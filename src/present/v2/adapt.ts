// Adapters between the v2 rules (core/v2) and the UI-layer kit (ui3d): id mapping (suits, special dice, row condition icons),
// the bot recorder (botTurn plays a turn on a clone; we replay its actions on the live battle so every event is staged), and the
// debug node jump. No rules are computed here: values, tiers, previews and choices all come from Battle2 / Run2.
import type { Battle2, BoardRow, KnifeShape, RowRef } from '../../core/v2/battle2';
import type { Run2, NodeKind } from '../../core/v2/run2';
import type { DieKind, Suit as CoreSuit } from '../../core/v2/types';
import { botTurn } from '../../core/v2/bot2';
import type { TabletRow, RowCond } from '../ui3d/tablet';
import type { SpecialId, SuitId } from '../ui3d/suitData';

/** core suit → ui3d suit id (ui3d calls 怒 'rage') */
export function uiSuit(s: CoreSuit): SuitId | null { return s === 'none' ? null : s === 'fury' ? 'rage' : (s as SuitId); }
/** core die kind → ui3d special skin */
export function uiSpecial(k: DieKind): SpecialId | undefined {
  return k === 'furyDie' ? 'fury' : k === 'titanDie' ? 'titan' : k === 'starDie' ? 'starry' : k === 'shadowDie' ? 'shadowres' : undefined;
}

/** a board row → a tablet row (condition icon + one lamp per tier step) */
export function tabletRow(r: BoardRow): TabletRow {
  const ic = r.def.icon; let cond: RowCond;
  if ((ic.kind === 'suit' || ic.kind === 'one') && ic.suit && uiSuit(ic.suit)) cond = { kind: 'suit', suit: uiSuit(ic.suit)! };
  else if (ic.kind === 'mix' && ic.suits?.length) cond = { kind: 'mix', suits: ic.suits.map(uiSuit).filter((s): s is SuitId => !!s) };
  else if (ic.kind === 'straight') cond = { kind: 'straight' };
  else if (ic.kind === 'same' || ic.kind === 'pairs' || ic.kind === 'twoPair' || ic.kind === 'fullHouse') cond = { kind: 'pair' };
  else if (ic.kind === 'sum') cond = { kind: 'sum' };
  else if (ic.kind === 'atLeast') cond = { kind: 'big' };
  else cond = { kind: 'any' };
  return { id: r.def.id, cond, tiers: Math.max(1, Math.min(5, r.def.tierRule.steps.length)) };
}
export const BASIC_ROW: TabletRow = { id: 'basic', cond: { kind: 'any' }, tiers: 1 };
/** lamp count for a tier id on a row (index of its step + 1) */
export function lampsFor(r: BoardRow | null, tier: string | null | undefined) {
  if (!r || !tier) return 0; const i = r.def.tierRule.steps.findIndex(s => s.tier === tier); return i < 0 ? 1 : i + 1;
}

// ---------------------------------------------------------------- bot recorder
export type BotAct = { k: 'reroll'; uids: number[] } | { k: 'play'; ref: RowRef; uids: number[]; target?: number; mark?: KnifeShape } | { k: 'end' };
/** Plays the current turn with botTurn on a clone and returns the actions it took, in order (the live battle is untouched). */
export function recordBotTurn(b: Battle2, rnd: () => number): BotAct[] {
  const c = b.clone(), log: BotAct[] = [];
  const rr = c.reroll.bind(c), pl = c.play.bind(c), en = c.endTurn.bind(c);
  c.reroll = (uids: number[]) => { const r = rr(uids); if (r.ok) log.push({ k: 'reroll', uids: uids.slice() }); return r; };
  c.play = (ref, uids, target, opts) => { const r = pl(ref, uids, target, opts); if (r.ok) log.push({ k: 'play', ref, uids: uids.slice(), target, mark: opts?.mark }); return r; };
  c.endTurn = () => { const r = en(); if (r.ok) log.push({ k: 'end' }); return r; };
  botTurn(c, rnd);
  return log;
}

// ---------------------------------------------------------------- debug: jump to a node
/** Debug only (__dh.goto): move the run to the first node of a kind. Uses Run2 internals (the shop builder is private). */
export function gotoNode(run: Run2, kind: 'normal' | 'elite' | 'shop' | 'boss') {
  const want: NodeKind = kind === 'boss' ? 'midBoss' : kind;
  const idx = run.s.nodes.findIndex(n => n.kind === want); if (idx < 0) return false;
  run.battle = null; run.s.queue = []; run.s.node = idx;
  if (want === 'shop') { run.s.phase = 'shop'; run.s.shop = (run as unknown as { makeShop(): typeof run.s.shop }).makeShop(); run.s.shopBought = { potions: 0, engrave: 0, refresh: 0 }; }
  else run.s.phase = 'battle';
  return true;
}
