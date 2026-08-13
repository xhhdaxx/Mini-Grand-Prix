import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCar, controlCar, updateCar, collideBoundary, collidePitBarrier, surfaceSpeedFactor, getWorldSpeedScale, ACCELERATION_TIME_SCALE, BRAKING_FORCE_SCALE } from '../src/game/car.js';
import { createAI, updateAI } from '../src/game/ai.js';
import { setupRaceCar, commitPitService, regenerationEfficiency, updateRaceSystems, updateWeather, createWeather, createRaceControl, shouldAIPit, computeStandings, ERS_RULES, dryTyreRuleSatisfied } from '../src/game/race-systems.js';
import { applyTeamProfile } from '../src/game/teams.js';
import { getTrack, listTracks, getPitConfig, getPitRoutePoint, getPitRoadHalfWidth, getPitSpeedLimitRange, isPitEntryTransition, isPitExitTransition, getPitBoxLength, getPitBox, PIT_TEAMS } from '../src/game/track.js';
import { VEHICLE_MODELS, sanitizeVehicleSetup, applyVehicleSetup } from '../src/game/vehicle-config.js';
import {
  sanitizeDriveSettings, SEASON_TRACKS,
  saveRaceHistory, subscribeDataChanges
} from '../src/utils/storage.js';
import { getPitGuidance } from '../src/renderer/hud.js';
import { getPitVisualStyle } from '../src/renderer/track-render.js';
import { trackMeta, SEASON_2026_ORDER } from '../src/game/track-meta.js';
import { projectGlobePoint, clipVisibleRing } from '../src/ui/globe.js';
import { buildResultPages } from '../src/game/race-flow.js';
import { parseInputMode, renderInputMode } from '../src/config/input-mode.js';
import { setLang } from '../src/i18n.js';

// 断言按 i18n 改造前的中文文案编写，统一切到中文模式运行。
setLang('zh');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('存档更新会立即通知当前页面刷新积分等生涯数据', () => {
  const previousStorage = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value))
  };
  const changes = [];
  const unsubscribe = subscribeDataChanges(change => changes.push(change));
  try {
    saveRaceHistory({ track: '测试赛道', position: 1, points: 25 });
    assert.deepEqual(changes, [{ type: 'history' }, { type: 'career' }]);
  } finally {
    unsubscribe();
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test('npm 启动参数只允许键盘与手柄两种输入模式', () => {
  assert.equal(parseInputMode(['--input-mode=keyboard']), 'keyboard');
  assert.equal(parseInputMode(['--input-mode=gamepad']), 'gamepad');
  assert.equal(parseInputMode(['--input-mode=unknown']), 'keyboard');
  assert.equal(parseInputMode([]), 'keyboard');
});

test('服务端把输入模式写入首页且两条 npm 指令分别启动对应模式', () => {
  const html = '<meta name="input-mode" content="__INPUT_MODE__">';
  assert.match(renderInputMode(html, 'gamepad'), /content="gamepad"/);
  assert.match(renderInputMode(html, 'unknown'), /content="keyboard"/);

  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['start:keyboard'], 'node server.js --input-mode=keyboard');
  assert.equal(pkg.scripts['start:gamepad'], 'node server.js --input-mode=gamepad');

  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /\.home-modes \.btn\.hidden\s*\{\s*display:none\s*\}/);
});

test('手机热点地址由服务端动态生成并在网卡 IP 变化后重新提示', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /function getControllerUrls\(ips = getLocalIPs\(\)\)/);
  assert.match(server, /JSON\.stringify\(\{ port: PORT, ips, urls: getControllerUrls\(ips\) \}\)/);
  assert.match(server, /setInterval\(refreshControllerAddresses,/);
});

test('结算页把同场全部成绩卡放在一个可滚动页面中', () => {
  const cards = [{ id: '总时间' }, { id: '最佳圈' }, { id: '单圈明细' }, { id: '积分' }];
  const pages = buildResultPages(cards);
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0], cards);
});

test('结算流程不再访问旧版已移除的 over card 节点', () => {
  const flow = readFileSync(new URL('../src/game/race-flow.js', import.meta.url), 'utf8');
  assert.doesNotMatch(flow, /querySelector\(['"]#over \.card['"]\)/);
});

test('轮胎选择按钮为色点保留独立布局空间，首字不会被覆盖', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.tyre-option\{[^}]*display:inline-flex[^}]*gap:/);
  assert.match(html, /\.tyre-option::before\{[^}]*position:static[^}]*flex:0 0 auto/);
});

test('主菜单三个辅助入口同排显示并包含图案与用途说明', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.home-tool-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html, /\.home-tools\{[^}]*border-top:3px dashed/);
  for (const id of ['btnGarage', 'btnCareer', 'btnRules']) {
    assert.match(html, new RegExp(`<button[^>]*id="${id}"[\\s\\S]*?<svg[\\s\\S]*?home-tool-title[\\s\\S]*?home-tool-desc[\\s\\S]*?<\\/button>`));
  }
});

test('地球操作提示同时说明标记选择与随机选择入口', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /拖动地球旋转 · 点击标记选择 · 随机选择 →/);
  assert.match(html, /Drag to rotate · Tap a marker · Random pick →/);
});

test('手机手柄中栏结构完整并提供独立维修区急停键', () => {
  const html = readFileSync(new URL('../gamepad.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="center-col">[\s\S]*?<div class="speed-card">[\s\S]*?<\/div>\s*<button class="emergency-chip" data-key="emergency"[\s\S]*?S[\s\S]*?急停[\s\S]*?<\/button>\s*<\/div>\s*<!-- 右：/);
  assert.match(html, /\.emergency-chip\s*\{[^}]*display:\s*flex[^}]*flex:\s*1 1 0[^}]*width:\s*100%[^}]*min-height:\s*0/);
});

