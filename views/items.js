/* 视图：器物图谱 —— 武器/宝物/战兽/其他，图标卡 + 搜索 + 类型筛选 */
(function () {
  var NW = window.NW, esc = NW.esc;
  var TYPE = {
    weapon: { t: '武器', i: '⚔' }, treasure: { t: '宝物', i: '💎' },
    beast: { t: '战兽', i: '🐺' }, other: { t: '其他', i: '📦' },
  };
  var curType = 'all', kw = '';

  function paint(root) {
    var list = (NW.data.items || []).filter(function (it) {
      if (curType !== 'all' && (it.type || 'other') !== curType) return false;
      if (!kw) return true;
      var s = (it.name + ' ' + (it.owner || '') + ' ' + (it.ability || '') + ' ' + (it.addr || '')).toLowerCase();
      return s.indexOf(kw.toLowerCase()) >= 0;
    });
    var host = root.querySelector('#nwItemBody');
    if (!list.length) { host.innerHTML = '<div class="nw-empty">没有匹配的器物。可在 data/items.json 手工补充或重新 extract。</div>'; return; }
    host.innerHTML = '<div class="nw-grid">' + list.map(function (it) {
      var ty = TYPE[it.type || 'other'] || TYPE.other;
      return '<div class="nw-card2">' +
        '<h4><span>' + ty.i + '</span>' + esc(it.name) + '<span class="nw-tag" style="margin-left:auto">' + ty.t + '</span></h4>' +
        '<div><span class="k">持有者</span> ' + esc(it.owner || '—') + '</div>' +
        (it.addr ? '<div><span class="k">称号</span> ' + esc(it.addr) + '</div>' : '') +
        (it.from ? '<div><span class="k">首现</span> <span class="nw-chref" data-ch="' + it.from + '">CH' + it.from + '</span></div>' : '') +
        (it.to && it.to !== it.from ? '<div><span class="k">末现</span> <span class="nw-chref" data-ch="' + it.to + '">CH' + it.to + '</span></div>' : '') +
        (it.ability ? '<div style="margin-top:8px;font-size:12.5px;color:#bcd0ee">' + esc(it.ability) + '</div>' : '') +
        (it.draft ? '<div style="margin-top:8px"><span class="nw-tag warn">草稿待核</span></div>' : '') +
        '</div>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(host.querySelectorAll('.nw-chref'), function (b) {
      b.addEventListener('click', function () { NW.api.jumpTo(Number(b.getAttribute('data-ch'))); });
    });
  }

  NW.use({
    id: 'items', nav: '器物图谱', icon: '⚔', requires: ['items'],
    build: function (root) {
      var keys = ['all'].concat(Object.keys(TYPE));
      root.innerHTML =
        '<div class="nw-card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<input class="nw-search" id="nwItemKw" placeholder="搜索器物 / 持有者 / 能力" style="max-width:300px">' +
        keys.map(function (k) { return '<button class="nw-btn' + (k === 'all' ? ' on' : '') + '" data-t="' + k + '">' + (k === 'all' ? '全部' : TYPE[k].t) + '</button>'; }).join('') +
        '<span class="nw-sub">共 ' + (NW.data.items || []).length + ' 条</span>' +
        '</div><div id="nwItemBody"></div>';
      root.querySelector('#nwItemKw').addEventListener('input', function (e) { kw = e.target.value.trim(); paint(root); });
      Array.prototype.forEach.call(root.querySelectorAll('[data-t]'), function (b) {
        b.addEventListener('click', function () {
          curType = b.getAttribute('data-t');
          Array.prototype.forEach.call(root.querySelectorAll('[data-t]'), function (x) { x.classList.toggle('on', x === b); });
          paint(root);
        });
      });
      paint(root);
    },
  });
})();
