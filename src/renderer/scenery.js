// 场景装饰：天空背景、云朵、雨、速度线。纯绘制函数，无状态。

export function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9be7ff');
  g.addColorStop(0.5, '#b8efff');
  g.addColorStop(1, '#e8faff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawRain(ctx, W, H, t, strength) {
  ctx.save();
  ctx.strokeStyle = `rgba(195,225,255,${0.12 + strength * 0.38})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 90 * strength; i++) {
    const x = (i * 83 + t * 520) % (W + 80) - 40;
    const y = (i * 137 + t * 760) % (H + 80) - 40;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 20); ctx.stroke();
  }
  ctx.fillStyle = `rgba(35,65,90,${strength * 0.14})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawSpeedLines(ctx, W, H, speed, raceTime) {
  if (speed < 250) return;
  const alpha = Math.min(0.22, (speed - 250) / 600);
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = (i * 149 + raceTime * 900) % W;
    const y = (i * 83) % H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 38, y + 12); ctx.stroke();
  }
  ctx.restore();
}

export function drawClouds(ctx, W, H, t) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const clouds = [
    { x: (W * 0.2 - t * 8) % (W + 200), y: H * 0.12, s: 1 },
    { x: (W * 0.6 - t * 5) % (W + 200), y: H * 0.18, s: 0.7 },
    { x: (W * 0.85 - t * 10) % (W + 200), y: H * 0.08, s: 0.85 }
  ];
  for (const c of clouds) {
    const x = c.x < -100 ? c.x + W + 200 : c.x;
    ctx.beginPath();
    ctx.arc(x, c.y, 22 * c.s, 0, Math.PI * 2);
    ctx.arc(x + 24 * c.s, c.y + 4, 18 * c.s, 0, Math.PI * 2);
    ctx.arc(x - 22 * c.s, c.y + 5, 16 * c.s, 0, Math.PI * 2);
    ctx.arc(x + 6 * c.s, c.y - 12 * c.s, 16 * c.s, 0, Math.PI * 2);
    ctx.fill();
  }
}
