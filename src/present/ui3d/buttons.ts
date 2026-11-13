// 八角石钮: an octagonal stone push-button with real thickness in the UI layer (perspective shows its side), a carved face icon and
// a metal rim. Pressing sinks the cap into its base (spring); disabled buttons go dark; breathe() makes the rim glow in and out
// (the end-turn reminder when nothing else can be done). Used for 结束回合 (right edge, vertically centred, small, like Hearthstone)
// and 重投 (free rerolls as small dice icons, or the blood price: a drop + number).
import * as THREE from 'three';
import { V3 } from '../engine/world';
import { UiLayer } from './layer';
import { voxModel, iconCells, octPrism, flat, Spring, UiSparks } from './vox';
import { cue } from '../../audio/cues';

const ICONS: Record<string, string[]> = {
  // an hourglass-free "end": a sheathed sword pointing right
  end: ['..........', '..........', '.#........', '.##.......', '.#########', '.#########', '.##.......', '.#........', '..........', '..........'],
  // reroll: two curved arrows as right-angle hooks
  reroll: ['..######..', '.#......#.', '#........#', '#.....###.', '#......#..', '..#......#', '.###.....#', '#........#', '.#......#.', '..######..'],
  die: ['########', '#......#', '#.##...#', '#.##...#', '#...##.#', '#...##.#', '#......#', '########'],
  drop: ['...##...', '...##...', '..####..', '.######.', '########', '########', '.######.', '..####..'],
};

export interface ButtonLook { icon: keyof typeof ICONS; face: number; faceD: number; rim: number; glow: number; iconCol: number }
export const LOOKS: Record<'end' | 'reroll', ButtonLook> = {
  end: { icon: 'end', face: 0x7a6a4a, faceD: 0x4a3e2a, rim: 0xc89a48, glow: 0xffc860, iconCol: 0xffe6a8 },
  reroll: { icon: 'reroll', face: 0x5a6472, faceD: 0x343a46, rim: 0x9aa6b8, glow: 0x8ad8ff, iconCol: 0xe8f4ff },
};

