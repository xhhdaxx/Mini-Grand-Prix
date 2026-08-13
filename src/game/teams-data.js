// 车队数据与难度系数。
// 六支虚构车队：命名采用"抽象概念词 + 颜色"统一风格，营造同一虚构赛车宇宙。
export const ALL_TEAMS = [
  { team: 'VECTOR', number: '12', color: '#4a6fa5', accent: '#c9d6df' },
  { team: 'APEX',   number: '23', color: '#d4a017', accent: '#2d2d2d' },
  { team: 'HELIX',  number: '36', color: '#4b0082', accent: '#e6e6fa' },
  { team: 'ORBIT',  number: '17', color: '#e34234', accent: '#fff5e6' },
  { team: 'PULSE',  number: '88', color: '#008080', accent: '#ffffff' },
  { team: 'PRISM',  number: '6',  color: '#1a1a1a', accent: '#c0c0c0' }
];

export const DIFFICULTY_SKILL = { easy: 0.76, normal: 0.9, hard: 1.02 };

// VECTOR 的三种涂装（默认 cobalt，其余通过生涯积分解锁）
export const LIVERIES = {
  cobalt:   { color: '#4a6fa5', accent: '#c9d6df' },
  midnight: { color: '#1a1a1a', accent: '#4a6fa5' },
  solar:    { color: '#d4a017', accent: '#fff5e6' }
};

export const LIVERY_NAMES = { cobalt: '钴蓝', midnight: '午夜（25 分）', solar: '日冕（60 分）' };
