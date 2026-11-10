'use strict';
/* ============================================================
   文本层：去标签 / 切章 / 分句 / 候选专名抽取
   目标：用确定性统计给出「草稿」，模型只做审核，不读全文
   ============================================================ */

const CJK = '\\u4e00-\\u9fa5';

const SURNAMES = (
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯管卢莫房裘缪解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊惠甄曲家封芮储靳段富巫乌焦巴弓牧山谷车侯全班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶幸司韶黎薄印宿白怀蒲鄂索咸赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧沃利蔚越隆师巩聂晁勾敖融冷辛那简饶曾沙鞠丰巢关蒯查荆红游竺权盖益桓');
const SURNAME_SET = new Set(SURNAMES.split(''));

/* 高频虚词/代词，命中即否决 */
const STOP = new Set((
  '自己 我们 他们 她们 你们 大家 众人 所有人 别人 对方 这个 那个 一个 什么 怎么 为何 因为 所以 但是 如果 现在 刚才 忽然 突然 立刻 马上 一直 已经 还是 就是 可是 只是 于是 因此 然后 只见 只听 不过 其实 果然 居然 竟然 而且 并且 虽然 既然 无论 不管 只有 只要 不能 不会 不要 没有 不是 可以 应该 需要 知道 觉得 认为 心中 心里 到底 究竟 到底 一样 一般 这次 那次 此时 那时 时候 地方 东西 事情 问题 家伙 小子 老者 少女 少年 男人 女人 老者 大汉 青年 中年 本尊 在下 前辈 师尊 长老 主人 公子 小姐 少爷 夫人 陛下 殿下 大王 掌门 宗主 城主 门主 三长老 二长老 大长老'
).split(' '));

const PLACE_SUF = ['城','山','谷','殿','宫','塔','海','林','岛','峰','门','堡','镇','村','关','府','庄','寺','阁','湖','江','州','域','界','堂','院','寨','窟','渊','漠','岭','崖','洞','国','郡','县','营','园','盆地','平原','森林','大陆','秘境','遗迹','战场','绿洲','山脉','峡谷'];
const ITEM_SUF = ['剑','刀','枪','杖','珠','轮','镜','书','面具','罗盘','鞭','弓','甲','袍','丹','符','印','钟','鼎','旗','幡','令','盾','斧','锤','扇','琴','箫','玉','石','晶','镯','戒','冠','靴','披风','神剑','神刀','神杖','圣衣','宝典','令牌','卷轴'];
const BEAST_SUF = ['狼','虎','蛇','凤','龙','熊','鹰','豹','蛛','蚁','鼠','狮','蝎','蛟','鲲','麒麟','凤凰','巨猿','魔猿','兽','妖','魔兽','战兽','灵兽'];
const VERB_AFTER = ['说','道','问道','笑道','冷笑','点头','摇头','说道','开口','沉声','皱眉','叹道','怒道','喝道','摆手','大笑','想了想','答道','回答','解释道','介绍道','看了一眼','望着','看着','喝道','低声道','轻声道'];

/* 句中事件动词锚点 */
const EV = {
  breakthrough: /(突破|晋阶|进阶|晋级|晋升|蜕变|进化|觉醒|化形|飞升|渡劫|达到.{0,4}(级|阶|层|品)|踏入.{0,6}(境界|层次))/,
  acquire: /(获得|得到|夺得|缴获|购得|炼成|凝结|得到一|拿到|抢到|收服|获得了一)/,
  death: /(陨落|战死|身死|被杀|自爆|魂飞魄散|死去|咽气)/,
  love: /(行房|云雨|双修|同房|初夜|亲密|亲吻|拥吻|成亲|大婚|洞房|肌肤相亲|拿下|一夜)/,
};

function stripHtml(s) {
  return String(s)
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* 章节切分：支持「第X章/第X节/【标题】/Chapter N」四种主流格式 */
const CH_PATTERNS = [
  /^[\s\u3000]*第[0-9零一二三四五六七八九十百千万两]{1,10}[章节回卷][\s:：、.．]*(.{0,40})$/,
  /^[\s\u3000]*【(.{1,40})】[\s\u3000]*$/,
  /^[\s\u3000]*Chapter\s+\d+[\s:：]*(.{0,40})$/i,
  /^[\s\u3000]*[（(][0-9]{1,5}[）)][\s\u3000]*(.{0,40})$/,
];

function splitChapters(rawText) {
  const lines = rawText.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln || ln.length > 60) continue;
    for (const re of CH_PATTERNS) {
      const m = ln.match(re);
      /* 标题保留整行（含"第X章"前缀），只压缩空白，避免丢失章节号 */
      if (m) { hits.push({ line: i, title: ln.replace(/^[=＝\-—\s]+|[=＝\-—\s]+$/g, '') || ln }); break; }
    }
  }
  /* 至少命中 3 次且覆盖全文才认为是章节结构，否则整体一章 */
  if (hits.length < 3) {
    return [{ t: '全文', p: lines.filter(x => x.trim()) }];
  }
  const chs = [];
  for (let k = 0; k < hits.length; k++) {
    const from = hits[k].line + 1;
    const to = k + 1 < hits.length ? hits[k + 1].line : lines.length;
    const paras = [];
    for (let i = from; i < to; i++) {
      const t = lines[i].trim();
      if (t) paras.push(t);
    }
    if (paras.length) chs.push({ t: hits[k].title, p: paras });
  }
  return chs;
}

