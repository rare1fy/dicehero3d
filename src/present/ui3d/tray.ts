// 准备区漂浮骰子: next turn's N dice (3..6) float in the UI layer along the bottom of the screen, turning slowly and bobbing.
// earn(): a die is won — it pops out of a world point (a killed enemy) and arcs into a new slot while the others make room.
// launch(): the throw — every die leaves its UI pose and continues, as the same object, into the world: it is re-parented to the
// world scene at the pose that covers the same pixels (layer.uiToWorld), swoops down to the throw point and then plays a recorded
// throw from dice/throw.ts (the locked v5 physics), landing on the field or on a given point. Returned dice rest in mode 'rest'.
import * as THREE from 'three';
import { scene, V3, R } from '../engine/world';
import { ease, lerp, wait, animP } from '../engine/clock';
import { Die3D, SIM_FPS, type ThrowRec } from '../dice/die3d';
import { DIE } from '../dice/signature';
import { simThrow, playThrow, FIELD } from '../dice/throw';
import { presentQuat } from '../dice/faces';
import { UiLayer, uiToWorld, uiQuatToWorld, worldToUi } from './layer';
import { UiSparks } from './vox';
import { SPECIALS, type SuitSkin, type SpecialId } from './suitData';
import { cue } from '../../audio/cues';

