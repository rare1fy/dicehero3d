// The drag-aim arrow (UX_V3 §3, done the Hearthstone way): a quadratic arc from the play button to the finger / enemy, filled with
// V-shaped chevrons placed at a FIXED arc-length pitch (so a short drag shows few chevrons, a long one many, and the spacing never
// squeezes), all flowing from the button toward the finger at a constant speed (one pitch per FLOW s), the first two near the button
// fading in smaller. A separate arrowhead sits on the end, turned to the end tangent; over a valid enemy (`hot`) the head snaps there,
// turns hot red with a stepped glow; over a taunt-protected enemy (`blocked`) the whole arrow greys out and a padlock hangs on the head.
// All pieces are extruded pixel art (1 voxel = 1 art pixel = GRID.uc CSS px, see arrowParts.ts); the chevrons are one InstancedMesh.
// Curvature grows with distance (near = flatter, far = rounder): the control point is lifted by dist × c, c rising with dist, capped.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { GRID } from '../../ui3d/pixelGrid';
import type { PixModel } from '../../ui3d/pixMesh';
import { ARROW_PAL, HEAD_PAL, chevronPix, headPix, headW, headGlow, lockPix, setGlow } from './arrowParts';

type Aim = { x0: number; y0: number; x1: number; y1: number; hot: boolean; blocked?: boolean };
/** chevrons max (draw cost is one instanced call either way) */
const MAX = 40;
/** pitch between chevrons (art px) and the flow: one pitch per FLOW seconds */
const PITCH = 10, FLOW = 0.15;
/** arc-length table resolution */
const NS = 48;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class AimArrow {
  /** x0,y0 → x1,y1 in CSS px; hot = over a valid target; blocked = over a taunt-protected enemy */
  a: Aim | null = null;
  /** HUD layout scale (CSS px per reference px), set by the HUD */
  k = 1;
  private t = 0; private grow = 0; private fire = 0; private last: Aim | null = null; private wasHot = false; private wasBlocked = false; private pop = 0; private lockPop = 0;
  private chev: PixModel; private inst: THREE.InstancedMesh; private head: PixModel; private headG = new THREE.Group(); private glow: THREE.Mesh; private lock: PixModel; private lockG = new THREE.Group();
  private pal: 'idle' | 'hot' | 'blocked' | '' = '';
  private lut = new Float32Array(NS + 1); private P0 = new THREE.Vector2(); private C = new THREE.Vector2(); private P1 = new THREE.Vector2();
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private qz = new THREE.Quaternion(); private sv = new THREE.Vector3(); private pv = new THREE.Vector3(); private col = new THREE.Color(); private Z = new THREE.Vector3(0, 0, 1);
  private v2a = new THREE.Vector2(); private v2b = new THREE.Vector2(); private v2c = new THREE.Vector2();
  constructor(private L: UiLayer) {
    this.chev = chevronPix(ARROW_PAL.idle);
    const G = this.chev.groups[0];
    this.inst = new THREE.InstancedMesh(G.mesh.geometry, G.mat, MAX);
    this.inst.frustumCulled = false; this.inst.renderOrder = 41; this.inst.userData.noTilt = true; this.inst.count = 0;
    for (let i = 0; i < MAX; i++) this.inst.setColorAt(i, this.col.setRGB(1, 1, 1));
    L.scene.add(this.inst);
    this.head = headPix(HEAD_PAL.idle); this.glow = headGlow(3); this.glow.position.z = -0.5; this.glow.renderOrder = 41;
    this.headG.add(this.glow, this.head); this.headG.visible = false; this.headG.renderOrder = 42; this.headG.userData.noTilt = true; L.scene.add(this.headG);
    this.lock = lockPix(); this.lockG.add(this.lock); this.lockG.visible = false; this.lockG.renderOrder = 43; this.lockG.userData.noTilt = true; L.scene.add(this.lockG);
  }
  private bez(t: number, out: THREE.Vector2) {
    const u = 1 - t, A = this.P0, C = this.C, B = this.P1;
    return out.set(u * u * A.x + 2 * u * t * C.x + t * t * B.x, u * u * A.y + 2 * u * t * C.y + t * t * B.y);
  }
  private tan(t: number, out: THREE.Vector2) {
    const A = this.P0, C = this.C, B = this.P1;
    return out.set(2 * (1 - t) * (C.x - A.x) + 2 * t * (B.x - C.x), 2 * (1 - t) * (C.y - A.y) + 2 * t * (B.y - C.y));
  }
  /** arc length s (CSS px) → curve parameter t */
  private tAt(s: number) {
    const lut = this.lut; if (s <= 0) return 0; if (s >= lut[NS]) return 1;
    let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut[m] < s) lo = m; else hi = m; }
    return (lo + (s - lut[lo]) / Math.max(1e-6, lut[hi] - lut[lo])) / NS;
  }
  private setPal(p: 'idle' | 'hot' | 'blocked') {
    if (p === this.pal) return; this.pal = p;
    this.chev.setPal(0, ARROW_PAL[p]);
    this.head.setPal(0, HEAD_PAL[p]);
  }
  private hide() { this.inst.count = 0; this.inst.visible = false; this.headG.visible = this.lockG.visible = false; }

  update(dt: number) {
    dt = Math.min(dt, 0.05); this.t += dt; const L = this.L, A = this.a;
    // lifecycle: grow out on a new aim; on release, a hot release "fires" (the tail runs into the head), anything else retracts
    if (A) {
      if (!this.last) { this.grow = 0; this.fire = 0; }
      this.last = { ...A }; this.grow = Math.min(1, this.grow + dt / 0.14); this.fire = 0;
    } else if (this.last) {
      if (this.wasHot && !this.wasBlocked) { this.fire += dt / 0.12; if (this.fire >= 1) this.last = null; }
      else { this.grow -= dt / 0.1; if (this.grow <= 0) this.last = null; }
    }
    const S = this.last; if (!S) { this.hide(); this.wasHot = this.wasBlocked = false; return; }
    const hot = A ? A.hot && !A.blocked : this.wasHot, blocked = A ? !!A.blocked : this.wasBlocked;
    if (A && hot && !this.wasHot) this.pop = 1;
    if (A && blocked && !this.wasBlocked) this.lockPop = 1;
    if (A) { this.wasHot = hot; this.wasBlocked = blocked; }
    this.pop = Math.max(0, this.pop - dt / 0.16); this.lockPop = Math.max(0, this.lockPop - dt / 0.2);
    this.setPal(blocked ? 'blocked' : hot ? 'hot' : 'idle');

    // the curve: lift the control point by dist × c (c 0.1 near → 0.3 far, capped), nudged back toward the start so the arc rises off
    // the button first and sweeps into the target
    const k = this.k, u = GRID.uc, dx = S.x1 - S.x0, dy = S.y1 - S.y0, dist = Math.hypot(dx, dy);
    const bend = Math.min(190 * k, dist * (0.1 + 0.2 * smooth(60 * k, 520 * k, dist)));
    this.P0.set(S.x0, S.y0); this.P1.set(S.x1, S.y1); this.C.set((S.x0 + S.x1) / 2 - dx * 0.16, (S.y0 + S.y1) / 2 - bend);
    const p = this.v2a, q = this.v2b, tg = this.v2c;
    this.lut[0] = 0; this.bez(0, q);
    for (let i = 1; i <= NS; i++) { this.bez(i / NS, p); this.lut[i] = this.lut[i - 1] + p.distanceTo(q); q.copy(p); }
    const total = this.lut[NS], ge = 1 - (1 - Math.max(0, this.grow)) ** 3, end = total * ge, tail = total * this.fire * this.fire;
    // depth: above the button faces, rising a little toward the camera mid-arc (the UI camera shows more of the sides there)
    const zAt = (s: number) => L.px((34 + 26 * Math.sin(Math.PI * Math.min(1, s / Math.max(1, total)))) * k);

    // the head: tip on the end point, turned along the end tangent
    const hw = headW() * u, tEnd = this.tAt(end); this.bez(tEnd, p); this.tan(Math.max(0.001, tEnd), tg);
    const ang = Math.atan2(-tg.y, tg.x), cx = Math.cos(ang), cy = -Math.sin(ang);   // screen-space unit tangent (y down)
    const hx = p.x - cx * hw * 0.5, hy = p.y - cy * hw * 0.5, hz = zAt(end) + L.px(3 * u);
    const hs = 1 + 0.22 * Math.sin(Math.PI * this.pop) + (this.fire > 0 ? 0.3 * this.fire : 0);
    L.at(hx, hy, hz, this.headG.position); this.headG.scale.setScalar(L.px(u, hz) * hs * (this.grow < 1 ? 0.6 + 0.4 * ge : 1));
    L.tiltAt(hx, hy, 0, this.q); this.qz.setFromAxisAngle(this.Z, ang); this.headG.quaternion.copy(this.q).multiply(this.qz);
    this.headG.visible = ge > 0.05 && this.fire < 0.95;
    this.glow.visible = hot && !blocked; if (this.glow.visible) setGlow(this.glow, 0xff5a1a, 1.05 + 0.3 * Math.sin(this.t * 9) + 0.8 * this.pop);

    // the padlock above the head (blocked), upright
    this.lockG.visible = blocked && this.headG.visible;
    if (this.lockG.visible) {
      const lx = p.x - cx * hw * 0.5, ly = p.y - cy * hw * 0.5 - 15 * u, lz = hz + L.px(6 * u), ls = 1 + 0.3 * Math.sin(Math.PI * this.lockPop);
      L.at(lx, ly + Math.sin(this.t * 3) * u * 0.5, lz, this.lockG.position); this.lockG.scale.setScalar(L.px(u, lz) * ls);
      L.tiltAt(lx, ly, 0, this.q); this.qz.setFromAxisAngle(this.Z, Math.sin(Math.PI * this.lockPop) * 0.25); this.lockG.quaternion.copy(this.q).multiply(this.qz);
    }

    // the chevrons: fixed pitch along the arc, flowing button → finger; they slide under the head and vanish there
    const P = PITCH * u, phase = ((this.t / FLOW) % 1) * P, sMax = end - hw * 0.5 - 1 * u, fadeLen = 2 * P;
    let n = 0;
    const first = Math.max(0, Math.ceil((sMax - phase) / P) - MAX + 1);   // too long: drop the oldest near the button
    for (let i = first; n < MAX; i++) {
      const s = phase + i * P; if (s > sMax) break; if (s < tail) continue;
      const f = Math.min(1, s / fadeLen), sz = 0.55 + 0.45 * f;
      const t = this.tAt(s); this.bez(t, p); this.tan(Math.max(0.001, t), tg);
      const z = zAt(s), a = Math.atan2(-tg.y, tg.x);
      L.at(p.x, p.y, z, this.pv); L.tiltAt(p.x, p.y, 0, this.q); this.qz.setFromAxisAngle(this.Z, a); this.q.multiply(this.qz);
      this.sv.setScalar(L.px(u, z) * sz); this.m4.compose(this.pv, this.q, this.sv); this.inst.setMatrixAt(n, this.m4);
      this.inst.setColorAt(n, this.col.setScalar(0.3 + 0.7 * f)); n++;
    }
    this.inst.count = n; this.inst.visible = n > 0; this.inst.instanceMatrix.needsUpdate = true; if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
  }
}
