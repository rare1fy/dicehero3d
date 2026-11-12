// Class mechanics (SPEC 2.1–2.3) on hand-set dice.
import { Battle2, kindSuit, type RowRef } from '../../src/core/v2/battle2';
import { loadoutB } from '../../src/core/v2/data';
import type { Ev2 } from '../../src/core/v2/events2';
import type { ClassId, DieKind } from '../../src/core/v2/types';

function mk(classId: ClassId, tablet: string, waves: string[][] = [['forest_ghoul', 'forest_ghoul']]) {
  const b = new Battle2({ seed: 7, classId, loadout: loadoutB(tablet), waves, kind: 'normal' });
  b.start();
  for (const e of b.s.enemies) { e.hp = e.maxHp = 999; }
  return b;
}
function setDice(b: Battle2, vals: number[], kind: DieKind = 'normal') {
  b.s.dice = vals.map(v => ({ uid: b.s.dieUid++, kind, face: { value: v, suit: kindSuit(b.cls.id, kind, v) }, persist: 'turn' as const, source: 'base' as const, carried: 0 }));
  b.s.turnDice = Math.max(b.s.turnDice, b.s.dice.length);
  return b.s.dice.map(d => d.uid);
}
function play(b: Battle2, ref: RowRef, uids: number[]): Ev2[] {
  const r = b.play(ref, uids);
  if (!r.ok) throw new Error(r.reason);
  return r.events;
}
const of = <T extends Ev2['t']>(ev: Ev2[], t: T) => ev.filter(e => e.t === t) as Array<Extract<Ev2, { t: T }>>;