export interface TrayDie { die: Die3D; special?: SpecialId; /** current px pose (x, y, size) */ x: number; y: number; s: number; z: number; ph: number; axis: THREE.Vector3; busy: boolean; showValue: number | null }
export interface LaunchOpts {
  /** landing points on the field (one per die; missing = anywhere on FIELD) */
  targets?: Array<THREE.Vector3 | null | undefined>;
  /** dice already resting on the field (the throw avoids them) */
  kept?: Array<{ p: THREE.Vector3; q: THREE.Quaternion }>;
  /** where the recorded throw starts (default: above the near edge of FIELD) */
  from?: THREE.Vector3;
  /** viewer used to paint landed faces upright (the battle camera position) */
  eye: THREE.Vector3;
  /** seconds between dice */
  stagger?: number;
  /** hand-over distance in front of the camera */
  dist?: number;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export class DiceTray {
  dice: TrayDie[] = [];
  /** the dice of the throw in progress (world dice, filled by launch) */
  flying: Die3D[] = [];
  /** die size on screen (CSS px) and the row's centre line (px from the bottom) */
  sizePx = 70; bottom = 64;
  sparks: UiSparks;
  constructor(private L: UiLayer, public skin: SuitSkin, o: { sizePx?: number; bottom?: number } = {}) {
    if (o.sizePx) this.sizePx = o.sizePx; if (o.bottom) this.bottom = o.bottom;
    this.sparks = new UiSparks(L.scene, 160);
  }
  get count() { return this.dice.length; }
  private skinFor(sp?: SpecialId): SuitSkin { return { ...this.skin, special: sp }; }
  /** where slot i of n sits (CSS px) */
  slotPx(i: number, n = this.dice.length) { const gap = this.sizePx * 1.4; return { x: this.L.w / 2 + (i - (n - 1) / 2) * gap, y: this.L.h - this.bottom }; }

  /** switch face scheme / class for every tray die */
  setSkin(skin: SuitSkin) { this.skin = skin; for (const t of this.dice) t.die.setSuit(this.skinFor(t.special)); }

  private make(sp?: SpecialId) {
    const d = new Die3D('standard', { parent: this.L.scene, suit: this.skinFor(sp) }); d.mode = 'queue'; d.root.visible = true;
    d.mesh.castShadow = false; d.mesh.receiveShadow = false;
    if (sp) { d.glow = 0.6; d.glowCol.set(SPECIALS[sp].glow); }
    return d;
  }
  /** set the tray to n dice at once (turn start); specials[i] marks special dice. They pop in one by one. */
  fill(n: number, specials: Array<SpecialId | undefined> = []) {
    this.clear();
    for (let i = 0; i < n; i++) {
      const d = this.make(specials[i]), p = this.slotPx(i, n);
      const t: TrayDie = { die: d, special: specials[i], x: p.x, y: p.y + 40, s: 0, z: 0, ph: R(0, 6.28), axis: V3(R(0.4, 1), R(0.6, 1), R(-0.3, 0.3)).normalize(), busy: true, showValue: null };
      this.dice.push(t);
      void animP(0.32, k => { t.s = this.sizePx * ease.outBack(k); t.y = p.y + 40 * (1 - ease.outCubic(k)); }).then(() => { t.busy = false; });
      t.s = 0; void wait(i * 0.07).then(() => cue('click', 0.3));
    }
  }
  clear() { for (const t of this.dice) t.die.dispose(); this.dice = []; }

  /** a die is won: it pops out of `from` (world) and arcs into a new slot. Resolves when it has settled. */
  async earn(from: THREE.Vector3, special?: SpecialId) {
    if (this.dice.length >= 6) return null;
    const sp = worldToUi(from), d = this.make(special);
    const t: TrayDie = { die: d, special, x: sp.x, y: sp.y, s: 0, z: 0, ph: R(0, 6.28), axis: V3(R(0.4, 1), R(0.6, 1), R(-0.3, 0.3)).normalize(), busy: true, showValue: null };
    this.dice.push(t); cue('reveal', 0.6);
    const n = this.dice.length, end = this.slotPx(n - 1, n), x0 = sp.x, y0 = sp.y, cx = lerp(x0, end.x, 0.4), cy = Math.min(y0, end.y) - 180;
    const glow = special ? SPECIALS[special].glow : '#ffe08a';
    this.sparks.burst(this.L.at(x0, y0, 2), 16, this.L.px(240), this.L.px(5), glow, { life: 0.45 });
    let lastX = x0, lastY = y0;
    await animP(0.7, k => {
      const e = ease.inOut(k), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
      t.x = x0 * a + cx * b + end.x * c; t.y = y0 * a + cy * b + end.y * c; t.s = this.sizePx * (k < 0.25 ? ease.outBack(k / 0.25) * 1.25 : lerp(1.25, 1, ease.outCubic((k - 0.25) / 0.75)));
      for (let i = 0; i < 2; i++) this.sparks.emit(this.L.at(lerp(lastX, t.x, i / 2), lerp(lastY, t.y, i / 2), 1), V3(0, 0, 0), this.L.px(R(3, 6)), glow, 0.35);
      lastX = t.x; lastY = t.y;
    });
    this.sparks.burst(this.L.at(end.x, end.y, 2), 14, this.L.px(160), this.L.px(5), glow, { life: 0.4 }); cue('count', 0.8);
    t.busy = false; return t;
  }

  /** remove the last die (or index i) with a shrink-out */
  async drop(i = this.dice.length - 1) {
    const t = this.dice[i]; if (!t) return; t.busy = true; this.dice.splice(i, 1);
    await animP(0.22, k => { t.s = this.sizePx * (1 - ease.inCubic(k)); }); t.die.dispose();
  }

  /** show a value face toward the camera on tray die i (e.g. a kept / preset die); null = free tumble */
  showValue(i: number, v: number | null) { const t = this.dice[i]; if (!t) return; t.showValue = v; if (v != null) t.die.setValue(v, 4, 0); }

  /**
   * The throw: every tray die flies from its UI pose into the world and lands. values[i] is the rolled value for die i.
   * Resolves with the world dice once all have landed (they rest on the field in mode 'rest', ready for selection).
   */
  async launch(values: number[], o: LaunchOpts): Promise<Die3D[]> {
    const ts = this.dice.splice(0, this.dice.length), out: Die3D[] = [], kept = (o.kept || []).map(k => ({ p: k.p.clone(), q: k.q.clone() }));
    this.flying = out;
    const from = o.from || V3(lerp(FIELD.x0, FIELD.x1, 0.35), 2.4, FIELD.z1 + 0.9), st = o.stagger ?? 0.07, dist = o.dist ?? 5;
    // pre-simulate every die (targets: a small FIELD around the point; restored after)
    const recs: ThrowRec[] = [], saved = { ...FIELD };
    ts.forEach((_, i) => {
      const tg = o.targets?.[i];
      if (tg) Object.assign(FIELD, { x0: tg.x - 0.82, x1: tg.x + 0.82, z0: tg.z - 0.82, z1: tg.z + 0.82 });
      const r = simThrow(1, kept, from)[0]; Object.assign(FIELD, saved);
      kept.push({ p: r.pEnd.clone(), q: r.qEnd.clone() }); recs.push(r);
    });
    cue('whoosh', 0.8);
    let longest = 0;
    ts.forEach((t, i) => {
      const d = t.die, rec = recs[i];
      const go = () => {
        // hand-over: the world pose covering the same pixels, same on-screen orientation
        const h = uiToWorld(t.x, t.y, t.s, DIE, dist), qW = uiQuatToWorld(d.root.quaternion);
        scene.add(d.root); d.root.position.copy(h.pos); d.root.quaternion.copy(qW); d.root.scale.setScalar(h.scale);
        d.mesh.castShadow = true;
        prependLeg(rec, h.pos, qW, h.scale);
        rec.rel = 0;
        playThrow(d, rec, values[i] ?? 1, o.eye);
        this.sparks.burst(this.L.at(t.x, t.y, 1), 10, this.L.px(200), this.L.px(5), t.special ? SPECIALS[t.special].glow : '#fff0c0', { life: 0.35 });
      };
      const delay = i * st; longest = Math.max(longest, delay + rec.dur + (LEG_S));
      if (delay <= 0) go(); else void wait(delay).then(go);
      out.push(d);
    });
    await wait(longest + 0.05);
    return out;
  }

  /** CSS px hit test: index of the tray die under (x, y), or −1 */
  hit(x: number, y: number) { for (let i = 0; i < this.dice.length; i++) { const t = this.dice[i]; if (Math.hypot(t.x - x, t.y - y) < t.s * 0.62) return i; } return -1; }

  update(dt: number, time: number) {
    const n = this.dice.length;
    this.dice.forEach((t, i) => {
      if (!t.busy) { const p = this.slotPx(i, n), k = 1 - Math.exp(-10 * dt); t.x = lerp(t.x, p.x, k); t.y = lerp(t.y, p.y, k); t.s = lerp(t.s, this.sizePx, k); }
      const d = t.die, bob = Math.sin(time * 1.7 + t.ph) * 5;
      this.L.at(t.x, t.y + bob, t.z, d.root.position); d.root.scale.setScalar(Math.max(1e-4, this.L.px(t.s, t.z) / DIE));
      if (t.showValue != null) {   // the value face toward the camera, swaying a little
        _q.copy(presentQuat(d.topIdx, d.topTurns, _q2.identity()));
        d.root.quaternion.copy(_q).premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(time * 1.3 + t.ph) * 0.18 - 0.2, Math.sin(time * 0.9 + t.ph) * 0.35, 0)));
      } else d.root.quaternion.setFromAxisAngle(t.axis, time * 0.55 + t.ph).premultiply(_q.setFromEuler(new THREE.Euler(-0.35, 0, 0)));
    });
    this.sparks.update(dt);
  }
}

