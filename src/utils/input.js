// src/utils/input.js — 虚拟输入状态（手机手柄写入，controlCar 读取）
// 维护 P1 / P2 两套独立按键状态，键盘和触摸手柄都通过 setVirtualKey 写入。

const PLAYERS = ['p1', 'p2'];
const KEY_FIELDS = ['left', 'right', 'up', 'down', 'emergency', 'reverse', 'boost'];

const virtualKeys = {
  p1: Object.fromEntries(KEY_FIELDS.map(k => [k, false])),
  p2: Object.fromEntries(KEY_FIELDS.map(k => [k, false]))
};

export function setVirtualKey(player, key, pressed) {
  const p = virtualKeys[player];
  if (p && key in p) p[key] = !!pressed;
}

export function getVirtualKeys(player) {
  return virtualKeys[player] || virtualKeys.p1;
}

export function resetVirtualKeys() {
  PLAYERS.forEach(p => KEY_FIELDS.forEach(k => { virtualKeys[p][k] = false; }));
}

export function resetVirtualKeysFor(player) {
  const p = virtualKeys[player];
  if (p) KEY_FIELDS.forEach(k => { p[k] = false; });
}
