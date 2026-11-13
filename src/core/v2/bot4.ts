// v4 bots (CORE4 §3). botTurn() in bot2.ts hands v4 battles here.
// · 刺客: exact one-turn expectimax over (dice multiset, free rerolls, strike number, 袖箭 used) — the v4calc/rogue.py idea —
//   with each pattern valued from the real row defs (level, targets ≈ enemies alive); targets are then picked on clones.
// · 魔导: rule policy (清场 / 满 6 / 5 颗够好 / 反噬 / 挨打要冻或补刀 / 3 颗充能) checked on clones, with a survival override.
// · 狂战: every play (and the follow-up after 斩杀再动) is tried on a clone through the enemy turn, so 斩 and 挡 are compared on
//   the same scale; rerolls and blood sales use a fast face-only planner (P(behead or guard) feeds the 血偿 expectation).
import type { Battle2, PlayOpts, RowRef } from './battle2';
import { tierOf } from './cond';
import { ENEMY_TRAITS, FIGHT_SCALE, V4_PARAMS, enemyCfgV2, sleeveRefill } from './data';
import type { Effect, Enemy, RowDef, Target } from './types';

// ───────────────────────────────────────────────────────── multisets (values 1..6, ≤ 6 dice)
const P7 = [1, 7, 49, 343, 2401, 16807];
interface MS { key: number; n: number; sum: number; c: number[] }
const MS_LIST: MS[] = [];
const MS_IDX = new Map<number, number>();
(function build() {
  const rec = (v: number, c: number[], n: number) => {
    if (v === 6) { const key = c.reduce((a, x, i) => a + x * P7[i], 0); MS_IDX.set(key, MS_LIST.length); MS_LIST.push({ key, n, sum: c.reduce((a, x, i) => a + x * (i + 1), 0), c: c.slice() }); return; }
    for (let k = 0; n + k <= 6; k++) { c[v] = k; rec(v + 1, c, n + k); }
    c[v] = 0;
  };
  rec(0, [0, 0, 0, 0, 0, 0], 0);
})();
const keyOf = (vals: number[]) => vals.reduce((a, v) => a + P7[v - 1], 0);
/** kinds bitmask: 1 loose, 2 same, 4 straight, 8 array */
function kindsOf(m: MS): number {
  let k = 0; const d = m.c.filter(x => x > 0).length;
  if (m.n === 1) k |= 1;
  if (m.n >= 2 && d === 1) k |= 2;
  if (m.n >= 3 && d === m.n) { const lo = m.c.findIndex(x => x > 0), hi = 5 - [...m.c].reverse().findIndex(x => x > 0); if (hi - lo === m.n - 1) k |= 4; }
  if (m.n >= 4 && d >= 2 && m.c.every(x => x === 0 || x >= 2)) k |= 8;
  return k;
}
interface Sub { sub: number; rest: number; n: number; sum: number; kinds: number }
const SUBS: Sub[][] = MS_LIST.map(m => {
  const out: Sub[] = [];
  const rec = (v: number, s: number[]) => {
    if (v === 6) {
      const n = s.reduce((a, b) => a + b, 0); if (!n) return;
      const sub = s.reduce((a, x, i) => a + x * P7[i], 0);
      const sm = MS_LIST[MS_IDX.get(sub)!];
      out.push({ sub, rest: m.key - sub, n, sum: sm.sum, kinds: kindsOf(sm) });
      return;
    }
    for (let k = 0; k <= m.c[v]; k++) { s[v] = k; rec(v + 1, s); }
    s[v] = 0;
  };
  rec(0, [0, 0, 0, 0, 0, 0]);
  return out;
});
/** outcomes of rolling r dice: [multiset key, probability] */
const OUT: Array<Array<[number, number]>> = [[[0, 1]]];
for (let r = 1; r <= 6; r++) {
  const m = new Map<number, number>();
  for (const [k, p] of OUT[r - 1]) for (let v = 0; v < 6; v++) m.set(k + P7[v], (m.get(k + P7[v]) || 0) + p / 6);
  OUT.push([...m.entries()]);
}

