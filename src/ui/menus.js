// UI 菜单与面板绑定：选关、调校、车库、规则、手机手柄地址面板、设置选项。
// 从主入口注入 ctx（含 state、$、startRace、showResultPage 等）。
import { listTracks, getTrack } from '../game/track.js';
import { SEASON_TRACKS, getBestLap, saveVehicleSetup, saveVehicleSetup2, saveDriveSettings, saveLastTeam } from '../utils/storage.js';
import { VEHICLE_MODELS, TUNE_FIELDS, sanitizeVehicleSetup } from '../game/vehicle-config.js';
import { TYRES, commitPitService } from '../game/race-systems.js';
import { ALL_TEAMS, LIVERY_NAMES } from '../game/teams-data.js';
import { TEAM_EMOJI, trackMeta, trackLocalName, trackDetails, regionLabel, TRACK_REGIONS, SEASON_2026_ORDER } from '../game/track-meta.js';
import { t, isZh, teamName } from '../i18n.js';
import { fmtTime, renderRanks } from '../renderer/hud.js';
import { transition, isState } from '../state-machine.js';
import { exportRaceResult, exportAllData } from '../utils/export.js';
import { createTrackGlobe } from './globe.js';
import { drawTrackPreview } from '../renderer/track-preview.js';

const $ = s => document.querySelector(s);

