// Underground: catacomb, dungeon cells, spider cave, mushroom grotto, and the root colossus deep (boss).
// Each room has one landmark at the back centre (ossuary arch, gatehouse, web-curtained cave mouth, giant mushroom over a glowing pool,
// root arch over a sap pool), walls with real structure (plinth, courses, pilasters, niches, cornice; or rock strata, terraces, lips and
// stepped stalactites), story props in groups on the sides with a light each, and a patterned floor; the battle floor stays flat.
// The room-building kit lives in k_under.ts.
import { type SceneDef, type Ctx } from './stage';
import { M, AREA, patches, barrel, crate } from './props';
import { mushroom } from './flora';
import { dress } from './dress';
import { CELL } from '../bestiary/kit';
import * as K from './k_under';

const FIRE = 0xffa040, IRON = 0x3a3844, IRON_D = 0x2c2a34, WOOD = 0x6a4a32, WOOD_D = 0x4a3222, WOOD_L = 0x86603e;
const lightAt = (c: Ctx, p: K.P3, col: number, i: number, d: number, dy = 0) => c.light([p[0], p[1] + dy, p[2]], col, i, d);
/** cave side walls drop to a low rim in front of the battle floor's front edge (nothing over 0.5 m there) */
const lowFront = (u: number) => (u * CELL > 5.5 ? 5 : null);
/** a dungeon side wall's front stub: plinth-high masonry with a coping (under 0.5 m) */
const stub = (f: K.Face, u0: number, u1: number, S: K.Stone) => { f.box(u0, -2, 0, u1, 5, 6, S.a).box(u0, -2, -1, u1, 4, -1, S.base).box(u0, 6, -1, u1, 6, 6, S.trimL); };

