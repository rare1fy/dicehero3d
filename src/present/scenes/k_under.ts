// The underground scenes' own kit (crypt, cells, spider cave, mushroom grotto, root deep). Dungeon walls built like MCD rooms —
// plinth, brick courses, pilasters, arched niches, dentil cornice — patterned flagstone floors with border bands and gutters, terraced
// cave walls in rock strata with overhangs and stepped stalactites, and the props that tell each room's story. Same house rules as
// props.ts: axis-aligned masses, a few wide tiers for every slope or curve, no diagonal stair-steps, no speckle; detail comes from
// structure (courses, frames, bands, rows), in two or three shades per material.
import type { Ctx, Mood } from './stage';
import { M, hash, field, type W, PLAY } from './props';
import { addCardKind } from './cards';
import { CELL } from '../bestiary/kit';
import { DUNGEON, CAVE } from './common';

type Col = number;
export type Rect = { x0: number; z0: number; x1: number; z1: number };
export type Look = 's' | 'n' | 'e' | 'w';
export type P3 = [number, number, number];

// ------------------------------------------------------------------ moods (lighter fog than the shared ones: the back landmark must read)
export const CRYPT: Mood = { ...DUNGEON, bg: 0x06060c, fog: 0x0c0c18, fogD: 0.019, hemiSky: 0x8088aa, hemiGround: 0x1e1c26, hemiI: 1.90, moon: 0xa4acd4, moonI: 1.85, key: 0xb0b6d0, keyI: 1.0, mist: 0x4a4e6e, mistA: 0.09 };
export const JAIL: Mood = { ...DUNGEON, bg: 0x06060c, fog: 0x0c0c16, fogD: 0.019, hemiSky: 0x8288a8, hemiGround: 0x201c24, hemiI: 1.90, moon: 0xa8b0d4, moonI: 1.85, key: 0xb4b8d0, keyI: 1.0, mist: 0x4a4a6a, mistA: 0.09 };
export const WEBCAVE: Mood = { ...CAVE, bg: 0x05050a, fog: 0x0a0a14, fogD: 0.021, hemiSky: 0x747aa8, hemiGround: 0x1a1824, hemiI: 1.95, moon: 0x9aa4d8, moonI: 1.65, key: 0xa8b0d8, keyI: 0.9, mist: 0x4a4c70, mistA: 0.11 };
export const GLOWCAVE: Mood = { ...CAVE, bg: 0x05050c, fog: 0x0a0a16, fogD: 0.021, hemiSky: 0x6a74b4, hemiGround: 0x1a1a2c, hemiI: 1.90, moon: 0x8a9ce0, moonI: 1.60, key: 0xa8b0e8, keyI: 0.85, mist: 0x3e4678, mistA: 0.11 };
export const ROOTDEEP: Mood = { ...CAVE, bg: 0x06050a, fog: 0x0c0a14, fogD: 0.021, hemiSky: 0x6e6c98, hemiGround: 0x1c1820, hemiI: 1.95, moon: 0x9aa4d8, moonI: 1.65, key: 0xb0acd0, keyI: 0.95, earth: [0x16141a, 0x1a181e, 0x141216], mist: 0x4a4668, mistA: 0.11 };
/** the dark coping on a cut wall top (what shows when the vault is hidden) */
export const SECTION = 0x0e0c14;
/** rusted iron */
export const RUST = 0x6a4232, RUST_D = 0x4a3028;

// ------------------------------------------------------------------ a wall face in local cells
/** A vertical face looking into the room. Local cells: u along the run (absolute world cells along x or z), v = height, d = depth into
 *  the wall from the face layer (0 = the face layer, negative = standing proud of it, toward the room). */
export class Face {
  readonly alongX: boolean; readonly sg: number;
  constructor(readonly w: W, readonly look: Look, readonly plane: number) { this.alongX = look === 's' || look === 'n'; this.sg = look === 's' || look === 'e' ? 1 : -1; }
  box(u0: number, v0: number, d0: number, u1: number, v1: number, d1: number, c: Col | null, g = 0) {
    const a = this.plane - this.sg * d0, b = this.plane - this.sg * d1;
    if (this.alongX) this.w.box(u0, v0, a, u1, v1, b, c, g); else this.w.box(a, v0, u0, b, v1, u1, c, g);
    return this;
  }
  has(u: number, v: number, d: number) { const a = this.plane - this.sg * d; return this.alongX ? this.w.has(u, v, a) : this.w.has(a, v, u); }
  /** world position (metres) of the centre of a local cell */
  pos(u: number, v: number, d: number): P3 { const a = (this.plane - this.sg * d + 0.5) * CELL, b = (u + 0.5) * CELL, y = (v + 0.5) * CELL; return this.alongX ? [b, y, a] : [a, y, b]; }
  /** world coordinate (metres, on the perpendicular axis) of the exposed side of layer d */
  front(d: number) { return (this.plane - this.sg * d + (this.sg > 0 ? 1 : 0)) * CELL; }
  /** a wall card on this face at u (cells), hanging from height y (metres), lifted off the face layer d */
  card(c: Ctx, kind: string, u: number, y: number, d: number, s: number, tint?: number) {
    const p = this.front(d) + this.sg * 0.03, q = (u + 0.5) * CELL;
    c.cards.add(kind, this.alongX ? q : p, this.alongX ? p : q, { y, ry: this.ry, s, tint });
  }
  get ry() { return this.look === 's' ? 0 : this.look === 'n' ? Math.PI : this.look === 'e' ? Math.PI / 2 : -Math.PI / 2; }
}
/** a face whose layer sits at m metres on the perpendicular axis */
export const face = (w: W, look: Look, m: number) => new Face(w, look, M(m));

// ------------------------------------------------------------------ dungeon walls
export interface Stone { a: Col; b: Col; mortar: Col; base: Col; baseTop: Col; trim: Col; trimL: Col; pil: Col; dark: Col }

/** A dungeon wall run from u0 to u1, H cells tall: stepped plinth, brick courses (flush mortar, a third of the bricks a shade lighter),
 *  a dentil band and a two-step cornice, pilasters with base and capital at the given u. */
export function dWall(f: Face, u0: number, u1: number, H: number, s: Stone, o: { t?: number; pil?: number[]; pw?: number; course?: number; top?: boolean; hollow?: boolean; section?: Col; y0?: number } = {}) {
  const t = o.t ?? 7, pw = o.pw ?? 5, C = o.course ?? 6, Y0 = o.y0 ?? -2;
  if (o.hollow && t > 2) f.box(u0, Y0, 0, u1, H, 0, s.a).box(u0, Y0, t - 1, u1, H, t - 1, s.a).box(u0, Y0, 0, u0, H, t - 1, s.a).box(u1, Y0, 0, u1, H, t - 1, s.a).box(u0, H, 0, u1, H, t - 1, s.a);
  else f.box(u0, Y0, 0, u1, H, t - 1, s.a);
  for (let r = 0, v = 7; v + C <= H - 6; r++, v += C) {
    f.box(u0, v, 0, u1, v, 0, s.mortar);
    const off = r & 1 ? 7 : 0;
    for (let k = Math.floor((u0 - off) / 14); k * 14 + off <= u1; k++) {
      const j = k * 14 + off;
      if (hash(k, r, 41) < 0.3) f.box(Math.max(u0, j + 1), v + 1, 0, Math.min(u1, j + 13), v + C - 1, 0, s.b);
      if (j >= u0) f.box(j, v + 1, 0, j, v + C - 1, 0, s.mortar);
    }
  }
  // plinth: a toe and a course, the course capped in a lighter stone
  if (Y0 < 5) f.box(u0, Y0, -1, u1, 4, -1, s.base).box(u0, 5, -1, u1, 5, -1, s.baseTop).box(u0, Y0, -2, u1, 1, -2, s.base);
  if (o.top !== false) {
    for (let u = u0 + 1; u + 1 <= u1; u += 4) f.box(u, H - 5, -1, u + 1, H - 4, -1, s.trim);
    f.box(u0, H - 3, -1, u1, H - 2, -1, s.trim).box(u0, H - 1, -2, u1, H, -1, s.trimL).box(u0, H, 0, u1, H, t - 1, s.trimL);
  }
  for (const c of o.pil ?? []) {
    if (c < u0 - pw || c > u1 + pw) continue;
    const a = Math.max(u0, c - pw), b = Math.min(u1, c + pw);
    f.box(a, -2, -2, b, H - 4, -1, s.pil);
    for (let v = 13; v < H - 9; v += 12) f.box(a, v, -2, b, v, -2, s.mortar);
    f.box(Math.max(u0, a - 1), -2, -3, Math.min(u1, b + 1), 6, -1, s.base).box(Math.max(u0, a - 1), 7, -3, Math.min(u1, b + 1), 7, -1, s.baseTop);
    f.box(Math.max(u0, a - 1), H - 7, -3, Math.min(u1, b + 1), H - 5, -1, s.trim);
    if (o.top !== false) f.box(Math.max(u0, a - 2), H - 4, -3, Math.min(u1, b + 2), H, -1, s.trimL);
    if (o.section != null) f.box(Math.max(u0, a - 2), H + 1, -3, Math.min(u1, b + 2), H + 1, -1, o.section);
  }
  if (o.section != null) f.box(u0, H + 1, o.top !== false ? -2 : 0, u1, H + 1, t - 1, o.section);
}

/** a recess with a stepped arch head (each tier `ins` cells narrower per side, `rise` tall), a flush frame and a sill; returns its rects */
export function niche(f: Face, uc: number, v0: number, hw: number, h: number, depth: number, s: Stone, o: { steps?: number; rise?: number; ins?: number; frame?: Col | null; fw?: number; sill?: Col | null; back?: Col; inner?: Col; t?: number; skin?: Col } = {}) {
  const steps = o.steps ?? 1, rise = o.rise ?? 2, ins = o.ins ?? 2, fw = o.fw ?? 1;
  const rects: Array<[number, number, number, number]> = [[uc - hw, v0, uc + hw, v0 + h - 1]];
  for (let k = 1; k <= steps; k++) rects.push([uc - hw + k * ins, v0 + h + (k - 1) * rise, uc + hw - k * ins, v0 + h + k * rise - 1]);
  const top = rects[rects.length - 1][3];
  if (o.frame !== null) for (const [a, b, c, d] of rects) f.box(a - fw, b === v0 ? b - fw : b, 0, c + fw, d + fw, 0, o.frame ?? s.trim);
  if (o.t != null && depth >= o.t - 1) f.box(uc - hw - 2, v0 - 2, o.t - 1, uc + hw + 2, top + 2, depth + 1, o.skin ?? s.a);   // a skin where the niche pokes out of a thin wall
  f.box(uc - hw - 1, v0 - 1, 1, uc + hw + 1, top + 1, depth, o.inner ?? s.dark);
  for (const [a, b, c, d] of rects) { f.box(a, b, 0, c, d, depth - 1, null); f.box(a, b, depth, c, d, depth, o.back ?? s.dark); }
  if (o.sill !== null) f.box(uc - hw - 1, v0 - 1, -1, uc + hw + 1, v0 - 1, -1, o.sill ?? s.trimL);
  return { rects, top };
}