test('手机进站协议分发选胎事件并发送明确的进站目标状态', () => {
  const client = readFileSync(new URL('../src/gamepad/ws-client.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const pad = readFileSync(new URL('../gamepad.html', import.meta.url), 'utf8');
  assert.match(client, /pitTyre:\s*null/);
  assert.match(client, /msg\.type === 'pitTyre'[\s\S]*?listeners\.pitTyre\?\.\(msg\)/);
  assert.match(main, /car\._pitRequested\s*=\s*!!msg\.requested/);
  assert.match(pad, /role:\s*'pit',\s*player,\s*requested:\s*next/);
  assert.doesNotMatch(main, /state\.session\s*!==\s*'race'/);
  assert.doesNotMatch(main, /state\.running\s*&&\s*state\.session\s*===\s*'race'/);
});

test('手机选胎遮罩显示时允许触控并将五种轮胎排成一行', () => {
  const html = readFileSync(new URL('../gamepad.html', import.meta.url), 'utf8');
  assert.match(html, /\.pit-overlay\.show\s*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto/);
  assert.match(html, /\.pit-tyres\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
});


test('中等刹车回收效率高于轻刹和锁胎重刹', () => {
  assert.ok(regenerationEfficiency(.55) > regenerationEfficiency(.2));
  assert.ok(regenerationEfficiency(.55) > regenerationEfficiency(1, true));
});

test('满电停止回收并产生提示', () => {
  const car = setupRaceCar(createCar({ x: 0, y: 0 }), 'medium');
  car.boostCharge = 100; car.brakeInput = .55; car.v = 200;
  const state = { weather: { wetness: 0 }, raceControl: {}, player: car, ais: [], track: getTrack('sunshine'), session: 'race' };
  updateRaceSystems(car, .1, state);
  assert.equal(car.regenRate, 0); assert.equal(car.energyFull, true);
  assert.match(car.warning, /电池已满/);
});

test('AI 和玩家共用规则，100% 电量一次连续放电 5 秒', () => {
  const car = setupRaceCar(createCar({ x: 0, y: 0 }), 'medium');
  car.isAI = true; car.v = 280; car.throttleInput = 1; car.steer = 0;
  const state = { weather: { wetness: 0 }, raceControl: {}, player: car, ais: [], track: getTrack('sunshine') };
  for (let i = 0; i < 49; i++) updateRaceSystems(car, .1, state);
  assert.equal(car.boostActive, true);
  updateRaceSystems(car, .1, state);
  assert.equal(car.boostActive, false); assert.ok(car.boostCooldown > 0); assert.ok(car.boostCharge >= 0);
  assert.equal(ERS_RULES.maxDeploySeconds, 5);
  assert.equal(ERS_RULES.deployRate, 20);
});

test('W、D、S、X 分别控制加速、制动、P区急停和倒车', () => {
  const car = createCar({ x: 0, y: 0 });
  controlCar(car, { up: true, down: false, emergency: false }); assert.equal(car.throttle, 1);
  controlCar(car, { up: false, down: true, emergency: false }); assert.equal(car.brake, 1);
  controlCar(car, { up: false, down: false, emergency: true }); assert.equal(car.emergencyBrake, 0);
  car.inPit = true; car.pitBoxDistance = 100;
  controlCar(car, { up: false, down: false, emergency: true }); assert.equal(car.emergencyBrake, 1);
  controlCar(car, { up: false, down: false, emergency: false, reverse: true }); assert.equal(car.reverse, 1);
});

test('D 和 S 只能停车，X 才能倒车', () => {
  for (const emergency of [false, true]) {
    const car = createCar({ x:0, y:0 }); car.v = 1; car.brake = emergency ? 0 : 1; car.emergencyBrake = emergency ? 1 : 0;
    for (let i=0; i<100; i++) updateCar(car, .02, null, 0);
    assert.equal(car.v, 0);
  }
  const reversing = createCar({ x:0, y:0 }); reversing.reverse = 1;
  updateCar(reversing, .1, null, 0); assert.ok(reversing.v < 0);
});

test('达到极速后松开 W 仍保持巡航', () => {
  const car = createCar({ x:0, y:0 }); car.tyreMaxSpeed = 360; car.v = 360; car.throttle = 0; car.throttleInput = 0;
  car.surface = 'asphalt'; updateCar(car, .1, null, 0);
  assert.equal(car.v, 360); assert.equal(car.cruiseAtMax, true);
  car.brake = 1; updateCar(car, .1, null, 0); assert.equal(car.cruiseAtMax, false); assert.ok(car.v < 360);
});

test('自动速度保持开启时松开 W 保持任意当前速度', () => {
  const car = createCar({ x:0, y:0 }); car.v = 180; car.surface = 'asphalt';
  updateCar(car, .5, null, 0);
  assert.equal(car.v, 180);
});

test('自动速度保持关闭时必须持续按 W，否则车辆滑行减速', () => {
  const car = createCar({ x:0, y:0 }); car.v = 180; car.surface = 'asphalt'; car.throttleInput = 1;
  controlCar(car, { up:false, autoSpeedHold:false });
  updateCar(car, .5, null, 0);
  assert.ok(car.v < 180);
  controlCar(car, { up:true, autoSpeedHold:false });
  const coastingSpeed = car.v;
  updateCar(car, .5, null, 0);
  assert.ok(car.v > coastingSpeed);
});

test('表显速度不变且世界坐标位移倍率可按 0.1 设置', () => {
  const car = createCar({ x:0, y:0, angle:0 });
  car.v = 180; car.velX = 180; car.velY = 0; car.surface = 'asphalt'; car.worldSpeedScale = 1.6;
  updateCar(car, .1, null, 0);
  assert.equal(getWorldSpeedScale(car), 1.6);
  assert.equal(car.v, 180);
  assert.ok(Math.abs(car.x - 28.8) < 1e-9, `实际位移 ${car.x}`);
  assert.equal(car.y, 0);
  assert.deepEqual(sanitizeDriveSettings({ movementScale:1.64, autoSpeedHold:false }), { movementScale:1.6, autoSpeedHold:false });
  assert.deepEqual(sanitizeDriveSettings({ movementScale:5 }), { movementScale:2, autoSpeedHold:true });
});

test('路肩、浅灰缓冲区和砂石区分别减速 10%、20%、30%', () => {
  assert.equal(surfaceSpeedFactor('curb'), .90);
  assert.equal(surfaceSpeedFactor('runoff'), .80);
  assert.equal(surfaceSpeedFactor('gravel'), .70);
});

test('加速慢 1.5 倍、制动快 1.5 倍且锁胎削弱转向', () => {
  assert.equal(ACCELERATION_TIME_SCALE, 1.5);
  assert.equal(BRAKING_FORCE_SCALE, 1.5);
  const car = createCar({ x: 0, y: 0 }); car.v = 200 / .7; car.velX = car.v; car.brake = 1; car.steerTarget = 1;
  let elapsed = 0, lockedDuringStop = false;
  while (car.v > .1 && elapsed < 10) { updateCar(car, .01, null, 0); elapsed += .01; lockedDuringStop ||= car.locked; }
  assert.ok(elapsed > 3.4 && elapsed < 4.0, `实际 ${elapsed.toFixed(2)}s`);
  assert.equal(lockedDuringStop, true);
});

test('车队性能倾向独立且幅度公平', () => {
  const apex = applyTeamProfile({}, 'APEX');
  const helix = applyTeamProfile({}, 'HELIX');
  const orbit = applyTeamProfile({}, 'ORBIT');
  assert.ok(apex.powerMultiplier > helix.powerMultiplier);
  assert.ok(helix.corneringMultiplier > apex.corneringMultiplier);
  assert.ok(orbit.recoveryMultiplier > apex.recoveryMultiplier);
  for (const car of [apex, helix, orbit]) for (const key of ['powerMultiplier','corneringMultiplier','recoveryMultiplier','deploymentMultiplier']) assert.ok(car[key] >= .95 && car[key] <= 1.16);
});

test('车型预设和自定义调校进入真实车辆参数', () => {
  assert.deepEqual(Object.keys(VEHICLE_MODELS), ['balanced', 'sprint', 'technical', 'endurance']);
  const setup = sanitizeVehicleSetup({ model: 'sprint', tune: { acceleration: 115, topSpeed: 115, braking: 115, steering: 115, recovery: 115 } });
  assert.ok(Object.values(setup.tune).every(value => value >= 85 && value <= 115));
  assert.ok(Object.values(setup.tune).reduce((sum, value) => sum + value, 0) <= 515);
  const car = applyTeamProfile({}, 'ORBIT');
  const basePower = car.powerMultiplier, baseRecovery = car.recoveryMultiplier;
  applyVehicleSetup(car, { model: 'technical' });
  assert.equal(car.accelerationMultiplier, .95);
  assert.equal(car.brakeMultiplier, 1.08);
  assert.equal(car.powerMultiplier, basePower * .90);
  assert.equal(car.recoveryMultiplier, baseRecovery * 1.05);
});

test('正赛必须在 P 房实际完成一次换胎，同配方新胎也计入', () => {
  const car = { usedCompounds: new Set(['medium']), pitStops: 0, tyreChanges: 0 };
  assert.equal(dryTyreRuleSatisfied(car, { wetness: 0 }), false);
  car.usedCompounds.add('hard'); assert.equal(dryTyreRuleSatisfied(car, { wetness: 0 }), false);
  car.tyreChanges = 1; assert.equal(dryTyreRuleSatisfied(car, { wetness: 0 }), true);
  assert.equal(dryTyreRuleSatisfied({ tyreChanges: 0 }, { wetness: .6, raining: true }), false);
  assert.equal(dryTyreRuleSatisfied({ tyreChanges: 1 }, { wetness: .6, raining: true }), true);
});

test('P 房完成同配方换胎后满足正赛规则', () => {
  const track = getTrack('sunshine'), box = getPitBox(track, 'ORBIT');
  const car = setupRaceCar(createCar({ x: box.x, y: box.y }), 'medium');
  Object.assign(car, { team:'ORBIT', pitBox:box, isPitLane:true, pitTimer:2.49, nextTyre:'medium', boostCharge:17, v:0 });
  const state = { track, weather:{ wetness:0 }, raceControl:{}, player:car, ais:[], session:'race' };
  updateRaceSystems(car, .02, state);
  assert.equal(car.pitStops, 1);
  assert.equal(car.tyreChanges, 1);
  assert.equal(car.tyre, 'medium');
  assert.equal(car.boostCharge, 100);
  assert.equal(car.energyFull, true);
  assert.equal(dryTyreRuleSatisfied(car, state.weather), true);
});

test('玩家在 P 房停稳后必须先选胎，选好后才开始换胎计时', () => {
  const track = getTrack('sunshine'), box = getPitBox(track, 'ORBIT');
  const car = setupRaceCar(createCar({ x:box.x, y:box.y }), 'medium');
  Object.assign(car, { team:'ORBIT', pitBox:box, isPitLane:true, _pitRequested:true, v:0 });
  const state = { track, weather:{ wetness:0 }, raceControl:{}, player:car, ais:[], session:'race' };
  updateRaceSystems(car, .1, state);
  assert.equal(car.atPitBox, true);
  assert.equal(car.pitTimer, 0);
  assert.match(car.warning, /选择轮胎/);
  assert.equal(commitPitService(car, 'hard'), true);
  updateRaceSystems(car, .1, state);
  assert.equal(car.pitTimer, .1);
});

test('选胎后锁定 P 房维修位置，车辆轻微漂移也能自动完成换胎', () => {
  const track = getTrack('sunshine'), box = getPitBox(track, 'ORBIT');
  const car = setupRaceCar(createCar({ x:box.x, y:box.y }), 'medium');
  Object.assign(car, { team:'ORBIT', pitBox:box, isPitLane:true, inPit:true, atPitBox:true, _pitRequested:true, v:0 });
  assert.equal(commitPitService(car, 'hard'), true);
  car.x += 35; car.y += 20; car.v = 18; car.velX = 12; car.velY = 5;
  const state = { track, weather:{ wetness:0 }, raceControl:{}, player:car, ais:[], session:'race' };
  for (let i = 0; i < 26; i++) updateRaceSystems(car, .1, state);
  assert.equal(car.pitStops, 1);
  assert.equal(car.tyre, 'hard');
  assert.equal(car._pitServiceCommitted, false);
  assert.equal(car.v, 0);
});

test('动态天气提供可预判的降雨窗口', () => {
  const weather = createWeather('dynamic');
  updateWeather(weather, .1, 47.9); assert.equal(weather.raining, false);
  updateWeather(weather, .1, 48.1); assert.equal(weather.raining, true);
  assert.match(weather.forecast, /降雨/);
});

test('上海维修区入口出口与主通道保持等宽', () => {
  const track = getTrack('sunshine'), cfg = getPitConfig(track);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62, `k=${k} 的维修区半宽发生变化`);
  }
  for (const k of [cfg.entryStart, cfg.exitEnd]) {
    const fast = getPitRoutePoint(track, k, 'fast');
    const work = getPitRoutePoint(track, k, 'work');
    const centerOffset = (fast.amount + work.amount) / 2;
    assert.ok(centerOffset + getPitRoadHalfWidth(k, track) <= track.halfWidth,
      `k=${k} 的维修区端头仍伸出主赛道 ${centerOffset + getPitRoadHalfWidth(k, track) - track.halfWidth}`);
  }
  assert.ok(cfg.entryGateEnd < cfg.entryEnd, 'PIT IN 白色虚线不应延伸到维修区主体');
  assert.ok(cfg.exitGateStart > cfg.exitStart, 'PIT OUT 白色虚线不应从维修区主体开始');
});

test('上海限速区只覆盖首个 P 房前和末个 P 房后各 30 米', () => {
  const track = getTrack('sunshine'), cfg = getPitConfig(track);
  const range = getPitSpeedLimitRange(track);
  const firstBox = getPitBox(track, 0), lastBox = getPitBox(track, PIT_TEAMS.length - 1);
  assert.ok(range.entryK > cfg.entryEnd && range.entryK < firstBox.k);
  assert.ok(range.exitK > lastBox.k && range.exitK < cfg.exitStart);
  const target = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(range.entryLine && range.exitLine, '限速白线必须提供精确插值位置');
  assert.ok(Math.abs(range.entryDistance - target) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target) < 1e-6);
});

