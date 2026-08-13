// 相机：根据赛道 bounding box 算缩放，平滑跟随目标车 + 沿车头方向 lookahead。
const LOOK_AHEAD = 90;

export function computeZoom(track) {
  // 放大后的上海赛道使用近景跟车，不再为了显示完整地图而缩得很小。
  if (track.worldScale > 1) return 0.82;

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const s of track.samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  const w = maxX - minX + 200;
  const h = maxY - minY + 200;
  const zx = innerWidth / w;
  const zy = innerHeight / h;
  return Math.min(zx, zy, 1.0) * 0.95;
}

// viewW = 该视图宽度，screenCenterX = 视图中心在整屏的 x 坐标。
export function updateCam(cam, target, viewW, screenCenterX, dt) {
  if (!target) return;
  const zoom = cam.zoom || 0.82;
  const targetX = -(target.x + Math.cos(target.angle) * LOOK_AHEAD) * zoom + screenCenterX;
  const targetY = -(target.y + Math.sin(target.angle) * LOOK_AHEAD) * zoom + innerHeight / 2;
  const lerp = Math.min(1, 6 * dt);
  cam.x += (targetX - cam.x) * lerp;
  cam.y += (targetY - cam.y) * lerp;
  if (cam.shake > 0) {
    cam.x += (Math.random() - 0.5) * cam.shake;
    cam.y += (Math.random() - 0.5) * cam.shake;
    cam.shake = Math.max(0, cam.shake - dt * 30);
  }
}