export class StoneButton {
  root = new THREE.Group(); cap = new THREE.Group(); private base: THREE.Mesh; private rimMat: THREE.MeshToonMaterial; private faceMat: THREE.MeshToonMaterial; private glowMat: THREE.MeshBasicMaterial;
  private press = new Spring(420, 20); private down = false; private breatheOn = false; private t = 0; private sparks: UiSparks; private pips: THREE.Group;
  x = 0; y = 0; sizePx = 76; enabled = true;
  onTap: () => void = () => {};
  /** reroll badge: free count (dice icons) or a blood price (drop + number) */
  badge: { free: number; blood: number } = { free: 0, blood: 0 };
  constructor(private L: UiLayer, private look: ButtonLook, private name: string) {
    this.sparks = new UiSparks(L.scene, 60);
    // base: a wider, darker octagon (the socket)
    this.base = new THREE.Mesh(octPrism(1.12, 0.5, 1.12), flat(0x2a2430)); this.base.position.z = -0.25; this.root.add(this.base);
    // cap: rim ring + face, thick (the perspective shows its side)
    this.rimMat = flat(look.rim, { emissive: 0x000000 }).clone(); this.faceMat = flat(look.face).clone();
    const rim = new THREE.Mesh(octPrism(1.0, 0.55, 0.94), this.rimMat); rim.position.z = 0.27; this.cap.add(rim);
    const face = new THREE.Mesh(octPrism(0.84, 0.2, 0.8), this.faceMat); face.position.z = 0.62; this.cap.add(face);
    // carved icon in relief on the face
    const ic = voxModel(1, set => iconCells(set, ICONS[look.icon], 0, 0, 0, 1, ch => (ch === '#' ? { c: look.iconCol } : null)), { centre: [5, 5, 0] });
    ic.scale.setScalar(0.12); ic.position.z = 0.76; this.cap.add(ic);
    // glow ring (additive) for breathing / hover
    this.glowMat = new THREE.MeshBasicMaterial({ color: look.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const gr = new THREE.Mesh(octPrism(1.3, 0.05, 1.3), this.glowMat); gr.position.z = -0.3; this.root.add(gr);
    this.root.add(this.cap);
    this.pips = new THREE.Group(); this.root.add(this.pips);
    L.scene.add(this.root);
  }
  place(x: number, y: number, sizePx: number) { this.x = x; this.y = y; this.sizePx = Math.max(64, sizePx); }
  setEnabled(on: boolean) { this.enabled = on; }
  /** the end-turn reminder: no playable action left */
  breathe(on: boolean) { if (on && !this.breatheOn) cue('tick', 0.3); this.breatheOn = on; }
  setBadge(free: number, blood: number) {
    if (free === this.badge.free && blood === this.badge.blood) return; this.badge = { free, blood };
    this.pips.clear();
    if (free > 0) for (let i = 0; i < Math.min(3, free); i++) {
      const d = voxModel(1, set => iconCells(set, ICONS.die, 0, 0, 0, 2, ch => (ch === '#' ? { c: 0xfff2d8 } : null)), { centre: [4, 4, 1] });
      d.scale.setScalar(0.085); d.position.set(-0.32 + i * 0.32 - (Math.min(3, free) - 1) * 0 , -1.18, 0.6); this.pips.add(d);
    } else if (blood > 0) {
      const d = voxModel(1, set => iconCells(set, ICONS.drop, 0, 0, 0, 2, ch => (ch === '#' ? { c: 0xd01a2a } : null)), { centre: [4, 4, 1] });
      d.scale.setScalar(0.11); d.position.set(-0.32, -1.2, 0.6); this.pips.add(d);
    }
    this.pips.children.forEach((c, i, a) => { if (free > 0) c.position.x = (i - (a.length - 1) / 2) * 0.34; });
  }
  hit(x: number, y: number) { const r = this.sizePx * 0.56; return Math.abs(x - this.x) < r && Math.abs(y - this.y) < r && Math.abs(x - this.x) + Math.abs(y - this.y) < r * 1.45; }
  pointer(type: string, x: number, y: number) {
    const h = this.hit(x, y);
    if (type === 'down' && h) { this.down = true; if (this.enabled) { cue('click', 0.6); } else cue('deny', 0.4); return true; }
    if ((type === 'up' || type === 'cancel') && this.down) {
      this.down = false;
      if (type === 'up' && h && this.enabled) { this.press.kick(-6); this.sparks.burst(this.L.at(this.x, this.y, 2), 14, this.L.px(200), this.L.px(5), this.look.glow, { life: 0.4 }); this.onTap(); }
      return true;
    }
    return false;
  }
  /** a keyboard / bot press (same beat as a tap) */
  tap() { if (!this.enabled) { cue('deny', 0.4); return; } this.down = false; this.press.kick(-18); cue('click', 0.6); this.sparks.burst(this.L.at(this.x, this.y, 2), 14, this.L.px(200), this.L.px(5), this.look.glow, { life: 0.4 }); this.onTap(); }
  update(dt: number) {
    this.t += dt;
    const L = this.L, s = L.px(this.sizePx) / 2.3;
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(s);
    const p = this.press.step(this.down ? -1 : 0, dt);
    this.cap.position.z = 0.32 * Math.max(-1, p) * 0.8;
    // a little tilt toward the screen centre so the side reads (perspective already shows it; this adds a touch)
    const dx = (this.x - L.w / 2) / L.w, dy = (this.y - L.h / 2) / L.h;
    this.root.rotation.set(0, 0, 0); void dx; void dy;   // fx4: the toward-centre tilt now comes from the layer (UiLayer.tilt) for every widget
    const br = this.breatheOn && this.enabled ? 0.5 + 0.5 * Math.sin(this.t * 3.2) : 0;
    this.glowMat.opacity = br * 0.6 + (this.down ? 0.25 : 0);
    this.rimMat.emissive.setHex(this.look.glow).multiplyScalar(br * 0.55);
    this.faceMat.color.setHex(this.enabled ? this.look.face : 0x2e2a34); this.rimMat.color.setHex(this.enabled ? this.look.rim : 0x4a4452);
    this.sparks.update(dt);
    const bp = L.toPx(this.root.localToWorld(V3(0.25, -1.2, 0.7)));
    L.text.set(this.name + '.badge', { text: this.badge.free > 0 ? '' : this.badge.blood > 0 ? String(this.badge.blood) : '', x: bp.x + 4, y: bp.y, cell: 3, color: '#ffd0c8', align: 'left' });
  }
}
