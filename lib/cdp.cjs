'use strict';
/* ============================================================
   零依赖 CDP 客户端：启动 headless Edge/Chrome，用原始 WebSocket 帧通信
   （Node 无内置 ws，这里手写客户端帧：FIN=1、opcode=1、必须掩码）
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CANDIDATES = {
  win32: [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  linux: ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

function findBrowser() {
  const list = CANDIDATES[process.platform] || [];
  for (const p of list) if (fs.existsSync(p)) return p;
  return null;
}

function httpJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout: 2000 }, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/* 最小 WebSocket 文本帧客户端 */
class WS {
  constructor(url) {
    const u = new URL(url);
    this.host = u.hostname;
    this.port = Number(u.port || 80);
    this.pathname = u.pathname + (u.search || '');
    this.key = crypto.randomBytes(16).toString('base64');
    this.buf = Buffer.alloc(0);
    this.handlers = new Map();
    this.seq = 0;
    this.ready = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
    this._connect();
  }
  _connect() {
    this.sock = net.connect(this.port, this.host, () => {
      this.sock.write(
        `GET ${this.pathname} HTTP/1.1\r\n` +
        `Host: ${this.host}:${this.port}\r\n` +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${this.key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    this.sock.on('data', chunk => this._onData(chunk));
    this.sock.on('error', e => this._reject(e));
    this.sock.on('close', () => { if (this._reject) this._reject(new Error('socket closed')); });
  }
  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    if (!this.upgraded) {
      const i = this.buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      const head = this.buf.slice(0, i).toString();
      if (!/101/.test(head.split('\r\n')[0])) { this._reject(new Error('handshake failed: ' + head.split('\r\n')[0])); return; }
      this.upgraded = true;
      this.buf = this.buf.slice(i + 4);
      this._resolve(this);
    }
    this._drain();
  }
  _drain() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len).toString('utf8');
      this.buf = this.buf.slice(off + len);
      if (opcode === 1) this._onMessage(payload);
      else if (opcode === 8) { try { this.sock.end(); } catch (e) {} return; }
      else if (opcode === 9) this._frame(Buffer.alloc(0), 0xA);
    }
  }
  _onMessage(str) {
    let msg; try { msg = JSON.parse(str); } catch (e) { return; }
    if (msg.id && this.handlers.has(msg.id)) {
      const h = this.handlers.get(msg.id);
      this.handlers.delete(msg.id);
      h(msg);
    }
  }
  _frame(payload, opcode) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    const len = data.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = 0x80 | len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | (opcode == null ? 1 : opcode);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = data[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([head, mask, masked]));
  }
  send(method, params) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, resolve);
      this._frame(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.handlers.has(id)) { this.handlers.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 30000);
    });
  }
  close() { try { this.sock.destroy(); } catch (e) {} }
}

async function launch(opts) {
  opts = opts || {};
  const exe = opts.exe || findBrowser();
  if (!exe) throw new Error('未找到 Edge/Chrome，可用 --exe 指定浏览器路径');
  const port = opts.port || (9300 + (process.pid % 500));
  const profile = path.join(os.tmpdir(), 'nw-edge-' + port + '-' + Date.now());
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--allow-file-access-from-files',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*',
    '--user-data-dir=' + profile, '--window-size=' + (opts.width || 1440) + ',' + (opts.height || 900),
    'about:blank',
  ];
  const child = spawn(exe, args, { stdio: 'ignore', detached: false });
  /* 等端口就绪 */
  let page = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await httpJson(port, '/json');
      page = (list || []).find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  if (!page) { try { child.kill(); } catch (e) {} throw new Error('CDP 端口未就绪'); }
  const ws = new WS(page.webSocketDebuggerUrl);
  await ws.ready;
  await ws.send('Page.enable');
  await ws.send('Runtime.enable');
  return {
    ws, port, child,
    async goto(url) {
      await ws.send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 400));
    },
    async eval(expr) {
      const r = await ws.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) {
        return { ok: false, err: JSON.stringify(r.result.exceptionDetails).slice(0, 600) };
      }
      const res = r.result || {};
      return { ok: true, val: res.result ? res.result.value : undefined };
    },
    async close() {
      try { await ws.send('Browser.close'); } catch (e) {}
      ws.close();
      try { child.kill(); } catch (e) {}
    },
  };
}

module.exports = { launch, findBrowser };
