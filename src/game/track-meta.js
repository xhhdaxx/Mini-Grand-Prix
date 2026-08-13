// 赛道元信息：国旗 emoji、副标题描述、所属地区。集中管理避免散落硬编码。
import { isZh } from '../i18n.js';
export const TRACK_META = {
  sunshine:  { flag: '🇨🇳', details: 'Shanghai · 16 Turns · 5.451 km', cnDetails: '上海 · 16 弯 · 5.451 km', lat:31.3389, lon:121.2197, region: 'asia', cn: '上海' },
  rainbow:   { flag: '🇲🇨', details: 'Monte Carlo · 19 Turns · 3.337 km', cnDetails: '蒙特卡洛 · 19 弯 · 3.337 km', lat:43.7347, lon:7.4206, region: 'europe', cn: '摩纳哥' },
  galaxy:    { flag: '🇧🇪', details: 'Spa-Francorchamps · 20 Turns · 7.004 km', cnDetails: '斯帕-弗朗科尔尚 · 20 弯 · 7.004 km', lat:50.4372, lon:5.9714, region: 'europe', cn: '比利时' },
  yasmarina: { flag: '🇦🇪', details: 'Yas Marina · 16 Turns · 5.281 km', cnDetails: '亚斯码头 · 16 弯 · 5.281 km', lat:24.4672, lon:54.6031, region: 'me', cn: '阿布扎比' },
  lasvegas:  { flag: '🇺🇸', details: 'Las Vegas Strip · 17 Turns · 6.201 km', cnDetails: '拉斯维加斯大道 · 17 弯 · 6.201 km', lat:36.1147, lon:-115.1728, region: 'americas', cn: '拉斯维加斯' },
  baku:      { flag: '🇦🇿', details: 'Baku · 20 Turns · 6.003 km', cnDetails: '巴库 · 20 弯 · 6.003 km', lat:40.3725, lon:49.8533, region: 'me', cn: '巴库' },
  jeddah:    { flag: '🇸🇦', details: 'Jeddah · 27 Turns · 6.174 km', cnDetails: '吉达 · 27 弯 · 6.174 km', lat:21.6319, lon:39.1044, region: 'me', cn: '吉达' },
  australia:  { flag: '🇦🇺', details: 'Albert Park · 14 Turns · 5.278 km', cnDetails: '阿尔伯特公园 · 14 弯 · 5.278 km', lat:-37.8497, lon:144.9680, region: 'asia', cn: '澳大利亚' },
  silverstone:{ flag: '🇬🇧', details: 'Silverstone · 18 Turns · 5.891 km', cnDetails: '银石 · 18 弯 · 5.891 km', lat:52.0786, lon:-1.0169, region: 'europe', cn: '英国' },
  hockenheim: { flag: '🇩🇪', details: 'Hockenheimring · 17 Turns · 4.574 km', cnDetails: '霍肯海姆 · 17 弯 · 4.574 km', lat:49.3278, lon:8.5658, region: 'europe', cn: '德国' },
  bahrain:    { flag: '🇧🇭', details: 'Sakhir · 15 Turns · 5.412 km', cnDetails: '萨基尔 · 15 弯 · 5.412 km', lat:26.0325, lon:50.5106, region: 'me', cn: '巴林' },
  brazil:     { flag: '🇧🇷', details: 'Interlagos · 15 Turns · 4.309 km', cnDetails: '因特拉格斯 · 15 弯 · 4.309 km', lat:-23.7036, lon:-46.6997, region: 'americas', cn: '巴西' },
  miami:      { flag: '🇺🇸', details: 'Miami · 19 Turns · 5.412 km', cnDetails: '迈阿密 · 19 弯 · 5.412 km', lat:25.9581, lon:-80.2389, region: 'americas', cn: '迈阿密' },
  canada:     { flag: '🇨🇦', details: 'Montréal · 14 Turns · 4.361 km', cnDetails: '蒙特利尔 · 14 弯 · 4.361 km', lat:45.5000, lon:-73.5228, region: 'americas', cn: '加拿大' },
  spain:      { flag: '🇪🇸', details: 'Barcelona-Catalunya · 16 Turns · 4.675 km', cnDetails: '巴塞罗那-加泰罗尼亚 · 16 弯 · 4.675 km', lat:41.5700, lon:2.2611, region: 'europe', cn: '西班牙' },
  hungary:    { flag: '🇭🇺', details: 'Hungaroring · 14 Turns · 4.381 km', cnDetails: '亨格罗林 · 14 弯 · 4.381 km', lat:47.5830, lon:19.2526, region: 'europe', cn: '匈牙利' },
  austria:    { flag: '🇦🇹', details: 'Spielberg · 10 Turns · 4.318 km', cnDetails: '施皮尔贝格 · 10 弯 · 4.318 km', lat:47.2197, lon:14.7647, region: 'europe', cn: '奥地利' },
  netherlands:{ flag: '🇳🇱', details: 'Zandvoort · 14 Turns · 4.259 km', cnDetails: '赞德福特 · 14 弯 · 4.259 km', lat:52.3888, lon:4.5409, region: 'europe', cn: '荷兰' },
  singapore:  { flag: '🇸🇬', details: 'Marina Bay · 23 Turns · 5.063 km', cnDetails: '滨海湾 · 23 弯 · 5.063 km', lat:1.2914, lon:103.8640, region: 'asia', cn: '新加坡' },
  austin:     { flag: '🇺🇸', details: 'Austin · 20 Turns · 5.513 km', cnDetails: '奥斯汀 · 20 弯 · 5.513 km', lat:30.1328, lon:-97.6411, region: 'americas', cn: '奥斯汀' },
  malaysia:   { flag: '🇲🇾', details: 'Sepang · 15 Turns · 5.543 km', cnDetails: '雪邦 · 15 弯 · 5.543 km', lat:2.7608, lon:101.7383, region: 'asia', cn: '马来西亚' },
  mexico:     { flag: '🇲🇽', details: 'Mexico City · 17 Turns · 4.304 km', cnDetails: '墨西哥城 · 17 弯 · 4.304 km', lat:19.4042, lon:-99.0907, region: 'americas', cn: '墨西哥' },
  qatar:      { flag: '🇶🇦', details: 'Lusail · 16 Turns · 5.419 km', cnDetails: '卢赛尔 · 16 弯 · 5.419 km', lat:25.4900, lon:51.4542, region: 'me', cn: '卡塔尔' },
  italy:      { flag: '🇮🇹', details: 'Monza · 11 Turns · 5.793 km', cnDetails: '蒙扎 · 11 弯 · 5.793 km', lat:45.6156, lon:9.2811, region: 'europe', cn: '意大利' }
};

