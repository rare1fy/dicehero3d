// 心形血瓶（R6 高清像素版，UX_V3 §5b / §6b）：UI 层里一颗挤出的像素画心形玻璃瓶（美术见 flaskArt.ts）。每个体素 = 1 美术像素：
// place() 给的高度正好 = FH 格 × GRID.uc 时，1 体素对上 1 美术像素（玩家区 status.placeZone 就是这么给的）；别的尺寸照常等比缩放。
// 液面 = HP 比例（按格取整成台阶），受击时液面按列晃成台阶、整瓶按整格抖一下、溅血；刚掉的血留一截浅色残影约 0.4 秒缩回；
// DoT（中毒 + 灼烧）回合末要扣的那截画成更暗的一段并慢闪；残血两级横竖裂纹。护甲：右下挂一面像素铁盾（showShield）；屏障：
// 心形外 3 圈阶梯光（showDome）。血量数字由玩家区（v2/hud/status.ts）画在瓶上。
import * as THREE from 'three';
import { UiLayer } from './layer';
import { UiSparks, Spring } from './vox';
import { cue } from '../../audio/cues';
import { buildHeart, buildNeck, buildDome, buildShield, levelRow, FH, HH, DEPTH, type HeartMesh } from './flaskArt';

export interface FlaskState { hp: number; maxHp: number; armor: number; barrier: number }

export class HeartFlask {
  root = new THREE.Group(); private body = new THREE.Group();
  private heart: HeartMesh; private shield: THREE.Group; private dome: THREE.Mesh;
  private sparks: UiSparks;
  /** layout: centre (CSS px) and height (px) */
  x = 110; y = 600; sizePx = 150;
  st: FlaskState = { hp: 1, maxHp: 1, armor: 0, barrier: 0 };
  /** HP the poison / burn will take at turn end (drawn as a darker cut at the top of the blood) */
  dot = 0; private cutShown = 0;
  /** the armour shield and the barrier rings (v2 shows armour / barrier in the status rows instead) */
  showShield = false; showDome = false;
  /** thickness multiplier (the extruded heart reads as a solid bottle under the UI perspective) */
  depthK = 1.75;   // user 11-14 (调参): 血瓶厚 1.75
  private shown = 1; private ghost = 1; private wave = new Spring(90, 3.2); private rock = new Spring(140, 7); private pop = new Spring(260, 14);
  private ghostFrom = 1; private ghostAge = 1;
  private shieldK = 0; private shieldPop = new Spring(300, 12); private domeK = 0; private time = 0; private crackK = [0, 0];
  constructor(private L: UiLayer) {
    this.sparks = new UiSparks(L.scene, 120);
    L.scene.add(this.root); this.root.add(this.body);
    this.heart = buildHeart(); this.body.add(this.heart.mesh);
    this.body.add(buildNeck());
    this.dome = buildDome(); this.dome.visible = false; this.dome.renderOrder = 2; this.root.add(this.dome);
    this.shield = new THREE.Group(); const sh = buildShield(); sh.position.z = 0; this.shield.add(sh);
    this.shield.position.set(11, -(HH / 2) + 2, 1); this.shield.scale.setScalar(0.001); this.root.add(this.shield);
  }

  /** layout in CSS px: centre and height */
  place(x: number, y: number, sizePx: number) { this.x = x; this.y = y; this.sizePx = sizePx; }
  /** set the values (no animation of its own: use hit() / heal() for the beats) */
  set(s: Partial<FlaskState>) {
    const a0 = this.st.armor, b0 = this.st.barrier; Object.assign(this.st, s);
    const f = Math.max(0, Math.min(1, this.st.hp / Math.max(1, this.st.maxHp)));
    if (f < this.shown) { this.ghostFrom = Math.max(this.ghost, this.shown); this.ghostAge = 0; }
    else if (f > this.shown) { this.ghost = f; this.ghostAge = 1; }
    this.shown = f;
    if (this.st.armor > a0) { this.shieldPop.kick(14); cue('armor', 0.6); }
    if (this.st.barrier > 0 && b0 <= 0) cue('magic', 0.5);
  }
  /** take a hit: the blood drops, sloshes and splashes; armour / barrier soak first (pass what is left after the rules) */
  hit(dmg: number, s?: Partial<FlaskState>) {
    if (s) this.set(s);
    const k = Math.min(1, 0.35 + dmg / 25);
    this.wave.kick(26 * k); this.rock.kick((Math.random() < 0.5 ? -1 : 1) * 9 * k); this.pop.kick(-8 * k);
    const top = this.L.at(this.x, this.y - this.sizePx * 0.3, 6);
    this.sparks.burst(top, Math.round(10 + 16 * k), this.L.px(260), this.L.px(5), 0xd01a2a, { life: 0.7, grav: this.L.px(900), up: this.L.px(220), k: 1 });
    cue('hurt', 0.4 + k * 0.5);
  }
  heal(s?: Partial<FlaskState>) { if (s) this.set(s); this.wave.kick(10); this.sparks.burst(this.L.at(this.x, this.y, 6), 14, this.L.px(120), this.L.px(5), 0x7aff9a, { life: 0.6, up: this.L.px(140) }); cue('heal', 0.6); }
  /** where the flask sits (CSS px) — fly targets */
  anchor() { return { x: this.x, y: this.y }; }

