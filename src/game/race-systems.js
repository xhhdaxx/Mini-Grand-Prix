// 比赛周末、轮胎、天气、处罚、能量放电与生涯系统的集中规则。
import { getPitExit, getPitBoxLength, isPitEntryTransition, isPitExitTransition } from './track.js';
import { applyTeamProfile } from './teams.js';
import { t } from '../i18n.js';

export const ERS_RULES = Object.freeze({ capacity: 100, minDeploy: 0.1, deployRate: 20, maxDeploySeconds: 5, cooldown: 1.5 });

export const TYRES = {
  soft:   { name: '软胎', code: 'S', color: '#ff3b45', grip: 1.08, wear: 1.45, wet: 0.22, maxSpeed: 374, slip: 1.22 },
  medium: { name: '中性胎', code: 'M', color: '#ffd23f', grip: 1.00, wear: 1.00, wet: 0.28, maxSpeed: 366, slip: 1.00 },
  hard:   { name: '硬胎', code: 'H', color: '#f4f4f4', grip: 0.94, wear: 0.65, wet: 0.32, maxSpeed: 357, slip: 0.84 },
  inter:  { name: '半雨胎', code: 'I', color: '#49d17d', grip: 0.90, wear: 1.20, wet: 0.82, maxSpeed: 346, slip: 1.07 },
  wet:    { name: '全雨胎', code: 'W', color: '#3a86ff', grip: 0.83, wear: 1.35, wet: 1.00, maxSpeed: 334, slip: 1.12 }
};

export function setupRaceCar(car, compound = 'medium') {
  car.tyre = compound;
  car.tyreWear = 0;
  car.tyreLaps = 0;
  car.tyreTemp = 82;
  car.penalty = 0;
  car.penaltyReasons = [];
  car.warning = '';
  car.offTrackTime = 0;
  car.trackExitCount = 0;
  car.pitStops = 0;
  car.tyreChanges = 0;
  car.inPit = false;
  car.pitTimer = 0;
  car.nextTyre = null;
  car._pitServiceCommitted = false;
  car._pitServiceAnchor = null;
  car.gear = 1;
  car.rpm = 3500;
  car.boostCharge = 100;
  car.boostActive = false;
  car.boostCooldown = 0;
  car.boostBurst = 0;
  car.regenRate = 0;
  car.energyFull = false;
  car.usedCompounds = new Set([compound]);
  car.startingCompound = compound;
  car.damage = 0;
  applyTeamProfile(car);
  return car;
}

export function commitPitService(car, compound) {
  if (!car || !TYRES[compound] || car._pitServiced) return false;
  if (!car.atPitBox || Math.abs(car.v || 0) >= 24) return false;
  car.nextTyre = compound;
  car._pitServiceCommitted = true;
  car._pitServiceAnchor = { x:car.x, y:car.y, angle:car.angle };
  car.v = 0;
  car.velX = 0;
  car.velY = 0;
  car.throttle = 0;
  car.throttleInput = 0;
  return true;
}

// 制动力并非越大回收越高：中等制动是效率峰值，重刹时机械制动和锁胎损失增多。
export function regenerationEfficiency(brake, locked = false, wetness = 0) {
  const b = Math.max(0, Math.min(1, brake || 0));
  const curve = b <= 0.55 ? b / 0.55 : 1 - (b - 0.55) * 0.62;
  return Math.max(0, curve) * (locked ? 0.42 : 1) * (1 - Math.min(0.35, wetness * 0.28));
}

export function addPenalty(car, seconds, reason) {
  car.penalty += seconds;
  car.penaltyReasons.push({ seconds, reason });
  car.warning = t('{reason} · +{s} 秒', { reason, s: seconds });
  car.warningTime = 3;
}

export function createWeather(kind = 'dynamic') {
  const wetStart = kind === 'rain' ? 0.72 : 0;
  return { kind, label: t(kind === 'rain' ? '降雨' : kind === 'cloudy' ? '阴天' : kind === 'sunny' ? '晴天' : '动态'), wetness: wetStart, raining: kind === 'rain', timer: 0, forecast: t('赛道干燥') };
}

