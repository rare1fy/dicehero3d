// Rules v4 (CLASS_DESIGN_V4 + DECISIONS_V4): rogue combo + refills, mage 小咒 / 释放 with persistent dice, warrior 斩杀再动 + 血偿.
import { Battle2, kindSuit } from '../../src/core/v2/battle2';
import { CLASSES, ENEMIES, V4_PARAMS, holdBarrier, loadoutB, rowDef, sleeveRefill } from '../../src/core/v2/data';
import type { Ev2 } from '../../src/core/v2/events2';
import { Run2 } from '../../src/core/v2/run2';
import type { ClassId, DieKind } from '../../src/core/v2/types';

const TAB: Record<ClassId, string> = { warrior: 'w_v4', mage: 'm_v4', rogue: 'r_v4' };
function mk(classId: ClassId, waves: string[][] = [['forest_ghoul', 'forest_ghoul']], level: 1 | 2 | 3 = 1) {
  const b = new Battle2({ seed: 7, classId, loadout: loadoutB(TAB[classId], { level }), waves, kind: 'normal' });
  b.start();
  for (const e of b.s.enemies) { e.hp = e.maxHp = 999; e.distance = 5; }
  return b;
}
function setDice(b: Battle2, vals: number[], kinds: DieKind[] = []) {
  b.s.dice = vals.map((v, i) => { const kind = kinds[i] || 'normal'; return { uid: b.s.dieUid++, kind, face: { value: v, suit: kindSuit(b.cls.id, kind, v) }, persist: 'turn' as const, source: 'base' as const, carried: 0 }; });
  b.s.turnDice = Math.max(b.s.turnDice, b.s.dice.length);
  return b.s.dice.map(d => d.uid);
}
const of = <T extends Ev2['t']>(ev: Ev2[], t: T) => ev.filter(e => e.t === t) as Array<Extract<Ev2, { t: T }>>;
const spawned = (ev: Ev2[]) => of(ev, 'special').filter(e => e.action === 'spawn').length;
/** tuning numbers read from data, so the rule tests survive retuning */
const wallMul = () => (rowDef('w4_loose').tiers.single!.effects.find(e => e.t === 'armor') as { mul: number }).mul;
const blood = (maxHp: number, k: number) => Math.ceil(maxHp * 0.02 * 2 ** k - 1e-9);

describe('v4 setup', () => {
  it('v4 tablets are the default; the board keeps 3 rows and the loose-dice skill is a 4th upgradeable slot', () => {
    for (const cid of Object.keys(CLASSES) as ClassId[]) {
      expect(CLASSES[cid].tablets[0]).toBe(TAB[cid]);
      const b = mk(cid);
      expect(b.v4).toBe(true);
      expect(b.rows().map(r => r.def.cond.t)).toEqual(['sameValue', 'straight', 'array']);
      expect(b.basicSkill()?.name).toBe({ warrior: '铁壁', mage: '奥术弹', rogue: '袖箭' }[cid]);
    }
    // level ups only offer the §5 upgrades: 盾冲 / 奥术弹 never; 袖箭 / 影舞 / 铁壁 stop at II
    for (const cid of Object.keys(CLASSES) as ClassId[]) for (let seed = 1; seed <= 15; seed++) {
      const r = new Run2({ seed, classId: cid, full: true, rowLevel: 3 });
      for (const sl of r.s.loadout.tablets[0].slots) expect(sl.level).toBeLessThanOrEqual({ w4_straight: 1, m4_loose: 1, r4_loose: 2, r4_array: 2, w4_loose: 2 }[sl.rowId] ?? 3);
      const r1 = new Run2({ seed, classId: cid });
      for (let i = 0; i < 3; i++) (r1 as unknown as { queueLevelUp(): void }).queueLevelUp();
      for (const c of r1.s.queue) if (c.kind === 'levelUp') for (const k of c.cards) {
        expect(k.kind).toBe('upgrade');
        const id = r1.s.loadout.tablets[0].slots[(k as { slot: number }).slot].rowId;
        expect(['w4_straight', 'm4_loose']).not.toContain(id);
      }
    }
  });
});

