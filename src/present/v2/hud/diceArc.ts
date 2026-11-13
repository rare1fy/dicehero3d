// R5 dice landing (UX_V3 §1b「手机握持」): the dice land on a "smile arc" in the lower half of the screen, above the HUD — screen y ≈ 430
// at the ends to 520 in the middle (1280×720 reference), centre-to-centre ≥ 120 px — so thumbs reach them and they are far enough apart
// to tap. Slots are screen points cast down onto the ground (the arc keeps its shape on any aspect ratio). Throws are pre-simulated
// with the locked v5 physics (dice/throw.ts) into a small box round each slot. Taps pick the nearest die by screen distance.
import * as THREE from 'three';
import { V3 } from '../../engine/world';
import { FIELD, simThrow } from '../../dice/throw';
import type { ThrowRec } from '../../dice/die3d';
import { DIE } from '../../dice/signature';
import { uiRayPlane, worldToUi, worldPerPxAt } from '../../ui3d/layer';
import type { Die3D } from '../../dice/die3d';

export interface ArcFrame { L0: number; R0: number; k: number; top?: number }
/** arc centre (ref px), spacing (ref px), the parabola */
const CX = 660, GAP = 124, Y_MID = 520, Y_END = 430, HALF = 320, X_MIN = 372, X_MAX = 982;

/** n slot points in screen px (left → right) */
export function arcPx(n: number, f: ArcFrame) {
  n = Math.max(1, Math.min(6, n));
  const gap = n > 1 ? Math.min(GAP, (X_MAX - X_MIN) / (n - 1)) : GAP; let cx = CX; const span = (n - 1) * gap;
  if (cx - span / 2 < X_MIN) cx = X_MIN + span / 2; if (cx + span / 2 > X_MAX) cx = X_MAX - span / 2;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * gap, u = (x - CX) / HALF;
    out.push({ x: f.L0 + x * f.k, y: (f.top??0)+(Y_MID - (Y_MID - Y_END) * Math.min(1.2, u * u)) * f.k });
  }
  return out;
}
/** 镜头拉高时仍保留 ≥72 参考像素；仅落定时计算，不在选骰时移动镜头。 */
export function sizeRestingDie(d: Die3D, k: number) {
  const px=worldToUi(d.home), scale=Math.max(1,worldPerPxAt(d.home)*76*k/DIE);
  const p=uiRayPlane(px.x,px.y,DIE*scale/2);
  d.root.scale.setScalar(scale); if(p) { d.home.copy(p.pos); d.root.position.copy(p.pos); }
  d.foot.position.y=0.012;
}
/** the arc slots as ground points (die centre height) */
export function arcSlots(n: number, f: ArcFrame): THREE.Vector3[] {
  return arcPx(n, f).map(p => { const r = uiRayPlane(p.x, p.y, DIE / 2); return r ? r.pos.clone().setY(DIE / 2) : V3(0, DIE / 2, 1); });
}
/** n slots for the dice to come, with `occupied` (dice staying on the field) taking their nearest slots first */
export function freeSlots(total: number, occupied: THREE.Vector3[], f: ArcFrame) {
  const slots = arcSlots(total, f), taken = new Set<number>();
  for (const p of occupied) {
    let bi = -1, bd = 1e9; slots.forEach((s, i) => { if (taken.has(i)) return; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) taken.add(bi);
  }
  return slots.filter((_, i) => !taken.has(i));
}
/** pre-simulate one throw per target (each lands within ±r of its slot), avoiding `kept` and each other */
export function simTo(targets: THREE.Vector3[], kept: Array<{ p: THREE.Vector3; q: THREE.Quaternion }>, from: THREE.Vector3 | ((i: number) => THREE.Vector3), r = 0.3): ThrowRec[] {
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
