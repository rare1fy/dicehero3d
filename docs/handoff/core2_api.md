# core2 对外接口（规则 v2 引擎）

> 状态：v0.2，已按实际代码核对（04:45）。之后有变动会改这里，并在文末「变更记录」写一笔。
> 位置：`src/core/v2/`。纯规则层，不碰 three / DOM，确定性（同种子同结果）。入口 `src/core/v2/index.ts`。

## 文件
| 文件 | 内容 |
|---|---|
| `src/core/v2/types.ts` | 全部类型（Suit、Face、Die、RowDef、TabletDef、Loadout、Enemy……） |
| `src/core/v2/data/classes.ts` | 三职业 ClassDefV2（花色表、稀有 / 王牌、普攻、机制开关） |
| `src/core/v2/data/rows_warrior.ts` / `rows_mage.ts` / `rows_rogue.ts` | 每职业的行（RowDef）和碑（TabletDef） |
| `src/core/v2/data/talents.ts`、`relics.ts`、`enemies.ts` | 天赋；遗物（含 `ECON` 商店 / 营火数值、`xpToNext`）；敌人（含狼人首领、`FIGHT_SCALE`、`DROPS`、`JUNK`） |
| `src/core/v2/data/util.ts`、`data/index.ts` | 档位累积 `ladder()`、改写 `evo()`；`loadoutA / loadoutB / slotRow / addableRows / ROWS / TABLETS` |
| `src/core/v2/cond.ts` | 条件判定和档位查表（纯函数） |
| `src/core/v2/events2.ts` | 事件类型 `Ev2` |
| `src/core/v2/battle2.ts` | `Battle2` 战斗引擎、`kindValues / kindSuit / buildBoard` |
| `src/core/v2/run2.ts` | `Run2` 一局（4 节点原型切片）、`SLICE_NODES` |
| `src/core/v2/bot2.ts`、`sim.ts` | 机器人和批量对局统计 |

## 骰子
```ts
type Suit = 'axe'|'blood'|'fury' | 'star'|'moon'|'sun'|'void' | 'poison'|'blade'|'shadow' | 'none';
type DieKind = 'normal'|'furyDie'|'titanDie'|'starDie'|'shadowDie'|'cracked'|'cursed';
interface Face { value: number; suit: Suit }        // value 0..6（诅咒骰 0）
interface Die { uid: number; kind: DieKind; face: Face; persist: 'turn'|'untilUsed'|'retained'; source: 'base'|'earned'|'mechanic'|'enemy'; carried: number }
kindValues(kind): number[]            // 这种骰子能掷出的点数（星辰骰 2/2/4/5/6/6、裂骰 1～2……）
kindSuit(classId, kind, value): Suit  // 点数 → 花色（怒火骰 1～2 血、3～6 怒；暗影骰恒为影）
```
- 骰面画法只需要 `face.value`、`face.suit`、`kind`（特殊骰换材质）。
- `persist === 'retained'`：魔导吟唱保留的骰子（UI 上绕吟唱环）；`untilUsed`：怒火骰 / 暗影残骰（留到下回合）。

## 条件判定（cond.ts，纯函数）
```ts
tierOf(rule: TierRule, count: number): TierName | null           // 'single'|'feed'|'area'|'earn'|'ultimate'
stepOf(rule: TierRule, count: number): { min, tier, label, idx } | null   // 落在第几盏档位灯（idx = steps 下标）
matchRow(row: RowDef, faces: Face[], kinds?: DieKind[]): Match | null
bestMatch(row, faces, kinds): { match, idx } | null              // 从一堆骰子里能凑的最高档
// Match = { count: 档位颗数; companions: 陪骰颗数; tier: TierName; tierIdx: 0..4 }
```

## Battle2（battle2.ts）
```ts
interface Battle2Setup {
  seed: number; classId: ClassId;
  loadout: Loadout;                       // 版本 A：2 块单行碑；版本 B：1 块 3～5 行的碑
  talents?: Record<string, 1|2>; relics?: string[];
  hp?: number; maxHp?: number;
  waves: string[][];                      // 敌人 id（data/enemies.ts），每波一组
  kind: 'normal'|'elite'|'midBoss'|'boss';
  god?: boolean;                          // 调试：玩家不会死
}
type RowRef = number | 'basic';           // number = rows() 的下标

class Battle2 {
  constructor(setup: Battle2Setup);
  s: Battle2State;                        // 全部可序列化；UI 只读
  stats: BattleStats;                     // 机器人指标
  start(): Ev2[];

  // 查询
  rows(): BoardRow[];                     // { ref, tablet, slot, rowId, name, level, def }（A 版两块碑拼起来）
  dice(): Die[];                          // 场上骰子（未交出的）
  alive(): Enemy[]; enemy(uid): Enemy | null; target(): Enemy | null;   // 默认目标优先守卫
  intent(e: Enemy): Intent2;              // { kind:'atk'|'def'|'skl'|'mov'|'frz'|'curse', text, value?, status?, desc? }
  rerollInfo(): { free: number; bloodCost: number | null };  // bloodCost = 下一次卖血扣的血；null = 不能卖血
  canReroll(uids: number[]): string | null;                   // null = 可以；否则中文原因
  options(uids: number[]): RowOption[];   // 选中这些骰子时每一行的状态（碑上亮灯）
  check(ref: RowRef, uids: number[]): { match: Match | null; reason?: string };
  preview(ref: RowRef, uids: number[], target?: number): Preview | null;   // 克隆后试算，精确
  nextDice(): { count: number; overflow: number; reasons: GainReason[] };  // 下回合骰子数（准备区悬浮骰）
  strikesLeft(): number; mustEndTurn(): boolean;
  talent(id): number; hasRelic(id): boolean;

  // 动作（都返回 { ok: true, events } | { ok: false, reason, events: [] }）
  reroll(uids: number[]): Result2;
  play(ref: RowRef, uids: number[], target?: number, opts?: { mark?: 'straight'|'sameValue'; knifeDelta?: 1|-1 }): Result2;
  markShapes(): Array<'straight'|'sameValue'>;   // 飞刀能标记的形状（碑上有的形状行）
  chantRisk(): number;                    // 魔导：再吟唱一回合，预计因反噬多承受的伤害 Y
  flip(uid: number): Result2;             // 魔导天赋「逆转」
  endTurn(): Result2;                     // 结束回合 → 敌人回合 → 下一回合开始（事件一次返回）
  clone(): Battle2;
}

interface RowOption {
  ref: RowRef; rowId: string; name: string;
  ok: boolean;                            // 选中的骰子能不能发动这一行
  tier?: TierName; count?: number;        // 能打到的档、算档的颗数
  reason?: 'cond'|'strike'|'chant'|'none';  // 条件不符 / 只能当第二刀 / 吟唱回合不够 / 没选骰子
  bestTier?: TierName | null;             // 只看本行条件、从当前场上能凑出的最高档
}
interface Preview {
  total: number; hits: Array<{ uid: number; dmg: number }>;
  armor: number; barrier: number; heal: number; selfDmg: number;
  tier: TierName | null; ultimate: boolean;
  gainDice: number; kills: number[];
}
```

