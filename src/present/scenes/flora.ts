// Vegetation on the block grid: trees, stumps, logs, mushrooms, and the dark-woods ring most outdoor scenes stand in.
// Same house rules as props.ts: axis-aligned masses, a few tiers, no diagonal stair-steps, no random speckle.
import { type Ctx } from './stage';
import { M, hash, type W } from './props';
import { BARK, BARK_D, PINE, PINE_T } from './common';

export function deadTree(w: W, x: number, z: number, h: number, bark: number, dark: number, o: { seed?: number; leaves?: number; leavesTop?: number } = {}) {
  const X = M(x), Z = M(z), T = M(h * 0.5), t3 = Math.round(T / 3), s = o.seed ?? 1;
  w.box(X - 3, -2, Z - 3, X + 3, t3, Z + 3, bark).box(X - 2, t3 + 1, Z - 2, X + 2, 2 * t3, Z + 2, bark).box(X - 1, 2 * t3 + 1, Z - 1, X + 1, T + M(h * 0.12), Z + 1, bark);
  w.box(X - 6, -2, Z - 1, X + 6, -1, Z + 1, dark).box(X - 1, -2, Z - 6, X + 1, -1, Z + 6, dark);
  const arms: Array<[number, number, number]> = [[1, 0, T - 4], [-1, 0, T - 9], [0, 1, T + 1], [0, -1, T - 6]];
  for (const [dx, dz, y] of arms) {
    const len = M(h * (0.13 + hash(s, y) * 0.08)), rise = M(h * (0.12 + hash(s, y, 2) * 0.08)), ex = X + dx * len, ez = Z + dz * len;
    w.box(Math.min(X, ex), y, Math.min(Z, ez), Math.max(X, ex), y + 1, Math.max(Z, ez), bark).box(ex, y, ez, ex + (dz ? 1 : 0), y + rise, ez + (dx ? 1 : 0), dark);
    if (o.leaves != null) { w.box(ex - 4, y + rise - 1, ez - 4, ex + 4, y + rise + 3, ez + 4, o.leaves); w.box(ex - 3, y + rise + 4, ez - 3, ex + 3, y + rise + 4, ez + 3, o.leavesTop ?? o.leaves); }
  }
}
/** a dark pine-ish tree: trunk + three stacked foliage tiers */

export function pine(w: W, x: number, z: number, h: number, trunk: number, leaf: number, leafTop: number) {
  const X = M(x), Z = M(z), H = M(h), base = Math.round(H * 0.25);
  w.box(X - 1, -2, Z - 1, X + 1, base, Z + 1, trunk);
  const tiers = [[9, 0.25, 0.5], [7, 0.45, 0.7], [4, 0.65, 0.88], [2, 0.84, 1]];
  for (const [r, a, b] of tiers) w.box(X - r, Math.round(H * a), Z - r, X + r, Math.round(H * b), Z + r, leaf);
  w.box(X - 1, H + 1, Z - 1, X + 1, H + 2, Z + 1, leafTop);
}

export function stump(w: W, x: number, z: number, r: number, h: number, bark: number, top: number) { const X = M(x), Z = M(z); w.box(X - r, -2, Z - r, X + r, h - 1, Z + r, bark).box(X - r + 1, h - 1, Z - r + 1, X + r - 1, h - 1, Z + r - 1, top); }

export function log(w: W, x: number, z: number, len: number, alongX: boolean, bark: number, end: number) {
  const X = M(x), Z = M(z), L = M(len) >> 1;
  if (alongX) { w.box(X - L, 0, Z - 3, X + L, 5, Z + 3, bark).box(X - L, 1, Z - 2, X - L, 4, Z + 2, end).box(X + L, 1, Z - 2, X + L, 4, Z + 2, end); }
  else { w.box(X - 3, 0, Z - L, X + 3, 5, Z + L, bark).box(X - 2, 1, Z - L, X + 2, 4, Z - L, end).box(X - 2, 1, Z + L, X + 2, 4, Z + L, end); }
}

export function mushroom(w: W, x: number, z: number, s: number, stem: number, cap: number, glow = 0) {
  const X = M(x), Z = M(z), H = s * 2;
  w.box(X - (s >> 1), 0, Z - (s >> 1), X + (s >> 1), H, Z + (s >> 1), stem).box(X - s, H + 1, Z - s, X + s, H + 2, Z + s, cap, glow).box(X - s + 1, H + 3, Z - s + 1, X + s - 1, H + 3, Z + s - 1, cap, glow);
}


/** dark woods ring: pines and dead trees around the outside of the stage */
export function woodsRing(c: Ctx, seed: number, dense = 1) {
  const spots: Array<[number, number]> = [[-8.8, -10.2], [-5.6, -11.4], [-2.4, -11.8], [2.2, -11.6], [5.8, -11.2], [8.8, -9.4], [-9, -5.2], [9, -4.6], [-8.8, -0.4], [8.8, 0.4], [-8.6, 4.4], [8.6, 4.8], [-7.2, -8], [7.4, -7.6], [-6.9, -4.6], [7.1, -3.8], [-7.2, 1.6], [7.3, 2.4]];
  spots.forEach(([x, z], i) => { if (hash(i, seed, 4) > dense) return; if (hash(i, seed) < 0.6) pine(c.w, x + (hash(i, seed, 1) - 0.5), z, 6 + hash(i, seed, 2) * 3, BARK_D, PINE, PINE_T); else deadTree(c.w, x, z, 5.5 + hash(i, seed, 3) * 2, BARK, BARK_D, { seed: i + seed }); });
}
