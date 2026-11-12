// Outdoor forest scenes: the trail, the lumber camp, and the three nodes (camp, merchant, shrine).
// Each is composed the Minecraft-Dungeons way: one clear landmark at the back (biggest mass, clearest silhouette, its own light),
// story groups of 2–5 props in different materials on the flanks with empty ground between them, low rocks / logs / shrubs easing
// the edges, a designed floor (kerbed paths, trampled rings, decks) instead of one flat colour, and a few warm and cold lights with
// a clear lead. The battle floor (PLAY) stays flat in the fight scenes; the node scenes keep an open patch where the hero stands.
import { type SceneDef, type Ctx } from './stage';
import { M, hash, AREA, patches, crate, barrel, table, candle, pillar } from './props';
import { deadTree, stump, bush, woodsRing, plantRings } from './flora';
import { NIGHT, BARK, BARK_D, WOOD, WOOD_D, WOOD_L, IRON } from './common';
import { dress } from './dress';
import {
  KC, lift, glowShroom, stele, masonry, pathway, flags, roundPatch, deck, boulder, logX, logPile, firewood, sack, lampPost, signpost, firePit, lantern, wheel,
  ruinGate, sawShed, tent, wagon, stall, shrineTemple, stoneLamp, wayShrine, stumpAxe, choppingBlock, cookFrame, bedroll, dryingRack, weaponRack, grindstone,
  type Rect,
} from './k_forest';
import { CELL } from '../bestiary/kit';
type W = Ctx['w'];

// ------------------------------------------------------------------ shared scene pieces
/** the layered wall of woods (flora's ring), planted now so it steps around everything this scene built; keep = areas left open */
function woods(c: Ctx, seed: number, dense: number, keep: Rect[]) { woodsRing(c, seed, dense, { keep }); plantRings(c); }
/** a clump of glowing mushrooms: 2–4 plants of different sizes and heights round a tall one, dark caps with lit rims (blue or teal) */
function shrooms(w: W, x: number, z: number, big: number, col: number, seed: number) {
  const p = col === TEAL ? [0x132626, 0x1a3030, 0x7affd8] : [0x141e2c, 0x1a2636, 0x6ae0ff];
  const sz = [Math.max(5, big + 2), Math.max(4, big + 1), 4, 3].slice(0, big >= 4 ? 4 : big >= 3 ? 3 : 2), hs = [2 * sz[0] + 4, 2 * sz[1] + 2, sz[2] + 6, 2 * sz[3] + 3];
  const a0 = hash(seed, 1) * 6.28;
  sz.forEach((s, i) => {
    if (!i) { glowShroom(w, x, z, s, p[0], p[1], p[2], hs[0]); return; }
    const a = a0 + (i - 1) * 2.2, r = (sz[0] + s + 1.5) * CELL;
    glowShroom(w, x + Math.cos(a) * r, z + Math.sin(a) * r, s, p[0], p[1], p[2], hs[i]);
  });
}
/** low edge rocks: [x, z, half size, height] */
function rocks(w: W, list: Array<[number, number, number, number]>, cols = [0x4a4854, 0x52505c], top = 0x5a5866) {
  list.forEach(([x, z, s, h], i) => boulder(w, x, z, s, Math.max(2, s - 1 + (i % 2)), h, cols[i % cols.length], top, h > 4 ? KC.moss : undefined));
}
const SHROOM_C = 0x4ac8ff, TEAL = 0x5affd0;

