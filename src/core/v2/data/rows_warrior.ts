// 嗜血狂战 rows and tablets (SPEC_v2.1 2.1). Coefficients I / II / III in `coef`; each row writes its own steps (count → tier);
// tier effects are cumulative (see util.ladder).
import type { RowDef, TabletDef } from '../types';
import { EARN, addFrom, dmg, evo, hook, ladder, st, steps, stun, withFlags } from './util';

const W = 'warrior' as const;

export const W_ROWS: RowDef[] = [
  // ── 战意（花色流）★原型
  {
    id: 'w_axe', name: '斧行', classId: W, cond: { t: 'suit', suit: 'axe' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']) },
    coef: [1.5, 1.9, 2.25], coef2: [3, 3.75, 4.5], tags: ['suit'], icon: { kind: 'suit', suit: 'axe' },
    tiers: ladder({
      single: { fx: [{ t: 'armor', mul: 1, of: 'coef2' }, dmg('one')] },
      feed: { fx: [{ t: 'taunt' }, { t: 'capUp', which: 'guard', n: 1 }] },
      area: { fx: [dmg('all'), stun('all')] },
      ultimate: { fx: [], coefMul: 2 },
    }),
    evolutions: [
      evo('w_axe_giant', '巨人壁垒', '嘲讽提前到 2 颗；每次完防反震攻击者', r => withFlags(addFrom(r, 'single', [{ t: 'taunt' }]), { thorns: 1 })),
      evo('w_axe_hyper', '霸体', '每档额外造成「当前护甲 × 0.5」的伤害，3 颗起打全体', r => withFlags(r, { armorStrike: 0.5 })),
    ],
  },
  {
    id: 'w_blood', name: '血行', classId: W, cond: { t: 'suit', suit: 'blood' },
    tierRule: { steps: steps(['1', 'single'], ['2～3', 'feed'], ['4+', 'area']) },
    coef: [2.5, 3.1, 3.75], tags: ['suit'], icon: { kind: 'suit', suit: 'blood' },
    tiers: ladder({
      single: { fx: [dmg('one'), { t: 'heal', mul: 1, of: 'X' }] },
      feed: { fx: [{ t: 'purify', n: 1 }, { t: 'freeBlood' }] },
      area: { fx: [dmg('all'), { t: 'heal', mul: 0.3, of: 'dmg', overArmor: 1 }] },
    }),
    evolutions: [
      evo('w_blood_forge', '生命熔炉', '任何档位满血时多出的回复都变护甲，每 1 点回复变 2 护甲', r => withFlags(r, { overhealArmor: 2 })),
      evo('w_blood_thirst', '血之渴望', '每回复 8 点，下回合开局自带 1 层血怒（最多 3 层）', r => withFlags(r, { healRage: 8 })),
    ],
  },
  {
    id: 'w_fury', name: '怒行', classId: W, cond: { t: 'suit', suit: 'fury', companions: 2 }, tierCount: 'matching',
    tierRule: { steps: steps(['1', 'single'], ['2', 'feed'], ['3', 'ultimate']) },
    coef: [1.8, 2.25, 2.7], tags: ['suit'], icon: { kind: 'suit', suit: 'fury' },
    tiers: ladder({
      single: { fx: [dmg('one', 1, { armorBreak: true })] },
      feed: { fx: [st('berserk', 1, 'self', 2)] },
      ultimate: { fx: [{ t: 'heal', mul: 0.2, of: 'dmg' }, hook('furyUlt')], coefMul: 1.7 },
    }),
    evolutions: [
      evo('w_fury_god', '血神', '本行吃血怒加成翻倍（每层 +30%）', r => withFlags(r, { rageDouble: 1 })),
      evo('w_fury_titan', '泰坦', '1 颗档 +15 固定伤害；3 怒斩首后下回合出 1 颗泰坦骰', r => withFlags({ ...r, tiers: { ...r.tiers, single: { ...r.tiers.single!, effects: [dmg('one', 1, { armorBreak: true, flat: 15 })] } } }, { titanOnBehead: 1 })),
    ],
  },
  {
    id: 'w_warcry', name: '战吼', classId: W, cond: { t: 'suitMix', need: { axe: 1, blood: 1, fury: 1 } },
    tierRule: { steps: steps(['3', 'feed']), fixedCount: 3 },
    coef: [1.2, 1.5, 1.8], tags: ['suit'], icon: { kind: 'mix', suits: ['axe', 'blood', 'fury'] },
    tiers: { feed: { effects: [{ t: 'taunt' }, st('vulnerable', 1, 'all', 2), dmg('one'), { t: 'rage', n: 1 }] } },
    evolutions: [
      evo('w_warcry_roar', '怒吼', '易伤改为 3 回合', r => ({ ...r, tiers: { feed: { effects: [{ t: 'taunt' }, st('vulnerable', 1, 'all', 3), dmg('one'), { t: 'rage', n: 1 }] } } })),
      evo('w_warcry_drum', '战鼓', '血怒 +1 改为 +2', r => ({ ...r, tiers: { feed: { effects: [{ t: 'taunt' }, st('vulnerable', 1, 'all', 2), dmg('one'), { t: 'rage', n: 2 }] } } })),
    ],
  },
  {
    id: 'w_ironblood', name: '铁血', classId: W, cond: { t: 'suitMix', need: { axe: 2, blood: 2 } },
    tierRule: { steps: steps(['4', 'area']), fixedCount: 4 },
    coef: [1.5, 1.9, 2.25], tags: ['suit'], icon: { kind: 'mix', suits: ['axe', 'axe', 'blood', 'blood'] },
    tiers: { area: { effects: [{ t: 'armor', mul: 3, of: 'suitPoints', suit: 'axe' }, { t: 'heal', mul: 1, of: 'suitPoints', suit: 'blood' }, dmg('all'), { t: 'capUp', which: 'guard', n: 1 }] } },
    evolutions: [
      evo('w_ironblood_will', '铁血战意', '护甲 × 4', r => ({ ...r, tiers: { area: { effects: [{ t: 'armor', mul: 4, of: 'suitPoints', suit: 'axe' }, { t: 'heal', mul: 1, of: 'suitPoints', suit: 'blood' }, dmg('all'), { t: 'capUp', which: 'guard', n: 1 }] } } })),
      evo('w_ironblood_forge', '血铸', '回复翻倍，满血转护甲', r => withFlags({ ...r, tiers: { area: { effects: [{ t: 'armor', mul: 3, of: 'suitPoints', suit: 'axe' }, { t: 'heal', mul: 2, of: 'suitPoints', suit: 'blood' }, dmg('all'), { t: 'capUp', which: 'guard', n: 1 }] } } }, { overhealArmor: 1 })),
    ],
  },
  // ── 处刑（点数流）
  {
    id: 'w_same', name: '同点行', classId: W, cond: { t: 'sameValue' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    coef: [2, 2.5, 3], tags: ['point'], icon: { kind: 'same' }, flags: { execute: 0.3, executeHigh: 0.5, executeHeal: 10 },
    tiers: ladder({
      single: { fx: [dmg('one')] },
      feed: { fx: [], coefMul: 1.25 },
      area: { fx: [dmg('one', 1, { ignoreArmor: true }), stun('one'), dmg('others', 0.5)], coefMul: 1.5 },
    }),
    evolutions: [
      evo('w_same_chain', '连斩', '三条起，斩首后本回合用剩下的骰子再出手 1 次（每回合 1 次）', r => withFlags(r, { chainKill: 3 })),
      evo('w_same_reap', '收割', '斩杀线再 +15%；斩首回血翻倍；溢出伤害的 30% 换成金币', r => withFlags(r, { execute: 0.45, executeHigh: 0.65, executeHeal: 20, overkillGold: 0.3 })),
    ],
  },
  {
    id: 'w_straight', name: '顺子行', classId: W, cond: { t: 'straight' },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4+', 'area']) },
    coef: [2, 2.5, 3], tags: ['point'], icon: { kind: 'straight' },
    tiers: ladder({
      single: { fx: [dmg('one')] },
      feed: { fx: [dmg('one', 0.75), dmg('adjacent', 0.75)] },
      area: { fx: [dmg('all', 0.75), { t: 'capUp', which: 'behead', n: 2 }], noInherit: true },
    }),
    evolutions: [
      evo('w_straight_blood', '血旋风', '每层血怒，每个目标额外 +3 固定伤害', r => withFlags(r, { rageFlat: 3 })),
      evo('w_straight_quake', '震地旋风', '4 颗起全体眩晕；6 连时终极特权', r => addFrom({ ...r, tierRule: { steps: [...r.tierRule.steps, { min: 6, tier: 'ultimate', label: '6' }] }, tiers: { ...r.tiers, ultimate: r.tiers.area } }, 'area', [stun('all')])),
    ],
  },
  {
    id: 'w_heavy', name: '千钧行', classId: W, cond: { t: 'sumAtLeast', byCount: { 2: 9, 3: 14, 4: 18 } },
    tierRule: { steps: steps(['2', 'single'], ['3', 'feed'], ['4', 'area']), maxDice: 4 },
    coef: [1.6, 2, 2.4], tags: ['point'], icon: { kind: 'sum', value: 9 },
    tiers: ladder({
      single: { fx: [dmg('one', 1, { armorBreak: true })] },
      feed: { fx: [hook('transfer', { chain: 0 })] },
      area: { fx: [hook('transfer', { chain: 1 }), { t: 'capUp', which: 'behead', n: 1 }] },
    }),
    evolutions: [
      evo('w_heavy_titan', '泰坦之拳', '血怒第 3 层变出的是泰坦骰，不是怒火骰', r => withFlags(r, { titanFist: 1 })),
      evo('w_heavy_unbowed', '不屈', '生命低于 30% 时交出的骰子全部按 6 点算', r => withFlags(r, { unbowed: 0.3 })),
    ],
  },
  {
    id: 'w_twin', name: '双斩', classId: W, cond: { t: 'twoPair' },
    tierRule: { steps: steps(['4', 'area']), fixedCount: 4 },
    coef: [2, 2.5, 3], tags: ['point'], icon: { kind: 'twoPair' },
    tiers: { area: { effects: [hook('twinCut')] } },
    evolutions: [
      evo('w_twin_cross', '交叉斩', '两个目标改为全体', r => ({ ...r, tiers: { area: { effects: [dmg('all')] } } })),
      evo('w_twin_return', '回旋', '斩首后各回 5 血', r => withFlags(r, { killHeal: 5 })),
    ],
  },
  {
    id: 'w_verdict', name: '圣裁', classId: W, cond: { t: 'fullHouse' },
    tierRule: { steps: steps(['5', 'earn']), fixedCount: 5 },
    coef: [2.5, 3.1, 3.75], tags: ['point'], icon: { kind: 'fullHouse' },
    tiers: { earn: { effects: [dmg('one', 1, { ignoreArmor: true }), EARN] } },
    evolutions: [
      evo('w_verdict_judge', '裁决', '目标低于 50% 生命时直接斩首（首领除外）', r => withFlags(r, { judge: 0.5 })),
      evo('w_verdict_full', '满堂', '+15 护甲并全体虚弱 2', r => ({ ...r, tiers: { earn: { effects: [dmg('one', 1, { ignoreArmor: true }), EARN, { t: 'armor', mul: 15, of: 'flat' }, st('weak', 1, 'all', 2)] } } })),
    ],
  },
];

export const W_TABLETS: TabletDef[] = [
  { id: 'w_suit', classId: W, name: '战意', style: 'suit', question: '这回合挡住谁，能把下一回合养大？', startRows: ['w_axe', 'w_blood', 'w_fury'], pool: ['w_warcry', 'w_ironblood'], maxRows: 5, allowBorrow: false, borrowFrom: 'w_point', prototype: true },
  { id: 'w_point', classId: W, name: '处刑', style: 'point', question: '先杀谁，才能把溢出伤害和斩首接起来？', startRows: ['w_same', 'w_straight', 'w_heavy'], pool: ['w_twin', 'w_verdict'], maxRows: 5, allowBorrow: false, borrowFrom: 'w_suit', prototype: false },
];
