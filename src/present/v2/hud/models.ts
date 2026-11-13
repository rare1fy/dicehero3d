// R5 HUD 3D parts in the UI layer: the octagon stone plate (base + metal rim + recessed face, real thickness), additive rings,
// a small pip die, and the model hooks (skill icons, relics, pedestal, pattern badges) over agent A's ui3d/models3d.ts (thick voxel
// models), with chunky extruded voxel placeholders if a model fails. Every model is normalised: centred, fits a unit box, +z faces
// the camera.
import * as THREE from 'three';
import { voxModel, iconCells, octPrism, flat } from '../../ui3d/vox';
import { skillIcon3D, relicModel3D, relicPedestal3D, patternBadge3D } from '../../ui3d/models3d';

/** centre a group and scale it so its largest side = size */
export function fit(o: THREE.Object3D, size = 1) {
  const inner = new THREE.Group(), g = new THREE.Group(); inner.add(o); g.add(inner); o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(s); b.getCenter(c);
  const m = Math.max(s.x, s.y, s.z) || 1; o.position.sub(c); inner.scale.setScalar(size / m); return g;   // the outer group stays free to pose / scale
}
const noShadow = (o: THREE.Object3D) => { o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); return o; };

// ---------------------------------------------------------------- the octagon plate
export interface Plate { root: THREE.Group; rim: THREE.MeshToonMaterial; face: THREE.MeshToonMaterial; base: THREE.MeshToonMaterial; faceMesh: THREE.Mesh }
/** an octagon stone plate of radius 1 (centre → flat side); front at z ≈ 0.34 */
export function octPlate(o: { rim?: number; face?: number; base?: number } = {}): Plate {
  const root = new THREE.Group();
  const base = flat(o.base ?? 0x1c1a24).clone(), rim = flat(o.rim ?? 0x6a6878).clone(), face = flat(o.face ?? 0x2e2a38).clone();
  const b = new THREE.Mesh(octPrism(1.0, 0.36, 0.98), base); b.position.z = -0.06; root.add(b);
  const r = new THREE.Mesh(octPrism(0.98, 0.2, 0.9), rim); r.position.z = 0.2; root.add(r);
  const f = new THREE.Mesh(octPrism(0.8, 0.2, 0.78), face); f.position.z = 0.22; root.add(f);
  noShadow(root); return { root, rim, face, base, faceMesh: f };
}
/** an additive glow ring (radius 1) in the xy plane */
export function glowRing(col: number, r0 = 0.9, r1 = 1.1, seg = 64, arc = Math.PI * 2, start = 0) {
  const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.RingGeometry(r0, r1, seg, 1, start, arc), m);
}
/** a thick arc segment (annulus sector extruded): the 3-cell chant ring, energy arcs */
export function arcSlab(r0: number, r1: number, a0: number, a1: number, depth: number, mat: THREE.Material) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 1, curveSegments: 24 }); g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}
/** two curved arrows chasing each other round a circle (the reroll mark), extruded with a bevel */
export function rerollMark(mat: THREE.Material, depth = 0.22) {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const a0 = i * Math.PI + 0.35, a1 = a0 + Math.PI - 0.95, r0 = 0.5, r1 = 0.78, s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    const tip = a1 + 0.5, mid = (r0 + r1) / 2;   // the arrowhead: wider than the band, pointing along the circle
    s.lineTo(Math.cos(a1) * (r1 + 0.16), Math.sin(a1) * (r1 + 0.16)); s.lineTo(Math.cos(tip) * mid, Math.sin(tip) * mid); s.lineTo(Math.cos(a1) * (r0 - 0.16), Math.sin(a1) * (r0 - 0.16));
    s.absarc(0, 0, r0, a1, a0, true); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 20 }); geo.translate(0, 0, -depth / 2);
    g.add(new THREE.Mesh(geo, mat));
  }
  return g;
}
/** a four-point star, extruded (the chant mark) */
export function starMark(mat: THREE.Material, depth = 0.2) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.2 : 0.9; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 1 }); g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

