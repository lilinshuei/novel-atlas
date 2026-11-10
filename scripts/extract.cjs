#!/usr/bin/env node
'use strict';
/* ============================================================
   extract：把小说原文 → data/*.json（纯确定性统计，0 次模型调用）
   用法：
     node scripts/extract.cjs "书名.epub" --out data
     node scripts/extract.cjs "书名.txt" --out data --top 120 --min-count 6
   产出（全部可直接手改）：
     meta / chapters / persons / events / rel / items / places / geo / love / density
   ============================================================ */
const fs = require('fs');
const path = require('path');
const T = require('../lib/text.cjs');
const EPUB = require('../lib/epub.cjs');

/* ---------- 参数 ---------- */
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
if (!A._[0] || A.help) {
  console.log('\n用法: node scripts/extract.cjs <书.epub|书.txt|书.pdf> [--out data] [--top 120] [--min-count 6] [--win 25] [--force] [--quiet]\n');
  process.exit(A._[0] ? 0 : 1);
}
const SRC = A._[0];
const OUT = A.out || 'data';
const TOP = Number(A.top || 120);
const MINC = Number(A['min-count'] || 6);
const WIN = Number(A.win || 25);
const QUIET = !!A.quiet;
const log = (...x) => { if (!QUIET) console.error(...x); };

if (!fs.existsSync(SRC)) { console.error('源文件不存在: ' + SRC); process.exit(1); }

