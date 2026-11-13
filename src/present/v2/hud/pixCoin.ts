// R7B 像素「硬币钮」（UX_V3 §5b / §6b；用户：「按钮还是像个纸片」「点了以后就应该要翻转一下嘛，点下去的时候要有按钮按进去的效果」）。
// 重投、结束回合 / 吟唱共用的外壳，单位 = 1 美术像素（主人把 root.scale 设成 L.px(GRID.uc)，静止时 1 体素 = 1 美术像素）：
//   · 底座：比按钮大一圈的深色八角石槽，固定不动；
//   · 硬币：正反两片八角石钮背靠背（各厚 D/2，总厚 D ≥ 宽的 42%），金属边框 + 下凹石面，侧面上段是边框色暗两档、中段深色石身；
//     正面挂 front 组（记号、小灯），反面挂 back 组；翻过去看到的也是一块完整的钮面，不会露出空心；
//   · 按下：硬币整体下沉约半个厚度（正面几乎和底座沿齐平，露出来的侧面变短），松开弹簧回弹；
//   · 翻转：绕横轴（或竖轴）转，转动时按角度自动抬离底座（不穿模），带回弹；
//   · 阶梯发光圈（3 圈，不用柔光）、接触投影。
// root 的 z = 0 是静止时硬币正面（边框顶）所在的平面。
import * as THREE from 'three';
import { octPlatePix, stepGlow, contactShadow, G_RIM, G_FACE, G_BODY, type OctPix } from './pixParts';
import { PAL, ramp } from '../../ui3d/pixelGrid';
import { Spring } from '../../ui3d/vox';

export type FlipAxis = 'x' | 'y';
interface FlipStep { d: number; dur: number; hold: number }
/** 回弹缓动（略过头再回来） */
const easeBack = (t: number) => { const s = 1.9; t -= 1; return 1 + (s + 1) * t * t * t + s * t * t; };