### Battle2State 里 UI 常用的字段
```ts
s.turn; s.phase: 'idle'|'player'|'enemy'|'over'; s.result: null|'win'|'lose';
s.player: { hp, maxHp, armor, barrier, statuses, rage (血怒 0..5), backlash (反噬层数) }
s.dice: Die[]; s.turnDice           // 场上骰子；本回合开局颗数
s.strikesUsed; s.maxStrikes         // 刺客出手小点
s.freeRerollsLeft; s.bloodRerolls
s.chantRing (0..3); s.overcharge; s.starTurnsLeft; s.chantsThisCycle   // 魔导
s.overflow                          // 狂战溢出颗数（本回合每颗 +10%）
s.carry: Die[]                      // 留到下回合的骰子（怒火 / 暗影 / 吟唱保留）
s.knifeMark: { shape, dieUid } | null   // 刺客飞刀标记（下一刀要完成的形状、弹回的那颗）
s.classSpawns                       // 刺客本回合职业产残次数（≤2；>0 时回合结束留残骰）
s.income: { kill, overflow, relic, summonGold, summonXp }   // 本场收入分项（溢出 / 遗物 / 召唤物有上限）
s.junkNext                          // 污染骰（v2.1 原型关闭，恒为 null）
s.enemies: Enemy[]; s.waveIdx; s.waves; s.targetUid
s.goldEarned; s.xpEarned
```
下回合预计骰子数请用 `nextDice()`（v0.1 写的 `s.next` 不存在）。
`Enemy` 有 `age`（这个敌人已经行动过的回合数，意图轮换 / 召唤 / 塞骰都按它算）、`distance`（近战距离，0 才攻击）、`rank`、`statuses`、`interrupted`（首领被控只打断一半）。

## 事件（events2.ts，`Ev2`）
沿用 v1 形状的：
`battleStart{enemies,isBoss,wave}`、`enemyEnter{uid,summonedBy?}`、`quote{uid,kind,index}`、`hit{uid,dmg,absorbed,hpDmg,killed,aoe,ultimate,source}`（source 多了 `'cleave'|'detonate'|'thorns'`）、`statusAdd{who,status}`、`statusTick{who,type,dmg}`、`statusExpire{who,type}`、`armor{who,delta,total,reason}`、`hp{who:'player',delta,hp,reason}`、`purify{removed}`、`enemyTurn{turn}`、`enemyMove{uid,distance}`、`enemyAct{uid,kind,desc?,value?,interrupted?,taunted?}`、`playerHit{from,dmg,byBarrier,byArmor,hpDmg,isDot,perfectBlock}`、`summon{by,uid}`、`phase{uid,phaseIdx}`、`death{uid,direct,overkill}`、`victory{gold,xp}`、`defeat`、`relic{id,text}`。

v2 新增：
| 事件 | 字段 | 说明 |
|---|---|---|
| `turnStart` | `turn, diceCount, overflow, strikes, reasons` | 回合开始；`reasons` 是本回合多出来的骰子的来源 |
| `roll` | `dice: DieSnap2[], reason: 'turn'\|'reroll'\|'spawn'\|'flip'\|'return', kept: number[]` | 每颗骰子的 uid / kind / value / suit；`kept` = 保留没重掷的；`return` = 飞刀回手 |
| `reroll` | `uids, hpCost, rage, capped, free` | 重投（卖血时 hpCost > 0） |
| `rowPlay` | `ref, rowId, name, tier, count, uids, companions, target, strike, ultimate, combo, X, bonusPct` | 发动了哪一行、哪一档；`combo` = 精准连击；`bonusPct` = 加成百分比之和 |
| `spent` | `uids` | 骰子离场 |
| `gainDice` | `n, reason, from?` | 下回合 +骰；reason：`behead / guard / stun / tier / resonance / shadow / fury / chant / furyUlt / precise / mark` |
| `special` | `action: 'spawn'\|'vanish'\|'transform'\|'carry', uid, kind, value, suit` | 特殊骰生成 / 消失 / 变身（怒火骰）/ 留到下回合 |
| `junk` | `kind: 'cracked'\|'cursed', from` | 敌人塞的污染骰（v2.1 原型关闭，不会发） |
| `waveClear` | `wave, nextDice, reasons` | 清完一波、还有下一波；在下一波 `battleStart` 之前发 |
| `gold` | `amount, from, overflow` | 掉金币（overflow = 溢出加成部分，已按本场上限截断） |
| `xp` | `amount, from` | 经验光点 |
| `rage` | `stacks` | 血怒层数 |
| `chant` | `ring, barrier, overcharge` | 魔导吟唱 |
| `barrier` | `delta, total` | 屏障 |
| `backlash` | `stacks` | 反噬层数 |
| `overload` | `turns` | 超载：之后 N 回合新骰全是星辰骰 |
| `strikeGain` | `n, reason` | 刺客 +1 刀 |
| `freeReroll` | `n, reason` | 白送的重投 |

