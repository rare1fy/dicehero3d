# 任务：技能动作 / 特效盘点并实现（战斗演出）

## 用户原话
「战士叠甲的防御技能怎么给配的一个进攻动画。你把相关的动效、特效也都盘点清楚安排一个子 AGENT 实现一下吧。」
项目目标（工程根 `CLAUDE.md`）：表现力向主机 3A 看齐——镜头语言、动画质量、打击感、因果可读性（效果从哪来、到哪去都看得见）、演出节奏。美术铁律：体素风，横平竖直的大块，不要斜线阶梯和随机碎点。

## 现状（先读）
- 演出编排：`src/present/v2/show2.ts`（技能出手那一拍：搜 `rowPlay`、`strike`、`hero.attack`、`hero.cast`、`fxImpact` 等；骰子飞向英雄 → 技能特效 → 命中）。职业状态特效 `src/present/v2/heroFx.ts`、魔导屏障 `barrierDome.ts`、状态飞行 `statusFlight.ts`、死亡 `death.ts`。
- 角色动作：`src/present/bestiary/battle.ts`（`BattleActor`：attack / cast / block / bleed / spin / hurt / roar / summon / cheer 等）。待机动画 `heroPose.ts`、`bactor.ts` **归另一个会话**，不要改。
- 特效库：`src/present/fx/fx.ts`（fxImpact、fxSparks、fxGlow、fxShield、fxHeal、fxRing、fxSmoke、fxStatus …）。
- 规则和技能：`docs/GAME_DESIGN.md`（三职业 13 个技能各档效果、职业机制、特殊骰、敌人）；技能数据 `src/core/v2/data/rows_v4.ts`；战斗事件 `src/core/v2/events2.ts`。

## 要做
1. **盘点**（先写 `docs/handoff/reports/fx_audit.md`）：逐个技能、逐档（单体 / 群体 / 终极）、逐个职业机制和敌人动作，列成表：现在英雄做什么动作、出什么特效、命中 / 结算怎么表现、对不对、要改成什么。至少覆盖：
   - 狂战：劈砍（攻击）、**铁壁（防御：举斧横挡 / 顿地起盾，护甲盾在身前凝成，不能是攻击动作）**、顺劈斩（横扫，溢出转移的轨迹）、盾冲（冲撞 + 眩晕星）、血战（斩 + 挡一起）、卖血（割血、血怒层数）、斩杀再动（怒火骰落下、「再动」）、完防（盾牌闪光、伤害 0）。
   - 魔导：奥术弹、冰锥 / 冰环（冻结冰壳）、闪电链（弹射路径逐个跳）、陨石（从天而降、灼烧）、吟唱（不出手时的蓄力姿态和环）、小咒 vs 释放（释放要有明显的大招蓄力和爆发）、屏障、反噬。
   - 刺客：袖箭（甩手飞刀）、背刺（瞬移到身后再刺）、处决（慢动作 + 斩杀）、影步（残影位移、补暗影骰）、影舞（多段全体）、连击第 N 刀的加速感、末刀。
   - 通用：轻 / 中 / 重命中分级（顿帧、震屏、闪白、击退）、暴击、格挡、护甲碎、中毒 / 灼烧 / 冻结 / 眩晕的身上表现、治疗、敌人攻击（近战冲上来、远程施法）、召唤、死亡（击倒 / 击碎，已有）。
2. **实现**：新建 `src/present/v2/skillStage.ts`：一张「技能（含档位）→ 英雄动作 + 起手特效 + 飞行 / 路径 + 命中特效 + 镜头 / 顿帧」的编排表，`show2.ts` 技能出手那一拍改成查这张表（只改那一处调用，其余编排不动）。缺的动作在 `bestiary/battle.ts` 里加（例如 `guard()` 防御、`chant()` 蓄力、`dash()` 位移、`throwKnife()`），缺的特效在 `fx/**` 里加。防御类技能（铁壁、屏障、完防）一律用防御 / 蓄力类动作，绝不用攻击动作。
3. 每改完一类就构建截图（或录短片）自查：`VITE_ENTRY=v2 npx vite build --outDir dist/fx5`，`node tools/cap.mjs http://127.0.0.1:8812/fx5/index.html <输出目录> '<动作 JSON>' 1672x941 1 [vt]`（`vt` = 虚拟时钟逐帧录；动作写法看 `tools/cap.mjs` 开头；`__dh.pick('warrior'|'mage'|'rogue', 7)` 开局，`__dh.bot(true)` 自动打）。关键技能截「起手 / 命中 / 余韵」三帧或录 webm。截图放 `docs/handoff/reports/shots_fx5/`。

## 规矩
- 文件范围：`src/present/v2/skillStage.ts`（新）、`src/present/fx/**`、`src/present/bestiary/battle.ts`（只加动作，不改现有动作的手感，除非盘点里写明为什么）、`show2.ts` 里技能出手那一拍的调用。**不要碰** `bestiary/heroPose.ts`、`bestiary/bactor.ts`、`src/present/v2/hud/**`、`src/present/ui3d/**`、`src/present/dice/**`、`targeting.ts`、`fieldMarks.ts`、`hpDisplay.ts`（另一个会话在改），也不要改 `src/core/**`、`src/present/v2/meta/**`。
- `npx tsc --noEmit -p .` 零错误、`npx vitest run` 全过；性能：每帧 draw call 别比现在多出太多（特效用完就回收）。
- 不要 git commit，不要动 git，不要启动或关闭服务器（8812 已在服务 dist/），不要杀进程。全程中文。
- 交付：`docs/handoff/reports/fx_report.md`（盘点表路径、改了什么、文件清单、截图 / 短片路径、没做到的）。完成后回复不超过 8 行要点。
