// 比赛流程：startRace / loop / draw / endRace。
// 这是游戏的核心循环，从主入口注入 ctx（含 state、canvas、ctx2d、UI 元素引用）。
import { isKeyDown } from '../utils/keyboard.js';
import { getVirtualKeys } from '../utils/input.js';
import { getTrack, getPitBox } from './track.js';
import { createCar, controlCar, updateCar, collideBoundary, collidePitBarrier, collideCars } from './car.js';
import { createAI, updateAI } from './ai.js';
import { drawTrack } from '../renderer/track-render.js';
import { drawCar } from '../renderer/car-render.js';
import { drawHUD, drawSplitHUD, fmtTime, renderRanks } from '../renderer/hud.js';
import { drawSky, drawClouds, drawRain, drawSpeedLines } from '../renderer/scenery.js';
import {
  setupRaceCar, createWeather, updateWeather, updateRaceSystems, shouldAIPit,
  computeStandings, createRaceControl, updateRaceControl, addPenalty,
  dryTyreRuleSatisfied, POINTS
} from './race-systems.js';
import { applyVehicleSetup } from './vehicle-config.js';
import { gridPosition } from './grid.js';
import { computeZoom, updateCam } from './camera.js';
import { ALL_TEAMS, DIFFICULTY_SKILL, LIVERIES } from './teams-data.js';
import { saveRank, saveRaceHistory, saveSeasonRound, SEASON_TRACKS, getHistoricalSplits } from '../utils/storage.js';
import { transition } from '../state-machine.js';
import { trackLocalName } from './track-meta.js';
import { t, isZh, teamName } from '../i18n.js';

const $ = s => document.querySelector(s);

// 收集玩家车辆/调校/天气等元数据，用于排行榜展示
function buildRankMeta(car, state) {
  return {
    trackId: state?.trackId || '',
    team: car?.team || '',
    number: car?.number ?? '',
    tyre: car?.startingCompound || car?.tyre || '',
    vehicle: state?.vehicleSetup?.model || '',
    weather: state?.weather?.forecast || ''
  };
}

// —— 结果分页（完整成绩 + 排行榜）——
let resultPage = 0;
let resultPages = [];

export function buildResultPages(items) {
  // 结算主区域现在可以独立滚动。成绩卡必须作为一个完整页面展示，
  // 否则按卡片高度拆页时，长卡片会独占一页，看起来像只渲染了一项。
  return [Array.from(items)];
}

export function showResultPage(index) {
  const grid = $('#resultGrid');
  const ranking = $('#over .ranking');
  const total = resultPages.length + 1;
  resultPage = Math.max(0, Math.min(total - 1, index));
  [...grid.children].forEach(el => { el.style.display = 'none'; });
  if (resultPage < resultPages.length) {
    grid.classList.remove('hidden');
    ranking.classList.add('hidden');
    resultPages[resultPage].forEach(el => { el.style.display = ''; });
  } else {
    grid.classList.add('hidden');
    ranking.classList.remove('hidden');
  }
  $('#resultPageLabel').textContent = `${resultPage + 1} / ${total}`;
  $('#resultPrev').disabled = resultPage === 0;
  $('#resultNext').disabled = resultPage === total - 1;
}

export function setupResultPagination() {
  const items = [...$('#resultGrid').children];
  resultPages = buildResultPages(items);
  showResultPage(0);
}

