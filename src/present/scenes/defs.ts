// Chapter 1 · 幽暗森林 — the scene set. Ten normal-fight scenes drawn at random (no repeats in a run; elites draw here too), four
// fixed boss scenes, three node scenes. Outdoor, indoor, dungeon and cave, all roofless. Battle staging is the same everywhere:
// the centre (PLAY) stays flat and clear; dressing lives on the sides and at the back; only low props in front.
import { type SceneDef, type Mood, type Ctx } from './stage';
import {
  M, hash, pick, AREA, tiles, planks, patches, wall, rockRing, deadTree, pine, stump, log, rock, mushroom, crate, barrel, table, candle, bones, skull,
  pillar, eggSac, sarcophagus, bars, torchPost, brazier, fence, grave, cottageWall,
} from './props';
import { buildVoxArena } from '../look/voxarena';
import { dress } from './dress';
import { CELL } from '../bestiary/kit';
import { V3 } from '../engine/world';

// ------------------------------------------------------------------ moods
const NIGHT: Mood = { sky: true, bg: 0x0e0c1c, fog: 0x1a1630, fogD: 0.019, hemiSky: 0x6a70a8, hemiGround: 0x221a20, hemiI: 1.2, moon: 0xb8c4ff, moonI: 2.4, key: 0xffd2a8, keyI: 0.8, earth: [0x2a2c2a, 0x2e3a2a, 0x262226], mist: 0x5a5c8c, mistA: 0.08 };
const SWAMP: Mood = { ...NIGHT, fog: 0x1a2a22, fogD: 0.024, hemiSky: 0x4a7a6a, hemiGround: 0x141a14, moon: 0xa8d8c0, moonI: 2.2, earth: [0x262a20, 0x2a3222, 0x20241c], mist: 0x5a8a6a, mistA: 0.08 };
const DUNGEON: Mood = { sky: false, bg: 0x07060b, fog: 0x0c0a12, fogD: 0.03, hemiSky: 0x7a7a9a, hemiGround: 0x221e22, hemiI: 1.5, moon: 0xa8a8c8, moonI: 2.0, key: 0xffc890, keyI: 0.55, earth: [0x121016, 0x16141a, 0x100e12], mist: 0x3a3a50, mistA: 0.06 };
const CAVE: Mood = { sky: false, bg: 0x050408, fog: 0x0a0a10, fogD: 0.028, hemiSky: 0x7a8ab0, hemiGround: 0x22222a, hemiI: 1.75, moon: 0x8a9ac0, moonI: 1.9, key: 0xc8d0ff, keyI: 0.4, earth: [0x141216, 0x18161a, 0x121014], mist: 0x3a4a5a, mistA: 0.07 };
const HOUSE: Mood = { ...NIGHT, keyI: 0.6, mistA: 0.05 };

const BARK = 0x3e3434, BARK_D = 0x2a2224, PINE = 0x1e3a2e, PINE_T = 0x2e5a40, MOSS = 0x3e5a30, MOSS_D = 0x2e4426, EARTH = [0x3e3634, 0x36422e, 0x342e2c];
const STONE = [0x6c6a7c, 0x666478, 0x716f84], GROUT = 0x2a2832, WOOD = 0x6a4a32, WOOD_D = 0x4a3222, WOOD_L = 0x86603e, ROCK = [0x46444e, 0x3e3c46, 0x52505a], IRON = 0x2c2a36, BONE = 0xe6dcc4, FIRE = 0xffa040, SOUL = 0x5affb0, CURSE = 0xb060ff;

/** dark woods ring: pines and dead trees around the outside of the stage */
function woodsRing(c: Ctx, seed: number, dense = 1) {
  const spots: Array<[number, number]> = [[-8.8, -10.2], [-5.6, -11.4], [-2.4, -11.8], [2.2, -11.6], [5.8, -11.2], [8.8, -9.4], [-9, -5.2], [9, -4.6], [-8.8, -0.4], [8.8, 0.4], [-8.6, 4.4], [8.6, 4.8], [-7.2, -8], [7.4, -7.6], [-6.9, -4.6], [7.1, -3.8], [-7.2, 1.6], [7.3, 2.4]];
  spots.forEach(([x, z], i) => { if (hash(i, seed, 4) > dense) return; if (hash(i, seed) < 0.6) pine(c.w, x + (hash(i, seed, 1) - 0.5), z, 6 + hash(i, seed, 2) * 3, BARK_D, PINE, PINE_T); else deadTree(c.w, x, z, 5.5 + hash(i, seed, 3) * 2, BARK, BARK_D, { seed: i + seed }); });
}
function floorEarth(c: Ctx, cols = EARTH) { patches(c.w, AREA, cols); }
/** a cobweb card where the old block web stood (y0 and s in blocks, as the block web took them) */
const cweb = (c: Ctx, x: number, z: number, y0: number, s: number, alongX: boolean) => c.cards.add('web', x, z, { y: (y0 + 2 * s + 1) * CELL, s: ((2 * s + 1) / 32) * 1.25, ry: alongX ? 0 : Math.PI / 2 });
/** the cave rock ring's inner faces, for hanging growth */
const RING: Array<[number, number, number, number, 'n' | 's' | 'e' | 'w']> = [[-8.4, -11.6, 8.4, -11.6, 's'], [-9.8, -10, -9.8, 4.5, 'e'], [9.8, -10, 9.8, 4.5, 'w']];

