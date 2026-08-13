// src/game/ai.js — 卡通 AI 对手，沿赛道中线行驶，弯道减速

import { nearestSample, nearestPitRoute, getPitRoutePoint, getPitConfig, getPitSpeedLimitRange, getPitLaneOffset, getPitExit, getPitRoadHalfWidth, getRunoffSurface, PIT_LANE_HALF_GAP } from './track.js';
import { normAngle, clamp } from '../utils/math.js';
import { surfaceSpeedFactor, getWorldSpeedScale, ACCELERATION_TIME_SCALE, BRAKING_FORCE_SCALE } from './car.js';

export function createAI({ track, color = '#5bc0eb', accent = '#3a86ff', name = 'AI', skill = 0.92, offsetLateral = 0 }) {
  const start = track.samples[0];
  const next = track.samples[1];
  return {
    x: start.x,
    y: start.y,
    angle: Math.atan2(next.y - start.y, next.x - start.x),
    v: 0,
    velX: 0,
    velY: 0,
    color, accent, name,
    onTrack: true,
    lateral: offsetLateral,
    progress: 0,
    lap: 0,
    lapStartTime: 0,
    lapTimes: [],
    bestLap: null,
    finished: false,
    finishTime: 0,
    isAI: true,
    skill,
    offsetLateral,
    raceLineOffset: offsetLateral,
    spinTimer: 0,
    spinRate: 0,
    surface: 'asphalt',
    targetIdx: 5
  };
}

// 相邻弯在几何上可能很近。AI 已经开始行驶后只在上一索引附近重新捕获赛车线，
// 避免 nearestSample 跳到赛道另一段，导致车辆逆行或在两个弯之间来回切换。
function nearestProgressSample(track, x, y, previousIndex) {
  if (!Number.isInteger(previousIndex)) return nearestSample(track, x, y);
  const samples = track.samples;
  const m = samples.length;
  let best = previousIndex;
  let bestD = Infinity;
  for (let offset = -24; offset <= 96; offset++) {
    const idx = (previousIndex + offset + m) % m;
    const sample = samples[idx];
    const dx = sample.x - x;
    const dy = sample.y - y;
    const distance2 = dx * dx + dy * dy;
    if (distance2 < bestD) { bestD = distance2; best = idx; }
  }
  const sample = samples[best];
  const dx = x - sample.x;
  const dy = y - sample.y;
  return {
    idx: best,
    lateral: dx * sample.nx + dy * sample.ny,
    dist: Math.sqrt(bestD),
    roadHalfWidth: track.halfWidth * (sample.roadScale || 1),
    bufferWidth: track.bufferWidth * (sample.roadScale || 1)
  };
}

function targetIndexAtDistance(track, startIndex, distance) {
  const samples = track.samples;
  const m = samples.length;
  let travelled = 0;
  let idx = startIndex;
  while (travelled < distance && travelled < track.totalLength * 0.1) {
    const next = (idx + 1) % m;
    travelled += Math.hypot(samples[next].x - samples[idx].x, samples[next].y - samples[idx].y);
    idx = next;
  }
  return idx;
}

