// Dice piles: bag / discard / hand / owned bookkeeping as small pure operations (port of the v6 prototype's 04p_piles.js).
// Invariant (asserted by tests and by the debug build after every operation):
//   bag + discard + unspent non-temporary hand dice == owned dice.
// Kept from v6 (CLAUDE.md: the 3D fixes must survive): the v5 drift came from purify removing a junk die from `owned` unconditionally
// and then from the bag AND the discard independently, and from 冥想 calling that removal every chant turn. removeJunk() removes
// exactly ONE physical copy (bag, else discard, else an unplayed hand die) together with its owned entry; 冥想 only cleanses statuses.

export interface PileDie { defId: string; temp?: boolean; spent?: boolean; def?: { isCracked?: boolean } }
export interface Piles<D extends PileDie = PileDie> { owned: string[]; bag: string[]; discard: string[]; hand: D[] }

export const JUNK = ['cursed', 'cracked'];
export const isTemp = (d: PileDie | null | undefined) => !!(d && (d.temp || d.defId === 'temp_rogue'));
/** The counted hand: dice in hand that belong to the owned pool. */
export const handOwned = <D extends PileDie>(st: Piles<D>) => st.hand.filter(d => !d.spent && !isTemp(d));
export const pileTotal = (st: Piles) => st.bag.length + st.discard.length + handOwned(st).length;
export const pilesOk = (st: Piles) => pileTotal(st) === st.owned.length;

/** drawFromBag (data/diceBag.ts): if the bag is short, the shuffled discard goes under the bag first; then take n from the top. */
export function draw(st: Piles, n: number, shuffle: (a: string[]) => string[]) {
  let reshuffled = false;
  if (st.bag.length < n && st.discard.length) { st.bag = st.bag.concat(shuffle(st.discard)); st.discard = []; reshuffled = true; }
  const ids: string[] = [];
  for (let i = 0; i < n && st.bag.length; i++) ids.push(st.bag.shift()!);
  return { ids, reshuffled };
}

/** Dice leaving the hand (turn end / wave end): temporary dice vanish, cracked dice are destroyed (gone from owned), the rest go to the discard. */
export function discardDice<D extends PileDie>(st: Piles<D>, dice: D[], o: { keepCracked?: boolean } = {}): D[] {
  const gone: D[] = [];
  for (const d of dice) {
    if (isTemp(d)) { gone.push(d); continue; }
    if (d.def?.isCracked && !o.keepCracked) { gone.push(d); unown(st, d.defId); continue; }
    st.discard.push(d.defId);
  }
  const set = new Set(dice);
  st.hand = st.hand.filter(d => !set.has(d));
  return gone;
}

/** A played die is spent: into the discard unless temporary (it stays in the hand flagged spent until compact()). */
export function spend<D extends PileDie>(st: Piles<D>, d: D) { d.spent = true; if (!isTemp(d)) st.discard.push(d.defId); }
export function compact<D extends PileDie>(st: Piles<D>) { st.hand = st.hand.filter(d => !d.spent); }
/** Reroll: the chosen (non-temporary) hand dice go to the discard; the caller draws replacements. */
export function returnToDiscard<D extends PileDie>(st: Piles<D>, dice: D[]) {
  for (const d of dice) st.discard.push(d.defId);
  const set = new Set(dice); st.hand = st.hand.filter(d => !set.has(d));
}
/** An enemy slips a junk die into the bag. */
export function addJunk(st: Piles, id: string) { st.owned.push(id); st.bag.push(id); }
export function gain(st: Piles, id: string) { st.owned.push(id); }
export function unown(st: Piles, id: string) { const i = st.owned.indexOf(id); if (i >= 0) st.owned.splice(i, 1); }

/** Purify a junk die: remove exactly one physical copy and its owned entry. */
export function removeJunk<D extends PileDie>(st: Piles<D>, ids: string[] = JUNK): { id: string; where: 'bag' | 'discard' | 'hand'; die?: D } | null {
  for (const where of ['bag', 'discard'] as const) {
    const i = st[where].findIndex(id => ids.includes(id));
    if (i >= 0) { const id = st[where].splice(i, 1)[0]; unown(st, id); return { id, where }; }
  }
  const d = st.hand.find(x => !x.spent && !isTemp(x) && ids.includes(x.defId));
  if (d) { st.hand = st.hand.filter(x => x !== d); unown(st, d.defId); return { id: d.defId, where: 'hand', die: d }; }
  return null;
}

/** useBattleVictory.ts: junk dice enemies slipped in are destroyed when the battle ends. */
export function victoryCleanup(st: Piles) {
  const keep = (id: string) => !JUNK.includes(id);
  st.owned = st.owned.filter(keep); st.bag = st.bag.filter(keep); st.discard = st.discard.filter(keep);
}
