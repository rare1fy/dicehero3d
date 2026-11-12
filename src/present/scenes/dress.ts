// Set dressing with cards, the Minecraft-Dungeons way: every block edge softened by tufts, vines and webs, the floor broken up with
// flat decals, and the air filled with motes. One call per scene picks a preset and a few scene facts (which walls to hang growth
// from, which corners get webs, where the water is). Cards land on whatever surface the voxel world has at that spot, never inside
// a prop, never on top of a tall one; the battle floor gets only flat decals plus a soft fringe of grass at its edges.
import * as THREE from 'three';
import type { Ctx } from './stage';
import type { VoxWorld } from '../look/voxkit';
import { Cards, ambientTick, shaft, type Ambient } from './cards';
import { onUpdate } from '../engine/world';
import { M, hash, AREA, PLAY } from './props';
import { CELL } from '../bestiary/kit';

type Rect = { x0: number; z0: number; x1: number; z1: number };
export type Preset = 'woods' | 'grave' | 'grove' | 'swamp' | 'house' | 'dungeon' | 'cave' | 'spider' | 'roots';
export interface DressOpt {
  /** wall or rock runs to hang vines and moss from: [x0, z0, x1, z1] along the run, plus the inward direction (toward the stage) */
  hang?: Array<[number, number, number, number, 'n' | 's' | 'e' | 'w']>;
  /** cobweb corners: [x, y, z, yaw] */
  webs?: Array<[number, number, number, number]>;
  /** water rectangles: reeds along their banks */
  water?: Rect[];
  /** moonbeams / window light: [x, z, yaw, tilt, width] */
  shafts?: Array<[number, number, number?, number?, number?]>;
  /** areas kept free of standing cards */
  clear?: Rect[];
  seed?: number;
  /** multiplier on standing-card counts */
  dense?: number;
  /** block colours that are foliage: their outer edges get leaf-clump cards (default: the woods' pine greens) */
  leaves?: number[];
}

/** top surface height (metres) of the voxel world at (x, z), or null where there is no ground (water, holes) */
export function surface(c: Ctx, x: number, z: number) {
  const X = M(x), Z = M(z);
  for (let y = M(9); y >= -3; y--) if (c.w.has(X, y, Z)) return (y + 1) * CELL;
  return null;
}
const playDepth = (x: number, z: number) => Math.min(x - PLAY.x0, PLAY.x1 - x, z - PLAY.z0, PLAY.z1 - z);
const inRect = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