// ======================================================================================== 地下墓穴 · catacomb
export const catacomb: SceneDef = {
  id: 'n_catacomb', name: '地下墓穴', group: '普通', kind: '地牢', blurb: '墙里一格一格的骷髅都在看着你。', mood: K.CRYPT, foes: ['forest_bone_reaver', 'forest_ghoul'],
  build(c) {
    const w = c.w;
    const S: K.Stone = { a: 0x67657c, b: 0x6d6b83, mortar: 0x4d4b60, base: 0x4a4859, baseTop: 0x78768e, trim: 0x7c7a93, trimL: 0x8c8aa3, pil: 0x716f88, dark: 0x16141c };
    const SOUL = 0x5affc0, EYE = 0x2aa07a, WAX = 0xe8e0c8;
    // ---------------------------------------------------------------- floor: gutters along the walls, a slab border, flagstones, a processional runner to the arch
    const FIELD = [0x57556c, 0x5c5a72, 0x535166], GROUT = 0x24222c, BAND = [0x66647c, 0x6a6880], WATER = 0x1a2a2e, RUN = [0x6e6b7e, 0x737084], RUNB = 0x3e3c4c, MED = 0x86829a, MEDD = 0x5e5a70;
    K.floorPaint(w, AREA, (x, z) => {
      const ax = Math.abs(x);
      if (z <= -161 || ax >= 149) return [S.base, 0];
      const gutS = ax >= 145 && ax <= 148, gutB = z >= -160 && z <= -157 && ax <= 148;
      if (gutS || gutB) { const along = gutS ? z : x; return ((along + 400) % 40) < 6 && ((along + 400) % 2 === 0) ? [IRON, 0] : [WATER, 1]; }
      if (ax >= 135 || z <= -147) {   // the border band: long slabs
        if (ax === 135 && z > -147) return [GROUT, 1];
        if (z === -147 && ax < 135) return [GROUT, 1];
        const along = ax >= 135 && z > -147 ? z : x;
        return ((along + 400) % 20) === 19 ? [GROUT, 1] : [BAND[Math.floor((along + 400) / 20) % 2], 0];
      }
      if (ax <= 21) {   // the runner
        if (ax >= 20) return [RUNB, 0];
        const row = Math.floor((z + 140) / 14), lz = (z + 140) - row * 14;
        if (lz === 13 || ax === 7) return [GROUT, 1];
        if (ax < 7 && row % 2 === 0 && ax <= 5 && lz >= 1 && lz <= 11) return [ax === 5 || lz === 1 || lz === 11 ? MEDD : MED, 0];
        return [RUN[(row + (x > 7 ? 1 : 0)) % 2], 0];
      }
      return K.flag(x, z, 15, 15, FIELD, GROUT, 3);
    });
    c.water(-10.36, -11.2, -10.15, 8, WATER); c.water(10.15, -11.2, 10.36, 8, WATER); c.water(-10.36, -11.2, 10.36, -10.98, WATER);

    // ---------------------------------------------------------------- back wall: pilastered bays, a grid of burial niches, the ossuary arch
    const back = K.face(w, 's', -11.4);
    K.dWall(back, -158, 158, 64, S, { pil: [-128, -86, 86, 128] });
    // niches: three rows in each bay, a skull in each; the middle row's eyes burn
    const bays: Array<[number, number, number]> = [[37, 80, 3], [92, 122, 2], [134, 148, 1]];
    for (const sg of [-1, 1]) for (const [a, b, n] of bays) for (let i = 0; i < n; i++) {
      const uc = sg * Math.round(a + ((b - a + 1) / n) * (i + 0.5));
      [11, 25, 39].forEach((v0, r) => {
        K.niche(back, uc, v0, 4, 7, 4, S, { steps: 1, rise: 2, ins: 2 });
        if (r === 0) { K.boneRod(w, uc - 3, v0, back.plane - 2, 7, true, K.BONE_D); K.skullF(back, uc, v0 + 1, 1, K.BONE, 0x1a1418); }
        else K.skullF(back, uc, v0, 1, K.BONE, r === 1 ? EYE : 0x1a1418, r === 1 ? 1 : 0);
      });
    }
    // soul sconces on the bay pilasters
    for (const u of [-128, -86, 86, 128]) K.sconce(back, u, 33, IRON, SOUL);
    // the arch: big flanking pilasters to the pediment, a raised wall above, the stepped arch with a voussoir band and a skull keystone
    K.dWall(back, -38, 38, 70, S, { pil: [] });
    for (const sg of [-1, 1]) {
      const u0 = sg * 25, u1 = sg * 37, a = Math.min(u0, u1), b = Math.max(u0, u1);
      back.box(a, -2, -3, b, 70, -1, S.pil).box(a - 1, -2, -4, b + 1, 7, -1, S.base).box(a - 1, 8, -4, b + 1, 8, -1, S.baseTop).box(a - 1, 66, -4, b + 1, 69, -1, S.trim).box(a - 2, 70, -4, b + 2, 74, -1, S.trimL);
      for (let v = 14; v < 64; v += 12) back.box(a, v, -3, b, v, -3, S.mortar);
    }
    const arch = K.niche(back, 0, 6, 22, 30, 24, S, { steps: 3, rise: 4, ins: 5, frame: S.trimL, fw: 3, sill: null, inner: 0x24222e, back: 0x1c1a24 });
    back.box(-22, 6, -1, -20, 35, -1, S.trimL).box(20, 6, -1, 22, 35, -1, S.trimL);
    back.box(-6, arch.top + 1, -3, 6, arch.top + 10, -1, S.trimL);
    // the big skull on the keystone: eyes of soul fire
    const KS = arch.top + 2;
    back.box(-4, KS + 2, -5, 4, KS + 7, -4, K.BONE).box(-2, KS, -5, 2, KS + 1, -4, K.BONE).box(-3, KS + 4, -5, -2, KS + 5, -5, EYE, 1).box(2, KS + 4, -5, 3, KS + 5, -5, EYE, 1).box(0, KS + 2, -5, 0, KS + 3, -5, 0x2a2420);
    // crown on the raised wall
    back.box(-18, 71, -1, 18, 73, 5, S.a).box(-19, 74, -2, 19, 74, 5, S.trimL);
    // stairs up to the arch
    back.box(-30, 0, -21, 30, 1, -1, S.pil).box(-30, 1, -21, 30, 1, -21, S.trimL);
    back.box(-27, 2, -14, 27, 3, -1, S.pil).box(-27, 3, -14, 27, 3, -14, S.trimL);
    back.box(-24, 4, -7, 24, 5, -1, S.pil).box(-24, 5, -7, 24, 5, -7, S.trimL);
    // inside: an ossuary wall of skulls in rows between courses of long bones, an altar with an urn of soul fire
    back.box(-22, 6, 22, 22, 50, 23, K.BONE_S);
    const row = (a: number, cc: number, v: number) => { const n = Math.floor((cc - a - 4) / 6) + 1, u0 = Math.round((a + cc) / 2 - (n - 1) * 3); for (let i = 0; i < n; i++) K.skullF(back, u0 + i * 6, v, 20, K.BONE, 0x1a1418); };
    for (let v = 7; v <= 31; v += 6) { row(-22, 22, v); back.box(-22, v + 4, 21, 22, v + 4, 21, K.BONE_D); }
    for (const [a, b, cc] of arch.rects.slice(1)) row(a, cc, b);
    back.box(-8, 6, 9, 8, 12, 17, S.pil).box(-9, 13, 8, 9, 13, 18, S.trimL);
    back.box(-3, 14, 11, 3, 15, 15, S.trim).box(-4, 16, 10, 4, 19, 16, S.pil).box(-3, 20, 11, 3, 20, 15, S.trim).box(-3, 21, 11, 3, 22, 15, SOUL, 1).box(-1, 23, 12, 1, 25, 14, SOUL, 1);
    lightAt(c, back.pos(0, 20, 4), 0x4affb8, 5, 8);
    c.flame(back.pos(0, 25, 13), SOUL, 0.16);
    // soul braziers at the foot of the stairs
    for (const sx of [-2.75, 2.75]) { const p = K.soulBrazier(w, sx, -9.2, S.base, IRON, SOUL); if (sx < 0) c.flame(p, SOUL, 0.14); }

    // ---------------------------------------------------------------- side walls: tall at the back, stepping down toward the camera
    for (const sg of [-1, 1]) {
      const f = K.face(w, sg < 0 ? 'e' : 'w', sg * 10.6);
      K.dWall(f, M(0.5), M(5.5), 14, S, { pil: [M(4.2)] }); stub(f, M(5.5) + 1, 116, S);
      K.dWall(f, M(-4.2), M(0.5), 34, S, { pil: [M(-4.2), M(-1.9), M(0.5)] });
      K.dWall(f, -160, M(-4.2), 50, S, { pil: [M(-8.0), M(-4.2)] });
      for (const uc of [-150, -130]) [11, 25].forEach((v0, r) => { K.niche(f, uc, v0, 4, 7, 4, S); K.skullF(f, uc, v0, 1, K.BONE, r ? EYE : 0x1a1418, r); });
      for (const uc of [M(-3.1), M(-0.7)]) { K.niche(f, uc, 11, 4, 7, 4, S); K.skullF(f, uc, 11, 1, K.BONE, 0x1a1418); }
      if (sg < 0) {   // left: an iron gate into the dark, a torch beside it
        K.barGate(f, M(-6.1), 0, 10, 24, S, IRON, { steps: 2, ins: 4, rise: 3, depth: 10, band: 2, set: 2, pitch: 3, rail: 8 });
        const t = K.sconce(f, M(-6.1) - 17, 33, IRON, FIRE); c.flame(t, FIRE, 0.12); lightAt(c, t, 0xff9a50, 6, 7, -0.3);
      } else {        // right: the ossuary heap under two niches
        for (const uc of [M(-7.0), M(-5.2)]) { K.niche(f, uc, 25, 4, 7, 4, S); K.skullF(f, uc, 25, 1, K.BONE, EYE, 1); }
      }
    }
    // ---------------------------------------------------------------- columns along the nave
    for (const [x, z, br] of [[-6.0, -7.4, 0], [6.0, -7.4, 0], [-6.4, -1.0, 0], [6.4, -1.0, 34]] as const) K.column(w, x, z, 52, S, br ? { broken: br } : {});
    K.rubble(w, 7.6, -0.2, [S.pil, S.base, S.trim], 2, 0.9);

    // ---------------------------------------------------------------- groups
    const TOMB = { stone: 0x6a687e, panel: 0x56546a, lid: 0x7a7890, effigy: 0x8e8ca2, base: S.base, trim: S.trimL };
    // back left: a burial dais with two knights, candles at its corners, urns
    w.box(M(-10.3), -1, M(-11.0), M(-6.8), 1, M(-7.4), S.base).box(M(-10.3), 1, M(-11.0), M(-6.8), 1, M(-7.4), S.baseTop);
    K.effigyTomb(w, -9.35, -9.2, TOMB); K.effigyTomb(w, -7.75, -9.2, TOMB);
    K.candles(w, -10.0, -7.75, 2, 5, WAX); K.candles(w, -7.1, -7.75, 2, 4, WAX);
    lightAt(c, [-8.6, 1.5, -8.0], 0xffb060, 7, 7);
    // back right: a tomb broken open, its lid on the floor; a soul brazier; bones in the corner
    K.effigyTomb(w, 8.0, -9.4, TOMB, { open: true, side: 1 });
    K.bonePile(w, 9.6, -10.95, 's', 1.6, { eye: EYE, glow: 1 });
    { const p = K.soulBrazier(w, 6.7, -10.4, S.base, IRON, SOUL); lightAt(c, p, 0x4affb0, 6, 7, 0.3); c.flame(p, SOUL, 0.14); }
    // left: urns flanking the gate, a pile of bones
    K.urn(w, -10.0, -7.1, 0x6a5a4e, 0x8a7a64, 2); K.urn(w, -10.0, -4.6, 0x5e5046, 0x8a7a64);
    K.bonePile(w, -9.95, -2.6, 'e', 1.4);
    // right: the skull pyramid with a candelabrum and candles
    K.skullHeap(w, 10.05, -6.1, 'w', 3, { glow: 1, eye: EYE });
    { const p = K.candelabrum(w, 9.6, -8.0, 16, IRON, WAX, 0xffc060, false); lightAt(c, p, 0xffb060, 6, 7, -0.4); }
    K.candles(w, 9.4, -4.2, 0, 5, WAX);
    // front sides: a fallen column on the left, an urn group and candles on the right (low)
    K.effigyTomb(w, -8.7, 3.0, TOMB); K.candles(w, -7.4, 4.4, 0, 4, WAX); K.urn(w, -9.9, 4.9, 0x5e5046, 0x8a7a64);
    K.urn(w, 9.6, 2.4, 0x6a5a4e, 0x8a7a64, 2); K.urn(w, 9.0, 3.2, 0x5e5046, 0x8a7a64); K.candles(w, 8.6, 2.0, 0, 4, WAX);
    // a few strands on the back wall pilasters only (the niches stay clear), webs in the corners
    for (const u of [-128, 86]) back.card(c, 'moss', u, 4.5, -2, 0.55, 0xd0d8c0);
    dress(c, 'dungeon', { seed: 6, hang: [[-11.4, -10.8, -11.4, 0.4, 'e'], [11.4, -10.8, 11.4, 0.4, 'w']], webs: [[-10.3, 4.4, -11.2, 0.785], [10.3, 4.4, -11.2, -0.785], [-10.3, 3.3, -4.4, 1.2], [10.3, 3.3, -4.4, -1.2], [-2.9, 5.0, -11.3, 0]], clear: [{ x0: -3.2, z0: -12, x1: 3.2, z1: -9 }] });
  },
};

