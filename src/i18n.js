// src/i18n.js — 中英文国际化核心。
// 策略：中文原文即 key，英文存入 EN 字典。t() 在中文模式原样返回，英文模式查字典。
// 静态 HTML 用 data-i18n / data-i18n-html / data-i18n-title / data-i18n-placeholder / data-i18n-aria。
// 语言偏好存 localStorage，默认英文（用户要求默认英文）。

const LANG_KEY = 'miniGpLang';
let lang = 'en';
try { lang = localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en'; } catch { /* 隐私模式 */ }

const listeners = new Set();

// 中文 key → 英文。缺少时 t() 回退原文（中文），便于发现遗漏。
const EN = {
  // ===== 品牌 / 标题 =====
  '卡通方程式大奖赛': 'Cartoon Formula Grand Prix',
  'Mini Grand Prix · 卡通方程式竞速': 'Mini Grand Prix · Cartoon Racing',
  'Mini Grand Prix 手柄 · Controller': 'Mini Grand Prix Controller',
  'Mini GP 手柄': 'Mini GP Controller',

  // ===== 主菜单 =====
  '搜索赛道 / 国家 / 城市': 'Search circuit / country / city',
  '搜索赛道': 'Search circuits',
  '比赛模式': 'RACE MODE',
  '大奖赛周末': 'Grand Prix Weekend',
  '双人模式': 'Head-to-Head',
  '单人计时': 'Time Trial',
  '其他选项': 'More options',
  '1 · 赛车设置': '1 · Garage Setup',
  '2 · 成绩与生涯': '2 · Career & Results',
  '3 · 完整规则': '3 · Full Rules',
  '完整规则': 'Full Rules',
  '调校赛车性能': 'Tune your car',
  '查看积分与成绩': 'Stats & results',
  '了解完整玩法': 'How to play',
  '世界大奖赛': 'World Grand Prix',
  '大奖赛地点地球': 'Grand Prix world map',
  '选择左侧赛道': 'Select a circuit',
  '地球会旋转到对应比赛地点': 'The globe rotates to the chosen venue',
  '随机选择一条赛道': 'Pick a random circuit',
  '随机开始': 'Random circuit',
  '拖动地球旋转 · 点击标记选择 · 随机选择 →': 'Drag to rotate · Tap a marker · Random pick →',
  '未找到匹配的赛道': 'No matching circuits',
  '2026 赛程': '2026 SEASON',

  // ===== QR 面板 =====
  '手机当手柄': 'Phone as Controller',
  '两台手机分别在浏览器访问对应网址。手机需连接同一 WiFi / 热点。': 'Open each URL on a phone browser. The phones must share the same WiFi / hotspot.',
  '知道了': 'Got it',
  '正在获取热点地址…': 'Fetching hotspot addresses…',

  // ===== 规则面板 =====
  '比赛规则': 'Race Rules',
  '规则目录': 'Rules index',
  '驾驶控制': 'Driving Controls',
  'ERS 能量回收': 'ERS Energy Recovery',
  '路面与轮胎': 'Surfaces & Tyres',
  '轮胎性能对比': 'Tyre Comparison',
  '维修区与比赛': 'Pit Lane & Racing',
  '返回主菜单': 'Main Menu',

  // ===== 暂停面板 =====
  '比赛暂停': 'Race Paused',
  '比赛计时与所有车辆已冻结。': 'Timing and all cars are frozen.',
  '继续比赛': 'Resume',
  '查看规则': 'View Rules',
  '重新开始': 'Restart',

  // ===== 车库 =====
  '赛车设置': 'Garage Setup',
  '车型': 'VEHICLE MODEL',
  '赛车配色与头盔': 'LIVERY',
  '取消': 'Cancel',
  '保存并返回': 'Save & Back',
  '性能调校': 'Performance Tuning',
  '总预算': 'Budget',
  '平衡是关键': 'Balance is key',
  '性能预算': 'BUDGET',
  '驾驶设置': 'ASSISTS',
  '实际位移': 'Real Movement',
  '速度表数值不变，仅调整赛车在赛道中的移动节奏。': 'The speedometer value is unchanged; this only adjusts how the car moves on track.',
  '辅助驾驶': 'Assists',
  '自动速度保持': 'Auto Speed Hold',
  '完整碰撞': 'Full Collisions',
  '轻度碰撞': 'Light Collisions',
  '幽灵碰撞': 'Ghost Collisions',
  '性能预算 {total}/515 · 提高一项需要牺牲其他性能': 'Performance budget {total}/515 · boosting one costs others',

  // ===== 生涯 =====
  '成绩与生涯': 'Career & Results',
  '二十二站锦标赛': 'CHAMPIONSHIP',
  '重置赛季': 'Reset Season',
  '导出全部数据': 'Export All Data',
  '各赛道前 3 名': 'Top 3 per Circuit',
  '最近比赛': 'Recent Races',
  '🏆 二十二站锦标赛 {points} 分 · {wins} 胜/{races} 场 · 已解锁 {livers} 套赛车配色与头盔': '🏆 22-round championship · {points} pts · {wins}W/{races}R · {livers} liveries unlocked',
  '{track} · P{position} · +{points}分 · {date}': '{track} · P{position} · +{points} pts · {date}',
  '完成正赛后自动记录': 'Auto-recorded after each race',
  '暂无记录，去刷新吧！': 'No records yet — go set one!',
  '你的最佳圈 ': 'Your best lap ',
  '尚无记录': 'No records yet',
  '{laps} 圈': '{laps} Laps',
  '确定重置当前二十二站锦标赛吗？历史比赛记录不会删除。': 'Reset the 22-round championship? Race history will not be deleted.',
  '{done}/{total} 站完成': '{done}/{total} rounds done',
  '{points} 分': '{points} pts',
  '从澳大利亚站开始新的 {n} 站赛季': 'Start a new {n}-round season from Australia',
  '赛季冠军 🏆 {team}': 'Season champion 🏆 {team}',
  '历届冠军': 'Past champions',
  '最快圈 ': 'best lap ',

  // ===== 选关 / 比赛设置 =====
  '选择赛道': 'Select Circuit',
  '返回': 'Back',
  '下一步：比赛设置': 'Next: Race Setup',
  '比赛设置': 'Race Setup',
  'P1 车队': 'P1 TEAM',
  'P2 车队': 'P2 TEAM',
  'P1 赛车': 'P1 VEHICLE',
  'P2 赛车': 'P2 VEHICLE',
  'AI 难度': 'AI DIFFICULTY',
  '简单': 'Easy',
  '普通': 'Normal',
  '困难': 'Hard',
  '天气': 'WEATHER',
  '动态': 'Dynamic',
  '晴天': 'Sunny',
  '阴天': 'Cloudy',
  '降雨': 'Rain',
  '起步轮胎': 'STARTING TYRE',
  '软胎 S': 'Soft S',
  '中性胎 M': 'Medium M',
  '硬胎 H': 'Hard H',
  '半雨胎 I': 'Inter I',
  '全雨胎 W': 'Wet W',
  '圈数': 'LAPS',
  '1 圈': '1 Lap',
  '3 圈': '3 Laps',
  '5 圈': '5 Laps',
  '10 圈': '10 Laps',
  '20 圈': '20 Laps',
  '返回更换赛道': 'Back to Circuits',
  '开始排位赛': 'Start Qualifying',
  '开始计时赛': 'Start Time Trial',
  '赛道俯视预览': 'Circuit top-down preview',
  '俯视预览 · 起跑线在拱门处': 'Top-down preview · start line at the arch',
  '单人计时 {n} 圈': 'Time Trial · {n} Laps',
  '排位赛 1 圈 · 正赛 3 圈': 'Qualifying 1 lap · Race 3 laps',
  '双人对决 · 排位 1 圈 + 正赛 {n} 圈': 'Duel · Qualifying 1 lap + Race {n} laps',
  '本场 ': 'Laps: ',

  // ===== 结算 =====
  '比赛完成': 'Race Complete',
  '成绩明细': 'BREAKDOWN',
  '上一页': 'Previous',
  '下一页': 'Next',
  '再来一局 [R]': 'Restart [R]',
  '导出成绩': 'Export Result',
  '主菜单': 'Main Menu',
  '你赢了！': 'You win!',
  '第 {position} 名完赛': 'Finished P{position}',
  '🏆 大奖赛冠军！': '🏆 Grand Prix Champion!',
  '冠军 {team} · {time}': 'Winner {team} · {time}',
  '计时挑战': 'Time Trial',
  '挑战完成': 'Challenge complete',
  '你的总时间 ': 'Your total time',
  '· 罚时 +{s}s': '· Penalty +{s}s',
  '+{s}秒': '+{s}s',
  '🏆 胜利': '🏆 WIN',
  'P{position} 完赛': 'P{position} FINISH',
  '🏆 P1 胜利': '🏆 P1 WIN',
  '🏆 P2 胜利': '🏆 P2 WIN',
  '你的最佳圈速': 'Your best lap',
  '领先对手 · {team}': 'Lead rival · {team}',
  '领先对手最佳圈速': 'Lead rival best lap',
  '单圈明细': 'Lap detail',
  '第 {i} 圈': 'Lap {i}',
  'P1 第 {i} 圈': 'P1 Lap {i}',
  'P2 第 {i} 圈': 'P2 Lap {i}',
  '对手第 {i} 圈': 'Rival Lap {i}',
  '排位赛 · P1 第{p1} · P2 第{p2}': 'Qualifying · P1 P{p1} · P2 P{p2}',
  '杆位 {x} · {time}': 'Pole {x} · {time}',
  '双人对决发车顺序': 'Duel starting grid',
  '开始正赛': 'Start Race',
  '排位赛 P{pos}': 'Qualifying P{pos}',
  '正式发车顺序': 'Starting grid',
  '你 · ': 'You · ',
  'P1 获胜！': 'P1 wins!',
  'P2 获胜！': 'P2 wins!',
  '{x} 率先完赛 · 差距 {time}': '{x} finished first · gap {time}',
  '无': 'None',
  'P1 总用时（含罚时）': 'P1 total (incl. penalties)',
  'P2 总用时（含罚时）': 'P2 total (incl. penalties)',
  '完赛 {time} · 罚时 +{s}s': 'Finish {time} · Penalty +{s}s',
  '罚时明细：': 'Penalties: ',
  'P1 最佳圈速': 'P1 best lap',
  'P2 最佳圈速': 'P2 best lap',
  '总用时': 'Total',
  '圈': 'Lap',
  '分段明细': 'Sector detail',
  '12 等分视图（每段约圈长 1/12）· 蓝=最佳圈总用时': '12-sector view (each ≈ 1/12 lap) · blue = best-lap total',
  '三等分视图（每段约圈长 1/3）· 从发车点开始 红/蓝/黄 三段 · 蓝=最佳圈总用时': '3-sector view (each ≈ 1/3 lap) · red/blue/yellow from start · blue = best-lap total',
  '奇数段': 'Odd sectors',
  '偶数段': 'Even sectors',
  '创同赛道历史最快': 'Fastest on this circuit',
  '同赛道历史第二': '2nd fastest on this circuit',
  '锦标赛': 'Championship',
  '本场 +{points} 分 · 总积分 {career}': 'Race +{points} pts · total {career}',
  '{n} 站锦标赛积分': '{n}-round championship points',
  '下一站：{name}': 'Next: {name}',
  '开始新赛季': 'Start new season',
  '赛季领奖台': 'Season podium',
  '处罚明细': 'PENALTIES',
  '{reason} +{s}秒': '{reason} +{s}s',
  '错误': 'Error',

  // ===== HUD =====
  '圈数': 'LAPS',
  '圈': 'Lap',
  '总时间': 'TOTAL',
  '赛道位置': 'TRACK MAP',
  '当前圈速': 'CURRENT LAP',
  '当前': 'NOW',
  '最佳': 'BEST',
  '对手': 'RIVAL',
  '速度': 'SPEED',
  '挡位': 'GEAR',
  '软胎': 'Soft',
  '中性胎': 'Medium',
  '硬胎': 'Hard',
  '半雨胎': 'Inter',
  '全雨胎': 'Wet',
  '磨损': 'WEAR',
  '越界': 'OFF-TRACK',
  '湿地': 'WET',
  '放电中': 'DISCHARGING',
  '可用': 'READY',
  '电池': 'BATTERY',
  '正赛': 'RACE',
  '排位赛': 'QUALIFYING',
  '计时赛': 'TIME TRIAL',
  '进站': 'PIT',
  '前车': 'AHEAD',
  '后车': 'BEHIND',
  '← → 转向 · W 加速 · D 刹车': '← → Steer · W Gas · D Brake',
  'S P区急停 · X 倒车 · Space 放电': 'S Pit-brake · X Reverse · Space ERS',
  'P 进站 · 1–5 选胎 · Esc 暂停': 'P Pit · 1–5 Tyre · Esc Pause',
  '实时排名': 'INTERVAL',
  '放电': 'DISCHARGE',
  '满电': 'FULL',
  '充电': 'CHARGING',
  '建议进站 · {reason} · 预计换胎后 P{pos}': 'Pit advised · {reason} · rejoin P{pos}',
  '天气预告 · 约 {n} 秒后降雨': 'Rain in about {n}s',
  '天气预告 · 降雨持续，建议半雨胎/全雨胎': 'Rain continues · Inter/Wet advised',
  '天气预告 · 雨势结束，赛道将逐渐变干': 'Rain stopping · track will dry',
  '天气预告 · 持续降雨': 'Steady rain',
  '前往 PIT IN': 'Go to PIT IN',
  '等待来车 · 暂勿出站': 'Traffic ahead · hold',
  '安全释放 · 前往 PIT OUT': 'Safe release · go to PIT OUT',
  '前往 {team} P房': 'Go to {team} pit',
  'P房停车 ': 'PIT PARK ',
  '已进入本车队维修区': 'In pit box',
  '尚未进入': 'Not yet in',
  '已驶过': 'Past the box',
  '横向调整': 'Adjust laterally',
  '绿旗 · GREEN FLAG': 'GREEN FLAG',
  '黄旗 · 禁止超车': 'YELLOW FLAG · No overtaking',

  // ===== 比赛规则系统（警告 / 天气 / 策略） =====
  '抢跑': 'Jump start',
  '黄旗下超车': 'Overtake under yellow',
  '未完成一次换胎': 'No pit tyre change completed',
  '碰撞责任': 'Collision fault',
  '赛道界限': 'Track limits',
  '{reason} · +{s} 秒': '{reason} · +{s}s',
  '赛道界限累计 {n} 次': 'Track limits ×{n}',
  '赛道界限 {n}/5': 'Track limits {n}/5',
  '电池已满 · 能量回收停止': 'Battery full · regen stopped',
  '蓝旗 · 让行后方领先赛车': 'Blue flag · yield to leader',
  '{team} P房换胎 {t}/2.5s': '{team} pit service {t}/2.5s',
  '已停稳 · 请选择轮胎': 'Stopped · select a tyre',
  '停车位置过浅 · 继续向前': 'Too short · move forward',
  '停车位置过深 · 请倒车': 'Too far · reverse',
  '左右未对准停车框': 'Center on the box',
  '{team} P房完成 · {tyre} · 电池 100%': '{team} pit done · {tyre} · battery 100%',
  '等待放行 · 主赛道有来车': 'Hold · traffic on track',
  '安全释放 · 可以驶出 P 房': 'Safe release · exit pit',
  '降雨 · 赛道变湿': 'Rain · track getting wet',
  '雨停 · 赛道变干': 'Drying · track drying',
  '赛道干燥': 'Track dry',
  '需完成一次换胎': 'Mandatory stop',
  '天气变化': 'Weather change',
  '轮胎磨损': 'Tyre wear',
  '保持赛道位置': 'Hold position',
  '预判降雨': 'Rain forecast',
  '标准策略': 'Standard',
  'S 急刹仅限 P 区停车': 'S hard-brakes only in the pit lane',
  '已请求进站 · 驶向起终点外侧': 'Pit requested · head to start/finish outer',
  '取消进站': 'Pit cancelled',
  '下一次进站换 {x} 胎': 'Next pit: {x} tyre',
  '需在 P 房停稳后才能选择换胎种类': 'Stop in your pit box first to select a tyre',
  '下次进站换 {x} 胎': 'Next pit: {x} tyre',
  '你': 'You',

  // ===== 车型 / 调校 / 涂装 =====
  '全能型 GP': 'All-Rounder GP',
  '低阻直线型': 'Low-Drag Sprint',
  '高下压力型': 'High Downforce',
  '耐力回收型': 'Endurance Regen',
  '各项均衡，适合陌生赛道': 'Balanced stats, great on any circuit',
  '加速与极速更强，牺牲弯道和回收': 'Faster acceleration & top speed, weaker corners & regen',
  '制动和转向更强，直线速度较低': 'Stronger braking & cornering, lower top speed',
  '能量回收和稳定性优先': 'Prioritizes energy recovery & stability',
  '加速': 'Acceleration',
  '极速': 'Top Speed',
  '制动': 'Braking',
  '转向': 'Steering',
  '能量回收': 'Recovery',
  '钴蓝': 'Cobalt',
  '午夜（25 分）': 'Midnight (25 pts)',
  '日冕（60 分）': 'Solar (60 pts)',
  '· 极速调校 {v}': '· Top-speed tune {v}',
  '轮胎': 'Tyre',
  '配方': 'Compound',
  '速度': 'Speed',
  '耐磨': 'Durability',
  '每圈递减': 'Per-lap decay',

  // ===== 语言切换 / 杂项 =====
  '未定义的游戏状态: {name}': 'Undefined game state: {name}',
  '切换语言': 'Switch Language',
  '已暂停': 'PAUSED',
  '完赛': 'FINISH',
  '开': 'ON',
  '关': 'OFF',
  '当前选中赛道的俯视预览图': 'Top-down preview of the selected circuit',

  // ===== 车队按钮（P1 静态选择） =====
  '🔵 矢量 #12': '🔵 Vector #12',
  '🟡 巅峰 #23': '🟡 Apex #23',
  '🟣 螺旋 #36': '🟣 Helix #36',
  '🔴 轨道 #17': '🔴 Orbit #17',
  '🟢 脉冲 #88': '🟢 Pulse #88',
  '⚫ 棱镜 #6': '⚫ Prism #6',

  // ===== 手柄页 =====
  '请横屏使用': 'Rotate to landscape',
  '旋转手机到横屏开启手柄': 'Rotate your phone to start the controller',
  '选择位置': 'Choose a seat',
  '扫描电脑屏幕上对应的二维码后\n点击下方按钮进入手柄': 'Scan the matching QR code on your PC,\nthen tap a button below to enter',
  'P1 玩家': 'P1 Player',
  'P2 玩家': 'P2 Player',
  '也可在网址后加 ?p=1 或 ?p=2 直接指定': 'Or append ?p=1 / ?p=2 to the URL',
  '添加到主屏幕 · 全屏无浏览器栏': 'Add to home screen · fullscreen, no browser UI',
  '分享 → 添加到主屏幕 · 全屏无浏览器栏': 'Share → Add to Home Screen · fullscreen, no browser UI',
  '菜单 ⋮ → 添加到主屏幕 · 全屏无浏览器栏': 'Menu ⋮ → Add to Home Screen · fullscreen, no browser UI',
  '未连接': 'Not connected',
  '已连接': 'Connected',
  '重连中…': 'Reconnecting…',
  '维修区急停': 'Pit Emergency Stop',
  '全屏': 'Fullscreen',
  '第 {lap}/{total} 圈 · {time} · 最佳 {best}': 'Lap {lap}/{total} · {time} · Best {best}',
  '倒计时 {c} · 共 {n} 圈': 'Countdown {c} · {n} laps',
  '完赛 · 最佳 {time}': 'Finished · Best {time}',
  '已请求': 'Requested',
  '请求中…': 'Requesting…',
  '取消中…': 'Cancelling…',
  '请选择轮胎': 'Select a tyre',
  '中性': 'Medium',
  '半雨': 'Inter',
  '全雨': 'Wet',
  '已停稳 · 点击选择换什么胎': 'Stopped · tap a tyre',
  '进站换胎': 'Pit Stop',
  '技师正在换胎…': 'Changing tyre…',

  // ===== 语言切换 =====
  '切换语言 / Switch Language': '切换语言 / Switch Language',
};

// 富文本 HTML 块（规则说明等含 <b>/<kbd> 的长段落），按语义 key 分语言。
const RICH = {
  'rules.hint': {
    zh: '按 <b>Esc</b> 暂停比赛<br>按 <b>P</b> 请求进站<br>按 <b>Space</b> 启动 ERS',
    en: 'Press <b>Esc</b> to pause<br>Press <b>P</b> to request a pit stop<br>Press <b>Space</b> to launch ERS'
  },
  'rule.controls': {
    zh: '<kbd>←</kbd><kbd>→</kbd> 转向；<kbd>W</kbd> 加速；<kbd>D</kbd> 渐进制动；<kbd>S</kbd> 仅在 P 区用于急停，赛道上无效；<kbd>X</kbd> 独立倒车。松开 <kbd>W</kbd> 后保持当前速度，只有制动、倒车或路面限速会减速；<kbd>Space</kbd> 启动 ERS；<kbd>P</kbd> 请求进站；<kbd>Esc</kbd> 暂停。',
    en: '<kbd>←</kbd><kbd>→</kbd> steer; <kbd>W</kbd> accelerate; <kbd>D</kbd> progressive brake; <kbd>S</kbd> emergency brake (pit lane only, no effect on track); <kbd>X</kbd> independent reverse. Releasing <kbd>W</kbd> holds current speed — only braking, reversing or track speed limits slow you down; <kbd>Space</kbd> launches ERS; <kbd>P</kbd> requests a pit stop; <kbd>Esc</kbd> pauses.'
  },
  'rule.ers': {
    zh: '启动一次后会持续放完当前电量。100% 电量加速 5 秒，50% 为 2.5 秒。中等制动回收效率最高；锁胎、湿地会降低效率；满电停止回收。',
    en: 'Once launched it discharges the current charge fully. 100% charge boosts for 5 seconds, 50% for 2.5. Moderate braking recovers most efficiently; locked wheels and wet track lower efficiency; regen stops at full charge.'
  },
  'rule.tyres': {
    zh: '压红白路肩限速 90%；浅灰缓冲区限速 80%；砂石区限速 70%。正赛必须在 P 房实际完成至少一次换胎，同配方换新胎也有效；未完成 <b>+20 秒</b>。',
    en: 'Red-and-white kerbs limit speed to 90%; light-grey runoff to 80%; gravel to 70%. In the race you must complete at least one tyre change at the pit box — a fresh set of the same compound also counts; otherwise <b>+20s</b>.'
  },
  'rule.compare': {
    zh: '以中性胎（M）为基准：速度=100%、耐磨=100%。其他配方按比例对照。耐磨数值越高，轮胎寿命越长、磨损越慢；湿地表现指雨天抓地保留率。',
    en: 'Based on the Medium (M) tyre: speed=100%, durability=100%. Other compounds are proportional. Higher durability means longer life and slower wear; wet performance is retained grip in the rain.'
  },
  'rule.speeddecay': {
    zh: '极速递减：每跑完一圈，当前轮胎极速下降 <b>2%</b>（中性胎基准 366 km/h，第 1 圈后 ≈358，第 2 圈后 ≈351）。磨损越快的配方递减越快：软胎每圈 −2.9%，硬胎每圈 −1.3%。',
    en: 'Top-speed decay: each lap completed drops the current tyre top speed by <b>2%</b> (Medium baseline 366 km/h: ≈358 after lap 1, ≈351 after lap 2). Faster-wearing compounds decay quicker: Soft −2.9%/lap, Hard −1.3%/lap.'
  },
  'rule.speedtable': {
    zh: '按估算磨损率计算（单圈 80s、均速 240、滑移 0.2）。磨损达 100% 后封顶衰减；实际极速受天气、调校、驾驶风格影响。',
    en: 'Computed from estimated wear rates (lap 80s, avg speed 240, slip 0.2). Decay caps once wear reaches 100%; actual top speed is affected by weather, tuning and driving style.'
  },
  'rule.pit': {
    zh: '<kbd>P</kbd> 请求进站，沿 PIT IN 进入；两条白线之间自动限速并暂停赛道界限判定，在所属车队 P 房停稳换胎。碰撞责任、黄旗下超车及累计越界会被处罚。',
    en: '<kbd>P</kbd> requests a pit stop — enter via PIT IN; speed is auto-limited between the two white lines and track-limit checks pause while you stop at your team\'s pit box for tyres. Collision fault, overtaking under yellow and repeated off-track are penalised.'
  },
  'rule.theorylabel': {
    zh: '理论极速表 · 各车型 × 轮胎 × 圈数（km/h 视觉值）',
    en: 'Theoretical top speed · each car × tyre × laps (visual km/h)'
  },
  'garage.tip': {
    zh: '总预算 <b style="color:#2b2b33">515</b><br><span class="dot">●</span> 平衡是关键',
    en: 'Budget <b style="color:#2b2b33">515</b><br><span class="dot">●</span> Balance is key'
  },
  'overlay.hint': {
    zh: '扫描电脑屏幕上对应的二维码后<br>点击下方按钮进入手柄',
    en: 'Scan the matching QR code on your PC,<br>tap a button below to enter'
  },
};

export function t(key, vars) {
  let out = lang === 'zh' ? key : (EN[key] ?? key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split('{' + k + '}').join(String(v));
    }
  }
  return out;
}

