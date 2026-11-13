// Class select, console style (user: 「选职业的画面现在也太草率了，不要常显介绍面板，点一个职业再拉近，然后出介绍的UI面板，UI面板我也
// 希望是有3D透视感一点的」): the three heroes stand on the path with small name plates only; picking one (tap, or ←→ + Enter / D-pad + A)
// dollies the camera in on that hero, who flourishes, and an info panel swings in on the right — a canvas-painted plane in the UI 3D
// layer, turned toward the screen centre so it reads with depth. Buttons under it: choose / back.
import * as THREE from 'three';
import type { ClassId } from '../../../core/v2/types';
import { CLASSES } from '../../../core/v2/data';
import { V3 } from '../../engine/world';
import { animP, ease } from '../../engine/clock';
import { shot, staticShot } from '../../director';
import type { BattleActor } from '../../bestiary/battle';
import type { UiLayer } from '../../ui3d/layer';
import { worldToUi } from '../../ui3d/layer';
import { CLASS_COL } from '../../ui3d/suitData';
import { canvasOf } from '../../hud/paint';
import { type Overlay, type Pane, panel, text, textW, pixWrap, PIX_H } from '../overlay';
import type { Menu } from './menu';
import { cue } from '../../../audio/cues';

const INFO: Record<ClassId, { hook: string; mech: string[]; skills: Array<[string, string, string]> }> = {
  warrior: {
    hook: '要么斩杀，要么毫发无伤',
    mech: ['打死敌人：得到怒火骰，再出手一次', '护甲挡住全部攻击：下回合多 1 颗骰', '卖血继续重投，血怒越高越疼；做到斩杀或完防还一半血'],
    skills: [['散骰', '劈砍 / 铁壁', '几颗都行，砍或挡二选一'], ['同点', '顺劈斩', '斩杀，溢出转给下一个'], ['连环', '盾冲', '眩晕'], ['阵列', '血战', '又斩又挡']],
  },
  mage: {
    hook: '囤一手大牌，一击毙命',
    mech: ['骰子不消散，每回合补 1 颗，最多 6 颗', '交 3 颗以内是小咒，照样吟唱、照样有屏障', '交 4 颗以上释放大招，被打会叠反噬，逼你出手'],
    skills: [['散骰', '奥术弹', '单体'], ['同点', '冰锥', '冻结'], ['连环', '闪电链', '弹射，充能下回合多 1 颗'], ['阵列', '陨石', '爆发，6 颗终极']],
  },
  rogue: {
    hook: '一回合连砍好几刀',
    mech: ['有骰子就能接着出手，每多一刀 +20%', '刀鞘是每回合出手上限，开局 2 把，会成长', '先用袖箭、影步补骰续刀，最后背刺、影舞收尾'],
    skills: [['散骰', '袖箭', '续刀：补 2～3 颗'], ['同点', '背刺', '处决'], ['连环', '影步', '交几补几'], ['阵列', '影舞', '全体中毒']],
  },
};
const IDS: ClassId[] = ['warrior', 'mage', 'rogue'];

export interface ClassPickHost { L: UiLayer; ov: Overlay; menu: Menu; scene: THREE.Scene; actors: () => BattleActor[]; pick(c: ClassId): void; back(): void }