// ======================================================================================== 地牢囚室 · dungeon cells
export const cells: SceneDef = {
  id: 'n_cells', name: '地牢囚室', group: '普通', kind: '地牢', blurb: '锁链还在晃，牢门却都开着。', mood: K.JAIL, foes: ['forest_bone_reaver', 'forest_banshee'],
  build(c) {
    const w = c.w;
    const S: K.Stone = { a: 0x6a6670, b: 0x716d78, mortar: 0x4e4a54, base: 0x4a4650, baseTop: 0x7a7682, trim: 0x7e7a88, trimL: 0x8e8a98, pil: 0x75717e, dark: 0x16141a };
    const FIELD = [0x5c5860, 0x615d66, 0x58545c], DIRTY = [0x4e4a4c, 0x544e4c], GROUT = 0x24222a, BAND = [0x6a6670, 0x6e6a74], WATER = 0x1c2428;
    const ZF = M(-8.75);   // the cell fronts
    // ---------------------------------------------------------------- floor: cells, a gutter along their fronts and the side walls, a border, flags, a drain grate in the middle
    K.floorPaint(w, AREA, (x, z) => {
      const ax = Math.abs(x);
      if (z <= -161 || ax >= 149) return [S.base, 0];
      if (z < ZF - 1) return K.flag(x, z, 10, 10, DIRTY, GROUT, 5);
      if (z <= ZF + 1) return [S.trimL, 0];
      const gutF = z >= ZF + 3 && z <= ZF + 5 && ax <= 148, gutS = ax >= 145 && ax <= 148 && z > ZF + 5;
      if (gutF || gutS) { const along = gutF ? x : z; return ((along + 400) % 36) < 6 && ((along + 400) % 2 === 0) ? [IRON, 0] : [WATER, 1]; }
      if (z <= ZF + 15 || ax >= 135) {
        if ((z === ZF + 15 && ax < 135) || (ax === 135 && z > ZF + 15)) return [GROUT, 1];
        const along = ax >= 135 && z > ZF + 15 ? z : x;
        return ((along + 400) % 20) === 19 ? [GROUT, 1] : [BAND[Math.floor((along + 400) / 20) % 2], 0];
      }
      const gx = x - 4, gz = z;   // the drain in the middle of the floor
      if (Math.abs(gx) <= 9 && Math.abs(gz) <= 9) { if (Math.abs(gx) >= 8 || Math.abs(gz) >= 8) return [S.base, 0]; return (gz & 1) === 0 ? [0x4a4854, 0] : [0x2a2830, 1]; }
      return K.flag(x, z, 15, 15, FIELD, GROUT, 7);
    });
    c.water(-10.4, (ZF + 3) * CELL, 10.4, (ZF + 6) * CELL, WATER);

    // ---------------------------------------------------------------- back wall and the gatehouse
    const back = K.face(w, 's', -11.4);
    K.dWall(back, -158, 158, 60, S, { pil: [] });
    for (const sg of [-1, 1]) {   // towers flanking the gate, crenellated
      const a = sg < 0 ? -52 : 33, b = sg < 0 ? -33 : 52, tf = new K.Face(w, 's', back.plane + 8);
      K.dWall(tf, a, b, 70, S, { t: 9, pil: [] });
      for (const m of [a, a + 8, b - 4]) tf.box(m, 71, -1, m + 4, 75, 7, S.a).box(m, 75, -1, m + 4, 75, 7, S.trimL);
      tf.box(a - 1, -2, -2, a, 70, 8, S.pil).box(b, -2, -2, b + 1, 70, 8, S.pil);
      const t = K.sconce(tf, sg * 42, 38, IRON, FIRE); c.flame(t, FIRE, 0.13);
    }
    lightAt(c, back.pos(0, 36, -12), 0xff9a50, 8, 9);
    const top = K.barGate(back, 0, 1, 16, 28, S, IRON, { steps: 2, ins: 5, rise: 4, depth: 16, set: 3, pitch: 4, band: 3, spikes: true, rail: 6 });
    back.box(-17, 0, -2, 17, 0, -1, S.trimL);
    // the jailer's crest over the gate: a shield with a key
    back.box(-6, top + 6, -2, 6, top + 16, -1, S.trimL).box(-5, top + 7, -3, 5, top + 15, -3, 0x5a2a2a).box(-3, top + 4, -2, 3, top + 5, -1, S.trimL).box(-2, top + 3, -3, 2, top + 6, -3, 0x5a2a2a);
    back.box(0, top + 8, -4, 0, top + 13, -4, 0xc8a040).box(-1, top + 13, -4, 1, top + 15, -4, 0xc8a040).box(0, top + 14, -4, 0, top + 14, -4, 0x5a2a2a).box(1, top + 8, -4, 2, top + 9, -4, 0xc8a040);
    // cells: partitions with piers at the front, barred fronts with open doors
    const part = (X: number, z0: number) => {
      w.box(X - 3, -2, z0, X + 2, 38, ZF - 2, S.a);
      for (const f of [new K.Face(w, 'e', X + 2), new K.Face(w, 'w', X - 3)]) K.dWall(f, z0 + 2, ZF - 3, 38, S, { t: 1, top: false });
      w.box(X - 4, 39, z0, X + 3, 40, ZF - 2, S.trimL);
      w.box(X - 4, -1, ZF - 2, X + 3, 42, ZF + 2, S.pil).box(X - 5, -1, ZF - 3, X + 4, 6, ZF + 3, S.base).box(X - 5, 40, ZF - 3, X + 4, 43, ZF + 3, S.trimL);
    };
    for (const sg of [-1, 1]) {
      part(sg * 56, -153); part(sg * 102, -162);
      const xs: Array<[number, number]> = sg < 0 ? [[-10.45, -7.45], [-6.85, -4.05]] : [[4.05, 6.85], [7.45, 10.45]];
      K.cellFront(w, xs[0][0], xs[0][1], -8.75, 34, IRON, S.a, S.trimL, sg < 0 ? { x0: -8.6, x1: -7.7 } : { x0: 4.3, x1: 5.2, hinge: 'l' });
      K.cellFront(w, xs[1][0], xs[1][1], -8.75, 34, IRON, S.a, S.trimL, sg < 0 ? { x0: -6.2, x1: -5.3, torn: true } : { x0: 9.4, x1: 10.3 });
    }
    // cell L1: a skeleton shackled under two chains, straw, a bucket, a stub of candle
    K.wallChain(back, M(-10.0), 46, 16, IRON); K.wallChain(back, M(-8.8), 46, 16, IRON);
    K.skeletonSit(w, -9.4, -11.05, 's');
    K.straw(w, -8.0, -10.3, 6, 7); K.bucket(w, -10.0, -9.4, WOOD, IRON);
    K.candles(w, -7.8, -9.3, 0, 2);
    lightAt(c, [-8.6, 0.9, -9.9], 0xffb060, 3.5, 5);
    // cell L2: a plank bed with straw on it, a sagging chain, a bowl
    K.bench(w, -6.3, -10.0, 1.8, 10, 6, WOOD, WOOD_D); K.straw(w, -6.3, -10.0, 3, 9);
    K.chainSag(back, M(-5.4), M(-4.4), 40, 6, IRON);
    w.box(M(-4.6) - 1, 0, M(-9.4) - 1, M(-4.6) + 1, 1, M(-9.4) + 1, 0x6a5a4a);
    // cell R1: a barred window letting in cold light, straw, a tipped bucket, a broken chain
    { const win = K.niche(back, M(5.4), 44, 6, 8, 8, S, { steps: 1, ins: 3, rise: 2, back: 0x6a7ab0, inner: 0x2a2a3a }); for (let u = M(5.4) - 4; u <= M(5.4) + 4; u += 3) back.box(u, 44, 2, u, win.top, 2, IRON); }
    lightAt(c, [5.4, 2.6, -10.5], 0x8ab0ff, 6, 6);
    c.shaft(5.4, -9.8, { w: 1.1, h: 6, tilt: 0.12, yaw: 0, color: 0x9ab8ff, a: 0.2 });
    K.straw(w, 6.1, -10.4, 6, 5); K.bucket(w, 4.6, -9.6, WOOD, IRON, 0x3a5a7a, true);
    K.wallChain(back, M(4.6), 46, 8, IRON, { shackle: false });
    // cell R2: the back wall broken through, rubble spilling in
    back.box(M(8.8) - 9, 0, 0, M(8.8) + 9, 16, 6, null).box(M(8.8) - 6, 17, 0, M(8.8) + 6, 22, 6, null).box(M(8.8) - 9, 0, 7, M(8.8) + 9, 22, 7, 0x0a090c);
    K.rubble(w, 8.6, -10.5, [S.a, S.pil, S.base], 3, 0.8);
    K.wallChain(back, M(10.0), 46, 14, IRON);
    // ---------------------------------------------------------------- side walls
    const left = K.face(w, 'e', -10.6), right = K.face(w, 'w', 10.6);
    for (const f of [left, right]) {
      K.dWall(f, M(0.6), M(5.5), 14, S, { pil: [M(4.2)] }); stub(f, M(5.5) + 1, 116, S);
      K.dWall(f, M(-4.2), M(0.6), 32, S, { pil: [M(-4.2), M(-1.6), M(0.6)] });
      K.dWall(f, -160, M(-4.2), 48, S, { pil: [M(-4.2)] });
    }
    // left: the guard post — a rug, the desk with keys and a lamp, a stool, the weapon rack, a notice board, a torch, barrels
    K.floorPaint(w, { x0: -9.6, z0: -4.4, x1: -6.4, z1: -0.7 }, (x, z) => { const e = Math.min(x - M(-9.6), M(-6.4) - 1 - x, z - M(-4.4), M(-0.7) - 1 - z); return [e < 2 ? 0x3a2624 : e === 3 || e === 4 ? 0x7e6440 : 0x5a3430, 0]; });
    const lamp = K.guardDesk(w, -7.6, -2.6, WOOD, WOOD_D, WOOD_L); lightAt(c, lamp, 0xffb060, 3.2, 6, 0.9);
    K.stool(w, -8.7, -2.2, WOOD, WOOD_D);
    K.weaponRack(w, -10.1, -4.6, 1.6, WOOD, WOOD_D);
    left.box(M(-1.4) - 8, 12, -1, M(-1.4) + 8, 24, -1, WOOD_D).box(M(-1.4) - 7, 13, -2, M(-1.4) - 2, 19, -2, 0xd8d0b8).box(M(-1.4), 15, -2, M(-1.4) + 6, 22, -2, 0xc8c0a4).box(M(-1.4) + 1, 20, -2, M(-1.4) + 5, 20, -2, 0x6a5a4a);
    { const t = K.sconce(left, M(-6.4), 34, IRON, FIRE); c.flame(t, FIRE, 0.12); }
    barrel(w, -9.9, 0.9, WOOD, IRON); barrel(w, -9.2, 1.7, WOOD_D, IRON); crate(w, -8.7, 0.6, 4, WOOD_L, WOOD_D);
    // right: a gibbet cage, a water trough, a torch, crates
    K.gibbet(w, 9.9, -3.0, 8.2, WOOD, WOOD_D, IRON);
    { const t = K.sconce(right, M(-5.6), 34, IRON, FIRE); c.flame(t, FIRE, 0.12); lightAt(c, t, 0xff9a50, 6, 7, -0.4); }
    { const X0 = M(9.4), X1 = M(10.3), Z0 = M(-0.6), Z1 = M(1.6); w.box(X0, 0, Z0, X1, 6, Z1, WOOD_D).box(X0 + 1, 6, Z0 + 1, X1 - 1, 6, Z1 - 1, 0x3a5a7a).box(X0, 2, Z0, X1, 2, Z1, IRON); }
    K.bucket(w, 8.8, 0.9, WOOD, IRON); crate(w, 9.6, 2.8, 5, WOOD, WOOD_D); crate(w, 8.7, 3.4, 3, WOOD_L, WOOD_D);
    // front: low things only
    { const X = M(6.4), Z = M(6.2); for (let i = 0; i < 9; i++) w.set(X + i, 0, Z + (i % 4 === 2 ? 1 : 0), IRON); }
    dress(c, 'dungeon', { seed: 7, hang: [[-11.4, -8.0, -11.4, 0.6, 'e'], [11.4, -8.0, 11.4, 0.6, 'w']], webs: [[-10.3, 4.1, -11.2, 0.785], [10.3, 4.1, -11.2, -0.785], [-3.5, 2.8, -11.2, 0], [-10.3, 3.2, -4.6, 1.3]] });
  },
};

