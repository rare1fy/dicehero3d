# 任务：地图选路（规则 + 地图界面）

## 用户原话
「然后，我要的地图选路环节怎么没有实现。」（早期定过「线性推进、不要岔路」，现在用户要选路，以这次为准。）
画面风格：主机游戏规格，参考《我的世界：地下城》（MCD）的任务 / 地图界面；UI 守 `docs/handoff/UX_V3.md` §6b 高清像素规范（横平竖直或正 45°，1u 描边，平涂 2～4 档，Fusion Pixel 像素字，不要矢量圆角和渐变）。

## 现状（先读）
- 规则：`src/core/v2/run2.ts`（`SLICE_NODES` 固定 4 站：普通两波 → 精英 → 商人 → 首领；`RunState.nodes`、`node`、`advance()`；存档 `Run2.restore`）。数据：`src/core/v2/data/`（敌人、经济 `ECON`）。机器人和模拟：`src/core/v2/bot2.ts`、`bot4.ts`、`sim.ts`、`simcli.ts`，测试 `tests/v2/`。
- 表现：`src/present/v2/show2.ts` 的 `nextNode()` / `enterBattle()` / `enterShop()` / `choices()`；菜单和存档 `src/present/v2/meta/`（menu.ts 菜单套件、save.ts 存档、screens.ts）；2D 叠层 `src/present/v2/overlay.ts`（像素面板 `panel`、像素字 `text`）。设计总表 `docs/GAME_DESIGN.md`。

## 要做
1. **规则（core）**：新建 `src/core/v2/map2.ts`：按种子生成第一章地图——约 7 层，每层 2～4 个节点，最后一层是首领；相邻层之间连线（不交叉、每个节点至少一条出路）；节点类型：普通战、精英、商人、营火（新：回复 30% 生命，或强化一个技能，二选一）、首领；精英和商人按层数限制出现位置（精英不在前 2 层、商人在中段至少出现一次、首领前一层放营火）。普通战的敌人波次从现有敌人里按层数变难（复用现有 waves 和 FIGHT 配置，别新造敌人）。`Run2` 改成「在地图上走」：`RunState` 存地图和当前位置，`reachable()` 给出下一步能去的节点，`travel(nodeId)` 前往；`Run2.restore` 兼容；旧的 `SLICE_NODES` 用法保留成开关（`nodes` 选项照旧能用，测试不坏）。
2. **机器人和模拟**：机器人选路（血少避精英、钱多去商人等简单规则）；三职业初始 / 成型各跑 200 局，报告新的通关率（目标仍是初始 60～85%、成型 ≥ 90%；掉出范围用数值调，不改机制），写进 `docs/handoff/core2_report.md` 新节「地图选路」。补测试：地图连通、节点类型约束、存档读档后位置不变、营火两种选择。
3. **地图界面**：新建 `src/present/v2/meta/mapScreen.ts`：每打完一个节点（以及开局）进地图，看到整章路线；当前位置、走过的路、能去的下一站要一眼分清（能去的节点有呼吸光 / 抬起，走过的路变亮，没走的暗）。节点用像素图标（剑、骷髅 / 双剑 = 精英、钱袋 = 商人、营火、王冠 = 首领），连线用像素点线（横平竖直或 45°）。点节点或键盘 / 手柄选中 → 节点信息小面板（类型、可能的奖励）→ 确认后有一小段行进（标记沿路线移动），再进入那个节点。键盘方向键 / 手柄十字键在可选节点间移动，Enter / A 确认；暂停键能打开暂停菜单。地图本身有一点 3D 感或纵深（例如地图平面略微后倾、近大远小），和 MCD 的任务地图一样有氛围，不要做成网页表格。
4. **接线**：`show2.ts` 里只改 `nextNode()` 的分支（进地图 / 进节点）和营火节点的入口，改动尽量小；营火界面用 meta/menu.ts 的菜单或新的面板。

## 规矩
- 文件范围：`src/core/v2/map2.ts`（新）、`src/core/v2/run2.ts`、`bot*.ts`、`sim*.ts`、`tests/v2/**`、`src/present/v2/meta/mapScreen.ts`（新）和 meta 下你新建的文件、`show2.ts` 的 `nextNode()` 一带。**不要碰** `src/present/v2/hud/**`、`src/present/ui3d/**`、`src/present/dice/**`、`src/present/bestiary/**`、`src/present/fx/**`（另外两个会话在改），也不要改 `meta/menu.ts`、`meta/screens.ts`（主会话在改它们的样式）。
- `npx tsc --noEmit -p .` 零错误、`npx vitest run` 全过。构建 `VITE_ENTRY=v2 npx vite build --outDir dist/map1`，截图 `node tools/cap.mjs http://127.0.0.1:8812/map1/index.html <输出目录> '<动作 JSON>' 1672x941 1`（8812 端口已在服务 dist/，不要启动或关闭它；动作写法看 `tools/cap.mjs` 开头；`__dh.pick('warrior', 7)` 开局）。截图放 `docs/handoff/reports/shots_map/`。新加中文字后跑 `npm run font` 重新烘焙像素字库。
- 不要 git commit，不要动 git，不要杀进程。全程中文。
- 交付：`docs/handoff/reports/map_report.md`（规则、接口、模拟结果、截图路径、没做到的）。完成后回复不超过 8 行要点。
