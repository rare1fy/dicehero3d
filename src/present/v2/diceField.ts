// R6S 骰场 (UX_V3 §1b): a fixed stone dais on the ground in front of the hero and the enemies, nearer the camera, with six landing
// sockets on a smile arc (the middle two a little nearer = lower on screen). Dice only ever come to rest in a socket, so they never
// overlap each other or the characters. The dais has a centre c (ground) and a scale s chosen by the camera fit (battleCamera.ts) so a
// die is ~80 reference px on screen at any distance.
// Physics stays the locked v5 throw at unit size: every throw is simulated in a "unit frame" (world = c + (u − c)·s) and a late
// updater maps the playing track into the world, easing the scale in after the UI → world hand-over. Resting dice remember their
// local offset, so a reframe (summon, big death) carries the dais and the dice on it together.
import * as THREE from 'three';
import { scene, V3, onLateUpdate } from '../engine/world';
import { clock, animP, ease, lerp } from '../engine/clock';
import { toon } from '../look/toon';
import { DICE3D, type Die3D } from '../dice/die3d';

/** unit-size local slot offsets from c: 1.3 apart (≥ 1.6 die widths → ≥ 120 ref px centre to centre at 80 px dice) */
const N = 6, GAP = 1.12, SMILE = 0.3;
/** three sockets each side of the centre line, with a lane open in the middle so the hero and the enemy straight across from him
 *  keep a clear line (user 2026-11-13: hero on the centre line, 「站位还是太斜了」) */
const XS = [-3.5, -2.35, -1.2, 1.2, 2.35, 3.5];
export const SLOT_LOCAL = XS.map(x => { const u = x / 3.5; return V3(x * GAP / 1.15, 0, SMILE * (1 - u * u) - SMILE * 0.45); });
/** which slots n dice take first: the most central */
const PREF = [2, 3, 1, 4, 0, 5];

