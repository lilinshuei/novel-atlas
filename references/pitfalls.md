# 踩坑清单（按"症状"查）

## A. 地图类

| 症状 | 原因 | 修复 |
|---|---|---|
| 缩放后背景不动、节点漂走 | 背景层没进同一个变换组 | 全部图层进 `nwMapRoot`，在非 100% 态断言 |
| 缩小后留一大片空白、地图缩在角落 | `clampMap` 在 `z<1` 时把 tx/ty 置 0 | `z<1` 时居中；或最小缩放锁 100% |
| 地图文字被压斜、看着像坏了 | 对文字密集地图用了 CSS 3D 倾斜 | 改平面 + 辉光/落影，删掉 perspective/rotate |
| 飞入后目标偏了 | 祖先元素有 3D 变换，坐标系被污染 | 去掉祖先的 3D，或改用手算屏幕坐标 |
| 小地图看不见 / 点不到 | 被全局悬浮按钮遮挡，或被推出视口 | `position:fixed` 换角，用探针量几何 |
| 拖拽禁不掉，或缩放跟着失效 | 在冒泡阶段拦了事件，或连 `wheel` 一起拦了 | 在 `parentNode` **捕获阶段**拦 `mousedown`，别拦 `wheel` |

## B. 抽取/数据类

| 症状 | 原因 | 修复 |
|---|---|---|
| 章节标题丢了"第X章" | 章节正则只取了捕获组 | 保留整行做标题（本版已修） |
| 切不出章节，全书变成 1 章 | 章节标记不匹配（`卷一`/`Chapter 1`/`（1）` 等变体） | 检查 `lib/text.cjs` 的 `CH_PATTERNS`，补充正则 |
| 人物表里混进"低声""忽然"这类词 | 2-3 字 + 动作词的误判 | 提高 `--min-count`；或在 `persons.json` 里删掉误判项 |
| 器物 owner 全是同一个人 | 邻近窗口里主角出现频率压倒性高 | 手工改 `items.json` 的 `owner`，别指望自动修 |
| 感情线数量爆炸 | 每章都命中"感情类"关键词 | 只保留 `formal: true`，或在 `love.json` 里删条目 |
| 有一章 0 字 / 字数异常 | 分卷页、目录页被当成章节 | 在 `config.json` 里 `disable` 或直接在 `chapters.json` 删掉 |

## C. 构建/运行类

| 症状 | 原因 | 修复 |
|---|---|---|
| 打开 HTML 白屏 | 内嵌 JSON 里有 `</script>` | `build.cjs` 已做 `</` → `<\/` 转义；自己改模板时要保留 |
| 某视图空白但没报错 | 该视图 `requires` 里的数据是空数组 | 检查对应 `data/*.json` 是否有内容 |
| 导航栏少了一个视图 | `config.views` 里没列它 | 在 `config.views` 加上；或删掉 `config.views` 用全部 |
| 改了 `views/*.js` 没生效 | 忘了重新 `build` | 视图是构建期内联的，改完必须重新 build |

## D. 验证类（headless 浏览器）

| 症状 | 原因 | 修复 |
|---|---|---|
| verify 一直等不到页面就绪 | 数据块 JSON 坏了，boot 抛错 | 先 `build` 看自校验有没有过；再手动开一次看 console |
| 断言脚本整段 SyntaxError | 在 `Runtime.evaluate` 里写了 `await` | 断言表达式保持同步；异步用轮询取结果 |
| 跳章断言失败但页面看着正常 | `jumpTo` 内部有 `setTimeout`，读得太早 | 等 200ms 再读（`scripts/verify.cjs` 已内置） |
| 多尺寸测完只有第一个尺寸对 | 改尺寸后没 reload，首屏布局没重算 | 换尺寸后 reload，或至少重新触发一次视图 `show` |
| Windows 下 `getUserMedia`/字体差异影响截图 | headless 环境与真实浏览器不同 | 截图只作参考，结论以 DOM 断言为准 |

## E. 在 Windows / PowerShell 下跑本工具

| 症状 | 原因 | 修复 |
|---|---|---|
| 终端看不到 node 的 stderr 输出，只剩一行 | PowerShell 把 native 进程 stderr 包成 CLIXML | 用 `node script.cjs > out.log 2> err.log` 再读文件，或改用 Node 的 `spawnSync` 捕获 |
| 中文路径报错 | 编码/引号问题 | 路径统一加双引号；Node 内部全程 UTF-8，路径不用转义 |
| 技能目录报错时显示成别的盘 | 该目录是软链接，报错显示的是真实路径 | 不是错误，按真实路径找文件即可 |