// ───────────────────────────────────────────────────────── pattern values from the real row defs
type Kind = 'loose' | 'same' | 'straight' | 'array';
const KIND_BIT: Record<Kind, number> = { loose: 1, same: 2, straight: 4, array: 8 };
const COND_KIND: Record<string, Kind> = { sameValue: 'same', straight: 'straight', array: 'array' };
/** how many enemies a target hits, as a single-target equivalent (extra targets count 0.75: overkill, early deaths) */
function targetFactor(t: Target, alive: number): number {
  const extra = (k: number) => 1 + 0.75 * Math.max(0, Math.min(k, alive - 1));
  switch (t) { case 'two': return extra(1); case 'three': return extra(2); case 'four': return extra(3); case 'all': case 'others': return extra(5); default: return 1; }
}
interface PatVal { mul: number; flat: number; refill: boolean; armorMul: number; stun: Target | null; ref: RowRef }
/** value of handing in k dice of a kind: damage ≈ sum × mul + flat (poison ≈ 1.5 per stack) */
function patternTable(b: Battle2): (kind: Kind, k: number) => PatVal | null {
  const alive = Math.max(1, b.alive().length);
  const cache = new Map<string, PatVal | null>();
  const rowFor = (kind: Kind) => kind === 'loose' ? null : b.rows().find(r => COND_KIND[r.def.cond.t] === kind) || null;
  const basic = b.basicRowDef();
  return (kind, k) => {
    const id = kind + k; if (cache.has(id)) return cache.get(id)!;
    let out: PatVal | null = null;
    const r = rowFor(kind);
    const def = kind === 'loose' ? basic?.def : r?.def, level = kind === 'loose' ? basic?.level ?? 1 : r?.level ?? 1;
    if (def) {
      const tn = kind === 'loose' ? 'single' : tierOf(def.tierRule, k);
      const t = tn ? def.tiers[tn] : null;
      if (t) {
        const coef = def.coef[level - 1] * (kind === 'loose' ? 1 : V4_PARAMS.dmgScale[b.cls.id] ?? 1) * (t.coefMul ?? 1) + (t.coefAdd ?? 0);
        out = { mul: 0, flat: 0, refill: false, armorMul: 0, stun: null, ref: kind === 'loose' ? 'basic' : r!.ref };
        for (const e of t.effects as Effect[]) {
          if (e.t === 'dmg') out.mul += (e.mul ?? 1) * coef * targetFactor(e.target, alive) * (e.exec ? 1.1 : 1);
          else if (e.t === 'status' && e.status === 'poison' && e.target !== 'self') { const tf = targetFactor(e.target, alive); if (e.ofX != null) out.mul += e.ofX * 1.5 * tf; else out.flat += e.value * 1.5 * tf; }
          else if (e.t === 'status' && e.status === 'burn' && e.target !== 'self') out.mul += (e.ofX ?? 0) * 1.0 * targetFactor(e.target, alive);
          else if (e.t === 'hook' && e.id === 'refill') out.refill = true;
          else if (e.t === 'armor' && e.of === 'coef2') out.armorMul += e.mul * (def.coef2 ? def.coef2[level - 1] : 1);
          else if (e.t === 'stun') out.stun = e.target;
        }
      }
    }
    cache.set(id, out); return out;
  };
}

