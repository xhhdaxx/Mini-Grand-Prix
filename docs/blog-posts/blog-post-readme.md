# 🏁 Mini Grand Prix：一台直接在浏览器里跑的卡通方程式大奖赛

> 24 条赛道。6 辆车同场。一圈排位 + 三圈正赛。零安装、零依赖、零构建 —— 点开链接就能开赛。

**大家好，我是 [xhhdaxx](https://github.com/xhhdaxx)。** 这篇文章要介绍我的开源项目 **Mini Grand Prix** —— 一台完全用原生 HTML、JavaScript 和 Canvas 2D 打造的方程式策略竞速游戏。

先点一下下面的图片，看 20 秒主菜单 + 3D 地球选站实录：

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-preview.gif" width="100%" alt="主菜单与三维地球选站 20 秒循环预览" /></a>

<div align="center">

**▶ 立即试玩**：<https://xhhdaxx.github.io/Mini-Grand-Prix/> · **📦 GitHub**：<https://github.com/xhhdaxx/Mini-Grand-Prix>

</div>

---

## 📑 这篇文章的目录

- [一、它是什么](#一它是什么)
- [二、核心数据](#二核心数据)
- [三、六大核心特色](#三六大核心特色)
- [四、视觉一览](#四视觉一览)
- [五、2026 赛历：24 站 + 6 支虚构车队](#五2026-赛历24-站--6-支虚构车队)
- [六、每一圈都是一次决策](#六每一圈都是一次决策)
- [七、3 分钟跑起来](#七3-分钟跑起来)
- [八、参与贡献与联系作者](#八参与贡献与联系作者)
- [📌 CSDN / 博客园读者增补段：项目定位与故事](#-csdn--博客园读者增补段项目定位与故事)
- [📍 三平台发布提示](#-三平台发布提示)

---

## 一、它是什么

**Mini Grand Prix** 是一台**纯前端**的方程式策略竞速游戏。一句话定义：

> **3D 地球选站 → 调校赛车 → 一圈排位 → 三圈正赛 → 积分与下一站**

你和 5 辆 AI 赛车同场争夺排名，同时管理 **轮胎配方、温度、磨损、ERS 电量、动态天气和进站窗口**。速度当然重要，但真正决定方格旗落下时排名的，往往是下一个弯、下一片雨云、下一次进站决策。

### 三种玩法模式

| 模式 | 适合场景 | 备注 |
|:---|:---|:---|
| 🏁 **大奖赛周末** | 主线玩法 | 排位 + 正赛，积分累计到 24 站生涯 |
| ⏱️ **单人计时挑战** | 练车、刷圈 | 一圈计时，记录最佳圈速 |
| 📱 **手机手柄分屏对决** | 朋友来家里 | 局域网扫码连接两台手机，P1 / P2 同屏对决 |

### 完全开源、MIT 协议

- 项目地址：<https://github.com/xhhdaxx/Mini-Grand-Prix>
- 在线 Demo：<https://xhhdaxx.github.io/Mini-Grand-Prix/>
- 邮件联系：[xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com)

---

## 二、核心数据

| 维度 | 数值 |
|:---|:---|
| **支持语言** | 简体中文 / English（运行时切换） |
| **赛道数量** | 24 条（覆盖亚太 / 欧洲 / 美洲 / 中东） |
| **车队数量** | 6 支（全部虚构，性能倾向各异） |
| **同场赛车** | 6 辆（玩家 + 5 辆 AI 公平对抗） |
| **玩法模式** | 大奖赛周末 / 单人计时 / 手机双人分屏 |
| **轮胎配方** | 5 种（软、中性、硬、半雨、全雨） |
| **天气类型** | 晴 / 阴 / 雨 / 可预报的动态天气 |

> 💡 **一句话亮点**：纯前端、零安装、零账号 —— 浏览器原生 ES Modules + Canvas 2D，点开链接就能开赛。

---

## 三、六大核心特色

### 🏎️ 1. 六车同场 AI 竞速

你不是一个人在跑圈。**5 辆 AI 赛车**和你争夺每一个弯道，它们和你**共享同一套车辆、轮胎、ERS、维修区规则** —— 不开挂、不读档，公平对抗。

**关键设计**：AI 难度参数**只调"目标圈速"和"激进度"**，物理参数（最高速度、抓地力、轮胎磨损速率）所有车完全一致。你看到 AI 第 2 圈进站换了硬胎，就知道它最后一圈会更耐用但单圈更慢 —— 策略博弈完全成立。

### 🌍 2. 3D 地球手工选站

主菜单右侧是一颗可拖动旋转的 **3D 地球**，每条赛道用**真实经纬度**标记在地球上。从上海到拉斯维加斯，从摩纳哥到亚斯码头 —— 24 条赛道覆盖五大洲。

**实现细节**：地球陆地数据来自开源的 **Natural Earth**（Public Domain），用 Canvas 2D 球面投影 + 自定义裁剪渲染，**不依赖 WebGL / Three.js**。

### ⚡ 3. ERS（能量回收系统）

按 `Space` 主动放电，**100% 电量可放电约 5 秒**；制动时回收能量，**中等制动力回收效率最高**；锁胎、湿地、满电状态会影响或停止回收。每一次按下 Space，都是在做"现在用还是留到直道末尾"的策略决策。

### 🛞 4. 完整轮胎模型

五种配方：**软胎、中性胎、硬胎、半雨胎、全雨胎**。每种配方都有自己的温度窗口、磨损曲线和湿地适配。**正赛强制至少进站换胎一次**（同配方换新也算），未完成则完赛加罚 20 秒。

### 🌦️ 5. 动态天气与预报

晴天、阴天、降雨，以及**可提前预判的动态天气**。预报会告诉你"雨云还有 N 圈到达赛道"，但要不要提前换雨胎 —— 取决于你当前的名次、轮胎状态和风险偏好。

### 🔧 6. 完整维修区系统

每条赛道都有**独立的 PIT IN / PIT OUT 路线**，**6 支车队互不重叠的 P 房**，**限速区**（首个 P 房前 30 米到最后一个 P 房后 30 米），以及**安全释放规则**。按 `P` 请求进站，进 P 房后按 `1`-`5` 选择下次换什么胎。

> **更多细节**：抢跑处罚、黄旗下超车处罚、碰撞责任处罚、累计越界处罚、HUD（速度/挡位/转速/圈速/轮胎/天气/ERS/排名/赛道图/进站引导）…… 想说真的太多了，建议直接上手体验。

---

## 四、视觉一览

> ⚠️ **发布提示**：以下截图来自项目本地 `Web_Pictures_Material/CN/` 目录。**发布到 CSDN / 博客园 / 掘金时，请将这些本地图片手动上传到平台图床**，再把 Markdown 中的相对路径替换为返回的 URL。文末 [📍 三平台发布提示](#-三平台发布提示) 有完整清单。

### 主菜单与选站

| 主菜单 + 3D 地球 | 赛道详情 |
|:---:|:---:|
| ![主菜单与 3D 地球](../../Web_Pictures_Material/CN/1-home.png) | ![赛道详情](../../Web_Pictures_Material/CN/2-track-selection.png) |

### 比赛准备

| 比赛设置 | 赛车调校 |
|:---:|:---:|
| ![比赛设置](../../Web_Pictures_Material/CN/3-race-setup.png) | ![赛车调校](../../Web_Pictures_Material/CN/4-car-setup.png) |

### 生涯与规则

| 生涯与排行榜 | 完整规则 |
|:---:|:---:|
| ![生涯与排行榜](../../Web_Pictures_Material/CN/5-career-results.png) | ![完整规则](../../Web_Pictures_Material/CN/6-rules-1.png) |

### 📱 手机手柄界面

<p align="center">
  <img src="../../Web_Pictures_Material/CN/7-phone-controller.png" width="60%" alt="中文手机手柄操控界面" />
</p>

### 🎬 赛道实录 GIF（点击可看完整视频）

> GIF 全部托管在 GitHub Release，**三个博客平台可直接外链显示，无需上传图床**。

| 发车效果（上海） | 弯道（迈阿密） |
|:---:|:---:|
| <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/shanghai-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/shanghai-preview.gif" width="100%" alt="上海发车效果循环预览" /></a> | <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/miami-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/miami-preview.gif" width="100%" alt="迈阿密弯道循环预览" /></a> |
| **ERS 加速（奥地利）** | **换胎（巴塞罗那）** |
| <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/austria-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/austria-preview.gif" width="100%" alt="奥地利 ERS 加速循环预览" /></a> | <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/barcelona-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/barcelona-preview.gif" width="100%" alt="巴塞罗那换胎循环预览" /></a> |
| **AI 对战（卢赛尔）** | **AI 对战（亚斯码头）** |
| <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/lusail-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/lusail-preview.gif" width="100%" alt="卢赛尔 AI 对战循环预览" /></a> | <a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/yas-marina-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/yas-marina-preview.gif" width="100%" alt="亚斯码头 AI 对战循环预览" /></a> |

---

## 五、2026 赛历：24 站 + 6 支虚构车队

2026 赛历横跨亚太、欧洲、美洲与中东四大区。所有赛道均为根据现实地理走向手工制作的**简化艺术参考**，并非测绘复制 —— 弯道数量、半径、长度与现实布局存在差异。

### 🏁 24 条赛道完整列表

| # | 分站 | 赛道布局 | 弯数 | 长度 | 地区 |
|:---:|:---|:---|:---:|:---:|:---|
| 1 | 🇦🇺 澳大利亚 | 阿尔伯特公园 | 14 | 5.278 km | 亚太 |
| 2 | 🇨🇳 上海 | 上海 | 16 | 5.451 km | 亚太 |
| 3 | 🇧🇭 巴林 | 萨基尔 | 15 | 5.412 km | 中东 |
| 4 | 🇸🇦 吉达 | 吉达 | 27 | 6.174 km | 中东 |
| 5 | 🇺🇸 迈阿密 | 迈阿密 | 19 | 5.412 km | 美洲 |
| 6 | 🇨🇦 加拿大 | 蒙特利尔 | 14 | 4.361 km | 美洲 |
| 7 | 🇲🇨 摩纳哥 | 蒙特卡洛 | 19 | 3.337 km | 欧洲 |
| 8 | 🇪🇸 西班牙 | 巴塞罗那-加泰罗尼亚 | 16 | 4.675 km | 欧洲 |
| 9 | 🇦🇹 奥地利 | 施皮尔贝格 | 10 | 4.318 km | 欧洲 |
| 10 | 🇬🇧 英国 | 银石 | 18 | 5.891 km | 欧洲 |
| 11 | 🇩🇪 德国 | 霍肯海姆 | 17 | 4.574 km | 欧洲 |
| 12 | 🇧🇪 比利时 | 斯帕-弗朗科尔尚 | 20 | 7.004 km | 欧洲 |
| 13 | 🇭🇺 匈牙利 | 亨格罗林 | 14 | 4.381 km | 欧洲 |
| 14 | 🇳🇱 荷兰 | 赞德福特 | 14 | 4.259 km | 欧洲 |
| 15 | 🇮🇹 意大利 | 蒙扎 | 11 | 5.793 km | 欧洲 |
| 16 | 🇦🇿 阿塞拜疆 | 巴库 | 20 | 6.003 km | 中东 |
| 17 | 🇲🇾 马来西亚 | 雪邦 | 15 | 5.543 km | 亚太 |
| 18 | 🇸🇬 新加坡 | 滨海湾 | 23 | 5.063 km | 亚太 |
| 19 | 🇺🇸 奥斯汀 | 奥斯汀 | 20 | 5.513 km | 美洲 |
| 20 | 🇲🇽 墨西哥 | 墨西哥城 | 17 | 4.304 km | 美洲 |
| 21 | 🇧🇷 巴西 | 因特拉格斯 | 15 | 4.309 km | 美洲 |
| 22 | 🇺🇸 拉斯维加斯 | 拉斯维加斯大道 | 17 | 6.201 km | 美洲 |
| 23 | 🇶🇦 卡塔尔 | 卢赛尔 | 16 | 5.419 km | 中东 |
| 24 | 🇦🇪 阿布扎比 | 亚斯码头 | 16 | 5.281 km | 中东 |

> 📊 **几个有趣的数据**：弯数最少 = 奥地利（10 弯）｜最多 = 吉达（27 弯）｜最长 = 比利时斯帕（7.004 km）｜最短 = 摩纳哥蒙特卡洛（3.337 km）

### 🏎️ 6 支虚构车队

| 车队 | 车号 | 性能倾向 |
|:---|:---:|:---|
| **Vector Cobalt** 🔵 | 12 | 平衡、易上手 |
| **Apex Saffron** 🟡 | 23 | 直道速度 |
| **Helix Indigo** 🟣 | 36 | 弯道表现 |
| **Orbit Vermilion** 🔴 | 17 | ERS 回收 |
| **Pulse Teal** 🟢 | 88 | 综合动力 |
| **Prism Onyx** ⚫ | 6 | 稳定性 |

> ⚠️ **版权声明**：所有车队、车号、涂装均为**虚构内容**。本项目与 Formula 1、FIA 或任何现实赛事、车队、车手、车辆制造商、赛道运营方**均无隶属、授权、赞助或背书关系**。

---

## 六、每一圈都是一次决策

这个游戏的设计哲学是 **"规则足够丰富，但操作仍然直观"**。每一圈你都在回答这些问题：

| 决策点 | 你需要权衡的 |
|:---|:---|
| ⚡ **我现在该放电吗？** | ERS 只能持续数秒，之后需要通过制动回收并等待冷却 |
| 🌧️ **雨还没下，要提前进站吗？** | 预报会给你信息，但赛道位置和轮胎状态才决定答案 |
| 🛞 **再撑一圈，还是保住轮胎？** | 温度与磨损会直接改变抓地力和赛车表现 |
| 🚨 **要快，也要守规则。** | 黄旗、越界、碰撞责任和强制换胎都会影响最终成绩 |
| 🏁 **现在进站还是再拖一圈？** | 早进站 = 新胎更快但被堵在车流里；晚进站 = 旧胎但出站空旷 |

速度很重要，但**真正决定方格旗落下时排名的，是策略**。

---

## 七、3 分钟跑起来

### 环境要求

- **Node.js 18+**
- 现代桌面浏览器（Chrome / Edge / Firefox / Safari）
- 手机手柄模式需要电脑和手机在**同一局域网**

### 方式一：直接在线试玩（推荐第一次）

> 🔗 **点击直接玩**：<https://xhhdaxx.github.io/Mini-Grand-Prix/>

**不需要安装任何东西**。键盘模式下，主线玩法（排位 + 正赛 + 计时挑战 + 24 站生涯）100% 可用。

### 方式二：本地运行（完整功能含手机手柄）

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

## 八、参与贡献与联系作者

### 🤝 欢迎这样参与

- ⭐ **Star 项目** —— 让更多人看到它
- 🍴 **Fork 并贡献** —— 改 AI 策略、加新赛道、优化 HUD、做翻译
- 📢 **分享给喜欢赛车或前端的朋友**
- 🐛 **提 Issue** —— 反馈 bug、提想法、聊设计

### 👍 适合贡献的方向

- 改善 AI 的超车、防守与雨战策略
- 优化 Canvas 性能、窄屏 HUD 和可访问性
- 设计符合几何规范的参考赛道
- 补充物理、策略、存档容错、本地化与浏览器流程测试
- 改善文档、翻译或新手引导

### 📮 联系方式

| 入口 | 地址 |
|:---|:---|
| 🏠 GitHub 仓库 | [github.com/xhhdaxx/Mini-Grand-Prix](https://github.com/xhhdaxx/Mini-Grand-Prix) |
| 🎮 在线 Demo | [xhhdaxx.github.io/Mini-Grand-Prix](https://xhhdaxx.github.io/Mini-Grand-Prix/) |
| 🎬 完整实录视频 | [GitHub Release `gameplay-v1`](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/tag/gameplay-v1) |
| 📄 产品需求文档 | [`docs/prd.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/prd.md) |
| 🛠️ 赛道设计规范 | [`docs/track-authoring-standard.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/track-authoring-standard.md) |
| 📧 联系作者 | [xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com) |

### 📜 权利声明

本项目与 Formula 1、FIA 或任何现实赛事、车队、车手、车辆制造商、赛道运营方**均无隶属、授权、赞助或背书关系**。所有车队、车号、涂装均为虚构内容。3D 地球陆地数据来自 [Natural Earth](https://www.naturalearthdata.com/)（Public Domain）。完整第三方版权说明见 [`THIRD_PARTY_NOTICES.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/THIRD_PARTY_NOTICES.md)。

项目自有源代码使用 [MIT License](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/LICENSE) 开源。

---

# 📌 CSDN / 博客园读者增补段：项目定位与故事

> 📖 **这一段是给 CSDN / 博客园读者的"项目展示增补"**。如果你在 CSDN / 博客园发布，把这一段保留；如果在掘金发布，可以删除这一段（掘金读者更想看技术，对故事不感冒）。

## 这个项目为什么存在

如果你玩过任何一款商业方程式游戏，可能会注意到两件事：

1. **它们都很大**：动辄 30-100 GB 安装包，需要高配 PC 或主机
2. **它们都很复杂**：手柄/方向盘操作学习成本高，新手 10 分钟内被劝退

我想做一个**反方向**的尝试：

> **如果方程式赛车的核心乐趣 —— 排位、轮胎、天气、进站策略 —— 可以在一个浏览器标签页里完整呈现，会怎样？**

**Mini Grand Prix 就是这个问题的答案**：

- 📦 **零安装**：点开链接就玩
- 🎯 **5 分钟上手**：方向 + 油门 + 刹车，剩下的策略系统可以慢慢学
- 🧠 **每一圈都有决策**：不是单纯比谁按方向键按得快
- 💾 **零账号**：所有进度存在浏览器本地，不用注册不用登录

## 这个项目适合谁

| 你是… | 你会喜欢这个项目的… |
|:---|:---|
| 🏎️ **赛车爱好者** | 24 条赛道 + 6 车队 + 完整策略系统 |
| 💻 **前端工程师** | 零依赖、零构建的"反潮流"工程实践 |
| 🎓 **计算机学生** | 一份干净、可读、有完整测试的实战项目 |
| 🤖 **AI 协作开发者** | 一个适合让 AI 接手维护的代码基线 |
| 🎮 **独立游戏玩家** | 浏览器里能跑的策略竞速，正适合摸鱼 |
| 📚 **教学场景** | Canvas 2D / ES Modules / 状态机的活教材 |

## 视觉冲击

如果上面的 GIF 还没看够，这里再来一组：

### 🎬 6 段完整实录

每一段 GIF 都对应一条赛道的真实录屏。**点击 GIF 跳转到完整 mp4 视频**（GitHub Release 托管，全球 CDN 加速）：

| 视频 | 时长 | 内容 |
|:---|:---:|:---|
| 🎬 [**上海发车**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/shanghai-gameplay.mp4) | ~30s | 灯灭发车的瞬间加速感 |
| 🎬 [**迈阿密弯道**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/miami-gameplay.mp4) | ~30s | 高速弯的走线与抓地力 |
| 🎬 [**奥地利 ERS**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/austria-gameplay.mp4) | ~30s | 直道末段放电超车 |
| 🎬 [**巴塞罗那换胎**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/barcelona-gameplay.mp4) | ~45s | 进站换胎的完整流程 |
| 🎬 [**卢赛尔 AI 对战**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/lusail-gameplay.mp4) | ~60s | 与 AI 的多圈缠斗 |
| 🎬 [**亚斯码头 AI 对战**](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/yas-marina-gameplay.mp4) | ~60s | 收官战的攻防节奏 |

## 后续路线图

项目当前是 `v1.0` 稳定版本。后续可能探索的方向（如果你有兴趣贡献，欢迎 Issue 聊）：

- 🌐 **在线多人**：把局域网手机手柄扩展成互联网对战
- 🏆 **赛季模式增强**：完整的 24 站锦标赛模拟，含车队总冠军
- 🎨 **车辆涂装自定义**：玩家可以设计自己的涂装并分享
- 📊 **遥测数据导出**：把每圈的油门/刹车/转向数据导出成 CSV/JSON
- 🌍 **更多语言**：日语、韩语、西班牙语等
- 📱 **PWA 离线支持**：把游戏装到手机主屏幕，离线也能玩

## 写在最后

这个项目想表达的东西很简单：

> **"轻量"和"原始"不是劣势，而是另一种美学。**

当所有项目都在比谁的 `package.json` 更长、谁的 webpack 配置更复杂时，**回到浏览器最本源的能力**反而变成了一件有点酷的事。

如果这个项目让你有一点点心动 —— 哪怕只是想点开 Demo 玩两圈 —— 都欢迎：

<div align="center">

**🎮 [立即试玩](https://xhhdaxx.github.io/Mini-Grand-Prix/) · 📦 [GitHub 仓库](https://github.com/xhhdaxx/Mini-Grand-Prix) · ⭐ [点个 Star](https://github.com/xhhdaxx/Mini-Grand-Prix) · 🐛 [提个 Issue](https://github.com/xhhdaxx/Mini-Grand-Prix/issues)**

</div>

> 📧 任何问题、想法、合作意向，欢迎邮件至 [xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com)。
>
> **Made with Canvas, curiosity, and a little too much late braking.**

---

# 📍 三平台发布提示

> 📖 **发布前请阅读这一段并按指引操作，然后删除整段。**

## 图片资源清单

### ✅ 无需上传（三个平台都支持外链）

所有 `https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/*.gif` 的 GIF 和指向 `*.mp4` 的视频链接。**这些可以直接保留 Markdown 原样，三个平台都能正常显示。**

### ⚠️ 需要手动上传到平台图床的本地图片

| 文件 | 在文中的位置 | 用途 |
|:---|:---|:---|
| `Web_Pictures_Material/CN/1-home.png` | 视觉一览 · 主菜单与选站 | 主菜单 + 3D 地球 |
| `Web_Pictures_Material/CN/2-track-selection.png` | 视觉一览 · 主菜单与选站 | 赛道详情 |
| `Web_Pictures_Material/CN/3-race-setup.png` | 视觉一览 · 比赛准备 | 比赛设置 |
| `Web_Pictures_Material/CN/4-car-setup.png` | 视觉一览 · 比赛准备 | 赛车调校 |
| `Web_Pictures_Material/CN/5-career-results.png` | 视觉一览 · 生涯与规则 | 生涯与排行榜 |
| `Web_Pictures_Material/CN/6-rules-1.png` | 视觉一览 · 生涯与规则 | 完整规则 |
| `Web_Pictures_Material/CN/7-phone-controller.png` | 视觉一览 · 手机手柄界面 | 手机手柄 UI |

**操作步骤**：

1. 用平台编辑器的"上传图片"功能，把上面 7 张 PNG 各传一遍
2. 把 Markdown 中所有 `../../Web_Pictures_Material/CN/xxx.png` 替换为平台返回的 URL
3. 删除整个"📍 三平台发布提示"段落

## 三个平台各自的发布建议

> 📌 **三平台现在共用同一份正文**，没有"掘金版 / CSDN 版"的差异。下面的"📌 CSDN / 博客园读者增补段"对三个平台都适用（项目展示 + 视觉冲击 + 路线图）—— 它本质上是"项目故事增补段"，掘金读者也会喜欢。可以直接保留全文发布，不需要再删任何段落。

### 🥇 掘金

- **推荐标签**：`前端`、`JavaScript`、`Canvas`、`游戏开发`、`开源项目`
- **推荐封面**：`Web_Pictures_Material/CN/1-home.png`
- **掘金编辑器**对 markdown 支持最好，可以保留所有 `<details>`、复杂表格、HTML 标签

### 🥈 CSDN

- **推荐标签**：`前端`、`JavaScript`、`HTML5`、`Canvas`、`游戏开发`、`开源项目`
- **推荐封面**：`Web_Pictures_Material/CN/1-home.png`
- **推荐专栏**：可以新建一个"独立开源项目"专栏
- **CSDN 编辑器**对 markdown 支持不错，但 `<details>` 可能渲染为纯文本，建议把代码块直接展开

### 🥉 博客园（cnblogs）

- **推荐分类**：`前端`、`JavaScript`
- **博客园 markdown 支持较基础**，建议：
  - 把所有 `<details>` 展开成普通段落
  - 复杂 HTML 标签（如 `<div align="center">`）可能不渲染，建议改成纯 markdown 引用 `> `
  - 表格保持简单结构

## 标题候选（你可以按平台调性选）

| 平台 | 推荐标题 |
|:---|:---|
| 掘金 | **原生 Canvas + ES Modules 做了 24 站方程式赛车游戏：Mini Grand Prix 项目介绍** |
| CSDN | **🏁 Mini Grand Prix：一台浏览器里直接玩的卡通方程式大奖赛（含在线 Demo）** |
| 博客园 | **Mini Grand Prix —— 用纯前端做的方程式策略赛车游戏** |

---

<div align="center">

<sub>📖 本文是 Mini Grand Prix 项目的纯项目介绍。如果你喜欢这个项目，欢迎到 [GitHub](https://github.com/xhhdaxx/Mini-Grand-Prix) 点 Star ⭐。</sub>

<sub>👍 如果这篇文章对你有启发，**点赞 + 收藏 + 关注** 三连是对独立开发者最大的鼓励。</sub>

</div>