export function updateWeather(weather, dt, raceTime) {
  weather.timer += dt;
  if (weather.kind === 'dynamic') {
    // 固定种子的比赛天气时间线，保证每局可预判又有阶段变化。
    weather.raining = raceTime > 48 && raceTime < 112;
  } else weather.raining = weather.kind === 'rain';
  const target = weather.raining ? 0.9 : 0;
  const rate = weather.raining ? 0.012 : 0.006;
  weather.wetness += (target - weather.wetness) * Math.min(1, rate * dt * 8);
  weather.wetness = Math.max(0, Math.min(1, weather.wetness));
  weather.forecast = t(weather.raining ? '降雨 · 赛道变湿' : weather.wetness > 0.18 ? '雨停 · 赛道变干' : weather.kind === 'cloudy' ? '阴天' : '赛道干燥');
}

export function updateRaceSystems(car, dt, state) {
  const tyre = TYRES[car.tyre] || TYRES.medium;
  const speed = Math.abs(car.v || 0);
  const wet = state.weather?.wetness || 0;
  car.wetness = wet;
  const slipHeat = Math.min(18, (car.slip || 0) * 0.025);
  const targetTemp = 70 + speed * 0.07 + slipHeat - wet * 30;
  car.tyreTemp += (targetTemp - car.tyreTemp) * Math.min(1, dt * 0.22);
  const tempPenalty = Math.min(0.25, Math.abs(car.tyreTemp - 92) / 180);
  const wetSuitability = 1 - wet * (1 - tyre.wet);
  const wearRatio = Math.max(0, Math.min(1, car.tyreWear / 100));
  const wearGrip = 1 - Math.pow(wearRatio, 1.35) * (0.16 + tyre.slip * 0.12);
  car.gripMultiplier = Math.max(0.38, tyre.grip * wetSuitability * wearGrip * (1 - tempPenalty));
  // 极速递减：每跑完一圈降 2%（按耐磨系数缩放：软胎 −2.9%/圈，硬胎 −1.3%/圈），叠加磨损衰减。
  const tyreLaps = car.tyreLaps || 0;
  const lapDecay = Math.min(0.5, 0.02 * tyre.wear * tyreLaps);
  car.tyreMaxSpeed = tyre.maxSpeed * (1 - lapDecay) * (1 - wearRatio * 0.07);
  car.tyreSlipRisk = tyre.slip * (1 + Math.pow(wearRatio, 1.25) * 0.95);
  // 湿地固定区域形成积水；高速压过时短暂水滑。
  const puddlePhase = ((car.trackIndex || 0) - 80 + 2300) % 230;
  car.aquaplaning = wet > 0.5 && puddlePhase < 16 && Math.abs(car.lateral || 0) > 18 && speed > 205;
  if (car.aquaplaning) {
    car.gripMultiplier *= 0.38;
    car.spinRate = (car.lateral > 0 ? -1 : 1) * 1.4;
    car.spinTimer = Math.max(car.spinTimer || 0, 0.18);
  }
  car.tyreWear = Math.min(100, car.tyreWear + dt * tyre.wear * (0.12 + speed / 900 + (car.slip || 0) / 500));

  // 自动挡转速；空格键放电提供短时动力，释放后进入冷却。
  car.gear = Math.max(1, Math.min(8, Math.floor(speed / 47) + 1));
  car.rpm = Math.min(15000, 3800 + (speed % 47) / 47 * 10500);
  car.boostCooldown = Math.max(0, (car.boostCooldown || 0) - dt);
  // AI 只能在直道、油门全开且电量充足时放电；和玩家共用容量、时长与冷却。
  const aiWantsBoost = car.isAI && speed > 235 && (car.throttleInput || 0) > 0.8 && Math.abs(car.steer || 0) < 0.14 && !car.inPit;
  if (!car.boostActive && car.boostCooldown <= 0 && (car.boostRequested || aiWantsBoost) && car.boostCharge > ERS_RULES.minDeploy) {
    car.boostActive = true;
    car.boostBurst = 0;
  }
  if (car.boostActive) {
    car.boostBurst += dt;
    // 按下后锁定本次放电，20%/秒：100% 恰好持续 5 秒，剩余电量按比例持续。
    car.boostCharge = Math.max(0, car.boostCharge - dt * ERS_RULES.deployRate);
    if (car.boostCharge <= 0) {
      car.boostActive = false;
      car.boostCooldown = ERS_RULES.cooldown;
    }
  } else if ((car.brakeInput || 0) > 0.05 && speed > 20) {
    const efficiency = regenerationEfficiency(car.brakeInput, car.locked, wet);
    car.regenRate = car.boostCharge >= ERS_RULES.capacity ? 0 : 18 * efficiency * (car.recoveryMultiplier || 1);
    car.boostCharge = Math.min(ERS_RULES.capacity, car.boostCharge + dt * car.regenRate);
  } else car.regenRate = 0;
  car.energyFull = car.boostCharge >= ERS_RULES.capacity - 0.01;
  if (car.energyFull && (car.brakeInput || 0) > 0.05) {
    car.regenRate = 0;
    if (!car.isAI) { car.warning = t('电池已满 · 能量回收停止'); car.warningTime = 0.25; }
  }

  // 黄旗全场限速；蓝旗下慢车必须让出正常赛车线。
  // duel 双人对决是纯竞速，不执行任何比赛规则限速与处罚。
  const isDuel = state.mode === 'duel';
  // cars 在 awaitingRelease 出站检查中也要用到，必须在 if 块外声明。
  const cars = [state.player, ...(state.player2 && state.mode !== 'solo' ? [state.player2] : []), ...(state.ais || [])];
  if (!isDuel) {
    if (state.raceControl?.yellow && speed > 205) car.v = Math.min(car.v, 205);
    const leaderLap = Math.max(...cars.map(c => c.lap || 0));
    car.blueFlag = leaderLap > (car.lap || 0) && cars.some(c => c !== car && (c.lap || 0) > (car.lap || 0));
    if (car.blueFlag && !car.isAI) {
      car.warning = t('蓝旗 · 让行后方领先赛车');
      car.warningTime = 0.3;
    }
  } else {
    car.blueFlag = false;
  }

  const legalPitEntry = !!(car._pitRequested && isPitEntryTransition(state.track, car.trackIndex, car.lateral));
  const legalPitExit = !!(car._pitExitActive && isPitExitTransition(state.track, car.trackIndex, car.lateral));
  // 出口白线只负责关闭维修区自动限速。完成换胎后，车辆仍要沿独立 PIT OUT
  // 通道驶向主赛道；在车身完全汇入主赛道、_pitExitActive 被车辆几何清除前，
  // 持续暂停赛道界限，避免把合法安全释放误判为越界。
  const pitTrackLimitsSuspended = !!(car.pitSpeedLimited || car._pitExitActive);
  if (legalPitEntry || legalPitExit || pitTrackLimitsSuspended) {
    car.fullyBeyondCurb = false;
    car._outsideCurb = false;
    if ((car.warning || '').startsWith(t('赛道界限'))) { car.warning = ''; car.warningTime = 0; }
  }

  // 整台赛车完全越过红白路肩才记一次；每累计 5 次加罚 5 秒。
  if (!isDuel && car.fullyBeyondCurb && !car.isPitLane && !car._outsideCurb) {
    car.trackExitCount += 1;
    car._outsideCurb = true;
    if (car.trackExitCount % 5 === 0) {
      addPenalty(car, 5, t('赛道界限累计 {n} 次', { n: car.trackExitCount }));
    } else {
      car.warning = t('赛道界限 {n}/5', { n: car.trackExitCount });
    }
    car.warningTime = 3;
  }
  if (!car.fullyBeyondCurb || car.isPitLane) car._outsideCurb = false;
  if (!isDuel && car.collisionFlash > 0.12 && !car._collisionPenalized) {
    addPenalty(car, 2, t('碰撞责任'));
    car.damage = Math.min(100, car.damage + 8);
    car._collisionPenalized = true;
  }
  if (!car.collisionFlash) car._collisionPenalized = false;

  // 维修区采用起终点附近的低速区域；停稳 2.5 秒完成换胎。
  const m = state.track.samples.length;
  const inPitSection = (car.trackIndex || 0) > m - 285 || (car.trackIndex || 0) < 285;
  if (car._pitServiceCommitted && car._pitServiceAnchor) {
    car.x = car._pitServiceAnchor.x;
    car.y = car._pitServiceAnchor.y;
    car.angle = car._pitServiceAnchor.angle;
    car.v = 0;
    car.velX = 0;
    car.velY = 0;
    car.isPitLane = true;
  }
  car.inPit = state.track.hasDedicatedPitLane ? !!car.isPitLane : inPitSection && (car.lateral || 0) > state.track.halfWidth * 0.52;
  const box = car.pitBox;
  car.pitBoxDistance = box ? Math.hypot(car.x - box.x, car.y - box.y) : Infinity;
  if (box) {
    const dx = car.x - box.x, dy = car.y - box.y;
    car.pitLongitudinalError = dx * Math.cos(box.angle) + dy * Math.sin(box.angle);
    car.pitLateralError = -dx * Math.sin(box.angle) + dy * Math.cos(box.angle);
  }
  car.pitBoxLongitudinalLimit = getPitBoxLength(state.track) / 2;
  car.pitBoxLateralLimit = 22;
  car.atPitBox = car.inPit
    && Math.abs(car.pitLongitudinalError ?? 999) <= car.pitBoxLongitudinalLimit
    && Math.abs(car.pitLateralError ?? 999) <= car.pitBoxLateralLimit;
  if (car.inPit) {
    // 白线之间直接自动限速，不再设置维修区超速罚时。
    if (car.pitSpeedLimited) car.v = Math.min(car.v, 115);
    if (car.atPitBox && speed < 24 && (car.isAI || car.nextTyre)) {
      car.pitTimer += dt;
      car.warning = t('{team} P房换胎 {t}/2.5s', { team: box?.team?.short || car.team, t: Math.min(2.5, car.pitTimer).toFixed(1) });
      car.warningTime = 0.25;
    } else {
      car.pitTimer = 0;
      if (car.atPitBox && speed < 24 && !car.isAI && !car.nextTyre) {
        car.warning = t('已停稳 · 请选择轮胎');
        car.warningTime = 0.25;
      } else if (car._pitRequested && car.pitBoxDistance < 150 && speed < 35) {
        const long = car.pitLongitudinalError || 0;
        car.warning = t(long < -19 ? '停车位置过浅 · 继续向前' : long > 19 ? '停车位置过深 · 请倒车' : '左右未对准停车框');
        car.warningTime = 0.25;
      }
    }
    if (car.pitTimer >= 2.5 && !car._pitServiced) {
      car.tyre = car.nextTyre || chooseTyre(wet);
      // 在 P 房完成的每次换新胎都计入强制换胎，同配方换新胎同样有效。
      car.tyreChanges += 1;
      car.usedCompounds.add(car.tyre);
      car.nextTyre = null;
      car.tyreWear = 0;
      car.tyreLaps = 0;
      car.tyreTemp = 72;
      car.damage *= 0.35;
      // 每次实际完成换胎都获得一次满电出站机会。
      car.boostCharge = ERS_RULES.capacity;
      car.energyFull = true;
      car.regenRate = 0;
      car.pitStops += 1;
      car._pitRequested = false;
      car._pitServiced = true;
      car._pitServiceCommitted = false;
      car._pitServiceAnchor = null;
      car._pitExitActive = true;
      car.awaitingRelease = true;
      car.warning = t('{team} P房完成 · {tyre} · 电池 100%', { team: box?.team?.short || car.team, tyre: t(TYRES[car.tyre].name) });
      car.warningTime = 3;
    }
  } else {
    car.pitTimer = 0;
    car._pitServiced = false;
  }
  car.wheelProgress = [0, 0, 0, 0].map((_, i) => Math.max(0, Math.min(1, (car.pitTimer - i * 0.12) / 2.0)));

  // 出站前检查主赛道来车，给出安全/不安全释放提示。
  if (car.awaitingRelease) {
    const exit = getPitExit(state.track);
    const traffic = cars.some(other => other !== car && Math.hypot(other.x - exit.x, other.y - exit.y) < 260 && Math.abs(other.v || 0) > 80);
    car.releaseSafe = !traffic;
    car.warning = t(traffic ? '等待放行 · 主赛道有来车' : '安全释放 · 可以驶出 P 房');
    car.warningTime = 0.25;
    if (!car.inPit) car.awaitingRelease = false;
  }
  if (car.warning) {
    car.warningTime = (car.warningTime || 3) - dt;
    if (car.warningTime <= 0) { car.warning = ''; car.warningTime = 0; }
  }
}