  update(dt: number) {
    this.time += dt;
    const L = this.L, f = Math.max(0, Math.min(1, this.st.hp / Math.max(1, this.st.maxHp)));
    this.shown = f; this.ghostAge = Math.min(1, this.ghostAge + dt / 0.4);
    this.ghost = f + (this.ghostFrom - f) * (1 - this.ghostAge) ** 2;
    const w = this.wave.step(0, dt), rk = this.rock.step(0, dt), pp = this.pop.step(0, dt);
    // 1 cell = sizePx / FH CSS px; the hit shake moves the whole flask by whole cells (no rotation: pixel art stays square)
    const uc = this.sizePx / FH, sx = Math.round(rk * 0.25), sy = Math.round(-pp * 0.2);
    L.at(this.x + sx * uc, this.y + sy * uc, 0, this.root.position); this.root.scale.set(L.px(uc), L.px(uc), L.px(uc) * this.depthK);
    this.root.rotation.set(0, 0, 0);
    // the blood: rows (heart grid) quantised in the shader; a little floor so any HP > 0 shows the tip
    const u = this.heart.u, row = (v: number) => { const r = levelRow(v); return v > 0 ? Math.min(HH - 1, r) : r; };
    u.uSurf.value = row(this.shown); u.uGhost.value = row(Math.max(this.shown, this.ghost));
    u.uAmp.value = this.shown > 0.01 ? Math.min(2.4, Math.abs(w) * 0.1) : 0; u.uTime.value = this.time;
    // the DoT cut (the digits are drawn by the HUD's status rows)
    const cf = Math.max(0, Math.min(1, (this.st.hp - this.dot) / Math.max(1, this.st.maxHp)));
    this.cutShown += ((this.dot > 0 ? cf : this.shown) - this.cutShown) * Math.min(1, dt * 6);
    u.uCut.value = this.dot > 0 ? levelRow(this.cutShown) : -99; u.uPulse.value = 0.5 + 0.5 * Math.sin(this.time * 4);
    // cracks
    const low = f < 0.3 ? 1 : 0, vlow = f < 0.15 ? 1 : 0;
    for (const [i, on] of [low, vlow].entries()) { if (on && !this.crackK[i]) { cue('shatter', 0.4); this.sparks.burst(L.at(this.x, this.y, 8), 10, L.px(160), L.px(4), 0xe8f2ff, { life: 0.4 }); } this.crackK[i] = on; }
    u.uCrack.value = vlow ? 2 : low ? 1 : 0;
    // armour shield
    const sp = this.shieldPop.step(0, dt);
    this.shieldK += ((this.st.armor > 0 ? 1 : 0) - this.shieldK) * Math.min(1, dt * 10);
    this.shield.scale.setScalar(Math.max(0.001, this.shieldK * (1 + sp * 0.02)));
    this.shield.visible = this.showShield && this.shieldK > 0.01;
    // barrier: stepped rings, a slow breathing
    this.domeK += ((this.st.barrier > 0 ? 1 : 0) - this.domeK) * Math.min(1, dt * 6);
    this.dome.visible = this.showDome && this.domeK > 0.01;
    (this.dome.material as THREE.MeshBasicMaterial).color.setHex(0x4aa8ff).multiplyScalar(this.domeK * (1.2 + 0.3 * Math.sin(this.time * 3.4)));
    this.sparks.update(dt);
    void DEPTH;
  }
}