## Run2（run2.ts）
```ts
type NodeKind = 'normal'|'elite'|'shop'|'camp'|'midBoss';
interface RunNode { kind: NodeKind; waves?: string[][] }
class Run2 {
  constructor(o: { seed: number; classId: ClassId; tablet?: string; version?: 'A'|'B'; nodes?: RunNode[]; full?: boolean; rowLevel?: 1|2|3; talents?; relics? });
  s: RunState;                    // hp, maxHp, gold, xp, level, loadout, talents, relics, potions, phase, nodes, node, queue, shop
  node(): RunNode & { idx: number };
  startBattle(): Battle2;         // 当前是战斗节点时（重复调用返回同一场）
  endBattle(b?: Battle2): BattleReward;   // 写回生命、金币、经验，排上升级 / 天赋 / 遗物选择
  pending(): Choice | null;       // 当前要玩家做的选择
  choose(index: number, sub?: number): { ok; reason? };   // sub = 改写时二选一
  shop(): ShopItem[]; buy(i: number): { ok; reason? }; refreshShop(): { ok; reason? };
  drink(): boolean;               // 喝药
  campOptions(); camp(kind: 'rest'|'train'|'reforge'): { ok };
  next(): void;                   // 离开商店 / 营火
  boardNames(): string[]; relicNames(): string[];
}
type RunState['phase'] = 'battle'|'choice'|'shop'|'camp'|'win'|'dead';
type Choice =
  | { kind: 'levelUp'; cards: LevelCard[] }     // addRow / upgrade / evolve（改写，options 二选一）
  | { kind: 'talent'; options: Array<{ id: string; level: 1|2 }> }
  | { kind: 'relic'; options: string[] };
type ShopItem = { kind: 'relic', id, price, sold, sale? } | { kind: 'potion', price, sold } | { kind: 'engrave', price, tablet, slot, sold };
```
节点表（`SLICE_NODES`）：普通（食尸鬼 1 + 2 两波）→ 精英（狼人首领 + 1 只食尸鬼）→ 战后升级三选一 + 天赋三选一 → 商人（固定 4 格）→ 首领（枯骨巫妖，整场最多召唤 3 只）。
天赋候选里 `id === 't_grind'`（磨炼 +40 经验）、`'t_gold'`（+30 金）是补位卡，`choose()` 直接结算。

## 机器人（bot2.ts / sim.ts）
```ts
botTurn(b: Battle2, rnd: () => number): void    // 打完当前玩家回合（含 endTurn）
autoBattle2(b: Battle2, o?: { seed?, maxTurns? }): { result, turns }
bestPlay(b): { c: { ref, uids, target }, v } | null   // 可做「提示」按钮
autoRun(o: Run2Options): RunResult
simulate(o: { n, classId, tablet?, version?, stage?: 'initial'|'built' }): SimReport   // built = 成型构筑（满行 II 级 + 2 天赋 + 3 遗物）
formatTable(reports): string    // SPEC 第 7 节主表（Markdown）
formatSide(reports): string     // 附带指标（卖血、吟唱、交汇、产残来源、收入、上限触顶）
```
命令行：`npx vite-node src/core/v2/sim.ts 200`（加 `extra` 再跑满行和 A 版）；`npx vitest run tests/v2/sim.test.ts` 也会打印小样本表。

## 变更记录
- 03:40 初稿。
- 04:45 按代码核对：新增 `check / nextDice / target / mustEndTurn / bestMatch / kindValues / kindSuit / refreshShop / drink / boardNames`；`RowOption.reason` 取值改为 `cond|strike|chant|none`；去掉不存在的 `s.next`（改用 `nextDice()`）；事件补 `spent`、`relic`、`rowPlay.X / bonusPct`、`roll.reason = 'return'`；`Run2` 的 `nodes` 是 `RunNode[]`。
- 04:50 **改到 SPEC v2.1**（向后兼容，旧调用都还能用）：
  - **档位**：`RowDef.tierRule` 改成 `{ steps: Array<{ min, tier, label }>, fixedCount?, countBonus?, maxDice? }`（每行自带档位表，最多 3～4 档）。UI 画档位灯直接遍历 `row.def.tierRule.steps`：`min` = 从几颗起，`label` = 灯上的短字，`tier` 是档位 id（`ultimate` = 终极特权）。旧的 `rare / ace / singleFromOne / override` 字段删除。`RowOption.tier` / `rowPlay.tier` 仍是档位 id。
  - **新条件**：`sumAtLeast`（千钧行：2 颗 ≥9、3 颗 ≥14、4 颗 ≥18）、`mixedRelease`（元素交汇：≥4 颗、两种花色各 ≥2，其余任意骰可一起交）。
  - **碑**：战意（斧 / 血 / 怒，池 战吼 / 铁血）；星界元素起步 **日行 + 元素交汇**（池 月 / 星 / 虚空）；影袭起步 **影 + 刃**（池 毒 / 影舞）；处刑（同点 / 顺子 / 千钧，池 双斩 / 圣裁）；星轨数理起步成对 / 顺子（池 大点 / 同点）；连环刺起步飞刀 / 顺子（池 同点 / 背刺）。三相行、收刀删除。行 id 变化：狂战大点行 `w_big` → 千钧行 `w_heavy`；新增 `m_mix`（元素交汇）；删除 `m_triad`。
  - **飞刀标记**：`play(ref, uids, target?, opts?: { mark?: 'straight' | 'sameValue' })`。飞刀出手时可指定标记，不传就自动选碑上第一个形状行。`s.knifeMark: { shape, dieUid } | null` 给 UI 显示。完成标记发 `gainDice{reason:'mark'}` + `special{action:'spawn'}`。
  - **刺客产残**：精准连击伤害只看同一行（+25%）；产残另判（后一刀多用骰子），`gainDice{reason:'precise'}`；`s.classSpawns` = 本回合职业产残次数（≤2）。
  - **魔导反噬**：本吟唱周期累计，出手清零，上限 30。新查询 `chantRisk(): number` = 「再吟唱一回合，预计多承受 Y 伤害」的 Y。星辰骰点数 2/2/4/5/6/6。
  - **跨波**：清完一波时先发 `waveClear{ wave, nextDice, reasons }`，再发下一波的 `battleStart`；UI 在这两条之间演「骰子飞进准备区」。
  - **遗物**：原型池 5 件 `greedy_hand / wildfire / iron_charm / steady_heart / field_aid`，禁用的不再出现。
  - **经济**：开局 0 金；溢出产钱每场上限（普 6 / 精 15 / 首 20）；召唤物每场 5 金 5 经验封顶；`gold` 事件的 `overflow` 是截断后的值。巫妖整场最多召唤 3 只。原型关闭污染骰（巫妖「诅咒」= 1 层毒）。
  - **商店**：固定 4 格：特价遗物 42、原价遗物 70、血瓶 35、描金 → II 50。
  - **天赋**：候选只出对当前碑有效的；不足时用 `{ id: 't_grind' }`（磨炼 +40 经验）补，全无时加 `{ id: 't_gold' }`（+30 金）。新增刺客天赋 `t_markmaster`（标记精通）。
  - `GainReason` 新增 `'precise' | 'mark'`；`'sheathe'` 不再出现。
