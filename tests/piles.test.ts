// Port of _ref/px3d/dh6_tools/piles_test.mjs: (1) the two minimal repros of the v5 dice-count drift, (2) a seeded fuzz of whole
// mage-style battles through the same pile operations, asserting bag + discard + hand == owned after every operation.
// The v5 purify is transcribed to prove the fuzz still catches the drift; the ported module must show zero violations.
import * as P from '../src/core/piles';
import { createRng } from '../src/core/rng';

type D = P.PileDie;
const DEF: Record<string, { isCracked?: boolean }> = { cursed: {}, cracked: { isCracked: true } };
const die = (id: string): D => ({ defId: id, def: DEF[id] || {}, temp: id === 'temp_rogue', spent: false });

// the v5 purifyPlayer junk branch, transcribed (v5 04_battle.js line 470)
function purifyV5(st: P.Piles) {
  const ci = st.owned.findIndex(id => id === 'cursed' || id === 'cracked'); if (ci < 0) return;
  const id = st.owned.splice(ci, 1)[0];
  const bi = st.bag.indexOf(id); if (bi >= 0) st.bag.splice(bi, 1);
  const di = st.discard.indexOf(id); if (di >= 0) st.discard.splice(di, 1);
}
const purifyNew = (st: P.Piles) => { P.removeJunk(st); };

describe('piles: minimal repros', () => {
  it('A: junk only in the kept hand — v5 drifts, removeJunk removes the hand copy', () => {
    const mk = (): P.Piles => ({ owned: ['mage_meditate', 'standard', 'standard', 'cursed'], bag: ['standard'], discard: ['standard'], hand: [die('mage_meditate'), die('cursed')] });
    const a = mk(); purifyV5(a); expect(P.pilesOk(a)).toBe(false); expect(P.pileTotal(a)).toBe(a.owned.length + 1);
    const b = mk(); const r = P.removeJunk(b); expect(P.pilesOk(b)).toBe(true); expect(r?.where).toBe('hand');
  });
  it('B: junk in bag AND discard — v5 drifts, removeJunk keeps the invariant', () => {
    const mk = (): P.Piles => ({ owned: ['standard', 'standard', 'cracked', 'cracked'], bag: ['cracked', 'standard'], discard: ['cracked', 'standard'], hand: [] });
    const a = mk(); purifyV5(a); expect(P.pilesOk(a)).toBe(false); expect(P.pileTotal(a)).toBe(a.owned.length - 1);
    const b = mk(); P.removeJunk(b); expect(P.pilesOk(b)).toBe(true);
  });
});

function battleSim(seed: number, purify: (st: P.Piles) => void) {
  const r = createRng(seed), sh = (a: string[]) => r.shuffle(a), pick = <T,>(a: T[]) => r.pick(a);
  const owned = ['mage_meditate', 'mage_elemental', 'standard', 'standard', 'mage_missile', 'mage_barrier'];
  for (let i = 0; i < Math.floor(r.next() * 4); i++) owned.push(pick(['mage_reverse', 'blade', 'standard']));
  let violations = 0;
  const st: P.Piles & { _chanted?: boolean } = { owned: owned.slice(), bag: sh(owned), discard: [], hand: [] };
  const chk = () => { if (!P.pilesOk(st)) violations++; };
  let chargeStacks = 0; const drawCount = 3;
  for (let wave = 0; wave < 3; wave++) {
    for (let turn = 0; turn < 8; turn++) {
      const hand = st.hand.filter(d => !d.spent); const lim = Math.min(6, drawCount + chargeStacks);
      const chanted = turn > 0 && st._chanted; let keep: D[] = [], disc: D[] = [];
      if (chanted) { keep = hand.slice(); if (keep.length > lim) { disc = keep.slice(0, keep.length - lim); keep = keep.slice(keep.length - lim); } } else disc = hand;
      P.discardDice(st, disc); chk();
      const need = Math.max(0, lim - keep.length); const { ids } = P.draw(st, need, sh); st.hand = st.hand.concat(ids.map(die)); chk();
      if (r.next() < 0.4 && st.hand.length) {
        const sel = st.hand.filter(() => r.next() < 0.5).slice(0, 2); const normals = sel.filter(d => !P.isTemp(d));
        P.returnToDiscard(st, normals); const { ids: f } = P.draw(st, normals.length, sh); st.hand = st.hand.concat(f.map(die)); chk();
      }
      st._chanted = r.next() < 0.45;
      if (!st._chanted && st.hand.length) {
        const sel = st.hand.filter(() => r.next() < 0.5).slice(0, 3); if (!sel.length) sel.push(st.hand[0]);
        for (const d of sel) P.spend(st, d); chk();
        if (r.next() < 0.35) { purify(st); chk(); }
        P.compact(st); chk(); chargeStacks = 0;
      } else {
        chargeStacks++;
        if (st.hand.some(d => d.defId === 'mage_meditate') && purify === purifyV5) { purify(st); chk(); }   // v5 also purged junk from 冥想
      }
      if (r.next() < 0.3) { P.addJunk(st, pick(['cursed', 'cracked'])); chk(); }
    }
    if (!st._chanted) { P.discardDice(st, st.hand.filter(d => !d.spent)); chk(); }
  }
  P.discardDice(st, st.hand.filter(d => !d.spent), { keepCracked: true }); P.victoryCleanup(st); chk();
  return violations;
}

describe('piles: seeded fuzz (400 battles)', () => {
  it('the transcribed v5 purify still drifts (the fuzz is sensitive)', () => {
    let v = 0; for (let s = 1; s <= 400; s++) v += battleSim(s, purifyV5);
    expect(v).toBeGreaterThan(0);
  });
  it('the ported piles module has zero invariant violations', () => {
    let v = 0; for (let s = 1; s <= 400; s++) v += battleSim(s, purifyNew);
    expect(v).toBe(0);
  });
});
