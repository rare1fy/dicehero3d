// R5 reroll button (bottom left, UX_V3 §1): an octagon stone plate with a gold rim and the gold double-arrow mark (extruded, thick).
// Lamps on the top edge = rerolls left this turn (one goes out per use). With dice selected and a reroll available the whole button
// lights up gold and one little die per selected die circles it on a gold orbit (the user asked to keep this). Warrior: when the free
// rerolls are gone the button turns blood red and the lamp row becomes a drop + the HP price; out of rerolls = lamps off, button dark.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { lampMat, Spring, UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { octPlate, glowRing, rerollMark, pipDie, type Plate } from './models';
import { pill, label, glyph, type G } from './draw';
import { cue } from '../../../audio/cues';

export interface RerollView { free: number; blood: number | null; can: boolean; sel: number; maxLamps: number }

export class RerollButton {
  root = new THREE.Group(); private plate: Plate; private mark: THREE.Group; private markMat: THREE.MeshToonMaterial; private halo: THREE.Mesh; private orbit: THREE.Mesh;
  private lamps: THREE.Mesh[] = []; private lampOn: THREE.MeshBasicMaterial; private lampOff: THREE.MeshBasicMaterial; private lampBar = new THREE.Group();
  private dice: THREE.Mesh[] = []; private diceG = new THREE.Group(); private sparks: UiSparks; private press = new Spring(420, 20); private down = false; private t = 0; private litK = 0;
  private price: Pane; x = 0; y = 0; sizePx = 130; k = 1;
  v: RerollView = { free: 0, blood: null, can: false, sel: 0, maxLamps: 1 };
  onTap: () => void = () => {};
  constructor(private L: UiLayer, ov: Overlay) {
    this.plate = octPlate({ rim: 0xc8902a, face: 0x2c2836 }); this.root.add(this.plate.root);
    this.markMat = new THREE.MeshToonMaterial({ color: 0xffc23a, emissive: 0x6a3a00 });
    this.mark = rerollMark(this.markMat); this.mark.scale.setScalar(0.78); this.mark.position.z = 0.48; this.root.add(this.mark);
    this.halo = glowRing(0xffc040, 0.94, 1.3, 8, Math.PI * 2, Math.PI / 8); this.halo.position.z = -0.12; this.root.add(this.halo);
    this.orbit = glowRing(0xffc848, 1.38, 1.44, 96); this.orbit.rotation.x = -1.05; this.orbit.rotation.y = 0.25; this.root.add(this.orbit);
    this.lampOn = lampMat(0x5aff7a, 2.0); this.lampOff = new THREE.MeshBasicMaterial({ color: 0x2a3430, toneMapped: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.16), new THREE.MeshToonMaterial({ color: 0x1a2a20 })); this.lampBar.add(bar);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), this.lampOff); l.position.z = 0.1; this.lampBar.add(l); this.lamps.push(l); }
    this.lampBar.position.set(0, 1.02, 0.1); this.root.add(this.lampBar);
    for (let i = 0; i < 6; i++) { const d = pipDie(); d.visible = false; this.diceG.add(d); this.dice.push(d); }
    this.root.add(this.diceG);
    L.scene.add(this.root); this.sparks = new UiSparks(L.scene, 60);
    this.price = ov.pane(10, true);
  }
  place(x: number, y: number, sizePx: number, k: number) { this.x = x; this.y = y; this.sizePx = sizePx; this.k = k; }
  set(v: RerollView) { const lit = v.can && v.sel > 0, was = this.v.can && this.v.sel > 0; if (lit && !was) cue('tick', 0.35); this.v = v; }
  hit(x: number, y: number) { const r = this.sizePx * 0.56; return this.root.visible && Math.abs(x - this.x) < r && Math.abs(y - this.y) < r; }
  pointer(type: string, x: number, y: number) {
    const h = this.hit(x, y);
    if (type === 'down' && h) { this.down = true; cue(this.v.can ? 'click' : 'deny', 0.5); return true; }
    if ((type === 'up' || type === 'cancel') && this.down) { this.down = false; if (type === 'up' && h) this.tap(); return true; }
    return false;
  }
  tap() {
    if (!this.v.can || !this.v.sel) { cue('deny', 0.4); return; }
    this.press.kick(-14); this.sparks.burst(this.L.at(this.x, this.y, 3), 18, this.L.px(240), this.L.px(5), this.v.free > 0 ? 0xffd060 : 0xff3a2a, { life: 0.4 }); this.onTap();
  }
  update(dt: number) {
    this.t += dt; const L = this.L, v = this.v, bloodMode = v.free <= 0 && v.blood != null, lit = v.can && v.sel > 0;
    this.litK += ((lit ? 1 : 0) - this.litK) * Math.min(1, dt * 8);
    L.at(this.x, this.y, 0, this.root.position);
    const p = this.press.step(this.down ? -1 : 0, dt), s = L.px(this.sizePx) / 2;
    this.root.scale.set(s * (1 + p * 0.004), s * (1 + p * 0.004), s);
    this.plate.root.position.z = Math.min(0, p * 0.02);
    // colours: gold normally, blood red when paying HP, dark when spent
    const spent = !v.can, rim = bloodMode ? 0xb02020 : 0xc8902a, face = bloodMode ? 0x3a1418 : 0x2c2836;
    this.plate.rim.color.setHex(spent ? 0x4a4450 : rim); this.plate.face.color.setHex(spent ? 0x1e1c24 : face);
    this.plate.rim.emissive.setHex(bloodMode ? 0xff2010 : 0xffa020).multiplyScalar(this.litK * (0.4 + 0.25 * Math.sin(this.t * 5)));
    this.markMat.color.setHex(spent ? 0x5a5260 : bloodMode ? 0xff5a4a : 0xffc23a);
    this.markMat.emissive.setHex(bloodMode ? 0x6a0a00 : 0x6a3a00).multiplyScalar(spent ? 0 : 0.6 + this.litK * 0.8);
    this.mark.rotation.z = -this.t * (0.3 + this.litK * 2.2);
    (this.halo.material as THREE.MeshBasicMaterial).opacity = this.litK * (0.45 + 0.2 * Math.sin(this.t * 4)); this.halo.visible = this.litK > 0.02;
    (this.halo.material as THREE.MeshBasicMaterial).color.setHex(bloodMode ? 0xff3020 : 0xffc040);
    (this.orbit.material as THREE.MeshBasicMaterial).opacity = this.litK * 0.85; this.orbit.visible = this.litK > 0.02;
    (this.orbit.material as THREE.MeshBasicMaterial).color.setHex(bloodMode ? 0xff4030 : 0xffc848);
    // lamps = free rerolls left (the warrior's paid rerolls: a drop + price instead)
    const n = Math.max(1, Math.min(4, v.maxLamps)); this.lampBar.visible = !bloodMode;
    (this.lampBar.children[0] as THREE.Mesh).scale.set(0.3 + n * 0.22, 1, 1);
    this.lamps.forEach((l, i) => { l.visible = i < n; l.position.x = (i - (n - 1) / 2) * 0.22; l.material = i < v.free ? this.lampOn : this.lampOff; });
    // the orbit: one little die per selected die
    const m = lit ? Math.min(6, v.sel) : 0;
    this.dice.forEach((d, i) => {
      d.visible = i < m && this.litK > 0.05; if (!d.visible) return;
      const a = this.t * 1.3 + (i / Math.max(1, m)) * Math.PI * 2, rx = 1.41, ry = rx * Math.cos(1.05);
      d.position.set(Math.cos(a) * rx, Math.sin(a) * ry * 0.9 - 0.05, Math.sin(a) * 0.9 + 0.35); d.scale.setScalar(0.34 * this.litK);
      d.rotation.set(this.t * 1.7 + i, this.t * 1.1 + i * 2, 0.3);
    });
    this.sparks.update(dt);
    // the HP price (warrior) above the button
    const show = bloodMode && v.blood != null && v.can, txt = v.blood ? `-${v.blood}` : '0', w = 70, h = 30;
    this.price.paint('p' + txt, w, h, (g: G, k) => { pill(g, 1, 1, w - 2, h - 2, k, { rim: 'rgba(255,80,60,0.7)', r: 12 }); glyph(g, 'drop', 18, h / 2, 18, k, '#e02a2a', '#ff9a8a'); label(g, txt, 46, h / 2, 17, k, { col: '#ffd0c8' }); });
    this.price.at(this.x - w / 2, this.y - this.sizePx * 0.62 - h / 2 - 6); this.price.scale = this.k; this.price.visible = show;
  }
}