export function dress(c: Ctx, preset: Preset, o: DressOpt = {}) {
  const sd = o.seed ?? 1, D = o.dense ?? 1, clear = o.clear ?? [];
  const groundOK = (x: number, z: number, maxY = 0.22) => { const y = surface(c, x, z); return y != null && y <= maxY && y >= -0.1 ? y : null; };
  /** clustered standing cards outside the battle floor (feathered: a thin fringe reaches inside its edge) */
  const stand = (kind: string, n: number, s: [number, number], o2: { area?: Rect; tints?: number[]; cluster?: number; spread?: number; feather?: number; where?: (x: number, z: number) => boolean } = {}) => {
    const ar = o2.area ?? AREA, cl = o2.cluster ?? 5, sp = o2.spread ?? 0.7, fe = o2.feather ?? 0.9; let placed = 0, tries = 0; n = Math.round(n * D);
    while (placed < n && tries < n * 40) {
      tries++;
      const cx = ar.x0 + hash(tries, sd, 1 + kind.length) * (ar.x1 - ar.x0), cz = ar.z0 + hash(tries, sd, 2 + kind.length * 3) * (ar.z1 - ar.z0);
      for (let k = 0; k < cl && placed < n; k++) {
        const x = cx + (hash(tries, k, sd + 3) - 0.5) * sp * 2, z = cz + (hash(tries, k, sd + 4) - 0.5) * sp * 2, d = playDepth(x, z);
        if (d > 0 && (d > fe || hash(tries, k, 13) < d / fe)) continue;
        if (clear.some(r => inRect(r, x, z)) || (o2.where && !o2.where(x, z))) continue;
        const y = groundOK(x, z); if (y == null) continue;
        const sc = s[0] + hash(tries, k, 5) * (s[1] - s[0]) * (d > 0 ? 0.6 : 1);
        c.cards.add(kind, x, z, { y, s: sc, tint: o2.tints ? o2.tints[Math.floor(hash(tries, k, 6) * o2.tints.length)] : undefined }); placed++;
      }
    }
  };
  /** flat decals, anywhere on open floor (inside the battle floor too: they never hide a die) */
  const decal = (kind: string, n: number, s: [number, number], o2: { area?: Rect; tints?: number[]; inside?: boolean } = {}) => {
    const ar = o2.area ?? AREA; let placed = 0, tries = 0;
    while (placed < n && tries < n * 30) {
      tries++;
      const x = ar.x0 + hash(tries, sd, 21 + kind.length) * (ar.x1 - ar.x0), z = ar.z0 + hash(tries, sd, 22 + kind.length) * (ar.z1 - ar.z0);
      if (o2.inside === false && playDepth(x, z) > 0) continue;
      const y = groundOK(x, z, 0.1); if (y == null) continue;
      c.cards.add(kind, x, z, { y, s: s[0] + hash(tries, 7, sd) * (s[1] - s[0]), ry: Math.floor(hash(tries, 8, sd) * 4) * Math.PI / 2, tint: o2.tints ? o2.tints[tries % o2.tints.length] : undefined }); placed++;
    }
  };
  /** vines and moss hanging from the tops of wall or rock runs, on the face toward the stage */
  const hang = (kinds: string[], every: number, tints?: number[]) => {
    for (const [x0, z0, x1, z1, dir] of o.hang ?? []) {
      const [dx, dz] = dir === 's' ? [0, 1] : dir === 'n' ? [0, -1] : dir === 'e' ? [1, 0] : [-1, 0], ry = dir === 's' ? 0 : dir === 'n' ? Math.PI : dir === 'e' ? Math.PI / 2 : -Math.PI / 2;
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / every));
      for (let i = 0; i <= n; i++) {
        if (hash(i, sd, 31 + Math.round(x0 * 7 + z0 * 3)) < 0.3) continue;
        let x = x0 + (x1 - x0) * (i / n) + (hash(i, sd, 32) - 0.5) * every * 0.6, z = z0 + (z1 - z0) * (i / n) + (hash(i, sd, 33) - 0.5) * every * 0.6;
        // march inward: first into the wall (the run line may sit just behind it), then through it until the column at chest
        // height is open again — that boundary is the face
        let top = -1, k = 0, inside = false;
        for (; k < 60; k++) {
          const cx = x + dx * k * CELL, cz = z + dz * k * CELL, solid = c.w.has(M(cx), M(0.9), M(cz));
          if (!inside) { if (solid) inside = true; else continue; }
          if (!solid) break;
          top = Math.max(top, surface(c, cx, cz) ?? -1);
        }
        if (!inside || k >= 60 || top < 0.9) continue;
        // the face is the boundary of the first open cell (exact, so the card never sinks into the wall), plus a small gap
        if (dx) { const open = M(x + dx * k * CELL); x = (open - dx * 0.5) * CELL + dx * 0.03; }
        else { const open = M(z + dz * k * CELL); z = (open - dz * 0.5) * CELL + dz * 0.03; }
        const kind = kinds[Math.floor(hash(i, sd, 34) * kinds.length)], full = 32 * CELL, s = Math.min(0.6 + hash(i, sd, 35) * 0.65, (top - 0.25) / full);
        c.cards.add(kind, x, z, { y: top + 0.02, ry, s, tint: tints ? tints[i % tints.length] : undefined });
      }
    }
  };
  const reeds = (n: number) => {
    for (const r of o.water ?? []) for (let i = 0; i < n; i++) {
      const side = Math.floor(hash(i, sd, 41) * 4), t = hash(i, sd, 42), j = (hash(i, sd, 43) - 0.3) * 0.8;
      const x = side < 2 ? r.x0 + t * (r.x1 - r.x0) : side === 2 ? r.x0 + j : r.x1 - j, z = side >= 2 ? r.z0 + t * (r.z1 - r.z0) : side === 0 ? r.z0 + j : r.z1 - j;
      if (playDepth(x, z) > -0.2) continue;
      c.cards.add('reeds', x, z, { y: (surface(c, x, z) ?? -0.08), s: 0.8 + hash(i, sd, 44) * 0.6 });
    }
  };
  for (const [x, y, z, yaw] of o.webs ?? []) c.cards.add('web', x, z, { y, ry: yaw, s: 0.8 + hash(x, z) * 0.3 });
  leafFringe(c, new Set(o.leaves ?? [0x1e3a2e, 0x2e5a40]));
  for (const [x, z, yaw, tilt, w] of o.shafts ?? []) c.shaft(x, z, { yaw, tilt, w });

  const G = [0xffffff, 0xe8f0d8, 0xd0dcc0, 0xf0f4e0], COLD = [0xb8c8d8, 0xa8b8c8, 0xc8d4dc], DRY = [0xe8d8a8, 0xd8c890, 0xc8b880];
  const back: Rect = { x0: AREA.x0, z0: AREA.z0, x1: AREA.x1, z1: PLAY.z0 + 0.5 };
  const sides = (x: number) => Math.abs(x) > 5;
  switch (preset) {
    case 'woods': case 'grove': {
      const g = preset === 'grove' ? 1.5 : 1;
      stand('grass', 560 * g, [0.55, 0.95], { tints: G, cluster: 7, spread: 0.8 });
      stand('tallgrass', 90 * g, [0.7, 1.1], { tints: G, cluster: 5, spread: 0.6, feather: 0.3 });
      stand('fern', 70 * g, [0.8, 1.2], { tints: G, cluster: 3, spread: 0.6, feather: 0, where: sides });
      stand('flowers', 50 * g, [0.6, 0.9], { cluster: 4, spread: 0.5, feather: 0.4 });
      stand('weeds', 50, [0.7, 1.1], { tints: DRY, cluster: 4, feather: 0.2 });
      stand('bramble', 28, [0.9, 1.3], { area: back, cluster: 3, feather: 0 });
      decal('litter', 6, [0.5, 0.8], { inside: false }); decal('mossdecal', 8, [0.6, 1.0]); decal('pebbles', 6, [0.5, 0.8], { tints: [0x9a9a9a] });
      c.ambient({ kind: 'fireflies', color: preset === 'grove' ? 0xd8ff7a : 0xe8ff9a, rate: preset === 'grove' ? 9 : 4 });
      c.ambient({ kind: 'leaves', color: 0x9a6a3a, rate: 1.2 }); c.ambient({ kind: 'dust', color: 0xc8c8e8, rate: 2 });
      break;
    }
    case 'grave': {
      stand('grass', 420, [0.5, 0.85], { tints: COLD, cluster: 7, spread: 0.8 });
      stand('weeds', 90, [0.7, 1.1], { tints: [0xc8c0b0, 0xa8a090], cluster: 4, feather: 0.3 });
      stand('tallgrass', 50, [0.7, 1.0], { tints: COLD, cluster: 4, feather: 0.2 });
      stand('flowers', 18, [0.6, 0.8], { tints: [0xd8d0ff], cluster: 3, feather: 0 });
      stand('bramble', 30, [0.9, 1.3], { area: back, cluster: 3, feather: 0 });
      decal('mossdecal', 6, [0.6, 1.0], { tints: [0xc8d8c8] }); decal('bones', 3, [0.6, 0.8]); decal('crack', 5, [0.4, 0.6]);
      c.ambient({ kind: 'fireflies', color: 0x7affc0, rate: 4 }); c.ambient({ kind: 'leaves', color: 0x7a5a3a, rate: 0.8 }); c.ambient({ kind: 'dust', color: 0xb8c8e8, rate: 2 });
      break;
    }
    case 'swamp': {
      reeds(70);
      stand('tallgrass', 160, [0.7, 1.2], { tints: [0xd8e0a8, 0xc8d098, 0xe8e8b8], cluster: 6, feather: 0.4 });
      stand('weeds', 70, [0.8, 1.2], { tints: [0xb8c088, 0xa8a878], cluster: 4, feather: 0.2 });
      stand('grass', 220, [0.5, 0.8], { tints: [0xd8e0a8, 0xc8d098], cluster: 6, feather: 0.6 });
      decal('puddle', 6, [0.5, 0.9], { tints: [0xa8d0a0] }); decal('mossdecal', 8, [0.6, 1.0], { tints: [0xd8e0a8] });
      hang(['moss'], 1.4, [0xb8c8a0]);
      c.ambient({ kind: 'spores', color: 0x9aff7a, rate: 5 }); c.ambient({ kind: 'fireflies', color: 0x7affa0, rate: 3 });
      break;
    }
    case 'house': {
      // weeds through the boards along the walls, growth outside the ruin, webs, dust in the window light
      stand('weeds', 60, [0.6, 1.0], { tints: DRY, cluster: 3, spread: 0.4, feather: 0, where: (x, z) => Math.abs(x) > 6.8 || z < -8.4 });
      stand('grass', 180, [0.55, 0.9], { tints: G, cluster: 6, spread: 0.7, feather: 0, where: (x, z) => Math.abs(x) > 8.9 || z < -11.5 || z > 6.6 });
      stand('tallgrass', 40, [0.7, 1.0], { tints: G, cluster: 4, feather: 0, where: (x, z) => Math.abs(x) > 8.9 || z > 6.6 });
      hang(['vine', 'vine', 'moss'], 1.1);
      decal('crack', 5, [0.4, 0.65]);
      c.ambient({ kind: 'dust', color: 0xffe8c0, rate: 7, y: [0.3, 3.2] }); c.ambient({ kind: 'leaves', color: 0x8a6a3a, rate: 0.6 });
      break;
    }
    case 'dungeon': {
      hang(['moss', 'moss', 'vine'], 1.0, [0xd0d8c0, 0xc0c8b0]);
      stand('shroom', 20, [0.35, 0.55], { cluster: 3, spread: 0.3, feather: 0, where: sides, tints: [0xc8d8e8] });
      stand('weeds', 24, [0.5, 0.8], { tints: [0x8a8478], cluster: 3, spread: 0.3, feather: 0 });
      decal('crack', 7, [0.4, 0.7]); decal('bones', 4, [0.6, 0.8]); decal('pebbles', 8, [0.5, 0.8], { tints: [0x8a8898] }); decal('puddle', 4, [0.5, 0.8], { tints: [0x9aa0c0] });
      c.ambient({ kind: 'dust', color: 0xd8d0e8, rate: 6, y: [0.2, 3.5] });
      break;
    }
    case 'cave': case 'spider': case 'roots': {
      const glow = preset === 'roots' ? [0xffc890] : preset === 'spider' ? [0xc8ff9a] : [0xffffff, 0xe0c8ff];
      stand('shroom', preset === 'cave' ? 90 : 40, [0.5, 1.0], { tints: glow, cluster: 5, spread: 0.5, feather: 0.3 });
      hang(preset === 'roots' ? ['vine', 'vine', 'moss'] : ['moss', 'vine'], 0.8, preset === 'roots' ? [0xe0c890] : [0xd8e8d0]);
      stand('weeds', 30, [0.5, 0.9], { tints: [0x9a9488], cluster: 3, feather: 0 });
      if (preset !== 'spider') stand('fern', 24, [0.7, 1.0], { tints: [0xa8c8b8], cluster: 3, feather: 0, where: sides });
      decal('crack', 6, [0.4, 0.7]); decal('puddle', 3, [0.5, 0.8]); decal('pebbles', 12, [0.5, 0.9], { tints: [0x9a98a8, 0x8a8a9a] }); decal('mossdecal', 6, [0.6, 1.0], { tints: [0x88b0a0] }); if (preset === 'spider') decal('bones', 6, [0.6, 0.8]);
      c.ambient({ kind: 'spores', color: preset === 'roots' ? 0xffb050 : preset === 'spider' ? 0xc8ff7a : 0x7ae8ff, rate: 6 });
      c.ambient({ kind: 'dust', color: 0xc8c8d8, rate: 3 });
      break;
    }
  }
}

