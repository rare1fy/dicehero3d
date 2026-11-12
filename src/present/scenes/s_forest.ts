// Outdoor forest scenes: the trail, the lumber camp, and the three nodes (camp, merchant, shrine).
// Each is composed the Minecraft-Dungeons way: one clear landmark at the back (biggest mass, clearest silhouette, its own light),
// story groups of 2–5 props in different materials on the flanks with empty ground between them, low rocks / logs / shrubs easing
// the edges, a designed floor (kerbed paths, trampled rings, decks) instead of one flat colour.
// Tone (round 2): Duskwood — a wood where it is always evening. Everything has been left: roofs fallen in, kerbs and flagstones gone,
// cloth patched and torn, iron rusted, wood gone grey; crows sit on the high points; moonlight leads, and the little warm light there
// is comes from one lamp or one fire somebody left burning. The battle floor (PLAY) stays flat in the fight scenes; the node scenes
// keep an open patch where the hero stands.
import { type SceneDef, type Ctx, type Mood } from './stage';
import { M, hash, AREA, patches, crate, barrel, table, candle, pillar, bones, skull } from './props';
import { deadTree, stump, bush, woodsRing, plantRings } from './flora';
import { NIGHT, BARK, BARK_D, WOOD_D, IRON } from './common';
import { dress } from './dress';
import {
  KC, lift, glowShroom, stele, masonry, pathway, flags, roundPatch, deck, boulder, logX, logPile, firewood, sack, lampPost, signpost, firePit, lantern, wheel,
  ruinGate, sawShed, tent, wagon, stall, shrineTemple, stoneLamp, wayShrine, stumpAxe, choppingBlock, cookFrame, bedroll, dryingRack, weaponRack, grindstone,
  perch, brokenCrate, barrelSide, type Rect,
} from './k_forest';
import { CELL } from '../bestiary/kit';
type W = Ctx['w'];

// ------------------------------------------------------------------ shared scene pieces
/** the chapter's night (flora keeps it: cold blue-violet, fog that never lifts) with this scene's own touches on top */
const DUSK = (o: Partial<Mood> = {}): Mood => ({ ...NIGHT, ...o });
/** the layered wall of woods (flora's ring), planted now so it steps around everything this scene built; keep = areas left open */
function woods(c: Ctx, seed: number, dense: number, keep: Rect[]) { woodsRing(c, seed, dense, { keep }); plantRings(c); }
/** a clump of glowing mushrooms: 2–4 plants of different sizes and heights round a tall one, dark caps with lit rims (blue or teal) */
function shrooms(w: W, x: number, z: number, big: number, col: number, seed: number) {
  const p = col === TEAL ? [0x132626, 0x1a3030, 0x46b896] : [0x141e2c, 0x1a2636, 0x3ea0c4];   // rims glow, but dimly: cold, not neon
  const sz = [Math.max(5, big + 2), Math.max(4, big + 1), 4, 3].slice(0, big >= 4 ? 4 : big >= 3 ? 3 : 2), hs = [2 * sz[0] + 4, 2 * sz[1] + 2, sz[2] + 6, 2 * sz[3] + 3];
  const a0 = hash(seed, 1) * 6.28;
  sz.forEach((s, i) => {
    if (!i) { glowShroom(w, x, z, s, p[0], p[1], p[2], hs[0]); return; }
    const a = a0 + (i - 1) * 2.2, r = (sz[0] + s + 1.5) * CELL;
    glowShroom(w, x + Math.cos(a) * r, z + Math.sin(a) * r, s, p[0], p[1], p[2], hs[i]);
  });
}
/** low edge rocks: [x, z, half size, height] */
function rocks(w: W, list: Array<[number, number, number, number]>, cols = [0x48464e, 0x504e56], top = 0x58565e) {
  list.forEach(([x, z, s, h], i) => boulder(w, x, z, s, Math.max(2, s - 1 + (i % 2)), h, cols[i % cols.length], top, h > 4 ? KC.moss : undefined));
}
/** half-dead shrubs: grey-green, the way everything grows here */
function scrub(w: W, list: Array<[number, number, number, number]>) {
  for (const [x, z, r, h] of list) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13), leaf: 0x2a322c, leafTop: 0x3a4238 });
}
/** fallen leaves heaped flat where the wind leaves them (wall feet, kerbs, corners) */
function leaves(c: Ctx, list: Array<[number, number, number?]>) { for (const [x, z, s] of list) c.cards.add('litter', x, z, { y: 0.012, s: s ?? 0.6, tint: 0x8a6e52, ry: Math.floor(hash(x * 7, z * 5) * 4) * Math.PI / 2 }); }
/** cobwebs strung in a corner: [x, y (top), z, yaw, size] */
function webs(c: Ctx, list: Array<[number, number, number, number, number]>) { for (const [x, y, z, ry, s] of list) c.cards.add('web', x, z, { y, ry, s }); }
const SHROOM_C = 0x4ac8ff, TEAL = 0x5affd0, DEAD_EARTH = 0x3a3430;