/** a skull 5 wide, 4 tall, 4 deep looking out of face f, its front at depth d0: cranium, a three-wide jaw, two sockets and a nose */
export function skullF(f: Face, uc: number, v0: number, d0: number, bone: Col, eye: Col, g = 0) {
  f.box(uc - 2, v0 + 1, d0, uc + 2, v0 + 3, d0 + 3, bone).box(uc - 1, v0, d0, uc + 1, v0, d0 + 2, bone);
  f.box(uc - 1, v0 + 2, d0, uc - 1, v0 + 2, d0, eye, g).box(uc + 1, v0 + 2, d0, uc + 1, v0 + 2, d0, eye, g).box(uc, v0 + 1, d0, uc, v0 + 1, d0, 0x2a2420);
}
/** a free-standing skull at cell (X, Y, Z) looking `look` */
export function skullAt(w: W, X: number, Y: number, Z: number, look: Look, bone: Col, eye = 0x1a1418, g = 0) {
  const f = new Face(w, look, look === 's' || look === 'n' ? Z : X);
  skullF(f, look === 's' || look === 'n' ? X : Z, Y, 0, bone, eye, g);
}
/** a long bone (cells): a rod with knuckled ends */
export function boneRod(w: W, X: number, Y: number, Z: number, len: number, alongX: boolean, bone: Col) {
  if (alongX) w.box(X, Y, Z, X + len - 1, Y, Z, bone).box(X, Y, Z - 1, X, Y + 1, Z, bone).box(X + len - 1, Y, Z - 1, X + len - 1, Y + 1, Z, bone);
  else w.box(X, Y, Z, X, Y, Z + len - 1, bone).box(X - 1, Y, Z, X, Y + 1, Z, bone).box(X - 1, Y, Z + len - 1, X, Y + 1, Z + len - 1, bone);
}

export const BONE = 0xe6dcc4, BONE_D = 0xb4a68a, BONE_S = 0x8e8270;
/** a heap of skulls stacked like a pyramid (3-2-1) on a mound of bones, facing `look` (metres for x, z) */
export function skullHeap(w: W, x: number, z: number, look: Look, rows = 3, o: { eye?: Col; glow?: number; mound?: Col } = {}) {
  const f = new Face(w, look, look === 's' || look === 'n' ? M(z) : M(x)), uc = look === 's' || look === 'n' ? M(x) : M(z), half = rows * 3 + 2, md = o.mound ?? BONE_D;
  // mound: three tiers behind and under the skulls
  f.box(uc - half - 2, 0, -2, uc + half + 2, 2, 9, md).box(uc - half + 1, 3, 1, uc + half - 1, 4 + (rows - 1) * 4, 9, BONE_S).box(uc - half + 4, 5 + (rows - 1) * 4, 4, uc + half - 4, 6 + (rows - 1) * 4, 9, md);
  boneRod(w, ...rodAt(f, uc - half - 1, 3, -2), 9, f.alongX, BONE); boneRod(w, ...rodAt(f, uc + half - 9, 3, -2), 9, f.alongX, BONE);
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) {
    const u = uc - (rows - r - 1) * 3 + i * 6;
    skullF(f, u, 3 + r * 4, r * 2 - 1, BONE, o.eye ?? 0x1a1418, r === rows - 1 ? o.glow ?? 0 : 0);
  }
}
const rodAt = (f: Face, u: number, v: number, d: number): [number, number, number] => { const p = f.plane - f.sg * d; return f.alongX ? [u, v, p] : [p, v, u]; };

/** a long low pile of bones against a wall: a mound in two tiers, long bones laid across it, a few skulls on top facing out */
export function bonePile(w: W, x: number, z: number, look: Look, len = 2.0, o: { eye?: Col; glow?: number } = {}) {
  const f = new Face(w, look, look === 's' || look === 'n' ? M(z) : M(x)), uc = look === 's' || look === 'n' ? M(x) : M(z), L = M(len) >> 1;
  f.box(uc - L, 0, -4, uc + L, 2, 8, BONE_D).box(uc - L + 4, 3, 0, uc + L - 4, 5, 8, BONE_S).box(uc - L + 9, 6, 4, uc + L - 9, 7, 8, BONE_D);
  for (let u = uc - L + 2; u < uc + L - 8; u += 11) boneRod(w, ...rodAt(f, u, 3, -3), 8, f.alongX, BONE);
  for (let u = uc - L + 7; u < uc + L - 6; u += 13) boneRod(w, ...rodAt(f, u, 6, 1), 7, f.alongX, BONE);
  for (let u = uc - L + 6, i = 0; u < uc + L - 3; u += 10, i++) skullF(f, u, i % 2 ? 6 : 3, i % 2 ? 0 : -3, BONE, o.eye ?? 0x1a1418, i === 1 ? o.glow ?? 0 : 0);
}

// ------------------------------------------------------------------ crypt furniture
/** an effigy sarcophagus along z (head toward -z): plinth, chest with sunk panels, two-step lid, a carved knight lying on it.
 *  open: the lid has been shoved off onto the floor beside it and the chest gapes, a skull inside. */
export function effigyTomb(w: W, x: number, z: number, s: { stone: Col; panel: Col; lid: Col; effigy: Col; base: Col; trim: Col }, o: { open?: boolean; side?: 1 | -1; cracked?: boolean } = {}) {
  const X = M(x), Z = M(z);
  w.box(X - 9, -1, Z - 17, X + 9, 1, Z + 17, s.base).box(X - 9, 1, Z - 17, X + 9, 1, Z + 17, s.trim);
  w.box(X - 7, 2, Z - 15, X + 7, 8, Z + 15, s.stone);
  for (const sx of [-1, 1]) for (const [a, b] of [[-12, -2], [2, 12]]) w.box(X + sx * 7, 3, Z + a, X + sx * 7, 7, Z + b, s.panel);
  w.box(X - 5, 3, Z + 15, X + 5, 7, Z + 15, s.panel).box(X - 1, 3, Z + 15, X + 1, 7, Z + 15, s.trim).box(X - 3, 5, Z + 15, X + 3, 5, Z + 15, s.trim);
  const lid = (lx: number, ly: number, lz: number) => {
    w.box(lx - 8, ly, lz - 16, lx + 8, ly, lz + 16, s.trim).box(lx - 7, ly + 1, lz - 15, lx + 7, ly + 1, lz + 15, s.lid);
    const e = s.effigy, y = ly + 2;
    w.box(lx - 4, y, lz - 14, lx + 4, y, lz - 10, s.trim);                                   // pillow
    w.box(lx - 2, y + 1, lz - 13, lx + 2, y + 3, lz - 10, e).box(lx - 2, y + 4, lz - 13, lx + 2, y + 4, lz - 12, s.trim);   // head, circlet
    w.box(lx - 4, y, lz - 9, lx + 4, y + 1, lz + 1, e).box(lx - 3, y, lz + 2, lx + 3, y, lz + 11, e);                     // body, legs
    w.box(lx - 3, y + 2, lz - 7, lx + 3, y + 2, lz - 7, s.trim).box(lx, y + 2, lz - 6, lx, y + 2, lz + 7, s.trim);          // sword on the breast
    w.box(lx - 1, y + 2, lz - 9, lx + 1, y + 3, lz - 8, e);                                                                // folded hands
    w.box(lx - 3, y + 1, lz + 11, lx - 1, y + 3, lz + 12, e).box(lx + 1, y + 1, lz + 11, lx + 3, y + 3, lz + 12, e);         // feet
  };
  if (!o.open) { lid(X, 9, Z); if (o.cracked) w.box(X - 8, 9, Z + 3, X + 8, 16, Z + 3, null).box(X - 8, 8, Z + 3, X + 8, 8, Z + 3, 0x1a1820).box(X - 8, 9, Z + 4, X + 8, 16, Z + 16, null).box(X - 8, 8, Z + 4, X + 8, 8, Z + 16, s.trim).box(X - 7, 7, Z + 4, X + 7, 7, Z + 15, s.lid).box(X - 3, 8, Z + 5, X + 3, 8, Z + 11, s.effigy).box(X - 3, 9, Z + 11, X - 1, 10, Z + 12, s.effigy).box(X + 1, 9, Z + 11, X + 3, 10, Z + 12, s.effigy); return; }
  w.box(X - 5, 4, Z - 13, X + 5, 8, Z + 13, null).box(X - 5, 3, Z - 13, X + 5, 3, Z + 13, 0x1a1820);
  skullAt(w, X, 4, Z - 9, 's', BONE); boneRod(w, X - 3, 4, Z - 2, 9, false, BONE); boneRod(w, X + 2, 4, Z, 8, false, BONE_D);
  const sx = o.side ?? 1; lid(X + sx * 19, -1, Z + 4);
}

