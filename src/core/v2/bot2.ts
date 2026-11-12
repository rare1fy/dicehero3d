// Bot for rules v2: plays whole battles and runs (tests, SPEC §7 metrics, and __dh-style auto play).
// Turn policy: (1) rerolls: keep the dice of the most promising row, Monte-Carlo the rest with a cheap face-only scorer;
// warrior pays blood while it is cheap. (2) plays: try every row × matching subset on a clone and score the resulting state;
// rogue looks one strike ahead. Mage compares chanting with playing by simulating to the next turn.
import type { Battle2, KnifeShape, RowRef } from './battle2';
import { kindSuit, kindValues } from './battle2';
import { matchRow, subsets } from './cond';
import type { Die, Enemy, Face, RowDef } from './types';
import { TIER_ORDER } from './types';

export interface Cand { ref: RowRef; uids: number[]; target: number; mark?: KnifeShape }

const TIER_VAL = [0, 6, 14, 24, 34];
/** policy switches for experiments */
export const BOT_OPTS: { mage: 'compare' | 'never' | 'ring' } = { mage: 'compare' };

/** cheap value of a face set: best row match by points × coefficient + tier value (no simulation) */
function faceScore(b: Battle2, faces: Face[], kinds: Die['kind'][]): number {
  let best = 0;
  const n = faces.length;
  const subs = subsets(n);
  for (const r of b.rows()) {
    const def = r.def;
    if (def.strike === 'second' && b.s.strikesUsed < 1) continue;
    for (const s of subs) {
      const m = matchRow(def, s.map(i => faces[i]), s.map(i => kinds[i])); if (!m) continue;
      const X = s.reduce((a, i) => a + faces[i].value, 0);
      const coef = coefGuess(def, r.level, m.tier);
      const v = X * coef * (m.tierIdx >= 2 ? Math.min(2, b.alive().length) * 0.8 + 0.2 : 1) + TIER_VAL[m.tierIdx];
      if (v > best) best = v;
    }
  }
  const basic = faces.map(f => f.value).sort((a, c) => c - a).slice(0, b.cls.basicAttack.maxDice).reduce((a, c) => a + c, 0);
  return Math.max(best, basic * 0.8);
}
function coefGuess(def: RowDef, level: number, tier: string): number {
  const t = def.tiers[tier as keyof RowDef['tiers']];
  let c = def.coef[level - 1] * (t?.coefMul ?? 1) + (t?.coefAdd ?? 0);
  if (def.flags?.bolts) c = 1 + def.coef[level - 1] / 3;   // star bolts: points + flat per bolt
  if (def.id.startsWith('r_poison')) c = 1 + def.coef[level - 1] * 0.6;
  return c;
}

function sampleFace(b: Battle2, d: Die, rnd: () => number): Face {
  const vals = kindValues(d.kind); const v = vals[Math.floor(rnd() * vals.length)];
  return { value: v, suit: kindSuit(b.cls.id, d.kind, v) };
}

/** Pick dice to reroll. Returns null to stop rerolling. */
export function chooseReroll(b: Battle2, rnd: () => number, samples = 10): number[] | null {
  const dice = b.dice(); if (!dice.length) return null;
  const faces = dice.map(d => d.face), kinds = dice.map(d => d.kind);
  const now = faceScore(b, faces, kinds);
  const free = b.s.freeRerollsLeft > 0;
  // candidate keep-sets: every subset (incl. empty)
  let best: { keep: number[]; ev: number } | null = null;
  const all = [[] as number[], ...subsets(dice.length)];
  for (const keep of all) {
    if (keep.length === dice.length) continue;
    const re = dice.map((_, i) => i).filter(i => !keep.includes(i));
    if (free && re.some(i => kinds[i] === 'cursed')) continue;
    let sum = 0;
    for (let k = 0; k < samples; k++) {
      const f2 = faces.slice();
      for (const i of re) f2[i] = sampleFace(b, dice[i], rnd);
      sum += faceScore(b, f2, kinds.map((kd, i) => re.includes(i) && kd === 'cursed' ? 'cursed' : kd));
    }
    const ev = sum / samples;
    if (!best || ev > best.ev) best = { keep, ev };
  }
  if (!best) return null;
  const gain = best.ev - now;
  if (free) return gain > 1.5 ? dice.filter((_, i) => !best!.keep.includes(i)).map(d => d.uid) : null;
  // paid (warrior blood): also buys +15% rage
  const info = b.rerollInfo(); if (info.bloodCost == null) return null;
  const p = b.s.player;
  const cost = info.bloodCost;
  const rageVal = p.rage < 5 ? now * 0.15 : 3;
  const hpOk = p.hp - cost > p.maxHp * 0.45 && cost <= p.maxHp * 0.09;
  if (!hpOk) return null;
  if (gain + rageVal > cost * 1.2) return dice.filter((_, i) => !best!.keep.includes(i)).map(d => d.uid);
  return null;
}

