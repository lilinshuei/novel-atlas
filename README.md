<div align="center">

<img src="assets/banner.svg" alt="novel-atlas · 小说互动看板" width="100%">

<h1>novel-atlas · 男性向小说互动看板</h1>

<p><b>把一本小说，变成一座可以走进去的世界。</b></p>

<p>阅读器 · 世界地图 · 人物关系网络 · 成长曲线 · 感情线 · 器物图谱，全部压进一个离线 HTML。</p>

[![validate](https://github.com/lilinshuei/novel-atlas/actions/workflows/validate.yml/badge.svg)](https://github.com/lilinshuei/novel-atlas/actions/workflows/validate.yml)
[![License](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-1f6feb?style=flat-square)](https://github.com/topics/dsh-plugin)
[![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-lightgrey?style=flat-square)](#环境要求)

</div>

---

## 它解决什么问题

普通阅读器只给你一条从上往下的正文流。可一本设定流长篇真正难记的，是人物、势力、地点、境界和它们之间的关系。

novel-atlas 把同一本书拆成六个可以互相跳转的视角：读到哪里、谁在场、在哪张地图、关系怎么变、什么时候突破、哪些器物有归属。产物只有一个 HTML，双击就开，发给任何人都能看。

## 你会得到什么

- **六个视角，不是六份文档** — 阅读、剧情、关系网、世界地图、成长曲线、感情线与器物图谱共享同一份数据，点人物就能跳章节。
- **一条命令出成品** — extract → build → verify 三步，默认 0 次模型调用，不需要 npm install。
- **单文件离线交付** — CSS、JS、数据、地图全部内联，不依赖服务器，也不怕链接失效。
- **草稿可人工校正** — 人物归属、地区分组、感情线对象会标成草稿，改 data/*.json 再 build，不必碰生成的 HTML。
- **巨型 HTML 也能增量增强** — 面对 10MB+ 的生成式小说页面，legacy 路线可以只加一个地图，不重写原文件。

## 安装

### DSH 一条命令（推荐）

```powershell
dsh plugin --profile web add github:lilinshuei/novel-atlas
```

桌面端把 `web` 换成 `desktop`。装完重启 DSH，新会话即可调用。

### 手动安装

```bash
git clone https://github.com/lilinshuei/novel-atlas.git
mkdir -p ~/.dsh/skills
cp -r novel-atlas ~/.dsh/skills/
```

最终路径是 `~/.dsh/skills/novel-atlas/SKILL.md`。仓库根目录就是 Skill 本体，不用再找子目录。

## 快速上手

### 1. 抽取原文

```bash
node scripts/extract.cjs "你的书.epub" --out data
```

支持 .txt / .epub / .pdf；PDF 需要本地 Python 的 pymupdf。

### 2. 构建看板

```bash
node scripts/build.cjs --data data --out out/书.html
```

只想保留部分视图时加 --only read,map,rel。

### 3. 实测验证

```bash
node scripts/verify.cjs out/书.html --sizes 1440x900,390x844 --shots shots
```

退出码 0 才算通过，失败项会列在 fails 数组里。

## 能力边界

- 抽取结果是统计草稿，不保证每个人物、器物归属都正确；关键字段需要人看一眼。
- 地图质量取决于原文是否有足够的地点与方位描述，不是凭空生成地理。
- 不处理 DRM 加密书籍；请只对自己有权处理的文本使用。

## 环境要求

| 项 | 要求 |
|---|---|
| 运行环境 | Node.js ≥ 18 |
| 第三方依赖 | 零 npm 依赖 |
| PDF 输入 | 本地 Python + pymupdf（TXT / EPUB 不需要） |
| 产物体积 | 随书增长，通常几 MB 到几十 MB |

## 仓库里有什么

```
novel-atlas/
├── scripts/
├── views/
├── templates/
├── lib/
├── references/
├── legacy/
├── lib/index.js          # DSH 插件适配层（零依赖）
├── cordis.patch.yml      # DSH 挂载声明
├── tools/                # 仓库自检 + 适配层冒烟测试
└── README.md
```

- scripts/ — extract / build / verify / add-view 四个确定性脚本
- views/ — read、plot、rel、map、curve、items、love、overview 八个视图
- templates/ — 单文件外壳、主题与运行时
- lib/ — 自带 CDP、EPUB、文本与地图原语，零 npm 依赖
- references/ — 数据契约、注入流程、地图规则、踩坑清单
- legacy/ — 对已有巨型 HTML 做增量增强的旧版资产

## 安全与隐私

- **零遥测**：不上报使用数据、不内置统计、不访问外部接口。
- **本地执行**：所有处理都在你的机器上完成；需要联网时只发生在你自己执行的包管理器或下载命令里。
- **不删文件**：仓库脚本以“只新增、不删除”为约束；需要清理时会先说明并留回退路径。
- **无凭据**：仓库不包含账号、令牌、Cookie 或本机绝对路径。发现问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 同系列 Skill

| Skill | 一句话 |
|---|---|
| **[pc-privacy-shield](https://github.com/lilinshuei/pc-privacy-shield)** | 你的屏幕看得见，别人的截屏看不见。 |
| **[blank-workbench](https://github.com/lilinshuei/blank-workbench)** | 一句话，得到一个能直接干活的工作台。 |
| **[task-complete-chime](https://github.com/lilinshuei/task-complete-chime)** | 任务跑完了，别再盯着屏幕等。 |
| **[phone-media-transfer-android-app](https://github.com/lilinshuei/phone-media-transfer-android-app)** | App 说找不到文件夹？那就从电脑直接送进去。 |
| **[source-to-app](https://github.com/lilinshuei/source-to-app)** | 源码到双击即用，只差这一条命令。 |

## License

MIT © 2026 lilinshuei。本 Skill 为原创设计；第三方依赖与素材在各自目录内单独标注。

---

如果它替你省下了时间，点一个 **Star**，让更多人找到它。
