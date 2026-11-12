// The village square and the interiors: cottage, chapel, and the coven matriarch nest (boss). Interiors are cut-away rooms in the
// Minecraft-Dungeons manner: the back wall tallest and busiest (fireplace / altar niche / cauldron hood), the side walls stepping down
// toward the camera, the front wall only a footing; floors zoned (boards, hearth flags, a rug, a runner, a ritual circle); beams, lamps
// and cages up high at the back and sides only; furniture in purposeful groups at the back and in the side bays. The battle floor
// (PLAY) stays flat: only flush floor patterns and decals inside it.
import { type SceneDef, type Ctx } from './stage';
import { M, AREA, tiles, patches } from './props';
import { pine, deadTree } from './flora';
import { NIGHT, HOUSE, BARK, BARK_D, PINE, PINE_T, GROUT, CURSE, floorEarth } from './common';
import { dress } from './dress';
import {
  Run, buildWall, opening, panes, curtains, boards, flags, setts, rug, brick, ashlar, shade,
  candleStick, candles, pot, bowl, jug, bookFlat, openBook, loaf, skullAt,
  tableK, chairK, chairDown, benchK, stoolK, bedK, chestK, nightstand, cupboard, bookshelf, dresser, counter, shelfOn, jarOn, bottleOn, books,
  barrelK, crateK, sackK, woodStack, hangLantern, chandelier, herbs, fireplace, banner, column, pew, arcade, stained, cauldron, cage, spider,
  root, sac, well, house, stall, noticeBoard, cart, lampPost, picket, hay, loc,
  WD, WD_D, WD_L, WD_DD, PLAS, PLAS_D, TIM, TIM_D, ST, ST_L, ST_D, ST_DD, MORT, IRN, IRN_L, BRASS, LINEN, WAX, FLM, LANT, SLATE, SLATE_D, SLATE_L, BONE_C, BOOKS,
} from './k_village';
import { CELL } from '../bestiary/kit';

const FLOOR = [0x5a3e2a, 0x644630, 0x52382a], FSEAM = 0x2a1c14;

/** pines and dead trees standing outside a room's walls (never inside it) */
function outskirts(c: Ctx, seed: number, spots: Array<[number, number]>) {
  spots.forEach(([x, z], i) => {
    if ((i + seed) % 3 === 2) deadTree(c.w, x, z, 5.5 + (i % 3) * 0.6, BARK, BARK_D, { seed: i + seed });
    else pine(c.w, x, z, 6.5 + ((i * 7 + seed) % 5) * 0.5, BARK_D, PINE, PINE_T);
  });
}
/** small grey cobwebs: [x, y (top), z, yaw, scale] */
function webs(c: Ctx, list: Array<[number, number, number, number, number]>) { for (const [x, y, z, ry, s] of list) c.cards.add('web', x, z, { y, ry, s, tint: 0xa8a8b8 }); }
const RING_OUT: Array<[number, number]> = [[-10.4, -12.6], [-12.6, -8.4], [-10.8, -3.4], [-12.4, 2.6], [10.6, -12.8], [12.4, -7.8], [10.9, -2.6], [12.3, 3.2], [-4.6, -14.0], [4.2, -14.2], [0.2, -15.4]];

