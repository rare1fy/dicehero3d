# 交接提示词：六面史诗 3D · 第六轮（2026-11-13 晚）

> 给接手的人（新的 Claude Code 会话，或 onehub / opencode 代理）。先把这份读完，再读同目录的 `UX_V3.md`（界面规范，最高依据之一）和工程根 `CLAUDE.md`。所有沟通用中文。

## 1. 项目和用户
- 工程：`C:\Users\liufengyun\Documents\GameProtos\dicehero3d`（Vite + TypeScript + three.js 0.162）。用户自己的 2D 骰子肉鸽《六面史诗》的 3D 化，个人项目；用户是资深游戏策划，对表现要求高，反馈很具体。
- 可玩切片入口 `#v2`：编排器 `src/present/v2/show2.ts`，规则引擎 `src/core/v2/`（Battle2 / Run2 / bot），HUD `src/present/v2/hud/`，UI 层 3D 部件 `src/present/ui3d/`，骰子 `src/present/dice/`，角色 `src/present/bestiary/`，场景 `src/present/scenes/`，画面后处理 `src/present/look/`。
- 试玩链接（只有 Claude Code 能发布）：https://claude.ai/artifact/QpPjsJDSdWNwiwsyBKGDLT ，当前第 8 版。
- Figma：https://www.figma.com/design/dvBiHsxXoIkbNA9bnolRUX 。页面「版式 v2（手机握持）」= 最新布局；「战斗 UX」= 各屏交互说明（布局以版式 v2 为准）；「组件」= 组件库。逐屏导出图在同目录 `ux_png/`（先读 `ux_png/INDEX.md`）。

## 2. 硬规则
- 不要 `git push`。提交只在本地 main，提交信息末尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。**子代理不提交**，由主会话提交。
- **不要杀任何进程**：机器的 GPU 常被用户的语音任务占满（截图慢是正常的）。只有自己启动且确认过命令行的进程才能停。
- 不要读取或打印 onehub 的 key。用 opencode 时不要加 `--auto`（会被拦）。
- 界面 / 表现类的活不要交给 Codex（用户：「界面的事情还是你和你的子代理来干，codex干我不放心」）。子代理网络常断时，用户同意主会话直接自己做，或用 onehub（`opencode run -m onehub/claude-opus-5.5 --title <名字> "<提示词>"`，在工程目录里跑；`-s <session>` 续上一个会话）。
- 用户的设计原则：「机制问题不要给数值问题让步，能数值解决的问题就不要随便去动机制」。规则改动必须用户拍板；表现层可以自己想办法做到最好。
- 美术铁律：体素风，横平竖直的大块，不要斜线阶梯和随机碎点（正 45° 的 1:1 台阶可以）。
- 发布前在严格安全策略下测（页面禁止 fetch，data: 也不行）：8812 端口已经在服务整个 `dist/`（`tools/csp_serve.py`），不要启动或关闭它。

## 3. 命令
- 类型检查 `npx tsc --noEmit -p .`；单测 `npx vitest run`（当前 135 通过 + 1 todo）。
- 构建 `VITE_ENTRY=v2 npx vite build --outDir dist/<名字>`（PowerShell：`$env:VITE_ENTRY='v2'; npx vite build --outDir dist/<名字>`）。
- 截图 `node tools/cap.mjs http://127.0.0.1:8812/<名字>/index.html <输出目录> '<动作 JSON>' <宽x高> 1`。动作写法见 `tools/cap.mjs` 开头。常用：`{"waitFor":"window.__dhready","ms":30000}`、`{"eval":"__dh.pick(\"mage\",7)"}`（mage / warrior / rogue）、`{"eval":"__dh.show2().goto(\"boss\")"}`（normal / elite / boss / shop）、`{"eval":"__dh.bot(true)"}`、`{"json":"JSON.stringify(__dh.show2().errors)","file":"errs.json"}`。
- 每次给用户看都截三种尺寸：1672×941、844×390（手机横屏）、1920×866（用户浏览器的宽屏）。
- 发布（Claude Code）：把 `dist/<名字>/index.html` 复制成 scratchpad 里的 `pub_v2/v2_battle.html`，`<title>` 改成「六面史诗 v2 试玩」，用 Artifact 工具发布到上面的链接。

## 4. 已经定下来的（摘要，细节见 `UX_V3.md`、`design/DECISIONS_V4.md`、`core2_report.md`）
- 规则 v4.3：三职业四个牌型技能（散骰 / 同点 / 连环 / 阵列）。散骰是**排他**牌型（选中的骰子整体不成型才算）；狂战散骰 1～3 颗，二选一「劈砍（伤害）/ 铁壁（护甲，点数和 × 0.9）」，血量 90；魔导囤骰（留场、每回合补 1、≤3 颗小咒照样吟唱、≥4 颗释放）；刺客连击：刀鞘 = 每回合出手上限，**开局 2**，「刀鞘 +1」卡到 5，觉醒到 6；护甲挡所有直接伤害（含首领法术），**毒和灼烧无视护甲和屏障**；完防 = 本回合所有能挡的伤害都挡住；敌人距离已去掉；盾卫嘲讽（单体只能打盾卫）。
- 刀鞘表现：只减不增，末刀橙边，刀尽全灰「刀尽」，不庆祝「满连击」。
- 三个职业都有结束回合按钮（魔导的就是「吟唱」）。
- 站位：**经典站位**——英雄在左前，敌人在对面顺着小路往远处排（用户否掉了横向站位和场景里的骰子台）。骰子落在**英雄和敌人之间**的地面上，6 个不可见的固定落点（`src/present/v2/diceField.ts` + `battleCamera.ts`），按镜头距离缩放。镜头遇到大型敌人会同角度拉远（上限 1.4 倍）。
- HUD：左右两组**贴屏幕安全区边缘**（`hud.ts` layout：L0 = 安全区左边，R0 = 右边）；左侧「玩家区」= 重投 + 血瓶 + 状态（状态两行在血瓶右边，`status.stack`）；右侧 = 技能栏 + 结束回合。
- 画面：场景默认像素 3×（`look/pixel.ts`），UI 单独原生分辨率渲染（`look/uiPass.ts`、`uiLook.ts`：UI 周围暗晕 + 加粗描边 + 底带压暗）。曝光和英雄自发光已调低（白色不再糊）。
- 用户要的 UI 美术方向：**高清像素规范**（`UX_V3.md` §6b：美术像素单位 u，横平竖直 / 正 45°，平涂 2～4 档，1u 描边）、按钮有厚度（§5b，挤出 ≥ 宽度 35%）、字用方正的像素字（Fusion Pixel 12px，OFL，`_ref/px3d/pit_fonts/`）、骰子六面都写数字、瞄准箭头照炉石（等距 V 形节、流动）。

