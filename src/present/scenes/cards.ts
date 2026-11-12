// Dressing cards (面片): alpha-cut pixel-art sprites at the same pixel density as the blocks (one texel = one 7 cm block), placed as
// crossed quads (grass, ferns, flowers, weeds, little mushrooms), wall-hung strips (vines, moss), corner webs and ground decals
// (leaf litter, moss, cracks). They soften the block silhouettes and fill the edges of the stage with organic detail while the
// battle floor stays readable. Plus the atmosphere layer: fireflies, falling leaves, spores, dust, and moonbeam shafts.
import * as THREE from 'three';
import { canvasTex, onUpdate, V3, R } from '../engine/world';
import { clock } from '../engine/clock';
import { PADD, PALPHA, TILE } from '../engine/particles';
import { CELL } from '../bestiary/kit';
import { hash, inPlay } from './props';

// ------------------------------------------------------------------ the sprite atlas (128×128 texels), painted in code
type Rect = [number, number, number, number];
export const SPR: Record<string, Rect> = {
  grass: [0, 0, 16, 16], tallgrass: [16, 0, 16, 16], fern: [32, 0, 16, 16], flowers: [48, 0, 16, 16], weeds: [64, 0, 16, 16], shroom: [80, 0, 16, 16], bramble: [96, 0, 16, 16], reeds: [112, 0, 16, 16],
  vine: [0, 16, 16, 32], moss: [16, 16, 16, 32], web: [32, 16, 32, 32], litter: [64, 16, 32, 32], mossdecal: [96, 16, 32, 32], crack: [0, 48, 32, 32], bonesdecal: [32, 48, 32, 32], puddle: [64, 48, 32, 32], pebbles: [96, 48, 32, 32], leaf: [0, 80, 16, 16],
};
let atlas: THREE.Texture | null = null;
function paintAtlas() {
  if (atlas) return atlas;
  const t = canvasTex(128, 128, g => {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const col = (x: number, y0: number, y1: number, c: string) => { for (let y = y0; y <= y1; y++) px(x, y, c); };
    // grass: blades of different heights in two greens, darker at the root (y grows down in the canvas)
    const blades = (ox: number, oy: number, n: number, hMin: number, hMax: number, cols: string[], base: string) => { for (let i = 0; i < n; i++) { const x = ox + 1 + Math.floor(rnd() * 14), h = hMin + Math.floor(rnd() * (hMax - hMin)), c = cols[i % cols.length]; col(x, oy + 16 - h, oy + 15, c); px(x, oy + 15, base); if (rnd() < 0.4) col(x + 1, oy + 16 - Math.floor(h * 0.6), oy + 15, c); } };
    blades(0, 0, 9, 4, 10, ['#4a7a3a', '#5e9446', '#3e6a32'], '#2a4422');
    blades(16, 0, 11, 8, 15, ['#4e8240', '#6a9e4c', '#3a6430'], '#2a4422');
    // fern: a stem with level fronds getting shorter toward the tip
    for (let i = 0; i < 6; i++) { const y = 14 - i * 2, w = 6 - i; for (let k = 1; k <= w; k++) { px(40 - k, y, i % 2 ? '#3e7a3e' : '#4e8a46'); px(40 + k, y - 1, i % 2 ? '#4e8a46' : '#3e7a3e'); } col(40, y - 1, y + 1, '#2e5a2e'); }
    // flowers: grass with pale violet and white bells
    blades(48, 0, 7, 4, 9, ['#4a7a3a', '#3e6a32'], '#2a4422');
    for (const [x, y, c] of [[51, 6, '#b8a0ff'], [56, 4, '#e8e0ff'], [60, 7, '#b8a0ff']] as const) { g.fillStyle = c; g.fillRect(x, y, 2, 2); px(x, y + 2, '#3e6a32'); }
    // weeds: dry grey-brown stalks
    blades(64, 0, 8, 6, 14, ['#7a6a52', '#8a7a5e', '#5e5040'], '#3a3024');
    // small mushroom (glow variant uses its own material)
    g.fillStyle = '#d8d0e0'; g.fillRect(86, 9, 3, 7); g.fillStyle = '#7ad8ff'; g.fillRect(83, 6, 9, 3); g.fillRect(84, 5, 7, 1); g.fillStyle = '#c8f4ff'; g.fillRect(85, 6, 2, 1);
    // bramble: dark thorny twigs
    for (let i = 0; i < 5; i++) { const x = 98 + i * 3; col(x, 4 + (i % 3), 15, '#3a2a2a'); px(x + 1, 7 + (i % 3) * 2, '#5a3a3a'); px(x - 1, 10 + (i % 2) * 2, '#5a3a3a'); }
    // reeds: tall straight stalks with brown heads
    for (let i = 0; i < 6; i++) { const x = 113 + i * 2 + (i % 2); col(x, 3 + (i % 3), 15, '#6a7a3a'); g.fillStyle = '#6a4a2a'; g.fillRect(x, 2 + (i % 3), 1, 3); }
    const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    /** a blob with blocky (4-texel) edges: inner and outer colour, for decals that must read as one mass, never as speckle */
    const blob = (ox: number, oy: number, r: number, cIn: string, cOut: string, sx = 1, sd = 1) => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot((x - 15.5) * sx, y - 15.5) + (hash(x >> 2, y >> 2, sd) - 0.5) * 5; if (d < r) px(ox + x, oy + y, d < r * 0.6 ? cIn : cOut); } };
    // vine (16×32): a straight stem, leaves in pairs of 4×3 blocks alternating sides, a darker under-row on each leaf
    rect(7, 16, 2, 32, '#2e5a24');
    for (let i = 0; i < 7; i++) { const y = 18 + i * 4 + (i % 2), left = i % 2 === 0, x = left ? 3 : 9; rect(x, y, 4, 3, i % 3 ? '#5a9a3a' : '#6aaa44'); rect(x, y + 2, 4, 1, '#3e7a2e'); if (i % 3 === 1) rect(left ? 1 : 13, y + 1, 2, 2, '#4e8a34'); }
    // hanging moss (16×32): a solid cap, then strands two texels wide of different lengths, a lit left column
    rect(16, 16, 16, 3, '#6a7a5a');
    for (const [x, len] of [[16, 22], [18, 12], [21, 29], [24, 17], [27, 25], [30, 10]]) { rect(x, 18, 2, len, '#6e7e5e'); rect(x, 18, 1, len, '#8a9a76'); }
    // web (32×32): eight spokes (axis and exact 45°) and three octagon rings made of axis and 45° runs only
    const W0 = 32, cxw = 48, cyw = 32, wc = 'rgba(226,226,236,0.95)';
    for (let k = -15; k <= 15; k++) { px(cxw + k, cyw, wc); px(cxw, cyw + k, wc); if (Math.abs(k) <= 13) { px(cxw + k, cyw + k, wc); px(cxw + k, cyw - k, wc); } }
    for (const r of [4, 8, 12]) { const b = Math.round(r * 0.414); for (let k = -b; k <= b; k++) { px(cxw + r, cyw + k, wc); px(cxw - r, cyw + k, wc); px(cxw + k, cyw + r, wc); px(cxw + k, cyw - r, wc); } for (let k = 0; k <= r - b; k++) { const a = b + k, c2 = r - k; px(cxw + a, cyw + c2, wc); px(cxw - a, cyw + c2, wc); px(cxw + a, cyw - c2, wc); px(cxw - a, cyw - c2, wc); } }
    void W0;
    // leaf litter (32×32): a dark earth blob with five big leaves (4×2 plus a stem), nothing smaller
    blob(64, 16, 12, '#3e3026', '#342820', 1, 5);
    for (const [x, y, c] of [[70, 22, '#9a5a2a'], [80, 20, '#8a6a2a'], [74, 30, '#a0622e'], [84, 32, '#7a4a26'], [72, 38, '#8a5a2a']] as const) { rect(x, y, 4, 2, c); px(x + 4, y + 1, '#5a3a20'); rect(x, y + 1, 2, 1, '#6a3e1e'); }
    // moss decal: an irregular blob with a lighter centre
    blob(96, 16, 13, '#4e7a3a', '#3e6a32', 1, 1);
    // crack decal: right-angle runs two texels wide, a branch, a lit lip on one side (no diagonal steps)
    const cr = '#16121c', lip = '#8a86a0';
    for (const [x, y, w, h] of [[2, 62, 9, 2], [9, 62, 2, 5], [9, 65, 8, 2], [15, 60, 2, 7], [15, 60, 10, 2], [23, 60, 2, 4], [23, 62, 7, 2], [12, 67, 2, 7], [12, 72, 6, 2]] as const) rect(x, y, w, h, cr);
    for (const [x, y, w] of [[2, 64, 7], [11, 67, 1], [17, 62, 6], [25, 64, 5], [14, 74, 4]] as const) rect(x, y, w, 1, lip);
    // bones decal
    g.fillStyle = '#e6dcc4'; g.fillRect(36, 60, 12, 2); g.fillRect(35, 59, 2, 4); g.fillRect(47, 59, 2, 4); g.fillRect(44, 66, 2, 10); g.fillRect(43, 65, 4, 2); g.fillRect(50, 52, 6, 5); g.fillStyle = '#18141c'; g.fillRect(51, 54, 1, 1); g.fillRect(54, 54, 1, 1);
    // puddle: a lighter sky-coloured blob with a dark rim and two highlight streaks
    blob(64, 48, 11, '#5a78a8', '#34466a', 0.8, 3); rect(76, 58, 5, 1, '#c0d8ff'); rect(80, 62, 3, 1, '#a8c8f0');
    // leaf clump (16×16): separate leaf blocks with gaps between them (the cutout is what makes a canopy read as foliage, not a box);
    // painted pale so the instance tint carries the tree's own green
    for (const [x, y, w, h] of [[2, 3, 4, 3], [7, 1, 4, 3], [11, 4, 3, 3], [1, 7, 3, 3], [5, 6, 5, 3], [10, 8, 4, 3], [3, 11, 4, 3], [8, 11, 3, 4], [12, 12, 3, 2]] as const) { rect(x, 80 + y, w, h, '#b8c8a8'); rect(x, 80 + y, w, 1, '#dce8cc'); rect(x, 80 + y + h - 1, w, 1, '#889878'); }
    // pebbles: four flat stones, each lit on its top row and shaded on its bottom row (tinted per scene)
    for (const [x, y, w, h] of [[101, 54, 6, 4], [110, 58, 5, 3], [104, 64, 7, 5], [116, 66, 4, 3]] as const) { rect(x, y, w, h, '#a8a6b4'); rect(x, y, w, 1, '#d0ceda'); rect(x, y + h - 1, w, 1, '#6a6876'); }
  }, { nearest: true });
  t.colorSpace = THREE.SRGBColorSpace;
  return (atlas = t);
}