export function startRace(ctx, mode, trackId, session = (mode === 'race' || mode === 'duel') ? 'qualifying' : 'timeTrial') {
  const state = ctx.state;
  state.mode = mode;
  state.session = session;
  state.trackId = trackId;
  const baseTrack = getTrack(trackId);
  // duel 双人正赛用可设置的圈数；race 大奖赛正赛固定 3 圈；solo 计时赛用所选圈数；其余排位计时 1 圈
  const raceLaps = (mode === 'duel' && session === 'race') ? state.raceLaps
                 : (mode === 'solo' && session === 'timeTrial') ? state.soloLaps
                 : session === 'race' ? 3 : 1;
  state.track = { ...baseTrack, laps: raceLaps };
  state.raceTime = 0;
  state.countdown = 5.2;
  state.running = true;
  state.paused = false;
  state.nextRaceReady = false;
  state.nextSeasonReady = false;
  state.nextSeasonTrackId = null;
  state.weather = createWeather(state.weatherKind);
  state.raceControl = createRaceControl();
  state.gaps = new Map();
  state.last = performance.now();
  $('#restart').textContent = t('再来一局 [R]');

  // 正赛按排位赛成绩发车（race 玩家从排位名次起步，duel/solo 从首位起步）
  const playerSlot = session === 'race' ? state.playerGridOrder : 0;
  const playerGrid = gridPosition(state.track, playerSlot);
  const ang = Math.atan2(playerGrid.p.ty, playerGrid.p.tx);
  const selectedTeam = ALL_TEAMS.find(team => team.team === state.selectedTeam) || ALL_TEAMS[0];
  const selectedLivery = selectedTeam.team === 'VECTOR'
    ? (LIVERIES[state.livery] || LIVERIES.cobalt)
    : selectedTeam;
  state.player = createCar({
    x: playerGrid.x, y: playerGrid.y, angle: ang,
    color: selectedLivery.color, accent: selectedLivery.accent, name: t('你')
  });
  state.player.number = selectedTeam.number;
  state.player.team = selectedTeam.team;
  state.player.gridOrder = playerSlot;
  state.player.lapStartTime = 0;
  state.player._lastS = playerGrid.p.s;
  state.player._cum = 0;
  state.player.splits12 = [[]];
  state.player._s12Idx = 0;
  state.player._s12Start = 0;
  state.player.splits3 = [[]];
  state.player._s3Idx = 0;
  state.player._s3Start = 0;

  setupRaceCar(state.player, state.startingTyre);
  applyVehicleSetup(state.player, state.vehicleSetup);
  state.player.worldSpeedScale = state.settings.movementScale;
  state.player.pitBox = getPitBox(state.track, selectedTeam.team);

  // race 模式（大奖赛周末）：单人 + 6 个 AI 对手；正赛按排位成绩发车。
  if (mode === 'race' && session === 'race') {
    const baseSkill = DIFFICULTY_SKILL[state.difficulty];
    const opponentTeams = ALL_TEAMS.filter(team => team.team !== selectedTeam.team);
    const aiQualOrder = state.qualifyingResults ? state.qualifyingResults.filter(r => !r.player).map(r => r.team) : opponentTeams.map(t => t.team);
    state.ais = opponentTeams.map((team) => {
      const slot = aiQualOrder.indexOf(team.team);
      const adjustedSlot = slot >= state.playerGridOrder ? slot + 1 : slot;
      const grid = gridPosition(state.track, adjustedSlot);
      const ai = createAI({
        track: state.track,
        color: team.color, accent: team.accent, name: team.team,
        skill: baseSkill + (slot % 3 - 1) * 0.025,
        offsetLateral: slot % 2 === 0 ? -35 : 35
      });
      ai.x = grid.x; ai.y = grid.y;
      ai.angle = Math.atan2(grid.p.ty, grid.p.tx);
      ai.number = team.number; ai.team = team.team;
      ai.gridOrder = adjustedSlot;
      ai.lapStartTime = 0; ai._lastS = grid.p.s; ai._cum = 0;
      setupRaceCar(ai, ['soft', 'medium', 'hard'][adjustedSlot % 3]);
      ai.worldSpeedScale = state.settings.movementScale;
      ai.pitBox = getPitBox(state.track, team.team);
      return ai;
    });
    state.ai = state.ais[0];
  } else {
    state.ais = [];
    state.ai = null;
  }

  // P2 玩家车（仅 duel 双人模式）
  if (mode === 'duel') {
    const p2TeamId = state.selectedTeam2 || ALL_TEAMS.find(t => t.team !== selectedTeam.team).team;
    const p2Team = ALL_TEAMS.find(t => t.team === p2TeamId) || ALL_TEAMS[1];
    const p2Slot = session === 'race' ? state.player2GridOrder : 1;
    const p2Grid = gridPosition(state.track, p2Slot);
    const p2Ang = Math.atan2(p2Grid.p.ty, p2Grid.p.tx);
    state.player2 = createCar({
      x: p2Grid.x, y: p2Grid.y, angle: p2Ang,
      color: p2Team.color, accent: p2Team.accent, name: 'P2'
    });
    state.player2.number = p2Team.number;
    state.player2.team = p2Team.team;
    state.player2.gridOrder = p2Slot;
    state.player2.lapStartTime = 0;
    state.player2._lastS = p2Grid.p.s;
    state.player2._cum = 0;
    setupRaceCar(state.player2, state.startingTyre2 || 'medium');
    applyVehicleSetup(state.player2, state.vehicleSetup2);
    state.player2.worldSpeedScale = state.settings.movementScale;
    state.player2.pitBox = getPitBox(state.track, p2Team.team);
  } else {
    state.player2 = null;
  }

  // 相机初始：duel 双人模式近景跟车，其余模式按赛道 bounding box 自适应。
  const baseZoom = (mode === 'duel') ? 0.82 : computeZoom(state.track);
  state.cam.zoom = baseZoom;
  state.cam.x = -(state.player.x + Math.cos(state.player.angle) * 90) * state.cam.zoom + innerWidth / 2;
  state.cam.y = -(state.player.y + Math.sin(state.player.angle) * 90) * state.cam.zoom + innerHeight / 2;
  if (state.player2) {
    state.cam2.zoom = baseZoom;
    const halfW = innerWidth / 2;
    state.cam2.x = -(state.player2.x + Math.cos(state.player2.angle) * 90) * state.cam2.zoom + halfW / 2;
    state.cam2.y = -(state.player2.y + Math.sin(state.player2.angle) * 90) * state.cam2.zoom + innerHeight / 2;
  }

  // 隐藏所有菜单面板，切到 racing 阶段
  $('#menu').classList.add('hidden');
  $('#trackSelect').classList.add('hidden');
  $('#raceSetup').classList.add('hidden');
  $('#over').classList.add('hidden');
  $('#pausePanel').classList.add('hidden');
  $('#rulesPanel').classList.add('hidden');
  transition('racing');

  // 双人模式开赛前展示手机手柄地址，等手柄连上
  if (ctx.gamepadEnabled && mode === 'duel' && session === 'qualifying') {
    ctx.showQrPanel?.();
  }
  ctx.updateGamepadHud?.();

  requestAnimationFrame((t) => loop(ctx, t));
}

