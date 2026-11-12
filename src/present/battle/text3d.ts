// In-world text as camera-facing sprites: heavy gradient numerals with ink outline and drop shadow (damage, counters, stamps),
// the hand-type title that slams in, values that fly into the weapon counter, and speech lines.
import * as THREE from 'three';
import { scene, canvasTex, V3 } from '../engine/world';
import { anim, animP, ease, lerp } from '../engine/clock';
import { FONT } from '../hud/paint';

export interface TextOpts { color?: string; gradient?: [string, string]; stroke?: string; size?: number; weight?: number; bg?: string; glow?: string }

function makeSprite(text: string, o: TextOpts) {
  const px = 96, font = `${o.weight ?? 900} ${px}px ${FONT}`;
  const lines = String(text).split('\n');
  const tmp = canvasTex(4, 4, () => {}); const mg = tmp.userData.canvas.getContext('2d') as CanvasRenderingContext2D; mg.font = font;
  const pad = 36, lh = px + 16, w = Math.ceil(Math.max(...lines.map(l => mg.measureText(l).width))) + pad * 2, h = lines.length * lh + pad; tmp.dispose();
  const tex = canvasTex(w, h, g => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (o.bg) { g.fillStyle = o.bg; const r = 28; g.beginPath(); g.moveTo(r, 4); g.lineTo(w - r, 4); g.quadraticCurveTo(w - 4, 4, w - 4, r); g.lineTo(w - 4, h - r); g.quadraticCurveTo(w - 4, h - 4, w - r, h - 4); g.lineTo(r, h - 4); g.quadraticCurveTo(4, h - 4, 4, h - r); g.lineTo(4, r); g.quadraticCurveTo(4, 4, r, 4); g.fill(); }
    lines.forEach((l, i) => {
      const y = pad / 2 + lh * i + lh / 2;
      if (o.glow) { g.save(); g.shadowColor = o.glow; g.shadowBlur = 28; g.fillStyle = o.glow; g.fillText(l, w / 2, y); g.restore(); }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(l, w / 2 + 5, y + 7);
      g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = o.stroke || 'rgba(16,6,10,0.96)'; g.strokeText(l, w / 2, y);
      if (o.gradient) { const gr = g.createLinearGradient(0, y - px / 2, 0, y + px / 2); gr.addColorStop(0, o.gradient[0]); gr.addColorStop(1, o.gradient[1]); g.fillStyle = gr; } else g.fillStyle = o.color || '#fff4dc';
      g.fillText(l, w / 2, y);
      g.globalAlpha = 0.35; g.fillStyle = '#ffffff'; g.save(); g.beginPath(); g.rect(0, y - px / 2, w, px * 0.28); g.clip(); g.fillText(l, w / 2, y); g.restore(); g.globalAlpha = 1;
    });
  });
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(mat); s.renderOrder = 40;
  const k = (o.size ?? 0.5) / px; s.userData.base = V3(w * k, h * k, 1); s.scale.copy(s.userData.base);
  scene.add(s);
  return s;
}
export function disposeSprite(s: THREE.Sprite) { scene.remove(s); (s.material as THREE.SpriteMaterial).map?.dispose(); s.material.dispose(); }
export const setScale = (s: THREE.Sprite, k: number) => { const b = s.userData.base as THREE.Vector3; s.scale.set(b.x * k, b.y * k, 1); };

/** Pop a number / word at a point: punches in, rises, fades. */
export function popText(text: string, at: THREE.Vector3, o: TextOpts & { life?: number; rise?: number; big?: boolean; drift?: number } = {}) {
  const s = makeSprite(text, { size: o.big ? 0.9 : 0.5, ...o }); s.position.copy(at);
  const y0 = at.y, x0 = at.x, life = o.life ?? 1.0, rise = o.rise ?? 0.9, mat = s.material as THREE.SpriteMaterial, dx = o.drift ?? (Math.random() - 0.5) * 0.4;
  anim(life, k => {
    s.position.y = y0 + rise * ease.outCubic(k); s.position.x = x0 + dx * k;
    setScale(s, k < 0.1 ? lerp(0.2, o.big ? 1.6 : 1.3, k / 0.1) : lerp(o.big ? 1.6 : 1.3, 1, Math.min(1, (k - 0.1) / 0.18)));
    mat.opacity = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
  }, () => disposeSprite(s));
  return s;
}

/** A title that slams in (overshoot) and stays until fadeOut. */
export async function slamTitle(text: string, at: THREE.Vector3, o: TextOpts = {}) {
  const s = makeSprite(text, { size: 0.85, ...o }); s.position.copy(at); setScale(s, 2.6);
  await animP(0.16, k => setScale(s, lerp(2.6, 1, ease.inCubic(k))));
  await animP(0.14, k => setScale(s, 1 + Math.sin(k * Math.PI) * 0.12));
  return s;
}
export function fadeOut(s: THREE.Sprite, life = 0.3) {
  const mat = s.material as THREE.SpriteMaterial, y0 = s.position.y;
  anim(life, k => { mat.opacity = 1 - k; s.position.y = y0 + k * 0.4; setScale(s, 1 + k * 0.3); }, () => disposeSprite(s));
}

/** A value that flies from a point to a moving target (die value → weapon counter). */
export function flyText(text: string, from: THREE.Vector3, to: () => THREE.Vector3, dur: number, o: TextOpts = {}) {
  const s = makeSprite(text, { size: 0.42, ...o }); s.position.copy(from);
  return animP(dur, k => { const e = ease.inCubic(k), t = to(), mid = from.clone().lerp(t, 0.5).add(V3(0, 0.8, 0)), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    s.position.set(from.x * a + mid.x * b + t.x * c, from.y * a + mid.y * b + t.y * c, from.z * a + mid.z * b + t.z * c); setScale(s, k < 0.2 ? 0.6 + k * 3 : lerp(1.2, 0.6, (k - 0.2) / 0.8)); }).then(() => disposeSprite(s));
}

/** The running total over the weapon: set a value and punch. */
export class Counter {
  s: THREE.Sprite | null = null; v = 0; constructor(private at: () => THREE.Vector3, private o: TextOpts = {}) {}
  set(v: number, punch = 1.35, o: TextOpts = {}) {
    this.v = v; const old = this.s; this.s = makeSprite(String(v), { size: 0.7, gradient: ['#fff6c8', '#ffb43a'], glow: '#ff8a20', ...this.o, ...o }); this.s.position.copy(this.at());
    if (old) disposeSprite(old);
    const s = this.s; anim(0.22, k => { if (this.s === s) { setScale(s, lerp(punch, 1, ease.outCubic(k))); s.position.copy(this.at()); } });
  }
  follow() { if (this.s) this.s.position.copy(this.at()); }
  async burst() { const s = this.s; this.s = null; if (!s) return; const mat = s.material as THREE.SpriteMaterial; await animP(0.25, k => { setScale(s, 1 + k * 0.8); mat.opacity = 1 - k; }); disposeSprite(s); }
  clear() { if (this.s) disposeSprite(this.s); this.s = null; }
}

/** Speech line above a speaker (follows it). */
export function speech(text: string, follow: () => THREE.Vector3, life = 2.4) {
  const s = makeSprite(text, { size: 0.3, weight: 700, bg: 'rgba(14,10,22,0.86)', color: '#f4e8d0', stroke: 'rgba(0,0,0,0)' });
  s.position.copy(follow()); const mat = s.material as THREE.SpriteMaterial;
  anim(life, k => { s.position.copy(follow()); mat.opacity = k < 0.08 ? k / 0.08 : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1; }, () => disposeSprite(s));
}
