// Private prop kit for the wild scenes (腐沼 swamp, 古树圣林 ancient grove). Same house rules as props.ts: axis-aligned masses, slopes
// and taper as a few wide tiers (never a cell-by-cell staircase), detail from structured patterns (plank seams, shingle courses,
// rows of posts), two or three shades per prop. Geometry is authored in cells (CELL = 7 cm); placement takes metres.
import * as THREE from 'three';
import type { Ctx } from './stage';
import { M, hash, PLAY, type W } from './props';
import { addCardKind } from './cards';
import { surface } from './dress';
import { canvasTex, onUpdate } from '../engine/world';
import { CELL } from '../bestiary/kit';

export type Rect = { x0: number; z0: number; x1: number; z1: number };
const inR = (r: Rect, x: number, z: number) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
const playDepth = (x: number, z: number) => Math.min(x - PLAY.x0, PLAY.x1 - x, z - PLAY.z0, PLAY.z1 - z);

/** only the outer t cells of a box (for big masses whose inside is never seen); inner shell layers may take another colour */
export function shell(w: W, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, t = 2, inner?: number) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const d = Math.min(x - x0, x1 - x, y - y0, y1 - y, z - z0, z1 - z);
    if (d < t) w.set(x, y, z, d === 0 || inner == null ? c : inner);
  }
}

// ------------------------------------------------------------------ swamp palette
export const SW = {
  GRASS: [0x34402a, 0x2e3a26, 0x3c3a28], BANK: 0x2a2a1e, SHELF: 0x4e5034, SHELF_D: 0x3a3c28, MUD: 0x241e18,
  POST: 0x3a2c22, POST_D: 0x2a2018, DECK: 0x6a4e34, DECK_B: 0x624830, SEAM: 0x3a2a1c, ROPE: 0x9a8a62,
  WALL_A: 0x5e4630, WALL_B: 0x55402c, LOG: 0x46321f, SILL: 0x3c2a1c, FRAME: 0x7a5a3a, DOOR: 0x3e2a1a, DOOR_D: 0x2e1e12,
  SH_A: 0x4a5a3c, SH_B: 0x445436, SH_D: 0x323e2a, FASCIA: 0x3a2a1e, ROOFMOSS: 0x56703a,
  STONE: 0x5a5856, STONE_B: 0x4e4c4a, STONE_L: 0x6c6a66, SOOT: 0x1a1816, IRON: 0x2a2830, WARM: 0xffa850, PANE: 0xc87a34,
  BARK: 0x3e3a30, BARK_D: 0x2a2620, BARK_M: 0x4a5e32, PAD: 0x3e7432, PAD_D: 0x2e5a26, PETAL: 0xf0c8e0, PETAL_W: 0xf4f0e8, POLLEN: 0xf0d050,
  ROCK: 0x4e4c48, ROCK_D: 0x3e3c3a, ROCK_M: 0x4e6a34, HULL: 0x5a4632, HULL_D: 0x3e3024, GUNWALE: 0x7a6440,
  HERB: [0x7a9a5a, 0x8a6aa8, 0xb08a3a], STEM: 0x5a4a2a, BARREL: 0x6a4a32, HOOP: 0x2c2a36, CRATE: 0x7a5a3a, CRATE_B: 0x4a3222,
};

// ------------------------------------------------------------------ water: one plane with a pixel ripple pattern that drifts
let rippleTex: THREE.Texture | null = null;
function ripple() {
  if (rippleTex) return rippleTex;
  const t = canvasTex(64, 64, g => {
    g.fillStyle = '#21392b'; g.fillRect(0, 0, 64, 64);
    // short horizontal glints in staggered rows: a regular, low-contrast pattern (one texel = one block)
    for (let r = 0; r < 8; r++) for (let k = 0; k < 3; k++) {
      const y = r * 8 + 2, x = (k * 21 + (r % 2) * 10 + r * 3) % 64, len = 3 + ((r + k) % 3) * 2;
      g.fillStyle = (r + k) % 4 === 0 ? '#5e9070' : '#3e6650'; g.fillRect(x, y, len, 1); if (x + len > 64) g.fillRect(0, y, x + len - 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return (rippleTex = t);
}
export function swampWater(c: Ctx, r: Rect, y = -0.05) {
  const map = ripple().clone(); map.needsUpdate = true;
  const w = r.x1 - r.x0, d = r.z1 - r.z0; map.repeat.set(w / (64 * CELL), d / (64 * CELL));
  const mat = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.86, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.45, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2); m.renderOrder = 2; m.receiveShadow = true;
  c.add(m);
  onUpdate((_dt, rdt) => { if (!m.parent?.parent) return; map.offset.x += rdt * 0.012; map.offset.y += rdt * 0.004; });
  return m;
}

/** land (union of rects minus cuts) with a wet bank strip, a shallow shelf just under the water, mud bottom elsewhere */
export function marsh(w: W, land: Rect[], cuts: Rect[], shelves: Rect[], o: { box: Rect; seed?: number }) {
  const isLand = (x: number, z: number) => land.some(r => inR(r, x, z)) && !cuts.some(r => inR(r, x, z));
  const X0 = M(o.box.x0), X1 = M(o.box.x1), Z0 = M(o.box.z0), Z1 = M(o.box.z1), sd = o.seed ?? 1;
  const L = new Set<number>(), key = (x: number, z: number) => x * 4096 + z;
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) if (isLand((x + 0.5) * CELL, (z + 0.5) * CELL)) L.add(key(x, z));
  const land2 = (x: number, z: number) => L.has(key(x, z));
  const near = (x: number, z: number, r: number) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (land2(x + dx, z + dz)) return true; return false; };
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    if (land2(x, z)) {
      // bank: the outer two cells of land are wet mud; inside, ground in big blocky patches
      let edge = false; for (let dx = -2; dx <= 2 && !edge; dx++) for (let dz = -2; dz <= 2; dz++) if (!land2(x + dx, z + dz)) { edge = true; break; }
      const px = Math.floor(x / 9), pz = Math.floor(z / 9), f = Math.sin(px * 0.7 + sd) * Math.cos(pz * 0.55 + sd * 2) + Math.sin((px + pz) * 0.31) * 0.6;
      w.set(x, -1, z, edge ? SW.BANK : f > 0.75 ? SW.GRASS[2] : f < -0.55 ? SW.GRASS[1] : SW.GRASS[0]).box(x, -3, z, x, -2, z, SW.MUD);
    } else if (near(x, z, 4) || shelves.some(r => inR(r, (x + 0.5) * CELL, (z + 0.5) * CELL))) {
      w.set(x, -2, z, near(x, z, 2) ? SW.SHELF : SW.SHELF_D).set(x, -3, z, SW.MUD);
    }
  }
  return { isLand: (xm: number, zm: number) => land2(M(xm - CELL / 2), M(zm - CELL / 2)) };
}

