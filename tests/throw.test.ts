// Pre-simulated throws: every die lands flat, inside the battle-front field, apart from the others (no clipping, no stuck dice).
import * as THREE from 'three';
import { simThrow, FIELD, SIMDBG } from '../src/present/dice/throw';
import { topFaceOf } from '../src/present/dice/faces';
import { DIE } from '../src/present/dice/signature';

describe('simThrow', () => {
  it('6 dice from the hero land flat, in the field, apart', () => {
    const from = new THREE.Vector3(-1.4, 1.6, 2.8);
    for (let round = 0; round < 6; round++) {
      const recs = simThrow(6, [], from);
      expect(recs).toHaveLength(6);
      for (const r of recs) {
        expect(topFaceOf(r.qEnd).align).toBeGreaterThan(0.999);
        expect(r.pEnd.y).toBeCloseTo(DIE / 2, 5);
        expect(r.pEnd.x).toBeGreaterThanOrEqual(FIELD.x0); expect(r.pEnd.x).toBeLessThanOrEqual(FIELD.x1);
        expect(r.pEnd.z).toBeGreaterThanOrEqual(FIELD.z0); expect(r.pEnd.z).toBeLessThanOrEqual(FIELD.z1);
        expect(r.dur).toBeLessThan(1.8);
        // the recorded track ends exactly at the rest pose
        const n = r.f.length / 7, i = (n - 1) * 7;
        expect(new THREE.Vector3(r.f[i], r.f[i + 1], r.f[i + 2]).distanceTo(r.pEnd)).toBeLessThan(1e-4);
      }
      for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) expect(Math.hypot(recs[a].pEnd.x - recs[b].pEnd.x, recs[a].pEnd.z - recs[b].pEnd.z)).toBeGreaterThan(DIE * 1.05);
    }
    console.log('throw rejections', JSON.stringify(SIMDBG));
  });
});
