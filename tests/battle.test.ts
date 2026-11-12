import { Battle } from '../src/core/battle';
import { autoBattle } from '../src/core/bot';
import { sliceSetup } from '../src/core/slice';
import type { BattleEvent } from '../src/core/events';

const types = (ev: BattleEvent[]) => ev.map(e => e.t);

describe('battle start', () => {
  it('spawns the lich, quotes, and draws the warrior hand', () => {
    const b = new Battle(sliceSetup(1));
    const ev = b.start();
    expect(types(ev).slice(0, 2)).toEqual(['battleStart', 'enemyEnter']);
    expect(ev.find(e => e.t === 'quote')).toMatchObject({ kind: 'enter' });
    expect(b.alive()).toHaveLength(1);
    expect(b.alive()[0].cfgId).toBe('boss_lich_forest');
    expect(b.hand).toHaveLength(3);
    expect(b.s.phase).toBe('player');
    expect(b.invariantErrors).toEqual([]);
  });
});

describe('reroll cost (logic/rerollCalc.ts)', () => {
  it('first reroll is free, then ceil(maxHp × 2^(k) / 100)', () => {
    const b = new Battle(sliceSetup(2)); b.start();
    expect(b.rerollHpCost()).toBe(0);
    expect(b.reroll([b.hand[0].uid]).ok).toBe(true);
    expect(b.rerollHpCost()).toBe(3);   // ceil(120 × 2 / 100)
    const hp = b.player.hp;
    expect(b.reroll([b.hand[0].uid]).ok).toBe(true);
    expect(b.player.hp).toBe(hp - 3);
    expect(b.s.bloodRerollCount).toBe(1);
    expect(b.rerollHpCost()).toBe(5);   // ceil(120 × 4 / 100)
    expect(b.hand).toHaveLength(3);
    expect(b.invariantErrors).toEqual([]);
  });
});

describe('bot plays whole battles', () => {
  it('200 seeded lich fights end with a result, zero pile drift, no exceptions', () => {
    let wins = 0, turns = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = new Battle(sliceSetup(seed));
      const r = autoBattle(b);
      expect(r.result, `seed ${seed}`).not.toBeNull();
      expect(b.invariantErrors, `seed ${seed}`).toEqual([]);
      if (r.result === 'win') wins++;
      turns += r.turns;
    }
    console.log(`bot vs lich: ${wins}/200 wins, avg ${(turns / 200).toFixed(1)} turns`);
    expect(wins).toBeGreaterThan(0);
  });
});
