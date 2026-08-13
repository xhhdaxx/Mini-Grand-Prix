// src/renderer/hud.js — 卡通 HUD

import { PIT_TEAMS, getPitBox, getPitEntry, getPitExit, getPitRoutePoint, getPitConfig, listTracks } from '../game/track.js';
import { getStrategyAdvice } from '../game/race-systems.js';
import { trackLocalName } from '../game/track-meta.js';
import { t, teamName } from '../i18n.js';

export function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export function drawHUD(ctx, W, H, state) {
  const { player, track, raceTime, countdown, cam } = state;
  const ais = state.ais || (state.ai ? [state.ai] : []);
  const ai = ais[0] || null;
  // 圈速卡（340）和速度卡（200）作为一个整体居中，中间保留 12px 间距。
  const timingX = W / 2 - 276;
  const timingCenter = timingX + 170;
  const speedX = timingX + 352;

  // ===== 顶部面板（圆角卡片） =====
  // 左上：圈数
  card(ctx, 20, 18, 220, 210, '#fff8e7', '#2b2b33');
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(t('圈数'), 36, 28);
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = '#e84545';
  ctx.fillText(`${Math.min(player.lap + 1, track.laps)}/${track.laps}`, 36, 46);

  // 总时间
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(`${t('总时间')} ${fmtTime(raceTime)}`, 110, 60);

  // LAP 下方的赛道略缩图与实时车辆位置
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = '#555';
  ctx.fillText(t('赛道位置'), 36, 82);
  drawMiniMap(ctx, track, player, ais, 32, 98, 196, 118);

  // 中上：当前圈速 + 对比
  card(ctx, timingX, 18, 340, 70, '#fff8e7', '#2b2b33');
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(t('当前圈速'), timingCenter, 28);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#3a86ff';
  const curLap = player.finished
    ? (player.bestLap != null ? player.bestLap : 0)
    : (raceTime - (player.lapStartTime || 0));
  ctx.fillText(fmtTime(curLap), timingCenter, 44);

  // 最佳圈速对比
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = '#888';
  const bestLap = player.bestLap;
  const cmp = bestLap != null ? fmtTime(bestLap) : '--:--.--';
  ctx.fillText(`${t('最佳')} ${cmp}`, timingCenter - 80, 70);
  // AI 圈速对比
  const aiCur = ai ? (raceTime - (ai.lapStartTime || 0)) : null;
  ctx.fillStyle = '#e84545';
  ctx.fillText(`${t('对手')} ${ai ? fmtTime(aiCur) : '--:--.--'}`, timingCenter + 80, 70);

  // 右上：速度表
  card(ctx, speedX, 18, 200, 70, '#fff8e7', '#2b2b33');
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t('速度'), speedX + 20, 28);
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = '#3a86ff';
  const spd = Math.round(Math.abs(player.v) * 0.7); // 转 km/h 视觉值
  ctx.fillText(`${spd}`, speedX + 20, 46);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('km/h', speedX + 80, 60);

  // 速度条
  ctx.fillStyle = '#eee';
  roundRect(ctx, speedX + 124, 56, 66, 10, 5);
  ctx.fill();

  // 右侧遥测：挡位、转速、轮胎、天气与能量放电。
  card(ctx, W - 220, 18, 200, 142, '#fff8e7', '#2b2b33');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`${t('挡位')}  ${player.gear || 1}   ${(player.rpm || 0).toFixed(0)} RPM`, W - 204, 30);
  const tyreColors = { soft:'#ff3b45', medium:'#ffd23f', hard:'#eee', inter:'#49d17d', wet:'#3a86ff' };
  const tyreNames = { soft:t('软胎 S'), medium:t('中性胎 M'), hard:t('硬胎 H'), inter:t('半雨胎 I'), wet:t('全雨胎 W') };
  ctx.fillStyle = tyreColors[player.tyre] || '#ffd23f';
  ctx.beginPath(); ctx.arc(W - 194, 63, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#555';
  ctx.fillText(`${tyreNames[player.tyre] || t('中性胎 M')} · ${Math.round(player.tyreTemp || 0)}°C`, W - 174, 54);
  ctx.fillText(`${t('磨损')} ${Math.round(player.tyreWear || 0)}% · ${t('越界')} ${player.trackExitCount || 0}/5`, W - 174, 71);
  ctx.fillStyle = state.weather?.raining ? '#3a86ff' : '#666';
  ctx.fillText(`${state.weather?.raining ? '🌧' : '☁'} ${state.weather?.forecast || t('晴天')} · ${t('湿地')} ${Math.round((state.weather?.wetness || 0) * 100)}%`, W - 204, 96);
  ctx.fillStyle = player.boostActive ? '#13a85a' : player.boostCooldown > 0 ? '#e84545' : '#e29b00';
  const boostState = player.boostActive ? t('放电中') : player.boostCooldown > 0 ? `CD ${player.boostCooldown.toFixed(1)}s` : t('可用');
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${t('电池')} ${boostState} ${Math.round(player.boostCharge || 0)}%${player.regenRate > 0 ? ` · +${player.regenRate.toFixed(1)}/s` : ''}`, W - 204, 112);
  ctx.fillStyle = '#d8dde2'; roundRect(ctx, W - 204, 128, 168, 8, 4); ctx.fill();
  const charge = Math.max(0, Math.min(100, player.boostCharge || 0));
  ctx.fillStyle = player.energyFull ? '#49d17d' : player.boostActive ? '#3a86ff' : '#27c878';
  roundRect(ctx, W - 204, 128, 168 * charge / 100, 8, 4); ctx.fill();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(`${(player.vehicleModel || 'balanced').toUpperCase()} · ${t(state.session === 'race' ? '正赛' : state.session === 'qualifying' ? '排位赛' : '计时赛')} · ${t('进站')} ${player.pitStops || 0}`, W - 204, 142);

  if (state.session === 'race') {
    drawStrategyPopups(ctx, timingCenter, state, player);
  }

  drawLiveStandings(ctx, W - 220, 170, 200, state);
  drawPitGuidance(ctx, W, H, state);

  if (state.raceControl?.yellow || (player.warning && state.session !== 'race')) {
    const message = player.warning || state.raceControl.message;
    ctx.fillStyle = state.raceControl?.yellow ? '#ffd23f' : '#e84545';
    roundRect(ctx, W / 2 - 170, 98, 340, 36, 12); ctx.fill();
    ctx.fillStyle = '#202127'; ctx.textAlign = 'center'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(message, W / 2, 108);
  }
  const ratio = Math.min(1, Math.abs(player.v) / (player._maxV || 380));
  ctx.fillStyle = ratio > 0.8 ? '#e84545' : ratio > 0.5 ? '#ffb84d' : '#3a86ff';
  roundRect(ctx, speedX + 124, 56, 66 * ratio, 10, 5);
  ctx.fill();

  // ===== 倒计时 =====
  if (countdown > 0) {
    drawStartLights(ctx, countdown, W / 2);
  }

  // ===== 排位指示（左下） =====
  if (ais.length) {
    const progressOf = car => car.lap * track.totalLength + (car._cum || 0) - (car.gridOrder || 0) * 0.01;
    const playerProg = progressOf(player);
    const ranked = [player, ...ais].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTime - b.finishTime;
      return progressOf(b) - progressOf(a);
    });
    const position = ranked.indexOf(player) + 1;
    const closest = ais.reduce((best, rival) => {
      const progress = progressOf(rival);
      const gap = Math.abs(progress - playerProg);
      return !best || gap < best.gap ? { rival, gap, progress } : best;
    }, null);
    card(ctx, 20, H - 80, 200, 60, position === 1 ? '#d6f5d6' : '#ffe0e0', '#2b2b33');
    ctx.fillStyle = '#2b2b33';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`🏁 P${position}/6 · ${t(state.difficulty === 'easy' ? '简单' : state.difficulty === 'hard' ? '困难' : '普通')}`, 36, H - 70);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#666';
    const gapSeconds = closest.gap / Math.max(80, Math.abs(player.v));
    ctx.fillText(`${closest.progress > playerProg ? t('前车') : t('后车')} ${teamName(closest.rival.team)} · ${gapSeconds.toFixed(2)}s`, 36, H - 48);

    drawOpponentArrow(ctx, W, H, player, closest.rival, cam.zoom);
  }

  // ===== 控制提示（右下） =====
  // 三行紧凑排版，避免 Space / P 等较长标签溢出卡片边界。
  const controlsX = Math.max(20, W - 310);
  card(ctx, controlsX, H - 98, 290, 78, '#fff8e7', '#2b2b33');
  ctx.fillStyle = '#666';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(t('← → 转向 · W 加速 · D 刹车'), controlsX + 14, H - 86);
  ctx.fillText(t('S P区急停 · X 倒车 · Space 放电'), controlsX + 14, H - 65);
  ctx.fillText(t('P 进站 · 1–5 选胎 · Esc 暂停'), controlsX + 14, H - 44);
}

// 双人分屏 HUD：每视图左上角画圈速卡 + 速度卡 + 微缩地图。
// 倒计时和黄旗提示在两个半屏的中心各画一份，避免落在分屏中缝。
// 其余 HUD 元素（挡位/轮胎/能量/排名/控制提示/策略弹窗）在分屏下不展示。
export function drawSplitHUD(ctx, W, H, state) {
  const halfW = W / 2;
  drawPlayerPanel(ctx, 0, halfW, state.player, state.player2, state, '#3a86ff', 'P1');
  drawPlayerPanel(ctx, halfW, halfW, state.player2, state.player, state, '#e84545', 'P2');

  // 倒计时灯在每个半屏中心各显示一份
  if (state.countdown > 0) {
    drawStartLights(ctx, state.countdown, halfW / 2);
    drawStartLights(ctx, state.countdown, halfW + halfW / 2);
  }

  // 黄旗提示条在每个半屏顶部中心各显示一份
  if (state.raceControl?.yellow) {
    drawYellowFlagBanner(ctx, halfW / 2, state.raceControl.message);
    drawYellowFlagBanner(ctx, halfW + halfW / 2, state.raceControl.message);
  }
}

function drawYellowFlagBanner(ctx, centerX, message) {
  ctx.fillStyle = '#ffd23f';
  roundRect(ctx, centerX - 170, 14, 340, 32, 12);
  ctx.fill();
  ctx.fillStyle = '#202127';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(message, centerX, 30);
}

// 单个玩家面板：viewX 为该视图左上角 x（0 或 halfW），viewW 为该视图 CSS 像素宽度。
// 顶部居中放圈速 + 速度卡，左上角放地图 + 电量卡（竖向叠放）。
function drawPlayerPanel(ctx, viewX, viewW, car, rival, state, accent, label) {
  if (!car) return;
  const track = state.track;
  const raceTime = state.raceTime;
  const PAD = 14;

  // ===== 顶部居中：圈速卡 + 速度卡（并排）=====
  // 动态宽度：保证与左上角列（leftW）不重叠，最小留 16px 间隙
  const leftW = Math.min(200, Math.max(140, viewW * 0.28));
  const topCardGap = 8;
  // 顶部两卡可用宽度 = 视图宽 - 左上角列宽 - 左右各 14 padding - 两侧间隙
  const topAvail = viewW - leftW - PAD * 2 - 24;
  const topCardW = Math.max(110, Math.min(150, Math.floor((topAvail - topCardGap) / 2)));
  const topTotalW = topCardW * 2 + topCardGap;
  const topX = viewX + (viewW - topTotalW) / 2;
  const topY = 14;

  // 圈速卡
  card(ctx, topX, topY, topCardW, 64, '#fff8e7', '#2b2b33');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${label} · LAP`, topX + topCardW / 2, topY + 8);
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`${Math.min((car.lap || 0) + 1, track.laps)}/${track.laps}`, topX + topCardW / 2, topY + 24);
  ctx.fillStyle = '#666';
  ctx.font = 'bold 10px system-ui, sans-serif';
  const curLap = car.finished
    ? (car.bestLap != null ? car.bestLap : 0)
    : (raceTime - (car.lapStartTime || 0));
  ctx.fillText(`${t('当前')} ${fmtTime(curLap)}`, topX + topCardW / 2, topY + 48);

  // 速度卡
  const spdX = topX + topCardW + topCardGap;
  card(ctx, spdX, topY, topCardW, 64, '#fff8e7', '#2b2b33');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SPEED', spdX + 12, topY + 8);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = accent;
  const spd = Math.round(Math.abs(car.v || 0) * 0.7);
  ctx.fillText(`${spd}`, spdX + 12, topY + 24);
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('km/h', spdX + 60, topY + 38);
  // 速度条
  const ratio = Math.min(1, Math.abs(car.v || 0) / (car._maxV || 380));
  ctx.fillStyle = '#eee';
  roundRect(ctx, spdX + 12, topY + 50, topCardW - 24, 7, 4);
  ctx.fill();
  ctx.fillStyle = ratio > 0.8 ? '#e84545' : ratio > 0.5 ? '#ffb84d' : accent;
  roundRect(ctx, spdX + 12, topY + 50, (topCardW - 24) * ratio, 7, 4);
  ctx.fill();

  // ===== 左上角：电量卡 + 地图卡（竖向叠放）=====
  // leftW 已在上方动态计算
  // 电量卡
  const batY = topY;
  card(ctx, viewX + PAD, batY, leftW, 34, '#fff8e7', '#2b2b33');
  const charge = Math.max(0, Math.min(100, car.boostCharge || 0));
  const boostOn = !!car.boostActive;
  const boostCd = car.boostCooldown || 0;
  const batColor = boostOn ? '#3a86ff' : boostCd > 0 ? '#e84545' : car.energyFull ? '#49d17d' : '#e29b00';
  const batLabel = boostOn ? t('放电') : boostCd > 0 ? `CD ${boostCd.toFixed(1)}s` : car.energyFull ? t('满电') : t('充电');
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#2b2b33';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(t('电池'), viewX + PAD + 12, batY + 7);
  ctx.fillStyle = batColor;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText(`${batLabel} ${Math.round(charge)}%`, viewX + PAD + 12, batY + 20);
  // 电量条
  ctx.fillStyle = '#e8e8ee';
  roundRect(ctx, viewX + PAD + 92, batY + 18, 64, 9, 4); ctx.fill();
  ctx.fillStyle = batColor;
  roundRect(ctx, viewX + PAD + 92, batY + 18, 64 * charge / 100, 9, 4); ctx.fill();
  if ((car.regenRate || 0) > 0) {
    ctx.fillStyle = '#13a85a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText(`+${car.regenRate.toFixed(0)}`, viewX + PAD + 158, batY + 19);
  }

  // 地图卡：宽度取 leftW，高度按赛道 bounding box 比例计算；为横宽赛道设最小高度，避免挤压。
  const mapY = batY + 34 + 8;
  const mapW = leftW;
  const aspect = getTrackMapAspect(track);
  const drawW = mapW - 16; // 卡内绘制区宽度（左右各 8 padding）
  // 横宽赛道按比例算出的 drawH 偏矮，设最小 140 让车辆标记和 P 房图标不挤在一起；
  // drawMiniMap 内部用 min(scale) 等比缩放并居中，留白不会让赛道变形。
  const drawH = Math.max(140, Math.round(drawW / aspect));
  const mapH = drawH + 16; // 卡片高度 = 绘制区 + 上下各 8 padding
  card(ctx, viewX + PAD, mapY, mapW, mapH, '#fff8e7', '#2b2b33');
  const others = [];
  if (rival) others.push(rival);
  (state.ais || []).forEach(ai => others.push(ai));
  drawMiniMap(ctx, track, car, others, viewX + PAD + 8, mapY + 8, drawW, drawH);
}