export function bindMenus(ctx) {
  const { state } = ctx;

  // ===== 主菜单按钮 =====
  const chooseMode = mode => {
    if (!state.selectedTrackId) return;
    state.mode = mode;
    openSelectedRaceSetup(ctx);
  };
  $('#btnRace').onclick = () => chooseMode('race');
  $('#btnDuel').onclick = () => chooseMode('duel');
  $('#btnSolo').onclick = () => chooseMode('solo');
  $('#btnRandomTrack').onclick = () => {
    const buttons = document.querySelectorAll('#homeTrackList .home-track');
    if (!buttons.length) return;
    buttons[Math.floor(Math.random() * buttons.length)].click();
  };
  $('#btnGarage').onclick = () => {
    transition('garage');
    renderGarage(ctx);
  };
  $('#btnCareer').onclick = () => {
    transition('career');
  };
  $('#btnRules').onclick = () => showRules(ctx, 'menu');
  renderHomeTrackMenu(ctx);

  // 弹窗关闭
  document.querySelectorAll('.close-popup').forEach(btn => btn.onclick = () => {
    transition('menu');
  });

  // 结果页分页
  $('#resultPrev').onclick = () => ctx.showResultPage(ctx.getResultPage() - 1);
  $('#resultNext').onclick = () => ctx.showResultPage(ctx.getResultPage() + 1);

  // 全局快捷键
  addEventListener('keydown', e => {
    if (e.code === 'KeyR' && !state.running && state.track) {
      ctx.startRace(state.mode, state.trackId);
    }
    if (e.code === 'Escape') {
      // 比赛中：切换暂停；暂停态下 ESC 恢复比赛
      if (isState('racing')) { ctx.togglePause(); return; }
      // 规则面板：按进入来源返回（暂停态进来的回 racing，否则回主菜单）
      if (isState('rules')) { transition(ctx.rulesReturn === 'pause' && state.running ? 'racing' : 'menu'); return; }
      // 其余弹窗/选关/设置/结算/车库/生涯/手机手柄地址：ESC 一律回主菜单
      if (isState('trackSelect') || isState('raceSetup') || isState('garage')
          || isState('career') || isState('qr') || isState('results')) {
        transition('menu');
      }
      return;
    }
    if (e.code === 'KeyP' && state.running) {
      state.player._pitRequested = !state.player._pitRequested;
      state.player.warning = t(state.player._pitRequested ? '已请求进站 · 驶向起终点外侧' : '取消进站');
      state.player.warningTime = 3;
    }
    const tyreKeys = { Digit1: 'soft', Digit2: 'medium', Digit3: 'hard', Digit4: 'inter', Digit5: 'wet' };
    if (tyreKeys[e.code] && state.running) {
      if (commitPitService(state.player, tyreKeys[e.code])) {
        state.player.warning = t('下一次进站换 {x} 胎', { x: tyreKeys[e.code].toUpperCase() });
      } else {
        state.player.warning = t('需在 P 房停稳后才能选择换胎种类');
      }
      state.player.warningTime = 3;
    }
  });

  // 车库：移动倍率
  $('#movementScale').oninput = event => {
    state.settings.movementScale = Number(event.target.value);
    $('#movementScaleValue').textContent = `${state.settings.movementScale.toFixed(1)}×`;
    saveDriveSettings(state.settings);
  };

  // 规则面板
  $('#pauseRules').onclick = () => showRules(ctx, 'pause');
  $('#closeRules').onclick = () => {
    if (state.running) transition('racing');
    else transition('menu');
  };
  $('#resumeRace').onclick = () => ctx.togglePause(false);
  $('#restartRace').onclick = () => ctx.startRace(state.mode, state.trackId, state.session);
  $('#quitRace').onclick = () => {
    state.running = false; state.paused = false;
    transition('menu');
    ctx.updateGamepadHud?.();
  };

  // 选关 → 比赛设置
  $('#toRaceSetup').onclick = () => openSelectedRaceSetup(ctx);
  $('#backToTracks').onclick = () => transition('menu');
  $('#startRace').onclick = () => {
    if (state.selectedTrackId) ctx.startRace(state.mode, state.selectedTrackId);
  };
  $('#backToMenu').onclick = () => transition('menu');

  // 选项按钮组（难度/天气/轮胎/车队/设置/涂装）
  document.querySelectorAll('.difficulty-option').forEach(btn => {
    btn.onclick = () => {
      if (btn.classList.contains('weather-option') || btn.classList.contains('setting-option') || btn.classList.contains('tyre-option') || btn.classList.contains('team-option') || btn.classList.contains('livery-option')) return;
      document.querySelectorAll('.difficulty-option:not(.weather-option):not(.setting-option):not(.tyre-option):not(.team-option):not(.livery-option)').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state.difficulty = btn.dataset.difficulty;
    };
  });

  document.querySelectorAll('.weather-option').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.weather-option').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state.weatherKind = btn.dataset.weather;
    };
  });

  document.querySelectorAll('.tyre-option').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tyre-option').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state.startingTyre = btn.dataset.tyre;
    };
  });

  document.querySelectorAll('.team-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.team === state.selectedTeam);
    btn.onclick = () => {
      document.querySelectorAll('.team-option').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedTeam = btn.dataset.team;
      saveLastTeam(state.selectedTeam);
    };
  });

  document.querySelectorAll('.setting-option').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.setting === 'assists') {
        state.settings.assists = !state.settings.assists;
        btn.classList.toggle('selected', state.settings.assists);
        btn.textContent = `${t('辅助驾驶')} ${state.settings.assists ? t('开') : t('关')}`;
      } else if (btn.dataset.setting === 'autoSpeedHold') {
        state.settings.autoSpeedHold = !state.settings.autoSpeedHold;
        btn.classList.toggle('selected', state.settings.autoSpeedHold);
        btn.textContent = `${t('自动速度保持')} ${state.settings.autoSpeedHold ? t('开') : t('关')}`;
        saveDriveSettings(state.settings);
      } else {
        state.settings.collision = state.settings.collision === 'full' ? 'reduced' : state.settings.collision === 'reduced' ? 'off' : 'full';
        btn.classList.toggle('selected', state.settings.collision !== 'off');
        btn.textContent = t(state.settings.collision === 'full' ? '完整碰撞' : state.settings.collision === 'reduced' ? '轻度碰撞' : '幽灵碰撞');
      }
    };
  });

  // 涂装选择
  document.querySelectorAll('.livery-option:not(:disabled)').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.livery-option').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected'); state.livery = btn.dataset.livery;
  });

  // 手机手柄地址面板
  $('#qrClose').onclick = () => $('#qrPanel').classList.add('hidden');

  // 结算页按钮
  $('#restart').onclick = () => {
    if (state.nextRaceReady) {
      // 双人模式排位赛结束后进入双人正赛（依然只有 P1/P2，分屏），其余走单人正赛
      const nextMode = state.mode === 'duel' ? 'duel' : 'race';
      ctx.startRace(nextMode, state.trackId, 'race');
    } else if (state.nextSeasonReady) {
      state.mode = 'race';
      state.selectedTrackId = state.nextSeasonTrackId;
      state.nextSeasonReady = false;
      openSelectedRaceSetup(ctx);
    } else if (state.seasonComplete) {
      ctx.resetSeason();
      state.seasonComplete = false;
      showTrackSelect(ctx, 'race');
    } else {
      ctx.startRace(state.mode, state.trackId, state.mode === 'race' ? 'qualifying' : 'timeTrial');
    }
  };
  $('#exportResult').onclick = () => exportRaceResult(state);
  $('#back').onclick = () => transition('menu');

  // 赛季重置
  $('#resetSeason').onclick = () => {
    if (confirm(t('确定重置当前二十二站锦标赛吗？历史比赛记录不会删除。'))) {
      ctx.resetSeason();
      renderSeasonBoard(ctx);
    }
  };
  $('#exportAll').onclick = () => exportAllData(ctx.getCareer, ctx.getRaceHistory, ctx.getSeason, ctx.getRanks);

  // 比赛设置页右栏俯视图随窗口尺寸自适应重绘
  let resizeTimer = null;
  addEventListener('resize', () => {
    if (!isState('raceSetup') || !state.selectedTrackId) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const t = getTrack(state.selectedTrackId);
      if (t) drawTrackPreview($('#setupTrackMap'), t);
    }, 120);
  });
}