describe('v4 rogue: combo', () => {
  // these pin the strike cap at 5 (刀鞘 start is a run parameter, v4.1 / v4.2)
  let start0 = 0, sleeve0 = V4_PARAMS.sleeveRefill;
  beforeEach(() => { start0 = V4_PARAMS.rogueStartStrikes; V4_PARAMS.rogueStartStrikes = 5; sleeve0 = V4_PARAMS.sleeveRefill; V4_PARAMS.sleeveRefill = 'byStrike'; });
  afterEach(() => { V4_PARAMS.rogueStartStrikes = start0; V4_PARAMS.sleeveRefill = sleeve0; });
  it('strike N gets +20% × (N − 1); up to 5 strikes, then the turn must end', () => {
    const b = mk('rogue', undefined, 3);   // 刀鞘 at its top level → 5 strikes whatever the start value
    expect(b.s.maxStrikes).toBe(5);
    const bon: number[] = [];
    for (let i = 0; i < 5; i++) {
      const u = setDice(b, [5, 5, 1]);
      const ev = b.play(0, [u[0], u[1]]).events;
      bon.push(of(ev, 'rowPlay')[0].bonusPct);
    }
    expect(bon).toEqual([0, 20, 40, 60, 80]);
    setDice(b, [5, 5]);
    expect(b.strikesLeft()).toBe(0);
    expect(b.mustEndTurn()).toBe(true);
    expect(b.play(0, b.s.dice.map(d => d.uid)).ok).toBe(false);
  });
  it('袖箭 refills by strike number (1 / 2 / 3), once per turn; 影步 refills what it spent; 背刺 / 影舞 refill nothing', () => {
    expect([0, 1, 2, 3].map(sleeveRefill)).toEqual([1, 2, 3, 3]);
    const b = mk('rogue');
    let u = setDice(b, [2, 3, 4, 6]);
    let ev = b.play(1, u.slice(0, 3)).events;   // 影步 3 → +3
    expect(spawned(ev)).toBe(3);
    expect(b.s.dice.length).toBe(4);
    expect(b.s.dice.filter(d => d.kind === 'shadowDie')).toHaveLength(3);
    u = setDice(b, [1, 5, 5]);
    const opt = b.options([u[0]]).find(o => o.ref === 'basic')!;
    expect(opt.v4).toMatchObject({ strike: 2, refill: 2, comboPct: 20, finisher: false });
    ev = b.play('basic', [u[0]]).events;   // 2nd strike 袖箭 → +2
    expect(spawned(ev)).toBe(2);
    expect(b.check('basic', [b.s.dice[0].uid]).match).toBeNull();   // once per turn
    expect(b.options([b.s.dice[0].uid]).find(o => o.ref === 'basic')).toMatchObject({ ok: false, reason: 'used' });
    const pair = b.s.dice.filter(d => d.face.value === 5).map(d => d.uid);
    expect(b.options(pair).find(o => o.ref === 0)?.v4).toMatchObject({ refill: 0, finisher: true, comboPct: 40 });
    ev = b.play(0, pair).events;   // 背刺: no refill
    expect(spawned(ev)).toBe(0);
  });
  it('the alternative 袖箭 table refills 2 on the first strike, then 3', () => {
    V4_PARAMS.sleeveRefill = 'first2';
    try {
      expect([0, 1, 2].map(sleeveRefill)).toEqual([2, 3, 3]);
      const b = mk('rogue'); const u = setDice(b, [1, 4, 6]);
      expect(spawned(b.play('basic', [u[0]]).events)).toBe(2);
    } finally { V4_PARAMS.sleeveRefill = 'byStrike'; }   // the describe's afterEach restores the data default
  });
  it('refilled dice have no bonus, vanish at turn end, nothing carries; next turn is 3 dice', () => {
    const b = mk('rogue'); const u = setDice(b, [1, 4, 6]);
    b.play('basic', [u[0]]);
    const sh = b.s.dice.filter(d => d.kind === 'shadowDie');
    expect(sh).toHaveLength(1);
    expect(b.preview('basic', [sh[0].uid])).toBeNull();   // 袖箭 used; the shadow die is a plain die
    expect(b.nextDice().count).toBe(3);
    const ev = b.endTurn().events;
    expect(of(ev, 'special').filter(e => e.action === 'vanish' && e.uid === sh[0].uid)).toHaveLength(1);
    expect(b.s.turnDice).toBe(3);
  });
  it('mustEndTurn: no legal strike and no way to reroll into one', () => {
    const b = mk('rogue'); const u = setDice(b, [1, 4, 6]);
    b.play('basic', [u[0]]);   // first strike: free reroll +1
    setDice(b, [2, 6]);
    expect(b.hasLegalPlay()).toBe(false);
    expect(b.mustEndTurn()).toBe(false);   // a free reroll could still make a pair
    b.s.freeRerollsLeft = 0;
    expect(b.mustEndTurn()).toBe(true);
  });
  it('背刺 II: a kill refills 2 (once per turn)', () => {
    const b = mk('rogue', [['forest_ghoul', 'forest_ghoul', 'forest_ghoul']], 2);
    b.s.enemies[0].hp = 3; b.s.enemies[1].hp = 3;
    let u = setDice(b, [4, 4, 1]);
    expect(b.options([u[0], u[1]]).find(o => o.ref === 0)?.v4?.refillOnKill).toBe(2);
    expect(spawned(b.play(0, [u[0], u[1]], b.s.enemies[0].uid).events)).toBe(2);
    u = setDice(b, [4, 4, 1]);
    expect(spawned(b.play(0, [u[0], u[1]], b.s.enemies[1].uid).events)).toBe(0);
  });
});