// ------------------------------------------------------------------ boardwalk: planks across the run, stringers, pilings with headers, rope rail
export function walk(w: W, r: Rect, o: { rail?: -1 | 0 | 1; gap?: [number, number]; seed?: number; deck?: number } = {}) {
  const X0 = M(r.x0), X1 = M(r.x1) - 1, Z0 = M(r.z0), Z1 = M(r.z1) - 1, alongX = X1 - X0 >= Z1 - Z0;
  const len = alongX ? X1 - X0 : Z1 - Z0, wid = alongX ? Z1 - Z0 : X1 - X0, sd = o.seed ?? 1, top = o.deck ?? 2;
  const at = (i: number, j: number) => (alongX ? [X0 + i, Z0 + j] : [X0 + j, Z0 + i]) as [number, number];
  const put = (i: number, j: number, y0: number, y1: number, c: number | null) => { const [x, z] = at(i, j); w.box(x, y0, z, x, y1, z, c); };
  const g0 = o.gap ? Math.round(o.gap[0] / CELL) : -1, g1 = o.gap ? Math.round(o.gap[1] / CELL) : -1;
  // stringers under both deck edges, broken inside the gap on the inner side
  for (let i = 0; i <= len; i++) for (const j of [1, 2, wid - 2, wid - 1]) { if (i > g0 + 2 && i < g1 - 2 && j < 3) continue; put(i, j, top - 3, top - 2, SW.POST_D); }
  // planks: five cells wide, a seam groove between, two tones, a few with a short end
  for (let i = 0; i <= len; i++) {
    if (i >= g0 && i <= g1) continue;
    const p = Math.floor(i / 5), seam = i % 5 === 4, tone = hash(p, sd, 3) < 0.5 ? SW.DECK : SW.DECK_B;
    const cut0 = hash(p, sd, 4) < 0.25 ? 1 : 0, cut1 = hash(p, sd, 5) < 0.25 ? 1 : 0;
    for (let j = cut0; j <= wid - cut1; j++) { put(i, j, top - 1, top - 1, seam ? SW.SEAM : tone); if (!seam) put(i, j, top, top, tone); }
  }
  // pilings in pairs every 16 cells, a header beam between them; on the rail side every other piling rises into a rail post
  const posts: Array<[number, number]> = [];
  for (let i = 1; i <= len - 1; i += 16) {
    if (i > g0 - 2 && i < g1 + 2) continue;
    for (let k = 0; k <= wid - 2; k++) put(i, k, top - 3, top - 2, SW.POST_D), put(i + 1, k, top - 3, top - 2, SW.POST_D);
    for (const side of [-1, 1] as const) {
      const j = side < 0 ? -1 : wid, rail = o.rail === side && (Math.round(i / 16) % 2 === 0 || i + 16 > len - 1);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(i + a, j + (side < 0 ? -b : b), -6, rail ? top + 10 : top + 1, SW.POST);
      if (rail) { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(i + a, j + (side < 0 ? -b : b), top + 11, top + 11, SW.DECK); posts.push([i, j]); }
    }
  }
  // rope between rail posts
  for (let k = 0; k + 1 < posts.length; k++) { const [i0, j] = posts[k], [i1] = posts[k + 1]; if (i1 - i0 > 40) continue; for (let i = i0 + 2; i < i1; i++) put(i, j, top + 8, top + 8, SW.ROPE); }
  // a loose plank floating beside the gap
  if (o.gap) { const im = (g0 + g1) >> 1; for (let i = im - 5; i <= im + 3; i++) for (let j = wid + 2; j <= wid + 4; j++) put(i, j, -1, -1, SW.DECK_B); }
}

