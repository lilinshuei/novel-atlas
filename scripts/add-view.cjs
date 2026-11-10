#!/usr/bin/env node
'use strict';
/* ============================================================
   add-view：生成一个视图插件骨架（改看板 = 加一个文件，0 次模型调用）
   用法：node scripts/add-view.cjs charts --nav "势力分布" --requires rel
   然后编辑 views/charts.js 的 build()，再跑 build 即可。
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
if (!A._[0]) {
  console.log('用法: node scripts/add-view.cjs <id> [--nav 显示名] [--icon 符号] [--requires a,b]');
  process.exit(1);
}
const id = String(A._[0]).replace(/[^a-z0-9_-]/gi, '');
const nav = A.nav || id;
const icon = A.icon || '◆';
const requires = String(A.requires || '').split(',').map(s => s.trim()).filter(Boolean);
const dir = path.resolve(__dirname, '..', 'views');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, id + '.js');
if (fs.existsSync(file)) { console.error('已存在: ' + file); process.exit(1); }

const tpl = `/* 视图：${nav} —— id=${id} */
(function () {
  var NW = window.NW, esc = NW.esc, fmt = NW.fmt;

  NW.use({
    id: '${id}', nav: '${nav}', icon: '${icon}',
    requires: ${JSON.stringify(requires)},
    build: function (root, D, api) {
      /* 这里写渲染逻辑；D 是全量数据对象，api.jumpTo(ch) 可跳阅读 */
      root.innerHTML =
        '<div class="nw-h2">${nav}<span class="nw-sub">自己改 views/${id}.js 即可</span></div>' +
        '<div class="nw-card">数据键：' + esc(Object.keys(D).join(', ')) + '</div>';
    },
  });
})();
`;
fs.writeFileSync(file, tpl, 'utf8');
console.log('已生成 ' + file);

/* 顺手把 id 追加进 data/config.json 的 views 顺序（若存在） */
const cfgPath = path.resolve('data', 'config.json');
if (fs.existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.views = cfg.views || [];
    if (cfg.views.indexOf(id) < 0) { cfg.views.push(id); fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1)); console.log('已登记到 data/config.json → views'); }
  } catch (e) { console.error('config.json 解析失败，跳过登记: ' + e.message); }
}
