// src/renderer/car-render.js — 俯视方程式单座赛车

export function drawCar(ctx, car, opts = {}) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle + Math.PI / 2);
  if (opts.ghost) ctx.globalAlpha = 0.5;

  // 整车宽约等于上海赛道的一条车道。
  const W = 40;
  const H = 82;

  // ERS 放电蓝色尾流；制动回收显示绿色粒子，静音时也能辨识车辆状态。
  if (car.boostActive) {
    const glow = ctx.createRadialGradient(0, H * 0.48, 2, 0, H * 0.55, 42);
    glow.addColorStop(0, 'rgba(70,210,255,.9)'); glow.addColorStop(1, 'rgba(30,100,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(-44, H * 0.25, 88, 70);
  } else if ((car.regenRate || 0) > 0) {
    ctx.fillStyle = 'rgba(72,255,150,.72)';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc((i - 3) * 7, H * .48 + (i % 3) * 6, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }

  // 重刹/侧滑留下短轮胎痕；碰撞时飞出少量碳纤维碎片。
  if ((car.locked || car.slip > 80) && Math.abs(car.v) > 80) {
    ctx.strokeStyle = 'rgba(28,28,30,0.48)';
    ctx.lineWidth = 3;
    for (const sx of [-14, 14]) {
      ctx.beginPath(); ctx.moveTo(sx, 22); ctx.lineTo(sx, 54); ctx.stroke();
    }
  }
  if (car.collisionFlash > 0) {
    ctx.fillStyle = '#24262c';
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      ctx.save(); ctx.rotate(a); ctx.fillRect(24 + i * 2, -2, 5, 3); ctx.restore();
    }
  }

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  roundRect(ctx, -W / 2 + 3, -H / 2 + 4, W, H, 7);
  ctx.fill();

  // 锁胎或大幅侧滑时从轮胎后方喷出白烟。
  if (car.locked || car.slip > 85) {
    ctx.fillStyle = 'rgba(245,245,245,0.48)';
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(sx * (W * 0.4 + Math.random() * 4), H * (0.2 + i * 0.08) + Math.random() * 5, 4 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 草地边缘产生草屑和尘土。
  if ((car.surface === 'grass' || car.surface === 'gravel') && Math.abs(car.v) > 25) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = car.surface === 'gravel' ? (i % 2 ? 'rgba(190,165,112,.8)' : 'rgba(125,101,62,.7)') : (i % 2 ? 'rgba(78,132,43,0.75)' : 'rgba(139,99,48,0.65)');
      ctx.fillRect((Math.random() - 0.5) * W, H * 0.3 + Math.random() * 22, 2, 3 + Math.random() * 4);
    }
  }
  if ((car.wetness || 0) > 0.18 && Math.abs(car.v) > 80) {
    ctx.fillStyle = `rgba(205,232,248,${Math.min(.55, car.wetness * .6)})`;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc((Math.random() - .5) * W * 1.5, H * .5 + Math.random() * 30, 3 + Math.random() * 5, 0, Math.PI * 2); ctx.fill(); }
  }

  // 碳纤维底板与扩散器，作为车身下方的细长黑色基座。
  ctx.fillStyle = '#181a1f';
  ctx.beginPath();
  ctx.moveTo(-W * 0.09, -H * 0.34);
  ctx.lineTo(-W * 0.34, H * 0.24);
  ctx.lineTo(-W * 0.27, H * 0.43);
  ctx.lineTo(W * 0.27, H * 0.43);
  ctx.lineTo(W * 0.34, H * 0.24);
  ctx.lineTo(W * 0.09, -H * 0.34);
  ctx.closePath();
  ctx.fill();

  // 参考图式外露悬挂：细连杆把四个车轮与中央车体连接起来。
  ctx.strokeStyle = '#d8dde2';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-W * 0.08, -H * 0.31); ctx.lineTo(-W * 0.4, -H * 0.29);
  ctx.moveTo(W * 0.08, -H * 0.31); ctx.lineTo(W * 0.4, -H * 0.29);
  ctx.moveTo(-W * 0.2, H * 0.17); ctx.lineTo(-W * 0.41, H * 0.27);
  ctx.moveTo(W * 0.2, H * 0.17); ctx.lineTo(W * 0.41, H * 0.27);
  ctx.stroke();

  // 前轮较小、后轮明显更宽，贴近参考图的夸张比例。
  const tires = [
    [-W * 0.43, -H * 0.29, 9, 17], [W * 0.43, -H * 0.29, 9, 17],
    [-W * 0.44, H * 0.27, 11, 19], [W * 0.44, H * 0.27, 11, 19]
  ];
  for (const [x, y, tw, th] of tires) {
    ctx.fillStyle = '#16171b';
    roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 3);
    ctx.fill();
    ctx.fillStyle = '#747983';
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // 轮胎纵向沟槽
    ctx.strokeStyle = '#333640';
    ctx.lineWidth = 1;
    for (const gx of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(x + gx, y - th * 0.34);
      ctx.lineTo(x + gx, y + th * 0.34);
      ctx.stroke();
    }
  }

  // 分体倾斜前翼，中间给长鼻锥留出缺口。
  ctx.fillStyle = car.color;
  ctx.strokeStyle = '#25262c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-W * 0.06, -H * 0.46);
  ctx.lineTo(-W * 0.48, -H * 0.5);
  ctx.lineTo(-W * 0.45, -H * 0.4);
  ctx.lineTo(-W * 0.07, -H * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.06, -H * 0.46);
  ctx.lineTo(W * 0.48, -H * 0.5);
  ctx.lineTo(W * 0.45, -H * 0.4);
  ctx.lineTo(W * 0.07, -H * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = car.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-W * 0.43, -H * 0.44); ctx.lineTo(-W * 0.1, -H * 0.45);
  ctx.moveTo(W * 0.43, -H * 0.44); ctx.lineTo(W * 0.1, -H * 0.45);
  ctx.stroke();
  // 第二层前翼襟翼
  ctx.strokeStyle = '#111216';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-W * 0.44, -H * 0.405); ctx.lineTo(-W * 0.09, -H * 0.42);
  ctx.moveTo(W * 0.44, -H * 0.405); ctx.lineTo(W * 0.09, -H * 0.42);
  ctx.stroke();

  // 细长车身、侧箱和尖鼻锥
  ctx.fillStyle = car.color;
  ctx.strokeStyle = '#25262c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -H * 0.5);
  ctx.lineTo(W * 0.07, -H * 0.16);
  ctx.lineTo(W * 0.13, -H * 0.08);
  ctx.lineTo(W * 0.3, H * 0.03);
  ctx.lineTo(W * 0.32, H * 0.25);
  ctx.lineTo(W * 0.2, H * 0.4);
  ctx.lineTo(-W * 0.2, H * 0.4);
  ctx.lineTo(-W * 0.32, H * 0.25);
  ctx.lineTo(-W * 0.3, H * 0.03);
  ctx.lineTo(-W * 0.13, -H * 0.08);
  ctx.lineTo(-W * 0.07, -H * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 两侧进气口
  ctx.fillStyle = '#111216';
  roundRect(ctx, -W * 0.29, H * 0.02, W * 0.1, H * 0.11, 2);
  ctx.fill();
  roundRect(ctx, W * 0.19, H * 0.02, W * 0.1, H * 0.11, 2);
  ctx.fill();

  // 中央赛车涂装；梅赛德斯使用青绿线，法拉利使用黑色线。
  ctx.fillStyle = car.accent;
  ctx.beginPath();
  ctx.moveTo(0, -H * 0.45);
  ctx.lineTo(W * 0.045, -H * 0.12);
  ctx.lineTo(W * 0.1, H * 0.36);
  ctx.lineTo(-W * 0.1, H * 0.36);
  ctx.lineTo(-W * 0.045, -H * 0.12);
  ctx.closePath();
  ctx.fill();

  // 侧箱上沿的车队强调色，增强参考图中宽肩收腰的轮廓。
  ctx.strokeStyle = car.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-W * 0.24, H * 0.02);
  ctx.quadraticCurveTo(-W * 0.34, H * 0.12, -W * 0.22, H * 0.34);
  ctx.moveTo(W * 0.24, H * 0.02);
  ctx.quadraticCurveTo(W * 0.34, H * 0.12, W * 0.22, H * 0.34);
  ctx.stroke();

  // 引擎盖脊线与后部散热开口
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.18);
  ctx.lineTo(0, H * 0.36);
  ctx.stroke();
  ctx.fillStyle = '#292b31';
  ctx.fillRect(-W * 0.13, H * 0.31, W * 0.26, 3);

  // 单座驾驶舱
  ctx.fillStyle = '#20242b';
  ctx.beginPath();
  ctx.ellipse(0, H * 0.08, W * 0.18, H * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Halo 防滚架
  ctx.strokeStyle = '#edf0f3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, H * 0.05, W * 0.13, Math.PI, 0);
  ctx.moveTo(0, H * 0.05);
  ctx.lineTo(0, H * 0.17);
  ctx.stroke();

  // 后翼与中央雨灯
  ctx.fillStyle = '#111216';
  ctx.strokeStyle = '#25262c';
  roundRect(ctx, -W * 0.42, H * 0.4, W * 0.84, 7, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#555962';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-W * 0.39, H * 0.425);
  ctx.lineTo(W * 0.39, H * 0.425);
  ctx.stroke();
  ctx.fillStyle = '#111216';
  ctx.fillRect(-W * 0.46, H * 0.38, 3, 11);
  ctx.fillRect(W * 0.46 - 3, H * 0.38, 3, 11);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(car.team || '', 0, H * 0.45);
  ctx.fillStyle = car.brake ? '#ff3030' : '#961e25';
  ctx.fillRect(-2, H * 0.48, 4, 4);

  // 鼻锥上的赛车编号
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#25262c';
  ctx.lineWidth = 1.5;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const num = car.number || car.name || '1';
  ctx.strokeText(num, 0, -H * 0.22);
  ctx.fillText(num, 0, -H * 0.22);

  // 加速时尾部短促火焰
  if (car.throttle && car.v > 30) {
    ctx.fillStyle = '#ffb23f';
    ctx.beginPath();
    ctx.moveTo(-3, H * 0.5);
    ctx.lineTo(0, H * 0.63 + Math.random() * 5);
    ctx.lineTo(3, H * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  if (car.collisionFlash > 0) {
    ctx.strokeStyle = `rgba(255,245,120,${Math.min(1, car.collisionFlash * 7)})`;
    ctx.lineWidth = 3;
    roundRect(ctx, -W / 2, -H / 2, W, H, 8);
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
