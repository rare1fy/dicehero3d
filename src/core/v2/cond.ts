// Condition matching and tier lookup (SPEC 1.5). Pure functions over faces: the battle, the UI preview and the bot all call these.
import type { Condition, DieKind, Face, RowDef, Suit, TierName, TierRule } from './types';
import { TIER_ORDER } from './types';

export interface Match {
  /** dice that count toward the tier (after countBonus) */
  count: number;
  /** companion dice (fury row): add points, not tier */
  companions: number;
  tier: TierName;
  tierIdx: number;
}

/** count → tier for a rule (v2.1: the row's own steps); null if the row cannot fire with that many dice. */
export function tierOf(rule: TierRule, rawCount: number): TierName | null {
  if (rawCount < 1 || !rule.steps.length) return null;
  if (rule.fixedCount != null && rawCount !== rule.fixedCount) return null;
  if (rawCount < rule.steps[0].min) return null;
  const count = rawCount + (rule.countBonus || 0);
  let t: TierName | null = null;
  for (const s of rule.steps) if (count >= s.min) t = s.tier;
  return t;
}
/** the step (lamp) a count lands on */
export function stepOf(rule: TierRule, rawCount: number) {
  const t = tierOf(rule, rawCount); if (!t) return null;
  const count = rawCount + (rule.countBonus || 0);
  let idx = 0; rule.steps.forEach((s, i) => { if (count >= s.min) idx = i; });
  return { ...rule.steps[idx], idx };
}

export const tierIdx = (t: TierName) => TIER_ORDER.indexOf(t);

const usable = (f: Face, k?: DieKind) => k !== 'cursed' && f.value > 0;

function counts(vals: number[]) { const m = new Map<number, number>(); for (const v of vals) m.set(v, (m.get(v) || 0) + 1); return m; }

export function isStraight(vals: number[]): boolean {
  if (vals.length < 2) return false;
  const s = vals.slice().sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1] + 1) return false;
  return true;
}

/**
 * Does this set of handed-in dice satisfy the condition? Returns the tier count and companion count, or null.
 * `loose` (万象归一): a same-value set may contain exactly one odd die when it has ≥3 dice.
 */
export function matchCond(cond: Condition, faces: Face[], kinds: (DieKind | undefined)[] = [], o: { loose?: boolean; anyFourSuits?: boolean } = {}): { count: number; companions: number } | null {
  const n = faces.length; if (!n) return null;
  if (cond.t === 'any') return n >= cond.min && n <= cond.max ? { count: n, companions: 0 } : null;
  for (let i = 0; i < n; i++) if (!usable(faces[i], kinds[i])) return null;
  const vals = faces.map(f => f.value);
  switch (cond.t) {
    case 'suit': {
      const k = faces.filter(f => f.suit === cond.suit).length;
      const other = n - k;
      if (k < 1 || other > (cond.companions || 0)) return null;
      return { count: k, companions: other };
    }
    case 'sameValue': {
      const c = counts(vals);
      if (c.size === 1) return { count: n, companions: 0 };
      if (o.loose && n >= 3 && c.size === 2 && [...c.values()].some(x => x === n - 1)) return { count: n, companions: 0 };
      return null;
    }
    case 'straight': return isStraight(vals) ? { count: n, companions: 0 } : null;
    case 'allAtLeast': return vals.every(v => v >= cond.value) ? { count: n, companions: 0 } : null;
    case 'everyValuePaired': { const c = counts(vals); return n >= 2 && [...c.values()].every(x => x >= 2) ? { count: n, companions: 0 } : null; }
    case 'suitMix': {
      const have = new Map<Suit, number>(); for (const f of faces) have.set(f.suit, (have.get(f.suit) || 0) + 1);
      const need = cond.need as Record<string, number>;
      for (const s of have.keys()) if (!(s in need)) return null;
      for (const [s, k] of Object.entries(need)) { const h = have.get(s as Suit) || 0; if (cond.atLeast ? h < k : h !== k) return null; }
      return { count: n, companions: 0 };
    }
    case 'twoPair': { if (n !== 4) return null; const c = [...counts(vals).values()].sort(); return c.length === 2 && c[0] === 2 && c[1] === 2 ? { count: 4, companions: 0 } : null; }
    case 'fullHouse': { if (n !== 5) return null; const c = [...counts(vals).values()].sort(); return c.length === 2 && c[0] === 2 && c[1] === 3 ? { count: 5, companions: 0 } : null; }
    case 'sumAtLeast': { const need = cond.byCount[n]; return need != null && vals.reduce((a, b) => a + b, 0) >= need ? { count: n, companions: 0 } : null; }
    case 'mixedRelease': {
      if (n < cond.minDice) return null;
      const have = new Map<Suit, number>(); for (const f of faces) if (f.suit !== 'none') have.set(f.suit, (have.get(f.suit) || 0) + 1);
      // 元素之心: four different suits with ≥1 each also fires
      if (o.anyFourSuits && have.size >= 4) return { count: n, companions: 0 };
      return [...have.values()].filter(k => k >= cond.perSuit).length >= cond.minSuits ? { count: n, companions: 0 } : null;
    }
  }
  return null;
}

export function matchRow(row: RowDef, faces: Face[], kinds: (DieKind | undefined)[] = []): Match | null {
  const m = matchCond(row.cond, faces, kinds, { loose: !!row.flags?.looseSame, anyFourSuits: !!row.flags?.anyFourSuits });
  if (!m) return null;
  if (row.tierRule.maxDice && faces.length > row.tierRule.maxDice) return null;
  const t = tierOf(row.tierRule, m.count);
  if (!t) return null;
  return { count: m.count, companions: m.companions, tier: t, tierIdx: tierIdx(t) };
}

/** All subsets (as index lists) of n items, non-empty. n ≤ 6 → at most 63. */
export function subsets(n: number): number[][] {
  const out: number[][] = [];
  for (let m = 1; m < 1 << n; m++) { const s: number[] = []; for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(i); out.push(s); }
  return out;
}

/** Best match this row can make from any subset of the given faces (for the "this row can reach tier N" lamp). */
export function bestMatch(row: RowDef, faces: Face[], kinds: (DieKind | undefined)[] = []): { match: Match; idx: number[] } | null {
  let best: { match: Match; idx: number[] } | null = null;
  for (const s of subsets(faces.length)) {
    const m = matchRow(row, s.map(i => faces[i]), s.map(i => kinds[i]));
    if (!m) continue;
    if (!best || m.tierIdx > best.match.tierIdx || (m.tierIdx === best.match.tierIdx && s.length > best.idx.length)) best = { match: m, idx: s };
  }
  return best;
}
