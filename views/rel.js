/* 视图：人物关系 —— 力导向图（自实现，无依赖）+ 焦点关系面板 */
(function () {
  var NW = window.NW, esc = NW.esc;
  var SVG = 'http://www.w3.org/2000/svg';
  function mk(n, a) { var e = document.createElementNS(SVG, n); if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }

  NW.use({
    id: 'rel', nav: '人物关系', icon: '🕸', requires: ['rel'],
    build: function (root) {
      root.innerHTML =
        '<div class="nw-relwrap">' +
        '  <div><div class="nw-h2">关系网络<span class="nw-sub">拖动节点可调 · 点击查看该人物关系</span></div>' +
        '    <div class="nw-card" style="padding:0;overflow:hidden"><svg class="nw-relsvg" id="nwRelSvg"></svg></div>' +
        '  </div>' +
        '  <div class="nw-card nw-relpanel" id="nwRelPanel"><div class="nw-h2">选中人物</div><div style="color:var(--txt3);font-size:13px">点击左侧任意节点查看</div></div>' +
        '</div>';

      var links = (NW.data.rel || []).slice(0, 300);
      var deg = {}, nameSet = {};
      links.forEach(function (L) { deg[L.a] = (deg[L.a] || 0) + L.w; deg[L.b] = (deg[L.b] || 0) + L.w; nameSet[L.a] = 1; nameSet[L.b] = 1; });
      var names = Object.keys(deg).sort(function (a, b) { return deg[b] - deg[a]; }).slice(0, 60);
      var pos = {};
      var W = 900, H = 640;
      var cx = W / 2, cy = H / 2;
      names.forEach(function (n, i) {
        var r = 60 + 240 * Math.sqrt(i / Math.max(1, names.length));
        var th = i * 2.399963;
        pos[n] = { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r, vx: 0, vy: 0, d: deg[n] };
      });
      var E = links.filter(function (L) { return pos[L.a] && pos[L.b]; });

      /* 力导向迭代（一次性布局，避免每次交互重算） */
      for (var it = 0; it < 260; it++) {
        var alpha = 1 - it / 260;
        for (var i = 0; i < names.length; i++) {
          for (var j = i + 1; j < names.length; j++) {
            var A = pos[names[i]], B = pos[names[j]];
            var dx = B.x - A.x, dy = B.y - A.y;
            var d2 = dx * dx + dy * dy || 1;
            var f = 4200 / d2 * alpha;
            var d = Math.sqrt(d2);
            A.x -= dx / d * f; A.y -= dy / d * f;
            B.x += dx / d * f; B.y += dy / d * f;
          }
        }
        E.forEach(function (L) {
          var A = pos[L.a], B = pos[L.b];
          var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          var target = 120, f = (d - target) / d * 0.055 * alpha;
          A.x += dx * f; A.y += dy * f; B.x -= dx * f; B.y -= dy * f;
        });
        names.forEach(function (n) {
          var p = pos[n];
          p.x += (cx - p.x) * 0.004 * alpha; p.y += (cy - p.y) * 0.004 * alpha;
          p.x = Math.max(60, Math.min(W - 60, p.x)); p.y = Math.max(40, Math.min(H - 40, p.y));
        });
      }

      var svg = root.querySelector('#nwRelSvg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var gL = mk('g'), gN = mk('g');
      svg.appendChild(gL); svg.appendChild(gN);

      var maxW = Math.max.apply(null, E.map(function (x) { return x.w; }));
      E.forEach(function (L) {
        var A = pos[L.a], B = pos[L.b];
        L._line = mk('line', {
          x1: A.x, y1: A.y, x2: B.x, y2: B.y,
          stroke: '#4f74b8', 'stroke-width': 0.5 + 3 * (L.w / maxW), opacity: 0.18 + 0.42 * (L.w / maxW),
        });
        gL.appendChild(L._line);
      });

      function panel(name) {
        var rs = (NW.data.rel || []).filter(function (L) { return L.a === name || L.b === name; })
          .sort(function (a, b) { return b.w - a.w; }).slice(0, 22);
        var html = ['<div class="nw-h2">' + esc(name) + '<span class="nw-sub">出场权重 ' + Math.round(deg[name]) + '</span></div>'];
        if (!rs.length) html.push('<div style="color:var(--txt3)">暂无共现关系</div>');
        rs.forEach(function (L) {
          var other = L.a === name ? L.b : L.a;
          html.push('<div class="nw-relrow"><b>' + esc(other) + '</b><span class="nw-tag">共现 ' + L.w + '</span></div>');
        });
        var its = (NW.data.items || []).filter(function (it) { return it.owner === name; });
        if (its.length) {
          html.push('<div class="nw-h2" style="margin-top:14px">关联器物</div>');
          its.forEach(function (it) { html.push('<div class="nw-relrow"><b>' + esc(it.name) + '</b><span class="nw-tag">' + esc(it.type || '') + '</span></div>'); });
        }
        root.querySelector('#nwRelPanel').innerHTML = html.join('');
      }

      names.forEach(function (n) {
        var p = pos[n];
        var g = mk('g', { transform: 'translate(' + p.x + ',' + p.y + ')', style: 'cursor:pointer', 'data-n': n });
        var r = 5 + Math.min(9, Math.sqrt(deg[n]) / 3);
        g.appendChild(mk('circle', { r: r + 6, fill: '#6eaaff', opacity: 0.12 }));
        g.appendChild(mk('circle', { r: r, fill: '#6eaaff', stroke: '#0a1020', 'stroke-width': 1.4 }));
        var t = mk('text', { x: r + 5, y: 4, 'font-size': 12, fill: '#cfe0fb' });
        t.textContent = n;
        g.appendChild(t);
        g.addEventListener('click', function () {
          panel(n);
          Array.prototype.forEach.call(gN.children, function (x) { x.style.opacity = 0.4; });
          g.style.opacity = 1;
          E.forEach(function (L) {
            var on = L.a === n || L.b === n;
            L._line.setAttribute('opacity', on ? 0.95 : 0.05);
            L._line.setAttribute('stroke', on ? '#8fc2ff' : '#4f74b8');
          });
        });
        gN.appendChild(g);
      });
    },
  });
})();