// ================================================================== 雾林小径 — the fog trail and the old gate at its end
export const trail: SceneDef = {
  id: 'n_trail', name: '雾林小径', group: '普通', kind: '户外', blurb: '雾总也散不去的林间小道，尽头一道塌了半边的石门；发光的蘑菇是唯一的灯。',
  mood: DUSK({ fogD: NIGHT.fogD * 1.1, mistA: (NIGHT.mistA ?? 0.1) + 0.02 }), foes: ['forest_spider', 'forest_wolf_priest'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2a2e2a, 0x2e322c, 0x26282a], { seed: 3 });
    // the trail: three kerbed runs jogging toward the gate; worn earth, a paler middle where feet went, stepping slabs half of them
    // gone, kerb stones missing where the roots and the frost took them
    const runs: Rect[] = [{ x0: -1.3, z0: 1.0, x1: 1.1, z1: 8.4 }, { x0: -0.7, z0: -5.0, x1: 1.7, z1: 1.6 }, { x0: -0.6, z0: -9.1, x1: 1.4, z1: -4.4 }];
    const mid = (X: number, Z: number) => {
      const z = Z * CELL, r = runs.find(q => z >= q.z0 && z < q.z1) ?? runs[0], cx = M((r.x0 + r.x1) / 2), lz = ((Z % 17) + 17) % 17, n = Math.floor(Z / 17), lx = X - cx - (n & 1 ? 4 : -4);
      if (lz >= 3 && lz <= 10 && Math.abs(lx) <= 6 && hash(n, 5) > 0.35) return lz === 3 || Math.abs(lx) === 6 ? 0x52505e : 0x625f70;   // a flat stepping slab
      return Math.abs(X - cx) <= 5 ? 0x4c4438 : 0x433b31;
    };
    pathway(w, runs, { surf: mid, kerb: 0x5e5c6a, joint: 0x3a3848, band: 0x3a3229, broken: 0.35 });
    for (const [z, dx] of [[-11.2, 0], [-12.1, 0.3], [-13.0, -0.2]]) w.box(M(0.4 + dx) - 6, -1, M(z) - 4, M(0.4 + dx) + 6, 0, M(z) + 3, 0x56545f).box(M(0.4 + dx) - 5, 0, M(z) - 3, M(0.4 + dx) + 5, 0, M(z) + 2, z < -12.5 ? KC.moss : 0x62606c);
    // the landmark: the gate, half its lintel fallen, the rune on its keystone barely alight
    const rune = ruinGate(w, 0.4, -9.8, { span: 2.4, h: 2.4, wing: 2.4, rune: 0x3aa088, ruin: true });
    c.light([rune[0], rune[1] - 0.9, rune[2] + 1.0], 0x5ad8b0, 2.6, 6);
    shrooms(w, -2.5, -8.5, 3, SHROOM_C, 1); shrooms(w, 3.4, -8.4, 2, SHROOM_C, 2);
    // left: the wayside shrine, its candle burned down to a stub (the only warm light on the trail); the signpost lost an arm
    pathway(w, [{ x0: -8.6, z0: -3.8, x1: -5.9, z1: -0.9 }], { surf: flags([0x56546a, 0x5e5c6e], 9, 4), kerb: 0x4a4858, joint: 0x302e3a, broken: 0.4 });
    c.light(wayShrine(w, -7.25, -2.6), 0xffa050, 1.7, 3.6);
    signpost(w, -6.6, -0.5, 1.7, KC.woodD, KC.plank, KC.woodL, [[1, 22]]);
    { const X = M(-6.6), Z = M(-0.5); w.box(X - 14, 0, Z + 3, X - 2, 0, Z + 7, KC.plank).box(X - 15, 0, Z + 4, X - 15, 0, Z + 6, KC.plank); }
    // right front: a fallen mossy trunk, mushrooms sprouting from its end, a boulder behind
    logX(w, M(7.0), -1, M(1.0), M(3.0), 8, 'z', KC.bark, KC.ring, KC.ringD); w.box(M(7.0) - 3, 7, M(1.4), M(7.0) + 2, 7, M(3.4), KC.moss);
    shrooms(w, 7.4, 4.5, 4, SHROOM_C, 3); boulder(w, 8.7, 2.0, 8, 6, 11, 0x46444e, 0x52505a, KC.moss);
    c.light([7.0, 0.4, 3.8], SHROOM_C, 3.2, 6);
    // left back: a stacked outcrop with a giant glowing mushroom at its foot
    boulder(w, -7.9, -8.6, 12, 9, 16, 0x44424c, 0x504e58, KC.moss); boulder(w, -8.6, -7.0, 7, 6, 8, 0x4c4a54, 0x585660);
    glowShroom(w, -6.3, -7.3, 7, 0x141e2c, 0x1a2636, 0x4ab0d4, 16); shrooms(w, -6.9, -6.4, 2, SHROOM_C, 4);
    c.light([-5.8, 0.5, -6.6], SHROOM_C, 3.6, 7);
    // right back: a dead tree, its stump-neighbour and mushrooms (glow only, no lamp)
    deadTree(w, 7.4, -8.8, 5.6, BARK, BARK_D, { seed: 7 }); stump(w, 6.1, -7.3, 4, 6, BARK, KC.ring);
    shrooms(w, 6.4, -6.6, 2, TEAL, 5); boulder(w, 8.6, -6.4, 6, 5, 6, 0x48464e, 0x54525c);
    // front left: a stump with mushrooms
    stump(w, -7.7, 3.8, 5, 7, BARK, KC.ring); shrooms(w, -6.8, 4.5, 2, SHROOM_C, 6);
    c.light([-6.5, 0.35, 4.1], SHROOM_C, 2.4, 4.5);
    // right: a milestone where someone stopped and never went on — a marker stone, a cairn, his pack, his lantern gone dark, his bones
    stele(w, 6.6, -3.2, 12, 3, KC.stone, KC.stoneL, KC.mortar);
    { const X = M(7.4), Z = M(-3.9); w.box(X - 4, 0, Z - 3, X + 4, 1, Z + 3, 0x56545f).box(X - 3, 2, Z - 2, X + 2, 3, Z + 2, 0x626070).box(X - 2, 4, Z - 1, X + 1, 5, Z + 1, 0x6e6c7c).box(X - 1, 6, Z - 1, X, 6, Z, KC.moss); }
    sack(w, 6.1, -2.1, 0x5a5044, KC.rope, 0.8);
    { const X = M(7.1), Z = M(-2.2); w.box(X - 2, 0, Z - 1, X + 2, 2, Z + 1, KC.iron).box(X - 1, 0, Z - 1, X + 1, 2, Z + 1, 0x24242a).box(X - 3, 1, Z, X - 3, 1, Z, KC.rust).box(X + 3, 0, Z - 1, X + 3, 2, Z + 1, KC.iron); }
    bones(w, 7.0, -0.9, KC.bone); skull(w, 6.2, -1.0, 0, KC.bone);
    rocks(w, [[-6.0, 1.6, 5, 4], [-5.9, -5.2, 4, 3], [6.0, 0.2, 4, 3], [6.0, -5.4, 4, 4], [-4.1, 6.5, 4, 3], [3.6, 6.7, 3, 2], [5.6, 6.1, 4, 3], [-9.0, 0.4, 6, 6]]);
    scrub(w, [[-9.0, 2.8, 7, 9], [9.3, -1.6, 8, 10], [-9.4, -5.4, 7, 8], [9.6, 4.4, 6, 8], [3.8, -11.8, 6, 7], [-3.4, -11.9, 6, 8]]);
    // crows on the high points: the keystone, the signpost, the milestone
    perch(w, 0.25, -9.8, 'x-'); perch(w, -6.6, -0.5, 'x+'); perch(w, 6.6, -3.2, 'z+');
    woods(c, 1, 1, [{ x0: -1.4, z0: -17, x1: 2.2, z1: -10.4 }]);
    dress(c, 'grave', {
      seed: 1, clear: [...runs, { x0: -3.4, z0: -10.9, x1: 4.2, z1: -8.6 }, { x0: -8.6, z0: -3.8, x1: -5.9, z1: -0.9 }],
      hang: [[-4.8, -10.4, -1.6, -10.4, 's'], [2.4, -10.4, 5.6, -10.4, 's']],
      shafts: [[0.4, -11.6, 0, 0.1, 1.8], [-6.6, -7.6, 0.3, 0.3, 1.4], [7.8, 1.6, 0.2, 0.3, 1.2]],
    });
    leaves(c, [[-1.4, -8.9, 0.8], [2.0, -8.9, 0.7], [-0.9, -6.2], [1.6, -3.6, 0.5], [-1.2, 2.4, 0.5], [0.6, 6.4], [-6.0, -1.0, 0.5], [6.9, -2.6, 0.5]]);
    webs(c, [[-0.5, 2.46, -9.38, 0, 0.42], [1.3, 2.46, -9.38, 0, 0.36]]);
    c.ambient({ kind: 'spores', color: 0x7ae8ff, rate: 2, area: { x0: -9, z0: -11, x1: 9, z1: 5 } });
  },
};