export function loop(ctx, now) {
  const state = ctx.state;
  if (!state.running) return;
  const dt = Math.min((now - state.last) / 1000, 0.033);
  state.last = now;
  if (state.paused) { draw(ctx); requestAnimationFrame((t) => loop(ctx, t)); return; }

  // 倒计时
  if (state.countdown > 0) {
    state.countdown -= dt;
    if (isKeyDown('KeyW') && !state.player._jumpStartPenalized) {
      addPenalty(state.player, 5, t('抢跑'));
      state.player._jumpStartPenalized = true;
    }
    if (state.countdown <= 0) {
      state.countdown = 0;
      state.player.lapStartTime = 0;
      state.ais.forEach(ai => { ai.lapStartTime = 0; });
    }
  } else {
    state.raceTime += dt;
  }

  // 输入
  if (state.countdown <= 0 && !state.player.finished) {
    const vk1 = getVirtualKeys('p1');
    controlCar(state.player, {
      left: isKeyDown('ArrowLeft') || vk1.left,
      right: isKeyDown('ArrowRight') || vk1.right,
      up: isKeyDown('KeyW') || vk1.up,
      autoSpeedHold: state.settings.autoSpeedHold,
      down: isKeyDown('KeyD') || vk1.down,
      emergency: isKeyDown('KeyS') || vk1.emergency,
      reverse: isKeyDown('KeyX') || vk1.reverse,
      boost: isKeyDown('Space') || vk1.boost
    });
  } else {
    state.player.throttle = 0; state.player.brake = 0; state.player.emergencyBrake = 0;
    state.player.reverse = 0; state.player.steer = 0;
  }
  // P2 输入（仅双人模式）
  if (state.player2 && state.mode !== 'solo') {
    if (state.countdown <= 0 && !state.player2.finished) {
      const vk2 = getVirtualKeys('p2');
      controlCar(state.player2, {
        left: vk2.left, right: vk2.right, up: vk2.up,
        autoSpeedHold: state.settings.autoSpeedHold,
        down: vk2.down, emergency: vk2.emergency,
        reverse: vk2.reverse, boost: vk2.boost
      });
    } else {
      state.player2.throttle = 0; state.player2.brake = 0; state.player2.emergencyBrake = 0;
      state.player2.reverse = 0; state.player2.steer = 0;
    }
  }

  // 更新
  if (state.countdown <= 0) {
    const racers = state.player2
      ? [state.player, state.player2, ...state.ais]
      : [state.player, ...state.ais];
    updateWeather(state.weather, dt, state.raceTime);
    const standings = computeStandings(state);
    state.gaps = standings.gaps;
    racers.forEach(car => updateRaceSystems(car, dt, state));
    if (state.settings.assists) state.player.gripMultiplier *= 1.07;
    if (state.settings.assists && state.player2) state.player2.gripMultiplier *= 1.07;
    // duel 双人对决是纯竞速，不触发黄旗、不限速、不罚时。
    const isDuelRace = state.mode === 'duel';
    if (!isDuelRace) {
      updateRaceControl(state.raceControl, racers, dt);
      const currentPosition = standings.gaps.get(state.player)?.position || 1;
      if (state.raceControl.yellow) {
        if (!state.yellowPlayerPosition) state.yellowPlayerPosition = currentPosition;
      } else {
        state.yellowPlayerPosition = 0;
        state.yellowOvertakePenalized = false;
      }
    }
    state.ais.forEach(ai => shouldAIPit(ai, state));
    const oldCollision = state.player.collisionFlash || 0;
    updateCar(state.player, dt, state.track, state.raceTime);
    collideBoundary(state.player, state.track);
    collidePitBarrier(state.player, state.track);
    if (state.player2) {
      updateCar(state.player2, dt, state.track, state.raceTime);
      collideBoundary(state.player2, state.track);
      collidePitBarrier(state.player2, state.track);
    }
    state.ais.forEach(ai => {
      updateAI(ai, dt, state.track, state.raceTime, racers, state);
      collideBoundary(ai, state.track);
      collidePitBarrier(ai, state.track);
    });
    if (!isDuelRace && state.raceControl.yellow) racers.forEach(car => {
      if (car.v > 205) {
        const scale = 205 / Math.max(1, car.v);
        car.v = 205; car.velX *= scale; car.velY *= scale;
      }
    });
    if (state.settings.collision !== 'off') {
      collideCars(racers);
      if (state.settings.collision === 'reduced') racers.forEach(car => {
        car.spinTimer *= 0.35;
        car.damage = Math.max(0, car.damage - dt * 12);
      });
    }
    racers.forEach(car => { collideBoundary(car, state.track); collidePitBarrier(car, state.track); });
    if (!isDuelRace) {
      const afterPosition = computeStandings(state).gaps.get(state.player)?.position || 1;
      if (state.raceControl.yellow && afterPosition < state.yellowPlayerPosition && !state.yellowOvertakePenalized) {
        addPenalty(state.player, 5, t('黄旗下超车'));
        state.yellowOvertakePenalized = true;
      }
    }
    if (!oldCollision && state.player.collisionFlash) state.cam.shake = 11;
  }

  // 相机：单视图模式 P1 完赛后切到 P2；分屏模式左跟 player（完赛后冻结），右跟 player2
  const isDuel = state.mode === 'duel' && state.player2;
  const singleCamTarget = (isDuel && state.player.finished && !state.player2.finished)
                    ? state.player2 : state.player;
  const halfW = innerWidth / 2;
  if (isDuel) {
    if (!state.player.finished) updateCam(state.cam, state.player, halfW, halfW / 2, dt);
    updateCam(state.cam2, state.player2, halfW, halfW + halfW / 2, dt);
  } else {
    updateCam(state.cam, singleCamTarget, innerWidth, innerWidth / 2, dt);
  }

  // 渲染
  draw(ctx);

  // 推送玩家状态给手机手柄
  ctx.pushPlayerState?.(state);

  // 结束判定
  const p1Done = state.player.finished;
  const p2Done = state.player2 && state.mode !== 'solo' ? state.player2.finished : false;
  if (p1Done || p2Done) {
    endRace(ctx);
    return;
  }

  draw(ctx);

  requestAnimationFrame((t) => loop(ctx, t));
}

function draw(ctx) {
  const state = ctx.state;
  if (state.mode === 'duel' && state.player2) drawSplitView(ctx);
  else drawSingleView(ctx);
}