// ---------------------------------------------------------------- the hand-over leg in front of a recorded throw
const LEG_S = 0.26;
/** Prepend a swoop from the hand-over pose to the recorded throw's first frame (60 Hz frames), with a scale ease (rec.s0 → 1). */
function prependLeg(rec: ThrowRec, p0: THREE.Vector3, q0: THREE.Quaternion, s0: number) {
  const f = rec.f, p1 = V3(f[0], f[1], f[2]), q1 = new THREE.Quaternion(f[3], f[4], f[5], f[6]);
  const n = Math.round(LEG_S * SIM_FPS), mid = p0.clone().lerp(p1, 0.55); mid.y = Math.max(p0.y, p1.y) * 0.85 + 0.6;
  const pre: number[] = [], q = new THREE.Quaternion(), spin = new THREE.Quaternion(), ax = V3(R(-1, 1), 0.3, R(-1, 1)).normalize();
  for (let i = 0; i < n; i++) {
    const k = i / n, e = ease.inCubic(k) * 0.6 + k * 0.4, a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    q.copy(q0).slerp(q1, ease.inOut(k)); spin.setFromAxisAngle(ax, Math.sin(k * Math.PI) * 1.4); q.premultiply(spin);
    pre.push(p0.x * a + mid.x * b + p1.x * c, p0.y * a + mid.y * b + p1.y * c, p0.z * a + mid.z * b + p1.z * c, q.x, q.y, q.z, q.w);
  }
  rec.f = pre.concat(f);
  const dt = n / SIM_FPS; for (const im of rec.impacts) im.t += dt;
  rec.dur += dt; rec.s0 = s0; rec.sT = dt;
}
