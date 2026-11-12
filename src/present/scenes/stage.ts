// Stage manager: builds one chapter scene at a time (voxel geometry + its lights, fog, sky, mist, flames, water, runes) and tears
// it down when another is shown. Global lights are shared and re-tinted per scene. Returns an Env-compatible handle (phase2).
import * as THREE from 'three';
import { scene, camera, V3, onUpdate, canvasTex } from '../engine/world';
import { clock } from '../engine/clock';
import { VoxWorld } from '../look/voxkit';
import { CELL } from '../bestiary/kit';
import { glow } from '../look/toon';
import { toon } from '../look/toon';
import { buildSky, noiseTex, runeTex } from '../look/env';
import { AREA } from './props';
import { Cards, ambientTick, shaft, type Ambient } from './cards';

export interface Mood {
  sky: boolean; bg: number; fog: number; fogD: number; hemiSky: number; hemiGround: number; hemiI: number; moon: number; moonI: number; key: number; keyI: number;
  /** the flat ground beyond the built stage */
  earth: number[]; mist?: number; mistA?: number;
}
export interface Ctx {
  w: VoxWorld;
  light(p: [number, number, number], color: number, intensity?: number, dist?: number): void;
  flame(p: [number, number, number], color: number, size?: number): void;
  water(x0: number, z0: number, x1: number, z1: number, color: number): void;
  rune(x: number, y: number, z: number, r: number): void;
  onPhase(f: (k: number) => void): void;
  /** add a ready-made object (e.g. a prebuilt voxel arena mesh) to the stage */
  add(o: THREE.Object3D): void;
  /** dressing cards (grass, vines, webs, decals) collected during build, instanced after it */
  cards: Cards;
  /** the cutaway layer: roofs, ceilings, front walls and the near tops of side walls — everything that would stand between the
   *  camera and the room. Built like w (same cells, same look), but the camera hides it while it looks into the room from above
   *  (every battle view) and shows it again from far away or from below the eaves (exterior shots). Nothing here casts shadow
   *  into the room while hidden. */
  cut: VoxWorld;
  /** the eaves height (metres) of the cutaway: below it the camera is "inside" and the roof stays visible (default 3.5) */
  cutEaves(h: number): void;
  /** drifting ambient particles while this stage is up */
  ambient(a: Ambient): void;
  /** a soft light shaft from above */
  shaft(x: number, z: number, o?: { w?: number; h?: number; color?: number; tilt?: number; yaw?: number; a?: number }): void;
}
export interface SceneDef { id: string; name: string; group: '普通' | '首领' | '节点'; kind: '户外' | '室内' | '地牢' | '洞穴'; blurb: string; mood: Mood; build(c: Ctx): void; foes?: string[] }

// ------------------------------------------------------------------ shared lights, sky and mist (created once)
let G: { hemi: THREE.HemisphereLight; moon: THREE.DirectionalLight; key: THREE.DirectionalLight; sky: THREE.Mesh; skyMat: THREE.ShaderMaterial; mist: THREE.Mesh[] } | null = null;
function globals() {
  if (G) return G;
  const hemi = new THREE.HemisphereLight(0x5a6098, 0x1a1418, 0.95); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb8c4ff, 2.6); moon.position.set(-6, 14, -10); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -13, right: 13, top: 14, bottom: -12, near: 1, far: 50 }); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.02;
  scene.add(moon); scene.add(moon.target);
  const key = new THREE.DirectionalLight(0xffd2a8, 0.9); key.position.set(5, 8, 10); scene.add(key);
  const skyMat = buildSky(), sky = scene.children.find(o => (o as THREE.Mesh).material === skyMat) as THREE.Mesh;
  const nt = noiseTex(), mist: THREE.Mesh[] = [];
  // the ground mist thins out over the battle floor and thickens toward the edges (fog frames the stage without hazing the fight)
  const clearCentre = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32 + 64 * (2 / 44), 0, 32, 32 + 64 * (2 / 44), 32); gr.addColorStop(0, '#404040'); gr.addColorStop(0.24, '#404040'); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ map: nt.clone(), alphaMap: clearCentre, color: 0x5a5c8c, transparent: true, opacity: 0.08, depthWrite: false, fog: true });
    (m.map as THREE.Texture).wrapS = (m.map as THREE.Texture).wrapT = THREE.RepeatWrapping; (m.map as THREE.Texture).repeat.set(2 + i, 2 + i); (m.map as THREE.Texture).needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), m); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.2 + i * 0.25, -2); p.renderOrder = 3; scene.add(p); mist.push(p);
  }
  onUpdate((_dt, rdt) => mist.forEach((p, i) => { const map = (p.material as THREE.MeshBasicMaterial).map!; map.offset.x += rdt * (0.006 + i * 0.003); map.offset.y += rdt * 0.003 * (i % 2 ? 1 : -1); }));
  return (G = { hemi, moon, key, sky, skyMat, mist });
}

