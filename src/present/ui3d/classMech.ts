// 职业机制 UI (SPEC_v2 §2, simple versions), shown next to the flask, one class at a time:
//   狂战 血怒刻度: 5 blood notches on an iron bar (a notch fills and pulses when a layer is gained; full = all glow).
//   魔导 吟唱环: a stone ring with 3 rune slots (lit = chant turns); kept dice float on the ring and orbit slowly.
//   刺客 出手次数: 2 strike dots (blade marks); a used strike goes dark, a precise combo flashes violet.
// The rules layer pushes numbers in (setRage / setChant / setKept / setStrikes); this only shows them.
import * as THREE from 'three';
import { V3 } from '../engine/world';
import { Die3D } from '../dice/die3d';
import { DIE } from '../dice/signature';
import { presentQuat } from '../dice/faces';
import { UiLayer } from './layer';
import { voxModel, Spring, UiSparks, lampMat } from './vox';
import type { ClassId, SuitSkin } from './suitData';
import { cue } from '../../audio/cues';

export const MECH = { rageMax: 5, chantMax: 3, strikes: 2 };

const IRON = 0x3a3446, IRON_L = 0x6a6278, STONE = 0x5a5266, STONE_L = 0x8a8296;

/** a small socket plate (w × h cells) with a lamp cube on it */
function socket(w: number, h: number, col: number) {
  return voxModel(1, set => { for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const e = x === 0 || y === 0 || x === w - 1 || y === h - 1; set(x, y, 0, e ? IRON_L : IRON); } void col; });
}

interface Lamp { g: THREE.Group; lamp: THREE.Mesh; mat: THREE.MeshBasicMaterial; pop: Spring; on: boolean }