/** every legal (row, dice) pair right now, one target per pair (all enemies tried for single-target rows) */
export function candidates(b: Battle2): Cand[] {
  const dice = b.dice(); const out: Cand[] = []; const foes = b.alive(); if (!foes.length) return out;
  const subs = subsets(dice.length);
  const rows = b.rows();
  const shapes = b.markShapes();
  for (const r of rows) {
    // 飞刀: one candidate per shape it can mark
    const marks: Array<KnifeShape | undefined> = r.def.flags?.marksShape && shapes.length > 1 ? shapes : [undefined];
    for (const s of subs) {
      const uids = s.map(i => dice[i].uid);
      if (!b.check(r.ref, uids).match) continue;
      for (const t of foes) for (const mark of marks) out.push({ ref: r.ref, uids, target: t.uid, mark });
    }
  }
  const ba = b.cls.basicAttack;
  for (const s of subs) {
    if (s.length < ba.minDice || s.length > ba.maxDice) continue;
    const uids = s.map(i => dice[i].uid);
    for (const t of foes) out.push({ ref: 'basic', uids, target: t.uid });
  }
  return out;
}

function incoming(b: Battle2): number {
  let v = 0;
  for (const e of b.alive()) { const it = b.intent(e); if (it.kind === 'atk' && it.value) v += it.value; }
  return v;
}

/** value of a battle state from the player's point of view */
export function evalState(b: Battle2, inc: number): number {
  if (b.s.result === 'win') return 1e6 + b.s.player.hp * 10;
  if (b.s.result === 'lose') return -1e6;
  const p = b.s.player;
  let v = 0;
  const foes = b.alive();
  for (const e of foes) v -= e.hp + e.armor * 0.5 + 12 + (statusOn(e, 'stun') || statusOn(e, 'freeze') ? -8 : 0) + (e.interrupted ? -4 : 0) - stv(e, 'poison') * 1.2 - stv(e, 'burn') * 0.9;
  v -= (b.s.waves.length - 1 - b.s.waveIdx) * 60;
  v += p.hp * 1.3;
  const shield = Math.min(inc, p.armor + p.barrier);
  v += shield * 1.1;
  const nd = b.nextDice(); v += (nd.count - 3) * 10 + nd.overflow * 4;
  v += b.strikesLeft() * 8 * (b.dice().length ? 1 : 0.2);
  v -= p.backlash * 1.5;
  return v;
}
const statusOn = (e: Enemy, t: string) => e.statuses.some(s => s.type === t && s.value > 0);
const stv = (e: Enemy, t: string) => e.statuses.find(s => s.type === t)?.value || 0;

function applyCand(b: Battle2, c: Cand): Battle2 | null { const k = b.clone(); const r = k.play(c.ref, c.uids, c.target, c.mark ? { mark: c.mark } : undefined); return r.ok ? k : null; }

