// Pre-simulated throws (v5 02_world.js — locked feel). Each die is simulated instantly in a hidden cannon-es world; throws that end
// cocked, outside the landing field, too close to another die or too slow are rejected and re-simulated; the accepted trajectory is
// recorded at 60 Hz and played back in game time. The rules layer decides each value; the die's faces are renumbered before playback
// so that value lands on top, painted upright for the camera.
// Change from v5 (user, 2026-11-12): the landing area is the whole battle front (a rectangle), not a rune circle.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { V3, R, TAU } from '../engine/world';
import { ease, lerp, clock } from '../engine/clock';
import { DIE } from './signature';
import { FACE_N, faceToward, snapFlat, topFaceOf, uprightTurns, UP } from './faces';
import type { Die3D, ThrowRec } from './die3d';

/** Landing field on the ground (world units). Set by the battle layout so landed dice are readable and never under the HUD. */
export const FIELD = { x0: -2.6, x1: 2.6, z0: 0.2, z1: 2.4 };
const inField = (x: number, z: number, m = 0) => x > FIELD.x0 + m && x < FIELD.x1 - m && z > FIELD.z0 + m && z < FIELD.z1 - m;

const W = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
W.allowSleep = false; (W.solver as CANNON.GSSolver).iterations = 12; W.broadphase = new CANNON.NaiveBroadphase();
const M_DIE = new CANNON.Material('die'), M_GROUND = new CANNON.Material('ground');
W.addContactMaterial(new CANNON.ContactMaterial(M_DIE, M_GROUND, { friction: 0.7, restitution: 0.18 }));
W.addContactMaterial(new CANNON.ContactMaterial(M_DIE, M_DIE, { friction: 0.3, restitution: 0.3 }));
{ const fl = new CANNON.Body({ mass: 0, material: M_GROUND, shape: new CANNON.Plane() }); fl.quaternion.setFromEuler(-Math.PI / 2, 0, 0); W.addBody(fl); }
const SIM_HZ = 120, REC_EVERY = 2, STAGGER = 0.075;
export const SIMDBG: { why: Record<string, number>; synth: number } = { why: {}, synth: 0 };

interface Pose { p: THREE.Vector3; q: THREE.Quaternion }
const cv3 = (v: CANNON.Vec3) => V3(v.x, v.y, v.z), cq = (q: CANNON.Quaternion) => new THREE.Quaternion(q.x, q.y, q.z, q.w);

