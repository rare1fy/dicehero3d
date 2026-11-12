// 影锋刺客 rows and tablets (SPEC_v2.1 2.3).
import type { RowDef, TabletDef } from '../types';
import { EARN, dmg, evo, hook, ladder, st, steps, stun, withFlags } from './util';
// v2.2: SPEC_v2.2 2.3

const R = 'rogue' as const;
const SHADOW_STRIKE = [{ t: 'extraStrike' as const, n: 1 }, { t: 'spawnShadow' as const, n: 1 }];

export const R_ROWS: RowDef[] = [
  // ── 影袭（花色流）★原型：起步 影 + 刃
  {
    id: 'r_shadow', name: '影行', classId: R, cond: { t: 'suit', suit: 'shadow' },
    tierRule: { steps: steps(['1～2', 'single'], ['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']) },
    coef: [2, 2.4, 2.8], tags: ['suit'], icon: { kind: 'suit', suit: 'shadow' },
    tiers: ladder({
      single: { fx: [dmg('one')] },
      feed: { fx: [st('weak', 1, 'one', 1)] },
      area: { fx: [dmg('all', 0.6)], noInherit: true },
      ultimate: { fx: [dmg('all'), hook('killShadow')], noInherit: true },
    }),
    evolutions: [
      evo('r_shadow_assassin', '暗杀', '只用 1 颗影时 ×3.5 并无视护甲', r => withFlags(r, { assassin: 3.5 })),
      evo('r_shadow_thousand', '千影', '打一片提前到 3 颗', r => ({ ...r, tierRule: { steps: steps(['1～2', 'single'], ['3～5', 'area'], ['6', 'ultimate']) } })),
    ],
  },
  {
    id: 'r_blade', name: '刃行', classId: R, cond: { t: 'suit', suit: 'blade' },
    // v2.2: no 4-dice step (4 blades cannot happen with 3 normal + 1 shadow die); first / second strike effects via onStrike
    tierRule: { steps: steps(['1～2', 'single'], ['3', 'feed']) },
    coef: [1.5, 1.9, 2.25], tags: ['suit'], icon: { kind: 'suit', suit: 'blade' },
    tiers: ladder({
      single: { fx: [dmg('one'), { ...hook('bladeFirst', { per: 2 }), onStrike: 1 }, { ...hook('bladeSecond', { per: 3 }), onStrike: 2 }] },
      feed: { fx: [{ ...hook('bladeFirst', { per: 2, extra: 1 }), onStrike: 1 }, { ...hook('bladeSecond', { per: 3, mul: 2, purify: 1 }), onStrike: 2 }] },
    }),
    evolutions: [
      evo('r_blade_dark', '暗刃', '第二刀可以用 1 刃 + 1 影发动，×2.5 无视护甲'),
      evo('r_blade_venom', '淬刃', '第一刀改为每颗刃给目标 3 层毒', r => withFlags(r, { venomFirst: 3 })),
    ],
  },
  {
    id: 'r_poison', name: '毒行', classId: R, cond: { t: 'suit', suit: 'poison' },
    tierRule: { steps: steps(['1', 'single'], ['2～3', 'feed'], ['4+', 'area']) },
    // coef = poison stacks per die (4 / 5 / 6)
    coef: [4, 5, 6], tags: ['suit'], icon: { kind: 'suit', suit: 'poison' },
    tiers: ladder({
      single: { fx: [dmg('one', 1, { raw: true }), hook('poison', { all: 0, extra: 0 })] },
      feed: { fx: [hook('poison', { all: 0, extra: 1 })] },
      area: { fx: [hook('poison', { all: 1, extra: 1 })] },
    }),
    evolutions: [
      evo('r_poison_king', '毒王之牙', '每颗 8 层', r => ({ ...r, coef: [8, 8, 8] })),
      evo('r_poison_fang', '毒牙', '改为：目标毒层翻倍', r => withFlags(r, { doublePoison: 1 })),
    ],
  },
  {
    id: 'r_dance', name: '影舞行', classId: R, cond: { t: 'suit', suit: 'shadow' },
    tierRule: { steps: steps(['2～3', 'single'], ['4+', 'area']) },
    coef: [1.3, 1.6, 1.9], tags: ['suit'], icon: { kind: 'suit', suit: 'shadow' },
    tiers: ladder({
      single: { fx: [hook('dance', { all: 0, weak: 0, mul: 1 })] },
      area: { fx: [hook('dance', { all: 1, weak: 0, mul: 0.6 })] },
    }),
    evolutions: [
      evo('r_dance_triple', '三连闪', '第 3 刀之后再 +1 刀（每回合 1 次）', r => withFlags(r, { tripleFlash: 1 })),
      evo('r_dance_storm', '影刃风暴', '本回合之后每刀 +40%', r => withFlags(r, { bladeStorm: 0.4 })),
    ],
  },
  // ── 连环刺（点数流）：起步 飞刀 + 顺子
  {
    id: 'r_knife', name: '飞刀行', classId: R, cond: { t: 'suit', suit: 'blade' },
    tierRule: { steps: steps(['1', 'single']), fixedCount: 1 },
    coef: [2, 2.4, 2.8], tags: ['point', 'tool'], icon: { kind: 'one', suit: 'blade' }, flags: { marksShape: 1 },
    tiers: { single: { effects: [dmg('one'), hook('knifeReturn')] } },
    evolutions: [
      evo('r_knife_boomerang', '回旋刃', '弹射另一个敌人，弹回后可以免费重掷这颗', r => withFlags(r, { knifeBounce: 1 })),
      evo('r_knife_twin', '双飞', '一次扔 2 颗刃，都弹回', r => ({ ...r, tierRule: { steps: steps(['1～2', 'single']), maxDice: 2 } })),
    ],
  },
  {
    id: 'r_straight', name: '顺子行', classId: R, cond: { t: 'straight' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']) },
    coef: [2.2, 2.6, 3], tags: ['point'], icon: { kind: 'straight' }, flags: { shape: 1 },
    tiers: ladder({
      single: { fx: [dmg('one')] },
      feed: { fx: [st('vulnerable', 1, 'one', 1)] },
      area: { fx: [dmg('all', 0.6)], noInherit: true },
      ultimate: { fx: [dmg('all')], noInherit: true },
    }),
    evolutions: [
      evo('r_straight_dim', '降维打击', '顺子按长 1 颗算档位', r => ({ ...r, tierRule: { ...r.tierRule, countBonus: 1 } })),
      evo('r_straight_chain', '连锁', '每一段都可以换目标'),
    ],
  },
  {
    id: 'r_same', name: '同点行', classId: R, cond: { t: 'sameValue' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    coef: [1.6, 2, 2.4], tags: ['point'], icon: { kind: 'same' }, flags: { shape: 1 },
    tiers: ladder({
      single: { fx: [dmg('one'), dmg('one', 0.5, { add: true })] },
      feed: { fx: [dmg('one'), dmg('second', 0.5, { add: true }), dmg('second', 0.5, { add: true })] },
      area: { fx: [dmg('all', 0.9), stun('one')], noInherit: true },
    }),
    evolutions: [
      evo('r_same_one', '万象归一', '对子按三条结算', r => ({ ...r, tierRule: { ...r.tierRule, countBonus: 1 } })),
      evo('r_same_mirror', '镜像', '分身段复制场上最大的点数'),
    ],
  },
  {
    id: 'r_back', name: '背刺', classId: R, cond: { t: 'allAtLeast', value: 4 }, onlyAsStrike: 2,
    tierRule: { steps: steps(['1～2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    coef: [1.7, 2.1, 2.5], tags: ['point'], icon: { kind: 'atLeast', value: 4 },
    tiers: ladder({
      single: { fx: [dmg('one', 1, { ignoreArmor: true })] },
      feed: { fx: [st('vulnerable', 1, 'one', 1)] },
      area: { fx: [dmg('all', 0.8)], noInherit: true },
    }),
    evolutions: [
      evo('r_back_chase', '追击', '第 3 刀起 ×2.5', r => withFlags(r, { chase: 2.5 })),
      evo('r_back_gap', '破绽', '命中后目标易伤 2 回合', r => withFlags(r, { gapVuln: 2 })),
    ],
  },
];

void EARN; void SHADOW_STRIKE;

export const R_TABLETS: TabletDef[] = [
  { id: 'r_suit', classId: R, name: '影袭', style: 'suit', question: '把多少资源变成影，换即时收割还是下一回合的连续行动？', startRows: ['r_shadow', 'r_blade'], pool: ['r_poison', 'r_dance'], maxRows: 4, allowBorrow: false, borrowFrom: 'r_point', prototype: true },
  { id: 'r_point', classId: R, name: '连环刺', style: 'point', question: '怎样用第一刀改点，让第二刀完成原本不存在的组合？', startRows: ['r_knife', 'r_straight'], pool: ['r_same', 'r_back'], maxRows: 4, allowBorrow: false, borrowFrom: 'r_suit', prototype: false },
];
