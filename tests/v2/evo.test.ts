// v2.2: evolutions the engine does not implement are never offered on level up.
import { Run2 } from '../../src/core/v2/run2';
import { CLASSES, TABLETS, rowDef } from '../../src/core/v2/data';
import type { ClassId } from '../../src/core/v2/types';

describe('level-up evolutions', () => {
  it('never offers a row whose evolutions are not all implemented', () => {
    for (const cid of Object.keys(CLASSES) as ClassId[]) for (const tid of CLASSES[cid].tablets) {
      if (!TABLETS[tid]) continue;
      for (let seed = 1; seed <= 20; seed++) {
        const r = new Run2({ seed, classId: cid, tablet: tid, full: true, rowLevel: 3 });
        for (let i = 0; i < 4; i++) (r as unknown as { queueLevelUp(): void }).queueLevelUp();
        for (const c of r.s.queue) if (c.kind === 'levelUp') for (const k of c.cards) if (k.kind === 'evolve') {
          const sl = r.s.loadout.tablets[k.tablet].slots[k.slot];
          expect(rowDef(sl.rowId).evolutions.every(e => e.implemented)).toBe(true);
        }
      }
    }
  });
});