/** a cluster of candles of different heights on a wax-pooled base; the tallest two cells thick */
export function candles(w: W, x: number, z: number, y0 = 0, n = 5, wax = 0xe8e0c8, flame = 0xffc060, lit = 99) {
  const X = M(x), Z = M(z), spots: Array<[number, number, number, number]> = [[0, 0, 8, 2], [3, 2, 5, 1], [-3, 1, 6, 1], [2, -3, 3, 1], [-2, -3, 4, 1], [4, -1, 2, 1], [-4, 3, 3, 1]];
  w.box(X - 4, y0, Z - 3, X + 4, y0, Z + 3, 0xd4caae);
  spots.slice(0, n).forEach(([dx, dz, h0, s], i) => {
    const b = s === 2 ? 1 : 0, h = i < lit ? h0 : Math.max(1, h0 - 3);   // burnt-out ones are stubs with a black wick
    w.box(X + dx, y0 + 1, Z + dz, X + dx + b, y0 + h, Z + dz + b, wax);
    if (i < lit) w.box(X + dx, y0 + h + 1, Z + dz, X + dx, y0 + h + (s === 2 ? 2 : 1), Z + dz, flame, 1); else w.set(X + dx, y0 + h + 1, Z + dz, 0x1e1a1a);
  });
}
/** an iron candelabrum: footed base, a stem, a cross-arm with three candles */
export function candelabrum(w: W, x: number, z: number, h = 16, iron = 0x34323e, wax = 0xe8e0c8, flame = 0xffc060, alongX = true, lit = true) {
  const X = M(x), Z = M(z);
  w.box(X - 2, 0, Z - 2, X + 2, 0, Z + 2, iron).box(X - 1, 1, Z - 1, X + 1, 1, Z + 1, iron).box(X, 2, Z, X, h, Z, iron);
  const arm = (k: number) => (alongX ? [X + k, Z] : [X, Z + k]) as [number, number];
  const [ax0, az0] = arm(-4), [ax1, az1] = arm(4); w.box(ax0, h + 1, az0, ax1, h + 1, az1, iron);
  for (const k of [-4, 0, 4]) { const [cx, cz] = arm(k), hh = lit ? (k ? 3 : 4) : (k ? 1 : 2); w.box(cx, h + 2, cz, cx, h + 1 + hh, cz, wax); if (lit) w.set(cx, h + 2 + hh, cz, flame, 1); else w.set(cx, h + 2 + hh, cz, 0x1e1a1a); }
  return [x, (h + 6) * CELL, z] as P3;
}
/** a soul-fire brazier: stepped stone foot, iron bowl, a two-tier flame */
export function soulBrazier(w: W, x: number, z: number, stone: Col, iron: Col, fire: Col) {
  const X = M(x), Z = M(z);
  w.box(X - 4, 0, Z - 4, X + 4, 1, Z + 4, stone).box(X - 3, 2, Z - 3, X + 3, 3, Z + 3, stone).box(X - 1, 4, Z - 1, X + 1, 11, Z + 1, iron);
  w.box(X - 4, 12, Z - 4, X + 4, 13, Z + 4, iron).box(X - 4, 14, Z - 4, X + 4, 14, Z + 4, iron).box(X - 3, 14, Z - 3, X + 3, 14, Z + 3, null);
  w.box(X - 3, 14, Z - 3, X + 3, 15, Z + 3, fire, 1).box(X - 1, 16, Z - 1, X + 1, 18, Z + 1, fire, 1);
  return [x, 17 * CELL, z] as P3;
}
/** an urn: foot, belly with a band, shoulder, neck, lip */
export function urn(w: W, x: number, z: number, body: Col, band: Col, s = 1) {
  const X = M(x), Z = M(z), k = s > 1 ? 1 : 0;
  w.box(X - 2, 0, Z - 2, X + 2, 1, Z + 2, band).box(X - 3 - k, 2, Z - 3 - k, X + 3 + k, 6 + k * 2, Z + 3 + k, body).box(X - 3 - k, 4 + k, Z - 3 - k, X + 3 + k, 4 + k, Z + 3 + k, band);
  w.box(X - 2, 7 + k * 2, Z - 2, X + 2, 7 + k * 2, Z + 2, body).box(X - 1, 8 + k * 2, Z - 1, X + 1, 9 + k * 2, Z + 1, body).box(X - 2, 10 + k * 2, Z - 2, X + 2, 10 + k * 2, Z + 2, band);
}
/** a square column: two-step base, fluted shaft with two bands, two-step capital; broken = snapped off with a stepped stump */
export function column(w: W, x: number, z: number, H: number, s: Stone, o: { r?: number; broken?: number } = {}) {
  const X = M(x), Z = M(z), r = o.r ?? 5, top = o.broken ?? H;
  w.box(X - r - 3, -1, Z - r - 3, X + r + 3, 2, Z + r + 3, s.base).box(X - r - 2, 3, Z - r - 2, X + r + 2, 5, Z + r + 2, s.baseTop);
  w.box(X - r, 6, Z - r, X + r, top, Z + r, s.pil);
  for (const g of [-(r - 2), r - 2]) { w.box(X + g, 7, Z + r, X + g, Math.min(top, H - 8), Z + r, s.mortar).box(X + g, 7, Z - r, X + g, Math.min(top, H - 8), Z - r, s.mortar).box(X + r, 7, Z + g, X + r, Math.min(top, H - 8), Z + g, s.mortar).box(X - r, 7, Z + g, X - r, Math.min(top, H - 8), Z + g, s.mortar); }
  for (const v of [Math.round(H * 0.36), Math.round(H * 0.66)]) if (v + 1 < top) w.box(X - r - 1, v, Z - r - 1, X + r + 1, v + 1, Z + r + 1, s.trim);
  if (o.broken == null) { w.box(X - r - 1, H - 6, Z - r - 1, X + r + 1, H - 4, Z + r + 1, s.trim).box(X - r - 3, H - 3, Z - r - 3, X + r + 3, H, Z + r + 3, s.trimL); }
  else { w.box(X - r, top + 1, Z - r, X, top + 4, Z + r, s.pil).box(X - r, top + 5, Z - r, X - 2, top + 7, Z, s.pil); }
}

// ------------------------------------------------------------------ gates, bars, chains
/** a barred gate in a wall: a stepped-arch opening through the wall, a grid of bars (portcullis spikes at the foot), a voussoir band and keystone */
export function barGate(f: Face, uc: number, v0: number, hw: number, h: number, s: Stone, iron: Col, o: { steps?: number; ins?: number; rise?: number; depth?: number; set?: number; pitch?: number; band?: number; key?: Col; spikes?: boolean; rail?: number; t?: number } = {}) {
  const depth = o.depth ?? 10, set = o.set ?? 2, P = o.pitch ?? 3, band = o.band ?? 3;
  const { rects, top } = niche(f, uc, v0, hw, h, depth, s, { steps: o.steps ?? 2, ins: o.ins ?? 4, rise: o.rise ?? 3, frame: s.trimL, fw: band, sill: null, back: 0x07060a, inner: s.dark, t: o.t });
  for (const [a, b, c, d] of rects) for (let u = a + 1; u < c; u++) if ((u - uc) % P === 0) f.box(u, b, set, u, d, set, iron);
  const rail = o.rail ?? 7;
  for (let v = v0 + 2; v <= top; v += rail) for (const [a, b, c, d] of rects) if (v >= b && v <= d) f.box(a, v, set, c, v, set, iron);
  if (o.spikes) for (let u = uc - hw + 1; u < uc + hw; u++) if ((u - uc) % P === 0) f.box(u, v0 - 1, set, u, v0 - 1, set, iron);
  f.box(uc - 3, top - 1, -1, uc + 3, top + band + 1, -1, o.key ?? s.trimL);
  return top;
}
/** a chain hanging from a wall plate down `len` cells, links alternating flat and edge-on, ending in an open shackle */
export function wallChain(f: Face, u: number, vTop: number, len: number, iron: Col, o: { shackle?: boolean; plate?: Col } = {}) {
  f.box(u - 1, vTop, 0, u + 1, vTop + 2, 0, o.plate ?? 0x2a2830).box(u, vTop, -1, u, vTop, -1, iron);
  for (let i = 1; i <= len; i++) { const v = vTop - i; f.box(u, v, -1, u, v, -1, iron); if (i % 4 === 2) f.box(u - 1, v, -1, u + 1, v, -1, iron); if (i % 4 === 0) f.box(u, v, -2, u, v, -2, iron); }
  if (o.shackle !== false) { const v = vTop - len - 1; f.box(u - 2, v - 2, -1, u + 2, v - 2, -1, iron).box(u - 2, v - 1, -1, u - 2, v, -1, iron).box(u + 2, v - 1, -1, u + 2, v, -1, iron); }
}
/** a chain sagging between two plates on a wall in two wide tiers (no diagonals) */
export function chainSag(f: Face, u0: number, u1: number, v: number, sag: number, iron: Col) {
  const q = Math.round((u1 - u0) / 4);
  f.box(u0 - 1, v, 0, u0 + 1, v + 2, 0, 0x2a2830).box(u1 - 1, v, 0, u1 + 1, v + 2, 0, 0x2a2830);
  f.box(u0, v - sag, -1, u0, v, -1, iron).box(u1, v - sag, -1, u1, v, -1, iron);
  f.box(u0, v - sag, -1, u0 + q, v - sag, -1, iron).box(u1 - q, v - sag, -1, u1, v - sag, -1, iron).box(u0 + q, v - sag - 2, -1, u1 - q, v - sag - 2, -1, iron).box(u0 + q, v - sag - 2, -1, u0 + q, v - sag, -1, iron).box(u1 - q, v - sag - 2, -1, u1 - q, v - sag, -1, iron);
}
/** a wall sconce: iron bracket, a cup and a flame block; returns the flame position */
export function sconce(f: Face, u: number, v: number, iron: Col, fire: Col, lit = true) {
  f.box(u - 1, v - 4, 0, u + 1, v - 1, 0, 0x2a2830).box(u, v - 3, -1, u, v - 1, -2, iron).box(u - 1, v, -3, u + 1, v, -1, iron);
  if (lit) f.box(u, v + 1, -2, u, v + 2, -2, fire, 1); else f.box(u, v + 1, -2, u, v + 1, -2, 0x241e1c);
  return f.pos(u, v + 2, -2);
}

/** iron bars between two stone uprights facing ±z (a cell front): sill, bottom and top rails, a middle rail, a stone lintel over it;
 *  the door section [dx0, dx1] stands open, swung out toward +z on its hinge at dx1 */
export function cellFront(w: W, x0: number, x1: number, z: number, H: number, iron: Col, stone: Col, stoneL: Col, door?: { x0: number; x1: number; torn?: boolean; hinge?: 'l' | 'r' }) {
  const X0 = M(x0), X1 = M(x1), Z = M(z), D0 = door ? M(door.x0) : 1e9, D1 = door ? M(door.x1) : -1e9;
  w.box(X0, -1, Z - 1, X1, 0, Z + 1, stoneL);
  const gap = (x: number) => x >= D0 && x <= D1;
  for (let x = X0; x <= X1; x++) {
    if (gap(x)) continue;
    w.box(x, 1, Z, x, 1, Z, iron).box(x, Math.round(H * 0.5), Z, x, Math.round(H * 0.5), Z, iron).box(x, H - 1, Z, x, H, Z, iron);
    if ((x - X0) % 3 === 0) w.box(x, 2, Z, x, H - 2, Z, iron);
  }
  w.box(X0, H + 1, Z - 2, X1, H + 4, Z + 2, stone).box(X0, H + 1, Z + 2, X1, H + 1, Z + 2, stoneL).box(X0, H + 5, Z - 2, X1, H + 5, Z + 2, stoneL);
  if (!door) return;
  w.box(D0, H - 1, Z, D1, H, Z, iron);
  const L = D1 - D0;
  if (door.torn) {   // torn off its hinges, the door lies flat on the floor in front of the cell, along x
    const Lx = H - 2;
    for (let k = 0; k <= Lx; k += 3) w.box(D0 + k, 0, Z + 4, D0 + k, 0, Z + 4 + L, iron);
    w.box(D0, 0, Z + 4, D0 + Lx, 0, Z + 4, iron).box(D0, 0, Z + 4 + L, D0 + Lx, 0, Z + 4 + L, iron).box(D0 + (Lx >> 1), 0, Z + 4, D0 + (Lx >> 1), 0, Z + 4 + L, iron);
    return;
  }
  // swung open: the panel stands along z from the hinge, its own frame, bars and a lock plate
  const hx = door.hinge === 'l' ? D0 - 1 : D1 + 1;
  w.box(hx, 1, Z + 1, hx, 1, Z + L, iron).box(hx, H - 1, Z + 1, hx, H - 1, Z + L, iron).box(hx, Math.round(H * 0.5), Z + 1, hx, Math.round(H * 0.5), Z + L, iron).box(hx, 1, Z + L, hx, H - 1, Z + L, iron);
  for (let k = 3; k < L; k += 3) w.box(hx, 2, Z + k, hx, H - 2, Z + k, iron);
  w.box(hx - 1, Math.round(H * 0.5) - 2, Z + L - 2, hx + 1, Math.round(H * 0.5) + 1, Z + L - 1, 0x8a7a4a);
  w.box(hx, 4, Z, hx, 6, Z, 0x1a1820).box(hx, H - 6, Z, hx, H - 4, Z, 0x1a1820);
}