describe('v4 mage: 小咒 keeps the chant, 释放 ends it', () => {
  it('dice stay; each turn +1 (to at least 3), max 6; a hold gives barrier base + 2 × (hand − 3)', () => {
    const b = mk('mage', [['forest_ghoul']]);
    expect(b.s.turnDice).toBe(3);
    let ev = b.endTurn().events;
    expect(holdBarrier(3)).toBe(V4_PARAMS.barrierBase);
    expect(holdBarrier(5) - holdBarrier(4)).toBe(V4_PARAMS.barrierPer);
    expect(of(ev, 'chant')[0]).toMatchObject({ barrier: holdBarrier(3), hand: 3 });
    expect(b.s.turnDice).toBe(4);
    b.endTurn(); expect(b.s.turnDice).toBe(5);
    b.endTurn(); expect(b.s.turnDice).toBe(6);
    expect(b.s.chantRing).toBe(3);
    ev = b.endTurn().events;
    expect(of(ev, 'chant')[0]).toMatchObject({ hand: 6, overcharge: 1 });
    expect(b.s.turnDice).toBe(6);
  });
  it('a 小咒 (≤3 dice) keeps the cycle: barrier from the dice left, backlash stays; leftovers keep their values', () => {
    const b = mk('mage', [['forest_ghoul']]);
    b.endTurn();   // cycle open
    b.s.player.backlash = 6; b.s.cycleActive = true;
    const u = setDice(b, [3, 3, 3, 5, 6]);
    const o = b.options(u.slice(0, 3)).find(x => x.ref === 0)!;
    expect(o.v4).toMatchObject({ cast: 'minor', holdBarrier: holdBarrier(2) });
    const ev = b.play(0, u.slice(0, 3)).events;
    expect(of(ev, 'rowPlay')[0].v4).toMatchObject({ cast: 'minor' });
    expect(b.s.player.backlash).toBe(6);
    expect(b.s.cycleActive).toBe(true);
    expect(b.nextDice().count).toBe(3);   // 2 left + 1
    const ev2 = b.endTurn().events;
    expect(of(ev2, 'chant')[0]).toMatchObject({ minor: true, hand: 2, barrier: holdBarrier(2) });
    expect(b.s.dice.slice(0, 2).map(d => d.face.value)).toEqual([5, 6]);
  });
  it('a 释放 (≥4 dice) clears backlash and overcharge, uses the overcharge bonus, and leaves no barrier', () => {
    const b = mk('mage', [['forest_ghoul']]);
    b.s.player.backlash = 6; b.s.cycleActive = true; b.s.overcharge = 2;
    const u = setDice(b, [2, 2, 5, 5, 1]);
    expect(b.options(u.slice(0, 4)).find(x => x.ref === 2)?.v4?.cast).toBe('release');
    const ev = b.play(2, u.slice(0, 4)).events;
    expect(of(ev, 'rowPlay')[0]).toMatchObject({ bonusPct: 20, v4: { cast: 'release' } });
    expect(b.s.player.backlash).toBe(0);
    expect(b.s.cycleActive).toBe(false);
    expect(b.keepInfo()).toBeNull();
    const ev2 = b.endTurn().events;
    expect(of(ev2, 'chant')).toHaveLength(0);
    expect(b.s.turnDice).toBe(3);   // 1 left → max(3, 2)
    expect(b.s.dice[0].face.value).toBe(1);
  });
  it('闪电链 3 charges: next turn one more die', () => {
    const b = mk('mage', [['forest_ghoul', 'forest_ghoul']]);
    const u = setDice(b, [2, 3, 4]);
    b.play(1, u);
    expect(b.nextDice().count).toBe(4);   // 0 left → 3, +1 charge
    b.endTurn();
    expect(b.s.turnDice).toBe(4);
  });
});

