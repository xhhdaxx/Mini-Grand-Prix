// 主入口：组装游戏上下文、注册状态机节点、初始化菜单与游戏手柄客户端。
import { initKeyboard } from './utils/keyboard.js';
import { readInputMode, supportsGamepad } from './config/input-mode.js';
import { setVirtualKey, resetVirtualKeysFor } from './utils/input.js';
import {
  getVehicleSetup, getVehicleSetup2,
  getDriveSettings, getLastTeam,
  getCareer, getRaceHistory, getSeason, resetSeason, getRanks,
  subscribeDataChanges, isCareerDataKey
} from './utils/storage.js';
import { createWeather, createRaceControl, commitPitService } from './game/race-systems.js';
import { sanitizeVehicleSetup } from './game/vehicle-config.js';
import {
  defineState, bindContext, transition, togglePause as fsmTogglePause, isState
} from './state-machine.js';
import { initGamepadClient, onGamepadEvent, setPushHandler, pushPlayerState } from './gamepad/ws-client.js';
import { startRace, showResultPage, setupResultPagination, getResultPage } from './game/race-flow.js';
import {
  bindMenus, renderGarage, showQrPanel, renderSeasonBoard, initCareerPanel, renderTyreStatsTable, renderHomeTrackMenu
} from './ui/menus.js';
import { t, isZh, setLang, onLangChange } from './i18n.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx2d = canvas.getContext('2d');
const inputMode = readInputMode();
const gamepadEnabled = supportsGamepad(inputMode);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

initKeyboard();

// ===== 状态 =====
const state = {
  inputMode,
  mode: 'race',
  trackId: 'sunshine',
  selectedTrackId: null,
  raceLaps: 3,
  soloLaps: 1,
  track: null,
  player: null,
  player2: null,
  ai: null,
  ais: [],
  difficulty: 'normal',
  weatherKind: 'dynamic',
  startingTyre: 'medium',
  selectedTeam: getLastTeam(),
  weather: createWeather('dynamic'),
  raceControl: createRaceControl(),
  session: 'race',
  qualifyingResults: null,
  playerGridOrder: 5,
  player2GridOrder: 1,
  settings: { assists: true, collision: 'full', ...getDriveSettings() },
  livery: 'cobalt',
  vehicleSetup: sanitizeVehicleSetup(getVehicleSetup() || {}),
  vehicleSetup2: sanitizeVehicleSetup(getVehicleSetup2() || {}),
  raceTime: 0,
  countdown: 5.2,
  running: false,
  paused: false,
  last: 0,
  cam: { x: 0, y: 0, zoom: 0.7 },
  cam2: { x: 0, y: 0, zoom: 0.7 },
  gamepad: { p1: false, p2: false }
};

// ===== 上下文：注入到 FSM、race-flow、menus =====
const ctx = {
  $, state, ctx2d,
  gamepadEnabled,
  rulesReturn: 'menu',
  startRace: (mode, trackId, session) => startRace(ctx, mode, trackId, session),
  togglePause: (force) => fsmTogglePause(ctx, force),
  showResultPage,
  getResultPage,
  setupResultPagination,
  showQrPanel,
  updateGamepadHud,
  pushPlayerState,
  resetSeason: () => { resetSeason(); renderSeasonBoard(ctx); },
  getSeason, getCareer, getRaceHistory, getRanks
};
bindContext(ctx);

// ===== 游戏手柄 WS 客户端 =====
onGamepadEvent('connection', (msg) => {
  if (!msg) return;
  if (msg.reset) {
    state.gamepad.p1 = false; state.gamepad.p2 = false;
    updateGamepadHud();
    return;
  }
  state.gamepad[msg.player] = msg.connected;
  if (!msg.connected) resetVirtualKeysFor(msg.player);
  updateGamepadHud();
});
onGamepadEvent('input', (msg) => {
  setVirtualKey(msg.player, msg.key, msg.pressed);
});
onGamepadEvent('pit', (msg) => {
  const car = msg.player === 'p2' ? state.player2 : state.player;
  if (car && state.running) {
    car._pitRequested = !!msg.requested;
    car.warning = t(car._pitRequested ? '已请求进站 · 驶向起终点外侧' : '取消进站');
    car.warningTime = 3;
  }
});
onGamepadEvent('pitTyre', (msg) => {
  const car = msg.player === 'p2' ? state.player2 : state.player;
  if (!car || !state.running) return;
  const validTyres = ['soft', 'medium', 'hard', 'inter', 'wet'];
  if (!validTyres.includes(msg.tyre)) return;
  if (!commitPitService(car, msg.tyre)) return;
  car.warning = t('下次进站换 {x} 胎', { x: msg.tyre.toUpperCase() });
  car.warningTime = 3;
});
setPushHandler((ws, s) => {
  const totalLaps = s.track?.laps || 0;
  const send = (pid, car) => {
    if (!car) return;
    const ratio = Math.min(1, Math.abs(car.v) / (car._maxV || 380));
    const speedColor = ratio > 0.8 ? '#e84545' : ratio > 0.5 ? '#ffb84d' : '#3a86ff';
    ws.send(JSON.stringify({
      role: 'state', player: pid,
      speed: Math.round(Math.abs(car.v) * 0.7),
      speedColor,
      lap: car.lap || 0,
      totalLaps,
      lapTime: car.lapStartTime > 0 ? s.raceTime - car.lapStartTime : 0,
      bestLap: car.bestLap,
      finished: !!car.finished,
      countdown: s.countdown > 0 ? Math.ceil(s.countdown) : 0,
      pitRequested: !!car._pitRequested,
      pitServicing: car.inPit && car.pitTimer > 0 && car.pitTimer < 2.5 ? (car.nextTyre || car.tyre) : null,
      pitProgress: car.inPit && car.pitTimer > 0 ? Math.min(1, car.pitTimer / 2.5) : 0,
      canPickTyre: !!(car.atPitBox && Math.abs(car.v || 0) < 24 && !car.nextTyre && !car._pitServiced)
    }));
  };
  send('p1', s.player);
  if (s.player2) send('p2', s.player2);
});

