# 第六轮 · 舞台与战斗修补：三条横带 + 骰场 + 镜头取景 + 战斗反馈

工程：`C:\Users\liufengyun\Documents\GameProtos\dicehero3d`（Vite + TS + three.js 0.162），可玩切片 `#v2`（编排器 `src/present/v2/show2.ts`）。先读工程根 `CLAUDE.md` 第二节，再读同目录 `UX_V3.md`（重点 **§1b 的「三条横带」「骰场的做法」「镜头取景」**、§4、§8 和末尾「敌人站位」），用 Read 看 `ux_png\INDEX.md` 和 1.1～1.5、6.0～6.3、7.0～7.2 各张图、`TARGET_MOCKUP.png`。当前代码已提交为 `e3ef9d8`（出问题可以对比）。

## 背景
- 这一批修补原本交给了 Codex（任务单 `FIX6.md`，同目录），它做到一半被停了：新建了 `v2/hpDisplay.ts`、`v2/targeting.ts`、`v2/battleCamera.ts`、`v2/barrierDome.ts`、`v2/statusFlight.ts`、`scenes/battleGlow.ts`，改了 `show2.ts`、`overlay.ts`、`scenes/stage.ts`，进度和自述在 `fix6_report.md`。**用户说界面的事不放心交给 Codex**，现在由你接手：先把它的改动读一遍、构建截图看实际效果，好的留下，不对的重做，不必迁就它的写法。
- 用户刚看了试玩（第 6 版）的原话：「现在敌人和玩家的占位有点奇怪，跑屏幕边缘去了。骰子的位置也很诡异。你好好思考一下怎么保证骰子在场景中落下结果但是不影响场景中角色站位。」「镜头的高度要根据敌人的大小来调节，遇到大型敌人的时候，镜头得要再高一些，确保可以显示完整敌人。」

## 要做
1. **三条横带 + 骰场**（`UX_V3.md` §1b，核心）：
   - 舞台带：英雄在左、敌人在中右横向排开，都不贴屏幕边。
   - 骰场带：世界里一块固定的「骰场」地面（浅色石台或符文圈），在所有角色脚下前方、离镜头更近；里面 6 个预设落点槽排成微笑弧。骰子扔进分配好的槽，魔导留场骰占自己的槽。骰子屏幕尺寸 ≥ 72，中心距 ≥ 120。
   - 镜头取景求解：舞台带装下所有角色（含头顶敌人牌），骰场落在骰场带，HUD 带只有地面；俯角约 40°，大型敌人可到 45° 并拉高拉远，同时骰子按镜头距离放大。只在入场、召唤或新一波、大型敌人死亡时缓动重取景（约 0.6 秒）。
   - 开场入场：敌人从场地远端走进站位，错开 0.15 秒，走完才亮意图。
   - 要在 1672×941、844×390、1920×866 三种比例下都成立。现有 `v2/hud/diceArc.ts`（骰子落点）和 `v2/hud/fieldMarks.ts`（骰子上的世界标记）归你改，其余 `v2/hud/**` 不归你。
2. **`FIX6.md` 的第 1～3、5、7（刀鞘状态和魔导屏障）、8、9 条**：出牌瞬间扣血（血条只在命中帧变化）、当前目标（脚下红圈、点模型或敌人牌切换、热区 ≥ 88）、嘲讽（规则用引擎的 `canTarget` / `isTaunting`）、场景青色发光物撞色、刀用尽显示、魔导半球屏障、狂战散骰的劈砍 / 铁壁两个出手（`play(..., { loose: 'chop' })`）、选职业界面文案。
   - 敌人牌、按钮这些 **HUD 元件的长相**归另一个代理（R6V）。你负责逻辑和世界里的东西，按下面的约定把数据交给 HUD。
3. 结束回合：逻辑（点击后结束回合；魔导是吟唱）归你，按钮长相归 R6V。

## 引擎 v4.2 刚改完的几处（`core2_api.md` 的 v4.2 节）
- 除毒和灼烧以外，敌人所有直接伤害都先扣护甲（含首领法术）；施法类敌人的攻击意图现在显示为攻击 + 数值，不再是「施法」。
- 完防改为「本回合所有能挡的伤害都挡住」，在所有敌人行动完之后判定，所以「完防 +1 骰」的事件比以前晚，演出顺序要跟着调。
- 刺客刀鞘开局 2（`V4_PARAMS.rogueStartStrikes`），刀鞘槽数读引擎当前上限，不要写死 5。

## 和界面视觉代理（R6V）的约定
- R6V 同时在改 `src/present/ui3d/**` 和 `src/present/v2/hud/**`（`diceArc.ts`、`fieldMarks.ts` 除外），在做高清像素重绘、按钮加厚、HUD 贴边锚定。你不要改那些文件；它也不改你的。
- 敌人牌数据：保持 `hud.plates.sync(list, targetUid, live, dt)` 的调用方式。你在 list 的每一项里给出**显示用**的 hp / maxHp / armor / statuses / intent（来自 hpDisplay，不是引擎实时值），再加 `taunt: boolean`、`protected: boolean`、`trail?: number`（掉血残影的起点血量）。R6V 负责画出目标高亮、嘲讽图标、小锁和残影。把你最终的字段定义写进你的报告，并在 `C:\Users\LIUFEN~1\AppData\Local\Temp\claude\c07b67a416d9093a\e37cf6a1-c153-4c67-a425-40ff475cca1f\scratchpad\agents\impl\R6_CONTRACT.md` 里追加（两个代理都会读这个文件；需要对方配合时就写在这里）。
- 出牌按钮列表：沿用现在 show2 把 options 交给 hud 的方式；狂战散骰会出两个选项，各带 `loose: 'chop' | 'wall'`。

## 规矩
- 可以改 `src/present/v2/*.ts`（v2 目录顶层，不含 `hud/`，但含 `hud/diceArc.ts`、`hud/fieldMarks.ts`）、`src/present/scenes/**`（只限战斗场地）、`src/present/bestiary/**`（入场走路等动作需要时）。镜头要是在 `src/present/look/**` 里也可以改镜头相关部分，但不要改 `look/uiLook.ts`、`uiPass.ts`、`post.ts` 的画面参数。不要改 `src/core/**`（引擎代理正在改 v4.2）。不要 git commit，不要动 git，不要启动或关闭服务器，不要杀进程。新逻辑放新文件，单文件 ≤ 400 行（show2.ts 已经很长，别再往里堆）。
- `npx tsc --noEmit -p .`（你自己的文件零错误）、`npx vitest run`。
- 构建 `VITE_ENTRY=v2 npx vite build --outDir dist/r6s`。截图 `node tools/cap.mjs http://127.0.0.1:8812/r6s/index.html <输出目录> '<动作 JSON>' <宽x高> 1`（8812 端口已在服务整个 `dist/`；动作写法见 `tools/cap.mjs` 开头；`__dh.pick('mage'|'warrior'|'rogue', 7)` 进战斗，`__dh.bot(true)` 自动打）。**先把横带和骰场做出能看的版本、截图自查，再做别的**；每做完一块就构建截图。首领战、首领召唤后也要截。
- 截图放 `C:\Users\LIUFEN~1\AppData\Local\Temp\claude\c07b67a416d9093a\e37cf6a1-c153-4c67-a425-40ff475cca1f\scratchpad\agents\impl\shots_r6s\`；扣血时机截同一次出手的 3 帧（松手后 0.1 秒、命中瞬间、命中后 0.6 秒）。
- 交付：同目录写 `r6s_report.md`：做了什么、Codex 的改动哪些留了哪些重做了、文件清单、截图路径、没做到的。