// ======================================================================================== 蛛网洞穴 · spider cave
const ROCK_S: K.Rock = { cols: [0x56545e, 0x4c4a55, 0x605d6a], top: 0x66665a, tip: 0x7a7884 };
export const spiderCave: SceneDef = {
  id: 'n_spider', name: '蛛网洞穴', group: '普通', kind: '洞穴', blurb: '网上挂着的，不全是猎物。', mood: K.WEBCAVE, foes: ['forest_spider', 'forest_spider'],
  build(c) {
    const w = c.w, GREEN = 0x6aff2a;
    patches(w, AREA, [0x48464e, 0x403e46, 0x4e4c54], { seed: 4 });
    // ---------------------------------------------------------------- walls: a cave mouth at the back centre, curtained by the great web
    const back = K.face(w, 's', -10.2), left = K.face(w, 'e', -9.2), right = K.face(w, 'w', 9.2);
    K.caveRun(c, back, M(-11.8), M(11.8), 34, () => 66, ROCK_S, { seed: 3, hang: ['moss', 'vine'], tint: [0xd8e0d0, 0xc8d0c0], carve: (u, d) => (Math.abs(u) <= 42 && d < 30 ? -1 : null) });
    const side = (u: number) => (u * CELL < -4 ? 54 : u * CELL < 1.5 ? 36 : 18);
    K.caveRun(c, left, M(-12.6), M(8), 28, side, ROCK_S, { seed: 5, openEnd: true, carve: lowFront, hang: ['moss', 'vine'], tint: [0xd8e0d0] });
    K.caveRun(c, right, M(-12.6), M(8), 28, side, ROCK_S, { seed: 11, openEnd: true, carve: lowFront, hang: ['moss', 'vine'], tint: [0xd8e0d0] });
    // the mouth: a rock lintel with stepped shoulders, darkness behind, stalactites from the lintel
    back.box(-44, 55, -1, 44, 66, 12, ROCK_S.cols[0]).box(-44, 66, -1, 44, 66, 12, ROCK_S.top).box(-44, 48, -1, -30, 54, 12, ROCK_S.cols[1]).box(30, 48, -1, 44, 54, 12, ROCK_S.cols[1]);
    for (let y = 56; y <= 65; y += 3) back.box(-44, y, -1, 44, y, -1, ROCK_S.cols[2]);
    back.box(-42, 0, 30, 42, 54, 30, 0x121016);
    for (const [u, len, wd] of [[-36, 9, 3], [-24, 14, 5], [-12, 8, 3], [8, 11, 5], [20, 7, 3], [34, 10, 3]] as const) { const p = back.pos(u, 0, 4); K.stalactite(w, Math.floor(p[0] / CELL), u < -29 || u > 29 ? 47 : 54, Math.floor(p[2] / CELL), len, wd, ROCK_S.cols[1], ROCK_S.tip); }
    for (const sx of [-1, 1]) K.stalagmite(w, sx * 3.45, -9.5, 34, 7, ROCK_S);
    // the great web across the mouth, a thick top cable, cocoons hanging in it
    c.cards.add('bigweb', 0, back.front(0) + 0.12, { y: 3.85, ry: 0, s: 1.25 });
    { const Z = M(-10.0); w.box(-42, 54, Z, 42, 54, Z, K.SILK).box(-42, 53, Z, -38, 53, Z, K.SILK).box(38, 53, Z, 42, 53, Z, K.SILK); }
    K.cocoon(w, M(-1.7), 24, M(-9.7), 16, { thread: 53, peek: 'boot' });
    K.cocoon(w, M(1.9), 30, M(-9.7), 13, { thread: 53, peek: 'helm' });
    K.cocoon(w, M(0.2), 38, M(-9.8), 9, { thread: 53 });
    // the egg nest in the mouth
    K.eggNest(w, 0, -9.7, 2.5, 1.1, GREEN, 2);
    lightAt(c, [0, 1.4, -8.2], 0x8aff4a, 5, 8);
    // ---------------------------------------------------------------- left back: what is left of the last party — shield, helmet, sword, a lantern still lit
    K.rubble(w, -7.8, -8.9, ROCK_S.cols, 1, 1.0);
    K.shieldUpright(w, -7.5, -8.0, 0x3a4a7a, 0xc8a040);
    K.helmet(w, -6.3, -7.0); K.swordInGround(w, -5.75, -8.4);
    { const p = K.lantern(w, -6.9, -6.9); lightAt(c, p, 0xffa050, 4.5, 5, 0.3); }
    K.cocoon(w, M(-8.3), 0, M(-6.8), 14, { lying: true, peek: 'hand' });
    w.box(M(-7.0) - 3, 0, M(-7.6) - 2, M(-7.0) + 2, 1, M(-7.6) + 2, 0x5a3a26);   // a pack
    // right back: a second nest, cocoons stood against the wall
    K.eggNest(w, 7.3, -8.2, 1.5, 1.0, GREEN, 5);
    lightAt(c, [7.0, 1.2, -6.8], 0x8aff4a, 3.5, 6);
    K.cocoon(w, M(8.4), 0, M(-9.6), 15, {}); K.cocoon(w, M(5.8), 0, M(-9.4), 12, { peek: 'helm' });
    // ---------------------------------------------------------------- left side: a rock terrace with a spire, webs between spire and wall
    K.terrace(w, [{ x0: -9.4, z0: -5.0, x1: -6.0, z1: 1.8 }, { x0: -9.4, z0: -1.4, x1: -5.6, z1: 0.8 }], 6, ROCK_S.top, ROCK_S.cols[1], { rim: 3, topAlt: 0x4a5a40, seed: 3 });
    K.tufts(c, { x0: -9.2, z0: -4.8, x1: -6.2, z1: 1.6 }, 6 * CELL, ['weeds', 'shroom', 'weeds'], 7, [0x9a9488, 0xc8ff9a, 0x8a8478], 4);
    K.stalagmite(w, -7.9, -3.4, 30, 7, ROCK_S); K.stalagmite(w, -6.9, -2.6, 14, 5, ROCK_S);
    K.rubble(w, -6.6, 2.7, ROCK_S.cols, 4, 0.7);
    K.cocoon(w, M(-7.0), 6, M(-1.2), 12, { lying: true, peek: 'boot' });
    // right side: a terrace with spires and a cocoon, bones
    K.terrace(w, [{ x0: 6.0, z0: -4.6, x1: 9.4, z1: 1.6 }], 4, ROCK_S.top, ROCK_S.cols[1], { rim: 3, topAlt: 0x4a5a40, seed: 5 });
    K.tufts(c, { x0: 6.2, z0: -4.4, x1: 9.2, z1: 1.4 }, 4 * CELL, ['weeds', 'shroom'], 6, [0x9a9488, 0xc8ff9a], 6);
    K.stalagmite(w, 8.3, -2.4, 26, 7, ROCK_S); K.stalagmite(w, 7.0, 0.6, 12, 5, ROCK_S);
    K.cocoon(w, M(7.6), 4, M(-0.9), 13, { lying: true });
    K.skullAt(w, M(6.6), 4, M(-3.6), 's', K.BONE);
    // floor moss and small eggs on the fringes
    K.mossPatch(w, -7.6, 3.8, 1.0, 0.7, 0x3e5a3a); K.mossPatch(w, 7.8, 4.2, 0.9, 0.6, 0x3e5a3a);
    K.egg(w, M(-6.6), 0, M(4.6), GREEN); K.egg(w, M(-6.0), 0, M(4.2), GREEN); K.egg(w, M(6.8), 0, M(4.8), GREEN);
    K.rubble(w, 6.4, 6.6, ROCK_S.cols, 2, 0.4);
    lightAt(c, [0, 4.6, -6.0], 0x8aa0d8, 6, 13);
    c.shaft(0.2, -8.6, { w: 1.8, h: 7, tilt: 0.1, yaw: 0, color: 0x9ab8d8, a: 0.16 });
    dress(c, 'spider', { seed: 8, hang: [], webs: [[-8.6, 2.6, -2.8, 1.4], [8.7, 2.4, -1.6, -1.4], [-8.6, 3.8, -9.4, 0.785], [8.6, 3.8, -9.6, -0.785], [-6.3, 2.0, -9.6, 0.4], [8.6, 1.6, 2.6, -1.2]], clear: [{ x0: -3.6, z0: -12, x1: 3.6, z1: -8.2 }] });
  },
};