- 05:35 v2.1 代码落地，接口与 04:50 记录一致；补充：`play` 的 `opts.knifeDelta`（飞刀 II 级起可 −1 弹回）、`markShapes()`、`stepOf()`、`s.income`、`ShopItem.sale`、`Run2Options.rowLevel / talents / relics`、`simulate({ stage })`、`formatSide()`。`full` 参数仍可用（等于 `stage: 'built'`）。巫妖的「诅咒」意图在原型里显示为 `{ kind: 'skl', text: '剧毒 1', status: 'poison' }`。
- 06:10 **改到 SPEC v2.2**（除标「破坏」的一条外都向后兼容）：
  - **魔导选择保留哪些骰（新动作）**：出手后剩下的骰子超过保留容量（3 颗，有余韵时 4 颗）时，由玩家选留哪几颗，其余回合结束时消散。
    - 查询 `keepInfo(): { cap: number; need: boolean; selected: number[] } | null`：非魔导、或本回合还没出手时返回 `null`；`cap` = 能留几颗；`need` = 剩骰多于 `cap`，需要让玩家选；`selected` = 当前会留的 uid（默认预选点数最高的几颗，点数相同按场上顺序）。
    - 动作 `setKeep(uids: number[]): Result2`：改选要留的骰子（必须是场上的、不超过 `cap` 颗）；不发事件。UI：出手后 `need` 为真时把 `selected` 画成预选，玩家点骰子换，再调 `setKeep`。
    - `endTurn(opts?: { keep?: number[] })`：也可以在结束回合时直接传。都不调就按默认（点数最高）留。机器人只用默认，录像回放不受影响。
    - 吟唱回合全部保留，不需要选。
  - **刺客残骰携带**：回合结束只留场上**还没用掉的**暗影残骰（本回合发生过职业产残时最多 1 颗，影匣 2 / 3）；场上没有残骰就不留，不再凭空生成。`nextDice()` 按当前场上的残骰实时算，所以出手把残骰用掉后预计骰数会掉回去。产残时的 `gainDice{reason:'precise'|'mark'}` 照发（表示「这颗现在在场上，不用掉就带走」）。跨波同样只带合法留骰。
  - **末敌死亡顺序**（SPEC 1.9）：一次出手里的击杀奖励（`gold`、`xp` 事件，战场急救、斩首 `gainDice{reason:'behead'}`、磨砺、复仇计数）改到这次出手的伤害、附带效果和产骰全部结算之后再发，然后才回合结束、下一波入场；`death` 事件仍在致命那一击立刻发。UI 若把金币动画挂在 `gold` 事件上，顺序会比 `death` 晚几条事件，金额不变。刺客打死本波最后一个敌人后剩下的刀作废。敌人回合里的死亡（灼烧、毒、反伤）不在出手中，照旧立刻发。
  - **灼烧**：日行 2 颗起挂的灼烧在施放回合不熄灭，吟唱期间一直保留，到魔导下一次出手结算后熄灭（本次新挂的保留）。灼烧状态多了可选字段 `Status.held?: number` = 其中保留的层数，UI 可以画成「常驻火苗」。灼烧熄灭照发 `statusExpire`。
  - **反噬**：新增 `s.cycleActive: boolean`（吟唱周期进行中）。只有周期进行中、敌人的攻击命中（含被屏障挡下）才加层；毒、灼烧不加。
  - **过充屏障**：屏障 = 4 + 2 × (吟唱前环格数 + 此前过充回合数)，本次算完再加过充计数。`chantRisk()` 同步。
  - **卖血**：第 k 次 = ⌈最大生命 × 2% × 2^(k−1)⌉；免费卖血（血行加料、嗜血本能）也让 k +1，所以之后的付费卖血更贵。`rerollInfo().bloodCost` 照实返回。
  - **星弹**：额外星弹用交出星骰的平均点数（不取整）+ 弹伤，每段单独取整。
  - **行数据**：(破坏) `RowDef.strike` 删除，改为 `RowDef.onlyAsStrike?: 2`（背刺）；`RowOption.reason === 'strike'` 不变。新增 `RowDef.tierCount?: 'matching' | 'all'`（元素交汇 `'all'`）、效果项可带 `onStrike?: 1 | 2`（刃行第一刀 / 第二刀）。刃行删掉 4 颗档，现在 2 档（1～2、3）。
  - **遗物**：原型池只剩 3 件 `greedy_hand / iron_charm / field_aid`（`PROTO_RELICS`）。`wildfire / steady_heart` 不再出现在商店和首领奖励里。商店仍是 4 格。
  - **升级三选一**：没实现的进化（映照、暗刃、连锁、镜像、灼烧共鸣）不再出现在改写卡里；行到 III 级、两个进化有任一没实现时，改写卡换成一张强化卡（没有可强化的就不出）。
  - **数值（不改接口）**：魔导生命 100 → 110；精英狼人意图循环 11 / 14 / 9 → 8 / 嚎叫（护甲 10）/ 11 / 7。意图里会出现 `kind: 'def'` 的狼人回合，UI 照常画防御图标。
  - **机器人**：`BOT_OPTS.mage` 新增实验档 `'smart' | 'hybrid'`（默认仍是 `'compare'`）；刺客在场上 ≥4 颗且碑上有影行 4 颗档时先追 4 影千影（`botTurn` 内部，`adapt.ts` 不用改）。

