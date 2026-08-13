// src/game/car.js — 卡通赛车物理
// 位置 (x,y)、朝向 angle（弧度，0=朝右）、速度 v（像素/秒）
// 控制：左/右转向、W 加速、D 制动、S 仅在 P 区急停

import { normAngle } from '../utils/math.js';
import { t } from '../i18n.js';

// 集中管理所有物理调参常量，方便平衡性调整时一处修改。
export const PHYSICS = Object.freeze({
  CAR_BOUNDARY_RADIUS: 21,     // 包围圆半径，把整台车留在路面内
  MAX_V_OFF: 210,              // 出赛道后限速（不致命）
  ACCEL_BASE: 225,             // 基础加速度（px/s²），再除以 ACCELERATION_TIME_SCALE
  BRAKE_BASE: 55,              // 基础制动力，再乘以 BRAKING_FORCE_SCALE
  EMERGENCY_BRAKE: 245,        // P 区急刹制动力
  REVERSE_V: -140,             // 倒车最大速度
  BOOST_TOP_SPEED_BONUS: 58,   // 放电时的极速加成
  BOOST_ACCEL_MULT: 1.34,      // 放电时的加速度倍率
  STEER_TARGET: 0.68,          // 单次左右键转向输入幅度
  STEER_RATE: 2.75,            // 转向角速度基数
  STEER_LERP: 5.2,             // 方向盘建立转角的平滑速率
  GRIP_OFF: 0.85,              // 出赛道后转向折扣
  THROTTLE_LERP: 1.8,          // 油门机械响应速率
  BRAKE_LERP: 5.5,             // 制动机械响应速率
  EMERGENCY_BRAKE_LERP: 14,    // 急刹响应速率（更快）
  PIT_BOX_EMERGENCY_RANGE: 150,// P 区内允许急刹的距离
  COAST_DRAG_BASE: 12,         // 手动模式滑行基础阻力
  COAST_DRAG_VEL: 0.035,       // 手动模式滑行速度比例阻力
  LOCK_BRAKE_THRESHOLD: 0.72,  // 锁胎制动阈值
  LOCK_SPEED_THRESHOLD: 145,   // 锁胎最低速度
  LOCK_STEER_THRESHOLD: 0.18,  // 锁胎转向阈值（或纯高速重刹）
  LOCK_HIGH_SPEED: 245,        // 纯高速重刹锁胎速度
  LOCK_STEER_PENALTY: 0.28,    // 锁胎时转向能力保留
  HIGH_SPEED_UNDERSTEER_BASE: 0.48, // 高速转向不足强度
  GRASS_SPEED_CAP: 145,        // 草地限速
  GRASS_VEL_DECAY: 0.22,       // 草地速度衰减
  // 各表面转向抓地系数
  SURFACE_GRIP: { grass: 0.32, gravel: 0.52, runoff: 0.76, curb: 0.82, asphalt: 1 },
  // 各表面速度系数（surfaceSpeedFactor 用）
  SURFACE_SPEED: { curb: 0.90, runoff: 0.80, gravel: 0.70, grass: 0.40 },
  // 超速时各表面的回落阻力（px/s²）
  EXCESS_DRAG: { pit: 430, grass: 360, gravel: 300, runoff: 220, curb: 190, asphalt: 78 },
  // 各表面的速度对齐速率（velX/velY 向车头对齐的快慢）
  GRIP_RATE: { grass: 1.3, gravel: 2.2, runoff: 3.8, curb: 4.8, asphalt: 7.5 },
  GRAVEL_VEL_DECAY: 0.74,      // 砂石区速度衰减
  GRASS_VEL_LERP: 0.3,         // 草地 velX/velY 衰减
  COLLIDE_MIN_DISTANCE: 38,    // 车间碰撞最小距离
  COLLIDE_CLOSING_THRESHOLD: 105, // 触发旋转的闭合速度阈值
});

