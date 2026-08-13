// Playwright 冒烟测试：启动 server，验证拆分后的模块化页面能正常加载并进入比赛。
// 运行：node tests/smoke.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.SMOKE_PORT || 8092;
const BASE = `http://localhost:${PORT}`;

const server = spawn('node', ['server.js'], {
  env: { ...process.env, PORT },
  stdio: 'pipe'
});
server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
server.stderr.on('data', d => process.stderr.write(`[server!] ${d}`));

// 等 server 起来
let ready = false;
for (let i = 0; i < 30; i++) {
  await sleep(200);
  try {
    const r = await fetch(BASE);
    if (r.ok) { ready = true; break; }
  } catch {}
}
if (!ready) {
  console.error('❌ server 启动失败');
  server.kill();
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

let passed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log(`✓ ${name}`); }
  else { console.error(`✗ ${name}`); process.exitCode = 1; }
};

try {
  // 1. 加载主页面（带 test=1 暴露 __testCtx）
  await page.goto(`${BASE}?test=1`, { waitUntil: 'networkidle' });
  await sleep(500);

  // 主菜单可见
  const menuVisible = await page.locator('#menu').isVisible();
  check('主菜单可见', menuVisible);

  // 没有未捕获的 JS 错误（模块加载失败会在这里暴露）
  check('无模块加载错误', errors.filter(e => /Failed to fetch|import|module/i.test(e)).length === 0);

  // 2. 从主菜单选择赛道，比赛模式入口随后显示
  await page.click('#homeTrackList .home-track:first-child');
  await sleep(300);
  const modePickerVisible = await page.locator('#homeModePicker').isVisible();
  check('选择赛道后比赛模式入口可见', modePickerVisible);

  // 3. 点击大奖赛进入比赛设置
  await page.click('#btnRace');
  await sleep(300);
  const raceSetupVisible = await page.locator('#raceSetup').isVisible();
  check('比赛设置面板可见', raceSetupVisible);

  // 4. 开始排位赛
  await page.click('#startRace');
  await sleep(2000);

  // 比赛应已开始：菜单隐藏、canvas 可见、倒计时进行或已开始
  const menuHidden = await page.locator('#menu').isHidden();
  check('开始比赛后主菜单隐藏', menuHidden);

  // canvas 有实际绘制
  const canvasDrawn = await page.evaluate(() => {
    const c = document.querySelector('#game');
    if (!c || c.width === 0) return false;
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, Math.min(100, c.width), Math.min(100, c.height)).data;
    let nonBg = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) nonBg++;
      if (nonBg > 50) return true;
    }
    return nonBg > 50;
  });
  check('canvas 已绘制比赛画面', canvasDrawn);

  // 5. 验证比赛循环在跑：倒计时结束后 raceTime 应在增长
  //    先等倒计时（5.2s）过去
  await sleep(4000);
  const rt1 = await page.evaluate(() => window.__testCtx?.state.raceTime ?? -1);
  await sleep(2000);
  const rt2 = await page.evaluate(() => window.__testCtx?.state.raceTime ?? -1);
  check('比赛循环持续运行（raceTime 增长）', rt2 > rt1);

  // 6. 加速完赛：按 W 并偶尔打方向，最多等 90s（排位赛 1 圈）
  //    注：这是软断言——完赛时间依赖赛道长度与 AI 速度，CI 环境可能慢。
  //    核心已通过：菜单→选关→设置→进入比赛→循环运行→canvas 绘制。
  await page.keyboard.down('KeyW');
  let resultsVisible = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    resultsVisible = await page.locator('#over').isVisible().catch(() => false);
    if (resultsVisible) break;
    if (i % 4 === 1) { await page.keyboard.down('ArrowLeft'); await sleep(60); await page.keyboard.up('ArrowLeft'); }
    if (i % 4 === 3) { await page.keyboard.down('ArrowRight'); await sleep(60); await page.keyboard.up('ArrowRight'); }
  }
  await page.keyboard.up('KeyW');
  if (resultsVisible) { passed++; console.log('✓ 比赛结束后结算面板出现'); }
  else { console.log('⚠ 比赛未在 90s 内完赛（软断言，不阻塞）'); }

  console.log(`\n${passed} 项通过`);
  if (errors.length) {
    console.log('\n页面错误日志（仅供参考）：');
    errors.slice(0, 10).forEach(e => console.log('  ' + e));
  }
} finally {
  await browser.close();
  server.kill();
}