// ======================================================================================== 荧菇洞窟 · mushroom grotto
const ROCK_G: K.Rock = { cols: [0x404854, 0x39414b, 0x48525e], top: 0x3e6a56, tip: 0x5a8090, tipGlow: 0x1a6a7a };
export const grotto: SceneDef = {
  id: 'n_grotto', name: '荧菇洞窟', group: '普通', kind: '洞穴', blurb: '地下的水潭映着成片的荧光菇。', mood: K.GLOWCAVE, foes: ['forest_poison_sprite', 'forest_moss_golem'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x3c444c, 0x36423e, 0x424c52], { seed: 6 });
    const back = K.face(w, 's', -10.7), left = K.face(w, 'e', -9.3), right = K.face(w, 'w', 9.3);
    K.caveRun(c, back, M(-11.8), M(11.8), 32, () => 64, ROCK_G, { seed: 7, hang: ['moss', 'vine'], tint: [0xb8e0d0, 0xa8d8c8] });
    const side = (u: number) => (u * CELL < -4 ? 54 : u * CELL < 1.5 ? 36 : 18);
    K.caveRun(c, left, M(-12.6), M(8), 26, side, ROCK_G, { seed: 9, openEnd: true, carve: lowFront, hang: ['moss', 'vine'], tint: [0xb8e0d0] });
    K.caveRun(c, right, M(-12.6), M(8), 26, side, ROCK_G, { seed: 13, openEnd: true, carve: lowFront, hang: ['moss', 'vine'], tint: [0xb8e0d0] });
    // ---------------------------------------------------------------- the pool and the giant mushrooms over it
    K.pool(c, { x0: -3.2, z0: -9.9, x1: 4.0, z1: -7.4 }, { stone: 0x56626e, stoneL: 0x74828e, bed: 0x06262e, water: 0x2a8ab0, moss: 0x3e6a56 });
    lightAt(c, [0.4, 0.9, -8.0], 0x4ae8ff, 5.5, 8);
    c.shaft(0.4, -8.7, { w: 2.4, h: 7, tilt: 0.1, yaw: 0, color: 0x8ad8ff, a: 0.18 });
    const VIO = { stem: 0xd8d0e0, stemD: 0xa898b8, cap: 0x7a4ab8, capD: 0x5e3a92, gill: 0x5a2a8a, spot: 0x9a6ad0 };
    const CYA = { stem: 0xd0dce0, stemD: 0x98aab0, cap: 0x2a7a92, capD: 0x1e5a70, gill: 0x147080, spot: 0x3ac0d0 };
    K.bigShroom(w, -5.5, -9.0, 44, 20, VIO); c.light([-4.6, 2.0, -7.2], 0xb070ff, 6, 8);
    K.bigShroom(w, 6.5, -8.7, 32, 15, CYA); c.light([5.8, 1.5, -7.0], 0x4ae8ff, 4.5, 7);
    K.bigShroom(w, -8.5, -5.6, 18, 9, VIO); K.bigShroom(w, 8.7, -5.0, 14, 7, CYA); K.bigShroom(w, -4.4, -10.4, 12, 6, CYA); K.bigShroom(w, 4.9, -10.2, 16, 7, VIO);
    // ---------------------------------------------------------------- crystals and mossy terraces on the sides
    const VC = [0x6a3aa0, 0xa070e0], CC = [0x1a7a8a, 0x5ad0e0];
    K.crystals(w, 9.0, -9.6, 26, VC[0], VC[1], ROCK_G.cols[1], 1);
    K.terrace(w, [{ x0: 5.9, z0: -3.8, x1: 9.6, z1: 2.4 }], 5, ROCK_G.top, ROCK_G.cols[1], { rim: 3, topAlt: 0x4a7a5a, seed: 4 });
    K.tufts(c, { x0: 6.1, z0: -3.6, x1: 9.4, z1: 2.2 }, 5 * CELL, ['fern', 'shroom', 'grass'], 8, [0xa8c8b8, 0xe0c8ff, 0xb8d8c8], 7, [0.6, 1.0]);
    K.crystals(w, 8.4, -1.8, 20, VC[0], VC[1], ROCK_G.cols[1], 2, 5); K.crystals(w, 7.2, 1.0, 9, CC[0], CC[1], ROCK_G.cols[1], 3, 5);
    lightAt(c, [8.0, 1.4, -1.4], 0xa070ff, 5, 6);
    K.terrace(w, [{ x0: -9.6, z0: -4.2, x1: -5.9, z1: 2.8 }], 4, ROCK_G.top, ROCK_G.cols[1], { rim: 3, topAlt: 0x4a7a5a, seed: 8 });
    K.tufts(c, { x0: -9.4, z0: -4.0, x1: -6.1, z1: 2.6 }, 4 * CELL, ['fern', 'shroom', 'grass'], 8, [0xa8c8b8, 0xffffff, 0xb8d8c8], 9, [0.6, 1.0]);
    K.crystals(w, -8.6, -2.8, 16, CC[0], CC[1], ROCK_G.cols[1], 4, 4);
    K.bigShroom(w, -7.4, 1.4, 12, 6, CYA);
    lightAt(c, [-7.6, 1.0, -1.0], 0x4ae8ff, 4, 6);
    for (const [x, z, s, col] of [[-5.9, 3.6, 2, 0xb060ff], [-8.8, 3.8, 2, 0x4ae8ff], [5.8, -4.6, 2, 0x4ae8ff], [9.0, 3.2, 2, 0xb060ff], [-6.2, 4.6, 2, 0x4ae8ff], [6.4, 5.0, 2, 0xb060ff]] as const) mushroom(w, x, z, s, 0xd8d0e0, col, 1);
    K.crystals(w, -6.8, 5.2, 6, CC[0], CC[1], ROCK_G.cols[1], 5);
    K.mossPatch(w, -4.0, 6.6, 1.0, 0.5, 0x3e6a56, 0x08262c); K.mossPatch(w, 6.6, 6.4, 1.0, 0.5, 0x3e6a56, 0x180e2e);
    K.rubble(w, -6.4, -7.6, ROCK_G.cols, 2, 0.7); K.rubble(w, 4.8, 5.8, ROCK_G.cols, 3, 0.45);
    dress(c, 'cave', { seed: 9, hang: [], clear: [{ x0: -3.6, z0: -10.4, x1: 4.4, z1: -7 }] });
  },
};