// ================================================================== 废弃伐木场 — the abandoned sawmill
export const lumber: SceneDef = {
  id: 'n_lumber', name: '废弃伐木场', group: '普通', kind: '户外', blurb: '伐木工早已不见，塌了顶的锯木棚里那盏灯却一直没灭，木桩上还插着生锈的斧子。', mood: DUSK(), foes: ['forest_treant', 'forest_moss_golem'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x342e28, 0x3a332c, 0x2c2e28], { seed: 5 });
    // ground: old sawdust gone grey in front of the shed, the skid track where logs were dragged out, corduroy logs at its mouth
    roundPatch(w, -2.4, -6.2, 2.6, 0x564c3e, 0x4a4236, 4); roundPatch(w, 3.0, -6.8, 1.4, 0x4e463a, 0x443e33, 3);
    for (const x of [-2.9, -1.7]) w.box(M(x) - 1, -1, M(-7.6), M(x) + 1, -1, M(8.4), 0x2a241e);
    for (const z of [6.5, 7.4]) logX(w, M(-3.8), -2, M(z), M(3.4), 5, 'x', KC.bark, KC.ring, KC.ringD);
    // the landmark: the sawmill shed, its roof fallen in over both bays, boards gone from its walls — and its lantern still burning
    c.light(sawShed(w, { x0: -5.8, z0: -11.2, x1: 1.0, z1: -7.8 }, { ruin: true }), 0xffa050, 3.4, 7);
    deck(w, { x0: 1.6, z0: -9.4, x1: 5.8, z1: -8.0 }, 2, { a: KC.plank, b: KC.plankB, frame: KC.woodD, seam: KC.seam });
    w.box(M(2.4), 1, M(-9.2), M(3.0), 1, M(-8.3), null).box(M(4.4), 1, M(-9.0), M(4.8), 1, M(-8.5), null);
    // right back: the big log pile, moss on the top logs, ends to the camera, stakes holding it
    logPile(w, 6.9, -10.8, 3.6, 4, 'z', { d: 7, bark: KC.bark, ring: KC.ring, heart: KC.ringD, post: KC.woodD });
    w.box(M(6.9) - 3, 28, M(-10.8) - 10, M(6.9) + 2, 28, M(-10.8) + 8, KC.moss).box(M(6.9) - 7, 21, M(-10.8) - 6, M(6.9) - 5, 21, M(-10.8) + 9, KC.moss);
    shrooms(w, 8.6, -8.6, 2, SHROOM_C, 11);
    // front left: the stump with the axe still in it, a chopping block, split wood stacked between stakes, chips on the ground
    stumpAxe(w, -7.3, 1.6, 7, 9); choppingBlock(w, -8.6, 3.7); firewood(w, -8.6, -1.3, 9, 10, { bark: KC.bark, a: KC.ring, b: KC.moss, post: KC.woodD });
    shrooms(w, -6.6, 4.4, 2, SHROOM_C, 12);
    c.light([-6.0, 0.35, 3.9], SHROOM_C, 2.4, 4);
    for (const [x, z] of [[-6.4, 0.4], [-7.6, 3.0], [-5.9, 2.2]]) c.cards.add('litter', x, z, { y: 0.01, s: 0.55, tint: 0xa89070, ry: 0 });
    // left: a sawhorse with a half-cut log and a rusted bow saw lying on it; a grindstone with its dry trough
    for (const lx of [-8.9, -6.9]) { const X = M(lx), Z = M(-4.8); w.box(X, -2, Z - 4, X + 1, 9, Z - 3, KC.woodD).box(X, -2, Z + 3, X + 1, 9, Z + 4, KC.woodD).box(X - 1, 10, Z - 5, X + 2, 10, Z + 5, KC.wood).box(X, 4, Z - 3, X + 1, 4, Z + 3, KC.wood); }
    logX(w, M(-9.7), 11, M(-4.8), M(3.4), 6, 'x', KC.bark, KC.ring, KC.ringD);
    { const X = M(-7.9), Z = M(-4.8); w.box(X - 1, 11, Z + 3, X - 1, 18, Z + 3, KC.rust).box(X - 6, 18, Z + 3, X + 4, 18, Z + 3, KC.woodL).box(X - 6, 14, Z + 3, X - 6, 18, Z + 3, KC.woodL).box(X + 4, 14, Z + 3, X + 4, 18, Z + 3, KC.woodL); }
    grindstone(w, -8.4, -7.6);
    // right: the woodcutters' camp — the tent torn and patched, the fire pit long cold, the lamp on its post gone out, a crate
    // stove in, a barrel rolled over
    tent(w, 7.4, -6.9, { hw: 11, hd: 15, tiers: 3, th: 8, c: 0x4a5240, d: 0x323a2c, l: 0x58624c, pole: KC.woodD, torn: true, patch: 0x5e5a48 });
    firePit(w, 6.7, -3.7, false);
    lampPost(w, 8.3, -4.2, 2.1, [-1, 0], KC.woodD, KC.iron, KC.warm, false);
    brokenCrate(w, 8.2, -2.6, 4, KC.plank, KC.woodD); barrelSide(w, 6.4, -2.0, 'x', KC.wood, KC.rust);
    // front right: two stumps, glowing mushrooms, a cart wheel lying where it came off
    stump(w, 6.9, 3.8, 5, 6, BARK, KC.ring); stump(w, 8.1, 2.5, 4, 4, BARK, KC.ring); shrooms(w, 7.5, 4.2, 3, SHROOM_C, 13);
    c.light([7.1, 0.35, 4.2], SHROOM_C, 2.8, 5);
    wheel(w, M(8.4), 0, M(-0.4), 8, 'y', KC.woodL, KC.wood, KC.iron, 1, KC.rust, true);
    // low edges and the cleared-forest frame: stumps everywhere, a few tall pines left standing
    rocks(w, [[-5.9, -2.6, 4, 3], [6.1, 0.8, 4, 3], [-4.6, 6.4, 3, 2], [4.4, 6.6, 4, 3]]);
    for (const [x, z, r, h] of [[-9.3, -10.2, 5, 7], [-10.1, 5.0, 5, 6], [9.9, 0.0, 4, 5], [-4.8, -12.5, 5, 6], [1.6, -12.4, 4, 5], [9.6, 5.6, 5, 5]]) stump(w, x, z, r, h, BARK, KC.ring);
    scrub(w, [[-9.4, 1.8, 7, 9], [9.6, -7.6, 6, 8], [-2.0, -12.8, 6, 7]]);
    // boards dropped where they were stacked
    for (const [x0, z0, x1, h] of [[-9.6, -2.8, -7.4, 0], [-9.4, -2.5, -7.8, 1], [6.0, 0.4, 8.6, 0]] as const) w.box(M(x0), h, M(z0), M(x1), h, M(z0) + 3, h ? KC.plank : KC.plankB);
    // crows on the shed ridge and on a stake of the log pile
    perch(w, -4.0, -9.5, 'x+'); perch(w, -0.6, -9.5, 'x-'); perch(w, 8.1, -9.0, 'z+');
    woods(c, 2, 0.7, [{ x0: -4.0, z0: -9, x1: -1.8, z1: -7.8 }]);
    dress(c, 'grave', {
      seed: 2, dense: 0.8, clear: [{ x0: -6.2, z0: -11.6, x1: 1.4, z1: -7.4 }, { x0: 1.6, z0: -9.4, x1: 5.8, z1: -8.0 }, { x0: 5.8, z0: -8.4, x1: 9, z1: -2.0 }, { x0: -3.4, z0: -8, x1: -1.2, z1: 8.4 }],
      hang: [[-5.4, -11.5, 0.6, -11.5, 's']],
      shafts: [[-3.8, -9.6, 0.1, 0.12, 1.4], [-0.8, -10.4, 0.2, 0.3, 1.6], [8.6, -0.8, -0.2, 0.3, 1.2]],
    });
    c.ambient({ kind: 'dust', color: 0xc8c0b0, rate: 2, area: { x0: -5.8, z0: -11.2, x1: 1.0, z1: -7.4 }, y: [0.3, 2.4] });
    for (const [x, z, sc] of [[-2.0, -5.0, 0.7], [0.6, -6.0, 0.5], [3.2, -5.2, 0.6], [-6.9, -3.4, 0.6], [6.6, 1.4, 0.5]] as const) c.cards.add('litter', x, z, { y: 0.01, s: sc, tint: 0xa89070, ry: 0 });
    leaves(c, [[-5.4, -7.4, 0.8], [0.6, -7.5, 0.7], [-3.2, -7.2], [5.6, -7.6], [6.2, -4.4, 0.5], [-8.2, -6.2, 0.5]]);
    webs(c, [[-5.75, 2.2, -7.66, 0, 0.32], [-2.45, 2.2, -7.66, 0, 0.3], [0.95, 2.2, -7.66, 0, 0.32]]);
  },
};

