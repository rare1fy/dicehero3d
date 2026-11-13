// One skill slot of the R5 skill bar, three layers (UX_V3 2b): the plate (octagon stone + rim + energy ring + tier rays + the icon's
// shadow on the face), the floating icon (its own top-level group in the UI layer so the perspective tilts it on its own and the
// lift shows parallax), and the front layer (tier lamps and the pattern badge in 3D; the tag capsule, value pill, target portrait and
// the tier-2 extra icon as crisp overlay panes). `big` (0..1) morphs a small slot into the play button.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { lampMat, Spring, UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { glowRing, skillIcon, patternBadge, modelLook } from './models';
import { PixPlate } from './pixPlate';
import { lampRow } from './pixParts';
import { GRID, PAL } from '../../ui3d/pixelGrid';
import type { PixModel } from '../../ui3d/pixMesh';
import type { Glyph } from './draw';
import { paintSlotFront } from './slotFront';
import { lerp, ease } from '../../engine/clock';
import { cue } from '../../../audio/cues';

export type SkillKind = 'basic' | 'same' | 'straight' | 'array';
export interface SlotDef { name: string; kind: SkillKind; tag: string; tagCol: string; /** tier-3 icon (升级版), if any */ up?: string; /** badge override ('handful' = 1–3 loose dice) */ badge?: string }
export interface SlotState { lit: boolean; tier: number; dead: boolean; ready: boolean; value?: number; targetKind?: string; targetId?: string; /** what the value is (damage = no mark) */ valKind?: 'dmg' | 'armor' | 'barrier' | 'heal'; all?: boolean; ultimate?: boolean; extra?: Glyph | null; /** rogue v4: this strike's combo bonus and whether it is the last strike */ combo?: { pct: number; last: boolean } | null }

const GOLD = 0xd8a040, GOLD2 = 0xffb02a, PALE = 0x8adcf0, IRON = 0x5a5866;
const TAG_COL: Record<string, string> = { 单体: '#f0e6d0', 控制: '#6ae0ff', 弹射: '#ffd84a', 爆发: '#ff9a40', 补骰: '#7ae07a', 防御: '#a8b8cc', 横扫: '#ffb050', 吸血: '#ff7a7a', 处决: '#ff6060', 群毒: '#8ae05a' };
export const tagColor = (t: string) => TAG_COL[t] || '#f0e6d0';

