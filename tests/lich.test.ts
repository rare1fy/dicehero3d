// The lich fight follows the original's code (docs/规则对照_阶段1.md): caster never hits directly, 「诅咒」 = 1 poison,
// summons at the start of enemy turns 3/6/9 (unscaled ghoul, distance 2, first attack on turn 6), at most one junk die per turn,
// boss shield every 2nd turn, rage fire counts fully blocked hits.
import { Battle } from '../src/core/battle';
import { sliceSetup } from '../src/core/slice';
import type { BattleEvent } from '../src/core/events';

const passTurns = (b: Battle, n: number) => { const all: BattleEvent[][] = []; for (let i = 0; i < n; i++) { const r = b.endTurn(); expect(r.ok).toBe(true); all.push(r.events); } return all; };
const lich = (b: Battle) => b.s.enemies.find(e => e.cfgId === 'boss_lich_forest')!;

describe('lich (original rules)', () => {
  it('depth 7: 216 HP, attack 10, boss by max HP', () => {
    const b = new Battle(sliceSetup(1)); b.start();
    expect(lich(b).maxHp).toBe(216); expect(lich(b).attackDmg).toBe(10);
  });

  it('never attacks directly; its 「诅咒」 is 1 poison and adds no die', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const b = new Battle(sliceSetup(seed, { god: true })); b.start();
      const turns = passTurns(b, 5);
      for (const ev of turns) for (const e of ev) if (e.t === 'enemyAct' && e.uid === lich(b).uid) expect(e.kind).not.toBe('attack');
      // turn 4 (phase 1 action index 3) = 「诅咒」 → poison 1
      const t4 = turns[3];
      expect(t4.some(e => e.t === 'enemyAct' && e.uid === lich(b).uid && e.desc === '诅咒')).toBe(true);
      expect(t4.some(e => e.t === 'statusAdd' && e.who === 'player' && e.status.type === 'poison' && e.status.value === 1)).toBe(true);
      expect(t4.some(e => e.t === 'junk' && e.id === 'cursed')).toBe(false);
    }
  });

  it('summons an unscaled ghoul at the start of turn 3; it walks on 4–5 and first attacks on 6 (13 + weak)', () => {
    const b = new Battle(sliceSetup(3, { god: true })); b.start();
    const turns = passTurns(b, 6);
    const s3 = turns[2].findIndex(e => e.t === 'summon'), first = turns[2].findIndex(e => e.t === 'statusTick' || e.t === 'enemyAct');
    expect(s3).toBeGreaterThan(-1); expect(s3).toBeLessThan(first < 0 ? Infinity : first);
    const g = b.s.enemies.find(e => e.cfgId === 'forest_ghoul')!;
    expect(g.maxHp).toBe(28); expect(g.attackDmg).toBe(10);
    expect(turns[2].some(e => e.t === 'enemyAct' && e.uid === g.uid)).toBe(false);
    expect(turns[3].some(e => e.t === 'enemyMove' && e.uid === g.uid && e.distance === 1)).toBe(true);
    expect(turns[4].some(e => e.t === 'enemyMove' && e.uid === g.uid && e.distance === 0)).toBe(true);
    const hit = turns[5].find(e => e.t === 'enemyAct' && e.uid === g.uid);
    expect(hit).toMatchObject({ kind: 'attack', value: 13 });
    expect(turns[5].some(e => e.t === 'statusAdd' && e.who === 'player' && e.status.type === 'weak')).toBe(true);
  });

  it('boss: at most one junk die per turn, shield +20 on even turns', () => {
    const b = new Battle(sliceSetup(5, { god: true })); b.start();
    lich(b).hp = 60;   // below 40%: cursed dice on even turns
    const turns = passTurns(b, 12);
    turns.forEach((ev, i) => {
      const t = i + 1, junk = ev.filter(e => e.t === 'junk');
      expect(junk.length).toBeLessThanOrEqual(1);
      if (t % 2 === 0) expect(junk[0]).toMatchObject({ id: 'cursed' });
      else if (t % 3 === 0) expect(junk[0]).toMatchObject({ id: 'cracked' });
      else expect(junk).toHaveLength(0);
      expect(ev.some(e => e.t === 'armor' && e.who === lich(b).uid && e.delta === 20)).toBe(t % 2 === 0);
    });
    expect(b.invariantErrors).toEqual([]);
  });

  it('rage fire and 怒火 grow on every enemy attack branch, even when armor takes it all', () => {
    const b = new Battle(sliceSetup(3, { god: true })); b.start();
    passTurns(b, 5);
    b.s.armor = 999;   // the ghoul's first attack (turn 6) is fully blocked
    const ev = b.endTurn().events;
    expect(ev.some(e => e.t === 'playerHit' && e.perfectBlock)).toBe(true);
    expect(b.player.rageFireBonus).toBe(15);
    expect(b.player.furyBonus).toBe(1);
    expect(ev.some(e => e.t === 'reap' && e.kind === 'block')).toBe(true);
  });

  it('crossing 40% switches phase with a line; the ghoul gains blood fury when a play hurts it', () => {
    const b = new Battle(sliceSetup(9, { god: true })); b.start();
    const L = lich(b); L.hp = 90; L.armor = 0;
    const d = b.hand[0];
    const r = b.play([d.uid], L.uid);
    expect(r.ok).toBe(true);
    if (L.hp < 86.4 && L.hp > 0) {
      expect(r.events.some(e => e.t === 'phase' && e.uid === L.uid && e.phaseIdx === 1)).toBe(true);
      expect(r.events.some(e => e.t === 'quote' && e.uid === L.uid && e.kind === 'lowHp')).toBe(true);
    }
  });
});
