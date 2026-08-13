// server.js — 静态文件托管 + WebSocket 信令
// 用法：node server.js
// 电脑连上手机热点后跑这个，手机浏览器访问 http://<电脑IP>:8080/
// 默认端口 8080，可用 PORT 环境变量覆盖。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'node:os';
import { generateQR } from './scripts/qr-svg.js';
import { parseInputMode, renderInputMode, supportsGamepad } from './src/config/input-mode.js';

const PORT = Number(process.env.PORT) || 8080;
const ROOT = process.cwd();
const inputMode = parseInputMode(process.argv.slice(2));
const gamepadEnabled = supportsGamepad(inputMode);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.map': 'application/json'
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (!gamepadEnabled && ['/gamepad.html', '/qr', '/ips'].includes(urlPath)) {
    res.writeHead(404); res.end('Gamepad mode is disabled'); return;
  }
  // QR 接口：/qr?text=xxx 返回 SVG
  if (urlPath === '/qr') {
    const text = new URL(req.url, `http://${req.headers.host}`).searchParams.get('text') || '';
    const svg = generateQR(text);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(svg);
    return;
  }
  // 本机所有局域网 IP 接口：供前端展示热点形式地址 http://IP:port/... (Pn, 网卡名)
  if (urlPath === '/ips') {
    const ips = getLocalIPs();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ port: PORT, ips, urls: getControllerUrls(ips) }));
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  // 防目录穿越
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    if (urlPath === '/index.html') {
      data = Buffer.from(renderInputMode(data.toString('utf8'), inputMode));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = gamepadEnabled ? new WebSocketServer({ server, path: '/ws' }) : null;

// 玩家手柄注册：{role:'register', player:'p1'} → 后续输入消息带 player 字段
const players = new Map(); // ws -> {player}

wss?.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.role === 'register') {
      const player = msg.player === 'p2' ? 'p2' : 'p1';
      players.set(ws, { player });
      // 广播连接状态
      broadcast({ type: 'connection', player, connected: true });
      ws.send(JSON.stringify({ type: 'registered', player }));
      return;
    }
    if (msg.role === 'input') {
      // 转发给主机（index.html 也连 /ws，role:'host'）
      const reg = players.get(ws);
      const player = reg?.player || msg.player || 'p1';
      broadcast({ type: 'input', player, key: msg.key, pressed: !!msg.pressed }, ws);
      return;
    }
    if (msg.role === 'pit') {
      const reg = players.get(ws);
      const player = reg?.player || msg.player || 'p1';
      broadcast({ type: 'pit', player, requested: !!msg.requested }, ws);
      return;
    }
    if (msg.role === 'pitTyre') {
      const reg = players.get(ws);
      const player = reg?.player || msg.player || 'p1';
      broadcast({ type: 'pitTyre', player, tyre: msg.tyre }, ws);
      return;
    }
    if (msg.role === 'state') {
      // host → 对应 player 的手柄（不广播给 host 自己或其他手柄）
      const targetPlayer = msg.player;
      const out = JSON.stringify({ type: 'state', ...msg });
      let sent = 0;
      for (const [client, reg] of players) {
        if (reg.player === targetPlayer && client !== ws && client.readyState === 1) {
          client.send(out);
          sent++;
        }
      }
      if (process.env.DEBUG_WS) console.log('[state]', targetPlayer, 'speed=', msg.speed, '→', sent);
      return;
    }
    if (msg.role === 'host') {
      players.set(ws, { player: 'host' });
      // 把当前所有已连接玩家状态同步给 host，避免错过早期的 register 广播
      const connected = new Set();
      for (const [, reg] of players) {
        if (reg.player !== 'host') connected.add(reg.player);
      }
      for (const player of connected) {
        ws.send(JSON.stringify({ type: 'connection', player, connected: true }));
      }
      return;
    }
    if (msg.role === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });
  ws.on('close', () => {
    const reg = players.get(ws);
    if (reg && reg.player !== 'host') {
      broadcast({ type: 'connection', player: reg.player, connected: false });
    }
    players.delete(ws);
  });
});

function broadcast(obj, except) {
  const data = JSON.stringify(obj);
  for (const client of wss?.clients || []) {
    if (client.readyState !== 1) continue;
    if (except && client === except) continue;
    client.send(data);
  }
}

function getLocalIPs() {
  const result = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // 跳过链路本地地址（169.254.x.x）—— 别人访问不到，只会误导
      if (net.address.startsWith('169.254.')) continue;
      result.push({ name, address: net.address });
    }
  }
  // 把常见的热点/局域网段（192.168 / 10. / 172.16-31）排在前面
  const rank = ip => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 3;
  };
  result.sort((a, b) => rank(a.address) - rank(b.address));
  return result;
}

function getControllerUrls(ips = getLocalIPs()) {
  return ips.map(ip => ({
    name: ip.name,
    address: ip.address,
    p1: `http://${ip.address}:${PORT}/gamepad.html?p=1`,
    p2: `http://${ip.address}:${PORT}/gamepad.html?p=2`
  }));
}

function printControllerAddresses(urls = getControllerUrls()) {
  if (!urls.length) {
    console.log(`    （未检测到可用的局域网 IPv4 地址，请检查网络连接）`);
    return;
  }
  for (const item of urls) {
    console.log(`    ${item.p1}  (P1, ${item.name})`);
    console.log(`    ${item.p2}  (P2, ${item.name})`);
  }
}

let controllerAddressSignature = '';
function refreshControllerAddresses({ announce = false } = {}) {
  if (!gamepadEnabled) return;
  const urls = getControllerUrls();
  const signature = urls.map(item => `${item.name}:${item.address}`).join('|');
  if (!announce && signature === controllerAddressSignature) return;
  if (!announce) console.log(`\n  检测到网络地址变化，手机手柄新地址：`);
  controllerAddressSignature = signature;
  printControllerAddresses(urls);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Mini Grand Prix 服务已启动`);
  console.log(`  输入模式: ${gamepadEnabled ? '键盘 + 手机手柄' : '纯键盘'}`);
  console.log(`  本机: http://localhost:${PORT}`);
  if (!gamepadEnabled) {
    console.log(`  手机手柄、二维码和 WebSocket 服务未启用\n`);
    return;
  }
  console.log(`  手机热点场景下，手机扫码或访问以下任一地址：`);
  refreshControllerAddresses({ announce: true });
  console.log(`\n  WebSocket 信令路径: ws://<IP>:${PORT}/ws\n`);
});

// 手机热点重连后 DHCP 地址可能变化；服务运行期间自动发现并打印新链接。
const addressWatcher = setInterval(refreshControllerAddresses, 3000);
addressWatcher.unref();
