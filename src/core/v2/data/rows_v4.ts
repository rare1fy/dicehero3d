// Rules v4 (CLASS_DESIGN_V4 §2–§5 + DECISIONS_V4): 刺客连击 / 魔导蓄星 / 狂战斩或挡. One tablet per class: three pattern skills
// (同点 / 连环 / 阵列) on the board plus the loose-dice skill as a 4th, upgradeable slot (tag 'basic', not on the board).
// Multipliers are absolute (the v3 class factors are folded in); coef stays 1 and levels II / III are the named upgrades of §5,
// written as `levelUp` transforms (only these upgrades are ever offered). The class rules themselves live in battle2.ts (`v4`).
import type { Effect, RowDef, TabletDef, TierName } from '../types';
import { dmg, evo, hook, ladder, mapTiers, st, steps, stun, withFlags } from './util';

/** v4 knobs (CORE4 §4: the two parameter comparisons). Mutable on purpose: the sim flips them. */
export const V4_PARAMS = {
  /** 刺客 combo: strike N deals +comboPct × (N − 1) */
  comboPct: 0.2,
  /** 刺客 刀鞘 (v4.1): strikes per turn at the start of a run; each「刀鞘 +1」card adds one, up to rogueStrikeCap (觉醒「无尽连斩」+1 more) */
  rogueStartStrikes: 2, rogueStrikeCap: 5,   // v4.2 (user ruling): start 2, three「刀鞘 +1」cards to 5 (v4.1 compared 3 / 4 / 5)
  /** 袖箭 refill: 'byStrike' = strike N refills min(3, N) · 'first2' = strike 1 refills 2, later strikes 3 */
  sleeveRefill: 'first2' as 'byStrike' | 'first2',   // v4.2: with 刀鞘 start 2 the first-strike refill goes 1 → 2 (core2_report v4.2)
  /** 狂战 血偿: share of this turn's blood sales returned at round end after a behead or a perfect guard */
  bloodRefund: 0.5,
  /** 狂战 full-rage blood sale armor (血战 II raises it to `bloodArmorII`) */
  bloodArmor: 5, bloodArmorII: 8,
  /** 魔导 反噬 under v4: cap on layers, and layers per hit (0 = the v2.2 doubling 2^N). v4 tuning: 2^N → +2 per hit */
  backlashCap: 30, backlashStep: 2,
  /** 魔导 barrier on a turn without a release: base + per × (dice kept − 3), at least 0. v4 tuning: base 4 → 6 */
  barrierBase: 9, barrierPer: 2,   // v4.2: 6 → 9 (the lich's spells now hit)
  /** tuning scale on every v4 skill's damage (not the loose-dice skill), per class (sim knob; the tuned values are baked into the rows) */
  dmgScale: { warrior: 1, mage: 1, rogue: 1 } as Record<'warrior' | 'mage' | 'rogue', number>,
  /** tuning scale on 铁壁 armor (sim knob) */
  wallScale: 1,
};
/** v4 魔导 barrier for a hand of n dice at the end of a non-release turn */
export const holdBarrier = (n: number) => Math.max(0, V4_PARAMS.barrierBase + V4_PARAMS.barrierPer * (n - 3));
/** dice 袖箭 refills when played as strike index i (0-based) */
export function sleeveRefill(strikeIdx: number): number {
  return V4_PARAMS.sleeveRefill === 'first2' ? (strikeIdx === 0 ? 2 : 3) : Math.min(3, strikeIdx + 1);
}

const ONE: [number, number, number] = [1, 1, 1];
const noEvo = (id: string): [ReturnType<typeof evo>, ReturnType<typeof evo>] => [evo(id + '_a', '—', 'v4 不做改写'), evo(id + '_b', '—', 'v4 不做改写')];
const same = { t: 'sameValue' as const }, straight = { t: 'straight' as const }, array = { t: 'array' as const };
const S_SAME = steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']);
const S_STRAIGHT = steps(['3', 'single'], ['4', 'feed'], ['5+', 'area']);
const S_ARRAY = steps(['4', 'single'], ['5', 'area'], ['6', 'ultimate']);
const S_ONE = steps(['1', 'single']);
const armorX = (mul: number): Effect => ({ t: 'armor', mul, of: 'coef2' });

