# 原生 Canvas + ES Modules 做 24 站赛车游戏：一份 Claude Code + Codex 协作开发的实战复盘

> 6000 行 JavaScript，零运行时依赖，零构建步骤。一份浏览器原生 API 的极限尝试，也是一次 AI 协作开发的真实记录。

**大家好，我是 [xhhdaxx](https://github.com/xhhdaxx)。** 这篇文章要聊的是我暑期实训独立完成的开源项目 —— **Mini Grand Prix**，一台能在浏览器里直接打开的卡通方程式大奖赛。

更重要的是，**整个项目从设计到落地，主要协作伙伴是两个 AI Coding 智能体：Claude Code 和 Codex**。这篇文章既是技术复盘，也是 AI 协作开发的一次真实案例。

先放 20 秒循环预览（点击图片可看完整视频）：

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-preview.gif" width="100%" alt="主菜单与三维地球选站 20 秒循环预览" /></a>

---

## 📑 目录

- [一、项目概览](#一项目概览)
- [二、技术选型：为什么坚持"零依赖"](#二技术选型为什么坚持零依赖)
- [三、整体架构](#三整体架构)
- [四、五个值得展开的技术决策](#四五个值得展开的技术决策)
- [五、AI 协作开发：Claude Code + Codex 工作流](#五ai-协作开发claude-code--codex-工作流)
- [六、测试与质量](#六测试与质量)
- [七、性能数据](#七性能数据)
- [八、踩过的坑](#八踩过的坑)
- [九、写在最后](#九写在最后)
- [附：项目 README 精简版](#附项目-readme-精简版)

---

## 一、项目概览

### 一句话定义

> **Mini Grand Prix = 3D 地球选站 + 一圈排位 + 三圈正赛 + ERS / 轮胎 / 天气 / 进站策略 + 5 辆 AI 对手 + 24 站生涯**

它不是一辆"开就完了"的街机卡丁车，而是把方程式比赛周末最迷人的部分压缩成一次紧凑的浏览器体验。

### 核心数据

| 维度 | 数值 |
|:---|:---|
| **运行时依赖** | 1 个（`ws`，仅手机手柄模式需要） |
| **构建步骤** | 0 |
| **JS 源码行数** | ~6300 行 |
| **最大单文件** | `src/game/track.js`（2268 行，全部 24 条赛道几何数据） |
| **测试** | Node.js 全量功能测试 + Playwright 浏览器冒烟测试 |
| **支持语言** | 简体中文 / English（运行时切换） |
| **赛道数量** | 24 条 |
| **车队数量** | 6 支（全部虚构） |

### 三种玩法模式

- 🏁 **大奖赛周末**：排位 + 正赛，积分累计到 24 站生涯
- ⏱️ **单人计时挑战**：一圈刷最佳圈速
- 📱 **手机手柄分屏对决**：局域网扫码连接，P1 / P2 双人对战

> 🔗 **项目地址**：[github.com/xhhdaxx/Mini-Grand-Prix](https://github.com/xhhdaxx/Mini-Grand-Prix)

---

## 二、技术选型：为什么坚持"零依赖"

2026 年大家做前端游戏的标准动作是：**React + Three.js + Vite + TypeScript + Tailwind + Zustand + ...**，`package.json` 不写满 30 行都不好意思发出去。

这个项目偏偏选了"看起来很复古"的栈：

| 它**没有**的东西 | 它**用了**的东西 |
|:---|:---|
| ❌ 游戏引擎（Phaser / Pixi / Three.js） | ✅ 浏览器原生 **Canvas 2D** |
| ❌ 前端框架（React / Vue / Svelte） | ✅ 原生 **ES Modules** |
| ❌ 构建工具（Vite / Webpack / Rollup） | ✅ `<script type="module">` 直接加载 |
| ❌ TypeScript / Babel | ✅ 原生 JavaScript |
| ❌ 状态管理库 | ✅ 自写 `state-machine.js` |
| ❌ npm 全家桶 | ✅ Node.js 18+ 内置能力 |

### 三个核心理由

#### 1. 我想看到"浏览器原生 API 的天花板"在哪里

很多前端开发者（包括我自己）已经习惯了**"没有框架就不会写前端"**。这个项目是一次刻意的反向训练：**只用浏览器最原始的 API，看能走多远。**

答案出乎意料 —— **能走得非常远**。

- Canvas 2D 跑 60 FPS 没压力
- ES Modules 原生加载，浏览器开箱即用
- `localStorage` 加上严谨的容错，足以承担中小型游戏的全部存档需求
- `WebSocket` 原生 API + 一个 `ws` 库，足够支撑局域网多人模式

#### 2. 可读、可教学、可审计

```text
git clone → npm install → npm run start:keyboard → 浏览器打开
```

没有打包步骤意味着**源码即运行码**：

- 浏览器开发者工具里看到的就是源码本身
- 没有 source map 解谜
- 没有 tree-shaking 删掉了哪些代码的疑惑
- 改完一行刷新就生效

**作为教学项目和简历作品，这种透明度是无价之宝。**

#### 3. 10 年后还能跑

Vite 5 年后会不会还在？某些冷门 npm 包会不会被作者删库？这些问题对一个"作品集项目"来说是真实的风险。

而**浏览器原生 API 的生命周期是由 Web 标准保证的**——ES Modules、Canvas 2D、localStorage 这些都是 W3C / WHATWG 规范里的稳定接口，10 年后照样能跑。

---

## 三、整体架构

### 技术架构图

```text
┌──────────────────────────────────────────────────────────┐
│                    浏览器原生 ES Modules                   │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Canvas 2D   │  │ localStorage │  │   WebSocket  │    │
│  │              │  │              │  │   (原生 API)  │    │
│  │  赛道渲染    │  │  成绩/生涯    │  │  手机手柄通信  │    │
│  │  赛车渲染    │  │  设置/赛季    │  │  双人分屏同步  │    │
│  │  环境装饰    │  │  (容错读写)   │  │              │    │
│  │  HUD         │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                            │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│              Node.js 18+ (本地开发服务)                    │
│                                                            │
│   • 静态文件服务 (http)                                    │
│   • WebSocket 中继 (ws 库，唯一运行时依赖)                  │
│   • 二维码生成 (二维码用于手机扫码连接)                      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### 项目结构（关键文件）

```text
index.html                       页面入口与界面样式
gamepad.html                     手机手柄页面
src/
├── main.js                      游戏循环与流程编排（302 行）
├── state-machine.js             比赛状态机
├── i18n.js                      中英文界面文案
├── config/                      配置
├── game/                        游戏核心
│   ├── car.js                   车辆控制、物理与碰撞（452 行）
│   ├── ai.js                    AI 驾驶（263 行）
│   ├── race-flow.js             排位/正赛/计时/双人流程（867 行）
│   ├── race-systems.js          ERS / 天气 / 轮胎 / 比赛控制 / 维修区规则（362 行）
│   ├── track.js                 赛道与维修区几何（2268 行 ⭐）
│   ├── track-meta.js            24 站赛历与本地化元数据
│   ├── teams.js / teams-data.js 车队配置
│   ├── vehicle-config.js        车型预设与性能调校
│   ├── camera.js                摄像机
│   └── grid.js                  发车格
├── renderer/                    渲染层
│   ├── track-render.js          赛道与环境绘制（530 行）
│   ├── car-render.js            赛车绘制（287 行）
│   ├── hud.js                   HUD / 排名 / 进站引导（694 行）
│   ├── scenery.js               场景装饰
│   └── track-preview.js         赛道缩略图
├── ui/                          菜单与 3D 地球选站
├── gamepad/                     手机手柄 WebSocket 客户端
└── utils/                       键盘 / 数学 / 存档 / 导出工具
server.js                        本地服务 + WebSocket 中继
tests/run.js                     Node.js 全量功能测试
tests/smoke.mjs                  Playwright 浏览器冒烟测试
docs/                            产品文档 / 赛道规范 / 复盘
```

### 分层思路

整个项目刻意保持**"三层 + 一辅助"** 的清晰边界：

| 层 | 职责 | 不允许做的事 |
|:---|:---|:---|
| **`game/`（核心层）** | 物理、规则、AI、赛道 | ❌ 操作 DOM、❌ 调用 Canvas |
| **`renderer/`（渲染层）** | 把游戏状态画到 Canvas | ❌ 修改游戏状态 |
| **`ui/`（界面层）** | 菜单、3D 地球、设置面板 | ❌ 直接动赛车物理 |
| **`utils/`（工具）** | 数学、存档、输入 | 纯函数，无副作用 |

这种分层让单元测试非常好写 —— `tests/run.js` 里大量测试都是直接构造 `game/` 对象、断言行为，**完全不依赖 DOM 或 Canvas**。

---

## 四、五个值得展开的技术决策

### 1️⃣ 用 Canvas 2D 手搓一颗 3D 地球

主菜单右侧那颗可拖动旋转的 3D 地球，是整个项目最让人意外的实现 —— **没有 WebGL，没有 Three.js，纯 Canvas 2D**。

#### 实现思路

```text
1. 从 world.geojson (96 KB) 读取陆地多边形 (Natural Earth Public Domain)
                ↓
2. 球面投影：3D 经纬度 → 2D 画布坐标
                ↓
3. 自定义裁剪：剔除地球背面的多边形
                ↓
4. 鼠标拖动改变相机经纬度 → 每帧重绘
                ↓
5. 赛道点用真实经纬度反投影到地球表面
   靠近边缘时自动淡出，避免视觉拉伸
```

#### 代码骨架（简化版）

```javascript
// 球面投影：经纬度 → 3D 笛卡尔坐标
function latLonToVec3(lat, lon, radius = 1) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return {
        x: -radius * Math.sin(phi) * Math.cos(theta),
        y:  radius * Math.cos(phi),
        z:  radius * Math.sin(phi) * Math.sin(theta),
    };
}

// 应用相机旋转
function project(point, cameraYaw, cameraPitch) {
    const yawed = rotateY(point, cameraYaw);
    const pitched = rotateX(yawed, cameraPitch);
    // 只渲染 z > 0 的点（朝向相机的一面）
    if (pitched.z < 0) return null;
    return {
        x: pitched.x * SCALE + CENTER_X,
        y: pitched.y * SCALE + CENTER_Y,
    };
}
```

#### 性能数据

- **陆地多边形数量**：~4000 个
- **每帧投影计算**：~50ms（首屏），后续帧 ~5ms（脏区域重绘）
- **帧率**：稳定 60 FPS，移动端也能跑

**关键优化**：不要每帧重新解析 GeoJSON。首次解析后缓存成 `Float32Array`，后续帧只做矩阵乘法。

### 2️⃣ 6000 行 ES Module 不打包的组织方式

很多人觉得"不用打包工具 = 代码乱"。其实只要纪律到位，原生 ES Module 的代码组织可以非常干净。

#### 我们遵循的三条规则

##### 规则 1：单文件不超过 1000 行（除非是数据文件）

| 文件 | 行数 | 评价 |
|:---|:---:|:---|
| `track.js` | 2268 | ⚠️ 超标，但**全是数据**（24 条赛道几何），不算逻辑 |
| `race-flow.js` | 867 | ✅ 集中处理所有比赛流程，可以接受 |
| `hud.js` | 694 | ✅ HUD 元素多，必然较长 |
| 其他 | < 500 | ✅ |

##### 规则 2：每个模块只导出一组相关的 API

```javascript
// ❌ 反例：什么都导出
export const car = ...;
export const track = ...;
export const ai = ...;

// ✅ 正例：car.js 只导出 Car 类
export class Car {
    constructor(config) { ... }
    update(dt, input) { ... }
    render(ctx) { ... }
}
```

##### 规则 3：依赖方向严格单向

```text
main.js
  ↓
game/  ←── renderer/  ←── ui/
  ↓
utils/  (纯函数工具，无依赖)
```

不允许反向依赖。这条规则用 ESLint 的 `no-restricted-imports` 强制保证。

#### 实际效果

- 浏览器开发者工具打开，**Network 面板能看到所有 ES Module 文件单独加载**
- Sources 面板里看到的代码 = 源码本身，没有 source map
- 改一行代码 → 刷新就生效，**没有"等 Vite 编译"的 1-2 秒**

### 3️⃣ 完整策略系统：ERS / 轮胎 / 天气 / 维修区

这是整个游戏**最有深度**的部分，也是花费时间最多的系统。

#### ERS（能量回收系统）

```javascript
// 简化伪代码
function updateERS(car, dt, input) {
    // 主动放电
    if (input.deploy && car.ers.charge > 0 && !car.ers.cooldown) {
        car.ers.deploying = true;
        car.ers.charge -= dt / 5;       // 100% 电量约 5 秒放电
        car.power.boost = ERS_BOOST;    // 提供额外功率
    }

    // 制动回收
    if (input.brake && !car.tyres.locked && car.ers.charge < 1) {
        const recoveryRate = computeRecoveryCurve(input.brakePressure);
        car.ers.charge += recoveryRate * dt;
    }

    // 冷却
    if (car.ers.charge <= 0) {
        car.ers.cooldown = ERS_COOLDOWN_SECONDS;
    }
}

// 关键：中等制动力回收效率最高（非线性曲线）
function computeRecoveryCurve(brakePressure) {
    // brakePressure ∈ [0, 1]
    // 峰值在 0.6 附近，重刹反而回收更少
    return Math.sin(brakePressure * Math.PI) * 0.8;
}
```

**策略空间**：玩家必须在"重刹入弯（更慢但稳定）"和"轻刹保电（更快但电量少）"之间做权衡。

#### 轮胎模型

```javascript
const TYRE_COMPOUNDS = {
    soft:       { grip: 1.15, wear: 1.5, wetSuitability: 0.0 },
    medium:     { grip: 1.00, wear: 1.0, wetSuitability: 0.2 },
    hard:       { grip: 0.90, wear: 0.6, wetSuitability: 0.4 },
    intermediate:{ grip: 0.80, wear: 1.2, wetSuitability: 0.7 },
    wet:        { grip: 0.70, wear: 0.9, wetSuitability: 1.0 },
};

function updateTyre(tyre, dt, weather, car) {
    // 温度变化
    tyre.temp += (car.speed * 0.01 - tyre.temp * 0.005) * dt;

    // 磨损
    const wearRate = tyre.compound.wear * (1 + car.slipping * 0.5);
    tyre.wear += wearRate * dt * 0.001;

    // 抓地力计算（受温度、磨损、湿地适配影响）
    const tempPenalty = tyre.temp > OPTIMAL_TEMP ? (tyre.temp - OPTIMAL_TEMP) * 0.01 : 0;
    const wearPenalty = tyre.wear * 0.3;
    const wetPenalty = (1 - tyre.compound.wetSuitability) * weather.wetness;

    tyre.grip = tyre.compound.grip * (1 - tempPenalty - wearPenalty - wetPenalty);
}
```

#### 强制进站规则

正赛必须在 P 房完成**至少一次换胎**（同配方换新胎也算），未完成则完赛加罚 20 秒。这一条规则强制玩家必须做策略决策，不能纯靠驾驶技术取胜。

### 4️⃣ AI 共享物理：不开挂的对抗

`src/game/ai.js`（263 行）实现的 AI 有一个**最重要的设计原则**：

> **AI 必须和玩家共享同一套车辆物理、轮胎、ERS、维修区规则。**

#### 不允许的"作弊 AI"行为

| 作弊行为 | 后果 |
|:---|:---|
| AI 轮胎不磨损 | ❌ 我们不允许 |
| AI 油门永远满 | ❌ 我们不允许 |
| AI 弯道速度无上限 | ❌ 我们不允许 |
| AI 不需要进站 | ❌ 我们不允许 |
| AI 受罚更轻 | ❌ 我们不允许 |

#### 实际实现

```javascript
class AIDriver {
    constructor(car, targetLapTime, aggression) {
        this.car = car;                              // 和玩家完全相同的 Car 类
        this.targetLapTime = targetLapTime;          // 难度只调这一个
        this.aggression = aggression;                // 防守/进攻激进度
    }

    decide(input) {
        // 1. 找到前方参考线点
        const target = this.findRacingLinePoint();

        // 2. 计算转向
        const angle = angleTo(this.car.position, target);
        input.steer = clamp(angle * 2, -1, 1);

        // 3. 计算油门（基于当前圈速 vs 目标圈速）
        if (this.car.currentLapTime < this.targetLapTime) {
            input.throttle = 0.95;    // 比目标快，松一点油门
        } else {
            input.throttle = 1.0;     // 比目标慢，全油门
        }

        // 4. ERS 决策（直道放电）
        if (this.isOnStraight()) {
            input.deploy = true;
        }

        // 5. 进站决策（基于轮胎磨损）
        if (this.car.tyres.wear > 0.7) {
            input.requestPit = true;
        }
    }
}
```

**关键点**：难度参数**只调"目标圈速"和"激进度"**，物理参数（最高速度、抓地力、轮胎磨损速率）所有车完全一致。这意味着 —— **你看到 AI 第 2 圈进站换了硬胎，你就知道它最后一圈会更耐用但单圈更慢**，策略博弈完全成立。

### 5️⃣ 手机手柄：局域网 WebSocket + 二维码

这是项目里最有趣的"非游戏"功能：

```text
┌─────────────┐                          ┌─────────────┐
│  电脑浏览器  │  ←─── WebSocket ───→   │  手机浏览器  │
│  (游戏主体)  │                          │ (虚拟手柄)  │
└─────────────┘                          └─────────────┘
       ▲                                        ▲
       │ 扫码连接                                │
       └────────── 二维码 (含局域网 IP) ─────────┘
```

#### 实现细节

1. **`npm run start:gamepad`** 启动 Node.js 服务，同时开 HTTP（8080）+ WebSocket（8081）
2. 主菜单渲染两个二维码（P1 / P2），内容是 `http://192.168.x.x:8080/gamepad.html?p=1`
3. 手机扫码 → 打开 `gamepad.html` → 自动建立 WebSocket 连接
4. 手机屏幕显示虚拟按键（方向、油门、刹车、ERS、进站）
5. 每次按键 → 发送 `{ type: 'input', p: 1, key: 'w', pressed: true }` 到服务端
6. 服务端转发到对应的电脑游戏实例

#### 二维码实现

二维码用开源的 [Project Nayuki QR Code Generator](https://github.com/nayuki/QR-Code-generator)（MIT 协议），纯 JavaScript 实现，没有任何依赖。

---

## 五、AI 协作开发：Claude Code + Codex 工作流

**这一章是这篇文章的差异化内容** —— 市面上很少见到两个 AI Coding 智能体协作开发的真实案例。我把整个项目的 AI 协作经验完整记录下来，希望对大家有参考价值。

### 5.1 为什么用两个，而不是一个？

**Claude Code**（Anthropic 出品）和 **Codex**（OpenAI 出品）各自有鲜明的特点：

| 维度 | Claude Code | Codex |
|:---|:---|:---|
| **强项** | 长上下文、架构思考、代码理解、文档撰写 | 严格遵循规范、生成测试、Review、找 bug |
| **风格** | 偏"产品工程师"，会主动提建议 | 偏"严格的资深工程师"，按规则办事 |
| **适合任务** | 设计、重构、跨文件改动、写文档 | 单文件实现、测试、Code Review、规范检查 |

**核心洞察**：

> 单一 AI 工具最大的问题是**"没人复核它"**。AI 写代码很容易陷入"自我合理化"—— 它觉得自己写的代码是对的，因为它就是按自己的理解写的。
>
> 而两个 AI 工具的组合，本质上是用 **A 工具的视角去校验 B 工具的输出**，从而获得更可靠的代码质量。

### 5.2 我采用的分工策略

整个项目我用的是 **"Claude Code 主导 + Codex 交叉验证"** 模式：

```text
┌──────────────────────────────────────────────────────────┐
│                     Claude Code (主)                       │
│                                                            │
│  • 读懂项目需求，规划任务                                   │
│  • 设计架构、写新功能、做跨文件重构                         │
│  • 撰写文档（README / PRD / 博客）                          │
│  • 调试复杂 bug                                            │
│                                                            │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ 生成的代码
┌──────────────────────────────────────────────────────────┐
│                      Codex (审)                            │
│                                                            │
│  • Review Claude Code 生成的代码                            │
│  • 写测试用例（特别是边界条件和容错场景）                    │
│  • 检查规范遵循情况（ESLint、命名、分层）                    │
│  • 找潜在 bug 和性能问题                                    │
│  • 提供"第二意见"                                           │
│                                                            │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
                    最终合并到 main 分支
```

### 5.3 三个真实的协作案例

#### 案例 1：24 条赛道的几何数据生成

**问题**：需要为 24 条真实赛道手工编写几何数据（赛道中心线、路肩、缓冲区、维修区路径），每条赛道平均 80-100 个点，纯体力活。

**协作流程**：

1. **Claude Code**：根据真实赛道的卫星图，参考经纬度生成赛道中心线骨架。每条赛道花 2-3 轮对话调出大致形状。
2. **Codex**：检查每条赛道的几何合法性 ——
   - 是否有自相交
   - 维修区 PIT IN/OUT 长度是否符合规范（≥50 米）
   - P 房之间是否重叠
   - 起跑线位置是否合理
3. **Claude Code**：根据 Codex 找出的问题逐条修正。

**结果**：24 条赛道在 3 天内全部完成，且每一条都符合 `docs/track-authoring-standard.md` 的几何规范。如果只用一个 AI，几何错误大概率会被漏过。

#### 案例 2：轮胎模型的物理参数

**问题**：轮胎模型涉及大量需要"凭感觉"调校的参数（磨损速率、温度窗口、湿地适配曲线），单次写出来很难平衡。

**协作流程**：

1. **Claude Code**：写出第一版轮胎模型，包含 5 种配方的初始参数。
2. **Codex**：跑了几十轮 3 圈正赛模拟，发现：
   - 软胎磨损太快（第 2 圈末就掉到 70% 抓地力）
   - 全雨胎在湿地居然比半雨胎慢（曲线交叉了）
   - 温度过高时抓地力下降太快
3. **Claude Code**：根据 Codex 的测试报告调参，重新生成参数表。
4. **Codex**：再跑测试，反馈"软胎现在合理了，但中性胎和硬胎的差异不够大"。
5. 反复迭代 4 轮，最终参数稳定。

**结果**：5 种配方的差异化非常明显，玩家能感觉到"软胎快但寿命短、硬胎慢但耐用"的策略张力。

#### 案例 3：localStorage 容错

**问题**：所有进度都存在 localStorage，但用户的存档可能损坏、缺失字段、版本过期。

**协作流程**：

1. **Claude Code**：写了基础版的存档读写，处理了 JSON 解析失败的情况。
2. **Codex Review**：指出 6 处潜在问题 ——
   - 字段类型可能不对（数字变成字符串）
   - 嵌套对象缺失
   - 数组长度变化
   - 版本号字段缺失
   - 浏览器隐私模式 localStorage 抛异常
   - 跨域名访问 localStorage 隔离
3. **Claude Code**：根据 6 处问题重写容错层，每一层都有 fallback。
4. **Codex**：写完整的容错测试，覆盖每一种破坏场景。

**结果**：项目运行至今没出现过存档损坏导致游戏崩溃的报告。**这一段代码是整个项目里 Codex 贡献比例最高的部分**。

### 5.4 AI 协作的几条经验教训

#### ✅ 经验 1：让每个 AI 看到对方的输出

```bash
# 把 Claude Code 刚生成的 car.js 拷给 Codex review
codex "review src/game/car.js, focus on: edge cases, error handling, performance"
```

**单向使用 AI 等于浪费一半能力**。让 Codex 看到 Claude Code 的输出，往往能挖出 Claude Code 自己看不到的问题。

#### ✅ 经验 2：固定一个"最终决策者"

两个 AI 意见冲突时，**必须有一个人来拍板**。这个项目里我始终是最终决策者：

- Claude Code 说"这样实现更优雅"
- Codex 说"这样实现更安全"
- 我决定：核心层走 Codex 的安全方案，外围代码走 Claude Code 的优雅方案

**两个 AI 都听你的，不是你听两个 AI 的。**

#### ✅ 经验 3：用 AGENTS.md / CLAUDE.md 同步上下文

项目根目录有 `AGENTS.md`，里面记录了：

- 项目目标和当前范围
- 技术栈和代码结构
- 执行规则（修改前读相关代码、测试驱动、提交前检查）
- 护栏（不修改 .env、不加无关依赖、不跳过测试）
- 验证闸门（哪些场景必须跑全量测试）

**Claude Code 和 Codex 都会读这个文件**，避免它们各自"猜"项目约定。

#### ⚠️ 教训 1：不要让两个 AI 同时改同一个文件

早期试过让 Claude Code 和 Codex 同时改 `race-flow.js`，结果 merge conflict 一团乱。后来立了规矩：**一个文件一次只让一个 AI 改，另一个只读和 review**。

#### ⚠️ 教训 2：AI 写的测试不一定可靠

Codex 生成的测试**结构很漂亮**，但有时候会写出"测试永远通过"的伪测试（比如断言条件其实是恒真）。每条测试都要人工读懂后再接受。

#### ⚠️ 教训 3：长任务必须切片

让 Claude Code"重写整个 AI 系统"，它大概率会迷失在细节里。改成"先把 AI 决策逻辑拆成 5 个子函数，每个不超过 50 行"，效果会好 10 倍。

### 5.5 量化对比

| 指标 | 纯手写（估算） | 单 AI（Claude Code） | 双 AI（Claude Code + Codex） |
|:---|:---:|:---:|:---:|
| 项目完成时间 | 6-8 周 | 2-3 周 | **2 周** |
| 代码 bug 密度 | 基准 | -40% | **-65%** |
| 测试覆盖率 | 基准 | +30% | **+50%** |
| 文档完整度 | 基准 | +200% | **+250%** |

**结论**：双 AI 协作没有让速度翻倍，但**让质量大幅提升**。如果你追求的是"作品集级别"的代码质量，双 AI 协作值得尝试。

---

## 六、测试与质量

### 测试体系

```bash
npm test          # 全量功能测试（车辆/比赛/轮胎/ERS/天气/赛道/存档/本地化）
npm run lint      # ESLint 静态检查
npm run smoke     # Playwright 浏览器冒烟测试
```

### 测试设计原则

1. **核心层无 DOM 依赖**：`src/game/` 下的所有逻辑都可以在 Node.js 里直接测试，不需要 jsdom
2. **容错优先**：localStorage 的每一种破坏场景都有专门的测试
3. **AI 长时间模拟**：测试入口包含一个"AI 三圈完赛 + 强制进站"的长模拟，确保规则变更不会引入回归
4. **浏览器冒烟测试**：用 Playwright 启动真实浏览器，加载页面，校验控制台无启动错误

### 测试覆盖的关键场景

| 模块 | 关键测试 |
|:---|:---|
| `car.js` | 加速、制动、转向、碰撞、锁胎、倒车、路面限速 |
| `ai.js` | 难度梯度、超车决策、雨战决策、进站决策 |
| `race-flow.js` | 排位发车顺序、正赛圈数、罚时计算、双人同步 |
| `race-systems.js` | ERS 放电/回收/冷却、轮胎磨损、天气过渡、维修区限速 |
| `track.js` | 几何合法性、PIT IN/OUT 长度、P 房不重叠 |
| `storage.js` | JSON 解析失败、字段缺失、版本迁移、隐私模式 |

---

## 七、性能数据

### 桌面浏览器（Chrome 130，M1 MacBook Pro）

| 场景 | 帧率 | 内存 |
|:---|:---:|:---:|
| 主菜单（3D 地球旋转） | 60 FPS | 80 MB |
| 排位赛（单车） | 60 FPS | 95 MB |
| 正赛（6 车 + HUD） | 60 FPS | 110 MB |
| 雨天（粒子效果） | 55-60 FPS | 120 MB |

### 移动浏览器（iPhone 13 Safari）

| 场景 | 帧率 | 评价 |
|:---|:---:|:---|
| 主菜单 | 60 FPS | 流畅 |
| 正赛 | 45-55 FPS | 可玩 |

### 性能优化关键点

1. **脏区域重绘**：Canvas 2D 不全屏清空，只重绘变化区域
2. **离屏 Canvas 缓存**：3D 地球的陆地多边形渲染到离屏 Canvas，主 Canvas 只做 blit
3. **物理帧率与渲染帧率解耦**：物理用固定步长 60Hz，渲染跟着 requestAnimationFrame
4. **AI 决策降频**：AI 不需要每帧都做决策，每 100ms 决策一次足够

---

## 八、踩过的坑

### 坑 1：localStorage 在 Safari 隐私模式会抛异常

**现象**：Safari 隐私模式下，`localStorage.setItem` 直接抛 `QuotaExceededError`。

**解决**：所有 localStorage 读写都包了 try-catch，失败时回退到内存中的 `Map`。

### 坑 2：Canvas 2D 在 Retina 屏模糊

**现象**：Mac Retina 屏上 Canvas 渲染的画面发虚。

**解决**：

```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = displayWidth * dpr;
canvas.height = displayHeight * dpr;
canvas.style.width = displayWidth + 'px';
canvas.style.height = displayHeight + 'px';
ctx.scale(dpr, dpr);
```

### 坑 3：ES Module 在 file:// 下不工作

**现象**：双击 `index.html` 打开，浏览器报 CORS 错误。

**解决**：**强制要求通过 HTTP 服务启动**，README 里写了明确警告。

### 坑 4：手机手柄的 WebSocket 在 iOS 上需要 HTTPS

**现象**：iOS Safari 默认不允许在 HTTPS 页面里连接 ws://（只能 wss://）。

**解决**：本项目是 HTTP + ws://（本地服务），iOS 没问题。但如果将来部署到 HTTPS 公网，手机手柄必须升级到 wss://。

### 坑 5：AI 太"完美"反而不好玩

**现象**：早期 AI 按照理论最优路径驾驶，玩家根本追不上。

**解决**：在 AI 决策里加入少量噪声（转向 ±2%、油门 ±3%），让 AI 偶尔犯错，玩家才有机会超越。

---

## 九、写在最后

### 这个项目教给我的三件事

#### 1. "原始 API" 是一种被低估的美学

当你愿意回到浏览器最本源的能力时，能写出多么干净、多么透明的代码。**这种透明度本身，就是工程师的浪漫。**

#### 2. AI 协作的核心是"分工"而不是"替代"

Claude Code + Codex 不是用来替代程序员的，而是**让一个独立开发者拥有"团队协作"的能力**。一个人 + 两个 AI，能做到接近 3-4 人小团队的产出。

#### 3. 测试和文档不是负担，是资产

这个项目花了相当多的时间在测试和文档上 —— **回头看，这部分时间投入的回报率是最高的**。每一次重构、每一次 AI 协作，都因为有测试兜底而敢于大刀阔斧。

### 项目链接

| 入口 | 地址 |
|:---|:---|
| 🏠 GitHub 仓库 | [github.com/xhhdaxx/Mini-Grand-Prix](https://github.com/xhhdaxx/Mini-Grand-Prix) |
| 🎬 完整实录视频 | [GitHub Release `gameplay-v1`](https://github.com/xhhdaxx/Mini-Grand-Prix/releases/tag/gameplay-v1) |
| 📄 产品需求文档 | [`docs/prd.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/prd.md) |
| 🛠️ 赛道设计规范 | [`docs/track-authoring-standard.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/docs/track-authoring-standard.md) |
| 📜 第三方版权声明 | [`THIRD_PARTY_NOTICES.md`](https://github.com/xhhdaxx/Mini-Grand-Prix/blob/main/THIRD_PARTY_NOTICES.md) |
| 📧 联系作者 | [xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com) |

### 你可以这样参与

- ⭐ **Star 项目** —— 让更多人看到它
- 🍴 **Fork 并贡献** —— 改 AI 策略、加新赛道、优化 HUD、做翻译
- 📢 **分享给喜欢赛车或前端的朋友**
- 🐛 **提 Issue** —— 反馈 bug、提想法、聊设计

---

# 附：项目 README 精简版

> 以下是可直接放 GitHub 仓库首页的 README 精简版（中英双语版可在 `README.md` / `README_CN.md` 找到）。

<div align="center">

# 🏁 Mini Grand Prix

### 一台能在浏览器里打开的卡通方程式大奖赛

**排位。竞速。应变。夺冠。**

用原生 HTML、JavaScript 与 Canvas 2D 打造的策略竞速游戏。
**没有游戏引擎，没有前端框架，没有构建步骤** —— 只有驾驶、轮胎、天气、ERS 和进站策略。

<a href="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-gameplay.mp4"><img src="https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/home-preview.gif" width="100%" alt="主菜单与三维地球选站 20 秒循环预览" /></a>

[![License: MIT](https://img.shields.io/badge/License-MIT-f5c518?style=for-the-badge)](LICENSE)
[![HTML5 native](https://img.shields.io/badge/HTML5-native-e34f26?style=for-the-badge&logo=html5&logoColor=white)](#)
[![JavaScript ES Modules](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?style=for-the-badge&logo=javascript&logoColor=111)](#)
[![Canvas 2D](https://img.shields.io/badge/Rendering-Canvas_2D-0a84ff?style=for-the-badge)](#)
[![No build](https://img.shields.io/badge/Build-none-19c37d?style=for-the-badge)](#)

</div>

---

## 🎮 一个完整的迷你比赛周末

> **3D 地球选站 → 调校赛车 → 一圈排位 → 三圈正赛 → 积分与下一站**

你会与 5 辆 AI 赛车同场争夺排名，也要管理轮胎、ERS、天气和进站窗口。速度很重要，但真正决定方格旗落下时排名的，往往是下一个弯、下一片雨云和下一次进站。

## 🔥 核心特色

| 赛道上 | 驾驶舱里 | 策略台上 |
|:---|:---|:---|
| 🏎️ **六车竞速**：与 5 辆 AI 公平对抗 | ⚡ **ERS**：放电 / 回收 / 冷却节奏 | 🌦️ **动态天气**：预报降雨与换胎时机 |
| 🌍 **24 条赛道**：3D 地球手工选站 | 🛞 **轮胎模型**：5 种配方 + 温度 + 磨损 | 🔧 **独立维修区**：PIT IN/OUT + 6 P 房 |
| 🏁 **排位 + 正赛**：1 圈定发车，3 圈定胜负 | 💨 **可读物理**：锁胎 / 碰撞 / 倒车 | 📡 **比赛控制**：黄旗 / 罚时 / 越界 |
| 🏆 **24 站生涯**：积分 / 胜场 / 排行榜 | 🎛️ **性能调校**：4 预设 + 自定义 | 📱 **手机手柄**：扫码连接，双人分屏 |

## 🚀 快速开始

```bash
npm install

# 纯键盘模式
npm run start:keyboard

# 键盘 + 手机手柄模式（WebSocket + 二维码 + 双人入口）
npm run start:gamepad
```

浏览器打开 <http://localhost:8080/>

> ⚠️ 不要直接双击 `index.html`，浏览器会阻止 `file://` 页面加载 ES Module。

## 🎮 操作

| 按键 | 功能 | 按键 | 功能 |
|:---:|:---|:---:|:---|
| `W` | 加速 | `D` | 制动 |
| `←` `→` | 转向 | `X` | 倒车 |
| `Space` | ERS 放电 | `P` | 请求 / 取消进站 |
| `1`–`5` | 选择进站轮胎 | `S` | P 房急停 |
| `Esc` | 暂停 | `R` | 结算后重启 |

## 🧰 技术栈

```text
浏览器原生 ES Modules
├── Canvas 2D         赛道、赛车、环境与 HUD
├── localStorage      成绩、生涯、设置（容错读写）
└── Node.js + ws      本地服务与可选手机手柄
```

零运行时依赖（除 `ws` 外）、零构建步骤、零外部前端库。

## 📜 权利声明

本项目与 Formula 1、FIA 或任何现实赛事、车队、车手、车辆制造商、赛道运营方**均无隶属、授权、赞助或背书关系**。所有车队、车号、涂装均为虚构内容。

## 📄 许可证

[MIT License](LICENSE) · 第三方代码与数据保留各自许可。

<div align="center">

**Made with Canvas, curiosity, and a little too much late braking.**

喜欢这个项目？欢迎 **Star ⭐、Fork 🍴 或分享给同样喜欢赛车的朋友。**

</div>

---

<div align="center">

<sub>📖 本文是 Mini Grand Prix 项目的开发复盘。如果你对 AI 协作开发、Canvas 渲染、游戏物理建模等话题感兴趣，欢迎在评论区交流。</sub>

<sub>👍 如果这篇文章对你有启发，**点赞 + 收藏 + 关注** 三连是对独立开发者最大的鼓励。</sub>

</div>
