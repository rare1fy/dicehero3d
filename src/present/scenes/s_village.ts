// The village square and the interiors: cottage, chapel, and the coven matriarch nest (boss) — all of it left to rot under the endless
// Duskwood night. The interiors are whole houses: full-height walls in the world, the roof (trusses, purlins, stepped rafters, tile
// courses, holes fallen through), the front wall and the gables in the cutaway layer (c.cut), which the stage hides while the camera
// looks down into the room; the wall heads that remain carry a dark cap so the cut reads as a clean section. Back walls stay the
// richest (fireplace / altar niche / cauldron hood); furniture keeps its groups, but knocked over, emptied, spoiled; warm light is
// rare (a low fire, the altar candles, one window), moonlight comes through roof holes and broken windows; ivy, weeds and roots get in.
// The battle floor (PLAY) stays flat: only flush floor patterns and decals inside it.
import { type SceneDef, type Ctx, type Mood } from './stage';
import { M, AREA, tiles, patches } from './props';
import { pine, deadTree } from './flora';
import { NIGHT, HOUSE, BARK, BARK_D, PINE, PINE_T, GROUT, CURSE, floorEarth } from './common';
import { dress } from './dress';
import {
  Run, buildWall, opening, curtains, boards, flags, setts, rug, brick, ashlar, shade, darkPanes, boardedUp, roof, floorHole, slateHeap, crow,
  candleStick, candles, pot, bowl, jug, bookFlat, openBook, loaf, skullAt,
  tableK, chairK, chairDown, benchK, stoolK, bedK, chestK, nightstand, bookshelf, dresser, counter, shelfOn, jarOn, bottleOn, books,
  barrelK, crateK, sackK, woodStack, hangLantern, chandelier, herbs, fireplace, banner, column, pew, arcade, stained, cauldron, cage, spider,
  root, sac, well, house, stall, noticeBoard, cart, lampPost, picket, hay, loc,
  WD, WD_D, WD_L, WD_DD, TIM_D, ST, ST_L, ST_D, ST_DD, MORT, IRN, IRN_L, BRASS, LINEN, WAX, FLM, SLATE, SLATE_D, SLATE_L, BONE_C,
} from './k_village';
import { CELL } from '../bestiary/kit';

/** pines and (mostly) dead trees standing outside a room's walls (never inside it) */
function outskirts(c: Ctx, seed: number, spots: Array<[number, number]>) {
  spots.forEach(([x, z], i) => {
    if ((i + seed) % 3 !== 0) deadTree(c.w, x, z, 5.5 + (i % 3) * 0.7, BARK, BARK_D, { seed: i + seed });
    else pine(c.w, x, z, 6.5 + ((i * 7 + seed) % 5) * 0.5, BARK_D, PINE, PINE_T);
  });
}
/** grey cobwebs: [x, y (top), z, yaw, scale] */
function webs(c: Ctx, list: Array<[number, number, number, number, number]>) { for (const [x, y, z, ry, s] of list) c.cards.add('web', x, z, { y, ry, s, tint: 0xa0a0b0 }); }
/** ivy climbing a wall face from the floor: n strips side by side, tallest in the middle (ry = the way the wall faces) */
function ivy(c: Ctx, x: number, z: number, ry: number, h: number, n = 3, kinds = ['vine', 'deadvine']) {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.62, hh = h * (1 - Math.abs(i - (n - 1) / 2) * 0.28);
    c.cards.add(kinds[i % kinds.length], x + Math.cos(ry) * off, z - Math.sin(ry) * off, { y: hh, ry, s: hh / (32 * CELL), tint: i & 1 ? 0xa8a890 : 0x9aa888 });
  }
}
/** dry weeds in a small clump at each spot */
function tufts(c: Ctx, spots: Array<[number, number]>, kind = 'weeds', tint = 0xb8ae90, y = 0) {
  for (const [x, z] of spots) for (let k = 0; k < 3; k++) c.cards.add(kind, x + (k - 1) * 0.16, z + (((k * 7) % 3) - 1) * 0.12, { y, s: 0.55 + k * 0.14, tint });
}
/** inside the ruins: the chapter's cold night, the sky light a little stronger so a dark room still reads */
const INSIDE: Mood = { ...HOUSE, hemiI: HOUSE.hemiI + 0.1, hemiSky: 0x6c74aa };
const RING_OUT: Array<[number, number]> = [[-10.4, -12.6], [-12.6, -8.4], [-10.8, -3.4], [-12.4, 2.6], [10.6, -12.8], [12.4, -7.8], [10.9, -2.6], [12.3, 3.2], [-4.6, -14.0], [4.2, -14.2], [0.2, -15.4]];