// 用近似包围圆把整台车留在路面内，而不是只限制车体中心点。
const CAR_BOUNDARY_RADIUS = PHYSICS.CAR_BOUNDARY_RADIUS;
// v 继续作为 HUD/规则使用的表显速度；世界坐标位移倍率由页面设置，范围 1.0–2.0。
export const DEFAULT_WORLD_SPEED_SCALE = 2;
export const ACCELERATION_TIME_SCALE = 1.5;
export const BRAKING_FORCE_SCALE = 1.5;
export function getWorldSpeedScale(car) {
  const value = Number(car?.worldSpeedScale ?? DEFAULT_WORLD_SPEED_SCALE);
  return Math.round(Math.max(1, Math.min(2, Number.isFinite(value) ? value : DEFAULT_WORLD_SPEED_SCALE)) * 10) / 10;
}

export function surfaceSpeedFactor(surface) {
  return PHYSICS.SURFACE_SPEED[surface] ?? 1;
}

export function createCar({ x, y, angle = 0, color = '#ffd23f', accent = '#e84545', name = 'P1' }) {
  return {
    x, y, angle,
    v: 0,
    velX: 0,
    velY: 0,
    steer: 0,           // 平滑后的转向输入 (-1~1)
    steerTarget: 0,     // 目标转向（按键）
    throttle: 0,        // 油门 (0/1)
    autoSpeedHold: true,// 松开油门时是否保持当前速度
    brake: 0,           // 刹车 (0/1)
    emergencyBrake: 0,  // 急刹 (0/1)
    reverse: 0,         // 独立倒车 (0/1)
    throttleInput: 0,   // 带机械响应时间的实际油门
    brakeInput: 0,      // 带机械响应时间的实际制动
    onTrack: true,
    surface: 'asphalt',
    locked: false,
    spinTimer: 0,
    spinRate: 0,
    lateral: 0,
    lap: 0,
    lapStartTime: 0,
    lapTimes: [],
    bestLap: null,
    // 两套等分分段用时：12 等分（细粒度）+ 3 等分（粗粒度），每圈一个数组
    splits12: [[]],
    _s12Idx: 0,
    _s12Start: 0,
    splits3: [[]],
    _s3Idx: 0,
    _s3Start: 0,
    color, accent, name,
    finished: false,
    finishTime: 0
  };
}

export function controlCar(car, keys) {
  car.steerTarget = 0;
  if (keys.left) car.steerTarget -= PHYSICS.STEER_TARGET;
  if (keys.right) car.steerTarget += PHYSICS.STEER_TARGET;
  car.throttle = keys.up ? 1 : 0;
  car.autoSpeedHold = keys.autoSpeedHold !== false;
  car.brake = keys.down ? 1 : 0;
  const emergencyAllowed = !!car.inPit && (car.pitBoxDistance ?? Infinity) < PHYSICS.PIT_BOX_EMERGENCY_RANGE;
  car.emergencyBrake = keys.emergency && emergencyAllowed ? 1 : 0;
  if (keys.emergency && !emergencyAllowed) {
    car.warning = t('S 急刹仅限 P 区停车');
    car.warningTime = 0.25;
  }
  car.reverse = keys.reverse ? 1 : 0;
  car.boostRequested = !!keys.boost;
}

