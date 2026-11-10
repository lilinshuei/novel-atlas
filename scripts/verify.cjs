#!/usr/bin/env node
'use strict';
/* ============================================================
   verify：headless 浏览器实测（0 次模型调用）
   断言：1) 页面就绪 2) 视图全部渲染出内容 3) 无 JS 报错 4) 无横向溢出 5) 多尺寸截图
   用法：
     node scripts/verify.cjs out/书名.html
     node scripts/verify.cjs out/书名.html --sizes 1440x900,1280x800,390x844 --shots shots
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { launch } = require('../lib/cdp.cjs');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) {
      const k = s.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      a[k] = v;
    } else a._.push(s);
  }
  return a;
}
const A = parseArgs(process.argv.slice(2));
if (!A._[0]) { console.log('用法: node scripts/verify.cjs <file.html> [--sizes WxH,...] [--shots dir] [--keep]'); process.exit(1); }
const FILE = path.resolve(A._[0]);
if (!fs.existsSync(FILE)) { console.error('文件不存在: ' + FILE); process.exit(1); }
const SIZES = String(A.sizes || '1440x900,1280x800,390x844').split(',').map(s => {
  const [w, h] = s.split('x').map(Number); return { w: w || 1440, h: h || 900 };
});
const SHOTS = A.shots ? path.resolve(A.shots) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const toUrl = p => 'file:///' + p.replace(/\\/g, '/').replace(/ /g, '%20').replace(/#/g, '%23');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const fails = [];
  const notes = [];
  let browser;
  try {
    browser = await launch({ width: SIZES[0].w, height: SIZES[0].h });
    const { ws } = browser;
    const shot = async (name) => {
      if (!SHOTS) return;
      const r = await ws.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
    };

    await ws.send('Emulation.setDeviceMetricsOverride', { width: SIZES[0].w, height: SIZES[0].h, deviceScaleFactor: 1, mobile: false });
    await browser.goto(toUrl(FILE));

    /* 1) 就绪 */
    let ready = false;
    for (let i = 0; i < 80; i++) {
      const r = await browser.eval('!!window.__nwReady');
      if (r.ok && r.val === true) { ready = true; break; }
      await wait(150);
    }
    if (!ready) fails.push('页面未就绪（window.__nwReady 未变 true）');
    else notes.push('页面就绪');

    const views = await browser.eval('JSON.stringify(window.__nwViews||[])');
    let viewList = [];
    try { viewList = JSON.parse(views.val || '[]'); } catch (e) {}
    if (!viewList.length) fails.push('没有任何视图被启用（__nwViews 为空）');
    else notes.push('启用视图: ' + viewList.join(', '));

    /* 2) 逐尺寸逐视图 */
    for (const sz of SIZES) {
      await ws.send('Emulation.setDeviceMetricsOverride', { width: sz.w, height: sz.h, deviceScaleFactor: 1, mobile: sz.w < 600 });
      await wait(260);
      for (const v of viewList) {
        await browser.eval('window.NW.api.show("' + v + '")');
        await wait(340);
        const probe = await browser.eval(`(function(){
          var s=document.querySelector('.nw-view[data-v="${v}"]');
          var errs=(window.__errs||[]).slice(-4);
          var de=document.documentElement;
          return JSON.stringify({
            kids: s? s.childElementCount : -1,
            h: s? s.scrollHeight : 0,
            overflow: de.scrollWidth - window.innerWidth,
            btn: !!document.querySelector('.nw-navbtn.on'),
            errs: errs
          });
        })()`);
        let o = {};
        try { o = JSON.parse(probe.val || '{}'); } catch (e) {}
        const tag = sz.w + 'x' + sz.h + ' / ' + v;
        if (o.kids === -1) fails.push(tag + ' 视图容器不存在');
        else if (o.kids === 0) fails.push(tag + ' 视图渲染为空');
        else if (o.h < 40) fails.push(tag + ' 视图高度异常(' + o.h + 'px)');
        if (o.overflow > 6) fails.push(tag + ' 横向溢出 ' + o.overflow + 'px');
        if (o.errs && o.errs.length) fails.push(tag + ' JS 错误: ' + o.errs.join(' | '));
        await shot('v_' + v + '_' + sz.w + 'x' + sz.h);
      }
    }

    /* 3) 交互抽查：滚轮缩放地图、切章 */
    if (viewList.indexOf('map') >= 0) {
      await ws.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.eval('window.NW.api.show("map")');
      await wait(300);
      const r = await browser.eval(`(function(){
        var box=document.querySelector('.nw-mapbox');
        if(!box) return 'no-box';
        var before=box.querySelector('svg').innerHTML.length;
        box.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:400,clientY:300,bubbles:true,cancelable:true}));
        var t=box.querySelector('[data-root]').getAttribute('transform')||'';
        return before>0 && /scale\\(/.test(t) ? 'ok:'+t : 'bad:'+t;
      })()`);
      if (!String(r.val).startsWith('ok')) fails.push('地图滚轮缩放未生效: ' + r.val);
      else notes.push('地图缩放断言通过 ' + r.val.slice(3, 40));
      await shot('x_map_zoom');
    }
    if (viewList.indexOf('read') >= 0) {
      await browser.eval('window.NW.api.show("read")');
      await wait(220);
      await browser.eval('window.NW.api.jumpTo(3)');
      await wait(240);
      const r = await browser.eval(`(function(){
        var t=document.getElementById('nwChTitle');
        return JSON.stringify({ ch: window.__nwCh||0, title: (t&&t.textContent)||'' });
      })()`);
      let o = {};
      try { o = JSON.parse(r.val || '{}'); } catch (e) {}
      if (o.ch !== 3) fails.push('跳章未生效（期望第3章，实际 __nwCh=' + o.ch + '）');
      else notes.push('跳章断言通过：第3章「' + String(o.title).slice(0, 24) + '」');
    }
  } catch (e) {
    fails.push('执行异常: ' + (e && e.message));
  } finally {
    try { if (browser) await browser.close(); } catch (e) {}
  }

  console.log(JSON.stringify({ file: FILE, sizes: SIZES.map(s => s.w + 'x' + s.h), shots: SHOTS, notes, fails, pass: fails.length === 0 }, null, 2));
  process.exit(fails.length ? 2 : 0);
})();
