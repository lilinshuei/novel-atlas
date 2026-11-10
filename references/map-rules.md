# 世界地图渲染铁律

地图是这类看板里**踩坑最多**的模块。以下每一条都是被真实 bug 换来的。

## 1. 所有图层必须挂在同一个变换组下

```
<g id="nwMapRoot" transform="translate(tx,ty) scale(z)">
  ├─ 背景（海/陆/网格/罗盘/标题）
  ├─ 连线（路线/势力边界）
  ├─ 节点（城市/据点）
  └─ 装饰（辉光/落影）
</g>
```
只要有一层挂在 root 外面（比如背景直接是 svg 子节点），缩放时**背景不动、节点漂走**。
这个 bug 有个恶劣特征：**100% 缩放下完全看不出**，一缩放立刻露馅。所以断言必须在非 100% 缩放态跑（`scripts/verify.cjs` 已内置滚轮缩放断言）。

## 2. clampMap：缩小时必须居中，不能置 0

```js
if (z >= 1) {
  // 贴边夹取，防止把地图拖出视口
  tx = Math.min(0, Math.max(W - W * z, tx));
  ty = Math.min(0, Math.max(H - H * z, ty));
} else {
  // 缩小：居中，绝不能 tx=ty=0
  tx = W * (1 - z) / 2;
  ty = H * (1 - z) / 2;
}
```
最稳的做法是**最小缩放锁定 100%**（刚好铺满），彻底消灭"缩到角落留一片空白"。

## 3. 光标锚点缩放数学

```js
const k  = mapW / rect.width;              // SVG 单位 / 屏幕 px
const ox = (clientX - rect.left) * k;
const oy = (clientY - rect.top)  * k;
const f  = z / oldZ;
tx = ox - (ox - tx) * f;                   // 让光标下的那个地图点保持不动
ty = oy - (oy - ty) * f;
```

## 4. 飞入居中

```js
txEnd = W / 2 - x * z;
tyEnd = H / 2 - y * z;
```
用 rAF + easeInOut 缓动，不要 CSS transition（会和滚轮缩放抢变量）。

## 5. 高质感靠光，不靠 3D

- 用辉光 / 流光 / 落影 / 细描边营造层次。
- **绝对不要对文字密集的地图做 `perspective` / `rotateX` / `rotateY`**：文字被压斜像坏图，飞入居中的数学也会错位。
- 平面零几何变形 + 好的阴影，才是"精致"。

## 6. 小地图

- 位置：左下或左上，`position:fixed`，**避开右下全局悬浮按钮、右上信息卡**。
- 视口框：`x0 = -tx/z, y0 = -ty/z, w = W/z, h = H/z`。
- 点击小地图 → 屏幕坐标反算回 SVG 坐标 → `flyTo`。
- 188px 缩略图里，节点半径要放大到 ≈13、视口框 `stroke-width ≈ 8` 才看得清。

## 7. 拖拽与缩放要能分开控制

- 想禁拖但保留缩放：在 `box.parentNode` 的**捕获阶段**拦 `mousedown` 并 `stopPropagation`。
- **不要拦 `wheel`**，否则光标锚点缩放会一起失效。

## 8. 响应式分两条路，不要混用

- `isPC = innerWidth > 820`；PC 与手机走完全独立的渲染分支。
- 手机端：放大阅读模式 + 底部抽屉 + 触摸平移 + 横向滚动工具条。
- 尺寸切换后**必须 reload**，否则从 PC 缩到手机尺寸时首屏布局不会重算。

## 9. 数据侧：geo.json 才是真的

`autoGeo` 只按首次出场顺序做环形 + 抖动布点，**没有地理含义**。
要真实的地理感（北方冰原、南方雨林、中原腹地），直接手改 `data/geo.json` 里每个节点的 `x/y`，改完 `build` 即可，不需要碰代码。
