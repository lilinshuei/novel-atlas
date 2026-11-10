/* ============================================================
   地图原语（浏览器端，零依赖）
   铁律：背景/路线/节点全部挂在同一个 <g data-root> 下，统一变换
   用法：NWMap.create({ el, geo, places, onPick }) → 返回 API
   ============================================================ */
(function (global) {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function clampState(st, W, H) {
    var z = st.z;
    if (z >= 1) {
      st.tx = Math.min(0, Math.max(W * (1 - z), st.tx));
      st.ty = Math.min(0, Math.max(H * (1 - z), st.ty));
    } else {
      /* 关键：z<1 必须居中，绝不能置 0（否则缩到左上角留大片空白） */
      st.tx = W * (1 - z) / 2;
      st.ty = H * (1 - z) / 2;
    }
  }

  function create(opt) {
    var W = opt.geo.W || 1000, H = opt.geo.H || 660;
    var nodes = opt.geo.nodes || {};
    var places = opt.places || [];
    var st = { z: 1, tx: 0, ty: 0, min: 0.6, max: 3.6 };
    var onPick = opt.onPick || function () {};

    var host = opt.el;
    host.classList.add('nw-mapbox');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'nw-mapsvg' });
    /* 所有图层都进这一个 root —— 缩放/飞入永不分离 */
    var root = el('g', { 'data-root': '1' });
    svg.appendChild(root);

    /* 背景层（也在 root 里） */
    root.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#nwBg)', rx: 18 }));
    var defs = el('defs');
    var grad = el('radialGradient', { id: 'nwBg', cx: '50%', cy: '45%', r: '70%' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#16233f' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#0a1020' }));
    defs.appendChild(grad);
    svg.insertBefore(defs, root);
    var grid = el('g', { opacity: '0.18' });
    for (var gx = 0; gx <= W; gx += 40) grid.appendChild(el('line', { x1: gx, y1: 0, x2: gx, y2: H, stroke: '#3a5583', 'stroke-width': 1 }));
    for (var gy = 0; gy <= H; gy += 40) grid.appendChild(el('line', { x1: 0, y1: gy, x2: W, y2: gy, stroke: '#3a5583', 'stroke-width': 1 }));
    root.appendChild(grid);

    var gLink = el('g', { class: 'nw-links' });
    var gNode = el('g', { class: 'nw-nodes' });
    root.appendChild(gLink);
    root.appendChild(gNode);

    var colors = ['#6eaaff', '#ff9f6e', '#8de0a5', '#ffd166', '#c792ea', '#f78fb3', '#4dd0e1', '#a3e635'];
    var groupIdx = {}, gi = 0;
    function colorOf(g) {
      if (!(g in groupIdx)) groupIdx[g] = gi++ % colors.length;
      return colors[groupIdx[g]];
    }

    var drawn = {};
    places.forEach(function (p) {
      var q = nodes[p.name];
      if (!q) return;
      drawn[p.name] = q;
      var c = colorOf(q.group || 'default');
      var big = (p.count || 0) > 0;
      var node = el('g', { class: 'nw-node', transform: 'translate(' + q.x + ',' + q.y + ')', style: 'cursor:pointer' });
      node.appendChild(el('circle', { r: big ? 9 : 6, fill: c, opacity: '0.22' }));
      node.appendChild(el('circle', { r: big ? 5 : 4, fill: c, stroke: '#0a1020', 'stroke-width': 1.4 }));
      var label = el('text', { x: 9, y: 4, 'font-size': 12, fill: '#dbe7ff', 'font-weight': 500 });
      label.textContent = p.name;
      node.appendChild(label);
      node.addEventListener('click', function (ev) {
        ev.stopPropagation();
        flyToPoint(q.x, q.y, Math.max(1.8, st.z));
        onPick(p, q);
      });
      gNode.appendChild(node);
    });

    /* 连线：按共现强度画 */
    (opt.links || []).forEach(function (L) {
      var a = drawn[L.a], b = drawn[L.b];
      if (!a || !b) return;
      gLink.appendChild(el('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: '#5b7fc7', 'stroke-width': Math.min(3, 0.6 + (L.w || 0) / 40), opacity: '0.28',
      }));
    });

    host.appendChild(svg);

    /* 小地图：fixed 左下，避开右下 FAB */
    var mm = document.createElement('div');
    mm.className = 'nw-minimap';
    var msvg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
    msvg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: 'rgba(18,28,52,.72)' }));
    Object.keys(drawn).forEach(function (k) {
      var q = drawn[k];
      msvg.appendChild(el('circle', { cx: q.x, cy: q.y, r: 13, fill: colorOf(q.group || 'default') }));
    });
    var mmRect = el('rect', { fill: 'rgba(255,210,120,.16)', stroke: '#ffd278', 'stroke-width': 8 });
    msvg.appendChild(mmRect);
    mm.appendChild(msvg);
    host.appendChild(mm);

    function updateMinimap() {
      var z = st.z, x0 = -st.tx / z, y0 = -st.ty / z;
      mmRect.setAttribute('x', Math.max(0, x0));
      mmRect.setAttribute('y', Math.max(0, y0));
      mmRect.setAttribute('width', Math.min(W - Math.max(0, x0), W / z));
      mmRect.setAttribute('height', Math.min(H - Math.max(0, y0), H / z));
    }

    function apply() {
      root.setAttribute('transform', 'translate(' + st.tx + ',' + st.ty + ') scale(' + st.z + ')');
      updateMinimap();
    }

    /* 光标锚点缩放：看哪放大哪 */
    host.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var rect = svg.getBoundingClientRect();
      var k = W / Math.max(1, rect.width);
      var ox = (ev.clientX - rect.left) * k;
      var oy = (ev.clientY - rect.top) * k;
      var old = st.z;
      var z = Math.min(st.max, Math.max(st.min, old * (ev.deltaY < 0 ? 1.14 : 1 / 1.14)));
      var f = z / old;
      st.tx = ox - (ox - st.tx) * f;
      st.ty = oy - (oy - st.ty) * f;
      st.z = z;
      clampState(st, W, H);
      apply();
    }, { passive: false });

    /* 拖拽平移（自己实现，不依赖父级） */
    var dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    host.addEventListener('mousedown', function (ev) {
      dragging = true; sx = ev.clientX; sy = ev.clientY; stx = st.tx; sty = st.ty;
      host.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', function (ev) {
      if (!dragging) return;
      st.tx = stx + (ev.clientX - sx);
      st.ty = sty + (ev.clientY - sy);
      clampState(st, W, H);
      apply();
    });
    window.addEventListener('mouseup', function () { dragging = false; host.style.cursor = ''; });

    var raf = null;
    function flyToPoint(x, y, zoom) {
      var z = Math.min(st.max, Math.max(st.min, zoom == null ? st.z : zoom));
      var txEnd = W / 2 - x * z, tyEnd = H / 2 - y * z;
      var sx0 = st.tx, sy0 = st.ty, sz0 = st.z;
      var t0 = performance.now(), dur = 560;
      if (raf) cancelAnimationFrame(raf);
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        st.z = sz0 + (z - sz0) * p;
        st.tx = sx0 + (txEnd - sx0) * p;
        st.ty = sy0 + (tyEnd - sy0) * p;
        clampState(st, W, H);
        apply();
        if (p < 1) raf = requestAnimationFrame(step);
      })(t0);
    }

    mm.addEventListener('click', function (ev) {
      var r = mm.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width * W;
      var y = (ev.clientY - r.top) / r.height * H;
      flyToPoint(x, y, st.z < 1.2 ? 1.4 : st.z);
    });

    function fit() { st.z = 1; st.tx = 0; st.ty = 0; apply(); }
    function focus(name) { var q = drawn[name]; if (q) flyToPoint(q.x, q.y, Math.max(1.7, st.z)); }
    function zoomBy(f) {
      var mid = { x: W / 2, y: H / 2 };
      var old = st.z;
      st.z = Math.min(st.max, Math.max(st.min, old * f));
      var k = st.z / old;
      st.tx = mid.x - (mid.x - st.tx) * k;
      st.ty = mid.y - (mid.y - st.ty) * k;
      clampState(st, W, H); apply();
    }
    apply();
    return { flyToPoint: flyToPoint, focus: focus, fit: fit, zoomBy: zoomBy, apply: apply, state: st };
  }

  global.NWMap = { create: create };
})(window);
