// Camera director: named shots (functions, so they can track moving actors), blended with frame-rate independent damping in REAL time
// (hitstop / slow motion never freeze the camera), plus orbit shots for kills and victory. Writes the CAM rig the frame loop renders.
import * as THREE from 'three';
import { V3, view, onLateUpdate } from './engine/world';
import { CAM } from './engine/gfx';

export interface Shot { base: THREE.Vector3; look: THREE.Vector3; fov: number }
type ShotFn = (t: number) => Shot;
const cur = { base: V3(0, 22, 24), look: V3(0, 0, -2), fov: 34 };
let target: ShotFn = () => ({ base: cur.base.clone(), look: cur.look.clone(), fov: cur.fov });
let speed = 3, shotT = 0, cutNext = false;
export const DIRECTOR = { name: 'none', aspectK: 1 };

/** Switch to a shot. speed = blend rate (higher = faster); cut = jump without blending. */
export function shot(name: string, fn: ShotFn, o: { speed?: number; cut?: boolean } = {}) {
  DIRECTOR.name = name; target = fn; speed = o.speed ?? 3; shotT = 0; cutNext = !!o.cut;
}
export const staticShot = (base: THREE.Vector3, look: THREE.Vector3, fov: number): ShotFn => () => ({ base, look, fov });
/** Orbit a point: radius, height, angular speed (rad/s), starting angle. */
export const orbitShot = (center: () => THREE.Vector3, r: number, h: number, w: number, a0: number, fov: number, lookUp = 1): ShotFn => t => {
  const c = center(), a = a0 + w * t; return { base: V3(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r), look: c.clone().add(V3(0, lookUp, 0)), fov };
};

onLateUpdate((_dt, rdt) => {
  shotT += rdt;
  const s = target(shotT);
  // portrait phones need a wider vertical view than desktop for the same composition
  const portrait = view.w / Math.max(1, view.h) < 0.8;
  const fov = s.fov * (portrait ? 1 : 0.86);
  if (cutNext) { cur.base.copy(s.base); cur.look.copy(s.look); cur.fov = fov; cutNext = false; }
  const k = 1 - Math.exp(-speed * rdt);
  cur.base.lerp(s.base, k); cur.look.lerp(s.look, k); cur.fov += (fov - cur.fov) * k;
  CAM.base.copy(cur.base); CAM.look.copy(cur.look); CAM.fov = cur.fov;
});