// ------------------------------------------------------------------ the stilt hut (高脚小屋)
/** returns the lantern centres (metres) */
export function stiltHut(w: W, cx: number, cz: number): Array<[number, number, number]> {
  const X = M(cx), Z = M(cz), BW = 25, PW = 33, Zf = Z + 21, Zb = Z - 25, PY = 11, RY = PY + 29;
  const wb = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number | null, g = 0) => w.box(x0, y0, z0, x1, y1, z1, c, g);
  // stilts, tie beams
  for (const dx of [-PW + 2, -11, 11, PW - 2]) for (const z of [Zf - 2, Zb + 2, Z - 6]) wb(X + dx - 1, -6, z - 1, X + dx + 1, PY - 2, z + 1, SW.POST);
  wb(X - PW + 2, 3, Zf - 3, X + PW - 2, 4, Zf - 2, SW.POST_D);
  for (const dx of [-PW + 2, PW - 2]) wb(X + dx, 3, Zb + 2, X + dx, 4, Zf - 2, SW.POST_D);
  // deck: rim joist, planks along x with seams
  wb(X - PW, PY - 3, Zb, X + PW, PY - 2, Zb + 1, SW.SILL); wb(X - PW, PY - 3, Zf - 1, X + PW, PY - 2, Zf, SW.SILL);
  wb(X - PW, PY - 3, Zb, X - PW + 1, PY - 2, Zf, SW.SILL); wb(X + PW - 1, PY - 3, Zb, X + PW, PY - 2, Zf, SW.SILL);
  for (let z = Zb; z <= Zf; z++) { const seam = (Zf - z) % 6 === 5; wb(X - PW, PY - 1, z, X + PW, PY - 1, z, seam ? SW.SEAM : SW.DECK); if (!seam) wb(X - PW, PY, z, X + PW, PY, z, Math.floor((Zf - z) / 6) % 2 ? SW.DECK_B : SW.DECK); }
  // railing: front (with the stair opening) and both sides
  const SX0 = X - 15, SX1 = X - 1, RT = PY + 11;
  const railPost = (x: number, z: number, h = RT) => wb(x, PY + 1, z, x + 1, h, z + 1, SW.POST);
  for (let x = X - PW; x <= X + PW - 1; x += 11) if (x + 1 < SX0 - 1 || x > SX1 + 1) railPost(x, Zf - 1);
  for (const x of [X - PW, X + PW - 1]) for (let z = Zf - 1; z >= Zb + 8; z -= 11) railPost(x, z);
  for (const x of [SX0 - 2, SX1 + 1]) { wb(x, PY + 1, Zf - 1, x + 1, RT + 2, Zf, SW.POST); wb(x, RT + 3, Zf - 1, x + 1, RT + 3, Zf, SW.DECK); }
  wb(X - PW, RT + 1, Zf - 1, SX0 - 3, RT + 1, Zf, SW.DECK); wb(SX1 + 3, RT + 1, Zf - 1, X + PW, RT + 1, Zf, SW.DECK);
  wb(X - PW, PY + 6, Zf, SX0 - 3, PY + 6, Zf, SW.DECK_B); wb(SX1 + 3, PY + 6, Zf, X + PW, PY + 6, Zf, SW.DECK_B);
  for (const x of [X - PW, X + PW]) { wb(x, RT + 1, Zb + 8, x, RT + 1, Zf, SW.DECK); wb(x, PY + 6, Zb + 8, x, PY + 6, Zf, SW.DECK_B); }
  // stairs down to the boardwalk: open treads between stepped stringers
  for (let i = 0; i < 3; i++) {
    const z0 = Zf + 1 + i * 4, z1 = z0 + 3, y = PY - 3 - i * 3;
    wb(SX0, y - 1, z0, SX1, y, z1, i % 2 ? SW.DECK_B : SW.DECK);
    for (const x of [SX0 - 1, SX1 + 1]) wb(x, y - 2, z0, x, y + 1, z1, SW.POST_D);
  }
  for (const x of [SX0 - 1, SX1 + 1]) wb(x, -6, Zf + 11, x, 1, Zf + 12, SW.POST);
  // walls: horizontal board courses, corner logs, sill and top plate
  const bx0 = X - BW, bx1 = X + BW, bz0 = Z - 22, bz1 = Z + 8, top = RY - 1;
  for (let x = bx0; x <= bx1; x++) for (let y = PY + 1; y <= top; y++) for (let z = bz0; z <= bz1; z++) {
    if (Math.min(x - bx0, bx1 - x, z - bz0, bz1 - z) > 1) continue;
    w.set(x, y, z, Math.floor((y - PY - 1) / 3) % 2 ? SW.WALL_B : SW.WALL_A);
  }
  for (const x of [bx0 - 1, bx1 - 1]) for (const z of [bz0 - 1, bz1 - 1]) wb(x, PY + 1, z, x + 2, top + 1, z + 2, SW.LOG);
  wb(bx0 - 1, PY + 1, bz0 - 1, bx1 + 1, PY + 2, bz1 + 1, SW.SILL); wb(bx0 - 1, top - 1, bz0 - 1, bx1 + 1, top, bz1 + 1, SW.SILL);
  // door (left of centre, above the stairs): stepped frame, recessed boards, battens, ring
  const dx0 = X - 13, dx1 = X - 3, dTop = PY + 21;
  wb(dx0 - 2, PY + 1, bz1 - 1, dx1 + 2, dTop + 3, bz1 + 1, SW.FRAME); wb(dx0 - 3, dTop + 2, bz1 - 1, dx1 + 3, dTop + 3, bz1 + 1, SW.FRAME);
  wb(dx0, PY + 1, bz1 - 1, dx1, dTop, bz1 + 1, null); wb(dx0, PY + 1, bz1 - 1, dx1, dTop, bz1 - 1, SW.DOOR);
  for (const x of [dx0 + 3, dx0 + 7]) wb(x, PY + 1, bz1 - 1, x, dTop, bz1 - 1, SW.DOOR_D);
  for (const y of [PY + 5, PY + 17]) wb(dx0 + 1, y, bz1, dx1 - 1, y, bz1, SW.FRAME);
  w.set(dx1 - 2, PY + 11, bz1, SW.IRON);
  // window (right): frame, warm pane, cross mullion, sill
  const wx0 = X + 7, wx1 = X + 17, wy0 = PY + 9, wy1 = PY + 18;
  wb(wx0 - 1, wy0 - 1, bz1, wx1 + 1, wy1 + 1, bz1 + 1, SW.FRAME); wb(wx0, wy0, bz1 - 1, wx1, wy1, bz1 + 1, null);
  wb(wx0, wy0, bz1 - 1, wx1, wy1, bz1 - 1, SW.PANE, 1);
  wb(X + 12, wy0, bz1, X + 12, wy1, bz1, SW.DOOR); wb(wx0, wy0 + 5, bz1, wx1, wy0 + 5, bz1, SW.DOOR);
  wb(wx0 - 2, wy0 - 2, bz1, wx1 + 2, wy0 - 2, bz1 + 2, SW.SILL);
  // roof: ridge along x, four wide tiers; each tier's front and back rows are a darker shingle course, the gable ends a barge board
  const rx0 = bx0 - 5, rx1 = bx1 + 5, rz0 = bz0 - 6, rz1 = bz1 + 6;
  for (let k = 0; k < 4; k++) {
    const y0 = RY + k * 4, z0 = rz0 + k * 6, z1 = rz1 - k * 6, base = k % 2 ? SW.SH_B : SW.SH_A;
    wb(rx0, y0, z0, rx1, y0 + 3, z1, base);
    wb(rx0, y0, z1, rx1, y0 + 3, z1, SW.SH_D); wb(rx0, y0, z0, rx1, y0 + 3, z0, SW.SH_D);
    wb(rx0, y0, z0, rx0 + 1, y0 + 3, z1, SW.FASCIA); wb(rx1 - 1, y0, z0, rx1, y0 + 3, z1, SW.FASCIA);
    if (k === 1) wb(rx0 + 2, y0 + 3, z1 - 4, X - 4, y0 + 3, z1 - 1, SW.ROOFMOSS);   // a moss patch on one course
  }
  wb(rx0 - 2, RY + 16, rz0 + 19, rx1 + 2, RY + 17, rz1 - 19, SW.FASCIA);
  // stone chimney on the left gable
  const cx0 = bx0 - 9, cx1 = bx0 - 2, cz0 = Z - 12, cz1 = Z - 5;
  wb(cx0 - 1, PY + 1, cz0 - 1, cx1 + 1, PY + 8, cz1 + 1, SW.STONE_B);
  for (let y = PY + 9; y <= RY + 19; y++) wb(cx0, y, cz0, cx1, y, cz1, Math.floor(y / 3) % 2 ? SW.STONE : SW.STONE_B);
  wb(cx0 - 1, RY + 20, cz0 - 1, cx1 + 1, RY + 21, cz1 + 1, SW.STONE_L); wb(cx0 + 2, RY + 21, cz0 + 2, cx1 - 2, RY + 21, cz1 - 2, SW.SOOT);
  // drying herbs on a pole under the front eave, over the window
  wb(X - 1, RY - 2, bz1 + 3, X + 21, RY - 2, bz1 + 3, SW.POST_D);
  for (let i = 0; i < 5; i++) { const x = X + 1 + i * 5; w.set(x, RY - 3, bz1 + 3, SW.STEM); wb(x - 1, RY - 8, bz1 + 3, x + 1, RY - 4, bz1 + 4, SW.HERB[i % 3]); w.set(x, RY - 9, bz1 + 3, SW.STEM); }
  // porch goods: a barrel, two crates, a basket
  const barrel = (x: number, z: number) => { wb(x - 3, PY + 1, z - 3, x + 3, PY + 11, z + 3, SW.BARREL); for (const y of [PY + 3, PY + 9]) wb(x - 3, y, z - 3, x + 3, y, z + 3, SW.HOOP); wb(x - 2, PY + 12, z - 2, x + 2, PY + 12, z + 2, SW.CRATE); };
  const crate = (x: number, z: number, s: number, y0: number) => { wb(x - s, y0, z - s, x + s, y0 + 2 * s, z + s, SW.CRATE); for (const [a, b] of [[-s, -s], [s, -s], [-s, s], [s, s]]) wb(x + a, y0, z + b, x + a, y0 + 2 * s, z + b, SW.CRATE_B); wb(x - s, y0 + s, z + s, x + s, y0 + s, z + s, SW.CRATE_B); };
  barrel(X + 27, Zf - 6); crate(X + 19, Zf - 5, 4, PY + 1); crate(X + 19, Zf - 5, 3, PY + 10);
  wb(X - 28, PY + 1, Zf - 7, X - 23, PY + 4, Zf - 3, SW.STEM); wb(X - 27, PY + 5, Zf - 6, X - 24, PY + 5, Zf - 4, SW.HERB[0]);
  // two lanterns hanging from brackets on the front corner logs
  const out: Array<[number, number, number]> = [];
  for (const lx of [bx0, bx1]) {
    const lz = bz1 + 5;
    wb(lx, RY - 3, bz1 + 2, lx, RY - 3, lz, SW.IRON); w.set(lx, RY - 4, lz, SW.IRON);
    wb(lx - 1, RY - 5, lz - 1, lx + 1, RY - 5, lz + 1, SW.IRON); wb(lx - 2, RY - 6, lz - 2, lx + 2, RY - 6, lz + 2, SW.IRON);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) wb(lx + a, RY - 10, lz + b, lx + a, RY - 7, lz + b, SW.IRON);
    wb(lx - 1, RY - 10, lz - 1, lx + 1, RY - 7, lz + 1, SW.WARM, 1);
    wb(lx - 2, RY - 11, lz - 2, lx + 2, RY - 11, lz + 2, SW.IRON); w.set(lx, RY - 12, lz, SW.IRON);
    out.push([(lx + 0.5) * CELL, (RY - 8) * CELL, (lz + 0.5) * CELL]);
  }
  return out;
}