// ==================================================================== 荒村广场
export const village: SceneDef = {
  id: 'n_village', name: '荒村广场', group: '普通', kind: '户外', blurb: '村民在一夜之间消失，井边的水桶还挂着。', mood: NIGHT, foes: ['forest_ghoul', 'forest_banshee'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2c3226, 0x30382a, 0x343c2c]);
    // the square: a raised curb, flagstones in courses, a ring of setts round the well and a setts path leading from the front to it
    const PX0 = M(-7.6), PX1 = M(7.7), PZ0 = M(-9.6), PZ1 = M(6.6);
    flags(w, { X0: PX0, X1: PX1, Z0: PZ0, Z1: PZ1 }, [0x5e5c6a, 0x67657a, 0x5a5866], GROUT, 10, 3);
    setts(w, { X0: -32, X1: 32, Z0: PZ0, Z1: M(-6.0) }, [0x76748a, 0x6e6c80], GROUT, 5);
    setts(w, { X0: -11, X1: 11, Z0: M(-6.0), Z1: PZ1 }, [0x76748a, 0x6e6c80], GROUT, 5);
    for (let x = PX0 - 2; x <= PX1 + 2; x++) for (let z = PZ0 - 2; z <= PZ1 + 2; z++) {
      const e = Math.min(x - (PX0 - 2), PX1 + 2 - x, z - (PZ0 - 2), PZ1 + 2 - z); if (e > 2) continue;
      w.set(x, -1, z, e === 2 ? ST_L : ST_D); if (e < 2 && z > PZ0 - 2) w.set(x, 0, z, (Math.floor((x + z) / 9) & 1) ? ST_D : 0x4e4c58);
    }
    // the well, the focus: in front of the dark alley between the two houses
    const wl = well(w, 0, -7.85); c.light(wl, 0xffb060, 6, 9); c.flame(wl, 0xffc070, 0.1);
    w.box(M(1.7), 0, M(-9.3), M(3.4), 5, M(-8.6), ST).box(M(1.7) + 1, 2, M(-9.3) + 1, M(3.4) - 1, 5, M(-8.6) - 1, null).box(M(1.7) + 1, 2, M(-9.3) + 1, M(3.4) - 1, 2, M(-8.6) - 1, 0x0e1a30, 1);   // a trough
    w.box(M(-2.2), 0, M(-6.9), M(-1.6), 4, M(-6.5), WD).box(M(-2.2), 2, M(-6.9), M(-1.6), 2, M(-6.5), IRN);   // a bucket set down
    // the houses behind it: an eave-front cottage with a chimney and an inn sign, a gable-front house; an alley wall and gate between
    const hl = house(w, M(-11.4), M(-2.8), M(-10.2), { glowC: 0xc8843e, depth: 48, H: 40, door: M(-4.6), wins: [M(-9.6), M(-6.9)], chimney: M(-8.2), sign: M(-3.4) });
    const hr = house(w, M(2.9), M(11.6), M(-10.5), { glowC: 0xc07c3a, depth: 48, H: 36, gable: true, door: M(8.6), wins: [M(4.4), M(6.6)], upWin: true, plaster: 0x9a8a78, roof: [0x5a4038, 0x3e2c26, 0x6e5044] });
    c.light(hl[0], 0xffb060, 3.5, 6); void hr;
    for (let x = M(-2.8); x <= M(2.9); x++) { const gate = Math.abs(x) <= 9; w.box(x, -2, M(-13.0), x, gate ? 1 : 14, M(-12.7), gate ? ST_D : brick(x, 0, ST, MORT)); if (!gate) w.set(x, 15, M(-12.85), ST_L); }
    for (const s of [-1, 1]) w.box(s * 10, 0, M(-12.85), s * 10 + s, 22, M(-12.85) + 1, TIM).box(s * 9, 2, M(-12.85), s, 16, M(-12.85), WD_D);
    w.box(-9, 9, M(-12.85), 9, 9, M(-12.85), IRN);
    w.box(-12, 20, M(-12.85), -12, 20, M(-12.85) + 4, IRN); hangLantern(w, -12, 19, M(-12.85) + 4, 1, 0xd08a40);   // a lamp left burning at the gate
    // the left side: a lean-to stable with hay; the market stall facing the square
    const SX = M(-11.8), SZ0 = M(-8.6), SZ1 = M(-3.0), SF = M(-9.6);
    w.box(SX, -2, SZ0, SX + 3, 30, SZ1, PLAS_D).box(SX, -2, SZ0, SX + 3, 6, SZ1, ST_D);
    for (const z of [SZ0, SZ1]) w.box(SX, -2, z, SF, 26, z + 2, TIM).box(SX, 7, z, SF, 24, z + 2, PLAS);
    for (const z of [SZ0, (SZ0 + SZ1) >> 1, SZ1]) w.box(SF - 1, 0, z, SF + 1, 27, z + 2, TIM);
    for (let k = 0; k < 4; k++) { const y = 28 + k * 3, x1 = SF + 4 - k * 9; w.box(SX - 2, y, SZ0 - 3, x1, y + 2, SZ1 + 5, k & 1 ? 0x5a4038 : 0x52392f); w.box(x1, y, SZ0 - 3, x1, y, SZ1 + 5, 0x3e2c26); }
    hay(w, -10.6, -7.6, 1); hay(w, -10.6, -6.4, 1); hay(w, -10.6, -7.0, 1, 1); w.box(M(-10.6) - 4, 8, M(-7.0) - 7, M(-10.6) + 4, 14, M(-7.0) + 7, 0xc8a84a).box(M(-10.6) - 4, 14, M(-7.0) - 7, M(-10.6) + 4, 14, M(-7.0) + 7, 0xd8bc62);
    crateK(w, -10.4, -4.2, 5); sackK(w, -9.4, -3.8);
    stall(w, -7.0, -3.4, 1, 15);
    barrelK(w, -6.4, -6.0); barrelK(w, -7.2, -6.4); sackK(w, -6.1, -1.0); sackK(w, -6.6, -0.4, 0x8a7a58);
    const lpL = lampPost(w, -5.9, -7.5, 'x'), lpR = lampPost(w, 6.1, -7.5, '-x');
    c.light(lpL, 0xffb060, 5, 8); c.light(lpR, 0xffb060, 5, 8);
    // the right side: notice board, barrels and crates by the gable house, a hand cart, a bench
    noticeBoard(w, 7.2, -5.2, 3);
    barrelK(w, 9.4, -8.6); barrelK(w, 8.5, -8.9); crateK(w, 10.4, -8.4, 5); crateK(w, 10.4, -8.4, 4, WD_L, WD_D, 11);
    cart(w, 7.9, 1.0, 0); crateK(w, 7.9, 0.0, 4, WD_L, WD_D, 10); sackK(w, 7.6, 1.6); hay(w, 8.2, 2.0, 1, 0.6);
    benchK(w, -6.3, 2.2, 1, 22);
    // planters at the front corners, low picket fences down the sides, a dead tree front left
    for (const [x, z] of [[-6.8, 5.2], [6.9, 5.2]] as const) { const X = M(x), Z = M(z); w.box(X - 9, 0, Z - 4, X + 9, 5, Z + 4, ST).box(X - 8, 5, Z - 3, X + 8, 5, Z + 3, 0x2a2018).box(X - 9, 5, Z - 4, X + 9, 5, Z - 4, ST_L); for (let i = -6; i <= 6; i += 4) c.cards.add('flowers', x + i * CELL, z, { y: 0.42, s: 0.7 }); }
    picket(w, -10.2, -1.6, 8.0, 'z'); picket(w, 10.4, -1.6, 8.0, 'z');
    deadTree(w, -9.6, 4.6, 6, BARK, BARK_D, { seed: 3 });
    outskirts(c, 3, [[-0.4, -14.6], [-1.8, -16.0], [2.0, -15.8], [-12.8, -10.2], [12.8, -9.6], [-12.6, 0.4], [12.4, -2.2]]);
    dress(c, 'woods', { seed: 3, dense: 0.55, clear: [{ x0: -7.9, z0: -9.9, x1: 8.0, z1: 6.9 }, { x0: -11.9, z0: -8.7, x1: -9.5, z1: -2.9 }],
      hang: [[-11.4, -10.7, -2.8, -10.7, 's'], [2.9, -11.0, 11.6, -11.0, 's']], shafts: [[0.2, -8.2, 0.3, 0.25, 1.2]] });
  },
};

