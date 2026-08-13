# 🏁 用原生 HTML + Canvas 2D，我在浏览器里造了一台方程式大奖赛 — Mini Grand Prix

> 没有游戏引擎，没有前端框架，没有构建步骤。一份纯 JavaScript，渲染出排位、正赛、轮胎、ERS、天气和进站策略。

**大家好，我是 [xhhdaxx](https://github.com/xhhdaxx)。** 这是我暑期实训独立完成的个人项目 —— **Mini Grand Prix**，一台能直接在现代浏览器里打开的卡通方程式大奖赛。这篇文章想和大家聊聊：**它是什么、为什么这么做、有哪些有意思的技术决策，以及你怎么跑起来它。**

如果看完觉得有意思，欢迎到 GitHub 给个 **Star ⭐** 支持一下，这对独立开发者非常重要：

> 🔗 **项目地址**：[github.com/xhhdaxx/Mini-Grand-Prix](https://github.com/xhhdaxx/Mini-Grand-Prix)
> 📧 **联系作者**：[xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com)

先放一段 20 秒的循环预览热热身（**点击图片可看完整视频**）：

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-preview.gif" width="100%" alt="主菜单与三维地球选站 20 秒循环预览" /></a>

---

## 📑 目录

- [一、这个项目到底是个啥](#一这个项目到底是个啥)
- [二、为什么我要"反潮流"地用原生 Canvas](#二为什么我要反潮流地用原生-canvas)
- [三、一张图看懂整个比赛周末](#三一张图看懂整个比赛周末)
- [四、六大核心特色](#四六大核心特色)
- [五、四段赛道实录 GIF](#五四段赛道实录-gif)
- [六、技术架构剖析](#六技术架构剖析)
- [七、那些值得展开聊的实现细节](#七那些值得展开聊的实现细节)
- [八、3 分钟跑起来](#八3-分钟跑起来)
- [九、24 站 × 6 支虚构车队](#九24-站--6-支虚构车队)
- [十、写在最后](#十写在最后)

---

## 一、这个项目到底是个啥

**Mini Grand Prix** 是一台**纯前端**的方程式策略竞速游戏。一句话概括：

> **3D 地球选站 → 调校赛车 → 一圈排位 → 三圈正赛 → 积分与下一站**

你和 5 辆 AI 赛车同场争夺排名，同时要管理 **轮胎配方、温度、磨损、ERS 电量、动态天气和进站窗口**。速度当然重要，但真正决定名次的，往往是下一个弯、下一片雨云、下一次进站决策。

它不是一辆"开就完了"的街机卡丁车 —— 它把方程式比赛周末最迷人的部分压缩成一次紧凑的浏览器体验。

### 主要玩法模式

| 模式 | 适合场景 | 备注 |
|:---|:---|:---|
| 🏁 **大奖赛周末** | 主线玩法 | 排位 + 正赛，积分计入 24 站生涯 |
| ⏱️ **单人计时挑战** | 练车、刷圈 | 一圈计时，记录最佳圈速 |
| 📱 **手机手柄分屏对决** | 朋友来家里 | 局域网扫码连接两台手机，P1 / P2 同屏对决 |

---

## 二、为什么我要"反潮流"地用原生 Canvas

2026 年大家都在用 React/Vue + Vite + Three.js + TypeScript + Tailwind……为什么这个项目偏偏选了"看起来很复古"的技术栈？

**因为我想证明一件事：** 现代浏览器原生 API 的天花板，远比我们想象的高。

| 它**没有**的东西 | 它**用了**的东西 |
|:---|:---|
| ❌ 游戏引擎（Phaser / Pixi / Three.js） | ✅ 浏览器原生 **Canvas 2D** |
| ❌ 前端框架（React / Vue / Svelte） | ✅ 原生 **ES Modules** |
| ❌ 构建工具（Vite / Webpack / Rollup） | ✅ `<script type="module">` 直接加载 |
| ❌ TypeScript / Babel | ✅ 原生 JavaScript |
| ❌ npm 全家桶（运行时只有一个 `ws`） | ✅ Node.js 18+ 内置能力 |

带来的好处非常直接：

1. **零构建**：`git clone` 之后 `npm install && npm run start:keyboard`，没有打包步骤，源码即运行码。
2. **可读**：每个 `.js` 文件都是普通 ES Module，浏览器开发者工具里看到的就是源码本身，没有 source map 解谜。
3. **可教学**：作为教学项目，学生能直接读懂每一行代码。
4. **轻量**：除了 `ws`（手机手柄 WebSocket 服务），没有任何运行时依赖。

> **这不是说框架不好。** 而是想让大家看到：当你愿意回到浏览器最原始的 API 时，能写出多么干净、多么"透明"的代码。

---

## 三、一张图看懂整个比赛周末

> ⚠️ **CSDN 上传提示**：以下截图来自项目本地 `Web_Pictures_Material/CN/` 目录。**发布到 CSDN 时请将这些本地图片手动上传到 CSDN 图床**，再把 Markdown 中的相对路径替换为 CSDN 返回的 URL。文末附了完整路径清单。

| 主菜单 + 3D 地球选站 | 比赛设置 |
|:---:|:---:|
| ![主菜单与 3D 地球](../../Web_Pictures_Material/CN/1-home.png) | ![比赛设置](../../Web_Pictures_Material/CN/3-race-setup.png) |
| **赛道详情** | **赛车调校** |
| ![赛道详情](../../Web_Pictures_Material/CN/2-track-selection.png) | ![赛车调校](../../Web_Pictures_Material/CN/4-car-setup.png) |
| **生涯与排行榜** | **完整规则说明** |
| ![生涯与排行榜](../../Web_Pictures_Material/CN/5-career-results.png) | ![完整规则](../../Web_Pictures_Material/CN/6-rules-1.png) |

整个流程可以概括成一句话：

> **选赛道 → 选车队/难度/天气/起步轮胎 → 调校赛车 → 排位赛（1 圈定发车位）→ 正赛（3 圈，必须进站换胎）→ 结算 → 积分累计到 24 站生涯**

---

## 四、六大核心特色

### 🏎️ 1. 六车同场 AI 竞速

你不是一个人在跑圈。**5 辆 AI 赛车**会和你争夺每一个弯道，它们和你**共享同一套车辆、轮胎、ERS、维修区规则** —— 不开挂、不读档，公平对抗。

### 🌍 2. 3D 地球手工选站

主菜单右侧是一颗可拖动旋转的 **3D 地球**，每条赛道用**真实经纬度**标记在地球上。地球陆地数据来自开源的 **Natural Earth**（Public Domain）。从上海到拉斯维加斯，从摩纳哥到亚斯码头 —— 24 条赛道覆盖五大洲。

### ⚡ 3. ERS（能量回收系统）

按 `Space` 主动放电，**100% 电量可放电约 5 秒**；制动时回收能量，**中等制动力回收效率最高**；锁胎、湿地、满电状态会影响或停止回收。每一次按下 Space，都是在做"现在用还是留到直道末尾"的策略决策。

### 🛞 4. 完整轮胎模型

五种配方：**软胎、中性胎、硬胎、半雨胎、全雨胎**。每种配方都有自己的温度窗口、磨损曲线和湿地适配。**正赛强制至少进站换胎一次**（同配方换新也算），未完成则完赛加罚 20 秒。

### 🌦️ 5. 动态天气与预报

晴天、阴天、降雨，以及**可提前预判的动态天气**。预报会告诉你"雨云还有 N 圈到达赛道"，但要不要提前换雨胎 —— 取决于你当前的名次、轮胎状态和风险偏好。

### 🔧 6. 完整维修区系统

每条赛道都有**独立的 PIT IN / PIT OUT 路线**，**6 支车队互不重叠的 P 房**，**限速区**（首个 P 房前 30 米到最后一个 P 房后 30 米），以及**安全释放规则**（出 P 房不会撞到刚路过主道的车）。按 `P` 请求进站，进 P 房后按 `1`-`5` 选择下次换什么胎。

> **更多细节**：抢跑处罚、黄旗下超车处罚、碰撞责任处罚、累计越界处罚、HUD（速度/挡位/转速/圈速/轮胎/天气/ERS/排名/赛道图/进站引导）…… 想说真的太多了，建议直接上手体验。

---

## 五、四段赛道实录 GIF

**所有 GIF 都来自 [GitHub Release](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/tag/gameplay-v1)，CSDN 上可以直接外链显示，无需重新上传。点击 GIF 可观看完整视频。**

### 🏁 上海 — 发车效果

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/shanghai-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/shanghai-preview.gif" width="100%" alt="上海发车效果循环预览" /></a>

### 💨 迈阿密 — 弯道走线

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/miami-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/miami-preview.gif" width="100%" alt="迈阿密弯道循环预览" /></a>

### ⚡ 奥地利 — ERS 加速

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/austria-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/austria-preview.gif" width="100%" alt="奥地利 ERS 加速循环预览" /></a>

### 🔧 巴塞罗那 — 进站换胎

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/barcelona-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/barcelona-preview.gif" width="100%" alt="巴塞罗那进站换胎循环预览" /></a>

### 🤖 还有两段 AI 对战实录

| 卢赛尔 AI 对战 | 亚斯码头 AI 对战 |
|:---:|:---:|
| <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/lusail-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/lusail-preview.gif" width="100%" alt="卢赛尔 AI 对战循环预览" /></a> | <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/yas-marina-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/yas-marina-preview.gif" width="100%" alt="亚斯码头 AI 对战循环预览" /></a> |

---

## 六、技术架构剖析

整体架构非常干净 —— **"浏览器原生 ES Modules"** 五个字就能概括。

```text
浏览器原生 ES Modules
├── Canvas 2D          赛道、赛车、环境与 HUD
├── localStorage       成绩、生涯、设置与赛季进度（容错读写）
└── Node.js + ws       本地静态服务 + 可选的手机手柄 WebSocket 通道
```

### 项目结构（关键文件）

```text
index.html                       页面入口与界面样式
gamepad.html                     手机手柄页面
src/main.js                      游戏循环与流程编排
src/state-machine.js             比赛状态机
src/i18n.js                      中英文界面文案
src/game/
│   ├── car.js                   车辆控制、物理与碰撞
│   ├── ai.js                    AI 驾驶（263 行）
│   ├── race-flow.js             排位、正赛、计时与双人流程（867 行）
│   ├── race-systems.js          ERS、天气、轮胎、比赛控制和维修区规则
│   ├── track.js                 赛道与维修区几何（2268 行，最重的文件）
│   ├── track-meta.js            24 站赛历与本地化元数据
│   ├── teams.js / teams-data.js 车队配置
│   └── vehicle-config.js        车型预设与性能调校
src/renderer/
│   ├── track-render.js          赛道与环境绘制
│   ├── car-render.js            赛车绘制
│   ├── hud.js                   HUD、排名、进站引导（694 行）
│   ├── scenery.js               场景装饰
│   └── track-preview.js         赛道缩略图
src/ui/                          菜单与 3D 地球选站
src/gamepad/                     手机手柄 WebSocket 客户端
src/utils/                       键盘、数学、存档、导出工具
server.js                        本地静态服务 + WebSocket 中继
tests/run.js                     Node.js 功能测试入口
tests/smoke.mjs                  Playwright 浏览器冒烟测试
```

> **代码体量参考**：游戏核心逻辑约 **6000+ 行 JavaScript**（不含 HTML/CSS 和测试），最大的单文件是 `track.js`（2268 行，全部 24 条赛道的几何数据）。

### 测试与质量

| 命令 | 作用 |
|:---|:---|
| `npm test` | 车辆、比赛、轮胎、ERS、天气、赛道、存档、本地化全量功能测试 |
| `npm run lint` | ESLint 静态检查 |
| `npm run smoke` | Playwright 浏览器冒烟测试（自动启动 + 加载页面 + 校验控制台无错） |

整个项目**没有任何"CI 一下就绿，真机上就崩"**的情况 —— 每次改动都跑实际浏览器冒烟测试。

---

## 七、那些值得展开聊的实现细节

### 1️⃣ 3D 地球：用 Canvas 2D 模拟出来的"伪 3D"

主菜单右侧那颗可拖动的 3D 地球，**没有用 WebGL / Three.js**。它的实现思路是：

- 从 `world.geojson`（96KB，Natural Earth 公共领域数据）读取陆地多边形
- 用球面投影 + 自定义裁剪把 3D 经纬度映射到 2D 画布
- 鼠标拖动改变相机经纬度，每帧重绘
- 赛道点用真实经纬度反投影到地球表面，靠近边缘时自动淡出

**效果**：50KB 出头的代码，60 FPS 顺滑旋转，移动端也能跑。

### 2️⃣ ERS 模型：简单公式，复杂策略

ERS 的核心只有几个变量，但策略空间巨大：

```javascript
// 简化伪代码
if (按下 Space && 电量 > 0 && !冷却中) {
    放电 → 提供额外功率
    电量 -= dt / 5  // 100% 电量约 5 秒
}
if (制动中 && !锁胎 && !满电 && !湿地) {
    回收 → 电量 += 制动力 × 回收效率
}
if (电量耗尽) {
    进入冷却（X 秒后才能再次放电）
}
```

**关键在于**：制动回收的"中等制动力效率最高"是一条非线性的曲线 —— 重刹反而回收更少，因为锁胎会停止回收。**玩家必须在"重刹入弯"和"轻刹保电"之间做权衡**。

### 3️⃣ AI 驾驶：和你共享同一套规则

AI（`src/game/ai.js`）不是"作弊型"AI：

- AI 用**和你完全一样的车辆物理模型**
- AI 轮胎也会磨损、温度也会变化
- AI 也会进站换胎、被罚时、被黄旗限速
- AI 难度只调整"参考圈速目标"和"防守/进攻激进度"

这意味着 —— 你和 AI 的对抗是真正公平的。当你看到 AI 第 2 圈进站换了硬胎，你就知道它最后一圈会比你耐用，但单圈会更慢。

### 4️⃣ 维修区：每条赛道都是独立设计的

`track.js` 2268 行里有相当一部分是 24 条赛道的**独立维修区几何** —— 不是程序生成，是**手工设计的**：

- 每条赛道都有连续的 PIT IN → 维修区 → PIT OUT 路径
- 6 支车队的 P 房位置互不重叠
- 限速区严格按"首个 P 房前 30 米 → 最后一个 P 房后 30 米"规则
- 安全释放：出 P 房时会检查主道是否有车经过

> 设计标准全部记录在 [`docs/track-authoring-standard.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/track-authoring-standard.md)，欢迎社区贡献新赛道。

### 5️⃣ 手机手柄：局域网 WebSocket + 二维码

双人模式是这个项目最有趣的"非游戏"功能：

- 电脑端跑 `npm run start:gamepad`，启动一个 WebSocket 服务
- 主菜单显示 P1 / P2 两个二维码（局域网 IP + 端口）
- 手机扫码 → 打开 `gamepad.html` → 自动建立 WebSocket 连接
- 手机屏幕变成虚拟按键：方向、油门、刹车、ERS、进站
- 两位玩家可以分别用 P1 / P2 手机参加排位 + 分屏正赛

二维码实现来自开源的 [Project Nayuki QR Code Generator](https://github.com/nayuki/QR-Code-generator)（MIT 协议）。

### 6️⃣ 本地存档：把 localStorage 当数据库

所有进度（最佳成绩、最近比赛、车辆设置、赛季进度、设置项）都存在 `localStorage`，并且**所有读写都做了容错**：

- 解析 JSON 失败 → 回退到默认值
- 字段缺失 → 用默认值补全
- 版本迁移 → 自动升级旧存档

> **教训**：浏览器 `localStorage` 永远不是可信输入 —— 用户可能清缓存、可能跨域名访问、可能存档损坏。这个项目把每一行读出来的数据都当成"陌生人输入"对待。

---

## 八、3 分钟跑起来

### 环境要求

- **Node.js 18+**
- 现代桌面浏览器（Chrome / Edge / Firefox / Safari）
- 手机手柄模式需要电脑和手机在**同一局域网**

### 安装与启动

```bash
git clone https://github.com/xhhdaxx/Mini-Grand-Prix.git
cd Mini-Grand-Prix

npm install

# 纯键盘模式（最简）
npm run start:keyboard

# 键盘 + 手机手柄模式（启用 WebSocket、二维码、双人入口）
npm run start:gamepad
```

浏览器打开 <http://localhost:8080/> 即可。

> ⚠️ **不要直接双击 `index.html`**。浏览器会阻止 `file://` 页面加载 ES Module，必须通过本地 HTTP 服务启动。

### 连接手机当手柄

1. 电脑和手机连同一个 Wi-Fi（或电脑连手机热点）
2. 电脑端 `npm run start:gamepad`
3. 用手机扫描游戏页面显示的 **P1 / P2 二维码**
4. 手机屏幕变成手柄，可单独用 P1，也可双人 P1 + P2

### 操作速查

| 按键 | 功能 | 按键 | 功能 |
|:---:|:---|:---:|:---|
| `W` | 加速 | `D` | 制动 |
| `←` / `→` | 转向 | `X` | 倒车 |
| `Space` | ERS 放电 | `P` | 请求 / 取消进站 |
| `1` – `5` | 选择下次进站轮胎 | `S` | 在所属 P 房急停 |
| `Esc` | 暂停 | `R` | 结算后重新开始 |

> **自动速度保持**默认开启：松开 `W` 后赛车保持当前速度，可在"赛车设置"中关闭。

---

## 九、24 站 × 6 支虚构车队

### 2026 赛历（24 站）

> 澳大利亚 · 上海 · 巴林 · 沙特阿拉伯 · 迈阿密 · 加拿大 · 摩纳哥 · 西班牙 · 奥地利 · 英国 · 德国 · 比利时 · 匈牙利 · 荷兰 · 意大利 · 阿塞拜疆 · 马来西亚 · 新加坡 · 美国奥斯汀 · 墨西哥 · 巴西 · 拉斯维加斯 · 卡塔尔 · 阿布扎比

> 📌 **重要说明**：赛道是根据现实地理走向手工制作的**简化艺术参考**，并非测绘复制。弯道数量、半径、长度与现实布局存在差异。

### 6 支虚构车队

| 车队 | 车号 | 性能倾向 |
|:---|:---:|:---|
| **Vector Cobalt** | 12 | 平衡、易上手 |
| **Apex Saffron** | 23 | 直道速度 |
| **Helix Indigo** | 36 | 弯道表现 |
| **Orbit Vermilion** | 17 | ERS 回收 |
| **Pulse Teal** | 88 | 综合动力 |
| **Prism Onyx** | 6 | 稳定性 |

> ⚠️ **版权声明**：所有车队、车号、涂装均为**虚构内容**。本项目与 Formula 1、FIA 或任何现实赛事、车队、车手、车辆制造商、赛道运营方**均无隶属、授权、赞助或背书关系**。

---

## 十、写在最后

### 这个项目想表达什么

我一直觉得，**"轻量"和"原始"不是劣势，而是另一种美学**。

当所有项目都在比谁的 `package.json` 更长、谁的 webpack 配置更复杂时，**回到浏览器最本源的能力**反而变成了一件有点酷的事。Mini Grand Prix 想证明：

- ✅ 一款画面不丑、规则完整、策略有深度的游戏，可以**完全不依赖游戏引擎**
- ✅ 一个能拖动旋转的 3D 地球，可以**不用 WebGL**
- ✅ 一份现代前端代码，可以**没有打包步骤、没有 TypeScript、没有任何运行时依赖**
- ✅ 一个独立的暑期实训作品，可以**认真做完测试、文档、版权说明和国际化**

### 你可以这样参与

如果你喜欢这个项目，下面这些方式都能帮到独立开发者：

- ⭐ **Star 项目** —— 让更多人看到它
- 🍴 **Fork 并贡献** —— 改 AI 策略、加新赛道、优化 HUD、做翻译
- 📢 **分享给喜欢赛车或前端的朋友**
- 🐛 **提 Issue** —— 反馈 bug、提想法、聊设计
- 📧 **邮件联系** —— 商务合作、技术交流、教育用途都可以聊

### 项目链接

| 入口 | 地址 |
|:---|:---|
| 🏠 GitHub 仓库 | [github.com/xhhdaxx/Mini-Grand-Prix](https://github.com/xhhdaxx/Mini-Grand-Prix) |
| 🎬 完整实录视频 | [GitHub Release `gameplay-v1`](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/tag/gameplay-v1) |
| 📄 产品需求文档 | [`docs/prd.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/prd.md) |
| 🛠️ 赛道设计规范 | [`docs/track-authoring-standard.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/track-authoring-standard.md) |
| 📜 第三方版权声明 | [`THIRD_PARTY_NOTICES.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/THIRD_PARTY_NOTICES.md) |
| 📧 联系作者 | [xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com) |

---

### 📌 CSDN 发布小贴士（发布前请删除这一段）

本文中以下两种图片资源：

**✅ 无需上传（CSDN 会直接显示外链）**：

- 所有 `https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/*.gif` 的 GIF
- 所有指向 `*.mp4` 的视频链接（点击 GIF 跳转）

**⚠️ 需要手动上传到 CSDN 图床的本地图片**：

| 文件 | 在文中的位置 |
|:---|:---|
| `Web_Pictures_Material/CN/1-home.png` | "比赛周末流程"配图 |
| `Web_Pictures_Material/CN/2-track-selection.png` | "比赛周末流程"配图 |
| `Web_Pictures_Material/CN/3-race-setup.png` | "比赛周末流程"配图 |
| `Web_Pictures_Material/CN/4-car-setup.png` | "比赛周末流程"配图 |
| `Web_Pictures_Material/CN/5-career-results.png` | "比赛周末流程"配图 |
| `Web_Pictures_Material/CN/6-rules-1.png` | "比赛周末流程"配图 |

**发布建议**：

1. 先把上面 6 张本地 PNG 用 CSDN 编辑器的"上传图片"功能传一遍
2. 把 Markdown 中所有 `../../Web_Pictures_Material/CN/xxx.png` 替换为 CSDN 返回的图片 URL
3. 删除文末"CSDN 发布小贴士"这一节
4. 推荐标签：`前端` `JavaScript` `HTML5` `Canvas` `游戏开发` `开源项目` `赛车游戏`
5. 推荐封面图：`Web_Pictures_Material/CN/1-home.png`（主菜单 + 3D 地球）

---

<div align="center">

**Made with Canvas, curiosity, and a little too much late braking.**

如果这篇文章对你有启发，**点赞 + 收藏 + 关注** 三连是对独立开发者最大的鼓励 🙏

我们下一篇文章见 —— 也许会写《如何用 Canvas 2D 手搓一颗 3D 地球》或者《方程式游戏里的轮胎物理建模》，欢迎评论区告诉我你想看哪个。

</div>
