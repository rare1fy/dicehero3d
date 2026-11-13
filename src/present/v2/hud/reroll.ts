// R7 重投按钮（左下，UX_V3 §1 / §5b / §6b）：高清像素八角石钮（pixPlate：挤出的像素画，厚度 0.42 × 宽，侧面暗两档，1～2 格倒角台阶，
// 接触投影，按下沉半个厚度），金色挤出的像素双箭头记号，上沿一排像素小灯 = 本回合还能重投几次。选中骰子且能重投：整钮亮金（阶梯
// 发光圈，不用柔光），记号按 90° 一格一格转，选中几颗就有几颗小数字骰绕着按钮转（用户点名保留）。狂战免费次数用完：钮变血红，
// 灯条换成「血滴 + 代价」像素牌；次数用完：灯全灭、钮变暗。静止时 1 体素 = 1 美术像素（按当前格数现建一套外壳）。
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { Spring, UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { glowRing } from './models';
import { PixPlate } from './pixPlate';
import { Flip } from './flip';
import { lampRow } from './pixParts';
import { markPix, rerollRows, numeralDie, setNumeralTop } from './pixMarks';
import { GRID, PAL, ramp } from '../../ui3d/pixelGrid';
import type { PixModel } from '../../ui3d/pixMesh';
import { paintCells, digitCellsW } from '../../ui3d/pixDraw';
import { pixGlyph, INK } from './pixIcons';
import { cue } from '../../../audio/cues';

export interface RerollView { free: number; blood: number | null; can: boolean; sel: number; maxLamps: number }

const BLOOD_FACE = ramp(0x3a1418, { hi: 0x52202a }), DEAD_FACE = ramp(0x1e1c24, { hi: 0x2a2832 }), GREEN = ramp(0x48e070, { hi: 0xc0ffc8, dark: 0x041a0a });

export class RerollButton {
  root = new THREE.Group(); private pp: PixPlate; private mark: PixModel; private markG = new THREE.Group(); private orbit: THREE.Mesh;
  private lamps: PixModel | null = null; private lampN = 0;
  private dice: THREE.Mesh[] = []; private diceG = new THREE.Group(); private orbitG = new THREE.Group(); private sparks: UiSparks; private press = new Spring(420, 20); private down = false; private t = 0; private litK = 0;
  private turn = 0; private turnT = 0; private flip = new Flip(); private markB: PixModel;
  private price: Pane; x = 0; y = 0; sizePx = 130; k = 1;
  v: RerollView = { free: 0, blood: null, can: false, sel: 0, maxLamps: 1 };
  onTap: () => void = () => {};
  constructor(private L: UiLayer, ov: Overlay) {
    this.pp = new PixPlate([[40, 40]], { rim: PAL.gold, face: PAL.face }); this.root.add(this.pp.root);
    this.mark = markPix(rerollRows(), PAL.gold, 4); this.markG.add(this.mark); this.pp.root.add(this.markG);
    this.markB = markPix(rerollRows(), PAL.gold, 4); this.markB.rotation.x = Math.PI; this.pp.root.add(this.markB);
    // user 11-13: 「骰子环绕的路径也没对」 — ring and dice now live in one tilted group, so the dice ride the ring itself
    this.orbit = glowRing(0xffc848, 1.38, 1.44, 96); this.orbitG.rotation.set(-1.05, 0.25, 0); this.orbitG.add(this.orbit, this.diceG); this.root.add(this.orbitG);
    for (let i = 0; i < 6; i++) { const d = numeralDie(); d.visible = false; this.diceG.add(d); this.dice.push(d); }
    L.scene.add(this.root); this.sparks = new UiSparks(L.scene, 60);
    this.price = ov.pane(10);
  }
  place(x: number, y: number, sizePx: number, k: number) { this.x = x; this.y = y; this.sizePx = sizePx; this.k = k; }
  set(v: RerollView) { const lit = v.can && v.sel > 0, was = this.v.can && this.v.sel > 0; if (lit && !was) cue('tick', 0.35); this.v = v; }
  hit(x: number, y: number) { const r = Math.max(44 * this.k, this.sizePx * 0.56); return this.root.visible && Math.abs(x - this.x) < r && Math.abs(y - this.y) < r; }
  pointer(type: string, x: number, y: number) {
    const h = this.hit(x, y);
    if (type === 'down' && h) { this.down = true; cue(this.v.can ? 'click' : 'deny', 0.5); return true; }
    if ((type === 'up' || type === 'cancel') && this.down) { this.down = false; if (type === 'up' && h) this.tap(); return true; }
    return false;
  }
  tap() {
    if (!this.v.can || !this.v.sel) { cue('deny', 0.4); return; }
    this.press.kick(-6); this.flip.spin(); this.sparks.burst(this.L.at(this.x, this.y, 3), 18, this.L.px(240), this.L.px(5), this.v.free > 0 ? 0xffd060 : 0xff3a2a, { life: 0.4 }); this.onTap();
  }
  private setLamps(n: number) {
    if (n === this.lampN && this.lamps) return;
    if (this.lamps) { this.pp.root.remove(this.lamps); this.lamps.dispose(); }
    this.lamps = lampRow(n, 3, 1); this.lampN = n; this.pp.root.add(this.lamps);
  }
  private markW = 0;
  /** the mark sized to the plate (≈ 62% of its width), rebuilt only when the cell count changes */
  private buildMark(Wc: number) {
    this.markW = Wc; this.markG.remove(this.mark); this.mark.dispose();
    const R = Math.max(12, Math.round(Wc * 0.62) - 6); this.mark = markPix(rerollRows(R, Math.round(R / 3), 3), PAL.gold, 4); this.markG.add(this.mark);
    this.pp.root.remove(this.markB); this.markB.dispose(); this.markB = markPix(rerollRows(R, Math.round(R / 3), 3), PAL.gold, 4); this.markB.rotation.x = Math.PI; this.pp.root.add(this.markB);
  }
  update(dt: number) {
    this.t += dt; const L = this.L, v = this.v, bloodMode = v.free <= 0 && v.blood != null, lit = v.can && v.sel > 0, uc = GRID.uc;
    this.litK += ((lit ? 1 : 0) - this.litK) * Math.min(1, dt * 8);
    // 1 voxel = 1 art pixel: the shell is built for the exact cell count of the laid-out size
    const Wc = Math.max(16, Math.round(this.sizePx / uc)); this.pp.ensure(Wc, Wc);
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(L.px(uc));
    const p = this.press.step(this.down ? -1 : 0, dt); this.pp.pressK = Math.max(0, Math.min(1, -p));
    const pv = this.pp.use(Wc, Wc);
    this.markB.position.z = -pv.o.D - 0.5;
    const fa = this.flip.step(dt); this.pp.root.rotation.x = fa; this.pp.root.position.z = this.flip.lift(pv.H, pv.o.D);
    // colours: gold normally, blood red when paying HP, dark when spent
    const spent = !v.can;
    this.pp.setRim(spent ? PAL.dead : bloodMode ? PAL.blood : PAL.gold); this.pp.setFace(spent ? DEAD_FACE : bloodMode ? BLOOD_FACE : PAL.face);
    this.pp.dim(spent ? 0.7 : 1);
    this.pp.glowK = this.litK * (0.28 + 0.1 * Math.sin(this.t * 4)); this.pp.glowCol.setHex(bloodMode ? 0xff3020 : 0xffc040); this.pp.update();
    this.mark.setPal(0, spent ? PAL.dead : bloodMode ? PAL.blood : lit ? PAL.goldHot : PAL.gold, 1);
    // the mark turns in quarter steps while lit (pixel art stays on the grid between steps)
    if (lit) { this.turnT += dt; if (this.turnT > 0.7) { this.turnT = 0; this.turn++; } } else this.turnT = 0.7;
    const target = -this.turn * Math.PI / 2; this.markG.rotation.z += (target - this.markG.rotation.z) * Math.min(1, dt * 18);
    const markS = 1; if (Wc !== this.markW) this.buildMark(Wc); this.markG.scale.setScalar(markS); this.markG.position.set(0, 0, -2 * (1 - 0.5 * this.pp.pressK) - 0.5 * this.pp.pressK * pv.o.D);
    (this.orbit.material as THREE.MeshBasicMaterial).opacity = this.litK * 0.85; this.orbit.visible = this.litK > 0.02;
    (this.orbit.material as THREE.MeshBasicMaterial).color.setHex(bloodMode ? 0xff4030 : 0xffc848);
    this.orbitG.position.set(0, 0, -pv.o.D * 0.5); this.orbit.scale.setScalar(Wc / 2);
    // lamps = free rerolls left (the warrior's paid rerolls: a drop + price instead)
    const n = Math.max(1, Math.min(4, v.maxLamps)); this.setLamps(n);
    const lm = this.lamps!; lm.visible = !bloodMode; lm.position.set(0, pv.H / 2 - 1, 1 - this.pp.pressK * pv.o.D * 0.5);
    for (let i = 0; i < n; i++) lm.setPal(1 + i, i < v.free ? GREEN : PAL.dead, i < v.free ? 2.2 : 1);
    lm.tintAll(spent ? 0.7 : 1);
    // the orbit: one little numeral die per selected die
    const m = lit ? Math.min(6, v.sel) : 0, R = Wc / 2;
    this.dice.forEach((d, i) => {
      d.visible = i < m && this.litK > 0.05; if (!d.visible) return;
      const a = this.t * 1.3 + (i / Math.max(1, m)) * Math.PI * 2, rr = 1.41 * R;   // the ring's mid radius (1.38–1.44) × the ring scale
      d.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0); d.scale.setScalar(0.34 * R * this.litK);
      d.rotation.set(this.t * 1.7 + i, this.t * 1.1 + i * 2, 0.3); setNumeralTop(d, 1 + ((i * 3 + 2) % 6), bloodMode ? 'dim' : 'normal');
    });
    this.sparks.update(dt);
    // the HP price (warrior) above the button: a pixel plaque (drop + digits)
    const show = bloodMode && v.blood != null && v.can, txt = v.blood ? `-${v.blood}` : '0', cw = 15 + digitCellsW(txt) + 3, ch = 13;
    paintCells(this.price, 'p' + txt, cw, ch, pen => {
      pen.box(0, 0, cw, ch, { fill: 'rgba(30,8,12,0.9)', line: INK, rim: '#a02a24', hi: null, cut: 2 });
      pixGlyph(pen, 'drop', 2, 2, { col: '#e02a2a' }); pen.digits(txt, 13, 3, { col: '#ffd0c8', shadow: null });
    });
    this.price.at(Math.round(this.x - this.price.w / 2), Math.round(this.y - this.sizePx * 0.62 - this.price.h - 2 * uc)); this.price.visible = show && this.root.visible;
  }
}
