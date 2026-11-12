// The moonlit graveyard rebuilt in the characters' block language (same block size as the bestiary). Rules for a calm read:
// big flat masses, only axis-aligned edges (no diagonal or curved runs that turn into staircases), no random speckle; detail comes
// from a few deliberate pieces. Same layout as the smooth arena, so the battle staging (hero spot, altar, ghoul lanes, dice field)
// is unchanged.
import * as THREE from 'three';
import { VoxWorld } from './voxkit';
import { CELL } from '../bestiary/kit';

const C = {
  TILE: [0x6c6a7c, 0x666478, 0x716f84], GROUT: 0x2a2832, MOSS: 0x4e7038, MOSS_D: 0x3a5a2c, DIRT: 0x3a3030,
  ALTAR: 0x6a687e, ALTAR_D: 0x52506a, STEP: 0x84849c, GOLD: 0xd0a850,
  PILLAR: 0x7a7a90, PILLAR_D: 0x5c5c72, GRAVE: [0x7c7e8e, 0x686a7a, 0x5a5c6c], ENGRAVE: 0x3a3a4a, IRON: 0x2c2a36, IRON_L: 0x4a4858,
  BARK: 0x403436, BARK_D: 0x2c2326, WALL: 0x5a586a, WALL_D: 0x46445a, SOUL: 0x5affb0,
};
const hash = (a: number, b: number, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export interface VoxArena { meshes: THREE.Mesh[]; flames: THREE.Vector3[]; altarTop: number }

export function buildVoxArena(o: { altar: THREE.Vector3; altarR: number; lanterns: THREE.Vector3[] }): VoxArena {
  const w = new VoxWorld(CELL), M = (m: number) => Math.round(m / CELL);
  // ---------------------------------------------------------------- courtyard: big staggered flagstones (~1 m), flush with y = 0
  const X0 = M(-6.5), X1 = M(6.5), Z0 = M(-9.1), Z1 = M(7.9), P = 15;
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    const tz = Math.floor((z - Z0) / P), lz = (z - Z0) % P, sx = x - X0 + (tz & 1 ? 7 : 0), tx = Math.floor(sx / P), lx = sx % P;
    if (lx === P - 1 || lz === P - 1) { w.set(x, -2, z, C.GROUT); continue; }
    const margin = Math.abs(x * CELL) > 5.2 || z * CELL < -7.6 || z * CELL > 6.4;
    w.set(x, -1, z, margin && hash(tx, tz, 2) < 0.3 ? C.MOSS_D : C.TILE[Math.floor(hash(tx, tz, 1) * 3)]);
  }
  // a curb around the courtyard, in long even runs
  const curb = (x0: number, z0: number, x1: number, z1: number) => w.box(x0, -2, z0, x1, 0, z1, C.WALL_D);
  curb(X0 - 3, Z0 - 3, X1 + 2, Z0 - 1); curb(X0 - 3, Z1, X1 + 2, Z1 + 2); curb(X0 - 3, Z0, X0 - 1, Z1 - 1); curb(X1, Z0, X1 + 2, Z1 - 1);
  // low walls along the sides: plain blocks, one height each
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? -1 : 1, zc = M(-7.6 + (i % 5) * 3.2), h = M(0.35 + hash(i, 2) * 0.45), len = M(1.6 + hash(i, 3) * 0.6), x = side * M(6.9);
    w.box(x - 4, -2, zc - (len >> 1), x + 4, h, zc + (len >> 1), C.WALL);
    w.box(x - 4, h + 1, zc - (len >> 1), x + 4, h + 1, zc - (len >> 1) + Math.round(len * 0.4), C.WALL_D);
  }
  // ---------------------------------------------------------------- the altar: two square tiers with notched corners, a gold rim, front steps
  const ax = M(o.altar.x), az = M(o.altar.z), rB = M(o.altarR + 0.7), rM = M(o.altarR + 0.2), top = M(0.56);
  const sq = (dx: number, dz: number, r: number, n: number) => Math.abs(dx) <= r && Math.abs(dz) <= r && !(Math.abs(dx) > r - n && Math.abs(dz) > r - n);
  for (let dx = -rB; dx <= rB; dx++) for (let dz = -rB; dz <= rB; dz++) {
    if (sq(dx, dz, rM, 5)) { w.box(ax + dx, -2, az + dz, ax + dx, top - 1, az + dz, C.ALTAR); if (!sq(dx, dz, rM - 1, 5)) w.set(ax + dx, top - 1, az + dz, C.GOLD); }
    else if (sq(dx, dz, rB, 7)) w.box(ax + dx, -2, az + dz, ax + dx, 1, az + dz, C.ALTAR_D);
  }
  for (let i = 0; i < 3; i++) { const sw = M(1.3 - i * 0.15), z0 = az + rM - 2 + i * 5, h = top - 1 - (i + 1) * 2; w.box(ax - sw, -2, z0, ax + sw, h, z0 + 5, C.STEP); }
  // ---------------------------------------------------------------- the broken gate behind the altar: two pillars and a snapped lintel
  const archZ = M(o.altar.z - 2.2), archX = M(2.6), half = 5, base = M(0.5);
  for (const [sx, hm] of [[-1, 6.2], [1, 4.4]] as const) {
    const cx = sx * archX, h = M(hm);
    w.box(cx - 7, -2, archZ - 7, cx + 7, base, archZ + 7, C.PILLAR_D);
    w.box(cx - half, base + 1, archZ - half, cx + half, base + h, archZ + half, C.PILLAR);
    w.box(cx - 7, base + h + 1, archZ - 7, cx + 7, base + h + 4, archZ + 7, C.STEP);
  }
  const lintelY = base + M(6.2) + 5;
  w.box(-archX - 7, lintelY, archZ - 5, M(0.4), lintelY + 8, archZ + 5, C.PILLAR).box(-archX - 7, lintelY + 9, archZ - 5, M(-0.6), lintelY + 9, archZ + 5, C.PILLAR_D);
  // its fallen end, lying beside the right pillar
  w.box(M(3.4), -1, M(o.altar.z - 1.0), M(4.9), 7, M(o.altar.z - 0.4), C.PILLAR).box(M(3.0), -1, M(o.altar.z + 0.6), M(3.8), 5, M(o.altar.z + 1.6), C.PILLAR_D);
  // ---------------------------------------------------------------- graves on both flanks and in the back, upright, each with a mound
  let gi = 0;
  const grave = (gx: number, gz: number, s: number) => {
    const kind = hash(gi, 9), x0 = M(gx), z0 = M(gz), stone = C.GRAVE[gi % 3]; gi++;
    const H = Math.round(18 * s), W = Math.round(5 * s);
    w.box(x0 - W - 2, -2, z0 - 3, x0 + W + 2, -1, z0 + 3, C.WALL_D);
    if (kind < 0.45) {   // slab with a stepped top and an engraved cross
      w.box(x0 - W, 0, z0 - 1, x0 + W, H - 3, z0 + 1, stone).box(x0 - W + 2, H - 2, z0 - 1, x0 + W - 2, H, z0 + 1, stone);
      w.box(x0, Math.round(H * 0.35), z0 + 2, x0, H - 4, z0 + 2, C.ENGRAVE).box(x0 - 2, H - 6, z0 + 2, x0 + 2, H - 6, z0 + 2, C.ENGRAVE);
    } else if (kind < 0.75) {   // a cross
      w.box(x0 - 1, 0, z0 - 1, x0 + 1, H + 2, z0 + 1, stone);
      const ay = Math.round((H + 3) * 0.66); w.box(x0 - W - 1, ay, z0 - 1, x0 + W + 1, ay + 2, z0 + 1, stone);
    } else {   // an obelisk in three steps
      const t = Math.round(H / 3); w.box(x0 - W, 0, z0 - W, x0 + W, t, z0 + W, stone).box(x0 - W + 2, t + 1, z0 - W + 2, x0 + W - 2, 2 * t, z0 + W - 2, stone).box(x0 - 1, 2 * t + 1, z0 - 1, x0 + 1, H + 1, z0 + 1, stone);
    }
    w.box(x0 - W, -1, z0 + 4, x0 + W, -1, z0 + 4 + Math.round(10 * s), C.DIRT).box(x0 - W + 1, 0, z0 + 6, x0 + W - 1, 0, z0 + 2 + Math.round(10 * s), hash(gi, 5) < 0.5 ? C.MOSS_D : C.DIRT);
  };
  for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) for (const side of [-1, 1]) grave(side * (7.8 + k * 1.7), -7 + row * 3.3, 0.85 + hash(row, k, 3) * 0.35);
  for (let i = 0; i < 7; i++) grave(-12 + i * 4, -12.5 - (i & 1) * 2.5, 1.1);
  // ---------------------------------------------------------------- iron fence along the back
  const fz = M(-10.2);
  for (let i = -9; i <= 9; i++) { if (Math.abs(i) < 3) continue; const x = M(i * 0.9); w.box(x, -2, fz, x, M(1.8), fz, C.IRON).box(x, M(1.8) + 1, fz, x, M(1.8) + 2, fz, C.IRON_L); }
  for (const y of [M(0.4), M(1.5)]) { w.box(M(-8.2), y, fz, M(-2.65), y, fz, C.IRON); w.box(M(2.65), y, fz, M(8.2), y, fz, C.IRON); }
  // ---------------------------------------------------------------- bare dead trees: a trunk in three widths, branches that go out then up
  for (const [tx, tz, h, s] of [[-8.5, -3, 6.5, 1], [9.2, -8.5, 7.5, 2], [-10.5, 4.5, 5.5, 3], [11, 2.5, 6, 4]] as const) {
    const x = M(tx), z = M(tz), trunk = M(h * 0.45), t3 = Math.round(trunk / 3);
    w.box(x - 3, -2, z - 3, x + 3, t3, z + 3, C.BARK).box(x - 2, t3 + 1, z - 2, x + 2, 2 * t3, z + 2, C.BARK).box(x - 1, 2 * t3 + 1, z - 1, x + 1, trunk + M(h * 0.15), z + 1, C.BARK);
    w.box(x - 5, -2, z - 1, x + 5, -1, z + 1, C.BARK_D).box(x - 1, -2, z - 5, x + 1, -1, z + 5, C.BARK_D);
    const arms: Array<[number, number, number, number]> = [[1, 0, trunk - 4, 1], [-1, 0, trunk - 10, 0], [0, 1, trunk + 2, 1], [0, -1, trunk - 6, 0]];
    for (const [ddx, ddz, y, up] of arms) {
      const len = M(h * (0.14 + hash(s, y) * 0.08)), rise = M(h * (0.1 + up * 0.08)), ex = x + ddx * len, ez = z + ddz * len;
      w.box(Math.min(x, ex), y, Math.min(z, ez), Math.max(x, ex), y + 1, Math.max(z, ez), C.BARK).box(ex, y, ez, ex + (ddz ? 1 : 0), y + rise, ez + (ddx ? 1 : 0), C.BARK_D);
      const tw = Math.round(len * 0.5); w.box(Math.min(ex, ex + ddz * tw), y + rise, Math.min(ez, ez - ddx * tw), Math.max(ex, ex + ddz * tw), y + rise, Math.max(ez, ez - ddx * tw), C.BARK_D);
    }
  }
  // ---------------------------------------------------------------- soul-fire lantern posts
  const flames: THREE.Vector3[] = [];
  for (const p of o.lanterns) {
    const x = M(p.x), z = M(p.z), hTop = M(2.1);
    w.box(x - 2, -2, z - 2, x + 2, 0, z + 2, C.WALL_D).box(x - 1, 1, z - 1, x + 1, hTop, z + 1, C.IRON);
    w.box(x - 3, hTop + 1, z - 3, x + 3, hTop + 1, z + 3, C.IRON).box(x - 3, hTop + 7, z - 3, x + 3, hTop + 7, z + 3, C.IRON).box(x - 2, hTop + 8, z - 2, x + 2, hTop + 8, z + 2, C.IRON);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) w.box(x + dx, hTop + 2, z + dz, x + dx, hTop + 6, z + dz, C.IRON);
    w.box(x - 1, hTop + 2, z - 1, x + 1, hTop + 4, z + 1, C.SOUL, 1);
    flames.push(new THREE.Vector3((x + 0.5) * CELL, (hTop + 4) * CELL, (z + 0.5) * CELL));
  }
  return { meshes: w.build({ glow: 2.6 }), flames, altarTop: top * CELL };
}