function drawSingleView(ctx) {
  const { ctx2d: ctxc, state } = ctx;
  drawSky(ctxc, innerWidth, innerHeight);
  drawClouds(ctxc, innerWidth, innerHeight, state.raceTime);
  if (state.weather.raining || state.weather.wetness > 0.08) drawRain(ctxc, innerWidth, innerHeight, state.raceTime, state.weather.wetness);
  drawSpeedLines(ctxc, innerWidth, innerHeight, Math.abs(state.player.v), state.raceTime);

  ctxc.save();
  ctxc.translate(state.cam.x, state.cam.y);
  ctxc.scale(state.cam.zoom, state.cam.zoom);
  drawTrack(ctxc, state.track, state.cam, state.weather);
  state.ais.forEach(ai => drawCar(ctxc, ai));
  if (state.player2) drawCar(ctxc, state.player2);
  drawCar(ctxc, state.player);
  ctxc.restore();

  drawHUD(ctxc, innerWidth, innerHeight, state);
}

function drawSplitView(ctx) {
  const { ctx2d: ctxc, state } = ctx;
  const halfW = innerWidth / 2;
  drawSky(ctxc, innerWidth, innerHeight);
  drawClouds(ctxc, innerWidth, innerHeight, state.raceTime);
  if (state.weather.raining || state.weather.wetness > 0.08) drawRain(ctxc, innerWidth, innerHeight, state.raceTime, state.weather.wetness);

  // 左视图（P1）
  ctxc.save();
  ctxc.beginPath();
  ctxc.rect(0, 0, halfW, innerHeight);
  ctxc.clip();
  ctxc.translate(state.cam.x, state.cam.y);
  ctxc.scale(state.cam.zoom, state.cam.zoom);
  drawTrack(ctxc, state.track, state.cam, state.weather);
  state.ais.forEach(ai => drawCar(ctxc, ai));
  if (state.player2) drawCar(ctxc, state.player2);
  drawCar(ctxc, state.player);
  ctxc.restore();

  // 右视图（P2）
  ctxc.save();
  ctxc.beginPath();
  ctxc.rect(halfW, 0, halfW, innerHeight);
  ctxc.clip();
  ctxc.translate(state.cam2.x, state.cam2.y);
  ctxc.scale(state.cam2.zoom, state.cam2.zoom);
  drawTrack(ctxc, state.track, state.cam2, state.weather);
  state.ais.forEach(ai => drawCar(ctxc, ai));
  if (state.player2) drawCar(ctxc, state.player2);
  drawCar(ctxc, state.player);
  ctxc.restore();

  // 中间分隔线
  ctxc.fillStyle = '#2b2b33';
  ctxc.fillRect(halfW - 2, 0, 4, innerHeight);

  drawSplitHUD(ctxc, innerWidth, innerHeight, state);
}

