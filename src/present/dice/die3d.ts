// A die as a real object (v5 02e_dice.js): sharp cube with a painted 6-face atlas, emissive numerals, identity parts, rarity trim,
// a back-face glow shell for selection, and the motion modes the battle uses:
//   hidden → play (recorded throw playback) → rest (on the field; lifts and tilts toward the camera when selected) ⇄ fly (tweens)
import * as THREE from 'three';
import { scene, camera, canvasTex, V3, C, R, TAU } from '../engine/world';
import { anim, ease, lerp, damp, clock } from '../engine/clock';
import { dieDef } from '../../core/data';
import { paintFace, famKey, FAM } from './style';
import { DIE, sigOf, extra, TRIM_MAT, trimGeometry, type DieFxKind } from './signature';
import { dieGeometry, assignFaceValues } from './faces';

export const DT = 48;   // texels per face (one texel ~ one art pixel at the battle view)
const GEO = dieGeometry(DIE), SHELL = dieGeometry(DIE * 1.16);
export type DieMode = 'hidden' | 'play' | 'rest' | 'fly' | 'present' | 'queue' | 'gone';

export interface ThrowRec { rel: number; f: number[]; impacts: Array<{ t: number; v: number }>; top: number; qEnd: THREE.Quaternion; pEnd: THREE.Vector3; dur: number }

export const DICE3D = new Set<Die3D>();
let seq = 1;

export class Die3D {
  readonly id = seq++;
  readonly root = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly outline: THREE.Mesh;
  readonly mat: THREE.MeshStandardMaterial;
  readonly omat: THREE.MeshBasicMaterial;
  readonly tex: THREE.CanvasTexture; readonly etex: THREE.CanvasTexture;
  readonly seed: number;
  faceVals: number[]; topIdx = 2; topTurns = 0;
  mode: DieMode = 'hidden';
  play: { rec: ThrowRec; t0: number; ii: number } | null = null;
  tween: object | null = null;
  home = V3(); homeQ = new THREE.Quaternion();
  lift = 0; liftT = 0; sepY = 0; dodge = V3(); dodgeT = V3();
  glow = 0; glowCol = C(0xffd860);
  spinPart: THREE.Object3D | null = null;
  /** rules-layer die uid this model shows (null for gallery / queue pips) */
  uid: number | null = null;
  value = 1;