test('上海单车队 P 房长度保持三倍且车队间隔缩为当前的三分之一', () => {
  const track = getTrack('sunshine');
  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  assert.equal(getPitBoxLength(track), 276);
  const distances = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(distances.every(distance => distance >= 330 && distance <= 450), `车队间距不符合三分之一目标：${distances.join(',')}`);
});

test('维修区自动限速但不再处罚超速', () => {
  const track = getTrack('sunshine');
  const car = setupRaceCar({ tyre:'medium', v:200, x:0, y:0 });
  Object.assign(car, { inPit:true, isPitLane:true, pitSpeedLimited:true, v:200 });
  updateRaceSystems(car, 1 / 60, { track, weather:{ wetness:0 }, player:car, ais:[], mode:'solo' });
  assert.equal(car.v, 115);
  assert.equal(car.penalty, 0);
  assert.ok(car.penaltyReasons.every(item => item.reason !== '维修区超速'));
});

test('本车队完整维修区内均可停稳换胎', () => {
  const track = getTrack('sunshine'), box = getPitBox(track, 0);
  const longitudinal = getPitBoxLength(track) / 2 - 8;
  const car = setupRaceCar({ tyre:'medium', v:0, x:box.x + Math.cos(box.angle) * longitudinal, y:box.y + Math.sin(box.angle) * longitudinal });
  Object.assign(car, { team:'ORBIT', pitBox:box, inPit:true, isPitLane:true, pitSpeedLimited:true, _pitRequested:true, nextTyre:'hard', v:0 });
  updateRaceSystems(car, 2.5, { track, weather:{ wetness:0 }, player:car, ais:[], mode:'solo' });
  assert.equal(car.atPitBox, true);
  assert.equal(car.pitStops, 1);
  assert.equal(car.tyre, 'hard');
});

test('完成换胎后引导始终指向 PIT OUT 而不是 P 房', () => {
  const track = getTrack('sunshine');
  const car = { inPit:true, awaitingRelease:true, _pitServiced:false, _pitExitActive:true, pitBox:getPitBox(track, 0), releaseSafe:true };
  assert.match(getPitGuidance(car, track).label, /PIT OUT/);
});

test('两条白线之间关闭赛道界限，离开出口白线后恢复并关闭限速', () => {
  const track = getTrack('sunshine');
  const inside = setupRaceCar({ tyre:'medium', v:80, x:0, y:0 });
  Object.assign(inside, { fullyBeyondCurb:true, isPitLane:false, pitSpeedLimited:true, trackExitCount:0 });
  updateRaceSystems(inside, 1 / 60, { track, weather:{ wetness:0 }, player:inside, ais:[], mode:'solo' });
  assert.equal(inside.trackExitCount, 0);
  const outside = setupRaceCar({ tyre:'medium', v:80, x:0, y:0 });
  Object.assign(outside, { fullyBeyondCurb:true, isPitLane:false, pitSpeedLimited:false, trackExitCount:0 });
  updateRaceSystems(outside, 1 / 60, { track, weather:{ wetness:0 }, player:outside, ais:[], mode:'solo' });
  assert.equal(outside.trackExitCount, 1);
});

test('合法进入维修区不会累计赛道越界', () => {
  const track = getTrack('sunshine');
  const cfg = getPitConfig(track), entryIndex = (cfg.entryStart + 2 + track.samples.length) % track.samples.length;
  assert.equal(isPitEntryTransition(track, entryIndex, track.halfWidth + 30), true);
  const car = setupRaceCar({ tyre:'medium', fullyBeyondCurb:true, isPitLane:false, trackExitCount:0, v:80, x:0, y:0 });
  Object.assign(car, { _pitRequested:true, trackIndex:entryIndex, lateral:track.halfWidth + 30 });
  updateRaceSystems(car, 1 / 60, { track, weather:{ wetness:0 }, player:car, ais:[], mode:'solo' });
  assert.equal(car.trackExitCount, 0);
  assert.doesNotMatch(car.warning, /赛道界限/);
});

test('合法离开维修区不会累计赛道越界', () => {
  const track = getTrack('sunshine');
  const cfg = getPitConfig(track), exitIndex = (cfg.exitStart + 4 + track.samples.length) % track.samples.length;
  assert.equal(isPitExitTransition(track, exitIndex, track.halfWidth + 30), true);
  const car = setupRaceCar({ tyre:'medium', fullyBeyondCurb:true, isPitLane:false, trackExitCount:0, v:80, x:0, y:0 });
  Object.assign(car, { _pitExitActive:true, trackIndex:exitIndex, lateral:track.halfWidth + 30 });
  updateRaceSystems(car, 1 / 60, { track, weather:{ wetness:0 }, player:car, ais:[], mode:'solo' });
  assert.equal(car.trackExitCount, 0);
  assert.doesNotMatch(car.warning, /赛道界限/);
});

test('安全释放后沿 PIT OUT 通道行驶不会报赛道界限或继续限速', () => {
  const track = getTrack('sunshine');
  const range = getPitSpeedLimitRange(track);
  const pitOutK = Math.ceil(range.exitK + 8);
  const route = getPitRoutePoint(track, pitOutK, 'fast');
  const car = setupRaceCar(createCar({ x:route.x, y:route.y, angle:route.angle }));
  Object.assign(car, {
    _pitExitActive:true,
    awaitingRelease:true,
    fullyBeyondCurb:true,
    isPitLane:false,
    pitSpeedLimited:false,
    trackIndex:(pitOutK + track.samples.length) % track.samples.length,
    lateral:track.halfWidth + 60,
    trackExitCount:0,
    v:180,
    warning:'赛道界限 1/5',
    warningTime:3,
  });
  updateRaceSystems(car, 1 / 60, { track, weather:{ wetness:0 }, player:car, ais:[], mode:'solo' });
  assert.equal(car.trackExitCount, 0);
  assert.doesNotMatch(car.warning, /赛道界限/);
  assert.equal(car.v, 180, '越过出口白线后不应继续套用维修区限速');
});

