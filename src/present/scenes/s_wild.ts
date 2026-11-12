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
import { SW, GV, marsh, swampWater, walk, stiltHut, swampTree, lily, wetRock, rowboat, tufts, ancientTree, groveTree, canopyFringe, trilithon, standingStone, mound, bush, type Rect } from './k_wild';
import { surface } from './dress';
import { CELL } from '../bestiary/kit';
import { VoxWorld } from '../look/voxkit';
import { V3 } from '../engine/world';
void [M, hash, pick, AREA, PLAY, tiles, planks, patches, slabPath, wall, rockRing, rock, crate, barrel, table, candle, bones, skull, pillar, eggSac, sarcophagus, bars, torchPost, brazier, fence, grave, cottageWall, deadTree, pine, stump, log, mushroom, woodsRing, NIGHT, SWAMP, DUNGEON, CAVE, HOUSE, BARK, BARK_D, PINE, PINE_T, MOSS, MOSS_D, EARTH, STONE, GROUT, WOOD, WOOD_D, WOOD_L, ROCK, IRON, BONE, FIRE, SOUL, CURSE, floorEarth, cweb, RING, dress, buildVoxArena, CELL, V3];
type _C = Ctx;

export const swamp: SceneDef = {
  id: 'n_swamp', name: '腐沼', group: '普通', kind: '户外', blurb: '沼气里飘着鬼火，脚下的木栈道吱呀作响。', mood: SWAMP, foes: ['forest_poison_sprite', 'forest_treant'],
  build(c) {
    // land: the battle island with inlets and bulges, a few islets; a wet bank, a shallow shelf, open water everywhere else
    const land: Rect[] = [
      { x0: -6.4, z0: -7.0, x1: 6.6, z1: 9.5 }, { x0: -10.6, z0: 1.8, x1: -6.4, z1: 9.5 }, { x0: -7.4, z0: -3.6, x1: -6.4, z1: 1.8 }, { x0: 6.6, z0: 4.2, x1: 9.2, z1: 9.5 },
      { x0: 6.6, z0: -4.6, x1: 7.6, z1: 0.6 }, { x0: -3.0, z0: -7.8, x1: -0.6, z1: -7.0 }, { x0: -9.8, z0: -12.8, x1: -6.6, z1: -9.8 }, { x0: 8.0, z0: -7.6, x1: 10.6, z1: -5.0 }, { x0: 7.4, z0: -13.4, x1: 9.6, z1: -11.0 },
    ];
    const cuts: Rect[] = [{ x0: -6.4, z0: -1.6, x1: -5.5, z1: 0.4 }, { x0: 5.7, z0: 1.6, x1: 6.6, z1: 3.2 }];
    const shelves: Rect[] = [{ x0: -11.4, z0: -7.0, x1: -8.9, z1: -4.2 }, { x0: 9.2, z0: 0.0, x1: 11.4, z1: 3.6 }, { x0: -5.8, z0: -12.2, x1: -3.6, z1: -10.6 }];
    const m = marsh(c.w, land, cuts, shelves, { box: { x0: -13, z0: -15, x1: 13, z1: 10 }, seed: 3 });
    swampWater(c, { x0: -26, z0: -28, x1: 26, z1: 14 });
    // the boardwalk: a long run behind the island, a run down the left side with a broken stretch, a square dock
    walk(c.w, { x0: -8.8, z0: -8.9, x1: 6.4, z1: -7.8 }, { rail: -1, seed: 1 });
    walk(c.w, { x0: -8.8, z0: -7.8, x1: -7.7, z1: -1.6 }, { rail: -1, gap: [1.4, 2.2], seed: 2 });
    walk(c.w, { x0: -9.9, z0: -1.6, x1: -7.4, z1: 0.3 }, { seed: 3 });
    // the landmark: a stilt hut over the back water, lanterns at its eaves
    // a path of planks laid flush across the mud, from the front of the island to the jetty: boards across it, mud showing between
    for (let z = M(-7.6); z <= M(5.6); z++) { const k = z - M(-7.6), p = Math.floor(k / 4); if (k % 4 === 3 || hash(p, 77) < 0.12) continue; const sh = hash(p, 78) < 0.3 ? 1 : 0; c.w.box(M(-2.5) + sh, -1, z, M(-1.1) - (hash(p, 79) < 0.3 ? 1 : 0), -1, z, hash(p, 80) < 0.5 ? 0x4e3a28 : 0x46342a); }
    const lan = stiltHut(c.w, 2.6, -11.2);
    c.light([2.6, lan[0][1], lan[0][2] + 0.4], 0xffa850, 5, 8);
    for (const p of lan) c.flame([p[0], p[1], p[2]], 0xffc070, 0.07);
    // dock lantern post with a mooring ring, the swamped boat beside it
    { const X = M(-9.6), Z = M(-1.4); c.w.box(X - 1, -6, Z - 1, X + 1, 30, Z + 1, SW.POST).box(X - 2, 31, Z - 2, X + 2, 31, Z + 2, SW.DECK).box(X + 2, 28, Z, X + 6, 28, Z, SW.IRON).box(X + 6, 27, Z, X + 6, 27, Z, SW.IRON);
      c.w.box(X + 5, 22, Z - 1, X + 7, 26, Z + 1, SW.IRON).box(X + 6, 23, Z, X + 6, 25, Z, SW.WARM, 1).box(X - 2, 6, Z - 2, X + 2, 6, Z + 2, SW.ROPE);
      c.light([(X + 6.5) * CELL, 1.75, (Z + 0.5) * CELL], 0xffa850, 3, 5); }
    rowboat(c.w, -3.4, -9.95, 1, 0);
    // dead swamp trees hung with moss
    for (const [x, z, h, s] of [[-8.2, -11.2, 7.6, 1], [-7.4, 3.0, 6.6, 2], [9.2, -6.2, 6.8, 3], [7.4, 4.6, 5.6, 4], [8.5, -12.2, 7.0, 5]] as const) {
      swampTree(c.w, x, z, h, s).forEach((p, i) => c.cards.add('moss', p[0], p[2], { y: p[1], ry: p[3], s: 0.38 + hash(i, s) * 0.3, tint: 0xb8c8a0 }));
    }
    // lily pads (some in flower), stones breaking the water
    const pads: Array<[number, number, number, number, number]> = [[-5.6, -10.0, 3, 0, 1], [-5.0, -10.8, 2, 1, 0], [-1.2, -9.6, 2, 2, 2], [7.7, -2.6, 3, 3, 0], [8.5, -1.7, 2, 0, 1], [7.9, -1.0, 2, 1, 0],
      [-9.9, -3.1, 3, 2, 2], [-10.5, -2.2, 2, 3, 0], [6.7, -10.0, 3, 1, 1], [7.1, -9.1, 2, 0, 0], [-1.7, -11.6, 2, 3, 2], [-0.7, -12.3, 3, 2, 0], [10.1, 2.6, 3, 1, 1], [10.6, 3.5, 2, 0, 0], [-5.6, -8.6, 2, 1, 0]];
    for (const [x, z, r, n, f] of pads) lily(c.w, x, z, r, n, f);
    wetRock(c.w, 8.9, -3.7, 8, 6, 4); wetRock(c.w, 9.7, -3.1, 4, 4, 2); wetRock(c.w, -10.2, -6.0, 7, 5, 3); wetRock(c.w, -4.6, -12.1, 6, 5, 3); wetRock(c.w, 10.2, 0.9, 5, 6, 3);
    // will-o'-wisps drifting over the water
    for (const [x, y, z] of [[-5.2, 1.4, -10.4], [-1.4, 1.8, -12.6], [7.8, 1.5, -3.2], [-9.8, 1.2, -4.6], [9.6, 1.6, 1.8], [6.6, 2.1, -12.8]] as const) c.flame([x, y, z], 0x7affa0, 0.1);
    c.light([-5.2, 1.4, -10.4], 0x7affa0, 3.5, 6); c.light([7.8, 1.5, -3.2], 0x7affa0, 3.5, 6);
    // cards: reeds on the shallow shelf, grass on the banks, duckweed on the water, nets over the hut rails
    const A = { x0: -12, z0: -14, x1: 12, z1: 9 };
    tufts(c, 'reeds', 80, [0.7, 1.15], (x, z) => !m.isLand(x, z), { area: A, seed: 41, cluster: 4, spread: 0.35, maxY: -0.05 });
    tufts(c, 'tallgrass', 95, [0.7, 1.1], m.isLand, { area: A, seed: 42, tints: [0xd8e0a8, 0xc8d098, 0xe8e8b8], feather: 0.4 });
    tufts(c, 'grass', 260, [0.5, 0.8], m.isLand, { area: A, seed: 43, cluster: 6, tints: [0xd8e0a8, 0xc8d098], feather: 0.7 });
    tufts(c, 'weeds', 60, [0.7, 1.1], m.isLand, { area: A, seed: 44, tints: [0xb8c088, 0xa8a878], feather: 0.2 });
    tufts(c, 'flowers', 24, [0.6, 0.8], m.isLand, { area: A, seed: 45, cluster: 3, tints: [0xfff0a0], feather: 0 });
    for (let i = 0; i < 40; i++) { const x = -11 + hash(i, 51) * 22, z = -13 + hash(i, 52) * 21; if (m.isLand(x, z) || surface(c, x, z) !== -0.07 && hash(i, 53) < 0.7) continue; c.cards.add('mossdecal', x, z, { y: -0.035, s: 0.7 + hash(i, 54) * 0.6, ry: Math.floor(hash(i, 55) * 4) * Math.PI / 2, tint: 0x9ad070 }); }
    for (let i = 0; i < 6; i++) c.cards.add('mossdecal', -4.6 + hash(i, 71) * 9.6, -5.8 + hash(i, 72) * 11, { y: 0, s: 0.6 + hash(i, 73) * 0.4, ry: Math.floor(hash(i, 74) * 4) * Math.PI / 2, tint: 0xd8e0a8 });
    c.cards.add('net', 0.86, -9.64, { y: 1.68, ry: 0, s: 0.62, tint: 0xd8d0b8 }); c.cards.add('net', 5.0, -11.4, { y: 1.68, ry: Math.PI / 2, s: 0.55, tint: 0xc8c0a8 });
    c.ambient({ kind: 'spores', color: 0x9aff7a, rate: 5 }); c.ambient({ kind: 'fireflies', color: 0x7affa0, rate: 3 });
    c.shaft(-3.2, -6.4, { yaw: 0.2, tilt: 0.3, w: 1.6 }); c.shaft(4.6, -4.2, { yaw: -0.2, tilt: 0.3, w: 1.2 });
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
    tufts(c, 'grass', 40, [0.4, 0.4], () => true, { area: { x0: -5.8, z0: 5.3, x1: 6.0, z1: 8.4 }, seed: 32, tints: [0xb8c8d8, 0xa8b8c8], feather: 0.3, maxY: 0.02 });
    dress(c, 'grave', { seed: 11, clear: [{ x0: -2.6, z0: -7.2, x1: 2.6, z1: -2.2 }, { x0: -5.8, z0: 5.3, x1: 6.0, z1: 8.6 }], shafts: [[-6.6, -7.6, 0.3, 0.32, 1.8], [6.8, -8.6, -0.3, 0.3, 1.4]] });
  },
};