export function renderGarage(ctx) {
  const { state } = ctx;
  const setup = state.vehicleSetup;
  $('#vehicleModelPicker').innerHTML = Object.entries(VEHICLE_MODELS).map(([id, model]) => `<button class="difficulty-option vehicle-model-option ${id === setup.model ? 'selected' : ''}" data-model="${id}">${t(model.name)}</button>`).join('');
  $('#vehicleDescription').textContent = t(VEHICLE_MODELS[setup.model].description);
  $('#movementScale').value = state.settings.movementScale;
  $('#movementScaleValue').textContent = `${state.settings.movementScale.toFixed(1)}×`;
  const autoSpeedHoldButton = document.querySelector('[data-setting="autoSpeedHold"]');
  autoSpeedHoldButton.classList.toggle('selected', state.settings.autoSpeedHold);
  autoSpeedHoldButton.textContent = `${t('自动速度保持')} ${state.settings.autoSpeedHold ? t('开') : t('关')}`;
  $('#vehicleTuneGrid').innerHTML = Object.entries(TUNE_FIELDS).map(([key, label]) => `<label class="tune-row"><span>${t(label)}</span><input type="range" min="85" max="115" step="1" data-tune="${key}" value="${setup.tune[key]}"><span class="tune-value" data-value="${key}">${setup.tune[key]}%</span></label>`).join('');
  document.querySelectorAll('.vehicle-model-option').forEach(btn => btn.onclick = () => {
    state.vehicleSetup = sanitizeVehicleSetup({ model: btn.dataset.model });
    saveVehicleSetup(state.vehicleSetup); renderGarage(ctx);
  });
  document.querySelectorAll('[data-tune]').forEach(input => input.oninput = () => {
    const draft = { model: state.vehicleSetup.model, tune: { ...state.vehicleSetup.tune, [input.dataset.tune]: Number(input.value) } };
    state.vehicleSetup = sanitizeVehicleSetup(draft);
    saveVehicleSetup(state.vehicleSetup);
    Object.entries(state.vehicleSetup.tune).forEach(([key, value]) => {
      const slider = document.querySelector(`[data-tune="${key}"]`);
      const output = document.querySelector(`[data-value="${key}"]`);
      if (slider) slider.value = value; if (output) output.textContent = `${value}%`;
    });
    updateTuneBudget(ctx);
  });
  updateTuneBudget(ctx);
}