export class PixCoin {
  root = new THREE.Group(); coin = new THREE.Group(); front = new THREE.Group(); back = new THREE.Group();
  private halves: OctPix[] = []; private socket: OctPix; private glow: THREE.Mesh; private shadow: THREE.Mesh;
  readonly W: number; readonly H: number; readonly D: number;
  /** 0..1 按下程度（弹簧驱动，主人设 down） */
  down = false; private press = new Spring(520, 22); pressK = 0;
  glowK = 0; glowCol = new THREE.Color(0xffc040);
  /** 翻转 */
  angle = 0; private from = 0; private steps: FlipStep[] = []; private ft = 0; private holdT = 0;
  constructor(W: number, H: number, private axis: FlipAxis, o: { rim?: number[]; face?: number[]; depthK?: number } = {}) {
    this.W = W; this.H = H;
    const D = Math.max(12, Math.round(W * (o.depthK ?? 0.44))), Dh = Math.round(D / 2); this.D = Dh * 2;
    // 底座：宽 W+4，边框 2 格，沿口在硬币半厚处
    const Ds = Dh + 3;
    this.socket = octPlatePix(W + 4, H + 4, { D: Ds, rimW: 2, rim: ramp(0x2c2a36, { hi: 0x46425a }), face: ramp(0x121018, { hi: 0x1c1a24 }), body: ramp(0x1a1822, { hi: 0x26242e }) });
    this.socket.model.position.z = -Dh - Ds; this.root.add(this.socket.model);
    this.shadow = contactShadow(W + 4, H + 4, 0.55); this.shadow.position.set(1, -2, -Dh - Ds - 0.1); this.shadow.renderOrder = -1; this.root.add(this.shadow);
    this.glow = stepGlow(W, H, { gap: 1, rings: 3, w: 1 }); this.glow.position.z = -Dh + 0.3; this.glow.renderOrder = 1; this.root.add(this.glow);
    // 硬币：原点 = 硬币中心
    for (let i = 0; i < 2; i++) {
      const op = octPlatePix(W, H, { D: Dh, rim: o.rim ?? PAL.gold, face: o.face ?? PAL.face });
      const g = new THREE.Group(); g.add(op.model);   // model z: 0..Dh（Dh = 边框顶）
      if (i === 1) { if (axis === 'x') g.rotation.x = Math.PI; else g.rotation.y = Math.PI; }
      this.coin.add(g); this.halves.push(op);
    }
    this.front.position.z = Dh; this.coin.add(this.front);
    this.back.position.z = -Dh; if (axis === 'x') this.back.rotation.x = Math.PI; else this.back.rotation.y = Math.PI; this.coin.add(this.back);
    this.root.add(this.coin);
  }
  /** 石面（边框顶以下 2 格）相对 front / back 组的 z */
  get faceZ() { return -2; }
  setRim(pal: number[], glow = 1) { for (const h of this.halves) h.model.setPal(G_RIM, pal, glow); }
  setFace(pal: number[]) { for (const h of this.halves) h.model.setPal(G_FACE, pal); }
  setBody(pal: number[]) { for (const h of this.halves) h.model.setPal(G_BODY, pal); }
  /** 整体亮度（< 1 变暗）；rimK = 边框另乘（> 1 发光脉动） */
  dim(k: number, rimK = 1) { for (const h of this.halves) { h.model.tintAll(k); h.model.tint(G_RIM, k * rimK); } }
  /** 翻转：转 turns 圈（1 = 360°），dur 秒；hold 秒后接下一步 */
  flip(turns: number, dur = 0.35, hold = 0) { this.queue([{ d: turns * Math.PI * 2, dur, hold }]); }
  /** 翻到背面、停 hold 秒、再翻回正面（同一方向继续转） */
  flipOver(dur = 0.28, hold = 0.35) { this.queue([{ d: Math.PI, dur, hold }, { d: Math.PI, dur, hold: 0 }]); }
  private queue(s: FlipStep[]) { this.angle = this.normal(); this.from = this.angle; this.steps = s; this.ft = 0; this.holdT = 0; }
  private normal() { const t = Math.PI * 2; return ((this.angle % t) + t) % t; }
  get flipping() { return this.steps.length > 0; }
  update(dt: number) {
    const p = this.press.step(this.down ? 1 : 0, dt); this.pressK = Math.max(-0.3, Math.min(1.15, p));
    const st = this.steps[0];
    if (st) {
      if (this.ft < 1) { this.ft = Math.min(1, this.ft + dt / st.dur); this.angle = this.from + st.d * easeBack(this.ft); }
      else { this.angle = this.from + st.d; this.holdT += dt; if (this.holdT >= st.hold) { this.steps.shift(); this.from = this.angle; this.ft = 0; this.holdT = 0; } }
      if (!this.steps.length) this.angle = this.normal();
    }
    const Dh = this.D / 2, half = (this.axis === 'x' ? this.H : this.W) / 2;
    // 转起来时按角度抬离底座：硬币在 z 方向的半宽 = |sin|·半边 + |cos|·半厚
    const s = Math.abs(Math.sin(this.angle)), c = Math.abs(Math.cos(this.angle)), lift = Math.max(0, s * half + c * Dh - Dh) + s * 2;
    this.coin.position.z = -Dh - this.pressK * (Dh - 1) + lift;
    if (this.axis === 'x') this.coin.rotation.set(this.angle, 0, 0); else this.coin.rotation.set(0, this.angle, 0);
    this.glow.visible = this.glowK > 0.02; (this.glow.material as THREE.MeshBasicMaterial).color.copy(this.glowCol).multiplyScalar(1.7 * this.glowK);
  }
  /** 外部踢一下弹簧（键盘 / 机器人点按：先按下再回弹） */
  kick(v = 9) { this.press.kick(v); }
  dispose() { for (const h of [...this.halves, this.socket]) h.model.dispose(); for (const m of [this.glow, this.shadow]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }
}
