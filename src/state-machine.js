// 显式有限状态机：管理游戏阶段流转。
// 所有 UI 面板与比赛流程的进入/退出都走这里，避免散落的 flag 切换。
import { resetKeys } from './utils/keyboard.js';
import { t } from './i18n.js';

// 状态节点：key = 阶段名，value = { enter, exit } 钩子（可选）
// enter/exit 接收 (ctx) 参数，ctx 是主程序注入的上下文（含 state、$ 等）
const nodes = new Map();
let current = null;
let ctxRef = null;

export function defineState(name, { enter, exit } = {}) {
  nodes.set(name, { enter, exit });
}

export function getState() {
  return current;
}

export function isState(name) {
  return current === name;
}

// 切换到目标阶段：先执行当前阶段的 exit，再执行目标阶段的 enter。
// 重复切到同一阶段是 no-op（避免重入抖动）。
export function transition(name) {
  if (current === name) return;
  if (!nodes.has(name)) throw new Error(t('未定义的游戏状态: {name}', { name }));
  const from = current ? nodes.get(current) : null;
  const to = nodes.get(name);
  if (from?.exit) try { from.exit(ctxRef); } catch (err) { console.error(`[FSM exit:${current}]`, err); }
  current = name;
  if (to?.enter) try { to.enter(ctxRef); } catch (err) { console.error(`[FSM enter:${name}]`, err); }
}

export function bindContext(ctx) {
  ctxRef = ctx;
}

// 阶段谓词：菜单类阶段（不显示倒计时/HUD）
export function isInMenu() {
  return current === 'menu' || current === 'trackSelect' || current === 'raceSetup'
    || current === 'garage' || current === 'career' || current === 'rules' || current === 'qr';
}

export function isInRace() {
  return current === 'racing' || current === 'paused';
}

// 暂停/恢复只在 racing 内部切换，不改变 FSM 节点（暂停仍是 racing 阶段的一个子状态）。
// 这里通过 ctx.state.paused 控制，FSM 层不感知，但需要同步显隐暂停面板上的按钮。
export function togglePause(ctx, force) {
  if (!ctx || !ctx.state) return;
  const s = ctx.state;
  if (current !== 'racing') return;
  const next = typeof force === 'boolean' ? force : !(s.paused ?? false);
  if (next === (s.paused ?? false)) return;
  s.paused = next;
  resetKeys();
  const panel = document.querySelector('#pausePanel');
  if (panel) panel.classList.toggle('hidden', !s.paused);
  if (!s.paused) s.last = performance.now();
}