// ==================================================================== 荒村广场
export const village: SceneDef = {
  id: 'n_village', name: '荒村广场', group: '普通', kind: '户外', blurb: '村民在一夜之间消失，井边的水桶还挂着。', mood: NIGHT, foes: ['forest_ghoul', 'forest_banshee'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x282c24, 0x2c3026, 0x2e2e28]);
    // the square: a raised curb, flagstones in courses gone grey-green, setts round the well and up to it; slabs lost at the edges,
    // slabs heaved by the dead tree's roots
    const PX0 = M(-7.6), PX1 = M(7.7), PZ0 = M(-9.6), PZ1 = M(6.6);
    flags(w, { X0: PX0, X1: PX1, Z0: PZ0, Z1: PZ1 }, [0x54525c, 0x5a5862, 0x4e5250], GROUT, 10, 3);
    setts(w, { X0: -32, X1: 32, Z0: PZ0, Z1: M(-6.0) }, [0x625f6c, 0x5a5864], GROUT, 5);
    setts(w, { X0: -11, X1: 11, Z0: M(-6.0), Z1: PZ1 }, [0x625f6c, 0x5a5864], GROUT, 5);
    for (let x = PX0 - 2; x <= PX1 + 2; x++) for (let z = PZ0 - 2; z <= PZ1 + 2; z++) {
      const e = Math.min(x - (PX0 - 2), PX1 + 2 - x, z - (PZ0 - 2), PZ1 + 2 - z); if (e > 2) continue;
      w.set(x, -1, z, e === 2 ? 0x5e5c66 : ST_D); if (e < 2 && z > PZ0 - 2 && !((x >> 4) % 5 === 2)) w.set(x, 0, z, (Math.floor((x + z) / 9) & 1) ? ST_D : 0x46444e);
    }
    for (const [x0, z0, x1, z1] of [[-7.4, 3.0, -6.2, 4.2], [6.0, -1.9, 7.3, -0.8], [-7.3, -9.3, -6.1, -8.5], [5.8, 4.4, 7.1, 5.4], [-3.4, -9.4, -2.4, -8.8]] as const) {
      w.box(M(x0), -1, M(z0), M(x1), -1, M(z1), 0x262420).box(M(x0) + 3, -1, M(z0) - 2, M(x1) - 3, -1, M(z0) - 1, 0x262420);
      tufts(c, [[(x0 + x1) / 2, (z0 + z1) / 2], [x0 + 0.2, z1 - 0.2]], 'grass', 0x9aa080);
    }
    for (const [x, z, h] of [[-7.2, 4.4, 2], [-6.8, 5.3, 1], [-7.4, 5.6, 1]] as const) { const X = M(x), Z = M(z); w.box(X - 5, 0, Z - 3, X + 5, h - 1, Z + 3, 0x56545e).box(X - 5, h - 1, Z - 3, X + 5, h - 1, Z - 3, 0x6a6872); }
    c.cards.add('roots', -7.6, 4.0, { y: 0.3, ry: Math.PI / 2, s: 0.5, tint: 0x8a7a6a });
    // the well, the focus: in front of the dark alley; its lantern the last warm light in the square
    const wl = well(w, 0, -7.85); c.light(wl, 0xff9a48, 3.5, 7); c.flame(wl, 0xffb060, 0.07);
    crow(w, 7, 51, M(-7.85), 1); crow(w, -9, 51, M(-7.85) - 1, 3);
    w.box(M(1.7), 0, M(-9.3), M(3.4), 5, M(-8.6), ST).box(M(1.7) + 1, 2, M(-9.3) + 1, M(3.4) - 1, 5, M(-8.6) - 1, null).box(M(1.7) + 1, 2, M(-9.3) + 1, M(3.4) - 1, 2, M(-8.6) - 1, 0x0a1220).box(M(2.6), 4, M(-9.3), M(3.0), 5, M(-9.3), null);   // a cracked trough
    { const X = M(-2.2), Z = M(-6.8); w.box(X, 0, Z, X + 5, 4, Z + 4, WD_D).box(X + 1, 0, Z, X + 1, 4, Z + 4, IRN).box(X + 5, 1, Z + 1, X + 5, 3, Z + 3, 0x1a1418); }   // the other bucket, on its side
    // the houses behind it: doors fallen or gaping, windows boarded or dark — one still lit; plaster off in patches; roofs holed
    house(w, M(-11.4), M(-2.8), M(-10.2), { depth: 48, H: 40, door: M(-4.6), doorState: 'fallen', wins: [M(-9.6), M(-6.9)], winState: ['boarded', 'dark'], chimney: M(-8.2), sign: M(-3.4),
      peel: [[-123, 18, -109, 30], [-157, 8, -146, 17], [-62, 30, -52, 38], [-100, 30, -90, 37]], roofHoles: [[-104, -176, -76, -152]] });
    house(w, M(2.9), M(11.6), M(-10.5), { depth: 48, H: 36, gable: true, door: M(8.6), doorState: 'open', wins: [M(4.4), M(6.6)], winState: ['dark', 'lit'], upWin: 'dark', plaster: 0x726c64, roof: [0x40363a, 0x2c2426, 0x4e4246],
      peel: [[48, 10, 58, 22], [128, 18, 140, 30]], roofHoles: [[62, -214, 92, -168]] });
    c.light([6.6, 1.4, -10.0], 0xc07a38, 2.2, 3.5);
    crow(w, M(-6.0), 66, M(-12.4), 0);
    // the alley wall and gate: one leaf hanging, the other flat in the mud, the gate lamp dead
    for (let x = M(-2.8); x <= M(2.9); x++) { const gate = Math.abs(x) <= 9; w.box(x, -2, M(-13.0), x, gate ? 1 : 14 - ((x > 20 && x < 32) ? 5 : 0), M(-12.7), gate ? ST_D : brick(x, 0, ST_D, ST_DD)); if (!gate && !(x > 20 && x < 32)) w.set(x, 15, M(-12.85), ST); }
    for (const s of [-1, 1]) w.box(s * 10, 0, M(-12.85), s * 10 + s, 22, M(-12.85) + 1, 0x3a322c);
    w.box(-9, 2, M(-12.85), -1, 16, M(-12.85), 0x3e342c).box(-9, 9, M(-12.85), -1, 9, M(-12.85), 0x5a3a26);
    w.box(1, 0, M(-12.85) + 2, 9, 0, M(-12.85) + 16, 0x3e342c);
    w.box(-12, 20, M(-12.85), -12, 20, M(-12.85) + 4, IRN); hangLantern(w, -12, 19, M(-12.85) + 4, 1, 0xd08a40, false);
    // the left side: a lean-to stable gone grey, its roof holed, rotten hay; the stall in tatters
    const SX = M(-11.8), SZ0 = M(-8.6), SZ1 = M(-3.0), SF = M(-9.6);
    w.box(SX, -2, SZ0, SX + 3, 30, SZ1, 0x66605a).box(SX, -2, SZ0, SX + 3, 6, SZ1, ST_D);
    for (const z of [SZ0, SZ1]) w.box(SX, -2, z, SF, 26, z + 2, 0x3a322c).box(SX, 7, z, SF, 24, z + 2, 0x726c62);
    for (const z of [SZ0, (SZ0 + SZ1) >> 1, SZ1]) w.box(SF - 1, 0, z, SF + 1, 27, z + 2, 0x3a322c);
    for (let k = 0; k < 4; k++) { const y = 28 + k * 3, x1 = SF + 4 - k * 9; w.box(SX - 2, y, SZ0 - 3, x1, y + 2, SZ1 + 5, k & 1 ? 0x463a36 : 0x3e3430); w.box(x1, y, SZ0 - 3, x1, y, SZ1 + 5, 0x2a2224); }
    w.box(SX - 2, 28, M(-6.4), SF + 4, 40, M(-5.4), null);
    hay(w, -10.6, -7.6, 1); hay(w, -10.6, -6.4, 1); w.box(M(-10.6) - 7, 0, M(-7.0) - 7, M(-10.6) + 7, 7, M(-7.0) + 7, 0x7a6a42).box(M(-10.6) - 7, 7, M(-7.0) - 7, M(-10.6) + 7, 7, M(-7.0) + 7, 0x8a7a4e);
    crateK(w, -10.4, -4.2, 5, 0x5a5044, 0x3a322c); sackK(w, -9.4, -3.8, 0x6a6048, 0x4a4036);
    stall(w, -7.0, -3.4, 1, 15);
    barrelK(w, -6.4, -6.0, 0x4c4036, 0x4a2e22, 0x5a5044); { const X = M(-7.3), Z = M(-6.5); w.box(X - 4, 0, Z - 3, X + 4, 6, Z + 3, 0x4c4036).box(X - 4, 2, Z - 3, X + 4, 2, Z + 3, 0x4a2e22).box(X - 3, 1, Z - 2, X + 3, 6, Z + 2, 0x1a1418); }   // a barrel staved in
    sackK(w, -6.1, -1.0, 0x6a6048, 0x4a4036);
    lampPost(w, -5.9, -7.5, 'x', false); lampPost(w, 6.1, -7.5, '-x', false);
    // the right side: torn notices, barrels and crates by the gable house, the broken cart, a bench
    noticeBoard(w, 7.2, -5.2, 3); crow(w, M(7.2), 33, M(-5.2) - 6, 2);
    barrelK(w, 9.4, -8.6, 0x4c4036, 0x4a2e22, 0x5a5044); crateK(w, 10.4, -8.4, 5, 0x5a5044, 0x3a322c); { const X = M(8.4), Z = M(-8.9); w.box(X - 4, 0, Z - 5, X + 4, 1, Z + 5, 0x4c4036).box(X - 4, 2, Z - 5, X + 4, 2, Z - 3, 0x4a2e22); }   // a barrel burst flat
    cart(w, 7.9, 1.0, 0); sackK(w, 7.4, 2.8, 0x6a6048, 0x4a4036);
    { const b = loc(w, M(-6.3), M(2.2), 1); b(-11, 6, -2, 0, 6, 2, 0x5a5044); b(1, 2, -2, 11, 2, 2, 0x5a5044); b(-10, 0, -2, -9, 5, 2, 0x3a322c); b(-3, 0, -2, -2, 5, 2, 0x3a322c); }   // a bench snapped in two
    // planters gone to weeds, the fences down in places, dead trees
    for (const [x, z] of [[-6.8, 5.2], [6.9, 5.2]] as const) { const X = M(x), Z = M(z); w.box(X - 9, 0, Z - 4, X + 9, 5, Z + 4, ST_D).box(X - 8, 5, Z - 3, X + 8, 5, Z + 3, 0x1e1a16).box(X - 9, 5, Z - 4, X + 9, 5, Z - 4, ST); w.box(X + 4, 3, Z - 4, X + 9, 5, Z - 4, null); tufts(c, [[x - 0.3, z], [x + 0.3, z + 0.05]], 'weeds', 0xa89a78, 0.42); }
    picket(w, -10.2, -1.6, 8.0, 'z', 11, 0x3a322c, 0x4c4036); picket(w, 10.4, -1.6, 8.0, 'z', 11, 0x3a322c, 0x4c4036);
    for (const [x, z0, z1] of [[-10.2, 0.9, 2.8], [10.4, -0.4, 1.4], [10.4, 3.9, 5.2]] as const) { const X = M(x); w.box(X, 0, M(z0), X + 1, 12, M(z1), null); w.box(X + (x < 0 ? 2 : -12), 0, M(z0), X + (x < 0 ? 12 : -2), 0, M(z1), 0x4c4036); w.box(X + (x < 0 ? 4 : -10), 0, M(z0), X + (x < 0 ? 4 : -10), 0, M(z1), 0x3a322c); }
    deadTree(w, -9.6, 4.6, 6, BARK, BARK_D, { seed: 3 }); deadTree(w, 10.0, 5.2, 5, BARK, BARK_D, { seed: 8 });
    outskirts(c, 3, [[-0.4, -14.6], [-1.8, -16.0], [2.0, -15.8], [-12.8, -10.2], [12.8, -9.6], [-12.6, 0.4], [12.4, -2.2]]);
    ivy(c, -5.5, -10.12, 0, 2.2, 3); ivy(c, 10.6, -10.42, 0, 2.6, 4); ivy(c, -9.0, -10.12, 0, 1.6, 2);
    dress(c, 'grave', { seed: 3, dense: 0.8, clear: [{ x0: -11.9, z0: -8.7, x1: -9.5, z1: -2.9 }],
      hang: [[-11.4, -10.7, -2.8, -10.7, 's'], [2.9, -11.0, 11.6, -11.0, 's']], shafts: [[0.2, -8.2, 0.3, 0.25, 1.2]] });
  },
};