export function updateCar(car, dt, track, raceTime) {
  car.collisionFlash = Math.max(0, (car.collisionFlash || 0) - dt);
  if (car.finished) {
    car.v *= Math.pow(0.4, dt);
    const movementScale = getWorldSpeedScale(car);
    car.x += Math.cos(car.angle) * car.v * dt * movementScale;
    car.y += Math.sin(car.angle) * car.v * dt * movementScale;
    return;
  }

  // 更接近赛车的渐进式动力响应：轮胎决定基础尾速，放电只提供短时增压。
  const MAX_V = (car.tyreMaxSpeed || 360) * (car.powerMultiplier || 1) + (car.boostActive ? PHYSICS.BOOST_TOP_SPEED_BONUS : 0);
  const MAX_V_OFF = PHYSICS.MAX_V_OFF;        // 出赛道后限速（不致命）
  const ACCEL = PHYSICS.ACCEL_BASE / ACCELERATION_TIME_SCALE * (car.accelerationMultiplier || 1); // 加速建立时间放慢 1.5 倍
  // HUD 的 200km/h 约等于内部 286px/s；全力制动约 5.2 秒才停稳。
  const BRAKE = PHYSICS.BRAKE_BASE * BRAKING_FORCE_SCALE;
  const REVERSE_V = PHYSICS.REVERSE_V;        // 倒车最大速度
  const STEER_RATE = PHYSICS.STEER_RATE;      // 降低左右键一次输入造成的转向幅度
  const STEER_LERP = PHYSICS.STEER_LERP;      // 方向盘建立转角也需要时间
  const GRIP_OFF = PHYSICS.GRIP_OFF;          // 出赛道后转向折扣（轻微）
  if (car.surface === 'asphalt' && !car.boostActive && car.v >= MAX_V - 1 && !car.brake && !car.emergencyBrake) car.cruiseAtMax = true;

  // 车辆越靠近外沿，抓地力越低：沥青 → 路肩 → 草地。
  const surfaceNear = track ? nearestSampleHinted(track, car.x, car.y, car.trackIndex) : null;
  if (surfaceNear) {
    const absLateral = Math.abs(surfaceNear.lateral);
    const localScale = track.samples[surfaceNear.idx].roadScale || 1;
    const roadHalfWidth = track.halfWidth * localScale;
    const curbWidth = (track.curbWidth || 8) * localScale;
    const localBufferWidth = (track.bufferWidth || 0) * localScale;
    const m = track.samples.length;
    const inPitSection = surfaceNear.idx > m - 285 || surfaceNear.idx < 285;
    const pitNear = track.hasDedicatedPitLane ? nearestPitRoute(track, car.x, car.y) : null;
    // PIT OUT 是一条合法独立道路。出口阶段为弯曲路线的离散采样留出与赛道
    // 缓冲区等宽的捕获余量，避免赛车仍在出口通道上却被判成草地并限速。
    const pitExitCaptureBuffer = car._pitExitActive ? (track.bufferWidth || 0) : 0;
    car.isPitLane = pitNear
      ? pitNear.dist <= getPitRoadHalfWidth(pitNear.k, track) + CAR_BOUNDARY_RADIUS + pitExitCaptureBuffer
      : inPitSection && surfaceNear.lateral > track.halfWidth * 0.52;
    const pitLimit = getPitSpeedLimitRange(track);
    car.pitSpeedLimited = !!(car.isPitLane && pitNear && pitNear.k >= pitLimit.entryK && pitNear.k <= pitLimit.exitK);
    if (car.isPitLane) car.surface = 'pit';
    else if (absLateral + CAR_BOUNDARY_RADIUS <= roadHalfWidth) car.surface = 'asphalt';
    else if (absLateral - CAR_BOUNDARY_RADIUS <= roadHalfWidth + curbWidth) car.surface = 'curb';
    else if (absLateral - CAR_BOUNDARY_RADIUS <= roadHalfWidth + curbWidth + localBufferWidth) car.surface = getRunoffSurface(track, surfaceNear.idx, surfaceNear.lateral);
    else car.surface = 'grass';
  }

  // 转向输入平滑（避免瞬时满打，手感更线性）
  car.steer += (car.steerTarget - car.steer) * Math.min(1, STEER_LERP * dt);
  car.throttleInput += (car.throttle - car.throttleInput) * Math.min(1, PHYSICS.THROTTLE_LERP * dt);
  const requestedBrake = car.emergencyBrake ? 1 : car.brake;
  car.brakeInput += (requestedBrake - car.brakeInput) * Math.min(1, (car.emergencyBrake ? PHYSICS.EMERGENCY_BRAKE_LERP : PHYSICS.BRAKE_LERP) * dt);

  // 加速 / 刹车 / 倒车
  if (car.brakeInput > 0.01) {
    car.cruiseAtMax = false;
    if (car.v > 0) {
      // S 急刹只会在 P 区被控制层启用，用于 P 房精准停车。
      const brakingForce = (car.emergencyBrake ? PHYSICS.EMERGENCY_BRAKE * BRAKING_FORCE_SCALE : BRAKE) * (car.brakeMultiplier || 1);
      car.v -= brakingForce * car.brakeInput * dt;
      if (car.v < 0) car.v = 0;
    } else car.v = 0;
  } else if (car.reverse && car.v <= 1) {
    car.cruiseAtMax = false;
    car.v -= ACCEL * 0.6 * dt;
  } else if (!car.throttle) {
    if (!car.autoSpeedHold && car.v > 0) {
      // 手动模式需要持续给油；松开 W 后由滚阻和空气阻力自然降速。
      const coastDrag = PHYSICS.COAST_DRAG_BASE + car.v * PHYSICS.COAST_DRAG_VEL;
      car.v = Math.max(0, car.v - coastDrag * dt);
    }
  } else if (car.throttleInput > 0.01) {
    // 接近上限时加速变缓（让玩家"感觉到"限速）
    const vRatio = Math.max(0, 1 - Math.max(0, car.v) / MAX_V);
    const boostAccel = car.boostActive ? PHYSICS.BOOST_ACCEL_MULT : 1;
    car.v += ACCEL * boostAccel * car.throttleInput * (0.3 + 0.7 * vRatio) * dt;
  }
  // 自动模式下，未踩刹车、急刹或倒车时保持当前速度。

  // 硬上限：到达上限后 v 严格等于上限，无法再增
  const surfaceCap = car.surface === 'grass' ? PHYSICS.GRASS_SPEED_CAP : MAX_V * surfaceSpeedFactor(car.surface);
  const cap = car.pitSpeedLimited ? 115 : Math.min(surfaceCap, car.surface === 'grass' ? MAX_V_OFF : MAX_V);
  if (car.v > cap) {
    // 结束放电或轮胎衰退时靠空气阻力逐渐回落；草地与维修区限速仍更快介入。
    const excessDrag = PHYSICS.EXCESS_DRAG[car.pitSpeedLimited ? 'pit' : car.surface] ?? PHYSICS.EXCESS_DRAG.asphalt;
    car.v = Math.max(cap, car.v - excessDrag * dt);
  }
  if (car.v < REVERSE_V) car.v = REVERSE_V;
  car._maxV = MAX_V;
  if (car.surface === 'asphalt' && !car.boostActive && car.v >= MAX_V - 1 && !car.brake && !car.emergencyBrake) {
    car.v = MAX_V; car.cruiseAtMax = true;
  }
  if (car.surface !== 'asphalt' || car.v < MAX_V * 0.97) car.cruiseAtMax = false;

  // 转向：速度越快转向半径越大（但角速度仍够用）
  // 速度因子：低速 0.65（够灵敏），高速 1.0
  const speedFactor = 0.65 + 0.35 * Math.min(1, Math.abs(car.v) / 150);
  car.locked = !!(car.brakeInput > PHYSICS.LOCK_BRAKE_THRESHOLD && car.v > PHYSICS.LOCK_SPEED_THRESHOLD && (Math.abs(car.steer) > PHYSICS.LOCK_STEER_THRESHOLD || car.v > PHYSICS.LOCK_HIGH_SPEED));
  const surfaceGrip = PHYSICS.SURFACE_GRIP[car.surface] ?? 1;
  const grip = (car.onTrack ? 1 : GRIP_OFF) * surfaceGrip * (car.gripMultiplier || 1);
  // 低速灵活、高速转向不足；锁胎时方向能力显著下降。
  const highSpeedUndersteer = 1 - PHYSICS.HIGH_SPEED_UNDERSTEER_BASE * Math.pow(Math.min(1, Math.abs(car.v) / 360), 1.7);
  const steerOmega = STEER_RATE * speedFactor * grip * highSpeedUndersteer * (car.corneringMultiplier || 1) * (car.locked ? PHYSICS.LOCK_STEER_PENALTY : 1);
  if (car.spinTimer > 0) {
    car.spinTimer = Math.max(0, car.spinTimer - dt);
    car.angle = normAngle(car.angle + car.spinRate * dt);
    car.spinRate *= Math.pow(0.14, dt);
    car.v *= Math.pow(0.55, dt);
  } else {
    car.angle = normAngle(car.angle + car.steer * steerOmega * dt);
  }

  // 独立二维速度产生侧滑：低抓地力时，移动方向不会立即跟随车头。
  const targetVX = Math.cos(car.angle) * car.v;
  const targetVY = Math.sin(car.angle) * car.v;
  const tyreSlipRisk = Math.max(0.75, car.tyreSlipRisk || 1);
  const gripRate = (PHYSICS.GRIP_RATE[car.surface] ?? PHYSICS.GRIP_RATE.asphalt) / tyreSlipRisk;
  const velocityBlend = Math.min(1, gripRate * (car.locked ? 0.16 : 1) * (car.spinTimer > 0 ? 0.12 : 1) * dt);
  car.velX += (targetVX - car.velX) * velocityBlend;
  car.velY += (targetVY - car.velY) * velocityBlend;
  if (car.surface === 'gravel') {
    car.velX *= Math.pow(PHYSICS.GRAVEL_VEL_DECAY, dt); car.velY *= Math.pow(PHYSICS.GRAVEL_VEL_DECAY, dt);
  } else if (car.surface === 'grass') {
    car.v *= Math.pow(PHYSICS.GRASS_VEL_DECAY, dt);
    car.velX *= Math.pow(PHYSICS.GRASS_VEL_LERP, dt);
    car.velY *= Math.pow(PHYSICS.GRASS_VEL_LERP, dt);
  }
  const velocityAngle = Math.atan2(car.velY, car.velX);
  car.slip = Math.abs(Math.sin(velocityAngle - car.angle)) * Math.abs(car.v);
  const movementScale = getWorldSpeedScale(car);
  car.x += car.velX * dt * movementScale;
  car.y += car.velY * dt * movementScale;

  // 出赛道检测 + 圈数
  const near = track ? nearestSampleHinted(track, car.x, car.y, car.trackIndex) : null;
  if (near) {
    car.trackIndex = near.idx;
    car.lateral = near.lateral;
    const localScale = track.samples[near.idx].roadScale || 1;
    const curbOuter = (track.halfWidth + (track.curbWidth || 8)) * localScale;
    const movedPitNear = track.hasDedicatedPitLane ? nearestPitRoute(track, car.x, car.y) : null;
    const legallyEnteringPit = !!(car._pitRequested || car.inPit || car.awaitingRelease);
    const inEntryTransition = legallyEnteringPit && isPitEntryTransition(track, near.idx, near.lateral);
    const inExitTransition = !!(car._pitExitActive && isPitExitTransition(track, near.idx, near.lateral));
    const usingPitRoute = legallyEnteringPit || car._pitExitActive;
    const pitExitCaptureBuffer = car._pitExitActive ? (track.bufferWidth || 0) : 0;
    const onPitRoad = car.isPitLane || inEntryTransition || inExitTransition || !!(usingPitRoute && movedPitNear && movedPitNear.dist <= getPitRoadHalfWidth(movedPitNear.k, track) + CAR_BOUNDARY_RADIUS + pitExitCaptureBuffer);
    if (onPitRoad) car.isPitLane = true;
    car.fullyBeyondCurb = !onPitRoad && Math.abs(near.lateral) - CAR_BOUNDARY_RADIUS > curbOuter;
    car.onTrack = Math.abs(near.lateral) <= curbOuter || onPitRoad;
    if (car._pitExitActive) {
      const m = track.samples.length;
      let signedK = near.idx > m / 2 ? near.idx - m : near.idx;
      if (signedK > getPitConfig(track).exitEnd + 8 && Math.abs(near.lateral) <= curbOuter) car._pitExitActive = false;
    }

    const sNow = track.samples[near.idx].s;
    if (car._lastS === undefined) car._lastS = sNow;
    const sPrev = car._lastS;
    const total = track.totalLength;

    if (car.v > 0) {
      let delta = sNow - sPrev;
      if (delta < -total * 0.5) delta += total;
      else if (delta > total * 0.5) delta -= total;
      if (delta > 0 && delta < total * 0.2) {
        car._cum = (car._cum || 0) + delta;
      }
      // 分段计时：12 等分 + 3 等分两套，按弧长边界触发
      const now1 = raceTime != null ? raceTime : 0;
      const advanceSplits = (N, arrField, idxField, startField) => {
        const boundary = i => (i * total) / N;
        while (car[idxField] < N - 1 && car._cum >= boundary(car[idxField] + 1)) {
          const t = now1 - (car[startField] || car.lapStartTime);
          const lapArr = car[arrField][car[arrField].length - 1];
          if (lapArr) lapArr.push(t);
          car[idxField] += 1;
          car[startField] = now1;
        }
      };
      advanceSplits(12, 'splits12', '_s12Idx', '_s12Start');
      advanceSplits(3, 'splits3', '_s3Idx', '_s3Start');
      if (car._cum >= total && !car.finished) {
        car.lap += 1;
        car.tyreLaps = (car.tyreLaps || 0) + 1;
        const now = raceTime != null ? raceTime : 0;
        const lapTime = now - car.lapStartTime;
        car.lapStartTime = now;
        car.lapTimes.push(lapTime);
        // 收尾每套最后一段
        const closeSplit = (N, arrField, idxField, startField) => {
          const lapArr = car[arrField][car[arrField].length - 1];
          if (lapArr && lapArr.length < N) {
            lapArr.push(now - (car[startField] || (now - lapTime)));
          }
        };
        closeSplit(12, 'splits12', '_s12Idx', '_s12Start');
        closeSplit(3, 'splits3', '_s3Idx', '_s3Start');
        if (car.bestLap === null || lapTime < car.bestLap) car.bestLap = lapTime;
        car._cum -= total;
        car._s12Idx = 0; car._s12Start = now;
        car._s3Idx = 0; car._s3Start = now;
        if (car.lap < track.laps) { car.splits12.push([]); car.splits3.push([]); }
        if (car.lap >= track.laps) {
          car.finished = true;
          car.finishTime = now;
        }
      }
    }
    car._lastS = sNow;
  }
}