function drawStrategyPopups(ctx, centerX, state, player) {
  const messages = [];
  if (player.warning) messages.push({ text: player.warning, color:'#ffd9d9', accent:'#e84545' });
  else if (state.raceControl?.yellow) messages.push({ text: state.raceControl.message, color:'#fff1b8', accent:'#d99a00' });

  const advice = getStrategyAdvice(player, state);
  if (advice.shouldPit) messages.push({ text:t('建议进站 · {reason} · 预计换胎后 P{pos}', { reason: advice.reason, pos: advice.rejoinPosition }), color:'#fff1c7', accent:'#e29b00' });

  const weather = state.weather;
  if (weather?.kind === 'dynamic') {
    const rt = state.raceTime || 0;
    const text = rt < 48 ? t('天气预告 · 约 {n} 秒后降雨', { n: Math.max(0, Math.ceil(48 - rt)) }) : rt < 112 ? t('天气预告 · 降雨持续，建议半雨胎/全雨胎') : t('天气预告 · 雨势结束，赛道将逐渐变干');
    messages.push({ text, color:'#dceeff', accent:'#3a86ff' });
  } else if (weather?.raining) messages.push({ text:t('天气预告 · 持续降雨'), color:'#dceeff', accent:'#3a86ff' });

  messages.slice(0, 3).forEach((item, i) => {
    const y = 98 + i * 43;
    card(ctx, centerX - 170, y, 340, 35, item.color, '#2b2b33');
    ctx.fillStyle = item.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(item.text, centerX, y + 10);
  });
}