// ================================================================== 雾林小径 — the fog trail and the old gate at its end
export const trail: SceneDef = {
  id: 'n_trail', name: '雾林小径', group: '普通', kind: '户外', blurb: '浓雾里的林间小道通向一道没人认得的石门，发光的蘑菇是唯一的灯。',
  mood: { ...NIGHT, fogD: 0.023, mist: 0x6a70a0, mistA: 0.12 }, foes: ['forest_spider', 'forest_wolf_priest'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2a3428, 0x2e3a2c, 0x262e26], { seed: 3 });
    // the trail: three kerbed runs jogging toward the gate; worn earth, a paler middle where feet go, a darker band inside the kerb
    const runs: Rect[] = [{ x0: -1.3, z0: 1.0, x1: 1.1, z1: 8.4 }, { x0: -0.7, z0: -5.0, x1: 1.7, z1: 1.6 }, { x0: -0.6, z0: -9.1, x1: 1.4, z1: -4.4 }];
    const mid = (X: number, Z: number) => {
      const z = Z * CELL, r = runs.find(q => z >= q.z0 && z < q.z1) ?? runs[0], cx = M((r.x0 + r.x1) / 2), lz = ((Z % 17) + 17) % 17, n = Math.floor(Z / 17), lx = X - cx - (n & 1 ? 4 : -4);
      if (lz >= 3 && lz <= 10 && Math.abs(lx) <= 6) return lz === 3 || Math.abs(lx) === 6 ? 0x56546a : 0x6a687c;   // a flat stepping slab
      return Math.abs(X - cx) <= 5 ? 0x5a4e3c : 0x4e4334;
    };
    pathway(w, runs, { surf: mid, kerb: 0x6c6a7c, joint: 0x44425a, band: 0x423829 });
    for (const [z, dx] of [[-11.2, 0], [-12.1, 0.3], [-13.0, -0.2]]) w.box(M(0.4 + dx) - 6, -1, M(z) - 4, M(0.4 + dx) + 6, 0, M(z) + 3, 0x5e5c6c).box(M(0.4 + dx) - 5, 0, M(z) - 3, M(0.4 + dx) + 5, 0, M(z) + 2, 0x6a6878);
    // the landmark: a ruined gate with wall wings, a rune glowing on its keystone
    const rune = ruinGate(w, 0.4, -9.8, { span: 2.4, h: 2.4, wing: 2.4, rune: TEAL });
    c.light([rune[0], rune[1] - 0.9, rune[2] + 1.0], 0x6affd8, 3.4, 6.5);
    shrooms(w, -2.5, -8.5, 3, SHROOM_C, 1); shrooms(w, 3.4, -8.4, 2, SHROOM_C, 2);
    // left: a wayside shrine on its own flagstone pad with a candle in its niche, a signpost pointing to the trail
    pathway(w, [{ x0: -8.6, z0: -3.8, x1: -5.9, z1: -0.9 }], { surf: flags([0x5a5868, 0x626072], 9, 4), kerb: 0x4e4c5c, joint: 0x34323e });
    c.light(wayShrine(w, -7.25, -2.6), 0xffb060, 2.6, 4.5);
    signpost(w, -6.6, -0.5, 1.7, KC.woodD, KC.plank, KC.woodL, [[1, 22], [-1, 17]]);
    // right front: a fallen mossy trunk, mushrooms sprouting from its end, a boulder behind
    logX(w, M(7.0), -1, M(1.0), M(3.0), 8, 'z', KC.bark, KC.ring, KC.ringD); w.box(M(7.0) - 3, 7, M(1.4), M(7.0) + 2, 7, M(3.4), KC.moss);
    shrooms(w, 7.4, 4.5, 4, SHROOM_C, 3); boulder(w, 8.7, 2.0, 8, 6, 11, 0x4a4854, 0x56545f, KC.moss);
    c.light([7.0, 0.4, 3.8], SHROOM_C, 3.4, 6);
    // left back: a stacked outcrop with a giant glowing mushroom at its foot
    boulder(w, -7.9, -8.6, 12, 9, 16, 0x46444f, 0x52505b, KC.moss); boulder(w, -8.6, -7.0, 7, 6, 8, 0x4e4c57, 0x5a5864);
    glowShroom(w, -6.3, -7.3, 7, 0x141e2c, 0x1a2636, 0x6ae0ff, 16); shrooms(w, -6.9, -6.4, 2, SHROOM_C, 4);
    c.light([-5.8, 0.5, -6.6], SHROOM_C, 4, 7);
    // right back: a dead tree, its stump-neighbour and shelf mushrooms (glow only, no lamp)
    deadTree(w, 7.4, -8.8, 5.6, BARK, BARK_D, { seed: 7 }); stump(w, 6.1, -7.3, 4, 6, BARK, KC.ring);
    shrooms(w, 6.4, -6.6, 2, TEAL, 5); boulder(w, 8.6, -6.4, 6, 5, 6, 0x4a4854, 0x56545f);
    // front left: a stump with mushrooms, ferns round it (cards)
    stump(w, -7.7, 3.8, 5, 7, BARK, KC.ring); shrooms(w, -6.8, 4.5, 2, SHROOM_C, 6);
    c.light([-6.5, 0.35, 4.1], SHROOM_C, 2.6, 4.5);
    // low edges: rocks along the battle floor's flanks and front, shrubs further out
    // right: a milestone where someone stopped and never went on — a marker stone, a cairn, a dropped pack, a lantern gone dark
    stele(w, 6.6, -3.2, 12, 3, KC.stone, KC.stoneL, KC.mortar);
    { const X = M(7.4), Z = M(-3.9); w.box(X - 4, 0, Z - 3, X + 4, 1, Z + 3, 0x56545f).box(X - 3, 2, Z - 2, X + 2, 3, Z + 2, 0x626070).box(X - 2, 4, Z - 1, X + 1, 5, Z + 1, 0x6e6c7c).box(X - 1, 6, Z - 1, X, 6, Z, KC.moss); }
    sack(w, 6.1, -2.1, 0x6a5a40, KC.rope, 0.8);
    { const X = M(7.1), Z = M(-2.2); w.box(X - 2, 0, Z - 1, X + 2, 2, Z + 1, KC.iron).box(X - 1, 0, Z - 1, X + 1, 2, Z + 1, 0x3a4a52).box(X - 3, 1, Z, X - 3, 1, Z, KC.iron).box(X + 3, 0, Z - 1, X + 3, 2, Z + 1, KC.iron); }
    rocks(w, [[-6.0, 1.6, 5, 4], [-5.9, -5.2, 4, 3], [6.0, 0.2, 4, 3], [6.0, -5.4, 4, 4], [-4.1, 6.5, 4, 3], [3.6, 6.7, 3, 2], [5.6, 6.1, 4, 3], [-9.0, 0.4, 6, 6]]);
    for (const [x, z, r, h] of [[-9.0, 2.8, 7, 9], [9.3, -1.6, 8, 10], [-9.4, -5.4, 7, 8], [9.6, 4.4, 6, 8], [3.8, -11.8, 6, 7], [-3.4, -11.9, 6, 8]]) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13) });
    woods(c, 1, 1, [{ x0: -1.4, z0: -17, x1: 2.2, z1: -10.4 }]);
    dress(c, 'woods', {
      seed: 1, clear: [...runs, { x0: -3.4, z0: -10.9, x1: 4.2, z1: -8.6 }, { x0: -8.6, z0: -3.8, x1: -5.9, z1: -0.9 }],
      hang: [[-4.8, -10.4, -1.6, -10.4, 's'], [2.4, -10.4, 5.6, -10.4, 's']],
      shafts: [[0.4, -11.6, 0, 0.1, 1.8], [-6.6, -7.6, 0.3, 0.3, 1.4], [7.8, 1.6, 0.2, 0.3, 1.2]],
    });
    c.ambient({ kind: 'spores', color: 0x7ae8ff, rate: 3, area: { x0: -9, z0: -11, x1: 9, z1: 5 } });
  },
};

