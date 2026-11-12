// Underground: catacomb, dungeon cells, spider cave, mushroom grotto, and the root colossus deep (boss).
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

export const catacomb: SceneDef = {
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

export const cells: SceneDef = {
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

export const spiderCave: SceneDef = {
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

export const grotto: SceneDef = {
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

export const rootDeep: SceneDef = {
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