// ================================================================== 营火 · 林间营地 — the camp round the fire
export const camp: SceneDef = {
  id: 'c_camp', name: '营火 · 林间营地', group: '节点', kind: '户外', blurb: '还能歇一歇脚的地方：帐篷破了一顶、塌了一顶，火快熄了，余烬还温着。', mood: DUSK(),
  build(c) {
    const w = c.w, FX = 0.6, FZ = -2.4;
    patches(w, AREA, [0x2c2e28, 0x32322a, 0x2a2a26], { seed: 9 });
    // ground: a trampled earth ring round the fire, an ash ring at the pit, a footpath out toward the front
    roundPatch(w, FX, FZ, 3.8, 0x3e352c, 0x342c26, 4);
    roundPatch(w, FX, FZ, 1.25, 0x34302c, 0x34302c, 1);
    pathway(w, [{ x0: -2.9, z0: 0.6, x1: -1.1, z1: 8.4 }], { surf: (_X, Z) => ((Z >> 2) & 1 ? 0x403629 : 0x3c3228), kerb: 0x4e4c56, joint: 0x36343e, band: 0x382e26, broken: 0.45 });
    // the fire: burned low — charred logs, a bed of embers, one small tongue of flame; the cooking frame and its pot; log seats
    const fp = firePit(w, FX, FZ, 'dying'); cookFrame(w, FX, FZ);
    c.light([FX, 0.7, FZ], 0xff8a40, 7, 9.5); c.flame([fp[0], 0.32, fp[2]], 0xff9a40, 0.13);
    c.ambient({ kind: 'embers', color: 0xff8a40, rate: 2, area: { x0: FX - 0.3, z0: FZ - 0.3, x1: FX + 0.3, z1: FZ + 0.3 }, y: [0.2, 0.5] });
    logX(w, M(FX - 1.6), 0, M(FZ - 2.3), M(3.2), 6, 'x', KC.bark, KC.ring, KC.ringD);
    logX(w, M(FX + 2.7), 0, M(FZ - 1.2), M(2.6), 6, 'z', KC.bark, KC.ring, KC.ringD);
    stump(w, FX - 2.6, FZ + 0.6, 4, 6, BARK, KC.ring);
    // back left: the big tent, patched and torn but still standing; its lamp out; a bedroll beside it
    tent(w, -3.6, -8.4, { hw: 13, hd: 20, tiers: 3, th: 10, c: 0x5e5848, d: 0x3e382e, l: 0x6e6858, pole: KC.woodD, torn: true, patch: 0x4a4a3c });
    lampPost(w, -0.9, -6.0, 2.0, [-1, 0], KC.woodD, KC.iron, KC.warm, false);
    bedroll(w, -6.2, -5.4, false, 0x4e443c, 0x3a322c); sack(w, -6.3, -3.6, 0x5a5044, KC.rope);
    // back right: the small tent, its back half fallen in; the banner on its pole in rags; the supplies broken open
    tent(w, 4.0, -8.6, { hw: 10, hd: 14, tiers: 3, th: 8, c: 0x562e2a, d: 0x3a1e1c, l: 0x663a34, pole: KC.woodD, collapse: true });
    { const X = M(5.8), Z = M(-10.0); w.box(X, -2, Z, X + 1, 46, Z + 1, KC.woodD).box(X + 2, 30, Z, X + 14, 44, Z, 0x4e2a28).box(X + 2, 30, Z, X + 14, 31, Z, 0x3a1e1c).box(X + 6, 36, Z, X + 9, 39, Z, 0x6e6658);
      w.box(X + 9, 34, Z, X + 11, 36, Z, null).box(X + 2, 30, Z, X + 5, 32, Z, null).box(X + 11, 30, Z, X + 14, 33, Z, null).box(X + 13, 38, Z, X + 14, 40, Z, null).box(X - 1, 47, Z - 1, X + 2, 47, Z + 2, KC.rust); }
    brokenCrate(w, 6.8, -6.4, 5, KC.plank, KC.woodD); crate(w, 7.7, -5.2, 4, KC.plankB, KC.woodD);
    barrelSide(w, 5.9, -4.7, 'z', KC.wood, KC.rust); sack(w, 7.0, -4.1, 0x5a5044, KC.rope); sack(w, 8.2, -3.9, 0x4e463c, KC.rope, 0.8);
    // right: firewood stacked between stakes, the chopping block
    firewood(w, 7.0, -2.0, 9, 9, { bark: KC.bark, a: KC.ring, b: KC.moss, post: KC.woodD }); choppingBlock(w, 6.1, -0.2);
    // left: the cook's corner — a drying rack with grey hides, a small table with a bowl and a jug, a water barrel, its lantern out
    dryingRack(w, -7.6, -3.4, [0x5e544a, 0x4a423c, 0x6a6052]);
    table(w, -7.0, -1.0, 1.4, 0.8, KC.woodL, KC.woodD);
    { const T = lift(w, 12), X = M(-7.0), Z = M(-1.0); T.box(X - 6, 0, Z - 2, X - 3, 1, Z + 1, 0x5e4e40).box(X - 5, 1, Z - 1, X - 4, 1, Z, 0x2e2622).box(X + 2, 0, Z - 1, X + 4, 4, Z + 1, 0x5a4a3a).box(X + 3, 5, Z, X + 3, 5, Z, 0x5a4a3a); }
    barrel(w, -8.7, -0.6, KC.wood, KC.rust);
    lantern(lift(w, 12), M(-6.5), 5, M(-0.8), KC.iron, KC.warm, false, false);
    // front left: a second bedroll and a pack, the weapon rack with a shield
    bedroll(w, -7.0, 3.0, true, 0x3e4250, 0x2e3240); sack(w, -8.6, 3.6, 0x4e463c, KC.rope); weaponRack(w, -8.4, 1.0);
    // front right: glowing mushrooms by a boulder (the one cold light)
    boulder(w, 8.4, 2.6, 8, 6, 10, 0x48464e, 0x54525c, KC.moss); shrooms(w, 7.2, 3.6, 3, SHROOM_C, 21);
    c.light([6.8, 0.35, 3.2], SHROOM_C, 2.8, 5.5);
    rocks(w, [[-4.6, 6.6, 3, 2], [4.0, 6.4, 4, 3], [-9.6, -6.6, 6, 6]]);
    scrub(w, [[-9.6, 0.8, 7, 9], [9.8, -2.8, 7, 9], [-2.0, -12.0, 7, 8], [2.0, -12.4, 6, 7], [9.6, 5.0, 6, 8], [-9.8, 5.4, 6, 7]]);
    // crows: on the drying rack's bar, on the banner pole, on the ridge pole of the standing tent
    perch(w, -7.6, -3.4, 'x+'); perch(w, 5.85, -9.95, 'x-'); perch(w, -3.6, -9.6, 'z+');
    woods(c, 9, 0.9, []);
    dress(c, 'grave', {
      seed: 15, clear: [{ x0: FX - 4, z0: FZ - 4, x1: FX + 4, z1: FZ + 3.6 }, { x0: -2.9, z0: 0.6, x1: -1.1, z1: 8.4 }, { x0: -6.4, z0: -10.4, x1: -0.8, z1: -5.4 }],
      shafts: [[-6.8, -7.0, 0.3, 0.32, 1.4], [7.6, 1.6, -0.2, 0.3, 1.2], [3.6, -8.4, 0.1, 0.15, 1.2]],
    });
    leaves(c, [[-5.2, -6.6, 0.7], [-1.8, -6.8], [2.6, -7.4, 0.7], [5.0, -6.0], [-8.0, -2.2, 0.5], [3.4, 0.6, 0.5], [-3.4, -0.6, 0.5]]);
  },
};