function drawPitGuidance(ctx, W, H, state) {
  const car = state.player;
  const guidance = getPitGuidance(car, state.track);
  if (!guidance) return;
  const { target, label } = guidance;
  if (!target) return;
  const dx = target.x - car.x, dy = target.y - car.y;
  const distance = Math.hypot(dx, dy);
  const relative = Math.atan2(dy, dx) - car.angle;
  const x = W / 2, y = H - 105;
  ctx.save(); ctx.translate(x, y); ctx.rotate(relative);
  ctx.fillStyle = car.releaseSafe === false ? '#e84545' : '#ffd23f'; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-15, 10); ctx.lineTo(-5, 6); ctx.lineTo(-5, 24); ctx.lineTo(5, 24); ctx.lineTo(5, 6); ctx.lineTo(15, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#2b2b33';
  ctx.fillText(`${label} · ${Math.round(distance)}m`, x, y + 29);

  if (car.inPit && car.pitBoxDistance < 150 && !car._pitServiced) {
    card(ctx, W / 2 - 145, H - 190, 290, 66, '#fff8e7', '#2b2b33');
    const longitudinalLimit = car.pitBoxLongitudinalLimit || 19;
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px system-ui'; ctx.fillText(`${t('P房停车')} ${t(car.atPitBox ? '已进入本车队维修区' : (car.pitLongitudinalError || 0) < -longitudinalLimit ? '尚未进入' : (car.pitLongitudinalError || 0) > longitudinalLimit ? '已驶过' : '横向调整')}`, W / 2, H - 180);
    const progress = car.wheelProgress || [0,0,0,0];
    [-1, 1].forEach((side, si) => [-1, 1].forEach((row, ri) => {
      const i = si * 2 + ri;
      const wx = W / 2 + side * 82, wy = H - 151 + row * 10;
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(wx, wy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#13a85a'; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.arc(wx, wy, 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*progress[i]); ctx.closePath(); ctx.fill();
    }));
    ctx.fillStyle = '#e84545'; ctx.font = 'bold 18px system-ui'; ctx.fillText(`${Math.max(0, 2.5 - (car.pitTimer || 0)).toFixed(1)}s`, W / 2, H - 163);
  }
}

export function getPitGuidance(car, track) {
  if (car.awaitingRelease || car._pitServiced || car._pitExitActive) {
    return { target:getPitExit(track), label:t(car.releaseSafe === false ? '等待来车 · 暂勿出站' : '安全释放 · 前往 PIT OUT') };
  }
  if (!car._pitRequested && !car.inPit) return null;
  if (!car.inPit) return { target:getPitEntry(track), label:t('前往 PIT IN') };
  return { target:car.pitBox, label:t('前往 {team} P房', { team: teamName(car.pitBox?.team?.team || car.pitBox?.team?.short || 'MER') }) };
}

// 挡位面板下方的六车排名塔；差距为每辆车与其前车的实时估算秒差。
function drawLiveStandings(ctx, x, y, w, state) {
  const cars = [state.player, ...(state.ais || [])];
  const track = state.track;
  const progress = car => car.lap * track.totalLength + (car._cum || 0) - (car.gridOrder || 0) * 0.01;
  const ordered = [...cars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return (a.finishTime + (a.penalty || 0)) - (b.finishTime + (b.penalty || 0));
    return progress(b) - progress(a);
  });
  const h = 38 + ordered.length * 23;
  card(ctx, x, y, w, h, '#fff8e7', '#2b2b33');
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#2b2b33'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(t('实时排名'), x + 14, y + 10);

  ordered.forEach((car, i) => {
    const ry = y + 31 + i * 23;
    const isPlayer = car === state.player;
    if (isPlayer) {
      ctx.fillStyle = 'rgba(0,161,156,0.18)';
      roundRect(ctx, x + 7, ry - 3, w - 14, 21, 6); ctx.fill();
    }
    ctx.fillStyle = isPlayer ? '#007f7b' : (car.color || '#555');
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`P${i + 1}`, x + 14, ry);
    const shortName = isPlayer ? t('你') : teamName(car.team || car.name || 'AI');
    ctx.fillStyle = '#34353b';
    ctx.fillText(`#${car.number || '--'} ${shortName}`, x + 46, ry);

    let interval = 'LEADER';
    if (i > 0) {
      const front = ordered[i - 1];
      if (car.finished && front.finished) {
        interval = `+${Math.max(0, car.finishTime + (car.penalty || 0) - front.finishTime - (front.penalty || 0)).toFixed(2)}s`;
      } else {
        const distance = Math.max(0, progress(front) - progress(car));
        const referenceSpeed = Math.max(70, (Math.abs(front.v || 0) + Math.abs(car.v || 0)) * 0.5);
        interval = `+${(distance / referenceSpeed).toFixed(2)}s`;
      }
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = i === 0 ? '#e84545' : '#666';
    ctx.fillText(interval, x + w - 13, ry);
    ctx.textAlign = 'left';
  });
}

