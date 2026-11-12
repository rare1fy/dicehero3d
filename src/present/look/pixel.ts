// The 3D-pixel render style (from the 千珠守关「3D像素舒服版」prototype, kit_pit.js): the scene renders into a low-res art buffer
// (PX.size CSS px per art pixel, default 2) that is blown up with nearest sampling; 1-art-pixel dark outlines on silhouettes;
// flat face tones with a crisp 1-art-pixel bevel light on big block faces; square pixel particles with stepped halos; a bloom with
// a ceiling that backs off when the screen is busy; a warm-key / cool-fill light balance and a gentle S-curve grade.
// It only changes how the same scene is drawn, and it is a switch over the standard look: #px or ?px (?px=1|2|3) in the URL,
// P toggles at runtime, [ and ] change the pixel size. The HUD, relic bar and floating combat text stay at full resolution.
import * as THREE from 'three';

export const PX = {
  on: false,
  /** CSS px per art pixel (1 / 2 / 3) */
  size: 2,
  /** render-time light balance (multipliers on the scene's own lights, restored after the frame) */
  warmK: 1.5, coolK: 1.0, hemiK: 1.2, pointK: 1.0,
  /** bloom ceiling (per-pixel cap on the added glow, which is then stepped into 6 bands) and how much it backs off on busy screens */
  bloomCap: 1.1, busyDim: 0.4,
  /** silhouette outline: relative depth jump that counts as an edge, strength */
  inkT: 0.05, ink: 0.85,
  /** grade */
  curve: 0.1, sat: 1.06, vig: 0.8, exposure: 1.08,
};

/** shared shader uniforms (materials keep references, so toggling never recompiles) */
export const PXU = { uPx: { value: 0 }, uPxEdge: { value: 0.32 }, uArtH: { value: 360 }, uPxMin: { value: 2.5 } };

type Sub = () => void;
const subs: Sub[] = [];
export function onPixelChange(fn: Sub) { subs.push(fn); }
function changed() { PXU.uPx.value = PX.on ? 1 : 0; for (const f of subs) f(); }

export function setPixel(on: boolean, size?: number) {
  PX.on = on; if (size != null && size >= 1 && size <= 3) PX.size = Math.round(size);
  changed(); return PX.on ? PX.size : 0;
}
export const togglePixel = () => setPixel(!PX.on);
export function stepPixelSize(d: number) { PX.size = Math.max(1, Math.min(3, PX.size + d)); if (!PX.on) PX.on = true; changed(); return PX.size; }

/** URL switch: #px / #px2 / #name&px (hash tokens), ?px / ?px=1|2|3 (query). Returns the hash without the px token. */
export function readPixelFlag(hash: string, query: (k: string) => string | null): string {
  const toks = hash.split(/[&+,]/).filter(Boolean), rest: string[] = [];
  let on = false, size = PX.size;
  for (const t of toks) { const m = /^px([123])?$/.exec(t); if (m) { on = true; if (m[1]) size = +m[1]; } else rest.push(t); }
  const q = query('px');
  if (q != null) { on = q !== '0'; if (/^[123]$/.test(q)) size = +q; }
  PX.on = on; PX.size = size; PXU.uPx.value = on ? 1 : 0;
  return rest.join('&');
}

/** P toggles the pixel look, [ / ] change the pixel size. */
export function installPixelKeys() {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') { togglePixel(); e.preventDefault(); }
    else if (e.key === '[') { stepPixelSize(-1); e.preventDefault(); }
    else if (e.key === ']') { stepPixelSize(1); e.preventDefault(); }
  });
}

// ---------------------------------------------------------------- light balance: a warm key and a cool fill
// The scenes light themselves (hemisphere sky, a cool moon that casts the shadows, a warm front key). The pixel look of the reference
// leans on a strong warm key and a cool fill, so for the frame we lift warm directional lights, ease cool ones and raise the hemisphere.
const saved: Array<[THREE.Light, number]> = [];
export function pxLightsBegin(scene: THREE.Scene) {
  saved.length = 0;
  for (const o of scene.children) {
    const L = o as THREE.Light; if (!L.isLight || !L.visible) continue;
    let k = 1;
    if ((L as THREE.DirectionalLight).isDirectionalLight) { const c = L.color; k = c.r > c.b * 1.08 ? PX.warmK : c.b > c.r * 1.08 ? PX.coolK : 1; }
    else if ((L as THREE.HemisphereLight).isHemisphereLight) k = PX.hemiK;
    else if ((L as THREE.PointLight).isPointLight) k = PX.pointK;
    if (k !== 1) { saved.push([L, L.intensity]); L.intensity *= k; }
  }
}
export function pxLightsEnd() { for (const [L, i] of saved) L.intensity = i; saved.length = 0; }

// ---------------------------------------------------------------- overlays kept at full resolution
// Floating combat text is a camera-facing sprite drawn on top of everything (renderOrder ≥ 40, no depth test): it belongs to the UI,
// so in the pixel look it is lifted out of the art buffer and drawn crisp after the upscale.
const overlay = new THREE.Scene(), lifted: THREE.Object3D[] = [];
export function liftOverlays(scene: THREE.Scene) {
  lifted.length = 0;
  for (const o of scene.children) {
    const s = o as THREE.Sprite;
    if (s.isSprite && s.visible && s.renderOrder >= 40 && (s.material as THREE.SpriteMaterial).depthTest === false) lifted.push(s);
  }
  for (const s of lifted) overlay.add(s);   // add() removes it from the scene
  return lifted.length;
}
export function drawOverlays(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  if (!lifted.length) return;
  const ac = r.autoClear; r.autoClear = false; r.render(overlay, camera); r.autoClear = ac;
  for (const s of lifted) scene.add(s);
  lifted.length = 0;
}
