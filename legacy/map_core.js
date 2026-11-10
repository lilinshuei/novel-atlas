/* ==================================================================
   可复用地图原语（通用）
   依赖全局：V2MAP={W,H}、V2S={mapZoom,mapTx,mapTy}、V2C(配色)、PLACES、V2D.GEO
   用法：把下面函数抄进你的 vX_pc.js / v2_map.js，按需改 id 与配色。
   铁律：背景/路线/节点全部挂在同一个 #v2MapRoot 下，由 v2MapTransform 统一变换。
   ================================================================== */

/* 1) 变换应用：把 translate/scale 写到 root（背景与前景同一组，永远同步） */
function v2MapTransform() {
  const g = document.getElementById('v2MapRoot');
  if (g) g.setAttribute('transform', 'translate(' + V2S.mapTx + ',' + V2S.mapTy + ') scale(' + V2S.mapZoom + ')');
}

/* 2) 边界约束：z>=1 贴边夹取；z<1 居中（绝不置 0，否则缩到角落留白） */
function clampMap() {
  const w = V2MAP.W, h = V2MAP.H, z = V2S.mapZoom;
  if (z >= 1) {
    V2S.mapTx = Math.min(0, Math.max(w * (1 - z), V2S.mapTx));
    V2S.mapTy = Math.min(0, Math.max(h * (1 - z), V2S.mapTy));
  } else {
    V2S.mapTx = w * (1 - z) / 2;
    V2S.mapTy = h * (1 - z) / 2;
  }
}

/* 3) 光标锚点滚轮缩放（看哪放大哪）：最小锁 100%（铺满），最大随你定 */
function bindAnchorWheel(box) {
  box.parentNode.addEventListener('wheel', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const live = box.querySelector('svg'), rect = live.getBoundingClientRect();
    const k = V2MAP.W / Math.max(1, rect.width);
    const ox = (ev.clientX - rect.left) * k, oy = (ev.clientY - rect.top) * k;
    const old = V2S.mapZoom;
    const z = Math.min(3.4, Math.max(1, old * (ev.deltaY < 0 ? 1.13 : 1 / 1.13))); // 最小 1
    const f = z / old;
    V2S.mapTx = ox - (ox - V2S.mapTx) * f;
    V2S.mapTy = oy - (oy - V2S.mapTy) * f;
    V2S.mapZoom = z;
    clampMap(); v2MapTransform();
  }, true);
}

/* 4) 禁拖拽但保留缩放：父级捕获阶段拦截 mousedown，原拖拽监听失效（不拦 wheel） */
function disableDragKeepZoom(box) {
  if (box._bound) return; box._bound = 1;
  box.parentNode.addEventListener('mousedown', e => e.stopPropagation(), true);
}

/* 5) 飞入居中：rAF 缓动，平面下坐标即准确 */
let _flyRAF = null;
function flyToPoint(x, y, zoom) {
  const z = Math.min(4, Math.max(1, zoom == null ? V2S.mapZoom : zoom));
  const txEnd = V2MAP.W / 2 - x * z, tyEnd = V2MAP.H / 2 - y * z;
  const sx = V2S.mapTx, sy = V2S.mapTy, sz = V2S.mapZoom;
  const t0 = performance.now(), dur = 560;
  if (_flyRAF) cancelAnimationFrame(_flyRAF);
  const step = now => {
    let p = Math.min(1, (now - t0) / dur);
    p = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
    V2S.mapZoom = sz + (z - sz) * p;
    V2S.mapTx = sx + (txEnd - sx) * p;
    V2S.mapTy = sy + (tyEnd - sy) * p;
    clampMap(); v2MapTransform();
    if (p < 1) _flyRAF = requestAnimationFrame(step);
  };
  _flyRAF = requestAnimationFrame(step);
}
function flyTo(name, zoom) {
  const q = (V2D.GEO || {})[name]; if (!q) return;
  flyToPoint(q.x, q.y, zoom == null ? (V2S.mapZoom < 1.5 ? 1.6 : V2S.mapZoom) : zoom);
}

/* 6) 小地图：fixed 左下，点哪跳哪；视口框随缩放/平移刷新 */
function buildMinimap(box) {
  if (box.querySelector('.v6-minimap')) return;
  const mm = document.createElement('div'); mm.className = 'v6-minimap';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + V2MAP.W + ' ' + V2MAP.H);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', V2MAP.W); bg.setAttribute('height', V2MAP.H);
  bg.setAttribute('fill', 'rgba(18,28,52,.6)'); svg.appendChild(bg);
  (PLACES || []).forEach(p => {
    const q = (V2D.GEO || {})[p.name]; if (!q) return;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); c.setAttribute('r', 13); // 缩略图里放大才看得清
    c.setAttribute('fill', ((V2D.REGION_COLOR || {})[p.group]) || '#6eaaff'); svg.appendChild(c);
  });
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('id', 'v6MmRect'); rect.setAttribute('fill', 'rgba(255,210,120,.18)');
  rect.setAttribute('stroke', '#ffd278'); rect.setAttribute('stroke-width', 8); svg.appendChild(rect);
  mm.appendChild(svg); box.appendChild(mm);
  mm.addEventListener('click', ev => {
    const r = mm.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * V2MAP.W;
    const y = (ev.clientY - r.top) / r.height * V2MAP.H;
    flyToPoint(x, y, V2S.mapZoom < 1.2 ? 1.4 : V2S.mapZoom);
  });
  box._v6mmRect = rect;
}
function updateMinimap() {
  const box = document.querySelector('#v2MapBox'); if (!box || !box._v6mmRect) return;
  const z = V2S.mapZoom, x0 = -V2S.mapTx / z, y0 = -V2S.mapTy / z, rect = box._v6mmRect;
  rect.setAttribute('x', Math.max(0, x0)); rect.setAttribute('y', Math.max(0, y0));
  rect.setAttribute('width', Math.min(V2MAP.W - Math.max(0, x0), V2MAP.W / z));
  rect.setAttribute('height', Math.min(V2MAP.H - Math.max(0, y0), V2MAP.H / z));
}

/* 7) 包装 v2MapTransform：每次缩放/平移后刷新约束 + 小地图 */
(function wrapTransform() {
  const OLD = v2MapTransform;
  v2MapTransform = function () { OLD(); clampMap(); updateMinimap(); };
})();
