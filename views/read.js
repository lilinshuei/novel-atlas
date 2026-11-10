/* 视图：阅读 —— 章节目录 + 正文 */
(function () {
  var NW = window.NW, esc = NW.esc;
  var box, listEl, readEl, titleEl, bodyEl, pagerEl, cur = 0, items = [];

  function render(i) {
    var ch = NW.data.chapters[i];
    if (!ch) return;
    cur = i;
    Array.prototype.forEach.call(listEl.children, function (c, k) { c.classList.toggle('on', k === i); });
    titleEl.textContent = (ch.t || ('第 ' + (i + 1) + ' 章'));
    var html = [];
    (ch.p || []).forEach(function (p) { html.push('<p class="nw-para">' + esc(p) + '</p>'); });
    bodyEl.innerHTML = html.join('');
    readEl.scrollTop = 0;
    pagerEl.innerHTML =
      '<button class="nw-btn" data-go="-1">← 上一章</button>' +
      '<span>' + (i + 1) + ' / ' + NW.data.chapters.length + ' · ' + ((ch.p || []).join('').length) + ' 字</span>' +
      '<button class="nw-btn" data-go="1">下一章 →</button>';
    Array.prototype.forEach.call(pagerEl.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { render(Math.max(0, Math.min(NW.data.chapters.length - 1, cur + Number(b.getAttribute('data-go'))))); });
    });
    var on = listEl.children[i];
    if (on && listEl.scrollHeight > listEl.clientHeight) {
      var t = on.offsetTop - listEl.clientHeight / 2 + on.offsetHeight / 2;
      listEl.scrollTop = Math.max(0, t);
    }
    window.__nwCh = i + 1;
  }

  NW.use({
    id: 'read', nav: '阅读', icon: '📖', requires: ['chapters'],
    jump: function (ch) { render(Math.max(0, Math.min(NW.data.chapters.length - 1, (ch || 1) - 1))); },
    build: function (root) {
      root.innerHTML =
        '<div class="nw-split">' +
        '  <div class="nw-card nw-chlist" id="nwChList"></div>' +
        '  <div class="nw-card nw-reader" id="nwReader">' +
        '    <h2 class="nw-chtitle" id="nwChTitle"></h2>' +
        '    <div id="nwChBody"></div>' +
        '    <div class="nw-pager" id="nwPager"></div>' +
        '  </div>' +
        '</div>';
      listEl = root.querySelector('#nwChList');
      readEl = root.querySelector('#nwReader');
      titleEl = root.querySelector('#nwChTitle');
      bodyEl = root.querySelector('#nwChBody');
      pagerEl = root.querySelector('#nwPager');
      var html = [];
      (NW.data.chapters || []).forEach(function (ch, i) {
        html.push('<div class="nw-chitem" data-i="' + i + '">' + esc(ch.t || ('第 ' + (i + 1) + ' 章')) + '</div>');
      });
      listEl.innerHTML = html.join('');
      items = Array.prototype.slice.call(listEl.children);
      items.forEach(function (d) {
        d.addEventListener('click', function () { render(Number(d.getAttribute('data-i'))); });
      });
      render(0);
    },
  });
})();
