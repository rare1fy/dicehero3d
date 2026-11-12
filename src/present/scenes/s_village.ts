// The village square and the interiors: cottage, chapel, and the coven matriarch nest (boss).
import { type SceneDef, type Ctx } from './stage';
import {
  M, hash, pick, AREA, PLAY, tiles, planks, patches, slabPath, wall, rockRing, rock, crate, barrel, table, candle, bones, skull,
  pillar, eggSac, sarcophagus, bars, torchPost, brazier, fence, grave, cottageWall,
} from './props';
import { deadTree, pine, stump, log, mushroom, woodsRing } from './flora';
import { NIGHT, SWAMP, DUNGEON, CAVE, HOUSE, BARK, BARK_D, PINE, PINE_T, MOSS, MOSS_D, EARTH, STONE, GROUT, WOOD, WOOD_D, WOOD_L, ROCK, IRON, BONE, FIRE, SOUL, CURSE, floorEarth, cweb, RING } from './common';
import { dress } from './dress';
import { buildVoxArena } from '../look/voxarena';
import { CELL } from '../bestiary/kit';
import { V3 } from '../engine/world';
void [M, hash, pick, AREA, PLAY, tiles, planks, patches, slabPath, wall, rockRing, rock, crate, barrel, table, candle, bones, skull, pillar, eggSac, sarcophagus, bars, torchPost, brazier, fence, grave, cottageWall, deadTree, pine, stump, log, mushroom, woodsRing, NIGHT, SWAMP, DUNGEON, CAVE, HOUSE, BARK, BARK_D, PINE, PINE_T, MOSS, MOSS_D, EARTH, STONE, GROUT, WOOD, WOOD_D, WOOD_L, ROCK, IRON, BONE, FIRE, SOUL, CURSE, floorEarth, cweb, RING, dress, buildVoxArena, CELL, V3];
type _C = Ctx;

export const village: SceneDef = {
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

export const cottage: SceneDef = {
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

export const chapel: SceneDef = {
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

export const covenNest: SceneDef = {
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