// ================================================================== normal fights (random pool)
const trail: SceneDef = {
  id: 'n_trail', name: '雾林小径', group: '普通', kind: '户外', blurb: '浓雾里的林间小道，发光的蘑菇是唯一的灯。', mood: NIGHT, foes: ['forest_spider', 'forest_wolf_priest'],
  build(c) {
    floorEarth(c);
    for (let z = M(AREA.z0); z < M(AREA.z1); z += 12) { const ox = Math.round((hash(z, 7) - 0.5) * 8); c.w.box(M(0.4) - 7 + ox, -1, z, M(0.4) + 7 + ox, -1, z + 9, 0x5a5660); }
    woodsRing(c, 1);
    log(c.w, -7.6, 1.5, 4, false, BARK, 0x8a6a4a); stump(c.w, 7.2, 3.4, 4, 6, BARK, 0x8a6a4a); stump(c.w, -6.4, -6.5, 5, 5, BARK, 0x8a6a4a);
    rock(c.w, 7.6, -2.5, 8, 6, ROCK[0], MOSS); rock(c.w, -8.4, 4.6, 6, 4, ROCK[1], MOSS);
    for (const [x, z] of [[-7.2, 3.4], [-6.8, 2.6], [6.6, -3.6], [7.4, 2.2], [-5.9, -7.4]]) mushroom(c.w, x, z, 2 + Math.round(hash(x, z) * 2), 0xc8c0d8, 0x4ac8ff, 1);
    c.light([-7, 0.6, 3], 0x4ac8ff, 4, 6); c.light([6.8, 0.6, -3], 0x4ac8ff, 3.5, 6);
    const lp = torchPost(c.w, 6.2, 5.6, 1.8, BARK_D, FIRE); c.flame(lp, FIRE); c.light(lp, 0xff9a50, 5, 7);
    c.w.box(M(-6.2), -2, M(5.4), M(-6.2) + 1, M(1.4), M(5.4) + 1, WOOD_D).box(M(-6.2) - 6, M(1.1), M(5.4), M(-6.2) + 3, M(1.4), M(5.4), WOOD);   // signpost
    dress(c, 'woods', { seed: 1, shafts: [[-6.4, -7.2, 0.3, 0.32, 1.8], [5.8, -9.2, -0.3, 0.3, 1.4], [7.8, 1.2, 0.2, 0.3, 1.2]] });
  },
};
const lumber: SceneDef = {
  id: 'n_lumber', name: '废弃伐木场', group: '普通', kind: '户外', blurb: '伐木工早已不见，木桩上还插着斧子。', mood: NIGHT, foes: ['forest_treant', 'forest_moss_golem'],
  build(c) {
    patches(c.w, AREA, [0x4a3a2c, 0x54422e, 0x3e3226]);
    woodsRing(c, 2, 0.8);
    for (const [x0, z] of [[-8.2, -8.6], [3.4, -8.8]]) for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) log(c.w, x0 + 2.2, z + 0.7 * i + 0.35 * r, 4.4, true, BARK, 0xb08a5a), void 0;
    for (const [x0, z] of [[-8.2, -8.6], [3.4, -8.8]]) for (let r = 0; r < 3; r++) c.w.box(M(x0), M(0.42) * r, M(z), M(x0 + 4.4), M(0.42) * r + 5, M(z + 2.2 - r * 0.6), BARK);
    for (const [x, z, h] of [[-7.5, -2.5, 6], [-6.6, 3.8, 5], [7.4, 4.2, 6], [6.8, -1.2, 4], [-8.8, 1, 5]]) stump(c.w, x, z, 4, h, BARK, 0xb08a5a);
    c.w.box(M(-7.5) - 1, 6, M(-2.5), M(-7.5), 14, M(-2.5), WOOD_D).box(M(-7.5) - 1, 12, M(-2.5) - 3, M(-7.5), 15, M(-2.5) + 1, 0x9aa0aa);   // axe in a stump
    // a torn tent and a sawhorse with a log
    c.w.box(M(7.2), 0, M(-6.4), M(9.6), M(1.6), M(-3.4), 0x6a6448).box(M(7.6), M(1.6), M(-6.4), M(9.2), M(2.1), M(-3.4), 0x5a5440).box(M(8.2), M(2.1), M(-6.4), M(8.6), M(2.4), M(-3.4), 0x4a4434);
    c.w.box(M(7.6), 0, M(-3.4), M(9.2), M(1.4), M(-3.4), 0x1a1612);
    for (const x of [-3.4, -1.4]) c.w.box(M(x), 0, M(6.2), M(x) + 1, M(0.8), M(6.2) + 1, WOOD).box(M(x), 0, M(7.2), M(x) + 1, M(0.8), M(7.2) + 1, WOOD);
    log(c.w, -2.4, 6.7, 3, true, BARK, 0xb08a5a);
    fence(c.w, -10.5, 7.4, -5, WOOD_D); fence(c.w, 5, 7.4, 10.5, WOOD_D);
    for (const p of [torchPost(c.w, -5.8, -4.6, 2, WOOD_D, FIRE), torchPost(c.w, 6, 1.6, 2, WOOD_D, FIRE)]) { c.flame(p, FIRE); c.light(p, 0xff9a50, 5, 8); }
    dress(c, 'woods', { seed: 2, dense: 0.8, shafts: [[-1.2, -10.4, 0.2, 0.3, 1.6], [8.4, -0.6, -0.2, 0.3, 1.2]] });
  },
};
const village: SceneDef = {
  id: 'n_village', name: '荒村广场', group: '普通', kind: '户外', blurb: '村民在一夜之间消失，井边的水桶还挂着。', mood: NIGHT, foes: ['forest_ghoul', 'forest_banshee'],
  build(c) {
    patches(c.w, AREA, [0x2c3226, 0x30382a]); tiles(c.w, { x0: -7, z0: -10, x1: 7, z1: 7 }, [0x5e5c6a, 0x67657a, 0x585666], GROUT, { size: 11 });
    cottageWall(c.w, -10, -11, -3.4, -11, 3.4, 0x5a5862, 0x3a2a20, 0x8a8478); cottageWall(c.w, -10, -11, -10, -3, 3, 0x5a5862, 0x3a2a20, 0x8a8478);
    cottageWall(c.w, 3.6, -11.5, 10, -11.5, 3.6, 0x5a5862, 0x3a2a20, 0x8a8478); cottageWall(c.w, 10, -11.5, 10, -4, 3.2, 0x5a5862, 0x3a2a20, 0x8a8478);
    // the well at the back
    const wx = M(0), wz = M(-8.6); c.w.box(wx - 9, -1, wz - 9, wx + 9, 8, wz + 9, 0x6a6876).box(wx - 7, 0, wz - 7, wx + 7, 8, wz + 7, null).box(wx - 7, -1, wz - 7, wx + 7, -1, wz + 7, 0x10141c);
    c.w.box(wx - 8, 9, wz - 1, wx - 7, 30, wz, WOOD_D).box(wx + 7, 9, wz - 1, wx + 8, 30, wz, WOOD_D).box(wx - 10, 31, wz - 4, wx + 10, 32, wz + 3, 0x4a3a30).box(wx - 1, 18, wz - 1, wx + 1, 21, wz + 1, WOOD);
    // a broken cart, barrels and crates, a dead tree
    c.w.box(M(6.4), M(0.5), M(1.2), M(9.2), M(1.0), M(3.4), WOOD).box(M(6.4), M(1), M(1.2), M(9.2), M(1.5), M(1.4), WOOD_D);
    for (const [x, z] of [[6.6, 1], [6.6, 3.6]]) c.w.box(M(x), 0, M(z), M(x) + 1, M(1.0), M(z) + 1, WOOD_D).box(M(x) - 6, 6, M(z), M(x) + 6, 6, M(z) + 1, WOOD_D);
    barrel(c.w, -7.4, 2.2, WOOD, IRON); barrel(c.w, -7.4, 3.2, WOOD, IRON); crate(c.w, -6.2, 4.6, 5, WOOD_L, WOOD_D); crate(c.w, 8.6, -2.4, 6, WOOD_L, WOOD_D);
    deadTree(c.w, -8.8, 5.6, 6, BARK, BARK_D, { seed: 3 }); woodsRing(c, 3, 0.4);
    for (const p of [torchPost(c.w, -5.6, -5.2, 2.4, IRON, 0xffc070), torchPost(c.w, 5.8, -5.6, 2.4, IRON, 0xffc070)]) { c.flame(p, 0xffc070); c.light(p, 0xffb060, 5, 8); }
    dress(c, 'woods', { seed: 3, dense: 0.8, hang: [[-9.6, -11.4, -3.6, -11.4, 's'], [-10.4, -10.6, -10.4, -3.2, 'e'], [3.8, -11.9, 9.8, -11.9, 's'], [10.4, -11.2, 10.4, -4.2, 'w']], shafts: [[-1.6, -6.2, 0.2, 0.3, 1.4]] });
  },
};
const cottage: SceneDef = {
  id: 'n_cottage', name: '荒屋', group: '普通', kind: '室内', blurb: '屋顶早已塌了，壁炉的火却不知被谁点着。', mood: HOUSE, foes: ['forest_wraith_cultist', 'forest_ghoul'],
  build(c) {
    floorEarth(c); planks(c.w, { x0: -8, z0: -10, x1: 8, z1: 6.5 }, [0x5a3e2a, 0x644630, 0x52382a], 0x2a1c14);
    const ST = 0x5a5862, PL = 0x8a8478, TM = 0x3a2a20;
    wall(c.w, -8.4, -10.4, 8.4, -10.4, 3.4, PL, { t: 4, band: ST }); wall(c.w, -8.4, -10.4, -8.4, -2, 2.8, PL, { band: ST }); wall(c.w, -8.4, -2, -8.4, 6.5, 1.4, PL, { band: ST });
    wall(c.w, 8.4, -10.4, 8.4, -2, 2.8, PL, { band: ST }); wall(c.w, 8.4, -2, 8.4, 6.5, 1.4, PL, { band: ST });
    for (const x of [-8.4, -2.8, 2.8, 8.4]) c.w.box(M(x) - 1, -2, M(-10.4) - 2, M(x) + 1, M(3.6), M(-10.4) + 2, TM);
    // the fireplace on the back wall
    const fx = M(0), fz = M(-10.4); c.w.box(fx - 10, -2, fz, fx + 10, M(2.4), fz + 6, ST).box(fx - 6, 0, fz + 3, fx + 6, M(1.1), fz + 6, null).box(fx - 6, 0, fz + 3, fx + 6, 0, fz + 6, 0x1a1210)
      .box(fx - 4, 1, fz + 4, fx + 4, 3, fz + 5, 0xffa040, 1).box(fx - 2, 4, fz + 4, fx + 2, 6, fz + 5, 0xffd070, 1).box(fx - 11, M(2.4), fz - 1, fx + 11, M(2.4) + 2, fz + 7, TM);
    c.light([0, 0.5, -9.4], 0xff8a40, 8, 10);
    // furniture: a table with chairs and a candle, a bed, shelves, barrels, cobwebs
    table(c.w, -6.2, -4.2, 2.2, 1.4, WOOD_L, WOOD_D); for (const z of [-5.4, -3.0]) c.w.box(M(-6.2) - 4, 0, M(z) - 3, M(-6.2) + 4, 6, M(z) + 3, WOOD).box(M(-6.2) - 4, 7, M(z) + (z < -4 ? -3 : 3), M(-6.2) + 4, 14, M(z) + (z < -4 ? -3 : 3), WOOD_D);
    candle(c.w, -6.2, -4.2, 3, 0xf0e8d0, 0xffd070, 12); c.light([-6.2, 1.2, -4.2], 0xffb060, 3, 5);
    c.w.box(M(5), 0, M(-9.6), M(7.8), M(0.5), M(-6), WOOD_D).box(M(5.2), M(0.5), M(-9.4), M(7.6), M(0.65), M(-6.2), 0x7a6a8a).box(M(5.2), M(0.5), M(-9.4), M(7.6), M(0.8), M(-8.6), 0xd8d0c0);
    c.w.box(M(-7.8), 0, M(-10), M(-4.4), M(2.4), M(-9.6), WOOD_D); for (const y of [0.8, 1.6]) c.w.box(M(-7.8), M(y), M(-9.6), M(-4.4), M(y), M(-9.0), WOOD);
    barrel(c.w, 7.4, 1.6, WOOD, IRON); crate(c.w, 7.2, 4.4, 5, WOOD_L, WOOD_D); crate(c.w, -7.2, 4.6, 4, WOOD_L, WOOD_D);
    cweb(c, -7.9, -9.9, M(2.0), 9, true); cweb(c, 7.9, -9.9, M(2.0), 8, true);
    woodsRing(c, 4, 0.5);
    dress(c, 'house', { seed: 4, hang: [[-8.4, -10.8, 8.4, -10.8, 's'], [-8.8, -10.2, -8.8, -2.2, 'e'], [8.8, -10.2, 8.8, -2.2, 'w']], webs: [[-7.9, 3.3, -10.0, 0.785], [7.9, 3.3, -10.0, -0.785], [-8.0, 2.7, -2.4, 2.3]], shafts: [[-3.4, -6.4, 0.2, 0.3, 1.6], [3.8, -3.2, -0.2, 0.3, 1.3]] });
  },
};
const chapel: SceneDef = {
  id: 'n_chapel', name: '残破礼拜堂', group: '普通', kind: '室内', blurb: '月光从空窗框里落在长椅上，祭台的蜡烛还在烧。', mood: HOUSE, foes: ['forest_wraith_cultist', 'elite_necromancer'],
  build(c) {
    floorEarth(c); tiles(c.w, { x0: -8.5, z0: -11, x1: 8.5, z1: 6.5 }, [0x5c5a6c, 0x646276, 0x56546a], GROUT, { size: 15 });
    const ST = 0x6a687c, STD = 0x4e4c60;
    // back wall with three tall empty window frames
    wall(c.w, -8.8, -11.2, 8.8, -11.2, 5.2, ST, { t: 5, band: STD });
    for (const x of [-5, 0, 5]) c.w.box(M(x) - 7, M(1.6), M(-11.2) - 3, M(x) + 7, M(4.4), M(-11.2) + 3, null).box(M(x) - 8, M(4.4), M(-11.2) - 3, M(x) + 8, M(4.8), M(-11.2) + 3, STD).box(M(x) - 1, M(1.6), M(-11.2), M(x) + 1, M(4.4), M(-11.2), STD);
    wall(c.w, -8.8, -11.2, -8.8, -3, 4, ST, { broken: 0.6, seed: 2, band: STD }); wall(c.w, 8.8, -11.2, 8.8, -3, 3.6, ST, { broken: 0.7, seed: 5, band: STD });
    wall(c.w, -8.8, -3, -8.8, 6.5, 1.2, ST, { band: STD }); wall(c.w, 8.8, -3, 8.8, 6.5, 1.0, ST, { band: STD });
    for (const z of [-8.5, -4.5, -0.5, 3.5]) { pillar(c.w, -6.6, z, 3.6 - (z > 0 ? 1.4 : 0), ST, STD, { broken: z > 0 }); pillar(c.w, 6.6, z, 3.4 - (z > -2 ? 1.6 : 0), ST, STD, { broken: z > -2 }); }
    // the altar and candles, the pews
    c.w.box(M(-2.4), 0, M(-10.4), M(2.4), M(1.0), M(-8.8), 0x7a7890).box(M(-2.6), M(1.0), M(-10.6), M(2.6), M(1.1), M(-8.6), 0x8a88a0).box(M(-0.6), M(1.1), M(-9.8), M(0.6), M(1.6), M(-9.6), 0xd0a850);
    for (const x of [-2, -1.2, 1.2, 2]) candle(c.w, x, -9.4, 4, 0xf0e8d0, 0xffd070, M(1.1));
    c.light([0, 1.6, -9.4], 0xffb060, 5, 8);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const x = side * 7.6, z = -7 + i * 2.6; c.w.box(M(x) - 9, 0, M(z) - 3, M(x) + 9, 6, M(z) + 3, WOOD).box(M(x) - 9, 7, M(z) - 3, M(x) + 9, 12, M(z) - 2, WOOD_D); }
    c.w.box(M(3.4), 0, M(-6.2), M(6.4), M(0.5), M(-5.6), WOOD_D);   // a fallen beam
    woodsRing(c, 5, 0.5);
    dress(c, 'house', { seed: 5, hang: [[-8.8, -11.6, 8.8, -11.6, 's'], [-9.2, -11, -9.2, -3.2, 'e'], [9.2, -11, 9.2, -3.2, 'w']], webs: [[-8.3, 4.6, -10.7, 0.785], [8.3, 4.6, -10.7, -0.785]], shafts: [[-5, -8.4, 0, 0.3, 1.5], [0, -8.4, 0, 0.3, 1.5], [5, -8.4, 0, 0.3, 1.5]] });
  },
};
const catacomb: SceneDef = {
  id: 'n_catacomb', name: '地下墓穴', group: '普通', kind: '地牢', blurb: '墙里一格一格的骷髅都在看着你。', mood: DUNGEON, foes: ['forest_bone_reaver', 'forest_ghoul'],
  build(c) {
    tiles(c.w, AREA, [0x5a586a, 0x62607a, 0x545266], 0x22202a, { size: 15 });
    const ST = 0x5a5870, STD = 0x3e3c50;
    wall(c.w, -11, -12, 11, -12, 4.6, ST, { t: 6 }); wall(c.w, -11, -12, -11, 0, 3.4, ST, { t: 6 }); wall(c.w, 11, -12, 11, 0, 3.4, ST, { t: 6 }); wall(c.w, -11, 0, -11, 8, 1.2, ST, { t: 6 }); wall(c.w, 11, 0, 11, 8, 1.2, ST, { t: 6 });
    // burial niches with skulls in the back and side walls
    for (let i = 0; i < 9; i++) for (let r = 0; r < 2; r++) { const x = -8 + i * 2, y = M(1.0 + r * 1.4); c.w.box(M(x) - 5, y, M(-12) + 2, M(x) + 5, y + 8, M(-12) + 3, 0x14121a); skull(c.w, x, -12 + 3 * CELL + 0.1, y, BONE); }
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -9.5 + i * 2.4, y = M(1.2); c.w.box(M(side * 11) - side * 3, y, M(z) - 5, M(side * 11) - side * 2, y + 8, M(z) + 5, 0x14121a); }
    // a back archway, pillars, sarcophagi, bones
    c.w.box(M(-1.6), 0, M(-12) - 3, M(1.6), M(2.8), M(-12) + 3, 0x08070c).box(M(-2.2), M(2.8), M(-12) - 3, M(2.2), M(3.3), M(-12) + 3, STD);
    for (const x of [-6.8, 6.8]) for (const z of [-7.4, -1.4]) pillar(c.w, x, z, 4.2, ST, STD, { r: 5 });
    sarcophagus(c.w, -8.4, -4.4, false, 0x6a687e, 0x7a7890); sarcophagus(c.w, 8.4, -4.2, false, 0x6a687e, 0x7a7890); sarcophagus(c.w, 8.6, 3.6, false, 0x5a5870, 0x6a687e);
    bones(c.w, -6.2, 2.6, BONE); bones(c.w, 6.4, -9, BONE); skull(c.w, -5.8, -9.6, 0, BONE);
    for (const p of [brazier(c.w, -4.8, -9.6, IRON, SOUL), brazier(c.w, 4.8, -9.6, IRON, SOUL)]) { c.flame(p, SOUL, 0.16); c.light(p, 0x4affa0, 5, 9); }
    const t = torchPost(c.w, -8.8, 3.4, 1.8, IRON, FIRE); c.flame(t, FIRE); c.light(t, 0xff9a50, 4, 7);
    dress(c, 'dungeon', { seed: 6, hang: [[-10.6, -12.4, 10.6, -12.4, 's'], [-11.4, -11.6, -11.4, -0.4, 'e'], [11.4, -11.6, 11.4, -0.4, 'w']], webs: [[-10.4, 4.5, -11.4, 0.785], [10.4, 4.5, -11.4, -0.785], [-10.4, 3.3, -0.6, 2.3], [10.4, 3.3, -0.6, -2.3]] });
  },
};
const cells: SceneDef = {
  id: 'n_cells', name: '地牢囚室', group: '普通', kind: '地牢', blurb: '锁链还在晃，牢门却都开着。', mood: DUNGEON, foes: ['forest_bone_reaver', 'forest_banshee'],
  build(c) {
    tiles(c.w, AREA, [0x5e5a62, 0x66626c, 0x56525c], 0x201e24, { size: 15 });
    const ST = 0x56525e;
    wall(c.w, -11, -12, 11, -12, 4.2, ST, { t: 6 }); wall(c.w, -11, -12, -11, 1, 3.2, ST, { t: 6 }); wall(c.w, 11, -12, 11, 1, 3.2, ST, { t: 6 }); wall(c.w, -11, 1, -11, 8, 1.0, ST, { t: 6 }); wall(c.w, 11, 1, 11, 8, 1.0, ST, { t: 6 });
    // cells along both sides: partition walls and iron bars facing the centre
    for (const side of [-1, 1]) {
      for (const z of [-11.6, -7.6, -3.6, 0.4]) wall(c.w, side * 11, z, side * 6.8, z, 2.6, ST, { t: 3 });
      bars(c.w, side * 6.8, -11.4, side * 6.8, 0.2, 2.4, IRON);
      for (const [z, open] of [[-9.6, true], [-5.6, false], [-1.6, true]] as const) { if (open) c.w.box(M(side * 6.8), 0, M(z) - 6, M(side * 6.8), M(2.4), M(z) + 6, null); patches(c.w, { x0: side > 0 ? 7.2 : -10.6, z0: z - 1.6, x1: side > 0 ? 10.6 : -7.2, z1: z + 1.6 }, [0x8a7a3a, 0x7a6a34]); }
    }
    // chains on the back wall, a rack, the iron door
    for (const x of [-4, -2.6, 2.6, 4]) { c.w.box(M(x), M(1.4), M(-12) + 3, M(x), M(3.2), M(-12) + 3, IRON); c.w.box(M(x) - 1, M(1.3), M(-12) + 3, M(x) + 1, M(1.4), M(-12) + 3, 0x6a6a76); }
    c.w.box(M(-1.4), 0, M(-12) + 3, M(1.4), M(2.6), M(-12) + 3, 0x3a3440).box(M(-1.4), M(1.4), M(-12) + 4, M(1.4), M(1.5), M(-12) + 4, IRON);
    c.w.box(M(-6.2), 0, M(4), M(-5.8), M(1.8), M(4.4), WOOD_D).box(M(-3.8), 0, M(4), M(-3.4), M(1.8), M(4.4), WOOD_D).box(M(-6.2), M(0.8), M(4), M(-3.4), M(1.0), M(4.4), WOOD).box(M(-6.2), M(1.6), M(4), M(-3.4), M(1.8), M(4.4), WOOD);
    c.water(5.4, 3.2, 6.6, 4.4, 0x1a2a3a);
    for (const p of [torchPost(c.w, -5.6, -10.6, 2.2, IRON, FIRE), torchPost(c.w, 5.6, -10.6, 2.2, IRON, FIRE), torchPost(c.w, 6.2, 5.4, 1.6, IRON, FIRE)]) { c.flame(p, FIRE); c.light(p, 0xff9a50, 5, 8); }
    dress(c, 'dungeon', { seed: 7, hang: [[-6.4, -12.4, 6.4, -12.4, 's'], [-11.4, -11.4, -11.4, 0.6, 'e'], [11.4, -11.4, 11.4, 0.6, 'w']], webs: [[-6.4, 4.1, -11.4, 0.785], [6.4, 4.1, -11.4, -0.785], [-10.4, 2.5, -7.3, 0.785], [10.4, 2.5, -3.3, -0.785]] });
  },
};
const spiderCave: SceneDef = {
  id: 'n_spider', name: '蛛网洞穴', group: '普通', kind: '洞穴', blurb: '网上挂着的，不全是猎物。', mood: CAVE, foes: ['forest_spider', 'forest_spider'],
  build(c) {
    patches(c.w, AREA, [0x46444c, 0x3e3c44, 0x504e56], { raise: [2], seed: 4 });
    rockRing(c.w, { x0: -9, z0: -10.8, x1: 9, z1: 7.5 }, 4.4, ROCK, { seed: 3 });
    for (const [x, z, s, h] of [[-7.8, -6, 5, 2.4], [7.4, -7.4, 6, 3], [-8.4, 2.4, 4, 1.6], [7.8, 1.8, 5, 2], [-3.6, -10, 4, 2.8], [4.2, -10.2, 5, 3.4]] as const) { c.w.box(M(x) - s, -2, M(z) - s, M(x) + s, M(h * 0.5), M(z) + s, ROCK[1]); c.w.box(M(x) - s + 2, M(h * 0.5), M(z) - s + 2, M(x) + s - 2, M(h), M(z) + s - 2, ROCK[0]); }
    cweb(c, -6.2, -8.8, 0, 14, true); cweb(c, 6.4, -9.6, 4, 12, true); cweb(c, -9.4, -1.8, 4, 11, false); cweb(c, 9.4, -3.4, 2, 12, false);
    for (const [x, z] of [[-7, -4.4], [-6.4, -4.2], [6.6, -5.2], [7.2, -4.8], [-2.6, -9.6], [6.8, 4.4]]) eggSac(c.w, x, z, 3, 0xd8d0c0, 0x9aff3a);
    for (const [x, z] of [[8.6, -1.4], [-8.8, -8.4]]) c.w.box(M(x) - 3, 0, M(z) - 3, M(x) + 3, M(1.6), M(z) + 3, 0xe0dcd0).box(M(x) - 2, M(1.6), M(z) - 2, M(x) + 2, M(1.9), M(z) + 2, 0xe0dcd0);
    bones(c.w, -5.8, 3.4, BONE); bones(c.w, 5.8, -2, BONE); skull(c.w, 6.2, 3, 0, BONE);
    c.light([-6.6, 0.6, -4.3], 0x9aff3a, 4, 6); c.light([6.9, 0.6, -5], 0x9aff3a, 4, 6); c.light([0, 3, -8], 0x8a9ab8, 3, 12);
    dress(c, 'spider', { seed: 8, hang: RING, webs: [[-7.8, 3.6, -9.6, 0.785], [7.8, 3.8, -9.8, -0.785], [-8.4, 3.2, -4, 1.4], [8.4, 3.0, -1, -1.4], [-2.8, 3.6, -10, 0.2], [3.2, 3.4, -10.2, -0.3], [-8.2, 2.4, 4.2, 2.2]] });
  },
};
const grotto: SceneDef = {
  id: 'n_grotto', name: '荧菇洞窟', group: '普通', kind: '洞穴', blurb: '地下的水潭映着成片的荧光菇。', mood: CAVE, foes: ['forest_poison_sprite', 'forest_moss_golem'],
  build(c) {
    patches(c.w, AREA, [0x3e4246, 0x34403a], { seed: 6 });
    rockRing(c.w, { x0: -9, z0: -10.8, x1: 9, z1: 7.5 }, 4.2, [0x3e4448, 0x363c40, 0x464c50], { seed: 5 });
    // a still pool at the back, its bank in mossy stone
    c.w.box(M(-6), -1, M(-11), M(6), -1, M(-7.4), null); c.w.box(M(-6), -3, M(-11), M(6), -3, M(-7.4), 0x10181c); c.water(-6, -11, 6, -7.4, 0x12304a);
    c.w.box(M(-6.6), -1, M(-7.4), M(6.6), 0, M(-6.8), 0x3a5a3a);
    for (const [x, z, s, col] of [[-7.4, -6, 3, 0x4ae8ff], [-6.6, -7, 2, 0xb060ff], [7, -5.4, 3, 0x4ae8ff], [7.8, -6.6, 2, 0xb060ff], [-8.2, 1.4, 3, 0x4ae8ff], [8, 2.2, 2, 0xb060ff], [-6.8, 4.8, 2, 0x4ae8ff], [6.4, -9.6, 4, 0x4ae8ff], [-5.8, -10.2, 3, 0xb060ff]] as const) mushroom(c.w, x, z, s, 0xd8d0e0, col, 1);
    for (const [x, z] of [[8.8, -2.6], [-9, -3.6]]) { c.w.box(M(x) - 1, 0, M(z) - 1, M(x) + 1, 14, M(z) + 1, 0x8af0ff, 1); c.w.box(M(x) + 2, 0, M(z), M(x) + 3, 9, M(z) + 1, 0x8af0ff, 1); }
    c.light([-7, 0.8, -6.4], 0x4ae8ff, 5, 7); c.light([7.2, 0.8, -6], 0xb060ff, 5, 7); c.light([0, 1, -9], 0x4ae8ff, 4, 9);
    dress(c, 'cave', { seed: 9, hang: RING, shafts: [[0, -9.2, 0, 0.12, 2.2]] });
  },
};
const swamp: SceneDef = {
  id: 'n_swamp', name: '腐沼', group: '普通', kind: '户外', blurb: '沼气里飘着鬼火，脚下的木栈道吱呀作响。', mood: SWAMP, foes: ['forest_poison_sprite', 'forest_treant'],
  build(c) {
    patches(c.w, AREA, [0x36382a, 0x2e3626]);
    for (const [x0, z0, x1, z1] of [[-11, -13, -5.6, 8], [5.8, -13, 11, 8], [-5.6, -13, 5.8, -7.4]] as const) { c.w.box(M(x0), -1, M(z0), M(x1), -1, M(z1), null); c.w.box(M(x0), -3, M(z0), M(x1), -3, M(z1), 0x1a2016); c.water(x0, z0, x1, z1, 0x2a3a24); }
    // a rotting boardwalk across the back water, lily pads, reeds, dead trees with hanging moss
    for (let x = M(-5.6); x < M(5.8); x += 5) if (hash(x, 3) > 0.12) c.w.box(x, -1, M(-10.2), x + 3, -1, M(-8.6), WOOD_D);
    for (const [x, z] of [[-7.6, -2], [-8.4, 3], [7.4, -4], [8.6, 1.6], [-2.6, -11], [3.4, -10.4]]) c.w.box(M(x) - 3, -1, M(z) - 3, M(x) + 3, -1, M(z) + 3, 0x3a6a2a);
    for (const [x, z] of [[-6.2, -5.6], [6.4, 4.6], [-6.4, 5.6], [6.6, -6.8], [-9.6, -9]]) for (let i = 0; i < 4; i++) c.w.box(M(x) + i * 2 - 3, -1, M(z) + (i & 1), M(x) + i * 2 - 3, 6 + (i % 3) * 3, M(z) + (i & 1), 0x6a7a3a);
    for (const [x, z, h, s] of [[-8.6, -6.4, 6, 1], [8.4, -2, 7, 2], [-8.2, 4.6, 5.4, 3], [9, 5.4, 5, 4], [-3.4, -11.6, 6.4, 5]] as const) { deadTree(c.w, x, z, h, 0x3a3630, 0x26221e, { seed: s }); c.w.box(M(x) + 3, M(h * 0.3), M(z), M(x) + 3, M(h * 0.5), M(z), 0x7a8a6a); }
    for (const [x, y, z] of [[-6.8, 1.4, -3.6], [7.2, 1.8, 0.4], [0.6, 1.6, -9.6], [-7.6, 1.2, 4]] as const) c.flame([x, y, z], 0x7affa0, 0.1);
    c.light([-6.8, 1.4, -3.6], 0x7affa0, 3.5, 6); c.light([7.2, 1.8, 0.4], 0x7affa0, 3.5, 6);
    dress(c, 'swamp', { seed: 10, water: [{ x0: -11, z0: -13, x1: -5.6, z1: 8 }, { x0: 5.8, z0: -13, x1: 11, z1: 8 }, { x0: -5.6, z0: -13, x1: 5.8, z1: -7.4 }], shafts: [[-3, -6.6, 0.2, 0.3, 1.6], [4.2, -4, -0.2, 0.3, 1.2]] });
  },
};

