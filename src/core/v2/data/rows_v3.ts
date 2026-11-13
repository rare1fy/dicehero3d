// Rules v3 (RULES_V3.md): one tablet per class, three pattern skills — 同点 / 顺子 / 阵列. Loose dice are the class basicAttack.
// Damage = points handed in × coef[level] × the tier's dmg mul. coef is the level scale (I 1.0 / II 1.2 / III 1.35, × a class tuning factor);
// level III also adds the row's `levelFx[3]` effect. No row reads die suits.
import type { Effect, RowDef, TabletDef } from '../types';
import { dmg, evo, ladder, st, steps, stun } from './util';

const LV: [number, number, number] = [1, 1.2, 1.35];
/** v3 tuning (core2_report 数值调整): class scale on the level coefficients */
const LV_CLASS: Record<string, [number, number, number]> = {
  warrior: [1.9, 2.28, 2.57],   // ×1.9: at ×1.0 the warrior cleared 3%, at ×1.5 32% (100 runs, 66 boss deaths)
  mage: LV,
  rogue: [0.8, 0.96, 1.08],   // ×0.8: at ×1.0 the rogue cleared 100%
};
const noEvo = (id: string): [ReturnType<typeof evo>, ReturnType<typeof evo>] => [evo(id + '_a', '—', 'v3 不做改写'), evo(id + '_b', '—', 'v3 不做改写')];
const same = { t: 'sameValue' as const }, straight = { t: 'straight' as const }, array = { t: 'array' as const };
const S_SAME = steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']);
const S_STRAIGHT = steps(['3', 'single'], ['4', 'feed'], ['5+', 'area']);
const S_ARRAY = steps(['4', 'single'], ['5', 'area'], ['6', 'ultimate']);
const armorX = (mul: number): Effect => ({ t: 'armor', mul, of: 'coef2' });
const healX = (mul: number): Effect => ({ t: 'heal', mul, of: 'X' });

function row(o: Omit<RowDef, 'evolutions' | 'tags' | 'coef'> & { coef?: [number, number, number] }): RowDef {
  return { coef: LV_CLASS[o.classId], tags: ['pattern'], evolutions: noEvo(o.id), ...o };
}