function splitSentences(paras) {
  const out = [];
  for (const p of paras) {
    for (const s of String(p).split(/(?<=[。！？!?；;…])/)) {
      const t = s.trim();
      if (t.length >= 4) out.push(t);
    }
  }
  return out;
}

function countMap() { return Object.create(null); }
function bump(m, k, n) { m[k] = (m[k] || 0) + (n == null ? 1 : n); }

function cleanName(s) {
  if (!s) return false;
  if (s.length < 2 || s.length > 4) return false;
  if (!new RegExp('^[' + CJK + ']+$').test(s)) return false;
  if (STOP.has(s)) return false;
  /* 首字是虚词直接否决 */
  if (/^[的了是在不这那我你他她它个们和与及或而且就都也又还很有没最更把被给让对从向为所以着过呢吧啊呀么吗一二三四五六七八九十几每各某]/.test(s)) return false;
  /* 尾字是虚词否决 */
  if (/[的了是在着过呢吧啊呀么吗]$/.test(s)) return false;
  return true;
}

/* 人物候选：动作词前置窗口 + 姓氏加权 */
function extractPersons(text, opt) {
  opt = opt || {};
  const minCount = opt.minCount || 6;
  const limit = opt.limit || 150;
  const cnt = countMap(), surnamed = countMap();

  const verbAlt = VERB_AFTER.join('|');
  /* 名字用惰性 {2,4}?，动词用非捕获消耗组吃掉，避免把「林轩说」当成人名吞进动词 */
  const reAfter = new RegExp('([' + CJK + ']{2,4}?)(?:' + verbAlt + ')', 'g');
  let m;
  while ((m = reAfter.exec(text))) {
    const w = m[1];
    if (!cleanName(w)) continue;
    bump(cnt, w);
    if (SURNAME_SET.has(w[0])) bump(surnamed, w, 1);
  }
  /* 补一轮：2~3 字 + 「的」前，提升召回（权重低） */
  const reDe = new RegExp('([' + CJK + ']{2,3})(?=的[\\u4e00-\\u9fa5])', 'g');
  let n = 0;
  while ((m = reDe.exec(text)) && n < 400000) {
    n++;
    const w = m[1];
    if (!cleanName(w)) continue;
    if (SURNAME_SET.has(w[0])) bump(cnt, w, 0.4);
  }

  const arr = Object.keys(cnt)
    .map(name => ({ name, count: Math.round(cnt[name] * 10) / 10, surname: !!surnamed[name] }))
    .filter(x => x.count >= minCount)
    .map(x => ({ ...x, score: x.count * (x.surname ? 1.6 : 1) }))
    .sort((a, b) => b.score - a.score);

  /* 子串去重：若 A 是 B 的子串且 A 出现次数被 B 覆盖大半，去掉 A */
  const kept = [];
  for (const x of arr) {
    const dup = kept.some(k => k.name.includes(x.name) && k.count >= x.count * 0.7);
    if (!dup) kept.push(x);
    if (kept.length >= limit) break;
  }
  return kept.map(x => ({ name: x.name, count: x.count }));
}