export class ClassPick {
  on = false; focus = 1; zoomed: ClassId | null = null;
  private plates: Pane[] = []; private hint: Pane | null = null; private ring: THREE.Mesh | null = null;
  private card: THREE.Mesh | null = null; private cardTex: THREE.CanvasTexture | null = null;
  constructor(private h: ClassPickHost) {}
  open() {
    this.on = true; this.zoomed = null; this.wide(true); this.buildPlates();
    if (!this.ring) {
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 4, 1), new THREE.MeshBasicMaterial({ color: 0xf6d36b, transparent: true, opacity: 0.85, depthWrite: false }));
      this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 4; this.ring.renderOrder = 2;   // a square (diamond) ring, axis-aligned voxel feel
    }
    this.h.scene.add(this.ring); this.paintAll();
  }
  close() {
    this.on = false; for (const p of this.plates) this.h.ov.drop(p); this.plates = [];
    if (this.hint) { this.h.ov.drop(this.hint); this.hint = null; }
    this.ring?.parent?.remove(this.ring); this.dropCard(); this.h.menu.close();
  }
  private wide(cut = false) { shot('select', staticShot(V3(0, 3.4, 10.8), V3(0, 1.5, 0), 40), { cut }); }
  private buildPlates() {
    const ov = this.h.ov; for (const p of this.plates) ov.drop(p); this.plates = IDS.map(() => ov.pane(40));
    this.hint = this.hint ?? ov.pane(40);
  }
  /** name plates under the heroes + the hint; the gold diamond ring under the focused hero */
  paintAll() {
    if (!this.on) return;
    const ov = this.h.ov, k = ov.dpr, s2 = Math.max(2, Math.round(ov.fp * 1.5)), s1 = Math.max(1, Math.round(ov.fp)), acts = this.h.actors();
    IDS.forEach((c, i) => {
      const a = acts[i], p = this.plates[i]; if (!a || !p) return;
      const foc = i === this.focus, name = CLASSES[c].name, w = textW(name, s2) + 36, hh = PIX_H * s2 + 18;
      p.paint('cp' + c + foc + w, w, hh, g => {
        panel(g, 0, 0, w * k, hh * k, 3 * k, { body: foc ? 'rgba(46,40,26,0.95)' : 'rgba(20,22,30,0.82)', rim: foc ? '#f6d36b' : '#5d6475', line: '#07050a', hi: 'rgba(255,255,255,0.06)' });
        text(g, name, (w * k) / 2, 9 * k, s2 * k, foc ? '#fffaf0' : CLASS_COL[c], 'center');
      });
      const v = worldToUi(a.home.clone().add(V3(0, -0.15, 0.9))); p.at(v.x - w / 2, v.y + 6); p.visible = !this.zoomed;
    });
    if (this.hint) {
      const t = this.zoomed ? '' : '选择你的英雄　←→ / 点选　Enter / A 查看', w = textW(t, s1) + 28, hh = PIX_H * s1 + 16;
      this.hint.paint('ch' + t + w, w, hh, g => { panel(g, 0, 0, w * k, hh * k, 2 * k, { body: 'rgba(10,10,16,0.8)', rim: '#4a5060', line: '#07050a', hi: 'rgba(255,255,255,0.04)' }); text(g, t, (w * k) / 2, 8 * k, s1 * k, '#d8dce8', 'center'); });
      this.hint.at(ov.w / 2 - w / 2, ov.h - hh - 18); this.hint.visible = !this.zoomed;
    }
    const a = acts[this.focus]; if (this.ring && a) { this.ring.position.set(a.home.x, 0.03, a.home.z); this.ring.visible = !this.zoomed; this.ring.scale.setScalar(1 + 0.06 * Math.sin(performance.now() / 260)); }
  }
  move(d: number) { if (this.zoomed) return; this.focus = (this.focus + d + IDS.length) % IDS.length; cue('click', 0.4); this.paintAll(); }
  /** CSS px → which hero (screen distance to the chest) */
  hit(x: number, y: number) {
    const acts = this.h.actors(); let best = -1, bd = 120;
    acts.forEach((a, i) => { const v = worldToUi(a.chest()), d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  pointer(type: string, x: number, y: number) {
    if (!this.on) return false;
    if (this.zoomed) return this.h.menu.pointer(type, x, y);
    const i = this.hit(x, y);
    if (type === 'move' && i >= 0 && i !== this.focus) { this.focus = i; this.paintAll(); }
    if (type === 'up' && i >= 0) { this.focus = i; void this.zoom(IDS[i]); }
    return true;
  }
  key(k: 'left' | 'right' | 'ok' | 'back') {
    if (this.zoomed) return false;   // the menu has the keys while zoomed
    if (k === 'left') this.move(-1); else if (k === 'right') this.move(1); else if (k === 'ok') void this.zoom(IDS[this.focus]); else this.h.back();
    return true;
  }
  async zoom(c: ClassId) {
    const i = IDS.indexOf(c), acts = this.h.actors(), a = acts[i]; if (!a) return;
    this.zoomed = c; cue('select', 0.7); this.paintAll();
    // the hero stands at ~30% of the screen, head to shins in frame; the card fills the right; the other two step out of the shot
    const eye = a.home.clone().add(V3(0.9, 1.9, 6.4)), look = a.home.clone().add(V3(1.35, 1.15, 0));
    shot('select', staticShot(eye, look, 34), { speed: 2.2 });
    acts.forEach((o, j) => { o.root.visible = j === i; });
    a.cheer();
    const r = this.showCard(c);
    this.h.menu.open({
      title: '', anchor: { x: r.x, y: Math.round(r.y + r.h + 18), w: r.w }, dim: 0, onBack: () => this.unzoom(),
      items: [{ kind: 'btn', id: 'go', label: `选择 ${CLASSES[c].name}`, on: () => this.h.pick(c) }, { kind: 'btn', id: 'back', label: '换一个', on: () => this.unzoom() }],
    });
  }
  /** every frame: plates follow the heroes while the camera settles; D-pad / A / B when not zoomed (the menu polls its own pad) */
  private padWas: Record<string, boolean> = {};
  tick() {
    this.paintAll();
    const p = Array.from((globalThis.navigator as Navigator | undefined)?.getGamepads?.() ?? []).find(x => x && x.connected); if (!p) return;
    const ax = p.axes[0] ?? 0, st: Record<string, boolean> = { left: !!p.buttons[14]?.pressed || ax < -0.6, right: !!p.buttons[15]?.pressed || ax > 0.6, ok: !!p.buttons[0]?.pressed, back: !!p.buttons[1]?.pressed };
    const was = this.padWas; this.padWas = st;   // tracked while zoomed too, so the B that closes the card doesn't also leave the screen
    if (!this.zoomed) for (const k of ['left', 'right', 'ok', 'back'] as const) if (st[k] && !was[k]) this.key(k);
  }
  relayout() { if (this.zoomed) { const c = this.zoomed; this.h.menu.close(); this.dropCard(); void this.zoom(c); } else this.paintAll(); }
  unzoom() { this.zoomed = null; this.h.menu.close(); this.dropCard(); for (const a of this.h.actors()) a.root.visible = true; this.wide(); this.paintAll(); cue('click', 0.4); }
  // ------------------------------------------------------------ the tilted info card in the UI 3D layer
  /** builds the card, returns its screen rect (CSS px, before the tilt) */
  private showCard(c: ClassId) {
    this.dropCard();
    const ov = this.h.ov, W = ov.w, H = ov.h, kk = Math.min(1, H / 820), cw = Math.round(Math.min(600, W * 0.4)), d = Math.max(2, ov.dpr);
    const sz = { t: Math.max(3, Math.round(d * 3 * kk)), h: Math.max(2, Math.round(d * 2.5 * kk)), b: Math.max(2, Math.round(d * 2 * kk)), u: Math.max(2, Math.round(d * 1.5 * kk)) };
    const chh = Math.ceil(this.paintCard(null, c, cw * d, sz) / d);   // measure pass
    const { c: cv, g } = canvasOf(Math.round(cw * d), Math.round(chh * d)); g.imageSmoothingEnabled = false;
    this.paintCard(g, c, cw * d, sz, chh * d);
    const tex = new THREE.CanvasTexture(cv as HTMLCanvasElement); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const x = W - cw - Math.max(48, W * 0.06), y = Math.max(24, (H - chh - 150 * kk) * 0.4);
    const L = this.h.L, mesh = new THREE.Mesh(new THREE.PlaneGeometry(L.px(cw), L.px(chh)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    mesh.renderOrder = 60; L.at(x + cw / 2, y + chh / 2, 0, mesh.position); L.scene.add(mesh);
    this.card = mesh; this.cardTex = tex;
    // swing in: from edge-on to −0.3 rad (turned toward the hero), a slight lean back
    const m = mesh.material as THREE.MeshBasicMaterial; m.opacity = 0;
    void animP(0.38, t => { const e = ease.outBack(t); mesh.rotation.set(-0.05, -1.25 + (1.25 - 0.3) * e, 0); m.opacity = Math.min(1, t * 2.5); }, { real: true });
    return { x, y, w: cw, h: chh };
  }
  /** paints (or with g = null only measures) the card; returns the height used, canvas px */
  private paintCard(g: CanvasRenderingContext2D | null, c: ClassId, W: number, sz: { t: number; h: number; b: number; u: number }, H = 0) {
    const info = INFO[c], col = CLASS_COL[c], { t: sT, h: sH, b: sB, u } = sz, pad = 12 * u;
    const T = (s: string, x: number, y: number, sc: number, cl: string, al?: 'center' | 'right') => { if (g) text(g, s, x, y, sc, cl, al); };
    if (g) { panel(g, 0, 0, W, H, 3 * u, { body: 'rgba(16,18,26,0.95)', rim: '#6a7182', line: '#07050a', hi: 'rgba(255,255,255,0.07)' }); g.fillStyle = col; g.fillRect(4 * u, 4 * u, W - 8 * u, 3 * u); }
    let y = pad + 2 * u;
    T(CLASSES[c].name, pad, y, sT, '#fffaf0'); T(`生命 ${CLASSES[c].hp}`, W - pad, y + PIX_H * (sT - sH), sH, '#ff9a8a', 'right');
    y += PIX_H * sT + 8 * u; T(`「${info.hook}」`, pad, y, sH, col); y += PIX_H * sH + 12 * u;
    for (const m of info.mech) {
      const lines = pixWrap(m, (W - pad * 2 - 10 * u) / sB);
      if (g) { g.fillStyle = col; g.fillRect(pad, y + PIX_H * sB * 0.35, 3 * u, 3 * u); }   // square bullet
      for (const ln of lines) { T(ln, pad + 10 * u, y, sB, '#e4e2ec'); y += PIX_H * sB + 4 * u; }
      y += 4 * u;
    }
    y += 6 * u; if (g) { g.fillStyle = 'rgba(160,166,186,0.3)'; g.fillRect(pad, y, W - pad * 2, u); } y += 10 * u;
    const rh = PIX_H * sB + 12 * u;
    for (const [pat, name, tag] of info.skills) {
      if (g) panel(g, pad, y, W - pad * 2, rh, 2 * u, { body: 'rgba(30,32,44,0.92)', rim: '#4a5060', line: '#07050a', hi: 'rgba(255,255,255,0.05)' });
      const ty = y + 6 * u; T(pat, pad + 8 * u, ty, sB, '#9aa2bc'); T(name, pad + 8 * u + textW('同点　', sB), ty, sB, '#fffaf0'); T(tag, W - pad - 8 * u, ty, sB, col, 'right');
      y += rh + 6 * u;
    }
    return y + pad - 6 * u;
  }
  private dropCard() {
    if (this.card) { this.card.parent?.remove(this.card); this.card.geometry.dispose(); (this.card.material as THREE.Material).dispose(); this.cardTex?.dispose(); this.card = null; this.cardTex = null; }
  }
}