## 5. 剩下的活（按优先级）
### A. 战斗修补（任务单 `R6S.md` 的第 2、3 条；站位 / 骰场 / 镜头那第 1 条已经由主会话做完）
Codex 做过一半（`hpDisplay.ts`、`targeting.ts`、`barrierDome.ts`、`statusFlight.ts`、`scenes/battleGlow.ts`，进度见 `fix6_report.md` 和 `FIX6.md`），**先构建截图核实每条现在的实际效果，没做到的补上**：
1. 出牌瞬间敌人就扣血 → 血条 / 护甲 / 状态图标只在命中帧变化，掉血留残影；敌人牌在死亡动画后才撤。验收截同一次出手的 3 帧。
2. 当前目标：脚下红圈 + 敌人牌提亮；点模型或敌人牌切换（热区 ≥ 88）；切换后预计伤害 / 斩杀线刷新。
3. 嘲讽表现：盾卫牌上盾牌图标、被保护的牌上小锁；点被保护的敌人不切换并提示「先打盾卫」；箭头指到它上面变灰 + 锁。规则接口 `canTarget(uid)` / `isTaunting(uid)`。
4. 结束回合按钮：三个职业都能点（魔导 = 吟唱）；没合法出手时自动结束。
5. 魔导屏障：贴地半球能量罩（不是透明方盒）；中毒扣血时不要表现成屏障挡住了。
6. 刺客刀鞘：槽数读引擎当前上限（开局 2），刀尽状态正确（之前截图里刀用完了还显示满）。
7. 狂战散骰：选成散骰时「劈砍」「铁壁」两个中号按钮并排（`play(..., { loose: 'chop' })`，默认铁壁）；选中一对只出顺劈斩。
8. 选职业界面文案换成 v4 说法（`FIX6.md` 第 9 条）。
9. 场景里青色发光蘑菇和 UI 青色撞色：战斗场地里调暗、偏色（`FIX6.md` 第 5 条）。
10. 骰子落点：魔导囤到 5～6 颗时最左边那颗不要压到英雄（`battleCamera.ts` placeField 的中心 x、`diceField.ts` GAP）。
### B. 界面视觉（任务单 `R6V.md`）
界面视觉代理和它派出的 4 个子代理都因为断网死了，留下了**做了一半**的文件：`ui3d/pixelGrid.ts`、`pixDraw.ts`、`pixMesh.ts`、`pixDigits.ts`、`flaskArt.ts`、`dice/numFace.ts`（骰面数字，还没接进 `ui3d/suitFace.ts`）、`v2/hud/pixParts.ts`、`pixIcons.ts`、`pixPlate.ts`、`platePaint.ts`、`plateDemo.ts`、`arrow.ts` + `arrowParts.ts`（炉石式箭头，基本完成）、`slot3d.ts`。工程目前能编译、机器人能打通，但这些部件的完成度不一，**先逐个构建截图看现状**，再按 `R6V.md` 补完：像素格、按钮加厚、像素字、骰子六面数字、敌人牌、血瓶、箭头短 / 长两张特写。
### C. 之后
- Figma「版式 v2」按实际实现同步位置（Figma 用 Figma MCP；`use_figma` 是原子的，失败整次回滚）。
- `CLAUDE.md` 第三节定稿表、第五节展示记录补上这几轮；给用户看的构建打 tag（下一个是 `show-11`）。
- 用户点名的实验（别的问题都解决后）：一版「骰子不落进场景，直接在 UI 层浮空 roll 点」的做法，做成开关和现在的对比。
- 用户问过平台：网页现在可用；微信 / 抖音小游戏构建（`npm run build:minigame`）还没接 v2 入口，也没在沙盒里跑过；绘制调用约 250 / 帧，手机预算 150。

## 6. 文件地图（本目录）
`UX_V3.md` 界面规范 · `R6V.md` 界面视觉任务单 · `R6S.md` 舞台与战斗修补任务单 · `R6_CONTRACT.md` 两者的接口约定 · `FIX6.md` 修补单原文 · `core2_api.md` / `core2_report.md` 引擎接口和模拟报告（v4～v4.3）· `design/` 规则和职业设计、决策记录、Figma 版式计划 · `ux_png/` Figma 逐屏导出 · `TARGET_MOCKUP.png` 用户认可的效果图。