### v3（规则 v3：牌型 → 职业技能，RULES_V3.md）
公开方法签名都不变。下面是语义和数据上的新东西：
- **默认碑**：`Run2` 选职业后默认装 v3 碑 `w_v3 / m_v3 / r_v3`（`CLASSES[cls].tablets[0]`）。旧碑 `w_suit / w_point / m_suit / m_point / r_suit / r_point` 还在，传 `tablet` 显式装就能用。
- **`rows()`**：v3 碑固定 3 行，顺序是 同点、顺子、阵列。`def.name` = 技能名（狂战 顺劈斩 / 盾墙 / 狂血；魔导 冰锥 / 闪电链 / 陨石；刺客 背刺 / 影步 / 毒雾），`def.cond.t` ∈ `'sameValue' | 'straight' | 'array'`，`def.tierRule.steps` = 档位（同点 2 / 3 / 4+，顺子 3 / 4 / 5+，阵列 4 / 5 / 6）。`def.tags` 含 `'pattern'`。散骰仍是 `options()` / `play()` 里的 `'basic'`（狂战 劈砍、魔导 奥术弹、刺客 袖箭）。
- **认牌型**：选中的骰子必须恰好全部组成牌型。同点 = 全部同点、≥2 颗；顺子 = 全部不同且连续、≥3 颗；阵列（新条件 `{ t: 'array' }`）= 分成 ≥2 组、每组同点且 ≥2 颗（2+2、3+2、4+2、3+3、2+2+2）。阵列行 `def.icon.kind === 'array'`（新增取值）。
- **散骰颗数**：魔导 `basicAttack.maxDice` 改为 1（只能交 1 颗）；狂战 1～3；刺客 1。
- **花色**：v3 碑下规则不读普通骰的 `face.suit`（字段还在，UI 不要画）。
- **特殊骰附加效果**：被交出时按颗数加到本次伤害百分比上：怒火骰 +50%、星辰骰 +15%、暗影残骰 +20%（每颗都算）。
  - 事件：`rowPlay.bonusPct` 已含这部分；`rowPlay` 新增可选字段 `special?: Array<{ uid: number; kind: DieKind; pct: number }>`，列出这次交出的特殊骰和各自加成（`pct` 是整数百分比）。
  - 预览：`Preview` 新增 `specialPct: number`（特殊骰加成合计，整数百分比）；`total / hits` 已经算进去。
- **刺客**：第一刀用袖箭 → 补 1 颗暗影残骰（每回合 1 次，`special{action:'spawn'}`）；影步按档补残骰；精准连击 / 产残按「同一行」判定；回合末无条件留 1 颗场上没用掉的残骰（影匣 +1），不再要求本回合发生过职业产残。
- **升级三选一**：v3 碑只出 `kind: 'upgrade'` 卡（强化 3 个牌型技能之一，I→II→III），不出 `addRow` / `evolve`。三行都 III 级后不再出升级卡。
- **`mustEndTurn()`**：语义不变：玩家回合里出手次数用完（狂战、魔导出手后；刺客两刀后，影舞等加刀另算）或场上没有骰子时为真。v3 下散骰总能出手，所以只要还有骰子和出手次数就为假。魔导出手前永远为假（不出手 = 吟唱，由玩家点结束回合）。
- **升级卡文案**：`RowDef.levelDesc?: [string, string]` = II 级、III 级各加了什么（例：「伤害 +20%」「伤害 +35%，并获得护甲 = 点数和 × 0.5」）。III 级的附加效果来自 `RowDef.levelFx[3]`，`slotRow()` 已经把它并进每一档，`rows()[i].def` 直接就是生效后的行。
- **目标**：新 `Target` 取值 `'other' | 'two' | 'three'`（主目标 + 随机另 1 / 2 个敌人），同一次出手里随机到的敌人固定；`hit` 事件照常逐个发。
- **刺客处决**：背刺 4+ 对生命 <30% 的目标直接斩杀（一条 `hit`，`dmg` = 剩余生命 + 护甲，`killed: true`）。
- **数值**：v3 技能系数按职业乘了一个系数（狂战 ×1.9、刺客 ×0.8、魔导 ×1.0），见 `core2_report.md`「v3 数值调整」。只改数值，不影响接口。

### v4（规则 v4：刺客连击 / 魔导蓄星 / 狂战斩或挡，CLASS_DESIGN_V4 + DECISIONS_V4）
公开方法签名都不变，只加字段和查询。旧碑（含 v3 碑 `w_v3 / m_v3 / r_v3`）行为不变；v4 规则只在 v4 碑上生效。

**默认碑**：`Run2` 默认装 v4 碑 `w_v4 / m_v4 / r_v4`（`CLASSES[cls].tablets[0]`）。v3 碑仍可用 `tablet: 'w_v3'` 显式装。`b.v4: boolean` = 当前是不是 v4 规则。

