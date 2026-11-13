// R6 像素八角石钮的外壳：同一个按钮按显示尺寸备几套格数（待机槽 28 格、缩小槽 20 格、出牌按钮 66×56 格…），静止时总用格数
// 正好对上的那一套（1 体素 = 1 美术像素），形变途中临时缩放。外壳管：换边框色 / 石面色、整体变暗、按下（下沉半个厚度、侧面变短、
// 松开回弹）、阶梯发光圈（2～3 圈，不用柔光）、接触投影。root 的单位 = 1 美术像素（主人把 root.scale 设成 L.px(GRID.uc)），
// 正面在 z = 0。
import * as THREE from 'three';
import { octPlatePix, stepGlow, contactShadow, G_RIM, G_FACE, G_BODY, type OctPix } from './pixParts';

interface Var { W: number; H: number; o: OctPix; holder: THREE.Group; shadow: THREE.Mesh; glows: THREE.Mesh[] }
/** 发光圈：0 = 贴边的 3 圈阶梯光（激活 / 可点），1 = 外面再隔 3 格的一道外环（2 档起） */

export class PixPlate {
  root = new THREE.Group(); private vars: Var[] = []; cur: Var;
  private rim: number[]; private face: number[]; private body: number[] | undefined; private rimGlow = 1;
  /** 0..1 按下程度、发光圈强度与颜色 */
  pressK = 0; glowK = 0; glowCol = new THREE.Color(0xffc040); outerK = 0; outerCol = new THREE.Color(0xffa030); private glowRings: number;
  constructor(specs: Array<[number, number]>, o: { rim: number[]; face: number[]; body?: number[]; glowRings?: number; glowGap?: number; depthK?: number }) {
    this.rim = o.rim; this.face = o.face; this.body = o.body; this.glowRings = o.glowRings ?? 3;
    for (const [W, H] of specs) {
      const op = octPlatePix(W, H, { rim: o.rim, face: o.face, body: o.body, D: Math.max(6, Math.round(W * (o.depthK ?? 0.42))) }), holder = new THREE.Group();
      op.model.position.z = -op.D; holder.add(op.model);
      const sh = contactShadow(W, H, 0.55); sh.position.set(1, -2, -op.D - 0.05); sh.renderOrder = -1; holder.add(sh);
      const glows = [stepGlow(W, H, { gap: 1, rings: this.glowRings, w: 1 }), stepGlow(W, H, { gap: this.glowRings + 4, rings: 2, w: 1 })];
      for (const g of glows) { g.position.z = -op.D * 0.35; g.renderOrder = 1; holder.add(g); }
      holder.visible = false; this.root.add(holder); this.vars.push({ W, H, o: op, holder, shadow: sh, glows });
    }
    this.cur = this.vars[0]; this.cur.holder.visible = true;
  }
  /** 显示宽 wCells × 高 hCells（格）：选格数最接近的那套，余下的差用缩放补上 */
  use(wCells: number, hCells: number) {
    let best = this.vars[0], bd = 1e9;
    for (const v of this.vars) { const d = Math.abs(Math.log(v.W / Math.max(1, wCells))); if (d < bd) { bd = d; best = v; } }
    if (best !== this.cur) { this.cur.holder.visible = false; best.holder.visible = true; this.cur = best; }
    const v = this.cur, p = this.pressK;
    v.holder.scale.set(wCells / v.W, hCells / v.H, 1 - 0.5 * p);   // pressed: sinks half its thickness, the sides get shorter
    v.holder.position.z = -0.0;
    return v;
  }
  /** 当前那套的厚度（格） */
  get D() { return this.cur.o.D; }
  setRim(pal: number[], glow = 1) { this.rim = pal; this.rimGlow = glow; for (const v of this.vars) v.o.model.setPal(G_RIM, pal, glow); }
  setFace(pal: number[]) { this.face = pal; for (const v of this.vars) v.o.model.setPal(G_FACE, pal); }
  setBody(pal: number[]) { this.body = pal; for (const v of this.vars) v.o.model.setPal(G_BODY, pal); }
  /** 整体变暗（1 = 原色）；rimK = 边框另乘的亮度（> 1 发光脉动） */
  dim(k: number, rimK = 1) { for (const v of this.vars) { v.o.model.tintAll(k); v.o.model.tint(G_RIM, k * rimK); } }
  /** 每帧调用：发光圈 */
  update() {
    const [a, b] = this.cur.glows;
    a.visible = this.glowK > 0.02; (a.material as THREE.MeshBasicMaterial).color.copy(this.glowCol).multiplyScalar(1.7 * this.glowK);
    b.visible = this.outerK > 0.02; (b.material as THREE.MeshBasicMaterial).color.copy(this.outerCol).multiplyScalar(1.7 * this.outerK);
    this.cur.shadow.position.z = -this.cur.o.D * (1 - 0.5 * this.pressK) - 0.05;
  }
  dispose() { for (const v of this.vars) { v.o.model.dispose(); v.shadow.geometry.dispose(); (v.shadow.material as THREE.Material).dispose(); for (const g of v.glows) { g.geometry.dispose(); (g.material as THREE.Material).dispose(); } } }
}
