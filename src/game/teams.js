// 车队性能倾向。所有加成都围绕 1.0 小幅波动，AI 与玩家共用，避免隐藏优势。
// 数值沿用原六组范围，但映射关系已与现实车队完全打乱，避免反向识别。
export const TEAM_PROFILES = {
  VECTOR: { power: 0.98,  cornering: 0.995, recovery: 1.01,  deployment: 0.99, pitCrew: '#4a6fa5' },
  APEX:   { power: 1.045, cornering: 0.985, recovery: 0.96,  deployment: 1.02, pitCrew: '#d4a017' },
  HELIX:  { power: 0.99,  cornering: 1.055, recovery: 1.00,  deployment: 1.00, pitCrew: '#4b0082' },
  ORBIT:  { power: 1.00,  cornering: 0.99,  recovery: 1.16,  deployment: 1.04, pitCrew: '#e34234' },
  PULSE:  { power: 1.015, cornering: 1.02,  recovery: 0.99,  deployment: 1.00, pitCrew: '#008080' },
  PRISM:  { power: 0.985, cornering: 1.01,  recovery: 1.04,  deployment: 0.98, pitCrew: '#1a1a1a' }
};

export function applyTeamProfile(car, team = car.team) {
  const profile = TEAM_PROFILES[team] || { power: 1, cornering: 1, recovery: 1, deployment: 1 };
  car.teamProfile = profile;
  car.powerMultiplier = profile.power;
  car.corneringMultiplier = profile.cornering;
  car.recoveryMultiplier = profile.recovery;
  car.deploymentMultiplier = profile.deployment;
  return car;
}