**碑和散骰**
- `rows()` 仍是 3 行：同点、连环、阵列（`def.cond.t` = `'sameValue' | 'straight' | 'array'`），`ref` 0 / 1 / 2 不变。技能名：狂战 顺劈斩 / 盾冲 / 血战；魔导 冰锥 / 闪电链 / 陨石；刺客 背刺 / 影步 / 影舞。
- 散骰仍走 `'basic'`：狂战 **铁壁**（1～3 颗，**只给护甲**，不打伤害）、魔导 奥术弹（1 颗）、刺客 袖箭（1 颗，每回合 1 次）。
- 散骰现在也能升级：v4 碑在 loadout 里多 1 个槽（第 4 个，`rowId` = `w4_loose / m4_loose / r4_loose`，`def.tags` 含 `'basic'`），**不出现在 `rows()` 里**。查询 `basicSkill(): { rowId, name, level, maxLevel, levelDesc? } | null`。升级卡照常是 `{ kind: 'upgrade', tablet, slot, from }`，`slot` 可能是 3（散骰）。
- `RowDef.maxLevel?: 1 | 2 | 3`：这一行能升到几级（没写 = 3）。v4 只出设计稿第 5 节列的升级：盾冲、奥术弹 1 级封顶，影舞、袖箭、铁壁 2 级封顶。三选一、商店描金都不会出满级的行。`levelDesc` 照旧是 [II, III] 文案（封顶的行只有前一条有意义）。
- 觉醒：只有数据 `AWAKEN_V4`（`data/rows_v4.ts`，每职业 3 个：`{ id, classId, skill, name, desc }`），不进流程。

**每个出手选项的新字段**：`options(uids)` 返回的 `RowOption` 在 v4 碑上多一个 `v4?: OptionV4`（`ok === true` 时才有；为了算击杀 / 护甲会在克隆上试算一次，和 `preview()` 同精度，目标 = 当前目标）：
```ts
interface OptionV4 {
  strike: number;            // 这是本回合第几次出手（1 起）
  // 刺客
  comboPct?: number;         // 连击加成（整数 %）：第 N 刀 = 20 × (N − 1)
  refill?: number;           // 这一刀打完立刻补几颗暗影骰（袖箭按刀数 / 参数表；影步 = 交几补几；背刺 / 影舞 = 0）
  refillOnKill?: number;     // 背刺 II：打死目标再补几颗（只在会打死时 > 0）
  finisher?: boolean;        // 收尾技（背刺 / 影舞：不补骰）——卡片右上角「收尾」
  lastStrike?: boolean;      // 这是本回合第 5 刀（满连击）
  // 魔导
  cast?: 'minor' | 'release';  // 小咒（交 ≤3 颗，吟唱不断）/ 释放（交 ≥4 颗，结束周期、清反噬）
  holdBarrier?: number;      // 小咒：放完后本回合的屏障（4 + 2 × (剩下的骰子数 − 3)，最少 0）
  // 狂战
  armor?: number;            // 这次出手给的护甲（铁壁 = 点数和 × 1.5，怒火骰再 +50%；血战、顺劈斩 III 也有）
  kills?: number[];          // 会打死的敌人 uid（含溢出、全体）
  killAct?: boolean;         // 会触发斩杀再动（打死 + 本回合次数没用完）：补 1 颗怒火骰 + 再出手 1 次
  guard?: { armor: number; incoming: number; full: boolean };  // 出手后总护甲 vs 本回合敌人攻击合计（扣掉这次打死 / 眩晕的）；full = 全部挡住（完防）
  bloodPending?: number;     // 本回合卖血扣的血，斩首或完防后回合末按比例返还的量
}
```
不能出手的原因 `RowOption.reason` 新增 `'used'`：袖箭本回合已经用过。

**刺客（连击）**
- 有骰子且有合法出手就能继续，每回合最多 5 刀（`s.maxStrikes = 5`）；第 N 刀伤害 +20% × (N − 1)，记在 `rowPlay.bonusPct` 里。
- 补骰：袖箭（每回合 1 次）第 N 刀补 min(3, N) 颗（参数，见下）；影步交几补几；背刺 II 打死目标补 2（每回合 1 次）；背刺、影舞不补。补出来的是暗影骰（`kind: 'shadowDie'`，**没有伤害加成**），当回合能用，回合末全部消散（`special{action:'vanish'}`），不再跨回合携带。补骰事件：`special{action:'spawn'}` + `roll{reason:'spawn'}`，场上最多 6 颗。
- 重投：回合开始免费 1 次 + 第一刀后送 1 次（不变）。删掉精准连击、精准产残、残骰携带、暗影骰 +20%。
- 查询 `comboInfo(): { strike, max, pct, sleeveUsed, sleeveRefill } | null`：下一刀是第几刀、上限、下一刀加成 %、袖箭用过没有、现在用袖箭补几颗（袖箭槽上的「补 N」）。
- `mustEndTurn()`：5 刀用完 / 没骰子 / 没有合法出手且重投也凑不出（没有免费重投，或只剩 1 颗）时为真。
- `nextDice()` 恒为 3。

**魔导（蓄星）**
- 骰子不消散：回合末场上剩下的骰子全部留着（点数不变，`persist: 'retained'`）。下回合骰数 = min(6, max(3, 留下的 + 1) + 充能)。
- 每回合最多出手 1 次：不出手 / 小咒（交 ≤3 颗）/ 释放（交 ≥4 颗）。
  - 不出手或小咒的回合都算吟唱：屏障 = max(0, 4 + 2 × (回合末手里骰子数 − 3))；反噬照叠（`s.cycleActive` 打开）；回合开始满 6 颗还没释放 → 过充 +1。回合末发 `chant{ring, barrier, overcharge, minor?, hand}`（`minor` = 这回合放了小咒；`hand` = 留下的骰子数）。
  - 释放：吃过充加成（每层 +10%，陨石 II +20%），然后清反噬、清过充、关周期。满 6 颗时释放 → 超载（之后 2 回合新补的是星辰骰，+15% / 颗）。