// ==================================================================== 荒屋
const CP = 0x857d70, CPD = 0x6c665c, CT = 0x3e322a, CTD = 0x2a221c;
export const cottage: SceneDef = {
  id: 'n_cottage', name: '荒屋', group: '普通', kind: '室内', blurb: '屋顶早已塌了，壁炉的火却不知被谁点着。', mood: INSIDE, foes: ['forest_wraith_cultist', 'forest_ghoul'],
  build(c) {
    const w = c.w, cut = c.cut, H = 78; floorEarth(c); c.cutEaves(3.4);
    // floor: boards across the room, along z in the side bays behind a dark sleeper, hearth flags; the rug faded and half torn away
    const FL = [0x5e5246, 0x66584a, 0x564a40], FS = 0x261e18;
    boards(w, { X0: -79, X1: 79, Z0: -150, Z1: 96 }, 'x', FL, FS, 34, 5, 4);
    boards(w, { X0: -120, X1: -81, Z0: -150, Z1: 96 }, 'z', FL, FS, 30, 5, 5); boards(w, { X0: 81, X1: 120, Z0: -150, Z1: 96 }, 'z', FL, FS, 30, 5, 6);
    for (const x of [-80, 80]) w.box(x, -1, -150, x, -1, 96, CTD);
    flags(w, { X0: -36, X1: 36, Z0: -132, Z1: -118 }, [ST_D, ST, 0x5a5862], MORT, 7, 3);
    const torn = (x: number, z: number) => (x >= 22 && z <= -50) || (x >= 34 && z <= -38) || (x <= -28 && z >= 18) || (x <= -36 && z >= 8) || (x >= 6 && x <= 14 && z >= 4 && z <= 30);
    rug(w, { X0: -44, Z0: -74, X1: 48, Z1: 30 }, { field: 0x3a2a2c, band: 0x5a4c38, edge: 0x1e1618, motif: 0x6e6044, fringe: 0x7a7266 }, { skip: torn });
    floorHole(w, M(-8.2), M(-0.5), M(-7.4), M(0.0)); floorHole(w, M(4.3), M(-9.1), M(5.0), M(-8.6)); floorHole(w, M(5.8), M(4.3), M(6.6), M(4.8));
    tufts(c, [[-7.8, -0.2], [4.6, -8.8], [6.2, 4.6]], 'grass', 0x8a9a78, -0.07);
    // walls, all full height: plaster between timber posts and rails on a stone footing, the plaster off in big patches (brick and
    // lath behind); a dark plate on every wall head where the roof was cut away
    const B = new Run(w, 'x', -151, -1), L = new Run(w, 'z', -121, -1), R = new Run(w, 'z', 121, 1);
    const peel = (rs: Array<[number, number, number, number]>) => (a: number, y: number) => rs.some(([a0, y0, a1, y1]) => a >= a0 && a <= a1 && y >= y0 && y <= y1);
    const body = (p: (a: number, y: number) => boolean) => (a: number, y: number) => (p(a, y) ? ((y % 5 === 4) ? 0x3a2e26 : brick(a, y, 0x625650, 0x40362e, 7, 4)) : y < 14 ? CPD : CP);
    const bB = body(peel([[-112, 14, -100, 30], [-108, 30, -94, 42], [74, 10, 90, 24], [96, 34, 112, 52], [-40, 44, -24, 56]]));
    const bL = body(peel([[-44, 10, -28, 26], [-140, 30, -126, 48], [24, 44, 40, 60]])), bR = body(peel([[-90, 14, -76, 30], [-24, 40, -8, 58], [70, 12, 84, 24]]));
    const wall = { t: 5, cPlinth: ST_D, cCap: ST, cPost: CT, rails: [[7, 2, CT], [32, 2, CT], [58, 2, CT]] as Array<[number, number, number]>, top: CTD, full: H };
    buildWall(B, -126, 126, () => H, { ...wall, body: bB, posts: [-126, -96, -38, 35, 93, 124] });
    buildWall(L, -156, 98, () => H, { ...wall, body: bL, posts: [-153, -112, -88, -50, -17, 19, 55, 96] });
    buildWall(R, -156, 98, () => H, { ...wall, body: bR, posts: [-153, -112, -86, -40, -4, 62, 96] });
    w.box(-126, -2, 95, 126, 4, 99, ST_D).box(-126, 5, 95, 126, 5, 99, ST);
    // the cutaway: the front wall (door, boarded windows), the roof with its trusses, rafters and two holes fallen through
    const FC = new Run(cut, 'x', 95, 1);
    buildWall(FC, -120, 120, () => H, { ...wall, from: 6, body: bL, posts: [-120, -90, -40, 38, 88, 118] });
    opening(FC, 0, 6, 8, 32, { t: 5, frame: CT, lintel: CTD }); for (const ac of [-62, 62]) opening(FC, ac, 24, 7, 16, { t: 5, frame: CT, sill: ST_L, glass: boardedUp(7, 16, ac > 0 ? 1 : 0), glassD: 2 });
    roof(cut, { axis: 'x', a0: -125, a1: 125, b0: -155, b1: 99, E: 81, run: 14, rise: 7, over: 5, tiles: [0x3e404c, 0x2a2c36, 0x4e505c], moss: 0x3c4838, wood: 0x4a3a2e, woodD: 0x30261e,
      trusses: [-88, -30, 30, 88], rafterEvery: 12, holes: [[80, -43, 116, 24], [92, 24, 110, 36], [-88, -132, -56, -104], [-14, -152, 14, -142]], gableT: 5, gable: (b, y) => (y % 7 === 6 ? CT : (b & 1 ? CP : CPD)) });
    // the fireplace: a low fire someone lit, the painting fallen face-up on the hearth, one candlestick knocked over
    const fp = fireplace(B, 0, 96, { low: true, bare: true });
    c.light([fp.fire[0], 0.6, fp.fire[2] + 0.7], 0xff7a30, 7, 9); c.flame([fp.fire[0], fp.fire[1] - 0.12, fp.fire[2]], 0xffa040, 0.09);
    { const zm = -151 + 12; candleStick(w, -21, 24, zm, 3, BRASS, false); w.box(17, 24, zm, 22, 24, zm, BRASS).box(23, 24, zm, 24, 24, zm, WAX);
      for (const [a, h, cc] of [[8, 3, 0x6a4a36], [11, 4, 0x9a9078]] as const) jarOn(B, a, -11, 24, h, cc, shade(cc, 0.7));
      w.box(-8, 0, -129, 8, 0, -120, TIM_D).box(-7, 0, -128, 7, 0, -121, 0x26324a).box(-7, 0, -124, 7, 0, -121, 0x2a3e2a).box(3, 0, -127, 4, 0, -126, 0xb8b098); }
    B.box(27, -14, 0, 28, -13, 1, IRN).box(28, -14, 2, 28, -14, 14, IRN).box(27, -14, 14, 29, -14, 14, IRN); w.box(30, 0, -137, 30, 0, -128, IRN_L);   // the poker on the floor
    woodStack(w, -2.15, -10.05, 0, 2, 1);
    // windows: the left one boarded, the right one dark and smashed, the curtains faded to rags; side windows the same
    opening(B, -66, 22, 8, 18, { t: 5, frame: CT, sill: ST_L, glass: boardedUp(8, 18, 0), glassD: 3 }); opening(B, 60, 22, 8, 18, { t: 5, frame: CT, sill: ST_L, glass: darkPanes(8, 18, CTD, 1), glassD: 3 });
    curtains(B, -66, 22, 8, 18, 0x4a3434, 0x3e2c2c, 0x2a1c1c, true); curtains(B, 60, 22, 8, 18, 0x4a3434, 0x3e2c2c, 0x2a1c1c, true);
    opening(L, -71, 22, 6, 22, { t: 5, frame: CT, sill: ST_L, glass: darkPanes(6, 22, CTD, 2), glassD: 3 }); opening(L, 37, 22, 6, 20, { t: 5, frame: CT, sill: ST_L, glass: boardedUp(6, 20, 1), glassD: 3 });
    opening(R, -132, 24, 6, 22, { t: 5, frame: CT, sill: ST_L, glass: darkPanes(6, 22, CTD, 3), glassD: 3 });
    // the side door: torn off its hinges, flat on the floor inside; threshold and step
    opening(R, -54, 0, 7, 32, { t: 5, frame: CT, lintel: CTD }); R.box(-61, -1, -1, -47, 5, -1, ST_L); R.box(-62, 5, -2, -46, 10, -1, ST);
    for (let d = -17; d <= -3; d++) R.box(-61, d, 0, -47, d, 0, (d + 17) % 3 === 0 ? 0x3a3028 : 0x4c4036); R.box(-61, -14, 1, -47, -13, 1, 0x4a2e22); R.box(-61, -6, 1, -47, -5, 1, 0x4a2e22);
    // a breach in the left wall near the front, in wide steps; its rubble inside
    for (const [y0, y1, a0, a1] of [[10, 17, 62, 78], [18, 31, 58, 82], [32, 39, 62, 78], [40, 45, 66, 74]] as const) L.box(a0, -1, y0, a1, 5, y1, null);
    { const X = M(-8.0), Z = M(4.9); w.box(X - 5, 0, Z - 8, X + 5, 2, Z + 8, ST_D).box(X - 3, 3, Z - 5, X + 5, 4, Z + 5, 0x625650).box(X, 5, Z - 2, X + 5, 6, Z + 3, ST_D); }
    // kitchen: the counter with a pot on its side, bread gone to stone, a jug; jars on the shelf, one fallen; the dresser, plates broken
    counter(w, -4.76, -10.22, 0, 52);
    { const y = 14; w.box(-90, y, -147, -86, y + 4, -143, IRN).box(-90, y + 1, -146, -90, y + 3, -144, 0x1a1418); w.box(-79, y, -148, -72, y, -143, 0x6a5040); loaf(w, -76, y + 1, -146); jug(w, -63, y, -147, 0x6a4a36); bowl(w, -55, y, -145, 0x6a5040, 0x4a4030); w.box(-50, y, -147, -46, y + 1, -145, 0x6a4a36); }
    shelfOn(B, -96, -81, 30, 5); for (const [a, h, cc] of [[-94, 4, 0x6a4a36], [-88, 5, 0x5a6470]] as const) jarOn(B, a, -2, 31, h, cc, shade(cc, 0.7));
    w.box(-85, 14, -146, -82, 15, -144, 0x6a4a36);
    herbs(w, -95, -82, 29, -149, 2, [0x5a5640, 0x4a4436], 3);
    dresser(w, -8.05, -8.6, 1); for (const [x, z] of [[-7.4, -7.4], [-7.0, -8.0]] as const) w.box(M(x) - 1, 0, M(z) - 1, M(x) + 1, 0, M(z) + 1, 0xb8b2a4);
    banner(L, -100, 44, 5, 16, 0x2a3530, 0x6a5a3a, 0x7a6a48);
    // the table: the meal still on it, the candle burnt out; one chair pushed back, two knocked over, the bench
    const ty = tableK(w, -6.95, -3.5, 1, 28, 16, 0x6a5040, 0x3e3028);
    chairK(w, -5.7, -4.5, 3, 0x56443a, 0x3a3028); chairDown(w, -5.95, -2.6, 1, 0x56443a, 0x3a3028); chairK(w, -6.95, -5.35, 0, 0x56443a, 0x3a3028); chairDown(w, -6.95, -1.35, 2, 0x56443a, 0x3a3028);
    benchK(w, -8.05, -3.5, 1, 24);
    { const X = M(-6.95), Z = M(-3.5); candleStick(w, X, ty, Z, 1, BRASS, false); bowl(w, X + 3, ty, Z - 8, 0x6a5040, 0x5a4a30); bowl(w, X - 3, ty, Z + 7, 0x6a5040, 0x4a4030); w.box(X + 2, ty, Z + 8, X + 6, ty + 2, Z + 10, 0x6a4a36).box(X + 6, ty, Z + 9, X + 6, ty + 1, Z + 9, 0x1a1418); loaf(w, X - 4, ty, Z - 6); bookFlat(w, X + 3, ty, Z + 3, 0x4a2a2a, 0xa8a090, false); }
    // front left: barrels (one staved in), sacks slumped, a crate, the broom fallen
    barrelK(w, -7.7, 1.4, 0x4c4036, 0x4a2e22, 0x5a5044); { const X = M(-6.8), Z = M(2.3); w.box(X - 4, 0, Z - 3, X + 4, 6, Z + 3, 0x4c4036).box(X - 4, 2, Z - 3, X + 4, 2, Z + 3, 0x4a2e22).box(X - 3, 1, Z - 2, X + 3, 6, Z + 2, 0x1a1418); }
    sackK(w, -7.8, 2.9, 0x6a6048, 0x4a4036); crateK(w, -7.4, 3.9, 4, 0x5a5044, 0x3a322c);
    w.box(M(-8.0), 0, M(-1.8), M(-8.0), 0, M(-0.4), 0x6a5a44).box(M(-8.0) - 1, 0, M(-0.4), M(-8.0) + 1, 1, M(0.0), 0x8a7a50);
    // the bed: blanket gone grey, a pillow on the floor; the candle out; the chest; the bookcase half emptied onto the floor
    bedK(w, 7.63, -9.45, 0, 0x3a3a46, 0x5a5038); w.box(M(6.2) - 3, 0, M(-8.1) - 2, M(6.2) + 3, 2, M(-8.1) + 2, 0xa8a294);
    { const ny = nightstand(w, 5.85, -10.2, 0); candleStick(w, M(5.85), ny, M(-10.2), 1, BRASS, false); }
    chestK(w, 7.63, -7.98, 0, 0x4c4036, 0x4a2e22);
    bookshelf(w, 8.19, -6.4, 3, 12, 32, 7, [0x4a2a2a, 0x2a3646, 0x34402e, 0x5a4a2a, 0x3a2a3a], 0.45);
    for (const [x, z, n, cc] of [[7.4, -5.6, 3, 0x4a2a2a], [7.0, -6.8, 2, 0x2a3646], [6.6, -6.0, 1, 0x5a4a2a]] as const) for (let k = 0; k < n; k++) bookFlat(w, M(x) + (k & 1), k * 3, M(z) - k, [cc, 0x34402e, 0x3a2a3a][k], 0x9a9282, (k & 1) === 0);
    // where the roof came in: the fallen beam, slate heaps, broken rafters; barrels, crates; the firewood stack
    w.box(M(6.2), 0, M(-1.9), M(6.5), 3, M(1.5), CT).box(M(6.2), 4, M(1.5) - 2, M(6.5) - 2, 4, M(1.5), CTD);
    slateHeap(w, 7.5, 0.0, 5, [0x2a2c36, 0x3e404c, 0x4e505c]); slateHeap(w, 7.2, -1.6, 4, [0x2a2c36, 0x3e404c, 0x4e505c], 'z'); slateHeap(w, -5.1, -8.3, 4, [0x2a2c36, 0x3e404c, 0x4e505c]);
    crateK(w, 7.5, 2.9, 5, 0x5a5044, 0x3a322c); barrelK(w, 6.4, 3.9, 0x4c4036, 0x4a2e22, 0x5a5044); sackK(w, 6.3, 2.6, 0x6a6048, 0x4a4036);
    for (const [x, z, l, ax] of [[5.9, -2.6, 9, 1], [7.0, 1.2, 7, 0], [-6.0, 0.4, 8, 1], [-5.8, 4.6, 6, 0], [-4.4, -7.4, 10, 1]] as const) { const X = M(x), Z = M(z); w.box(X, 0, Z, X + (ax ? l : 1), 0, Z + (ax ? 1 : l), 0x6a5a44).box(X, 0, Z, X + (ax ? 1 : 0), 0, Z + (ax ? 1 : 0), CTD); }
    woodStack(w, 8.21, 4.6, 3, 6, 3);
    // overhead in the room: tie-beam stubs on the side walls, the dead lantern, herbs dried to straw
    w.box(-120, 49, -138, -30, 52, -135, CT).box(-35, 51, -138, -30, 52, -135, null).box(-34, 49, -138, -30, 49, -135, CTD);
    w.box(40, 49, -138, 120, 52, -135, CT).box(40, 51, -138, 45, 52, -135, null);
    for (const x of [-120, 117]) w.box(x, 44, -138, x + 3, 48, -135, CTD);
    hangLantern(w, -42, 48, -136, 12, 0xd08a40, false);
    herbs(w, 76, 116, 49, -136, 1, [0x5a5640, 0x6a5a44, 0x4a4436]);
    // the night getting in: moonlight down the roof holes and the broken windows, ivy through the breach, webs, a cold fill
    c.shaft(7.0, -0.8, { w: 1.6, tilt: 0.22, yaw: 0.5, a: 0.24 }); c.shaft(-5.1, -8.3, { w: 1.2, tilt: 0.2, yaw: 0.3, a: 0.2 });
    c.light([7.0, 3.2, -0.6], 0x6a78d8, 3, 6);
    for (const [x, z] of [[-3.4, -6.0], [3.6, 3.8], [-2.0, 4.6]] as const) c.cards.add('pages', x, z, { y: 0.01, s: 0.8, ry: 0, tint: 0x8a8478 });
    ivy(c, -8.37, 3.8, Math.PI / 2, 2.6, 4); ivy(c, -8.37, 6.0, Math.PI / 2, 1.8, 2); ivy(c, 4.2, -10.47, 0, 1.6, 2); ivy(c, 8.37, -3.0, -Math.PI / 2, 2.2, 3);
    webs(c, [[-8.25, 4.6, -10.35, 0.785, 0.9], [8.25, 4.0, -10.35, -0.785, 0.8], [-8.3, 2.8, -6.4, 1.57, 0.6], [-3.0, 3.6, -9.5, 0, 0.5], [8.3, 3.0, 3.0, -1.57, 0.6], [-6.95, 1.4, -3.5, 0, 0.35]]);
    outskirts(c, 4, RING_OUT);
    dress(c, 'house', { seed: 4, dense: 0.7, hang: [[-8.4, -10.8, 8.4, -10.8, 's'], [-8.8, -10.2, -8.8, 5.0, 'e'], [8.8, -10.2, 8.8, 5.0, 'w']],
      shafts: [[4.2, -8.6, 1.57, 0.42, 0.9], [-6.9, -5.0, 0, -0.5, 0.8]],
      clear: [{ x0: -8.4, z0: -10.5, x1: -2.6, z1: -7.4 }, { x0: -8.4, z0: -5.8, x1: -5.4, z1: -0.8 }, { x0: 5.4, z0: -10.5, x1: 8.4, z1: -5.2 }] });
  },
};