export function endRace(ctx) {
  const state = ctx.state;
  try {
    state.running = false;
    ctx.updateGamepadHud?.();
    transition('results');
    const p = state.player;
    if (state.session === 'race' && !dryTyreRuleSatisfied(p, state.weather) && !p._tyreRulePenalized) {
      addPenalty(p, 20, t('未完成一次换胎'));
      p._tyreRulePenalized = true;
    }
    const opponents = state.ais || [];
    const progressOf = car => car.finished
      ? state.track.totalLength + 1000000 - car.finishTime
      : car.lap * state.track.totalLength + (car._cum || 0) - (car.gridOrder || 0) * 0.01;
    const ordered = [...opponents].sort((a, b) => progressOf(b) - progressOf(a));
    const ai = ordered[0] || null;
    const pTotal = p.finishTime > 0 ? p.finishTime : state.raceTime;
    const pBest = p.bestLap != null ? p.bestLap : (p.lapTimes[0] || 0);

    if (state.session === 'qualifying') {
      if (state.mode === 'duel' && state.player2) {
        // 双人对决：用 P1/P2 真实圈速定杆位
        const p2Total = state.player2.finishTime > 0 ? state.player2.finishTime : state.raceTime;
        const p2Best = state.player2.bestLap != null ? state.player2.bestLap : (state.player2.lapTimes[0] || p2Total);
        const results = [
          { team: p.team, number: p.number, time: pBest || pTotal, player: true },
          { team: state.player2.team, number: state.player2.number, time: p2Best || p2Total, player2: true }
        ].sort((a, b) => a.time - b.time);
        state.qualifyingResults = results;
        state.playerGridOrder = results.findIndex(r => r.player);
        state.player2GridOrder = results.findIndex(r => r.player2);
        state.nextRaceReady = true;
        $('#overBadge').textContent = 'QUALIFYING';
        $('#overBadge').style.background = '#7c3aed';
        const p1Pos = state.playerGridOrder + 1;
        const p2Pos = state.player2GridOrder + 1;
        $('#overTitle').textContent = t('排位赛 · P1 第{p1} · P2 第{p2}', { p1: p1Pos, p2: p2Pos });
        $('#winnerBanner').textContent = t('杆位 {x} · {time}', { x: results[0].player2 ? 'P2' : 'P1', time: fmtTime(results[0].time) });
        $('#winnerBanner').classList.remove('hidden');
        $('#resultGrid').innerHTML = `<div class="result-cell" style="grid-column:1/-1"><div class="lbl">${t('双人对决发车顺序')}</div><div style="margin-top:9px;line-height:1.9;text-align:left">${results.map((r, i) => `<b>P${i + 1}</b> ${r.player ? 'P1 · ' : 'P2 · '}${teamName(r.team)} #${r.number} <span style="float:right;color:${r.player ? '#3a86ff' : '#e84545'}">${fmtTime(r.time)}</span>`).join('<br>')}</div></div>`;
        $('#restart').textContent = t('开始正赛');
        renderRanks($('#rankList2'));
        setupResultPagination();
        $('#over').classList.remove('hidden');
        return;
      }
      const baseSkill = DIFFICULTY_SKILL[state.difficulty];
      const results = [
        { team: p.team, number: p.number, time: pBest || pTotal, player: true },
        ...ALL_TEAMS.filter(team => team.team !== p.team).map((team, i) => ({
          ...team,
          time: (pBest || pTotal) * (1.08 - baseSkill * 0.1 + (i - 2) * 0.008)
        }))
      ].sort((a, b) => a.time - b.time);
      state.qualifyingResults = results;
      state.playerGridOrder = results.findIndex(r => r.player);
      state.player2GridOrder = state.player2 ? Math.max(0, 1 - state.playerGridOrder) : 1;
      state.nextRaceReady = true;
      $('#overBadge').textContent = 'QUALIFYING';
      $('#overBadge').style.background = '#7c3aed';
      $('#overTitle').textContent = t('排位赛 P{pos}', { pos: state.playerGridOrder + 1 });
      $('#winnerBanner').textContent = t('杆位 {x} · {time}', { x: teamName(results[0].team), time: fmtTime(results[0].time) });
      $('#winnerBanner').classList.remove('hidden');
      $('#resultGrid').innerHTML = `<div class="result-cell" style="grid-column:1/-1"><div class="lbl">${t('正式发车顺序')}</div><div style="margin-top:9px;line-height:1.9;text-align:left">${results.map((r, i) => `<b>P${i + 1}</b> ${r.player ? t('你 · ') : ''}${teamName(r.team)} #${r.number} <span style="float:right;color:${r.player ? '#3a86ff' : '#666'}">${fmtTime(r.time)}</span>`).join('<br>')}</div></div>`;
      $('#restart').textContent = t('开始正赛');
      if (p.finished) saveRank(state.track.name, pTotal, pBest, buildRankMeta(p, state));
      renderRanks($('#rankList2'));
      setupResultPagination();
      $('#over').classList.remove('hidden');
      return;
    }

    const finalStanding = computeStandings(state);
    const position = finalStanding.ordered.indexOf(p) + 1;
    const win = position === 1;

    // 双人正赛：显示 P1/P2 真实完赛时间对比
    if (state.mode === 'duel' && state.player2) {
      const p2 = state.player2;
      const p1Total = p.finishTime > 0 ? p.finishTime : state.raceTime;
      const p2Total = p2.finishTime > 0 ? p2.finishTime : state.raceTime;
      const p1Best = p.bestLap != null ? p.bestLap : (p.lapTimes[0] || 0);
      const p2Best = p2.bestLap != null ? p2.bestLap : (p2.lapTimes[0] || 0);
      const p1Win = (p1Total + (p.penalty || 0)) <= (p2Total + (p2.penalty || 0));
      $('#overBadge').textContent = t(p1Win ? '🏆 P1 胜利' : '🏆 P2 胜利');
      $('#overBadge').style.background = p1Win ? '#3a86ff' : '#e84545';
      $('#overTitle').textContent = t(p1Win ? 'P1 获胜！' : 'P2 获胜！');
      const gap = Math.abs((p1Total + (p.penalty || 0)) - (p2Total + (p2.penalty || 0)));
      $('#winnerBanner').textContent = t('{x} 率先完赛 · 差距 {time}', { x: p1Win ? 'P1' : 'P2', time: fmtTime(gap) });
      $('#winnerBanner').classList.remove('hidden');

      const penFormat = item => t('{reason} +{s}秒', { reason: item.reason, s: item.seconds });
      const p1PenaltyList = (p.penaltyReasons || []).map(penFormat).join(isZh() ? '、' : ', ') || t('无');
      const p2PenaltyList = (p2.penaltyReasons || []).map(penFormat).join(isZh() ? '、' : ', ') || t('无');
      const duelHtml = `
        <div class="result-cell ${p1Win ? 'win' : 'lose'}">
          <div class="lbl">${t('P1 总用时（含罚时）')}</div>
          <div class="val" style="color:#3a86ff">${fmtTime(p1Total + (p.penalty || 0))}</div>
          <div style="font-size:12px;margin-top:6px;color:#666">${t('完赛 {time} · 罚时 +{s}s', { time: fmtTime(p1Total), s: (p.penalty || 0).toFixed(2) })}</div>
          <div style="font-size:11px;margin-top:4px;color:#888">${t('罚时明细：')}${p1PenaltyList}</div>
        </div>
        <div class="result-cell ${p1Win ? '' : 'lose'}">
          <div class="lbl">${t('P2 总用时（含罚时）')}</div>
          <div class="val" style="color:#e84545">${fmtTime(p2Total + (p2.penalty || 0))}</div>
          <div style="font-size:12px;margin-top:6px;color:#666">${t('完赛 {time} · 罚时 +{s}s', { time: fmtTime(p2Total), s: (p2.penalty || 0).toFixed(2) })}</div>
          <div style="font-size:11px;margin-top:4px;color:#888">${t('罚时明细：')}${p2PenaltyList}</div>
        </div>
        <div class="result-cell">
          <div class="lbl">${t('P1 最佳圈速')}</div>
          <div class="val" style="color:#3a86ff">${fmtTime(p1Best)}</div>
        </div>
        <div class="result-cell">
          <div class="lbl">${t('P2 最佳圈速')}</div>
          <div class="val" style="color:#e84545">${fmtTime(p2Best)}</div>
        </div>
        <div class="result-cell" style="grid-column:1/-1">
          <div class="lbl">${t('单圈明细')}</div>
          <div style="font-size:13px;margin-top:6px;line-height:1.7">
            ${p.lapTimes.map((lt, i) => `${t('P1 第 {i} 圈', { i: i + 1 })} <b style="color:#3a86ff">${fmtTime(lt)}</b>`).join(' · ')}
            <br>${p2.lapTimes.map((lt, i) => `${t('P2 第 {i} 圈', { i: i + 1 })} <b style="color:#e84545">${fmtTime(lt)}</b>`).join(' · ')}
          </div>
        </div>`;
      $('#resultGrid').innerHTML = duelHtml;
      if (p.finished) saveRank(state.track.name, p1Total, p1Best, buildRankMeta(p, state));
      renderRanks($('#rankList2'));
      setupResultPagination();
      $('#over').classList.remove('hidden');
      return;
    }

    // 标题
    if (ai) {
      $('#overBadge').textContent = win ? t('🏆 胜利') : t('P{position} 完赛', { position });
      $('#overBadge').style.background = win ? '#3a86ff' : '#e84545';
      $('#overTitle').textContent = win ? t('你赢了！') : t('第 {position} 名完赛', { position });
      $('#winnerBanner').textContent = win ? t('🏆 大奖赛冠军！') : t('冠军 {team} · {time}', { team: teamName(ai.team), time: fmtTime(ai.finishTime) });
      $('#winnerBanner').classList.remove('hidden');
    } else {
      $('#overBadge').textContent = t('计时挑战');
      $('#overBadge').style.background = '#3a86ff';
      $('#overTitle').textContent = t('挑战完成');
      $('#winnerBanner').classList.add('hidden');
    }

    // 结果网格
    const grid = $('#resultGrid');
    let html = `
      <div class="result-cell ${ai ? 'win' : ''}">
        <div class="lbl">${t('你的总时间 ')}${p.penalty ? t('· 罚时 +{s}s', { s: p.penalty }) : ''}</div>
        <div class="val">${fmtTime(pTotal + p.penalty)}</div>
      </div>
      <div class="result-cell">
        <div class="lbl">${t('你的最佳圈速')}</div>
        <div class="val" style="color:#3a86ff">${fmtTime(pBest)}</div>
      </div>
    `;
    if (ai) {
      const aiTotal = ai.finishTime || state.raceTime;
      const aiBest = ai.bestLap != null ? ai.bestLap : (ai.lapTimes[0] || 0);
      html += `
        <div class="result-cell ${win ? '' : 'lose'}">
          <div class="lbl">${t('领先对手 · {team}', { team: teamName(ai.team) })}</div>
          <div class="val">${fmtTime(aiTotal)}</div>
        </div>
        <div class="result-cell">
          <div class="lbl">${t('领先对手最佳圈速')}</div>
          <div class="val" style="color:#e84545">${fmtTime(aiBest)}</div>
        </div>
      `;
      html += `<div class="result-cell" style="grid-column:1/-1">
        <div class="lbl">${t('单圈明细')}</div>
        <div style="font-size:13px;margin-top:6px;line-height:1.7">
          ${p.lapTimes.map((lt, i) => `${t('第 {i} 圈', { i: i + 1 })} <b style="color:#3a86ff">${fmtTime(lt)}</b>`).join(' · ')}
          ${ai ? '<br>' + ai.lapTimes.map((lt, i) => `${t('对手第 {i} 圈', { i: i + 1 })} <b style="color:#e84545">${fmtTime(lt)}</b>`).join(' · ') : ''}
        </div>
      </div>`;
    }
    // 单人计时赛：双视图分段明细（12 等分 + 3 等分）
    if (state.session === 'timeTrial' && p.splits12 && p.splits12.length) {
      // 12 等分着色：默认红白交替；同赛道历史中最快段紫、第二段绿
      const buildSectorColors = (splits, N, trackName) => {
        const colors = Array.from({ length: N }, (_, i) => i % 2 === 0 ? '#e84545' : '#ffffff');
        const currentBest = [];
        for (let si = 0; si < N; si++) {
          const vals = splits.map(lap => lap[si]).filter(v => v != null && !isNaN(v));
          currentBest.push(vals.length ? Math.min(...vals) : null);
        }
        const key = N === 12 ? 'splits12' : 'splits3';
        const historical = getHistoricalSplits(trackName, key);
        if (!historical.length) return colors;
        for (let si = 0; si < N; si++) {
          if (currentBest[si] == null) continue;
          let better = 0;
          for (const h of historical) {
            const v = h[si];
            if (v != null && !isNaN(v) && v < currentBest[si]) better++;
          }
          if (better === 0) colors[si] = '#9b5de5';       // 紫：创同赛道历史最快
          else if (better === 1) colors[si] = '#49d17d';  // 绿：同赛道历史第二
        }
        return colors;
      };
      const colors12 = buildSectorColors(p.splits12, 12, state.track.name);
      // 三等分：固定红/蓝/黄三段（从发车点开始）
      const colors3 = ['#e84545', '#3a86ff', '#ffd23f'];

      // 生成单个视图的 HTML（canvas + 表格）
      const renderView = (splits, N, colors, canvasId) => {
        const totalOf = (lap, li) => p.lapTimes[li] != null ? p.lapTimes[li] : lap.reduce((a, b) => a + (b || 0), 0);
        const totalColor = total => (p.bestLap != null && Math.abs(total - p.bestLap) < 1e-6) ? '#3a86ff' : '#2b2b33';
        // 表格数据统一深色，不在数字上叠加油墨色（颜色规则只用在微缩图）
        const cellHtml = (lap, si) => {
          const v = lap[si];
          if (v == null || isNaN(v)) return '<td style="color:#999;text-align:center">—</td>';
          return `<td style="color:#2b2b33;font-weight:700;text-align:center">${fmtTime(v)}</td>`;
        };

        let tableHtml;
        if (N === 12) {
          // 每圈拆三行：表头1-6 / 数据1-6 / 表头7-12 / 数据7-12 / 总用时
          const rows = splits.map((lap, li) => {
            const total = totalOf(lap, li);
            const hdr = (arr) => arr.map(i =>
              `<th style="padding:5px 3px;text-align:center;font-size:10px;font-weight:700">${i}</th>`
            ).join('');
            return `
              <tr style="background:#3a3a44;color:#fff8e7">
                <th style="padding:5px 4px;text-align:center;font-size:10px">${t('圈')}</th>
                ${hdr([1,2,3,4,5,6])}
              </tr>
              <tr>
                <td style="color:#888;text-align:center;font-weight:700" rowspan="3">${t('第 {i} 圈', { i: li + 1 })}</td>
                ${Array.from({length:6}, (_, i) => cellHtml(lap, i)).join('')}
              </tr>
              <tr style="background:#3a3a44;color:#fff8e7">
                ${hdr([7,8,9,10,11,12])}
              </tr>
              <tr>
                ${Array.from({length:6}, (_, i) => cellHtml(lap, i + 6)).join('')}
              </tr>
              <tr>
                <td style="color:#888;text-align:center;font-weight:700">${t('总用时')}</td>
                <td colspan="6" style="color:${totalColor(total)};font-weight:800;text-align:center;font-size:14px;padding:7px 4px;border-top:1px solid #555">${fmtTime(total)}</td>
              </tr>`;
          }).join('');
          tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px"><tbody>${rows}</tbody></table>`;
        } else {
          // N=3：保持单行 + 总用时列
          const rows = splits.map((lap, li) => {
            const total = totalOf(lap, li);
            return `<tr>
              <td style="color:#888;text-align:center">${t('第 {i} 圈', { i: li + 1 })}</td>
              ${Array.from({length: N}, (_, si) => cellHtml(lap, si)).join('')}
              <td style="color:${totalColor(total)};font-weight:800;text-align:center">${fmtTime(total)}</td>
            </tr>`;
          }).join('');
          const ths = Array.from({ length: N }, (_, si) =>
            `<th style="padding:6px 5px;text-align:center;font-size:12px">${si + 1}</th>`
          ).join('');
          tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#2b2b33;color:#fff8e7">
              <th style="padding:6px 5px;text-align:center">${t('圈')}</th>
              ${ths}
              <th style="padding:6px 5px;text-align:center">${t('总用时')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        }

        const legend = N === 12
          ? `<div style="font-size:11px;color:#555;margin-top:6px;line-height:1.6">
              <span style="display:inline-block;width:10px;height:10px;background:#e84545;border-radius:2px;vertical-align:middle"></span> ${t('奇数段')}
              &nbsp;<span style="display:inline-block;width:10px;height:10px;background:#ffffff;border:1px solid #999;border-radius:2px;vertical-align:middle"></span> ${t('偶数段')}
              &nbsp;<span style="display:inline-block;width:10px;height:10px;background:#9b5de5;border-radius:2px;vertical-align:middle"></span> ${t('创同赛道历史最快')}
              &nbsp;<span style="display:inline-block;width:10px;height:10px;background:#49d17d;border-radius:2px;vertical-align:middle"></span> ${t('同赛道历史第二')}
            </div>`
          : '';

        return `<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:10px">
          <div style="flex:0 0 auto">
            <canvas id="${canvasId}" width="${N > 8 ? 380 : 320}" height="280" style="background:#dff2cf;border:3px solid #2b2b33;border-radius:12px;display:block"></canvas>
            ${legend}
          </div>
          <div style="flex:1;min-width:280px;overflow-x:auto">${tableHtml}</div>
        </div>`;
      };

      html += `<div class="result-cell" style="grid-column:1/-1">
        <div class="lbl">${t('分段明细')}</div>
        <div style="margin-top:14px;padding:10px 14px;background:#f4f0e0;border-radius:10px">
          <div style="font-weight:900;font-size:14px;color:#2b2b33;margin-bottom:4px">${t('12 等分视图（每段约圈长 1/12）· 蓝=最佳圈总用时')}</div>
          ${renderView(p.splits12, 12, colors12, 'sectorMap12')}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:#f4f0e0;border-radius:10px">
          <div style="font-weight:900;font-size:14px;color:#2b2b33;margin-bottom:4px">${t('三等分视图（每段约圈长 1/3）· 从发车点开始 红/蓝/黄 三段 · 蓝=最佳圈总用时')}</div>
          ${renderView(p.splits3, 3, colors3, 'sectorMap3')}
        </div>
      </div>`;
      // DOM 插入后画微缩图
      queueMicrotask(() => {
        drawSectorMap(document.getElementById('sectorMap12'), state.track, 12, p.splits12, colors12);
        drawSectorMap(document.getElementById('sectorMap3'), state.track, 3, p.splits3, colors3);
      });
    }
    grid.innerHTML = html;

    // 存档（仅完赛才存）
    if (p.finished) {
      saveRank(state.track.name, pTotal, pBest, {
        ...buildRankMeta(p, state),
        splits12: p.splits12,
        splits3: p.splits3
      });
      const points = POINTS[position - 1] || 0;
      const career = saveRaceHistory({ track: state.track.name, position, points, total: +(pTotal + p.penalty).toFixed(2), bestLap: +pBest.toFixed(2), weather: state.weather.forecast });
      html += `<div class="result-cell" style="grid-column:1/-1"><div class="lbl">${t('锦标赛')}</div><div class="val">${t('本场 +{points} 分 · 总积分 {career}', { points, career: career.points })}</div></div>`;
      if (state.mode === 'race') {
        const season = saveSeasonRound(state.trackId, finalStanding.ordered, POINTS);
        state.season = season;
        const seasonRows = Object.entries(season.standings).sort((a,b) => b[1] - a[1]);
        html += `<div class="result-cell" style="grid-column:1/-1"><div class="lbl">${t('{n} 站锦标赛积分', { n: SEASON_TRACKS.length })}</div><div style="font-size:13px;margin-top:7px;line-height:1.8">${seasonRows.map(([team, pts], i) => `<b>P${i+1}</b> ${teamName(team)}<span style="float:right">${t('{points} 分', { points: pts })}</span>`).join('<br>')}</div></div>`;
        const currentIndex = SEASON_TRACKS.indexOf(state.trackId);
        if (!season.complete && currentIndex >= 0 && currentIndex < SEASON_TRACKS.length - 1) {
          state.nextSeasonTrackId = SEASON_TRACKS[currentIndex + 1];
          state.nextSeasonReady = true;
          $('#restart').textContent = t('下一站：{name}', { name: trackLocalName(state.nextSeasonTrackId, getTrack(state.nextSeasonTrackId).name) });
        } else if (season.complete) {
          state.seasonComplete = true;
          $('#restart').textContent = t('开始新赛季');
          html += `<div class="result-cell win" style="grid-column:1/-1"><div class="lbl">${t('赛季领奖台')}</div><div class="val">${season.podium.map(pod => `${pod.position === 1 ? '🏆' : pod.position === 2 ? '🥈' : '🥉'} ${teamName(pod.team)} ${t('{points} 分', { points: pod.points })}`).join(' · ')}</div></div>`;
        }
      }
      grid.innerHTML = html;
    }
    if (p.penaltyReasons?.length) {
      html += `<div class="result-cell lose" style="grid-column:1/-1"><div class="lbl">${t('处罚明细')}</div><div style="font-size:13px;margin-top:7px;line-height:1.8">${p.penaltyReasons.map(item => `${item.reason} <b>${t('+{s}秒', { s: item.seconds })}</b>`).join('<br>')}</div></div>`;
      grid.innerHTML = html;
    }
    renderRanks($('#rankList2'));
    setupResultPagination();
    $('#over').classList.remove('hidden');
  } catch (err) {
    console.error('[endRace]', err);
    $('#resultGrid').innerHTML = `<div class="result-cell"><div class="lbl">${t('错误')}</div><div class="val">${err.message}</div></div>`;
    $('#over').classList.remove('hidden');
  }
}

// 结算页微缩赛道图：把单圈 N 等分着色。
// 默认按"该段跨圈最快用时"在所有段中排名着色：紫=最快段，绿=第二快段，黄=其余。
// 传入 fixedColors 时改用固定配色（如三等分红蓝黄）。段边界标白点+段号。
function drawSectorMap(canvas, track, N, splits, fixedColors) {
  if (!canvas || !track || !N) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const s = track.samples;
  const n = s.length;
  const total = track.totalLength;
  // bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of s) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const pad = 14;
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * scale) / 2 - minX * scale;
  const oy = (H - spanY * scale) / 2 - minY * scale;
  const px = p => ox + p.x * scale;
  const py = p => oy + p.y * scale;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#dff2cf';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let colorOf;
  if (Array.isArray(fixedColors) && fixedColors.length === N) {
    colorOf = fixedColors;
  } else {
    // 每段跨圈最快用时
    const bestPerSector = [];
    for (let si = 0; si < N; si++) {
      const vals = splits.map(lap => lap[si]).filter(v => v != null && !isNaN(v));
      bestPerSector.push(vals.length ? Math.min(...vals) : null);
    }
    // 段间排名：最快紫、第二绿、其余黄
    const ranked = bestPerSector
      .map((v, i) => ({ v, i }))
      .filter(o => o.v != null)
      .sort((a, b) => a.v - b.v);
    colorOf = new Array(N).fill('#ffd23f'); // 黄
    if (ranked.length >= 1) colorOf[ranked[0].i] = '#9b5de5'; // 紫
    if (ranked.length >= 2) colorOf[ranked[1].i] = '#49d17d'; // 绿
  }

  // 段边界采样索引
  const sectorStartIdx = i => Math.floor((i * total / N) / total * n) % n;

  // 黑色描边底
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const p = s[i]; if (i === 0) ctx.moveTo(px(p), py(p)); else ctx.lineTo(px(p), py(p)); }
  ctx.closePath();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 8;
  ctx.stroke();

  // 按段着色
  for (let si = 0; si < N; si++) {
    const startIdx = sectorStartIdx(si);
    const endIdx = sectorStartIdx((si + 1) % N);
    const pts = [s[startIdx]];
    let cur = (startIdx + 1) % n;
    while (cur !== endIdx) { pts.push(s[cur]); cur = (cur + 1) % n; if (pts.length > n) break; }
    pts.push(s[endIdx]);
    ctx.beginPath();
    pts.forEach((p, k) => { if (k === 0) ctx.moveTo(px(p), py(p)); else ctx.lineTo(px(p), py(p)); });
    ctx.strokeStyle = colorOf[si];
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // 段边界白点 + 段号
  for (let si = 0; si < N; si++) {
    const p = s[sectorStartIdx(si)];
    const x = px(p), y = py(p);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, N > 8 ? 6 : 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2b33';
    ctx.font = `900 ${N > 8 ? 9 : 11}px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(si + 1), x, y);
  }
}

export function getResultPage() { return resultPage; }