// ------------------------------------------------------------------ a swamp tree: flared roots, three trunk tiers, L-shaped limbs; returns moss-strand spots
export function swampTree(w: W, x: number, z: number, h: number, seed: number): Array<[number, number, number, number]> {
  const X = M(x), Z = M(z), H = M(h), T1 = Math.round(H * 0.32), T2 = Math.round(H * 0.62);
  const wb = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number) => w.box(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), c);
  // flared foot with a mossy top, four root spurs stepping down into the mud
  wb(X - 8, -4, Z - 8, X + 7, 4, Z + 7, SW.BARK); wb(X - 8, 5, Z - 8, X + 7, 5, Z + 7, SW.BARK_M);
  ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).forEach(([dx, dz], i) => {
    if (hash(seed, i, 7) < 0.2) return;
    const e = dx > 0 || dz > 0 ? 8 : -9, L1 = 5, L2 = 4 + Math.round(hash(seed, i, 8) * 3), off = Math.round((hash(seed, i, 6) - 0.5) * 6);
    const seg = (k0: number, k1: number, y0: number, y1: number, c: number) => wb(dx ? X + e + dx * k0 : X + off - 2, y0, dz ? Z + e + dz * k0 : Z + off - 2, dx ? X + e + dx * k1 : X + off + 1, y1, dz ? Z + e + dz * k1 : Z + off + 1, c);
    seg(0, L1 - 1, -3, 2, SW.BARK); seg(0, L1 - 1, 3, 3, SW.BARK_M); seg(L1, L1 + L2 - 1, -3, 0, SW.BARK_D);
  });
  // trunk in three widths, a darker groove down the middle of each face of the lowest
  wb(X - 6, 6, Z - 6, X + 5, T1, Z + 5, SW.BARK); wb(X - 4, T1 + 1, Z - 4, X + 3, T2, Z + 3, SW.BARK); wb(X - 3, T2 + 1, Z - 3, X + 2, H, Z + 2, SW.BARK);
  wb(X, 6, Z + 5, X - 1, T1 - 3, Z + 5, SW.BARK_D); wb(X, 6, Z - 6, X - 1, T1 - 3, Z - 6, SW.BARK_D); wb(X + 5, 6, Z, X + 5, T1 - 3, Z - 1, SW.BARK_D); wb(X - 6, 6, Z, X - 6, T1 - 3, Z - 1, SW.BARK_D);
  // limbs: out, then up, then a short twig across; moss strands hang under the horizontal runs
  const spots: Array<[number, number, number, number]> = [];
  const arms: Array<[number, number, number]> = [[1, 0, 0.5], [-1, 0, 0.66], [0, 1, 0.78], [0, -1, 0.58], [1, 0, 0.88]];
  arms.forEach(([dx, dz, fy], i) => {
    if (i === 4 && hash(seed, 9) < 0.5) return;
    const y = Math.round(H * fy), len = M(h * (0.18 + hash(seed, i, 2) * 0.1)), rise = M(h * (0.08 + hash(seed, i, 3) * 0.08)), t = i < 2 ? 2 : 1;
    const ex = X + dx * len, ez = Z + dz * len;
    wb(dx ? X : X - t, y - t, dz ? Z : Z - t, dx ? ex : X + t - 1, y + t - 1, dz ? ez : Z + t - 1, SW.BARK);
    wb(ex - 1, y, ez - 1, ex, y + rise, ez, SW.BARK_D);
    const tw = Math.round(len * 0.4); wb(ex + dz * tw, y + rise, ez - dx * tw, ex, y + rise, ez, SW.BARK_D);
    for (let k = 6; k < len; k += 5) spots.push([(X + dx * k + 0.5) * CELL, (y - t) * CELL, (Z + dz * k + 0.5) * CELL, dx ? 0 : Math.PI / 2]);
  });
  return spots;
}

// ------------------------------------------------------------------ small water things
/** a lily pad with a notch; flower: 0 none, 1 pink, 2 white */
export function lily(w: W, x: number, z: number, r: number, notch: number, flower = 0) {
  const X = M(x), Z = M(z), [nx, nz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][notch & 3];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
    if ((nx && dz === 0 && dx * nx > 0) || (nz && dx === 0 && dz * nz > 0)) continue;
    w.set(X + dx, -1, Z + dz, Math.abs(dx) === r || Math.abs(dz) === r ? SW.PAD_D : SW.PAD);
  }
  if (flower) { const p = flower === 1 ? SW.PETAL : SW.PETAL_W; for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) w.set(X - nx + a, 0, Z - nz + b, p); w.set(X - nx, 1, Z - nz, SW.POLLEN); }
}
/** a flat stone in two tiers breaking the water, mossy on top */
export function wetRock(w: W, x: number, z: number, sx: number, sz: number, h: number) {
  const X = M(x), Z = M(z);
  w.box(X - sx, -4, Z - sz, X + sx, h - 2, Z + sz, SW.ROCK).box(X - sx + 2, h - 1, Z - sz + 1, X + sx - 1, h, Z + sz - 2, SW.ROCK);
  w.box(X - sx + 2, h, Z - sz + 1, X + Math.round(sx * 0.3), h, Z + sz - 2, SW.ROCK_M);
  w.box(X - sx, -4, Z + sz, X + sx, h - 3, Z + sz, SW.ROCK_D);
}
/** a rowboat swamped at the stern, bow pointing along (ax, az) (one of the four axis directions) */
export function rowboat(w: W, x: number, z: number, ax: number, az: number) {
  const X = M(x), Z = M(z), N = 32;
  const put = (i: number, j: number, y0: number, y1: number, c: number) => w.box(X + ax * (i - N / 2) + az * j, y0, Z + az * (i - N / 2) - ax * j, X + ax * (i - N / 2) + az * j, y1, Z + az * (i - N / 2) - ax * j, c);
  for (let i = 0; i < N; i++) {
    const hw = i >= N - 3 ? 2 : i >= N - 7 ? 4 : 6, top = i < 13 ? -2 : i < 20 ? 1 : i >= N - 3 ? 4 : 3;
    for (let j = -hw; j <= hw; j++) put(i, j, -4, -4, SW.HULL_D);
    for (const s of [-1, 1]) { put(i, s * hw, -4, top - 1, SW.HULL); put(i, s * hw, top, top, SW.GUNWALE); put(i, s * hw, top - 2, top - 2, SW.HULL_D); }
    if (i === 0 || i === N - 1) for (let j = -hw; j <= hw; j++) put(i, j, -4, top, i === 0 ? SW.HULL_D : SW.GUNWALE);
    if (i === 22 || i === 23) for (let j = -hw + 1; j <= hw - 1; j++) put(i, j, 1, 1, SW.GUNWALE);
  }
  for (let i = 4; i < 26; i++) put(i, 2, i < 13 ? -3 : 0, i < 13 ? -3 : 0, SW.DECK_B);
}

