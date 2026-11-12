// The swamp and the two open-air boss grounds: the lich graveyard altar and the ancient tree king grove.
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

export const swamp: SceneDef = {
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

export const lichAltar: SceneDef = {
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

export const ancientGrove: SceneDef = {
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