describe('warrior', () => {
  it('the paid reroll that reaches rage 3 makes a fury die', () => {
    const b = mk('warrior', 'w_suit');
    const ev: Ev2[] = [];
    for (let i = 0; i < 4; i++) { const r = b.reroll([b.s.dice[0].uid]); expect(r.ok).toBe(true); ev.push(...r.events); }
    expect(b.s.player.rage).toBe(3);
    expect(of(ev, 'special').filter(e => e.action === 'transform' && e.kind === 'furyDie')).toHaveLength(1);
    expect(b.s.dice.some(d => d.kind === 'furyDie')).toBe(true);
  });
  it('blood reroll costs 2% / 4% / 8% of max HP', () => {
    const b = mk('warrior', 'w_suit');
    b.reroll([b.s.dice[0].uid]);   // free
    const costs = [0, 1, 2].map(() => (b.reroll([b.s.dice[0].uid]) as { events: Ev2[] }).events.find(e => e.t === 'reroll'));
    expect(costs.map(e => e && e.t === 'reroll' ? e.hpCost : -1)).toEqual([3, 5, 10]);
  });
  it('a direct kill (behead) gives +1 die next turn, capped at 1', () => {
    const b = mk('warrior', 'w_suit', [['forest_ghoul', 'forest_ghoul', 'forest_ghoul']]);
    b.s.enemies[0].hp = 1; b.s.enemies[1].hp = 1;
    const u = setDice(b, [6, 6, 6]);
    const ev = play(b, 'basic', u);
    expect(of(ev, 'gainDice').filter(e => e.reason === 'behead')).toHaveLength(1);
    expect(b.nextDice().count).toBe(4);
  });
  it('a perfect guard gives +1 die next turn', () => {
    const b = mk('warrior', 'w_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 0; b.s.player.armor = 100;
    const ev = b.endTurn().events;
    expect(of(ev, 'playerHit')[0].perfectBlock).toBe(true);
    expect(b.s.turnDice).toBe(4);
  });
  it('dice above 6 become +10% damage each (overflow)', () => {
    const b = mk('warrior', 'w_suit', [['forest_ghoul']]);
    b.s.earned = { behead: 1, guard: 1, tier: 1, extra: 1 };
    expect(b.nextDice()).toMatchObject({ count: 6, overflow: 1 });
    b.endTurn();
    expect(b.s.turnDice).toBe(6); expect(b.s.overflow).toBe(1);
    const u = setDice(b, [1]);
    const rp = of(play(b, 'basic', u), 'rowPlay')[0];
    expect(rp.bonusPct).toBe(10);
  });
});

describe('mage', () => {
  it('a turn with no play chants: ring +1, barrier 4, then 6; dice 4, then 5', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 5;
    let ev = b.endTurn().events;
    expect(of(ev, 'chant')[0]).toMatchObject({ ring: 1 });
    expect(of(ev, 'barrier')[0].delta).toBe(4);
    expect(b.s.turnDice).toBe(4);
    ev = b.endTurn().events;
    expect(of(ev, 'chant')[0]).toMatchObject({ ring: 2 });
    expect(of(ev, 'barrier').find(e => e.delta > 0)!.delta).toBe(6);
    expect(b.s.turnDice).toBe(5);
  });
  it('chanting keeps the leftover dice', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 5;
    const before = b.s.dice.map(d => d.face.value);
    const ev = b.endTurn().events;
    const roll = of(ev, 'roll').find(e => e.reason === 'turn')!;
    expect(roll.kept).toHaveLength(3);
    expect(b.s.dice.slice(0, 3).map(d => d.face.value)).toEqual(before);
  });
  it('backlash v2.1: the hit uses the old layers, then +2^N; N runs over the cycle; cap 30; a play clears it', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul', 'forest_ghoul']]);
    for (const e of b.s.enemies) e.distance = 0;
    let ev = b.endTurn().events;
    expect(of(ev, 'backlash').map(e => e.stacks)).toEqual([2, 6]);
    const hits = of(ev, 'playerHit');
    expect(hits[1].dmg).toBe(Math.ceil(hits[0].dmg * 1.2 - 1e-9));   // 2nd hit: ×1.2 (2 layers), not ×1.6
    ev = b.endTurn().events;   // second chant turn of the same cycle: N = 3, 4
    expect(of(ev, 'backlash').map(e => e.stacks)).toEqual([14, 30]);
    ev = b.endTurn().events;
    expect(of(ev, 'backlash').map(e => e.stacks)).toEqual([30, 30]);
    play(b, 'basic', [b.s.dice[0].uid]);
    expect(b.s.player.backlash).toBe(0);
    expect(b.s.chantHits).toBe(0);
  });
  it('chantRisk(): extra damage from backlash if this turn is a chant; 0 for other classes', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul', 'forest_ghoul']]);
    for (const e of b.s.enemies) e.distance = 0;
    b.s.chantsThisCycle = 1; b.s.chantHits = 2; b.s.player.backlash = 6;
    expect(b.chantRisk()).toBeGreaterThan(0);
    b.s.player.backlash = 0; b.s.chantHits = 0;
    const r0 = b.chantRisk();
    b.s.player.backlash = 30;
    expect(b.chantRisk()).toBeGreaterThan(r0);
    expect(mk('warrior', 'w_suit').chantRisk()).toBe(0);
  });
  it('a play breaks the chant and clears the ring', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 5;
    b.endTurn();
    expect(b.s.chantRing).toBe(1);
    const u = setDice(b, [1]);
    play(b, 'basic', u);
    expect(b.s.chantRing).toBe(0);
    expect(b.nextDice().count).toBe(3);
  });
  it('overload: 6 dice in hand and a 4-dice 元素交汇 → star dice (2/2/4/5/6/6) next turns', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 5;
    const u = setDice(b, [1, 2, 3, 4, 5, 6]);
    expect(b.s.turnDice).toBe(6);
    const mix = b.rows().findIndex(r => r.rowId === 'm_mix');
    const ev = play(b, mix, u.slice(0, 4));
    expect(of(ev, 'overload')[0].turns).toBe(2);
    b.endTurn();
    const stars = b.s.dice.filter(d => d.kind === 'starDie');
    expect(stars.length).toBeGreaterThan(0);
    for (const d of stars) expect([2, 4, 5, 6]).toContain(d.face.value);
  });
  it('元素交汇 5 dice is the earn tier: resonance, +1 die next turn', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    const u = setDice(b, [1, 2, 3, 4, 5]);
    const ev = play(b, b.rows().findIndex(r => r.rowId === 'm_mix'), u);
    expect(of(ev, 'rowPlay')[0].tier).toBe('earn');
    expect(of(ev, 'gainDice').some(e => e.reason === 'resonance')).toBe(true);
    expect(b.nextDice().count).toBe(4);
  });
  it('元素交汇: star ×2 → vulnerable, moon ×2 → freeze; +25% per element status already on the target', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    const t = b.s.enemies[0];
    const mix = b.rows().findIndex(r => r.rowId === 'm_mix');
    const u = setDice(b, [1, 2, 3, 4]);
    const ev = play(b, mix, u);
    expect(of(ev, 'hit')[0].dmg).toBe(15);   // X 10 × 1.5
    expect(t.statuses.map(s => s.type).sort()).toEqual(['freeze', 'vulnerable']);
    const b2 = mk('mage', 'm_suit', [['forest_ghoul']]);
    b2.s.enemies[0].statuses.push({ type: 'burn', value: 3 });
    const ev2 = play(b2, mix, setDice(b2, [1, 2, 3, 4]));
    expect(of(ev2, 'hit')[0].dmg).toBe(19);  // 15 × 1.25
  });
});