function simOne(from: THREE.Vector3, target: THREE.Vector3, statics: Pose[], rel: number) {
  const half = new CANNON.Vec3(DIE / 2, DIE / 2, DIE / 2);
  const st = statics.map(k => { const b = new CANNON.Body({ mass: 0, material: M_DIE, shape: new CANNON.Box(half) }); b.position.set(k.p.x, k.p.y, k.p.z); b.quaternion.set(k.q.x, k.q.y, k.q.z, k.q.w); W.addBody(b); return b; });
  const b = new CANNON.Body({ mass: 1, material: M_DIE, shape: new CANNON.Box(half), linearDamping: 0.3, angularDamping: 0.42 });
  const p0 = from.clone().add(V3(R(-0.08, 0.08), R(-0.05, 0.05), R(-0.08, 0.08))); b.position.set(p0.x, p0.y, p0.z);
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R(0, TAU), R(0, TAU), R(0, TAU))); b.quaternion.set(q0.x, q0.y, q0.z, q0.w);
  const T = R(0.42, 0.52);
  b.velocity.set(((target.x - p0.x) / T) * 0.82, (DIE / 2 - p0.y) / T + 15 * T, ((target.z - p0.z) / T) * 0.82);
  b.angularVelocity.set(R(-16, 16), R(-9, 9), R(-16, 16));
  const rec = { rel, f: [] as number[], impacts: [] as Array<{ t: number; v: number }>, quiet: 0, done: false, endT: 0, t: 0 };
  b.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 1.2) rec.impacts.push({ t: rec.t, v }); });
  W.addBody(b);
  const dt = 1 / SIM_HZ; let step = 0;
  while (rec.t < 1.5) {
    W.step(dt); rec.t += dt; step++;
    if (step % REC_EVERY === 0) rec.f.push(b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const sp = b.velocity.length() + b.angularVelocity.length() * 0.25;
    if (sp < 0.18 && b.position.y < DIE * 0.62) rec.quiet += dt; else rec.quiet = 0;
    if (rec.quiet > 0.1) { rec.done = true; rec.endT = rec.t; break; }
  }
  const fin: Pose = { p: cv3(b.position), q: cq(b.quaternion) };
  W.removeBody(b); for (const x of st) W.removeBody(x);
  const why = SIMDBG.why; let score = 0;
  const al = topFaceOf(fin.q).align; if (al < 0.992) { score += 10 + (1 - al) * 100; why.tilt = (why.tilt || 0) + 1; }
  if (!inField(fin.p.x, fin.p.z, 0.2)) { score += 8; why.out = (why.out || 0) + 1; }
  if (!rec.done || rec.endT > 1.35) { score += 4; why.slow = (why.slow || 0) + 1; }
  if (fin.p.y > DIE * 0.56) { score += 10; why.high = (why.high || 0) + 1; }
  for (const k of statics) if (Math.hypot(fin.p.x - k.p.x, fin.p.z - k.p.z) < 0.95) { score += 6; why.close = (why.close || 0) + 1; }
  return { rec, fin, score };
}

/** Fallback when no simulated throw is clean: a hand-made arc with two small hops that ends flat on the freest spot. */
function synthThrow(from: THREE.Vector3, occupied: Pose[], rel: number) {
  let tg = V3(), bd = -1;
  for (let i = 0; i < 80; i++) { const c = V3(R(FIELD.x0 + 0.5, FIELD.x1 - 0.5), 0, R(FIELD.z0 + 0.5, FIELD.z1 - 0.5)); const d = Math.min(9, ...occupied.map(q => Math.hypot(q.p.x - c.x, q.p.z - c.z))); if (d > bd) { bd = d; tg = c; } if (d > 1.1) break; }
  const qEnd = snapFlat(new THREE.Quaternion().setFromEuler(new THREE.Euler(R(0, TAU), R(0, TAU), R(0, TAU))), Math.floor(R(0, 6)));
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R(0, TAU), R(0, TAU), R(0, TAU)));
  const rec = { rel, f: [] as number[], impacts: [] as Array<{ t: number; v: number }>, done: true };
  const N = 54, hz = SIM_HZ / REC_EVERY, end = V3(tg.x, DIE / 2, tg.z), land1 = from.clone().lerp(end, 0.78).setY(DIE / 2), land2 = from.clone().lerp(end, 0.93).setY(DIE / 2);
  const ax = V3(R(-1, 1), R(-0.3, 0.3), R(-1, 1)).normalize(), qq = new THREE.Quaternion();
  for (let i = 0; i <= N; i++) {
    const t = i / N; let p: THREE.Vector3;
    if (t < 0.55) { const k = t / 0.55; p = from.clone().lerp(land1, k); p.y = lerp(from.y, DIE / 2, k) + Math.sin(k * Math.PI) * 0.9; }
    else if (t < 0.78) { const k = (t - 0.55) / 0.23; p = land1.clone().lerp(land2, k); p.y = DIE / 2 + Math.sin(k * Math.PI) * 0.28; }
    else { const k = (t - 0.78) / 0.22; p = land2.clone().lerp(end, ease.outCubic(k)); p.y = DIE / 2 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.07; }
    qq.setFromAxisAngle(ax, (1 - ease.outCubic(t)) * TAU * 1.6);
    const q = q0.clone().slerp(qEnd, ease.inOut(Math.min(1, t * 1.15))).premultiply(qq); if (t > 0.97) q.copy(qEnd);
    rec.f.push(p.x, p.y, p.z, q.x, q.y, q.z, q.w);
  }
  rec.impacts.push({ t: (0.55 * N) / hz, v: 6 }, { t: (0.78 * N) / hz, v: 2.5 });
  return { rec, fin: { p: end, q: qEnd }, score: 0 };
}

