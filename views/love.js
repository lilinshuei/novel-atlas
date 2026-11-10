/* 视图：感情线 —— 泳道图（横轴章节，纵轴伴侣）+ 事件表 */
(function () {
  var NW = window.NW, esc = NW.esc;
  var SVG = 'http://www.w3.org/2000/svg';
  function mk(n, a) { var e = document.createElementNS(SVG, n); if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }

  NW.use({
    id: 'love', nav: '感情线', icon: '♥', requires: ['love'],
    build: function (root) {
      var D = NW.data;
      var evs = (D.love || []).slice().sort(function (a, b) { return a.ch - b.ch; });
      var partners = [];
      evs.forEach(function (e) { if (partners.indexOf(e.b) < 0) partners.push(e.b); });

      root.innerHTML =
        '<div class="nw-h2">感情线时间线<span class="nw-sub">金实心=正式（夫妻之实/成亲）· 空心彩点=非正式 · 点击跳章</span></div>' +
        '<div class="nw-card" style="padding:8px"><div class="nw-swim" id="nwSwim"></div></div>' +
        '<div class="nw-card nw-lovelist"><div class="nw-h2">事件明细</div>' +
        '<table class="nw-table"><thead><tr><th style="width:70px">章</th><th style="width:110px">对象</th><th style="width:80px">性质</th><th>上下文</th></tr></thead><tbody>' +
        evs.map(function (e) {
          return '<tr><td><span class="nw-chref" data-ch="' + e.ch + '">CH' + e.ch + '</span></td><td>' + esc(e.b || '-') + '</td><td>' +
            (e.formal ? '<span class="nw-tag ok">正式</span>' : '<span class="nw-tag">非正式</span>') + '</td><td>' + esc((e.ctx || e.what || '').slice(0, 90)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';

      var W = 980, laneH = 34, PL = 96, PR = 26, PT = 16, PB = 26;
      var H = PT + PB + Math.max(1, partners.length) * laneH;
      var chMax = (D.meta && D.meta.chapters) || Math.max.apply(null, evs.map(function (e) { return e.ch; }).concat([1]));
      var X = function (ch) { return PL + (W - PL - PR) * ((ch - 1) / Math.max(1, chMax - 1)); };
      var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H });
      svg.style.maxWidth = '100%';

      /* 章节刻度 */
      for (var t = 0; t <= 5; t++) {
        var chv = Math.round(1 + (chMax - 1) * t / 5);
        var x = X(chv);
        svg.appendChild(mk('line', { x1: x, y1: PT, x2: x, y2: H - PB, stroke: '#1e2d4a' }));
        var tx = mk('text', { x: x, y: H - 8, 'font-size': 10, fill: '#5d7aa6', 'text-anchor': 'middle' });
        tx.textContent = 'CH' + chv; svg.appendChild(tx);
      }

      partners.forEach(function (nm, i) {
        var y = PT + i * laneH + laneH / 2;
        svg.appendChild(mk('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: '#233c5c', 'stroke-width': 1 }));
        var lb = mk('text', { x: PL - 10, y: y + 4, 'font-size': 12, fill: '#cfe0fb', 'text-anchor': 'end' });
        lb.textContent = nm; svg.appendChild(lb);
        evs.filter(function (e) { return e.b === nm; }).forEach(function (e) {
          var cx = X(e.ch);
          var c = e.formal
            ? mk('path', { d: 'M' + cx + ',' + (y - 6) + ' L' + (cx + 6) + ',' + y + ' L' + cx + ',' + (y + 6) + ' L' + (cx - 6) + ',' + y + ' Z', fill: '#ffd166' })
            : mk('circle', { cx: cx, cy: y, r: 4.2, fill: '#f78fb3', opacity: 0.9 });
          var title = mk('title'); title.textContent = 'CH' + e.ch + ' ' + (e.formal ? '正式' : '非正式') + ' ' + (e.what || '');
          c.appendChild(title);
          c.style.cursor = 'pointer';
          c.addEventListener('click', function () { NW.api.jumpTo(e.ch); });
          svg.appendChild(c);
        });
      });
      root.querySelector('#nwSwim').appendChild(svg);

      Array.prototype.forEach.call(root.querySelectorAll('.nw-chref'), function (b) {
        b.addEventListener('click', function () { NW.api.jumpTo(Number(b.getAttribute('data-ch'))); });
      });
    },
  });
})();