function updateGamepadHud() {
  const el = $('#gamepadHud');
  if (!el) return;
  if (!gamepadEnabled) {
    el.classList.add('hidden');
    return;
  }
  el.classList.toggle('hidden', !!state.running);
  const p1On = !!state.gamepad.p1;
  const p2On = !!state.gamepad.p2;
  el.classList.toggle('online', p1On || p2On);
  el.innerHTML = `
    <span class="gh-tag p1 ${p1On ? 'online' : ''}"><span class="gh-dot"></span>P1</span>
    <span class="gh-sep"></span>
    <span class="gh-tag p2 ${p2On ? 'online' : ''}"><span class="gh-dot"></span>P2</span>
  `;
}

// 同一场比赛结算会连续写入排行榜、生涯和赛季数据。合并到一个微任务中重绘，
// 既保证当前页面马上更新，也避免在一次结算里重复渲染数次。
let careerRefreshQueued = false;
function scheduleCareerRefresh() {
  if (careerRefreshQueued) return;
  careerRefreshQueued = true;
  queueMicrotask(() => {
    careerRefreshQueued = false;
    initCareerPanel(ctx);
  });
}

subscribeDataChanges(scheduleCareerRefresh);
addEventListener('storage', event => {
  if (isCareerDataKey(event.key)) scheduleCareerRefresh();
});

// ===== 状态机节点：每个阶段对应一组 UI 面板的显隐 =====
// menu：主菜单
defineState('menu', {
  enter: () => {
    $('#menu').classList.remove('hidden');
    $('#trackSelect').classList.add('hidden');
    $('#raceSetup').classList.add('hidden');
    $('#over').classList.add('hidden');
    $('#garagePanel').classList.add('hidden');
    $('#careerPanel').classList.add('hidden');
    $('#rulesPanel').classList.add('hidden');
    $('#pausePanel').classList.add('hidden');
    $('#qrPanel').classList.add('hidden');
    updateGamepadHud();
  }
});

// trackSelect：选关面板
defineState('trackSelect', {
  enter: () => {
    $('#menu').classList.add('hidden');
    $('#trackSelect').classList.remove('hidden');
    $('#raceSetup').classList.add('hidden');
    $('#over').classList.add('hidden');
  }
});

// raceSetup：比赛设置（难度/天气/轮胎/车队等）
defineState('raceSetup', {
  enter: () => {
    $('#menu').classList.add('hidden');
    $('#trackSelect').classList.add('hidden');
    $('#over').classList.add('hidden');
    $('#raceSetup').classList.remove('hidden');
  }
});

// racing：比赛中（FSM 不直接管面板，race-flow 接管）
defineState('racing', {
  enter: () => {
    // 面板显隐已在 startRace 中处理
  }
});

// results：结算页
defineState('results', {
  enter: () => {
    // 结算页内容由 endRace 填充
  }
});

// garage：车库
defineState('garage', {
  enter: () => {
    $('#menu').classList.add('hidden');
    renderGarage(ctx);
    $('#garagePanel').classList.remove('hidden');
  }
});

// career：生涯面板
defineState('career', {
  enter: () => {
    $('#menu').classList.add('hidden');
    initCareerPanel(ctx);
    $('#careerPanel').classList.remove('hidden');
  }
});

// rules：规则面板
defineState('rules', {
  enter: () => {
    renderTyreStatsTable();
    $('#menu').classList.add('hidden');
    $('#pausePanel').classList.add('hidden');
    $('#rulesPanel').classList.remove('hidden');
  },
  exit: () => {
    $('#rulesPanel').classList.add('hidden');
  }
});

// qr：手机手柄地址面板（双人模式开赛前等手柄连接）
defineState('qr', {
  enter: () => { /* showQrPanel 由 race-flow 直接调用 */ }
});

// ===== 启动 =====
bindMenus(ctx);
initCareerPanel(ctx);

// ===== 语言切换按钮（左栏 中文/English 分段开关） =====
const btnLang = $('#btnLang');
const langOpts = btnLang ? btnLang.querySelectorAll('.lang-opt') : [];
const syncLangBtn = () => {
  if (!btnLang) return;
  langOpts.forEach(opt => opt.classList.toggle('active', opt.dataset.lang === (isZh() ? 'zh' : 'en')));
};
syncLangBtn();
if (btnLang) btnLang.onclick = () => setLang(isZh() ? 'en' : 'zh');
onLangChange(() => {
  syncLangBtn();
  // 语言按钮在主菜单可见，切换后重绘主菜单的动态面板（赛道列表 / 模式 / 位置文字）。
  if (isState('menu')) renderHomeTrackMenu(ctx);
});

document.body.dataset.inputMode = inputMode;
if (!gamepadEnabled) $('#btnDuel')?.classList.add('hidden');
if (gamepadEnabled) initGamepadClient();
transition('menu');

// 测试钩子：暴露 state 便于冒烟测试观察
if (location.search.includes('test=1')) window.__testCtx = ctx;
