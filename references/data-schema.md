# data/*.json 字段契约

`scripts/extract.cjs` 产出以下文件到 `--out` 目录，`scripts/build.cjs` 把它们整体塞进 HTML 的 `#nwData` 块。
**改数据一律改 JSON，不要改生成的 HTML。**

| 文件 | 必需 | 生成方式 | 人工校对价值 |
|---|---|---|---|
| meta.json | ✓ | 自动 | 低（标题/作者/章数/字数） |
| chapters.json | ✓ | 自动 | 低（正文与切章结果） |
| persons.json | — | 统计确定性 | 中（是否要剔除误判的"人名"） |
| events.json | — | 规则锚定 | 中（事件类型、归属人） |
| rel.json | — | 共现统计 | 低（权重即真实共现次数） |
| items.json | — | 候选 + 草稿 | **高**（owner/type 常错） |
| places.json | — | 候选 + 草稿 | **高**（group 分组需人工定） |
| geo.json | — | 由 places 自动布点 | **高**（坐标建议手调成真实地理关系） |
| love.json | — | 事件 + 邻近人名 | **高**（对方 b 常误判） |
| density.json | — | 统计 | 低（用于找"水章/断更章"） |
| config.json | — | 可选，手写 | 控制视图顺序、启停、默认视图 |

## meta.json
```json
{ "title": "书名", "author": "作者", "source": "book.epub", "sourceType": "epub",
  "chapters": 1200, "words": 5400000, "extractedAt": "2026-11-05 10:00:00", "note": "..." }
```

## chapters.json
```json
[{ "i": 1, "t": "第1章 章节名", "p": ["段落1", "段落2"] }]
```
`t` 保留原始章节行（含"第X章"前缀）；`p` 是段落数组。

## persons.json
```json
[{ "name": "林牧", "count": 3821, "first": 1, "last": 1200 }]
```
`count` 为全文出现次数，`first/last` 为首末出场章号。按 `count` 降序，只保留 `--min-count` 以上的候选。

## events.json
```json
[{ "ch": 37, "kind": "breakthrough", "who": "林牧", "what": "突破至金丹境", "ctx": "原始句摘录" }]
```
`kind` 取值：`breakthrough`（突破/晋升）、`acquire`（获得/得到）、`battle`（战/斗/杀）、`love`（感情）、`death`（死亡）、`travel`（抵达/前往）、`other`。
视图按 `kind` 过滤；`curve` 只吃 `breakthrough`。

## rel.json
```json
[{ "a": "林牧", "b": "苏青", "w": 812, "first": 3, "last": 1180 }]
```
`w` 为两人在同一章共现的章数（权重）。只输出 `w >= 3` 的边，`a`/`b` 按名字排序去重。

## items.json
```json
[{ "name": "星痕剑", "type": "weapon", "count": 42, "owner": "林牧", "first": 9, "last": 900, "draft": true }]
```
`type`：`weapon` / `treasure` / `beast` / `other`。`owner` 由"名字附近 ±70 字内最常同现的人物"推断，**务必复核**；`draft: true` 表示未经人工确认，可整条删除或改写。

## places.json / geo.json
```json
// places.json
[{ "name": "星河城", "group": "default", "count": 210, "first": 1, "last": 900, "draft": true }]
// geo.json
{ "W": 1000, "H": 660, "nodes": { "星河城": { "x": 320, "y": 180, "group": "default" } } }
```
`geo.nodes` 才是地图真正使用的坐标；`autoGeo` 只是按首次出场顺序做了环形+抖动布点，**想要真实地理感必须手改 x/y**。`group` 相同的节点会用同色。

## love.json
```json
[{ "ch": 88, "a": "林牧", "b": "苏青", "formal": true, "what": "亲密事件摘要", "ctx": "原文摘录", "draft": true }]
```
`formal: true` 表示含成亲/双修/洞房等明确关系确立词；`false` 多为暧昧或误判，泳道视图会弱化显示。

## density.json
```json
{ "win": 25, "persons": ["林牧", "..."],
  "windows": [{ "from": 1, "to": 25, "cnt": 118, "items": [["林牧", 40], ["苏青", 32]] }] }
```
用于总览页的"人物密度曲线"和找异常章节（密度骤降可能是水章或分卷断点）。

## config.json（可选，手写）
```json
{
  "views": ["read", "plot", "rel", "map", "curve", "items", "love", "overview"],
  "disable": ["curve"],
  "start": "read"
}
```
`views` 同时决定**顺序**和**启用集合**（未列出的视图不渲染）；`start` 是默认打开的视图 id。
