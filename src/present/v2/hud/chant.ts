// R7 吟唱 / 结束回合按钮（右侧，UX_V3 §1 / §5b / §6b，不写字以外的东西）：高清像素八角石钮（pixPlate，厚 0.42 × 宽）。魔导 = 3 段
// 像素八角环（吟唱格，亮几段 = 环里几颗；下一格慢闪）+ 挤出的四角星；狂战 / 刺客 = 挤出的像素沙漏「结束回合」。点击 = 结束回合
// （魔导即吟唱）。Figma 附录 A 的状态：可吟唱（青边）、满环（金边 + 金环）、确认保留（白边 + 「留 N 颗」）、反噬高（紫边紫黑闪）。
// 下方小字用 Fusion Pixel（每个字体像素 = 整数个设备像素）。
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { Spring, UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { PixPlate } from './pixPlate';
import { STAR_ROWS, HOURGLASS_ROWS } from './pixParts';
import { markPix, chantRingPix } from './pixMarks';
import { GRID, PAL, ramp } from '../../ui3d/pixelGrid';
import type { PixModel } from '../../ui3d/pixMesh';
import { paintCells, textCellsW, textCellsH, labelFp } from '../../ui3d/pixDraw';
import { cue } from '../../../audio/cues';

export interface ChantView { mage?: boolean; urgent?: boolean; ring: number; live: boolean; struck: boolean; keep: boolean; risk: number; keepN?: number }

const FACE = ramp(0x1c1e2a, { hi: 0x2a2c3a }), SAND = ramp(0xe7c78d, { hi: 0xfff0c8 }), CYAN_OFF = ramp(0x3a4a5a, { hi: 0x52667a });
const RIM = { cyan: ramp(0x40a8d0, { hi: 0x9ae8ff }), white: ramp(0xd8e4f0, { hi: 0xffffff }), violet: PAL.violet, plum: ramp(0x2a1438, { hi: 0x3e2050 }), sand: ramp(0xa99a80, { hi: 0xd8ccb0 }), hot: ramp(0xffd584, { hi: 0xfff2c8 }) };

export class ChantButton {
  root = new THREE.Group(); private pp: PixPlate; private ring: PixModel | null = null; private star: PixModel; private hourglass: PixModel; private ringW = 0;
  private sparks: UiSparks; private press = new Spring(420, 20); private down = false; private t = 0;
  x = 0; y = 0; sizePx = 120; k = 1; v: ChantView = { ring: 0, live: false, struck: false, keep: false, risk: 0 }; private txt: Pane | null = null;
  onTap: () => void = () => {};
  constructor(private L: UiLayer, ov?: Overlay) {
    if (ov) this.txt = ov.pane(10);
    this.pp = new PixPlate([[34, 34]], { rim: RIM.cyan, face: FACE }); this.root.add(this.pp.root);
    this.star = markPix(STAR_ROWS, PAL.pale, 4); this.hourglass = markPix(HOURGLASS_ROWS, SAND, 4);
    this.pp.root.add(this.star, this.hourglass);
    L.scene.add(this.root); this.sparks = new UiSparks(L.scene, 40);
  }
  place(x: number, y: number, sizePx: number) { this.x = x; this.y = y; this.sizePx = sizePx; }
  hit(x: number, y: number) { const r = Math.max(44 * this.k, this.sizePx * 0.56); return this.root.visible && Math.abs(x - this.x) < r && Math.abs(y - this.y) < r; }
  pointer(type: string, x: number, y: number) {
    const h = this.hit(x, y);
    if (type === 'down' && h) { this.down = true; cue(this.v.live ? 'click' : 'deny', 0.5); return true; }
    if ((type === 'up' || type === 'cancel') && this.down) { this.down = false; if (type === 'up' && h) this.tap(); return true; }
    return false;
  }
  tap() { if (!this.v.live) { cue('deny', 0.4); return; } this.press.kick(-6); this.sparks.burst(this.L.at(this.x, this.y, 3), 18, this.L.px(220), this.L.px(5), 0x60e0ff, { life: 0.4 }); cue('magic', 0.5); this.onTap(); }
  private buildRing(Wc: number) {
    if (this.ring) { this.pp.root.remove(this.ring); this.ring.dispose(); }
    const R = Math.max(14, Math.round(Wc * 0.62)) & ~1; this.ring = chantRingPix(R, 2, PAL.cyan, 3); this.ringW = Wc; this.pp.root.add(this.ring);
  }
  update(dt: number) {
    this.t += dt; const L = this.L, v = this.v, uc = GRID.uc, p = this.press.step(this.down ? -1 : 0, dt);
    const Wc = Math.max(16, Math.round(this.sizePx / uc)); this.pp.ensure(Wc, Wc); if (Wc !== this.ringW) this.buildRing(Wc);
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(L.px(uc));
    this.pp.pressK = Math.max(0, Math.min(1, -p)); const pv = this.pp.use(Wc, Wc), sink = -2 - 0.5 * this.pp.pressK * pv.o.D;
    const mage = v.mage !== false, chantable = mage && v.live && !v.struck, full = v.ring >= 3 && chantable, high = v.live && v.risk >= 8;
    const ring = this.ring!; ring.visible = mage; ring.position.z = sink + 0.5;
    for (let i = 0; i < 3; i++) {
      const on = i < v.ring, next = i === v.ring && chantable, pal = full ? PAL.goldHot : on ? (chantable ? PAL.cyan : PAL.iron) : next ? PAL.cyan : CYAN_OFF;
      ring.setPal(1 + i, pal, full || (on && chantable) ? 2 : 1); ring.tint(1 + i, next && !on ? 0.45 + 0.3 * Math.sin(this.t * 4) : 1);
    }
    this.star.visible = mage; this.star.position.z = sink + 1; this.star.setPal(0, v.live ? PAL.pale : PAL.dead, v.live ? 1 + (v.keep ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0.2) : 1);
    this.hourglass.visible = !mage; this.hourglass.position.z = sink + 1; this.hourglass.setPal(0, v.live ? SAND : PAL.dead);
    const rim = !mage ? (v.live ? (v.urgent ? RIM.hot : RIM.sand) : PAL.dead) : v.keep ? RIM.white : high ? (Math.sin(this.t * 10) > 0 ? RIM.violet : RIM.plum) : full ? PAL.goldHot : v.live ? RIM.cyan : PAL.dead;
    this.pp.setRim(rim); this.pp.dim(v.live ? 1 : 0.75);
    this.pp.glowK = mage && v.live ? (v.keep ? 0.5 + 0.2 * Math.sin(this.t * 5) : full ? 0.35 : 0) : !mage && v.urgent ? 0.35 + 0.15 * Math.sin(this.t * 4) : 0;
    this.pp.glowCol.setHex(high ? 0xa060ff : full || !mage ? 0xffc040 : 0x40d0ff); this.pp.update();
    if (this.txt) {
      const n = v.keepN ?? 0, t = mage ? (v.keep ? `留 ${n} 颗` : '吟唱') : '结束回合', fp = labelFp(), col = v.live ? '#e9ddc3' : '#8b8492';
      const cw = textCellsW(t, fp) + 2, ch = textCellsH(fp) + 2;
      paintCells(this.txt, 'k' + t + col + fp, cw, ch, pen => pen.text(t, 1, 1, { col, fp }));
      this.txt.at(Math.round(this.x - this.txt.w / 2), Math.round(this.y + this.sizePx * 0.5 + 2 * uc)); this.txt.visible = this.root.visible;
    }
    this.sparks.update(dt);
  }
}
