// 起跑格子位置计算：2 列网格，同列前后间距 162px，同排左右轻微错开 18px（梯形起步）。
const ROW_SPACING = 162;
const STAGGER = 18;
const LATERAL_OFFSET = 28; // 左右离赛道中心

export function gridPosition(track, slot) {
  const row = Math.floor(slot / 2);            // 第几排（0=最前起跑线）
  const side = slot % 2 === 0 ? -1 : 1;        // 偶数左 / 奇数右
  const back = row * ROW_SPACING + (slot % 2) * STAGGER;
  const m = track.samples.length;
  let cum = 0;
  let idx = 0;
  while (cum < back) {
    const prev = (idx - 1 + m) % m;
    const seg = Math.hypot(track.samples[idx].x - track.samples[prev].x, track.samples[idx].y - track.samples[prev].y);
    if (cum + seg >= back) break;
    cum += seg;
    idx = prev;
  }
  const p = track.samples[idx];
  return { p, x: p.x + p.nx * side * LATERAL_OFFSET, y: p.y + p.ny * side * LATERAL_OFFSET };
}