export function dryTyreRuleSatisfied(car, _weather) {
  // 正赛只检查是否在 P 房实际完成过一次换胎；单纯驶入维修区不算，雨战也不豁免。
  return (car.tyreChanges || 0) >= 1;
}

export function getStrategyAdvice(car, state) {
  const remaining = Math.max(0, state.track.laps - (car.lap || 0));
  const wet = state.weather?.wetness || 0;
  const desired = chooseTyre(wet);
  const mandatory = state.session === 'race' && remaining <= 1 && !dryTyreRuleSatisfied(car, state.weather);
  const worn = (car.tyreWear || 0) > Math.max(48, 78 - remaining * 8);
  const shouldPit = mandatory || desired !== car.tyre || worn;
  const standings = computeStandings(state);
  const current = standings.ordered.indexOf(car);
  const pitLoss = state.track.id === 'lasvegas' ? 24 : 22;
  const gaps = standings.ordered.slice(current + 1).filter(r => ((standings.gaps.get(r)?.leaderGap || 0) / Math.max(80, Math.abs(r.v || 1))) < pitLoss).length;
  return { shouldPit, mandatory, tyre: desired, rejoinPosition: Math.min(standings.ordered.length, current + gaps + 1), reason: t(mandatory ? '需完成一次换胎' : desired !== car.tyre ? '天气变化' : worn ? '轮胎磨损' : '保持赛道位置') };
}