test('PIT OUT 弯曲通道的采样容差不会误判草地并限制加速', () => {
  const track = getTrack('sunshine');
  const range = getPitSpeedLimitRange(track);
  const k = Math.ceil(range.exitK + 10);
  const fast = getPitRoutePoint(track, k, 'fast');
  const work = getPitRoutePoint(track, k, 'work');
  const center = { x:(fast.x + work.x) / 2, y:(fast.y + work.y) / 2 };
  const toleranceOffset = getPitRoadHalfWidth(k, track) + 21 + track.bufferWidth / 2;
  const car = setupRaceCar(createCar({
    x:center.x + fast.nx * toleranceOffset,
    y:center.y + fast.ny * toleranceOffset,
    angle:fast.angle,
  }));
  Object.assign(car, { _pitExitActive:true, v:180, throttle:1, throttleInput:1 });
  updateCar(car, 1 / 120, track, 0);
  assert.equal(car.surface, 'pit');
  assert.equal(car.pitSpeedLimited, false);
  assert.ok(car.v >= 180, `PIT OUT 被错误减速到 ${car.v}`);
});

test('赛道列表包含二十四站大奖赛且尺寸一致', () => {
  const expectedOrder = [
    'australia', 'sunshine', 'bahrain', 'jeddah', 'miami',
    'canada', 'rainbow', 'spain', 'austria', 'silverstone', 'hockenheim', 'galaxy',
    'hungary', 'netherlands', 'italy', 'baku', 'malaysia', 'singapore',
    'austin', 'mexico', 'brazil', 'lasvegas', 'qatar', 'yasmarina'
  ];
  assert.deepEqual(listTracks().map(track => track.id), expectedOrder);
  assert.deepEqual(SEASON_2026_ORDER, expectedOrder);
  assert.deepEqual(SEASON_TRACKS, expectedOrder);
  for (const track of listTracks().map(({ id }) => getTrack(id))) {
    assert.equal(track.worldScaleX, 24, `${track.id} 横向比例不是 24`);
    assert.equal(track.worldScaleY, 24, `${track.id} 纵向比例不是 24`);
  }
});

test('二十四条赛道提供有效经纬度并可投影到旋转地球', () => {
  for (const { id } of listTracks()) {
    const meta = trackMeta(id);
    assert.ok(Number.isFinite(meta.lat) && meta.lat >= -90 && meta.lat <= 90, `${id} 纬度无效`);
    assert.ok(Number.isFinite(meta.lon) && meta.lon >= -180 && meta.lon <= 180, `${id} 经度无效`);
    const point = projectGlobePoint(meta.lat, meta.lon, meta.lon, 0, 200);
    assert.ok(point.visible, `${id} 居中后没有显示在地球正面`);
    assert.ok(Math.abs(point.x) < 1e-6, `${id} 居中后的横坐标不为 0`);
    assert.ok(Math.abs(point.y) <= 200, `${id} 投影超出球面`);
  }
});