// ───────────────────────────────────────────────────────── 刺客: one-turn expectimax
type RogueAction = { a: 'end' } | { a: 'reroll'; rer: number } | { a: 'strike'; sub: number; kind: Kind };
class RogueSolver {
  private memo = new Float64Array(MS_LIST.length * 4 * 2 * 7).fill(NaN);
  constructor(private val: (kind: Kind, k: number) => PatVal | null, private cap: number) {}
  private idx(key: number, rr: number, sl: number, n: number) { return ((MS_IDX.get(key)! * 4 + rr) * 2 + sl) * 7 + n; }
  V(key: number, rr: number, sl: number, n: number): number {
    const i = this.idx(key, rr, sl, n);
    const m = this.memo[i]; if (!Number.isNaN(m)) return m;
    const v = this.best(key, rr, sl, n).v;
    this.memo[i] = v; return v;
  }
  best(key: number, rr: number, sl: number, n: number): { v: number; act: RogueAction } {
    let bv = 0, act: RogueAction = { a: 'end' };
    const mi = MS_IDX.get(key)!, size = MS_LIST[mi].n;
    if (n < this.cap) for (const s of SUBS[mi]) {
      for (const kind of ['loose', 'same', 'straight', 'array'] as Kind[]) {
        if (!(s.kinds & KIND_BIT[kind])) continue;
        if (kind === 'loose' && sl) continue;
        const pv = this.val(kind, s.n); if (!pv) continue;
        const dmg = (s.sum * pv.mul + pv.flat) * (1 + V4_PARAMS.comboPct * n);
        let r = kind === 'loose' ? sleeveRefill(n) : pv.refill ? s.n : 0;
        r = Math.min(r, 6 - (size - s.n));
        const rr2 = Math.min(3, rr + (n === 0 ? 1 : 0)), sl2 = sl || (kind === 'loose' ? 1 : 0);
        let ev = 0;
        if (n + 1 < this.cap) for (const [k2, p] of OUT[r]) ev += p * this.V(s.rest + k2, rr2, sl2, n + 1);
        if (dmg + ev > bv + 1e-9) { bv = dmg + ev; act = { a: 'strike', sub: s.sub, kind }; }
      }
    }
    if (rr > 0 && size > 0 && n < this.cap) for (const s of SUBS[mi]) {
      let ev = 0;
      for (const [k2, p] of OUT[s.n]) ev += p * this.V(s.rest + k2, rr - 1, sl, n);
      if (ev > bv + 1e-9) { bv = ev; act = { a: 'reroll', rer: s.sub }; }
    }
    return { v: bv, act };
  }
}
const SOLVERS = new Map<string, RogueSolver>();
function rogueSolver(b: Battle2): RogueSolver {
  const alive = Math.min(3, Math.max(1, b.alive().length));
  const key = [alive, b.s.maxStrikes, V4_PARAMS.sleeveRefill, V4_PARAMS.comboPct, V4_PARAMS.dmgScale.rogue, b.basicSkill()?.level, ...b.rows().map(r => r.rowId + r.level)].join('|');
  let s = SOLVERS.get(key);
  if (!s) { s = new RogueSolver(patternTable(b), b.s.maxStrikes); SOLVERS.set(key, s); if (SOLVERS.size > 64) SOLVERS.delete(SOLVERS.keys().next().value!); }
  return s;
}
/** uids on the field whose values make the multiset key */
function uidsFor(b: Battle2, key: number): number[] {
  const need = MS_LIST[MS_IDX.get(key)!].c.slice(), out: number[] = [];
  // prefer refilled shadow dice first (they vanish anyway), then the rest
  const dice = b.dice().slice().sort((x, y) => (x.kind === 'shadowDie' ? 0 : 1) - (y.kind === 'shadowDie' ? 0 : 1));
  for (const d of dice) { const v = d.face.value; if (v >= 1 && v <= 6 && need[v - 1] > 0) { need[v - 1]--; out.push(d.uid); } }
  return out;
}
export const ROGUE_STATS = { decisions: 0 };
function rogueTurn(b: Battle2): void {
  let guard = 0;
  while (b.s.phase === 'player' && !b.s.result && guard++ < 30) {
    const s = b.s, turn = s.turn;
    const vals = b.dice().map(d => d.face.value).filter(v => v >= 1 && v <= 6);
    if (!vals.length || b.strikesLeft() <= 0) break;
    const sol = rogueSolver(b);
    const { act } = sol.best(keyOf(vals), Math.min(3, s.freeRerollsLeft), s.sleeveUsed ? 1 : 0, s.strikesUsed);
    ROGUE_STATS.decisions++;
    if (act.a === 'end') break;
    if (act.a === 'reroll') { if (!b.reroll(uidsFor(b, act.rer)).ok) break; continue; }
    const uids = uidsFor(b, act.sub);
    const ref: RowRef = act.kind === 'loose' ? 'basic' : b.rows().find(r => COND_KIND[r.def.cond.t] === act.kind)!.ref;
    const t = pickTarget(b, ref, uids);
    if (!b.play(ref, uids, t).ok) break;
    if (b.s.turn !== turn || b.s.result) return;
  }
  if (b.s.phase === 'player' && !b.s.result) b.endTurn();
}

