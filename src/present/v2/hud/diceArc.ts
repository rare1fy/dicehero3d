// R6S dice landing (UX_V3 §1b「骰场」): dice land only in the six sockets of the dice field (v2/diceField.ts), a fixed stone dais
// in front of everyone — never in screen points cast onto the ground. Throws are pre-simulated with the locked v5 physics
// (dice/throw.ts) in the field's unit frame, each into a small box round its socket, and the field maps the track into the world.
// Taps pick the nearest die by screen distance.
import * as THREE from 'three';
import { FIELD, simThrow } from '../../dice/throw';
import type { ThrowRec } from '../../dice/die3d';
import { worldToUi } from '../../ui3d/layer';
import type { Die3D } from '../../dice/die3d';
import type { DiceField } from '../diceField';

export interface ThrowPlan { slots: number[]; targets: THREE.Vector3[]; kept: Array<{ p: THREE.Vector3; q: THREE.Quaternion }> }
/** n dice to throw: the free sockets (resting dice keep theirs), as unit-frame targets, plus the resting dice as unit-frame obstacles */
export function throwPlan(field: DiceField, n: number, resting: Die3D[]): ThrowPlan {
  const slots = field.freeSlots(n, resting);
  return { slots, targets: slots.map(i => field.toUnit(field.slot(i))), kept: resting.map(d => ({ p: field.toUnit(d.home).setY(0.4), q: d.homeQ.clone() })) };
}
/** pre-simulate one throw per target (each lands within ±r of its slot), avoiding `kept` and each other (all in the unit frame) */
export function simTo(targets: THREE.Vector3[], kept: Array<{ p: THREE.Vector3; q: THREE.Quaternion }>, from: THREE.Vector3 | ((i: number) => THREE.Vector3), r = 0.1): ThrowRec[] {
  const saved = { ...FIELD }, occ = kept.map(k => ({ p: k.p.clone(), q: k.q.clone() })), out: ThrowRec[] = [];
  for (const [i, t] of targets.entries()) {
    Object.assign(FIELD, { x0: t.x - r - 0.32, x1: t.x + r + 0.32, z0: t.z - r - 0.32, z1: t.z + r + 0.32 });
    const rec = simThrow(1, occ, typeof from === 'function' ? from(i) : from)[0]; Object.assign(FIELD, saved);
    occ.push({ p: rec.pEnd.clone(), q: rec.qEnd.clone() }); out.push(rec);
  }
  return out;
}
/** the die nearest to screen (x, y) within `radius` px (taps between dice still pick the closest) */
export function nearestDie<D extends { root: THREE.Object3D }>(dice: D[], x: number, y: number, radius: number): D | null {
  let best: D | null = null, bd = radius;
  for (const d of dice) { const v = worldToUi(d.root.position), dd = Math.hypot(v.x - x, v.y - y); if (v.z < 1 && dd < bd) { bd = dd; best = d; } }
  return best;
}
