// Outdoor forest scenes: the trail, the lumber camp, and the three nodes (camp, merchant, shrine).
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

export const trail: SceneDef = {
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

export const lumber: SceneDef = {
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

export const camp: SceneDef = {
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

export const merchant: SceneDef = {
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

export const shrine: SceneDef = {
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