// ───────────────────────────────────────────────────────── shared helpers
/** HP (+12 each) of the waves still to come */
function wavesLeft(b: Battle2): number {
  let v = 0;
  const sc = FIGHT_SCALE[b.setup.kind];
  for (let i = b.s.waveIdx + 1; i < b.s.waves.length; i++) for (const id of b.s.waves[i]) v += Math.floor(enemyCfgV2(id).hp * sc.hp) + 12;
  return v;
}
const atkOf = (b: Battle2, e: Enemy) => { const it = b.intent(e); return it.kind === 'atk' && it.value ? it.value : 0; };
/** enemies' threat after a play: HP left, a flat per enemy, and this turn's attack */
function foeScore(b: Battle2): number {
  let v = 0;
  for (const e of b.alive()) v += e.hp + e.armor * 0.5 + 12 + atkOf(b, e) * 1.5;
  return v + wavesLeft(b) - (b.s.result === 'win' ? 1e5 : 0);
}
/** best target for a play (single-target ones differ; tried on clones) */
function pickTarget(b: Battle2, ref: RowRef, uids: number[]): number | undefined {
  const foes = b.alive().filter(e => b.canTarget(e.uid)); if (foes.length <= 1) return foes[0]?.uid;
  let best: { t: number; v: number } | null = null;
  for (const e of foes) {
    const k = b.clone(); if (!k.play(ref, uids, e.uid).ok) continue;
    const v = -foeScore(k) - (k.s.waveIdx > b.s.waveIdx ? -1e4 : 0);
    if (!best || v > best.v) best = { t: e.uid, v };
  }
  return best?.t;
}
interface Cand { ref: RowRef; uids: number[]; target?: number; opts?: PlayOpts }
function legalCands(b: Battle2): Cand[] {
  const dice = b.dice(), out: Cand[] = [], seen = new Set<string>();
  const n = dice.length;
  for (let m = 1; m < 1 << n; m++) {
    const idx: number[] = []; for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i);
    const uids = idx.map(i => dice[i].uid);
    // de-duplicate by (kinds, values) multiset
    const sig = idx.map(i => dice[i].kind + dice[i].face.value).sort().join(',');
    for (const ref of [...b.rows().map(r => r.ref as RowRef), 'basic' as RowRef]) {
      const k = ref + ':' + sig; if (seen.has(k)) continue;
      if (!b.check(ref, uids).match) continue;
      seen.add(k);
      // v4.1 狂战: loose dice can guard (铁壁) or attack (劈砍)
      if (ref === 'basic' && b.v4 && b.cls.id === 'warrior') { out.push({ ref, uids, opts: { loose: 'guard' } }, { ref, uids, opts: { loose: 'chop' } }); }
      else out.push({ ref, uids });
    }
  }
  return out;
}
/** single-target plays get one candidate per enemy */
function withTargets(b: Battle2, cs: Cand[]): Cand[] {
  const foes = b.alive().filter(e => b.canTarget(e.uid)); const out: Cand[] = [];
  for (const c of cs) { if (foes.length <= 1) out.push({ ...c, target: foes[0]?.uid }); else for (const e of foes) out.push({ ...c, target: e.uid }); }
  return out;
}