describe('v4 warrior: 斩或挡', () => {
  it('铁壁 = armor only (points × 1.5, fury die +50%); options show armor and guard', () => {
    const b = mk('warrior', [['forest_ghoul']]);
    b.s.enemies[0].distance = 0; b.s.enemies[0].age = 1;   // v4.1: age 1 = the ghoul's first attack
    const u = setDice(b, [4, 6, 2], ['normal', 'normal', 'furyDie']);
    const o = b.options(u).find(x => x.ref === 'basic')!;
    expect(o.v4?.armor).toBe(Math.ceil(12 * wallMul() * 1.5 - 1e-9));
    expect(o.v4?.guard?.full).toBe(true);
    const ev = b.play('basic', u).events;
    expect(of(ev, 'hit')).toHaveLength(0);
    expect(b.s.player.armor).toBe(Math.ceil(12 * wallMul() * 1.5 - 1e-9));
  });
  it('斩杀再动: a skill kill adds a fury die to the field and one more action (once per turn)', () => {
    const b = mk('warrior', [['forest_ghoul', 'forest_ghoul', 'forest_ghoul']]);
    b.s.enemies[0].hp = 5; b.s.enemies[1].hp = 5;
    let u = setDice(b, [3, 3, 1]);
    expect(b.options([u[0], u[1]]).find(x => x.ref === 0)?.v4).toMatchObject({ killAct: true, kills: [b.s.enemies[0].uid] });
    const ev = b.play(0, [u[0], u[1]], b.s.enemies[0].uid).events;
    expect(of(ev, 'strikeGain')).toEqual([{ t: 'strikeGain', n: 1, reason: '斩杀再动' }]);
    expect(b.s.dice.filter(d => d.kind === 'furyDie')).toHaveLength(1);
    expect(b.strikesLeft()).toBe(1);
    expect(b.nextDice().count).toBe(4);   // the unused fury die would carry
    u = setDice(b, [3, 3]);
    const ev2 = b.play(0, u, b.s.enemies[1].uid).events;
    expect(of(ev2, 'strikeGain')).toHaveLength(0);   // cap 1 per turn
    expect(b.strikesLeft()).toBe(0);
    expect(b.bloodInfo()).toMatchObject({ behead: true, killActsLeft: 0 });
  });
  it('顺劈斩 4+ allows one more 斩杀再动 this turn', () => {
    const b = mk('warrior', [['forest_ghoul', 'forest_ghoul', 'forest_ghoul']]);
    for (const e of b.s.enemies.slice(0, 2)) e.hp = 5;
    const u = setDice(b, [2, 2, 2, 2]);
    const ev = b.play(0, u).events;
    expect(of(ev, 'strikeGain')).toHaveLength(2);
    expect(b.s.dice.filter(d => d.kind === 'furyDie')).toHaveLength(2);
  });
  it('血偿: blood sold this turn comes back × ratio after a behead; nothing without one', () => {
    for (const [ratio, kill] of [[0.5, true], [1, true], [0.5, false]] as const) {
      V4_PARAMS.bloodRefund = ratio;
      try {
        const b = mk('warrior', [['forest_ghoul', 'forest_ghoul']]);
        b.reroll([b.s.dice[0].uid]);   // free
        b.reroll([b.s.dice[0].uid]); b.reroll([b.s.dice[0].uid]);   // 3 + 5 blood
        const paid = blood(b.s.player.maxHp, 0) + blood(b.s.player.maxHp, 1);
        expect(b.bloodInfo()).toMatchObject({ paid, refund: Math.ceil(paid * ratio - 1e-9) });
        const hp = b.s.player.hp;
        if (kill) { b.s.enemies[0].hp = 3; const u = setDice(b, [2, 2]); b.play(0, u, b.s.enemies[0].uid); }
        const ev = b.endTurn().events;
        const rf = of(ev, 'bloodRefund');
        if (kill) { expect(rf).toEqual([{ t: 'bloodRefund', paid, amount: Math.ceil(paid * ratio - 1e-9), why: 'behead' }]); expect(b.s.player.hp).toBe(hp + Math.ceil(paid * ratio - 1e-9)); }
        else expect(rf).toHaveLength(0);
      } finally { V4_PARAMS.bloodRefund = 0.5; }
    }
  });
  it('血偿 after a perfect guard (armor blocks a whole attack)', () => {
    const b = mk('warrior', [['forest_ghoul']]);
    b.s.enemies[0].distance = 0; b.s.enemies[0].age = 1;   // v4.1: age 1 = the ghoul's first attack
    b.reroll([b.s.dice[0].uid]); b.reroll([b.s.dice[0].uid]);   // free, then 3 blood
    const u = setDice(b, [6, 5, 3]);   // v4.1: loose dice must form no pattern
    b.play('basic', u);
    const ev = b.endTurn().events;
    expect(of(ev, 'playerHit')[0].perfectBlock).toBe(true);
    const paid = blood(b.s.player.maxHp, 0);
    expect(of(ev, 'bloodRefund')[0]).toMatchObject({ paid, amount: Math.ceil(paid * V4_PARAMS.bloodRefund - 1e-9), why: 'guard' });
  });
});