// ================================================================== bosses (fixed)
const lichAltar: SceneDef = {
  id: 'b_lich', name: '枯骨巫妖 · 墓园祭坛', group: '首领', kind: '户外', blurb: '月光下的墓园中央，巫妖的祭坛刻满了符文。', mood: NIGHT, foes: ['boss_lich_forest'],
  build(c) {
    const lanterns = [V3(-4.4, 0, -3.4), V3(4.4, 0, -3.4), V3(-5.6, 0, 1.5), V3(5.6, 0, 1.5)];
    const va = buildVoxArena({ altar: V3(0, 0.55, -4.7), altarR: 2.2, lanterns });
    for (const [k, v] of va.world.cells) c.w.cells.set(k, v);   // the arena joins the stage world (one mesh build; cards find its surfaces)
    va.flames.forEach((p, i) => { c.flame([p.x, p.y + CELL * 1.5, p.z], SOUL, 0.14); if (i < 2) c.light([p.x, p.y, p.z], 0x4affa0, 5, 6); });
    c.rune(0, va.altarTop + 0.006, -4.7, 2.2);
    dress(c, 'grave', { seed: 11, clear: [{ x0: -2.6, z0: -7.2, x1: 2.6, z1: -2.2 }], shafts: [[-6.6, -7.6, 0.3, 0.32, 1.8], [6.8, -8.6, -0.3, 0.3, 1.4]] });
  },
};