export function chooseTyre(wetness) {
  return wetness > 0.58 ? 'wet' : wetness > 0.18 ? 'inter' : 'medium';
}

export function shouldAIPit(ai, state) {
  if (ai.inPit || ai._pitRequested) return ai._pitRequested;
  const rainSoon = state.weather.kind === 'dynamic' && state.raceTime > 34 + (ai.pitBox?.index || 0) * 1.6 && state.raceTime < 48;
  const desired = rainSoon ? 'inter' : chooseTyre(state.weather.wetness);
  const wrongTyre = desired !== ai.tyre && ((desired === 'wet' || desired === 'inter') || ['wet', 'inter'].includes(ai.tyre));
  // 维修区入口位于计时线之前，等到最后一圈才下指令可能来不及驶入 P 房。
  // 三圈短赛从倒数第二圈开始安排强制进站，给所有赛道留出完整的进站窗口。
  const mandatoryStop = state.session === 'race' && ai.lap >= Math.max(0, state.track.laps - 2) && !dryTyreRuleSatisfied(ai, state.weather);
  const standing = state.gaps?.get(ai);
  const frontGap = standing?.frontGap ?? Infinity;
  const team = ai.teamProfile || {};
  const undercutBias = team.cornering > 1.02 ? 5 : team.power > 1.02 ? -3 : 0;
  const overcutBias = team.recovery > 1.08 ? 7 : 0;
  const strategyStopAvailable = (ai.tyreChanges || 0) === 0;
  const undercut = strategyStopAvailable && ai.tyreWear > 43 - undercutBias && frontGap < 420 && ai.lap < state.track.laps - 1;
  const overcut = ai.tyreWear < 52 + overcutBias && frontGap < 220 && !wrongTyre;
  const pitTraffic = (state.ais || []).filter(other => other !== ai && other.inPit && other.pitBoxDistance < 240).length;
  const pitQueue = (state.ais || []).filter(other => other !== ai && other._pitRequested && !other._pitServiced).length;
  ai.strategy = rainSoon ? t('预判降雨') : undercut ? 'UNDERCUT' : overcut ? 'OVERCUT' : t('标准策略');
  ai.nextTyre = desired;
  ai._pitRequested = pitTraffic < 2 && pitQueue < 2 && (mandatoryStop || (strategyStopAvailable && ai.tyreWear > 68) || wrongTyre || (undercut && !overcut));
  return ai._pitRequested;
}