// 地区分组定义（按主页左栏显示顺序）
export const TRACK_REGIONS = [
  { id: 'asia',     icon: '🌏', label: '亚太', en: 'ASIA-PACIFIC' },
  { id: 'europe',   icon: '🌍', label: '欧洲', en: 'EUROPE' },
  { id: 'americas', icon: '🌎', label: '美洲', en: 'AMERICAS' },
  { id: 'me',       icon: '🏜️', label: '中东', en: 'MIDDLE EAST' }
];

// 游戏赛历顺序（当前收录 24 站）
export const SEASON_2026_ORDER = [
  'australia', 'sunshine', 'bahrain', 'jeddah',
  'miami', 'canada', 'rainbow', 'spain', 'austria',
  'silverstone', 'hockenheim', 'galaxy', 'hungary', 'netherlands', 'italy',
  'baku', 'malaysia', 'singapore', 'austin', 'mexico',
  'brazil', 'lasvegas', 'qatar', 'yasmarina'
];

export function trackMeta(id) {
  return TRACK_META[id] || { flag: '🏁', details: '' };
}

// 赛道显示名：中文模式用 cn 中文名，英文模式用 listTracks 的英文名。
export function trackLocalName(id, enName) {
  return isZh() ? (trackMeta(id).cn || enName || id) : (enName || trackMeta(id).details?.split(' · ')[0] || id);
}

// 赛道副标题描述：中文模式用 cnDetails，英文模式用 details。
export function trackDetails(id) {
  const meta = trackMeta(id);
  return isZh() ? (meta.cnDetails || meta.details || '') : (meta.details || '');
}

// 地区分组标签：中文模式用 label，英文模式用 en。
export function regionLabel(region) {
  return isZh() ? region.label : region.en;
}

// 车队 emoji（用于 P2 选择面板）
export const TEAM_EMOJI = {
  'VECTOR': '🔵',
  'APEX':   '🟡',
  'HELIX':  '🟣',
  'ORBIT':  '🔴',
  'PULSE':  '🟢',
  'PRISM':  '⚫'
};