// ───────────────────────────────────────────────────────── 狂战: 斩 vs 挡
/** state after the enemy turn, from the player's side */
function evalAfter(k: Battle2): number {
  if (k.s.result === 'win') return 1e6 + k.s.player.hp * 10;
  if (k.s.result === 'lose') return -1e6;
  const p = k.s.player;
  let v = p.hp * 1.4;
  for (const e of k.alive()) v -= e.hp + e.armor * 0.5 + 14;
  v -= wavesLeft(k);
  v += (k.s.turnDice - 3) * 9 + k.s.overflow * 4;
  return v;
}
/** finish a cloned turn greedily (follow-up actions after 斩杀再动), then run the enemy turn */
function playOut(k: Battle2, depth: number): number {
  if (k.s.result) return evalAfter(k);
  if (k.s.phase === 'player' && k.strikesLeft() > 0 && k.dice().length && depth > 0) {
    let best = -Infinity;
    const cs = withTargets(k, legalCands(k));
    for (const c of cs) { const k2 = k.clone(); if (!k2.play(c.ref, c.uids, c.target, c.opts).ok) continue; best = Math.max(best, playOut(k2, depth - 1)); }
    // or keep the dice (end now)
    const k3 = k.clone(); k3.endTurn(); best = Math.max(best, evalAfter(k3));
    return best;
  }
  if (k.s.phase === 'player') k.endTurn();
  return evalAfter(k);
}
interface WarCtx { foes: Array<{ hp: number; armor: number; atk: number; boss: boolean }>; armor0: number; bonus: number; armorMul: number; killLeft: number; vul: number }
function warCtx(b: Battle2): WarCtx {
  const p = b.s.player, info = b.bloodInfo();
  const vul = b.s.player.statuses.some(x => x.type === 'vulnerable' && x.value > 0) ? 1.5 : 1;
  const basicMul = (() => { const r = b.basicRowDef(); const a = r?.def.tiers.single?.effects.find(e => e.t === 'armor') as { mul: number } | undefined; return (a ? a.mul : 1.5) * V4_PARAMS.wallScale; })();
  return {
    foes: b.alive().map(e => ({ hp: e.hp, armor: e.armor, atk: Math.ceil(atkOf(b, e) * vul), boss: e.rank === 'boss' || e.rank === 'midBoss' })),
    armor0: p.armor, bonus: p.rage * 0.15 + b.s.overflow * 0.1, armorMul: basicMul, killLeft: info ? info.killActsLeft : 0, vul,
  };
}
/** fast face-only plan value for rerolls / blood: best single play (+ a 铁壁 follow-up after a kill), and whether it beheads or guards */
function warPlan(b: Battle2, vals: number[], fury: boolean[], cx: WarCtx, pt: (k: Kind, n: number) => PatVal | null): { v: number; ok: boolean } {
  const n = vals.length;
  const none = cx.foes.map(() => false);
  const g0 = guardValue(cx, cx.armor0, none, none);
  let best = { v: g0.v, ok: g0.full };
  for (let m = 1; m < 1 << n; m++) {
    const idx: number[] = []; for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i);
    const sv = idx.map(i => vals[i]);
    const X = sv.reduce((a, c) => a + c, 0), fz = idx.filter(i => fury[i]).length * 0.5;
    const rest = vals.filter((_, i) => !(m & (1 << i)));
    const c = new Map<number, number>(); for (const v of sv) c.set(v, (c.get(v) || 0) + 1);
    const kinds: Kind[] = [];
    if (idx.length >= 2 && c.size === 1) kinds.push('same');
    if (idx.length >= 3 && c.size === idx.length && Math.max(...sv) - Math.min(...sv) === idx.length - 1) kinds.push('straight');
    if (idx.length >= 4 && c.size >= 2 && [...c.values()].every(x => x >= 2)) kinds.push('array');
    // v4.1: only dice that form no pattern are loose — 铁壁 (armor) or 劈砍 (damage, one target)
    if (idx.length <= 3 && !kinds.length) {
      const g = guardValue(cx, cx.armor0 + Math.ceil(X * cx.armorMul * (1 + fz)), none, none);
      if (g.v > best.v) best = { v: g.v, ok: g.full };
      const per = X * 1.0 * (1 + cx.bonus + fz);
      cx.foes.forEach((f, i) => {
        const hpd = Math.max(0, per - f.armor), dead = cx.foes.map((_, j) => j === i && hpd >= f.hp);
        const gg = guardValue(cx, cx.armor0, dead, none);
        const v = Math.min(f.hp, hpd) + (dead[i] ? 16 + (cx.killLeft > 0 ? 6 : 0) : 0) + gg.v;
        if (v > best.v) best = { v, ok: dead[i] || gg.full };
      });
    }
    for (const kind of kinds) {
      const pv = pt(kind, idx.length); if (!pv) continue;
      const def = b.rows().find(r => COND_KIND[r.def.cond.t] === kind)!;
      const tier = def.def.tiers[tierOf(def.def.tierRule, idx.length)!]!;
      const coef = def.def.coef[def.level - 1] * (V4_PARAMS.dmgScale.warrior ?? 1);
      const d = tier.effects.find(e => e.t === 'dmg') as Extract<Effect, { t: 'dmg' }> | undefined;
      const per = d ? X * (d.mul ?? 1) * coef * (1 + cx.bonus + fz) : 0;
      const all = d && (d.target === 'all');
      const armor = Math.ceil(X * pv.armorMul * (1 + fz));
      const targets = all ? [cx.foes.map((_, i) => i)] : cx.foes.map((_, i) => [i]);
      for (const tg of targets) {
        let prog = 0, kills = 0; const dead = cx.foes.map(() => false), stunned = cx.foes.map(() => false);
        for (const i of tg) { const f = cx.foes[i]; const hpd = Math.max(0, per - f.armor); prog += Math.min(f.hp, hpd); if (hpd >= f.hp) { dead[i] = true; kills++; } }
        if (pv.stun) for (const i of (pv.stun === 'all' ? cx.foes.map((_, j) => j) : tg)) if (!dead[i] && !cx.foes[i].boss) stunned[i] = true;
        let g = guardValue(cx, cx.armor0 + armor, dead, stunned);
        let ok = kills > 0 || g.full;
        let v = prog + kills * 16 + g.v;
        // 斩杀再动: a 铁壁 follow-up with what is left + the fury die (≈3.5, +50%)
        if (kills > 0 && cx.killLeft > 0) {
          const rx = rest.slice().sort((a, b2) => b2 - a).slice(0, 2).reduce((a, c2) => a + c2, 0);
          const g2 = guardValue(cx, cx.armor0 + armor + Math.ceil((rx + 3.5 * 1.5) * cx.armorMul), dead, stunned);
          if (g2.v > g.v) { v += g2.v - g.v; g = g2; }
          v += 6;
          ok = true;
        }
        if (v > best.v) best = { v, ok };
      }
    }
  }
  return best;
}
/** HP saved by armor against the remaining attacks (hit by hit) + a perfect-guard bonus */
function guardValue(cx: WarCtx, armor: number, dead: boolean[], stunned: boolean[]): { v: number; full: boolean } {
  let rem = armor, saved = 0, full = false, removed = 0, any = false, leak = false;
  cx.foes.forEach((f, i) => {
    if (dead[i]) { removed += f.atk; return; }
    if (stunned[i]) { removed += f.atk; full = true; any = true; return; }   // a stunned attacker counts as a perfect guard
    if (!f.atk) return;
    any = true;
    const blk = Math.min(rem, f.atk); saved += blk; rem -= blk;
    if (blk >= f.atk) full = true; else leak = true;
  });
  // v4.2: 完防 = every blockable hit covered
  if (ENEMY_TRAITS.guardAll) full = any && !leak;
  return { v: 1.4 * (saved + removed) + (full ? 9 : 0), full };
}
function warriorTurn(b: Battle2, rnd: () => number): void {
  let guard = 0;
  while (b.s.phase === 'player' && !b.s.result && guard++ < 12) {
    const turn = b.s.turn;
    // rerolls (free, then blood while it pays)
    let rr = 0;
    while (rr++ < 8 && b.s.phase === 'player' && b.dice().length) {
      const re = warReroll(b, rnd); if (!re) break;
      if (!b.reroll(re).ok) break;
    }
    if (b.strikesLeft() <= 0 || !b.dice().length) break;
    // every play tried through the enemy turn (with the 斩杀再动 follow-up)
    const cs = withTargets(b, legalCands(b));
    let best: { c: Cand; v: number } | null = null;
    for (const c of cs) {
      const k = b.clone(); if (!k.play(c.ref, c.uids, c.target, c.opts).ok) continue;
      const v = playOut(k, k.s.phase === 'player' && k.strikesLeft() > 0 ? 1 : 0);
      if (!best || v > best.v) best = { c, v };
    }
    const k0 = b.clone(); k0.endTurn();
    if (!best || evalAfter(k0) > best.v) break;
    if (!b.play(best.c.ref, best.c.uids, best.c.target, best.c.opts).ok) break;
    if (b.s.turn !== turn || b.s.result) return;
  }
  if (b.s.phase === 'player' && !b.s.result) b.endTurn();
}
function warReroll(b: Battle2, rnd: () => number, samples = 14): number[] | null {
  const dice = b.dice(); const n = dice.length; if (!n) return null;
  const free = b.s.freeRerollsLeft > 0;
  const info = b.rerollInfo(); if (!free && info.bloodCost == null) return null;
  const cx = warCtx(b), pt = patternTable(b);
  const vals = dice.map(d => d.face.value), fury = dice.map(d => d.kind === 'furyDie');
  const now = warPlan(b, vals, fury, cx, pt);
  let best: { re: number[]; ev: number; ok: number } | null = null;
  for (let m = 1; m < 1 << n; m++) {
    const re: number[] = []; for (let i = 0; i < n; i++) if (m & (1 << i)) re.push(i);
    let sum = 0, ok = 0;
    for (let k = 0; k < samples; k++) {
      const v2 = vals.slice(); for (const i of re) v2[i] = 1 + Math.floor(rnd() * 6);
      const r = warPlan(b, v2, fury, cx, pt); sum += r.v; ok += r.ok ? 1 : 0;
    }
    const ev = sum / samples;
    if (!best || ev > best.ev) best = { re, ev, ok: ok / samples };
  }
  if (!best) return null;
  const gain = best.ev - now.v;
  const uids = best.re.map(i => dice[i].uid);
  if (free) return gain > 1.5 ? uids : null;
  // blood: cost now vs gain + rage + the 血偿 expectation
  const p = b.s.player, cost = info.bloodCost!;
  if (cost > 0 && (p.hp - cost < p.maxHp * 0.4 || cost > p.maxHp * 0.09)) return null;
  const paid = b.s.bloodPaid, r = V4_PARAMS.bloodRefund;
  const refundGain = r * ((paid + cost) * best.ok - paid * (now.ok ? 1 : 0));
  const rage = p.rage < 5 ? 2.5 : 3;
  const net = gain + rage + 1.4 * refundGain - 1.4 * cost;
  return net > 1 ? uids : null;
}