// ------------------------------------------------------------------ cell furniture
export const STRAW = [0x8a7434, 0xa88e44, 0xc4aa58];
/** a heap of straw in two tiers with lengthwise stalk lines on top */
export function straw(w: W, x: number, z: number, a: number, b: number, C: Col[] = STRAW) {
  const X = M(x), Z = M(z);
  w.box(X - a, 0, Z - b, X + a, 1, Z + b, C[0]).box(X - a + 2, 2, Z - b + 2, X + a - 2, 3, Z + b - 2, C[1]);
  for (let k = -a + 3; k <= a - 3; k += 3) w.box(X + k, 3, Z - b + 3, X + k, 3, Z + b - 3, C[2]);
  w.box(X + a + 2, 0, Z - 2, X + a + 5, 0, Z - 2, C[1]).box(X - a - 4, 0, Z + 2, X - a - 2, 0, Z + 2, C[1]);
}
/** a wooden bucket: staves, two iron hoops, water, a handle; tipped = lying on its side with a spill */
export function bucket(w: W, x: number, z: number, wood: Col, iron: Col, water = 0x3a5a7a, tipped = false) {
  const X = M(x), Z = M(z);
  if (tipped) { w.box(X - 2, 0, Z - 2, X + 2, 4, Z + 2, wood).box(X - 2, 0, Z - 1, X + 2, 4, Z - 1, iron).box(X - 2, 0, Z + 1, X + 2, 4, Z + 1, iron).box(X - 1, 1, Z + 2, X + 1, 3, Z + 2, 0x2a2018); return; }
  w.box(X - 2, 0, Z - 2, X + 2, 4, Z + 2, wood).box(X - 2, 1, Z - 2, X + 2, 1, Z + 2, iron).box(X - 2, 3, Z - 2, X + 2, 3, Z + 2, iron).box(X - 1, 4, Z - 1, X + 1, 4, Z + 1, water);
  w.box(X - 2, 5, Z, X - 2, 6, Z, iron).box(X + 2, 5, Z, X + 2, 6, Z, iron).box(X - 2, 7, Z, X + 2, 7, Z, iron);
}
/** a plank bench / bed along z: boards with seams, two trestle legs */
export function bench(w: W, x: number, z: number, len: number, wide: number, h: number, wood: Col, woodD: Col) {
  const X = M(x), Z = M(z), L = M(len) >> 1, a = wide >> 1;
  w.box(X - a, h, Z - L, X + a, h, Z + L, wood);
  for (let k = -a + 2; k < a; k += 3) w.box(X + k, h, Z - L, X + k, h, Z + L, woodD);
  for (const e of [-L + 2, L - 2]) w.box(X - a + 1, 0, Z + e - 1, X + a - 1, h - 1, Z + e, woodD);
}
/** the guard's desk along z: plank top with a dark rim, apron, square legs, a stretcher; on it a key ring, an oil lamp, papers, a ledger
 *  and a mug. Returns the lamp position. */
export function guardDesk(w: W, x: number, z: number, wood: Col, woodD: Col, woodL: Col) {
  const X = M(x), Z = M(z), a = 6, b = 11;
  w.box(X - a, 10, Z - b, X + a, 11, Z + b, woodL).box(X - a, 10, Z - b, X + a, 10, Z + b, woodD);
  w.box(X - a + 1, 8, Z - b + 1, X + a - 1, 9, Z + b - 1, wood);
  for (const [i, j] of [[-a + 1, -b + 1], [a - 2, -b + 1], [-a + 1, b - 2], [a - 2, b - 2]]) w.box(X + i, 0, Z + j, X + i + 1, 9, Z + j + 1, woodD);
  w.box(X - a + 2, 2, Z - b + 2, X - a + 2, 2, Z + b - 2, woodD).box(X + a - 2, 2, Z - b + 2, X + a - 2, 2, Z + b - 2, woodD);
  const BR = 0xc8a040, BRD = 0x8a6a2a;
  // key ring with two keys
  w.box(X + 1, 12, Z - 8, X + 3, 12, Z - 6, BR).set(X + 2, 12, Z - 7, woodL).box(X + 4, 12, Z - 7, X + 6, 12, Z - 7, BR).set(X + 6, 12, Z - 8, BR).box(X + 2, 12, Z - 5, X + 2, 12, Z - 3, BR).set(X + 3, 12, Z - 3, BR);
  // oil lamp: brass foot, glowing glass, cap, ring
  w.box(X - 3, 12, Z + 5, X - 1, 12, Z + 7, BRD).box(X - 3, 13, Z + 5, X - 1, 15, Z + 7, 0xffc070, 1).box(X - 3, 16, Z + 5, X - 1, 16, Z + 7, BRD).set(X - 2, 17, Z + 6, BR);
  // papers, a ledger, a mug
  w.box(X - 4, 12, Z - 2, X, 12, Z + 2, 0xd8d0b8).box(X - 3, 12, Z - 1, X - 1, 12, Z - 1, 0x8a8478);
  w.box(X + 1, 12, Z + 1, X + 4, 13, Z + 5, 0x5a2a24).box(X + 1, 14, Z + 1, X + 4, 14, Z + 5, 0xd8d0b8);
  w.box(X - 4, 12, Z - 9, X - 3, 14, Z - 8, woodD);
  return [(X - 1.5) * CELL, 14.5 * CELL, (Z + 6.5) * CELL] as P3;
}
/** a stool */
export function stool(w: W, x: number, z: number, wood: Col, woodD: Col) { const X = M(x), Z = M(z); w.box(X - 2, 6, Z - 2, X + 2, 6, Z + 2, wood); for (const [i, j] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) w.box(X + i, 0, Z + j, X + i, 5, Z + j, woodD); }
/** a weapon rack along z against a wall: two posts, two rails, spears and a halberd standing in it, a sword and a round-topped shield */
export function weaponRack(w: W, x: number, z: number, len: number, wood: Col, woodD: Col, steel = 0xa8acb8, shieldC = 0x7a3a30) {
  const X = M(x), Z = M(z), L = M(len) >> 1;
  for (const e of [-L, L]) w.box(X - 1, 0, Z + e - 1, X + 1, 22, Z + e, woodD);
  w.box(X - 1, 6, Z - L, X + 1, 6, Z + L, wood).box(X - 1, 18, Z - L, X + 1, 18, Z + L, wood);
  for (let k = -L + 4, i = 0; k <= L - 4; k += 4, i++) {
    const zz = Z + k;
    if (i % 3 === 2) { w.box(X, 0, zz, X, 24, zz, wood).box(X - 2, 21, zz, X - 1, 25, zz, steel).box(X, 25, zz, X, 27, zz, steel); continue; }
    w.box(X, 0, zz, X, 26, zz, wood).box(X, 27, zz, X, 29, zz, steel).box(X, 26, zz - 1, X, 26, zz + 1, steel);
  }
  // a shield hung on the front post: heater shape in two tiers, rim and boss
  const sz = Z + L + 5;
  w.box(X + 2, 8, sz - 4, X + 2, 17, sz + 4, 0x3a3640).box(X + 2, 9, sz - 3, X + 2, 16, sz + 3, shieldC).box(X + 2, 6, sz - 2, X + 2, 7, sz + 2, 0x3a3640).box(X + 2, 7, sz - 2, X + 2, 8, sz + 2, shieldC);
  w.box(X + 3, 12, sz - 1, X + 3, 13, sz, steel).box(X + 2, 12, sz - 3, X + 2, 12, sz + 3, 0xc8a040).box(X + 2, 9, sz, X + 2, 16, sz, 0xc8a040);
}
/** a gibbet: a post on a stone footing with an arm, a chain, and a hanging cage of bars with a skull inside; returns a point by it */
export function gibbet(w: W, x: number, z: number, armX: number, wood: Col, woodD: Col, iron: Col) {
  const X = M(x), Z = M(z), A = M(armX), H = 46;
  w.box(X - 4, 0, Z - 4, X + 4, 2, Z + 4, 0x4a4652).box(X - 2, 3, Z - 2, X + 2, H, Z + 2, wood).box(X - 2, 3, Z - 2, X - 2, H, Z - 2, woodD).box(X + 2, 3, Z + 2, X + 2, H, Z + 2, woodD);
  const ax0 = Math.min(X, A), ax1 = Math.max(X, A); w.box(ax0, H - 3, Z - 1, ax1, H, Z + 1, wood);
  const bx = Math.sign(A - X), bz = X + bx * 3; w.box(bz, H - 8, Z - 1, bz + bx * 2, H - 4, Z + 1, woodD);
  w.box(A, H - 10, Z, A, H - 4, Z, iron);
  // cage: 13 wide, 18 tall, floor and roof plates, bars every 3 cells on each side
  const c0 = H - 30, c1 = H - 11, h = 6;
  w.box(A - h, c0, Z - h, A + h, c0, Z + h, iron).box(A - h, c1, Z - h, A + h, c1, Z + h, iron).box(A - 1, c1 + 1, Z - 1, A + 1, c1 + 1, Z + 1, iron);
  for (let k = -h; k <= h; k += 3) { w.box(A + k, c0, Z - h, A + k, c1, Z - h, iron).box(A + k, c0, Z + h, A + k, c1, Z + h, iron).box(A - h, c0, Z + k, A - h, c1, Z + k, iron).box(A + h, c0, Z + k, A + h, c1, Z + k, iron); }
  w.box(A - h, c0 + 9, Z - h, A + h, c0 + 9, Z - h, iron).box(A - h, c0 + 9, Z + h, A + h, c0 + 9, Z + h, iron);
  skullAt(w, A, c0 + 1, Z + 2, 's', BONE); boneRod(w, A - 3, c0 + 1, Z - 2, 7, true, BONE_D);
  return [(A + 0.5) * CELL, (c0 + 10) * CELL, (Z + 0.5) * CELL] as P3;
}

// ------------------------------------------------------------------ floors
/** paint a floor rectangle cell by cell: f returns [colour, recessed (0 = floor level, 1 = a joint: left open)] or null for a hole */
export function floorPaint(w: W, r: Rect, f: (x: number, z: number) => [Col, number] | null) {
  // a recessed cell is left as a gap: the dark ground plane a cell further down shows through (bevelled tile edges, no hidden faces)
  for (let x = M(r.x0); x < M(r.x1); x++) for (let z = M(r.z0); z < M(r.z1); z++) { const q = f(x, z); if (q && !q[1]) w.set(x, -1, z, q[0]); }
}
/** staggered flagstones on the absolute cell grid: [colour, recessed] */
export function flag(x: number, z: number, sx: number, sz: number, cols: Col[], grout: Col, seed = 1, ox = 0, oz = 0): [Col, number] {
  const zz = z - oz, row = Math.floor(zz / sz), lz = zz - row * sz, xx = x - ox + (row & 1 ? sx >> 1 : 0), col = Math.floor(xx / sx), lx = xx - col * sx;
  if (lx === sx - 1 || lz === sz - 1) return [grout, 1];
  return [cols[Math.floor(hash(col, row, seed) * cols.length)], 0];
}
/** cell inside a rect given in cells */
export const inC = (x: number, z: number, X0: number, Z0: number, X1: number, Z1: number) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;