describe('v4.1 no distance', () => {
  it('melee enemies start in range: no 逼近 intent, the ghoul opens with a guard turn, the wolf with its howl', () => {
    for (const waves of [[['forest_ghoul', 'forest_ghoul']], [['elite_alpha_wolf', 'forest_ghoul']]]) {
      const b = new Battle2({ seed: 3, classId: 'warrior', loadout: loadoutB('w_v4'), waves, kind: waves[0][0] === 'forest_ghoul' ? 'normal' : 'elite' });
      b.start();
      for (const e of b.alive()) { expect(e.distance).toBe(0); expect(b.intent(e).kind).not.toBe('mov'); }
      expect(b.intent(b.alive()[0]).kind).toBe('def');
      const ev = b.endTurn().events;
      expect(of(ev, 'enemyMove')).toHaveLength(0);
    }
  });
});

describe('v4.1 盾卫嘲讽', () => {
  const W = [['forest_banshee', 'forest_treant', 'forest_wolf_priest']];
  it('while the guardian lives, a protected pick is redirected to it; canTarget / isTaunting tell the UI', () => {
    const b = mk('rogue', W);
    const [banshee, treant, priest] = b.s.enemies;
    expect(b.target()!.uid).toBe(treant.uid);
    expect(b.isTaunting(treant.uid)).toBe(true);
    expect(b.canTarget(banshee.uid)).toBe(false);
    expect(b.canTarget(priest.uid)).toBe(false);
    expect(b.canTarget(treant.uid)).toBe(true);
    const u = setDice(b, [5, 5, 1]);
    const ev = b.play(0, [u[0], u[1]], banshee.uid).events;
    expect(of(ev, 'hit').map(h => h.uid)).toEqual([treant.uid]);
    expect(of(ev, 'rowPlay')[0].target).toBe(treant.uid);
    expect(b.s.targetUid).toBe(treant.uid);
    expect(banshee.hp).toBe(banshee.maxHp);
  });
  it('all-target skills are not affected', () => {
    const b = mk('rogue', W);
    const u = setDice(b, [3, 3, 4, 4]);   // 影舞 4: all
    const ev = b.play(2, u, b.s.enemies[0].uid).events;
    expect(new Set(of(ev, 'hit').map(h => h.uid)).size).toBe(3);
  });
  it('with two guardians the selected guardian takes the redirected hit', () => {
    const b = mk('warrior', [['forest_treant', 'forest_banshee', 'forest_treant']]);
    const [, banshee, t2] = b.s.enemies;
    const u0 = setDice(b, [6, 6, 1]);
    b.s.targetUid = t2.uid;
    const ev = b.play(0, [u0[0], u0[1]], banshee.uid).events;
    expect(of(ev, 'hit').map(h => h.uid)).toEqual([t2.uid]);
  });
  it('once the guardian dies the protection is lifted', () => {
    const b = mk('rogue', W);
    const [banshee, treant] = b.s.enemies;
    treant.hp = 3;
    let u = setDice(b, [4, 4, 1]);
    b.play(0, [u[0], u[1]], treant.uid);
    expect(treant.dead).toBe(true);
    expect(b.canTarget(banshee.uid)).toBe(true);
    u = setDice(b, [5, 5]);
    const ev = b.play(0, u, banshee.uid).events;
    expect(of(ev, 'hit').map(h => h.uid)).toEqual([banshee.uid]);
  });
});