// ------------------------------------------------------------------ cards: a fishing net hung over a rail
addCardKind('net', { kind: 'wall', w: 24, h: 20, sway: 0.02 }, g => {
  g.clearRect(0, 0, 24, 20);
  g.fillStyle = '#8a7a58'; g.fillRect(0, 0, 24, 2);
  const drop = (x: number) => 12 + (x > 4 && x < 20 ? 3 : 0) + (x > 8 && x < 16 ? 3 : 0);
  g.fillStyle = '#b8aa88';
  for (let x = 1; x < 24; x += 3) g.fillRect(x, 2, 1, drop(x));
  for (let y = 4; y < 20; y += 3) for (let x = 0; x < 24; x++) if (y <= drop(x) + 1) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#d0a050'; for (const x of [2, 10, 18]) g.fillRect(x, 0, 3, 3);
});

// ------------------------------------------------------------------ card helpers
/** clustered standing cards wherever mask(x, z) holds, thinning out into a feathered fringe at the battle floor's edge */
export function tufts(c: Ctx, kind: string, n: number, s: [number, number], mask: (x: number, z: number) => boolean, o: { area: Rect; seed: number; cluster?: number; spread?: number; tints?: number[]; feather?: number; maxY?: number }) {
  const cl = o.cluster ?? 5, sp = o.spread ?? 0.6, fe = o.feather ?? 0.6, A = o.area; let placed = 0, tries = 0;
  while (placed < n && tries < n * 40) {
    tries++;
    const cx = A.x0 + hash(tries, o.seed, 1 + kind.length) * (A.x1 - A.x0), cz = A.z0 + hash(tries, o.seed, 2 + kind.length) * (A.z1 - A.z0);
    for (let k = 0; k < cl && placed < n; k++) {
      const x = cx + (hash(tries, k, o.seed + 3) - 0.5) * sp * 2, z = cz + (hash(tries, k, o.seed + 4) - 0.5) * sp * 2, d = playDepth(x, z);
      if (d > 0 && (d > fe || hash(tries, k, 13) < d / fe)) continue;
      if (!mask(x, z)) continue;
      const y = surface(c, x, z); if (y == null || y > (o.maxY ?? 0.05) || y < -0.12) continue;
      const front = z > PLAY.z1 - 0.3 && x > PLAY.x0 - 0.6 && x < PLAY.x1 + 0.6;
      const sc = Math.min(s[0] + hash(tries, k, 5) * (s[1] - s[0]) * (d > 0 ? 0.6 : 1), front ? 0.4 : 9);
      c.cards.add(kind, x, z, { y, s: sc, tint: o.tints ? o.tints[Math.floor(hash(tries, k, 6) * o.tints.length)] : undefined }); placed++;
    }
  }
}

// ================================================================== the ancient grove (古树圣林)
export const GV = {
  BARK: 0x4e3e30, BARK_L: 0x5c4936, BARK_D: 0x3e3026, GROOVE: 0x3a2c22, HOLLOW: 0x160f0a, MOSS: 0x4a7034, MOSS_L: 0x5a8a3e,
  LEAF: 0x386a30, LEAF_M: 0x467e36, LEAF_T: 0x5a9640, LEAF_D: 0x2a5226, SEED: 0xa0ec50, SEED_C: 0xe8ffa8, VEIN: 0x8aff5a,
  STONE: 0x6a6c72, STONE_D: 0x4e5056, STONE_L: 0x82848c, CUT: 0x44464c, RUNE: 0xa8ff6a, EARTH: 0x3a3226, SLAB: [0x5e605a, 0x56584e],
  GRASS: [0x30442a, 0x2a3c24, 0x384a2c], STEM: 0xd8d0b8, CAP: 0x7ad8c0,
};
export type Pad = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };

/** a leaf mass: body, an inset upper tier and crown (lighter), a couple of side bulges and hanging lobes so the outline is not a box */
function leafMass(w: W, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, sd: number, pads: Pad[]) {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number) => {
    if ((x1 - x0) * (y1 - y0) * (z1 - z0) > 30000) shell(w, x0, y0, z0, x1, y1, z1, c, 1); else w.box(x0, y0, z0, x1, y1, z1, c);
  };
  const body: Pad = { x0: cx - hx, y0: cy, z0: cz - hz, x1: cx + hx, y1: cy + hy, z1: cz + hz };
  box(body.x0, body.y0, body.z0, body.x1, body.y1, body.z1, GV.LEAF); pads.push(body);
  w.box(cx - hx + 5, cy + hy + 1, cz - hz + 5, cx + hx - 5, cy + hy + 4, cz + hz - 5, GV.LEAF_M);
  if (hx > 14 && hz > 14) w.box(cx - hx + 11, cy + hy + 5, cz - hz + 11, cx + hx - 11, cy + hy + 7, cz + hz - 11, GV.LEAF_T);
  // side bulges (one on x, one on z), each a wide box that juts out four cells
  const bx = hash(sd, 1) < 0.5 ? -1 : 1, bz = hash(sd, 2) < 0.6 ? 1 : -1, bh = Math.round(hy * 0.6);
  const b1: Pad = { x0: bx < 0 ? cx - hx - 4 : cx + hx - 2, y0: cy + 2, z0: cz - Math.round(hz * 0.5), x1: bx < 0 ? cx - hx + 2 : cx + hx + 4, y1: cy + 2 + bh, z1: cz + Math.round(hz * 0.3) };
  const b2: Pad = { x0: cx - Math.round(hx * 0.6), y0: cy + 1, z0: bz > 0 ? cz + hz - 2 : cz - hz - 4, x1: cx + Math.round(hx * 0.2), y1: cy + 1 + bh, z1: bz > 0 ? cz + hz + 4 : cz - hz + 2 };
  for (const b of [b1, b2]) { w.box(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, GV.LEAF); w.box(b.x0, b.y1 + 1, b.z0, b.x1, b.y1 + 1, b.z1, GV.LEAF_M); pads.push(b); }
  // hanging lobes under the body
  for (let k = 0; k < 2; k++) {
    const lx = cx + Math.round((hash(sd, k, 3) - 0.5) * hx), lz = cz + Math.round((hash(sd, k, 4) - 0.2) * hz * 0.8), sx = Math.round(hx * 0.35), sz = Math.round(hz * 0.35), d = 4 + k * 2;
    const lo: Pad = { x0: lx - sx, y0: cy - d, z0: lz - sz, x1: lx + sx, y1: cy - 1, z1: lz + sz };
    w.box(lo.x0, lo.y0, lo.z0, lo.x1, lo.y1, lo.z1, GV.LEAF_D); pads.push(lo);
  }
}