function earthTex(cols: number[]) {
  const S = 64, c = cols.map(x => '#' + new THREE.Color(x).getHexString());
  const t = canvasTex(S, S, g => { for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) { const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; g.fillStyle = c[r < 0.6 ? 0 : r < 0.85 ? 1 % c.length : 2 % c.length]; g.fillRect(x, y, 8, 8); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.repeat.set(140 / (64 * CELL), 140 / (64 * CELL));
  return t;
}

export interface Stage { def: SceneDef; root: THREE.Group; phase2(k: number): void; dispose(): void }
/** how the cutaway layer behaves: 'auto' = the camera decides, 'show' / 'hide' = forced (scene browser toggle) */
export const CUT = { mode: 'auto' as 'auto' | 'show' | 'hide', far: 30, focus: V3(0, 0, -3) };

let current: Stage | null = null;
export function showStage(def: SceneDef): Stage {
  current?.dispose();
  const g = globals(), root = new THREE.Group(); scene.add(root);
  const md = def.mood, lights: THREE.Light[] = [], flames: Array<{ m: THREE.Mesh; l?: THREE.PointLight; base: number; s: number }> = [], phase: Array<(k: number) => void> = [];
  // mood: sky or void, fog, light colours
  scene.background = new THREE.Color(md.bg); scene.fog = new THREE.FogExp2(md.fog, md.fogD);
  g.sky.visible = md.sky; g.hemi.color.set(md.hemiSky); g.hemi.groundColor.set(md.hemiGround); g.hemi.intensity = md.hemiI;
  g.moon.color.set(md.moon); g.moon.intensity = md.moonI; g.key.color.set(md.key); g.key.intensity = md.keyI;
  (g.skyMat.uniforms.uTint.value as THREE.Color).setRGB(1, 1, 1);
  for (const m of g.mist) { const mm = m.material as THREE.MeshBasicMaterial; mm.color.set(md.mist ?? 0x5a5c8c); mm.opacity = md.mistA ?? 0.08; }
  // the ground beyond the stage
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), toon(0xffffff, { map: earthTex(md.earth) })); earth.rotation.x = -Math.PI / 2; earth.position.y = -2 * CELL; earth.receiveShadow = true; root.add(earth);
  const w = new VoxWorld(CELL), cut = new VoxWorld(CELL), cards = new Cards(), amb: Ambient[] = [], cutRoot = new THREE.Group(); let eaves = 3.5;
  root.add(cutRoot);
  const ctx: Ctx = {
    cards, cut,
    cutEaves(h) { eaves = h; },
    ambient(a) { amb.push(a); },
    shaft(x, z, o) { shaft(root, x, z, { color: md.moon, ...o }); },
    w,
    light(p, color, intensity = 5, dist = 7) { const l = new THREE.PointLight(color, intensity, dist, 1.8); l.position.set(...p); scene.add(l); lights.push(l); },
    flame(p, color, size = 0.12) { const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.4, size), glow(color, 3)); m.position.set(...p); root.add(m); flames.push({ m, base: size, s: Math.random() * 10 }); },
    water(x0, z0, x1, z1, color) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82, emissive: new THREE.Color(color).multiplyScalar(0.25) }));
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2); m.renderOrder = 2; root.add(m);
    },
    rune(x, y, z, r) {
      const mat = new THREE.MeshBasicMaterial({ map: runeTex(), color: new THREE.Color(0.35, 1.6, 0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); root.add(m);
      flames.push({ m, base: -1, s: 0 });
      phase.push(k => mat.color.setRGB(0.35 + 0.4 * k, 1.6 + 1.2 * k, 0.9));
    },
    onPhase(f) { phase.push(f); },
    add(o) { root.add(o); },
  };
  def.build(ctx);
  for (const m of w.build({ glow: 2.6 })) root.add(m);
  cards.build(root);
  if (cut.cells.size) for (const m of cut.build({ glow: 2.6 })) cutRoot.add(m);
  const off = { on: true };
  onUpdate((dt, rdt) => {
    if (!off.on) return; const t = clock.rtime;
    ambientTick(amb, rdt);
    cutRoot.visible = CUT.mode === 'show' || (CUT.mode === 'auto' && (camera.position.y < eaves || camera.position.distanceTo(CUT.focus) > CUT.far));
    for (const f of flames) {
      if (f.base < 0) { f.m.rotation.z += rdt * 0.08; ((f.m.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 1.6) * 0.12); continue; }
      const s = 1 + Math.sin(t * 9 + f.s) * 0.15 + Math.sin(t * 23 + f.s) * 0.08; f.m.scale.set(s, s * 1.3, s); f.m.rotation.y += dt * 2;
    }
    lights.forEach((l, i) => { if ((l as THREE.PointLight).isPointLight) (l as THREE.PointLight).intensity = (l.userData.base ??= (l as THREE.PointLight).intensity) * (1 + Math.sin(t * 8 + i * 3) * 0.12 + Math.sin(t * 19 + i) * 0.06); });
  });
  const st: Stage = {
    def, root,
    phase2(k: number) {
      (g.skyMat.uniforms.uTint.value as THREE.Color).setRGB(1 - 0.25 * k, 1 + 0.15 * k, 1 - 0.2 * k);
      const f = scene.fog as THREE.FogExp2; f.density = md.fogD * (1 + 0.4 * k); f.color.set(md.fog).lerp(new THREE.Color(0x1a3a2c), 0.5 * k);
      g.hemi.color.set(md.hemiSky).lerp(new THREE.Color(0x3a8a5a), 0.4 * k);
      for (const p of phase) p(k);
    },
    dispose() { off.on = false; scene.remove(root); root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); for (const l of lights) scene.remove(l); if (current === st) current = null; },
  };
  current = st;
  return st;
}
export const AREA_RECT = AREA;
void V3;