describe('warrior v2.1', () => {
  it('blood reroll order (1.8): HP → rage → fury die → reroll', () => {
    const b = mk('warrior', 'w_suit');
    b.reroll([b.s.dice[0].uid]); b.reroll([b.s.dice[0].uid]); b.reroll([b.s.dice[0].uid]);
    const ev = b.reroll(b.s.dice.map(d => d.uid)).events;
    const i = (t: string) => ev.findIndex(e => e.t === t);
    expect(b.s.player.rage).toBe(3);
    expect(i('hp')).toBeLessThan(i('rage'));
    expect(i('rage')).toBeLessThan(i('special'));
    expect(i('special')).toBeLessThan(i('roll'));
  });
  it('千钧行 3 dice: overkill goes in full to the lowest-HP other enemy', () => {
    const b = mk('warrior', 'w_point', [['forest_ghoul', 'forest_ghoul', 'forest_ghoul']]);
    const [a, , c] = b.s.enemies; a.hp = 5; c.hp = 50;
    const heavy = b.rows().findIndex(r => r.rowId === 'w_heavy');
    const ev = play(b, heavy, setDice(b, [6, 5, 3]));
    const hits = of(ev, 'hit');
    expect(hits[0]).toMatchObject({ uid: a.uid, killed: true });
    expect(hits[1]).toMatchObject({ uid: c.uid, dmg: Math.ceil(14 * 1.6) - 5, source: 'cleave' });
  });
  it('cross-wave (1.9): a behead on the last enemy of a wave carries +1 die into the next wave, with waveClear first', () => {
    const b = mk('warrior', 'w_suit', [['forest_ghoul'], ['forest_ghoul']]);
    b.s.enemies[0].hp = 1;
    const ev = play(b, 'basic', setDice(b, [6]));
    const wc = ev.findIndex(e => e.t === 'waveClear'), bs = ev.findIndex(e => e.t === 'battleStart');
    expect(wc).toBeGreaterThanOrEqual(0);
    expect(wc).toBeLessThan(bs);
    expect(of(ev, 'waveClear')[0]).toMatchObject({ wave: 0, nextDice: 4 });
    expect(of(ev, 'waveClear')[0].reasons).toContain('behead');
    expect(b.s.turnDice).toBe(4);
  });
});