test('德国大奖赛按参考图实现霍根海姆 17 弯与 4.574 km 规格', () => {
  const track = getTrack('hockenheim');
  assert.equal(track.name, 'Hockenheim Circuit');
  assert.equal(track.raceDistanceMeters, 4574);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 70, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.samples.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.match(trackMeta('hockenheim').details, /17 Turns · 4\.574 km/);

  const controls = track.controls.map(point => ({
    x:point.x / track.worldScaleX,
    y:point.y / track.worldScaleY
  }));
  const xs = controls.map(point => point.x), ys = controls.map(point => point.y);
  const aspect = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  assert.ok(aspect > 1.8 && aspect < 2.4, `赛道长宽比不像参考图：${aspect.toFixed(2)}`);
  assert.ok(Math.max(...xs) > 480, '6 号弯前的 Parabolika 长直道不够突出');
  assert.ok(Math.min(...xs) < -340, '左侧起终点与 Motodrom 回环不完整');

  let minimum = Infinity;
  const m = track.samples.length;
  for (let i = 0; i < m; i += 8) {
    for (let j = i + 160; j < m; j += 8) {
      if (i < 160 && j > m - 160) continue;
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `非相邻路段缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('德国大奖赛维修区满足统一尺寸、正确侧别和两端 50 m 规则', () => {
  const track = getTrack('hockenheim'), cfg = getPitConfig(track);
  const range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), 276);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .997, `k=${k} 未与主赛道同向`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  assert.equal(new Set(boxes.map(box => `${box.x.toFixed(2)},${box.y.toFixed(2)}`)).size, 6);
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, track.halfWidth + 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, track.halfWidth + 20), true);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), false);
  assert.deepEqual(getPitVisualStyle(track), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('巴西大奖赛按参考图实现 15 弯与 4.309 km 规格', () => {
  const track = getTrack('brazil');
  assert.equal(track.name, 'Interlagos Circuit');
  assert.equal(track.raceDistanceMeters, 4309);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 60, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.samples.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.match(trackMeta('brazil').details, /15 Turns · 4\.309 km/);
});

test('迈阿密南侧长弧恢复安全高度且不与上方内场路段重叠', () => {
  const controls = getTrack('miami').controls.slice(32, 42).map(point => ({
    x: point.x / 24,
    y: point.y / 24
  }));
  assert.deepEqual(controls, [
    { x: -55, y: 102 }, { x: -12, y: 104 }, { x: 30, y: 106 },
    { x: 68, y: 116 }, { x: 103, y: 126 }, { x: 135, y: 129 },
    { x: 166, y: 120 }, { x: 199, y: 107 }, { x: 232, y: 94 },
    { x: 265, y: 80 }
  ]);

  const track = getTrack('miami');
  const upper = track.samples.slice(8 * 32, 15 * 32);
  const lower = track.samples.slice(32 * 32, 39 * 32);
  let minDistance = Infinity;
  for (const a of upper) for (const b of lower) {
    minDistance = Math.min(minDistance, Math.hypot(a.x - b.x, a.y - b.y));
  }
  const pavedHalfWidth = track.halfWidth + track.curbWidth;
  assert.ok(minDistance > pavedHalfWidth * 2,
    `上下路段仍重叠：中心距 ${minDistance.toFixed(1)}，所需 ${Math.round(pavedHalfWidth * 2)}`);
});

test('加拿大大奖赛按参考图重画为无自交的扁长 14 弯轮廓', () => {
  const track = getTrack('canada');
  assert.equal(track.raceDistanceMeters, 4361);
  assert.ok(track.controls.length >= 60, `控制点不足：${track.controls.length}`);
  const xs = track.controls.map(point => point.x);
  const ys = track.controls.map(point => point.y);
  const aspect = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  assert.ok(aspect > 3.2 && aspect < 4.4, `赛道长宽比不像参考图：${aspect.toFixed(2)}`);

  const controls = track.controls.map(point => ({ x:point.x / 24, y:point.y / 24 }));
  assert.deepEqual(controls.slice(39, 48), [
    { x:-360, y:25 }, { x:-410, y:8 }, { x:-460, y:-10 },
    { x:-510, y:-22 }, { x:-545, y:-20 }, { x:-565, y:-28 },
    { x:-568, y:-42 }, { x:-552, y:-56 }, { x:-525, y:-64 }
  ]);
  assert.ok(controls[39].y > controls[50].y + 70,
    '西端发夹的去程与回程没有形成上下分离的两条支线');
});

test('加拿大维修区主体是一条水平直线且 P 房不再随末段凹陷', () => {
  const track = getTrack('canada'), cfg = getPitConfig(track);
  const points = [cfg.entryEnd, (cfg.entryEnd + cfg.exitStart) / 2, cfg.exitStart]
    .map(k => getPitRoutePoint(track, k, 'fast'));
  assert.ok(points.every(point => Math.abs(point.y - points[0].y) < 1e-6));
  assert.ok(points.every(point => Math.abs(point.ty) < 1e-9 && point.tx > .999));
  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1e-6));
  assert.ok(boxes.every(box => Math.abs(box.angle) < 1e-9));
});

test('亨格罗宁维修区从底部直道直接分流、左移并保留缓冲区', () => {
  const track = getTrack('hungary'), cfg = getPitConfig(track);
  const mainStraightY = track.controls[0].y;
  const expectedY = mainStraightY - (track.halfWidth + track.curbWidth + track.bufferWidth + 62);
  const points = [cfg.entryEnd, (cfg.entryEnd + cfg.exitStart) / 2, cfg.exitStart]
    .map(k => {
      const fast = getPitRoutePoint(track, k, 'fast');
      const work = getPitRoutePoint(track, k, 'work');
      return { y:(fast.y + work.y) / 2 };
    });
  assert.ok(points.every(point => Math.abs(point.y - expectedY) < 1e-6));
  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  assert.ok(boxes.every(box => box.y < points[0].y));
  assert.ok(boxes.every(box => box.y < mainStraightY));
  assert.ok(boxes.every(box => box.x < 140 * track.worldScaleX));
  for (let k = cfg.entryStart; k <= cfg.entryEnd; k += 1) {
    assert.ok(getPitRoutePoint(track, k).tx < 0, `PIT IN 在 k=${k} 出现回头`);
  }
});

test('意大利大奖赛按参考图重画为无自交的经典蒙扎 11 弯轮廓', () => {
  const track = getTrack('italy');
  assert.equal(track.raceDistanceMeters, 5793);
  assert.ok(track.controls.length >= 50, `控制点不足：${track.controls.length}`);
  const controls = track.controls.map(point => ({ x:point.x / 24, y:point.y / 24 }));
  assert.deepEqual(controls.slice(32, 40), [
    { x:-35, y:65 }, { x:-15, y:65 }, { x:-3, y:72 }, { x:10, y:66 },
    { x:25, y:73 }, { x:40, y:78 }, { x:100, y:78 }, { x:170, y:78 }
  ]);
  const upperStraight = controls.slice(38, 42);
  const lowerStraight = controls.slice(48, 53).concat(controls.slice(0, 4));
  assert.ok(Math.max(...upperStraight.map(point => point.y)) < Math.min(...lowerStraight.map(point => point.y)) - 60,
    'Parabolica 前后两条直道没有保留足够间距');
});

test('奥斯汀大奖赛按参考图重画为无自交的 20 弯 COTA 轮廓', () => {
  const track = getTrack('austin');
  assert.equal(track.raceDistanceMeters, 5513);
  assert.ok(track.controls.length >= 60, `控制点不足：${track.controls.length}`);
  const controls = track.controls.map(point => ({ x:point.x / 24, y:point.y / 24 }));
  const xs = controls.map(point => point.x), ys = controls.map(point => point.y);
  const aspect = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  assert.ok(aspect > 1.5 && aspect < 1.9, `赛道长宽比不像参考图：${aspect.toFixed(2)}`);
  assert.deepEqual(controls.slice(25, 32), [
    { x:155, y:30 }, { x:195, y:-15 }, { x:235, y:-55 },
    { x:270, y:-85 }, { x:290, y:-100 }, { x:295, y:-110 },
    { x:285, y:-112 }
  ]);
  assert.ok(controls[29].x > controls[25].x + 130, '11 号弯前的长直道不够突出');
  assert.ok(controls[8].x > controls[3].x + 50,
    '1 号弯出口仍回到起终点直道左侧并产生交叉');
  assert.ok(controls[6].y > controls[5].y && controls[6].y > controls[7].y,
    '底部 1 号发夹没有形成圆润且独立的最低弯心');
});

test('奥斯汀维修区位于最左侧赛道外侧且六个换胎位排在直线上', () => {
  const track = getTrack('austin'), cfg = getPitConfig(track);
  const straightKs = [cfg.entryEnd, (cfg.entryEnd + cfg.exitStart) / 2, cfg.exitStart];
  const centers = straightKs.map(k => {
    const fast = getPitRoutePoint(track, k, 'fast');
    const work = getPitRoutePoint(track, k, 'work');
    return { x:(fast.x + work.x) / 2, y:(fast.y + work.y) / 2, tx:fast.tx, ty:fast.ty };
  });
  const cross = (centers[1].x - centers[0].x) * (centers[2].y - centers[0].y)
    - (centers[1].y - centers[0].y) * (centers[2].x - centers[0].x);
  assert.ok(Math.abs(cross) < 1e-6, `维修区主体不是直线：叉积 ${cross}`);
  assert.ok(centers[1].tx > .65 && centers[1].ty > .65,
    '维修区直线方向没有沿最左侧主直道驶向 1 号弯');
  assert.deepEqual(centers.map(point => ({
    x:point.x / track.worldScaleX,
    y:point.y / track.worldScaleY
  })), [
    { x:-296, y:100 },
    { x:-232, y:160 },
    { x:-168, y:220 }
  ]);

  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  const direction = centers[1], nx = -direction.ty, ny = direction.tx;
  const offsets = boxes.map(box => box.x * nx + box.y * ny);
  assert.ok(Math.max(...offsets) - Math.min(...offsets) < 1e-6,
    '六个车队换胎位没有排在同一条直线上');
  const mainStart = { x:-300 * track.worldScaleX, y:80 * track.worldScaleY };
  const mainDx = 190 * track.worldScaleX, mainDy = 178 * track.worldScaleY;
  const mainLength = Math.hypot(mainDx, mainDy);
  const mainNx = -mainDy / mainLength, mainNy = mainDx / mainLength;
  const requiredCenterGap = track.halfWidth + track.curbWidth + track.bufferWidth + 62;
  for (const center of centers) {
    const gap = (center.x - mainStart.x) * mainNx + (center.y - mainStart.y) * mainNy;
    assert.ok(Math.abs(gap - requiredCenterGap) < 18,
      `维修区没有贴住缓冲区外缘：中心距 ${gap.toFixed(1)}，目标 ${requiredCenterGap.toFixed(1)}`);
  }
  for (let k = cfg.entryStart; k <= cfg.exitEnd; k += 1) {
    const point = getPitRoutePoint(track, k, 'fast');
    const forwardDot = point.tx * direction.tx + point.ty * direction.ty;
    assert.ok(forwardDot > .5,
      `维修区在 k=${k} 出现回头或反向弯：(${point.tx.toFixed(2)}, ${point.ty.toFixed(2)})`);
  }
});

test('墨西哥大奖赛实现与起跑直道分离的 13–17 号体育场弯组', () => {
  const track = getTrack('mexico');
  const controls = track.controls.map(point => ({ x:point.x / 24, y:point.y / 24 }));
  assert.deepEqual(controls.slice(0, 10), [
    { x:-365, y:-270 }, { x:-290, y:-264 }, { x:-210, y:-256 },
    { x:-125, y:-247 }, { x:-35, y:-238 }, { x:55, y:-229 },
    { x:145, y:-220 }, { x:230, y:-211 }, { x:305, y:-201 },
    { x:360, y:-192 }
  ]);
  assert.deepEqual(controls.slice(65), [
    { x:-342, y:-178 }, { x:-334, y:-190 }, { x:-343, y:-201 },
    { x:-360, y:-198 }, { x:-372, y:-187 }, { x:-392, y:-176 },
    { x:-418, y:-174 }, { x:-443, y:-182 }, { x:-460, y:-198 },
    { x:-468, y:-218 }, { x:-464, y:-238 }, { x:-449, y:-253 },
    { x:-427, y:-261 }, { x:-404, y:-260 }
  ]);
  assert.equal(controls.length, 79, '16号外弧没有按红线直接连接起跑直道');
});

test('墨西哥换胎区固定在上方主直道旁的直线上', () => {
  const track = getTrack('mexico'), cfg = getPitConfig(track);
  assert.deepEqual(
    { entryStart:cfg.entryStart, entryEnd:cfg.entryEnd },
    { entryStart:0, entryEnd:35 },
    '墨西哥 PIT IN 仍从已删除的体育场回环处分流'
  );
  let previousEntryX = -Infinity;
  for (let k = cfg.entryStart; k <= cfg.entryEnd; k += 1) {
    const point = getPitRoutePoint(track, k, 'fast');
    assert.ok(point.x > previousEntryX,
      `墨西哥 PIT IN 在 k=${k} 向后折返：${point.x.toFixed(1)} <= ${previousEntryX.toFixed(1)}`);
    previousEntryX = point.x;
  }
  const points = [cfg.entryEnd, (cfg.entryEnd + cfg.exitStart) / 2, cfg.exitStart]
    .map(k => {
      const point = getPitRoutePoint(track, k, 'fast');
      const work = getPitRoutePoint(track, k, 'work');
      return { ...point,
        x:(point.x + work.x) / 2 / track.worldScaleX,
        y:(point.y + work.y) / 2 / track.worldScaleY };
    });
  const cross = (points[1].x-points[0].x)*(points[2].y-points[0].y)
    - (points[1].y-points[0].y)*(points[2].x-points[0].x);
  assert.ok(Math.abs(cross) < 1e-6, `换胎区主体不是直线：叉积 ${cross}`);
  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  assert.ok(boxes.every(box => Math.abs(box.angle - points[1].angle) < 1e-9));
});

test('巴西右侧外环按红线改为接回南侧长直道的连续高速弧', () => {
  const controls = getTrack('brazil').controls;
  const shortcut = controls.slice(22, 30).map(point => ({
    x: point.x / 24,
    y: point.y / 24
  }));
  assert.deepEqual(shortcut, [
    { x: 250, y: 230 }, { x: 282, y: 226 }, { x: 310, y: 216 },
    { x: 326, y: 198 }, { x: 326, y: 170 }, { x: 318, y: 136 },
    { x: 308, y: 102 }, { x: 296, y: 76 }
  ]);
});

test('巴西右侧上下两段赛道不再交叉并保留草地区隔', () => {
  const track = getTrack('brazil');
  let minimum = Infinity;
  // 23–29 是下方外弧；54–60 是从内场出来的上方斜向赛道。
  for (let i = 23 * 32; i <= 29 * 32; i += 4) {
    for (let j = 54 * 32; j <= 60 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `巴西右侧赛道仍交叉或缓冲区粘连：${minimum.toFixed(1)} < ${required.toFixed(1)}`);
});

test('巴林右下小回环按红线缩短并平滑接入上扬长弧', () => {
  const controls = getTrack('bahrain').controls;
  const shortcut = controls.slice(56, 64).map(point => ({
    x: point.x / 24,
    y: point.y / 24
  }));
  assert.deepEqual(shortcut, [
    { x: 38, y: 148 }, { x: 39, y: 168 }, { x: 45, y: 181 },
    { x: 58, y: 187 }, { x: 73, y: 186 }, { x: 86, y: 178 },
    { x: 91, y: 162 }, { x: 82, y: 143 }
  ]);
});

test('巴西大奖赛维修区复用统一尺寸并位于主直道内侧', () => {
  const track = getTrack('brazil'), cfg = getPitConfig(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), 276);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .997, `k=${k} 未与主赛道同向`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  assert.equal(new Set(boxes.map(box => `${box.x.toFixed(2)},${box.y.toFixed(2)}`)).size, 6);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, -track.halfWidth - 20), true);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, track.halfWidth + 20), false);
});

test('英国大奖赛按参考图实现 18 弯与 5.891 km 规格', () => {
  const track = getTrack('silverstone');
  assert.equal(track.name, 'Silverstone Circuit');
  assert.equal(track.raceDistanceMeters, 5891);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 64, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 50000);
  assert.ok(track.samples.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.match(trackMeta('silverstone').details, /18 Turns · 5\.891 km/);
});

test('英国大奖赛 6–9 号弯不再于图像标注位置交叉', () => {
  const track = getTrack('silverstone'), samples = track.samples;
  let minimum = Infinity;
  // 18–21 是进入 6 号弯的 Wellington Straight；34–39 是 7 号弯出口至 9 号弯外圈。
  for (let i = 18 * 32; i <= 21 * 32; i += 4) {
    for (let j = 34 * 32; j <= 39 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `6–9 号弯仍交叉或缓冲区粘连：${minimum.toFixed(1)} < ${required.toFixed(1)}`);
});

test('英国大奖赛 6–8 号弯按参考图形成横向直段、右侧发夹和左侧外圈', () => {
  const controls = getTrack('silverstone').controls;
  const turn6 = controls[23], straightEnd = controls[26];
  const hairpinBottom = controls[29], turn8Approach = controls[35];
  assert.ok(straightEnd.x > turn6.x + 60 * 24, '6 号弯后没有向右展开横向直段');
  assert.ok(Math.abs(straightEnd.y - turn6.y) < 35 * 24, '6–7 号弯之间不应形成倾斜环形');
  assert.ok(hairpinBottom.y > turn6.y + 45 * 24, '7 号弯应向下形成扁平发夹');
  assert.ok(turn8Approach.x < turn6.x - 45 * 24, '7 号弯出口应向左扫入 8 号弯外圈');
});

test('英国大奖赛维修区满足统一尺寸、30 m 白线和两端 50 m 规则', () => {
  const track = getTrack('silverstone'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), 276);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .997, `k=${k} 未与主赛道同向`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, -track.halfWidth - 20), true);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, track.halfWidth + 20), false);
});

test('澳大利亚大奖赛按参考图实现 14 弯与 5.278 km 规格', () => {
  const track = getTrack('australia');
  assert.equal(track.name, 'Melbourne Circuit');
  assert.equal(track.raceDistanceMeters, 5278);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 56, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 45000);
  assert.match(trackMeta('australia').details, /14 Turns · 5\.278 km/);
});

test('澳大利亚维修区复用统一尺寸、正确侧别和 50 m 规则', () => {
  const track = getTrack('australia'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), 276);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .997, `k=${k} 未与主赛道同向`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  assert.equal(new Set(boxes.map(box => `${box.x.toFixed(2)},${box.y.toFixed(2)}`)).size, 6);
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, track.halfWidth + 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, track.halfWidth + 20), true);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), false);
});

test('澳大利亚 PIT OUT 在 1 号弯前顺滑汇入且两侧边界无尖角', () => {
  const track = getTrack('australia'), cfg = getPitConfig(track);
  assert.ok(cfg.exitEnd <= 4 * 32, `PIT OUT 延伸进 1 号弯：${cfg.exitEnd}`);
  for (const side of [-1, 1]) {
    const points = [];
    for (let k = cfg.exitStart; k <= cfg.exitEnd; k++) {
      const p = getPitRoutePoint(track, k), half = getPitRoadHalfWidth(k, track);
      points.push({ k, x:p.x + p.nx * half * side, y:p.y + p.ny * half * side });
    }
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const ux = b.x-a.x, uy = b.y-a.y, vx = c.x-b.x, vy = c.y-b.y;
      const dot = (ux*vx + uy*vy) / (Math.hypot(ux,uy) * Math.hypot(vx,vy));
      assert.ok(dot > .98, `PIT OUT 边界在 k=${b.k} 产生尖角：${dot.toFixed(3)}`);
    }
  }
});

test('大陆轮廓跨越地球背面时沿球缘闭合而不是横穿球面', () => {
  const ring = [[-120,55],[-30,70],[55,50],[80,5],[20,-15],[-70,0],[-120,55]];
  const segments = clipVisibleRing(ring, 120, 18, 200);
  assert.ok(segments.length > 0);
  assert.ok(segments.some(segment => segment.clipped), '测试轮廓没有触发半球裁剪');
  for (const segment of segments.filter(item => item.clipped)) {
    assert.ok(Number.isFinite(segment.startAngle) && Number.isFinite(segment.endAngle));
    assert.ok(segment.points.length >= 2);
    const first = segment.points[0], last = segment.points.at(-1);
    assert.ok(Math.abs(Math.hypot(first.x, first.y) - 200) < 1e-6, '入口交点不在球缘');
    assert.ok(Math.abs(Math.hypot(last.x, last.y) - 200) < 1e-6, '出口交点不在球缘');
  }
});

test('全新沙特阿拉伯大奖赛按参考图实现 27 弯与 6.174 km 规格', () => {
  const track = getTrack('jeddah');
  assert.equal(track.name, 'Jeddah Circuit');
  assert.equal(track.raceDistanceMeters, 6174);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 80, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 60000);
});

test('沙特阿拉伯高速去程与回程连缓冲区也保持草地间隔', () => {
  const track = getTrack('jeddah'), m = track.samples.length;
  let minimum = Infinity;
  for (let i = 0; i < m; i += 8) {
    for (let j = i + 160; j < m; j += 8) {
      if (i < 160 && j > m - 160) continue;
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `吉达缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('全新阿塞拜疆大奖赛按参考图实现 20 弯与 6.003 km 规格', () => {
  const track = getTrack('baku');
  assert.equal(track.name, 'Baku Circuit');
  assert.equal(track.raceDistanceMeters, 6003);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 64, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 50000);
});

test('阿塞拜疆相邻长直道连路肩和缓冲区也保持草地间隔', () => {
  const track = getTrack('baku');
  let minimum = Infinity;
  for (let i = 18 * 32; i <= 26 * 32; i += 4) {
    for (let j = 57 * 32; j <= 66 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `巴库缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('全新阿布扎比大奖赛按参考图实现 16 弯与 5.281 km 规格', () => {
  const track = getTrack('yasmarina');
  assert.equal(track.name, 'Yas Marina Circuit');
  assert.equal(track.raceDistanceMeters, 5281);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 56, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 45000);
});

test('阿布扎比两条长直道连缓冲区也保持草地间隔', () => {
  const track = getTrack('yasmarina');
  let minimum = Infinity;
  for (let i = 20 * 32; i <= 29 * 32; i += 4) {
    for (let j = 62 * 32; j <= 67 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const required = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth) + 120;
  assert.ok(minimum > required, `两条长直道缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('全新比利时大奖赛按参考图实现 20 弯与 7.004 km 规格', () => {
  const track = getTrack('galaxy');
  assert.equal(track.name, 'Spa Circuit');
  assert.equal(track.raceDistanceMeters, 7004);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.ok(track.controls.length >= 56, `控制点不足：${track.controls.length}`);
  assert.equal(track.samples.length, track.controls.length * 32);
  assert.ok(track.totalLength > 50000);
});

test('全新比利时赛道的紧邻回程段连缓冲区也保持分离', () => {
  const track = getTrack('galaxy');
  const twoOuterBuffers = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth);
  let minimum = Infinity;
  // 7–10 号弯外侧去程与 11–13 号弯内侧回程。
  for (let i = 22 * 32; i <= 34 * 32; i += 4) {
    for (let j = 38 * 32; j <= 48 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  assert.ok(minimum > twoOuterBuffers + 120, `Belgium 缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('摩纳哥大奖赛还原 19 弯轮廓与 3.337 km 赛道规格', () => {
  const track = getTrack('rainbow');
  assert.equal(track.name, 'Monte Carlo Circuit');
  assert.equal(track.raceDistanceMeters, 3337);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.halfWidth, 130);
  assert.equal(track.controls.length, 62);
  assert.equal(track.samples.length, 62 * 32);
  assert.ok(track.totalLength > 20000);
});

test('摩纳哥 5–8 号弯去程与回程保留明显视觉间隔', () => {
  const track = getTrack('rainbow');
  let minimum = Infinity;
  for (let i = 23 * 32; i <= 25 * 32; i += 4) {
    for (let j = 29 * 32; j <= 32 * 32; j += 4) {
      minimum = Math.min(minimum, Math.hypot(
        track.samples[i].x - track.samples[j].x,
        track.samples[i].y - track.samples[j].y
      ));
    }
  }
  const twoOuterBuffers = 2 * (track.halfWidth + track.curbWidth + track.bufferWidth);
  assert.ok(minimum > twoOuterBuffers + 120, `5–8 号弯缓冲区间隔不足：${minimum.toFixed(1)}`);
});

test('摩纳哥复用上海维修区规格并沿主直道内侧平滑接入', () => {
  const track = getTrack('rainbow'), shanghai = getTrack('sunshine'), cfg = getPitConfig(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), getPitBoxLength(shanghai));
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62, `k=${k} 未复用上海等宽道路`);
  }
  for (const k of [cfg.entryStart, cfg.exitEnd]) {
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 汇流方向不连续`);
    assert.ok(Math.abs(pit.amount) + getPitRoadHalfWidth(k, track) <= track.halfWidth + 1e-6, `k=${k} 匝道端头未埋入主赛道`);
  }
  for (let k = cfg.entryEnd; k <= cfg.exitStart; k += 8) {
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.amount > 0, `k=${k} 维修区未位于主直道内侧`);
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 未继承主直道弧度`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const distances = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(distances.every(distance => Math.abs(distance - 360) < 12), `车队间距不一致：${distances.join(',')}`);
  const range = getPitSpeedLimitRange(track), target = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target) < 1e-6);
  const idx = k => ((k % m) + m) % m;
  assert.equal(isPitEntryTransition(track, idx(cfg.entryGateStart), track.halfWidth + 20), true);
  assert.equal(isPitExitTransition(track, idx(cfg.exitGateEnd), track.halfWidth + 20), true);
  assert.equal(isPitEntryTransition(track, idx(cfg.entryGateStart), -track.halfWidth - 20), false);
});

test('摩纳哥维修区位于起终点与内场之间而不是赛道外侧', () => {
  const track = getTrack('rainbow'), cfg = getPitConfig(track);
  const middle = getPitRoutePoint(track, (cfg.entryEnd + cfg.exitStart) / 2, 'fast');
  assert.ok(middle.amount > track.halfWidth, `维修区横向偏移仍在外侧：${middle.amount}`);
});

test('摩纳哥离开主赛道 50 m 后才限速且解除限速 50 m 后才汇入主道', () => {
  const track = getTrack('rainbow'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track);
  const routeMeters = (fromK, toK) => {
    const direction = Math.sign(toK - fromK) || 1;
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while ((direction > 0 && k < toK) || (direction < 0 && k > toK)) {
      const nextK = direction > 0 ? Math.min(toK, k + .25) : Math.max(toK, k - .25);
      const current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current;
      k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  const beforeLimit = routeMeters(cfg.entryEnd, range.entryK);
  const afterLimit = routeMeters(range.exitK, cfg.exitStart);
  assert.ok(beforeLimit >= 50, `PIT IN 离开主赛道后仅 ${beforeLimit.toFixed(1)} m 就出现限速线`);
  assert.ok(afterLimit >= 50, `PIT OUT 解除限速后仅 ${afterLimit.toFixed(1)} m 就开始汇入主道`);
});

test('全新比利时维修区复用统一尺寸并满足两端 50 m 规则', () => {
  const track = getTrack('galaxy'), shanghai = getTrack('sunshine'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), getPitBoxLength(shanghai));
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
  }
  for (const k of [cfg.entryStart, cfg.exitEnd]) {
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 汇流方向不连续`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
});

test('全新比利时维修区按参考图弯入起终点内场', () => {
  const track = getTrack('galaxy'), cfg = getPitConfig(track);
  const middleK = (cfg.entryStart + cfg.exitEnd) / 2;
  const middle = getPitRoutePoint(track, middleK, 'fast');
  assert.ok(middle.y < 140 * track.worldScaleY, `维修区仍停留在旧直线位置：y=${middle.y.toFixed(1)}`);
  let previous = getPitRoutePoint(track, cfg.entryStart, 'fast');
  for (let k = cfg.entryStart + 1; k <= cfg.exitEnd; k++) {
    const current = getPitRoutePoint(track, k, 'fast');
    assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < 55, `内侧路线在 k=${k} 跳变`);
    assert.ok(previous.tx * current.tx + previous.ty * current.ty > .99, `内侧路线在 k=${k} 出现折角`);
    previous = current;
  }
});

test('全新阿布扎比维修区 PIT OUT 在 1 号弯内侧且不交叉主赛道', () => {
  const track = getTrack('yasmarina'), cfg = getPitConfig(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), getPitBoxLength(getTrack('sunshine')));
  assert.ok(cfg.exitStart >= 4 * 32 && cfg.exitEnd <= 8 * 32, `PIT OUT 未落在 1 号弯：${cfg.exitStart}..${cfg.exitEnd}`);
  for (let k = cfg.entryEnd; k <= cfg.exitStart; k += 8) {
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.amount > 0, `k=${k} 维修区未位于主直道内侧`);
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 路线未顺主赛道方向`);
  }
  let previous = getPitRoutePoint(track, cfg.entryStart, 'fast');
  for (let k = cfg.entryStart + 1; k <= cfg.exitEnd; k++) {
    const current = getPitRoutePoint(track, k, 'fast');
    assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < 55, `PIT OUT 在 k=${k} 跳变`);
    assert.ok(previous.tx * current.tx + previous.ty * current.ty > .99, `PIT OUT 在 k=${k} 出现折角`);
    previous = current;
  }
  for (const k of [cfg.entryStart, cfg.exitEnd]) {
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 端点不同向`);
    assert.ok(Math.abs(pit.amount) + getPitRoadHalfWidth(k, track) <= track.halfWidth + 1e-6, `k=${k} 端点未埋入主道`);
  }
});

test('全新阿布扎比维修区满足 P 房尺寸、30 m 白线和两端 50 m 规则', () => {
  const track = getTrack('yasmarina'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track);
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) assert.equal(getPitRoadHalfWidth(k, track), 62);
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
});

test('全新阿塞拜疆维修区位于主直道内侧并满足统一尺寸和 50 m 规则', () => {
  const track = getTrack('baku'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), getPitBoxLength(getTrack('sunshine')));
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 未与主赛道同向`);
  }
  for (let k = cfg.entryEnd; k <= cfg.exitStart; k += 8) {
    assert.ok(getPitRoutePoint(track, k, 'fast').amount < 0, `k=${k} 维修区未位于内侧`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, -track.halfWidth - 20), true);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, track.halfWidth + 20), false);
});

test('全新沙特阿拉伯维修区位于主直道内侧并满足统一尺寸和 50 m 规则', () => {
  const track = getTrack('jeddah'), cfg = getPitConfig(track), range = getPitSpeedLimitRange(track), m = track.samples.length;
  assert.equal(getPitBoxLength(track), getPitBoxLength(getTrack('sunshine')));
  for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62);
    const pit = getPitRoutePoint(track, k, 'fast'), main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .997, `k=${k} 未与主赛道同向`);
  }
  for (let k = cfg.entryEnd; k <= cfg.exitStart; k += 8) {
    assert.ok(getPitRoutePoint(track, k, 'fast').amount < 0, `k=${k} 维修区未位于内侧`);
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `P 房间距不一致：${spacing.join(',')}`);
  const target30 = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target30) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target30) < 1e-6);
  const routeMeters = (fromK, toK) => {
    let k = fromK, pixels = 0, previous = getPitRoutePoint(track, k, 'fast');
    while (k < toK) {
      const nextK = Math.min(toK, k + .25), current = getPitRoutePoint(track, nextK, 'fast');
      pixels += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current; k = nextK;
    }
    return pixels * track.raceDistanceMeters / track.totalLength;
  };
  assert.ok(routeMeters(cfg.entryEnd, range.entryK) >= 50);
  assert.ok(routeMeters(range.exitK, cfg.exitStart) >= 50);
  assert.equal(isPitEntryTransition(track, (cfg.entryGateStart + m) % m, -track.halfWidth - 20), true);
  assert.equal(isPitExitTransition(track, cfg.exitGateEnd, -track.halfWidth - 20), true);
});

test('沙特阿拉伯 PIT OUT 两侧边界平滑汇入且不产生尖角', () => {
  const track = getTrack('jeddah'), cfg = getPitConfig(track);
  for (const side of [-1, 1]) {
    const points = [];
    for (let k = cfg.exitStart; k <= cfg.exitEnd; k++) {
      const p = getPitRoutePoint(track, k), half = getPitRoadHalfWidth(k, track);
      points.push({ k, x:p.x + p.nx * half * side, y:p.y + p.ny * half * side });
    }
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const ux = b.x-a.x, uy = b.y-a.y, vx = c.x-b.x, vy = c.y-b.y;
      const dot = (ux*vx + uy*vy) / (Math.hypot(ux,uy) * Math.hypot(vx,vy));
      assert.ok(dot > .95, `PIT OUT 边界在 k=${b.k} 产生尖角：${dot.toFixed(3)}`);
    }
  }
});

test('拉斯维加斯赛道还原 17 弯轮廓且右上角维修区平滑接入', () => {
  const track = getTrack('lasvegas'), cfg = getPitConfig(track), m = track.samples.length;
  assert.equal(track.name, 'Las Vegas Circuit');
  assert.equal(track.controls.length, 34);
  assert.equal(track.worldScaleX, 24);
  assert.equal(track.worldScaleY, 24);
  assert.equal(track.controls[0].x, 420 * 24);
  assert.equal(track.controls[0].y, 20 * 24);
  assert.equal(track.raceDistanceMeters, 6201);
  assert.ok(track.totalLength > 60000);
  for (const k of [cfg.entryStart, cfg.exitEnd]) {
    const pit = getPitRoutePoint(track, k, 'fast');
    const main = track.samples[(k + m) % m];
    assert.ok(pit.tx * main.tx + pit.ty * main.ty > .999, `k=${k} 汇流切线与主赛道不同向`);
  }
  let previous = getPitRoutePoint(track, cfg.entryStart, 'fast');
  for (let k = cfg.entryStart + 1; k <= cfg.exitEnd; k++) {
    const current = getPitRoutePoint(track, k, 'fast');
    assert.ok(previous.tx * current.tx + previous.ty * current.ty > .99, `k=${k} 维修区出现突兀折角`);
    assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < 110, `k=${k} 维修区路线跳变`);
    previous = current;
  }
  const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
  assert.ok(boxes.every(box => box.x > 2000), 'P 房应位于地图右侧');
  assert.ok(boxes.reduce((sum, box) => sum + box.y, 0) / boxes.length < 0, 'P 房组应位于地图上半区');
});

test('拉斯维加斯复用上海维修区的道路、P 房与 30 米限速线规格', () => {
  const track = getTrack('lasvegas'), shanghai = getTrack('sunshine'), cfg = getPitConfig(track);
  const boxes = PIT_TEAMS.map((_, index) => getPitBox(track, index));
  const shanghaiBoxes = PIT_TEAMS.map((_, index) => getPitBox(shanghai, index));
  const range = getPitSpeedLimitRange(track);
  assert.equal(getPitBoxLength(track), getPitBoxLength(shanghai));
  for (const k of [cfg.entryStart, cfg.entryEnd, boxes[2].k, cfg.exitStart, cfg.exitEnd]) {
    assert.equal(getPitRoadHalfWidth(k, track), 62, `k=${k} 未复用上海维修区等宽道路`);
  }
  const spacing = boxes.slice(1).map((box, index) => Math.hypot(box.x - boxes[index].x, box.y - boxes[index].y));
  const shanghaiSpacing = shanghaiBoxes.slice(1).map((box, index) => Math.hypot(box.x - shanghaiBoxes[index].x, box.y - shanghaiBoxes[index].y));
  assert.ok(spacing.every(distance => Math.abs(distance - 360) < 12), `拉斯维加斯车队间距不是上海规格：${spacing.join(',')}`);
  assert.ok(shanghaiSpacing.every(distance => Math.abs(distance - 360) < 12), `上海车队间距未使用共享规格：${shanghaiSpacing.join(',')}`);
  assert.ok(range.entryK > cfg.entryEnd && range.entryK < boxes[0].k);
  assert.ok(range.exitK > boxes.at(-1).k && range.exitK < cfg.exitStart);
  const target = track.totalLength / track.raceDistanceMeters * 30;
  assert.ok(Math.abs(range.entryDistance - target) < 1e-6);
  assert.ok(Math.abs(range.exitDistance - target) < 1e-6);
});

test('拉斯维加斯 PIT IN 与 PIT OUT 只在右上角连接段允许合法跨线', () => {
  const track = getTrack('lasvegas'), cfg = getPitConfig(track), m = track.samples.length;
  const idx = k => ((k % m) + m) % m;
  assert.equal(isPitEntryTransition(track, idx(cfg.entryGateStart), track.halfWidth + 20), true);
  assert.equal(isPitExitTransition(track, idx(cfg.exitGateEnd), track.halfWidth + 20), true);
  assert.equal(isPitEntryTransition(track, idx(cfg.entryStart - 20), track.halfWidth + 20), false);
  assert.equal(isPitExitTransition(track, idx(cfg.exitEnd + 20), track.halfWidth + 20), false);
});

test('拉斯维加斯维修区前后使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('lasvegas')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
  assert.deepEqual(getPitVisualStyle(getTrack('sunshine')), {
    openConnectionGates:true,
    dashedConnectors:true,
    showLabels:true,
  });
});

test('摩纳哥维修区前后使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('rainbow')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('全新比利时维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('galaxy')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('全新阿布扎比维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('yasmarina')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('全新阿塞拜疆维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('baku')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('全新沙特阿拉伯维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('jeddah')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('澳大利亚维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('australia')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('英国维修区使用黑色实线且隐藏 PIT IN/PIT OUT 文字', () => {
  assert.deepEqual(getPitVisualStyle(getTrack('silverstone')), {
    openConnectionGates:false,
    dashedConnectors:false,
    showLabels:false,
  });
});

test('十条重点赛道的维修区入口出口连续且车队 P 房互不重叠', () => {
  for (const id of ['sunshine', 'rainbow', 'galaxy', 'yasmarina', 'lasvegas', 'baku', 'jeddah', 'australia', 'silverstone', 'hockenheim']) {
    const track = getTrack(id), cfg = getPitConfig(track);
    for (const k of [cfg.entryStart, cfg.entryEnd, cfg.exitStart, cfg.exitEnd]) {
      const p = getPitRoutePoint(track, k);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    const boxes = PIT_TEAMS.map(team => getPitBox(track, team.team));
    assert.equal(new Set(boxes.map(box => `${box.x.toFixed(2)},${box.y.toFixed(2)}`)).size, PIT_TEAMS.length);
  }
});
test('六支车队的困难 AI 能在十条重点赛道完成三圈并执行一次强制进站', () => {
  for (const id of ['sunshine', 'rainbow', 'galaxy', 'yasmarina', 'lasvegas', 'baku', 'jeddah', 'australia', 'silverstone', 'hockenheim']) {
    for (const { team } of PIT_TEAMS) {
      const track = { ...getTrack(id), laps: 3 };
      const ai = createAI({ track, skill: 1.02 });
      ai.team = team;
      setupRaceCar(ai, 'medium');
      ai.worldSpeedScale = 2;
      ai.pitBox = getPitBox(track, ai.team);
      ai._lastS = track.samples[0].s;
      ai._cum = 0;
      const state = {
        track,
        weather: createWeather('sunny'),
        raceControl: createRaceControl(),
        player: ai,
        ais: [],
        session: 'race',
        raceTime: 0,
        gaps: new Map()
      };
      // 拉斯维加斯低速弯更多，模拟时间预算略高；其余赛道仍保持原 30 分钟闸门。
      const maxSeconds = ['lasvegas', 'galaxy', 'yasmarina', 'baku', 'jeddah', 'australia', 'silverstone'].includes(id) ? 2700 : 1800;
      for (let frame = 0; frame < 60 * maxSeconds && !ai.finished; frame++) {
        const dt = 1 / 60;
        state.raceTime += dt;
        state.gaps = computeStandings(state).gaps;
        shouldAIPit(ai, state);
        updateRaceSystems(ai, dt, state);
        updateAI(ai, dt, track, state.raceTime, [ai], state);
        collideBoundary(ai, track);
        collidePitBarrier(ai, track);
      }
      assert.equal(ai.finished, true, `${id}/${team} 未能在 ${maxSeconds / 60} 分钟内完赛，停在第 ${ai.lap + 1} 圈索引 ${ai.trackIndex}`);
      assert.ok(ai.pitStops >= 1, `${id}/${team} 未完成强制进站`);
      assert.ok(ai.tyreChanges >= 1, `${id}/${team} 未完成换胎`);
    }
  }
});

let passed = 0;
for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}\n  ${error.stack}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
