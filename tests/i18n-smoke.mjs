// i18n 冒烟测试：验证中英文切换、英文版无中文残留、中文版无英文残留。
// 运行：node tests/i18n-smoke.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.I18N_PORT || 8093;
const BASE = `http://localhost:${PORT}`;

const server = spawn('node', ['server.js'], {
  env: { ...process.env, PORT },
  stdio: 'pipe'
});
server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
server.stderr.on('data', d => process.stderr.write(`[server!] ${d}`));

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
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));
page.on('console', msg => { if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`); });

let passed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log(`✓ ${name}`); }
  else { console.error(`✗ ${name}`); process.exitCode = 1; }
};

const hasCJK = s => /[一-鿿]/.test(s || '');
// 语言切换按钮自身始终含“中文 / English”，不参与内容纯语言校验
const menuText = () => page.evaluate(() => {
  const menu = document.querySelector('#menu').cloneNode(true);
  menu.querySelector('.lang-toggle')?.remove();
  return menu.innerText || '';
});
const activeLang = () => page.evaluate(() => document.querySelector('#btnLang .lang-opt.active')?.dataset.lang ?? null);

try {
  await page.goto(`${BASE}?test=1`, { waitUntil: 'networkidle' });
  await sleep(500);

  // ===== 初始：英文 =====
  check('默认语言英文（html lang=en）', await page.evaluate(() => document.documentElement.lang) === 'en');
  check('默认英文时 English 段激活', await activeLang() === 'en');
  const btnText = await page.locator('#btnLang').textContent();
  check('按钮含中文/English 两个选项', btnText.includes('中文') && /English/.test(btnText));
  check('英文模式主菜单无中文残留', !hasCJK(await menuText()));
  const enTrackName = await page.locator('#homeTrackList .home-track .name').first().textContent();
  check('英文模式赛道名显示英文', !hasCJK(enTrackName));

  // ===== 切换为中文 =====
  await page.click('#btnLang');
  await sleep(300);
  check('点击后 html lang=zh-CN', await page.evaluate(() => document.documentElement.lang) === 'zh-CN');
  check('切中文后「中文」段激活', await activeLang() === 'zh');
  check('中文模式主菜单显示中文', hasCJK(await menuText()));
  const zhHomeBrand = await page.evaluate(() => document.querySelector('.home-brand').innerText);
  check('中文模式品牌区无英文副标题', !/MINI GRAND PRIX|WORLD GRAND PRIX/i.test(zhHomeBrand));
  const zhTrackName = await page.locator('#homeTrackList .home-track .name').first().textContent();
  check('中文模式赛道名显示中文', hasCJK(zhTrackName));

  // 选择一条赛道 → 模式入口与位置文字均为中文
  await page.click('#homeTrackList .home-track:first-child');
  await sleep(300);
  const zhModePicker = await page.evaluate(() => document.querySelector('#homeModePicker').innerText);
  check('中文模式比赛模式入口为中文', hasCJK(zhModePicker));
  const zhLocation = await page.evaluate(() => document.querySelector('#globeLocation').innerText);
  check('中文模式位置文字含中文赛道名', hasCJK(zhLocation));

  // ===== 切回英文 =====
  await page.click('#btnLang');
  await sleep(300);
  check('切回英文 html lang=en', await page.evaluate(() => document.documentElement.lang) === 'en');
  check('切回英文后 English 段激活', await activeLang() === 'en');
  check('切回英文后主菜单无中文', !hasCJK(await menuText()));
  const enTrackName2 = await page.locator('#homeTrackList .home-track .name').first().textContent();
  check('切回英文后赛道名恢复英文', !hasCJK(enTrackName2));
  const enLocation = await page.evaluate(() => document.querySelector('#globeLocation').innerText);
  check('切回英文后位置文字恢复英文', !hasCJK(enLocation));

  // 切换过程不应有 JS 错误
  check('切换过程无 JS 错误', errors.length === 0);

  console.log(`\n${passed} 项通过`);
  if (errors.length) {
    console.log('\n页面错误日志：');
    errors.slice(0, 10).forEach(e => console.log('  ' + e));
  }
} finally {
  await browser.close();
  server.kill();
}
