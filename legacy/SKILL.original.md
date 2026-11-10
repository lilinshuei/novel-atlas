---
name: novel-workbench
description: 构建或优化「小说看书工作台 / novel reading workbench」——为某本小说/书籍生成单文件 HTML 交互看板（世界地图、人物关系球/矩阵、成长曲线、感情线时间轴、战力/评级阶梯、明暗线等）。当用户要新建、扩展或修复一个大型交互式小说阅读伴侣，尤其是**源 HTML 是 10MB+ 的编辑器生成巨文件、绝不能亲手改**时使用。内含：注入式构建管线、单变换组地图原则、光标锚点缩放、飞入居中、小地图、PC/手机分路、以及 headless-Edge CDP 验证骨架。也适用于任何「在超大生成式 HTML 上安全地增量增强」的前端任务。
---

# 小说看书工作台 · 构建与优化方法论

## 0. 何时用本 Skill
用户要做/改一个**单文件 HTML 的「小说看书工作台」**：世界地图、人物关系球/矩阵、成长曲线、感情线时间轴、战力/评级阶梯、明暗线等。
典型特征：源 HTML 是**编辑器生成的 10MB+ 巨文件，绝不能直接改**。本 Skill 提供可复用的工程方法，避免每版重走一遍坑。

## 1. 核心架构（两条铁律）
- **注入式构建管线 `_build.cjs`**：源模板只读，所有增强拆成 `_v2/*.js` + `_v2/*.css`，用标记注入产出新文件。每次注入用 `if(!s.includes(marker))` 幂等保护，跑完做自校验数组（见 `build_template.cjs`）。
- **装饰不修改内核**：用 `const OLD=fn; fn=function(){OLD(); enhance();}` 包住原 `buildMap/buildLove/v2MapTransform`，加行为而不碰核心代码。配合注入管线，核心文件一行都不动。

## 2. 世界地图渲染铁律（踩坑最多的地方）
1. **所有图层必须挂在同一个 `<g id="v2MapRoot">` 下**，由 `v2MapTransform()` 统一 `translate/scale`。背景(海/陆/罗盘/标题)、路线、节点**全部是 root 的子节点**——否则缩放/飞入时图层错位（背景不动、路线漂走，平时 100% 看不出，一缩放就露馅）。
2. **clampMap**：`z≥1` 贴边夹取防丢图；`z<1` **居中**（`mapTx=W*(1-z)/2`），绝不能置 0（会顶到左上角留大片空白）。最稳的是「最小缩放锁 100%（刚好铺满）」。
3. **禁拖但保留缩放**：在 `box.parentNode` 捕获阶段 `mousedown→stopPropagation` 让原拖拽监听失效；**不拦截 wheel**，保留光标锚点缩放。
4. **光标高质感**：用辉光/流光/落影，**绝不对文字密集地图做 CSS `perspective/rotateX/rotateY`**（文字压斜像坏图，且飞入居中数学错位）。平面零几何变形才是「精致感」的正确解法。
5. **装饰辉光要进 root**：辉光层若挂在 box 固定层，缩放时不跟地图走，加重「背景没动」观感——放进 map 内部随变换。

## 3. 缩放/平移数学（光标为锚）
```js
k  = mapW / rect.width;                       // SVG 单位 / 屏幕px
ox = (clientX - rect.left) * k;
oy = (clientY - rect.top)  * k;
f  = z / old;
mapTx = ox - (ox - mapTx) * f;                // 以光标处的地图点不动为锚
mapTy = oy - (oy - mapTy) * f;
mapZoom = z; v2MapTransform();
```
飞入居中目标：`txEnd = W/2 - x*z; tyEnd = H/2 - y*z;`（rAF 缓动，easeInOut）。

## 4. 小地图
- `position:fixed` 左下（避开右下全局 FAB、右上信息卡）；**必须在 transform 祖先以外或随视图隐藏**，并用探针确认在视口内（见复盘）。
- 视口框：`x0=-mapTx/z, y0=-mapTy/z, w=W/z, h=H/z`；点击→屏幕坐标反算 SVG 坐标→`flyToPoint`。
- 188px 缩略图里地点半径要放大(≈13)、视口框 `stroke-width≈8` 才看得清。

## 5. 响应式分两条路
- `isPC = innerWidth>820`；PC 走 `v6_pc.js`，手机(≤820)走 `v5_*`，**完全分离不混用**，各自在 `buildMap/buildLove` 装饰里按 `isPC` 决定是否增强。手机端单独做放大阅读模式 + 底部抽屉 + 触摸平移 + 横滚工具条。

## 6. 真浏览器验证（headless Edge CDP，零依赖）
- 自启 `msedge --headless=new --remote-debugging-port=PORT`，WebSocket 连 `webSocketDebuggerUrl`，`Runtime.evaluate` 跑页面内断言（见 `verify_template.cjs`）。
- 注入 `window.__errs` 捕获运行时报错；多尺寸 **reload**（1440 桌面 + 390/360/768 手机，手机必须 reload 才从首屏生效）。
- **断言要在非 100% 缩放态跑**（图层错位只在缩放后暴露）；几何用探针量（小地图位置、飞入居中误差 <14%）。
- exit code = 失败数 + 报错数，CI 友好。

## 7. 踩坑清单（复盘）
| 坑 | 表现 | 修复 |
|---|---|---|
| 背景层没进 root | 缩放后背景不动、路线漂离 | 全图层进一个 transform 组 + 非 100% 断言 `baseInRoot` |
| clampMap 在 z<1 置 0 | 缩到角落留大片空白 | z<1 居中 / 最小锁 100% |
| CSS 3D 倾斜文字密集地图 | 文字压斜像坏图、居中数学错位 | 平面高质感(辉光/落影) |
| 验证脚本 `await` 写非 async 上下文 | 整段 SyntaxError 全 FAIL | 断言表达式保持同步 |
| 小地图被全局 FAB 遮挡/推出视口 | 看不见/点不到 | 探针量几何 + `position:fixed` 左下 |
| 只在 100% 态测 | 漏掉缩放后错位 | 缩放态 + 飞入态各跑断言与截图 |

## 8. 资产文件
- `build_template.cjs` — 注入式构建模板（幂等 + 自校验数组）
- `verify_template.cjs` — headless Edge CDP 验证骨架
- `map_core.js` — 可复用地图原语（transform / clamp / 光标锚点缩放 / flyTo / minimap / 禁拖保留缩放）
