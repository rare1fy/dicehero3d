// Scene building blocks for the chapter-1 stages, all on the shared block grid (CELL, 7 cm). House rules (the user's): only
// axis-aligned masses, tapering by a few tiers, no diagonal or curved runs, no random speckle — variety comes from big patches and
// a few deliberate props. Every helper takes metres for placement (M converts) and writes cells into a VoxWorld.
import { VoxWorld } from '../look/voxkit';
import { CELL } from '../bestiary/kit';

export const M = (m: number) => Math.round(m / CELL);
export const hash = (a: number, b: number, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export type W = VoxWorld;
export const pick = <T>(arr: T[], a: number, b = 0, c = 0) => arr[Math.floor(hash(a, b, c) * arr.length) % arr.length];

/** the stage rectangle every scene floors (metres) and the clear battle area inside it */
export const AREA = { x0: -11, x1: 11, z0: -13, z1: 8 };
export const PLAY = { x0: -5.2, x1: 5.4, z0: -6.4, z1: 5.6 };
export const inPlay = (x: number, z: number) => x > PLAY.x0 && x < PLAY.x1 && z > PLAY.z0 && z < PLAY.z1;

// ------------------------------------------------------------------ floors (top surface at y = 0: cells at y = -1)
type Rect = { x0: number; z0: number; x1: number; z1: number };
const cellsOf = (r: Rect) => ({ X0: M(r.x0), X1: M(r.x1), Z0: M(r.z0), Z1: M(r.z1) });
/** big staggered flagstones with dark grout */
export function tiles(w: W, r: Rect, cols: number[], grout: number, o: { size?: number; moss?: number; mossCol?: number } = {}) {
  const { X0, X1, Z0, Z1 } = cellsOf(r), P = o.size ?? 15;
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    const tz = Math.floor((z - Z0) / P), lz = (z - Z0) % P, sx = x - X0 + (tz & 1 ? P >> 1 : 0), tx = Math.floor(sx / P), lx = sx % P;
    if (lx === P - 1 || lz === P - 1) { w.set(x, -2, z, grout); continue; }
    w.set(x, -1, z, o.moss && hash(tx, tz, 9) < o.moss && !inPlay(x * CELL, z * CELL) ? (o.mossCol ?? 0x4e7038) : cols[Math.floor(hash(tx, tz, 1) * cols.length)]);
  }
}
/** wooden boards running along x, staggered ends, dark seams between rows */
export function planks(w: W, r: Rect, cols: number[], seam: number) {
  const { X0, X1, Z0, Z1 } = cellsOf(r);
  for (let z = Z0; z < Z1; z++) {
    const row = Math.floor((z - Z0) / 5), lz = (z - Z0) % 5;
    for (let x = X0; x < X1; x++) {
      if (lz === 4) { w.set(x, -2, z, seam); continue; }
      const off = Math.floor(hash(row, 3) * 30), board = Math.floor((x - X0 + off) / 34), lx = (x - X0 + off) % 34;
      if (lx === 33) { w.set(x, -2, z, seam); continue; }
      w.set(x, -1, z, cols[Math.floor(hash(row, board) * cols.length)]);
    }
  }
}
/** smooth low-frequency field in about −1..1 (for ground regions that read as blobs, not a checkerboard) */
export const field = (x: number, z: number, seed = 1) => Math.sin(x * 0.23 + seed * 1.7) * Math.cos(z * 0.19 + seed * 0.9) * 0.7 + Math.sin((x + z) * 0.13 + seed * 2.3) * 0.5 + Math.cos((x - z) * 0.09 + seed) * 0.3;
/** ground in coherent regions: the first colour dominates, the others form a few large blobs (blocky edges, no speckle) */
export function patches(w: W, r: Rect, cols: number[], o: { size?: number; raise?: number[]; seed?: number } = {}) {
  const { X0, X1, Z0, Z1 } = cellsOf(r), S = o.size ?? 8, sd = o.seed ?? 1;
  const thr = [0, 0.55, 0.85, 1.1];
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    const px = Math.floor(x / S), pz = Math.floor(z / S), f = field(px, pz, sd);
    let i = 0; for (let k = 1; k < cols.length; k++) if ((k & 1 ? f : -f) > thr[Math.min(k, thr.length - 1)] - (k > 1 ? 0.15 : 0)) i = k;
    w.set(x, -1, z, cols[i]);
    if (o.raise && o.raise.includes(i) && !inPlay(x * CELL, z * CELL)) w.set(x, 0, z, cols[i]);
  }
}
/** a path of flat slabs (stepping stones) from (x,z0) to (x,z1) */
export function slabPath(w: W, x: number, z0: number, z1: number, c: number) {
  for (let z = M(z0); z < M(z1); z += 11) { const ox = Math.round((hash(z, 5) - 0.5) * 6); w.box(M(x) - 5 + ox, 0, z, M(x) + 5 + ox, 0, z + 8, c); }
}