export class Slot3D {
  root = new THREE.Group(); iconG = new THREE.Group(); pp: PixPlate; private fx = new THREE.Group(); private lampsPix: PixModel; private icon: THREE.Object3D; private iconUp: THREE.Object3D | null = null;
  private shadow: THREE.Mesh; private ring: THREE.Mesh; private outer: THREE.Mesh; private rays = new THREE.Group(); private halo: THREE.Mesh;
  private lampBar = new THREE.Group(); private lamps: THREE.Mesh[] = []; private lampOn: THREE.MeshBasicMaterial; private lampOff: THREE.MeshBasicMaterial; private badge: THREE.Object3D;
  tag: Pane; val: Pane; tgt: Pane; ext: Pane; cmb: Pane;
  /** current / target px pose and morph */
  cx = 0; cy = 0; size = 80; tx = 0; ty = 0; ts = 80; big = 0; tBig = 0; dim = 0; tDim = 0; vis = 0; tVis = 1;
  st: SlotState = { lit: false, tier: 0, dead: false, ready: false }; press = 0; aimK = 0; k = 1;
  /** where the aim arrow ends (CSS px), set by the skill bar while this slot is aimed */
  aim: { x: number; y: number } | null = null;
  private lift = 4; private shownTier = 0; bump = new Spring(500, 18); private popT = 1; private flashT = 0; t = Math.random() * 6; private wave = 1;
  constructor(private L: UiLayer, private ov: Overlay, public def: SlotDef, private sparks: UiSparks) {
    // R6: the pixel plate (28 cells idle, 20 shrunk, 66×56 the play button, 48×40 two buttons side by side); root unit = 1 CSS px
    this.pp = new PixPlate([[28, 28], [20, 20], [66, 56], [48, 40]], { rim: PAL.iron, face: PAL.face }); this.root.add(this.pp.root, this.fx);
    this.lampsPix = lampRow(3, 3, 1); this.pp.root.add(this.lampsPix);
    this.halo = glowRing(0xffc040, 0.9, 1.22, 8, Math.PI * 2, Math.PI / 8); this.halo.position.z = -0.1; this.fx.add(this.halo);
    this.ring = glowRing(0x40e0ff, 1.12, 1.24, 72); this.ring.rotation.x = -1.18; this.ring.position.set(0, -0.32, 0); this.fx.add(this.ring);
    this.outer = glowRing(0xffa030, 1.28, 1.34, 8, Math.PI * 2, Math.PI / 8); this.outer.position.z = -0.05; this.fx.add(this.outer);
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALE).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); const a = i * Math.PI / 4; sp.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, -0.1); sp.rotation.z = a - Math.PI / 2; this.rays.add(sp); }
    this.fx.add(this.rays);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })); this.shadow.position.z = 0.33; this.fx.add(this.shadow);
    // lamps: a dark bar on the top edge with three lamps
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.12), new THREE.MeshToonMaterial({ color: 0x14121c })); this.lampBar.add(bar);
    this.lampOn = lampMat(0x6ae8ff, 2.2); this.lampOff = new THREE.MeshBasicMaterial({ color: 0x3a3a48, toneMapped: false });
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12).rotateX(Math.PI / 2), this.lampOff); l.position.set((i - 1) * 0.19, 0, 0.08); this.lampBar.add(l); this.lamps.push(l); }
    this.lampBar.position.set(0, 0.3, 0.36); this.fx.add(this.lampBar);
    this.badge = patternBadge(def.badge || def.kind); this.badge.scale.multiplyScalar(0.3); this.fx.add(this.badge);
    this.icon = skillIcon(def.name); this.iconG.add(this.icon);
    L.scene.add(this.root, this.iconG);
    this.tag = ov.pane(9); this.val = ov.pane(15); this.tgt = ov.pane(15); this.ext = ov.pane(15); this.cmb = ov.pane(15);
  }
  setDef(def: SlotDef) {
    if (def.name === this.def.name && def.kind === this.def.kind && def.up === this.def.up && def.badge === this.def.badge) { this.def = def; return; }
    this.def = def; this.iconG.remove(this.icon); this.icon = skillIcon(def.name); this.iconG.add(this.icon);
    if (this.iconUp) { this.iconG.remove(this.iconUp); this.iconUp = null; }
    this.fx.remove(this.badge); this.badge = patternBadge(def.badge || def.kind); this.badge.scale.multiplyScalar(0.3); this.fx.add(this.badge); this.tag.key = '';
  }
  set(s: SlotState) {
    const was = this.st; this.st = s;
    if (s.lit && !was.lit) { this.popT = 0; this.shownTier = 0; }
    if (s.lit && s.tier !== this.shownTier) {
      const up = s.tier > this.shownTier; this.shownTier = s.tier;
      if (up) { this.bump.kick(9); this.flashT = 1; cue('tick', 0.5 + s.tier * 0.15, 1 + s.tier * 0.2); if (s.tier >= 3) { this.wave = 0; cue('reveal', 1.2); this.sparks.burst(this.L.at(this.cx, this.cy, 4), 26, this.L.px(320), this.L.px(6), PALE, { life: 0.5 }); } }
    }
  }
  /** hit area ≥ 88 reference px (UX_V3 §1b) even when the slot looks small */
  hit(x: number, y: number) { const r = Math.max(44 * this.k, this.size * (this.big > 0.5 ? 0.62 : 0.55)); return this.vis > 0.5 && Math.abs(x - this.cx) < r * (1 + this.big * 0.15) && Math.abs(y - this.cy) < r; }
  /** where the drag arrow starts (top of the button) */
  top() { return { x: this.cx, y: this.cy - this.size * 0.4 }; }
  iconPx() { return this.L.toPx(this.iconG.position); }

  update(dt: number) {
    this.t += dt; const L = this.L, k = 1 - Math.exp(-dt * 14), s = this.st;
    this.cx = lerp(this.cx, this.tx, k); this.cy = lerp(this.cy, this.ty, k); this.size = lerp(this.size, this.ts, k);
    this.big = lerp(this.big, this.tBig, 1 - Math.exp(-dt * 12)); this.dim = lerp(this.dim, this.tDim, k); this.vis = lerp(this.vis, this.tVis, k);
    this.popT = Math.min(1, this.popT + dt / 0.3); this.flashT = Math.max(0, this.flashT - dt * 3); this.wave = Math.min(1, this.wave + dt / 0.5);
    const B = this.big, tier = s.lit ? Math.max(1, s.tier) : 0, bp = this.bump.step(0, dt), on = this.vis > 0.02;
    this.root.visible = this.iconG.visible = on;
    // plate pose: a little wider when it is the play button; pressed while aiming
    // R6: root unit = 1 CSS px; the pixel plate in art pixels (front face at z = 0), the older radius-1 extras in fx
    L.at(this.cx, this.cy, 0, this.root.position); this.root.scale.setScalar(L.px(1));
    const sc = this.size / 2 * (1 + bp * 0.012) * Math.max(0.01, this.vis), uc = GRID.uc;
    this.fx.scale.set(sc * (1 + B * 0.16), sc * (1.04 - B * 0.06), sc); this.fx.position.z = -0.34 * sc;
    this.pp.root.scale.setScalar(uc); this.pp.pressK = Math.min(1, this.press);
    // R7: at rest the shell has exactly the cell count of its target size (1 voxel = 1 art pixel); mid-morph the nearest one is scaled
    const tB = this.tBig, tw = Math.round(this.ts * (1 + tB * 0.16) / uc), th = Math.round(this.ts * (1.04 - tB * 0.06) / uc); this.pp.ensure(tw, th);
    const pv = this.pp.use(sc * 2 * (1 + B * 0.16) / uc, sc * 2 * (1.04 - B * 0.06) / uc);
    // rim / face by state (Figma 附录 A: 可用 = gold rim; dead = grey)
    // user 11-13: 「可以触发的技能的状态UI语义提示不够，现在就是给材质换了个颜色，让人以为它本来就那样的」 — a ready (not yet lit) slot
    // breathes: the rim swaps gold ↔ hot gold on each breath (no brightness boost above 1: that bloomed the slot white), a faint stepped
    // glow ring breathes round it, the icon rises and bobs higher, and a pale glint crosses the rim every 1.6 s
    const rdy = s.ready && !s.lit && !s.dead && B < 0.5 ? 1 - B * 2 : 0, breath = 0.5 + 0.5 * Math.sin(this.t * 4.2), sweep = ((this.t * 0.62) % 1);
    const readyRim = sweep < 0.06 ? PAL.pale : breath > 0.55 ? PAL.goldHot : PAL.gold;
    this.pp.setRim(s.dead ? PAL.dead : B > 0.5 ? (tier >= 3 ? PAL.pale : tier === 2 ? PAL.goldHot : PAL.gold) : s.ready ? readyRim : PAL.iron);
    this.pp.dim(1 - this.dim * 0.45, B > 0.5 ? 1 + B * (0.12 + 0.1 * Math.sin(this.t * 4) + this.flashT * 0.5) : 1);
    this.pp.glowK = B * (0.55 + 0.2 * Math.sin(this.t * 3) + this.flashT * 0.5) + rdy * (0.04 + 0.06 * breath); this.pp.glowCol.setHex(tier >= 3 ? 0x80e0ff : 0xffb040);
    this.pp.outerK = B > 0.05 && tier >= 2 ? B * (0.5 + 0.3 * Math.sin(this.t * 6)) + this.flashT * 0.4 : 0; this.pp.outerCol.setHex(tier >= 3 ? 0x9ae8ff : 0xffa030);
    this.pp.update(); this.halo.visible = false; this.outer.visible = false;
    // pixel lamps on the top edge (big only): lit = tier
    this.lampsPix.visible = B > 0.3; this.lampsPix.position.set(0, pv.H / 2 - 1, 1); this.lampsPix.scale.setScalar(Math.max(0.01, B) * (1 + B * 0.6));
    for (let i = 0; i < 3; i++) this.lampsPix.setPal(1 + i, i < tier ? (tier >= 3 ? PAL.pale : PAL.cyan) : PAL.dead, i < tier ? 2.2 : 1);
    this.ring.visible = B > 0.05; this.ring.rotation.z = this.t * 0.8; (this.ring.material as THREE.MeshBasicMaterial).opacity = B * (0.65 + 0.2 * Math.sin(this.t * 5)) + this.aimK * 0.3;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(this.aimK > 0.5 ? 0xff8a30 : 0x40e0ff);
    this.rays.visible = B > 0.05 && tier >= 3; this.rays.rotation.z = this.t * 0.4; this.rays.scale.setScalar(0.9 + 0.1 * Math.sin(this.t * 7) + (1 - this.wave) * 0.6);
    for (const r of this.rays.children) ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = B * (0.8 - (1 - this.wave) * 0.3);
    // lamps (big only) and the badge (bottom edge when small, bottom-left corner when big; never scaled up)
    this.lampBar.visible = false;
    this.lamps.forEach((l, i) => { l.material = i < tier ? this.lampOn : this.lampOff; });
    const bs = 0.44 / (1 + B * 0.6); this.badge.scale.setScalar(bs); this.badge.position.set(lerp(0, -0.6, B), lerp(-0.8, -0.36, B), 0.42);
    // the floating icon: lift by state (dim 4 / ready 7 / tier 12 / 16 / 22 px), bob, spin on activation, tier-3 upgrade
    const liftT = s.dead || this.dim > 0.5 ? 4 : s.lit ? [12, 12, 16, 22][Math.min(3, tier)] : s.ready ? 11 + 3 * Math.sin(this.t * 4.2) : 5;
    this.lift = lerp(this.lift, liftT, k);
    const pop = this.popT < 1 ? Math.sin(this.popT * Math.PI) * 16 : 0, bob = Math.sin(this.t * Math.PI) * 2;
    // R7B 追加 8（用户：「技能激活待释放的时候按钮上的技能图标模型要再放大一些」「甚至立起来一些」）：长成出牌按钮时图标放大到约 1.4 倍、
    // 往上抬，并朝镜头立起约 30°；瞄准时朝目标方向倾。上限从 74 提到 112（参考 px），顶部仍按包围盒压在按钮上沿以下。
    const grow = 1 + 0.4 * B;
    const isz = Math.min(B > 0.5 ? 112 * this.k : Infinity, this.size * lerp(0.56, 0.62, B) * grow * (s.lit ? [1, 1.06, 1.12, 1.2][Math.min(3, tier)] : 1) * Math.max(0.01, this.vis) * (s.dead ? 0.8 : 1 - this.dim * 0.12));
    const ix = this.cx, iy = this.cy - lerp(this.lift * 0.4, this.size * 0.34, B) - (this.lift * 0.6 + pop + bob)*this.k;
    // in front of the plate face (front ≈ 0.17 × size) by the lift: the perspective shows the gap
    L.at(ix, iy, 0, this.iconG.position); this.iconG.position.z = L.px(isz * 0.16 + this.lift * 0.8 * this.k);
    const want = tier >= 3 && B > 0.5 && this.def.up ? 1 : 0;
    if (want && !this.iconUp) { this.iconUp = skillIcon(this.def.up!); this.iconG.add(this.iconUp); }
    this.icon.visible = !(want && this.iconUp); if (this.iconUp) this.iconUp.visible = !!want;
    const gl = s.dead ? 0.25 : s.lit ? [1.2, 1.2, 1.5, 1.9][Math.min(3, tier)] : s.ready ? 0.95 + 0.12 * Math.sin(this.t * 4.2) : 0.6, dm = s.dead ? 0.75 : this.dim * 0.6;
    modelLook(this.icon, gl, dm); if (this.iconUp) modelLook(this.iconUp, gl, dm); modelLook(this.badge, 1, s.dead ? 0.6 : this.dim * 0.4);
    this.iconG.scale.setScalar(L.px(isz));
    const spin = this.popT < 1 ? ease.inOut(this.popT) * Math.PI * 2 : 0;
    // stand up toward the camera when big (+0.52 rad ≈ 30°); while aiming lean toward the arrow's end
    const lean = this.aim ? Math.max(-0.5, Math.min(0.5, (this.aim.x - this.cx) / Math.max(1, this.size * 3))) * this.aimK : 0;
    this.iconG.rotation.set(-0.15 + 0.52 * B + this.aimK * -0.25, Math.sin(this.t * 0.6) * 0.25 * (1 - this.aimK) + spin - lean * 0.6, (tier >= 3 && B > 0.5 ? 0.12 : 0) - lean);
    if(B>0.5) { // 根据实际模型包围盒限制最高点，三档冰晶也不会侵入结束按钮。
      this.iconG.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(this.iconG), top = L.toPx(new THREE.Vector3(this.iconG.position.x,box.max.y,box.max.z));
      const floor = this.cy-118*this.k; if(top.y<floor) this.iconG.position.y-=L.px(floor-top.y);
    }
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - B) * Math.max(0.15, 1 - this.lift / 30); this.shadow.scale.setScalar(Math.max(0.3, 1 - this.lift / 40));
    // the front layer (crisp panes)
    this.paintFront(B, tier);
  }
  private paintFront(B: number, tier: number) { paintSlotFront(this, B, tier); }
  hideAll() { this.tVis = 0; }
  dispose() { this.L.scene.remove(this.root, this.iconG); this.pp.dispose(); for (const p of [this.tag, this.val, this.tgt, this.ext, this.cmb]) this.ov.drop(p); }
}