// ------------------------------------------------------------------ caves
export interface Rock { cols: Col[]; top: Col; tip: Col; tipGlow?: Col }
/** strata colour of a rock cell at height y: bands 5–10 cells thick, cycling the rock's shades */
export function strata(rk: Rock, y: number, phase = 0) {
  const pat = [8, 5, 10, 6, 9, 7]; let yy = y + 2 + phase, i = 0;
  while (yy >= pat[i % pat.length]) { yy -= pat[i % pat.length]; i++; }
  return rk.cols[i % rk.cols.length];
}
/** a stalactite hanging from (X, Ytop, Z): square tiers 5→3→1 (or 3→1) cells wide, a lighter tip */
export function stalactite(w: W, X: number, Ytop: number, Z: number, len: number, wid: number, col: Col, tip: Col, g = 0) {
  const tiers = wid >= 5 ? [[2, 0.42], [1, 0.36], [0, 0.22]] : [[1, 0.55], [0, 0.45]], yEnd = Ytop - len + 1;
  let y = Ytop;
  tiers.forEach(([r, k], i) => {
    const y1 = i === tiers.length - 1 ? yEnd : Math.max(yEnd + (tiers.length - 1 - i), y - Math.max(1, Math.round(len * k)) + 1);
    if (y1 <= y) w.box(X - r, y1, Z - r, X + r, y, Z + r, col);
    y = y1 - 1;
  });
  w.set(X, yEnd, Z, tip, g);
}
/** a stalagmite standing on the floor: square tiers getting narrower upward (metres for x, z; h in cells) */
export function stalagmite(w: W, x: number, z: number, h: number, wid: number, rk: Rock) {
  const X = M(x), Z = M(z), tiers = wid >= 7 ? [3, 2, 1, 0] : wid >= 5 ? [2, 1, 0] : [1, 0], fr = tiers.length === 4 ? [0.36, 0.28, 0.22, 0.14] : tiers.length === 3 ? [0.45, 0.33, 0.22] : [0.6, 0.4];
  let y = 0; tiers.forEach((r, i) => { const l = Math.max(2, Math.round(h * fr[i])); w.box(X - r, y, Z - r, X + r, y + l - 1, Z + r, i === tiers.length - 1 ? rk.tip : strata(rk, y)); y += l; });
}

interface Seg { a: number; b: number; rec: number; tiers: Array<[number, number]>; lip: number }
/** A cave wall along a face: segments 1.3–3 m long, each a few big terraces (ledges receding upward) or a cliff with an overhanging
 *  lip, rock in horizontal strata, ledge tops in a dust / moss colour, stepped stalactites under the lips, moss and vines hanging from
 *  the tier faces. hTop(u) is the full height (cells) at u — the side runs step down toward the camera. Builds hollow columns (only the
 *  cells that can show) so the rock stays cheap. Returns the segments (for placing things on ledges). */
export function caveRun(c: Ctx, f: Face, u0: number, u1: number, T: number, hTop: (u: number) => number, rk: Rock, o: { seed?: number; openEnd?: boolean; hang?: string[]; tint?: number[]; carve?: (u: number, d: number) => number | null } = {}) {
  const sd = o.seed ?? 1, segs: Seg[] = [], q = (h: number) => Math.max(2, Math.round(h / 3) * 3);
  for (let u = u0, i = 0; u <= u1; i++) {
    const len = 19 + Math.floor(hash(i, sd, 1) * 6) * 5, a = u, b = Math.min(u1, u + len - 1);
    const H = hTop(Math.round((a + b) / 2)) * (0.9 + hash(i, sd, 2) * 0.2), kind = hash(i, sd, 3);
    const rec = kind > 0.82 ? 9 : hash(i, sd, 4) < 0.5 ? 0 : 4, dA = 7 + Math.floor(hash(i, sd, 5) * 3) * 2, dB = 7 + Math.floor(hash(i, sd, 6) * 3) * 2;
    let tiers: Array<[number, number]>, lip = 0;
    if (H < 26) tiers = [[rec + dA, q(H * 0.55)], [T, q(H)]];
    else if (kind < 0.46) tiers = [[rec + dA, q(H * 0.28)], [rec + dA + dB, q(H * 0.6)], [T, q(H)]];
    else if (kind < 0.82) { tiers = [[rec + dB, q(H * 0.45)], [T, q(H)]]; lip = 5; }
    else tiers = [[rec + 5, q(H * 0.16)], [T, q(H)]];
    segs.push({ a, b, rec, tiers, lip }); u = b + 1;
  }
  const segOf = (u: number) => segs.find(s => u >= s.a && u <= s.b);
  const topAt = (u: number, d: number): number => {
    if (d < 0) return -1;
    const s = segOf(u); if (!s) return o.openEnd && u > u1 ? -1 : topAt(Math.max(u0, Math.min(u1, u)), d);
    if (d > T) return topAt(u, T);
    if (d < s.rec) return -1;
    let t = s.tiers[s.tiers.length - 1][1]; for (const [e, h] of s.tiers) if (d < e) { t = h; break; }
    if (o.carve) { const k = o.carve(u, d); if (k != null) t = Math.min(t, k); }
    return t;
  };
  for (let u = u0; u <= u1; u++) for (let d = 0; d <= T; d++) {
    const t = topAt(u, d); if (t < 0) continue;
    const nb = Math.min(topAt(u - 1, d), topAt(u + 1, d), topAt(u, d - 1), topAt(u, d + 1));
    const lo = nb < 0 ? -2 : Math.min(t, nb + 1);
    for (let y = lo; y <= t; y++) f.box(u, y, d, u, y, d, y === t ? rk.top : strata(rk, y));
  }
  // lips and stalactites; cards on terrace faces
  for (const [i, s] of segs.entries()) {
    const last = s.tiers[s.tiers.length - 1], dC = s.tiers.length > 1 ? s.tiers[s.tiers.length - 2][0] : s.rec, hC = last[1], below = s.tiers.length > 1 ? s.tiers[s.tiers.length - 2][1] : -1;
    const room = hC - below;
    const L = s.lip && room > 16 ? s.lip : room > 12 && hC > 30 ? 2 : 0;
    if (L) {
      f.box(s.a + 2, hC - 3, dC - L, s.b - 2, hC, dC - 1, strata(rk, hC - 2)).box(s.a + 2, hC, dC - L, s.b - 2, hC, dC - 1, rk.top);
      for (let u = s.a + 4, k = 0; u <= s.b - 4; u += 6 + Math.floor(hash(u, sd, 7) * 3) * 2, k++) {
        const wid = hash(u, sd, 8) < 0.45 ? 5 : 3, len = Math.min(room - 6, (wid === 5 ? 9 : 6) + Math.floor(hash(u, sd, 9) * 3) * 3);
        if (len < 4) continue;
        const p = f.pos(u, 0, dC - Math.ceil(L / 2)), X = Math.floor(p[0] / CELL), Z = Math.floor(p[2] / CELL);
        stalactite(f.w, X, hC - 4, Z, len, wid, strata(rk, hC - 6), rk.tip, rk.tipGlow ? 1 : 0);
        if (rk.tipGlow) f.w.set(X, hC - 4 - len + 1, Z, rk.tipGlow, 1);
      }
    }
    if (o.hang) s.tiers.forEach(([, h], ti) => {
      if (h < 14 || (ti === s.tiers.length - 1 && L)) return;
      const d0 = ti === 0 ? s.rec : s.tiers[ti - 1][0], hm = (h + 1) * CELL;
      for (let u = s.a + 3 + Math.floor(hash(i, ti, sd) * 6); u <= s.b - 3; u += 11 + Math.floor(hash(u, ti, sd) * 3) * 3) {
        if (hash(u, sd, 11 + ti) < 0.3) continue;
        if (o.carve) { const k = o.carve(u, d0); if (k != null && k < h) continue; }
        const kind = o.hang![Math.floor(hash(u, sd, 12) * o.hang!.length)], sc = Math.min(0.55 + hash(u, sd, 13) * 0.5, (hm - 0.3) / (32 * CELL));
        if (sc > 0.3) f.card(c, kind, u, hm + 0.02, d0, sc, o.tint ? o.tint[u % o.tint.length] : undefined);
      }
    });
  }
  return segs;
}

/** a raised platform over the union of rects (never inside the battle floor): full height inside, a rim tier `rim` cells wide at half height */
export function terrace(w: W, rects: Rect[], h: number, top: Col, side: Col, o: { rim?: number; rimH?: number; rimTop?: Col; topAlt?: Col; seed?: number } = {}) {
  const rim = o.rim ?? 3, set = new Set<number>(), k = (x: number, z: number) => (x + 1024) * 4096 + (z + 1024);
  for (const r of rects) for (let x = M(r.x0); x < M(r.x1); x++) for (let z = M(r.z0); z < M(r.z1); z++) if (!(x * CELL > PLAY.x0 - 0.1 && x * CELL < PLAY.x1 + 0.1 && z * CELL > PLAY.z0 - 0.1 && z * CELL < PLAY.z1 + 0.1)) set.add(k(x, z));
  for (const key of set) {
    const x = Math.floor(key / 4096) - 1024, z = (key % 4096) - 1024;
    let near = rim + 1; for (let i = -rim; i <= rim && near > 1; i++) for (let j = -rim; j <= rim; j++) if (!set.has(k(x + i, z + j))) near = Math.min(near, Math.max(Math.abs(i), Math.abs(j)));
    const hh = near <= rim ? (o.rimH ?? Math.max(1, h >> 1)) : h;
    const t = near <= rim ? (o.rimTop ?? side) : o.topAlt != null && field(Math.floor(x / 6), Math.floor(z / 6), o.seed ?? 2) > 0.35 ? o.topAlt : top;
    w.box(x, 0, z, x, hh - 2, z, side).set(x, hh - 1, z, t);
  }
}
/** clusters of standing cards on top of a raised surface at height y (metres): n clusters of 3-5 inside rect */
export function tufts(c: Ctx, r: Rect, y: number, kinds: string[], n: number, tints: number[], seed = 1, s: [number, number] = [0.5, 0.9]) {
  for (let i = 0; i < n; i++) {
    const cx = r.x0 + 0.3 + hash(i, seed, 1) * (r.x1 - r.x0 - 0.6), cz = r.z0 + 0.3 + hash(i, seed, 2) * (r.z1 - r.z0 - 0.6), m = 3 + Math.floor(hash(i, seed, 3) * 3);
    for (let k = 0; k < m; k++) c.cards.add(kinds[(i + k) % kinds.length], cx + (hash(i, k, seed + 4) - 0.5) * 0.7, cz + (hash(i, k, seed + 5) - 0.5) * 0.7, { y, s: s[0] + hash(i, k, seed + 6) * (s[1] - s[0]), tint: tints[(i + k) % tints.length] });
  }
}
/** a rubble heap of a few big blocks in two tiers (metres for x, z; s scales the blocks) */
export function rubble(w: W, x: number, z: number, cols: Col[], seed = 1, s = 1) {
  const X = M(x), Z = M(z), B: Array<[number, number, number, number, number, number]> = [[-7, -3, 7, 6, 0, 5], [2, -4, 6, 7, 0, 4], [-3, 3, 8, 5, 0, 3], [-4, -2, 6, 6, 5, 4], [3, 2, 4, 4, 0, 6], [1, -2, 4, 4, 4, 3]];
  B.forEach(([dx, dz, sx, sz, y0, h], i) => { if (i === 5 && hash(seed, 5) < 0.5) return; const a = Math.round(sx * s), b = Math.round(sz * s), c = cols[(i + seed) % cols.length]; w.box(X + Math.round(dx * s), y0, Z + Math.round(dz * s), X + Math.round(dx * s) + a - 1, y0 + Math.round(h * s) - 1, Z + Math.round(dz * s) + b - 1, c); });
}
/** a patch of floor moss: a blocky blob (two crossed rects and a core) in moss, the core glowing faintly */
export function mossPatch(w: W, x: number, z: number, rx: number, rz: number, moss: Col, glowC?: Col) {
  const X = M(x), Z = M(z), a = M(rx), b = M(rz);
  w.box(X - a, -1, Z - b + 3, X + a, -1, Z + b - 3, moss).box(X - a + 3, -1, Z - b, X + a - 3, -1, Z + b, moss);
  if (glowC != null) w.box(X - a + 5, -1, Z - b + 5, X + a - 5, -1, Z + b - 5, glowC, 1);
}