function row(o: Omit<RowDef, 'evolutions' | 'tags' | 'coef'> & { coef?: [number, number, number]; basic?: boolean }): RowDef {
  const { basic, ...rest } = o;
  return { coef: ONE, coef2: ONE, tags: basic ? ['pattern', 'v4', 'basic'] : ['pattern', 'v4'], evolutions: noEvo(o.id), ...rest };
}
/** add effects to every tier */
const addAll = (r: RowDef, fx: Effect[]): RowDef => mapTiers(r, list => [...list, ...fx]);
/** scale every level coefficient (伤害 ×k) */
const coefX = (r: RowDef, k: number): RowDef => ({ ...r, coef: r.coef.map(c => +(c * k).toFixed(3)) as [number, number, number] });
/** rewrite the dmg effects of some tiers */
const mapDmg = (r: RowDef, tiers: TierName[], f: (e: Extract<Effect, { t: 'dmg' }>) => Effect): RowDef =>
  mapTiers(r, (list, k) => tiers.includes(k) ? list.map(e => (e.t === 'dmg' ? f(e) : e)) : list);
/** wider bounce: two → three → four */
const WIDER: Record<string, 'three' | 'four'> = { two: 'three', three: 'four' };

export const V4_ROWS: RowDef[] = [
  // ── 嗜血狂战：斩或挡
  row({
    id: 'w4_loose', name: '铁壁', classId: 'warrior', basic: true, cond: { t: 'any', min: 1, max: 3 }, tierRule: { steps: S_ONE, maxDice: 3 }, icon: { kind: 'one' },
    tiers: ladder({ single: { fx: [armorX(0.9)] } }),   // v4.3: design ×1.5 / II ×2.0 → ×0.9 / ×1.2 (user pick: ×0.6 with HP 90; v4.2 had ×1.05 / ×1.4 with HP 80)
    maxLevel: 2,
    levelUp: { 2: r => mapTiers(r, list => list.map(e => (e.t === 'armor' ? { ...e, mul: 1.2 } : e))) },
    levelDesc: ['护甲 = 点数和 × 1.2（原 × 0.9）', '—'],
  }),
  row({
    id: 'w4_same', name: '顺劈斩', classId: 'warrior', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.95)] },   // v4 tuning: design ×2.6 / ×2.0, warrior skills ×0.75
      feed: { fx: [hook('cleave')] },
      area: { fx: [dmg('all', 1.5), hook('killActUp', { n: 1 })], noInherit: true },
    }),
    levelUp: {
      2: r => withFlags(r, { killActPlus: 1 }),
      // III merges the two §5 III entries for 顺劈斩 (斩首流「2 颗档也溢出」+ 防战流「附带护甲 = 点数和 × 0.5」)
      3: r => addAll(mapTiers(r, (list, k) => (k === 'single' ? [...list, hook('cleave')] : list)), [armorX(0.5)]),
    },
    levelDesc: ['斩杀再动 +1 次（顺劈斩打死时）', '2 颗档也溢出转移；砍完附带护甲 = 点数和 × 0.5'],
  }),
  row({
    id: 'w4_straight', name: '盾冲', classId: 'warrior', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.125), stun('one', 'stun', 1)] },   // v4 tuning: design ×1.5 / ×1.8, ×0.75
      feed: { fx: [stun('all', 'stun', 1)] },
      area: { fx: [dmg('all', 1.35)] },
    }),
    maxLevel: 1,
  }),
  row({
    id: 'w4_array', name: '血战', classId: 'warrior', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' },
    tiers: ladder({
      single: { fx: [dmg('one', 2.4), armorX(1)] },   // v4 tuning: design ×3.2 / ×2.4 / ×3.2, ×0.75
      area: { fx: [dmg('all', 1.8)] },
      ultimate: { fx: [dmg('all', 2.4, { ignoreArmor: true })] },
    }),
    levelUp: {
      2: r => withFlags(coefX(r, 1.2), { bloodArmorII: 1 }),
      3: r => mapDmg(r, ['single'], e => ({ ...e, target: 'all' })),
    },
    levelDesc: ['伤害 +20%；血怒满 5 层后每次卖血 +8 护甲（原 +5）', '4 颗档也打全体'],
  }),
  // ── 星界魔导：蓄星（没有星移）
  row({
    id: 'm4_loose', name: '奥术弹', classId: 'mage', basic: true, cond: { t: 'any', min: 1, max: 1 }, tierRule: { steps: S_ONE, maxDice: 1 }, icon: { kind: 'one' },
    tiers: ladder({ single: { fx: [dmg('one', 1.0)] } }),
    maxLevel: 1,
  }),
  row({
    id: 'm4_same', name: '冰锥', classId: 'mage', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.5)] },
      feed: { fx: [stun('one', 'freeze', 1)] },
      area: { fx: [dmg('all', 1.4), stun('all', 'freeze', 1)] },
    }),
    levelUp: {
      2: r => mapTiers(r, (list, k) => (k === 'single' ? [...list, stun('one', 'freeze', 1)] : list)),
      3: r => withFlags(r, { frozenTaken: 0.3 }),
    },
    levelDesc: ['2 颗档也冻结', '冻结的敌人受到伤害 +30%'],
  }),
  row({
    id: 'm4_straight', name: '闪电链', classId: 'mage', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('two', 1.2), hook('charge', { n: 1 })] },
      feed: { fx: [dmg('three', 1.5), st('vulnerable', 1, 'three', 2)], noInherit: true },
      area: { fx: [dmg('all', 1.8), st('vulnerable', 1, 'all', 2)], noInherit: true },
    }),
    levelUp: {
      2: r => mapTiers(r, list => list.map(e => (e.t === 'hook' && e.id === 'charge' ? { ...e, p: { n: 2 } } : e))),
      3: r => mapTiers(r, list => list.map(e => {
        if (e.t === 'dmg' && WIDER[e.target]) return { ...e, target: WIDER[e.target] };
        if (e.t === 'status' && e.status === 'vulnerable') return { ...e, duration: 3, target: e.target !== 'self' && WIDER[e.target] ? WIDER[e.target] : e.target };
        return e;
      })),
    },
    levelDesc: ['充能：下回合多补 2 颗（原 1 颗）', '弹射目标 +1，易伤 3 回合'],
  }),
  row({
    id: 'm4_array', name: '陨石', classId: 'mage', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' },
    tiers: ladder({
      single: { fx: [dmg('one', 2.5), st('burn', 0, 'one', undefined, 0.5)] },
      area: { fx: [dmg('all', 2.0), st('burn', 0, 'all', undefined, 0.5)], noInherit: true },
      ultimate: { fx: [dmg('all', 2.8, { ignoreArmor: true }), hook('pierceBarrier')], noInherit: true },
    }),
    levelUp: {
      2: r => withFlags(r, { overPct: 0.2 }),
      3: r => mapDmg(r, ['ultimate'], e => ({ ...e, mul: 3.3 })),
    },
    levelDesc: ['过充：每回合 +20%（原 +10%）', '6 颗终极 ×3.3（原 ×2.8）'],
  }),
  // ── 影锋刺客：连击
  row({
    id: 'r4_loose', name: '袖箭', classId: 'rogue', basic: true, cond: { t: 'any', min: 1, max: 1 }, tierRule: { steps: S_ONE, maxDice: 1 }, icon: { kind: 'one' },
    tiers: ladder({ single: { fx: [dmg('one', 1.0)] } }),
    maxLevel: 2,
    levelUp: { 2: r => addAll(r, [st('poison', 1, 'all')]) },
    levelDesc: ['交出时给全体 1 层中毒', '—'],
  }),
  row({
    id: 'r4_same', name: '背刺', classId: 'rogue', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.2)] },   // v4.2: design ×1.4 / ×2.2 → ×1.2 / ×1.85 (刀鞘 start 2 + 袖箭 first refill 2, then ×0.85)
      feed: { fx: [st('poison', 0, 'one', undefined, 1 / 3)] },
      area: { fx: [dmg('one', 1.85, { exec: 0.3 })] },
    }),
    levelUp: {
      2: r => addAll(r, [hook('killRefill', { n: 2 })]),
      3: r => mapDmg(r, ['area'], e => ({ ...e, exec: 0.4 })),
    },
    levelDesc: ['打死目标补 2 颗暗影骰（每回合 1 次）', '处决线 30% → 40%'],
  }),
  row({
    id: 'r4_straight', name: '影步', classId: 'rogue', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('one', 0.85), hook('refill')] },   // v4.2: design ×1.0 → ×0.85
      feed: { fx: [dmg('two', 0.85)] },
      area: { fx: [dmg('all', 0.85)] },
    }),
    levelUp: {
      2: r => coefX(r, 1.3),
      3: r => mapDmg(r, ['feed'], e => ({ ...e, target: 'all' })),
    },
    levelDesc: ['伤害 ×1.3', '4 颗就是千影（全体）'],
  }),
  row({
    id: 'r4_array', name: '影舞', classId: 'rogue', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' },
    tiers: ladder({
      single: { fx: [dmg('all', 1.1), st('poison', 0, 'all', undefined, 0.25)] },   // v4.2: design ×1.3 / ×1.5 / ×2.0 → ×1.1 / ×1.3 / ×1.7
      area: { fx: [dmg('all', 1.3)] },
      ultimate: { fx: [dmg('all', 1.7, { ignoreArmor: true })], noInherit: true },
    }),
    maxLevel: 2,
    levelUp: { 2: r => addAll(coefX(r, 1.3), [st('poison', 2, 'all')]) },
    levelDesc: ['伤害 ×1.3，中毒 +2 层', '—'],
  }),
];

