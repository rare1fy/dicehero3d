// 星界魔导 rows and tablets (SPEC_v2.1 2.2).
import type { RowDef, TabletDef } from '../types';
import { EARN, addFrom, dmg, evo, hook, ladder, mapTiers, st, steps, stun, withFlags } from './util';

const M = 'mage' as const;

export const M_ROWS: RowDef[] = [
  // ── 星界元素（花色流）★原型：起步 日行 + 元素交汇
  {
    id: 'm_sun', name: '日行', classId: M, cond: { t: 'suit', suit: 'sun' },
    tierRule: { steps: steps(['1', 'single'], ['2', 'feed'], ['3+', 'area']) },
    coef: [2, 2.5, 3], tags: ['suit'], icon: { kind: 'suit', suit: 'sun' }, flags: { burnL3: 1.5 },
    tiers: ladder({
      single: { fx: [dmg('one'), st('burn', 0, 'one', undefined, 1)] },
      feed: { fx: [dmg('one', 1, { armorBreak: true }), hook('burnHold')] },
      // 3+: the burn (not the damage) spreads to every enemy
      area: { fx: [st('burn', 0, 'all', undefined, 1)] },
    }),
    evolutions: [
      evo('m_sun_resonate', '灼烧共鸣', '每层现有灼烧追加 1 点伤害并延长 1 回合', r => withFlags(r, { burnResonance: 1 })),
      evo('m_sun_corona', '日冕', '2 颗就扩散，灼烧减半', r => withFlags({ ...r, tierRule: { steps: steps(['1', 'single'], ['2+', 'area']) }, tiers: { ...r.tiers, area: { effects: [...r.tiers.area!.effects.filter(e => e.t !== 'hook'), hook('burnHold')] } } }, { burnHalf: 1 })),
    ],
  },
  {
    id: 'm_mix', name: '元素交汇', classId: M, cond: { t: 'mixedRelease', minDice: 4, minSuits: 2, perSuit: 2 },
    tierRule: { steps: steps(['4', 'area'], ['5', 'earn'], ['6', 'ultimate']) },
    coef: [1.5, 1.9, 2.25], tags: ['suit'], icon: { kind: 'mix', suits: ['star', 'moon', 'sun', 'void'] }, flags: { resonancePct: 0.25 },
    tiers: {
      area: { effects: [hook('elements', { all: 0 })] },
      earn: { effects: [hook('elements', { all: 0 }), EARN] },
      ultimate: { effects: [hook('elements', { all: 1 }), EARN] },
    },
    evolutions: [
      evo('m_mix_storm', '元素风暴', '元素共鸣每种 +25% → +40%', r => withFlags(r, { resonancePct: 0.4 })),
      evo('m_mix_heart', '元素之心', '四种花色各 ≥1 颗也能发动', r => withFlags(r, { anyFourSuits: 1 })),
    ],
  },
  {
    id: 'm_moon', name: '月行', classId: M, cond: { t: 'suit', suit: 'moon' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    coef: [1.5, 1.9, 2.25], tags: ['suit'], icon: { kind: 'suit', suit: 'moon' }, flags: { frozenBonusFromL2: 0.5 },
    tiers: ladder({
      single: { fx: [dmg('one'), { t: 'barrier', mul: 1 }] },
      feed: { fx: [stun('one', 'freeze')] },
      area: { fx: [stun('all', 'freeze', 1, 2), { t: 'barrier', mul: 2 }] },
    }),
    evolutions: [
      evo('m_moon_perma', '永冻', '冻结 2 回合', r => mapTiers(r, fx => fx.map(e => e.t === 'stun' ? { ...e, turns: 2 } : e))),
      evo('m_moon_light', '月光', '改为净化全部负面，每净化 1 层回复 5', r => withFlags(addFrom(r, 'single', [{ t: 'purify', n: 99 }]), { purifyHeal: 5 })),
    ],
  },
  {
    id: 'm_star', name: '星行', classId: M, cond: { t: 'suit', suit: 'star' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    // coef = flat damage per bolt (弹伤 +3 / +4 / +5)
    coef: [3, 4, 5], tags: ['suit'], icon: { kind: 'suit', suit: 'star' }, flags: { bolts: 1, boltVuln: 1 },
    tiers: ladder({
      single: { fx: [hook('bolts', { extra: 0, all: 0 })] },
      feed: { fx: [hook('bolts', { extra: 1, all: 0 })] },
      area: { fx: [hook('bolts', { extra: 1, all: 1 })] },
    }),
    evolutions: [
      evo('m_star_missile', '奥术飞弹', '3 颗起星弹就打全体，每道 −1', r => mapTiers(r, (fx, k) => k === 'single' ? fx : fx.map(e => e.t === 'hook' && e.id === 'bolts' ? hook('bolts', { ...e.p, all: 1, minus: 1 }) : e))),
      evo('m_star_chain', '雷链', '击杀后多出的星弹跳到下一个敌人', r => withFlags(r, { boltChain: 1 })),
    ],
  },
  {
    id: 'm_void', name: '虚空行', classId: M, cond: { t: 'suit', suit: 'void' },
    tierRule: { steps: steps(['1', 'single'], ['2', 'feed'], ['3+', 'ultimate']) },
    coef: [2.5, 3.1, 3.75], tags: ['suit'], icon: { kind: 'suit', suit: 'void' },
    tiers: ladder({
      single: { fx: [dmg('one', 1, { ignoreArmor: true })] },
      feed: { fx: [], coefAdd: 1 },
      ultimate: { fx: [hook('devour', { per: 2, perL2: 3 })], coefMul: 1.6 },
    }),
    evolutions: [
      evo('m_void_back', '逆流', '先摧毁护甲，把护甲值加进伤害', r => withFlags(r, { armorToDmg: 1 })),
      evo('m_void_hole', '黑洞', '3 颗就打全体，不再吞噬', r => ({ ...r, tiers: { ...r.tiers, ultimate: { effects: [dmg('all', 1, { ignoreArmor: true })], coefMul: 1.6 } } })),
    ],
  },
  // ── 星轨数理（点数流）：起步 成对 + 顺子
  {
    id: 'm_pairs', name: '成对行', classId: M, cond: { t: 'everyValuePaired' },
    tierRule: { steps: steps(['2～3', 'single'], ['4～5', 'area'], ['6', 'ultimate']) },
    coef: [1.5, 1.9, 2.25], tags: ['point'], icon: { kind: 'pairs' }, flags: { barrier3: 1.5 },
    tiers: ladder({
      single: { fx: [dmg('one'), { t: 'barrier', mul: 1 }] },
      area: { fx: [dmg('all'), st('weak', 1, 'all', 2)] },
      ultimate: { fx: [EARN] },
    }),
    evolutions: [
      evo('m_pairs_mirror', '映照', '可以多带 1 颗不成对的骰子，它按最大那一对的点数算'),
      evo('m_pairs_recoil', '反冲', '屏障挡下的伤害累计成回响，本行出手时额外造成回响（最多 60）', r => withFlags(r, { echo: 60 })),
    ],
  },
  {
    id: 'm_straight', name: '顺子行', classId: M, cond: { t: 'straight' },
    tierRule: { steps: steps(['3', 'feed'], ['4', 'area'], ['5', 'earn'], ['6', 'ultimate']) },
    coef: [1.5, 1.9, 2.25], tags: ['point'], icon: { kind: 'straight' },
    tiers: ladder({
      feed: { fx: [dmg('one', 1, { ignoreArmor: true })] },
      area: { fx: [dmg('all', 1, { ignoreArmor: true })] },
      earn: { fx: [EARN] },
      ultimate: { fx: [{ t: 'resonance', n: 2 }], coefMul: 1.7 },
    }),
    evolutions: [
      evo('m_straight_dim', '降维', '顺子按多 1 颗算档位', r => ({ ...r, tierRule: { ...r.tierRule, countBonus: 1 } })),
      evo('m_straight_arith', '等差', '每多 1 连，伤害 +50%', r => withFlags(r, { perLen: 0.5 })),
    ],
  },
  {
    id: 'm_big', name: '大点行', classId: M, cond: { t: 'allAtLeast', value: 4 },
    tierRule: { steps: steps(['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']) },
    coef: [1.5, 1.9, 2.25], tags: ['point'], icon: { kind: 'atLeast', value: 4 }, flags: { chantBonus: 0.25, chantBonusL2: 0.35 },
    tiers: ladder({
      feed: { fx: [dmg('one')] },
      area: { fx: [dmg('others', 0.5, { add: true })] },
      ultimate: { fx: [dmg('all')] },
    }),
    evolutions: [
      evo('m_big_stars', '星辰', '吟唱保留的骰子每回合 +1 点', r => withFlags(r, { retainGrow: 1 })),
      evo('m_big_forbid', '禁咒', '至少吟唱 2 回合才能放，系数 ×2.5', r => withFlags({ ...r, coef: r.coef.map(c => c * 2.5) as [number, number, number] }, { needChant: 2 })),
    ],
  },
  {
    id: 'm_same', name: '同点行', classId: M, cond: { t: 'sameValue' },
    tierRule: { steps: steps(['3', 'feed'], ['4+', 'area']) },
    coef: [1.8, 2.25, 2.7], tags: ['point'], icon: { kind: 'same' },
    tiers: ladder({
      feed: { fx: [dmg('one'), stun('one', 'freeze')] },
      area: { fx: [stun('all', 'freeze')] },
    }),
    evolutions: [
      evo('m_same_one', '万象归一', '2 颗同点 + 任意 1 颗就能发动', r => withFlags(r, { looseSame: 1 })),
      evo('m_same_sym', '对称', '全同点时系数再 +50%', r => ({ ...r, coef: r.coef.map(c => c * 1.5) as [number, number, number] })),
    ],
  },
];

export const M_TABLETS: TabletDef[] = [
  { id: 'm_suit', classId: M, name: '星界元素', style: 'suit', question: '先施加哪种元素，才能让下一段吟唱和释放更值？', startRows: ['m_sun', 'm_mix'], pool: ['m_moon', 'm_star', 'm_void'], maxRows: 4, allowBorrow: false, borrowFrom: 'm_point', prototype: true },
  { id: 'm_point', classId: M, name: '星轨数理', style: 'point', question: '现在释放已有形状，还是保留半成品追更大的形状？', startRows: ['m_pairs', 'm_straight'], pool: ['m_big', 'm_same'], maxRows: 4, allowBorrow: false, borrowFrom: 'm_suit', prototype: false },
];