// ------------------------------------------------------------------ spider cave
export const SILK = 0xd8d4c8, SILK_D = 0xb4ae9e, SILK_S = 0x948e80;
/** a silk cocoon (cells): narrow caps, a fat wrapped body with darker wrap bands; hanging on a thread from yThread, or lying along x;
 *  `peek` shows what is inside: a boot at the foot or a helmet at the head */
export function cocoon(w: W, X: number, Y: number, Z: number, h: number, o: { lying?: boolean; thread?: number; peek?: 'boot' | 'helm' | 'hand' } = {}) {
  if (o.lying) {
    const Y0 = Y, hl = h >> 1;
    w.box(X - hl, Y0, Z - 3, X + hl, Y0 + 5, Z + 3, SILK).box(X - hl - 2, Y0 + 1, Z - 2, X + hl + 2, Y0 + 4, Z + 2, SILK);
    for (let k = -hl + 2; k < hl; k += 3) w.box(X + k, Y0, Z - 3, X + k, Y0 + 5, Z + 3, SILK_D);
    if (o.peek === 'boot') w.box(X + hl + 3, Y0 + 1, Z - 1, X + hl + 5, Y0 + 4, Z + 1, 0x4a3022).box(X + hl + 5, Y0 + 1, Z - 1, X + hl + 5, Y0 + 1, Z + 2, 0x4a3022);
    if (o.peek === 'helm') w.box(X - hl - 5, Y0 + 1, Z - 2, X - hl - 3, Y0 + 5, Z + 2, 0x8a8c98).box(X - hl - 5, Y0 + 3, Z - 2, X - hl - 5, Y0 + 3, Z + 2, 0x2a2830);
    if (o.peek === 'hand') w.box(X - 1, Y0 + 2, Z + 4, X + 1, Y0 + 3, Z + 6, 0xc8a080);
    return;
  }
  const y0 = Y, y1 = Y + h - 1;
  w.box(X - 2, y0 + 2, Z - 2, X + 2, y1 - 2, Z + 2, SILK).box(X - 1, y0, Z - 1, X + 1, y1, Z + 1, SILK);
  for (let v = y0 + 3; v < y1 - 2; v += 3) w.box(X - 2, v, Z - 2, X + 2, v, Z + 2, SILK_D);
  if (o.thread != null) w.box(X, y1 + 1, Z, X, o.thread, Z, SILK_D);
  if (o.peek === 'boot') w.box(X - 1, y0 - 3, Z - 1, X + 1, y0 - 1, Z + 1, 0x4a3022).box(X - 1, y0 - 3, Z + 2, X + 1, y0 - 3, Z + 2, 0x4a3022);
  if (o.peek === 'helm') w.box(X - 2, y1 - 1, Z - 2, X + 2, y1 + 1, Z + 2, 0x8a8c98).box(X - 2, y1 - 1, Z + 2, X + 2, y1 - 1, Z + 2, 0x2a2830);
  if (o.peek === 'hand') w.box(X + 3, y0 + 4, Z, X + 4, y0 + 6, Z, 0xc8a080);
}
/** a spider egg (cells): a cream body with a narrower crown and a glowing slit on the side facing +z */
export function egg(w: W, X: number, Y: number, Z: number, glowC: Col, big = false) {
  const r = big ? 3 : 2, h = big ? 7 : 5;
  w.box(X - r, Y, Z - r, X + r - 1, Y + h - 2, Z + r - 1, 0xe0d8c0).box(X - r + 1, Y + h - 1, Z - r + 1, X + r - 2, Y + h - 1, Z + r - 2, 0xcac0a6);
  w.box(X - 1, Y + 2, Z + r - 1, X, Y + h - 3, Z + r - 1, glowC, 1);
}
/** a nest of eggs on a three-tier silk mound (metres for x, z, a, b) */
export function eggNest(w: W, x: number, z: number, a: number, b: number, glowC: Col, seed = 1) {
  const X = M(x), Z = M(z), A = M(a), B = M(b);
  w.box(X - A, 0, Z - B, X + A, 2, Z + B, SILK_S).box(X - A + 4, 3, Z - B + 3, X + A - 4, 5, Z + B - 3, SILK_D).box(X - A + 9, 6, Z - B + 6, X + A - 9, 7, Z + B - 6, SILK_D);
  const put = (tierY: number, inset: number, n: number, big: boolean) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, ex = X - A + inset + Math.round(t * (2 * A - 2 * inset)); egg(w, ex + (hash(i, seed) < 0.5 ? 0 : 1), tierY, Z + B - inset - 2 - (i % 2) * 3, glowC, big); } };
  put(3, 3, Math.max(2, Math.round(A / 6)), false); put(6, 7, Math.max(2, Math.round(A / 8)), true); put(8, 11, Math.max(1, Math.round(A / 12)), false);
}
/** a fallen adventurer's kit (metres): a heater shield standing against something (facing +z), a helmet, a sword stuck in the ground */
export function shieldUpright(w: W, x: number, z: number, field: Col, mark: Col) {
  const X = M(x), Z = M(z), R = 0x3a3640;
  w.box(X - 5, 3, Z, X + 5, 13, Z + 1, R).box(X - 4, 4, Z + 1, X + 4, 12, Z + 1, field).box(X - 3, 1, Z, X + 3, 2, Z + 1, R).box(X - 2, 2, Z + 1, X + 2, 3, Z + 1, field).box(X - 1, 0, Z, X + 1, 0, Z + 1, R);
  w.box(X - 4, 9, Z + 1, X + 4, 9, Z + 1, mark).box(X, 3, Z + 1, X, 12, Z + 1, mark).box(X - 1, 8, Z + 2, X + 1, 10, Z + 2, 0x8a8c98);
}
export function helmet(w: W, x: number, z: number, steel = 0x8a8c98, dark = 0x2a2830, plume = 0x9a3a30) {
  const X = M(x), Z = M(z);
  w.box(X - 3, 0, Z - 3, X + 3, 3, Z + 3, steel).box(X - 2, 4, Z - 2, X + 2, 5, Z + 2, steel).box(X - 3, 2, Z + 3, X + 3, 2, Z + 3, dark).box(X - 1, 1, Z + 3, X + 1, 1, Z + 3, dark);
  w.box(X, 6, Z - 2, X, 7, Z + 1, plume).box(X, 6, Z - 3, X, 6, Z - 4, plume);
}
export function swordInGround(w: W, x: number, z: number, steel = 0xb8bcc8, grip = 0x4a3022, gold = 0xc8a040) {
  const X = M(x), Z = M(z);
  w.box(X, 0, Z, X, 10, Z, steel).box(X - 2, 11, Z, X + 2, 11, Z, gold).box(X, 12, Z, X, 14, Z, grip).box(X, 15, Z, X, 15, Z, gold).box(X - 1, 0, Z - 1, X + 1, 0, Z + 1, 0x4a4438);
}
export function lantern(w: W, x: number, z: number, iron = 0x34323e, glowC = 0xffb050) {
  const X = M(x), Z = M(z);
  w.box(X - 1, 0, Z - 1, X + 1, 0, Z + 1, iron).box(X - 1, 1, Z - 1, X + 1, 3, Z + 1, glowC, 1).box(X - 1, 4, Z - 1, X + 1, 4, Z + 1, iron).set(X, 5, Z, iron).box(X - 1, 6, Z, X + 1, 6, Z, iron);
  return [x, 2.5 * CELL, z] as P3;
}
/** the big web: a wall card 64×44 texels, anchored to a frame — eight spokes (axis and exact 45°), four octagon rings, corner anchors */
addCardKind('bigweb', { kind: 'wall', w: 64, h: 44, sway: 0.015 }, g => {
  const px = (x: number, y: number) => { if (x >= 0 && x < 64 && y >= 0 && y < 44) g.fillRect(x, y, 1, 1); };
  g.fillStyle = 'rgba(236,236,244,1)';
  const cx = 32, cy = 18;
  // eight spokes running out to the card's edges (they meet the rock, the lintel and the nest)
  for (let k = -32; k < 32; k++) px(cx + k, cy);
  for (let y = 0; y < 44; y++) px(cx, y);
  for (let k = -26; k <= 26; k++) { px(cx + k, cy + k); px(cx - k, cy + k); }
  // five octagon rings, the outer ones clipped by the edges
  for (const r of [3, 7, 11, 16, 22]) {
    const b2 = Math.round(r * 0.414);
    for (let k = -b2; k <= b2; k++) { px(cx + r, cy + k); px(cx - r, cy + k); px(cx + k, cy + r); px(cx + k, cy - r); }
    for (let k = 0; k <= r - b2; k++) { const a2 = b2 + k, c2 = r - k; px(cx + a2, cy + c2); px(cx - a2, cy + c2); px(cx + a2, cy - c2); px(cx - a2, cy - c2); }
  }
  // the hub: a small solid knot of silk
  g.fillRect(cx - 1, cy - 1, 3, 3);
});

// ------------------------------------------------------------------ mushroom grotto
/** a cross-shaped footprint: a square of half-size r with its corners cut by c (two overlapping rects) */
function plus(w: W, X: number, Z: number, r: number, cut: number, y0: number, y1: number, col: Col, g = 0) {
  w.box(X - r, y0, Z - r + cut, X + r, y1, Z + r - cut, col, g).box(X - r + cut, y0, Z - r, X + r - cut, y1, Z + r, col, g);
}
/** a giant mushroom: flared foot, stem with a hanging ring, three stepped cap tiers (cut corners), a glowing gill rim under the bottom
 *  tier and glowing spots set in a ring on top; returns a point under the cap (for a light) */