// ================================================================== 商人 · 林边货车 — the merchant's wagon on the forest road
export const merchant: SceneDef = {
  id: 'c_merchant', name: '商人 · 林边货车', group: '节点', kind: '户外', blurb: '死寂的林边路上停着一辆破篷车，车头还亮着一盏灯；那个怪人从不问你从哪来。', mood: DUSK(),
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2c2e28, 0x32322a, 0x36302a], { seed: 10 });
    // ground: the forest road along the back (kerbs half gone, packed earth, two wheel ruts) and a footpath teeing into it
    const road: Rect = { x0: -11.4, z0: -11.0, x1: 11.4, z1: -6.8 }, foot: Rect = { x0: -2.6, z0: -7.0, x1: -0.6, z1: 8.4 };
    const rut = (Z: number) => { const z = Z * CELL; return Math.abs(z + 10.15) < 0.1 || Math.abs(z + 7.75) < 0.1; };
    pathway(w, [road, foot], { surf: (X, Z) => (Z * CELL < -6.9 && rut(Z) ? 0x30281f : (X * CELL > -2.4 && X * CELL < -0.8 && Z * CELL > -6.6 && ((Z >> 2) & 1)) ? 0x403529 : 0x433a2d), kerb: 0x52505c, joint: 0x36343e, band: 0x3a3127, broken: 0.4 });
    // the landmark: the wagon, patched and torn, one wheel broken and the axle propped on stones — and its one lamp still lit
    c.light(wagon(w, 1.9, -8.9, { len: 4.6, wid: 2.0, flip: true, worn: true }), 0xffa050, 4.2, 8.5);
    brokenCrate(w, 0.2, -6.1, 5, KC.plank, KC.woodD); barrelSide(w, 1.4, -6.4, 'x', KC.wood, KC.rust);
    sack(w, 0.9, -5.4, 0x5a5044, KC.rope); sack(w, 1.8, -5.5, 0x4e463c, KC.rope, 0.8);
    // the stall on its plank deck: a tattered awning of faded stripes, murky jars and skulls on the counter, dried things hung up to
    // cure, a stained rug; its own lantern long gone out
    const dk: Rect = { x0: -8.0, z0: -7.0, x1: -3.2, z1: -3.8 }, DH = 3;
    deck(w, dk, DH, { a: KC.plank, b: KC.plankB, frame: KC.woodD, seam: KC.seam, step: true });
    w.box(M(-7.6), DH - 1, M(-4.4), M(-7.0), DH - 1, M(-4.0), null).box(M(-3.9), DH - 1, M(-6.8), M(-3.5), DH - 1, M(-6.2), null);
    const s = stall(lift(w, DH), -5.6, -6.0, { wid: 3.4, dep: 1.4, stripe: [0x4a3634, 0x625c50], tattered: true });
    { const T = lift(w, DH), X = s.X, Z = s.Z + s.hz - 3, y = s.top;
      const jars = [0x34402e, 0x3e3446, 0x7a7466, 0x2e3a2c, 0x4a3e30, 0x3e3446];
      for (let i = 0; i < 6; i++) { const u = X - 18 + i * 4, tall = i % 2; T.box(u, y, Z - 1, u + 1, y + 2 + tall, Z, jars[i]).set(u, y + 3 + tall, Z, 0x4a3a2c); if (i === 1 || i === 4) T.set(u, y + 1, Z, 0x3a8a5a, 1); }
      skull(T, (X + 8) * CELL, Z * CELL, y, KC.bone); skull(T, (X + 12) * CELL, (Z - 1) * CELL, y, 0xa8a090);
      T.box(X + 15, y, Z - 3, X + 21, y + 4, Z + 1, 0x4a3a2e).box(X + 15, y + 2, Z - 3, X + 21, y + 2, Z + 1, KC.rust).box(X + 18, y + 1, Z + 1, X + 18, y + 2, Z + 1, KC.rust);
      for (const [sy, n] of [[11, 5], [19, 4]]) for (let i = 0; i < n; i++) { const u = X - 20 + i * 9; T.box(u, sy, s.Z - s.hz + 1, u + 2, sy + 3, s.Z - s.hz + 2, [0x3e4a38, 0x4a3a34, 0x3a3e4a, 0x5a5040][i % 4]).box(u, sy + 4, s.Z - s.hz + 1, u + 2, sy + 4, s.Z - s.hz + 2, 0x3a2e26); }
      for (let i = 0; i < 6; i++) { const u = X - 16 + i * 6, len = 3 + (i * 7) % 4; T.box(u, 27 - len, s.Z + s.hz + 3, u, 26, s.Z + s.hz + 3, i % 2 ? 0x46523a : 0x5a4a38); }
      lantern(T, X - s.hx - 1, 27, s.Z + s.hz + 4, KC.iron, KC.warm, false, false);
    }
    { const X0 = M(-7.3), X1 = M(-3.9), Z0 = M(-5.1), Z1 = M(-4.1), y = DH - 1, cx = (X0 + X1) >> 1, cz = (Z0 + Z1) >> 1;
      w.box(X0, y, Z0, X1, y, Z1, 0x442a28).box(X0 + 2, y, Z0 + 2, X1 - 2, y, Z1 - 2, 0x2a2c34).box(cx - 4, y, cz - 1, cx + 4, y, cz + 1, 0x6a6458).box(cx - 1, y, Z0 + 3, cx + 1, y, Z1 - 3, 0x6a6458);
      w.box(X1 - 9, y, Z0 + 1, X1 - 4, y, Z0 + 4, 0x22201e); }
    // the shop sign over the footpath: the tarnished coin on a board that has split, its right half slipped down a hand's breadth
    { const X = M(-3.0), Z = M(-3.0), H = 30; w.box(X - 1, -2, Z - 1, X + 1, H, Z + 1, KC.woodD).box(X - 2, H + 1, Z - 2, X + 2, H + 1, Z + 2, KC.woodL).box(X, H - 2, Z, X + 14, H - 1, Z, KC.wood);
      w.box(X + 6, H - 5, Z, X + 6, H - 3, Z, KC.rust).box(X + 12, H - 5, Z, X + 12, H - 4, Z, KC.rust);
      w.box(X + 3, H - 17, Z, X + 8, H - 6, Z, KC.plank).box(X + 3, H - 17, Z, X + 8, H - 17, Z, KC.woodD).box(X + 3, H - 6, Z, X + 8, H - 6, Z, KC.woodD);
      w.box(X + 9, H - 20, Z, X + 14, H - 9, Z, KC.plankB).box(X + 9, H - 20, Z, X + 14, H - 20, Z, KC.woodD).box(X + 9, H - 9, Z, X + 14, H - 9, Z, KC.woodD);
      wheel(w, X + 8, H - 12, Z + 1, 4, 'z', KC.brass, KC.brass, KC.brass, 1); w.box(X + 7, H - 12, Z + 1, X + 9, H - 10, Z + 1, KC.plank).box(X + 7, H - 12, Z + 2, X + 9, H - 10, Z + 2, null); }
    weaponRack(w, -9.0, -5.4);
    // the wares laid out on a mat by the path: a rusted sword, a dented shield, a helmet, pots — and somebody's bones
    { const X0 = M(1.2), X1 = M(3.6), Z0 = M(-4.6), Z1 = M(-3.2), cz = (Z0 + Z1) >> 1;
      w.box(X0, 0, Z0, X1, 0, Z1, 0x3e2e2a).box(X0 + 1, 0, Z0 + 1, X1 - 1, 0, Z1 - 1, 0x4a3630).box(X0, 0, Z0, X0, 0, Z1, KC.brass).box(X1, 0, Z0, X1, 0, Z1, KC.brass);
      w.box(X0 + 3, 1, cz - 4, X0 + 3, 1, cz + 6, KC.rust).box(X0 + 1, 1, cz + 3, X0 + 5, 1, cz + 3, KC.brass).box(X0 + 3, 1, cz + 4, X0 + 3, 1, cz + 6, KC.woodD);
      { const SX = X0 + 12; for (const [a, b] of [[5, 2], [4, 4], [2, 5]]) w.box(SX - a, 1, cz - b, SX + a, 1, cz + b, KC.blue); w.box(SX - 5, 2, cz, SX + 5, 2, cz, KC.brass).box(SX, 2, cz - 5, SX, 2, cz + 5, KC.brass).box(SX - 1, 2, cz - 1, SX + 1, 2, cz + 1, KC.ironL).box(SX + 2, 1, cz + 2, SX + 4, 2, cz + 4, null); }
      w.box(X0 + 20, 1, cz - 3, X0 + 25, 3, cz + 2, KC.ironL).box(X0 + 21, 4, cz - 2, X0 + 24, 5, cz + 1, KC.ironL).box(X0 + 20, 1, cz + 2, X0 + 25, 1, cz + 3, KC.rust);
      w.box(X1 - 5, 1, Z0 + 2, X1 - 3, 3, Z0 + 4, 0x4a3a2e).box(X1 - 5, 1, Z1 - 4, X1 - 2, 4, Z1 - 1, 0x3e4436); }
    bones(w, 4.4, -3.9, KC.bone); skull(w, 4.0, -4.6, 0, KC.bone);
    // right: where a horse once rested — the hitching post, a dry cracked trough, a rotten hay bale, a horse's bones in the grass
    { const X = M(6.0), Z = M(-6.6); w.box(X - 1, -2, Z, X + 1, 14, Z + 1, KC.woodD).box(X - 1, 15, Z - 1, X + 1, 15, Z + 2, KC.woodL).box(X + 3, 0, Z - 2, X + 12, 4, Z + 3, KC.wood).box(X + 4, 3, Z - 1, X + 11, 4, Z + 2, 0x24222a).box(X + 8, 1, Z + 3, X + 9, 4, Z + 3, null); }
    { const X = M(7.6), Z = M(-5.2); w.box(X - 6, 0, Z - 4, X + 6, 5, Z + 4, 0x6a6450); for (let y = 1; y < 5; y += 2) w.box(X - 6, y, Z - 4, X + 6, y, Z + 4, 0x5e5846); w.box(X - 5, 6, Z - 3, X + 2, 6, Z + 3, 0x76705a).box(X - 3, 0, Z - 4, X - 3, 5, Z + 4, 0x4a4030).box(X + 3, 0, Z - 4, X + 3, 5, Z + 4, 0x4a4030); }
    c.cards.add('bones', 8.4, -6.8, { y: 0.012, s: 0.9, ry: 0.5 });
    // front corners: cold mushrooms by a boulder on the left, scrub on the right
    boulder(w, -8.3, 2.6, 8, 6, 10, 0x48464e, 0x54525c, KC.moss); shrooms(w, -7.2, 3.5, 3, SHROOM_C, 31);
    c.light([-6.7, 0.35, 3.1], SHROOM_C, 2.8, 5.5);
    rocks(w, [[-4.8, 6.5, 3, 2], [4.6, 6.4, 4, 3], [8.6, 3.0, 7, 7], [-9.6, -2.0, 6, 5], [-3.6, 1.2, 4, 3], [5.9, -1.6, 4, 3]]);
    scrub(w, [[9.8, 0.0, 7, 9], [-9.8, 5.0, 6, 8], [7.0, 4.6, 6, 7], [-10, -5.0, 6, 8]]);
    // crows: one on the canopy, one on the sign's arm, one on the hitching post
    perch(w, 2.6, -8.9, 'x-'); perch(w, -2.1, -3.0, 'x+'); perch(w, 6.05, -6.55, 'z+');
    woods(c, 10, 0.85, [road]);
    dress(c, 'grave', { seed: 16, clear: [road, foot, dk, { x0: -0.6, z0: -7, x1: 9, z1: -4.4 }, { x0: 1.0, z0: -4.8, x1: 3.8, z1: -3.0 }], shafts: [[-7, -4.4, 0.3, 0.3, 1.4], [7.6, -1.4, -0.2, 0.3, 1.2]] });
    leaves(c, [[-1.0, -7.4, 0.7], [-8.4, -7.2, 0.6], [5.0, -7.2, 0.7], [-2.2, -2.0, 0.5], [3.2, -7.4, 0.5], [-0.4, 1.8, 0.5]]);
    webs(c, [[-7.25, 2.3, -6.75, 0, 0.36], [-0.6, 2.0, -8.0, 0, 0.3]]);
  },
};