  constructor(readonly defId: string, o: { parent?: THREE.Object3D; T?: number } = {}) {
    const def = dieDef(defId), T = o.T || DT;
    this.faceVals = (def.faces.length === 6 ? def.faces : [1, 2, 3, 4, 5, 6]).slice();
    this.seed = (defId.length * 977 + this.id * 31) | 0;
    this.tex = canvasTex(T * 6, T, () => {}, { nearest: true }); this.etex = canvasTex(T * 6, T, () => {}, { nearest: true });
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, emissiveMap: this.etex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
    this.mesh = new THREE.Mesh(GEO, this.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.omat = new THREE.MeshBasicMaterial({ color: 0xffd860, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false });
    this.outline = new THREE.Mesh(SHELL, this.omat); this.outline.renderOrder = 2; this.outline.visible = false;
    this.root.add(this.mesh, this.outline);
    const sig = sigOf(defId);
    for (const k of sig.extras || []) { const X = extra(k), m = new THREE.Mesh(X.geo, X.mat); m.castShadow = true; this.root.add(m); if (sig.spin === k) this.spinPart = m; }
    const tr = FAM[famKey(defId)].gold ? 'legendary' : TRIM_MAT[def.rarity] && !(sig.extras || []).length ? def.rarity : null;
    if (tr) { const t = new THREE.Mesh(trimGeometry(), TRIM_MAT[tr]); t.castShadow = true; this.root.add(t); }
    (o.parent || scene).add(this.root); this.root.visible = false;
    this.paint(); DICE3D.add(this);
  }

  /** Repaint the atlas (after the faces were renumbered or the top tile turned). */
  paint() {
    const T = (this.tex.image as { height: number }).height;
    const g = this.tex.userData.canvas.getContext('2d') as CanvasRenderingContext2D, eg = this.etex.userData.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.faceVals.forEach((v, i) => {
      const turns = i === this.topIdx ? this.topTurns : 0, seed = this.seed * 13 + i;
      if (!turns) { paintFace(g, eg, i * T, T, v, this.defId, seed); return; }
      // paint into scratch tiles, then blit rotated by −turns·90° (counter-clockwise in texture space; see faces.turnedV)
      const tg = scratch(T, 0), te = scratch(T, 1); paintFace(tg.g, te.g, 0, T, v, this.defId, seed);
      for (const [ctx, src] of [[g, tg.c], [eg, te.c]] as const) { ctx.save(); ctx.translate(i * T + T / 2, T / 2); ctx.rotate(-turns * Math.PI / 2); ctx.drawImage(src, -T / 2, -T / 2, T, T); ctx.restore(); }
    });
    this.tex.needsUpdate = true; this.etex.needsUpdate = true;
    const F = FAM[famKey(this.defId)], m = this.mat;
    m.roughness = F.rough ?? 0.5; m.metalness = F.metal || 0; m.opacity = F.opacity || 1; m.transparent = (F.opacity || 1) < 1;
    m.emissiveIntensity = F.emis || F.glowPip ? 1.7 : 0; m.needsUpdate = true;
  }

  /** Put `value` on face `top`, painted upright for the viewer. */
  setValue(value: number, top: number, turns: number) {
    this.value = value; this.faceVals = assignFaceValues(dieDef(this.defId).faces, value, top); this.topIdx = top; this.topTurns = turns; this.paint();
  }

  fx(kind: DieFxKind) { sigOf(this.defId).fx(kind, this.root.getWorldPosition(V3())); }

  dispose() {
    this.root.parent?.remove(this.root); this.tex.dispose(); this.etex.dispose(); this.mat.dispose(); this.omat.dispose();
    DICE3D.delete(this); this.mode = 'gone';
  }
}

const scratches: Array<{ c: any; g: CanvasRenderingContext2D }> = [];
function scratch(T: number, i: number) {
  let s = scratches[i];
  if (!s || s.c.width !== T) { const t = canvasTex(T, T, () => {}); s = { c: t.userData.canvas, g: t.userData.canvas.getContext('2d') }; t.dispose(); scratches[i] = s; }
  s.g.clearRect(0, 0, T, T); return s;
}

/** Tween a die along an arc to a pose. o: q (end orientation), scale, arc height, turns (tumbles on the way), ease. */
export function flyDie(d: Die3D, to: THREE.Vector3, dur: number, o: { q?: THREE.Quaternion; scale?: number; arc?: number; turns?: number; ease?: (k: number) => number; trail?: (d: Die3D, k: number) => void } = {}) {
  d.mode = 'fly'; d.play = null; d.root.visible = true;
  const from = d.root.position.clone(), q0 = d.root.quaternion.clone(), q1 = o.q ? o.q.clone() : q0.clone();
  const s0 = d.root.scale.x, s1 = o.scale ?? s0, mid = from.clone().lerp(to, 0.5); mid.y = Math.max(from.y, to.y) + (o.arc ?? 0.8);
  const axis = V3(R(-1, 1), R(-0.3, 0.3), R(-1, 1)).normalize(), qs = new THREE.Quaternion(), tw = {}; d.tween = tw;
  return new Promise<void>(res => anim(dur, k => {
    if (d.tween !== tw) return;
    const e = (o.ease || ease.inOut)(k), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    d.root.position.set(from.x * a + mid.x * b + to.x * c, from.y * a + mid.y * b + to.y * c, from.z * a + mid.z * b + to.z * c);
    d.root.quaternion.slerpQuaternions(q0, q1, ease.outCubic(k));
    if (o.turns) { qs.setFromAxisAngle(axis, TAU * o.turns * (1 - ease.outCubic(k))); d.root.quaternion.premultiply(qs); }
    d.root.scale.setScalar(lerp(s0, s1, ease.outCubic(k)));
    o.trail?.(d, k);
  }, () => { if (d.tween === tw) d.tween = null; res(); }));
}

// ---- per-frame: playback of recorded throws, resting dice (lift / tilt / dodge / clearance), glow
const _pa = V3(), _pb = V3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), UP = V3(0, 1, 0);
export const SIM_FPS = 60;   // recorded frames per second (sim 120 Hz, every 2nd step)
export const throwHooks = { impact: (_d: Die3D, _v: number) => {}, landed: (_d: Die3D) => {} };

