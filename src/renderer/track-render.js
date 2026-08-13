// src/renderer/track-render.js — 卡通赛道绘制（俯视）
// 草地 + 路面 + 红白路肩 + 起跑线 + 装饰
//
// 性能：草地圆点纹理用 createPattern 一次铺满，替代逐个 arc（原实现每帧
// 6000+ 次 fill）。pattern canvas 仅构建一次、跨赛道复用。

import { PIT_TEAMS, getPitBox, getPitBoxLength, getPitRoutePoint, getPitRoadHalfWidth, getPitSpeedLimitRange, getPitConfig, getRunoffSurface, PIT_LANE_HALF_WIDTH } from '../game/track.js';

export function getPitVisualStyle(track) {
  const usesSolidUnlabelledConnections = ['rainbow', 'galaxy', 'yasmarina', 'lasvegas', 'baku', 'jeddah', 'australia', 'silverstone', 'hockenheim', 'bahrain', 'brazil', 'miami', 'canada', 'spain', 'hungary', 'austria', 'netherlands', 'singapore', 'austin', 'malaysia', 'mexico', 'qatar'].includes(track?.id);
  return {
    openConnectionGates:!usesSolidUnlabelledConnections,
    dashedConnectors:!usesSolidUnlabelledConnections,
    showLabels:!usesSolidUnlabelledConnections,
  };
}