// ======================================================================================== 根须巨像 · 古根深洞 (boss)
const ROCK_R: K.Rock = { cols: [0x56504e, 0x4c4644, 0x605856], top: 0x56603a, tip: 0x6a5e58 };
export const rootDeep: SceneDef = {
  id: 'b_colossus', name: '根须巨像 · 古根深洞', group: '首领', kind: '洞穴', blurb: '整片森林的根都扎到了这里，泥土在呼吸。', mood: K.ROOTDEEP, foes: ['boss_root_colossus'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x463a30, 0x4e4034, 0x3c3028], { seed: 3 });
    const B: K.Bark = { bark: 0x6e5038, dark: 0x4a3422, groove: 0x3a281a, sap: 0x86500e };
    const back = K.face(w, 's', -10.8), left = K.face(w, 'e', -9.3), right = K.face(w, 'w', 9.3);
    K.caveRun(c, back, M(-11.8), M(11.8), 32, () => 68, ROCK_R, { seed: 4, hang: ['vine', 'vine', 'moss'], tint: [0xe0c890, 0xd0b880], carve: (u, d) => (Math.abs(u) <= 52 && d < 30 ? -1 : null) });
    const side = (u: number) => (u * CELL < -4 ? 56 : u * CELL < 1.5 ? 38 : 18);
    K.caveRun(c, left, M(-12.6), M(8), 26, side, ROCK_R, { seed: 6, openEnd: true, carve: lowFront, hang: ['vine', 'moss'], tint: [0xe0c890] });
    K.caveRun(c, right, M(-12.6), M(8), 26, side, ROCK_R, { seed: 10, openEnd: true, carve: lowFront, hang: ['vine', 'moss'], tint: [0xe0c890] });
    back.box(-52, 0, 30, 52, 60, 30, 0x0e0a08);
    // ---------------------------------------------------------------- the root arch: two great roots come out of the wall top, bend down in
    // wide jogs and flare into the floor; two more cross over the mouth at different heights and knot in the middle, weeping sap
    const MO = 0x4e5a30, rs = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v?: [number, number]) => K.rootSeg(w, x0, y0, z0, x1, y1, z1, B, { vein: v, moss: MO });
    // left: out of the wall, over, down in three jogged lengths, a flare and toes; a thinner root braided beside it
    rs(-90, 40, -166, -74, 52, -150); rs(-84, 40, -153, -56, 51, -142);
    rs(-67, 22, -151, -54, 39, -141, [4, 14]); rs(-64, 7, -149, -50, 22, -138, [3, 10]);
    rs(-70, -2, -153, -46, 6, -134); rs(-66, 7, -151, -50, 10, -137);
    rs(-60, -2, -134, -53, 3, -112); rs(-94, -2, -149, -70, 4, -140);
    rs(-80, 20, -150, -73, 39, -144); rs(-84, -2, -151, -77, 20, -145); rs(-96, -2, -150, -84, 3, -144);
    // right: the same story, a little lower and thinner
    rs(72, 36, -166, 88, 48, -150); rs(54, 36, -153, 86, 46, -142);
    rs(52, 18, -151, 63, 35, -141, [6, 15]); rs(48, 5, -148, 60, 18, -137);
    rs(44, -2, -152, 66, 5, -135); rs(47, 6, -150, 63, 8, -137);
    rs(50, -2, -135, 57, 2, -114); rs(66, -2, -149, 96, 3, -141);
    rs(70, 16, -150, 76, 35, -145); rs(73, -2, -151, 79, 16, -146);
    // over the mouth: one root from the left, high and behind; one from the right, lower and in front; a knot where they cross
    rs(-58, 44, -150, 16, 52, -142, [20, 44]); rs(-20, 37, -146, 54, 44, -139, [30, 52]);
    rs(-9, 35, -153, 7, 55, -136);
    w.box(-3, 39, -135, 2, 50, -135, B.groove).box(-2, 40, -135, 1, 49, -135, B.sap, 1);
    K.rootSeg(w, -2, 33, -137, 1, 36, -132, B); w.box(-1, 24, -133, 0, 32, -133, B.sap, 1).box(-1, 16, -133, 0, 18, -133, B.sap, 1).box(-1, 8, -133, 0, 9, -133, B.sap, 1);
    for (const [x, len, z, top] of [[-44, 14, -147, 43], [-30, 9, -146, 43], [26, 10, -143, 36], [40, 16, -143, 36]] as const) K.rootTip(w, x, top, z, len, B, x < 0 ? 1 : -1);
    c.light([0, 2.2, -12.0], 0xffa040, 6, 7);
    // the sap pool in an old carved basin, its front rim broken where a root crawls over
    K.pool(c, { x0: -3.0, z0: -9.5, x1: 3.2, z1: -7.3 }, { stone: 0x5e5e6c, stoneL: 0x7a7a88, bed: 0x4a2806, water: 0xe89028 }, { broken: 0.62 });
    K.rootSeg(w, 15, -1, -106, 24, 2, -95, B); K.rootSeg(w, 17, -1, -95, 36, 1, -93, B);
    lightAt(c, [0.2, 0.9, -8.3], 0xffa040, 9, 9);
    // ---------------------------------------------------------------- ancient columns strangled by roots
    const ANC: K.Stone = { a: 0x60606e, b: 0x666674, mortar: 0x4a4a58, base: 0x50505e, baseTop: 0x6e6e7c, trim: 0x74748a, trimL: 0x84849a, pil: 0x666676, dark: 0x16141a };
    K.ruinColumn(w, -7.4, -8.6, 44, ANC); K.rootWrap(w, -7.4, -8.6, 5, [10, 30], B, 1, 40);
    K.ruinColumn(w, 7.6, -8.0, 30, ANC); K.rootWrap(w, 7.6, -8.0, 5, [8, 22], B, -1, 28);
    K.ruinColumn(w, -8.2, -2.0, 14, ANC); K.rootWrap(w, -8.2, -2.0, 5, [6], B, 1, 12);
    K.ruinColumn(w, 8.0, -0.6, 22, ANC); K.rootWrap(w, 8.0, -0.6, 5, [8], B, -1, 20);
    { // two drums of a fallen column lying along x, cut-corner section, a band at each end
      const X = M(-7.4), Z = M(1.2);
      for (let i = 0; i < 2; i++) { const a = X - 10 + i * 12, b = a + 10; w.box(a, 0, Z - 4, b, 9, Z + 4, ANC.pil).box(a, 1, Z - 5, b, 8, Z + 5, ANC.pil).box(a, 1, Z - 5, a, 8, Z + 5, ANC.trim).box(b, 1, Z - 5, b, 8, Z + 5, ANC.trim).box(a + 3, 9, Z - 2, b - 3, 9, Z - 2, ANC.mortar).box(a + 3, 9, Z + 2, b - 3, 9, Z + 2, ANC.mortar); }
      K.rootSeg(w, X - 4, 0, Z + 6, X + 2, 3, Z + 14, B, { moss: 0x4e5a30 });
    }
    lightAt(c, [-6.2, 1.6, -7.2], 0xffa040, 3.5, 6); lightAt(c, [6.6, 1.4, -6.8], 0xffa040, 3.5, 6);
    // ---------------------------------------------------------------- roots ridging the floor at the sides, sap puddles, fungus
    K.rootSeg(w, M(-9.0), -2, M(-6.4), M(-8.2), 4, M(4.6), B); K.rootSeg(w, M(-8.8), -2, M(2.0), M(-6.0), 3, M(2.6), B);
    K.rootSeg(w, M(8.3), -2, M(-5.6), M(9.1), 5, M(3.4), B); K.rootSeg(w, M(5.8), -2, M(-2.6), M(8.6), 3, M(-2.0), B);
    K.sapPuddle(w, -7.0, 3.6, 0.35, 0.25, 0x5a340a, 0x2a1a10); K.sapPuddle(w, 6.8, 4.4, 0.3, 0.22, 0x5a340a, 0x2a1a10); K.sapPuddle(w, -6.0, -6.9, 0.28, 0.2, 0x5a340a, 0x2a1a10);
    for (const [x, z, s] of [[-6.4, -4.4, 2], [-8.4, 4.4, 2], [6.6, -3.4, 2], [8.6, 5.0, 2], [-5.8, 2.6, 1], [7.4, 2.6, 1]] as const) mushroom(w, x, z, s, 0xc8b8a0, 0xffa040, 1);
    lightAt(c, [-7.4, 0.8, 3.0], 0xffa040, 3, 5);
    lightAt(c, [0, 5.5, -5.0], 0x7a90c0, 5, 14);
    c.shaft(0, -6.6, { w: 2.0, h: 8, tilt: 0.08, yaw: 0, color: 0xb8a888, a: 0.12 });
    dress(c, 'roots', { seed: 12, hang: [], clear: [{ x0: -3.6, z0: -10, x1: 3.8, z1: -6.8 }] });
  },
};