// ================================================================== 废弃伐木场 — the abandoned sawmill
export const lumber: SceneDef = {
  id: 'n_lumber', name: '废弃伐木场', group: '普通', kind: '户外', blurb: '伐木工早已不见，锯木棚里的灯还亮着，木桩上还插着斧子。', mood: { ...NIGHT, hemiI: 1.3 }, foes: ['forest_treant', 'forest_moss_golem'],
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x3a3026, 0x40352a, 0x2e3424], { seed: 5 });
    // ground: sawdust spread in front of the shed, a skid track where logs were dragged out (two ruts), corduroy logs at its mouth
    roundPatch(w, -2.4, -6.2, 2.6, 0x6a5a40, 0x5a4c36, 4); roundPatch(w, 3.0, -6.8, 1.4, 0x5e5038, 0x52462f, 3);
    for (const x of [-2.9, -1.7]) w.box(M(x) - 1, -1, M(-7.6), M(x) + 1, -1, M(8.4), 0x2e261e);
    for (const z of [6.5, 7.4]) logX(w, M(-3.8), -2, M(z), M(3.4), 5, 'x', KC.bark, KC.ring, KC.ringD);
    // the landmark: the sawmill shed (lantern still burning), a plank walk from it to the log pile
    c.light(sawShed(w, { x0: -5.8, z0: -11.2, x1: 1.0, z1: -7.8 }), 0xffb060, 6.5, 10);
    deck(w, { x0: 1.6, z0: -9.4, x1: 5.8, z1: -8.0 }, 2, { a: KC.plank, b: KC.plankB, frame: KC.woodD, seam: KC.seam });
    // right back: the big log pile, ends to the camera, stakes holding it
    logPile(w, 6.9, -10.8, 3.6, 4, 'z', { d: 7, bark: KC.bark, ring: KC.ring, heart: KC.ringD, post: KC.woodD });
    shrooms(w, 8.6, -8.6, 2, SHROOM_C, 11);
    // front left: the stump with the axe still in it, a chopping block, split wood stacked between stakes, chips on the ground
    stumpAxe(w, -7.3, 1.6, 7, 9); choppingBlock(w, -8.6, 3.7); firewood(w, -8.6, -1.3, 9, 10, { bark: KC.bark, a: KC.ring, b: KC.bark, post: KC.woodD });
    shrooms(w, -6.6, 4.4, 2, SHROOM_C, 12);
    c.light([-6.0, 0.35, 3.9], SHROOM_C, 2.4, 4);
    for (const [x, z] of [[-6.4, 0.4], [-7.6, 3.0], [-5.9, 2.2]]) c.cards.add('litter', x, z, { y: 0.01, s: 0.55, tint: 0xe8c890, ry: 0 });
    // left: a sawhorse with a half-cut log and a bow saw lying on it; a grindstone with its trough
    for (const lx of [-8.9, -6.9]) { const X = M(lx), Z = M(-4.8); w.box(X, -2, Z - 4, X + 1, 9, Z - 3, KC.woodD).box(X, -2, Z + 3, X + 1, 9, Z + 4, KC.woodD).box(X - 1, 10, Z - 5, X + 2, 10, Z + 5, KC.wood).box(X, 4, Z - 3, X + 1, 4, Z + 3, KC.wood); }
    logX(w, M(-9.7), 11, M(-4.8), M(3.4), 6, 'x', KC.bark, KC.ring, KC.ringD);
    { const X = M(-7.9), Z = M(-4.8); w.box(X - 1, 11, Z + 3, X - 1, 18, Z + 3, KC.ironL).box(X - 6, 18, Z + 3, X + 4, 18, Z + 3, KC.woodL).box(X - 6, 14, Z + 3, X - 6, 18, Z + 3, KC.woodL).box(X + 4, 14, Z + 3, X + 4, 18, Z + 3, KC.woodL); }
    grindstone(w, -8.4, -7.6);
    // right: the woodcutters' camp — a torn tent, a dead fire pit, a lamp post still lit, a crate and a barrel
    tent(w, 7.4, -6.9, { hw: 11, hd: 15, tiers: 3, th: 8, c: 0x4e5a40, d: 0x343e2c, l: 0x606c50, pole: KC.woodD, torn: true });
    firePit(w, 6.7, -3.7, false);
    c.light(lampPost(w, 8.3, -4.2, 2.1, [-1, 0], KC.woodD, KC.iron, KC.warm), 0xffa050, 4.5, 7);
    crate(w, 8.2, -2.6, 4, WOOD_L, WOOD_D); barrel(w, 6.1, -2.2, WOOD, IRON);
    // front right: two stumps and glowing mushrooms
    stump(w, 6.9, 3.8, 5, 6, BARK, KC.ring); stump(w, 8.1, 2.5, 4, 4, BARK, KC.ring); shrooms(w, 7.5, 4.2, 3, SHROOM_C, 13);
    c.light([7.1, 0.35, 4.2], SHROOM_C, 3, 5);
    // low edges and the cleared-forest frame: stumps everywhere, a few tall pines left standing
    rocks(w, [[-5.9, -2.6, 4, 3], [6.1, 0.8, 4, 3], [-4.6, 6.4, 3, 2], [4.4, 6.6, 4, 3]]);
    for (const [x, z, r, h] of [[-9.3, -10.2, 5, 7], [-10.1, 5.0, 5, 6], [9.9, 0.0, 4, 5], [-4.8, -12.5, 5, 6], [1.6, -12.4, 4, 5], [9.6, 5.6, 5, 5]]) stump(w, x, z, r, h, BARK, KC.ring);
    for (const [x, z, r, h] of [[-9.4, 1.8, 7, 9], [9.6, -7.6, 6, 8], [-2.0, -12.8, 6, 7]]) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13) });
    woods(c, 2, 0.7, [{ x0: -4.0, z0: -9, x1: -1.8, z1: -7.8 }]);
    dress(c, 'woods', {
      seed: 2, dense: 0.75, clear: [{ x0: -6.2, z0: -11.6, x1: 1.4, z1: -7.4 }, { x0: 1.6, z0: -9.4, x1: 5.8, z1: -8.0 }, { x0: 5.8, z0: -8.4, x1: 9, z1: -2.0 }, { x0: -3.4, z0: -8, x1: -1.2, z1: 8.4 }],
      hang: [[-5.4, -11.5, 0.6, -11.5, 's']],
      shafts: [[-0.8, -10.4, 0.2, 0.3, 1.6], [8.6, -0.8, -0.2, 0.3, 1.2]],
    });
    c.ambient({ kind: 'dust', color: 0xe8d0a0, rate: 3, area: { x0: -5.8, z0: -11.2, x1: 1.0, z1: -7.4 }, y: [0.3, 2.4] });
    // boards dropped where they were stacked, chips round the work spots (flat; the battle floor only gets decals)
    for (const [x0, z0, x1, h] of [[-9.6, -2.8, -7.4, 0], [-9.4, -2.5, -7.8, 1], [6.0, 0.4, 8.6, 0]] as const) w.box(M(x0), h, M(z0), M(x1), h, M(z0) + 3, h ? KC.plank : KC.plankB);
    for (const [x, z, sc] of [[-2.0, -5.0, 0.7], [0.6, -6.0, 0.5], [3.2, -5.2, 0.6], [-6.9, -3.4, 0.6], [6.6, 1.4, 0.5]] as const) c.cards.add('litter', x, z, { y: 0.01, s: sc, tint: 0xe8c890, ry: 0 });
  },
};