export const ancientGrove: SceneDef = {
  id: 'b_treeking', name: '远古树王 · 古树圣林', group: '首领', kind: '户外', blurb: '石环围着的林中空地，背后是比夜空还高的古树。', mood: { ...NIGHT, hemiSky: 0x5a7a68, moon: 0xd0e8c8, fog: 0x18221e }, foes: ['boss_ancient_treant'],
  build(c) {
    // ground: dark woodland grass, a lighter clearing (a rectangle with two-step corners), a path of flush stepping slabs to the tree
    const clear = (x: number, z: number) => { const ax = Math.abs(x), az = Math.abs(z + 0.6); return ax < 6.8 && az < 6.6 && !(ax > 5.4 && az > 5.2) && !(ax > 6.2 && az > 4.4); };
    const X0 = M(AREA.x0), X1 = M(AREA.x1), Z0 = M(AREA.z0), Z1 = M(AREA.z1);
    for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
      const px = Math.floor(x / 10), pz = Math.floor(z / 10), f = Math.sin(px * 0.9 + 1) * Math.cos(pz * 0.7) + Math.sin((px - pz) * 0.4) * 0.5;
      c.w.set(x, -1, z, clear(x * CELL, z * CELL) ? (f > 0.6 ? 0x44582e : 0x3c5230) : f > 0.7 ? GV.GRASS[2] : f < -0.6 ? GV.GRASS[1] : GV.GRASS[0]);
    }
    for (let i = 0; i < 13; i++) {
      const zc = M(5.0 - i * 1.12), xc = M((i % 2 ? 0.28 : -0.22) + (i > 8 ? 0.6 : 0)), hw = 6 - (i % 3 === 1 ? 1 : 0), hd = 4;
      c.w.box(xc - hw - 1, -1, zc - hd - 1, xc + hw + 1, -1, zc + hd + 1, 0x4a4c44).box(xc - hw, -1, zc - hd, xc + hw, -1, zc + hd, GV.SLAB[i % 2]);
    }
    // the ancient tree behind the clearing
    // the high crown is its own mesh that casts no shadow: under the moon it would black out the whole clearing
    const crown = new VoxWorld(CELL), tree = ancientTree(c.w, 0, -12.4, { hollowX: 1.4, crown });
    for (const m of crown.build({ glow: 2.6 })) { m.castShadow = false; c.add(m); }
    c.light([tree.seed[0], tree.seed[1] + 0.2, tree.seed[2] + 1.8], 0xc8ff8a, 2.2, 7);
    const pads = [...tree.pads];
    for (const [x, z, h, sd] of [[-10.4, -10.2, 6.0, 21], [10.5, -9.8, 5.6, 22], [-10.9, -4.8, 5.0, 23], [11.0, -4.0, 5.2, 24], [-10.8, 5.8, 4.6, 25], [10.8, 6.2, 4.4, 26]] as const) pads.push(...groveTree(c.w, x, z, h, sd));
    canopyFringe(c, pads, 7);
    // the stone ring: trilithons at the back corners, single stones down the sides, low ones at the front corners
    const r1 = trilithon(c.w, -6.3, -8.4, 2.4, 1), r2 = trilithon(c.w, 6.4, -8.2, 2.3, 4);
    c.light([r1[0], r1[1], r1[2] + 1.2], 0xa8ff6a, 1.8, 5); c.light([r2[0], r2[1], r2[2] + 1.2], 0xa8ff6a, 1.8, 5);
    const stones: Array<[number, number, number, number, number, number]> = [[-8.1, -3.4, 1, 0, 2.6, 2], [-8.3, 1.4, 1, 0, 2.2, 3], [8.1, -2.8, -1, 0, 2.5, 5], [8.0, 1.8, -1, 0, 2.1, 6], [-6.9, 5.0, 1, 0, 1.5, 7], [7.1, 4.8, -1, 0, 1.6, 8]];
    for (const [x, z, fx, fz, h, sd] of stones) standingStone(c.w, x, z, fx, fz, h, { seed: sd, a: h > 2 ? 6 : 5, b: 4 });
    // mossy mounds with toadstools, flowering bushes
    mound(c.w, -9.2, -6.6, 14, 10, 3); mound(c.w, 9.4, -5.6, 12, 9, 2); mound(c.w, -9.8, 3.8, 12, 9, 2); mound(c.w, 9.9, 3.0, 10, 8, 3);
    const flowerTints = [0xe0d0ff, 0xfff0c0, 0xffffff];
    [[-6.9, -6.0, 8, 6, 12], [7.2, -5.4, 7, 6, 10], [-9.8, -1.0, 9, 7, 13], [9.8, -0.6, 8, 6, 11], [-7.4, 3.0, 6, 5, 9], [7.6, 3.4, 6, 5, 9], [-3.6, -8.6, 7, 5, 9], [3.4, -8.8, 6, 5, 8]].forEach(([x, z, sx, sz, h], i) => {
      const t = bush(c.w, x, z, sx, sz, h);
      for (let k = 0; k < 3; k++) c.cards.add('flowers', t[0] + (hash(i, k, 1) - 0.5) * sx * CELL * 1.2, t[2] + (hash(i, k, 2) - 0.5) * sz * CELL * 1.2, { y: t[1], s: 0.55 + hash(i, k, 3) * 0.2, tint: flowerTints[(i + k) % 3] });
    });
    // fireflies hanging still in the air near the tree and the stones
    for (const [x, y, z] of [[-3.4, 2.2, -9.4], [3.8, 2.8, -9.6], [-7.4, 1.6, -5.4], [7.6, 1.8, -4.8], [-6.2, 1.2, 2.4], [6.4, 1.4, 2.8]] as const) c.flame([x, y, z], 0xd8ff7a, 0.06);
    tufts(c, 'grass', 70, [0.4, 0.4], () => true, { area: { x0: -5.8, z0: 5.3, x1: 6.0, z1: 8.4 }, seed: 31, tints: [0xffffff, 0xe8f0d8], feather: 0.3 });
    dress(c, 'grove', { seed: 14, leaves: [], clear: [{ x0: -5.8, z0: 5.3, x1: 6.0, z1: 8.6 }], shafts: [[-7.4, -6.6, 0.3, 0.3, 2.0], [7.2, -7.8, -0.3, 0.3, 1.6], [-3.2, -3.6, 0.2, 0.32, 1.2]] });
  },
};