// ==================================================================== 残破礼拜堂
const CH = 0x625f72, CH2 = 0x5a586c, CHM = 0x4a485c, CH_L = 0x747286, CH_D = 0x46445a;
export const chapel: SceneDef = {
  id: 'n_chapel', name: '残破礼拜堂', group: '普通', kind: '室内', blurb: '月光从空窗框里落在长椅上，祭台的蜡烛还在烧。', mood: INSIDE, foes: ['forest_wraith_cultist', 'elite_necromancer'],
  build(c) {
    const w = c.w, cut = c.cut, H = 86; floorEarth(c); c.cutEaves(3.4);
    // floor: nave flagstones, a dark band along each colonnade, tiles in the aisles, the altar steps, the runner faded and torn
    flags(w, { X0: -77, X1: 77, Z0: -151, Z1: 96 }, [0x545262, 0x5a586a, 0x50525a], GROUT, 11, 5);
    for (const s of [-1, 1]) for (let x = 78; x <= 92; x++) for (let z = -151; z <= 96; z++) w.set(s * x, -1, z, mod14(z) ? GROUT : x === 78 || x === 92 ? 0x625f74 : 0x46445a);
    tiles(w, { x0: 6.6, z0: -10.6, x1: 8.65, z1: 6.7 }, [0x525062, 0x585668], GROUT, { size: 8 }); tiles(w, { x0: -8.65, z0: -10.6, x1: -6.6, z1: 6.7 }, [0x525062, 0x585668], GROUT, { size: 8 });
    const steps: Array<[number, number, number]> = [[60, -103, 0], [48, -114, 2], [36, -124, 4]];
    for (const [hx, zf, y] of steps) { w.box(-hx, y, -151, hx, y + 1, zf, CH); w.box(-hx, y + 1, zf, hx, y + 1, zf, CH_L); w.box(-hx, y, zf, hx, y, zf, CH_D); }
    w.box(40, 0, -104, 52, 1, -103, null);                                                                                        // a step corner broken away
    for (let z = -102; z <= 96; z++) for (let x = -12; x <= 12; x++) {
      if ((z > 40 && ((x < -4 && z > 52) || (x > 4 && z > 46 && z < 70) || z > 80)) || (z > -40 && z < -26 && x > 6)) continue;
      const ex = 12 - Math.abs(x); w.set(x, -1, z, ex === 0 ? 0x2a1418 : ex === 1 ? 0x8a7040 : ex === 2 ? 0x2a1418 : (Math.abs(x) <= 2 && Math.abs(((z + 200) % 18) - 9) <= 2) || (x === 0 && Math.abs(((z + 200) % 18) - 9) <= 4) ? 0x8a7040 : 0x4a1e26);
    }
    // heaved flagstones where roots got under the floor at the front left
    for (const [x, z, h] of [[-6.6, 4.4, 2], [-6.0, 5.8, 1], [-5.4, 6.3, 1]] as const) { const X = M(x), Z = M(z); w.box(X - 4, 0, Z - 3, X + 4, h - 1, Z + 3, 0x545262).box(X - 4, h - 1, Z - 3, X + 4, h - 1, Z - 3, 0x66647a); }
    // walls, full height: ashlar with pilasters and a string course, a cap where the roof is cut away
    const B = new Run(w, 'x', -152, -1), L = new Run(w, 'z', -124, -1), R = new Run(w, 'z', 124, 1);
    const ash = (a: number, y: number) => ashlar(a, y, CH, CH2, CHM, 10, 5);
    const wall = { t: 6, plinth: 7, cPlinth: CH_D, cCap: CH_L, body: ash, postW: 5, cPost: CH_L, rails: [[64, 2, CH_L]] as Array<[number, number, number]>, top: 0x3a384a, full: H };
    buildWall(B, -130, 130, () => H, { ...wall, posts: [-130, -101, -46, 42, 97, 126] });
    for (const S of [L, R]) buildWall(S, -158, 100, () => H, { ...wall, posts: [-157, -119, -68, -16, 35, 86] });
    w.box(-130, -2, 95, 130, 4, 100, CH_D).box(-130, 5, 95, 130, 5, 100, CH_L);
    // the cutaway: the front wall with its great door and a stepped round window, the roof along the nave, gables, holes
    const FC = new Run(cut, 'x', 95, 1);
    buildWall(FC, -123, 123, () => H, { ...wall, from: 6, posts: [-123, -60, 56, 119] });
    opening(FC, 0, 6, 14, 46, { t: 6, tiers: 3, tierH: 3, tierIn: 3, frame: CH_L }); opening(FC, 0, 60, 9, 18, { t: 6, tiers: 2, tierH: 3, tierIn: 3, frame: CH_L });
    roof(cut, { axis: 'z', a0: -157, a1: 100, b0: -129, b1: 129, E: 89, run: 12, rise: 7, over: 5, tiles: [0x3a3c48, 0x282a34, 0x4a4c58], moss: 0x384434, wood: 0x4a3a2e, woodD: 0x30261e,
      trusses: [-136, -100, -64, -28, 8, 44, 80], rafterEvery: 12, holes: [[-80, -134, 12, -70], [12, -134, 30, -96], [24, 70, 60, 134]], gableT: 6, gable: (b, y) => ash(b, y) });
    // the apse niche: a stepped arch through the back wall, the great window with panes gone, a slab over it in the cutaway
    opening(B, 0, 6, 30, 50, { t: 6, tiers: 3, tierH: 4, tierIn: 5, frame: CH_L });
    w.box(-36, -2, -167, 36, H, -158, CH_D); w.box(-30, 4, -166, 30, H, -158, null); w.box(-30, 4, -166, 30, 5, -152, CH); w.box(-30, 5, -153, 30, 5, -152, CH_L);
    for (let a = -36; a <= 36; a++) for (let y = 6; y <= H; y++) w.set(a, y, -167, ash(a, y));
    w.box(-36, H - 1, -158, 36, H, -158, 0x3a384a); cut.box(-36, H - 2, -167, 36, H, -158, CH_D);
    const NB = new Run(w, 'x', -167, -1);
    const GL = { gold: 0xa8803a, blue: 0x34509c, red: 0x983040, violet: 0x6c4aa4, green: 0x2e7a5a, pale: 0xb8a878 };
    const gone = (u: number, v: number, sets: Array<[number, number]>) => sets.some(([pu, pv]) => Math.floor((Math.abs(u) - 1) / 4) === pu && Math.floor(v / 4) === pv && (u < 0) === (pu + pv) % 2 > 0);
    const big = stained(13, 40, (pu, pv, n) => pv === 0 ? GL.green : pv >= n - 3 ? GL.violet : (pv === 4 || pv === 5) && pu === 0 ? GL.pale : pu === 0 ? GL.gold : pu === 1 ? GL.blue : GL.red);
    opening(NB, 0, 16, 13, 40, { t: 5, tiers: 3, tierH: 4, tierIn: 4, frame: CH_L, sill: CH_L, glassD: 2, glass: (u, v) => (gone(u, v, [[2, 3], [1, 6], [2, 7], [1, 2], [0, 8]]) && u % 4 && v % 4 ? null : big(u, v)) });
    const small = stained(7, 28, (pu, pv, n) => pv >= n - 2 ? GL.violet : pv === 0 ? GL.green : pu === 0 ? GL.gold : GL.blue);
    opening(B, -73, 22, 7, 28, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L, glassD: 3, glass: (u, v) => (v > 10 && u % 4 && v % 4 ? null : small(u, v)) });
    opening(B, 73, 22, 7, 28, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L, glassD: 3, glass: (u, v) => (gone(u, v, [[0, 2], [1, 4], [0, 5]]) && u % 4 && v % 4 ? null : small(u, v)) });
    banner(B, -55, 60, 5, 22, 0x232a44, 0x6a5a3a, 0x7a6a48); banner(B, 55, 60, 5, 12, 0x232a44, 0x6a5a3a, 0x7a6a48);
    w.box(M(4.0) - 6, 0, -150, M(4.0) + 6, 0, -146, 0x232a44).box(M(4.0) - 6, 0, -146, M(4.0) + 6, 0, -146, 0x6a5a3a);           // the rest of it on the floor
    // side windows: tall empty frames, a few bars of lead left
    for (const S of [L, R]) for (const a of [-138, -93, -42, 10]) opening(S, a, 24, 6, 36, { t: 6, tiers: 2, tierH: 3, tierIn: 2, frame: CH_L, sill: CH_L, glassD: 3, glass: (u, v) => (u === 0 && v > 20 && (a & 1) === 0 ? [0x1a1822, 0] : null) });
    // a breach in the left wall at the front, in wide steps, rubble inside it
    for (const [y0, y1, a0, a1] of [[8, 16, 54, 74], [17, 34, 50, 80], [35, 44, 56, 74], [45, 52, 60, 70]] as const) L.box(a0, -1, y0, a1, 6, y1, null);
    { const X = M(-8.0), Z = M(4.5); w.box(X - 6, 0, Z - 8, X + 6, 2, Z + 8, CH_D).box(X - 4, 3, Z - 6, X + 6, 4, Z + 5, CH).box(X - 1, 5, Z - 3, X + 6, 6, Z + 2, CH_D); }
    // the colonnades: whole columns at the back carrying stepped arches, broken ones toward the front, fallen drums
    for (const s of [-1, 1]) {
      const X = s * 86;
      column(w, s * 6.15, -8.2, 54, CH, CH_L); column(w, s * 6.15, -4.6, 54, CH, CH_L); column(w, s * 6.15, -1.0, s < 0 ? 34 : 28, CH, CH_L, true); column(w, s * 6.15, 2.6, s < 0 ? 14 : 18, CH, CH_L, true);
      arcade(w, X, -157, -117, 55, CH, CH_L); arcade(w, X, -117, -66, 55, CH, CH_L);
      w.box(X - 4, 55, -66, X + 4, 61, -58, CH).box(X - 4, 62, -64, X + 4, 64, -62, CH_D);
      const dz = s < 0 ? 4.3 : 0.6, DX = s * M(7.0); w.box(DX - 4, 0, M(dz) - 7, DX + 4, 8, M(dz) + 7, CH).box(DX - 4, 4, M(dz) - 7, DX + 4, 4, M(dz) + 7, CH_L);
    }
    // the altar: the cloth gone grey, the runner dark; its candles still burning
    { const zb = -142, zf = -133;
      w.box(-16, 6, zb, 16, 17, zf, 0x6c6a80); for (const px of [-11, 0, 11]) w.box(px - 4, 8, zf, px + 4, 15, zf, 0x56546a).box(px - 3, 9, zf, px + 3, 14, zf, 0x605e74);
      w.box(-18, 18, zb - 1, 18, 19, zf + 2, 0x7a788e);
      w.box(-17, 20, zb, 17, 20, zf + 1, 0xb0aa9c).box(-17, 14, zf + 3, 17, 20, zf + 3, 0xb0aa9c).box(-17, 14, zf + 3, 17, 14, zf + 3, 0x8a7040).box(10, 14, zf + 3, 17, 16, zf + 3, null);
      w.box(-4, 8, zf + 4, 4, 21, zf + 4, 0x5a2228).box(-4, 8, zf + 4, -4, 21, zf + 4, 0x8a7040).box(4, 8, zf + 4, 4, 21, zf + 4, 0x8a7040).box(-1, 13, zf + 5, 1, 16, zf + 5, 0x8a7040);
      candleStick(w, -13, 21, -138, 4); candleStick(w, 13, 21, -138, 2); candles(w, -9, 21, -139, WAX, FLM, [3, 2, 1]); w.box(5, 21, -139, 10, 21, -139, BRASS);
      w.box(-3, 21, -140, 3, 22, -136, BRASS); openBook(w, 0, 23, -138, 0x4a1e26);
      c.light([0, 2.0, -9.2], 0xffa850, 5, 8);
    }
    // the standing candelabra: the left one still lit, the right one down across the step; the lectern, pages blown about
    { const X = -66, Z = -110; w.box(X - 2, 2, Z - 2, X + 2, 3, Z + 2, IRN).box(X - 1, 4, Z - 1, X + 1, 4, Z + 1, IRN).box(X, 5, Z, X, 24, Z, IRN).box(X - 4, 25, Z, X + 4, 25, Z, IRN);
      for (const [dx, h] of [[-4, 2], [0, 4]]) w.box(X + dx, 26, Z, X + dx, 26 + h, Z, WAX).set(X + dx, 27 + h, Z, FLM, 1); c.light([X * CELL, 2.2, Z * CELL], 0xffa850, 2.5, 5); }
    w.box(64, 2, -112, 68, 3, -108, IRN).box(46, 4, -110, 66, 4, -110, IRN).box(44, 4, -114, 44, 4, -106, IRN).box(43, 5, -114, 43, 5, -114, WAX);
    { const b = loc(w, M(-3.1), M(-7.0), 0); b(-3, 0, -3, 3, 1, 3, 0x3e3028); b(-1, 2, -1, 1, 13, 1, 0x3e3028); b(-4, 14, -3, 4, 15, 3, 0x4c4036); b(-4, 16, -3, 4, 16, 0, 0x4c4036); openBook(w, M(-3.1), 17, M(-7.0) - 1, 0x2e2a3a); }
    for (const [x, z] of [[-2.0, -6.2], [-4.4, -5.4], [2.8, -6.6]] as const) c.cards.add('pages', x, z, { y: 0.01, s: 0.8, ry: 0, tint: 0x8a8478 });
    // pews: still in rows, but shoved out of line, some overturned, two smashed under the fallen roof, one snapped
    const PW = 0x4c4036, PW2 = 0x3a3028;
    for (const s of [-1, 1]) for (const [i, z] of [-9.8, -8.2, -6.6, -5.0, -3.4, -1.8, -0.2, 1.4, 3.0, 4.6].entries()) {
      const x = s * 7.6 + ((i * 5 + (s > 0 ? 2 : 0)) % 3 - 1) * 0.1;
      if (s < 0 && (i === 4 || i === 5)) continue;                                                                               // under the roof heap
      if ((s < 0 && i === 7) || (s > 0 && i === 5)) { const b = loc(w, M(x), M(z), 0); b(-11, 0, -3, 11, 2, 3, PW2); b(-11, 3, -3, 11, 3, -3, PW); continue; }
      if (s > 0 && i === 8) { pew(w, x + 0.4, z, 2, 6, PW, PW2); const b = loc(w, M(x - 0.5), M(z), 0); b(-5, 0, -2, 5, 1, 2, PW); continue; }
      pew(w, x, z, 2, 11, PW, PW2);
    }
    slateHeap(w, -7.4, -3.0, 7, [0x282a34, 0x3a3c48, 0x4a4c58], 'z'); slateHeap(w, -7.0, -1.6, 5, [0x282a34, 0x3a3c48, 0x4a4c58]); slateHeap(w, 7.2, 2.4, 5, [0x282a34, 0x3a3c48, 0x4a4c58]);
    { const b = loc(w, M(-7.6), M(-2.4), 0); b(-11, 0, -3, -2, 4, 2, PW2); b(2, 0, -2, 11, 1, 2, PW); b(-8, 5, -1, 6, 6, 0, 0x30261e); }
    // chandeliers: the left one hangs dark, the right one fell into the aisle
    w.box(-123, 66, -94, -92, 69, -90, 0x3a3028); chandelier(w, -108, 65, -92, 24, 6, false);
    { const X = M(7.4), Z = M(-6.4), hs = 6; w.box(X - hs, 0, Z - hs, X + hs, 0, Z - hs, IRN).box(X - hs, 0, Z + hs, X + hs, 0, Z + hs, IRN).box(X - hs, 0, Z - hs, X - hs, 0, Z + hs, IRN).box(X + hs, 0, Z - hs, X + hs, 0, Z + hs, IRN).box(X - hs, 0, Z, X + hs, 0, Z, IRN).box(X, 0, Z - hs, X, 0, Z + hs, IRN).box(X - 1, 0, Z - 1, X + 1, 1, Z + 1, IRN_L); w.box(X + hs, 1, Z, X + hs, 1, Z, WAX).box(X - hs, 1, Z - hs, X - hs, 2, Z - hs, WAX); }
    for (const s of [-1, 1]) for (const z of [-66, -14]) { const X = s * 80; w.box(X - s * 1, 30, z - 1, X - s * 3, 30, z + 1, 0x4a2e22).box(X - s * 3, 31, z, X - s * 3, 31, z, WAX); }
    // light: the great window's colours, the moon down the roof hole onto the pews, through the side windows; a cold fill
    c.shaft(0, -9.4, { color: 0xa890e0, w: 1.6, tilt: -0.42, yaw: Math.PI / 2, a: 0.14 });
    c.shaft(-7.0, -2.2, { w: 2.2, tilt: 0.24, yaw: 0.5, a: 0.28 }); c.shaft(7.0, 2.9, { w: 1.5, tilt: 0.2, yaw: 0.4, a: 0.22 });
    c.light([-7.0, 3.4, -2.2], 0x6a78d8, 3.5, 7);
    ivy(c, -8.57, 2.8, Math.PI / 2, 3.0, 4); ivy(c, 8.57, -0.6, -Math.PI / 2, 2.4, 3); ivy(c, -5.6, -10.52, 0, 2.0, 2); ivy(c, 3.0, -10.52, 0, 1.4, 2);
    tufts(c, [[-6.3, 1.4], [6.4, -3.2], [-6.4, -7.2], [6.3, 4.6], [-6.0, 3.6], [5.8, -9.0]], 'weeds', 0xa89a78);
    webs(c, [[-8.45, 5.0, -10.45, 0.785, 0.9], [8.45, 5.0, -10.45, -0.785, 0.9], [-6.15, 4.2, -6.4, 0, 0.55], [6.15, 4.2, -6.4, 0, 0.5], [-6.15, 3.8, -2.8, 0, 0.45], [8.5, 3.0, 4.0, -1.57, 0.6]]);
    outskirts(c, 5, RING_OUT);
    dress(c, 'house', { seed: 5, dense: 0.7, hang: [[-8.8, -11.6, 8.8, -11.6, 's'], [-9.2, -11, -9.2, 5.5, 'e'], [9.2, -11, 9.2, 5.5, 'w']],
      shafts: [[-7.3, -9.7, 0, -0.55, 0.9], [7.3, -9.7, 0, 0.55, 0.9], [-7.3, -6.4, 0, -0.5, 0.8], [7.3, -6.4, 0, 0.5, 0.8]],
      clear: [{ x0: 6.4, z0: -10.6, x1: 8.6, z1: 5.2 }, { x0: -8.6, z0: -10.6, x1: -6.4, z1: 5.2 }, { x0: -4.4, z0: -10.6, x1: 4.4, z1: -7.1 }] });
  },
};
const mod14 = (z: number) => ((z % 14) + 14) % 14 === 0;

