// 手机手柄 WebSocket 客户端：负责与 server.js 的 /ws 中继通信。
// 仅当通过 http(s) 访问时启用（file:// 下无法用 WS）。
import { setVirtualKey, resetVirtualKeys, resetVirtualKeysFor } from '../utils/input.js';

let ws = null;
let retryTimer = null;
const listeners = { connection: null, input: null, pit: null, pitTyre: null };
let pushHandler = null; // 接收 state 推送目标的回调

export function initGamepadClient() {
  if (location.protocol === 'file:') return;
  connect();
}

function connect() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ role: 'host' }));
    listeners.connection?.();
  };
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'connection') {
      listeners.connection?.(msg);
    } else if (msg.type === 'input') {
      listeners.input?.(msg);
    } else if (msg.type === 'pit') {
      listeners.pit?.(msg);
    } else if (msg.type === 'pitTyre') {
      listeners.pitTyre?.(msg);
    }
  };
  ws.onclose = () => {
    listeners.connection?.({ connected: false, reset: true });
    resetVirtualKeys();
    retryTimer = setTimeout(connect, 1000);
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

export function onGamepadEvent(type, fn) {
  listeners[type] = fn;
}

export function setPushHandler(fn) {
  pushHandler = fn;
}

// 推送玩家状态给手机手柄（节流 ~12fps）
let _lastSent = 0;
export function pushPlayerState(state) {
  if (!ws || ws.readyState !== 1) return;
  const now = performance.now();
  if (now - _lastSent < 80) return;
  _lastSent = now;
  pushHandler?.(ws, state);
}

export function closeGamepadClient() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (ws) { try { ws.close(); } catch {} ws = null; }
}

export { setVirtualKey, resetVirtualKeys, resetVirtualKeysFor };