// ---------------------------------------------------------------- a little pip die (orbiting the reroll, thumbnails)
const PIPS: Record<number, Array<[number, number]>> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
let pipMats: THREE.Material[] | null = null;
function pipFace(n: number, tint = '#f4ecdc') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = tint; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 56, 64, 8); g.fillRect(56, 0, 8, 64);
  g.fillStyle = '#2a2230'; for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(32 + x * 16, 32 + y * 16, 7, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** a white pip die of side 1 (top = 1... face order px nx py ny pz nz = 3 4 2 5 1 6) */
export function pipDie() {
  if (!pipMats) pipMats = [3, 4, 2, 5, 1, 6].map(n => new THREE.MeshToonMaterial({ map: pipFace(n), color: 0xffffff }));
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pipMats); return m;
}

// ---------------------------------------------------------------- model hooks (agent A's models3d.ts first, placeholders after)
type ModelFn = (name: string) => THREE.Object3D | null | undefined;
function tryA(fn: ModelFn | undefined, name: string) { try { return fn ? fn(name) || null : null; } catch { return null; } }
/** drive a model's glow / dim when it supports it (agent A's Model3D) */
export function modelLook(o: THREE.Object3D, glow: number, dim: number) {
  const m = o as unknown as { setGlow?: (k: number) => void; setDim?: (k: number) => void; children: THREE.Object3D[] };
  if (m.setGlow) { m.setGlow(glow); m.setDim?.(dim); return; }
  for (const c of o.children) modelLook(c, glow, dim);
}
const A = { skillIcon3D: (n: string) => skillIcon3D(n), relicModel3D: (n: string) => relicModel3D(n), relicPedestal3D, patternBadge3D: (n: string) => patternBadge3D(n) } as { skillIcon3D: ModelFn; relicModel3D: ModelFn; relicPedestal3D: () => THREE.Object3D; patternBadge3D: ModelFn };