describe('rogue', () => {
  it('two strikes per turn; the second gets +20%', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [3, 3, 3]);
    const a = of(play(b, 'basic', [u[0]]), 'rowPlay')[0];
    const c = of(play(b, 'basic', [u[1]]), 'rowPlay')[0];
    expect([a.bonusPct, c.bonusPct]).toEqual([0, 20]);
    expect(b.strikesLeft()).toBe(0);
    expect(b.mustEndTurn()).toBe(true);
  });
  it('the first strike gives a free reroll', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [3, 3, 3]);
    const f0 = b.s.freeRerollsLeft;
    play(b, 'basic', [u[0]]);
    expect(b.s.freeRerollsLeft).toBe(f0 + 1);
  });
  it('precise combo v2.1: same row → +25%; more dice than the last strike → also a shadow die now and one next turn', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [5, 5, 6, 3]);
    play(b, 0, [u[0]]);
    const ev = play(b, 0, [u[1], u[2]]);
    const rp = of(ev, 'rowPlay')[0];
    expect(rp.combo).toBe(true);
    expect(rp.bonusPct).toBe(45);
    expect(of(ev, 'special').some(e => e.action === 'spawn' && e.kind === 'shadowDie')).toBe(true);
    expect(of(ev, 'gainDice').some(e => e.reason === 'precise')).toBe(true);
    expect(b.s.classSpawns).toBe(1);
    expect(b.nextDice().count).toBe(4);
    b.endTurn();
    expect(b.s.turnDice).toBe(4);
    expect(b.s.dice.filter(d => d.kind === 'shadowDie')).toHaveLength(1);
  });
  it('same row with fewer dice still gets +25% but spawns nothing', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [5, 5, 6]);
    play(b, 0, [u[0], u[1]]);
    const ev = play(b, 0, [u[2]]);
    expect(of(ev, 'rowPlay')[0]).toMatchObject({ combo: true, bonusPct: 45 });
    expect(of(ev, 'special').some(e => e.action === 'spawn')).toBe(false);
    expect(b.nextDice().count).toBe(3);
  });
  it('blade-row shadow dice are not class spawns: nothing carries to next turn', () => {
    const b = mk('rogue', 'r_suit');
    const blade = b.rows().findIndex(r => r.rowId === 'r_blade');
    const ev = play(b, blade, setDice(b, [2, 3]));
    expect(of(ev, 'special').some(e => e.action === 'spawn')).toBe(true);
    expect(b.s.classSpawns).toBe(0);
    expect(b.nextDice().count).toBe(3);
  });
  it('class spawns are capped at 2 per turn', () => {
    const b = mk('rogue', 'r_suit');
    b.s.maxStrikes = 4;
    const u = setDice(b, [5, 5, 6, 5, 6, 5]);
    play(b, 0, [u[0]]); play(b, 0, [u[1], u[2]]); play(b, 0, [u[3], u[4], u[5]]);
    expect(b.s.classSpawns).toBe(2);
    const sh = b.s.dice.filter(d => d.kind === 'shadowDie').map(d => d.uid);
    const ev = play(b, 0, sh.concat(b.s.dice.filter(d => d.kind !== 'shadowDie' && d.face.suit === 'shadow').map(d => d.uid)).slice(0, 4));
    expect(of(ev, 'gainDice').some(e => e.reason === 'precise')).toBe(false);
    expect(b.s.classSpawns).toBe(2);
  });
  it('飞刀标记: knife marks a shape; next strike completes it with the bounced die, ≥3 dice, all field dice → shadow die', () => {
    const b = mk('rogue', 'r_point');
    const knife = b.rows().findIndex(r => r.rowId === 'r_knife'), straight = b.rows().findIndex(r => r.rowId === 'r_straight');
    const u = setDice(b, [3, 5, 6]);
    const r1 = b.play(knife, [u[0]], undefined, { mark: 'straight' });
    expect(r1.ok).toBe(true);
    expect(b.s.knifeMark).toEqual({ shape: 'straight', dieUid: u[0] });
    expect(b.s.dice.find(d => d.uid === u[0])!.face.value).toBe(4);
    const ev = play(b, straight, b.s.dice.map(d => d.uid));
    expect(of(ev, 'gainDice').some(e => e.reason === 'mark')).toBe(true);
    expect(b.s.knifeMark).toBeNull();
    expect(b.nextDice().count).toBe(4);
  });
  it('飞刀标记 fails when a field die is left over', () => {
    const b = mk('rogue', 'r_point');
    const knife = b.rows().findIndex(r => r.rowId === 'r_knife'), straight = b.rows().findIndex(r => r.rowId === 'r_straight');
    const u = setDice(b, [3, 5, 6, 1]);
    b.play(knife, [u[0]]);
    const ev = play(b, straight, [u[0], u[1], u[2]]);
    expect(of(ev, 'gainDice').some(e => e.reason === 'mark')).toBe(false);
  });
  it('袖箭 on a poison / blade die turns into a shadow die', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [1, 5]);
    const ev = play(b, 'basic', [u[0]]);
    expect(of(ev, 'special').some(e => e.action === 'spawn' && e.kind === 'shadowDie')).toBe(true);
    const b2 = mk('rogue', 'r_suit');
    const u2 = setDice(b2, [5, 5]);
    expect(of(play(b2, 'basic', [u2[0]]), 'special').some(e => e.action === 'spawn')).toBe(false);
  });
  it('背刺 only fires as the second strike', () => {
    const b = mk('rogue', 'r_point');
    const back = b.rows().findIndex(r => r.rowId === 'r_back');
    if (back < 0) return;   // not on the start tablet
    const u = setDice(b, [5, 5, 5]);
    expect(b.check(back, [u[0]]).match).toBeNull();
    play(b, 'basic', [u[1]]);
    expect(b.check(back, [u[0]]).match).not.toBeNull();
  });
});