// ------------------------------------------------------------------ walls (cutaway: tall at the back, stepping down toward the camera)
/** a wall run along x or z with a broken, stepped top; h in metres, t = thickness in blocks */
export function wall(w: W, x0: number, z0: number, x1: number, z1: number, h: number, c: number, o: { t?: number; band?: number; broken?: number; seed?: number } = {}) {
  const t = o.t ?? 4, X0 = M(Math.min(x0, x1)), X1 = M(Math.max(x0, x1)), Z0 = M(Math.min(z0, z1)), Z1 = M(Math.max(z0, z1)), H = M(h);
  const alongX = X1 - X0 >= Z1 - Z0, len = alongX ? X1 - X0 : Z1 - Z0;
  for (let i = 0; i <= len; i++) {
    const seg = Math.floor(i / 18), drop = o.broken ? Math.floor(hash(seg, o.seed ?? 1) * 3) * Math.round(H * (o.broken / 3)) : 0, hh = Math.max(2, H - drop);
    for (let k = 0; k < t; k++) {
      const x = alongX ? X0 + i : X0 + k - (t >> 1), z = alongX ? Z0 + k - (t >> 1) : Z0 + i;
      w.box(x, -2, z, x, hh, z, c);
      if (o.band != null) w.set(x, Math.min(hh, M(0.5)), z, o.band);
    }
  }
}
/** a rock wall of stacked boulders around a rectangle's back and sides (caves) */
export function rockRing(w: W, r: Rect, h: number, cols: number[], o: { front?: boolean; seed?: number } = {}) {
  const block = (cx: number, cz: number, s: number, hh: number, c: number) => w.box(cx - s, -2, cz - s, cx + s, hh, cz + s, c);
  const sd = o.seed ?? 1;
  const edge = (x0: number, z0: number, x1: number, z1: number, hMax: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.1));
    for (let i = 0; i <= n; i++) { const t = i / n, x = M(x0 + (x1 - x0) * t), z = M(z0 + (z1 - z0) * t), s = 8 + Math.floor(hash(i, sd) * 6), hh = M(hMax * (0.55 + hash(i, sd, 3) * 0.45)); block(x, z, s, hh, cols[i % cols.length]); }
  };
  edge(r.x0, r.z0, r.x1, r.z0, h);                     // back
  edge(r.x0, r.z0, r.x0, r.z1, h * 0.6); edge(r.x1, r.z0, r.x1, r.z1, h * 0.6);   // sides, lower
  if (o.front) edge(r.x0, r.z1, r.x1, r.z1, h * 0.18);
}