export function updateAI(ai, dt, track, raceTime, racers = [], raceState = null) {
  ai.collisionFlash = Math.max(0, (ai.collisionFlash || 0) - dt);
  ai.locked = false;
  if (ai.finished) {
    ai.v *= Math.pow(0.4, dt);
    const movementScale = getWorldSpeedScale(ai);
    ai.x += Math.cos(ai.angle) * ai.v * dt * movementScale;
    ai.y += Math.sin(ai.angle) * ai.v * dt * movementScale;
    return;
  }

  // 找前方一段距离的目标点
  const near = nearestProgressSample(track, ai.x, ai.y, ai.trackIndex);
  ai.trackIndex = near.idx;
  const m = track.samples.length;
  const targetIdx = targetIndexAtDistance(track, near.idx, 150 + ai.v * 0.55);
  const target = track.samples[targetIdx];

  // 检测前车：直道上主动选择空侧超车，距离太近时先减速避让。
  let desiredOffset = ai.offsetLateral;
  const cfg = getPitConfig(track);
  const routePosition = nearestPitRoute(track, ai.x, ai.y);
  const trackK = near.idx > m / 2 ? near.idx - m : near.idx;
  // 各赛道维修区长度不同，必须使用自身入口/出口范围；固定 285 个采样点会让
  // 上海 AI 提前数公里转向维修区入口并撞在外墙上。
  const inPitApproach = trackK >= cfg.entryStart - 12 && trackK <= cfg.exitEnd + 12;
  const pitLaneOffset = getPitLaneOffset(track) + PIT_LANE_HALF_GAP;
  // 若在计时线后才收到进站指令，应先正常跑完这一圈，不能直接横切到位于
  // 起终点另一侧的 PIT OUT。只有接近 PIT IN 或已经进入维修区时才接管路线。
  const enteringPit = ai._pitRequested && trackK >= cfg.entryStart - 12 && trackK <= cfg.entryEnd + 8;
  if (enteringPit) ai._pitLaneCommitted = true;
  // 到达 PIT OUT 端点后立即交回主赛道寻路；否则 awaitingRelease 会因仍贴着
  // 维修区端点而保持 true，AI 反复瞄准同一点并卡在出口。
  if (ai.awaitingRelease && ai.releaseSafe && routePosition.k >= cfg.exitEnd - 2 && routePosition.dist < 100) {
    ai.awaitingRelease = false;
    ai._pitLaneCommitted = false;
  }
  if (!ai._pitRequested && !ai.awaitingRelease && routePosition.k >= cfg.exitEnd - 2 && routePosition.dist < 80) ai._pitLaneCommitted = false;
  const pitGuidanceActive = ai._pitLaneCommitted || ai.inPit || ai.awaitingRelease;
  if (pitGuidanceActive) {
    // 独立维修区会从赛道末段跨过计时线接回开头；同步进度索引，保证出站后
    // 连续寻路从 PIT OUT 捕获，而不是仍在数公里外的 PIT IN 附近搜索。
    near.idx = (routePosition.k + m) % m;
    ai.trackIndex = near.idx;
  }
  if (pitGuidanceActive && inPitApproach) desiredOffset = ai.awaitingRelease ? getPitLaneOffset(track) - PIT_LANE_HALF_GAP : pitLaneOffset;
  let nearestAhead = Infinity;
  let nearestBehind = Infinity;
  let tyreAdvantage = 0;
  for (const other of racers) {
    if (other === ai || other.finished) continue;
    const dx = other.x - ai.x, dy = other.y - ai.y;
    const forward = dx * Math.cos(ai.angle) + dy * Math.sin(ai.angle);
    const side = -dx * Math.sin(ai.angle) + dy * Math.cos(ai.angle);
    if (forward > 0 && forward < 240 && Math.abs(side) < 72) {
      nearestAhead = Math.min(nearestAhead, forward);
      tyreAdvantage = (other.tyreWear || 0) - (ai.tyreWear || 0);
      const passSide = side >= 0 ? -1 : 1;
      desiredOffset = clamp(ai.offsetLateral + passSide * (tyreAdvantage > 8 ? 82 : 68), -92, 92);
    }
    if (forward < 0 && forward > -210 && Math.abs(side) < 80) nearestBehind = Math.min(nearestBehind, -forward);
  }
  // 蓝旗主动靠边减速；后车逼近时守住内线，出弯再回赛车线形成交叉线。
  if (ai.blueFlag) desiredOffset = 92;
  else if (nearestBehind < 150 && nearestAhead === Infinity) desiredOffset = near.lateral >= 0 ? 72 : -72;
  if (pitGuidanceActive && inPitApproach) desiredOffset = ai.awaitingRelease ? getPitLaneOffset(track) - PIT_LANE_HALF_GAP : pitLaneOffset;
  ai.raceLineOffset += (desiredOffset - ai.raceLineOffset) * Math.min(1, dt * 3.2);
  let tx = target.x + target.nx * ai.raceLineOffset;
  let ty = target.y + target.ny * ai.raceLineOffset;
  if (pitGuidanceActive && ['sunshine', 'rainbow', 'galaxy', 'yasmarina', 'lasvegas', 'baku', 'jeddah', 'australia', 'silverstone', 'hockenheim', 'bahrain', 'brazil', 'miami', 'canada', 'spain', 'hungary', 'austria', 'netherlands', 'singapore', 'austin', 'malaysia', 'mexico', 'qatar', 'italy'].includes(track.id)) {
    if (routePosition.dist < 520 || inPitApproach) {
      // 上海采样点间距远大于另外两条赛道；固定前瞻 8 点会跨过维修区弯折并切出道路。
      const routeLookAhead = track.id === 'sunshine' ? 2 : 8;
      const routeTarget = getPitRoutePoint(track, Math.min(cfg.exitEnd, routePosition.k + routeLookAhead), 'fast');
      tx = routeTarget.x; ty = routeTarget.y;
    }
  }
  if (ai._pitRequested && ai.inPit && ai.pitBox && ai.pitBoxDistance < 210) {
    tx = ai.pitBox.x;
    ty = ai.pitBox.y;
  }
  if (ai.awaitingRelease && ai.releaseSafe) {
    const exit = getPitExit(track);
    tx = exit.x; ty = exit.y;
  }

  const desired = Math.atan2(ty - ai.y, tx - ai.x);
  const d = normAngle(desired - ai.angle);
  const steer = clamp(d * 2.8, -1, 1);

  // 弯道减速：用前方曲率
  // 多点预瞄会在连续弯前提前制动，湿地/磨损时再扩大安全余量。
  // 赛道采样间距会随 worldScale 改变；按索引预瞄会让上海 AI 在数公里外的弯前
  // 一直减速。改用实际世界距离，使各条赛道拥有一致的刹车预判范围。
  const curves = [180, 360, 620, 920].map(distance => track.samples[targetIndexAtDistance(track, near.idx, distance)].curve);
  const aheadCurve = Math.max(...curves);
  const brakeMargin = 1 - Math.min(0.2, (ai.tyreWear || 0) / 500 + (raceState?.weather?.wetness || 0) * 0.14);
  let targetV = ai.skill * ((ai.tyreMaxSpeed || 360) * (ai.powerMultiplier || 1) + (ai.boostActive ? 58 : 0)) * (ai.gripMultiplier || 1) * brakeMargin * (1 - 0.52 * Math.min(1, aheadCurve / 0.22));
  if (raceState?.raceControl?.yellow) targetV = Math.min(targetV, 205);
  if (ai.blueFlag) targetV *= 0.72;
  if (ai._pitRequested) targetV = Math.min(targetV, 150);
  // 分段接近停车框。此前在 95px 外直接刹停，而换胎框只有 19px，AI 会永久停在框外。
  if (ai._pitRequested && ai.pitBoxDistance < 120) targetV = Math.min(targetV, 62);
  if (ai._pitRequested && ai.pitBoxDistance < 58) targetV = Math.min(targetV, 28);
  if (ai._pitRequested && ai.pitBoxDistance < 24) targetV = Math.min(targetV, 12);
  if (ai._pitRequested && ai.pitBoxDistance < 9) targetV = 0;
  if (ai.awaitingRelease && ai.releaseSafe === false) targetV = 0;
  if (ai.recoveryMode) targetV = Math.min(targetV, 95);
  if (nearestAhead < 72) targetV *= tyreAdvantage > 8 ? 0.7 : 0.48;
  else if (nearestAhead < 125) targetV *= tyreAdvantage > 8 ? 0.88 : 0.74;

  if (ai.v < targetV) ai.v += 520 / ACCELERATION_TIME_SCALE * dt;
  else ai.v -= 460 * BRAKING_FORCE_SCALE * dt;
  ai.throttleInput = ai.v < targetV ? 1 : 0;
  ai.brakeInput = ai.v > targetV + 8 ? 1 : 0;
  if (ai.v > (ai.tyreMaxSpeed || 360) + (ai.boostActive ? 58 : 0)) ai.v = (ai.tyreMaxSpeed || 360) + (ai.boostActive ? 58 : 0);
  if (ai.v < 0) ai.v = 0;

  const speedFactor = 0.65 + 0.35 * Math.min(1, ai.v / 150);
  if (ai.spinTimer > 0) {
    ai.spinTimer = Math.max(0, ai.spinTimer - dt);
    ai.angle = normAngle(ai.angle + ai.spinRate * dt);
    ai.spinRate *= Math.pow(0.14, dt);
    ai.v *= Math.pow(0.5, dt);
  } else {
    ai.angle = normAngle(ai.angle + steer * 3.6 * speedFactor * dt);
  }
  ai.velX = Math.cos(ai.angle) * ai.v;
  ai.velY = Math.sin(ai.angle) * ai.v;
  const movementScale = getWorldSpeedScale(ai);
  ai.x += ai.velX * dt * movementScale;
  ai.y += ai.velY * dt * movementScale;

  // 圈数判定（累积法）
  const sNow = track.samples[near.idx].s;
  if (ai._lastS === undefined) ai._lastS = sNow;
  const sPrev = ai._lastS;
  const total = track.totalLength;
  if (ai.v > 0) {
    let delta = sNow - sPrev;
    if (delta < -total * 0.5) delta += total;
    else if (delta > total * 0.5) delta -= total;
    if (delta > 0 && delta < total * 0.2) {
      ai._cum = (ai._cum || 0) + delta;
    }
    if (delta > 0.5) {
      ai._stuckTimer = 0;
      ai.recoveryMode = false;
    } else if (!ai.atPitBox && !ai.awaitingRelease) {
      ai._stuckTimer = (ai._stuckTimer || 0) + dt;
      ai.recoveryMode = ai._stuckTimer > 2.5;
      if (ai.recoveryMode) ai.raceLineOffset *= Math.max(0, 1 - dt * 2.5);
    }
    if (ai._cum >= total) {
      ai.lap += 1;
      const now = raceTime != null ? raceTime : 0;
      const lapTime = now - ai.lapStartTime;
      ai.lapStartTime = now;
      ai.lapTimes.push(lapTime);
      if (ai.bestLap === null || lapTime < ai.bestLap) ai.bestLap = lapTime;
      ai._cum -= total;
      if (ai.lap >= track.laps) {
        ai.finished = true;
        ai.finishTime = now;
      }
    }
  }
  ai._lastS = sNow;
  // 与玩家使用相同的路肩、缓冲区和维修区判定。
  const localScale = track.samples[near.idx].roadScale || 1;
  const roadHalfWidth = track.halfWidth * localScale;
  const curbOuter = (track.halfWidth + (track.curbWidth || 8)) * localScale;
  const pitNear = routePosition;
  ai.lateral = near.lateral;
  // 使用维修区自身几何判断，避免弯曲连接段被误判为驶离路线。
  ai.isPitLane = inPitApproach && pitNear.dist <= getPitRoadHalfWidth(pitNear.k, track) + 12;
  const pitLimit = getPitSpeedLimitRange(track);
  ai.pitSpeedLimited = ai.isPitLane && pitNear.k >= pitLimit.entryK && pitNear.k <= pitLimit.exitK;
  const runoffOuter = curbOuter + (track.bufferWidth || 0) * localScale;
  ai.surface = ai.isPitLane ? 'pit' : Math.abs(near.lateral) <= roadHalfWidth ? 'asphalt' : Math.abs(near.lateral) <= curbOuter ? 'curb' : Math.abs(near.lateral) <= runoffOuter ? getRunoffSurface(track, near.idx, near.lateral) : 'grass';
  const surfaceFactor = surfaceSpeedFactor(ai.surface);
  ai.v = Math.min(ai.v, (ai.tyreMaxSpeed || 360) * surfaceFactor);
  ai.fullyBeyondCurb = !ai.isPitLane && Math.abs(near.lateral) - 21 > curbOuter;
  ai.onTrack = Math.abs(near.lateral) <= curbOuter || ai.isPitLane;
}