- 闪电链 3 颗：下回合多补 1 颗（II：2 颗），发 `gainDice{reason:'resonance'}`（沿用魔导「下回合 +骰」的原因，不新增 GainReason，免得界面的 Record 类型要改）。
- 删掉：出手后选保留（v4 下 `keepInfo()` 恒为 `null`，`setKeep` 失败）、余韵。**没有星移**。
- `s.chantRing` 在 v4 下 = 手里第 4～6 颗的数量（0～3），UI 的环照旧画它。
- 查询 `castInfo(): { hand, holdBarrier, overcharge, charge, cycle } | null`：手里几颗、现在结束回合能拿多少屏障、过充层数、下回合充能、周期是否进行中。

**狂战（斩或挡）**
- 散骰 = 铁壁：1～3 颗，护甲 = 点数和 × 1.5（II ×2.0），怒火骰 +50%。不打伤害。
- 斩杀再动：技能的直接伤害（含溢出转移）打死敌人 → 补 1 颗怒火骰到场上（`special{action:'spawn', kind:'furyDie'}`）+ 再出手 1 次（`strikeGain{n:1, reason:'斩杀再动'}`），每回合 1 次；顺劈斩 4+ 本回合 +1 次；顺劈斩 II 打死时再 +1 次。怒火骰没用掉留到下回合（最多 1 颗）。v4 下斩首不再给「下回合 +1 骰」（被怒火骰取代）。
- 完防：一次攻击被护甲完全挡住，或敌人被眩晕 / 冻结没出手 → 下回合 +1 骰（每回合 1 次，不变）。
- 血偿：本回合（玩家回合 + 随后的敌人回合）做到斩首或完防 → 回合末返还本回合卖血扣的血 × 比例（参数，默认 0.5，向上取整）。事件 `bloodRefund{ paid, amount, why: 'behead' | 'guard' }` + `hp{reason:'refund'}`。
- 怒火骰：交出时伤害或护甲 +50%。
- 查询 `bloodInfo(): { paid, refund, ratio, behead, guard, killActsLeft } | null`：本回合卖血扣了多少、成功时返还多少、比例、本回合已斩首 / 已完防、斩杀再动还剩几次。血瓶上「待还」虚影 = `refund`（`behead || guard` 为真时已锁定）。

**参数**（`data/rows_v4.ts` 的 `V4_PARAMS`，模拟和调试可改）：`sleeveRefill: 'byStrike' | 'first2'`（第 N 刀补 min(3, N) / 第 1 刀补 2、之后补 3）、`bloodRefund: number`（返还比例）。

**事件增量**：`hp.reason` 加 `'refund'`；`chant` 加可选 `minor / hand`；新事件 `bloodRefund`；`rowPlay` 加可选 `v4?: { strike, comboPct?, cast?, refill? }`；`Preview` 加 `spawned`（这次出手立刻补到场上的骰子数）和 `extraAction`（斩杀再动给的出手次数）。

**机器人**：`botTurn` 签名不变。刺客用「一回合精确期望」求解出手顺序（骰子多重集 + 重投次数 + 刀数 + 袖箭状态，按敌人数估群体价值），目标在克隆上试算挑；魔导按「清场 / 满 6 / 反噬 / 挨打要冻或补刀 / 3 颗充能」规则选小咒或释放；狂战把每个出手（含斩杀再动后的第二手）连同敌人回合在克隆上试算，比较「斩」和「挡」，并按期望决定是否为斩杀或完防卖血。

### v4.1（去掉敌人距离 / 盾卫嘲讽 / 刺客刀鞘）
公开方法签名都不变，只加查询和数据。

**去掉距离**：`MELEE_START_DISTANCE = 0`，近战敌人开场就在攻击范围。对局里不会再出现 `intent.kind === 'mov'`（「逼近 N」）和 `enemyMove` 事件；`Enemy.distance` 字段保留、恒为 0（走位代码还在但不会触发，只有测试会手动设距离让敌人不动）。为了补回开场空档，敌人的第一回合意图改了：食尸鬼 = 防御「蹲伏」（循环 蹲伏 / 攻击 10 / 撕咬 12，去掉了虚弱），狼人首领 = 防御「嚎叫」（循环 嚎叫 / 8 / 11 / 7）。界面照常画 `kind: 'def'` 的意图。

**盾卫嘲讽**（2D 原版规则）：场上有活着的盾卫（`Enemy.ct === 'guardian'`）时，单体伤害 / 单体状态只能打盾卫。
- 查询 `canTarget(uid): boolean`：这个敌人现在能不能被点成目标（死了、或被盾卫保护时为 `false`）；`isTaunting(uid): boolean`：它是不是正在嘲讽的盾卫。界面：盾卫画嘲讽标记，`canTarget === false` 的敌人画「被保护」、点它不切目标（或提示「盾卫强制嘲讽」）。
- `play(ref, uids, target)` / `preview` 传了被保护的敌人 → 改打盾卫（多个盾卫时取当前选中的那个盾卫，否则第一个）；`rowPlay.target` 和 `hit` 事件给的是实际打到的敌人。`target()` / `s.targetUid` 不会停在被保护的敌人上；盾卫死了保护就解除。
- 全体、弹射（闪电链、影步 4 颗的「另 1 个」）、随机目标不受影响（主目标仍被改成盾卫）。原版「葫芦无视嘲讽」没有对应，没做。
- 开关 `ENEMY_TRAITS.taunt`（默认开，只给模拟对比用）。原型切片里没有盾卫；新增 3 个第一章敌人数据 `forest_treant`（腐化树人，盾卫）、`forest_banshee`（哀嚎女妖，术士）、`forest_wolf_priest`（月光狼灵，牧师），照 2D 配置移植，没进切片节点。

