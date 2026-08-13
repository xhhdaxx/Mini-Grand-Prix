export const VEHICLE_MODELS = {
  balanced: { name: '全能型 GP', description: '各项均衡，适合陌生赛道', tune: { acceleration: 100, topSpeed: 100, braking: 100, steering: 100, recovery: 100 } },
  sprint: { name: '低阻直线型', description: '加速与极速更强，牺牲弯道和回收', tune: { acceleration: 110, topSpeed: 110, braking: 95, steering: 90, recovery: 95 } },
  technical: { name: '高下压力型', description: '制动和转向更强，直线速度较低', tune: { acceleration: 95, topSpeed: 90, braking: 108, steering: 112, recovery: 105 } },
  endurance: { name: '耐力回收型', description: '能量回收和稳定性优先', tune: { acceleration: 92, topSpeed: 96, braking: 102, steering: 100, recovery: 115 } }
};

export const TUNE_FIELDS = {
  acceleration: '加速', topSpeed: '极速', braking: '制动', steering: '转向', recovery: '能量回收'
};

export function sanitizeVehicleSetup(value = {}) {
  const model = VEHICLE_MODELS[value.model] ? value.model : 'balanced';
  const base = VEHICLE_MODELS[model].tune;
  const tune = {};
  for (const key of Object.keys(TUNE_FIELDS)) tune[key] = Math.round(Math.max(85, Math.min(115, Number(value.tune?.[key] ?? base[key]))));
  // 总预算最多 515，避免所有性能同时拉满；超出时按比例收回高于 85 的点数。
  const total = Object.values(tune).reduce((sum, item) => sum + item, 0);
  if (total > 515) {
    const room = Object.values(tune).reduce((sum, item) => sum + item - 85, 0);
    const scale = (515 - 85 * 5) / Math.max(1, room);
    for (const key of Object.keys(tune)) tune[key] = Math.round(85 + (tune[key] - 85) * scale);
    while (Object.values(tune).reduce((sum, item) => sum + item, 0) > 515) {
      const key = Object.keys(tune).sort((a, b) => tune[b] - tune[a])[0];
      tune[key] -= 1;
    }
  }
  return { model, tune };
}

export function applyVehicleSetup(car, value) {
  const setup = sanitizeVehicleSetup(value);
  const t = setup.tune;
  car.vehicleModel = setup.model;
  car.vehicleTune = t;
  car.accelerationMultiplier = t.acceleration / 100;
  car.powerMultiplier = (car.powerMultiplier || 1) * t.topSpeed / 100;
  car.brakeMultiplier = t.braking / 100;
  car.corneringMultiplier = (car.corneringMultiplier || 1) * t.steering / 100;
  car.recoveryMultiplier = (car.recoveryMultiplier || 1) * t.recovery / 100;
  return car;
}
