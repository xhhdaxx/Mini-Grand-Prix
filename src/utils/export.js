// src/utils/export.js — 比赛数据导出为 JSON 文件下载。

function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// 导出当前比赛结算。state 来自 ctx.state，含 player/ais/track/weather 等。
export function exportRaceResult(state) {
  const p = state.player;
  const p2 = state.player2;
  const opponents = state.ais || [];
  const progressOf = car => car.finished
    ? state.track.totalLength + 1000000 - car.finishTime
    : car.lap * state.track.totalLength + (car._cum || 0);
  const ordered = [...opponents].sort((a, b) => progressOf(b) - progressOf(a));
  const ai = ordered[0] || null;

  const carSummary = car => car ? ({
    team: car.team,
    number: car.number,
    tyre: car.tyre,
    tyreChanges: car.tyreChanges || 0,
    finished: !!car.finished,
    finishTime: car.finishTime || null,
    totalTime: car.finishTime > 0 ? car.finishTime : state.raceTime,
    bestLap: car.bestLap ?? null,
    lapTimes: car.lapTimes || [],
    penalty: car.penalty || 0,
    penaltyReasons: car.penaltyReasons || [],
    ersUsed: car.ersUsed || 0,
    pitStops: car.pitStops || 0,
    position: car.finished ? (car._finalPosition ?? null) : null
  }) : null;

  const data = {
    exportedAt: new Date().toISOString(),
    track: {
      id: state.trackId,
      name: state.track.name,
      laps: state.track.laps,
      totalLength: state.track.totalLength
    },
    mode: state.mode,
    session: state.session,
    difficulty: state.difficulty,
    weather: {
      forecast: state.weather?.forecast,
      finalWetness: state.weather?.wetness ?? 0,
      raining: !!state.weather?.raining
    },
    raceTime: state.raceTime,
    player: carSummary(p),
    player2: p2 ? carSummary(p2) : null,
    topOpponent: carSummary(ai),
    allOpponents: ordered.map(carSummary),
    qualifyingResults: state.qualifyingResults || null
  };

  download(`race-${state.trackId}-${state.session}-${timestamp()}.json`, data);
}

// 导出全部本地存储数据：生涯、历史、赛季、最佳圈速、设置。
export function exportAllData(getCareer, getRaceHistory, getSeason, getRanks) {
  const data = {
    exportedAt: new Date().toISOString(),
    career: getCareer(),
    raceHistory: getRaceHistory(),
    season: getSeason(),
    ranks: getRanks ? getRanks() : null
  };
  download(`mini-grand-prix-career-${timestamp()}.json`, data);
}
