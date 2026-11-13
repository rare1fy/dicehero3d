// R5 mage chant button (right edge, vertically centred; no text): a dark octagon, a cyan ring of three thick arcs (the chant cells,
// lit = cells filled; the next cell to fill pulses) and a four-point star. Tap = end the turn (chant). After a strike the arcs go grey
// (ending now does not chant); in the keep-dice step the whole button pulses cyan. Figma 附录 A states: 可吟唱 (cyan rim), 满环 (gold rim +
// gold arcs), 确认保留 (white rim + 「留 N 颗」), 反噬高 (purple rim, purple-black flicker).
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { Spring, UiSparks, voxModel } from '../../ui3d/vox';
import { octPlate, glowRing, arcSlab, starMark, type Plate } from './models';
import { cue } from '../../../audio/cues';
import type { Overlay, Pane } from '../overlay';
import { label } from './draw';

export interface ChantView { mage?: boolean; urgent?: boolean; ring: number; live: boolean; struck: boolean; keep: boolean; risk: number; keepN?: number }

export class ChantButton {
  root = new THREE.Group(); private plate: Plate; private arcs: THREE.Mesh[] = []; private arcOn: THREE.MeshBasicMaterial; private arcNext: THREE.MeshBasicMaterial; private arcOff: THREE.MeshBasicMaterial;
  private star: THREE.Mesh; private starMat: THREE.MeshToonMaterial; private halo: THREE.Mesh; private sparks: UiSparks; private press = new Spring(420, 20); private down = false; private t = 0;
  x = 0; y = 0; sizePx = 120; k = 1; v: ChantView = { ring: 0, live: false, struck: false, keep: false, risk: 0 }; private txt: Pane | null = null; private arcGold: THREE.MeshBasicMaterial;
  onTap: () => void = () => {};
  private hourglass: THREE.Group;
  constructor(private L: UiLayer, ov?: Overlay) {
    if (ov) this.txt = ov.pane(10, true);
    this.arcGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(1.5), toneMapped: false });
    this.plate = octPlate({ rim: 0x3a3e4e, face: 0x1c1e2a, base: 0x121218 }); this.root.add(this.plate.root);
    this.arcOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30d8ff).multiplyScalar(1.5), toneMapped: false });
    this.arcNext = new THREE.MeshBasicMaterial({ color: 0x30d8ff, transparent: true, opacity: 0.5, toneMapped: false });
    this.arcOff = new THREE.MeshBasicMaterial({ color: 0x3a4250, toneMapped: false });
    for (let i = 0; i < 3; i++) { const a0 = Math.PI / 2 + 0.2 - i * (Math.PI * 2 / 3), a1 = a0 + Math.PI * 2 / 3 - 0.4; const m = arcSlab(0.44, 0.66, a0, a1, 0.12, this.arcOff); m.position.z = 0.42; this.root.add(m); this.arcs.push(m); }
    this.starMat = new THREE.MeshToonMaterial({ color: 0xbff4ff, emissive: 0x1a6a8a }); this.star = starMark(this.starMat); this.star.scale.setScalar(0.34); this.star.position.z = 0.46; this.root.add(this.star);
    const rows=['#######','.#####.','..###..','...#...','..###..','.#####.','#######'];
    this.hourglass=voxModel(0.11,set=>rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#')set(x,6-y,0,y===0||y===6?0xb9b1a3:0xe7c78d);}))); this.hourglass.position.set(0,0.1,0.45); this.root.add(this.hourglass);
    this.halo = glowRing(0x40d0ff, 0.98, 1.16, 8, Math.PI * 2, Math.PI / 8); this.halo.position.z = -0.1; this.root.add(this.halo);
    L.scene.add(this.root); this.sparks = new UiSparks(L.scene, 40);
  }
  place(x: number, y: number, sizePx: number) { this.x = x; this.y = y; this.sizePx = sizePx; }
  hit(x: number, y: number) { const r = this.sizePx * 0.56; return this.root.visible && Math.abs(x - this.x) < r && Math.abs(y - this.y) < r; }
  pointer(type: string, x: number, y: number) {
    const h = this.hit(x, y);
    if (type === 'down' && h) { this.down = true; cue(this.v.live ? 'click' : 'deny', 0.5); return true; }
    if ((type === 'up' || type === 'cancel') && this.down) { this.down = false; if (type === 'up' && h) this.tap(); return true; }
    return false;
  }
  tap() { if (!this.v.live) { cue('deny', 0.4); return; } this.press.kick(-14); this.sparks.burst(this.L.at(this.x, this.y, 3), 18, this.L.px(220), this.L.px(5), 0x60e0ff, { life: 0.4 }); cue('magic', 0.5); this.onTap(); }
  update(dt: number) {
    this.t += dt; const L = this.L, v = this.v, p = this.press.step(this.down ? -1 : 0, dt), s = L.px(this.sizePx) / 2;
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.set(s, s, s); this.plate.root.position.z = Math.min(0, p * 0.02);
    const mage = v.mage !== false, chantable = mage && v.live && !v.struck;
    this.star.visible = mage; this.hourglass.visible = !mage;
    const full = v.ring >= 3 && chantable, high = v.live && v.risk >= 8;
    this.arcs.forEach((a, i) => { a.visible = mage; a.material = full ? this.arcGold : !chantable ? (i < v.ring ? this.arcNext : this.arcOff) : i < v.ring ? this.arcOn : i === v.ring ? this.arcNext : this.arcOff; });
    this.arcNext.opacity = 0.35 + 0.3 * Math.sin(this.t * 4);
    this.star.rotation.z = Math.sin(this.t * 0.8) * 0.15; this.starMat.emissive.setHex(v.live ? 0x1a8aaa : 0x0a1a20).multiplyScalar(1 + (v.keep ? 0.6 * Math.sin(this.t * 6) : 0));
    this.plate.rim.color.setHex(!mage ? (v.live ? v.urgent ? 0xffd584 : 0xa99a80 : 0x48434c) : v.keep ? 0xe8f4ff : high ? (Math.sin(this.t * 10) > 0 ? 0x9a50e0 : 0x2a1438) : full ? 0xffb030 : v.live ? 0x40a8d0 : 0x2a2a34);
    if (this.txt) { const n = v.keepN ?? 0, t = mage ? (v.keep ? `留 ${n} 颗` : '吟唱') : '结束回合'; this.txt.paint('k' + t, 96, 26, (g, kk) => label(g, t, 48, 13, mage ? 14 : 13, kk, { col: v.live ? '#e9ddc3' : '#8b8492' })); this.txt.scale = this.k; this.txt.at(this.x - 48, this.y + this.sizePx * 0.3 - 13); this.txt.visible = this.root.visible; }
    const hb = mage && v.live ? (v.keep ? 0.5 + 0.2 * Math.sin(this.t * 5) : 0.08 + 0.06 * Math.sin(this.t * 2)) : 0;
    (this.halo.material as THREE.MeshBasicMaterial).opacity = hb; this.halo.visible = hb > 0.02; (this.halo.material as THREE.MeshBasicMaterial).color.setHex(high ? 0xa060ff : full ? 0xffc040 : 0x40d0ff);
    this.sparks.update(dt);
  }
}