// 空气墙位于缓冲区最外侧，不再贴着红白路肩。
export function collideBoundary(car, track) {
  if (!track) return;
  const near = nearestSampleHinted(track, car.x, car.y, car.trackIndex);
  const m = track.samples.length;
  const k = near.idx > m / 2 ? near.idx - m : near.idx;
  const pitOuterExtension = k >= PIT_ENTRY_START - 5 && k <= PIT_EXIT_END + 5 && near.lateral > 0 ? 46 : 0;
  const localScale = track.samples[near.idx].roadScale || 1;
  const limit = Math.max(0, (track.halfWidth + (track.curbWidth || 8) + (track.bufferWidth || track.halfWidth * 2 / 3)) * localScale + pitOuterExtension - CAR_BOUNDARY_RADIUS);
  if (track.hasDedicatedPitLane) {
    const pitNear = nearestPitRoute(track, car.x, car.y);
    // 给维修区缓冲带留出一个车轮级的捕获余量，避免自动驾驶沿外侧出站时
    // 同时被主赛道空气墙和维修区边界夹住。
    const pitLimit = getPitRoadHalfWidth(pitNear.k, track) + (track.bufferWidth || 86) - CAR_BOUNDARY_RADIUS + 40;
    if (pitNear.dist <= pitLimit) return;
  }
  const over = Math.abs(near.lateral) - limit;
  if (over > 0) {
    const samp = track.samples[near.idx];
    const sign = Math.sign(near.lateral) || 1;
    car.x = samp.x + samp.nx * sign * limit;
    car.y = samp.y + samp.ny * sign * limit;
    car.lateral = sign * limit;
    car.onTrack = false;

    // 只有车辆仍朝墙外运动时才吸收速度；沿墙行驶不会被反复制动。
    const vx = Math.cos(car.angle) * car.v;
    const vy = Math.sin(car.angle) * car.v;
    const outwardSpeed = (vx * samp.nx + vy * samp.ny) * sign;
    if (outwardSpeed > 0) car.v *= 0.25;
    const vn = car.velX * samp.nx + car.velY * samp.ny;
    if (vn * sign > 0) {
      car.velX -= samp.nx * vn;
      car.velY -= samp.ny * vn;
    }
  }
}