/** v4.1 狂战 劈砍: the attack side of the warrior's loose dice (铁壁 is the guard side, and the upgradeable slot). Not on the tablet */
V4_ROWS.push(row({
  id: 'w4_chop', name: '劈砍', classId: 'warrior', basic: true, cond: { t: 'any', min: 1, max: 3 }, tierRule: { steps: S_ONE, maxDice: 3 }, icon: { kind: 'one' },
  tiers: ladder({ single: { fx: [dmg('one', 1.0)] } }), maxLevel: 1,
}));
/** v4.1: do these values form a pattern (同点 ≥2 / 连环 ≥3 / 阵列 ≥4)? Loose dice must not (散骰 is an exclusive pattern) */
export function formsPattern(vals: number[]): boolean {
  const n = vals.length; if (n < 2) return false;
  const c = new Map<number, number>(); for (const v of vals) c.set(v, (c.get(v) || 0) + 1);
  if (c.size === 1) return true;
  if (n >= 3 && c.size === n && Math.max(...vals) - Math.min(...vals) === n - 1) return true;
  if (n >= 4 && [...c.values()].every(x => x >= 2)) return true;
  return false;
}

/** 刀鞘 (v4.1): a growth slot, not a skill (tag 'meta': not on the board, no dice). Level L = start + (L − 1) strikes per turn */
V4_ROWS.push(row({
  id: 'r4_sheath', name: '刀鞘', classId: 'rogue', cond: { t: 'any', min: 1, max: 1 }, tierRule: { steps: S_ONE }, icon: { kind: 'one' },
  tiers: ladder({ single: { fx: [] } }), flags: { sheath: 1 },
  levelDesc: ['刀鞘 +1：每回合多出 1 刀', '刀鞘 +1：每回合再多出 1 刀'],   // the IV card reads the same (levelDesc only has II / III)
}));
V4_ROWS[V4_ROWS.length - 1].tags = ['v4', 'meta'];
/** levels the 刀鞘 slot can reach with the current start value: start 2 → IV (5 strikes), 3 → III, 4 → II, 5 → I (never offered) */
export const sheathMaxLevel = () => Math.max(1, Math.min(4, 1 + V4_PARAMS.rogueStrikeCap - V4_PARAMS.rogueStartStrikes)) as 1 | 2 | 3 | 4;

