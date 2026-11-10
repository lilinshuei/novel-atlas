'use strict';
/* ============================================================
   EPUB / TXT / PDF 读取层（尽量零依赖）
   EPUB：借系统 zip 能力解包 → container.xml → opf spine 顺序 → 去标签
   PDF ：优先调用 python + pymupdf，失败则提示先转 txt
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const T = require('./text.cjs');

function unzip(file, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  const tries = [];
  if (process.platform === 'win32') {
    tries.push(['tar', ['-xf', file, '-C', toDir]]);
    tries.push(['powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${file.replace(/'/g, "''")}','${toDir.replace(/'/g, "''")}')`]]);
  } else {
    tries.push(['unzip', ['-o', '-q', file, '-d', toDir]]);
    tries.push(['tar', ['-xf', file, '-C', toDir]]);
  }
  let err;
  for (const [cmd, args] of tries) {
    try { execFileSync(cmd, args, { stdio: 'pipe' }); return true; }
    catch (e) { err = e; }
  }
  throw new Error('解压 EPUB 失败（已尝试 ' + tries.map(t => t[0]).join('/') + '）：' + (err && err.message));
}

function readText(fp) {
  return fs.readFileSync(fp, 'utf8');
}

/* 取 opf 中的 spine 顺序，返回 [{href, abs, mediaType}] */
function spineFromOpf(opfPath, rootDir) {
  const xml = readText(opfPath);
  const base = path.dirname(opfPath);
  const manifest = {};
  const itemRe = /<item\b[^>]*>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const tag = m[0];
    const id = (tag.match(/\bid\s*=\s*"([^"]+)"/i) || [])[1];
    const href = (tag.match(/\bhref\s*=\s*"([^"]+)"/i) || [])[1];
    const mt = (tag.match(/\bmedia-type\s*=\s*"([^"]+)"/i) || [])[1] || '';
    if (id && href) manifest[id] = { href: decodeURIComponent(href), mt };
  }
  const order = [];
  const refRe = /<itemref\b[^>]*\bidref\s*=\s*"([^"]+)"/gi;
  while ((m = refRe.exec(xml))) {
    const it = manifest[m[1]];
    if (it) order.push({ href: it.href, mediaType: it.mt, abs: path.resolve(base, it.href) });
  }
  if (!order.length) {
    Object.values(manifest).forEach(it => {
      if (/x?html/i.test(it.mt) || /\.x?html?$/i.test(it.href)) {
        order.push({ href: it.href, mediaType: it.mt, abs: path.resolve(base, it.href) });
      }
    });
  }
  return order;
}

function readEpub(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-epub-'));
  unzip(file, tmp);
  const contPath = path.join(tmp, 'META-INF', 'container.xml');
  let opf = null;
  if (fs.existsSync(contPath)) {
    const c = readText(contPath);
    const m = c.match(/full-path\s*=\s*"([^"]+)"/i);
    if (m) opf = path.join(tmp, decodeURIComponent(m[1]));
  }
  if (!opf || !fs.existsSync(opf)) {
    const found = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.opf$/i.test(f)) found.push(p);
      }
    })(tmp);
    opf = found[0];
  }
  if (!opf) throw new Error('EPUB 中找不到 .opf 文件');
  const docs = spineFromOpf(opf, tmp);
  const parts = [];
  for (const d of docs) {
    if (!/\.x?html?$/i.test(d.abs) && !/xml|html/i.test(d.mediaType)) continue;
    if (!fs.existsSync(d.abs)) continue;
    const txt = T.stripHtml(readText(d.abs));
    if (txt) parts.push(txt);
  }
  const metaXml = readText(opf);
  const title = (metaXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) || [])[1] || '';
  const author = (metaXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] || '';
  return {
    text: parts.join('\n\n'),
    meta: { title: T.stripHtml(title), author: T.stripHtml(author), sourceType: 'epub' },
    tmp,
  };
}

function readPdf(file) {
  const py = ['python', 'py', 'python3'];
  const script = [
    'import sys',
    'try:',
    '    import fitz',
    'except Exception:',
    '    sys.exit(9)',
    'd=fitz.open(sys.argv[1])',
    'out=[]',
    'for p in d:',
    '    out.append(p.get_text())',
    'sys.stdout.write("\\n".join(out))',
  ].join('\n');
  let lastErr;
  for (const exe of py) {
    try {
      const buf = execFileSync(exe, ['-c', script, file], { maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
      return { text: buf.toString('utf8'), meta: { title: path.basename(file, '.pdf'), author: '', sourceType: 'pdf' } };
    } catch (e) { lastErr = e; }
  }
  throw new Error('读取 PDF 失败：未找到可用的 pymupdf。请先 `pip install pymupdf`，或把 PDF 转成 .txt 再喂给 extract。' + (lastErr ? '（' + String(lastErr.message).slice(0, 160) + '）' : ''));
}

/** 统一入口：返回 {text, meta} */
function load(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.epub') return readEpub(file);
  if (ext === '.pdf') return readPdf(file);
  const text = readText(file);
  return { text, meta: { title: path.basename(file, ext), author: '', sourceType: ext.replace('.', '') || 'txt' } };
}

module.exports = { load, readEpub, readPdf, unzip };