// ==================================================================== 荒屋
export const cottage: SceneDef = {
  id: 'n_cottage', name: '荒屋', group: '普通', kind: '室内', blurb: '屋顶早已塌了，壁炉的火却不知被谁点着。', mood: HOUSE, foes: ['forest_wraith_cultist', 'forest_ghoul'],
  build(c) {
    const w = c.w; floorEarth(c);
    // floor zones: boards across the room, boards along z in the side bays behind a dark sleeper, hearth flags, the rug
    boards(w, { X0: -79, X1: 79, Z0: -150, Z1: 96 }, 'x', FLOOR, FSEAM, 34, 5, 4);
    boards(w, { X0: -120, X1: -81, Z0: -150, Z1: 96 }, 'z', FLOOR, FSEAM, 30, 5, 5);
    boards(w, { X0: 81, X1: 120, Z0: -150, Z1: 96 }, 'z', FLOOR, FSEAM, 30, 5, 6);
    for (const x of [-80, 80]) w.box(x, -1, -150, x, -1, 96, TIM_D);
    flags(w, { X0: -36, X1: 36, Z0: -132, Z1: -118 }, [ST, ST_L, 0x6a6874], MORT, 7, 3);
    rug(w, { X0: -44, Z0: -74, X1: 48, Z1: 30 }, { field: 0x5e2430, band: 0x94703a, edge: 0x2e1a20, motif: 0xc09a50, fringe: LINEN });
    // walls: plaster between timber posts and rails on a stone footing; the back wall full height, the sides stepping down to the front
    const B = new Run(w, 'x', -151, -1), L = new Run(w, 'z', -121, -1), R = new Run(w, 'z', 121, 1);
    const patch = (a: number, y: number) => (a >= -112 && a <= -100 && y >= 16 && y <= 27) || (a >= -108 && a <= -96 && y >= 27 && y <= 33) || (a >= 74 && a <= 86 && y >= 10 && y <= 20);
    const body = (a: number, y: number) => (patch(a, y) ? brick(a, y, ST, MORT, 7, 4) : y < 14 ? PLAS_D : PLAS);
    buildWall(B, -126, 126, a => (a > 96 ? 38 : a > 74 ? 47 : 56), { t: 5, cPlinth: ST_D, cCap: ST, body, posts: [-126, -96, -38, 35, 93, 124], rails: [[7, 2, TIM], [32, 2, TIM]], top: TIM_D, full: 56, rubble: PLAS_D });
    const side = (a: number) => (a <= -86 ? 46 : a <= -15 ? 34 : a <= 42 ? 20 : 7);
    const sideBody = (a: number, y: number) => ((a >= -40 && a <= -28 && y >= 12 && y <= 24) ? brick(a, y, ST, MORT, 7, 4) : y < 14 ? PLAS_D : PLAS);
    for (const S of [L, R]) buildWall(S, -156, 98, side, { t: 5, cPlinth: ST_D, cCap: ST, body: sideBody, posts: [-153, -112, -88, -50, -17, 19], rails: [[7, 2, TIM], [32, 2, TIM]], top: TIM_D, full: 46, rubble: PLAS_D });
    w.box(-126, -2, 94, 126, 4, 98, ST_D).box(-126, 5, 94, 126, 5, 98, ST);
    // the fireplace, its fire and mantel things, a little painting above
    const fp = fireplace(B, 0, 56);
    c.light([fp.fire[0], 0.8, fp.fire[2] + 0.6], 0xff8a3a, 10, 11); c.flame(fp.fire, 0xffb050, 0.16); c.flame([fp.fire[0] + 0.25, fp.fire[1] - 0.15, fp.fire[2]], 0xff9040, 0.12);
    { const zm = -151 + 12; candleStick(w, -21, 24, zm, 3); candleStick(w, 21, 24, zm, 3); for (const [a, h, cc] of [[8, 3, 0x8a5a3a], [11, 4, 0xc8b890], [14, 3, 0x6a7a8a]] as const) jarOn(B, a, -11, 24, h, cc, shade(cc, 0.7)); B.box(-12, -10, 24, -8, -10, 27, 0xd8d2c4); B.box(-11, -10, 25, -9, -10, 26, 0x6a7a9a); B.box(-17, -12, 24, -14, -10, 25, WD_D); }
    // fire irons and a log basket either side of the hearth
    B.box(27, -14, 0, 28, -13, 1, IRN).box(28, -14, 2, 28, -14, 14, IRN).box(27, -14, 14, 29, -14, 14, IRN).box(26, -13, 2, 26, -13, 12, IRN_L);
    woodStack(w, -2.15, -10.05, 0, 2, 2);
    // back windows with mullions and moonlit panes (some broken), curtains
    for (const [ac, br] of [[-66, 2], [60, 1]] as const) { opening(B, ac, 22, 8, 18, { t: 5, frame: TIM, sill: ST_L, glass: panes(8, 18, 0x2c3a5e, 1, TIM_D, br), glassD: 3 }); curtains(B, ac, 22, 8, 18, 0x7a3434, 0x6a2c2c, 0x4a1e1e, ac > 0); }
    opening(L, -71, 18, 6, 14, { t: 5, frame: TIM, sill: ST_L, glass: panes(6, 14, 0x2c3a5e, 1, TIM_D, 3), glassD: 3 });
    opening(R, -112, 20, 6, 16, { t: 5, frame: TIM, sill: ST_L, glass: panes(6, 16, 0x2c3a5e, 1, TIM_D), glassD: 3 });
    // the side door, standing open into the room, a threshold and a step
    opening(R, -54, 0, 7, 30, { t: 5, frame: TIM, lintel: TIM_D }); R.box(-61, -1, -1, -47, 5, -1, ST_L); R.box(-62, 5, -2, -46, 10, -1, ST);
    R.box(-45, -14, 0, -45, -2, 28, WD); for (let d = -14; d <= -2; d += 3) R.box(-45, d, 0, -45, d, 28, WD_D); R.box(-45, -13, 5, -45, -2, 5, IRN).box(-45, -13, 23, -45, -2, 23, IRN).put(-44, -12, 14, BRASS);
    // kitchen: counter under the left window with pot, board and bread, jug, bowls; a shelf of jars; the dresser on the left wall
    counter(w, -4.76, -10.22, 0, 52);
    { const y = 14, z = -146; pot(w, -86, y, z, IRN, 0x6a4a2a); w.box(-79, y, -148, -72, y, -143, WD_L); loaf(w, -76, y + 1, -146); jug(w, -63, y, -147); bowl(w, -55, y, -145); bowl(w, -50, y, -147, WD_L, 0x9ab05a); w.box(-46, y, -148, -44, y + 2, -146, 0x5a7a3a).box(-46, y + 3, -148, -44, y + 3, -146, 0x6a8a46); }
    shelfOn(B, -96, -81, 30, 5); for (const [a, h, cc] of [[-94, 4, 0x8a5a3a], [-91, 3, 0xc8b890], [-88, 5, 0x6a7a8a], [-85, 3, 0x8a5a3a]] as const) jarOn(B, a, -2, 31, h, cc, shade(cc, 0.7));
    herbs(w, -95, -82, 29, -149, 2, [0x5a7a3a, 0x7a6a3a], 3);
    dresser(w, -8.05, -8.6, 1);
    banner(L, -100, 42, 5, 22, 0x2e4a36, 0xa8823e, 0xc8a050);   // a faded tapestry between the dresser and the window
    // the table in the left bay: four chairs (one knocked over), a bench, candle, bowls, bread, a jug, a book
    const ty = tableK(w, -6.95, -3.5, 1, 28, 16);
    chairK(w, -5.85, -4.2, 3); chairK(w, -5.85, -2.7, 3); chairK(w, -6.95, -5.35, 0); chairDown(w, -6.95, -1.35, 2);
    benchK(w, -8.05, -3.5, 1, 24);
    { const X = M(-6.95), Z = M(-3.5), f = candleStick(w, X, ty, Z, 3); c.light([f[0], f[1] + 0.1, f[2]], 0xffb060, 3.5, 5); c.flame(f, 0xffd070, 0.06); bowl(w, X + 3, ty, Z - 8); bowl(w, X - 3, ty, Z + 7); jug(w, X + 4, ty, Z + 9, 0x7a5a3a); loaf(w, X - 4, ty, Z - 6); bookFlat(w, X + 3, ty, Z + 3, 0x7a2a2a, LINEN, false); }
    // front left: a water barrel, sacks, a crate, a broom against the wall
    barrelK(w, -7.7, 1.4); barrelK(w, -6.8, 2.2, WD_D); sackK(w, -7.8, 2.8); sackK(w, -6.4, 0.9, 0x8a7a58); crateK(w, -7.5, 4.0, 4);
    w.box(M(-8.2), 0, M(0.2), M(-8.2), 22, M(0.2), WD_L).box(M(-8.2) - 1, 0, M(0.2) - 1, M(-8.2) + 1, 5, M(0.2) + 1, 0xb09a5a).box(M(-8.2) - 1, 5, M(0.2) - 1, M(-8.2) + 1, 5, M(0.2) + 1, 0x7a3434);
    // the bed in the back right corner, a nightstand with a candle, the chest at its foot, the bookshelf on the right wall
    bedK(w, 7.63, -9.45, 0, 0x4a4a7a, 0xa8823e);
    { const ny = nightstand(w, 5.85, -10.2, 0); candleStick(w, M(5.85), ny, M(-10.2), 2); bookFlat(w, M(5.85) + 2, ny, M(-10.2) + 2, 0x2e4a6a); }
    chestK(w, 7.63, -7.98, 0);
    bookshelf(w, 8.19, -6.4, 3, 12, 32, 7);
    // where the roof came in: a fallen beam and broken slates in the right bay; barrels, crates and a firewood stack at the front
    w.box(M(6.2), 0, M(-1.9), M(6.5), 3, M(1.5), TIM).box(M(6.2), 4, M(1.5) - 2, M(6.5) - 2, 4, M(1.5), TIM_D);
    for (const [x, z, s] of [[7.5, 0.0, 5], [7.2, -1.4, 4], [6.9, 1.9, 3]] as const) { const X = M(x), Z = M(z); w.box(X - s, 0, Z - s + 1, X + s, 0, Z + s - 1, SLATE_D).box(X - s + 2, 1, Z - s + 2, X + s - 1, 1, Z + s - 2, SLATE).box(X - 1, 2, Z - 2, X + 2, 2, Z + 1, SLATE_L); }
    crateK(w, 7.5, 2.9, 5); crateK(w, 7.6, 2.9, 4, WD_L, WD_D, 11); barrelK(w, 6.4, 3.9); sackK(w, 6.3, 2.6);
    for (const [x, z, l, ax] of [[5.9, -2.6, 9, 1], [7.0, 1.2, 7, 0], [-6.0, 0.4, 8, 1], [-5.8, 4.6, 6, 0]] as const) { const X = M(x), Z = M(z); w.box(X, 0, Z, X + (ax ? l : 1), 0, Z + (ax ? 1 : l), WD_L).box(X, 0, Z, X + (ax ? 1 : 0), 0, Z + (ax ? 1 : 0), WD_D); }   // splintered boards
    woodStack(w, 8.21, 4.6, 3, 6, 4);
    // overhead: tie-beam stubs on the side walls (the middle fell), a lantern hanging from one, herbs drying on the other
    w.box(-120, 49, -138, -30, 52, -135, TIM).box(-35, 51, -138, -30, 52, -135, null).box(-34, 49, -138, -30, 49, -135, TIM_D);
    w.box(40, 49, -138, 120, 52, -135, TIM).box(40, 51, -138, 45, 52, -135, null);
    for (const x of [-120, 117]) w.box(x, 44, -138, x + 3, 48, -135, TIM_D);
    w.box(-118, 49, -118, -112, 52, -96, TIM).box(112, 49, -110, 118, 52, -96, TIM);   // two rafter ends left on the side walls
    const lan = hangLantern(w, -42, 48, -136, 12); c.light(lan, 0xffb060, 4, 7);
    herbs(w, 76, 116, 49, -136, 1);
    // webs, pages, ivy, window light
    for (const [x, z] of [[-3.4, -6.0], [3.6, 3.8]] as const) c.cards.add('pages', x, z, { y: 0.01, s: 0.8, ry: 0, tint: 0x9a9284 });
    webs(c, [[-8.25, 3.2, -10.35, 0.785, 0.6], [8.25, 2.6, -10.35, -0.785, 0.5], [-8.3, 2.3, -6.4, 1.57, 0.45], [-3.0, 3.6, -9.5, 0, 0.4]]);
    outskirts(c, 4, RING_OUT);
    dress(c, 'house', { seed: 4, dense: 0.5, hang: [[-8.4, -10.8, 8.4, -10.8, 's'], [-8.8, -10.2, -8.8, -2.2, 'e'], [8.8, -10.2, 8.8, -2.2, 'w']],
      shafts: [[-4.6, -8.6, 1.57, 0.42, 1.1], [4.2, -8.6, 1.57, 0.42, 1.1], [-6.9, -5.0, 0, -0.5, 0.9]],
      clear: [{ x0: -8.4, z0: -10.5, x1: -2.6, z1: -7.4 }, { x0: -8.4, z0: -5.8, x1: -5.4, z1: -0.8 }, { x0: 5.4, z0: -10.5, x1: 8.4, z1: -5.2 }] });
  },
};