export class DiceField {
  root = new THREE.Group(); c = V3(); s = 1;
  private local = new WeakMap<Die3D, THREE.Vector3>(); private slotOf = new WeakMap<Die3D, number>();
  private flying = new Set<Die3D>(); private sockets: THREE.Mesh[] = []; private runeMat: THREE.MeshBasicMaterial; private t = 0;
  constructor() {
    this.root.name = 'diceField';
    const stone = toon(0xb4ab98), edge = toon(0x857c6c), inset = toon(0x9b927f), seam = toon(0x6a6256);
    this.runeMat = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false });
    const W = (N - 1) * GAP + 1.7, D = 1.95, cz = -0.06;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; this.root.add(b); return b; };
    // a low two-step dais: a darker plinth, the pale top slab, seams between the six stones
    box(W + 0.24, 0.05, D + 0.24, 0, 0.025, cz, edge);
    box(W, 0.1, D, 0, 0.05, cz, stone);
    for (let i = 1; i < N; i++) box(0.04, 0.012, D - 0.1, (i - N / 2) * GAP, 0.104, cz, seam);
    // the sockets: a recessed square with a thin dark frame and four warm rune studs at the corners
    SLOT_LOCAL.forEach(p => {
      box(1.06, 0.012, 1.06, p.x, 0.103, p.z, seam);
      this.sockets.push(box(0.94, 0.014, 0.94, p.x, 0.106, p.z, inset));
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.09, 0.02, 0.09, p.x + dx * 0.44, 0.112, p.z + dz * 0.44, this.runeMat);
    });
    this.root.visible = false; scene.add(this.root);
    onLateUpdate(() => this.late());
  }
  /** set the transform at once */
  place(c: THREE.Vector3, s: number) { this.c.copy(c).setY(0); this.s = s; this.apply(); }
  private apply() { this.root.position.copy(this.c); this.root.scale.setScalar(this.s); }
  /** the sockets are invisible (user: 「场景里不要丢个一个骰子的台面」); the dais meshes stay built but hidden for debugging (__dh) */
  show(on: boolean) { this.active = on; this.root.visible = false; }
  private active = false;
  /** world position of slot i (die centre) */
  slot(i: number) { return this.c.clone().addScaledVector(SLOT_LOCAL[i], this.s).setY(0.4 * this.s); }
  toUnit(w: THREE.Vector3) { return this.c.clone().add(w.clone().sub(this.c).divideScalar(this.s)); }
  toWorld(u: THREE.Vector3) { return this.c.clone().add(u.clone().sub(this.c).multiplyScalar(this.s)); }
  /** slot indices for `n` new dice, skipping the slots the `resting` dice hold */
  freeSlots(n: number, resting: Die3D[]) {
    const taken = new Set(resting.map(d => this.slotOf.get(d) ?? this.nearest(d.home)));
    return PREF.filter(i => !taken.has(i)).slice(0, n);
  }
  nearest(p: THREE.Vector3) { let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) { const q = this.slot(i), d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; bi = i; } } return bi; }
  slotIndex(d: Die3D) { return this.slotOf.get(d) ?? this.nearest(d.home); }
  /** a throw is about to be played for d into slot i: map its track from the unit frame into the world until it lands */
  track(d: Die3D, slot: number) { this.flying.add(d); this.slotOf.set(d, slot); }
  /** call from throwHooks.landed: the die rests at its slot in world space, at field scale */
  landed(d: Die3D) {
    if (!this.flying.delete(d)) return false;
    const w = this.toWorld(d.home); w.y = 0.4 * this.s; d.home.copy(w); d.root.position.copy(w); d.root.scale.setScalar(this.s);
    this.local.set(d, w.clone().sub(this.c).divideScalar(this.s).setY(0.4)); return true;
  }
  /** a die that came to rest without a tracked throw (or was moved): remember where it sits */
  adopt(d: Die3D) { this.local.set(d, d.home.clone().sub(this.c).divideScalar(this.s).setY(0.4)); this.slotOf.set(d, this.nearest(d.home)); }
  forget(d: Die3D) { this.flying.delete(d); }
  /** reframe: ease the dais and the resting dice on it to a new centre / scale */
  async moveTo(c: THREE.Vector3, s: number, dice: Iterable<Die3D>, dur = 0.6) {
    const c0 = this.c.clone(), s0 = this.s, ds = [...dice].filter(d => d.mode === 'rest' && this.local.has(d));
    if (dur <= 0) { this.place(c, s); for (const d of ds) this.restAt(d); return; }
    await animP(dur, t => { const e = ease.inOut(t); this.c.lerpVectors(c0, c, e).setY(0); this.s = lerp(s0, s, e); this.apply(); for (const d of ds) this.restAt(d); });
  }
  private restAt(d: Die3D) { const l = this.local.get(d)!; d.home.copy(this.c).addScaledVector(V3(l.x, 0, l.z), this.s).setY(0.4 * this.s); d.root.scale.setScalar(this.s); }
  /** runes glow while it is the player's turn to throw / pick */
  glow(on: boolean) { this.runeOn = on; }
  private runeOn = false;
  private late() {
    if (!this.active) return;
    this.t += clock.rdt;
    this.runeMat.opacity += ((this.runeOn ? 0.55 + 0.15 * Math.sin(this.t * 2.4) : 0.18) - this.runeMat.opacity) * 0.1;
    for (const d of this.flying) {
      // a die tracked before its throw starts (the prep tray staggers its launches) waits here; landed() takes it out
      if (d.mode !== 'play' || !d.play) { if (!d.root.parent) this.flying.delete(d); continue; }
      const P = d.play, rec = P.rec, tt = clock.time - P.t0 - rec.rel;
      const m = rec.sT ? lerp(1, this.s, ease.inOut(Math.max(0, Math.min(1, tt / rec.sT)))) : this.s;
      d.root.position.sub(this.c).multiplyScalar(m).add(this.c); d.root.scale.multiplyScalar(m);
      d.foot.position.set(d.root.position.x, 0.012, d.root.position.z); d.foot.scale.setScalar(d.root.scale.x);
    }
    // resting dice: the contact shadow stays on the ground whatever the scale (die3d puts it at home.y − 0.4)
    for (const d of DICE3D) if (d.mode === 'rest' && this.local.has(d)) d.foot.position.y = 0.012;
  }
}
