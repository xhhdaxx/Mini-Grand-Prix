// src/utils/storage.js — localStorage 最佳圈速排行榜

const KEY = 'f1MiniRanks';
const CAREER_KEY = 'f1MiniCareer';
const HISTORY_KEY = 'f1MiniHistory';
const SEASON_KEY = 'f1MiniSeason';
const TEAM_KEY = 'f1MiniLastTeam';
const VEHICLE_KEY = 'f1MiniVehicleSetup';
const VEHICLE2_KEY = 'f1MiniVehicleSetup2';
const DRIVE_SETTINGS_KEY = 'f1MiniDriveSettings';
const dataChangeListeners = new Set();
const CAREER_DATA_KEYS = new Set([KEY, CAREER_KEY, HISTORY_KEY, SEASON_KEY]);

function notifyDataChange(type) {
  for (const listener of dataChangeListeners) {
    try { listener({ type }); }
    catch (error) { console.error('[storage data change]', error); }
  }
}

// localStorage 的 storage 事件不会在发起写入的当前页面触发，因此用一个轻量
// 的进程内订阅补齐即时 UI 更新；跨标签页仍由原生 storage 事件负责。
export function subscribeDataChanges(listener) {
  if (typeof listener !== 'function') return () => {};
  dataChangeListeners.add(listener);
  return () => dataChangeListeners.delete(listener);
}

export function isCareerDataKey(key) {
  return CAREER_DATA_KEYS.has(key);
}

export const SEASON_TRACKS = [
  'australia', 'sunshine', 'bahrain', 'jeddah', 'miami',
  'canada', 'rainbow', 'spain', 'austria', 'silverstone', 'hockenheim', 'galaxy',
  'hungary', 'netherlands', 'italy', 'baku', 'malaysia', 'singapore',
  'austin', 'mexico', 'brazil', 'lasvegas', 'qatar', 'yasmarina'
];

export function getLastTeam() {
  try { return localStorage.getItem(TEAM_KEY) || 'VECTOR'; } catch { return 'VECTOR'; }
}

export function saveLastTeam(team) {
  try { localStorage.setItem(TEAM_KEY, team); } catch { /* 隐私模式下仍允许继续比赛 */ }
  return team;
}

export function getVehicleSetup() {
  try { return JSON.parse(localStorage.getItem(VEHICLE_KEY) || 'null'); } catch { return null; }
}

export function saveVehicleSetup(setup) {
  try { localStorage.setItem(VEHICLE_KEY, JSON.stringify(setup)); } catch { /* 存储不可用时仅本局生效 */ }
  return setup;
}

export function getVehicleSetup2() {
  try { return JSON.parse(localStorage.getItem(VEHICLE2_KEY) || 'null'); } catch { return null; }
}

export function saveVehicleSetup2(setup) {
  try { localStorage.setItem(VEHICLE2_KEY, JSON.stringify(setup)); } catch { /* 存储不可用时仅本局生效 */ }
  return setup;
}

export function sanitizeDriveSettings(value = {}) {
  const raw = Number(value.movementScale ?? 2);
  const movementScale = Math.round(Math.max(1, Math.min(2, Number.isFinite(raw) ? raw : 2)) * 10) / 10;
  const autoSpeedHold = typeof value.autoSpeedHold === 'boolean' ? value.autoSpeedHold : true;
  return { movementScale, autoSpeedHold };
}

export function getDriveSettings() {
  try { return sanitizeDriveSettings(JSON.parse(localStorage.getItem(DRIVE_SETTINGS_KEY) || 'null') || {}); }
  catch { return sanitizeDriveSettings(); }
}

export function saveDriveSettings(settings) {
  const safe = sanitizeDriveSettings(settings);
  try { localStorage.setItem(DRIVE_SETTINGS_KEY, JSON.stringify(safe)); } catch { /* 存储不可用时仅本局生效 */ }
  return safe;
}

export function getRanks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