// ==================================================================== 残破礼拜堂
const CH = 0x6a687c, CH2 = 0x62607a, CHM = 0x52506a, CH_L = 0x7e7c92, CH_D = 0x4e4c62;
export const chapel: SceneDef = {
  id: 'n_chapel', name: '残破礼拜堂', group: '普通', kind: '室内', blurb: '月光从空窗框里落在长椅上，祭台的蜡烛还在烧。', mood: HOUSE, foes: ['forest_wraith_cultist', 'elite_necromancer'],
  build(c) {
    const w = c.w; floorEarth(c);
    // floor: nave flagstones, a dark band along each colonnade, smaller tiles in the side aisles, the altar steps, a runner up the nave
    flags(w, { X0: -77, X1: 77, Z0: -151, Z1: 96 }, [0x5c5a6c, 0x646276, 0x58566a], GROUT, 11, 5);
    for (const s of [-1, 1]) for (let x = 78; x <= 92; x++) for (let z = -151; z <= 96; z++) { if (mod14(z)) { w.set(s * x, -1, z, null).set(s * x, -2, z, GROUT); } else w.set(s * x, -1, z, x === 78 || x === 92 ? 0x6e6c82 : 0x4c4a5e); }
    tiles(w, { x0: 6.6, z0: -10.6, x1: 8.65, z1: 6.7 }, [0x5a586a, 0x625f74], GROUT, { size: 8 }); tiles(w, { x0: -8.65, z0: -10.6, x1: -6.6, z1: 6.7 }, [0x5a586a, 0x625f74], GROUT, { size: 8 });
    const steps: Array<[number, number, number]> = [[60, -103, 0], [48, -114, 2], [36, -124, 4]];
    for (const [hx, zf, y] of steps) { w.box(-hx, y, -151, hx, y + 1, zf, CH); w.box(-hx, y + 1, zf, hx, y + 1, zf, CH_L); w.box(-hx, y, zf, hx, y, zf, CH_D); }
    for (let z = -102; z <= 96; z++) for (let x = -12; x <= 12; x++) {
      if (z > 58 && ((x < -4 && z > 70) || (x > 6 && z > 64 && z < 84) || z > 88)) continue;               // the runner is torn away at the front
      const ex = 12 - Math.abs(x); w.set(x, -1, z, ex === 0 ? 0x3a1620 : ex === 1 ? 0xb08a40 : ex === 2 ? 0x3a1620 : (Math.abs(x) <= 2 && Math.abs(((z + 200) % 18) - 9) <= 2) || (x === 0 && Math.abs(((z + 200) % 18) - 9) <= 4) ? 0xb08a40 : 0x5e1e2c);
    }
    // walls: ashlar with pilasters, a cornice where whole; the sides broken in wide steps toward the front
    const B = new Run(w, 'x', -152, -1), L = new Run(w, 'z', -124, -1), R = new Run(w, 'z', 124, 1);
    const ash = (a: number, y: number) => ashlar(a, y, CH, CH2, CHM, 10, 5);
    buildWall(B, -130, 130, () => 62, { t: 6, plinth: 7, cPlinth: CH_D, cCap: CH_L, body: ash, posts: [-130, -101, -46, 42, 97, 126], postW: 5, cPost: CH_L, top: CH_L, full: 62 });
    const sideH = (a: number) => (a <= -100 ? 60 : a <= -40 ? 46 : a <= 10 ? 30 : a <= 50 ? 14 : 7);
    for (const S of [L, R]) buildWall(S, -158, 98, sideH, { t: 6, plinth: 7, cPlinth: CH_D, cCap: CH_L, body: ash, posts: [-157, -119, -68, -16, 35], postW: 5, cPost: CH_L, top: CH_L, full: 60, rubble: CH_D });
    w.box(-130, -2, 94, 130, 3, 99, CH_D);
    // the apse niche behind the altar: a stepped arch through the back wall, a deeper wall with the great stained-glass window
    opening(B, 0, 6, 30, 50, { t: 6, tiers: 3, tierH: 4, tierIn: 5, frame: CH_L });
    w.box(-36, -2, -167, 36, 64, -158, CH_D); w.box(-30, 4, -166, 30, 64, -158, null); w.box(-30, 4, -166, 30, 5, -152, CH); w.box(-30, 5, -153, 30, 5, -152, CH_L);
    for (let a = -36; a <= 36; a++) for (let y = 6; y <= 64; y++) w.set(a, y, -167, ash(a, y));
    const NB = new Run(w, 'x', -167, -1);
    const GL = { gold: 0xd8a040, blue: 0x3a5ad0, red: 0xc0384a, violet: 0x8a52d0, green: 0x34a070, pale: 0xf0dca0 };
    opening(NB, 0, 16, 13, 40, { t: 5, tiers: 3, tierH: 4, tierIn: 4, frame: CH_L, sill: CH_L, glassD: 2, glass: stained(13, 40, (pu, pv, n) => pv === 0 ? GL.green : pv >= n - 3 ? GL.violet : (pv === 4 || pv === 5) && pu === 0 ? GL.pale : pu === 0 ? GL.gold : pu === 1 ? GL.blue : GL.red) });
    for (const ac of [-73, 73]) opening(B, ac, 22, 7, 28, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L, glassD: 3, glass: stained(7, 28, (pu, pv, n) => pv >= n - 2 ? GL.violet : pv === 0 ? GL.green : pu === 0 ? GL.gold : GL.blue) });
    banner(B, -55, 56, 5, 30, 0x2a3466, 0xb08a3a, 0xc8a048); banner(B, 55, 56, 5, 24, 0x2a3466, 0xb08a3a, 0xc8a048);
    // side windows: empty stepped frames letting the moon in
    for (const S of [L, R]) { opening(S, -138, 22, 6, 30, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L }); opening(S, -92, 16, 6, 24, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L }); }
    // the colonnades: whole columns at the back carrying stepped arches, broken ones toward the front, fallen drums
    for (const s of [-1, 1]) {
      const X = s * 86;
      column(w, s * 6.15, -8.2, 54, CH, CH_L); column(w, s * 6.15, -4.6, 54, CH, CH_L); column(w, s * 6.15, -1.0, s < 0 ? 34 : 28, CH, CH_L, true); column(w, s * 6.15, 2.6, s < 0 ? 14 : 18, CH, CH_L, true);
      arcade(w, X, -157, -117, 55, CH, CH_L); arcade(w, X, -117, -66, 55, CH, CH_L);
      w.box(X - 4, 55, -66, X + 4, 61, -58, CH).box(X - 4, 62, -64, X + 4, 64, -62, CH_D);
      const dz = s < 0 ? 4.3 : 0.6, DX = s * M(7.0); w.box(DX - 4, 0, M(dz) - 7, DX + 4, 8, M(dz) + 7, CH).box(DX - 4, 4, M(dz) - 7, DX + 4, 4, M(dz) + 7, CH_L);
    }
    // the altar on three steps: stone block with panels, top slab, white cloth with a gold hem, a red runner with an emblem
    { const zb = -142, zf = -133;
      w.box(-16, 6, zb, 16, 17, zf, 0x76748c); for (const px of [-11, 0, 11]) w.box(px - 4, 8, zf, px + 4, 15, zf, 0x5e5c74).box(px - 3, 9, zf, px + 3, 14, zf, 0x6a687e);
      w.box(-18, 18, zb - 1, 18, 19, zf + 2, 0x8a88a0);
      w.box(-17, 20, zb, 17, 20, zf + 1, 0xe2dccc).box(-17, 14, zf + 3, 17, 20, zf + 3, 0xe2dccc).box(-17, 14, zf + 3, 17, 14, zf + 3, 0xc8a048);
      w.box(-4, 8, zf + 4, 4, 21, zf + 4, 0x8a2a3a).box(-4, 8, zf + 4, -4, 21, zf + 4, 0xc8a048).box(4, 8, zf + 4, 4, 21, zf + 4, 0xc8a048).box(-1, 13, zf + 5, 1, 16, zf + 5, 0xc8a048);
      for (let x = -3; x <= 3; x += 2) w.set(x, 7, zf + 4, 0xc8a048);
      candleStick(w, -13, 21, -138, 5); candleStick(w, 13, 21, -138, 5); candles(w, -9, 21, -139, WAX, FLM, [4, 3, 2]); candles(w, 8, 21, -139, WAX, FLM, [3, 4, 2]);
      w.box(-3, 21, -140, 3, 22, -136, BRASS); openBook(w, 0, 23, -138, 0x5a1e2a); w.box(5, 21, -135, 5, 23, -135, BRASS).box(4, 24, -136, 6, 25, -134, BRASS);
      c.light([0, 2.0, -9.2], 0xffb060, 6, 9);
    }
    // standing candelabra on the first step, a lectern before the steps
    for (const s of [-1, 1]) { const X = s * 66, Z = -110; w.box(X - 2, 2, Z - 2, X + 2, 3, Z + 2, IRN).box(X - 1, 4, Z - 1, X + 1, 4, Z + 1, IRN).box(X, 5, Z, X, 24, Z, IRN).box(X - 1, 14, Z - 1, X + 1, 14, Z + 1, IRN_L).box(X - 4, 25, Z, X + 4, 25, Z, IRN);
      for (const [dx, h] of [[-4, 3], [0, 5], [4, 3]]) w.box(X + dx, 26, Z, X + dx, 26, Z, BRASS).box(X + dx, 27, Z, X + dx, 26 + h, Z, WAX).set(X + dx, 27 + h, Z, FLM, 1);
      c.light([X * CELL, 2.3, Z * CELL], 0xffb060, 4, 6); }
    { const b = loc(w, M(-3.1), M(-7.0), 0); b(-3, 0, -3, 3, 1, 3, WD_D); b(-1, 2, -1, 1, 13, 1, WD_D); b(-4, 14, -3, 4, 15, 3, WD); b(-4, 16, -3, 4, 16, 0, WD); openBook(w, M(-3.1), 17, M(-7.0) - 1, 0x2e2a4a); }
    // pews in the side aisles, all facing the altar; a few overturned or missing toward the front
    for (const s of [-1, 1]) for (const [i, z] of [-9.8, -8.2, -6.6, -5.0, -3.4, -1.8, -0.2, 1.4, 3.0, 4.6].entries()) {
      const x = s * 7.6;
      if ((s < 0 && i === 7) || (s > 0 && i === 5)) { const b = loc(w, M(x), M(z), 0); b(-11, 0, -3, 11, 2, 3, WD_D); b(-11, 3, -3, 11, 3, -3, WD); continue; }   // one lying flat
      if (s > 0 && i === 8) { pew(w, x + 0.4, z, 2, 7); continue; }
      pew(w, x, z, 2, 11);
    }
    // chandeliers in the side aisles hung from beams across the bays, wall sconces on the colonnade
    for (const s of [-1, 1]) { w.box(s * 92, 66, -94, s * 123, 69, -90, TIM); const ch = chandelier(w, s * 108, 65, -92, 24); if (s < 0) c.light(ch, 0xffb060, 4, 7); else c.light(ch, 0xffb060, 3, 6); }
    for (const s of [-1, 1]) for (const z of [-66, -14]) { const X = s * 80; w.box(X - s * 1, 30, z - 1, X - s * 3, 30, z + 1, IRN).box(X - s * 3, 31, z, X - s * 3, 33, z, WAX).set(X - s * 3, 34, z, FLM, 1); }
    // the light: coloured beams from the great window, moonlight from the side windows
    c.shaft(0, -9.4, { color: 0xc8a8ff, w: 1.8, tilt: -0.42, yaw: Math.PI / 2, a: 0.2 });
    c.shaft(-5.1, -9.6, { color: 0x8aa8ff, w: 0.9, tilt: -0.4, yaw: Math.PI / 2, a: 0.16 }); c.shaft(5.1, -9.6, { color: 0x8aa8ff, w: 0.9, tilt: -0.4, yaw: Math.PI / 2, a: 0.16 });
    webs(c, [[-8.45, 4.2, -10.45, 0.785, 0.6], [8.45, 4.2, -10.45, -0.785, 0.6], [-6.15, 4.2, -6.4, 0, 0.45], [6.15, 4.2, -6.4, 0, 0.4]]);
    outskirts(c, 5, RING_OUT);
    dress(c, 'house', { seed: 5, dense: 0.5, hang: [[-8.8, -11.6, 8.8, -11.6, 's'], [-9.2, -11, -9.2, -3.2, 'e'], [9.2, -11, 9.2, -3.2, 'w']],
      shafts: [[-7.3, -9.7, 0, -0.55, 0.9], [7.3, -9.7, 0, 0.55, 0.9], [-7.3, -6.4, 0, -0.5, 0.8]],
      clear: [{ x0: 6.4, z0: -10.6, x1: 8.6, z1: 5.2 }, { x0: -8.6, z0: -10.6, x1: -6.4, z1: 5.2 }, { x0: -4.4, z0: -10.6, x1: 4.4, z1: -7.1 }] });
  },
};
const mod14 = (z: number) => ((z % 14) + 14) % 14 === 0;