/** dress a voxel world that was not built through a stage (the battle's own arena): cards, motes and shafts under root */
export function dressWorld(root: THREE.Object3D, w: VoxWorld, preset: Preset, o: DressOpt = {}, moon = 0xb8c4ff) {
  const cards = new Cards(), amb: Ambient[] = [];
  const ctx = { w, cards, ambient: (a: Ambient) => { amb.push(a); }, shaft: (x: number, z: number, so?: object) => { shaft(root, x, z, { color: moon, ...so }); } } as unknown as Ctx;
  dress(ctx, preset, o); cards.build(root);
  onUpdate((_dt, rdt) => { if (root.parent) ambientTick(amb, rdt); });
}

/** leaf clumps along the outer edges of foliage masses: drooping under each tier's rim, tufting over its top rim */
function leafFringe(c: Ctx, leafCols: Set<number>) {
  const col = new THREE.Color(), H = 16 * CELL;
  for (const [k, v] of c.w.cells) {
    if (!leafCols.has(v.c)) continue;
    const z = (k % 1024) - 512, y = (Math.floor(k / 1024) % 1024) - 512, x = Math.floor(k / 1048576) - 512;
    const sides: Array<[number, number]> = [];
    if (!c.w.has(x + 1, y, z)) sides.push([1, 0]); if (!c.w.has(x - 1, y, z)) sides.push([-1, 0]); if (!c.w.has(x, y, z + 1)) sides.push([0, 1]); if (!c.w.has(x, y, z - 1)) sides.push([0, -1]);
    if (!sides.length) continue;
    const bottom = !c.w.has(x, y - 1, z), top = !c.w.has(x, y + 1, z); if (!bottom && !top) continue;
    if (hash(x * 3 + y, z * 5 - y, 77) > (bottom ? 0.2 : 0.12)) continue;
    const [dx, dz] = sides[Math.floor(hash(x, z, y) * sides.length)], s = 0.55 + hash(x, y, z + 9) * 0.45;
    col.setHex(v.c).multiplyScalar(1.55);
    const px = (x + dx * 0.5) * CELL + (hash(x, y, 3) - 0.5) * 0.08, pz = (z + dz * 0.5) * CELL + (hash(z, y, 4) - 0.5) * 0.08;
    const py = bottom ? y * CELL - H * s * 0.5 : (y + 1) * CELL - H * s * 0.3;
    c.cards.add('leaf', px, pz, { y: py, s, tint: col.getHex() });
  }
}