// 主赛道与维修区之间的实体护栏；只在 PIT IN / PIT OUT 标志之后开放门区。
export function collidePitBarrier(car, track) {
  if (!track) return;
  // 四条赛道均使用独立维修区道路，由各自道路外侧空气墙限制。
  if (track.hasDedicatedPitLane) return;
  const near = nearestSampleHinted(track, car.x, car.y, car.trackIndex);
  const m = track.samples.length;
  const k = near.idx > m / 2 ? near.idx - m : near.idx;
  if (k < PIT_ENTRY_START || k > PIT_EXIT_END) {
    car._pitBarrierSide = null;
    return;
  }
  // 黑色维修区内缘随匝道宽度变化，碰撞限制与画面保持一致。
  const barrier = getPitRoadCenterOffset(track, k) - getPitRoadHalfWidth(k) - 3;
  const inEntryGate = k >= PIT_ENTRY_GATE_START && k <= PIT_ENTRY_GATE_END;
  const inExitGate = k >= PIT_EXIT_GATE_START && k <= PIT_EXIT_GATE_END;
  if (inEntryGate || inExitGate) {
    car._pitBarrierSide = near.lateral > barrier ? 'pit' : 'track';
    return;
  }
  if (!car._pitBarrierSide) car._pitBarrierSide = near.lateral > barrier ? 'pit' : 'track';
  const samp = track.samples[near.idx];
  const legal = car._pitBarrierSide === 'pit' ? barrier + CAR_BOUNDARY_RADIUS : barrier - CAR_BOUNDARY_RADIUS;
  const crossed = car._pitBarrierSide === 'pit' ? near.lateral < legal : near.lateral > legal;
  if (!crossed) return;
  car.x = samp.x + samp.nx * legal;
  car.y = samp.y + samp.ny * legal;
  car.lateral = legal;
  const vn = car.velX * samp.nx + car.velY * samp.ny;
  if ((car._pitBarrierSide === 'pit' && vn < 0) || (car._pitBarrierSide === 'track' && vn > 0)) {
    car.velX -= samp.nx * vn;
    car.velY -= samp.ny * vn;
    car.v *= 0.35;
  }
  car.pitBarrierHit = 0.15;
}