// ================================================================== 事件 · 林中古祠 — the nameless shrine with fresh offerings
export const shrine: SceneDef = {
  id: 'c_shrine', name: '事件 · 林中古祠', group: '节点', kind: '户外', blurb: '一座没人记得名字的小祠，屋顶塌了一角，石像捧着一团冷光；供桌上的花和蜡烛却是新的。', mood: DUSK({ hemiSky: 0x6a6a9a }),
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2a2e2a, 0x30322c, 0x282a28], { seed: 11 });
    // the approach: a flagstone forecourt and path, stones missing here and there (bare earth where they were), kerbs half gone
    const court: Rect = { x0: -2.6, z0: -7.7, x1: 3.4, z1: -5.2 }, walk: Rect = { x0: -0.6, z0: -5.6, x1: 1.4, z1: 8.4 };
    const fl = flags([0x5a586a, 0x626074, 0x545264], 11, 7);
    pathway(w, [court, walk], { surf: (X, Z) => { const v = fl(X, Z); if (v == null) return null; const r = Math.floor(Z / 11), cc = Math.floor((X + (r & 1 ? 5 : 0)) / 11); return hash(cc, r, 77) < 0.16 ? DEAD_EARTH : v; }, kerb: 0x484656, joint: 0x302e3a, broken: 0.3 });
    // the landmark: the shrine, a corner of its roof caved in, its statue's face worn away, the orb in its hands the lead light
    { const o = shrineTemple(w, 0.4, -9.5, { orb: 0xb8f4ff, ruin: true }); c.light([o[0], o[1] + 0.3, o[2] + 0.9], 0xa8e0ff, 3.4, 7.5); }
    // the offering table: stone slab on two blocks — and on it, fresh flowers, fruit, candles burning (the one warm light here)
    { const X = M(0.4), Z = M(-6.2);
      masonry(w, X - 9, 0, Z - 3, X - 5, 7, Z + 3, KC.stone, KC.mortar, { ch: 4, cl: 4 }); masonry(w, X + 5, 0, Z - 3, X + 9, 7, Z + 3, KC.stone, KC.mortar, { ch: 4, cl: 4 });
      w.box(X - 11, 8, Z - 4, X + 11, 9, Z + 4, KC.stoneL).box(X - 11, 8, Z - 4, X + 11, 8, Z + 4, KC.stone).box(X - 11, 9, Z + 3, X - 7, 9, Z + 4, KC.moss);
      w.box(X - 9, 10, Z - 1, X - 5, 11, Z + 2, 0x6a4a2a).box(X - 8, 12, Z, X - 7, 12, Z + 1, 0xc84a3a).box(X - 6, 12, Z - 1, X - 6, 12, Z, 0xd8b040).set(X - 7, 13, Z, 0xc84a3a);
      for (const [u, h] of [[-3, 4], [0, 5], [3, 3]]) candle(w, (X + u) * CELL + 0.035, (Z - 2) * CELL, h, 0xf0e8d0, 0xffd070, 10);
      w.box(X + 5, 10, Z - 1, X + 8, 11, Z + 2, 0x5e5c6c).box(X + 6, 12, Z, X + 7, 15, Z + 1, 0x7a766a);
      for (const [u, cl] of [[-10, 0xe86a8a], [-10, 0xf0e070], [10, 0xe86a8a], [10, 0xffffff]] as const) w.box(X + u, 10, Z + 2, X + u, 11, Z + 2, 0x3e6a2e).set(X + u, 12, Z + 2 + (cl === 0xf0e070 || cl === 0xffffff ? 1 : 0), cl);
      c.light([0.4, 1.5, -5.9], 0xffb860, 1.8, 4); }
    // the stone lamps have gone dark; the right one has lost its head, which lies in the grass beside it
    stoneLamp(w, -2.2, -6.3, KC.warm, false);
    { const X = M(3.0), Z = M(-6.3); w.box(X - 4, -1, Z - 4, X + 4, 1, Z + 4, KC.stoneD).box(X - 3, 2, Z - 3, X + 3, 3, Z + 3, KC.stone).box(X - 2, 4, Z - 2, X + 2, 11, Z + 2, KC.stone).box(X - 2, 12, Z - 2, X, 12, Z + 2, KC.stone);
      w.box(X + 6, 0, Z + 3, X + 12, 5, Z + 9, KC.stone).box(X + 7, 2, Z + 10, X + 11, 4, Z + 10, 0x1e1c24).box(X + 5, 0, Z + 2, X + 13, 0, Z + 10, KC.stoneL).box(X + 7, 6, Z + 4, X + 11, 6, Z + 7, KC.moss); }
    // left: old tablets whose names have worn away — one fallen on its face, one sunk to its shoulders, the middle one still standing
    // with a candle at its foot; a broken column and its fallen drum
    { const X = M(-8.7), Z = M(-8.6); w.box(X - 6, -1, Z - 3, X + 6, 1, Z + 3, KC.stoneD).box(X - 4, 0, Z + 4, X + 4, 2, Z + 21, KC.stone).box(X - 3, 3, Z + 6, X + 3, 3, Z + 18, KC.moss); }
    stele(w, -7.3, -8.9, 25, 5, 0x6e6c80, KC.stoneL, KC.mortar); stele(w, -5.9, -8.6, 9, 4, KC.stone, KC.stoneL, KC.mortar);
    for (const x of [-7.3, -5.9]) { const X = M(x), Z = M(-8.2); w.box(X - 2, 0, Z + 2, X - 1, 0, Z + 3, KC.stoneL).set(X + 1, 0, Z + 3, KC.stoneD).set(X - 2, 1, Z + 2, KC.stone); }
    candle(w, -7.3, -8.0, 3, 0xf0e8d0, 0xffd070, 2);
    pillar(w, -9.4, -6.0, 1.3, KC.stone, KC.stoneL, { r: 4, broken: true });
    { const X = M(-7.0), Z = M(-5.6); masonry(w, X - 10, -1, Z - 4, X + 3, 6, Z + 3, KC.stone, KC.mortar, { ch: 8, cl: 7, cap: KC.moss }); w.box(X + 4, -1, Z - 3, X + 4, 5, Z + 2, KC.stoneL); }
    // right: a prayer rope between two posts, its cloth strips grey and torn; an old dead tree behind
    { const X0 = M(5.8), X1 = M(8.8), Z = M(-6.0), H = 22;
      w.box(X0 - 1, -2, Z - 1, X0 + 1, H + 2, Z + 1, KC.woodD).box(X1 - 1, -2, Z - 1, X1 + 1, H + 2, Z + 1, KC.woodD).box(X0, H, Z, X1, H, Z, KC.rope);
      for (let u = X0 + 4, i = 0; u < X1 - 2; u += 5, i++) if (i !== 2) w.box(u, H - 6 - (i % 2) * 3 + (i === 4 ? 3 : 0), Z, u + 1, H - 1, Z, i % 3 === 1 ? 0x5a3432 : 0x8a8478); }
    deadTree(w, 8.4, -9.0, 5.8, BARK, BARK_D, { seed: 13 });
    // front left: the stone bench, one leg gone and that end of the seat down in the grass; front right: mushrooms by a boulder
    { const X = M(-7.2), Z = M(2.6); w.box(X + 8, 0, Z - 2, X + 10, 4, Z + 2, KC.stone).box(X - 1, 5, Z - 3, X + 12, 6, Z + 3, KC.stoneL).box(X - 12, 0, Z - 3, X - 2, 1, Z + 3, KC.stoneL).box(X - 11, 0, Z - 3, X - 9, 2, Z - 2, KC.stone).box(X + 2, 7, Z - 3, X + 6, 7, Z + 3, KC.moss).box(X - 8, 2, Z - 3, X - 4, 2, Z + 3, KC.moss); }
    boulder(w, 8.4, 2.6, 8, 6, 10, 0x48464e, 0x54525c, KC.moss); shrooms(w, 7.2, 3.6, 3, TEAL, 41);
    c.light([6.8, 0.35, 3.2], TEAL, 2.4, 5);
    rocks(w, [[-4.6, 6.5, 3, 2], [4.2, 6.6, 4, 3], [-9.4, -1.6, 6, 6], [9.6, -2.6, 6, 5]]);
    scrub(w, [[-9.8, 3.6, 7, 9], [9.8, 0.4, 7, 9], [-4.6, -12.0, 7, 8], [5.0, -12.0, 7, 8], [6.6, 4.8, 6, 7]]);
    // crows: on the finial, on the standing tablet, on the prayer-rope post
    perch(w, 0.4, -9.5, 'x+'); perch(w, -7.3, -8.9, 'x-'); perch(w, 5.8, -6.0, 'z+');
    woods(c, 11, 0.9, []);
    dress(c, 'grave', { seed: 17, dense: 0.9, clear: [court, walk, { x0: -2.4, z0: -12, x1: 3.2, z1: -7.2 }], shafts: [[0.4, -9.6, 0, 0.1, 2.4], [-6.6, -3, 0.3, 0.3, 1.2]] });
    // ivy and moss down the front columns and the stepped platform, leaves in the corners, webs between the columns
    for (const [x, y, s, k] of [[-0.85, 2.6, 0.72, 'vine'], [1.75, 2.6, 0.6, 'moss'], [-1.0, 2.6, 0.5, 'moss']] as const) c.cards.add(k, x, -8.33, { y, ry: 0, s });
    leaves(c, [[-2.3, -7.6, 0.7], [3.0, -7.6, 0.6], [-1.6, -5.4, 0.5], [2.6, -5.4, 0.5], [0.4, -3.0, 0.5], [-4.8, -8.2, 0.7]]);
    webs(c, [[-0.25, 2.6, -8.3, 0, 0.42], [1.05, 2.6, -8.3, 0, 0.36]]);
  },
};
