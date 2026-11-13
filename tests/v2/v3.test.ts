// Rules v3 (RULES_V3.md): pattern skills, exact patterns, special dice bonuses, upgrade-only level ups.
import { Battle2, kindSuit } from '../../src/core/v2/battle2';
import { matchRow } from '../../src/core/v2/cond';
import { CLASSES, loadoutB, rowDef } from '../../src/core/v2/data';
import { Run2 } from '../../src/core/v2/run2';
import type { ClassId, DieKind, Face } from '../../src/core/v2/types';

const F = (...vals: number[]): Face[] => vals.map(v => ({ value: v, suit: 'none' }));
// v4 made w_v4 / m_v4 / r_v4 the default; these tests pin the v3 tablets
const V3_TAB: Record<ClassId, string> = { warrior: 'w_v3', mage: 'm_v3', rogue: 'r_v3' };
function mk(classId: ClassId, waves: string[][] = [['forest_ghoul', 'forest_ghoul']]) {
  const b = new Battle2({ seed: 7, classId, loadout: loadoutB(V3_TAB[classId]), waves, kind: 'normal' });
  b.start();
  for (const e of b.s.enemies) { e.hp = e.maxHp = 999; e.distance = 5; }
  return b;
}
function setDice(b: Battle2, vals: number[], kinds: DieKind[] = []) {
  b.s.dice = vals.map((v, i) => { const kind = kinds[i] || 'normal'; return { uid: b.s.dieUid++, kind, face: { value: v, suit: kindSuit(b.cls.id, kind, v) }, persist: 'turn' as const, source: 'base' as const, carried: 0 }; });
  b.s.turnDice = Math.max(b.s.turnDice, b.s.dice.length);
  return b.s.dice.map(d => d.uid);
}

describe('v3 patterns', () => {
  it('同点 / 顺子 / 阵列 must use every die handed in', () => {
    const same = rowDef('w3_same'), str = rowDef('w3_straight'), arr = rowDef('w3_array');
    expect(matchRow(same, F(4, 4))).toMatchObject({ tier: 'single' });
    expect(matchRow(same, F(4, 4, 4, 4))).toMatchObject({ tier: 'area' });
    expect(matchRow(same, F(4, 4, 5))).toBeNull();
    expect(matchRow(str, F(2, 3, 4))).toMatchObject({ tier: 'single' });
    expect(matchRow(str, F(2, 3, 4, 5, 6))).toMatchObject({ tier: 'area' });
    expect(matchRow(str, F(2, 3, 5))).toBeNull();
    expect(matchRow(str, F(2, 3))).toBeNull();
    for (const ok of [[1, 1, 2, 2], [3, 3, 3, 5, 5], [6, 6, 6, 6, 1, 1], [2, 2, 2, 4, 4, 4], [1, 1, 3, 3, 5, 5]]) expect(matchRow(arr, F(...ok))).not.toBeNull();
    expect(matchRow(arr, F(1, 1, 2, 2))).toMatchObject({ tier: 'single' });
    expect(matchRow(arr, F(1, 1, 2, 2, 2))).toMatchObject({ tier: 'area' });
    expect(matchRow(arr, F(1, 1, 2, 2, 3, 3))).toMatchObject({ tier: 'ultimate' });
    for (const bad of [[1, 1, 1, 1], [1, 1, 2, 3], [1, 1, 2]]) expect(matchRow(arr, F(...bad))).toBeNull();
    expect(arr.icon.kind).toBe('array');
  });
  it('every class defaults to the 3-row v3 tablet; mage loose dice = 1', () => {
    for (const cid of Object.keys(CLASSES) as ClassId[]) {
      const b = mk(cid);
      expect(b.rows().map(r => r.def.cond.t)).toEqual(['sameValue', 'straight', 'array']);
    }
    expect(CLASSES.mage.basicAttack.maxDice).toBe(1);
    expect(CLASSES.warrior.basicAttack.maxDice).toBe(6);   // v4.4: any count of loose dice
    const b = mk('mage'); const u = setDice(b, [1, 2]);
    expect(b.check('basic', u).match).toBeNull();
  });
  it('damage = points × class scale × tier multiplier (顺劈斩 2 颗: 10 × 1.9 × 1.5)', () => {
    const b = mk('warrior'); const u = setDice(b, [5, 5]);
    const ev = b.play(0, u).events;
    expect(ev.find(e => e.t === 'hit')).toMatchObject({ dmg: 29 });
  });
  it('special dice add to the play: fury +50%, star +15%, shadow +20%, listed on rowPlay and in preview', () => {
    const w = mk('warrior'); const u = setDice(w, [5, 5], ['furyDie', 'normal']);
    const pv = w.preview(0, u)!;
    expect(pv.specialPct).toBe(50);
    const rp = w.play(0, u).events.find(e => e.t === 'rowPlay');
    expect(rp && rp.t === 'rowPlay' ? rp.special : null).toEqual([{ uid: u[0], kind: 'furyDie', pct: 50 }]);
    const m = mk('mage'); const um = setDice(m, [3, 3], ['starDie', 'starDie']);
    expect(m.preview(0, um)!.specialPct).toBe(30);
    const r = mk('rogue'); const ur = setDice(r, [4, 4], ['shadowDie', 'normal']);
    expect(r.preview(0, ur)!.specialPct).toBe(20);
  });
  it('rogue: the first strike as 袖箭 adds a shadow die, once per turn; an unused shadow die carries', () => {
    const b = mk('rogue'); const u = setDice(b, [1, 3, 6]);
    const ev = b.play('basic', [u[0]]).events;
    expect(ev.some(e => e.t === 'special' && e.action === 'spawn' && e.kind === 'shadowDie')).toBe(true);
    expect(b.nextDice().count).toBe(4);
    const ev2 = b.play('basic', [u[1]]).events;
    expect(ev2.some(e => e.t === 'special' && e.action === 'spawn')).toBe(false);
  });
  it('背刺 4+: execute below 30% HP', () => {
    const b = mk('rogue'); const t = b.s.enemies[0]; t.hp = 200;
    const u = setDice(b, [2, 2, 2, 2]);
    const ev = b.play(0, u, t.uid).events;
    expect(ev.find(e => e.t === 'hit')).toMatchObject({ killed: true });
  });
  it('level ups only upgrade one of the 3 skills', () => {
    for (const cid of Object.keys(CLASSES) as ClassId[]) for (let seed = 1; seed <= 10; seed++) {
      const r = new Run2({ seed, classId: cid, tablet: V3_TAB[cid] });
      for (let i = 0; i < 3; i++) (r as unknown as { queueLevelUp(): void }).queueLevelUp();
      for (const c of r.s.queue) if (c.kind === 'levelUp') for (const k of c.cards) expect(k.kind).toBe('upgrade');
    }
  });
});