export function updateDice(dt: number, rdt: number) {
  for (const d of DICE3D) {
    if (d.mode === 'play' && d.play) {
      const P = d.play, rec = P.rec, t = clock.time - P.t0 - rec.rel, F = rec.f, nF = F.length / 7;
      if (t < 0) { d.root.visible = false; continue; }
      d.root.visible = true;
      const fi = t * SIM_FPS, i0 = Math.min(nF - 1, Math.floor(fi)), i1 = Math.min(nF - 1, i0 + 1), a = Math.min(1, fi - i0);
      _pa.set(F[i0 * 7], F[i0 * 7 + 1], F[i0 * 7 + 2]); _pb.set(F[i1 * 7], F[i1 * 7 + 1], F[i1 * 7 + 2]); d.root.position.lerpVectors(_pa, _pb, a);
      _qa.set(F[i0 * 7 + 3], F[i0 * 7 + 4], F[i0 * 7 + 5], F[i0 * 7 + 6]); _qb.set(F[i1 * 7 + 3], F[i1 * 7 + 4], F[i1 * 7 + 5], F[i1 * 7 + 6]); d.root.quaternion.slerpQuaternions(_qa, _qb, a);
      d.root.scale.setScalar(Math.min(1, 0.55 + t * 3));
      while (P.ii < rec.impacts.length && rec.impacts[P.ii].t <= t) throwHooks.impact(d, rec.impacts[P.ii++].v);
      if (fi >= nF - 1) { d.mode = 'rest'; d.play = null; d.root.position.copy(d.home); d.root.quaternion.copy(d.homeQ); d.liftT = 0; throwHooks.landed(d); }
    } else if (d.mode === 'rest') {
      d.liftT = lerp(d.liftT, d.lift, 1 - Math.exp(-14 * dt));
      d.dodge.lerp(d.dodgeT, 1 - Math.exp(-9 * dt));
      _pa.copy(d.home).add(d.dodge); _pa.y += d.liftT * 0.38;
      const tilt = _qa.setFromUnitVectors(UP, _pb.copy(camera.position).sub(d.root.position).normalize());
      _qb.identity().slerp(tilt, d.liftT * 0.6).multiply(d.homeQ);
      d.sepY = lerp(d.sepY, d.liftT > 0.02 ? clearance(d, _pa, _qb) : 0, 1 - Math.exp(-16 * dt)); _pa.y += d.sepY;
      d.root.position.lerp(_pa, 1 - Math.exp(-20 * dt)); d.root.quaternion.slerp(_qb, 1 - Math.exp(-14 * dt));
    }
    if (d.spinPart) d.spinPart.rotation.y += dt * (d.mode === 'rest' ? (d.glow ? 6 : 1.2) : 3);
    d.omat.opacity = damp(d.omat.opacity, d.glow ? 0.5 * Math.min(1, d.glow * 1.6) : 0, 12, rdt); d.omat.color.copy(d.glowCol); d.outline.visible = d.omat.opacity > 0.02;
    d.mat.emissive.setRGB(1, 1, 1);
    const F = FAM[famKey(d.defId)], base = F.emis || F.glowPip ? 1.7 : 0;
    d.mat.emissiveIntensity = base + d.glow * (0.16 + 0.06 * Math.sin(clock.rtime * 6)) * 2;
  }
}

// box-vs-box overlap test (corners, edge midpoints, face centres) — enough for dice-sized cubes; lifted dice rise until clear
const _cq = new THREE.Quaternion(), _cv = V3(), _cp = V3(), DPTS: number[][] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) DPTS.push([x, y, z]);
function ptsIn(pA: THREE.Vector3, qA: THREE.Quaternion, hA: number, pB: THREE.Vector3, qB: THREE.Quaternion, hB: number) {
  _cq.copy(qB).invert();
  for (const [x, y, z] of DPTS) { _cv.set(x * hA, y * hA, z * hA).applyQuaternion(qA).add(pA).sub(pB).applyQuaternion(_cq); if (Math.abs(_cv.x) < hB && Math.abs(_cv.y) < hB && Math.abs(_cv.z) < hB) return true; }
  return false;
}
export function boxesHit(pA: THREE.Vector3, qA: THREE.Quaternion, hA: number, pB: THREE.Vector3, qB: THREE.Quaternion, hB: number) {
  if (pA.distanceToSquared(pB) > (hA + hB) * (hA + hB) * 3.1) return false;
  return ptsIn(pA, qA, hA, pB, qB, hB) || ptsIn(pB, qB, hB, pA, qA, hA);
}
function clearance(d: Die3D, pos: THREE.Vector3, q: THREE.Quaternion) {
  const hA = DIE * 0.5 * d.root.scale.x * 1.05; let extraY = 0;
  for (let it = 0; it < 18; it++) {
    _cp.copy(pos); _cp.y += extraY; let hit = false;
    for (const o of DICE3D) {
      if (o === d || !o.root.visible || (o.mode !== 'rest' && o.mode !== 'play') || o.root.parent !== d.root.parent) continue;
      if (boxesHit(_cp, q, hA, o.root.position, o.root.quaternion, DIE * 0.5 * o.root.scale.x * 1.02)) { hit = true; break; }
    }
    if (!hit) return extraY; extraY += 0.06;
  }
  return extraY;
}