export function bigShroom(w: W, x: number, z: number, H: number, R: number, c: { stem: Col; stemD: Col; cap: Col; capD: Col; gill: Col; spot: Col }) {
  const X = M(x), Z = M(z), r = Math.max(2, Math.round(R / 6));
  plus(w, X, Z, r + 3, 2, 0, 1, c.stemD); plus(w, X, Z, r + 1, 1, 2, 4, c.stem);
  w.box(X - r, 0, Z - r, X + r, H - 1, Z + r, c.stem);
  const ring = Math.round(H * 0.68); plus(w, X, Z, r + 2, 1, ring, ring + 1, c.stemD); plus(w, X, Z, r + 1, 0, ring - 2, ring - 1, c.stem);
  plus(w, X, Z, R, Math.round(R * 0.3), H, H, c.gill, 1);
  plus(w, X, Z, R, Math.round(R * 0.3), H + 1, H + 4, c.capD);
  plus(w, X, Z, R - 3, Math.round(R * 0.28), H + 5, H + 8, c.cap);
  const r3 = Math.max(2, R - 7); plus(w, X, Z, r3, Math.round(r3 * 0.3), H + 9, H + 10, c.cap);
  // spots: 2x2, evenly round each tier's visible rim
  const sp = R - 2;
  for (const [dx, dz] of [[0, -sp], [0, sp - 1], [-sp, 0], [sp - 1, 0]] as const) w.box(X + dx, H + 4, Z + dz, X + dx + 1, H + 4, Z + dz + 1, c.spot, 1);
  const sp2 = R - 5; if (sp2 > 3) for (const [dx, dz] of [[-sp2 + 2, -sp2 + 2], [sp2 - 3, -sp2 + 2], [-sp2 + 2, sp2 - 3], [sp2 - 3, sp2 - 3]] as const) w.box(X + dx, H + 8, Z + dz, X + dx + 1, H + 8, Z + dz + 1, c.spot, 1);
  return [x, (H - 2) * CELL, z] as P3;
}
/** a crystal: a square prism tapering in two or three tiers (glowing), on a darker base collar */
export function crystal(w: W, X: number, Y: number, Z: number, h: number, r: number, col: Col, colL: Col, base: Col) {
  w.box(X - r - 1, Y, Z - r - 1, X + r + 1, Y + 1, Z + r + 1, base);
  const t1 = Math.round(h * 0.55), t2 = Math.round(h * 0.85);
  w.box(X - r, Y + 2, Z - r, X + r, Y + 1 + t1, Z + r, col, 1);
  if (r >= 2) { w.box(X - r + 1, Y + 2 + t1, Z - r + 1, X + r - 1, Y + 1 + t2, Z + r - 1, col, 1); w.box(X, Y + 2 + t2, Z, X, Y + 1 + h, Z, colL, 1); }
  else w.box(X, Y + 2 + t1, Z, X, Y + 1 + h, Z, colL, 1);
}
/** a crystal cluster (metres): a tall centre prism and smaller ones round it on a rock base */
export function crystals(w: W, x: number, z: number, h: number, col: Col, colL: Col, base: Col, seed = 1, Y = 0) {
  const X = M(x), Z = M(z);
  w.box(X - 5, Y, Z - 4, X + 5, Y + 1, Z + 4, base);
  crystal(w, X, Y + 1, Z, h, 2, col, colL, base);
  const around: Array<[number, number, number]> = [[-5, 2, 0.55], [4, -2, 0.7], [-2, -5, 0.4], [5, 4, 0.35], [-6, -3, 0.3]];
  around.forEach(([dx, dz, k], i) => { if (i === 4 && hash(seed, 4) < 0.5) return; crystal(w, X + dx, Y + 1, Z + dz, Math.max(3, Math.round(h * k)), i < 2 ? 1 : 0 + 1, col, colL, base); });
}
/** a sunk pool with a stone curb in two tiers and corner posts; the bed glows faintly under the water (metres) */
export function pool(c: Ctx, r: Rect, s: { stone: Col; stoneL: Col; bed: Col; water: Col; moss?: Col }, o: { rim?: number; broken?: number } = {}) {
  const w = c.w, X0 = M(r.x0), X1 = M(r.x1), Z0 = M(r.z0), Z1 = M(r.z1), R = o.rim ?? 4;
  w.box(X0, -1, Z0, X1, -1, Z1, null).box(X0, -2, Z0, X1, -2, Z1, s.bed, 1);
  for (let x = X0 - R; x <= X1 + R; x++) for (let z = Z0 - R; z <= Z1 + R; z++) {
    if (x >= X0 && x <= X1 && z >= Z0 && z <= Z1) continue;
    const inner = x >= X0 - 2 && x <= X1 + 2 && z >= Z0 - 2 && z <= Z1 + 2;
    if (o.broken != null && x > X0 + (X1 - X0) * o.broken && x < X0 + (X1 - X0) * (o.broken + 0.18) && z > Z1) continue;
    w.box(x, -1, z, x, inner ? 1 : 0, z, s.stone).set(x, inner ? 2 : 0, z, inner ? s.stoneL : (s.moss ?? s.stone));
  }
  for (const [px, pz] of [[X0 - R, Z0 - R], [X1 + 1, Z0 - R], [X0 - R, Z1 + 1], [X1 + 1, Z1 + 1]]) if (o.broken == null || pz < Z1) w.box(px, 0, pz, px + R - 1, 3, pz + R - 1, s.stone).box(px, 4, pz, px + R - 1, 4, pz + R - 1, s.stoneL);
  c.water(r.x0, r.z0, r.x1 + CELL, r.z1 + CELL, s.water);
}

// ------------------------------------------------------------------ root deep
export interface Bark { bark: Col; dark: Col; groove: Col; sap: Col }
/** a root segment: a box of bark; its long faces carry bark plates (two staggered lines of groove dashes), a long root gets one knuckle
 *  ring, a horizontal one a mossy strip on top; optionally a glowing sap crack along one groove line */
export function rootSeg(w: W, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: Bark, o: { vein?: [number, number]; seed?: number; moss?: number } = {}) {
  const [ax, ay, az] = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [bx, by, bz] = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
  w.box(ax, ay, az, bx, by, bz, b.bark);
  const lx = bx - ax, ly = by - ay, lz = bz - az, along = ly >= lx && ly >= lz ? 'y' : lx >= lz ? 'x' : 'z';
  const dashes = (a0: number, a1: number, off: number, put: (t: number) => void) => { for (let t = a0; t <= a1; t++) if (((t - a0 + off) % 9) < 6) put(t); };
  if (along === 'y') {
    if (bx - ax >= 6) { dashes(ay, by, 0, y => w.set(ax + 2, y, bz, b.groove)); dashes(ay, by, 4, y => w.set(bx - 2, y, bz, b.groove)); }
    if (bz - az >= 6) { dashes(ay, by, 2, y => { w.set(ax, y, az + 2, b.groove); w.set(bx, y, bz - 2, b.groove); }); }
    if (ly > 18) { const k = ay + Math.round(ly * 0.38); w.box(ax - 1, k, az - 1, bx + 1, k + 1, bz + 1, b.dark); }
    if (o.vein) w.box(ax + 2, ay + o.vein[0], bz, ax + 2, Math.min(by, ay + o.vein[1]), bz, b.sap, 1);
  } else if (along === 'x') {
    if (by - ay >= 6) { dashes(ax, bx, 0, x => w.set(x, ay + 2, bz, b.groove)); dashes(ax, bx, 4, x => w.set(x, by - 2, bz, b.groove)); }
    w.box(ax, by, az, bx, by, az, b.dark);
    if (lx > 22) { const k = ax + Math.round(lx * 0.42); w.box(k, ay - 1, az - 1, k + 1, by + 1, bz + 1, b.dark); }
    if (o.moss != null && lx > 8 && bz - az >= 4) w.box(ax + 3, by, az + 2, bx - 3, by, bz - 2, o.moss);
    if (o.vein) w.box(ax + o.vein[0], ay + 2, bz, Math.min(bx, ax + o.vein[1]), ay + 2, bz, b.sap, 1);
  } else {
    if (bx - ax >= 6) dashes(az, bz, 0, z => { w.set(ax + 2, by, z, b.groove); w.set(bx - 2, by, z, b.groove); });
    if (o.moss != null && lz > 8 && bx - ax >= 4) w.box(ax + 2, by, az + 3, bx - 2, by, bz - 3, o.moss);
    if (o.vein) w.box(ax + 2, by, az + o.vein[0], ax + 2, by, Math.min(bz, az + o.vein[1]), b.sap, 1);
  }
}
/** a hanging root tip (cells): 4 → 2 → 1 wide, with a one-cell jog half way down so it never reads as a stick */
export function rootTip(w: W, X: number, Ytop: number, Z: number, len: number, b: Bark, jog = 1) {
  const l1 = Math.round(len * 0.4), l2 = Math.round(len * 0.35);
  w.box(X - 1, Ytop - l1 + 1, Z - 1, X + 2, Ytop, Z + 2, b.bark);
  w.box(X + jog, Ytop - l1 - l2 + 1, Z, X + jog + 1, Ytop - l1, Z + 1, b.dark);
  w.box(X + jog, Ytop - len + 1, Z, X + jog, Ytop - l1 - l2, Z, b.dark);
}
/** roots wrapped round a column (cells): two bands, a climbing root up one side that bends into the floor */
export function rootWrap(w: W, x: number, z: number, r: number, ys: number[], b: Bark, side: 1 | -1, top: number) {
  const X = M(x), Z = M(z);
  for (const y of ys) w.box(X - r - 2, y, Z - r - 2, X + r + 2, y + 2, Z + r + 2, b.bark).box(X - r - 2, y + 2, Z + r + 2, X + r + 2, y + 2, Z + r + 2, b.dark);
  const cx = X + side * (r + 2);
  rootSeg(w, cx - 1, 0, Z - 1, cx + 1, top, Z + 2, b, { vein: [4, 14] });
  rootSeg(w, cx, -1, Z - 1, cx + side * 12, 2, Z + 2, b);
  w.box(cx + side * 12, -1, Z - 1, cx + side * 16, 0, Z + 1, b.dark);
}
/** a broken ancient column of carved blue-grey stone (cells via metres); returns its top */
export function ruinColumn(w: W, x: number, z: number, H: number, s: Stone, r = 5) {
  column(w, x, z, H + 12, s, { r, broken: H });
  return H;
}
/** a sap puddle on the floor: an off-centre blob of three overlapping rects of glowing amber inside a dark rim (metres) */
export function sapPuddle(w: W, x: number, z: number, rx: number, rz: number, sap: Col, rim: Col) {
  const X = M(x), Z = M(z), a = M(rx), b = M(rz), R: Array<[number, number, number, number]> = [[-a, -b + 1, a - 2, b - 1], [-a + 3, -b - 1, a, b - 2], [-a + 1, 0, a - 4, b + 1]];
  for (const [x0, z0, x1, z1] of R) w.box(X + x0 - 1, -1, Z + z0 - 1, X + x1 + 1, -1, Z + z1 + 1, rim);
  for (const [x0, z0, x1, z1] of R) w.box(X + x0, -1, Z + z0, X + x1, -1, Z + z1, sap, 1);
}
/** a skeleton slumped against a wall, looking `look` (metres): ribcage with dark rib gaps, pelvis, skull, arms down, legs out */
export function skeletonSit(w: W, x: number, z: number, look: Look, bone = BONE) {
  const f = new Face(w, look, look === 's' || look === 'n' ? M(z) : M(x)), uc = look === 's' || look === 'n' ? M(x) : M(z), gap = 0x2a2420;
  f.box(uc - 2, 0, 0, uc + 2, 2, 3, BONE_D).box(uc - 2, 3, 0, uc + 2, 8, 3, bone).box(uc - 2, 4, 0, uc + 2, 4, 0, gap).box(uc - 2, 6, 0, uc + 2, 6, 0, gap).box(uc, 3, 0, uc, 8, 0, bone);
  skullF(f, uc, 9, -1, bone, 0x1a1418);
  f.box(uc - 2, 0, -9, uc - 1, 1, -1, bone).box(uc + 1, 0, -9, uc + 2, 1, -1, bone).box(uc - 2, 2, -9, uc - 1, 3, -9, bone).box(uc + 1, 2, -9, uc + 2, 3, -9, bone);
  f.box(uc - 4, 2, 1, uc - 3, 7, 1, bone).box(uc + 3, 2, 1, uc + 4, 7, 1, bone);
}


