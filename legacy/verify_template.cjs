/* ==================================================================
   headless Edge CDP 验证骨架（零依赖，自启/自关浏览器）
   用法：把 preview.html 放到 URL 指向处，node verify_template.cjs
   关键：多尺寸 reload、注入 window.__errs、evaluate 跑页面内断言、exit=失败数。
   ================================================================== */
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = (() => { try { return require('ws'); } catch (e) { return null; } })();
const OUT = 'PATH/TO/_v2/shots';                        // TODO
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file:///PATH/TO/_v2/preview.html';         // TODO
const PORT = 9500 + (process.pid % 300);
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let seq = 0, ws; const pending = new Map(), issues = [];

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 25000);
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: '(function(){' + expr + '})()', returnByValue: true });
  if (r.exceptionDetails) return { err: ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '').slice(0, 600) };
  return { val: r.result.value };
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.data, 'base64'));
}
async function reloadReady() {
  await send('Page.reload', { ignoreCache: true });
  for (let i = 0; i < 60; i++) {
    const r = await evaluate("return document.readyState+'|'+(typeof V2D)");
    if (r.val && r.val.startsWith('complete|object')) return;
    if (r.err) break;
    await sleep(400);
  }
}

async function main() {
  const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
    '--user-data-dir=' + OUT + '/edgeprofile_' + PORT, '--window-size=1440,900', '--disable-dev-shm-usage', URL],
    { stdio: 'ignore', windowsHide: true });
  let p = null;
  for (let i = 0; i < 60; i++) {
    try { const j = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
      p = j.find(x => x.type === 'page' && x.url.indexOf('preview') >= 0) || j.find(x => x.type === 'page');
      if (p) break; } catch (e) {}
    await sleep(400);
  }
  if (!p) throw new Error('CDP 未就绪');
  ws = new WebSocket(p.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const q = pending.get(m.id); pending.delete(m.id); q.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') issues.push('EXC ' + ((m.params.exceptionDetails.exception || {}).description || '').slice(0, 400));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') issues.push('LOG ' + m.params.entry.text.slice(0, 200));
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',
    { source: "window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(e.message+' @'+e.lineno)});" });

  /* ---- 桌面 1440 ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await reloadReady();
  await evaluate("switchView('map'); return 1"); await sleep(450);
  await shot('21-PC世界地图');
  // TODO: 在此跑你的专项断言（务必含非 100% 缩放态 + 几何探针）
  const pc = await evaluate(`
    const out={};
    try {
      const box=document.querySelector('#v2MapBox'); const svg=box.querySelector('svg');
      // Fix：底图(ocean rect)应是 #v2MapRoot 直接子节点，才能随缩放/平移一起移动
      out.baseInRoot=(function(){const root=document.getElementById('v2MapRoot');if(!root)return false;
        return [].slice.call(root.children).some(c=>c.tagName==='rect'&&c.getAttribute('fill')==='url(#v2Sea)');})();
    } catch(e){ out.err=e.message }
    return out;`);
  console.log('PC 专项:', JSON.stringify(pc.val || pc.err));
  await send('Emulation.clearDeviceMetricsOverride');

  /* ---- 手机 390/360/768：每个尺寸都 reload，让手机模式从首屏生效 ---- */
  let failed = 0;
  for (const [w, h, tag] of [[390, 844, '390'], [360, 780, '360'], [768, 1024, '768']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await reloadReady();
    const mob = await evaluate("return {bodyW:document.body.scrollWidth, winW:window.innerWidth};");
    console.log(tag + 'px:', JSON.stringify(mob.val || mob.err));
    if (mob.val && mob.val.bodyW > mob.val.winW + 2) failed++;
    await send('Emulation.clearDeviceMetricsOverride');
  }

  const finalErrs = await evaluate("return (window.__errs||[]).length");
  console.log('\n运行时问题(' + issues.length + '):'); issues.slice(0, 25).forEach(x => console.log('  ' + x));
  const errCount = (finalErrs.val != null ? finalErrs.val : 0);
  console.log('失败断言=' + failed + ' / __errs=' + errCount);
  try { await send('Browser.close'); } catch (e) {}
  try { child.kill(); } catch (e) {}
  process.exit(failed > 0 || issues.length > 0 || errCount > 0 ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