const tab = (id: string, classId: TabletDef['classId'], name: string, rows: string[]): TabletDef =>
  ({ id, classId, name, style: 'pattern', question: '这把骰子能凑成什么牌型？', startRows: rows, pool: [], maxRows: rows.length, allowBorrow: false, prototype: true });
export const V4_TABLETS: TabletDef[] = [
  tab('w_v4', 'warrior', '狂战技能', ['w4_same', 'w4_straight', 'w4_array', 'w4_loose']),
  tab('m_v4', 'mage', '魔导技能', ['m4_same', 'm4_straight', 'm4_array', 'm4_loose']),
  tab('r_v4', 'rogue', '刺客技能', ['r4_same', 'r4_straight', 'r4_array', 'r4_loose', 'r4_sheath']),
];

/** v4 §5 觉醒 (data only this round: not offered, not implemented) */
export const AWAKEN_V4: Array<{ id: string; classId: TabletDef['classId']; skill: string; name: string; desc: string }> = [
  { id: 'aw_endless', classId: 'rogue', skill: 'r4_straight', name: '无尽连斩', desc: '连击上限 5 → 6，第 5 刀起每刀额外 +30%' },
  { id: 'aw_throat', classId: 'rogue', skill: 'r4_same', name: '割喉', desc: '背刺 2 颗档也能处决（生命 <20%）' },
  { id: 'aw_miasma', classId: 'rogue', skill: 'r4_array', name: '毒雾', desc: '本回合每出 1 刀，全体中毒 +1 层' },
  { id: 'aw_starfall', classId: 'mage', skill: 'm4_array', name: '天外陨星', desc: '陨石 6 颗打完，目标剩余生命 < 本次伤害的一半直接处决' },
  { id: 'aw_permafrost', classId: 'mage', skill: 'm4_same', name: '永冻', desc: '冰环冻结 2 回合，首领也会被冻住（不只是打断）' },
  { id: 'aw_stormcharge', classId: 'mage', skill: 'm4_straight', name: '雷暴充能', desc: '闪电链小咒交出去的骰子下回合原样回来' },
  { id: 'aw_execute', classId: 'warrior', skill: 'w4_same', name: '处刑', desc: '打不死时目标生命 <25% 直接斩杀' },
  { id: 'aw_riposte', classId: 'warrior', skill: 'w4_loose', name: '盾反', desc: '完防时把挡下的伤害打回去' },
  { id: 'aw_bloodgod', classId: 'warrior', skill: 'w4_array', name: '血神', desc: '本回合每卖 1 次血，伤害和护甲 +10%（不封顶，血偿照还）' },
];