**刺客刀鞘**（每回合最多几刀变成成长项）
- v4 刺客碑多第 5 个槽 `r4_sheath`（名字「刀鞘」，`def.tags` 含 `'meta'`，不在 `rows()` 里、不收骰子）。槽等级 L → 每回合上限 = 开局值 + (L − 1)，最多 5。升级三选一里会出现它（`{ kind: 'upgrade', tablet: 0, slot: 4 }`，`levelDesc` =「刀鞘 +1：每回合多出 1 刀」），满了就不再出。
- 开局值是参数 `V4_PARAMS.rogueStartStrikes`（默认 **4**；3 / 4 / 5 的对比见 core2_report「v4.1」），上限 `rogueStrikeCap = 5`。`maxLevelOf('r4_sheath')` 随开局值变（开局 3 → III，4 → II，5 → I 即不出卡）。
- `s.maxStrikes` = 本回合上限；查询 `strikeCap()`；`comboInfo()` 多了 `capMax`（这把刀鞘最终能到几，觉醒后 6）。头顶匕首：画 `capMax` 把，其中 `s.maxStrikes` 把可用、`s.strikesUsed` 把已点亮。
- 觉醒「无尽连斩」：`Battle2Setup.awaken?: string[]` 含 `'aw_endless'` 时上限 +1（到 6），第 5 刀起每刀再 +30%。觉醒还没进流程，`Run2` 不会传它。

**散骰排他 + 狂战劈砍 / 铁壁**（用户指出的规则 bug，优先级最高；取代上面 v4 一节里「狂战散骰 = 铁壁，只给护甲」的说法）
- 散骰是一种排他的牌型：选中的骰子整体构成同点 / 连环 / 阵列时，不能当散骰。`options()` 里这时散骰选项 `ok: false, reason: 'pattern'`（`RowOption.reason` 新增取值）；`check('basic', …)` 返回「这几颗成牌型了，不是散骰」。一颗骰子永远算散骰，所以魔导、刺客不受影响。
- 狂战的散骰对同一选择给两个选项，都是 `ref: 'basic'`，用新字段 `RowOption.loose` 区分：`'guard'` = 铁壁（护甲 = 点数和 × 1.5，II ×2.0）在前，`'chop'` = 劈砍（单体伤害 = 点数和 × 1.0）在后；两者的 `v4` 信息分开算（劈砍的 `armor` 为 0、`kills` / `killAct` 照常）。怒火骰对两者都 +50%。
- 出手：`play('basic', uids, target, { loose: 'chop' })`；不传 `loose` = 铁壁（老写法照常能用）。`preview(ref, uids, target?, opts?)` 多了可选第 4 个参数。事件 `rowPlay` 的 `ref` 仍是 `'basic'`、`name` 是「劈砍」或「铁壁」，`rowPlay.v4.loose` 标出哪条路。
- 没有新增 `RowRef` 取值（界面有按非 `'basic'` 的 ref 当数组下标的代码，加值会编译失败）。界面要把散骰槽做成两个按钮（或长按切换），就遍历 `options()` 里 `ref === 'basic'` 的两项。

### v4.2（刀鞘开局 2、护甲按《杀戮尖塔》口径）
公开方法签名都不变。

**刀鞘开局 2**
- `V4_PARAMS.rogueStartStrikes` 默认 **2**，「刀鞘 +1」仍最多到 5 刀、觉醒到 6。刀鞘槽因此能升到 **IV 级**：`Level` 类型扩成 `1 | 2 | 3 | 4`（只有刀鞘槽会到 4）。升级卡 `{ kind: 'upgrade', slot: 4, from: 3 }` 就是 III → IV；`levelDesc` 只有 [II, III] 两条，IV 那张卡沿用「刀鞘 +1」文案。界面里的罗马数字表要补一个 `'IV'`（`show2.ts`、`skills.ts` 的 `ROMAN` 现在只到 III）。商店描金 → IV 价格 150（`ECON.engravePrice` 第三项）。
- `V4_PARAMS.sleeveRefill` 默认改为 `'first2'`（袖箭第 1 刀补 2、之后补 3），是给开局 2 刀的数值补偿。

**护甲（参照《杀戮尖塔》）**
- 敌人所有直接伤害都先扣护甲：普通攻击、技能附带的攻击，以及施法者 / 牧师的「攻击」（巫妖的亡灵风暴、骸骨之矛这类法术）。施法者的攻击意图现在是 `kind: 'atk'`、`value` = 伤害（以前是 `kind: 'skl'`、`text: '施法'`、随机上毒 / 灼烧 / 虚弱）；结算发 `enemyAct{kind:'attack'}` + `playerHit`，和普通攻击一样。开关 `ENEMY_TRAITS.spellHits`（默认开）。
- 中毒、灼烧（玩家身上的持续伤害）无视护甲（原本就是），也不影响完防。魔导的屏障仍然会吸收持续伤害（没改，见报告）。
- **完防 = 本回合所有能被挡的伤害都挡住了**（至少挨了一下，或有敌人被眩晕 / 冻结没出手）。在敌人全部行动完之后统一判定，`gainDice{reason:'guard' | 'stun'}` 和血偿的「完防」都在那时才成立，不再是「某一下被完全挡住」就算。`playerHit.perfectBlock` 仍是逐下的（给打击演出用）。`OptionV4.guard.full` / `guardForecast()` 按新口径：本回合来袭合计 ≤ 护甲（+ 屏障）。开关 `ENEMY_TRAITS.guardAll`（默认开；关掉是 v4 的「挡住一下就算」）。

**数值**（不改接口）：巫妖的攻击 16 / 14 / 8 / 8 → 12 / 11 / 6 / 6；狂战生命 80、铁壁 ×1.05（II ×1.4）；魔导屏障底数 9；刺客技能约 ×0.85。见 core2_report「v4.2」。

### v4.3
- **持续伤害（中毒、灼烧）既不吃护甲也不吃魔导屏障**（照《杀戮尖塔》统一）。`playerHit{isDot:true}` 的 `byBarrier` 和 `byArmor` 恒为 0，伤害全部进 `hpDmg`。界面上屏障不要再画成能挡毒。
- 完防口径不变：本回合所有能挡的伤害都挡住（`ENEMY_TRAITS.guardAll` 默认开）。
- 数值（不改接口）：狂战生命 90、铁壁护甲 ×0.9（II ×1.2）。魔导没改数值。
