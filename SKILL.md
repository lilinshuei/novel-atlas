---
name: novel-atlas
display_name: 男频小说互动看板
display_name_en: Male-Oriented Webnovel Dashboard
version: 1.2.1
author: "lilinshuei"
description: '把一本男频小说（EPUB/TXT/PDF）变成单文件离线「互动看板」——阅读器、世界地图、人物关系网络、成长曲线、感情线、器物图谱，一条命令跑完。用户提出「给小说做个看板 / 小说可视化 / 看书工作台 / 整理人物关系和地图 / 生成小说设定图 / 男频网文世界观整理」时使用。也适用于在 10MB+ 巨型生成式 HTML 上做安全增量增强。'
description_zh: '把男频小说（EPUB/TXT/PDF）一键转成离线单文件 HTML 互动看板：阅读器、世界地图、人物关系网络、成长曲线、感情线、器物图谱。适合玄幻、仙侠、奇幻、都市异能、无限流等男频设定流长篇，也适合在超大生成式 HTML 上做安全增量增强；改视图只需加一个插件文件，全程零模型调用。'
description_en: 'Turn a male-oriented web novel (EPUB/TXT/PDF) into a single-file offline interactive dashboard: reader, world map, character network, growth curves, romance timeline and item gallery. Built for long-running male-oriented Chinese web novels (xianxia, fantasy, urban-power, infinite-flow); also safe incremental enhancement of huge generated HTML files. Adding a view means dropping in one plugin file, with zero model calls.'
examples_zh:
- "把《召唤万岁》做成可互动的看书工作台，要有世界地图和人物关系图"
- "整理这本仙侠小说的人物关系、势力分布和成长曲线"
- "给一份 16MB 的生成式小说 HTML 加一个可缩放的世界地图，但不要破坏原文件"
examples_en:
- "Turn 'Summoning Supreme' into an interactive reading dashboard with a world map and character network"
- "Extract character relationships, faction distribution and growth curves from this xianxia novel"
- "Add a zoomable world map to a 16MB generated novel HTML without breaking the original"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# 男频小说互动看板 · novel-atlas

> **原创制作人：lilinshuei**
> 本 Skill 把一本男频小说（EPUB/TXT/PDF）一键转成**单文件离线 HTML 互动看板**，自带可执行工具层（`scripts/`），默认 0 次模型调用即可出成品；只有需要人工判断的数据（人物、器物归属）才值得花 token 复核。

## 0. 技能结构（遵循通用 Skill 规范）

```
novel-atlas/
├── SKILL.md            # ★ 技能定义（本文件）
├── scripts/            # 可执行脚本（AI 通过 Bash 工具调用）
│   ├── extract.cjs     # 抽取：原文 → data/*.json（0 模型调用）
│   ├── build.cjs       # 构建：data + 视图插件 → 单文件 HTML（0 模型调用）
│   ├── verify.cjs      # 验证：headless 浏览器实测 + 截图（0 模型调用）
│   └── add-view.cjs    # 脚手架：新增一个视图插件
├── references/         # 参考资料（AI 执行技能时载入，见第 5 节）
│   ├── data-schema.md  # data/*.json 字段契约
│   ├── pipeline.md     # 已有巨型 HTML 的注入式增强
│   ├── map-rules.md    # 地图图层 / 缩放规则
│   └── pitfalls.md     # 踩坑清单（按症状查）
├── lib/                # 内部模块（被 scripts 调用：cdp/text/epub/map_core）
├── views/              # 视图插件（每个 .js 文件 = 一个看板页）
├── templates/          # shell.html / theme.css / runtime.js
└── legacy/             # 旧版方法论资产（仅增量增强时用）
```

## 1. 开箱三步（99% 的场景只需要这三条）

```bash
# ① 抽取：小说原文 → data/*.json（确定性统计，0 模型调用）
node scripts/extract.cjs "C:/path/书名.epub" --out data

# ② 构建：data + 视图插件 → 单个 HTML（0 模型调用）
node scripts/build.cjs --data data --out out/书名.html

# ③ 验证：headless 浏览器实测 + 截图（0 模型调用）
node scripts/verify.cjs out/书名.html --sizes 1440x900,390x844 --shots shots
```

- 运行环境：Node ≥ 18，**零 npm 依赖**（自带 CDP 客户端、自带 zip/文本解析）。
- 支持格式：`.txt` / `.epub` / `.pdf`（PDF 需本地 Python `pymupdf`，缺失时会明确报错）。
- 产物是**单文件 HTML**，双击即可离线打开，可发给任何人，不需要服务器。
- `verify` 退出码 0 = 全通过；非 0 会把失败项打在 `fails` 数组里。

## 2. 常用变体

```bash
# 只保留部分视图
node scripts/build.cjs --data data --out out/x.html --only read,map,rel

# 加一个新视图（自动登记到 data/config.json）
node scripts/add-view.cjs charts --nav "势力分布" --requires rel
# 然后编辑 views/charts.js 里的 build()，重新 build 即可

# 抽取参数：人物榜取多少个 / 至少出现几次才算角色
node scripts/extract.cjs book.txt --out data --top 120 --min-count 6 --win 25
```

## 3. 内置视图（按 requires 自动启用，缺数据不报错）

| id | 导航名 | 依赖 | 说明 |
|---|---|---|---|
| read | 阅读 | chapters | 目录 + 正文，跨视图 `jumpTo(章号)` 可定位 |
| plot | 剧情走线 | events | 事件流按章聚合，可筛类型 |
| rel | 人物关系 | persons,rel | 力导向关系网，节点大小=出场次数 |
| map | 世界地图 | places,geo | 可缩放平移地图 + 小地图 + 飞入居中 |
| curve | 成长曲线 | events | 突破/升级事件的时间轴曲线 |
| items | 器物图谱 | items | 武器/宝物/灵兽分类卡 |
| love | 感情线 | love | 双人泳道时间轴，区分正式关系 |
| overview | 总览 | — | 全书体检：章字数、人物密度、异常章 |

## 4. 数据是「草稿 + 人工确认」的关系

`extract` 产出的 `persons / events / rel / density` 由统计确定性生成，可直接用。
`items / places / love` 带 `"draft": true`，字段是**候选值**，其中 `owner`（归属人）、`group`（地区分组）、`b`（感情线对方）最需要人工核对。
**核对方式：直接改 `data/*.json` 再 build，不要改生成的 HTML。**

## 5. 参考资料（执行时自动载入）

以下文档通过 `@references/` 指令注入上下文，AI 执行技能时直接可用：

@references/data-schema.md
@references/pipeline.md
@references/map-rules.md
@references/pitfalls.md

## 6. 与旧版的关系

`legacy/` 保留了原始方法论资产（`build_template.cjs` 注入模板、`verify_template.cjs` 验证骨架、`map_core.js` v1 地图原语、`SKILL.original.md` 全文）。
只有在**必须对一份已存在的 10MB+ 生成式 HTML 做增量增强**、且不接受重新生成时，才走 legacy 路线并读 `references/pipeline.md`。