// ------------------------------------------------------------------ props (x, z in metres at the base; sizes in blocks unless noted)
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
export function rock(w: W, x: number, z: number, s: number, h: number, c: number, top?: number) { const X = M(x), Z = M(z); w.box(X - s, -2, Z - s, X + s, h, Z + s, c).box(X - s + 2, h + 1, Z - s + 2, X + s - 3, h + 2, Z + s - 2, top ?? c); }
export function mushroom(w: W, x: number, z: number, s: number, stem: number, cap: number, glow = 0) {
  const X = M(x), Z = M(z), H = s * 2;
  w.box(X - (s >> 1), 0, Z - (s >> 1), X + (s >> 1), H, Z + (s >> 1), stem).box(X - s, H + 1, Z - s, X + s, H + 2, Z + s, cap, glow).box(X - s + 1, H + 3, Z - s + 1, X + s - 1, H + 3, Z + s - 1, cap, glow);
}
export function crate(w: W, x: number, z: number, s: number, c: number, band: number) { const X = M(x), Z = M(z); w.box(X - s, 0, Z - s, X + s, 2 * s, Z + s, c).box(X - s, 2 * s, Z - s, X + s, 2 * s, Z + s, band).box(X - s, 0, Z - s, X - s, 2 * s, Z - s, band).box(X + s, 0, Z + s, X + s, 2 * s, Z + s, band); }
export function barrel(w: W, x: number, z: number, c: number, hoop: number) { const X = M(x), Z = M(z); w.box(X - 3, 0, Z - 3, X + 3, 11, Z + 3, c).box(X - 3, 2, Z - 3, X + 3, 2, Z + 3, hoop).box(X - 3, 9, Z - 3, X + 3, 9, Z + 3, hoop).box(X - 2, 12, Z - 2, X + 2, 12, Z + 2, c); }
export function table(w: W, x: number, z: number, lx: number, lz: number, c: number, leg: number) { const X = M(x), Z = M(z), a = M(lx) >> 1, b = M(lz) >> 1; w.box(X - a, 10, Z - b, X + a, 11, Z + b, c); for (const [i, j] of [[-a + 1, -b + 1], [a - 1, -b + 1], [-a + 1, b - 1], [a - 1, b - 1]]) w.box(X + i, 0, Z + j, X + i, 9, Z + j, leg); }
export function candle(w: W, x: number, z: number, h: number, wax: number, flame: number, y0 = 0) { const X = M(x), Z = M(z); w.box(X, y0, Z, X, y0 + h - 1, Z, wax).set(X, y0 + h, Z, flame, 1); }
export function bones(w: W, x: number, z: number, bone: number, s = 1) { const X = M(x), Z = M(z); w.box(X - 3 * s, 0, Z, X + 3 * s, 0, Z, bone).box(X - 1, 0, Z - 2 * s, X - 1, 0, Z + 2 * s, bone).box(X + 2 * s, 0, Z + 2, X + 4 * s, 2, Z + 4, bone).set(X + 3 * s, 1, Z + 4, 0x1a1418); }
export function skull(w: W, x: number, z: number, y0: number, bone: number) { const X = M(x), Z = M(z); w.box(X - 2, y0, Z - 2, X + 1, y0 + 3, Z + 1, bone).set(X - 1, y0 + 2, Z + 1, 0x1a1418).set(X, y0 + 2, Z + 1, 0x1a1418); }
export function pillar(w: W, x: number, z: number, h: number, c: number, cap: number, o: { r?: number; broken?: boolean } = {}) {
  const X = M(x), Z = M(z), r = o.r ?? 4, H = M(h);
  w.box(X - r - 2, -2, Z - r - 2, X + r + 2, 1, Z + r + 2, cap).box(X - r, 2, Z - r, X + r, H, Z + r, c);
  if (!o.broken) w.box(X - r - 2, H + 1, Z - r - 2, X + r + 2, H + 3, Z + r + 2, cap); else w.box(X - r, H + 1, Z - r, X, H + 3, Z + r, c);
}
/** a web in a frame: straight strands (a cross and two square rings), between two anchor points on a vertical plane */
export function web(w: W, x: number, z: number, y0: number, s: number, alongX: boolean, c: number) {
  const X = M(x), Z = M(z), put = (a: number, y: number) => (alongX ? w.set(X + a, y, Z, c) : w.set(X, y, Z + a, c));
  for (let i = -s; i <= s; i++) { put(i, y0 + s); put(0, y0 + s + i); }
  for (const r of [Math.round(s * 0.45), Math.round(s * 0.85)]) for (let i = -r; i <= r; i++) { put(i, y0 + s - r); put(i, y0 + s + r); put(-r, y0 + s + i); put(r, y0 + s + i); }
}
export function eggSac(w: W, x: number, z: number, s: number, c: number, glowC: number) { const X = M(x), Z = M(z); w.box(X - s, 0, Z - s, X + s, 2 * s, Z + s, c).box(X - s + 1, 2 * s + 1, Z - s + 1, X + s - 1, 2 * s + 1, Z + s - 1, c).box(X - 1, s, Z + s, X, s + 1, Z + s, glowC, 1); }
export function sarcophagus(w: W, x: number, z: number, alongX: boolean, stone: number, lid: number) {
  const X = M(x), Z = M(z), a = alongX ? 13 : 6, b = alongX ? 6 : 13;
  w.box(X - a, -1, Z - b, X + a, 7, Z + b, stone).box(X - a + 1, 8, Z - b + 1, X + a - 1, 9, Z + b - 1, lid).box(X - a + 3, 10, Z - b + 3, X + a - 3, 10, Z + b - 3, lid);
}
export function bars(w: W, x0: number, z0: number, x1: number, z1: number, h: number, iron: number) {
  const X0 = M(x0), X1 = M(x1), Z0 = M(z0), Z1 = M(z1), H = M(h), alongX = Math.abs(X1 - X0) > Math.abs(Z1 - Z0), n = alongX ? X1 - X0 : Z1 - Z0;
  for (let i = 0; i <= n; i++) { const x = alongX ? X0 + i : X0, z = alongX ? Z0 : Z0 + i; if (i % 4 === 0) w.box(x, 0, z, x, H, z, iron); w.set(x, H, z, iron); w.set(x, 1, z, iron); }
}
export function torchPost(w: W, x: number, z: number, h: number, wood: number, fire: number) { const X = M(x), Z = M(z), H = M(h); w.box(X - 1, -2, Z - 1, X + 1, H, Z + 1, wood).box(X - 2, H + 1, Z - 2, X + 2, H + 1, Z + 2, 0x2c2a32).box(X - 1, H + 2, Z - 1, X + 1, H + 4, Z + 1, fire, 1).set(X, H + 5, Z, fire, 1); return [x, (H + 4) * CELL, z] as [number, number, number]; }
export function brazier(w: W, x: number, z: number, iron: number, fire: number) { const X = M(x), Z = M(z); w.box(X - 1, 0, Z - 1, X + 1, 9, Z + 1, iron).box(X - 4, 10, Z - 4, X + 4, 12, Z + 4, iron).box(X - 3, 13, Z - 3, X + 3, 14, Z + 3, fire, 1).box(X - 1, 15, Z - 1, X + 1, 16, Z + 1, fire, 1); return [x, 15 * CELL, z] as [number, number, number]; }
export function fence(w: W, x0: number, z: number, x1: number, wood: number) { const X0 = M(x0), X1 = M(x1), Z = M(z); for (let x = X0; x <= X1; x++) { if ((x - X0) % 12 === 0) w.box(x, -2, Z, x + 1, 12, Z + 1, wood); w.set(x, 8, Z, wood).set(x, 4, Z, wood); } }
export function grave(w: W, x: number, z: number, s: number, stone: number, kind: number, engrave = 0x3a3a4a) {
  const X = M(x), Z = M(z), H = Math.round(16 * s), Wd = Math.round(5 * s);
  w.box(X - Wd - 2, -2, Z - 3, X + Wd + 2, -1, Z + 3, 0x46445a);
  if (kind < 0.5) { w.box(X - Wd, 0, Z - 1, X + Wd, H - 3, Z + 1, stone).box(X - Wd + 2, H - 2, Z - 1, X + Wd - 2, H, Z + 1, stone).box(X, Math.round(H * 0.35), Z + 2, X, H - 4, Z + 2, engrave).box(X - 2, H - 6, Z + 2, X + 2, H - 6, Z + 2, engrave); }
  else { w.box(X - 1, 0, Z - 1, X + 1, H + 2, Z + 1, stone); const ay = Math.round((H + 3) * 0.66); w.box(X - Wd - 1, ay, Z - 1, X + Wd + 1, ay + 2, Z + 1, stone); }
}
export function cottageWall(w: W, x0: number, z0: number, x1: number, z1: number, h: number, stone: number, timber: number, plaster: number) {
  // stone footing, plaster panels between timber posts, a beam on top; broken in two steps toward one end
  const X0 = M(Math.min(x0, x1)), X1 = M(Math.max(x0, x1)), Z0 = M(Math.min(z0, z1)), Z1 = M(Math.max(z0, z1)), H = M(h), alongX = X1 - X0 >= Z1 - Z0, len = alongX ? X1 - X0 : Z1 - Z0;
  for (let i = 0; i <= len; i++) {
    const hh = i > len * 0.7 ? Math.round(H * 0.55) : i > len * 0.85 ? Math.round(H * 0.3) : H, post = i % 16 === 0;
    for (let k = -1; k <= 1; k++) { const x = alongX ? X0 + i : X0 + k, z = alongX ? Z0 + k : Z0 + i; w.box(x, -2, z, x, 6, z, stone); w.box(x, 7, z, x, hh, z, post ? timber : plaster); if (hh === H) w.set(x, H, z, timber); }
  }
}
