// Auto-play bot (rules only): used by tests (whole battles, zero errors) and by __dh.bot() in the game to drive the presentation.
// Greedy: try every subset of the hand against every target, score by effective damage (+ kill bonus, + armor when an attack is
// coming), reroll the dice that do not fit the best hand while rerolls are cheap.
import type { Battle } from './battle';
import type { Die, Enemy } from './types';

export interface BotMove { kind: 'reroll'; uids: number[] } export interface BotPlay { kind: 'play'; uids: number[]; target: number } export interface BotEnd { kind: 'end' }
export type BotStep = BotMove | BotPlay | BotEnd;

function subsets<T>(a: T[]): T[][] { const out: T[][] = []; for (let m = 1; m < 1 << a.length; m++) out.push(a.filter((_, i) => m & (1 << i))); return out; }

export function bestPlay(b: Battle): { uids: number[]; target: number; score: number; damage: number } | null {
  const hand = b.hand, foes = b.alive(); if (!hand.length || !foes.length) return null;
  const incoming = foes.some(e => b.intent(e).kind === 'atk');
  let best: { uids: number[]; target: number; score: number; damage: number } | null = null;
  for (const sel of subsets(hand)) {
    const uids = sel.map(d => d.uid);
    if (!b.canPlay(uids)) continue;
    for (const t of foes) {
      const o = b.preview(uids, t.uid); if (!o) continue;
      const targets: Enemy[] = o.aoe ? foes : [t];
      let score = 0;
      for (const e of targets) {
        const eff = o.armorBreak ? o.damage : Math.max(0, o.damage - e.armor);
        score += Math.min(eff, e.hp) + (eff >= e.hp ? 25 + (e.cat === 'boss' ? 500 : 0) : 0);
      }
      if (incoming) score += o.armor * 0.6;
      score += Math.min(o.heal, b.player.maxHp - b.player.hp) * 0.4 + Math.min(0, o.heal) * 0.8;
      if (!best || score > best.score) best = { uids, target: t.uid, score, damage: o.damage };
    }
  }
  return best;
}

/** Dice worth keeping: members of the best non-trivial hand in the current roll. */
function keepers(b: Battle): Set<number> {
  const p = bestPlay(b); const keep = new Set<number>();
  if (!p) return keep;
  const o = b.preview(p.uids); if (o && o.hands.activeHands[0] !== '普通攻击') p.uids.forEach(u => keep.add(u));
  return keep;
}

export function botStep(b: Battle): BotStep {
  if (b.mustEndTurn()) return { kind: 'end' };
  const hand: Die[] = b.hand;
  const cost = b.rerollHpCost();
  const keep = keepers(b);
  const cheap = cost === 0 || (cost > 0 && cost <= b.player.maxHp * 0.06 && b.player.hp > b.player.maxHp * 0.55);
  if (cheap && hand.length >= 2) {
    const re = hand.filter(d => !keep.has(d.uid) && d.value <= 4 && !d.def.isCursed);
    if (re.length && keep.size < hand.length) return { kind: 'reroll', uids: re.map(d => d.uid) };
  }
  const p = bestPlay(b);
  if (!p) return { kind: 'end' };
  return { kind: 'play', uids: p.uids, target: p.target };
}

/** Run a whole battle with the bot. Returns the outcome and how many turns / actions it took. */
export function autoBattle(b: Battle, o: { maxActions?: number; onEvents?: (ev: unknown[]) => void } = {}) {
  const max = o.maxActions ?? 600; let actions = 0, rerollsThisTurn = 0, turn = b.s.turn;
  if (b.s.phase === 'idle') { const ev = b.start(); o.onEvents?.(ev); }   // (an optional call would skip evaluating start())
  while (!b.s.result && actions++ < max) {
    if (b.s.turn !== turn) { turn = b.s.turn; rerollsThisTurn = 0; }
    let st = botStep(b);
    if (st.kind === 'reroll' && rerollsThisTurn >= 2) st = (() => { const p = bestPlay(b); return p ? { kind: 'play', uids: p.uids, target: p.target } as BotPlay : { kind: 'end' } as BotEnd; })();
    const r = st.kind === 'reroll' ? (rerollsThisTurn++, b.reroll(st.uids)) : st.kind === 'play' ? b.play(st.uids, st.target) : b.endTurn();
    if (!r.ok) { const e = b.endTurn(); if (!e.ok) throw new Error('bot stuck: ' + r.reason + ' / ' + e.reason); o.onEvents?.(e.events); continue; }
    o.onEvents?.(r.events);
  }
  return { result: b.s.result, turns: b.s.turn, actions };
}