// 赛车间实体碰撞：使用俯视包围圆分离车体，并吸收一部分碰撞速度。
export function collideCars(cars) {
  const minDistance = PHYSICS.COLLIDE_MIN_DISTANCE;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance >= minDistance) continue;
      if (distance < 0.001) { dx = 1; dy = 0; distance = 1; }

      const nx = dx / distance, ny = dy / distance;
      const overlap = minDistance - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const avx = Math.cos(a.angle) * a.v;
      const avy = Math.sin(a.angle) * a.v;
      const bvx = Math.cos(b.angle) * b.v;
      const bvy = Math.sin(b.angle) * b.v;
      const closing = (avx - bvx) * nx + (avy - bvy) * ny;
      if (closing > 0) {
        const impact = Math.min(0.5, closing / 500);
        a.v *= 0.72 - impact * 0.25;
        b.v *= 0.82 - impact * 0.15;
        a.velX *= 0.58; a.velY *= 0.58;
        b.velX *= 0.68; b.velY *= 0.68;
        if (closing > PHYSICS.COLLIDE_CLOSING_THRESHOLD) {
          const turn = (nx * Math.sin(a.angle) - ny * Math.cos(a.angle)) || (i % 2 ? -1 : 1);
          a.spinTimer = Math.max(a.spinTimer || 0, 0.45 + impact * 0.8);
          b.spinTimer = Math.max(b.spinTimer || 0, 0.25 + impact * 0.5);
          a.spinRate = turn * (2.8 + impact * 4);
          b.spinRate = -turn * (1.8 + impact * 3);
        }
      }
      a.collisionFlash = 0.15;
      b.collisionFlash = 0.15;
    }
  }
}

import { nearestSampleHinted, nearestPitRoute, getPitConfig, getPitSpeedLimitRange, isPitEntryTransition, isPitExitTransition, getPitRoadCenterOffset, getPitRoadHalfWidth, getRunoffSurface, PIT_ENTRY_START, PIT_EXIT_END, PIT_ENTRY_GATE_START, PIT_ENTRY_GATE_END, PIT_EXIT_GATE_START, PIT_EXIT_GATE_END } from './track.js';