function updateTuneBudget(ctx) {
  const { state } = ctx;
  const total = Object.values(state.vehicleSetup.tune).reduce((sum, value) => sum + value, 0);
  const used = Math.max(0, total - 425), max = 90;
  $('#tuneBudgetBar').style.width = `${Math.min(100, used / max * 100)}%`;
  $('#tuneBudgetBar').style.background = total >= 515 ? '#e84545' : '#49d17d';
  $('#tuneBudgetText').textContent = t('性能预算 {total}/515 · 提高一项需要牺牲其他性能', { total });
}

export function renderTyreStatsTable() {
  const el = $('#tyreStatsTable');
  if (!el) return;
  const MEDIUM_SPEED = TYRES.medium.maxSpeed;
  const rows = Object.entries(TYRES).map(([, tyre]) => {
    const speedPct = Math.round(tyre.maxSpeed / MEDIUM_SPEED * 100);
    const durabilityPct = Math.round(1 / tyre.wear * 100);
    const wetPct = Math.round(tyre.wet * 100);
    const decay = (2 * tyre.wear).toFixed(1);
    const colorBox = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${tyre.color};border:1.5px solid #2b2b33;vertical-align:middle;margin-right:6px"></span>`;
    return `<tr>
      <td>${colorBox}<b>${tyre.code}</b> ${t(tyre.name)}</td>
      <td style="text-align:center">${speedPct}%</td>
      <td style="text-align:center">${durabilityPct}%</td>
      <td style="text-align:center">${wetPct}%</td>
      <td style="text-align:center">−${decay}%</td>
    </tr>`;
  }).join('');
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;font-weight:800">
    <thead><tr style="background:#2b2b33;color:#fff8e7">
      <th style="text-align:left;padding:6px 8px">${t('配方')}</th>
      <th style="padding:6px 8px">${t('速度')}</th>
      <th style="padding:6px 8px">${t('耐磨')}</th>
      <th style="padding:6px 8px">${t('湿地')}</th>
      <th style="padding:6px 8px">${t('每圈递减')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// 理论极速表：4 种车型 × 5 种轮胎 × 1-20 圈。
// 复用 race-systems.js 的极速公式：tyreMaxSpeed * (1-lapDecay) * (1-wearRatio*0.07) * powerMultiplier
// 磨损按估算增量累积（单圈 80s、均速 240v、滑移 0.2），转 km/h 视觉值（×0.7）。
export function renderTyreSpeedTable() {
  const el = $('#tyreSpeedTable');
  if (!el) return;
  const LAP_TIME = 80, AVG_SPEED = 240, AVG_SLIP = 0.2;
  const KMH = 0.7;
  const wearPerLap = ty => LAP_TIME * ty.wear * (0.12 + AVG_SPEED / 900 + AVG_SLIP / 500);
  const maxSpeedAtLap = (tyre, topSpeedTune, lap) => {
    const cumWear = Math.min(100, (lap - 1) * wearPerLap(tyre));
    const wearRatio = cumWear / 100;
    const tyreLaps = lap - 1;
    const lapDecay = Math.min(0.5, 0.02 * tyre.wear * tyreLaps);
    const tyreMaxSpeed = tyre.maxSpeed * (1 - lapDecay) * (1 - wearRatio * 0.07);
    return tyreMaxSpeed * (topSpeedTune / 100) * KMH;
  };
  const laps = Array.from({ length: 20 }, (_, i) => i + 1);
  const block = (model) => {
    const topSpeed = model.tune.topSpeed;
    const rows = Object.entries(TYRES).map(([, tyre]) => {
      const cells = laps.map(l => {
        const v = maxSpeedAtLap(tyre, topSpeed, l);
        return `<td style="text-align:center;padding:4px 3px;${l === 1 ? 'color:#3a86ff' : ''}">${v.toFixed(0)}</td>`;
      }).join('');
      const colorBox = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${tyre.color};border:1px solid #2b2b33;vertical-align:middle;margin-right:4px"></span>`;
      return `<tr><td style="padding:4px 6px;white-space:nowrap">${colorBox}<b>${tyre.code}</b></td>${cells}</tr>`;
    }).join('');
    return `<div style="margin-bottom:14px">
      <div style="font-weight:900;font-size:13px;color:#2b2b33;margin-bottom:4px">${t(model.name)} <span style="color:#888;font-weight:400;font-size:11px">${t('· 极速调校 {v}', { v: topSpeed })}</span></div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-weight:700">
        <thead><tr style="background:#2b2b33;color:#fff8e7">
          <th style="text-align:left;padding:5px 6px">${t('轮胎')}</th>
          ${laps.map(l => `<th style="padding:5px 3px;font-weight:800${l === 1 ? ';color:#9b5de5' : ''}">${l}</th>`).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  };
  el.innerHTML = Object.values(VEHICLE_MODELS).map(block).join('');
}

let rulesNavBound = false;
function bindRulesNav() {
  if (rulesNavBound) return;
  const panel = $('#rulesPanel');
  if (!panel) return;
  rulesNavBound = true;
  const items = panel.querySelectorAll('.rules-nav-item');
  const main = panel.querySelector('.rules-main');
  const blocks = panel.querySelectorAll('.rule-block');
  items.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const target = panel.querySelector('#' + item.dataset.target);
      if (target && main) main.scrollTo({ top: target.offsetTop - 14, behavior: 'smooth' });
      items.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
  });
  if (main && items.length) {
    const offsets = Array.from(blocks).map(b => b.offsetTop - 30);
    main.addEventListener('scroll', () => {
      const y = main.scrollTop;
      let idx = 0;
      for (let i = 0; i < offsets.length; i++) if (y >= offsets[i]) idx = i;
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
    }, { passive: true });
  }
}

export function showRules(ctx, from = 'menu') {
  ctx.rulesReturn = from;
  renderTyreStatsTable();
  renderTyreSpeedTable();
  transition('rules');
  bindRulesNav();
}

let homeGlobe = null;
export function renderHomeTrackMenu(ctx) {
  const { state } = ctx;
  const list = $('#homeTrackList'), modePicker = $('#homeModePicker'), location = $('#globeLocation'), searchInput = $('#trackSearch');
  const tracks = listTracks().map(track => ({ ...track, ...trackMeta(track.id) }));
  let globe;
  const selectTrack = id => {
    const track = tracks.find(item => item.id === id);
    if (!track) return;
    state.selectedTrackId = id;
    list.querySelectorAll('.home-track').forEach(button => {
      button.classList.toggle('selected', button.dataset.track === id);
      button.setAttribute('aria-pressed', button.dataset.track === id ? 'true' : 'false');
    });
    modePicker.classList.remove('hidden');
    location.innerHTML = `${track.flag} ${isZh() ? (track.cn || track.name) : track.name}<span class="loc-sub">${trackDetails(track.id)}<br>${track.lat.toFixed(4)}°, ${track.lon.toFixed(4)}°</span>`;
    globe?.setSelected(id);
  };
  const shortName = name => name.replace(/\s*Circuit\s*/i, '').trim();
  const trackNameHtml = track => {
    const enName = shortName(track.name);
    if (isZh()) return `<b>${track.cn || enName}</b><small class="en-caption">${enName}</small>`;
    return `<b>${enName}</b>`;
  };
  const matches = (track, q) => {
    if (!q) return true;
    q = q.toLowerCase().trim();
    return track.name.toLowerCase().includes(q) || (track.cn || '').includes(q) || track.id.toLowerCase().includes(q) || (track.details || '').toLowerCase().includes(q);
  };
  const renderList = (query = '') => {
    const filtered = tracks.filter(t => matches(t, query));
    const searching = !!query.trim();
    // 2026 赛程分组（按时间顺序，带站次编号）
    const seasonItems = SEASON_2026_ORDER
      .map(id => filtered.find(t => t.id === id))
      .filter(Boolean);
    const seasonHtml = seasonItems.length ? `<div class="track-group${searching ? '' : ''}" data-region="season">
      <div class="track-group-head" data-region="season">
        <span class="rg-icon">🏆</span>
        <span class="rg-label" style="flex:1">${t('2026 赛程')}</span>
        <span class="rg-count">${seasonItems.length}</span>
      </div>
      <div class="track-group-body">
        ${seasonItems.map((track, i) => `
          <button class="home-track home-track-season" type="button" data-track="${track.id}" aria-pressed="false" title="${trackLocalName(track.id, track.name)}">
            <span class="round">${String(i + 1).padStart(2, '0')}</span>
            <span class="flag">${track.flag}</span>
            <span class="name">${trackNameHtml(track)}</span>
          </button>`).join('')}
      </div>
    </div>` : '';
    const regionHtml = TRACK_REGIONS.map(region => {
      const items = filtered.filter(t => t.region === region.id);
      if (!items.length) return '';
      const collapsed = searching ? '' : ' collapsed';
      const bodyStyle = searching ? '' : ' style="display:none"';
      return `<div class="track-group${collapsed}" data-region="${region.id}">
        <div class="track-group-head" data-region="${region.id}">
          <span class="rg-icon">${region.icon}</span>
          <span class="rg-label" style="flex:1">${regionLabel(region)}</span>
          <span class="rg-count">${items.length}</span>
        </div>
        <div class="track-group-body"${bodyStyle}>
          ${items.map(track => `
            <button class="home-track" type="button" data-track="${track.id}" aria-pressed="false" title="${trackLocalName(track.id, track.name)}">
              <span class="flag">${track.flag}</span>
              <span class="name">${trackNameHtml(track)}</span>
            </button>`).join('')}
        </div>
      </div>`;
    }).join('');
    list.innerHTML = seasonHtml + regionHtml || `<div class="track-empty">${t('未找到匹配的赛道')}</div>`;
    list.querySelectorAll('.home-track').forEach(button => button.onclick = () => selectTrack(button.dataset.track));
    list.querySelectorAll('.track-group-head').forEach(head => head.onclick = () => {
      const body = head.parentElement.querySelector('.track-group-body');
      head.parentElement.classList.toggle('collapsed');
      if (body) body.style.display = head.parentElement.classList.contains('collapsed') ? 'none' : '';
    });
    if (state.selectedTrackId) {
      const sel = list.querySelector(`.home-track[data-track="${state.selectedTrackId}"]`);
      if (sel) {
        sel.classList.add('selected');
        sel.setAttribute('aria-pressed', 'true');
      }
    }
  };
  renderList();
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = () => renderList(searchInput.value);
  }
  homeGlobe?.destroy?.();
  globe = createTrackGlobe($('#trackGlobe'), tracks, selectTrack);
  homeGlobe = globe;
  if (state.selectedTrackId && tracks.some(track => track.id === state.selectedTrackId)) selectTrack(state.selectedTrackId);
}

export function showTrackSelect(ctx, mode) {
  const { state } = ctx;
  state.mode = mode;
  const list = $('#trackList');
  list.innerHTML = '';
  const tracks = listTracks();
  state.selectedTrackId = null;
  tracks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'track-card';
    const best = getBestLap(t.name);
    const meta = trackMeta(t.id);
    el.innerHTML = `
      <div class="track-icon">${meta.flag}</div>
      <div class="track-info">
        <div class="track-name">${trackLocalName(t.id, t.name)}</div>
        <div class="track-desc">${trackDetails(t.id)}</div>
        <div class="track-best">${best ? t('你的最佳圈 ') + fmtTime(best) : t('尚无记录')}</div>
      </div>
      <div class="track-meta">${t('{laps} 圈', { laps: t.laps })}</div>
    `;
    el.onclick = () => {
      list.querySelectorAll('.track-card').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      state.selectedTrackId = t.id;
      const btn = $('#toRaceSetup');
      btn.disabled = false;
      btn.style.opacity = 1;
    };
    list.appendChild(el);
  });
  transition('trackSelect');
  $('#toRaceSetup').disabled = true;
  $('#toRaceSetup').style.opacity = 0.4;
}

export function openSelectedRaceSetup(ctx) {
  const { state } = ctx;
  if (!state.selectedTrackId) return;
  const track = listTracks().find(t => t.id === state.selectedTrackId);
  const meta = trackMeta(track.id);
  const sessionText = state.mode === 'solo' ? t('单人计时 {n} 圈', { n: state.soloLaps })
    : state.mode === 'race' ? t('排位赛 1 圈 · 正赛 3 圈')
    : t('双人对决 · 排位 1 圈 + 正赛 {n} 圈', { n: state.raceLaps });
  $('#difficultyPicker').classList.toggle('hidden', state.mode !== 'race');
  $('#weatherPicker').classList.remove('hidden');
  $('#tyrePicker').classList.remove('hidden');
  $('#startRace').textContent = state.mode === 'solo' ? t('开始计时赛') : t('开始排位赛');
  const isDuel = state.mode === 'duel';
  const isSolo = state.mode === 'solo';
  $('#team2Picker').classList.toggle('hidden', !isDuel);
  if (isDuel) renderTeam2Options(ctx);
  $('#vehicle1Picker').classList.toggle('hidden', !isDuel);
  $('#vehicle2Picker').classList.toggle('hidden', !isDuel);
  if (isDuel) { renderVehicleOptions(ctx, 1); renderVehicleOptions(ctx, 2); }
  $('#lapsPicker').classList.toggle('hidden', !isDuel && !isSolo);
  if (isDuel) syncLapsPicker(ctx, 'raceLaps', state.raceLaps);
  if (isSolo) syncLapsPicker(ctx, 'soloLaps', state.soloLaps);
  transition('raceSetup');
  const lapsLabel = isSolo ? t('{laps} 圈', { laps: state.soloLaps }) : isDuel ? t('{laps} 圈', { laps: state.raceLaps }) : t('{laps} 圈', { laps: track.laps });
  $('#setupTrackMeta').innerHTML = `${meta.flag} ${trackLocalName(track.id, track.name)}<span>${trackDetails(track.id)}<br>${t('本场 ')}${lapsLabel} · ${sessionText}</span>`;
  requestAnimationFrame(() => drawTrackPreview($('#setupTrackMap'), getTrack(track.id)));
}

function renderTeam2Options(ctx) {
  const { state } = ctx;
  const opts = $('#team2Options');
  const p2Team = state.selectedTeam2 || ALL_TEAMS[1].team;
  opts.innerHTML = ALL_TEAMS.map(t => {
    const sel = t.team === p2Team ? 'selected' : '';
    return `<button class="difficulty-option team2-option ${sel}" data-team2="${t.team}">${TEAM_EMOJI[t.team] || ''} ${teamName(t.team)} #${t.number}</button>`;
  }).join('');
  opts.querySelectorAll('.team2-option').forEach(btn => {
    btn.onclick = () => {
      opts.querySelectorAll('.team2-option').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedTeam2 = btn.dataset.team2;
    };
  });
}

function renderVehicleOptions(ctx, which) {
  const { state } = ctx;
  const setup = which === 2 ? state.vehicleSetup2 : state.vehicleSetup;
  const opts = $(`#vehicle${which}Options`);
  opts.innerHTML = Object.entries(VEHICLE_MODELS).map(([id, model]) =>
    `<button class="difficulty-option vehicle${which}-option ${id === setup.model ? 'selected' : ''}" data-model="${id}">${t(model.name)}</button>`
  ).join('');
  opts.querySelectorAll(`.vehicle${which}-option`).forEach(btn => {
    btn.onclick = () => {
      opts.querySelectorAll(`.vehicle${which}-option`).forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      const newSetup = sanitizeVehicleSetup({ model: btn.dataset.model });
      if (which === 2) {
        state.vehicleSetup2 = newSetup;
        saveVehicleSetup2(newSetup);
      } else {
        state.vehicleSetup = newSetup;
        saveVehicleSetup(newSetup);
      }
    };
  });
}

function syncLapsPicker(ctx, field, currentValue) {
  const { state } = ctx;
  const opts = document.querySelectorAll('.laps-option');
  opts.forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.laps) === currentValue);
    btn.onclick = () => {
      opts.forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      state[field] = Number(btn.dataset.laps);
    };
  });
}