// ==================================================================== 魇森巫母 · 巫母巢穴
const PLK = 0x3a2c30, PLK2 = 0x423238, LOGC = 0x2a2022;
export const covenNest: SceneDef = {
  id: 'b_matriarch', name: '魇森巫母 · 巫母巢穴', group: '首领', kind: '室内', blurb: '大锅里熬着的东西在冒泡，屋梁上爬满了她的女儿们。', mood: { ...HOUSE, hemiSky: 0x6a5a8e, hemiI: 1.75, fog: 0x1c1428 }, foes: ['boss_coven_matriarch'],
  build(c) {
    const w = c.w, cut = c.cut, H = 78; floorEarth(c, [0x2a2626, 0x302a2c]); c.cutEaves(3.4);
    const NF = [0x3a2a24, 0x403028, 0x342620], NS = 0x161010;
    boards(w, { X0: -77, X1: 77, Z0: -154, Z1: 96 }, 'x', NF, NS, 30, 5, 9);
    boards(w, { X0: -125, X1: -79, Z0: -154, Z1: 96 }, 'z', NF, NS, 28, 5, 10); boards(w, { X0: 79, X1: 125, Z0: -154, Z1: 96 }, 'z', NF, NS, 28, 5, 11);
    for (const x of [-78, 78]) w.box(x, -1, -154, x, -1, 96, LOGC);
    floorHole(w, M(5.8), M(1.6), M(6.6), M(2.2)); floorHole(w, M(-8.3), M(-7.0), M(-7.6), M(-6.5)); tufts(c, [[6.2, 1.9], [-7.9, -6.7]], 'grass', 0x7a8a6a, -0.07);
    // the ritual circle on the battle floor (a glowing decal)
    c.cards.add('ritual', 0, -1.2, { y: 0.004, s: 1.3, ry: 0 });
    // walls, full height: vertical boards on a mud-stone footing, log posts and rails, boards missing high up, a log plate on top
    const B = new Run(w, 'x', -155, -1), L = new Run(w, 'z', -126, -1), R = new Run(w, 'z', 126, 1);
    const plank = (a: number, y: number) => (y > 52 && ((a + 400) % 23) < 2 ? 0x241a1c : (((a + 400) % 6) < 3 ? PLK : PLK2));
    const opt = { t: 5, plinth: 5, cPlinth: ST_DD, cCap: ST_D, body: plank, postW: 4, cPost: LOGC, rails: [[6, 3, LOGC], [36, 3, LOGC], [62, 3, LOGC]] as Array<[number, number, number]>, top: 0x1e1618, full: H };
    buildWall(B, -131, 131, () => H, { ...opt, posts: [-131, -96, -8, 60, 128] });
    for (const S of [L, R]) buildWall(S, -160, 98, () => H, { ...opt, posts: [-158, -104, -62, -32, 18, 60, 95] });
    for (const [S, as] of [[B, [-112, -70, 34, 100]], [L, [-140, -50, 40]], [R, [-128, -16, 76]]] as const) for (const a of as) S.box(a, -1, 44 + ((a & 3) * 3), a + 2, 5, 74, null);
    w.box(-131, -2, 94, 131, 3, 98, ST_DD).box(-131, 4, 94, 131, 4, 98, ST_D);
    // the cutaway: the front wall with its low door, the thatch roof (steep, holed), its frame
    const FC = new Run(cut, 'x', 94, 1);
    buildWall(FC, -125, 125, () => H, { ...opt, from: 5, posts: [-125, -60, 56, 122] }); opening(FC, 0, 5, 8, 28, { t: 5, frame: LOGC, lintel: 0x1e1618 });
    roof(cut, { axis: 'x', a0: -130, a1: 130, b0: -159, b1: 98, E: 81, run: 10, rise: 9, over: 6, tiles: [0x4a4232, 0x302a22, 0x5a5040], moss: 0x3a4030, wood: 0x3a2c26, woodD: 0x2a201c,
      trusses: [-90, -30, 30, 90], rafterEvery: 10, holes: [[60, -150, 100, -118], [-110, -40, -80, -10], [-60, -159, -40, -146]], gableT: 5, gable: (b, y) => plank(b, y) });
    // the cauldron, back left of the boss's mark so she never hides it: hearth flags, the hood in three stone steps and a flue,
    // skulls and candles on its ledge, a chain, the paddle
    const CA = M(-3.5);
    flags(w, { X0: CA - 26, X1: CA + 26, Z0: -154, Z1: -104 }, [ST_D, ST, 0x524e58], ST_DD, 7, 6);
    { const hb = (a: number, y: number) => brick(a, y, ST_D, ST_DD, 7, 4);
      for (let a = CA - 26; a <= CA + 26; a++) for (let y = 30; y <= 33; y++) B.box(a, -16, y, a, -1, y, hb(a, y));
      for (let a = CA - 20; a <= CA + 20; a++) for (let y = 34; y <= 39; y++) B.box(a, -12, y, a, -1, y, hb(a, y));
      for (let a = CA - 14; a <= CA + 14; a++) for (let y = 40; y <= 47; y++) B.box(a, -9, y, a, -1, y, hb(a, y));
      for (let a = CA - 9; a <= CA + 9; a++) for (let y = 48; y <= 96; y++) B.box(a, -6, y, a, -1, y, hb(a, y));
      B.box(CA - 27, -17, 29, CA + 27, -1, 29, ST_DD); for (const s of [-1, 1]) B.box(CA + s * 25, -15, 0, CA + s * 23, -14, 28, ST_DD);
      for (const k of [-2, -1, 0, 1, 2]) skullAt(w, CA + k * 10, 34, -155 + 15, 'z');
      for (const k of [-1.5, 0.5]) { const x = CA + Math.round(k * 10); w.box(x, 34, -141, x, 36, -141, 0x3a2a44).set(x, 37, -141, CURSE, 1); }
      w.box(CA, 22, -141, CA, 28, -141, IRN).box(CA - 1, 22, -141, CA + 1, 22, -141, IRN); }
    const cf = cauldron(w, -3.5, -8.75, 0x4adf3a);
    c.light([cf[0] + 0.4, 1.9, cf[2] + 0.6], 0x6aff4a, 8, 9); c.light([cf[0], 0.35, cf[2] + 0.9], 0xff6a28, 2, 3);
    c.flame([cf[0] + 0.15, 1.45, cf[2] + 0.1], 0x7aff5a, 0.12); c.flame([cf[0] - 0.3, 1.4, cf[2] - 0.2], 0x9aff6a, 0.09);
    w.box(CA + 4, 14, M(-8.55), CA + 5, 40, M(-8.55) + 1, WD).box(CA + 2, 37, M(-8.55), CA + 7, 38, M(-8.55) + 1, WD_D);
    c.ambient({ kind: 'spores', color: 0x8aff6a, rate: 4, area: { x0: -4.6, z0: -9.8, x1: -2.4, z1: -7.8 }, y: [1.4, 2.6] });
    // centre and right of the back wall: shelves of potions in colour groups (skulls and grimoires between), a few fallen
    { const pal = [0x4ab832, 0x7a46c8, 0xc05a28, 0x34a6bc, 0xbc3450], A0 = -16, A1 = 54;
      B.box(A0 - 2, -7, 12, A0 - 1, -1, 46, WD_D); B.box(A1 + 1, -7, 12, A1 + 2, -1, 46, WD_D); B.box(A0 - 3, -8, 47, A1 + 3, -1, 48, WD_D);
      for (const [k, y] of [12, 22, 32, 42].entries()) {
        B.box(A0, -7, y, A1, -1, y, WD);
        let a = A0 + 2, g = 0;
        while (a < A1 - 3) {
          const n = 2 + ((g * 7 + k * 3) % 3), col = pal[(g + k * 2) % pal.length], kind = (g + k) % 3;
          if ((g + k) % 4 === 3) { if (k % 2) skullAt(w, a + 1, y + 1, -155 + 4, 'z'); else books(B.bx(), a, a + 3, -6, -2, y + 1, 6, g + k, [0x3a2a3a, 0x2a3a2a, 0x4a2a2a]); a += 6; g++; continue; }
          if ((g + k) % 5 === 1) { a += 5; g++; continue; }                                                                            // a gap where bottles fell
          for (let i = 0; i < n && a < A1 - 3; i++) a += bottleOn(B, a, -3, y + 1, kind, col, 1) + 1;
          a += 2; g++;
        }
      }
      for (const [x, z, cc] of [[0.4, -9.6, 0x4ab832], [1.8, -9.7, 0x7a46c8]] as const) w.box(M(x), 0, M(z), M(x) + 3, 1, M(z) + 1, cc, 1); }
    // right back: the herb-drying rack, baskets, a stool; thatch fallen through the hole above it
    { w.box(64, -2, -146, 66, 48, -144, LOGC).box(118, -2, -146, 120, 48, -144, LOGC);
      for (const y of [46, 36, 26]) { w.box(62, y, -146, 122, y + 1, -145, WD_D); herbs(w, 67, 117, y, -145, y, [0x4a4a36, 0x5a4a34, 0x4a3a40]); }
      for (const x of [5.4, 6.8]) crateK(w, x, -9.7, 4, 0x4a3a2c, LOGC); w.box(M(5.4) - 3, 9, M(-9.7) - 3, M(5.4) + 3, 9, M(-9.7) + 3, 0x4a4a36).box(M(6.8) - 3, 9, M(-9.7) - 3, M(6.8) + 3, 9, M(-9.7) + 3, 0x4a3a40);
      stoolK(w, 4.4, -8.6); slateHeap(w, 6.0, -8.3, 5, [0x302a22, 0x4a4232, 0x5a5040]); }
    // back left corner: a heap of skulls under a root that broke in through the wall
    const pile = (x: number, z: number, big = false) => { const X = M(x), Z = M(z);
      for (const [dx, dz, f] of [[-4, -2, 'z'], [0, -2, 'z'], [4, -2, 'x'], [-4, 2, '-x'], [0, 2, 'z'], [4, 2, 'z']] as const) skullAt(w, X + dx, 0, Z + dz, f);
      if (big) for (const [dx, dz, f] of [[-8, 0, '-x'], [8, 0, 'x'], [-4, 6, 'z'], [4, 6, 'z']] as const) skullAt(w, X + dx, 0, Z + dz, f);
      for (const [dx, dz, f] of [[-2, 0, 'z'], [2, 0, 'z']] as const) skullAt(w, X + dx, 4, Z + dz, f); skullAt(w, X, 8, Z, 'z');
      w.box(X - 9, 0, Z + 5, X - 3, 0, Z + 5, BONE_C).box(X + 6, 0, Z - 6, X + 6, 0, Z - 1, BONE_C); w.box(X, 12, Z, X, 14, Z, 0x3a2a44).set(X, 15, Z, CURSE, 1); };
    pile(-7.3, -9.4, true); root(w, B, -100, 40, 6, 1);
    // the left bay: her work table, a gallows post with an open cage, a root through the wall, thatch fallen through the roof
    { const ty = tableK(w, -6.85, -2.4, 1, 26, 14, 0x4a3428, WD_DD), X = M(-6.85), Z = M(-2.4);
      w.box(X - 2, ty, Z - 9, X + 2, ty + 2, Z - 5, ST).box(X - 1, ty + 2, Z - 8, X + 1, ty + 2, Z - 6, 0x4a5a36).box(X, ty + 3, Z - 7, X + 1, ty + 7, Z - 7, ST_L);
      openBook(w, X, ty, Z + 1, 0x3a2a44); candles(w, X + 2, ty, Z + 7, 0x3a2a44, CURSE, [5, 3, 2]); skullAt(w, X - 3, ty, Z + 8, 'x'); w.box(X - 3, ty + 4, Z + 8, X - 3, ty + 6, Z + 8, 0x3a2a44).set(X - 3, ty + 7, Z + 8, CURSE, 1);
      for (let k = 0; k < 3; k++) w.box(X - 5, ty, Z - 2 + k * 2, X - 4, ty + 3 - k, Z - 2 + k * 2, [0x4ab832, 0x7a46c8, 0xc05a28][k], 1);
      c.light([X * CELL + 0.3, 1.4, (Z + 6) * CELL], 0xb060ff, 3, 5);
      stoolK(w, -5.9, -1.4); slateHeap(w, -6.6, -0.3, 4, [0x302a22, 0x4a4232, 0x5a5040], 'z'); }
    { const X = M(-8.1), Z = M(1.6); w.box(X - 1, -2, Z - 1, X + 1, 50, Z + 1, LOGC).box(X - 1, 47, Z - 1, X + 22, 49, Z + 1, LOGC).box(X - 3, 0, Z - 3, X + 3, 1, Z + 3, ST_DD).box(X + 2, 42, Z, X + 5, 43, Z, LOGC); cage(w, X + 20, 47, Z, 9, { open: true }); }
    root(w, L, -84, 26, 8, 1);
    for (const [x, z, s] of [[-7.9, 3.4, 4], [-7.6, 4.4, 3], [7.9, -2.8, 4], [7.7, -1.9, 3], [8.0, 4.2, 4], [7.4, -10.3, 3]] as const) sac(w, x, z, s);
    // the right bay: a bookcase of grimoires, half pulled out; a chest; a root; a second skull heap at the front
    bookshelf(w, 8.45, -5.0, 3, 10, 30, 11, [0x3a2a3a, 0x2a3a32, 0x4a2a2a, 0x2a2a3e, 0x4a3a22], 0.5);
    for (const [x, z, cc] of [[7.6, -4.2, 0x3a2a3a], [7.2, -5.4, 0x4a2a2a]] as const) { bookFlat(w, M(x), 0, M(z), cc, 0x8a8478, false); bookFlat(w, M(x) + 1, 3, M(z) - 1, 0x2a3a32, 0x8a8478); }
    chestK(w, 8.1, -0.6, 3, 0x4a3428, IRN);
    root(w, R, -98, 36, 10, -1);
    pile(7.2, 3.2);
    w.box(M(-8.3), 0, M(-4.4), M(-8.3), 24, M(-4.4), WD_L).box(M(-8.3) - 1, 0, M(-4.4) - 1, M(-8.3) + 1, 6, M(-4.4) + 1, 0x8a7a4a);   // her broom
    // overhead in the room: two cross beams (the near one broken), a cage with bones, daughters on the beams and on a thread
    w.box(-131, 58, -146, 131, 61, -143, LOGC);
    w.box(-131, 56, -116, -34, 59, -113, LOGC).box(40, 56, -116, 131, 59, -113, LOGC).box(-38, 58, -116, -34, 59, -113, null).box(40, 58, -116, 44, 59, -113, null);
    cage(w, 92, 56, -114, 14, { bones: true });
    spider(w, -70, 64, -144, 0); spider(w, 30, 64, -144, 1); spider(w, -100, 62, -114, 3); spider(w, 74, 62, -114, 0); spider(w, -60, 62, -114, 1);
    w.box(16, 46, -120, 16, 56, -120, 0xb8b8c8); spider(w, 16, 39, -111, 0);
    for (const [x, z, r] of [[-6.4, -5.6, 1], [6.8, -4.2, 3], [-7.0, 0.6, 1]] as const) spider(w, M(x), 2, M(z), r);
    sac(w, -2.6, -8.1, 2, 0x7a7480, 0x6ad83a, 62); sac(w, 2.9, -10.2, 3, 0x7a7480, 0x6ad83a, 62);
    for (const [x, z, lit] of [[-5.9, 1.2, 0], [6.1, 0.8, 1], [-6.0, 4.0, 0], [6.0, 4.2, 0], [1.4, -8.6, 1], [-6.2, -7.6, 0]] as const) { const p = candles(w, M(x), 0, M(z), 0x3a2a44, CURSE, [6, 4, 2]); if (lit) c.light([p[0], 0.6, p[2]], 0xb060ff, 2.5, 4); }
    c.shaft(5.6, -9.1, { w: 1.4, tilt: 0.2, yaw: 0.5, a: 0.2 }); c.shaft(-6.6, -1.8, { w: 1.2, tilt: 0.2, yaw: 0.4, a: 0.2 });
    ivy(c, -8.72, -1.0, Math.PI / 2, 2.6, 3, ['roots', 'deadvine']); ivy(c, 8.72, 2.0, -Math.PI / 2, 2.2, 3, ['roots', 'deadvine']);
    outskirts(c, 7, RING_OUT);
    webs(c, [[-8.5, 4.6, -10.6, 0.785, 0.9], [8.5, 4.6, -10.6, -0.785, 0.9], [-8.55, 2.8, -7.2, 1.57, 0.6], [8.55, 2.8, -6.6, -1.57, 0.6], [-5.6, 4.1, -8.0, 0, 0.5], [5.0, 4.1, -8.0, 0, 0.5], [1.2, 4.3, -10.1, 0, 0.55], [-7.9, 3.4, 1.6, 0, 0.45], [8.6, 3.6, 3.0, -1.57, 0.6]]);
    dress(c, 'house', { seed: 13, dense: 0.5, hang: [[-8.8, -11.2, 8.8, -11.2, 's'], [-9.2, -11, -9.2, 5.0, 'e'], [9.2, -11, 9.2, 5.0, 'w']],
      clear: [{ x0: -8.8, z0: -10.8, x1: -1.0, z1: -7.0 }, { x0: 3.4, z0: -10.8, x1: 8.8, z1: -7.6 }] });
  },
};
void [WD_L, SLATE, SLATE_D, SLATE_L, LINEN, ST_L, MORT, pot, chairK, bowl, jug, chandelier];