/** bark faces in vertical plates of a few widths and three close tones (no regular grooves: those read as a crate) */
function barkPlates(w: W, X: number, Z: number, a: number, b: number, y0: number, y1: number, sd: number) {
  const tone = [GV.BARK, GV.BARK_L, GV.BARK, GV.BARK_D];
  const run = (n: number, f: (i: number, c: number) => void) => { let i = 0, k = 0; while (i <= n) { const wdt = 4 + Math.floor(hash(sd, k, 9) * 6), c = tone[Math.floor(hash(sd, k, 8) * 4)]; for (let j = 0; j < wdt && i <= n; j++, i++) f(i, c); k++; } };
  run(2 * a, (i, c) => { w.box(X - a + i, y0, Z + b, X - a + i, y1, Z + b, c); w.box(X - a + i, y0, Z - b, X - a + i, y1, Z - b, c); });
  run(2 * b, (i, c) => { w.box(X - a, y0, Z - b + i, X - a, y1, Z - b + i, c); w.box(X + a, y0, Z - b + i, X + a, y1, Z - b + i, c); });
}

/** the ancient tree: a vast trunk of bark plates with protruding flutes and mossy ledges, buttress fins, a hollow with a glowing seed,
 *  sap veins, low boughs whose leaf masses hang into the clearing's back corners, a crown of stacked leaf masses. */
export function ancientTree(w: W, x: number, z: number, o: { hollowX?: number; crown?: W } = {}) {
  const X = M(x), Z = M(z), pads: Pad[] = [], cw = o.crown ?? w;
  const tiers: Array<[number, number, number, number]> = [[42, 31, -3, 14], [31, 24, 15, 46], [27, 20, 47, 92], [23, 17, 93, 134]];
  tiers.forEach(([a, b, y0, y1], i) => { shell(w, X - a, y0, Z - b, X + a, y1, Z + b, GV.BARK, 2, GV.BARK_D); barkPlates(w, X, Z, a, b, y0, y1, i + 3); });
  for (let i = 0; i < tiers.length - 1; i++) {
    const [a, b, , y1] = tiers[i], [a2, b2] = tiers[i + 1];
    for (let x2 = X - a; x2 <= X + a; x2++) for (let z2 = Z - b; z2 <= Z + b; z2++) if (Math.abs(x2 - X) > a2 || Math.abs(z2 - Z) > b2) w.set(x2, y1, z2, (Math.abs(x2 - X) > a2 + 3 || Math.abs(z2 - Z) > b2 + 3) ? GV.MOSS : GV.MOSS_L);
  }
  // flutes: vertical ridges standing proud of the trunk, rising out of the fins and stepping back near their tops
  const flute = (x0: number, x1: number, zf: number, dz: number, y0: number, y1: number) => {
    const za = Math.min(zf, zf + dz * 3), zb = Math.max(zf, zf + dz * 3);
    w.box(x0, y0, za, x1, y1 - 6, zb, GV.BARK_L).box(x0, y1 - 5, Math.min(zf, zf + dz), x1, y1, Math.max(zf, zf + dz), GV.BARK_L);
    w.box(x0, y1 - 6, za, x1, y1 - 6, zb, GV.MOSS);
  };
  flute(X - 27, X - 21, Z + 25, 1, 15, 70); flute(X - 6, X - 1, Z + 25, 1, 15, 52); flute(X + 32, X + 35, Z + 18, 1, 15, 40);
  flute(X - 18, X - 13, Z + 21, 1, 47, 104); flute(X + 9, X + 14, Z + 21, 1, 47, 86);
  for (const s of [-1, 1]) { const xa = X + s * 32; w.box(Math.min(xa, xa + s * 3), 15, Z - 4, Math.max(xa, xa + s * 3), 58, Z + 6, GV.BARK_L); w.box(Math.min(xa, xa + s * 3), 59, Z - 4, Math.max(xa, xa + s * 3), 59, Z + 6, GV.MOSS); }
  // buttress fins: thick boards that step down in wide tiers as they leave the trunk
  const fin = (x0: number, z0: number, dx: number, dz: number, t: number, steps: Array<[number, number]>) => {
    let k = 0;
    for (const [len, h] of steps) for (let i = 0; i < len; i++, k++) {
      const cx = x0 + dx * k, cz = z0 + dz * k;
      w.box(cx - (dz ? t : 0), -3, cz - (dx ? t : 0), cx + (dz ? t : 0), h - 1, cz + (dx ? t : 0), GV.BARK);
      w.box(cx - (dz ? t : 0), h, cz - (dx ? t : 0), cx + (dz ? t : 0), h, cz + (dx ? t : 0), GV.MOSS);
    }
  };
  fin(X - 43, Z + 12, -1, 0, 3, [[16, 30], [18, 18], [20, 8]]);
  fin(X + 43, Z + 6, 1, 0, 3, [[14, 28], [16, 16], [18, 7]]);
  fin(X - 24, Z + 32, 0, 1, 3, [[12, 26], [12, 15], [12, 6]]);
  fin(X + 34, Z + 32, 0, 1, 3, [[10, 22], [12, 12], [10, 5]]);
  fin(X - 43, Z - 14, -1, 0, 3, [[12, 22], [14, 10]]);
  fin(X + 43, Z - 16, 1, 0, 3, [[10, 20], [12, 9]]);
  rootArch(w, X - 97, X - 137, Z + 12, 24, 4); rootArch(w, X + 91, X + 126, Z + 6, 20, 4);
  // the hollow: a stepped arch in the lower trunk, dark inside, a lighter lip, the seed glowing on a cradle of roots
  const hx = X + M(o.hollowX ?? 1.4), hb = Z + 24, y0 = 17, y1 = 44;
  w.box(hx - 12, 15, hb - 12, hx + 12, y1 + 2, hb - 1, GV.HOLLOW);
  const open = (x2: number, y: number) => { const d = Math.abs(x2 - hx); return y >= y0 && y <= y1 && d <= 8 && !(y > y1 - 3 && d > 4) && !(y > y1 - 7 && d > 6); };
  for (let x2 = hx - 10; x2 <= hx + 10; x2++) for (let y = y0 - 1; y <= y1 + 2; y++) {
    if (open(x2, y)) w.box(x2, y, hb - 9, x2, y, hb + 1, null);
    else if (open(x2 - 1, y) || open(x2 + 1, y) || open(x2, y - 1) || open(x2, y + 1) || open(x2 - 2, y) || open(x2 + 2, y) || open(x2, y - 2)) w.set(x2, y, hb + 1, GV.BARK_L);
  }
  w.box(hx - 7, y0, hb - 9, hx + 7, y0 + 2, hb - 3, GV.BARK_D).box(hx - 5, y0 + 3, hb - 8, hx - 3, y0 + 5, hb - 4, GV.BARK_D).box(hx + 3, y0 + 3, hb - 8, hx + 5, y0 + 5, hb - 4, GV.BARK_D);
  w.box(hx - 3, y0 + 3, hb - 8, hx + 3, y0 + 12, hb - 3, GV.SEED, 1).box(hx - 2, y0 + 13, hb - 7, hx + 2, y0 + 15, hb - 4, GV.SEED, 1).box(hx - 1, y0 + 16, hb - 6, hx, y0 + 17, hb - 5, GV.SEED_C, 1);
  w.box(hx, y0 + 4, hb - 3, hx, y0 + 11, hb - 3, GV.SEED_C, 1);
  // sap veins: thin glowing lines from the hollow, square turns only
  w.box(hx - 11, y0 + 2, hb + 1, hx - 11, y1 - 4, hb + 1, GV.VEIN, 1); w.box(hx + 11, y0 + 6, hb + 1, hx + 11, y1 - 2, hb + 1, GV.VEIN, 1);
  // boughs: square limbs out to the sides just above the top of the battle frame; leaf masses hang off them into its corners
  const limb = (x0: number, x1: number, y: number, zc: number, t: number) => w.box(Math.min(x0, x1), y - t, zc - t, Math.max(x0, x1), y + t, zc + t, GV.BARK);
  limb(X - 25, X - 150, 70, Z + 20, 4); limb(X + 25, X + 150, 66, Z + 16, 4);
  const climb = (x0: number, x1: number, y: number, zc: number, t: number) => cw.box(Math.min(x0, x1), y - t, zc - t, Math.max(x0, x1), y + t, zc + t, GV.BARK);
  climb(X - 21, X - 74, 114, Z, 5); cw.box(X - 80, 114, Z - 5, X - 70, 140, Z + 5, GV.BARK);
  climb(X + 21, X + 70, 106, Z - 4, 5); cw.box(X + 66, 106, Z - 9, X + 76, 134, Z + 1, GV.BARK);
  cw.box(X - 6, 110, Z + 15, X + 6, 120, Z + 46, GV.BARK);
  const L = (cx: number, cy: number, cz: number, hx2: number, hy: number, hz: number, sd: number) => leafMass(cy >= 90 ? cw : w, X + cx, cy, Z + cz, hx2, hy, hz, sd, pads);
  L(-82, 52, 24, 22, 16, 22, 1); L(-128, 46, 20, 26, 18, 26, 2); L(-164, 38, 4, 20, 16, 22, 3);
  L(86, 48, 22, 22, 16, 22, 4); L(130, 42, 16, 26, 18, 26, 5); L(166, 34, 2, 20, 16, 22, 6);
  L(0, 128, 0, 72, 28, 54, 7); L(-78, 110, 10, 40, 24, 36, 8); L(78, 104, -6, 38, 24, 34, 9); L(0, 104, 46, 34, 20, 22, 10);
  L(-30, 160, -6, 46, 22, 38, 11); L(38, 156, 12, 40, 22, 30, 12); L(0, 184, 0, 34, 18, 28, 13);
  return { seed: [(hx + 0.5) * CELL, (y0 + 9) * CELL, (hb - 4) * CELL] as [number, number, number], pads };
}