// ------------------------------------------------------------------ decay: cracks, spalled facing, seeps, roots, lifted slabs, the vault
/** a crack running down a wall face: one cell wide and one deep, in vertical runs of 5-10 cells joined by 2-3 cell sideways jogs (no
 *  diagonals); dark inside */
export function crack(f: Face, u: number, vTop: number, vBot: number, seed = 1, dark = 0x0c0a10, amp = 2) {
  let x = u, v = vTop, i = 0;
  while (v > vBot) {
    const run = 5 + Math.floor(hash(i, seed, 1) * 6), v1 = Math.max(vBot, v - run);
    f.box(x, v1, 0, x, v, 0, null).box(x, v1, 1, x, v, 1, dark);
    if (v1 <= vBot) break;
    const sgn = x > u ? -1 : x < u ? 1 : hash(i, seed, 2) < 0.5 ? -1 : 1, jog = sgn * (amp - 1 + Math.floor(hash(i, seed, 3) * 2)), x1 = x + jog;
    f.box(Math.min(x, x1), v1, 0, Math.max(x, x1), v1, 0, null).box(Math.min(x, x1), v1, 1, Math.max(x, x1), v1, 1, dark);
    x = x1; v = v1 - 1; i++;
  }
}
/** facing fallen off a wall: the face layer is gone over a union of rects, showing the rough core (darker, coursed every 4 cells) */
export function spall(f: Face, rects: Array<[number, number, number, number]>, core: Col, coreJ: Col) {
  for (const [a, b, c, d] of rects) {
    f.box(a, b, 0, c, d, 0, null).box(a, b, 1, c, d, 1, core);
    for (let v = b + 1; v <= d; v += 4) f.box(a, v, 1, c, v, 1, coreJ);
    for (let v = b + 1, r = 0; v <= d; v += 4, r++) for (let k = a + (r & 1 ? 3 : 0); k <= c; k += 6) f.box(k, v, 1, k, Math.min(d, v + 3), 1, coreJ);
  }
}
/** a water stain down a wall face: a flush dark streak, narrow at the top and wider at its wet foot */
export function seep(f: Face, u: number, vTop: number, vBot: number, col: Col, colD: Col) {
  const mid = Math.round((vTop + vBot) / 2);
  f.box(u, mid, 0, u + 1, vTop, 0, col).box(u - 1, vBot, 0, u + 2, mid, 0, col).box(u, vBot, 0, u + 1, vBot + 3, 0, colD);
}
/** a root that came in at the top of a wall and crawls down its face in runs and sideways jogs, then out across the floor */
export function rootCrawl(f: Face, u: number, vTop: number, out: number, b: Bark, seed = 1, th = 2) {
  let x = u, v = vTop, i = 0; const e = th - 1;
  f.box(x - 1, v - 2, -2, x + 2, v + 1, -1, b.dark);
  while (v > 3) {
    const run = 9 + Math.floor(hash(i, seed, 4) * 8), v1 = Math.max(2, v - run);
    f.box(x, v1, -1 - e, x + e, v, -1, b.bark).box(x, v1, -1 - e, x, v, -1 - e, b.dark);
    if (v1 <= 2) break;
    const sgn = x > u + 1 ? -1 : x < u - 1 ? 1 : hash(i, seed, 5) < 0.5 ? -1 : 1, jog = sgn * (3 + Math.floor(hash(i, seed, 6) * 2)), x1 = x + jog;
    f.box(Math.min(x, x1), v1 - e, -1 - e, Math.max(x, x1) + e, v1, -1, b.bark);
    x = x1; v = v1 - 2; i++;
  }
  f.box(x - 1, 0, -1 - e, x + e + 1, 2, -1, b.bark).box(x, 0, -1 - e - out, x + e + 1, 1, -1 - e, b.bark).box(x, 1, -1 - e - out, x + e + 1, 1, -1 - e, b.dark);
  return x;
}
/** floor slabs heaved up by a root: each slab in two wide steps (one half a cell higher), the root showing along their edge (metres) */
export function heave(w: W, x: number, z: number, n: number, alongX: boolean, slab: Col, slabL: Col, b: Bark) {
  const X = M(x), Z = M(z);
  for (let i = 0; i < n; i++) {
    const o = i * 12, [x0, z0] = alongX ? [X + o, Z - 5] : [X - 5, Z + o], [x1, z1] = alongX ? [x0 + 10, Z + 5] : [X + 5, z0 + 10];
    const half = alongX ? [x0, z0, x0 + 4, z1] : [x0, z0, x1, z0 + 4];
    w.box(x0, 0, z0, x1, 0, z1, slab).box(half[0], 1, half[1], half[2], 1, half[3], slabL);
  }
  const L = n * 12;
  if (alongX) w.box(X, 0, Z + 6, X + L, 1, Z + 8, b.bark).box(X, 2, Z + 7, X + L, 2, Z + 7, b.dark);
  else w.box(X + 6, 0, Z, X + 8, 1, Z + L, b.bark).box(X + 7, 2, Z, X + 7, 2, Z + L, b.dark);
}
/** fallen vault stones: big dressed blocks (a trim edge on each), lying in two tiers, plus smaller rubble (metres) */
export function vaultFall(w: W, x: number, z: number, s: Stone, seed = 1) {
  const X = M(x), Z = M(z);
  const B: Array<[number, number, number, number, number, number]> = [[-12, -6, 10, 7, 0, 7], [0, -9, 12, 6, 0, 6], [-4, 2, 9, 9, 0, 5], [6, 3, 7, 6, 0, 8], [-8, -3, 9, 6, 7, 5], [2, -5, 8, 5, 6, 4]];
  B.forEach(([dx, dz, sx, sz, y0, h], i) => {
    const a = X + dx, b = Z + dz, c = i % 3 === 0 ? s.pil : i % 3 === 1 ? s.a : s.trim;
    w.box(a, y0, b, a + sx - 1, y0 + h - 1, b + sz - 1, c).box(a, y0 + h - 1, b, a + sx - 1, y0 + h - 1, b, s.trimL);
  });
  rubble(w, x + 0.9, z + 0.9, [s.a, s.pil, s.base], seed, 0.55);
}
/** A corbelled stone vault over a room, for the cutaway layer: tiers stepping in from both side walls to a flat crown, a shell t cells
 *  thick (closed where tiers rise), transverse ribs every ribEvery cells, a moss / earth skin on top, and jagged holes knocked through. */
export function corbelVault(cw: W, o: { x0: number; x1: number; z0: number; z1: number; y: number; tiers: Array<[number, number]>; crown: number; t?: number; stone: Col; under: Col; rib: Col; top: Col; topAlt?: Col; ribEvery?: number; holes?: Array<[number, number, number, number]>; ends?: Array<[number, number]>; endCol?: Col }) {
  const t = o.t ?? 3, RE = o.ribEvery ?? 46;
  const h = (x: number) => { const ins = Math.min(x - o.x0, o.x1 - x); for (const [e, hh] of o.tiers) if (ins < e) return o.y + hh; return o.y + o.crown; };
  const inHole = (x: number, z: number) => (o.holes ?? []).some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
  for (let x = o.x0; x <= o.x1; x++) {
    const hx = h(x), hi = Math.max(h(x - 1 < o.x0 ? x : x - 1), hx, h(x + 1 > o.x1 ? x : x + 1)) + t - 1;
    for (let z = o.z0; z <= o.z1; z++) {
      if (inHole(x, z)) continue;
      const rib = ((z - o.z0) % RE) < 3, lo = rib ? hx - 2 : hx;
      if (hi - 1 > lo) cw.box(x, lo + 1, z, x, hi - 1, z, o.stone);
      cw.set(x, lo, z, rib ? o.rib : o.under).set(x, hi, z, o.topAlt != null && ((z - o.z0) % 18 === 0 || h(x) !== h(x + 1) || h(x) !== h(x - 1)) ? o.topAlt : o.top);   // roof slabs: dark joints every 18 rows and along each tier's edge
    }
  }
  // end walls (the lunettes over the front and back walls) closing the vault's profile: [z0, z1] cell ranges
  for (const [za, zb] of o.ends ?? []) for (let x = o.x0; x <= o.x1; x++) cw.box(x, o.y, za, x, h(x) + t - 1, zb, o.endCol ?? o.stone);
  // the broken edges of the holes: a darker raw ring one cell in
  for (const [a, b, c, d] of o.holes ?? []) for (let x = a - 1; x <= c + 1; x++) for (let z = b - 1; z <= d + 1; z++) {
    if (inHole(x, z) || x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) continue;
    if (inHole(x + 1, z) || inHole(x - 1, z) || inHole(x, z + 1) || inHole(x, z - 1)) { const hx = h(x); cw.box(x, hx, z, x, hx + t - 1, z, o.rib); }
  }
}

/** a stool knocked over: seat on edge, legs sticking out sideways (metres) */
export function stoolTipped(w: W, x: number, z: number, wood: Col, woodD: Col) { const X = M(x), Z = M(z); w.box(X, 0, Z - 2, X, 4, Z + 2, wood); for (const [j, y] of [[-2, 0], [2, 0], [-2, 4], [2, 4]]) w.box(X + 1, y, Z + j, X + 6, y, Z + j, woodD); }
/** a crate broken open: three walls standing, the fourth and the lid gone, one plank on the floor beside it (metres) */
export function brokenCrate(w: W, x: number, z: number, s: number, wood: Col, woodD: Col) {
  const X = M(x), Z = M(z);
  w.box(X - s, 0, Z - s, X + s, 0, Z + s, woodD).box(X - s, 1, Z - s, X - s, 2 * s, Z + s, wood).box(X - s, 1, Z - s, X + s, 2 * s, Z - s, wood).box(X + s, 1, Z - s, X + s, s, Z + s, wood);
  w.box(X - s, 2 * s, Z - s, X + s, 2 * s, Z - s, woodD).box(X - s, 1, Z - s, X - s, 2 * s, Z - s, woodD);
  w.box(X - s + 1, 0, Z + s + 2, X + s + 3, 0, Z + s + 3, wood);
}

/** a breach in the top of a wall: the wall above each step's height is gone between its u bounds (wide steps, widest at the top); the
 *  broken surfaces show rough core. steps: [u0, u1, v] from the bottom of the gap up */
export function breach(f: Face, steps: Array<[number, number, number]>, H: number, t: number, core: Col) {
  for (const [a, b, v] of steps) f.box(a, v, -4, b, H + 2, t - 1, null);
  steps.forEach(([a, b, v], i) => {
    const prev = steps[i - 1], vTop = i + 1 < steps.length ? steps[i + 1][2] - 1 : H;
    if (!prev) f.box(a, v - 1, 0, b, v - 1, t - 1, core);
    else { if (a < prev[0]) f.box(a, v - 1, 0, prev[0] - 1, v - 1, t - 1, core); if (b > prev[1]) f.box(prev[1] + 1, v - 1, 0, b, v - 1, t - 1, core); }
    f.box(a - 1, v, 0, a - 1, vTop, t - 1, core).box(b + 1, v, 0, b + 1, vTop, t - 1, core);
  });
}