describe('v4.1 刀鞘', () => {
  it('start strikes is a parameter; each 刀鞘 level adds one, up to 5; 觉醒「无尽连斩」makes it 6', () => {
    const old = V4_PARAMS.rogueStartStrikes;
    try {
      V4_PARAMS.rogueStartStrikes = 3;
      for (const [lv, want] of [[1, 3], [2, 4], [3, 5]] as const) {
        const lo = loadoutB('r_v4');
        lo.tablets[0].slots.find(x => x.rowId === 'r4_sheath')!.level = lv;
        const b = new Battle2({ seed: 1, classId: 'rogue', loadout: lo, waves: [['forest_ghoul']], kind: 'normal' });
        b.start();
        expect(b.s.maxStrikes).toBe(want);
        expect(b.rows()).toHaveLength(3);   // 刀鞘 is not a skill row
      }
      const lo = loadoutB('r_v4', { level: 3 });
      const b6 = new Battle2({ seed: 1, classId: 'rogue', loadout: lo, waves: [['forest_ghoul']], kind: 'normal', awaken: ['aw_endless'] });
      b6.start();
      expect(b6.s.maxStrikes).toBe(6);
      // level-ups offer 刀鞘 +1 only while it can still grow
      const r = new Run2({ seed: 2, classId: 'rogue' });
      expect(r.s.loadout.tablets[0].slots.some(x => x.rowId === 'r4_sheath')).toBe(true);
      V4_PARAMS.rogueStartStrikes = 5;
      for (let seed = 1; seed <= 10; seed++) {
        const r5 = new Run2({ seed, classId: 'rogue' });
        for (let i = 0; i < 3; i++) (r5 as unknown as { queueLevelUp(): void }).queueLevelUp();
        for (const c of r5.s.queue) if (c.kind === 'levelUp') for (const k of c.cards) expect(r5.s.loadout.tablets[0].slots[(k as { slot: number }).slot].rowId).not.toBe('r4_sheath');
      }
    } finally { V4_PARAMS.rogueStartStrikes = old; }
  });
  it('a turn the cap cuts short is counted (刀鞘卡住)', () => {
    const old = V4_PARAMS.rogueStartStrikes;
    try {
      V4_PARAMS.rogueStartStrikes = 3;
      const b = mk('rogue');
      for (let i = 0; i < 3; i++) { const u = setDice(b, [5, 5, 2]); b.play(0, [u[0], u[1]]); }
      setDice(b, [2, 2]);
      expect(b.strikesLeft()).toBe(0);
      b.endTurn();
      expect(b.stats.capBlocked).toBe(1);
    } finally { V4_PARAMS.rogueStartStrikes = old; }
  });
});

