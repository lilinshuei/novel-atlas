/* 视图：总览 —— 书目信息 + 数据体检 + 人物榜 + 视图入口（无 requires，永远可用） */
(function () {
  var NW = window.NW, esc = NW.esc, fmt = NW.fmt;

  NW.use({
    id: 'overview', nav: '总览', icon: '◎', requires: [],
    build: function (root) {
      var D = NW.data, m = D.meta || {};
      var persons = (D.persons || []).slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
      var stat = [
        ['章节', m.chapters != null ? m.chapters + ' 章' : '—'],
        ['总字数', m.words != null ? fmt(m.words) + ' 字' : '—'],
        ['人物', (D.persons || []).length + ' 个'],
        ['事件', (D.events || []).length + ' 个'],
        ['关系边', (D.rel || []).length + ' 条'],
        ['器物', (D.items || []).length + ' 条'],
        ['地点', (D.places || []).length + ' 处'],
        ['感情线', (D.love || []).length + ' 条'],
      ];
      var ok = function (b, yes, no) { return '<span class="nw-tag ' + (b ? 'ok' : 'warn') + '">' + (b ? yes : no) + '</span>'; };

      root.innerHTML =
        '<div class="nw-card" style="margin-bottom:14px">' +
        '  <div class="nw-h2">' + esc(m.title || '未命名书目') + '<span class="nw-sub">' + esc(m.author || '作者未标注') + ' · 生成于 ' + esc(m.builtAt || '') + '</span></div>' +
        '  <div class="nw-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">' +
        stat.map(function (s) { return '<div class="nw-card2"><div class="k">' + s[0] + '</div><div style="font-size:18px;font-weight:600;color:#eaf1ff">' + s[1] + '</div></div>'; }).join('') +
        '  </div>' +
        '</div>' +
        '<div class="nw-card" style="margin-bottom:14px">' +
        '  <div class="nw-h2">数据体检<span class="nw-sub">缺哪块就去补 data/ 里对应的 json，然后重跑 build</span></div>' +
        '  <div>' +
        ok(D.chapters && D.chapters.length, '章节全', '缺章节') +
        ok(D.events && D.events.length, '事件有', '缺事件') +
        ok(D.persons && D.persons.length, '人物有', '缺人物') +
        ok(D.rel && D.rel.length, '关系有', '缺关系') +
        ok(D.items && D.items.length, '器物有', '缺器物') +
        ok(D.geo && D.geo.nodes && Object.keys(D.geo.nodes).length, '地图有', '缺地图') +
        ok(D.love && D.love.length, '感情线有', '缺感情线') +
        ok(D.density && D.density.windows && D.density.windows.length, '曲线有', '缺曲线') +
        '  </div>' +
        '</div>' +
        '<div class="nw-card">' +
        '  <div class="nw-h2">出场权重榜<span class="nw-sub">按出场章数排序，点击可跳转阅读</span></div>' +
        '  <table class="nw-table"><thead><tr><th style="width:46px">#</th><th>人物</th><th style="width:90px">出场章</th><th style="width:90px">首见</th><th style="width:90px">末见</th><th style="width:120px">占比</th></tr></thead><tbody>' +
        persons.slice(0, 26).map(function (p, i) {
          var ratio = m.chapters ? Math.round((p.count || 0) / m.chapters * 100) : 0;
          return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.name) + '</b></td><td>' + (p.count || 0) + '</td>' +
            '<td><span class="nw-chref" data-ch="' + (p.first || 1) + '">CH' + (p.first || '-') + '</span></td>' +
            '<td><span class="nw-chref" data-ch="' + (p.last || 1) + '">CH' + (p.last || '-') + '</span></td>' +
            '<td><div class="nw-bar"><i style="width:' + Math.min(100, ratio) + '%"></i></div></td></tr>';
        }).join('') +
        '  </tbody></table></div>';
      Array.prototype.forEach.call(root.querySelectorAll('.nw-chref'), function (b) {
        b.addEventListener('click', function () { NW.api.jumpTo(Number(b.getAttribute('data-ch'))); });
      });
    },
  });
})();