/** best play by one-step (rogue: two-step) lookahead */
export function bestPlay(b: Battle2, depth = b.cls.id === 'rogue' ? 2 : 1): { c: Cand; v: number } | null {
  const inc = incoming(b);
  const cs = candidates(b);
  let scored: Array<{ c: Cand; k: Battle2; v: number }> = [];
  for (const c of cs) { const k = applyCand(b, c); if (!k) continue; scored.push({ c, k, v: evalState(k, inc) }); }
  if (!scored.length) return null;
  scored.sort((a, c) => c.v - a.v);
  if (depth > 1) {
    // also look ahead from light row openers (1–2 dice): they set up 精准连击 even though they score low on their own
    const light = scored.slice(6).filter(x => x.c.ref !== 'basic' && x.c.uids.length <= 2);
    scored = [...scored.slice(0, 6), ...light.slice(0, 10)].map(x => {
      if (x.k.s.result || x.k.strikesLeft() <= 0 || !x.k.dice().length) return x;
      const nx = bestPlay(x.k, depth - 1);
      return nx && nx.v > x.v ? { ...x, v: nx.v } : x;
    });
    scored.sort((a, c) => c.v - a.v);
  }
  return { c: scored[0].c, v: scored[0].v };
}

/** Plays the current player turn to its end (including endTurn). */
export function botTurn(b: Battle2, rnd: () => number): void {
  let guard = 0;
  while (b.s.phase === 'player' && !b.s.result && guard++ < 40) {
    const turn = b.s.turn;
    // rerolls
    let rr = 0;
    while (rr++ < 8 && b.s.phase === 'player') {
      const re = chooseReroll(b, rnd); if (!re) break;
      if (!b.reroll(re).ok) break;
    }
    if (b.s.phase !== 'player') break;
    const inc = incoming(b);
    const stay = evalState(b, inc);
    const bp = b.strikesLeft() > 0 ? bestPlay(b) : null;
    // mage: chant (no play) vs play, compared one enemy turn ahead
    if (b.cls.id === 'mage' && b.s.strikesUsed === 0 && bp && BOT_OPTS.mage !== 'never') {
      if (BOT_OPTS.mage === 'ring' && b.s.turnDice < 6 && !bp.c.uids.length) { b.endTurn(); return; }
      const a = b.clone(); a.endTurn();
      const c = b.clone(); c.play(bp.c.ref, bp.c.uids, bp.c.target, bp.c.mark ? { mark: bp.c.mark } : undefined); if (!c.s.result) { finishGreedy(c); c.endTurn(); }
      const va = evalLong(a), vc = evalLong(c);
      if (va > vc) { b.endTurn(); return; }
    }
    if (!bp || (bp.v <= stay && b.cls.id !== 'warrior' && b.s.strikesUsed > 0)) { b.endTurn(); return; }
    const r = b.play(bp.c.ref, bp.c.uids, bp.c.target, bp.c.mark ? { mark: bp.c.mark } : undefined);
    if (!r.ok) { b.endTurn(); return; }
    if (b.s.turn !== turn || b.s.result) return;   // wave cleared / battle over
    if (b.strikesLeft() <= 0 || !b.dice().length) { if (b.s.phase === 'player') b.endTurn(); return; }
  }
  if (b.s.phase === 'player' && !b.s.result) b.endTurn();
}
function finishGreedy(b: Battle2) {
  let g = 0;
  while (b.s.phase === 'player' && b.strikesLeft() > 0 && b.dice().length && g++ < 6) { const p = bestPlay(b, 1); if (!p) break; if (!b.play(p.c.ref, p.c.uids, p.c.target, p.c.mark ? { mark: p.c.mark } : undefined).ok) break; }
}
function evalLong(b: Battle2) {
  if (b.s.result === 'win') return 1e6; if (b.s.result === 'lose') return -1e6;
  const inc = incoming(b);
  return evalState(b, inc) + (b.s.turnDice - 3) * 6 + b.s.chantRing * 3;
}

export function autoBattle2(b: Battle2, o: { seed?: number; maxTurns?: number } = {}) {
  let st = (o.seed ?? 12345) >>> 0;
  const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
  if (b.s.phase === 'idle') b.start();
  const max = o.maxTurns ?? 60;
  while (!b.s.result && b.s.turn <= max) botTurn(b, rnd);
  return { result: b.s.result, turns: b.stats.turns };
}

export { TIER_ORDER };