export function computeStandings(state) {
  const cars = [state.player, ...(state.player2 && state.mode !== 'solo' ? [state.player2] : []), ...(state.ais || [])];
  const progress = car => car.lap * state.track.totalLength + (car._cum || 0) - (car.gridOrder || 0) * 0.01;
  const ordered = [...cars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return (a.finishTime + a.penalty) - (b.finishTime + b.penalty);
    return progress(b) - progress(a);
  });
  const gaps = new Map();
  ordered.forEach((car, i) => gaps.set(car, {
    position: i + 1,
    frontGap: i ? Math.max(0, progress(ordered[i - 1]) - progress(car)) : Infinity,
    leaderGap: Math.max(0, progress(ordered[0]) - progress(car))
  }));
  return { ordered, gaps, progress };
}

export function createRaceControl() {
  return { yellow: false, yellowTimer: 0, message: t('绿旗 · GREEN FLAG') };
}

export function updateRaceControl(control, cars, dt) {
  const incident = cars.some(c => c.spinTimer > 0.3 || c.damage > 35);
  if (incident) { control.yellow = true; control.yellowTimer = 5; control.message = t('黄旗 · 禁止超车'); }
  if (control.yellowTimer > 0) control.yellowTimer -= dt;
  else { control.yellow = false; control.message = t('绿旗 · GREEN FLAG'); }
}

export const POINTS = [25, 18, 15, 12, 10, 8];
