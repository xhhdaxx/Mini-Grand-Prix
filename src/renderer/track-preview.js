// 比赛设置页右栏的赛道俯视预览：复用 drawTrack 渲染，按 canvas 尺寸自适应缩放居中。
import { drawTrack } from './track-render.js';
import { getPitConfig, getPitRoutePoint, getPitRoadHalfWidth } from '../game/track.js';

export function drawTrackPreview(canvas, track) {
  if (!canvas || !track) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 800;
  const cssH = canvas.clientHeight || canvas.parentElement.clientHeight || 600;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const s = track.samples;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // 独立维修区也是赛道图的一部分。统一纳入取景范围，避免墨西哥城等
  // 维修区偏离主赛道中心线的地图在设置页裁掉 PIT IN、P 房或 PIT OUT。
  const pit = getPitConfig(track);
  for (let k = pit.entryStart; k <= pit.exitEnd; k += 2) {
    const p = getPitRoutePoint(track, k);
    const halfWidth = getPitRoadHalfWidth(k, track);
    minX = Math.min(minX, p.x - halfWidth);
    minY = Math.min(minY, p.y - halfWidth);
    maxX = Math.max(maxX, p.x + halfWidth);
    maxY = Math.max(maxY, p.y + halfWidth);
  }
  const margin = track.halfWidth + (track.curbWidth || 8) + (track.bufferWidth || track.halfWidth * 2 / 3) + 36;
  const boxW = (maxX - minX) + margin * 2;
  const boxH = (maxY - minY) + margin * 2;
  const scale = Math.min(cssW / boxW, cssH / boxH);
  const cx = cssW / 2 - ((minX + maxX) / 2) * scale;
  const cy = cssH / 2 - ((minY + maxY) / 2) * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  drawTrack(ctx, track, null, null);
  ctx.restore();
}
