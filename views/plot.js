/* 视图：剧情走线 —— 事件时间轴（可按类型过滤、跳章） */
(function () {
  var NW = window.NW, esc = NW.esc;
  var KIND = {
    breakthrough: { t: '突破/升级', c: 'breakthrough' },
    acquire: { t: '获得', c: 'acquire' },
    love: { t: '感情', c: 'love' },
    death: { t: '死亡', c: 'death' },
  };
  var filter = 'all';

  function paint(root) {
    var evs = (NW.data.events || []).filter(function (e) { return filter === 'all' || e.kind === filter; });
    var host = root.querySelector('#nwPlotBody');
    if (!evs.length) { host.innerHTML = '<div class="nw-empty">没有事件数据。extract 会按关键词锚定突破/获得/感情/死亡节点。</div>'; return; }
    /* 按章聚合 */
    var byCh = {};
    evs.forEach(function (e) { (byCh[e.ch] = byCh[e.ch] || []).push(e); });
    var chs = Object.keys(byCh).map(Number).sort(function (a, b) { return a - b; });
    var html = ['<div class="nw-timeline">'];
    chs.forEach(function (ch) {
      byCh[ch].slice(0, 8).forEach(function (e) {
        var k = KIND[e.kind] || { t: e.kind, c: '' };
        html.push(
          '<div class="nw-ev ' + k.c + '">' +
          '<span class="nw-chref" data-ch="' + ch + '">CH' + ch + '</span>' +
          '<b>' + esc(k.t) + '</b>' +
          (e.who ? ' · <b>' + esc(e.who) + '</b>' : '') +
          ' · ' + esc(e.what || '') +
          '<div class="nw-evctx">' + esc(e.ctx || '') + '</div>' +
          '</div>'
        );
      });
    });
    html.push('</div>');
    host.innerHTML = html.join('');
    Array.prototype.forEach.call(host.querySelectorAll('.nw-chref'), function (b) {
      b.addEventListener('click', function () { NW.api.jumpTo(Number(b.getAttribute('data-ch'))); });
    });
  }

  NW.use({
    id: 'plot', nav: '剧情走线', icon: '🧭', requires: ['events'],
    build: function (root) {
      var kinds = ['all'].concat(Object.keys(KIND));
      root.innerHTML =
        '<div class="nw-card" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        kinds.map(function (k) {
          return '<button class="nw-btn' + (k === 'all' ? ' on' : '') + '" data-k="' + k + '">' + (k === 'all' ? '全部' : KIND[k].t) + '</button>';
        }).join('') +
        '<span class="nw-sub">共 ' + (NW.data.events || []).length + ' 个节点 · 点击 CH 编号跳章</span>' +
        '</div>' +
        '<div id="nwPlotBody"></div>';
      Array.prototype.forEach.call(root.querySelectorAll('[data-k]'), function (b) {
        b.addEventListener('click', function () {
          filter = b.getAttribute('data-k');
          Array.prototype.forEach.call(root.querySelectorAll('[data-k]'), function (x) { x.classList.toggle('on', x === b); });
          paint(root);
        });
      });
      paint(root);
    },
  });
})();