/* ---------- 0. 备份已有 data ---------- */
if (fs.existsSync(OUT) && fs.readdirSync(OUT).some(f => f.endsWith('.json'))) {
  if (!A.force) {
    const bak = path.join(OUT, '_backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(bak, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.copyFileSync(path.join(OUT, f), path.join(bak, f));
    log('已有 data 已备份到 ' + bak + '（手工改过的 items/places/geo 请从备份取回）');
  }
}
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 1. 读原文 ---------- */
log('[1/6] 读取源文件…');
const t0 = Date.now();
const { text, meta: srcMeta } = EPUB.load(SRC);
const plain = T.stripHtml(text);
log('      正文 ' + (plain.length / 1e4).toFixed(1) + ' 万字，耗时 ' + (Date.now() - t0) + 'ms');

/* ---------- 2. 切章 ---------- */
log('[2/6] 切分章节…');
let chapters = T.splitChapters(plain);
if (!chapters.length) { console.error('未切出任何章节，请检查文件编码或章节标题格式'); process.exit(1); }
chapters = chapters.map((c, i) => ({ i: i + 1, t: c.t, p: c.p }));
const words = chapters.reduce((s, c) => s + c.p.join('').length, 0);
log('      ' + chapters.length + ' 章 / ' + (words / 1e4).toFixed(1) + ' 万字');

/* ---------- 3. 人物候选 + 精确首末章 ---------- */
log('[3/6] 抽取人物候选…');
const cand = T.extractPersons(plain, { minCount: MINC, limit: TOP });
const nameList = cand.map(c => c.name);
const nameRe = new RegExp(
  nameList.slice().sort((a, b) => b.length - a.length)
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'
);
const stat = new Map(nameList.map(n => [n, { name: n, count: 0, first: 0, last: 0 }]));
chapters.forEach(ch => {
  const body = ch.p.join('\n');
  nameRe.lastIndex = 0;
  let m;
  const seen = new Set();
  while ((m = nameRe.exec(body))) {
    const r = stat.get(m[0]);
    if (!r) continue;
    r.count++;
    if (!r.first) r.first = ch.i;
    r.last = ch.i;
    seen.add(m[0]);
  }
});
const persons = Array.from(stat.values())
  .filter(p => p.count >= MINC)
  .sort((a, b) => b.count - a.count);

/* ---------- 4. 事件 / 关系 / 密度 ---------- */
log('[4/6] 锚定事件与关系…');
const events = T.extractEvents(text, chapters, persons).slice(0, 4000);

/* 关系边：加上共现首末章 */
const rel = T.buildRelations(chapters, persons, { minWeight: 3, top: 120 }).slice(0, 600);
const density = T.buildDensity(chapters, persons, WIN);

/* ---------- 5. 器物 / 地点 / 感情线 ---------- */
log('[5/6] 抽取器物、地点、感情线…');

/* 通用：在名字附近 ±WIN 字内找最近的人物名，判归属 */
function nearestPerson(fullText, name) {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const votes = Object.create(null);
  let m, n = 0;
  while ((m = re.exec(fullText)) && n < 60) {
    n++;
    const win = fullText.slice(Math.max(0, m.index - 70), Math.min(fullText.length, m.index + name.length + 70));
    nameRe.lastIndex = 0;
    let q;
    while ((q = nameRe.exec(win))) {
      if (q[0] !== name) votes[q[0]] = (votes[q[0]] || 0) + 1;
    }
  }
  const best = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
  return best && votes[best] >= 2 ? best : '';
}
function firstLastCh(name) {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let first = 0, last = 0;
  for (const ch of chapters) {
    re.lastIndex = 0;
    if (re.test(ch.p.join(''))) { if (!first) first = ch.i; last = ch.i; }
    if (first && ch.i - last > 400) break;
  }
  return { first, last };
}

const ITEM_TYPE = [
  [/剑|刀|枪|杖|斧|锤|鞭|弓|盾|扇|轮|矛|戟|匕|爪$/, 'weapon'],
  [/袍|甲|衣|靴|冠|镯|戒|面具|披风/, 'treasure'],
  [/兽|狼|虎|蛇|龙|凤|鹰|豹|蛛|蚁|鼠|狮|蝎|蛟|鲲|麒麟|猿|妖|魔兽|战兽|灵兽/, 'beast'],
];
const rawItems = T.extractBySuffix(plain, T.ITEM_SUF.concat(T.BEAST_SUF), { minCount: 2, limit: 160 });
const items = rawItems.map(it => {
  let type = 'other';
  for (const [re, ty] of ITEM_TYPE) if (re.test(it.name)) { type = ty; break; }
  const fl = firstLastCh(it.name);
  return { name: it.name, type, count: it.count, owner: nearestPerson(plain, it.name), first: fl.first, last: fl.last, draft: true };
});

const rawPlaces = T.extractBySuffix(plain, T.PLACE_SUF, { minCount: 3, limit: 120 });
const places = rawPlaces.map(p => {
  const fl = firstLastCh(p.name);
  return { name: p.name, group: 'default', count: p.count, first: fl.first, last: fl.last, draft: true };
});

/* 感情线：事件层 love 类，配最近的另一个人名 */
const love = [];
{
  const seen = new Set();
  for (const e of events) {
    if (e.kind !== 'love') continue;
    const re = new RegExp('(' + nameList.slice(0, 120).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
    const found = [];
    let m;
    while ((m = re.exec(e.ctx || ''))) if (found.indexOf(m[1]) < 0) found.push(m[1]);
    const b = found.filter(x => x !== e.who)[0] || found[0] || '';
    const key = e.ch + '|' + b;
    if (seen.has(key)) continue;
    seen.add(key);
    const formal = /(行房|云雨|双修|同房|初夜|成亲|大婚|洞房|肌肤相亲)/.test(e.ctx || '');
    love.push({ ch: e.ch, a: e.who || '', b, formal, what: e.what, ctx: (e.ctx || '').slice(0, 80), draft: true });
  }
}

/* ---------- 6. 地理布局 ---------- */
const geoPlaces = places.slice(0, 60);
const geo = T.autoGeo(geoPlaces, 1000, 660);

/* ---------- 写出 ---------- */
const write = (name, obj) => {
  const p = path.join(OUT, name + '.json');
  fs.writeFileSync(p, JSON.stringify(obj, null, 1));
  return p;
};
write('meta', {
  title: (srcMeta && srcMeta.title) || path.basename(SRC, path.extname(SRC)),
  author: (srcMeta && srcMeta.author) || '',
  source: path.basename(SRC),
  sourceType: (srcMeta && srcMeta.sourceType) || '',
  chapters: chapters.length,
  words,
  extractedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  note: 'persons/events/rel/density 由统计确定性生成；items/places/love 为草稿(draft:true)，建议人工核对 owner 与 type',
});
write('chapters', chapters);
write('persons', persons.map(p => ({ name: p.name, count: p.count, first: p.first, last: p.last })));
write('events', events);
write('rel', rel);
write('items', items);
write('places', places);
write('geo', geo);
write('love', love);
write('density', density);

log('[6/6] 完成 → ' + path.resolve(OUT));
if (!QUIET) {
  console.log(JSON.stringify({
    chapters: chapters.length,
    words,
    persons: persons.length,
    events: events.length,
    rel: rel.length,
    items: items.length,
    places: places.length,
    love: love.length,
    out: path.resolve(OUT),
  }, null, 2));
}
