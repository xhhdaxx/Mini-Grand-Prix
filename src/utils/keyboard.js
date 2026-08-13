// src/utils/keyboard.js — 键盘输入管理

const keys = {};

export function initKeyboard() {
  addEventListener('keydown', e => {
    keys[e.code] = 1;
    if (['ArrowLeft', 'ArrowRight', 'KeyW', 'KeyD', 'KeyS', 'KeyX', 'Space', 'Escape'].includes(e.code)) {
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => {
    keys[e.code] = 0;
  });
}

export function isKeyDown(code) {
  return !!keys[code];
}

export function resetKeys() {
  for (const k in keys) keys[k] = 0;
}