// score 为秒数（越小越好）。meta 携带车型/车队/轮胎/天气等附加信息
export function saveRank(trackName, totalSeconds, bestLapSeconds, meta = {}) {
  const a = getRanks();
  a.push({
    track: trackName,
    trackId: meta.trackId || '',
    total: +totalSeconds.toFixed(2),
    bestLap: +bestLapSeconds.toFixed(2),
    team: meta.team || '',
    number: meta.number || '',
    tyre: meta.tyre || '',
    vehicle: meta.vehicle || '',
    weather: meta.weather || '',
    splits12: Array.isArray(meta.splits12) ? meta.splits12 : null,
    splits3: Array.isArray(meta.splits3) ? meta.splits3 : null,
    date: new Date().toLocaleDateString()
  });
  a.sort((x, y) => x.total - y.total);
  localStorage.setItem(KEY, JSON.stringify(a.slice(0, 50)));
  notifyDataChange('ranks');
}

// 取同赛道历史所有分段记录（key 为 'splits12' 或 'splits3'），用于段位历史排名对比
export function getHistoricalSplits(trackName, key = 'splits12') {
  const a = getRanks();
  return a
    .filter(r => r.track === trackName && Array.isArray(r[key]))
    .map(r => r[key]);
}

// 按赛道分组，每组取总时间最短的前 topN 条
export function getTopRanksByTrack(topN = 3) {
  const all = getRanks();
  const groups = new Map();
  for (const r of all) {
    if (!groups.has(r.track)) groups.set(r.track, []);
    groups.get(r.track).push(r);
  }
  const result = [];
  for (const [track, list] of groups) {
    list.sort((x, y) => x.total - y.total);
    result.push({ track, ranks: list.slice(0, topN) });
  }
  result.sort((a, b) => (a.ranks[0]?.total ?? Infinity) - (b.ranks[0]?.total ?? Infinity));
  return result;
}

export function getBestLap(trackName) {
  const a = getRanks();
  let best = null;
  for (const r of a) {
    if (r.track === trackName && (!best || r.bestLap < best)) best = r.bestLap;
  }
  return best;
}

export function getCareer() {
  try { return JSON.parse(localStorage.getItem(CAREER_KEY)) || { points: 0, races: 0, wins: 0, unlocked: ['cobalt'] }; }
  catch { return { points: 0, races: 0, wins: 0, unlocked: ['cobalt'] }; }
}

export function saveRaceHistory(result) {
  const history = getRaceHistory();
  history.unshift({ ...result, date: new Date().toLocaleString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  notifyDataChange('history');
  const career = getCareer();
  career.races += 1;
  career.points += result.points || 0;
  if (result.position === 1) career.wins += 1;
  if (career.points >= 25 && !career.unlocked.includes('midnight')) career.unlocked.push('midnight');
  if (career.points >= 60 && !career.unlocked.includes('solar')) career.unlocked.push('solar');
  localStorage.setItem(CAREER_KEY, JSON.stringify(career));
  notifyDataChange('career');
  return career;
}

export function getRaceHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function getSeason() {
  const blank = { rounds: [], standings: {}, complete: false, history: [] };
  try { return { ...blank, ...(JSON.parse(localStorage.getItem(SEASON_KEY) || 'null') || {}) }; }
  catch { return blank; }
}

export function saveSeasonRound(trackId, orderedCars, pointsTable) {
  const season = getSeason();
  if (!season.rounds.some(r => r.trackId === trackId)) {
    const results = orderedCars.map((car, i) => ({ team: car.team, number: car.number, position: i + 1, points: pointsTable[i] || 0 }));
    season.rounds.push({ trackId, results, date: new Date().toLocaleString() });
    results.forEach(r => { season.standings[r.team] = (season.standings[r.team] || 0) + r.points; });
  }
  season.complete = SEASON_TRACKS.every(id => season.rounds.some(r => r.trackId === id));
  if (season.complete && !season.podium) {
    season.podium = Object.entries(season.standings).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([team, points], i) => ({ position:i+1, team, points }));
    season.history.unshift({ date: new Date().toLocaleString(), podium: season.podium });
  }
  localStorage.setItem(SEASON_KEY, JSON.stringify(season));
  notifyDataChange('season');
  return season;
}

export function resetSeason() {
  const old = getSeason();
  const history = old.history || [];
  const fresh = { rounds: [], standings: {}, complete: false, history };
  localStorage.setItem(SEASON_KEY, JSON.stringify(fresh));
  notifyDataChange('season');
  return fresh;
}