/** a root that leaves the ground at x0, arches at height h (cells) and dives back in at x1 (cells), along x at depth zc */
export function rootArch(w: W, x0: number, x1: number, zc: number, h: number, t: number) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  w.box(a - t, -3, zc - t, a + t, h, zc + t, GV.BARK).box(b - t, -3, zc - t, b + t, h, zc + t, GV.BARK);
  w.box(a - t, h - 2 * t + 1, zc - t, b + t, h, zc + t, GV.BARK);
  w.box(a + t + 1, h - 3 * t, zc - t, a + 2 * t + 2, h - 2 * t, zc + t, GV.BARK).box(b - 2 * t - 2, h - 3 * t, zc - t, b - t - 1, h - 2 * t, zc + t, GV.BARK);
  w.box(a - t, h + 1, zc - t + 1, b + t, h + 1, zc + t - 1, GV.MOSS);
  w.box(a - t - 3, -3, zc - t - 2, a + t + 3, 1, zc + t + 2, GV.BARK_D).box(b - t - 3, -3, zc - t - 2, b + t + 3, 1, zc + t + 2, GV.BARK_D);
}


const GLYPHS = [['X..', 'XX.', 'X.X', 'X..'], ['.X.', 'XXX', '.X.', '.X.'], ['XXX', 'X.X', 'X.X', 'X.X'], ['X.X', 'XXX', 'X.X', 'X.X'], ['XX.', 'X.X', 'XX.', 'X.X'], ['.X.', 'X.X', '.X.', 'X.X']];
/** a standing stone facing (fx, fz): two-tier plinth, slab with shoulders and a mossy crown, two carved bands bracketing a column of
 *  glowing runes. a = half width (cells), b = half depth, h = height (metres). Returns the face centre for a light. */
export function standingStone(w: W, x: number, z: number, fx: number, fz: number, h: number, o: { a?: number; b?: number; runes?: number; seed?: number; lintel?: boolean } = {}) {
  const X = M(x), Z = M(z), a = o.a ?? 6, b = o.b ?? 4, H = M(h), sd = o.seed ?? 1;
  // local (u along the face width, v toward the face) → world
  const put = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, c: number | null, g = 0) => {
    const xs = fz ? [X + u0 * fz, X + u1 * fz] : [X + v0 * fx, X + v1 * fx], zs = fz ? [Z + v0 * fz, Z + v1 * fz] : [Z - u0 * fx, Z - u1 * fx];
    w.box(Math.min(...xs), y0, Math.min(...zs), Math.max(...xs), y1, Math.max(...zs), c, g);
  };
  put(-a - 4, -3, -b - 4, a + 4, 1, b + 4, GV.STONE_D); put(-a - 2, 2, -b - 2, a + 2, 3, b + 2, GV.STONE_D);
  put(-a, 4, -b, a, H - 6, b, GV.STONE);
  if (!o.lintel) { put(-a + 2, H - 5, -b, a - 2, H - 2, b, GV.STONE); put(-a + 4, H - 1, -b + 1, a - 4, H, b - 1, GV.MOSS); put(-a + 2, H - 5, b, a - 2, H - 5, b, GV.STONE_L); }
  else put(-a, H - 5, -b, a, H, b, GV.STONE);
  const bLo = 8, bHi = H - 9;
  put(-a, bLo, b, a, bLo, b, GV.CUT); put(-a, bHi, b, a, bHi, b, GV.CUT);
  const n = o.runes ?? Math.max(1, Math.floor((bHi - bLo - 3) / 6)), span = bHi - bLo - 1, step = span / n;
  for (let k = 0; k < n; k++) {
    const g = GLYPHS[(sd * 3 + k * 5) % GLYPHS.length], top = Math.round(bHi - 1 - step * k - (step - 4) / 2);
    g.forEach((row, r) => [...row].forEach((ch, cI) => { if (ch === 'X') put(cI - 1, top - r, b, cI - 1, top - r, b, GV.RUNE, 1); }));
  }
  return [(X + 0.5 + fx * (b + 1)) * CELL, (bLo + bHi) * 0.5 * CELL, (Z + 0.5 + fz * (b + 1)) * CELL] as [number, number, number];
}