const rootDeep: SceneDef = {
  id: 'b_colossus', name: '根须巨像 · 古根深洞', group: '首领', kind: '洞穴', blurb: '整片森林的根都扎到了这里，泥土在呼吸。', mood: { ...CAVE, hemiSky: 0x5a4a3a, earth: [0x1c1612, 0x221a14, 0x18120e] }, foes: ['boss_root_colossus'],
  build(c) {
    patches(c.w, AREA, [0x3e3024, 0x46362a, 0x34281e], { seed: 3 });
    rockRing(c.w, { x0: -9, z0: -10.8, x1: 9, z1: 7.5 }, 4.8, [0x4a3a2c, 0x403226, 0x523f30], { seed: 9 });
    // giant roots: out of the back wall, over, down into the floor; amber sap glowing in their splits
    const R = 0x5a3e28, RD = 0x3e2a1a;
    for (const [x, zTop, zEnd, th] of [[-5.8, -10.6, -6.6, 5], [6.2, -10.6, -7.2, 6], [-2.2, -10.8, -8.8, 4], [3.2, -10.8, -8.6, 4]] as const) {
      const X = M(x), Z0 = M(zTop), Z1 = M(zEnd), H = M(4.2);
      c.w.box(X - th, M(2.6), Z0, X + th, H, Z1, R).box(X - th, -2, Z1 - th * 2, X + th, H, Z1, R).box(X - 1, M(2.6) + 2, Z0, X + 1, H - 2, Z1, RD).box(X - 1, M(1.6), Z1 + 1, X + 1, M(2.2), Z1 + 1, 0xffb040, 1);
    }
    for (const side of [-1, 1]) { const X = M(side * 7.8); c.w.box(X - 5, -2, M(-4), X + 5, M(1.2), M(-1), R).box(X - 4, -2, M(1), X + 4, M(0.8), M(3.6), RD); }
    for (const [x, z] of [[-7.8, 4.4], [7.6, 4.8], [-8.4, -2.4]]) rock(c.w, x, z, 7, 5, 0x4a3e34, 0x5a6a3a);
    for (const [x, z] of [[-6, -3.6], [6.2, -2.8]]) mushroom(c.w, x, z, 2, 0xc8b8a0, 0xffa040, 1);
    c.light([-6.4, 1.8, -6.2], 0xffa040, 6, 8); c.light([6.8, 1.8, -7], 0xffa040, 6, 8); c.light([0, 3.4, -5], 0xd89a5a, 4, 12);
    dress(c, 'roots', { seed: 12, hang: RING, shafts: [[0, -6, 0, 0.1, 2.6]] });
  },
};
const covenNest: SceneDef = {
  id: 'b_matriarch', name: '魇森巫母 · 巫母巢穴', group: '首领', kind: '室内', blurb: '大锅里熬着的东西在冒泡，屋梁上爬满了她的女儿们。', mood: { ...HOUSE, hemiSky: 0x5a4a7a, fog: 0x1c1428 }, foes: ['boss_coven_matriarch'],
  build(c) {
    floorEarth(c, [0x2a2626, 0x302a2c]); planks(c.w, { x0: -8.6, z0: -11, x1: 8.6, z1: 6.5 }, [0x4a3428, 0x54392c, 0x402c22], 0x1e1410);
    c.w.box(M(-3.2), -1, M(-2.4), M(3.2), -1, M(3.2), 0x5a2a4a).box(M(-3.2), -1, M(-2.4), M(3.2), -1, M(-2.2), 0xb0884a).box(M(-3.2), -1, M(3), M(3.2), -1, M(3.2), 0xb0884a);   // rug
    const PL = 0x5a4a52, TM = 0x2a1e1a;
    wall(c.w, -8.8, -11.2, 8.8, -11.2, 4, PL, { t: 5 }); wall(c.w, -8.8, -11.2, -8.8, -2, 3.2, PL); wall(c.w, 8.8, -11.2, 8.8, -2, 3.2, PL); wall(c.w, -8.8, -2, -8.8, 6.5, 1.4, PL); wall(c.w, 8.8, -2, 8.8, 6.5, 1.4, PL);
    for (const x of [-8.8, -4, 4, 8.8]) c.w.box(M(x) - 1, -2, M(-11.2) - 3, M(x) + 1, M(4.2), M(-11.2) + 3, TM);
    // the cauldron on a fire, shelves of jars, hanging herbs, webs and egg sacs
    const cx = M(-4.2), cz = M(-8.4); c.w.box(cx - 9, 0, cz - 9, cx + 9, 12, cz + 9, 0x1e1c22).box(cx - 7, 4, cz - 7, cx + 7, 12, cz + 7, null).box(cx - 7, 10, cz - 7, cx + 7, 11, cz + 7, 0x7aff5a, 1).box(cx - 10, 12, cz - 10, cx + 10, 13, cz + 10, 0x2a2830);
    c.w.box(cx - 4, 0, cz + 9, cx + 4, 2, cz + 11, 0xff8a30, 1); c.light([-4.2, 1.6, -8.4], 0x7aff5a, 7, 9); c.flame([-4.2, 1.2, -8.4], 0x9aff6a, 0.2);
    c.w.box(M(3), 0, M(-11), M(7.6), M(2.8), M(-10.4), TM); for (const y of [0.9, 1.8]) { c.w.box(M(3), M(y), M(-10.4), M(7.6), M(y), M(-9.8), WOOD); for (let i = 0; i < 6; i++) c.w.box(M(3.3 + i * 0.75), M(y) + 1, M(-10.2), M(3.3 + i * 0.75) + 1, M(y) + 4, M(-10), pick([0x9aff3a, 0xb060ff, 0xff6a4a, 0x4ae8ff], i, y * 7), 1); }
    for (let i = 0; i < 9; i++) { const x = -7.6 + i * 1.9; c.w.box(M(x), M(2.2 + hash(i, 4) * 0.8), M(-10.9) + 3, M(x) + 1, M(3.8), M(-10.9) + 3, pick([0x5a8a3a, 0x8a7a3a, 0x6a4a6a], i)); }
    cweb(c, 0.6, -10.6, M(1.6), 16, true); cweb(c, -8.4, -6, M(1.0), 10, false); cweb(c, 8.4, -5, M(1.2), 10, false);
    for (const [x, z] of [[7.4, -7.6], [7.8, -6.8], [-7.6, 3.6], [7.2, 3.8]]) eggSac(c.w, x, z, 3, 0xd8d0c0, 0x9aff3a);
    for (const [x, z] of [[-6.8, -2.8], [6.6, -1.6], [-1.4, -10.2]]) { candle(c.w, x, z, 5, 0x3a2a44, CURSE); c.light([x, 0.5, z], 0xb060ff, 2.5, 4); }
    woodsRing(c, 7, 0.4);
    dress(c, 'house', { seed: 13, hang: [[-8.8, -11.6, 8.8, -11.6, 's'], [-9.2, -11, -9.2, -2.2, 'e'], [9.2, -11, 9.2, -2.2, 'w']], webs: [[-8.3, 3.9, -10.7, 0.785], [8.3, 3.9, -10.7, -0.785], [-8.3, 3.0, -2.5, 2.3], [8.3, 3.0, -2.5, -2.3]] });
  },
};
const ancientGrove: SceneDef = {
  id: 'b_treeking', name: '远古树王 · 古树圣林', group: '首领', kind: '户外', blurb: '石环围着的林中空地，背后是比夜空还高的古树。', mood: { ...NIGHT, hemiSky: 0x5a7a68, moon: 0xd0e8c8, fog: 0x18221e }, foes: ['boss_ancient_treant'],
  build(c) {
    patches(c.w, AREA, [0x30442a, 0x2a3c24, 0x4a4c2a]);
    // the ancient tree at the back: a vast trunk with buttress roots and a canopy of leaf blocks
    const X = 0, Z = M(-11.4), T = M(9);
    c.w.box(X - 22, -2, Z - 14, X + 22, M(1.6), Z + 10, 0x4a3628).box(X - 16, M(1.6), Z - 10, X + 16, T, Z + 8, 0x523c2c).box(X - 12, T, Z - 8, X + 12, T + M(2), Z + 6, 0x4a3628);
    for (const [dx, dz, l] of [[-1, 0, 16], [1, 0, 16], [-1, 1, 10], [1, 1, 10]] as const) c.w.box(dx < 0 ? X - 22 - l : X + 22, -2, Z + (dz ? 4 : -6), dx < 0 ? X - 22 : X + 22 + l, M(0.8), Z + (dz ? 10 : 0), 0x3e2e22);
    c.w.box(X - 3, M(1.6), Z + 8, X + 3, M(4.4), Z + 9, 0x1a120c).box(X - 2, M(2.6), Z + 9, X + 1, M(3.6), Z + 9, 0x9aff6a, 1);   // a hollow with a glowing seed
    for (const [dx, dy, dz, w2, h2] of [[-24, 0, -4, 18, 9], [6, 2, -6, 20, 10], [-10, 9, -2, 22, 9], [-30, -6, 2, 12, 7], [16, -5, 2, 14, 7]] as const) {
      const x0 = X + dx, y0 = T + M(2) + dy; c.w.box(x0, y0, Z - 12 + dz, x0 + w2, y0 + h2, Z + 6 + dz, 0x2e5a2a).box(x0 + 2, y0 + h2 + 1, Z - 10 + dz, x0 + w2 - 2, y0 + h2 + 1, Z + 4 + dz, 0x4a8a3a);
    }
    for (const [x, y] of [[-14, 6], [10, 9], [-2, 18]]) c.w.box(X + x, T + M(2) + y, Z + 7, X + x + 1, T + M(2) + y, Z + 7, 0xe8b830);
    // a ring of standing stones with glowing runes, fireflies
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2, x = Math.sin(a) * 8.2, z = -1.6 + Math.cos(a) * 7.4; if (Math.abs(x) < 4 && z > 2) continue; const sx = M(x), sz = M(z), h = M(2 + hash(i, 2) * 1.2); c.w.box(sx - 4, -2, sz - 3, sx + 4, h, sz + 3, 0x6a6c74).box(sx - 3, h + 1, sz - 2, sx + 3, h + 2, sz + 2, 0x5a6a4a).box(sx - 1, M(1), sz + 4, sx, M(1.6), sz + 4, 0xb8ff7a, 1); }
    for (let i = 0; i < 12; i++) c.flame([(hash(i, 1) - 0.5) * 18, 0.8 + hash(i, 2) * 2.4, -11 + hash(i, 3) * 16], 0xd8ff7a, 0.06);
    c.light([0, 2.6, -9.6], 0x9aff6a, 7, 10); c.light([-6, 1.4, -2], 0xd8ff7a, 3, 6); c.light([6, 1.4, -2], 0xd8ff7a, 3, 6);
    dress(c, 'grove', { seed: 14, leaves: [0x1e3a2e, 0x2e5a40, 0x2e5a2a, 0x4a8a3a], shafts: [[-7.4, -6.6, 0.3, 0.3, 2.0], [7.2, -7.8, -0.3, 0.3, 1.6], [-3.2, -3.6, 0.2, 0.32, 1.2]] });
  },
};