export function thtml(key) {
  const block = RICH[key];
  if (!block) return '';
  return block[lang] || block.zh || '';
}

export function getLang() { return lang; }
export function isZh() { return lang === 'zh'; }

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 扫描静态 DOM：data-i18n（文本）、data-i18n-html（富文本）、title/placeholder/aria。
export function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = thtml(el.getAttribute('data-i18n-html'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
}

export function setLang(next) {
  lang = next === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 隐私模式 / 无 localStorage */ }
  // typeof document 守卫：Node 单测环境可调用 setLang 切换到中文断言，无需 DOM。
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyStaticI18n();
  }
  for (const fn of listeners) {
    try { fn(lang); } catch (e) { console.error('[i18n listener]', e); }
  }
}

// 语言切换按钮的文案：中/EN
export function langButtonLabel() {
  return lang === 'zh' ? 'EN' : '中';
}

// 车队显示名：中文用中文名（矢量…），英文用首字母大写的代码（Vector…）
const TEAM_ZH = { VECTOR: '矢量', APEX: '巅峰', HELIX: '螺旋', ORBIT: '轨道', PULSE: '脉冲', PRISM: '棱镜' };
export function teamName(code) {
  return lang === 'zh' ? (TEAM_ZH[code] || code) : (code.charAt(0) + code.slice(1).toLowerCase());
}

// 模块加载即同步文档语言与静态文案（脚本位于 body 末尾，DOM 已就绪）。
// typeof document 守卫：Node 单测环境直接 import 本模块（经 hud/race-flow 传递）时无 DOM。
if (typeof document !== 'undefined') {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  applyStaticI18n();
}