// 赛道 bounding box 宽高比（含维修区），用于按比例确定地图卡尺寸，避免压缩。
function getTrackMapAspect(track) {
  const pit = getPitConfig(track);
  let bounds = track._miniMapBounds;
  if (!bounds) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of track.samples) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    for (let k = pit.entryStart; k <= pit.exitEnd; k += 8) {
      for (const lane of ['fast', 'work']) {
        const p = getPitRoutePoint(track, k, lane);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    bounds = track._miniMapBounds = { minX, maxX, minY, maxY };
  }
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  return spanX / spanY;
}

// 完整赛道略缩图：黄色标记为玩家，蓝色标记为 AI。
function drawMiniMap(ctx, track, player, ais, x, y, w, h) {
  const pit = getPitConfig(track);
  let bounds = track._miniMapBounds;
  if (!bounds) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of track.samples) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    for (let k = pit.entryStart; k <= pit.exitEnd; k += 8) {
      for (const lane of ['fast', 'work']) {
        const p = getPitRoutePoint(track, k, lane);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    bounds = track._miniMapBounds = { minX, maxX, minY, maxY };
  }

  const pad = 5;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = x + (w - spanX * scale) / 2 - bounds.minX * scale;
  const oy = y + (h - spanY * scale) / 2 - bounds.minY * scale;

  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.fillStyle = '#dff2cf';
  ctx.fillRect(x, y, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 维修区使用独立灰线，从主直道分流并在出口重新汇合。
  ctx.strokeStyle = '#858792';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  for (let k = pit.entryStart; k <= pit.exitEnd; k += 4) {
    const fast = getPitRoutePoint(track, k, 'fast');
    const work = getPitRoutePoint(track, k, 'work');
    const px = ox + ((fast.x + work.x) / 2) * scale;
    const py = oy + ((fast.y + work.y) / 2) * scale;
    if (k === pit.entryStart) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // 正式赛道按参考图使用纯黑轮廓，避免与灰色维修区混淆。
  ctx.beginPath();
  track.samples.forEach((p, i) => {
    const px = ox + p.x * scale, py = oy + p.y * scale;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // 六个车队 P 房在缩略图上使用车队色方块标出。
  PIT_TEAMS.forEach((team, i) => {
    const box = getPitBox(track, i);
    const px = ox + box.x * scale, py = oy + box.y * scale;
    ctx.fillStyle = team.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.fillRect(px - 2.5, py - 2.5, 5, 5); ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
  });
  const marker = (car, color, radius) => {
    if (!car) return;
    const px = ox + car.x * scale, py = oy + car.y * scale;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  ais.forEach(ai => marker(ai, ai.color, 3.5));
  marker(player, '#00a19c', 5);
  ctx.restore();

  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
}

function drawStartLights(ctx, countdown, centerX) {
  const elapsed = 5.2 - countdown;
  const lit = Math.max(0, Math.min(5, Math.floor(elapsed / 0.8) + 1));
  const boxW = 310, boxH = 82, x = centerX - boxW / 2, y = 110;
  ctx.save();
  ctx.fillStyle = '#18191e';
  ctx.strokeStyle = '#050506';
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, boxW, boxH, 16);
  ctx.fill(); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const cx = x + 43 + i * 56;
    ctx.fillStyle = i < lit ? '#ff2028' : '#3a1418';
    ctx.shadowColor = i < lit ? '#ff2028' : 'transparent';
    ctx.shadowBlur = i < lit ? 18 : 0;
    ctx.beginPath();
    ctx.arc(cx, y + 40, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#08090b';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function card(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// 对手方向指示器：在屏幕边缘画箭头指向 AI
function drawOpponentArrow(ctx, W, H, player, ai, zoom) {
  zoom = zoom || 0.8;
  const dx = (ai.x - player.x) * zoom;
  const dy = (ai.y - player.y) * zoom;
  const cx = W / 2, cy = H / 2;
  const ax = cx + dx, ay = cy + dy;
  const margin = 70;
  if (ax > margin && ax < W - margin && ay > margin && ay < H - margin) return;

  const halfW = W / 2 - margin, halfH = H / 2 - margin;
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const tt = Math.min(tx, ty);
  const px = cx + dx * tt;
  const py = cy + dy * tt;

  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = ai.color;
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderRanks(el) {
  if (!el) return;
  const ranks = JSON.parse(localStorage.getItem('f1MiniRanks') || '[]');

  // 全部赛道基准（trackId → name）
  const allTracks = listTracks();
  const idToName = new Map(allTracks.map(t => [t.id, t.name]));
  const nameToId = new Map(allTracks.map(t => [t.name, t.id]));

  // 按 trackId 分组（旧记录无 trackId 时用 name 反查），每组取总时间最短的前 3 名
  const groups = new Map(); // trackId → records
  for (const r of ranks) {
    const tid = r.trackId || nameToId.get(r.track) || r.track; // 兜底用 name 当 key
    if (!groups.has(tid)) groups.set(tid, []);
    groups.get(tid).push(r);
  }
  for (const list of groups.values()) list.sort((x, y) => x.total - y.total);

  // 以全部赛道为基准，没记录的也显示占位；同时兜底收纳未知 trackId
  const seen = new Set();
  const merged = [];
  for (const t of allTracks) {
    if (!seen.has(t.id)) { seen.add(t.id); merged.push({ id: t.id, name: t.name }); }
  }
  for (const tid of groups.keys()) {
    if (!seen.has(tid)) {
      seen.add(tid);
      merged.push({ id: tid, name: idToName.get(tid) || tid });
    }
  }

  const sortedGroups = merged
    .map(({ id, name }) => ({ id, name, top3: (groups.get(id) || []).slice(0, 3), hasRecord: groups.has(id) }))
    .sort((a, b) => {
      const at = a.top3[0]?.total ?? Infinity;
      const bt = b.top3[0]?.total ?? Infinity;
      return at - bt;
    });

  const medal = ['🥇', '🥈', '🥉'];
  const tyreName = { soft: '软胎', medium: '中性胎', hard: '硬胎', inter: '半雨胎', wet: '全雨胎' };
  const vehicleName = {
    balanced: '全能型 GP',
    sprint: '低阻直线型',
    technical: '高下压力型',
    endurance: '耐力回收型'
  };
  const weatherName = { sunny: '晴天', cloudy: '阴天', rain: '降雨', dynamic: '动态' };

  const renderItem = ({ id, name, top3, hasRecord }) => `
    <li style="list-style:none;margin-bottom:10px;padding:8px 10px;background:rgba(43,43,51,0.06);border-radius:8px;border-left:3px solid #e84545">
      <div style="font-weight:800;color:#2b2b33;font-size:13px;margin-bottom:5px">🏁 ${trackLocalName(id, name)}</div>
      ${hasRecord ? `<div style="display:flex;flex-direction:column;gap:3px">
        ${top3.map((r, i) => {
          const car = [r.team && teamName(r.team), r.number && `#${r.number}`, r.tyre && tyreName[r.tyre] && t(tyreName[r.tyre]), r.vehicle && vehicleName[r.vehicle] && t(vehicleName[r.vehicle]), r.weather && weatherName[r.weather] && t(weatherName[r.weather])].filter(Boolean).join(' · ');
          return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#3a3a44">
            <span style="width:18px;text-align:center">${medal[i] || `P${i + 1}`}</span>
            <span style="color:#e84545;font-weight:700;min-width:62px">${fmtTime(r.total)}</span>
            <span style="color:#666;font-size:11px">${t('最快圈 ')}${fmtTime(r.bestLap)}</span>
            <span style="flex:1;color:#7a7f93;font-size:11px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${car}">${car}</span>
            <span style="color:#9aa0b4;font-size:10px">${r.date}</span>
          </div>`;
        }).join('')}
      </div>` : `<div style="color:#9aa0b4;font-size:12px;padding:4px 0">${t('暂无记录，去刷新吧！')}</div>`}
    </li>
  `;

  el.innerHTML = sortedGroups.map(renderItem).join('');
}
