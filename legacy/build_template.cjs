/* ==================================================================
   注入式构建模板（通用）
   原则：源模板 SRC 只读；增强层拆成 _v2/*.js + _v2/*.css，用标记注入 OUT。
   每次注入幂等（if(!s.includes(marker))），跑完做自校验数组。
   核心文件一行都不动。
   ================================================================== */
const fs = require('fs');
const path = require('path');

const SRC = 'PATH/TO/source.html';                       // TODO: 编辑器生成的巨文件，只读
const OUT = 'PATH/TO/output-enhanced.html';              // TODO: 产出文件
const V2  = 'PATH/TO/_v2';                               // TODO: 增量目录
const read = p => fs.readFileSync(p, 'utf8');

let s = read(SRC);
const before = s.length;

/* ---- 1. CSS：拼到 </style> 前，用注释标记防重复注入 ---- */
const css = ['v2.css', 'v4.css', 'v5.css', 'v6.css']
  .map(f => read(path.join(V2, f))).join('\n');
if (!s.includes('/* ENHANCE LAYER */'))
  s = s.replace('</style>', () => css + '\n/* ENHANCE LAYER */\n</style>');

/* ---- 2. HTML 骨架：导航 + 新视图（用锚点幂等插入） ---- */
const navAnchor = '<button data-v="love"><i>♥</i>感情线</button>';
const navAdd = navAnchor + '\n    <button data-v="ranks"><i>♜</i>召唤者评级</button>';
if (!s.includes('data-v="ranks"')) {
  if (!s.includes('data-v="power"')) s = s.replace(navAnchor, () => navAdd);
  else s = s.replace('<button data-v="threads">',
    () => '<button data-v="threads">' + ranksNav);
}
const secAnchor = '  <section id="v-love" class="view">';
const secAdd = secAnchor + '\n  <section id="v-ranks" class="view"><div class="scroll"><div class="page" id="ranksWrap"></div></div></section>';
if (!s.includes('id="v-ranks"')) s = s.replace(secAnchor, () => secAdd);

/* ---- 3. JS：在 init() 之前插入增强层 ---- */
const files = ['v2_core.js', 'v2_map.js', 'v4_ranks.js', 'v5_map.js', 'v6_pc.js']; // TODO
const js = files.map(f => {
  const p = path.join(V2, f);
  if (!fs.existsSync(p)) throw new Error('缺少片段: ' + f);
  return '\n/* ===== ENHANCE · ' + f + ' ===== */\n' + read(p);
}).join('\n');
const marker = '/* ==================== 启动 ==================== */\ninit();';
if (!s.includes(marker)) throw new Error('找不到启动标记');
s = s.replace(marker, () => js + '\n\n' + marker);

/* ---- 4. 自校验：每个特性字符串必须出现，且导航/视图不重复 ---- */
const checks = [
  ['CSS 注入',    s.includes('/* ENHANCE LAYER */')],
  ['导航新项',    s.includes('data-v="ranks"')],
  ['视图新项',    s.includes('id="v-ranks"')],
  ['增强入口',    s.includes('function enhanceMapPC') || s.includes('v6PC')],
  ['导航不重复',  (s.match(/data-v="ranks"/g) || []).length === 1],
  ['视图不重复',  (s.match(/id="v-ranks"/g)     || []).length === 1],
];
checks.forEach(([k, v]) => console.log((v ? 'OK  ' : 'FAIL') + '  ' + k));
if (checks.some(c => !c[1])) throw new Error('注入校验失败');

fs.writeFileSync(OUT, s, 'utf8');
console.log('\n原始字节: ' + before + '  输出字节: ' + s.length + '\n输出: ' + OUT);
