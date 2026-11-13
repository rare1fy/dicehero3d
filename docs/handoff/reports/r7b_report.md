# R7B 报告：界面视觉（R6V 收尾）

日期：2026-11-13。所有改动未提交。tsc 零错误，`npx vitest run` 135 通过（1 todo）。构建：`VITE_ENTRY=v2 npx vite build --outDir dist/r7b`。三种尺寸截图的 `show2().errors` 都是 `[]`。

## 做了什么

- **像素格规范**：按钮外壳统一用 `PixPlate`。`ensure(W,H)` 按布局算出的格数现建外壳，静止时 1 体素 = 1 美术像素（1672x941 下 u=4）。宽和高都对上才复用旧外壳。
- **按钮加厚、按下手感**：按下时外壳 z 方向压成一半，同时往后退半个厚度。接触投影固定在底部，不跟着动。
- **重投钮**：改成像素八角石钮。记号是两段八角环追逐箭头（`rerollRows`），亮起时按 90° 一格一格转。灯条是绿灯。周围的小骰换成数字骰（`numeralDie`）。发光圈调弱（glowK 0.28），边框和记号不再乘发光，之前会过曝成白色。
- **吟唱 / 结束回合钮**：像素八角钮，吟唱环分 3 段，每段一个色组（`chantRingPix`）。按钮下方小字改用 Fusion Pixel。
- **方正像素字**：`PixPen.text` 加了 `thin`。字号小于 u 时用 1 设备像素描边，「口」这类字内部不会被描边封死。技能 tips、遗物 tips、金币数字、按钮小字都用 Fusion Pixel 12px 加像素画法（`paintCells`）。
- **状态行**：重写成像素牌。正面状态是金边八角牌，负面状态是红边方牌缺一角，超过 3 个折成「+N」。
- **血瓶数字**：改用方正数字，倍数按宽度自适应（1～2）。血瓶本体没改。
- **技能槽前景层**：拆到新文件 `slotFront.ts`，全部像素化：标签胶囊、数值胶囊（2 倍方正数字，位置下移到 size×0.2）、像素兽头、附加效果图标、匕首牌。`valKind` 不是伤害时（护甲 / 屏障 / 治疗），数值旁画对应小图标，铁壁那格画盾牌。
- **无牌型虚线盘**：像素画法，盘里显示数字骰面。
- **骰子六面数字**：核对过，`numFace` 已经接进 `suitFace`（`skin.plain`），六面都是数字，本轮没再改。
- **敌人牌**：目标红光、嘲讽图标、小锁、掉血残影原本就有像素画法。本轮给 `FoeView` 加了 `trail?: number`（契约里的残影起点）。
- **箭头**：短、长箭头已经是像素画法，本轮只截了特写核对。
- **劈砍槽隐藏（R7A 的要求）**：`SkillBar.place()` 只按 `tVis>0.5` 的槽排版，劈砍隐藏时待机行不会空出一格。布局缓存的 key 里加了 tVis，所以槽显隐变化时会重新排版。
- **主会话做好的部分保留不动**：HUD 左右贴边、左侧玩家区（`hud.ts` layout、`status.stack`）。

## 没做 / 交给别人

- **罗马数字补 'IV'**：只出现在 `src/present/v2/show2.ts:66` 和 `src/present/v2/skills.ts:18`，两处都是顶层文件，不归本轮改。已写进 `docs/handoff/R6_CONTRACT.md` 的「R7B」追加节，请 R6S 改。
- **`trail` 数据**：需要 show2 在 `plates.sync` 的 list 里填上，同样写进了契约。
- **斩杀线 / 完防线**：要等 R6S 在 SlotState 里加字段，契约里给了建议的字段名。

## 文件清单

新建：
- `src/present/v2/hud/pixMarks.ts`：重投记号、灯条、吟唱环、数字小骰
- `src/present/v2/hud/slotFront.ts`：技能槽前景层

修改：
- `src/present/v2/hud/pixPlate.ts`：ensure 精确格数、addVar、按下压缩
- `src/present/v2/hud/reroll.ts`、`src/present/v2/hud/chant.ts`、`src/present/v2/hud/status.ts`：重写
- `src/present/v2/hud/slot3d.ts`：精确格数，前景层交给 slotFront，去掉 foeHead
- `src/present/v2/hud/skillBar.ts`：tip、虚线盘像素化，排版跳过隐藏槽
- `src/present/v2/hud/topLeft.ts`：金币数字、遗物 tip
- `src/present/v2/hud/plates.ts`：`trail`
- `src/present/ui3d/pixDraw.ts`：`text` 的 `thin` 选项
- `docs/handoff/R6_CONTRACT.md`：追加 R7B 节

`git status` 里的其他改动（`hud/hud.ts`、`hud/pixCoin.ts`、`show2.ts`、`battleCamera.ts`、`stage.ts`、`src/platform/**`、`src/audio/**` 等）不是本轮改的，没有碰。

## 截图

目录 `docs/handoff/reports/shots_r7b/`。

改前（`before/`，1672x941）：
- `mage_1672.png`、`sel_1672.png`、`aimShort_1672.png`、`aimLong_1672.png`、`plates_1672.png`、`atlas_1672.png`
- 放大图：`zoom_play4x.png`、`zoom_reroll4x.png`、`zoom_plates.png`、`zoom_left.png`、`zoom_dice.png`

改后（`after/`，每张都有 `_1672x941`、`_844x390`、`_1920x866` 三种尺寸）：
- `mage_idle_*`、`mage_sel_*`、`aim_short_*`、`aim_long_*`、`after_hit_*`、`plates_*`、`warrior_idle_*`、`warrior_sel_*`、`rogue_sel_*`
- 特写：`btn_reroll_closeup.png`、`btn_play_closeup.png`、`arrow_short_closeup.png`、`arrow_long_closeup.png`、`plates_closeup.png`、`warrior_hud_closeup.png`、`hud_closeup.png`

`dbg/` 里是调试过程图，可以不看。

## 和效果图（TARGET_MOCKUP）的差距

- **技能图标的 3D 模型**（models3d）：体素大小没对齐 u，放大后和外壳的像素格对不上。
- **血瓶**：只把数字换成了方正数字，瓶身还是 `flaskArt` 原样，没有重画成像素瓶。
- **遗物、金币胶囊**：还是旧的 3D 圆角板，没换成像素外壳。
- **字体体积**：没做子集裁剪。`ui/font.js` 109KB，已经是烘焙子集（3942 字）。
- **手机尺寸（844x390）**：u 变小后，按钮下方小字和状态牌接近可读下限。能认出来，但比效果图挤。
- **斩杀线 / 完防线、罗马数字 IV**：等 R6S 配合，见上文。