// ------------------------------------------------------------------ card kinds
export type Kind = 'cross' | 'wall' | 'decal';
interface Def { spr: string; kind: Kind; w: number; h: number; sway?: number; glow?: number }
/** card kinds registered by scene files, each with its own small pixel canvas (w × h texels, one texel = one block) */
const extra = new Map<string, { w: number; h: number; paint: (g: CanvasRenderingContext2D) => void; tex?: THREE.Texture }>();
/** register a new card kind painted in code. kind: 'cross' (standing crossed quads, base at y), 'wall' (hangs down from y, faces
 *  +z before ry), 'decal' (flat on the floor). glow > 0 = unlit and bright. Call at module level; repeated names are ignored. */
export function addCardKind(name: string, d: { kind: Kind; w: number; h: number; sway?: number; glow?: number }, paint: (g: CanvasRenderingContext2D) => void) {
  if (CARD[name]) return;
  extra.set(name, { w: d.w, h: d.h, paint }); CARD[name] = { spr: name, ...d };
}
function texOf(d: Def) {
  const e = extra.get(d.spr); if (!e) return paintAtlas();
  if (!e.tex) { e.tex = canvasTex(e.w, e.h, e.paint, { nearest: true }); e.tex.colorSpace = THREE.SRGBColorSpace; }
  return e.tex;
}
export const CARD: Record<string, Def> = {
  grass: { spr: 'grass', kind: 'cross', w: 16, h: 16, sway: 0.06 }, tallgrass: { spr: 'tallgrass', kind: 'cross', w: 16, h: 16, sway: 0.1 }, fern: { spr: 'fern', kind: 'cross', w: 16, h: 16, sway: 0.06 },
  flowers: { spr: 'flowers', kind: 'cross', w: 16, h: 16, sway: 0.07 }, weeds: { spr: 'weeds', kind: 'cross', w: 16, h: 16, sway: 0.08 }, shroom: { spr: 'shroom', kind: 'cross', w: 16, h: 16, glow: 1.5 },
  bramble: { spr: 'bramble', kind: 'cross', w: 16, h: 16, sway: 0.03 }, reeds: { spr: 'reeds', kind: 'cross', w: 16, h: 16, sway: 0.12 },
  vine: { spr: 'vine', kind: 'wall', w: 16, h: 32, sway: 0.03 }, moss: { spr: 'moss', kind: 'wall', w: 16, h: 32, sway: 0.05 }, web: { spr: 'web', kind: 'wall', w: 32, h: 32 },
  litter: { spr: 'litter', kind: 'decal', w: 32, h: 32 }, mossdecal: { spr: 'mossdecal', kind: 'decal', w: 32, h: 32 }, crack: { spr: 'crack', kind: 'decal', w: 32, h: 32 }, bones: { spr: 'bonesdecal', kind: 'decal', w: 32, h: 32 }, puddle: { spr: 'puddle', kind: 'decal', w: 32, h: 32, glow: 0.7 }, pebbles: { spr: 'pebbles', kind: 'decal', w: 32, h: 32 }, leaf: { spr: 'leaf', kind: 'cross', w: 16, h: 16, sway: 0.04 },
};
function cardGeo(d: Def) {
  const own = extra.has(d.spr), [ax, ay, aw, ah] = own ? [0, 0, 128, 128] : SPR[d.spr], u0 = ax / 128, u1 = (ax + aw) / 128, v1 = 1 - ay / 128, v0 = 1 - (ay + ah) / 128, W = d.w * CELL, H = d.h * CELL;
  const plane = () => { const g = new THREE.PlaneGeometry(W, H); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); return g; };
  let g: THREE.BufferGeometry;
  if (d.kind === 'cross') { const a = plane(), b = plane(); b.rotateY(Math.PI / 2); a.translate(0, H / 2, 0); b.translate(0, H / 2, 0); g = mergeTwo(a, b); }
  else if (d.kind === 'wall') { g = plane(); g.translate(0, -H / 2, 0); }
  else { g = plane(); g.rotateX(-Math.PI / 2); g.translate(0, 0.012, 0); }
  // cards are lit as if they faced the sky (even, like foliage), not by their facing
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry(), A = [a, b].map(x => x.toNonIndexed());
  for (const k of ['position', 'normal', 'uv']) { const arrs = A.map(x => x.attributes[k].array as Float32Array), out = new Float32Array(arrs[0].length + arrs[1].length); out.set(arrs[0]); out.set(arrs[1], arrs[0].length); g.setAttribute(k, new THREE.BufferAttribute(out, A[0].attributes[k].itemSize)); }
  return g;
}
const swayU = { uTime: { value: 0 } };
onUpdate((_dt, rdt) => { swayU.uTime.value += rdt; });
function cardMat(d: Def) {
  const tex = texOf(d), H = d.h * CELL;
  if (d.glow) return new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(d.glow, d.glow, d.glow), toneMapped: false });
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const s = d.sway ?? 0;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = swayU.uTime;
    // both faces lit as the front one (a flipped normal would make half of every crossed tuft go dark)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );');
    if (s) sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = instanceMatrix[3].xyz;
      #else
      vec3 ip = vec3(0.0);
      #endif
      float hk = ${d.kind === 'wall' ? `clamp(-position.y / ${H.toFixed(3)}, 0.0, 1.0)` : `clamp(position.y / ${H.toFixed(3)}, 0.0, 1.0)`};
      hk *= hk;
      transformed.x += sin(uTime * 1.6 + ip.x * 0.8 + ip.z * 0.6) * ${s.toFixed(3)} * hk;
      transformed.z += cos(uTime * 1.3 + ip.x * 0.5 - ip.z * 0.7) * ${(s * 0.6).toFixed(3)} * hk;`);
  };
  m.customProgramCacheKey = () => 'card' + d.kind + s + H;
  return m;
}

/** collects card instances for one stage and turns them into one instanced mesh per kind */
export class Cards {
  private items = new Map<string, Array<{ p: THREE.Vector3; ry: number; s: number; tint: THREE.Color; rx?: number }>>();
  add(kind: string, x: number, z: number, o: { y?: number; ry?: number; s?: number; tint?: number; rx?: number } = {}) {
    if (!this.items.has(kind)) this.items.set(kind, []);
    this.items.get(kind)!.push({ p: V3(x, o.y ?? 0, z), ry: o.ry ?? hash(x * 13, z * 7) * Math.PI, s: o.s ?? 1, tint: new THREE.Color(o.tint ?? 0xffffff), rx: o.rx });
  }
  /** scatter n cards in clusters over a rectangle, avoiding the battle floor */
  scatter(kind: string, n: number, area: { x0: number; z0: number; x1: number; z1: number }, o: { cluster?: number; spread?: number; s?: [number, number]; tints?: number[]; seed?: number; allowPlay?: number } = {}) {
    const cl = o.cluster ?? 4, sp = o.spread ?? 0.6, sd = o.seed ?? 1; let placed = 0, tries = 0;
    while (placed < n && tries < n * 30) {
      tries++;
      const cx = area.x0 + hash(tries, sd, 1) * (area.x1 - area.x0), cz = area.z0 + hash(tries, sd, 2) * (area.z1 - area.z0);
      if (inPlay(cx, cz) && hash(tries, sd, 9) > (o.allowPlay ?? 0)) continue;
      for (let k = 0; k < cl && placed < n; k++) {
        const x = cx + (hash(tries, k, sd + 3) - 0.5) * sp * 2, z = cz + (hash(tries, k, sd + 4) - 0.5) * sp * 2;
        if (inPlay(x, z) && hash(tries, k, 11) > (o.allowPlay ?? 0)) continue;
        const s = o.s ? o.s[0] + hash(tries, k, 5) * (o.s[1] - o.s[0]) : 0.8 + hash(tries, k, 5) * 0.5;
        this.add(kind, x, z, { s, tint: o.tints ? o.tints[Math.floor(hash(tries, k, 6) * o.tints.length)] : undefined }); placed++;
      }
    }
  }
  build(root: THREE.Object3D) {
    if (typeof window !== "undefined") { (window as any).__cards = Object.fromEntries([...this.items].map(([k, v]) => [k, v.length])); (window as any).__cardsAt = (k: string) => (this.items.get(k) ?? []).map(i => [+i.p.x.toFixed(2), +i.p.y.toFixed(2), +i.p.z.toFixed(2), +i.s.toFixed(2), +i.ry.toFixed(2)]); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const [kind, list] of this.items) {
      const d = CARD[kind]; if (!d || !list.length) continue;
      const mesh = new THREE.InstancedMesh(cardGeo(d), cardMat(d), list.length);
      list.forEach((it, i) => { e.set(it.rx ?? 0, it.ry, 0); q.setFromEuler(e); m4.compose(it.p, q, V3(it.s, it.s, it.s)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, it.tint); });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = false; mesh.receiveShadow = d.kind === 'cross'; mesh.frustumCulled = false; mesh.renderOrder = d.kind === 'decal' ? 1 : 0; root.add(mesh);
    }
  }
}

// ------------------------------------------------------------------ atmosphere: drifting particles and light shafts
export type Ambient = { kind: 'fireflies' | 'leaves' | 'spores' | 'dust' | 'embers'; color: number; rate: number; area?: { x0: number; z0: number; x1: number; z1: number }; y?: [number, number] };
export function ambientTick(list: Ambient[], dt: number) {
  for (const a of list) {
    const ar = a.area ?? { x0: -9, z0: -11, x1: 9, z1: 6 }, n = a.rate * dt + (Math.random() < (a.rate * dt) % 1 ? 1 : 0);
    for (let i = 0; i < Math.floor(n); i++) {
      const p = V3(R(ar.x0, ar.x1), R((a.y ?? [0.3, 2.4])[0], (a.y ?? [0.3, 2.4])[1]), R(ar.z0, ar.z1)), c = new THREE.Color(a.color);
      if (a.kind === 'fireflies') PADD.emit({ p, v: V3(R(-0.25, 0.25), R(-0.1, 0.2), R(-0.25, 0.25)), s0: 0.14, s1: 0.1, life: R(2.5, 4.5), c0: c, bright: 4, tile: TILE.glow, fadeIn: 0.5 });
      else if (a.kind === 'leaves') PALPHA.emit({ p: p.setY(R(3.5, 6)), v: V3(R(0.2, 0.6), R(-0.55, -0.35), R(-0.2, 0.2)), s0: 0.09, s1: 0.09, life: R(6, 10), c0: c, alpha: 0.95, tile: TILE.pixel, spin: R(-3, 3), fadeIn: 0.3 });
      else if (a.kind === 'spores') PADD.emit({ p, v: V3(R(-0.06, 0.06), R(0.08, 0.25), R(-0.06, 0.06)), s0: 0.05, s1: 0.03, life: R(4, 7), c0: c, bright: 1.8, tile: TILE.pixel, fadeIn: 0.6 });
      else if (a.kind === 'dust') PALPHA.emit({ p, v: V3(R(-0.05, 0.05), R(-0.02, 0.05), R(-0.05, 0.05)), s0: 0.035, s1: 0.035, life: R(5, 8), c0: c, alpha: 0.5, tile: TILE.pixel, fadeIn: 0.8 });
      else PADD.emit({ p, v: V3(R(-0.1, 0.1), R(0.4, 0.9), R(-0.1, 0.1)), s0: 0.05, s1: 0.02, life: R(1.5, 3), c0: c, bright: 2.6, tile: TILE.pixel });
    }
  }
}
let shaftTex: THREE.Texture | null = null;
/** a soft additive beam from above (moonlight through trees, light through a window) */
export function shaft(root: THREE.Object3D, x: number, z: number, o: { w?: number; h?: number; color?: number; tilt?: number; yaw?: number; a?: number } = {}) {
  shaftTex ??= canvasTex(16, 64, g => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 64); const gx = g.createLinearGradient(0, 0, 16, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 16, 64); });
  const m = new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(o.color ?? 0xb8c8ff), transparent: true, opacity: o.a ?? 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const H = o.h ?? 8, mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 1.6, H), m);
  mesh.position.set(x, H * 0.45, z); mesh.rotation.set(0, o.yaw ?? 0.5, o.tilt ?? 0.32); mesh.renderOrder = 5; root.add(mesh);
  const base = m.opacity, ph = Math.random() * 6;
  onUpdate(() => { m.opacity = base * (0.8 + 0.2 * Math.sin(clock.rtime * 0.6 + ph)); });
  return mesh;
}