const ICONS: Record<string, { rows: string[]; pal: Record<string, number>; glow?: string }> = {
  orb: { rows: ['...####...', '..#oooo#..', '.#oo##oo#.', '#oo#ww#oo#', '#o#wwww#o#', '#o#wwww#o#', '#oo#ww#oo#', '.#oo##oo#.', '..#oooo#..', '...####...'], pal: { '#': 0x5a2a9a, o: 0xa060ff, w: 0xf0d8ff }, glow: 'ow' },
  ice: { rows: ['....w.....', '...wo..w..', '...oo.wo..', '.w.oo.oo..', '.oo#o.o#.w', '.o#oo#o#.o', '#o#o##o##o', '#####o####', '.########.', '..######..'], pal: { '#': 0x2a6ab0, o: 0x8ad8ff, w: 0xeaffff }, glow: 'ow' },
  ring: { rows: ['..w....w..', '.wo.ww.ow.', 'woo####oow', '.o##..##o.', 'wo#....#ow', 'wo#....#ow', '.o##..##o.', 'woo####oow', '.wo.ww.ow.', '..w....w..'], pal: { '#': 0x2a6ab0, o: 0x8ad8ff, w: 0xeaffff }, glow: 'ow' },
  bolt: { rows: ['.....####.', '....###o..', '...###o...', '..######..', '.....###..', '....###...', '...###....', '..##o.....', '.##.......', '#.........'], pal: { '#': 0xffd040, o: 0xfff6c0 }, glow: '#o' },
  fire: { rows: ['....#.....', '...##..#..', '..#o#.##..', '.#oo##o#..', '.#owoo#o#.', '#oowwwoo#.', '#owwwwwo#.', '#oowwwoo#.', '.#oooooo#.', '..######..'], pal: { '#': 0xd83a10, o: 0xff9a20, w: 0xfff2a0 }, glow: 'ow#' },
  axe: { rows: ['..####....', '.#oooo#...', '#oooooo#..', '#ooo####..', '#oo#ww....', '.##..ww...', '......ww..', '.......ww.', '........ww', '.........w'], pal: { '#': 0x6a7488, o: 0xd8e0ee, w: 0x8a5a32 } },
  cleave: { rows: ['........##', '......##o#', '....##oo#.', '..##oo##..', '##oo##....', '#o##......', '##....ww..', '.....ww...', '....ww....', '...ww.....'], pal: { '#': 0x6a7488, o: 0xffe0a0, w: 0x8a5a32 }, glow: 'o' },
  shield: { rows: ['.########.', '#oooooooo#', '#oo####oo#', '#oo#ww#oo#', '#oo#ww#oo#', '.#oo##oo#.', '.#oooooo#.', '..#oooo#..', '...#oo#...', '....##....'], pal: { '#': 0x3a4458, o: 0x8a9ab8, w: 0xffd060 } },
  blood: { rows: ['....#.....', '...#o#....', '..#ooo#...', '..#ooo#...', '.#oowoo#..', '#oowwooo#.', '#oowoooo#.', '#ooooooo#.', '.#ooooo#..', '..#####...'], pal: { '#': 0x6a0a10, o: 0xd0202a, w: 0xff8a7a }, glow: 'w' },
  dagger: { rows: ['.........#', '........#o', '.......#o.', '......#o..', '.....#o...', '..#.#o....', '...#o.....', '..#w#.....', '.#w..#....', '#w........'], pal: { '#': 0x4a4a5a, o: 0xd8d8ee, w: 0x5a3a7a } },
  back: { rows: ['..#....#..', '.#o#..#o#.', '.#oo##oo#.', '..#oooo#..', '...#oo#...', '...#oo#...', '..#ww#....', '.#ww......', '#ww.......', 'ww........'], pal: { '#': 0x3a2a4a, o: 0xb070ff, w: 0x5a3a7a }, glow: 'o' },
  step: { rows: ['..####....', '.#oooo#...', '.#oooo#...', '..#oo#....', '..#oo#....', '..#ooo##..', '..#ooooo#.', '...#####..', '.w.w.w.w..', 'w.w.w.w...'], pal: { '#': 0x2a1a3a, o: 0x7a4ab0, w: 0xc090ff }, glow: 'w' },
  poison: { rows: ['...####...', '..#oooo#..', '.#oowooo#.', '#oooooowo#', '#owoooooo#', '.#oooowo#.', '..######..', '..w.w..w..', '.w...w..w.', '..w..w.w..'], pal: { '#': 0x2a6a1a, o: 0x6ad83a, w: 0xd8ff8a }, glow: 'ow' },
};
const SKILL_ICON: Record<string, string> = { 奥术弹: 'orb', 冰锥: 'ice', 冰环: 'ring', 闪电链: 'bolt', 陨石: 'fire', 劈砍: 'axe', 顺劈斩: 'cleave', 盾墙: 'shield', 铁壁: 'shield', 狂血: 'blood', 血战: 'blood', 袖箭: 'dagger', 背刺: 'back', 影步: 'step', 毒雾: 'poison', 影舞: 'step' };
function voxIcon(key: string, depth = 3) {
  const I = ICONS[key] || ICONS.orb;
  return voxModel(1, set => iconCells(set, I.rows, 0, 0, 0, depth, ch => (I.pal[ch] != null ? { c: I.pal[ch], g: I.glow?.includes(ch) ? 1 : 0 } : null)), { glow: 1.6 });
}
/** a skill's floating icon (fits a unit box) */
/** skill names agent A's art does not know yet → the closest icon */
const ICON_ALIAS: Record<string, string> = { 盾冲: '盾墙' };
export function skillIcon(name: string): THREE.Object3D { const a = tryA(A.skillIcon3D, ICON_ALIAS[name] || name); if (a) { const g = new THREE.Group(); g.add(noShadow(a)); return g; } return fit(noShadow(voxIcon(SKILL_ICON[name] || 'orb')), 1); }

