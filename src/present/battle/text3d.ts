// In-world text as camera-facing sprites (canvas textures): damage numbers, status words, the hand-type title, speech lines.
// A quick stand-in for the v6 3D block text (02x_text3d.js), which is ported next; the call sites stay the same.
import * as THREE from 'three';
import { scene, canvasTex, V3 } from '../engine/world';
import { anim, ease, lerp } from '../engine/clock';

export interface TextOpts { color?: string; stroke?: string; size?: number; bold?: boolean; bg?: string; maxW?: number }

function makeSprite(text: string, o: TextOpts) {
  const px = 64, font = `${o.bold === false ? '' : 'bold '}${px}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
  const lines = String(text).split('\n');
  const measure = canvasTex(4, 4, () => {}); const mg = measure.userData.canvas.getContext('2d') as CanvasRenderingContext2D; mg.font = font;
  const w = Math.ceil(Math.max(...lines.map(l => mg.measureText(l).width))) + 40, h = lines.length * (px + 14) + 30; measure.dispose();
  const tex = canvasTex(w, h, g => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (o.bg) { g.fillStyle = o.bg; const r = 18; g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r); g.lineTo(w, h - r); g.quadraticCurveTo(w, h, w - r, h); g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r); g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0); g.fill(); }
    lines.forEach((l, i) => {
      const y = 15 + (px + 14) * i + (px + 14) / 2;
      g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = o.stroke || 'rgba(10,6,4,0.95)'; g.strokeText(l, w / 2, y);
      g.fillStyle = o.color || '#fff4dc'; g.fillText(l, w / 2, y);
    });
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(mat); s.renderOrder = 40;
  const k = (o.size ?? 0.5) / px; s.userData.base = V3(w * k, h * k, 1); s.scale.copy(s.userData.base);
  scene.add(s);
  return s;
}
export function disposeSprite(s: THREE.Sprite) { scene.remove(s); (s.material as THREE.SpriteMaterial).map?.dispose(); s.material.dispose(); }
const setScale = (s: THREE.Sprite, k: number) => { const b = s.userData.base as THREE.Vector3; s.scale.set(b.x * k, b.y * k, 1); };

/** A number / word that pops at a point, rises and fades. */
export function popText(text: string, at: THREE.Vector3, o: TextOpts & { life?: number; rise?: number; big?: boolean } = {}) {
  const s = makeSprite(text, { size: o.big ? 0.75 : 0.5, ...o }); s.position.copy(at);
  const y0 = at.y, life = o.life ?? 1.0, rise = o.rise ?? 0.9, mat = s.material as THREE.SpriteMaterial;
  anim(life, k => {
    s.position.y = y0 + rise * ease.outCubic(k);
    setScale(s, k < 0.12 ? lerp(0.3, 1.25, k / 0.12) : lerp(1.25, 1, Math.min(1, (k - 0.12) / 0.15)));
    mat.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  }, () => disposeSprite(s));
  return s;
}

/** A title that slams in (scale overshoot) and stays until removed. */
export async function slamTitle(text: string, at: THREE.Vector3, o: TextOpts = {}) {
  const s = makeSprite(text, { size: 0.8, ...o }); s.position.copy(at); setScale(s, 2.2);
  await new Promise<void>(res => anim(0.18, k => setScale(s, lerp(2.2, 1, ease.outBack(k))), res));
  return s;
}
export function fadeOut(s: THREE.Sprite, life = 0.3) {
  const mat = s.material as THREE.SpriteMaterial, y0 = s.position.y;
  anim(life, k => { mat.opacity = 1 - k; s.position.y = y0 + k * 0.3; }, () => disposeSprite(s));
}

/** Speech line above a speaker (follows it). */
export function speech(text: string, follow: () => THREE.Vector3, life = 2.4) {
  const s = makeSprite(text, { size: 0.32, bold: false, bg: 'rgba(16,12,10,0.82)', color: '#f4e8d0', stroke: 'rgba(0,0,0,0)' });
  s.position.copy(follow()); const mat = s.material as THREE.SpriteMaterial;
  anim(life, k => { s.position.copy(follow()); mat.opacity = k < 0.08 ? k / 0.08 : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1; }, () => disposeSprite(s));
}
