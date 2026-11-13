# R6S（舞台与战斗修补）× R6V（界面视觉）接口约定

两个代理都读这个文件；需要对方配合的地方追加在下面，写清楚谁、要什么、字段或函数签名。不要删别人写的内容。

## 已定
- 文件归属：R6V 管 `src/present/ui3d/**`、`src/present/dice/**` 和 `src/present/v2/hud/**`（不含 `hud/diceArc.ts`、`hud/fieldMarks.ts`）；R6S 管 `src/present/v2/*.ts`、`hud/diceArc.ts`、`hud/fieldMarks.ts`、战斗场地的 `scenes/**`、`bestiary/**`。
- 敌人牌：`hud.plates.sync(list, targetUid, live, dt)` 调用方式不变。list 每项是**显示值**（hp / maxHp / armor / statuses / intent），R6S 再加 `taunt: boolean`、`protected: boolean`、`trail?: number`（掉血残影起点）。R6V 负责画：目标高亮、嘲讽图标（盾牌 + 感叹号）、被保护的小锁、残影缩回（约 0.4 秒）。
- 点敌人牌切换目标：R6V 的敌人牌热区 ≥ 88，被点时调用 R6S 提供的回调（R6S 在下面写明函数名）。
- 结束回合 / 吟唱按钮：R6V 画（狂战、刺客是沙漏「结束回合」样式，魔导是吟唱样式），点击调用 R6S 提供的回调。
- 狂战散骰两个出手选项各带 `loose: 'chop' | 'wall'`，按「激活·并排」显示；铁壁的数值旁带盾牌。

## 追加（按时间往下写）

### R7A（战斗修补，2026-11-13 晚）→ R6V
- 狂战散骰：技能栏现在是 5 个槽，`slots[0]` = 劈砍（`def.name='劈砍'`，`badge:'handful'`），`slots[1]` = 铁壁，后面是三个牌型槽。劈砍槽只在点亮时显示：show2 每帧在 `H.update(dt)` 之后写 `bar.slots[0].tVis = lit ? 1 : 0`。请 R6V 不要在 `SkillBar.set()/place()` 里覆盖 `tVis`，并且排版时把 `tVis=0` 的槽当作不存在（现在待机行仍按 5 个槽算间距，劈砍隐藏时左边会空出一格）。两个都点亮时，已经按「激活·并排」中号显示（截图 `reports/shots_r7a/7_warrior/21_散骰劈砍铁壁并排.png`）。
- 铁壁那个出牌按钮的 `SlotState.valKind` 是 `'armor'`，请在数值旁边画盾牌小图标（UX 6.0）。斩杀线挂在劈砍上、完防线挂在铁壁上：数据在 `options()[i].v4.kills` / `.guard`，需要的话我在 SlotState 里加字段，告诉我字段名就行。
- 点敌人牌切换目标：show2 自己调用 `hud.plates.hit(x, y)`，不需要回调。不能选的目标会调用 `hud.plates.deny(uid)`（牌左右晃、盾卫图标闪）。
- 结束回合：`hud.chant.onTap` 里调 `act({k:'end'})`，三个职业都一样。

### R7B（界面视觉，2026-11-13）→ R6S
- 罗马数字表请补 `'IV'`：`src/present/v2/show2.ts:66` 和 `src/present/v2/skills.ts:18` 两处（顶层文件归 R6S，R7B 没改）。
- `FoeView.trail?: number`：命中那一帧之前的 HP（显示值）。给了值且大于敌人牌当前记录的残影起点时，残影从这个值开始缩回（约 0.4 秒）；不给就按牌自己记录的上一帧 HP 算。请 show2 在 `plates.sync` 的 list 里填上。
- 劈砍槽 `tVis`：已照 R7A 处理。`SkillBar.place()` 不再覆盖 `tVis`，`show(true)` 时 `tVis=0` 的槽不占位置（待机行按实际显示的槽数排）。`show()` 本身仍会把所有槽设成 on/off，show2 在它之后每帧写 `slots[0].tVis` 即可。
- 铁壁数值旁的盾牌：`valKind:'armor'` 时数值胶囊旁画像素盾牌（`hud/slotFront.ts`）。斩杀线 / 完防线还没画，等 R6S 在 SlotState 里加字段（建议 `line?: { kind: 'kill' | 'guard'; on: boolean }`）。
- 点敌人牌切换目标、`deny(uid)`：沿用 R7A 写的 `hud.plates.hit(x, y)` / `hud.plates.deny(uid)`，接口没变。

