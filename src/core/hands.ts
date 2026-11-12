// Hand types (2D original data/handTypes.tsx v2 + utils/handEvaluator.ts; same table as the 3D prototypes' 03_rules.js).
// Keys are the original's internal Chinese names; `disp` is what the player sees.

export type HandName = '普通攻击' | '对子' | '顺子' | '连对' | '4顺' | '三条' | '5顺' | '三连对' | '6顺' | '葫芦' | '四条' | '大葫芦' | '五条' | '六条';

export const HAND_TYPES: Record<HandName, { id: string; disp: string; mult: number }> = {
  '普通攻击': { id: 'high_card', disp: '普通攻击', mult: 1.0 },
  '对子': { id: 'pair', disp: '对称打击', mult: 1.8 },
  '顺子': { id: 'straight_3', disp: '三连刺击', mult: 1.5 },
  '连对': { id: 'two_pair', disp: '对称阵列', mult: 2.4 },
  '4顺': { id: 'straight_4', disp: '四连裂空', mult: 2.0 },
  '三条': { id: 'three_of_a_kind', disp: '三星魔咒', mult: 2.8 },
  '5顺': { id: 'straight_5', disp: '五连裂斩', mult: 2.6 },
  '三连对': { id: 'three_pair', disp: '三重阵列', mult: 3.4 },
  '6顺': { id: 'straight_6', disp: '天启裂斩', mult: 3.5 },
  '葫芦': { id: 'full_house', disp: '圣裁之印', mult: 3.8 },
  '四条': { id: 'four_of_a_kind', disp: '四星血祭', mult: 4.5 },
  '大葫芦': { id: 'full_house_big', disp: '王葬', mult: 5.8 },
  '五条': { id: 'five_of_a_kind', disp: '五星裁决', mult: 6.5 },
  '六条': { id: 'six_of_a_kind', disp: '六星灭世', mult: 10.0 },
};
export const HAND_PRIORITY: HandName[] = ['六条', '五条', '大葫芦', '四条', '葫芦', '三连对', '6顺', '三条', '5顺', '连对', '4顺', '对子', '顺子', '普通攻击'];
/** Presentation tier for escalating VFX: 0 normal, 1 pair / 3-straight, 2 mid, 3 high, 4 top. */
export const HAND_TIER: Record<HandName, number> = { '普通攻击': 0, '对子': 1, '顺子': 1, '连对': 2, '4顺': 2, '三条': 2, '5顺': 3, '三连对': 3, '6顺': 3, '葫芦': 3, '四条': 4, '大葫芦': 4, '五条': 4, '六条': 4 };
export const STRAIGHTS: HandName[] = ['顺子', '4顺', '5顺', '6顺'];
export const TRIPLE_OR_BETTER: HandName[] = ['三条', '四条', '五条', '六条', '葫芦', '大葫芦'];

export interface HandDie { value: number; ignoreForHandType?: boolean }
export interface HandResult { bestHand: string; activeHands: HandName[] }

export function checkHands(dice: readonly HandDie[]): HandResult {
  if (dice.length === 0) return { bestHand: '普通攻击', activeHands: ['普通攻击'] };
  const handDice = dice.filter(d => !d.ignoreForHandType);
  const values = (handDice.length > 0 ? handDice : dice).map(d => d.value).sort((a, b) => a - b);
  const counts: Record<number, number> = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const sc = Object.values(counts).sort((a, b) => b - a), maxCount = sc[0], n = dice.length;
  const isTwoPair = sc.length >= 2 && sc[0] === 2 && sc[1] === 2;
  const isThreePair = sc.length >= 3 && sc[0] === 2 && sc[1] === 2 && sc[2] === 2;
  const fhSmall = sc.length >= 2 && sc[0] === 3 && sc[1] === 2 && n === 5;
  const fhBig = (sc.length >= 2 && sc[0] === 3 && sc[1] === 3 && n === 6) || (sc.length >= 2 && sc[0] === 4 && sc[1] === 2 && n === 6);
  const uniq = [...new Set(values)];
  let straightLen = 0;
  if (uniq.length === n && n >= 3 && uniq[uniq.length - 1] - uniq[0] === n - 1) straightLen = n;
  const active: HandName[] = [];
  if (maxCount === 6 && n === 6) active.push('六条');
  else if (maxCount === 5 && n === 5) active.push('五条');
  else if (fhBig) active.push('大葫芦');
  else if (maxCount === 4 && n === 4) active.push('四条');
  else if (fhSmall) active.push('葫芦');
  else if (isThreePair && n === 6) active.push('三连对');
  else if (maxCount === 3 && n === 3) active.push('三条');
  else if (isTwoPair && n === 4) active.push('连对');
  else if (maxCount === 2 && n === 2) active.push('对子');
  if (straightLen) active.push(straightLen === 6 ? '6顺' : straightLen === 5 ? '5顺' : straightLen === 4 ? '4顺' : '顺子');
  if (active.length === 0) active.push('普通攻击');
  active.sort((a, b) => HAND_PRIORITY.indexOf(a) - HAND_PRIORITY.indexOf(b));
  return { bestHand: active.join(' + '), activeHands: active };
}

export const handTier = (h: HandResult) => Math.max(...h.activeHands.map(x => HAND_TIER[x] || 0));
export const handDisp = (h: HandResult) => h.activeHands.map(x => HAND_TYPES[x].disp).join(' + ');
/** Combined multiplier: 1 + Σ(mult − 1) over the active hands. */
export const handMultiplier = (h: HandResult) => h.activeHands.reduce((m, x) => m + (HAND_TYPES[x].mult - 1), 1);

/** Dice that could form a hand with others in the set (the subtle "can combine" shimmer). Returns indices. */
export function handCandidates(values: readonly number[]): Set<number> {
  const res = new Set<number>(); if (values.length < 2) return res;
  const byV = new Map<number, number[]>();
  values.forEach((v, i) => { if (!byV.has(v)) byV.set(v, []); byV.get(v)!.push(i); });
  for (const idx of byV.values()) if (idx.length >= 2) idx.forEach(i => res.add(i));
  const u = [...byV.keys()].sort((a, b) => a - b);
  for (let i = 0; i < u.length - 2; i++) {
    if (u[i + 1] === u[i] + 1 && u[i + 2] === u[i] + 2) {
      const s = new Set([u[i], u[i + 1], u[i + 2]]); let j = i + 3;
      while (j < u.length && u[j] === u[j - 1] + 1) s.add(u[j++]);
      values.forEach((v, k) => { if (s.has(v)) res.add(k); });
    }
  }
  return res;
}
