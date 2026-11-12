// The bot finishes runs for every class × tablet (and version A) without errors.
import { autoRun, simulate, COMBOS, formatTable } from '../../src/core/v2/sim';
import { CLASSES } from '../../src/core/v2/data';

describe('bot runs', () => {
  for (const c of COMBOS) {
    it(`${c.classId} ${c.tablet}: 2 runs finish`, () => {
      for (const seed of [1, 2]) {
        const r = autoRun({ seed, ...c });
        expect(r.fights.length).toBeGreaterThan(0);
        expect(r.win || r.diedAt != null).toBe(true);
      }
    }, 60000);
  }
  for (const classId of Object.keys(CLASSES) as Array<keyof typeof CLASSES>) {
    it(`${classId} version A: 1 run finishes`, () => {
      const r = autoRun({ seed: 3, classId, version: 'A' });
      expect(r.fights.length).toBeGreaterThan(0);
    }, 60000);
  }
  it('metrics table', () => {
    const t = formatTable(COMBOS.map(c => simulate({ n: 3, ...c })));
    expect(t.split('\n')).toHaveLength(2 + COMBOS.length);
    console.log(t);
  }, 60000);
});