/** Simulate n throws from `from` against the dice already resting (`kept`). Each track ends with an eased glide to an exactly flat pose. */
export function simThrow(n: number, kept: Pose[], from: THREE.Vector3): ThrowRec[] {
  const occupied = kept.map(k => ({ p: k.p.clone(), q: k.q.clone() })), out: ThrowRec[] = [];
  for (let k = 0; k < n; k++) {
    let best: ReturnType<typeof simOne> | ReturnType<typeof synthThrow> | null = null;
    for (let att = 0; att < 28; att++) {
      let tg: THREE.Vector3 | null = null;
      for (let tries = 0; tries < 60; tries++) { const c = V3(R(FIELD.x0 + 0.5, FIELD.x1 - 0.5), 0, R(FIELD.z0 + 0.5, FIELD.z1 - 0.5)); if (occupied.every(q => Math.hypot(q.p.x - c.x, q.p.z - c.z) > 1.05)) { tg = c; break; } }
      if (!tg) tg = V3(lerp(FIELD.x0, FIELD.x1, R(0.3, 0.7)), 0, lerp(FIELD.z0, FIELD.z1, R(0.3, 0.7)));
      const res = simOne(from, tg, occupied, k * STAGGER);
      if (!best || res.score < best.score) best = res; if (res.score === 0) break;
    }
    if (!best || best.score > 0) { SIMDBG.synth++; best = synthThrow(from, occupied, k * STAGGER); }
    const f = best.fin, top = topFaceOf(f.q).i, qEnd = snapFlat(f.q, top);
    const pEnd = f.p.clone(); pEnd.y = DIE / 2;
    pEnd.x = Math.min(FIELD.x1 - 0.3, Math.max(FIELD.x0 + 0.3, pEnd.x)); pEnd.z = Math.min(FIELD.z1 - 0.3, Math.max(FIELD.z0 + 0.3, pEnd.z));
    const r = best.rec, steps = 9, qs = new THREE.Quaternion();
    for (let i = 1; i <= steps; i++) { const e = ease.inOut(i / steps); qs.copy(f.q).slerp(qEnd, e); const pp = f.p.clone().lerp(pEnd, e); r.f.push(pp.x, pp.y, pp.z, qs.x, qs.y, qs.z, qs.w); }
    out.push({ rel: r.rel, f: r.f, impacts: r.impacts, top, qEnd, pEnd, dur: r.f.length / 7 / (SIM_HZ / REC_EVERY) });
    occupied.push({ p: pEnd.clone(), q: qEnd.clone() });
  }
  return out;
}

/** Start a recorded throw: renumber faces so `value` lands on top (upright for `eye`), then play the track from now. */
export function playThrow(d: Die3D, rec: ThrowRec, value: number, eye: THREE.Vector3, rate = 1) {
  d.setValue(value, rec.top, uprightTurns(rec.qEnd, rec.top, rec.pEnd, eye));
  d.mode = 'play'; d.play = { rec, t0: clock.time, ii: 0, rate }; d.root.visible = false; d.root.scale.setScalar(1);
  d.home.copy(rec.pEnd); d.homeQ.copy(rec.qEnd); d.lift = 0; d.liftT = 0; d.glow = 0;
}

/** QA: the face pointing up at rest equals the die's value (CLAUDE.md history item). */
export function restFaceOk(d: Die3D) { const t = faceToward(d.homeQ, UP); return d.faceVals[t.i] === d.value && t.align > 0.999; }
export { FACE_N };
