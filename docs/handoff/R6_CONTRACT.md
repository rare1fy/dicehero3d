# R6S（舞台与战斗修补）× R6V（界面视觉）接口约定

两个代理都读这个文件；需要对方配合的地方追加在下面，写清楚谁、要什么、字段或函数签名。不要删别人写的内容。

## 已定
- 文件归属：R6V 管 `src/present/ui3d/**`、`src/present/dice/**` 和 `src/present/v2/hud/**`（不含 `hud/diceArc.ts`、`hud/fieldMarks.ts`）；R6S 管 `src/present/v2/*.ts`、`hud/diceArc.ts`、`hud/fieldMarks.ts`、战斗场地的 `scenes/**`、`bestiary/**`。
- 敌人牌：`hud.plates.sync(list, targetUid, live, dt)` 调用方式不变。list 每项是**显示值**（hp / maxHp / armor / statuses / intent），R6S 再加 `taunt: boolean`、`protected: boolean`、`trail?: number`（掉血残影起点）。R6V 负责画：目标高亮、嘲讽图标（盾牌 + 感叹号）、被保护的小锁、残影缩回（约 0.4 秒）。
- 点敌人牌切换目标：R6V 的敌人牌热区 ≥ 88，被点时调用 R6S 提供的回调（R6S 在下面写明函数名）。
- 结束回合 / 吟唱按钮：R6V 画（狂战、刺客是沙漏「结束回合」样式，魔导是吟唱样式），点击调用 R6S 提供的回调。
- 狂战散骰两个出手选项各带 `loose: 'chop' | 'wall'`，按「激活·并排」显示；铁壁的数值旁带盾牌。

## 追加（按时间往下写）