describe('v4.1 散骰是排他的牌型', () => {
  it('only a selection that forms no 同点 / 连环 / 阵列 is loose; the warrior gets two loose options (铁壁 / 劈砍)', () => {
    const b = mk('warrior', [['forest_ghoul']]);
    const basic = (vals: number[]) => { const u = setDice(b, vals); return b.options(u).filter(o => o.ref === 'basic'); };
    expect(basic([4, 4]).every(o => !o.ok && o.reason === 'pattern')).toBe(true);
    expect(b.check('basic', b.s.dice.map(d => d.uid)).match).toBeNull();
    expect(basic([3, 4, 5]).every(o => !o.ok)).toBe(true);
    expect(basic([4]).every(o => o.ok)).toBe(true);
    const two = basic([4, 4, 6]);
    expect(two.map(o => [o.name, o.loose, o.ok])).toEqual([['铁壁', 'guard', true], ['劈砍', 'chop', true]]);
    expect(two[0].v4?.armor).toBe(Math.ceil(14 * wallMul() - 1e-9));
    expect(two[1].v4?.armor).toBe(0);
    // the same [4,4,6] hand: a pair alone is 顺劈斩 only
    const pair = b.s.dice.filter(d => d.face.value === 4).map(d => d.uid);
    const o2 = b.options(pair);
    expect(o2.find(o => o.ref === 0)?.ok).toBe(true);
    expect(o2.filter(o => o.ref === 'basic').some(o => o.ok)).toBe(false);
    // mage / rogue: 1 die is always loose
    for (const cid of ['mage', 'rogue'] as const) { const m = mk(cid); const u = setDice(m, [5]); expect(m.options(u).find(o => o.ref === 'basic')?.ok).toBe(true); }
  });
  it('劈砍 = points × 1.0 damage (fury +50%), no armor; 铁壁 is still the default', () => {
    const b = mk('warrior', [['forest_ghoul']]);
    let u = setDice(b, [4, 6, 1], ['normal', 'furyDie', 'normal']);
    const ev = b.play('basic', u, undefined, { loose: 'chop' }).events;
    expect(of(ev, 'hit')[0].dmg).toBe(Math.ceil(11 * 1.5));
    expect(b.s.player.armor).toBe(0);
    expect(of(ev, 'rowPlay')[0]).toMatchObject({ ref: 'basic', name: '劈砍', v4: { loose: 'chop' } });
    const b2 = mk('warrior', [['forest_ghoul']]);
    u = setDice(b2, [4, 6, 1]);
    b2.play('basic', u);
    expect(b2.s.player.armor).toBe(Math.ceil(11 * wallMul() - 1e-9));
  });
  it('a 劈砍 kill is a behead: 斩杀再动 applies', () => {
    const b = mk('warrior', [['forest_ghoul', 'forest_ghoul']]);
    b.s.enemies[0].hp = 5;
    const u = setDice(b, [2, 5]);
    const ev = b.play('basic', u, b.s.enemies[0].uid, { loose: 'chop' }).events;
    expect(of(ev, 'strikeGain')).toHaveLength(1);
  });
});