describe('v2.2 settlement rules', () => {
  it('blood k (1.8): free sales count too, so the next paid sale doubles', () => {
    const b = mk('warrior', 'w_suit');
    b.reroll([b.s.dice[0].uid]);   // free reroll
    b.s.freeBloodLeft = 1;
    const e1 = b.reroll([b.s.dice[0].uid]).events.find(e => e.t === 'reroll');
    const e2 = b.reroll([b.s.dice[0].uid]).events.find(e => e.t === 'reroll');
    expect(e1 && e1.t === 'reroll' ? e1.hpCost : -1).toBe(0);
    expect(e2 && e2.t === 'reroll' ? e2.hpCost : -1).toBe(Math.ceil(120 * 0.04));
  });
  it('日行 2+ burn stays through chant turns and goes out after the next play resolves (a new one stays)', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    const t = b.s.enemies[0]; t.distance = 5;
    const sun = b.rows().findIndex(r => r.rowId === 'm_sun');
    play(b, sun, setDice(b, [5, 5]));
    const burn = () => t.statuses.find(s => s.type === 'burn');
    expect(burn()?.heldNew).toBeGreaterThan(0);
    b.endTurn();               // tick: held part stays
    expect(burn()?.held).toBeGreaterThan(0);
    b.endTurn();               // a chant turn: still there
    expect(burn()).toBeDefined();
    play(b, 'basic', [b.s.dice[0].uid]);
    expect(burn()).toBeUndefined();
    // a 日行 play clears the old held burn but keeps the one it lays
    const b2 = mk('mage', 'm_suit', [['forest_ghoul']]);
    const t2 = b2.s.enemies[0]; t2.distance = 5;
    play(b2, sun, setDice(b2, [5, 5]));
    b2.endTurn();
    play(b2, sun, setDice(b2, [5, 5]));
    const bn = t2.statuses.find(s => s.type === 'burn')!;
    expect(bn.held).toBe(0); expect(bn.heldNew).toBeGreaterThan(0);
  });
  it('a 1-die 日行 burn goes out at the turn-end tick', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    const t = b.s.enemies[0]; t.distance = 5;
    play(b, b.rows().findIndex(r => r.rowId === 'm_sun'), setDice(b, [5]));
    b.endTurn();
    expect(t.statuses.find(s => s.type === 'burn')).toBeUndefined();
  });
  it('backlash gate: no layers outside a chant cycle, none from DoT', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul', 'forest_ghoul']]);
    for (const e of b.s.enemies) e.distance = 0;
    play(b, 'basic', [b.s.dice[0].uid]);
    const ev = b.endTurn().events;    // played this turn: no cycle
    expect(b.s.cycleActive).toBe(false);
    expect(of(ev, 'backlash').filter(e => e.stacks > 0)).toHaveLength(0);
    const b2 = mk('mage', 'm_suit', [['forest_ghoul']]);
    b2.s.enemies[0].distance = 5;
    b2.s.player.statuses.push({ type: 'poison', value: 3 });
    b2.endTurn();
    expect(b2.s.cycleActive).toBe(true);
    expect(b2.s.player.backlash).toBe(0);
  });
  it('overcharge barrier (R3-5): 4 + 2 × (ring before + overcharge turns before)', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 99;
    const bars: number[] = [];
    for (let i = 0; i < 5; i++) { const ev = b.endTurn().events; bars.push(of(ev, 'barrier').find(e => e.delta > 0)!.delta); }
    expect(bars).toEqual([4, 6, 8, 10, 12]);
  });
  it('mage keep (R3-4): default keeps the highest points; setKeep / endTurn({keep}) choose', () => {
    const b = mk('mage', 'm_suit', [['forest_ghoul']]);
    b.s.enemies[0].distance = 5;
    const u = setDice(b, [1, 2, 3, 4, 6, 5]);
    play(b, 'basic', [u[0]]);
    const k = b.keepInfo()!;
    expect(k).toMatchObject({ cap: 3, need: true });
    expect(k.selected).toEqual([u[4], u[5], u[3]]);
    expect(b.setKeep([u[1], u[2], u[3], u[4]]).ok).toBe(false);
    b.endTurn({ keep: [u[1], u[2]] });
    const ids = b.s.dice.map(d => d.uid);
    expect(ids).toContain(u[1]); expect(ids).toContain(u[2]); expect(ids).not.toContain(u[4]);
    expect(mk('warrior', 'w_suit').keepInfo()).toBeNull();
  });
  it('rogue carry (1.1): only an unused shadow die on the field carries; none is created', () => {
    const b = mk('rogue', 'r_suit');
    const u = setDice(b, [5, 5, 6, 3]);
    play(b, 0, [u[0]]);
    play(b, 0, [u[1], u[2]]);    // precise spawn: a shadow die on the field
    const sh = b.s.dice.find(d => d.kind === 'shadowDie')!;
    b.s.maxStrikes = 3; b.s.strikesUsed = 2;
    const extra = b.clone();
    // using the spawned die: nothing carries
    (extra as Battle2).s.dice = extra.s.dice.filter(d => d.uid !== sh.uid);
    expect(extra.nextDice().count).toBe(3);
    expect(b.nextDice().count).toBe(4);
  });
  it('刃行 onStrike: the first strike spawns shadow dice, a later one heals', () => {
    const b = mk('rogue', 'r_suit');
    const blade = b.rows().findIndex(r => r.rowId === 'r_blade');
    const u = setDice(b, [2, 3, 2, 3]);
    const e1 = play(b, blade, [u[0], u[1]]);
    expect(of(e1, 'special').some(e => e.action === 'spawn')).toBe(true);
    b.s.player.hp = 50;
    const e2 = play(b, blade, [u[2], u[3]]);
    expect(of(e2, 'special').some(e => e.action === 'spawn')).toBe(false);
    expect(b.s.player.hp).toBeGreaterThan(50);
  });
});
