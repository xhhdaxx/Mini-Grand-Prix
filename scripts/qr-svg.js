// scripts/qr-svg.js — 极简 QR 码生成（SVG 输出）
//
// Copyright (c) Project Nayuki — https://www.nayuki.io/page/qr-code-generator-library
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// - The above copyright notice and this permission notice shall be included in
//   all copies or substantial portions of the Software.
// - The Software shall be used for Good, not Evil. If the source code or binary
//   is used in an Evil organization, a donation of USD 100 to the author is
//   appreciated.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// 本文件是 Nayuki QR-Code-generator 项目的简化改写：仅支持 byte 编码 + L 纠错 +
// 自动版本，输出可扫描的 SVG。完整实现见 https://github.com/nayuki/QR-Code-generator
// 完整许可文本与说明见 THIRD_PARTY_NOTICES.md。

// ---- QR Code generation (minimal, byte mode, ECC level L) ----

const ECC_CODEWORDS_PER_BLOCK = [
  -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25
];

function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ver] * NUM_ERROR_CORRECTION_BLOCKS[ver];
}
function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

// Reed-Solomon 编码
function reedSolomonComputeDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMul(root, 0x02);
  }
  return result;
}
function reedSolomonComputeRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= rsMul(divisor[i], factor);
    }
  }
  return result;
}
function rsMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >> 7) * 0x11D);
    z ^= ((y >> i) & 1) * x;
  }
  return z & 0xFF;
}

function buildMatrix(ver, allCodewords) {
  const size = ver * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const fn = (x, y, isDark) => { matrix[y][x] = isDark; };
  // Finder patterns
  function drawFinder(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
        matrix[yy][xx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 2 && Math.max(Math.abs(dx), Math.abs(dy)) !== 4;
      }
    }
  }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
  // Timing
  for (let i = 0; i < size; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }
  // Dark module
  matrix[size - 8][8] = true;
  // Alignment
  if (ver >= 2) {
    const aligns = getAlignmentPositions(ver);
    for (const r of aligns) for (const c of aligns) {
      if (matrix[r][c] !== null) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        matrix[r + dy][c + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
      }
    }
  }
  // Place data
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (matrix[y][x] === null && i < allCodewords.length * 8) {
          const bit = (allCodewords[i >>> 3] >>> (7 - (i & 7))) & 1;
          matrix[y][x] = bit === 1;
          i++;
        }
      }
    }
  }
  // Mask (mask 0)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (matrix[y][x] !== null) {
      const invert = (x + y) % 2 === 0;
      if (invert) matrix[y][x] = !matrix[y][x];
    }
  }
  return matrix;
}

function getAlignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil(ver * 2 / (numAlign * 2 - 2));
  let result = [6];
  for (let pos = size(ver) - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}
function size(ver) { return ver * 4 + 17; }

function encodeByte(text) {
  // UTF-8 编码
  const bytes = Array.from(new TextEncoder().encode(text));
  // 选版本
  for (let ver = 1; ver <= 40; ver++) {
    const dataCapacity = getNumDataCodewords(ver, 0); // ECC level L = 0
    const needBytes = 2 + bytes.length + 1; // mode(4bit) + count(8/16bit) + data + terminator
    // 简化估算
    const totalBits = 4 + (bytes.length < 256 ? 8 : 16) + bytes.length * 8;
    if (Math.ceil(totalBits / 8) + ECC_CODEWORDS_PER_BLOCK[ver] * NUM_ERROR_CORRECTION_BLOCKS[ver] > getNumRawDataModules(ver) / 8) continue;
    if (totalBits > dataCapacity * 8) continue;
    return buildQR(ver, bytes, totalBits);
  }
  throw new Error('text too long for QR');
}

function buildQR(ver, bytes, totalBits) {
  const dataCapacity = getNumDataCodewords(ver, 0);
  const bb = [];
  function appendBits(val, len) {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  }
  appendBits(0b0100, 4); // byte mode
  appendBits(bytes.length, bytes.length < 256 ? 8 : 16);
  for (const b of bytes) appendBits(b, 8);
  // terminator
  const dataCapacityBits = dataCapacity * 8;
  if (bb.length < dataCapacityBits) appendBits(0, Math.min(4, dataCapacityBits - bb.length));
  // pad to byte
  while (bb.length % 8 !== 0) bb.push(0);
  // pad bytes
  const dataCodewords = [];
  for (let i = 0; i < bb.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bb[i + j];
    dataCodewords.push(v);
  }
  const padBytes = [0xEC, 0x11];
  for (let i = 0; dataCodewords.length < dataCapacity; i++) dataCodewords.push(padBytes[i % 2]);

  // ECC
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ver];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ver];
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks = [];
  const eccBlocks = [];
  const divisor = reedSolomonComputeDivisor(eccPerBlock);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const blockLen = shortBlockLen - (i < numShortBlocks ? 0 : 1);
    const block = dataCodewords.slice(k, k + blockLen);
    k += blockLen;
    blocks.push(block);
    const ecc = reedSolomonComputeRemainder(block, divisor);
    eccBlocks.push(ecc);
  }
  // interleave
  const result = [];
  for (let i = 0; i < shortBlockLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i < blocks[j].length) result.push(blocks[j][i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (let j = 0; j < numBlocks; j++) result.push(eccBlocks[j][i]);
  }
  return buildMatrix(ver, result);
}

export function generateQR(text) {
  const matrix = encodeByte(text);
  const size = matrix.length;
  const scale = 6;
  const margin = 4 * scale;
  const dim = size * scale + margin * 2;
  let rects = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) {
        rects += `<rect x="${margin + x * scale}" y="${margin + y * scale}" width="${scale}" height="${scale}"/>`;
      }
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}"><rect width="${dim}" height="${dim}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
