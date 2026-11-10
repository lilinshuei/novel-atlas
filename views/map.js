/* 视图：世界地图 —— 舞台节点 + 关联人物 + 缩放/小地图 */
(function () {
  var NW = window.NW, esc = NW.esc;

  NW.use({
    id: 'map', nav: '世界地图', icon: '🗺', requires: ['geo'],
    build: function (root) {
      var D = NW.data;
      root.innerHTML =
        '<div class="nw-h2">世界地图<span class="nw-sub">滚轮缩放（看哪放大哪）· 拖动平移 · 点击地点看关联人物</span></div>' +
        '<div class="nw-mapbox" id="nwMapBox">' +
        '  <div class="nw-maptools">' +
        '    <button class="nw-btn" id="nwZoomIn">＋</button>' +
        '    <button class="nw-btn" id="nwZoomOut">－</button>' +
        '    <button class="nw-btn" id="nwFit">适应</button>' +
        '  </div>' +
        '  <div class="nw-mapinfo" id="nwMapInfo"></div>' +
        '</div>';

      var box = root.querySelector('#nwMapBox');
      var info = root.querySelector('#nwMapInfo');
      var map = window.NWMap.create({
        el: box,
        geo: D.geo,
        places: D.places || [],
        links: (D.rel || []).slice(0, 120),
        onPick: function (p) {
          var here = (D.persons || []).filter(function (per) {
            return (per.places || []).indexOf(p.name) >= 0;
          });
          var html = ['<div class="nw-h2">' + esc(p.name) + '</div>'];
          html.push('<div style="color:var(--txt2)">出场章数 <b>' + (p.count || 0) + '</b> · 首见 CH' + (p.first || '-') + ' · 末见 CH' + (p.last || '-') + '</div>');
          if (here.length) {
            html.push('<div class="nw-h2" style="margin-top:12px">此地出场人物</div>');
            html.push(here.slice(0, 16).map(function (x) { return '<span class="nw-tag">' + esc(x.name) + '</span>'; }).join(''));
          } else {
            html.push('<div style="color:var(--txt3);margin-top:10px;font-size:12px">未记录该地点的出场人物（可在 data/places.json 的 cast 字段补充）</div>');
          }
          info.innerHTML = html.join('');
          info.classList.add('on');
        },
      });
      root.querySelector('#nwZoomIn').addEventListener('click', function () { map.zoomBy(1.25); });
      root.querySelector('#nwZoomOut').addEventListener('click', function () { map.zoomBy(1 / 1.25); });
      root.querySelector('#nwFit').addEventListener('click', function () { map.fit(); });
    },
  });
})();