// ───────────────────────────────────────────────────────── 魔导: 小咒 / 释放
/** best 释放 (≥4 dice) value for a hand of values */
function relBest(vals: number[], pt: (k: Kind, n: number) => PatVal | null): number {
  if (vals.length < 4) return 0;
  const key = keyOf(vals), mi = MS_IDX.get(key)!;
  let best = 0;
  for (const s of SUBS[mi]) {
    if (s.n < 4) continue;
    for (const kind of ['same', 'straight', 'array'] as Kind[]) {
      if (!(s.kinds & KIND_BIT[kind])) continue;
      const pv = pt(kind, s.n); if (pv) best = Math.max(best, s.sum * pv.mul + pv.flat);
    }
  }
  return best;
}
/**
 * 魔导 hand values over a short horizon: D(h, d) = max(release now, γ · E[next turn] − cost), where next turn adds a die
 * (to at least 3, max 6) and allows the free reroll (T). Pure dice model, cached per board / enemy count.
 */
class MageTable {
  private r = new Map<number, number>();
  private t = new Map<number, number>();
  private dm = new Map<number, number>();
  constructor(private pt: (k: Kind, n: number) => PatVal | null, private gamma: number, private cost: number) {}
  R(key: number): number {
    let v = this.r.get(key); if (v != null) return v;
    const m = MS_LIST[MS_IDX.get(key)!]; const vals: number[] = []; m.c.forEach((c, i) => { for (let j = 0; j < c; j++) vals.push(i + 1); });
    v = relBest(vals, this.pt); this.r.set(key, v); return v;
  }
  /** value of a hand at the decision point (after the reroll) */
  D(key: number, d: number): number {
    const id = key * 8 + d; let v = this.dm.get(id); if (v != null) return v;
    v = this.R(key);
    if (d > 0) v = Math.max(v, this.gamma * this.plus(key, d - 1) - this.cost);
    this.dm.set(id, v); return v;
  }
  /** next turn: the new die, then the reroll */
  plus(key: number, d: number): number {
    const n = MS_LIST[MS_IDX.get(key)!].n, add = n < 3 ? 3 - n : n < 6 ? 1 : 0;
    let e = 0; for (const [k2, p] of OUT[add]) e += p * this.T(key + k2, d); return e;
  }
  /** start of a turn (before the reroll) */
  T(key: number, d: number): number {
    const id = key * 8 + d; let v = this.t.get(id); if (v != null) return v;
    v = this.D(key, d);
    for (const s of SUBS[MS_IDX.get(key)!]) { let e = 0; for (const [k2, p] of OUT[s.n]) e += p * this.D(s.rest + k2, d); if (e > v) v = e; }
    this.t.set(id, v); return v;
  }
}
const MTABLES = new Map<string, MageTable>();
export const MAGE_T = { gamma: 0.85, cost: 6, depth: 3 };
function mageTable(b: Battle2): MageTable {
  const alive = Math.min(3, Math.max(1, b.alive().length));
  const key = [alive, MAGE_T.gamma, MAGE_T.cost, V4_PARAMS.dmgScale.mage, ...b.rows().map(r => r.rowId + r.level)].join('|');
  let t = MTABLES.get(key);
  if (!t) { t = new MageTable(patternTable(b), MAGE_T.gamma, MAGE_T.cost); MTABLES.set(key, t); }
  return t;
}
/** a hand's worth: release now, or (if it can still grow) the release after one more die */
function handScore(vals: number[], pt: (k: Kind, n: number) => PatVal | null, urgency = 1): number {
  const now = relBest(vals, pt) * urgency;
  if (vals.length >= 6) return now;
  let grow = 0; for (let v = 1; v <= 6; v++) grow += relBest([...vals, v], pt) / 6;
  return Math.max(now, 0.85 * grow);
}
function mageReroll(b: Battle2, rnd: () => number, samples = 12): number[] | null {
  const dice = b.dice(); const n = dice.length; if (!n || b.s.freeRerollsLeft <= 0) return null;
  if (n <= 6) {
    const tb = mageTable(b), urg = 1 + 0.06 * b.s.player.backlash;
    const Dn = (key: number) => Math.max(tb.R(key) * urg, tb.D(key, MAGE_T.depth));
    const vals = dice.map(d => d.face.value), key = keyOf(vals);
    let best = { ev: Dn(key), sub: 0 };
    for (const s2 of SUBS[MS_IDX.get(key)!]) { let e = 0; for (const [k2, p] of OUT[s2.n]) e += p * Dn(s2.rest + k2); if (e > best.ev + 0.5) best = { ev: e, sub: s2.sub }; }
    void rnd; void samples;
    return best.sub ? uidsFor(b, best.sub) : null;
  }
  const pt = patternTable(b);
  const vals = dice.map(d => d.face.value);
  // backlash makes a release now worth more than growing the hand
  const urg = 1 + 0.06 * b.s.player.backlash;
  const now = handScore(vals, pt, urg);
  let best: { re: number[]; ev: number } | null = null;
  for (let m = 1; m < 1 << n; m++) {
    const re: number[] = []; for (let i = 0; i < n; i++) if (m & (1 << i)) re.push(i);
    let sum = 0;
    for (let k = 0; k < samples; k++) { const v2 = vals.slice(); for (const i of re) v2[i] = 1 + Math.floor(rnd() * 6); sum += handScore(v2, pt, urg); }
    if (!best || sum / samples > best.ev) best = { re, ev: sum / samples };
  }
  return best && best.ev > now + 1.5 ? best.re.map(i => dice[i].uid) : null;
}
export const MAGE_WHY: Record<string, number> = {};
function mageTurn(b: Battle2, rnd: () => number): void {
  const re = mageReroll(b, rnd); if (re) b.reroll(re);
  if (b.s.phase !== 'player' || b.s.result) return;
  const pick = mageDecide(b);
  MAGE_WHY[pick.why] = (MAGE_WHY[pick.why] || 0) + 1;
  if (pick.c) {
    const turn = b.s.turn;
    if (!b.play(pick.c.ref, pick.c.uids, pick.c.target, pick.c.opts).ok) { b.endTurn(); return; }
    if (b.s.turn !== turn || b.s.result) return;
  }
  if (b.s.phase === 'player' && !b.s.result) b.endTurn();
}
/** state after the enemy turn for the mage: HP, enemies, the dice kept (next release), backlash still building */
function evalMage(k: Battle2, pt: (k: Kind, n: number) => PatVal | null): number {
  if (k.s.result === 'win') return 1e6 + k.s.player.hp * 10;
  if (k.s.result === 'lose') return -1e6;
  const p = k.s.player;
  let v = p.hp * MAGE_W.hp;
  let inc = 0;
  for (const e of k.alive()) { v -= e.hp + e.armor * 0.5 + 12; inc += atkOf(k, e); }
  v -= wavesLeft(k);
  // dice that will be in hand next turn: after the enemy turn the kept ones come first; mid-turn (wave just cleared) all of them
  const kept = (k.s.phase === 'player' && k.s.strikesUsed === 0 && k.s.turn > 1 ? k.dice().filter(d => d.persist === 'retained') : k.dice()).map(d => d.face.value);
  // the kept dice are worth what the hand can release over the next turns (value table), discounted
  const tb = mageTable(k);
  const kk = keyOf(kept.slice(0, 6));
  const extra = Math.min(6 - kept.length, Math.max(3, kept.length + 1) + k.s.chargeNext - kept.length);
  let pot = 0; for (const [k2, p] of OUT[Math.max(0, extra)]) pot += p * tb.T(kk + k2, MAGE_T.depth);
  if (extra <= 0) pot = tb.T(kk, MAGE_T.depth) * (1 + 0.1 * (k.s.overcharge + 1));
  v += MAGE_W.hand * pot + MAGE_W.die * kept.length;
  v -= p.backlash * 0.1 * inc * MAGE_W.backlash;
  return v;
}
export const MAGE_W = { hp: 1.3, die: 0, hand: 0.85, backlash: 1.5 };
function mageDecide(b: Battle2): { c: Cand | null; why: string } {
  const pt = patternTable(b);
  const h = b.clone(); h.endTurn();
  let best: { c: Cand | null; v: number } = { c: null, v: evalMage(h, pt) };
  for (const c of withTargets(b, legalCands(b))) {
    const k = b.clone(); if (!k.play(c.ref, c.uids, c.target, c.opts).ok) continue;
    // a play that clears the wave ends the turn before the enemies act: score it right there
    if (k.s.phase === 'player' && !k.s.result && k.s.waveIdx === b.s.waveIdx) k.endTurn();
    const v = evalMage(k, pt);
    if (v > best.v) best = { c, v };
  }
  return { c: best.c, why: !best.c ? 'hold' : best.c.uids.length >= 4 ? 'release' : 'minor' };
}

// ───────────────────────────────────────────────────────── entry
export function botTurnV4(b: Battle2, rnd: () => number): void {
  if (b.cls.id === 'rogue') rogueTurn(b);
  else if (b.cls.id === 'mage') mageTurn(b, rnd);
  else warriorTurn(b, rnd);
}