// ================================================================== 营火 · 林间营地 — the camp round the fire
export const camp: SceneDef = {
  id: 'c_camp', name: '营火 · 林间营地', group: '节点', kind: '户外', blurb: '难得安全的一角：两顶帐篷围着火堆，锅里还冒着热气。', mood: { ...NIGHT, keyI: 0.5, hemiI: 1.4 },
  build(c) {
    const w = c.w, FX = 0.6, FZ = -2.4;
    patches(w, AREA, [0x2e3a26, 0x34402a, 0x2a3424], { seed: 9 });
    // ground: a trampled earth ring round the fire, an ash ring at the pit, a footpath out toward the front
    roundPatch(w, FX, FZ, 3.8, 0x4a3e30, 0x3c3228, 4);
    roundPatch(w, FX, FZ, 1.25, 0x3a3430, 0x3a3430, 1);
    pathway(w, [{ x0: -2.9, z0: 0.6, x1: -1.1, z1: 8.4 }], { surf: (X, Z) => ((Z >> 2) & 1 ? 0x4a3e30 : 0x463a2e), kerb: 0x56545f, joint: 0x3e3c48, band: 0x40362a });
    // the fire: stone ring, crossed logs, embers; a cooking frame with a pot over it; log seats and a stump round it
    const fp = firePit(w, FX, FZ, true); cookFrame(w, FX, FZ);
    c.light([FX, 0.9, FZ], 0xff9a50, 10, 12.5); c.flame([fp[0], 0.5, fp[2]], 0xffb040, 0.22);
    c.ambient({ kind: 'embers', color: 0xffa040, rate: 4, area: { x0: FX - 0.4, z0: FZ - 0.4, x1: FX + 0.4, z1: FZ + 0.4 }, y: [0.4, 0.8] });
    logX(w, M(FX - 1.6), 0, M(FZ - 2.3), M(3.2), 6, 'x', KC.bark, KC.ring, KC.ringD);
    logX(w, M(FX + 2.7), 0, M(FZ - 1.2), M(2.6), 6, 'z', KC.bark, KC.ring, KC.ringD);
    stump(w, FX - 2.6, FZ + 0.6, 4, 6, BARK, KC.ring);
    // back left: the big canvas tent facing the fire, a lantern post at its door, a bedroll laid out beside it
    tent(w, -3.6, -8.4, { hw: 13, hd: 20, tiers: 3, th: 10, c: 0x6a604e, d: 0x463e32, l: 0x7e7360, pole: KC.woodD });
    c.light(lampPost(w, -0.9, -6.0, 2.0, [-1, 0], KC.woodD, KC.iron, KC.warm), 0xffb060, 3, 5.5);
    bedroll(w, -6.2, -5.4, false, KC.red, KC.redD); sack(w, -6.3, -3.6, 0x8a7652, KC.rope);
    // back right: a smaller red tent, a banner pole, the supply pile (crates, barrel, sacks)
    tent(w, 4.0, -8.6, { hw: 10, hd: 14, tiers: 3, th: 8, c: 0x6a2e2a, d: 0x461e1c, l: 0x80403a, pole: KC.woodD });
    { const X = M(5.8), Z = M(-10.0); w.box(X, -2, Z, X + 1, 46, Z + 1, KC.woodD).box(X + 2, 30, Z, X + 14, 44, Z, KC.red).box(X + 2, 30, Z, X + 14, 31, Z, KC.redD).box(X + 6, 35, Z, X + 10, 39, Z, KC.cream).box(X - 1, 47, Z - 1, X + 2, 47, Z + 2, KC.brass); }
    crate(w, 6.8, -6.4, 5, WOOD_L, WOOD_D); crate(w, 7.7, -5.4, 4, WOOD_L, WOOD_D); crate(lift(w, 11), M(6.8) * CELL, M(-6.4) * CELL, 3, 0x9a7048, WOOD_D);
    barrel(w, 5.9, -5.0, WOOD, IRON); sack(w, 6.8, -4.5, 0x8a7652, KC.rope); sack(w, 7.9, -4.2, 0x7a6a4a, KC.rope, 0.8);
    // right: firewood stacked between stakes, the chopping block
    firewood(w, 7.0, -2.0, 9, 9, { bark: KC.bark, a: KC.ring, b: KC.bark, post: KC.woodD }); choppingBlock(w, 6.1, -0.2);
    // left: the cook's corner — a drying rack with hides, a small table with a bowl and a jug, a water barrel
    dryingRack(w, -7.6, -3.4, [0x8a6a4a, 0x6a5040, 0xa08060]);
    table(w, -7.0, -1.0, 1.4, 0.8, WOOD_L, WOOD_D);
    { const T = lift(w, 12), X = M(-7.0), Z = M(-1.0); T.box(X - 6, 0, Z - 2, X - 3, 1, Z + 1, 0x8a6a4a).box(X - 5, 1, Z - 1, X - 4, 1, Z, 0xc8a060).box(X + 2, 0, Z - 1, X + 4, 4, Z + 1, 0x7a5a3a).box(X + 3, 5, Z, X + 3, 5, Z, 0x7a5a3a); }
    barrel(w, -8.7, -0.6, WOOD, IRON);
    { const p = lantern(lift(w, 12), M(-6.5), 5, M(-0.8), KC.iron, KC.warm); c.light([p[0], p[1] + 12 * CELL, p[2]], 0xffb060, 2.6, 4.5); }
    // front left: a second bedroll and a pack, the weapon rack with a shield
    bedroll(w, -7.0, 3.0, true, KC.blue, 0x2e3e66); sack(w, -8.6, 3.6, 0x6a5a40, KC.rope); weaponRack(w, -8.4, 1.0);
    // front right: glowing mushrooms by a boulder (the one cold light)
    boulder(w, 8.4, 2.6, 8, 6, 10, 0x4a4854, 0x56545f, KC.moss); shrooms(w, 7.2, 3.6, 3, SHROOM_C, 21);
    c.light([6.8, 0.35, 3.2], SHROOM_C, 3, 5.5);
    rocks(w, [[-4.6, 6.6, 3, 2], [4.0, 6.4, 4, 3], [-9.6, -6.6, 6, 6]]);
    for (const [x, z, r, h] of [[-9.6, 0.8, 7, 9], [9.8, -2.8, 7, 9], [-2.0, -12.0, 7, 8], [2.0, -12.4, 6, 7], [9.6, 5.0, 6, 8], [-9.8, 5.4, 6, 7]]) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13) });
    woods(c, 9, 0.9, []);
    dress(c, 'woods', {
      seed: 15, clear: [{ x0: FX - 4, z0: FZ - 4, x1: FX + 4, z1: FZ + 3.6 }, { x0: -2.9, z0: 0.6, x1: -1.1, z1: 8.4 }, { x0: -6.4, z0: -10.4, x1: -0.8, z1: -5.4 }],
      shafts: [[-6.8, -7.0, 0.3, 0.32, 1.4], [7.6, 1.6, -0.2, 0.3, 1.2]],
    });
  },
};