function extractBySuffix(text, suffixes, opt) {
  opt = opt || {};
  const minCount = opt.minCount || 3;
  const limit = opt.limit || 80;
  const cnt = countMap();
  const suf = suffixes.slice().sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp('([' + CJK + ']{1,3})(?:' + suf + ')', 'g');
  let m;
  while ((m = re.exec(text))) {
    const w = m[1] + m[0].slice(m[1].length);
    if (!new RegExp('^[' + CJK + ']{2,6}$').test(w)) continue;
    if (/^[的了是在这那我你他她它个们和与及一二三四五六七八九十几每各某]/.test(w)) continue;
    if (STOP.has(m[1])) continue;
    bump(cnt, w);
  }
  return Object.keys(cnt)
    .map(name => ({ name, count: cnt[name] }))
    .filter(x => x.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* 事件锚定：返回带章节号与上下文的候选 */
function extractEvents(text, chapters, persons) {
  const names = (persons || []).map(p => p.name);
  const nameRe = names.length
    ? new RegExp('(' + names.slice(0, 120).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g')
    : null;
  const out = [];
  chapters.forEach((ch, idx) => {
    const body = ch.p.join('\n');
    for (const kind of Object.keys(EV)) {
      const re = new RegExp(EV[kind].source, 'g');
      let m;
      while ((m = re.exec(body))) {
        const from = Math.max(0, m.index - 40);
        const to = Math.min(body.length, m.index + m[0].length + 40);
        const ctx = body.slice(from, to).replace(/\n/g, '');
        let who = '';
        if (nameRe) {
          nameRe.lastIndex = 0;
          const nm = nameRe.exec(ctx);
          if (nm) who = nm[1];
        }
        out.push({ ch: idx + 1, kind, who, what: m[0], ctx, draft: true });
      }
    }
  });
  return out;
}

/* 句子级共现 → 关系边 */
function buildRelations(chapters, persons, opt) {
  opt = opt || {};
  const minW = opt.minWeight || 3;
  const top = opt.top || 120;
  const names = persons.map(p => p.name);
  const idx = new Map(names.map((n, i) => [n, i]));
  /* 长名优先，避免「岳阳」吃掉「岳阳和」这类 */
  const sorted = names.slice().sort((a, b) => b.length - a.length);
  const re = new RegExp(sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const W = new Map();
  chapters.forEach((ch, ci) => {
    for (const s of splitSentences(ch.p)) {
      re.lastIndex = 0;
      const hits = new Set();
      let m;
      while ((m = re.exec(s))) {
        const k = idx.get(m[0]);
        if (k != null) hits.add(k);
        re.lastIndex = m.index + m[0].length;
      }
      if (hits.size < 2) continue;
      const arr = Array.from(hits).sort((a, b) => a - b);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = arr[i] + ':' + arr[j];
          const rec = W.get(key) || { w: 0, first: ci + 1, last: ci + 1 };
          rec.w++; rec.last = ci + 1;
          W.set(key, rec);
        }
      }
    }
  });
  return Array.from(W.entries())
    .map(([k, v]) => {
      const [a, b] = k.split(':').map(Number);
      return { a: names[a], b: names[b], w: v.w, first: v.first, last: v.last };
    })
    .filter(x => x.w >= minW)
    .sort((x, y) => y.w - x.w)
    .slice(0, top * 4);
}

/* 出场密度：每窗内各人物出现次数（成长曲线/热度用） */
function buildDensity(chapters, persons, win) {
  const W = win || 25;
  const names = persons.slice(0, 40).map(p => p.name);
  const sorted = names.slice().sort((a, b) => b.length - a.length);
  const re = new RegExp(sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const windows = [];
  for (let i = 0; i < chapters.length; i += W) {
    const slice = chapters.slice(i, i + W);
    const cnt = countMap();
    for (const ch of slice) {
      const body = ch.p.join('');
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(body))) bump(cnt, m[0]);
    }
    windows.push({ from: i + 1, to: Math.min(chapters.length, i + W), cnt });
  }
  return { win: W, total: chapters.length, persons: names, windows };
}

/* 自动地理布局：按首次出场章排序，环形+螺旋铺点，保证不重叠 */
function autoGeo(places, W, H) {
  W = W || 1000; H = H || 660;
  const nodes = {};
  const n = places.length;
  if (!n) return { W, H, nodes };
  const golden = Math.PI * (3 - Math.sqrt(5));
  places.forEach((p, i) => {
    const r = Math.sqrt((i + 0.5) / n);
    const th = i * golden;
    nodes[p.name] = {
      x: Math.round(W / 2 + Math.cos(th) * r * (W * 0.40)),
      y: Math.round(H / 2 + Math.sin(th) * r * (H * 0.40)),
      group: p.group || 'default',
    };
  });
  return { W, H, nodes };
}

module.exports = {
  stripHtml, splitChapters, splitSentences, extractPersons,
  extractBySuffix, extractEvents, buildRelations, buildDensity, autoGeo,
  PLACE_SUF, ITEM_SUF, BEAST_SUF, EV,
};
