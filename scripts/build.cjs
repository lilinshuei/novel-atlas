#!/usr/bin/env node
'use strict';
/* ============================================================
   build：data/*.json + views/*.js + 主题 → 单文件离线 HTML（0 次模型调用）
   用法：
     node scripts/build.cjs --data data --out out/书名.html
     node scripts/build.cjs --data data --out out/x.html --only read,map,rel
   ============================================================ */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) {
      const k = s.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      a[k] = v;
    } else a._.push(s);
  }
  return a;
}
const A = parseArgs(process.argv.slice(2));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(A.data || 'data');
const OUT = path.resolve(A.out || path.join('out', 'novel-dashboard.html'));
const VIEWS_DIR = path.resolve(A.views || path.join(ROOT, 'views'));
const only = A.only ? String(A.only).split(',').map(s => s.trim()).filter(Boolean) : null;

if (!fs.existsSync(DATA)) { console.error('data 目录不存在: ' + DATA + '\n先跑 node scripts/extract.cjs'); process.exit(1); }

/* ---------- 1. 汇总 data ---------- */
const KEYS = ['meta', 'chapters', 'persons', 'events', 'rel', 'items', 'places', 'geo', 'love', 'density', 'config'];
const D = {};
for (const k of KEYS) {
  const p = path.join(DATA, k + '.json');
  if (fs.existsSync(p)) {
    try { D[k] = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error('解析失败 ' + k + '.json: ' + e.message); process.exit(1); }
  }
}
if (!D.meta) D.meta = {};
if (!D.chapters || !D.chapters.length) { console.error('chapters.json 为空，无法构建'); process.exit(1); }
D.config = D.config || {};

/* ---------- 2. 视图装配（按 config.views 顺序） ---------- */
let viewFiles = fs.readdirSync(VIEWS_DIR).filter(f => f.endsWith('.js'));
if (only) viewFiles = viewFiles.filter(f => only.indexOf(f.replace(/\.js$/, '')) >= 0);
const order = (D.config.views || []);
viewFiles.sort((a, b) => {
  const ia = order.indexOf(a.replace(/\.js$/, '')); const ib = order.indexOf(b.replace(/\.js$/, ''));
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
});
if (!viewFiles.length) { console.error('views 目录没有可用视图'); process.exit(1); }
const viewsCode = viewFiles.map(f =>
  '/* ---- view: ' + f + ' ---- */\n' + fs.readFileSync(path.join(VIEWS_DIR, f), 'utf8')
).join('\n');

/* ---------- 3. 读模板 ---------- */
const shell = fs.readFileSync(path.join(ROOT, 'templates', 'shell.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'templates', 'theme.css'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'templates', 'runtime.js'), 'utf8');
const mapcore = fs.readFileSync(path.join(ROOT, 'lib', 'map_core.js'), 'utf8');

/* ---- 数据序列化：转义 </ 防止脚本提前闭合，转义 U+2028/2029 ---- */
const json = JSON.stringify(D)
  .replace(/<\//g, '<\\/')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

/* ---- 单文件体积提示 ---- */
const mb = b => (b / 1024 / 1024).toFixed(2) + ' MB';

let html = shell
  .replace('{{CSS}}', () => css)
  .replace('{{DATA}}', () => json)
  .replace('{{MAPCORE}}', () => mapcore)
  .replace('{{RUNTIME}}', () => runtime)
  .replace('{{VIEWS}}', () => viewsCode)
  .replace(/\{\{BOOK_TITLE\}\}/g, () => (D.meta.title || '未命名书目').replace(/[<>&]/g, ''))
  .replace('{{BOOK_SUB}}', () => '离线单文件看板');

/* ---------- 4. 自校验（防止占位符残留） ---------- */
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
if (leftover) { console.error('模板占位符未替换完: ' + Array.from(new Set(leftover)).join(', ')); process.exit(1); }
for (const must of ['id="nwData"', 'nw-main', 'NW.use', 'nw-nav']) {
  if (html.indexOf(must) < 0) { console.error('产物缺少关键标记: ' + must); process.exit(1); }
}
/* 数据块可被 JSON.parse 的粗校验：截取 script 内容 */
const m = html.match(/<script id="nwData" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) { console.error('数据块注入失败'); process.exit(1); }
try { JSON.parse(m[1].replace(/<\\\//g, '</')); }
catch (e) { console.error('数据块不是合法 JSON: ' + e.message); process.exit(1); }

/* ---------- 5. 写出 ---------- */
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
const st = fs.statSync(OUT);
console.log(JSON.stringify({
  out: OUT,
  size: mb(st.size),
  chapters: D.chapters.length,
  views: viewFiles.map(f => f.replace(/\.js$/, '')),
  dataKeys: Object.keys(D).filter(k => D[k] != null),
}, null, 2));