// ================================================================== 商人 · 林边货车 — the merchant's wagon on the forest road
export const merchant: SceneDef = {
  id: 'c_merchant', name: '商人 · 林边货车', group: '节点', kind: '户外', blurb: '林边路上停着一辆亮着灯的篷车，货摊支在木台上，商人从不问你从哪来。', mood: { ...NIGHT, hemiI: 1.4 },
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2e3a26, 0x34402a, 0x3a3428], { seed: 10 });
    // ground: the forest road along the back (kerbs, packed earth, two wheel ruts) and a footpath teeing into it from the front
    const road: Rect = { x0: -11.4, z0: -11.0, x1: 11.4, z1: -6.8 }, foot: Rect = { x0: -2.6, z0: -7.0, x1: -0.6, z1: 8.4 };
    const rut = (Z: number) => { const z = Z * CELL; return Math.abs(z + 10.15) < 0.1 || Math.abs(z + 7.75) < 0.1; };
    pathway(w, [road, foot], { surf: (X, Z) => (Z * CELL < -6.9 && rut(Z) ? 0x3a3026 : (X * CELL > -2.4 && X * CELL < -0.8 && Z * CELL > -6.6 && ((Z >> 2) & 1)) ? 0x483c2e : 0x4c4032), kerb: 0x5a5866, joint: 0x3c3a46, band: 0x433829 });
    // the landmark: the covered wagon on the road, its lantern lit, its open back toward the path with goods half unloaded
    c.light(wagon(w, 1.9, -8.9, { len: 4.6, wid: 2.0, flip: true }), 0xffb060, 5, 9);
    crate(w, 0.2, -6.1, 5, WOOD_L, WOOD_D); crate(lift(w, 11), M(0.2) * CELL, M(-6.1) * CELL, 3, 0x9a7048, WOOD_D); barrel(w, 1.2, -6.4, WOOD, IRON);
    sack(w, 0.9, -5.5, 0x8a7652, KC.rope); sack(w, 1.7, -5.8, 0x7a6a4a, KC.rope, 0.8);
    // the stall on its plank deck beside the path: red and cream awning, potions and scrolls on the counter, a rug for customers
    const dk: Rect = { x0: -8.0, z0: -7.0, x1: -3.2, z1: -3.8 }, DH = 3;
    deck(w, dk, DH, { a: KC.plank, b: KC.plankB, frame: KC.woodD, seam: KC.seam, step: true });
    const s = stall(lift(w, DH), -5.6, -6.0, { wid: 3.4, dep: 1.4, stripe: [KC.red, KC.cream] });
    { const T = lift(w, DH), X = s.X, Z = s.Z + s.hz - 3, y = s.top;
      for (let i = 0; i < 6; i++) { const u = X - 18 + i * 4, cl = [0x9aff3a, 0xb060ff, 0xff6a4a, 0x4ae8ff, 0xffd040, 0xff6ac0][i]; T.box(u, y, Z - 1, u + 1, y + 2 + (i % 2), Z, cl, 1).set(u, y + 3 + (i % 2), Z, 0x8a6a4a); }
      T.box(X + 6, y, Z - 2, X + 13, y + 1, Z, KC.cream).box(X + 6, y, Z - 2, X + 6, y + 1, Z, 0xc8b890).box(X + 13, y, Z - 2, X + 13, y + 1, Z, 0xc8b890);
      T.box(X + 15, y, Z - 3, X + 21, y + 4, Z + 1, 0x8a5a3a).box(X + 15, y + 2, Z - 3, X + 21, y + 2, Z + 1, KC.brass).box(X + 18, y + 1, Z + 1, X + 18, y + 2, Z + 1, KC.brass);
      for (const [sy, n] of [[11, 5], [19, 4]]) for (let i = 0; i < n; i++) { const u = X - 20 + i * 9; T.box(u, sy, s.Z - s.hz + 1, u + 2, sy + 3, s.Z - s.hz + 2, [0x6a8a5a, 0x8a5a4a, 0x5a6a9a, 0xb09050][i % 4]).box(u, sy + 4, s.Z - s.hz + 1, u + 2, sy + 4, s.Z - s.hz + 2, 0x6a4a32); }
      c.light(lantern(T, X - s.hx - 1, 27, s.Z + s.hz + 4, KC.iron, KC.warm).map((v, i) => i === 1 ? v + DH * CELL : v) as [number, number, number], 0xffb060, 4, 6.5);
    }
    { const X0 = M(-7.3), X1 = M(-3.9), Z0 = M(-5.1), Z1 = M(-4.1), y = DH - 1, cx = (X0 + X1) >> 1, cz = (Z0 + Z1) >> 1;
      w.box(X0, y, Z0, X1, y, Z1, KC.red).box(X0 + 2, y, Z0 + 2, X1 - 2, y, Z1 - 2, 0x2e3e66).box(cx - 4, y, cz - 1, cx + 4, y, cz + 1, KC.cream).box(cx - 1, y, Z0 + 3, cx + 1, y, Z1 - 3, KC.cream);
      for (const u of [X0 + 5, X1 - 5]) w.box(u - 1, y, cz, u + 1, y, cz, 0xc8963a); }
    // the shop sign over the footpath: a holed coin painted on a board hung from an arm
    { const X = M(-3.0), Z = M(-3.0), H = 30; w.box(X - 1, -2, Z - 1, X + 1, H, Z + 1, KC.woodD).box(X - 2, H + 1, Z - 2, X + 2, H + 1, Z + 2, KC.woodL).box(X, H - 2, Z, X + 14, H - 1, Z, KC.wood);
      w.box(X + 6, H - 5, Z, X + 6, H - 3, Z, KC.iron).box(X + 12, H - 5, Z, X + 12, H - 3, Z, KC.iron).box(X + 3, H - 17, Z, X + 14, H - 6, Z, KC.plank).box(X + 3, H - 17, Z, X + 14, H - 17, Z, KC.woodD).box(X + 3, H - 6, Z, X + 14, H - 6, Z, KC.woodD);
      wheel(w, X + 8, H - 11, Z + 1, 4, 'z', KC.brass, KC.brass, KC.brass, 1); w.box(X + 7, H - 12, Z + 1, X + 9, H - 10, Z + 1, KC.plank).box(X + 7, H - 12, Z + 2, X + 9, H - 10, Z + 2, null); }
    weaponRack(w, -9.0, -5.4);
    // the merchant's wares laid out on a mat by the path: a sword, a round shield, a helmet, two pots, a bundle of arrows
    { const X0 = M(1.2), X1 = M(3.6), Z0 = M(-4.6), Z1 = M(-3.2), cz = (Z0 + Z1) >> 1;
      w.box(X0, 0, Z0, X1, 0, Z1, 0x6a3a2e).box(X0 + 1, 0, Z0 + 1, X1 - 1, 0, Z1 - 1, 0x7e4a36).box(X0, 0, Z0, X0, 0, Z1, KC.brass).box(X1, 0, Z0, X1, 0, Z1, KC.brass);
      w.box(X0 + 3, 1, cz - 4, X0 + 3, 1, cz + 6, 0xb8b8c8).box(X0 + 1, 1, cz + 3, X0 + 5, 1, cz + 3, KC.brass).box(X0 + 3, 1, cz + 4, X0 + 3, 1, cz + 6, KC.woodD);
      { const SX = X0 + 12; for (const [a, b] of [[5, 2], [4, 4], [2, 5]]) w.box(SX - a, 1, cz - b, SX + a, 1, cz + b, KC.blue); w.box(SX - 5, 2, cz, SX + 5, 2, cz, KC.brass).box(SX, 2, cz - 5, SX, 2, cz + 5, KC.brass).box(SX - 1, 2, cz - 1, SX + 1, 2, cz + 1, KC.ironL); }
      w.box(X0 + 20, 1, cz - 3, X0 + 25, 3, cz + 2, KC.ironL).box(X0 + 21, 4, cz - 2, X0 + 24, 5, cz + 1, KC.ironL).box(X0 + 20, 1, cz + 2, X0 + 25, 1, cz + 3, KC.iron);
      w.box(X1 - 5, 1, Z0 + 2, X1 - 3, 3, Z0 + 4, 0x8a5a3a).box(X1 - 4, 4, Z0 + 3, X1 - 4, 4, Z0 + 3, 0x8a5a3a).box(X1 - 5, 1, Z1 - 4, X1 - 2, 4, Z1 - 1, 0x6a7a5a);
      for (const dz of [-1, 0, 1]) w.box(X0 + 28, 1, cz + dz * 2, X0 + 31, 1, cz + dz * 2, KC.woodL).set(X0 + 32, 1, cz + dz * 2, KC.cream); }
    // right: where the horse rests — a hitching post, a water trough, a hay bale
    { const X = M(6.0), Z = M(-6.6); w.box(X - 1, -2, Z, X + 1, 14, Z + 1, KC.woodD).box(X - 1, 15, Z - 1, X + 1, 15, Z + 2, KC.woodL).box(X + 3, 0, Z - 2, X + 12, 4, Z + 3, KC.wood).box(X + 4, 3, Z - 1, X + 11, 4, Z + 2, 0x3a5a7a); }
    { const X = M(7.6), Z = M(-5.2); w.box(X - 6, 0, Z - 4, X + 6, 7, Z + 4, 0xb09a58); for (let y = 1; y < 7; y += 2) w.box(X - 6, y, Z - 4, X + 6, y, Z + 4, 0xa48c4c); w.box(X - 5, 7, Z - 3, X + 5, 7, Z + 3, 0xc8b068).box(X - 3, 0, Z - 4, X - 3, 7, Z + 4, 0x7a6030).box(X + 3, 0, Z - 4, X + 3, 7, Z + 4, 0x7a6030); }
    // front corners: cold mushrooms by a boulder on the left, bushes on the right
    boulder(w, -8.3, 2.6, 8, 6, 10, 0x4a4854, 0x56545f, KC.moss); shrooms(w, -7.2, 3.5, 3, SHROOM_C, 31);
    c.light([-6.7, 0.35, 3.1], SHROOM_C, 3, 5.5);
    rocks(w, [[-4.8, 6.5, 3, 2], [4.6, 6.4, 4, 3], [8.6, 3.0, 7, 7], [-9.6, -2.0, 6, 5], [-3.6, 1.2, 4, 3], [5.9, -1.6, 4, 3]]);
    for (const [x, z, r, h] of [[9.8, 0.0, 7, 9], [-9.8, 5.0, 6, 8], [7.0, 4.6, 6, 7], [-10, -5.0, 6, 8]]) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13) });
    woods(c, 10, 0.85, [road]);
    dress(c, 'woods', { seed: 16, clear: [road, foot, dk, { x0: -0.6, z0: -7, x1: 9, z1: -4.4 }, { x0: 1.0, z0: -4.8, x1: 3.8, z1: -3.0 }], shafts: [[-7, -4.4, 0.3, 0.3, 1.4], [7.6, -1.4, -0.2, 0.3, 1.2]] });
  },
};

