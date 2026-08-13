// scripts/gen-gamepad-icons.js — 生成 PWA 图标 PNG（无外部依赖）
// 跑一次：node scripts/gen-gamepad-icons.js
// 输出 gamepad-icon-192.png 和 gamepad-icon-512.png 到 assets/ 目录

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePNG(width, height, getPixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y);
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// 卡通风格图标：奶黄背景 + 黑色方向盘圆 + 红色中心
function pixel(size) {
  const cx = size / 2, cy = size / 2;
  const R_outer = size * 0.42;   // 外圆半径
  const R_inner = size * 0.20;   // 内圆半径
  const strokeW = size * 0.06;
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    // 外环（黑色描边）
    if (Math.abs(d - R_outer) < strokeW / 2) return [43, 43, 51];
    // 内圆红色
    if (d < R_inner) return [232, 69, 69];
    // 内圆描边
    if (Math.abs(d - R_inner) < strokeW / 2.5) return [43, 43, 51];
    // 三个辐条（120° 分布）
    const angle = Math.atan2(dy, dx);
    for (let i = 0; i < 3; i++) {
      const a = angle - (i * 2 * Math.PI / 3);
      const proj = d * Math.cos(a);
      const perp = Math.abs(d * Math.sin(a));
      if (proj > R_inner && proj < R_outer && perp < strokeW / 2.5) return [43, 43, 51];
    }
    // 背景
    return [255, 248, 231];
  };
}

const root = path.resolve(import.meta.dirname, '..');
for (const size of [192, 512]) {
  const png = makePNG(size, size, pixel(size));
  const out = path.join(root, 'assets', `gamepad-icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`生成 ${out} (${png.length} bytes)`);
}
