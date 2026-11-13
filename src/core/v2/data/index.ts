// Data registry: rows, tablets, evolutions, loadout builders.
import type { ClassId, Level, Loadout, RowDef, RowSlot, TabletDef } from '../types';
import { W_ROWS, W_TABLETS } from './rows_warrior';
import { M_ROWS, M_TABLETS } from './rows_mage';
import { R_ROWS, R_TABLETS } from './rows_rogue';
import { V3_ROWS, V3_TABLETS } from './rows_v3';
import { V4_ROWS, V4_TABLETS, sheathMaxLevel } from './rows_v4';
import { CLASSES } from './classes';

export * from './classes';
export * from './talents';
export * from './enemies';
export * from './relics';
export { V4_PARAMS, AWAKEN_V4, sleeveRefill, holdBarrier, sheathMaxLevel, formsPattern } from './rows_v4';

const ALL_ROWS = [...W_ROWS, ...M_ROWS, ...R_ROWS, ...V3_ROWS, ...V4_ROWS];
export const ROWS: Record<string, RowDef> = Object.fromEntries(ALL_ROWS.map(r => [r.id, r]));
export const TABLETS: Record<string, TabletDef> = Object.fromEntries([...W_TABLETS, ...M_TABLETS, ...R_TABLETS, ...V3_TABLETS, ...V4_TABLETS].map(t => [t.id, t]));

export function rowDef(id: string): RowDef { const r = ROWS[id]; if (!r) throw new Error('unknown row ' + id); return r; }
/** v4: the highest level a row can reach (default 3) */
export function maxLevelOf(id: string): Level { return ROWS[id]?.flags?.sheath ? sheathMaxLevel() : ROWS[id]?.maxLevel ?? 3; }
/** rules v4 loadout (any v4 row on it) */
export const isV4Loadout = (l: Loadout) => l.tablets.some(t => t.slots.some(s => ROWS[s.rowId]?.tags.includes('v4')));

/** The row a slot actually plays: the evolved row if it has been rewritten. */
export function slotRow(slot: RowSlot): RowDef {
  const base0 = rowDef(slot.rowId);
  // v3: level-III effects ride on every tier
  const lf = base0.levelFx?.[3];
  let base = lf && slot.level >= 3 ? { ...base0, tiers: Object.fromEntries(Object.entries(base0.tiers).map(([k, t]) => [k, { ...t!, effects: [...t!.effects, ...lf] }])) } : base0;
  // v4: the named upgrades of each level reached (II, then III)
  for (const lv of [2, 3] as const) { const f = base0.levelUp?.[lv]; if (f && slot.level >= lv) base = f(base); }
  if (!slot.evolvedTo) return base;
  const ev = base.evolutions.find(e => e.id === slot.evolvedTo);
  return ev ? ev.apply(base) : base;
}

/** Rows a tablet may add: its pool, plus (borrow slot) the other tablet's start rows and pool. */
export function addableRows(tabletId: string, slots: RowSlot[]): Array<{ rowId: string; borrowed: boolean }> {
  const t = TABLETS[tabletId]; const have = new Set(slots.map(s => s.rowId));
  const own = [...t.startRows, ...t.pool].filter(id => !have.has(id)).map(rowId => ({ rowId, borrowed: false }));
  const borrowedUsed = slots.some(s => s.borrowed);
  // v2.1 prototype: allowBorrow is false on every tablet, so no borrowed rows are offered
  const other = t.allowBorrow && t.borrowFrom && !borrowedUsed ? [...TABLETS[t.borrowFrom].startRows, ...TABLETS[t.borrowFrom].pool].filter(id => !have.has(id)).map(rowId => ({ rowId, borrowed: true })) : [];
  return [...own, ...other];
}

export function loadoutB(tabletId: string, o: { full?: boolean; level?: Level } = {}): Loadout {
  const t = TABLETS[tabletId]; if (!t) throw new Error('unknown tablet ' + tabletId);
  const lv = o.level ?? 1;
  const cap = (id: string) => Math.min(lv, maxLevelOf(id)) as Level;
  const slots: RowSlot[] = t.startRows.map(rowId => ({ rowId, level: cap(rowId) }));
  if (o.full) for (const a of addableRows(t.id, slots)) { if (slots.length >= t.maxRows) break; if (!a.borrowed || !slots.some(s => s.borrowed)) slots.push({ rowId: a.rowId, level: cap(a.rowId), borrowed: a.borrowed || undefined }); }
  return { version: 'B', tablets: [{ tabletId, slots }] };
}

export function loadoutA(classId: ClassId): Loadout {
  const [a, b] = CLASSES[classId].versionA;
  const tab = (row: string) => [...W_TABLETS, ...M_TABLETS, ...R_TABLETS].find(t => t.startRows.includes(row) || t.pool.includes(row))!.id;
  return { version: 'A', tablets: [{ tabletId: tab(a), slots: [{ rowId: a, level: 1 }] }, { tabletId: tab(b), slots: [{ rowId: b, level: 1 }] }] };
}