let grassPattern = null;
function getGrassPattern(ctx) {
  if (grassPattern) return grassPattern;
  const c = document.createElement('canvas');
  c.width = 280; c.height = 280;
  const g = c.getContext('2d');
  g.fillStyle = '#7ec850';
  g.fillRect(0, 0, 280, 280);
  g.fillStyle = 'rgba(80,170,60,0.55)';
  for (let gx = 0; gx < 280; gx += 40) {
    for (let gy = 0; gy < 280; gy += 40) {
      const ox = ((gx * 13 + gy * 7) % 40) - 20;
      const oy = ((gx * 5 + gy * 11) % 40) - 20;
      g.beginPath();
      g.arc((gx + ox) % 280, (gy + oy) % 280, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  grassPattern = ctx.createPattern(c, 'repeat');
  return grassPattern;
}

export function drawTrack(ctx, track, cam, weather = null) {
  const s = track.samples;
  const m = s.length;

  // ===== 草地背景（pattern 铺满，替代逐个圆点） =====
  ctx.fillStyle = getGrassPattern(ctx);
  ctx.fillRect(-30000, -30000, 60000, 60000);

  const curbWidth = track.curbWidth || 8;
  const bufferWidth = track.bufferWidth || track.halfWidth * 2 / 3;

  // ===== 缓冲区（最底层） =====
  // 双侧安全缓冲区：专业赛道使用浅灰铺装与砂石区。
  ctx.fillStyle = '#4b5055';
  traceRoad(ctx, track, track.halfWidth + curbWidth + bufferWidth + 4, 0);
  ctx.fill();
  ctx.fillStyle = '#c9ccd0';
  traceRoad(ctx, track, track.halfWidth + curbWidth + bufferWidth, 0);
  ctx.fill();

  // 固定伪随机分区：每次比赛保持一致，约一半为砂石、其余为浅灰铺装。
  for (let i = 0; i < m; i++) {
    const a = s[i], b = s[(i + 1) % m];
    for (const side of [-1, 1]) {
      const gravel = getRunoffSurface(track, i, side) === 'gravel';
      if (gravel) drawBufferStrip(ctx, a, b, side, track.halfWidth + curbWidth, track.halfWidth + curbWidth + bufferWidth, '#c8b58d');
      if (gravel && i % 6 === 0) {
        const mid = (track.halfWidth + curbWidth + bufferWidth * 0.55) * (a.roadScale || 1);
        ctx.fillStyle = 'rgba(105,88,58,0.36)';
        ctx.beginPath(); ctx.arc((a.x+b.x)/2 + a.nx*side*mid, (a.y+b.y)/2 + a.ny*side*mid, 3.2, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // ===== 维修区（中层） =====
  // 主直道外侧的独立维修区：入口匝道、限速通道、停车格和出口匝道。
  // 匝道沿主赛道法线延伸，缓入缓出；接入端被上层主赛道覆盖，自然嵌入赛道边缘。
  drawPitLane(ctx, track);

  // ===== 主赛道（最上层） =====
  // 赛道阴影（偏移深绿，营造厚度）
  ctx.fillStyle = 'rgba(40,90,30,0.35)';
  traceRoad(ctx, track, track.halfWidth + 8, 6);
  ctx.fill();

  // 赛道路面（深灰底）
  ctx.fillStyle = '#5a5a64';
  traceRoad(ctx, track, track.halfWidth, 0);
  ctx.fill();

  // 路面亮色顶层（略窄一点，留出深色边）
  ctx.fillStyle = '#6e6e7a';
  traceRoad(ctx, track, track.halfWidth - 6, 0);
  ctx.fill();

  // 湿地反光层与随机积水带；积水位置固定，便于玩家学习线路。
  if (weather?.wetness > 0.04) {
    ctx.fillStyle = `rgba(92,135,165,${weather.wetness * 0.28})`;
    traceRoad(ctx, track, track.halfWidth - 10, 0);
    ctx.fill();
    ctx.strokeStyle = `rgba(180,225,245,${weather.wetness * 0.38})`;
    ctx.lineWidth = 18;
    for (let i = 80; i < m; i += 230) {
      const p = s[i];
      ctx.beginPath();
      ctx.moveTo(p.x - p.tx * 35 + p.nx * 38, p.y - p.ty * 35 + p.ny * 38);
      ctx.lineTo(p.x + p.tx * 35 + p.nx * 38, p.y + p.ty * 35 + p.ny * 38);
      ctx.stroke();
    }
  }

  // 红白路肩：主赛道位于最上层，包括维修区接入处也完整绘制两侧路肩，
  // 让匝道接入端被主赛道边缘盖住，呈现"从赛道边长出"的视觉。
  for (let i = 0; i < m; i++) {
    const a = s[i];
    const b = s[(i + 1) % m];
    const red = Math.floor(i / 4) % 2 === 0;
    const col = red ? '#ff5252' : '#fff5e0';
    drawCurb(ctx, a, b, -1, col, track.halfWidth);
    drawCurb(ctx, a, b, 1, col, track.halfWidth);
  }

  // ===== 中心虚线（黄色） =====
  ctx.strokeStyle = 'rgba(255,210,63,0.85)';
  ctx.lineWidth = 4;
  ctx.setLineDash([22, 20]);
  ctx.beginPath();
  for (let i = 0; i <= m; i++) {
    const p = s[i % m];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 具有立体交叉的赛道在普通路面之上重绘桥面。
  if (track.overpassRange) drawOverpass(ctx, track);

  // ===== 起跑线（黑白格） =====
  const start = s[0];
  const next = s[1];
  const dx = next.x - start.x, dy = next.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // 垂直方向（赛道横向）
  const px = -dy / len, py = dx / len;
  const cells = 10;
  const cellW = (track.halfWidth * 2) / cells;
  const stripeLen = 18;
  for (let i = 0; i < cells; i++) {
    const t = -track.halfWidth + i * cellW;
    const cx = start.x + px * t;
    const cy = start.y + py * t;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#222';
    ctx.fillRect(-stripeLen / 2, -cellW / 2, stripeLen, cellW);
    // 第二排
    ctx.fillStyle = i % 2 === 0 ? '#222' : '#ffffff';
    ctx.fillRect(-stripeLen / 2 - stripeLen, -cellW / 2, stripeLen, cellW);
    ctx.restore();
  }

  // ===== 装饰：起点拱门 =====
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(Math.atan2(dy, dx));
  // 拱门两根柱
  ctx.fillStyle = '#ff5252';
  ctx.fillRect(-4, -track.halfWidth - 28, 8, 28);
  ctx.fillRect(-4, track.halfWidth, 8, 28);
  // 横幅
  ctx.fillStyle = '#ff5252';
  ctx.fillRect(-50, -track.halfWidth - 36, 100, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('START', 0, -track.halfWidth - 29);
  ctx.restore();

  // ===== 装饰：路边小树（每隔若干采样点） =====
  for (let i = 0; i < m; i += 24) {
    const p = s[i];
    const treeOffset = (track.halfWidth + curbWidth + bufferWidth) * (p.roadScale || 1) + 30;
    drawTree(ctx, p.x + p.nx * treeOffset, p.y + p.ny * treeOffset);
    drawTree(ctx, p.x - p.nx * treeOffset, p.y - p.ny * treeOffset);
  }

  drawLandmarks(ctx, track);
}

function drawPitLane(ctx, track) {
  const pit = getPitConfig(track);
  const usesShanghaiPitStyle = ['sunshine', 'rainbow', 'galaxy', 'yasmarina', 'lasvegas', 'baku', 'jeddah', 'australia', 'silverstone', 'hockenheim', 'bahrain', 'brazil', 'miami', 'canada', 'spain', 'hungary', 'austria', 'netherlands', 'singapore', 'austin', 'malaysia', 'mexico', 'qatar', 'italy'].includes(track.id);
  const visualStyle = getPitVisualStyle(track);
  const makePoints = (from, to) => {
    const arr = [];
    for (let k = from; k <= to; k += 1) {
      const fast = getPitRoutePoint(track, k, 'fast');
      const work = getPitRoutePoint(track, k, 'work');
      arr.push({ ...fast, x:(fast.x + work.x) / 2, y:(fast.y + work.y) / 2, k });
    }
    return arr;
  };
  const entryPoints = makePoints(pit.entryStart, pit.entryEnd);
  const flatPoints = makePoints(pit.entryEnd, pit.exitStart);
  const exitPoints = makePoints(pit.exitStart, pit.exitEnd);
  const points = [...entryPoints, ...flatPoints.slice(1), ...exitPoints.slice(1)];
  const stroke = (path, color, width, dash = []) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.setLineDash([]);
  };
  const strokeVariableRoad = (path, color, extraWidth = 0) => {
    // 用一整块连续多边形绘制变宽匝道，消除逐段 stroke 产生的扇形台阶和裂缝。
    ctx.fillStyle = color; ctx.beginPath();
    path.forEach((p, i) => {
      const half = getPitRoadHalfWidth(p.k, track) + extraWidth;
      const x=p.x+p.nx*half, y=p.y+p.ny*half;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    [...path].reverse().forEach(p => {
      const half = getPitRoadHalfWidth(p.k, track) + extraWidth;
      ctx.lineTo(p.x-p.nx*half,p.y-p.ny*half);
    });
    ctx.closePath(); ctx.fill();
  };
  // 上海规格从入口到出口始终等宽，必须作为单个连续道路多边形绘制。
  // 若把平行段画成粗描边、匝道画成独立多边形，两者会在 exitStart 各自
  // 封口并叠成尖锐三角接缝（澳大利亚 PIT OUT 截图中的毛刺）。
  if (usesShanghaiPitStyle) {
    strokeVariableRoad(points, '#30323a', 6);
    strokeVariableRoad(points, '#858792');
  } else {
    strokeVariableRoad(entryPoints, '#30323a', 6);
    strokeVariableRoad(exitPoints, '#30323a', 6);
    strokeVariableRoad(entryPoints, '#858792');
    strokeVariableRoad(exitPoints, '#858792');
    stroke(flatPoints, '#30323a', PIT_LANE_HALF_WIDTH * 2 + 12);
    stroke(flatPoints, '#858792', PIT_LANE_HALF_WIDTH * 2);
  }

  // 上海规格使用黑色实体边界，只有合法连接段会被白色虚线打开。
  const drawLaneBoundary = (path, side) => {
    const isOuter = side === 'outer';
    ctx.strokeStyle = usesShanghaiPitStyle ? '#30323a' : '#e84545';
    ctx.lineWidth = isOuter ? 3 : 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    path.forEach((p, i) => {
      const half = getPitRoadHalfWidth(p.k, track);
      const offset = isOuter ? half : -half;
      const x = p.x + p.nx * offset;
      const y = p.y + p.ny * offset;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  };

  // 入口匝道边界线
  drawLaneBoundary(entryPoints, 'outer');
  drawLaneBoundary(entryPoints, 'inner-entry');

  // 出口匝道边界线
  drawLaneBoundary(exitPoints, 'outer');
  drawLaneBoundary(exitPoints, 'inner-exit');
  // 双车道分隔线：内侧快速通道，外侧 P 房工作通道。
  stroke(flatPoints, '#f5d76e', 3, [16, 12]);

  // 引导线：帮助赛车在进出站时保持正确路线
  // 入口引导线 - 从主赛道引导到维修区入口
  const entryGuideLine = [];
  for (let k = pit.entryStart - 40; k <= pit.entryGateStart; k += 2) {
    const p = getPitRoutePoint(track, Math.max(pit.entryStart, k), 'fast');
    if (k < pit.entryStart) {
      // 在入口前，沿主赛道绘制引导线
      const mainSample = track.samples[(k + track.samples.length) % track.samples.length];
      const guideOffset = track.halfWidth * 0.6; // 靠近右侧的引导线
      entryGuideLine.push({ x: mainSample.x + mainSample.nx * guideOffset, y: mainSample.y + mainSample.ny * guideOffset });
    } else {
      entryGuideLine.push(p);
    }
  }
  if (!usesShanghaiPitStyle) {
    stroke(entryGuideLine, 'rgba(255, 100, 100, 0.6)', 3, [12, 8]);
  }

  // 出口引导线 - 从维修区出口引导回主赛道
  const exitGuideLine = [];
  for (let k = pit.exitGateEnd; k <= pit.exitEnd + 40; k += 2) {
    const p = getPitRoutePoint(track, Math.min(pit.exitEnd, k), 'fast');
    if (k > pit.exitEnd) {
      // 在出口后，沿主赛道绘制引导线
      const mainSample = track.samples[(k + track.samples.length) % track.samples.length];
      const guideOffset = track.halfWidth * 0.6; // 靠近右侧的引导线
      exitGuideLine.push({ x: mainSample.x + mainSample.nx * guideOffset, y: mainSample.y + mainSample.ny * guideOffset });
    } else {
      exitGuideLine.push(p);
    }
  }
  if (!usesShanghaiPitStyle) {
    stroke(exitGuideLine, 'rgba(58, 134, 255, 0.6)', 3, [12, 8]);
  }

  // 只在标志之后切开内侧黑线；其余位置保持实体隔离，不能提前进出。
  const openGate = (from, to) => {
    const gate = makePoints(from, to).map(p => {
      const half = getPitRoadHalfWidth(p.k, track) + 2;
      const innerSign = p.amount < 0 ? 1 : -1;
      return { ...p, x: p.x + p.nx * half * innerSign, y: p.y + p.ny * half * innerSign };
    });
    stroke(gate, '#858792', 14);
  };
  if (visualStyle.openConnectionGates) {
    openGate(pit.entryGateStart, pit.entryGateEnd);
    openGate(pit.exitGateStart, pit.exitGateEnd);
  }

  // 上海规格：进出站连接处画白色虚线，并共用首尾 30 m 限速实线。
  if (usesShanghaiPitStyle) {
    const drawConnector = path => {
      const inner = path.map(p => {
        const innerSign = p.amount < 0 ? 1 : -1;
        const half = getPitRoadHalfWidth(p.k, track) - 3;
        return { x:p.x + p.nx * half * innerSign, y:p.y + p.ny * half * innerSign };
      });
      stroke(inner, '#fff', 4, [14, 10]);
    };
    if (visualStyle.dashedConnectors) {
      drawConnector(makePoints(pit.entryGateStart, pit.entryGateEnd));
      drawConnector(makePoints(pit.exitGateStart, pit.exitGateEnd));
    }

    // P 房前 30 米的限速入口线：横跨完整维修区的白色实线。
    const limit = getPitSpeedLimitRange(track);
    const drawLimitLine = (k, exactLine) => {
      const center = exactLine;
      const half = getPitRoadHalfWidth(Math.round(k), track) - 2;
      stroke([
        { x:center.x - center.nx * half, y:center.y - center.ny * half },
        { x:center.x + center.nx * half, y:center.y + center.ny * half }
      ], '#fff', 5);
    };
    drawLimitLine(limit.entryK, limit.entryLine);
    // 最后一个车队停车点后 30 米的限速终止线。
    drawLimitLine(limit.exitK, limit.exitLine);
  }

  // 深色路面外轮廓本身就是实体护栏，不再叠加红白限制线。

  // 两条车道方向箭头。
  for (const lane of ['fast', 'work']) {
    for (const k of [-8, 20, 48]) {
      const p = getPitRoutePoint(track, k, lane);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = lane === 'fast' ? '#fff' : '#f5d76e';
      ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // 六支车队各自的停车框、P 房门头和维修技师。
  for (let i = 0; i < PIT_TEAMS.length; i++) {
    const box = getPitBox(track, i);
    const team = PIT_TEAMS[i];
    const boxLength = getPitBoxLength(track);
    const boxHalf = boxLength / 2;
    const buildingLength = boxLength + 8;
    const buildingHalf = buildingLength / 2;
    ctx.save(); ctx.translate(box.x, box.y); ctx.rotate(box.angle);

    // 停车框与千斤顶定位线。
    ctx.fillStyle = 'rgba(35,36,42,0.45)'; ctx.fillRect(-boxHalf, -22, boxLength, 44);
    ctx.strokeStyle = team.color; ctx.lineWidth = 4; ctx.strokeRect(-boxHalf, -22, boxLength, 44);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(-9, 20); ctx.moveTo(9, -20); ctx.lineTo(9, 20); ctx.stroke();

    // 外侧 P 房建筑、门头与车队名称。
    ctx.fillStyle = '#25272d'; ctx.strokeStyle = '#111216'; ctx.lineWidth = 3;
    ctx.fillRect(-buildingHalf, 24, buildingLength, 54); ctx.strokeRect(-buildingHalf, 24, buildingLength, 54);
    ctx.fillStyle = team.color; ctx.fillRect(-buildingHalf, 24, buildingLength, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1} · ${team.short}`, 0, 33);
    ctx.font = 'bold 9px system-ui'; ctx.fillStyle = '#dfe3e8'; ctx.fillText(team.team, 0, 58);

    // 四名轮胎技师与备用轮胎架。
    const crewX = Math.min(82, boxLength * 0.32);
    for (const [cx, cy] of [[-crewX,-28],[crewX,-28],[-crewX,28],[crewX,28]]) {
      ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = '#121318';
    for (const tx of [-crewX, -crewX / 2, crewX / 2, crewX]) { ctx.beginPath(); ctx.arc(tx, 69, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  const label = (k, text, color) => {
    const p = points.reduce((best, q) => Math.abs(q.k - k) < Math.abs(best.k - k) ? q : best, points[0]);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx));
    ctx.fillStyle = color; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1;
    ctx.fillRect(-35, -42, 70, 24); ctx.strokeRect(-35, -42, 70, 24);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, -30);
    ctx.restore();
  };
  if (visualStyle.showLabels) {
    label(pit.entryGateStart, 'PIT IN', '#e84545');
    label(pit.exitGateStart, 'PIT OUT', '#3a86ff');
  }
}

function drawOverpass(ctx, track) {
  const [from, to] = track.overpassRange;
  const points = track.samples.slice(from, to + 1);
  const stroke = (color, width, dash = []) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke(); ctx.setLineDash([]);
  };
  stroke('rgba(24,27,31,.48)', track.halfWidth * 2 + 44);
  stroke('#30323a', track.halfWidth * 2 + 24);
  stroke('#6e6e7a', track.halfWidth * 2);
  stroke('#fff5e0', track.halfWidth * 2 + 14, [34, 34]);
  stroke('#6e6e7a', track.halfWidth * 2 - 2);
  stroke('rgba(255,210,63,.85)', 4, [22, 20]);

  // 桥头与桥尾的双护栏明确上下层关系，交叉处不被误读成十字路口。
  for (const p of [points[0], points.at(-1)]) {
    ctx.strokeStyle = '#e8edf2'; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(p.x - p.nx * (track.halfWidth + 10), p.y - p.ny * (track.halfWidth + 10));
    ctx.lineTo(p.x + p.nx * (track.halfWidth + 10), p.y + p.ny * (track.halfWidth + 10));
    ctx.stroke();
  }
}

function drawLandmarks(ctx, track) {
  for (const item of track.landmarks || []) {
    ctx.save(); ctx.translate(item.x, item.y);
    ctx.fillStyle = 'rgba(35,39,45,.9)'; ctx.strokeStyle = item.color || '#ffd23f'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.roundRect(-240, -92, 480, 184, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 48px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(item.label, 0, -25);
    ctx.fillStyle = item.color || '#ffd23f'; ctx.font = 'bold 30px system-ui, sans-serif'; ctx.fillText(item.sublabel || '', 0, 35);

    ctx.rotate(item.direction || 0); ctx.translate(310, 0);
    ctx.fillStyle = item.color || '#ffd23f';
    ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(24, -54); ctx.lineTo(24, -22); ctx.lineTo(-88, -22);
    ctx.lineTo(-88, 22); ctx.lineTo(24, 22); ctx.lineTo(24, 54); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// 描绘赛道轮廓（路面外形），offsetHalf 多扩宽、shift 平移（用于阴影）
function traceRoad(ctx, track, halfW, shift) {
  const s = track.samples;
  const m = s.length;
  ctx.beginPath();
  // 外右侧
  for (let i = 0; i <= m; i++) {
    const p = s[i % m];
    const localHalfW = halfW * (p.roadScale || 1);
    const x = p.x + p.nx * localHalfW + shift;
    const y = p.y + p.ny * localHalfW + shift;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  // 内左侧（反向）
  for (let i = m; i >= 0; i--) {
    const p = s[i % m];
    const localHalfW = halfW * (p.roadScale || 1);
    const x = p.x - p.nx * localHalfW + shift;
    const y = p.y - p.ny * localHalfW + shift;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawCurb(ctx, a, b, side, color, halfW) {
  ctx.fillStyle = color;
  const as = a.roadScale || 1, bs = b.roadScale || 1;
  const ax = a.x + a.nx * side * halfW * as;
  const ay = a.y + a.ny * side * halfW * as;
  const bx = b.x + b.nx * side * halfW * bs;
  const by = b.y + b.ny * side * halfW * bs;
  const ax2 = a.x + a.nx * side * (halfW + 8) * as;
  const ay2 = a.y + a.ny * side * (halfW + 8) * as;
  const bx2 = b.x + b.nx * side * (halfW + 8) * bs;
  const by2 = b.y + b.ny * side * (halfW + 8) * bs;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx2, by2);
  ctx.lineTo(ax2, ay2);
  ctx.closePath();
  ctx.fill();
}

function drawBufferStrip(ctx, a, b, side, inner, outer, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const as = a.roadScale || 1, bs = b.roadScale || 1;
  ctx.moveTo(a.x + a.nx * side * inner * as, a.y + a.ny * side * inner * as);
  ctx.lineTo(b.x + b.nx * side * inner * bs, b.y + b.ny * side * inner * bs);
  ctx.lineTo(b.x + b.nx * side * outer * bs, b.y + b.ny * side * outer * bs);
  ctx.lineTo(a.x + a.nx * side * outer * as, a.y + a.ny * side * outer * as);
  ctx.closePath(); ctx.fill();
}

function drawTree(ctx, x, y) {
  // 树干
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - 4, y - 2, 8, 14);
  // 树冠（三层圆）
  ctx.fillStyle = '#3fa34d';
  ctx.beginPath();
  ctx.arc(x, y - 8, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4cb85c';
  ctx.beginPath();
  ctx.arc(x - 5, y - 12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 5, y - 11, 9, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - 3, y - 13, 3, 0, Math.PI * 2);
  ctx.fill();
}