// ================================================================== other nodes
const camp: SceneDef = {
  id: 'c_camp', name: '营火 · 林间营地', group: '节点', kind: '户外', blurb: '难得安全的一角，火堆噼啪作响。', mood: { ...NIGHT, keyI: 0.5 },
  build(c) {
    patches(c.w, AREA, [0x2e3a26, 0x34402a, 0x3a3428]); woodsRing(c, 9, 0.95);
    const X = M(0.4), Z = M(-0.6);
    for (const [dx, dz] of [[-7, -2], [-7, 2], [7, -2], [7, 2], [-2, -7], [2, -7], [-2, 7], [2, 7], [-5, -5], [5, -5], [-5, 5], [5, 5]]) c.w.box(X + dx - 1, 0, Z + dz - 1, X + dx + 1, 2, Z + dz + 1, 0x6a6876);
    c.w.box(X - 5, 0, Z - 1, X + 5, 2, Z + 1, BARK).box(X - 1, 0, Z - 5, X + 1, 2, Z + 5, BARK).box(X - 3, 3, Z - 3, X + 3, 5, Z + 3, 0xff8a30, 1).box(X - 1, 6, Z - 1, X + 1, 9, Z + 1, 0xffd070, 1);
    c.light([0.4, 0.8, -0.6], 0xff9a50, 9, 11); c.flame([0.4, 0.6, -0.6], 0xffb040, 0.24);
    log(c.w, -2.4, -0.6, 2.6, false, BARK, 0x8a6a4a); log(c.w, 3.2, -0.4, 2.6, false, BARK, 0x8a6a4a); log(c.w, 0.4, -3.4, 3, true, BARK, 0x8a6a4a);
    c.w.box(M(-4), 0, M(2.6), M(-2.2), 2, M(5.2), 0x6a2a2a).box(M(-4), 3, M(2.6), M(-3.4), 4, M(3.2), 0xd8d0c0);   // bedroll
    c.w.box(M(4.6), 0, M(-6.8), M(7.6), M(1.4), M(-4), 0x6a6448).box(M(5), M(1.4), M(-6.8), M(7.2), M(1.9), M(-4), 0x5a5440).box(M(5.8), M(1.9), M(-6.8), M(6.4), M(2.2), M(-4), 0x4a4434);
    dress(c, 'woods', { seed: 15, clear: [{ x0: -1.2, z0: -2.2, x1: 2, z1: 1 }], shafts: [[-6.6, -6.8, 0.3, 0.32, 1.6], [7.4, 1.4, -0.2, 0.3, 1.2]] });
  },
};
const merchant: SceneDef = {
  id: 'c_merchant', name: '商人 · 林边货车', group: '节点', kind: '户外', blurb: '一辆亮着灯的篷车，商人从不问你从哪来。', mood: NIGHT,
  build(c) {
    patches(c.w, AREA, [0x3a3428, 0x2e3a26, 0x403a2c]); woodsRing(c, 10, 0.8);
    // the covered wagon
    const X = M(0), Z = M(-7.4);
    c.w.box(X - 30, M(0.6), Z - 14, X + 30, M(1.1), Z + 14, WOOD).box(X - 28, M(1.1), Z - 12, X + 28, M(2.4), Z + 12, 0xb8a888).box(X - 24, M(2.4), Z - 10, X + 24, M(2.8), Z + 10, 0xa89878).box(X - 28, M(1.1), Z + 12, X + 28, M(2.4), Z + 12, 0x3a2a20);
    for (const [dx, dz] of [[-22, -15], [22, -15], [-22, 15], [22, 15]]) c.w.box(X + dx - 6, 0, Z + dz, X + dx + 6, 12, Z + dz + 1, WOOD_D).box(X + dx - 1, 0, Z + dz, X + dx + 1, 12, Z + dz + 1, WOOD_L);
    // goods: crates, barrels, a counter with jars, a hanging lantern
    crate(c.w, -3.4, -4.6, 5, WOOD_L, WOOD_D); crate(c.w, -4.4, -4.2, 4, WOOD_L, WOOD_D); barrel(c.w, 3.6, -4.4, WOOD, IRON); barrel(c.w, 4.4, -4.8, WOOD, IRON);
    table(c.w, 0, -4.4, 3, 1, WOOD_L, WOOD_D); for (let i = 0; i < 5; i++) c.w.box(M(-1.2 + i * 0.6), 12, M(-4.4) - 1, M(-1.2 + i * 0.6) + 1, 15, M(-4.4), pick([0x9aff3a, 0xb060ff, 0xff6a4a, 0x4ae8ff, 0xffd040], i), 1);
    const lp = torchPost(c.w, -2.2, -5.6, 2.2, WOOD_D, 0xffc070); c.flame(lp, 0xffc070); c.light(lp, 0xffb060, 7, 9);
    dress(c, 'woods', { seed: 16, shafts: [[-7, -4.4, 0.3, 0.3, 1.6], [7.6, -1.4, -0.2, 0.3, 1.2]] });
  },
};
const shrine: SceneDef = {
  id: 'c_shrine', name: '事件 · 林中古祠', group: '节点', kind: '户外', blurb: '一座没人记得名字的小祠，供品却是新的。', mood: { ...NIGHT, hemiSky: 0x6a6a9a },
  build(c) {
    patches(c.w, AREA, [0x2e3a26, 0x34402a]); woodsRing(c, 11, 0.9);
    tiles(c.w, { x0: -3.2, z0: -9.6, x1: 3.2, z1: -3.6 }, STONE, GROUT, { size: 15 });
    const X = M(0), Z = M(-7.6);
    c.w.box(X - 14, -1, Z - 14, X + 14, 2, Z + 14, 0x5a5870).box(X - 10, 3, Z - 10, X + 10, 5, Z + 10, 0x6a687e).box(X - 6, 6, Z - 6, X + 6, M(1.4), Z + 6, 0x7a7890);
    c.w.box(X - 4, M(1.4), Z - 4, X + 4, M(2.6), Z + 4, 0x8a88a0).box(X - 3, M(2.6), Z - 3, X + 3, M(3.2), Z + 3, 0x9a98b0).box(X - 1, M(3.2), Z - 1, X + 1, M(3.6), Z + 1, 0xc8f0ff, 1);   // the statue's stacked form and its light
    for (const [dx, dz] of [[-8, 11], [8, 11], [-11, 0], [11, 0]]) candle(c.w, (X + dx) * CELL, (Z + dz) * CELL, 3, 0xf0e8d0, 0xffd070, 3);
    for (const [x, z] of [[-1.4, -4.2], [1.4, -4.2]]) c.w.box(M(x) - 2, 0, M(z) - 2, M(x) + 2, 1, M(z) + 2, pick([0xb84a3a, 0xd8b040], x * 3));
    c.light([0, 3, -7.6], 0xa8e0ff, 6, 9); c.light([0, 0.6, -6.6], 0xffc070, 3, 6);
    for (const [x, z, h, s] of [[-7, -8, 5.5, 1], [7.4, -6.4, 6, 2]] as const) deadTree(c.w, x, z, h, BARK, BARK_D, { seed: s });
    dress(c, 'grove', { seed: 17, dense: 0.8, shafts: [[0, -7.4, 0, 0.12, 2.4], [-6.6, -3, 0.3, 0.3, 1.2]] });
  },
};

export const SCENES: SceneDef[] = [trail, lumber, village, cottage, chapel, catacomb, cells, spiderCave, grotto, swamp, lichAltar, rootDeep, covenNest, ancientGrove, camp, merchant, shrine];
export const NORMAL_POOL = SCENES.filter(s => s.group === '普通');
void grave; void rock;
