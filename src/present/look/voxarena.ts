// The moonlit graveyard in the characters' block language (same block size as the bestiary). Shared by the battle (look/env.ts) and
// the scene browser, so its contract is fixed: the courtyard, the altar (centre, radius, top height) and the four lantern posts stay
// where the battle staging expects them, and the courtyard floor stays flat and clear for the dice.
// Rules for a calm read: big flat masses, only axis-aligned edges, slopes as a few wide tiers, no random speckle; detail comes from
// structured patterns (stone courses, iron finials in a row, carved panels) and from props grouped into small scenes: a grave plot is
// a headstone on a plinth, a mound or a ledger stone inside a kerb, flowers or candles at its foot.
// Layout: the lich's altar in the middle; behind it a gated iron fence with two hooded keeper statues on the gate piers, and the
// mausoleum (podium, portico, pediment roof, a crypt door leaking soul light) as the landmark at the back; broken walls along the
// sides; rows of grave plots on both flanks; dead trees in the corners.
import * as THREE from 'three';
import { VoxWorld } from './voxkit';
import { CELL } from '../bestiary/kit';

const C = {
  TILE: [0x6c6a7c, 0x666478, 0x716f84], GROUT: 0x2a2832, MOSS: 0x4e7038, MOSS_D: 0x3a5a2c, DIRT: 0x3a3030, RUN: [0x7a788c, 0x747286], RUN_E: 0x4a4858, APRON: 0x5a586c,
  ALTAR: 0x6a687e, ALTAR_D: 0x52506a, STEP: 0x84849c, GOLD: 0xd0a850, GOLD_D: 0x9a7a3a,
  PILLAR: 0x7a7a90, PILLAR_D: 0x5c5c72, GRAVE: [0x7c7e8e, 0x686a7a, 0x5a5c6c], ENGRAVE: 0x3a3a4a, IRON: 0x2c2a36, IRON_L: 0x4a4858,
  BARK: 0x403436, BARK_D: 0x2c2326, WALL: 0x5a586a, WALL_D: 0x46445a, WALL_L: 0x6e6c80, SOUL: 0x5affb0,
  ROOF: 0x4a4860, ROOF_L: 0x5e5c76, DOOR: 0x2a2430, DARK: 0x14121a, STATUE: 0x7c7e90, STATUE_D: 0x5e6072, STATUE_L: 0x9496a8,
  TURF: [0x2e3430, 0x282e2a, 0x36382e], WAX: 0xe6dcc4, FLAME: 0xffc860, PETAL: [0xd8d0ff, 0xf0e8f0, 0xc8a8e8], LEAFG: 0x4a6a3a,
};
const hash = (a: number, b: number, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export interface VoxArena { meshes: THREE.Mesh[]; flames: THREE.Vector3[]; altarTop: number; world: VoxWorld }

export function buildVoxArena(o: { altar: THREE.Vector3; altarR: number; lanterns: THREE.Vector3[] }): VoxArena {
  const w = new VoxWorld(CELL), M = (m: number) => Math.round(m / CELL);
  const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number | null, g = 0) => w.box(x0, y0, z0, x1, y1, z1, c, g);
  const ax = M(o.altar.x), az = M(o.altar.z), rB = M(o.altarR + 0.7), rM = M(o.altarR + 0.2), top = M(0.56);
  const stepW = M(1.3), stepFront = az + rM - 2 + 15;
  // ---------------------------------------------------------------- courtyard: big staggered flagstones (~1 m), flush with y = 0;
  // a processional runner of lighter slabs from the altar steps to the front, a darker apron around the altar
  const X0 = M(-6.5), X1 = M(6.5), Z0 = M(-9.1), Z1 = M(7.9), P = 15, RW = M(1.25);
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    const dx = Math.abs(x - ax), dz = Math.abs(z - az);
    if (Math.abs(x) <= RW && z >= stepFront) {
      if (Math.abs(x) === RW) { w.set(x, -1, z, C.RUN_E); continue; }
      const lz = (z - stepFront) % 12; if (lz === 11) { w.set(x, -2, z, C.GROUT); continue; }
      w.set(x, -1, z, C.RUN[Math.floor((z - stepFront) / 12) % 2]); continue;
    }
    if (dx <= rB + 3 && dz <= rB + 3) { w.set(x, -1, z, C.APRON); continue; }
    const tz = Math.floor((z - Z0) / P), lz = (z - Z0) % P, sx = x - X0 + (tz & 1 ? 7 : 0), tx = Math.floor(sx / P), lx = sx % P;
    if (lx === P - 1 || lz === P - 1) { w.set(x, -2, z, C.GROUT); continue; }
    const margin = Math.abs(x * CELL) > 5.2 || z * CELL < -7.6 || z * CELL > 6.4;
    w.set(x, -1, z, margin && hash(tx, tz, 2) < 0.3 ? C.MOSS_D : C.TILE[Math.floor(hash(tx, tz, 1) * 3)]);
  }
  // the graveyard ground outside the courtyard: dark turf in big blocky patches; a short paved path from the gate to the mausoleum
  for (let x = M(-12); x < M(12); x++) for (let z = M(-16); z < M(8.6); z++) {
    if (x >= X0 - 3 && x < X1 + 3 && z >= Z0 - 3 && z < Z1 + 3) continue;
    if (Math.abs(x) <= 22 && z >= M(-10.5) && z < Z0 - 3) { const lz = (z - M(-10.5)) % 10; w.set(x, lz === 9 || Math.abs(x) === 22 ? -2 : -1, z, lz === 9 || Math.abs(x) === 22 ? C.GROUT : C.TILE[(Math.floor((z + 400) / 10) + (x < 0 ? 0 : 1)) % 3]); continue; }
    const px = Math.floor(x / 9), pz = Math.floor(z / 9), f = Math.sin(px * 0.8 + 2) * Math.cos(pz * 0.6) + Math.sin((px + pz) * 0.37) * 0.5;
    w.set(x, -1, z, f > 0.7 ? C.TURF[2] : f < -0.6 ? C.TURF[1] : C.TURF[0]);
  }
  // a kerb around the courtyard, in long even runs
  const curb = (x0: number, z0: number, x1: number, z1: number) => B(x0, -2, z0, x1, 0, z1, C.WALL_D);
  curb(X0 - 3, Z0 - 3, X1 + 2, Z0 - 1); curb(X0 - 3, Z1, X1 + 2, Z1 + 2); curb(X0 - 3, Z0, X0 - 1, Z1 - 1); curb(X1, Z0, X1 + 2, Z1 - 1);

  // ---------------------------------------------------------------- the altar: plinth with a lit lip, upper tier with carved panels and a
  // gold rim, gold-capped candle posts on the four notched corners, front steps between cheek blocks with gold nosings
  const sq = (dx: number, dz: number, r: number, n: number) => Math.abs(dx) <= r && Math.abs(dz) <= r && !(Math.abs(dx) > r - n && Math.abs(dz) > r - n);
  for (let dx = -rB; dx <= rB; dx++) for (let dz = -rB; dz <= rB; dz++) {
    if (sq(dx, dz, rM, 5)) { B(ax + dx, -2, az + dz, ax + dx, top - 1, az + dz, C.ALTAR); if (!sq(dx, dz, rM - 1, 5)) w.set(ax + dx, top - 1, az + dz, C.GOLD); }
    else if (sq(dx, dz, rB, 7)) { B(ax + dx, -2, az + dz, ax + dx, 1, az + dz, C.ALTAR_D); if (!sq(dx, dz, rB - 1, 7)) w.set(ax + dx, 1, az + dz, C.STEP); }
  }
  // carved panels on the upper tier's faces (skipping the stair opening), a soul rune in the two panels beside the stairs
  for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const u of fz === 1 ? [-26, 26] : [-20, -10, 0, 10, 20]) {
    const hw = fz === 1 ? 2 : 3, px = fz ? ax + u : ax + fx * rM, pz = fz ? az + fz * rM : az + u;
    B(fz ? px - hw : px, 3, fz ? pz : pz - hw, fz ? px + hw : px, 5, fz ? pz : pz + hw, C.ALTAR_D);
    if (fz === 1) B(px, 3, pz, px, 5, pz, C.SOUL, 1);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = ax + sx * (rM - 2), cz = az + sz * (rM - 2);
    B(cx - 2, 2, cz - 2, cx + 2, top + 1, cz + 2, C.ALTAR_D);
    B(cx - 2, top + 2, cz - 2, cx + 2, top + 2, cz + 2, C.GOLD).box(cx - 1, top + 3, cz - 1, cx + 1, top + 3, cz + 1, C.GOLD_D);
    candles(cx, top + 4, cz, sx * 3 + sz);
  }
  for (let i = 0; i < 3; i++) {
    const sw = stepW, z0 = az + rM - 2 + i * 5, h = top - 1 - (i + 1) * 2;
    B(ax - sw, -2, z0, ax + sw, h, z0 + 4, C.STEP); B(ax - sw, h, z0 + 4, ax + sw, h, z0 + 4, C.GOLD);
    for (const s of [-1, 1]) { const a = s < 0 ? ax - stepW - 4 : ax + stepW + 1, b = s < 0 ? ax - stepW - 1 : ax + stepW + 4; B(a, -2, z0, b, h + 1, z0 + 4, C.ALTAR_D); B(a, h + 2, z0, b, h + 2, z0 + 4, C.STEP); }
  }

  // ---------------------------------------------------------------- small pieces used everywhere
  function candles(x: number, y: number, z: number, sd: number) {
    const hs = [3, 5, 2];
    [[-1, 0], [1, -1], [0, 1]].forEach(([dx, dz], i) => { const h = hs[(i + Math.abs(sd)) % 3]; B(x + dx, y, z + dz, x + dx, y + h - 1, z + dz, C.WAX); w.set(x + dx, y + h, z + dz, C.FLAME, 1); });
  }
  const bouquet = (x: number, z: number, sd: number) => {
    B(x - 1, 0, z - 1, x + 1, 1, z + 1, C.WALL_L); B(x, 2, z, x, 3, z, C.LEAFG);
    const p = C.PETAL[sd % 3]; w.set(x, 4, z, p).set(x - 1, 3, z, p).set(x + 1, 3, z, p).set(x, 3, z - 1, C.LEAFG);
  };

  // ---------------------------------------------------------------- the mausoleum at the back centre (the landmark)
  {
    const Zf = M(-10.4), Zb = M(-14.8), cz0 = M(-14.3), cz1 = M(-11.9);
    // podium in three tiers, stairs down to the gate
    B(-50, -2, Zb, 50, 2, Zf, C.WALL_D); B(-46, 3, Zb + 4, 46, 6, Zf - 4, C.STEP);
    B(-46, 6, Zf - 4, 46, 6, Zf - 4, C.WALL_L);
    B(-16, -2, Zf - 4, 16, 3, Zf - 1, C.STEP); B(-16, -2, Zf, 16, 0, Zf + 3, C.STEP);
    B(-16, 3, Zf - 1, 16, 3, Zf - 1, C.WALL_L); B(-16, 0, Zf + 3, 16, 0, Zf + 3, C.WALL_L);
    for (const s of [-1, 1]) B(s * 17, -2, Zf - 4, s * 19, 6, Zf + 3, C.WALL_D);
    // the cella: ashlar courses, a darker base course, corner pilasters
    for (let y = 7; y <= 38; y++) B(-34, y, cz0, 34, y, cz1, y <= 8 ? C.WALL_D : Math.floor((y - 9) / 6) % 2 ? C.WALL : C.PILLAR_D);
    for (const s of [-1, 1]) B(s < 0 ? -36 : 33, 7, cz1 - 3, s < 0 ? -33 : 36, 38, cz1 + 1, C.PILLAR);
    // crypt door: stepped arch, deep recess, iron-banded leaves, soul light through the seam and under the door
    const dTop = 28;
    B(-10, 7, cz1 + 1, 10, dTop + 6, cz1 + 1, C.PILLAR); B(-3, dTop + 4, cz1 + 1, 3, dTop + 8, cz1 + 2, C.STEP);
    const open = (x: number, y: number) => Math.abs(x) <= 7 && y >= 7 && y <= dTop + 3 && !(y > dTop && Math.abs(x) > 5) && !(y > dTop + 2 && Math.abs(x) > 3);
    for (let x = -8; x <= 8; x++) for (let y = 7; y <= dTop + 4; y++) if (open(x, y)) B(x, y, cz1 - 3, x, y, cz1 + 1, null);
    B(-7, 7, cz1 - 4, 7, dTop + 3, cz1 - 4, C.DOOR);
    for (const y of [11, 18, 25]) B(-7, y, cz1 - 3, 7, y, cz1 - 3, C.IRON_L);
    B(0, 8, cz1 - 3, 0, dTop, cz1 - 3, C.SOUL, 1); B(-6, 7, cz1 - 3, 6, 7, cz1 - 3, C.SOUL, 1);
    for (const x of [-3, 3]) w.set(x, 17, cz1 - 2, C.GOLD_D);
    // portico: four columns (base, shaft, capital, abacus) on the podium
    for (const cx of [-28, -12, 12, 28]) {
      const zc = M(-11.3);
      B(cx - 3, 7, zc - 3, cx + 3, 8, zc + 3, C.WALL_L); B(cx - 2, 9, zc - 2, cx + 2, 33, zc + 2, C.PILLAR);
      B(cx - 1, 9, zc + 2, cx + 1, 33, zc + 2, C.STATUE_L);
      B(cx - 3, 34, zc - 3, cx + 3, 35, zc + 3, C.WALL_L); B(cx - 4, 36, zc - 4, cx + 4, 36, zc + 4, C.STEP);
    }
    // entablature: architrave, a frieze with a regular row of carved blocks, cornice
    const ez1 = M(-10.9);
    B(-36, 37, cz0 - 1, 36, 39, ez1, C.PILLAR); B(-35, 40, cz0, 35, 42, ez1 - 1, C.PILLAR_D);
    for (let x = -32; x <= 32; x += 8) B(x - 1, 40, ez1, x + 1, 42, ez1, C.PILLAR);
    B(-38, 43, cz0 - 3, 38, 44, ez1 + 1, C.STEP);
    // pediment roof: gable facing the courtyard, six wide tiers; each tier's front edge lit, its top in slate
    for (let k = 0; k < 5; k++) {
      const hw = 37 - k * 7, y0 = 45 + k * 4;
      B(-hw, y0, cz0 - 3, hw, y0 + 3, ez1, C.ROOF); B(-hw, y0 + 3, cz0 - 3, hw, y0 + 3, cz0 - 3 + 1, C.ROOF_L);
      B(-hw, y0, ez1, hw, y0 + 3, ez1, C.PILLAR); B(-hw, y0 + 3, ez1, hw, y0 + 3, ez1, C.STEP);
    }
    // the tympanum emblem: a soul gem in a gold frame; finials on the apex and the cornice corners
    B(-4, 47, ez1 + 1, 4, 55, ez1 + 1, C.GOLD); B(-2, 49, ez1 + 1, 2, 53, ez1 + 2, C.SOUL, 1);
    B(-2, 65, ez1 - 4, 2, 66, ez1, C.STEP); B(-1, 67, ez1 - 3, 1, 68, ez1 - 1, C.PILLAR); w.set(0, 69, ez1 - 2, C.STEP);
    for (const s of [-1, 1]) { B(s * 37 - 1, 45, ez1 - 2, s * 37 + 1, 47, ez1, C.STEP); w.set(s * 37, 48, ez1 - 1, C.PILLAR); }
    // soul braziers at the stair foot
    for (const s of [-1, 1]) { const bx = s * 26, bz = Zf - 2; B(bx - 2, 3, bz - 2, bx + 2, 6, bz + 2, C.IRON); B(bx - 3, 7, bz - 3, bx + 3, 8, bz + 3, C.IRON_L); B(bx - 2, 9, bz - 2, bx + 2, 9, bz + 2, C.SOUL, 1); w.set(bx, 10, bz, C.SOUL, 1); }
  }

  // ---------------------------------------------------------------- iron fence with spear finials on a stone sill, stone piers,
  // a wide gate opening guarded by two hooded keeper statues
  {
    const fz = M(-9.6), x0 = M(3.6), x1 = M(9.6);
    for (const s of [-1, 1]) {
      const a = s < 0 ? -x1 : x0, b = s < 0 ? -x0 : x1;
      B(a, -2, fz - 1, b, 2, fz + 1, C.WALL_D); B(a, 3, fz - 2, b, 3, fz + 2, C.WALL_L);
      for (let x = a; x <= b; x++) {
        if ((x + 400) % 4 === 0) { B(x, 4, fz, x, 22, fz, C.IRON); B(x - 1, 23, fz, x + 1, 23, fz, C.IRON_L); B(x, 24, fz, x, 25, fz, C.IRON_L); }
      }
      B(a, 7, fz, b, 7, fz, C.IRON); B(a, 19, fz, b, 19, fz, C.IRON);
      for (const px of [s < 0 ? a : b, Math.round((a + b) / 2)]) { B(px - 3, -2, fz - 3, px + 3, 24, fz + 3, C.WALL); B(px - 4, 25, fz - 4, px + 4, 26, fz + 4, C.WALL_L); B(px - 2, 27, fz - 2, px + 2, 27, fz + 2, C.STEP); B(px - 1, 28, fz - 1, px + 1, 29, fz + 1, C.WALL_L); }
    }
    // gate piers carrying the statues
    for (const s of [-1, 1]) {
      const px = s * M(3.0);
      B(px - 6, -2, fz - 6, px + 6, 1, fz + 6, C.WALL_D); B(px - 5, 2, fz - 5, px + 5, 11, fz + 5, C.WALL); B(px - 6, 12, fz - 6, px + 6, 13, fz + 6, C.WALL_L);
      B(px - 5, 6, fz + 6, px + 5, 6, fz + 6, C.WALL_D);
      keeper(px, 14, fz);
    }
  }
  // a hooded grave-keeper: a robe flaring in three tiers with folds, a mantle wider than the chest hanging down the back, sleeves
  // meeting at hands folded on the pommel of a sword planted point-down, a deep hood with a shadowed face and a stepped peak
  function keeper(x: number, y: number, z: number) {
    B(x - 6, y, z - 5, x + 6, y + 5, z + 4, C.STATUE); for (const fx of [-4, -2, 2, 4]) B(x + fx, y, z + 4, x + fx, y + 4, z + 4, C.STATUE_D);
    B(x - 5, y + 6, z - 4, x + 5, y + 13, z + 3, C.STATUE); B(x - 4, y + 14, z - 3, x + 4, y + 19, z + 3, C.STATUE);
    B(x - 5, y + 8, z - 5, x + 5, y + 19, z - 4, C.STATUE_D); B(x - 6, y + 20, z - 5, x + 6, y + 22, z + 3, C.STATUE_D);
    for (const s2 of [-1, 1]) B(x + s2 * 2, y + 15, z + 3, x + s2 * 4, y + 20, z + 4, C.STATUE);
    B(x, y, z + 5, x, y, z + 5, C.STATUE_L); B(x - 1, y + 1, z + 5, x + 1, y + 10, z + 5, C.STATUE_L); B(x - 3, y + 11, z + 4, x + 3, y + 12, z + 6, C.STATUE_D);
    B(x - 2, y + 13, z + 4, x + 2, y + 16, z + 6, C.STATUE); B(x - 1, y + 17, z + 5, x + 1, y + 17, z + 6, C.STATUE_D);
    B(x - 3, y + 23, z - 3, x + 3, y + 23, z + 2, C.STATUE_D);
    B(x - 4, y + 23, z - 4, x + 4, y + 30, z + 3, C.STATUE); B(x - 3, y + 31, z - 4, x + 3, y + 32, z + 2, C.STATUE); B(x - 1, y + 33, z - 3, x + 1, y + 34, z, C.STATUE);
    B(x - 2, y + 24, z + 1, x + 2, y + 28, z + 3, null); B(x - 2, y + 24, z, x + 2, y + 28, z, C.DARK);
    B(x - 3, y + 29, z + 3, x + 3, y + 29, z + 3, C.STATUE_L); for (const s2 of [-3, 3]) B(x + s2, y + 23, z + 3, x + s2, y + 28, z + 3, C.STATUE_L);
    B(x - 6, y + 22, z - 5, x - 3, y + 22, z, C.MOSS_D); B(x - 3, y + 32, z - 4, x - 1, y + 32, z - 1, C.MOSS_D);
  }

  // ---------------------------------------------------------------- broken walls down both sides: plinth, coursed body, coping; tops
  // stepping down in wide steps toward the breaks, fallen coping blocks on the ground
  for (const side of [-1, 1]) {
    const segs: Array<[number, number, number, number]> = [[-7.6, -5.8, 1.1, 1], [-5.0, -3.2, 0.7, -1], [-2.2, -0.2, 1.0, 1], [0.8, 2.4, 0.6, -1], [3.4, 5.0, 0.85, 1]];
    const xc = side * M(6.95);
    segs.forEach(([za, zb, h, brk], i) => {
      const A = M(za), Bz = M(zb), H = M(h), n = Bz - A;
      B(xc - 4, -2, A - 1, xc + 4, 1, Bz + 1, C.WALL_D);
      for (let k = 0; k <= n; k++) {
        const t = brk > 0 ? k : n - k, hh = t > n * 0.82 ? Math.round(H * 0.45) : t > n * 0.62 ? Math.round(H * 0.75) : H, z = A + k;
        for (let y = 2; y <= hh; y++) B(xc - 3, y, z, xc + 3, y, z, Math.floor((y - 2) / 5) % 2 ? C.WALL : C.PILLAR_D);
        if (hh === H) B(xc - 4, H + 1, z, xc + 4, H + 2, z, C.WALL_L);
      }
      const fzc = brk > 0 ? Bz + 4 : A - 4, fx = xc - side * 7;
      B(fx - 4, -1, fzc - 2, fx + 4, 1, fzc + 2, C.WALL_L); if (i % 2 === 0) B(fx - 2, 2, fzc - 1, fx + 3, 3, fzc + 2, C.WALL);
    });
  }

  // ---------------------------------------------------------------- grave plots: headstone on a plinth, a kerbed mound or ledger, flowers or candles
  let gi = 0;
  const plot = (gx: number, gz: number, s: number) => {
    const kind = Math.floor(hash(gi, 9) * 6), x0 = M(gx), z0 = M(gz), stone = C.GRAVE[gi % 3], sd = gi++;
    const H = Math.round(16 * s), Wd = Math.round(5 * s), L = Math.round(14 * s);
    // kerb around the plot (front part), plinth under the stone
    B(x0 - Wd - 2, -2, z0 - 3, x0 + Wd + 2, 0, z0 + 2, C.WALL_D);
    B(x0 - Wd - 1, -1, z0 + 3, x0 - Wd - 1, 0, z0 + 3 + L, C.WALL_D); B(x0 + Wd + 1, -1, z0 + 3, x0 + Wd + 1, 0, z0 + 3 + L, C.WALL_D); B(x0 - Wd - 1, -1, z0 + 4 + L, x0 + Wd + 1, 0, z0 + 4 + L, C.WALL_D);
    if (kind === 0) {   // round-topped slab (two inset steps) with an engraved cross
      B(x0 - Wd, 1, z0 - 1, x0 + Wd, H - 4, z0 + 1, stone).box(x0 - Wd + 2, H - 3, z0 - 1, x0 + Wd - 2, H - 2, z0 + 1, stone).box(x0 - Wd + 4, H - 1, z0 - 1, x0 + Wd - 4, H, z0 + 1, stone);
      B(x0, Math.round(H * 0.3), z0 + 2, x0, H - 5, z0 + 2, C.ENGRAVE).box(x0 - 2, H - 8, z0 + 2, x0 + 2, H - 8, z0 + 2, C.ENGRAVE);
    } else if (kind === 1) {   // a cross on a stepped base
      B(x0 - 3, 1, z0 - 2, x0 + 3, 3, z0 + 2, stone); B(x0 - 1, 4, z0 - 1, x0 + 1, H + 3, z0 + 1, stone);
      const ay = Math.round((H + 3) * 0.68); B(x0 - Wd - 1, ay, z0 - 1, x0 + Wd + 1, ay + 2, z0 + 1, stone);
    } else if (kind === 2) {   // an obelisk in four steps
      const t = Math.round(H / 4); B(x0 - Wd, 1, z0 - Wd + 2, x0 + Wd, t, z0 + 2, stone).box(x0 - Wd + 1, t + 1, z0 - Wd + 3, x0 + Wd - 1, t + 2, z0 + 1, C.ENGRAVE);
      B(x0 - 2, t + 3, z0 - 3, x0 + 2, H + 2, z0 + 1, stone).box(x0 - 1, H + 3, z0 - 2, x0 + 1, H + 5, z0, stone);
    } else if (kind === 3) {   // a double family stone with two stepped crowns
      B(x0 - Wd - 3, 1, z0 - 1, x0 + Wd + 3, H - 5, z0 + 1, stone);
      for (const s2 of [-1, 1]) B(x0 + s2 * 4 - 3, H - 4, z0 - 1, x0 + s2 * 4 + 3, H - 2, z0 + 1, stone).box(x0 + s2 * 4 - 1, H - 1, z0 - 1, x0 + s2 * 4 + 1, H - 1, z0 + 1, stone);
      B(x0, 2, z0 + 2, x0, H - 6, z0 + 2, C.ENGRAVE);
    } else if (kind === 4) {   // an urn on a pedestal
      B(x0 - 3, 1, z0 - 3, x0 + 3, 2, z0 + 3, stone); B(x0 - 2, 3, z0 - 2, x0 + 2, 9, z0 + 2, stone); B(x0 - 3, 10, z0 - 3, x0 + 3, 10, z0 + 3, stone);
      B(x0 - 2, 11, z0 - 2, x0 + 2, 14, z0 + 2, C.STATUE); B(x0 - 1, 15, z0 - 1, x0 + 1, 15, z0 + 1, C.STATUE); B(x0 - 2, 16, z0 - 2, x0 + 2, 16, z0 + 2, C.STATUE_L);
    } else {   // a low slab
      B(x0 - Wd, 1, z0 - 1, x0 + Wd, Math.round(H * 0.6), z0 + 1, stone).box(x0 - Wd + 2, Math.round(H * 0.6) + 1, z0 - 1, x0 + Wd - 2, Math.round(H * 0.6) + 1, z0 + 1, stone);
    }
    // the grave itself: a mound of earth in two tiers, or a ledger stone with a raised cross
    if (hash(sd, 4) < 0.5) { B(x0 - Wd, -1, z0 + 3, x0 + Wd, 0, z0 + 3 + L, C.DIRT); B(x0 - Wd + 1, 1, z0 + 5, x0 + Wd - 1, 1, z0 + 1 + L, hash(sd, 5) < 0.5 ? C.MOSS_D : C.DIRT); }
    else { B(x0 - Wd, -1, z0 + 3, x0 + Wd, 0, z0 + 3 + L, C.WALL_D); B(x0 - Wd + 1, 1, z0 + 4, x0 + Wd - 1, 1, z0 + 2 + L, stone); B(x0, 2, z0 + 6, x0, 2, z0 + L - 1, C.ENGRAVE); B(x0 - 2, 2, z0 + 8, x0 + 2, 2, z0 + 8, C.ENGRAVE); }
    const deco = hash(sd, 6);
    if (deco < 0.4) bouquet(x0 + (hash(sd, 7) < 0.5 ? -Wd + 1 : Wd - 1), z0 + 4 + L - 2 + 3, sd);
    else if (deco < 0.65) candles(x0 + Wd - 1, 0, z0 + 3, sd);
  };
  for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) for (const side of [-1, 1]) plot(side * (7.9 + k * 1.6), -7.4 + row * 3.25, 0.85 + hash(row, k, 3) * 0.3);
  for (const [x, z] of [[-5.6, -11.6], [-7.2, -12.2], [-8.8, -11.4], [5.6, -11.8], [7.2, -11.2], [8.8, -12.4], [-6.4, -14.2], [6.6, -14.0], [-9.6, -14.6], [9.4, -14.4]]) plot(x, z, 1.15);

  // ---------------------------------------------------------------- dead trees in the corners: root flare, trunk in three widths,
  // limbs that go out then up with a short twig across
  for (const [tx, tz, h, s] of [[-10.6, -10.4, 7.0, 1], [10.8, -10.0, 7.6, 2], [-10.4, 5.8, 5.6, 3], [10.6, 5.6, 6.0, 4]] as const) {
    const x = M(tx), z = M(tz), trunk = M(h * 0.5), t3 = Math.round(trunk / 3);
    B(x - 5, -2, z - 5, x + 5, 2, z + 5, C.BARK_D);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) B(dx > 0 ? x + 5 : dx < 0 ? x - 10 : x - 1, -2, dz > 0 ? z + 5 : dz < 0 ? z - 10 : z - 1, dx > 0 ? x + 10 : dx < 0 ? x - 5 : x + 1, 0, dz > 0 ? z + 10 : dz < 0 ? z - 5 : z + 1, C.BARK_D);
    B(x - 3, 3, z - 3, x + 3, t3, z + 3, C.BARK); B(x - 2, t3 + 1, z - 2, x + 2, 2 * t3, z + 2, C.BARK); B(x - 1, 2 * t3 + 1, z - 1, x + 1, trunk + M(h * 0.15), z + 1, C.BARK);
    const arms: Array<[number, number, number, number]> = [[1, 0, trunk - 4, 1], [-1, 0, trunk - 10, 0], [0, 1, trunk + 2, 1], [0, -1, trunk - 6, 0]];
    for (const [ddx, ddz, y, up] of arms) {
      const len = M(h * (0.15 + hash(s, y) * 0.08)), rise = M(h * (0.1 + up * 0.08)), ex = x + ddx * len, ez = z + ddz * len;
      B(Math.min(x, ex), y, Math.min(z, ez), Math.max(x, ex), y + 1, Math.max(z, ez), C.BARK); B(ex, y, ez, ex + (ddz ? 1 : 0), y + rise, ez + (ddx ? 1 : 0), C.BARK_D);
      const tw = Math.round(len * 0.5); B(Math.min(ex, ex + ddz * tw), y + rise, Math.min(ez, ez - ddx * tw), Math.max(ex, ex + ddz * tw), y + rise, Math.max(ez, ez - ddx * tw), C.BARK_D);
    }
  }

  // ---------------------------------------------------------------- soul-fire lantern posts: stepped stone foot, iron post with a collar,
  // a caged lantern under a stepped iron roof
  const flames: THREE.Vector3[] = [];
  for (const p of o.lanterns) {
    const x = M(p.x), z = M(p.z), hTop = M(2.1);
    B(x - 4, -2, z - 4, x + 4, 1, z + 4, C.WALL_D); B(x - 3, 2, z - 3, x + 3, 3, z + 3, C.WALL); B(x - 2, 4, z - 2, x + 2, 4, z + 2, C.WALL_L);
    B(x - 1, 5, z - 1, x + 1, hTop, z + 1, C.IRON); B(x - 2, 14, z - 2, x + 2, 15, z + 2, C.IRON_L);
    B(x - 3, hTop + 1, z - 3, x + 3, hTop + 1, z + 3, C.IRON_L);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B(x + dx, hTop + 2, z + dz, x + dx, hTop + 6, z + dz, C.IRON);
    B(x - 3, hTop + 7, z - 3, x + 3, hTop + 7, z + 3, C.IRON); B(x - 2, hTop + 8, z - 2, x + 2, hTop + 8, z + 2, C.IRON_L); B(x - 1, hTop + 9, z - 1, x + 1, hTop + 9, z + 1, C.IRON); w.set(x, hTop + 10, z, C.IRON_L);
    B(x - 1, hTop + 2, z - 1, x + 1, hTop + 4, z + 1, C.SOUL, 1);
    flames.push(new THREE.Vector3((x + 0.5) * CELL, (hTop + 4) * CELL, (z + 0.5) * CELL));
  }
  return { meshes: w.build({ glow: 2.6 }), flames, altarTop: top * CELL, world: w };
}
