/* ============================================================
   看板运行时（浏览器端）：读内嵌数据 → 过滤视图 → 建导航 → 渲染
   视图契约：NW.use({ id, nav, requires:[], build(el, D, api) })
   ============================================================ */
(function (global) {
  'use strict';

  var D = {};
  try {
    var node = document.getElementById('nwData');
    D = JSON.parse(node.textContent || '{}');
  } catch (e) {
    console.error('数据解析失败', e);
  }
  var VIEWS = [];
  var CURRENT = null;

  function has(key) {
    if (key === 'geo') return D.geo && D.geo.nodes && Object.keys(D.geo.nodes).length > 0;
    var v = D[key];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  function use(v) { VIEWS.push(v); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n) {
    if (n == null) return '-';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
    return String(n);
  }

  var api = {
    esc: esc,
    fmt: fmt,
    el: el,
    data: D,
    /** 跳到阅读视图并定位到第 ch 章（1-based） */
    jumpTo: function (ch) {
      var readView = VIEWS.filter(function (v) { return v.id === 'read'; })[0];
      show('read');
      if (readView && readView.jump) setTimeout(function () { readView.jump(ch); }, 30);
    },
    toast: function (msg) {
      var t = document.getElementById('nwTip');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('on');
      clearTimeout(t._tm);
      t._tm = setTimeout(function () { t.classList.remove('on'); }, 1800);
    },
    show: function (id) { show(id); },
  };

  function buildNav(list) {
    var nav = document.getElementById('nwNav');
    nav.innerHTML = '';
    list.forEach(function (v) {
      var b = el('button', 'nw-navbtn');
      b.setAttribute('data-v', v.id);
      b.innerHTML = '<span>' + esc(v.icon || '·') + '</span>' + esc(v.nav || v.id);
      b.addEventListener('click', function () { show(v.id); });
      nav.appendChild(b);
    });
  }

  var MOUNTED = {};
  function show(id) {
    var v = VIEWS.filter(function (x) { return x.id === id; })[0];
    if (!v) return;
    var main = document.getElementById('nwMain');
    Array.prototype.forEach.call(document.querySelectorAll('.nw-view'), function (s) {
      s.classList.toggle('on', s.getAttribute('data-v') === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nw-navbtn'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === id);
    });
    if (!MOUNTED[id]) {
      var sec = document.querySelector('.nw-view[data-v="' + id + '"]');
      try { v.build(sec, D, api); }
      catch (e) { console.error('[view ' + id + ']', e); sec.innerHTML = '<div class="nw-empty">视图 ' + esc(id) + ' 渲染失败：' + esc(e && e.message) + '</div>'; }
      MOUNTED[id] = true;
    }
    if (v.onShow) { try { v.onShow(); } catch (e) { console.error(e); } }
    CURRENT = id;
    window.__nwView = id;
  }

  function boot() {
    var cfg = D.config || {};
    var list = VIEWS.filter(function (v) {
      var req = v.requires || [];
      return req.every(has);
    });
    /* config.views 指定顺序与启用集合（缺省用全部） */
    if (cfg.views && cfg.views.length) {
      var order = cfg.views;
      /* 白名单：未列出的视图不渲染 */
      list = list.filter(function (v) { return order.indexOf(v.id) >= 0; });
      list.sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia < 0) ia = 999; if (ib < 0) ib = 999;
        return ia - ib;
      });
    }
    var disabled = cfg.disable || [];
    list = list.filter(function (v) { return disabled.indexOf(v.id) < 0; });
    if (!list.length) {
      document.getElementById('nwMain').innerHTML = '<div class="nw-empty">没有可渲染的视图：数据目录为空。先跑 extract 生成 data/*.json。</div>';
      return;
    }
    var main = document.getElementById('nwMain');
    list.forEach(function (v) {
      var sec = el('section', 'nw-view');
      sec.setAttribute('data-v', v.id);
      main.appendChild(sec);
    });
    buildNav(list);
    var t = document.getElementById('nwBookTitle');
    var sub = document.getElementById('nwBookSub');
    if (t && D.meta && D.meta.title) t.textContent = D.meta.title;
    if (sub) {
      var bits = [];
      if (D.meta && D.meta.author) bits.push(D.meta.author);
      if (D.meta && D.meta.chapters) bits.push(D.meta.chapters + ' 章');
      if (D.meta && D.meta.words) bits.push(fmt(D.meta.words) + ' 字');
      sub.textContent = bits.join(' · ') || '离线单文件看板';
    }
    show(cfg.start || list[0].id);
    window.__nwReady = true;
    window.__nwViews = list.map(function (v) { return v.id; });
  }

  global.NW = { use: use, boot: boot, data: D, api: api, esc: esc };
  global.__errs = [];
  window.addEventListener('error', function (e) { global.__errs.push(String(e.message)); });
  window.addEventListener('unhandledrejection', function (e) { global.__errs.push('rejection: ' + String(e.reason)); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