export const V3_ROWS: RowDef[] = [
  // ── 嗜血狂战
  row({
    id: 'w3_same', name: '顺劈斩', classId: 'warrior', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.5)] },
      feed: { fx: [dmg('two', 1.3)] },
      area: { fx: [dmg('all', 1.2), { t: 'capUp', which: 'behead', n: 1 }] },
    }),
    coef2: [0.5, 0.5, 0.5],
    levelFx: { 3: [armorX(1)] },
    levelDesc: ['伤害 +20%', '伤害 +35%，并获得护甲 = 点数和 × 0.5'],
  }),
  row({
    id: 'w3_straight', name: '盾墙', classId: 'warrior', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    coef2: [1.5, 1.8, 2.0],
    tiers: ladder({
      single: { fx: [armorX(1), dmg('one', 0.8)] },
      feed: { fx: [{ t: 'taunt' }, { t: 'capUp', which: 'guard', n: 1 }] },
      area: { fx: [stun('all', 'stun', 1)] },
    }),
    levelFx: { 3: [healX(0.3)] },
    levelDesc: ['伤害 +20%，护甲 ×1.8', '伤害 +35%，护甲 ×2.0，并回复 点数和 × 0.3'],
  }),
  row({
    id: 'w3_array', name: '狂血', classId: 'warrior', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' },
    tiers: ladder({
      single: { fx: [dmg('one', 2.0), healX(0.5)] },
      area: { fx: [dmg('all', 1.5), { t: 'heal', mul: 0.3, of: 'dmg' }], noInherit: true },
      ultimate: { fx: [dmg('all', 2.0, { ignoreArmor: true }), { t: 'heal', mul: 0.3, of: 'dmg' }], noInherit: true },
    }),
    levelFx: { 3: [{ t: 'rage', n: 1 }] },
    levelDesc: ['伤害 +20%', '伤害 +35%，并 +1 层血怒'],
  }),
  // ── 星界魔导
  row({
    id: 'm3_same', name: '冰锥', classId: 'mage', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.5)] },
      feed: { fx: [stun('one', 'freeze', 1)] },
      area: { fx: [dmg('all', 1.0), stun('all', 'freeze', 1)] },
    }),
    levelFx: { 3: [{ t: 'barrier', mul: 0.5 }] },
    levelDesc: ['伤害 +20%', '伤害 +35%，并获得屏障 = 点数和 × 0.5'],
  }),
  row({
    id: 'm3_straight', name: '闪电链', classId: 'mage', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('two', 1.2)] },
      feed: { fx: [dmg('three', 1.2), st('vulnerable', 1, 'three', 2)] },
      area: { fx: [dmg('all', 1.4), st('vulnerable', 1, 'all', 2)] },
    }),
    levelFx: { 3: [st('vulnerable', 1, 'one', 2)] },
    levelDesc: ['伤害 +20%', '伤害 +35%，主目标总是易伤 2 回合'],
  }),
  row({
    id: 'm3_array', name: '陨石', classId: 'mage', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' }, flags: { burnL3: 1.5 },
    tiers: ladder({
      single: { fx: [dmg('one', 2.2), st('burn', 0, 'one', undefined, 0.5)] },
      area: { fx: [dmg('all', 1.6), st('burn', 0, 'all', undefined, 0.5)], noInherit: true },
      ultimate: { fx: [dmg('all', 2.2, { ignoreArmor: true }), { t: 'hook', id: 'pierceBarrier' }], noInherit: true },
    }),
    levelDesc: ['伤害 +20%', '伤害 +35%，灼烧 ×1.5'],
  }),
  // ── 影锋刺客
  row({
    id: 'r3_same', name: '背刺', classId: 'rogue', cond: same, tierRule: { steps: S_SAME }, icon: { kind: 'same' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.8)] },
      feed: { fx: [st('poison', 0, 'one', undefined, 1 / 3)] },
      area: { fx: [dmg('one', 2.5, { exec: 0.3 })] },
    }),
    levelFx: { 3: [st('weak', 1, 'one', 1)] },
    levelDesc: ['伤害 +20%', '伤害 +35%，目标虚弱 1 回合'],
  }),
  row({
    id: 'r3_straight', name: '影步', classId: 'rogue', cond: straight, tierRule: { steps: S_STRAIGHT }, icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('one', 1.2), { t: 'spawnShadow', n: 1 }] },
      feed: { fx: [dmg('two', 1.2)] },
      area: { fx: [dmg('all', 1.2), { t: 'spawnShadow', n: 2 }], noInherit: true },
    }),
    levelFx: { 3: [st('vulnerable', 1, 'one', 1)] },
    levelDesc: ['伤害 +20%', '伤害 +35%，主目标易伤 1 回合'],
  }),
  row({
    id: 'r3_array', name: '毒雾', classId: 'rogue', cond: array, tierRule: { steps: S_ARRAY }, icon: { kind: 'array' },
    tiers: ladder({
      single: { fx: [st('poison', 0, 'all', undefined, 0.25)] },
      area: { fx: [dmg('all', 1.0)] },
      ultimate: { fx: [dmg('all', 2.0, { ignoreArmor: true })], noInherit: true },
    }),
    levelFx: { 3: [st('poison', 2, 'all')] },
    levelDesc: ['伤害 +20%', '伤害 +35%，全体额外中毒 2 层'],
  }),
];

const tab = (id: string, classId: TabletDef['classId'], name: string, rows: string[]): TabletDef =>
  ({ id, classId, name, style: 'pattern', question: '这把骰子能凑成什么牌型？', startRows: rows, pool: [], maxRows: 3, allowBorrow: false, prototype: true });
export const V3_TABLETS: TabletDef[] = [
  tab('w_v3', 'warrior', '狂战技能', ['w3_same', 'w3_straight', 'w3_array']),
  tab('m_v3', 'mage', '魔导技能', ['m3_same', 'm3_straight', 'm3_array']),
  tab('r_v3', 'rogue', '刺客技能', ['r3_same', 'r3_straight', 'r3_array']),
];