const RELIC_ROWS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  hand: { rows: ['..#.#.#...', '.#o#o#o#..', '.#o#o#o#.#', '.#o#o#o##o', '.#oooooo#o', '.#ooooooo#', '.#oooooo#.', '..#oooo#..', '..#oooo#..', '..######..'], pal: { '#': 0x8a5a10, o: 0xffc640 } },
  amulet: { rows: ['...####...', '..#....#..', '.########.', '#oooooooo#', '#ooowwooo#', '#oowwwwoo#', '.#oowwoo#.', '..#oooo#..', '...#oo#...', '....##....'], pal: { '#': 0x8a6a20, o: 0x3a6ab8, w: 0xbfe8ff } },
  kit: { rows: ['...####...', '...#..#...', '##########', '#oooooooo#', '#oooRRooo#', '#ooRRRRoo#', '#ooRRRRoo#', '#oooRRooo#', '#oooooooo#', '##########'], pal: { '#': 0x9a9aa8, o: 0xf4f0ea, R: 0xd02020 } },
  gem: { rows: ['..........', '..######..', '.#oooooo#.', '#oowwoooo#', '.#oooooo#.', '..#oooo#..', '...#oo#...', '....##....', '..........', '..........'], pal: { '#': 0x6a2a8a, o: 0xc060ff, w: 0xffe0ff } },
};
const RELIC_KEY: Record<string, string> = { 贪婪之手: 'hand', 铁壁护符: 'amulet', 战场急救: 'kit' };
export function relicModel(name: string): THREE.Object3D {
  const a = tryA(A.relicModel3D, name); if (a) { const g = new THREE.Group(); g.add(noShadow(a)); return g; }
  const R = RELIC_ROWS[RELIC_KEY[name] || 'gem'];
  return fit(voxModel(1, set => iconCells(set, R.rows, 0, 0, 0, 3, ch => (R.pal[ch] != null ? { c: R.pal[ch] } : null))), 1);
}
/** UX_V3 §8: the warrior's 铁壁 (any 1–3 dice) badge = a small handful of dice, unlike the one-die loose badge of mage / rogue */
function handfulBadge(): THREE.Object3D {
  const g = new THREE.Group();
  try {
    const a = patternBadge3D('single') as unknown as THREE.Object3D & { pivot?: THREE.Group }, pv = a.pivot, icon = pv?.children[2];
    if (pv && icon) {
      icon.scale.multiplyScalar(0.6); const p0 = icon.position.clone();
      icon.position.set(p0.x - 0.15, p0.y - 0.1, p0.z);
      const b = icon.clone(); b.position.set(p0.x + 0.15, p0.y - 0.12, p0.z + 0.01); b.rotation.z = -0.25;
      const c = icon.clone(); c.position.set(p0.x, p0.y + 0.16, p0.z + 0.02); c.rotation.z = 0.2; pv.add(b, c);
      g.add(noShadow(a)); return g;
    }
  } catch { /* placeholder below */ }
  const rows = ['##.##.', '##.##.', '......', '.##...', '.##...', '......'];
  g.add(fit(voxModel(1, set => { for (let x = -1; x < 7; x++) for (let y = -1; y < 7; y++) set(x, y, 0, 0x2a2634); iconCells(set, rows, 0, 0, 1, 1, ch => (ch === '.' ? null : { c: 0xf0e8d8 })); }), 1));
  return g;
}
/** the shared relic pedestal: a short stone drum with a metal ring (top at y = 0, radius ≈ 0.5) */
export function relicPedestal(): THREE.Object3D {
  try { const p = A.relicPedestal3D?.(); if (p) { p.userData.fromA = true; return noShadow(p); } } catch { /* placeholder */ }
  const g = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.22, 8), flat(0x4a4656)); stone.position.y = -0.11; g.add(stone);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8), flat(0xb08a40)); ring.position.y = -0.02; g.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.06, 8), flat(0x5e5a6a)); top.position.y = 0.01; g.add(top);
  return noShadow(g);
}
const BADGE_ROWS: Record<string, string[]> = {
  basic: ['######', '#....#', '#.##.#', '#.##.#', '#....#', '######'],
  same: ['##..##', '#o..o#', '##..##', '##..##', '#o..o#', '##..##'],
  straight: ['....##', '....##', '..####', '..####', '######', '######'],
  array: ['##.##.', '##.##.', '......', '.##.##', '.##.##', '......'],
};
/** the small pattern badge (散骰 / 同点 / 连环 / 阵列) */
export function patternBadge(kind: string): THREE.Object3D {
  if (kind === 'handful') return handfulBadge();
  const a = tryA(A.patternBadge3D, kind); if (a) { const g = new THREE.Group(); g.add(noShadow(a)); return g; }
  const rows = BADGE_ROWS[kind] || BADGE_ROWS.basic;
  return fit(voxModel(1, set => {
    for (let x = -1; x < 7; x++) for (let y = -1; y < 7; y++) set(x, y, 0, 0xe8e0d0);
    iconCells(set, rows, 0, 0, 1, 1, ch => (ch === '.' ? null : { c: 0x2a2230 }));
  }), 1);
}