// ================================================================== 事件 · 林中古祠 — the nameless shrine with fresh offerings
export const shrine: SceneDef = {
  id: 'c_shrine', name: '事件 · 林中古祠', group: '节点', kind: '户外', blurb: '一座没人记得名字的小祠，石像捧着一团冷光，供桌上的花和蜡烛却是新的。', mood: { ...NIGHT, hemiSky: 0x6a6a9a, hemiI: 1.4 },
  build(c) {
    const w = c.w;
    patches(w, AREA, [0x2e3a26, 0x34402a, 0x2a3424], { seed: 11 });
    // the approach: a flagstone forecourt before the steps, a flagstone path out to the front, kerbs of darker stone
    const court: Rect = { x0: -2.6, z0: -7.7, x1: 3.4, z1: -5.2 }, walk: Rect = { x0: -0.6, z0: -5.6, x1: 1.4, z1: 8.4 };
    pathway(w, [court, walk], { surf: flags([0x5e5c6e, 0x666478, 0x585668], 11, 7), kerb: 0x4a4858, joint: 0x32303c });
    // the landmark: the stone shrine on its stepped platform, the statue's orb the lead light, moonlight falling on it
    { const o = shrineTemple(w, 0.4, -9.5, { orb: 0xb8f4ff }); c.light([o[0], o[1] + 0.3, o[2] + 0.9], 0xa8e8ff, 3.4, 7.5); }
    // the offering table: stone slab on two blocks, fresh flowers, fruit in a bowl, candles, an incense bowl
    { const X = M(0.4), Z = M(-6.2);
      masonry(w, X - 9, 0, Z - 3, X - 5, 7, Z + 3, KC.stone, KC.mortar, { ch: 4, cl: 4 }); masonry(w, X + 5, 0, Z - 3, X + 9, 7, Z + 3, KC.stone, KC.mortar, { ch: 4, cl: 4 });
      w.box(X - 11, 8, Z - 4, X + 11, 9, Z + 4, KC.stoneL).box(X - 11, 8, Z - 4, X + 11, 8, Z + 4, KC.stone);
      w.box(X - 9, 10, Z - 1, X - 5, 11, Z + 2, 0x7a4a2a).box(X - 8, 12, Z, X - 7, 12, Z + 1, 0xc84a3a).box(X - 6, 12, Z - 1, X - 6, 12, Z, 0xd8b040).set(X - 7, 13, Z, 0xc84a3a);
      for (const [u, h] of [[-3, 4], [0, 5], [3, 3]]) candle(w, (X + u) * CELL + 0.035, (Z - 2) * CELL, h, 0xf0e8d0, 0xffd070, 10);
      w.box(X + 5, 10, Z - 1, X + 8, 11, Z + 2, 0x6a6878).box(X + 6, 12, Z, X + 7, 15, Z + 1, 0x8a8478);
      for (const [u, cl] of [[-10, 0xe86a8a], [-10, 0xf0e070], [10, 0xe86a8a], [10, 0xffffff]] as const) w.box(X + u, 10, Z + 2, X + u, 11, Z + 2, 0x3e6a2e).set(X + u, 12, Z + 2 + (cl === 0xf0e070 || cl === 0xffffff ? 1 : 0), cl);
      c.light([0.4, 1.5, -5.9], 0xffc070, 2.0, 4.5); }
    for (const x of [-2.2, 3.0]) c.light(stoneLamp(w, x, -6.3, KC.warm), 0xffb060, 1.6, 3.4);
    // left: a row of old tablets whose names have worn away, pebbles left at their feet, a broken column and its fallen drum
    stele(w, -8.7, -8.6, 18, 4, KC.stone, KC.stoneL, KC.mortar); stele(w, -7.3, -8.9, 25, 5, 0x76748a, KC.stoneL, KC.mortar); stele(w, -5.9, -8.6, 14, 4, KC.stone, KC.stoneL, KC.mortar);
    for (const x of [-8.7, -7.3, -5.9]) { const X = M(x), Z = M(-8.2); w.box(X - 2, 0, Z + 2, X - 1, 0, Z + 3, KC.stoneL).set(X + 1, 0, Z + 3, KC.stoneD).set(X - 2, 1, Z + 2, KC.stone); }
    candle(w, -7.3, -8.0, 3, 0xf0e8d0, 0xffd070, 2);
    pillar(w, -9.4, -6.0, 1.3, KC.stone, KC.stoneL, { r: 4, broken: true });
    { const X = M(-7.0), Z = M(-5.6); masonry(w, X - 10, -1, Z - 4, X + 3, 6, Z + 3, KC.stone, KC.mortar, { ch: 8, cl: 7, cap: KC.moss }); w.box(X + 4, -1, Z - 3, X + 4, 5, Z + 2, KC.stoneL); }
    // right: a prayer rope between two posts with cloth strips hanging, an old dead tree behind
    { const X0 = M(5.8), X1 = M(8.8), Z = M(-6.0), H = 22;
      w.box(X0 - 1, -2, Z - 1, X0 + 1, H + 2, Z + 1, KC.woodD).box(X1 - 1, -2, Z - 1, X1 + 1, H + 2, Z + 1, KC.woodD).box(X0, H, Z, X1, H, Z, KC.rope);
      for (let u = X0 + 4, i = 0; u < X1 - 2; u += 5, i++) w.box(u, H - 6 - (i % 2) * 3, Z, u + 1, H - 1, Z, i % 3 === 1 ? KC.red : KC.cream); }
    deadTree(w, 8.4, -9.0, 5.8, BARK, BARK_D, { seed: 13 });
    // front left: a stone bench under the trees; front right: mushrooms by a boulder (cold)
    { const X = M(-7.2), Z = M(2.6); w.box(X - 10, 0, Z - 2, X - 8, 4, Z + 2, KC.stone).box(X + 8, 0, Z - 2, X + 10, 4, Z + 2, KC.stone).box(X - 12, 5, Z - 3, X + 12, 6, Z + 3, KC.stoneL).box(X - 4, 7, Z - 3, X + 2, 7, Z + 3, KC.moss); }
    boulder(w, 8.4, 2.6, 8, 6, 10, 0x4a4854, 0x56545f, KC.moss); shrooms(w, 7.2, 3.6, 3, TEAL, 41);
    rocks(w, [[-4.6, 6.5, 3, 2], [4.2, 6.6, 4, 3], [-9.4, -1.6, 6, 6], [9.6, -2.6, 6, 5]]);
    for (const [x, z, r, h] of [[-9.8, 3.6, 7, 9], [9.8, 0.4, 7, 9], [-4.6, -12.0, 7, 8], [5.0, -12.0, 7, 8], [6.6, 4.8, 6, 7]]) bush(w, x, z, r * CELL, { h: h * CELL, seed: Math.round(x * 7 + z * 13) });
    woods(c, 11, 0.9, []);
    dress(c, 'grove', { seed: 17, dense: 0.8, clear: [court, walk, { x0: -2.4, z0: -12, x1: 3.2, z1: -7.2 }], shafts: [[0.4, -9.6, 0, 0.1, 2.4], [-6.6, -3, 0.3, 0.3, 1.2]] });
  },
};