// ==================================================================== 魇森巫母 · 巫母巢穴
const PLK = 0x3e2e32, PLK2 = 0x46343a, LOGC = 0x2e2224;
export const covenNest: SceneDef = {
  id: 'b_matriarch', name: '魇森巫母 · 巫母巢穴', group: '首领', kind: '室内', blurb: '大锅里熬着的东西在冒泡，屋梁上爬满了她的女儿们。', mood: { ...HOUSE, hemiSky: 0x6a5a8e, hemiI: 1.45, fog: 0x1c1428 }, foes: ['boss_coven_matriarch'],
  build(c) {
    const w = c.w; floorEarth(c, [0x2a2626, 0x302a2c]);
    const NF = [0x3e2c26, 0x46322a, 0x382822], NS = 0x1a1210;
    boards(w, { X0: -77, X1: 77, Z0: -154, Z1: 96 }, 'x', NF, NS, 30, 5, 9);
    boards(w, { X0: -125, X1: -79, Z0: -154, Z1: 96 }, 'z', NF, NS, 28, 5, 10); boards(w, { X0: 79, X1: 125, Z0: -154, Z1: 96 }, 'z', NF, NS, 28, 5, 11);
    for (const x of [-78, 78]) w.box(x, -1, -154, x, -1, 96, LOGC);
    // the ritual circle on the battle floor (a glowing decal)
    c.cards.add('ritual', 0, -1.2, { y: 0.004, s: 1.3, ry: 0 });
    // walls: vertical boards on a mud-stone footing, log posts, log rails, a log plate on top
    const B = new Run(w, 'x', -155, -1), L = new Run(w, 'z', -126, -1), R = new Run(w, 'z', 126, 1);
    const plank = (a: number, y: number) => (y > 52 && ((a + 400) % 23) < 2 ? 0x2a1e20 : (((a + 400) % 6) < 3 ? PLK : PLK2));
    const opt = { t: 5, plinth: 5, cPlinth: ST_DD, cCap: ST_D, body: plank, postW: 4, cPost: LOGC, rails: [[6, 3, LOGC], [36, 3, LOGC]] as Array<[number, number, number]>, top: LOGC };
    buildWall(B, -131, 131, () => 58, { ...opt, posts: [-131, -96, -8, 60, 128], full: 58 });
    const sideH = (a: number) => (a <= -100 ? 50 : a <= -30 ? 36 : a <= 20 ? 22 : 7);
    for (const S of [L, R]) buildWall(S, -160, 98, sideH, { ...opt, posts: [-158, -104, -62, -32, 18], full: 50 });
    w.box(-131, -2, 94, 131, 3, 98, ST_DD);
    // the cauldron, back left of the boss's mark so she never hides it: hearth flags, the hood in three stone steps and a flue,
    // skulls and candles on its ledge, a chain, the paddle
    const CA = M(-3.5);
    flags(w, { X0: CA - 26, X1: CA + 26, Z0: -154, Z1: -104 }, [ST_D, ST, 0x524e58], ST_DD, 7, 6);
    { const hb = (a: number, y: number) => brick(a, y, ST_D, ST_DD, 7, 4);
      for (let a = CA - 26; a <= CA + 26; a++) for (let y = 30; y <= 33; y++) B.box(a, -16, y, a, -1, y, hb(a, y));
      for (let a = CA - 20; a <= CA + 20; a++) for (let y = 34; y <= 39; y++) B.box(a, -12, y, a, -1, y, hb(a, y));
      for (let a = CA - 14; a <= CA + 14; a++) for (let y = 40; y <= 47; y++) B.box(a, -9, y, a, -1, y, hb(a, y));
      for (let a = CA - 9; a <= CA + 9; a++) for (let y = 48; y <= 72; y++) B.box(a, -6, y, a, -1, y, hb(a, y));
      B.box(CA - 27, -17, 29, CA + 27, -1, 29, ST_DD); for (const s of [-1, 1]) B.box(CA + s * 25, -15, 0, CA + s * 23, -14, 28, ST_DD);
      for (const k of [-2, -1, 0, 1, 2]) skullAt(w, CA + k * 10, 34, -155 + 15, 'z');
      for (const k of [-1.5, 0.5]) { const x = CA + Math.round(k * 10); w.box(x, 34, -141, x, 36, -141, 0x3a2a44).set(x, 37, -141, CURSE, 1); }
      w.box(CA, 22, -141, CA, 28, -141, IRN).box(CA - 1, 22, -141, CA + 1, 22, -141, IRN); }
    const cf = cauldron(w, -3.5, -8.75, 0x4adf3a);
    c.light([cf[0] + 0.4, 1.9, cf[2] + 0.6], 0x6aff4a, 8, 9); c.light([cf[0], 0.35, cf[2] + 0.9], 0xff7a30, 3, 4);
    c.flame([cf[0] + 0.15, 1.45, cf[2] + 0.1], 0x7aff5a, 0.12); c.flame([cf[0] - 0.3, 1.4, cf[2] - 0.2], 0x9aff6a, 0.09);
    w.box(CA + 4, 14, M(-8.55), CA + 5, 40, M(-8.55) + 1, WD).box(CA + 2, 37, M(-8.55), CA + 7, 38, M(-8.55) + 1, WD_D);
    c.ambient({ kind: 'spores', color: 0x8aff6a, rate: 4, area: { x0: -4.6, z0: -9.8, x1: -2.4, z1: -7.8 }, y: [1.4, 2.6] });
    // centre and right of the back wall: shelves of potions in colour groups (skulls and grimoires between), behind her
    { const pal = [0x5ad83a, 0x8a4ee0, 0xe0682e, 0x3abed8, 0xd83a5a], A0 = -16, A1 = 54;
      B.box(A0 - 2, -7, 12, A0 - 1, -1, 46, WD_D); B.box(A1 + 1, -7, 12, A1 + 2, -1, 46, WD_D); B.box(A0 - 3, -8, 47, A1 + 3, -1, 48, WD_D);
      for (const [k, y] of [12, 22, 32, 42].entries()) {
        B.box(A0, -7, y, A1, -1, y, WD);
        let a = A0 + 2, g = 0;
        while (a < A1 - 3) {
          const n = 2 + ((g * 7 + k * 3) % 3), col = pal[(g + k * 2) % pal.length], kind = (g + k) % 3;
          if ((g + k) % 4 === 3) { if (k % 2) skullAt(w, a + 1, y + 1, -155 + 4, 'z'); else books(B.bx(), a, a + 3, -6, -2, y + 1, 6, g + k, [0x3a2a3a, 0x2a3a2a, 0x4a2a2a]); a += 6; g++; continue; }
          for (let i = 0; i < n && a < A1 - 3; i++) a += bottleOn(B, a, -3, y + 1, kind, col, 1) + 1;
          a += 2; g++;
        }
      } }
    // right back: the herb-drying rack, baskets under it, a stool
    { w.box(64, -2, -146, 66, 48, -144, LOGC).box(118, -2, -146, 120, 48, -144, LOGC);
      for (const y of [46, 36, 26]) { w.box(62, y, -146, 122, y + 1, -145, WD_D); herbs(w, 67, 117, y, -145, y); }
      for (const x of [5.4, 6.8]) crateK(w, x, -9.7, 4, 0x5a4030, LOGC); w.box(M(5.4) - 3, 9, M(-9.7) - 3, M(5.4) + 3, 9, M(-9.7) + 3, 0x5a7a3a).box(M(6.8) - 3, 9, M(-9.7) - 3, M(6.8) + 3, 9, M(-9.7) + 3, 0x6a4a6a);
      stoolK(w, 4.4, -8.6); }
    // back left corner: a heap of skulls under a root that broke in through the wall
    const pile = (x: number, z: number, big = false) => { const X = M(x), Z = M(z);
      for (const [dx, dz, f] of [[-4, -2, 'z'], [0, -2, 'z'], [4, -2, 'x'], [-4, 2, '-x'], [0, 2, 'z'], [4, 2, 'z']] as const) skullAt(w, X + dx, 0, Z + dz, f);
      if (big) for (const [dx, dz, f] of [[-8, 0, '-x'], [8, 0, 'x'], [-4, 6, 'z'], [4, 6, 'z']] as const) skullAt(w, X + dx, 0, Z + dz, f);
      for (const [dx, dz, f] of [[-2, 0, 'z'], [2, 0, 'z']] as const) skullAt(w, X + dx, 4, Z + dz, f); skullAt(w, X, 8, Z, 'z');
      w.box(X - 9, 0, Z + 5, X - 3, 0, Z + 5, BONE_C).box(X + 6, 0, Z - 6, X + 6, 0, Z - 1, BONE_C); w.box(X, 12, Z, X, 14, Z, 0x3a2a44).set(X, 15, Z, CURSE, 1); };
    pile(-7.3, -9.4, true); root(w, B, -100, 40, 6, 1);
    // the left bay: her work table (mortar, grimoire, candles, a skull), a gallows post with an open cage, egg sacs, a root
    { const ty = tableK(w, -6.85, -2.4, 1, 26, 14, 0x4a3428, WD_DD), X = M(-6.85), Z = M(-2.4);
      w.box(X - 2, ty, Z - 9, X + 2, ty + 2, Z - 5, ST).box(X - 1, ty + 2, Z - 8, X + 1, ty + 2, Z - 6, 0x5a7a3a).box(X, ty + 3, Z - 7, X + 1, ty + 7, Z - 7, ST_L);
      openBook(w, X, ty, Z + 1, 0x3a2a44); candles(w, X + 2, ty, Z + 7, 0x3a2a44, CURSE, [5, 3, 2]); skullAt(w, X - 3, ty, Z + 8, 'x'); w.box(X - 3, ty + 4, Z + 8, X - 3, ty + 6, Z + 8, 0x3a2a44).set(X - 3, ty + 7, Z + 8, CURSE, 1);
      for (let k = 0; k < 3; k++) w.box(X - 5, ty, Z - 2 + k * 2, X - 4, ty + 3 - k, Z - 2 + k * 2, [0x5ad83a, 0x8a4ee0, 0xe0682e][k], 1);
      c.light([X * CELL + 0.3, 1.4, (Z + 6) * CELL], 0xb060ff, 3, 5);
      stoolK(w, -5.9, -1.4); }
    { const X = M(-8.1), Z = M(1.6); w.box(X - 1, -2, Z - 1, X + 1, 50, Z + 1, LOGC).box(X - 1, 47, Z - 1, X + 22, 49, Z + 1, LOGC).box(X - 3, 0, Z - 3, X + 3, 1, Z + 3, ST_DD).box(X + 2, 42, Z, X + 5, 43, Z, LOGC); cage(w, X + 20, 47, Z, 9, { open: true }); }
    root(w, L, -84, 26, 8, 1);
    opening(L, -114, 30, 5, 14, { t: 5, tiers: 2, tierH: 3, tierIn: 2, frame: LOGC, sill: ST_D, glass: panes(5, 14, 0x2c3a5e, 1, LOGC, 1), glassD: 3 }); c.shaft(-7.4, -8.1, { w: 0.8, tilt: -0.5, yaw: 0, a: 0.2 });
    // her daughters and their sacs
    for (const [x, z, s] of [[-7.9, 3.4, 4], [-7.6, 4.4, 3], [7.9, -2.8, 4], [7.7, -1.9, 3], [8.0, 4.2, 4], [7.4, -10.3, 3]] as const) sac(w, x, z, s);
    // the right bay: a bookcase of grimoires, a chest, a root, a second skull heap at the front
    bookshelf(w, 8.45, -5.0, 3, 10, 30, 11, [0x3a2a3a, 0x2a3a32, 0x4a2a2a, 0x2a2a3e, 0x4a3a22], 0.7);
    chestK(w, 8.1, -0.6, 3, 0x4a3428, IRN);
    root(w, R, -98, 36, 10, -1);
    pile(7.2, 3.2);
    w.box(M(-8.3), 0, M(-4.4), M(-8.3), 24, M(-4.4), WD_L).box(M(-8.3) - 1, 0, M(-4.4) - 1, M(-8.3) + 1, 6, M(-4.4) + 1, 0x8a7a4a);   // her broom
    // overhead: two cross beams (the near one broken), a cage with bones over the herb rack, daughters on the beams and on a thread
    w.box(-131, 58, -146, 131, 61, -143, LOGC);
    w.box(-131, 56, -116, -34, 59, -113, LOGC).box(40, 56, -116, 131, 59, -113, LOGC).box(-38, 58, -116, -34, 59, -113, null).box(40, 58, -116, 44, 59, -113, null);
    cage(w, 92, 56, -114, 14, { bones: true });
    spider(w, -70, 64, -144, 0); spider(w, 30, 64, -144, 1); spider(w, -100, 62, -114, 3); spider(w, 74, 62, -114, 0); spider(w, -60, 62, -114, 1);
    w.box(16, 46, -120, 16, 56, -120, 0xb8b8c8); spider(w, 16, 39, -111, 0);
    for (const [x, z, r] of [[-6.4, -5.6, 1], [6.8, -4.2, 3], [-7.0, 0.6, 1]] as const) spider(w, M(x), 2, M(z), r);
    sac(w, -2.6, -8.1, 2, 0x8e887c, 0x9aff3a, 62); sac(w, 2.9, -10.2, 3, 0x8e887c, 0x9aff3a, 62);
    // candle clusters around the room's edges
    for (const [x, z, lit] of [[-5.9, 1.2, 0], [6.1, 0.8, 1], [-6.0, 4.0, 0], [6.0, 4.2, 0], [1.4, -8.6, 1], [-6.2, -7.6, 0]] as const) { const p = candles(w, M(x), 0, M(z), 0x3a2a44, CURSE, [6, 4, 2]); if (lit) c.light([p[0], 0.6, p[2]], 0xb060ff, 2.5, 4); }
    outskirts(c, 7, RING_OUT);
    webs(c, [[-8.5, 3.9, -10.6, 0.785, 0.65], [8.5, 3.9, -10.6, -0.785, 0.65], [-8.55, 2.4, -7.2, 1.57, 0.5], [8.55, 2.4, -6.6, -1.57, 0.5], [-5.6, 4.1, -8.0, 0, 0.45], [5.0, 4.1, -8.0, 0, 0.45], [1.2, 4.3, -10.1, 0, 0.5], [-7.9, 3.4, 1.6, 0, 0.4]]);
    dress(c, 'house', { seed: 13, dense: 0.4, hang: [[-8.8, -11.2, 8.8, -11.2, 's'], [-9.2, -11, -9.2, -2.2, 'e'], [9.2, -11, 9.2, -2.2, 'w']],
      clear: [{ x0: -8.8, z0: -10.8, x1: -1.0, z1: -7.0 }, { x0: 3.4, z0: -10.8, x1: 8.8, z1: -7.6 }] });
  },
};
void [SLATE, LANT, PLAS, WD_DD, WD_L, BOOKS, cupboard, IRN_L, setts];
