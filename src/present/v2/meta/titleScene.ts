// Title screen with atmosphere (user: the title should be more than three heroes on a path). The forest camp at night: the three heroes
// round a dying fire, and over the embers hangs the game's sigil — a big stone die with glowing pips, turning slowly. The camera drifts.
// First the logo, centred, and a blinking 「按任意键开始」; any key / tap / pad button opens the menu (the logo moves to its corner, the
// camera eases so the fire sits right of the menu column).
import * as THREE from 'three';
import { V3, scene } from '../../engine/world';
import { shot } from '../../director';
import { type Overlay, type Pane, text, textW, PIX_H } from '../overlay';
import type { ClassId } from '../../../core/v2/types';

/** the fire in c_camp (scenes/s_forest.ts: FX 0.6, FZ −2.4) */
export const FIRE = V3(0.6, 0, -2.4);
/** where the heroes stand round it (x, z), each facing the fire */
export const TITLE_SPOTS: Record<ClassId, [number, number]> = { warrior: [FIRE.x - 1.8, FIRE.z + 1.1], mage: [FIRE.x + 2.0, FIRE.z + 0.6], rogue: [FIRE.x - 1.6, FIRE.z - 1.4] };
/** they face the fire, turned a little toward the camera (three-quarter view, not their backs) */
export const TITLE_FACE = V3(FIRE.x + 0.8, 0, FIRE.z + 3.6);

// standard pips on a 3×3 grid per face (1 opposite 6, 2 opposite 5, 3 opposite 4)
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** the sigil die: a carved stone cube (sharp edges, a raised rim on each face), gold pips that bloom, a warm point light */
function sigilDie() {
  const g = new THREE.Group(), S = 0.9, h = S / 2;
  const stone = new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.85 }), rim = new THREE.MeshStandardMaterial({ color: 0x5c5470, roughness: 0.7 });
  const pip = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.6), toneMapped: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), stone); body.castShadow = true; g.add(body);
  // 12 edge bars, axis-aligned, slightly proud of the faces: the carved rim
  const e = 0.09, L = S + 0.02, bar = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), rim); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
  for (const a of [-1, 1]) for (const b of [-1, 1]) { bar(L, e, e, 0, a * h, b * h); bar(e, L, e, a * h, 0, b * h); bar(e, e, L, a * h, b * h, 0); }
  // faces: +x 1, −x 6, +y 2, −y 5, +z 3, −z 4
  const faces: Array<[number, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
    [1, V3(1, 0, 0), V3(0, 0, -1), V3(0, 1, 0)], [6, V3(-1, 0, 0), V3(0, 0, 1), V3(0, 1, 0)],
    [2, V3(0, 1, 0), V3(1, 0, 0), V3(0, 0, -1)], [5, V3(0, -1, 0), V3(1, 0, 0), V3(0, 0, 1)],
    [3, V3(0, 0, 1), V3(1, 0, 0), V3(0, 1, 0)], [4, V3(0, 0, -1), V3(-1, 0, 0), V3(0, 1, 0)],
  ];
  const pg = new THREE.BoxGeometry(0.15, 0.15, 0.15), step = 0.24;
  for (const [n, nrm, u, v] of faces) for (const [a, b] of PIPS[n]) {
    const m = new THREE.Mesh(pg, pip); m.position.copy(nrm).multiplyScalar(h - 0.055).addScaledVector(u, a * step).addScaledVector(v, b * step); g.add(m);
  }
  const light = new THREE.PointLight(0xffc860, 5, 7, 1.8); g.add(light);
  return g;
}

