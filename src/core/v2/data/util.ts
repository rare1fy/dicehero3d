// Small builders for the row tables. A tier spec lists only what that tier adds; `ladder` makes each tier cumulative
// (SPEC 1.5: "+" = on top of the tier below). A new 'dmg' effect replaces the inherited damage unless it has `add`.
// earnDie is never inherited (the ultimate does not also earn a die). Singleton kinds (taunt, armor, the same hook…) are replaced.
import type { Effect, EvoDef, RowDef, Target, Tier, TierName, TierRule } from '../types';
import { TIER_ORDER } from '../types';

type FxIn = Effect & { add?: boolean };
export type TierSpec = Partial<Record<TierName, { fx: FxIn[]; coefMul?: number; coefAdd?: number; noInherit?: boolean }>>;

export function ladder(spec: TierSpec): Partial<Record<TierName, Tier>> {
  const out: Partial<Record<TierName, Tier>> = {};
  let acc: Effect[] = [];
  for (const name of TIER_ORDER) {
    const t = spec[name];
    if (!t) continue;
    const base = t.noInherit ? [] : acc.filter(e => e.t !== 'earnDie');
    const hasNewDmg = t.fx.some(e => e.t === 'dmg' && !e.add);
    const kept = hasNewDmg ? base.filter(e => e.t !== 'dmg') : base;
    const clean = t.fx.map(e => { const c = { ...e } as FxIn; delete c.add; return c as Effect; });
    const merged = mergeFx(kept, clean);
    out[name] = { effects: merged, coefMul: t.coefMul, coefAdd: t.coefAdd };
    acc = merged;
  }
  return out;
}

const fxKey = (e: Effect): string | null => {
  switch (e.t) {
    case 'taunt': case 'earnDie': case 'freeBlood': return e.t;
    case 'stun': return 'stun';
    case 'status': return 'status:' + e.status;
    case 'armor': return 'armor:' + (e.suit || '');
    case 'barrier': return 'barrier';
    case 'heal': return 'heal';
    case 'capUp': return 'cap:' + e.which;
    case 'hook': return 'hook:' + e.id;
    default: return null;
  }
};

/** later effects of the same singleton kind replace earlier ones */
function mergeFx(a: Effect[], b: Effect[]): Effect[] {
  const out = a.slice();
  for (const e of b) {
    const k = fxKey(e);
    if (k) { const i = out.findIndex(x => fxKey(x) === k); if (i >= 0) { out[i] = e; continue; } }
    out.push(e);
  }
  return out;
}

export const dmg = (target: Target, mul = 1, o: { flat?: number; ignoreArmor?: boolean; armorBreak?: boolean; add?: boolean; raw?: boolean } = {}): FxIn => ({ t: 'dmg', target, mul, ...o });
export const st = (status: 'poison' | 'burn' | 'vulnerable' | 'weak' | 'berserk', value: number, target: Target | 'self', duration?: number, ofX?: number): Effect =>
  ({ t: 'status', status, value, target, duration, ofX });
export const stun = (target: Target, look: 'freeze' | 'stun' = 'stun', turns = 1, elseWeak?: number): Effect => ({ t: 'stun', target, look, turns, elseWeak });
export const hook = (id: string, p?: Record<string, number>): Effect => ({ t: 'hook', id, p });
export const EARN: Effect = { t: 'earnDie' };

/** v2.1 per-row tier table: steps(['2', 'single'], ['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']); the number before ～ is the min count */
export function steps(...list: Array<[string, TierName]>): TierRule['steps'] {
  return list.map(([label, tier]) => ({ min: parseInt(label, 10), tier, label }));
}

/**
 * Evolution helper. Without `apply` the special rule is not implemented yet: the row keeps its rules and gets coef ×1.2
 * (implemented: false so the report / UI can tell).
 */
export function evo(id: string, name: string, desc: string, apply?: (r: RowDef) => RowDef): EvoDef {
  return {
    id, name, desc, implemented: !!apply,
    apply: r => {
      const base: RowDef = { ...r, id, name, flags: { ...(r.flags || {}) }, tierRule: { ...r.tierRule } };
      if (apply) return apply(base);
      return { ...base, coef: r.coef.map(c => +(c * 1.2).toFixed(2)) as [number, number, number] };
    },
  };
}
export const withFlags = (r: RowDef, f: Record<string, number>): RowDef => ({ ...r, flags: { ...(r.flags || {}), ...f } });
/** map every tier's effect list */
export const mapTiers = (r: RowDef, f: (fx: Effect[], name: TierName) => Effect[]): RowDef => {
  const tiers: RowDef['tiers'] = {};
  for (const k of Object.keys(r.tiers) as TierName[]) tiers[k] = { ...r.tiers[k]!, effects: f(r.tiers[k]!.effects, k) };
  return { ...r, tiers };
};
/** add effects to one tier and every tier above it */
export const addFrom = (r: RowDef, from: TierName, fx: Effect[]): RowDef =>
  mapTiers(r, (list, k) => TIER_ORDER.indexOf(k) >= TIER_ORDER.indexOf(from) ? mergeFx(list, fx) : list);
