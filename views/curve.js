/* 视图：成长曲线 —— 主要人物出场密度折线 + 事件标记 */
(function () {
  var NW = window.NW, esc = NW.esc;
  var SVG = 'http://www.w3.org/2000/svg';
  function mk(n, a) { var e = document.createElementNS(SVG, n); if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }

  NW.use({
    id: 'curve', nav: '成长曲线', icon: '📈', requires: ['density'],
    build: function (root) {
      var D = NW.data, den = D.density;
      root.innerHTML =
        '<div class="nw-h2">出场密度曲线<span class="nw-sub">窗口 ' + den.win + ' 章 · 纵轴为该窗出场次数</span></div>' +
        '<div class="nw-card" style="padding:10px"><svg class="nw-curve" id="nwCurveSvg"></svg>' +
        '<div class="nw-legend" id="nwCurveLegend"></div></div>' +
        '<div class="nw-card" style="margin-top:14px"><div class="nw-h2">突破/获得里程碑</div><div id="nwMileList" class="nw-scroll" style="max-height:280px"></div></div>';

      var W = 1100, H = 460, PL = 46, PR = 16, PT = 18, PB = 34;
      var svg = root.querySelector('#nwCurveSvg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var wins = den.windows || [];
      var n = wins.length || 1;
      var maxV = 1;
      wins.forEach(function (w) { Object.keys(w.cnt).forEach(function (k) { maxV = Math.max(maxV, w.cnt[k]); }); });
      var X = function (i) { return PL + (W - PL - PR) * (i / Math.max(1, n - 1)); };
      var Y = function (v) { return H - PB - (H - PT - PB) * (v / maxV); };

      /* 网格 */
      for (var g = 0; g <= 4; g++) {
        var gy = PT + (H - PT - PB) * g / 4;
        svg.appendChild(mk('line', { x1: PL, y1: gy, x2: W - PR, y2: gy, stroke: '#1e2d4a' }));
        var lb = mk('text', { x: PL - 8, y: gy + 4, 'font-size': 11, fill: '#5d7aa6', 'text-anchor': 'end' });
        lb.textContent = Math.round(maxV * (1 - g / 4));
        svg.appendChild(lb);
      }

      var colors = ['#6eaaff', '#ffd166', '#8de0a5', '#ff9f6e', '#c792ea', '#f78fb3', '#4dd0e1', '#a3e635'];
      (den.persons || []).slice(0, 6).forEach(function (name, k) {
        var pts = wins.map(function (w, i) { return [X(i), Y(w.cnt[name] || 0)]; });
        var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        svg.appendChild(mk('path', { d: d, fill: 'none', stroke: colors[k % colors.length], 'stroke-width': 2, opacity: 0.9 }));
        pts.forEach(function (p, i) {
          var c = mk('circle', { cx: p[0], cy: p[1], r: 2.6, fill: colors[k % colors.length] });
          var t = mk('title'); t.textContent = name + ' · 第' + wins[i].from + '-' + wins[i].to + '章 · ' + (wins[i].cnt[name] || 0) + ' 次';
          c.appendChild(t); svg.appendChild(c);
        });
      });

      /* 事件竖线：突破节点 */
      (D.events || []).filter(function (e) { return e.kind === 'breakthrough'; }).slice(0, 120).forEach(function (e) {
        var i = Math.min(n - 1, Math.floor((e.ch - 1) / den.win));
        var x = X(i);
        var line = mk('line', { x1: x, y1: PT, x2: x, y2: H - PB, stroke: '#ffd166', 'stroke-width': 1, opacity: 0.28 });
        var t = mk('title'); t.textContent = 'CH' + e.ch + ' ' + (e.who || '') + ' ' + (e.what || '');
        line.appendChild(t); svg.appendChild(line);
      });

      root.querySelector('#nwCurveLegend').innerHTML = (den.persons || []).slice(0, 6).map(function (nm, k) {
        return '<span><i style="background:' + colors[k % colors.length] + '"></i>' + esc(nm) + '</span>';
      }).join('') + '<span><i style="background:#ffd166;border-radius:0;width:2px"></i>突破节点</span>';

      var miles = (D.events || []).filter(function (e) { return e.kind === 'breakthrough' || e.kind === 'acquire'; });
      root.querySelector('#nwMileList').innerHTML = '<table class="nw-table"><thead><tr><th style="width:70px">章</th><th style="width:80px">类型</th><th style="width:110px">人物</th><th>内容</th></tr></thead><tbody>' +
        miles.slice(0, 300).map(function (e) {
          return '<tr><td><span class="nw-chref" data-ch="' + e.ch + '">CH' + e.ch + '</span></td><td>' + (e.kind === 'breakthrough' ? '突破' : '获得') + '</td><td>' + esc(e.who || '-') + '</td><td>' + esc((e.ctx || e.what || '').slice(0, 70)) + '</td></tr>';
        }).join('') + '</tbody></table>';
      Array.prototype.forEach.call(root.querySelectorAll('.nw-chref'), function (b) {
        b.addEventListener('click', function () { NW.api.jumpTo(Number(b.getAttribute('data-ch'))); });
      });
    },
  });
})();