export class TitleScene {
  on = false; pressed = false;
  private die: THREE.Group | null = null; private logo: Pane | null = null; private prompt: Pane | null = null;
  private t = 0; private side = 0; private sideTo = 0; private padWas = true;
  onPress: (() => void) | null = null;
  constructor(private ov: Overlay) {}
  enter(onPress: () => void) {
    this.exit(); this.on = true; this.pressed = false; this.onPress = onPress; this.t = 0; this.side = this.sideTo = 0; this.padWas = true;
    this.die = sigilDie(); this.die.position.set(FIRE.x, 2.5, FIRE.z); this.die.rotation.set(0.42, 0.6, 0.3); scene.add(this.die);
    this.logo = this.ov.pane(82); this.prompt = this.ov.pane(82);
    // the camera drifts on a shallow arc in front of the fire; `side` slides the fire right of the menu column once it opens
    shot('title', t => {
      const a = 0.22 + 0.14 * Math.sin(t * 0.05), r = 9.2, c = FIRE;
      const base = V3(c.x + Math.sin(a) * r, 3.3 + 0.25 * Math.sin(t * 0.07), c.z + Math.cos(a) * r);
      const right = V3(Math.cos(a), 0, -Math.sin(a));
      // attract: look up at the die between the logo and the prompt; menu: the fire right of the menu column
      return { base, look: V3(c.x, 1.45 + 0.75 * (1 - this.side), c.z).addScaledVector(right, -2.8 * this.side), fov: 45 };
    }, { cut: true });
    this.paint();
  }
  exit() {
    this.on = false;
    if (this.die) { this.die.parent?.remove(this.die); this.die.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); this.die = null; }
    for (const p of [this.logo, this.prompt]) if (p) this.ov.drop(p); this.logo = this.prompt = null;
  }
  /** any key / tap / pad button while the prompt shows → the menu */
  press() {
    if (!this.on || this.pressed) return false;
    this.pressed = true; this.sideTo = 1; if (this.logo) this.logo.visible = false; if (this.prompt) this.prompt.visible = false;
    this.onPress?.(); return true;
  }
  /** back to the attract state (menu closed by Esc on the title list) */
  unpress() { if (!this.on) return; this.pressed = false; this.sideTo = 0; this.paint(); }
  paint() {
    const ov = this.ov, k = ov.dpr, W = ov.w, H = ov.h, fp = ov.fp; if (!this.logo || !this.prompt) return;
    const sL = Math.max(4, Math.round(fp * 5)), s1 = Math.max(2, Math.round(fp * 1.5)), s2 = Math.max(2, Math.round(fp * 2));
    const t = '六面史诗', sub = '第一章 · 幽暗森林', lw = Math.max(textW(t, sL), textW(sub, s1)) + 60, lh = PIX_H * sL + 22 + PIX_H * s1 + 20;
    this.logo.paint('tl' + W + sL, lw, lh, g => {
      // a dark drop under the letters (offset by one font pixel, axis-aligned) so the logo reads over the bright fire
      text(g, t, (lw * k) / 2 + sL * k, 6 * k + sL * k, sL * k, '#140c18', 'center');
      text(g, t, (lw * k) / 2, 6 * k, sL * k, '#ffe2a0', 'center');
      text(g, sub, (lw * k) / 2, (6 + PIX_H * sL + 22) * k, s1 * k, '#d8c8e8', 'center');
    });
    this.logo.at(W / 2 - lw / 2, Math.round(H * 0.045)); this.logo.visible = !this.pressed;
    const touch = typeof window !== 'undefined' && 'ontouchstart' in window, pt = touch ? '点击屏幕开始' : '按任意键开始', pw = textW(pt, s2) + 40, ph = PIX_H * s2 + 20;
    this.prompt.paint('tp' + pt + s2, pw, ph, g => { text(g, pt, (pw * k) / 2 + s2 * k / 2, 10 * k + s2 * k / 2, s2 * k, '#140c18', 'center'); text(g, pt, (pw * k) / 2, 10 * k, s2 * k, '#fff4dc', 'center'); });
    this.prompt.at(W / 2 - pw / 2, Math.round(H * 0.86)); this.prompt.visible = !this.pressed;
  }
  private last = 0;
  /** runs on real time (performance.now): clock.rdt follows FX.speed, like the menus (menu.ts) */
  tick() {
    const now = performance.now(), rdt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0; this.last = now;
    if (!this.on) return;
    this.t += rdt; this.side += (this.sideTo - this.side) * (1 - Math.exp(-2.2 * rdt));
    if (this.die) { this.die.rotation.y += rdt * 0.35; this.die.position.y = 2.5 + 0.09 * Math.sin(this.t * 1.3); }
    if (this.prompt && !this.pressed) this.prompt.alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(this.t * 3.2));
    // any pad button (ignore one held over from the previous screen)
    const p = Array.from((globalThis.navigator as Navigator | undefined)?.getGamepads?.() ?? []).find(x => x && x.connected);
    const any = !!p && p.buttons.some(b => b.pressed);
    if (any && !this.padWas && !this.pressed) this.press();
    this.padWas = any;
  }
}