export class ClassMech {
  root = new THREE.Group(); cls: ClassId = 'warrior';
  /** layout: left-centre of the widget (CSS px) and its cell size in px */
  x = 200; y = 560; cellPx = 5;
  rage = 0; chant = 0; strikesUsed = 0; combo = false;
  private groups: Record<ClassId, THREE.Group> = { warrior: new THREE.Group(), mage: new THREE.Group(), rogue: new THREE.Group() };
  private rageL: Lamp[] = []; private chantL: Lamp[] = []; private strikeL: Lamp[] = [];
  private kept: Die3D[] = []; private sparks: UiSparks; private t = 0; private comboT = 0;
  constructor(private L: UiLayer, private skin: SuitSkin) {
    this.sparks = new UiSparks(L.scene, 80);
    L.scene.add(this.root); for (const g of Object.values(this.groups)) this.root.add(g);
    // warrior: an iron bar with 5 notches
    const bar = voxModel(1, set => { for (let x = -1; x < 5 * 6; x++) for (let y = -1; y < 6; y++) set(x, y, -1, y === -1 || y === 5 ? IRON_L : IRON); }, { centre: [0, 2.5, 0] });
    bar.position.x = 14.5; this.groups.warrior.add(bar);
    for (let i = 0; i < MECH.rageMax; i++) this.rageL.push(this.lamp(this.groups.warrior, i * 6 + 2.5, 0, 4, 4, 0xe0202a));
    // mage: a stone ring of 3 rune slots (radius 9 cells), dice orbit it
    const ring = voxModel(1, set => {
      for (let x = -11; x <= 11; x++) for (let y = -11; y <= 11; y++) { const r = Math.hypot(x + 0.5, y + 0.5); if (r > 8.5 && r < 11) set(x, y, -1, r > 10 ? STONE_L : STONE); }
    }, { centre: [0, 0, 0] });
    ring.position.x = 11; this.groups.mage.add(ring);
    for (let i = 0; i < MECH.chantMax; i++) { const a = Math.PI / 2 + (i * Math.PI * 2) / MECH.chantMax; this.chantL.push(this.lamp(this.groups.mage, 11 + Math.cos(a) * 9.7, Math.sin(a) * 9.7, 3, 3, 0x5a8aff)); }
    // rogue: 2 diamond-ish blade marks (plates with a lamp)
    for (let i = 0; i < MECH.strikes; i++) this.strikeL.push(this.lamp(this.groups.rogue, 3 + i * 9, 0, 6, 6, 0xb060ff));
    this.setClass('warrior');
  }
  private lamp(parent: THREE.Group, x: number, y: number, w: number, h: number, col: number): Lamp {
    const g = new THREE.Group(), s = socket(w + 2, h + 2, col); s.position.z = 0.5; g.add(s);
    const mat = lampMat(0x1a161e, 1) as THREE.MeshBasicMaterial; mat.userData.col = col;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), mat); lamp.position.z = 1; g.add(lamp);
    g.position.set(x, y, 0); parent.add(g);
    return { g, lamp, mat, pop: new Spring(320, 12), on: false };
  }
  place(x: number, y: number, cellPx = 5) { this.x = x; this.y = y; this.cellPx = cellPx; }
  setClass(c: ClassId) {
    this.cls = c; for (const k of Object.keys(this.groups) as ClassId[]) this.groups[k].visible = k === c;
    this.skin = { ...this.skin, cls: c }; for (const d of this.kept) d.setSuit(this.skin);
    if (c !== 'mage') this.setKept([]);
  }
  setSkin(s: SuitSkin) { this.skin = { ...s, special: undefined }; for (const d of this.kept) d.setSuit(this.skin); }
  /** 狂战 血怒层数 0..5 */
  setRage(n: number) { const v = Math.max(0, Math.min(MECH.rageMax, n)); if (v > this.rage) { this.rageL[v - 1]?.pop.kick(30); cue('roar', 0.25); this.burstAt(this.rageL[v - 1], 0xff3a2a); } this.rage = v; }
  /** 魔导 吟唱格数 0..3 */
  setChant(n: number) { const v = Math.max(0, Math.min(MECH.chantMax, n)); if (v > this.chant) { this.chantL[v - 1]?.pop.kick(30); cue('magic', 0.4); this.burstAt(this.chantL[v - 1], 0x6ab8ff); } this.chant = v; }
  /** 魔导 吟唱保留的骰子 (values); they orbit the ring */
  setKept(values: number[]) {
    while (this.kept.length > values.length) this.kept.pop()!.dispose();
    while (this.kept.length < values.length) { const d = new Die3D('standard', { parent: this.L.scene, suit: this.skin }); d.mode = 'queue'; d.root.visible = true; d.mesh.castShadow = false; this.kept.push(d); }
    values.forEach((v, i) => this.kept[i].setValue(v, 4, 0));
  }
  /** 刺客 本回合已出手次数 0..2; combo = 精准连击 lit on the second strike */
  setStrikes(used: number, combo = false) {
    const v = Math.max(0, Math.min(MECH.strikes, used));
    if (v > this.strikesUsed) { const l = this.strikeL[v - 1]; l.pop.kick(-24); this.burstAt(l, combo ? 0xd060ff : 0xc0b0d0); cue(combo ? 'crit' : 'click', 0.5); }
    this.strikesUsed = v; if (combo) { this.combo = true; this.comboT = 1; } if (v === 0) this.combo = false;
  }
  private burstAt(l: Lamp | undefined, col: number) { if (!l) return; this.root.updateMatrixWorld(true); this.sparks.burst(l.g.getWorldPosition(V3()).setZ(2), 12, this.L.px(180), this.L.px(4), col, { life: 0.4 }); }
  /** screen px of the widget centre (fly targets, e.g. a kept die returns to the ring) */
  anchor() { return { x: this.x + this.cellPx * 12, y: this.y }; }

  update(dt: number) {
    this.t += dt; const L = this.L, c = L.px(this.cellPx);
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(c); this.root.rotation.set(-0.12, 0.3, 0);
    this.comboT = Math.max(0, this.comboT - dt * 1.2);
    const paint = (l: Lamp, on: boolean, k: number) => {
      const p = l.pop.step(0, dt); l.g.scale.setScalar(1 + p * 0.012); l.lamp.position.z = 1 + (on ? 0.5 : -0.3);
      if (on) l.mat.color.setHex(l.mat.userData.col).multiplyScalar(k); else l.mat.color.setHex(0x1a161e);
    };
    const full = this.rage >= MECH.rageMax;
    this.rageL.forEach((l, i) => paint(l, i < this.rage, (full ? 1.8 + 0.4 * Math.sin(this.t * 6) : 1.4) + (i === this.rage - 1 ? 0.3 * Math.sin(this.t * 8) : 0)));
    this.chantL.forEach((l, i) => paint(l, i < this.chant, 1.5 + 0.3 * Math.sin(this.t * 3 + i)));
    this.strikeL.forEach((l, i) => { const on = i >= this.strikesUsed; paint(l, on || (this.combo && i === 1), on ? 1.5 : 1.6 + this.comboT * 1.5); if (this.combo && i === 1) l.mat.color.setHex(0xd060ff).multiplyScalar(1.6 + this.comboT * 1.5); });
    // kept dice orbit the chant ring
    if (this.cls === 'mage' && this.kept.length) {
      this.root.updateMatrixWorld(true);
      const centre = this.root.localToWorld(V3(11, 0, 4)), r = 9.7 * c, n = this.kept.length;
      this.kept.forEach((d, i) => {
        const a = this.t * 0.6 + (i / n) * Math.PI * 2;
        d.root.position.set(centre.x + Math.cos(a) * r, centre.y + Math.sin(a) * r * 0.9, centre.z + Math.sin(a) * 0.3);
        d.root.scale.setScalar(L.px(30) / DIE);
        d.root.quaternion.copy(presentQuat(d.topIdx, d.topTurns, new THREE.Quaternion())); d.root.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, Math.sin(this.t + i) * 0.4, 0)));
      });
    }
    for (const d of this.kept) d.root.visible = this.cls === 'mage';
    this.sparks.update(dt);
  }
}