export async function showQrPanel() {
  const grid = $('#qrGrid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#888;padding:12px">${t('正在获取热点地址…')}</div>`;
  const port = location.port || '8080';
  let ips = [];
  try {
    const resp = await fetch('/ips');
    const data = await resp.json();
    ips = (data.urls || []).map(i => ({ address: i.address, name: i.name, p1: i.p1, p2: i.p2 }));
    if (!ips.length) ips = (data.ips || []).map(i => ({ address: i.address, name: i.name }));
  } catch { /* ignore */ }
  if (!ips.length) {
    const host = location.hostname || 'localhost';
    ips = [{ address: host, name: 'current' }];
  }
  const proto = location.protocol === 'https:' ? 'https' : 'http';
  grid.innerHTML = ips.map(ip => {
    const url1 = ip.p1 || `${proto}://${ip.address}:${port}/gamepad.html?p=1`;
    const url2 = ip.p2 || `${proto}://${ip.address}:${port}/gamepad.html?p=2`;
    return `
      <div class="qr-box p1">
        <div class="qr-url">${url1} (P1, ${ip.name})</div>
      </div>
      <div class="qr-box p2">
        <div class="qr-url">${url2} (P2, ${ip.name})</div>
      </div>`;
  }).join('');
  $('#qrPanel').classList.remove('hidden');
}

export function renderSeasonBoard(ctx) {
  const season = ctx.getSeason();
  const rows = Object.entries(season.standings).sort((a, b) => b[1] - a[1]);
  const past = (season.history || []).slice(0, 3).map(item => `${item.date} · 🏆 ${teamName(item.podium?.[0]?.team || '--')}`).join('<br>');
  $('#seasonBoard').innerHTML = `${t('{done}/{total} 站完成', { done: season.rounds.length, total: SEASON_TRACKS.length })}${rows.length ? '<br>' + rows.map(([team, points], i) => `<b>P${i+1}</b> ${teamName(team)}<span style="float:right">${t('{points} 分', { points })}</span>`).join('<br>') : `<br><span style="color:#999">${t('从澳大利亚站开始新的 {n} 站赛季', { n: SEASON_TRACKS.length })}</span>`}${season.complete && season.podium ? `<hr style="margin:8px 0">${t('赛季冠军 🏆 {team}', { team: teamName(season.podium[0].team) })}` : ''}${past ? `<hr style="margin:8px 0"><b>${t('历届冠军')}</b><br>${past}` : ''}`;
}

export function initCareerPanel(ctx) {
  const { state } = ctx;
  renderRanks($('#rankList'));
  renderRanks($('#rankList2'));
  const career = ctx.getCareer();
  const ptsEl = $('#careerPoints');
  if (ptsEl) ptsEl.textContent = String(career.points);
  $('#careerSummary').textContent = t('🏆 二十二站锦标赛 {points} 分 · {wins} 胜/{races} 场 · 已解锁 {livers} 套赛车配色与头盔', { points: career.points, wins: career.wins, races: career.races, livers: career.unlocked.length });
  $('#liveryPicker').innerHTML = Object.keys(LIVERY_NAMES).map(id => `<button class="difficulty-option livery-option ${id === state.livery ? 'selected' : ''}" data-livery="${id}" ${career.unlocked.includes(id) ? '' : 'disabled'}>${career.unlocked.includes(id) ? '' : '🔒 '}${t(LIVERY_NAMES[id])}</button>`).join('');
  document.querySelectorAll('.livery-option:not(:disabled)').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.livery-option').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected'); state.livery = btn.dataset.livery;
  });
  const history = ctx.getRaceHistory();
  const nameToId = new Map(listTracks().map(tr => [tr.name, tr.id]));
  const localTrackName = enName => {
    const id = nameToId.get(enName);
    return id ? trackLocalName(id, enName) : enName;
  };
  $('#historyList').innerHTML = history.length ? history.slice(0, 5).map(r => `<li>${t('{track} · P{position} · +{points}分 · {date}', { track: localTrackName(r.track), position: r.position, points: r.points, date: r.date })}</li>`).join('') : `<li style="color:#999;list-style:none">${t('完成正赛后自动记录')}</li>`;
  renderSeasonBoard(ctx);
}