/** two uprights and a lintel (trilithon), facing +z; returns the lintel rune position */
export function trilithon(w: W, x: number, z: number, h: number, seed: number) {
  const X = M(x), Z = M(z), H = M(h), gap = 9, a = 6, b = 5;
  for (const s of [-1, 1]) standingStone(w, (X + s * (gap + a)) * CELL, z, 0, 1, h, { a, b, seed: seed + s + 2, lintel: true, runes: 2 });
  w.box(X - gap - 2 * a - 3, H + 1, Z - b - 1, X + gap + 2 * a + 3, H + 6, Z + b + 1, GV.STONE).box(X - gap - 2 * a - 1, H + 7, Z - b + 1, X + gap + 2 * a + 1, H + 7, Z + b - 1, GV.MOSS);
  w.box(X - gap - 2 * a - 3, H + 1, Z + b + 1, X + gap + 2 * a + 3, H + 1, Z + b + 1, GV.CUT);
  GLYPHS[seed % GLYPHS.length].forEach((row, r) => [...row].forEach((ch, cI) => { if (ch === 'X') w.set(X + cI - 1, H + 5 - r, Z + b + 1, GV.RUNE, 1); }));
  return [(X + 0.5) * CELL, (H + 3) * CELL, (Z + b + 2) * CELL] as [number, number, number];
}

/** a mossy mound in three tiers, with optional glowing toadstools along its front */
export function mound(w: W, x: number, z: number, sx: number, sz: number, shrooms = 0) {
  const X = M(x), Z = M(z);
  w.box(X - sx, -3, Z - sz, X + sx, 2, Z + sz, GV.EARTH).box(X - sx, 3, Z - sz, X + sx, 3, Z + sz, GV.MOSS);
  w.box(X - sx + 4, 4, Z - sz + 3, X + sx - 4, 5, Z + sz - 3, GV.EARTH).box(X - sx + 4, 6, Z - sz + 3, X + sx - 4, 6, Z + sz - 3, GV.MOSS);
  if (sx > 9 && sz > 7) w.box(X - sx + 8, 7, Z - sz + 6, X + sx - 8, 8, Z + sz - 6, GV.MOSS_L);
  for (let i = 0; i < shrooms; i++) {
    const mx = X - sx + 3 + Math.round(hash(i, X, 1) * (2 * sx - 6)), mz = Z + sz + 1 + (i % 2), h = 3 + (i % 2) * 2;
    w.box(mx, 0, mz, mx, h, mz, GV.STEM).box(mx - 1, h + 1, mz - 1, mx + 1, h + 1, mz + 1, GV.CAP, 1).set(mx, h + 2, mz, GV.CAP, 1);
  }
}

/** a leafy bush in two tiers; returns the top centre for flower cards */
export function bush(w: W, x: number, z: number, sx: number, sz: number, h: number) {
  const X = M(x), Z = M(z);
  w.box(X - sx, -1, Z - sz, X + sx, h - 3, Z + sz, GV.LEAF_D).box(X - sx + 2, h - 2, Z - sz + 2, X + sx - 2, h, Z + sz - 2, GV.LEAF);
  return [x, (h + 1) * CELL, z] as [number, number, number];
}

/** leaf clumps drooping under every pad's bottom rim and tufting its top rim (placed analytically: only on the true outside) */
export function canopyFringe(c: Ctx, pads: Pad[], seed: number) {
  const H = 16 * CELL;
  pads.forEach((p, k) => {
    const rim: Array<[number, number, number, number]> = [];
    for (let x = p.x0; x <= p.x1; x += 4) { rim.push([x, p.z1, 0, 1]); rim.push([x, p.z0, 0, -1]); }
    for (let z = p.z0; z <= p.z1; z += 4) { rim.push([p.x1, z, 1, 0]); rim.push([p.x0, z, -1, 0]); }
    rim.forEach(([x, z, dx, dz], i) => {
      if (hash(i, k, seed) < 0.35) return;
      const s = 0.6 + hash(i, k, seed + 1) * 0.5, px = (x + 0.5 + dx * 0.5) * CELL, pz = (z + 0.5 + dz * 0.5) * CELL;
      c.cards.add('leaf', px, pz, { y: p.y0 * CELL - H * s * 0.45, s, tint: hash(i, k, 3) < 0.5 ? 0x5a9a4a : 0x4a8a40 });
      if (hash(i, k, seed + 2) < 0.4) c.cards.add('leaf', px, pz, { y: (p.y1 + 1) * CELL - H * s * 0.35, s: s * 0.8, tint: 0x6aaa52 });
    });
  });
}

/** a younger tree of the grove: flared foot, two trunk tiers, two or three leaf masses; returns the pads for the leaf fringe */
export function groveTree(w: W, x: number, z: number, h: number, sd: number) {
  const X = M(x), Z = M(z), H = M(h), pads: Pad[] = [];
  w.box(X - 6, -3, Z - 6, X + 5, 3, Z + 5, GV.BARK).box(X - 6, 4, Z - 6, X + 5, 4, Z + 5, GV.MOSS);
  w.box(X - 4, 5, Z - 4, X + 3, Math.round(H * 0.45), Z + 3, GV.BARK).box(X - 3, Math.round(H * 0.45) + 1, Z - 3, X + 2, Math.round(H * 0.8), Z + 2, GV.BARK);
  w.box(X - 1, 5, Z + 4, X, Math.round(H * 0.4), Z + 4, GV.BARK_L).box(X - 4, 5, Z - 1, X - 4, Math.round(H * 0.35), Z, GV.BARK_L);
  const y0 = Math.round(H * 0.5), s = hash(sd, 7) < 0.5 ? -1 : 1;
  leafMass(w, X, y0, Z, 20, 16, 18, sd, pads);
  leafMass(w, X + s * 14, y0 + 20, Z - 4, 14, 12, 14, sd + 1, pads);
  if (hash(sd, 8) < 0.6) leafMass(w, X - s * 16, y0 - 6, Z + 6, 12, 10, 12, sd + 2, pads);
  return pads;
}
