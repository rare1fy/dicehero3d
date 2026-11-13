// Three classes (SPEC 2.1–2.3). Pure data; change numbers here when the spec moves.
import type { ClassDefV2, ClassId, Suit } from '../types';
import { TALENTS } from './talents';

const table = (s: Suit[]): Suit[] => ['none', ...s];

export const SUIT_TABLE: Record<ClassId, Suit[]> = {
  warrior: table(['axe', 'axe', 'axe', 'blood', 'blood', 'fury']),
  mage: table(['star', 'star', 'moon', 'moon', 'sun', 'void']),
  rogue: table(['poison', 'blade', 'blade', 'blade', 'shadow', 'shadow']),
};
/** 怒火骰: 1–2 blood, 3–6 fury */
export const FURY_DIE_SUITS: Suit[] = table(['blood', 'blood', 'fury', 'fury', 'fury', 'fury']);
/** v2.1: 2/2/4/5/6/6 → star star moon sun void void */
export const STAR_DIE_VALUES = [2, 2, 4, 5, 6, 6];
export const CRACKED_VALUES = [1, 1, 1, 2, 2, 2];

export const SUIT_CN: Record<Suit, string> = {
  axe: '斧', blood: '血', fury: '怒', star: '星', moon: '月', sun: '日', void: '虚空', poison: '毒', blade: '刃', shadow: '影', none: '无',
};

function mk(id: ClassId, o: Omit<ClassDefV2, 'id' | 'suitOf' | 'suitTable' | 'talents' | 'baseDice' | 'maxDice' | 'freeRerolls'>): ClassDefV2 {
  const t = SUIT_TABLE[id];
  return { id, suitTable: t, suitOf: v => t[v] ?? 'none', baseDice: 3, maxDice: 6, freeRerolls: 1, talents: TALENTS.filter(x => x.classId === id), ...o };
}

export const CLASSES: Record<ClassId, ClassDefV2> = {
  warrior: mk('warrior', {
    name: '嗜血狂战', hp: 120,
    strikesPerTurn: 1, maxStrikes: 1, leftover: 'dissipate', overflow: 'damagePct',
    basicAttack: { minDice: 1, maxDice: 3, coef: 1, name: '劈砍' },
    specialDice: ['furyDie', 'titanDie'],
    mechanics: ['bloodReroll', 'behead', 'perfectGuard', 'stunGuard', 'overflow'],
    earnDieMode: 'nextTurnPlusOne',
    tablets: ['w_v3', 'w_suit', 'w_point'], versionA: ['w_axe', 'w_same'],
  }),
  mage: mk('mage', {
    name: '星界魔导', hp: 110,   // v2.2 tuning: 100 → 110 (core2_report 数值调整)
    strikesPerTurn: 1, maxStrikes: 1, leftover: 'retain', overflow: 'discard',
    basicAttack: { minDice: 1, maxDice: 1, coef: 1, name: '奥术弹' },   // v3: mage hands in 1 loose die
    specialDice: ['starDie'],
    mechanics: ['chant', 'barrier', 'backlash', 'overcharge', 'overload', 'resonance'],
    earnDieMode: 'resonance',
    tablets: ['m_v3', 'm_suit', 'm_point'], versionA: ['m_sun', 'm_pairs'],
  }),
  rogue: mk('rogue', {
    name: '影锋刺客', hp: 90,
    strikesPerTurn: 2, maxStrikes: 4, leftover: 'secondStrike', overflow: 'discard',
    basicAttack: { minDice: 1, maxDice: 1, coef: 1, name: '袖箭', shadowify: true },
    specialDice: ['shadowDie'],
    mechanics: ['twoStrikes', 'preciseBonus', 'preciseSpawn', 'knifeMark', 'shadowDie'],
    earnDieMode: 'strikePlusShadow',
    tablets: ['r_v3', 'r_suit', 'r_point'], versionA: ['r_shadow', 'r_knife'],
  }),
};