describe('v4.2 护甲（杀戮尖塔口径）', () => {
  const lich = () => { const b = new Battle2({ seed: 5, classId: 'warrior', loadout: loadoutB('w_v4'), waves: [['boss_lich_forest']], kind: 'midBoss' }); b.start(); return b; };
  it('a caster「攻击」is direct spell damage: shown as an attack, blocked by armor, and a full block is 完防', () => {
    const b = lich();
    const it0 = b.intent(b.s.enemies[0]);
    const storm = ENEMIES.boss_lich_forest.phases[0].actions[0].baseValue;   // 亡灵风暴 (v4.2: 12)
    expect(it0).toMatchObject({ kind: 'atk', value: storm });
    b.s.player.armor = 20;
    const hp = b.s.player.hp;
    const ev = b.endTurn().events;
    const hit = of(ev, 'playerHit')[0];
    expect(hit).toMatchObject({ dmg: storm, byArmor: storm, hpDmg: 0, isDot: false, perfectBlock: true });
    expect(b.s.player.hp).toBe(hp);
    expect(b.s.turnDice).toBe(4);   // 完防 → +1 die
  });
  it('poison ignores armor and does not break 完防', () => {
    const b = lich();
    b.s.player.armor = 30;
    b.s.player.statuses.push({ type: 'poison', value: 3 });
    const hp = b.s.player.hp;
    const ev = b.endTurn().events;
    expect(of(ev, 'playerHit').find(h => h.isDot)).toMatchObject({ dmg: 3, byArmor: 0, hpDmg: 3 });
    expect(b.s.player.hp).toBe(hp - 3);
    expect(b.s.turnDice).toBe(4);
    expect(of(ev, 'gainDice').some(g => g.reason === 'guard')).toBe(true);
  });
  it('完防 needs every blockable hit covered: one blocked + one through is not 完防', () => {
    const b = mk('warrior', [['forest_ghoul', 'forest_ghoul']]);
    for (const e of b.s.enemies) { e.distance = 0; e.age = 1; }   // both attack (7 each)
    b.s.player.armor = 10;
    const ev = b.endTurn().events;
    const hits = of(ev, 'playerHit');
    expect(hits[0].perfectBlock).toBe(true);
    expect(hits[1].hpDmg).toBeGreaterThan(0);
    expect(of(ev, 'gainDice').some(g => g.reason === 'guard')).toBe(false);
    expect(b.s.turnDice).toBe(3);
    // and the UI forecast agrees
    const b2 = mk('warrior', [['forest_ghoul', 'forest_ghoul']]);
    for (const e of b2.s.enemies) { e.distance = 0; e.age = 1; }
    const u = setDice(b2, [6, 5, 3]);
    const o = b2.options(u).find(x => x.loose === 'guard')!;
    expect(o.v4?.guard).toMatchObject({ incoming: 14, full: Math.ceil(14 * wallMul() - 1e-9) >= 14 });   // [6,5,3] → 14 × 铁壁
    const u2 = setDice(b2, [1, 3]);
    expect(b2.options(u2).find(x => x.loose === 'guard')!.v4?.guard?.full).toBe(false);   // 4 × 铁壁 < 14
  });
});

describe('v4.2 刀鞘开局 2', () => {
  it('start 2: the 刀鞘 slot goes to IV = 5 strikes; the IV card upgrades from III', () => {
    expect(V4_PARAMS.rogueStartStrikes).toBe(2);
    for (const [lv, want] of [[1, 2], [2, 3], [3, 4], [4, 5]] as const) {
      const lo = loadoutB('r_v4');
      lo.tablets[0].slots.find(x => x.rowId === 'r4_sheath')!.level = lv;
      const b = new Battle2({ seed: 1, classId: 'rogue', loadout: lo, waves: [['forest_ghoul']], kind: 'normal' });
      b.start();
      expect(b.s.maxStrikes).toBe(want);
    }
    const r = new Run2({ seed: 4, classId: 'rogue' });
    const sl = r.s.loadout.tablets[0].slots.find(x => x.rowId === 'r4_sheath')!;
    sl.level = 3;
    for (let i = 0; i < 6; i++) (r as unknown as { queueLevelUp(): void }).queueLevelUp();
    const sheathCards = r.s.queue.flatMap(c => (c.kind === 'levelUp' ? c.cards : [])).filter(k => k.kind === 'upgrade' && r.s.loadout.tablets[0].slots[k.slot].rowId === 'r4_sheath');
    for (const k of sheathCards) expect(k).toMatchObject({ from: 3 });
  });
});
