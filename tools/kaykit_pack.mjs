#!/usr/bin/env node
// Pack the free KayKit assets (CC0, Kay Lousberg) the battle uses into small runtime GLBs under src/assets/models/kk_*.glb.
//  - texture atlases are baked into per-vertex colours (the artifact sandbox cannot fetch blob: images, and the toon shader and the
//    voxeliser both want flat colours anyway), UVs dropped
//  - characters get their weapons pre-attached to the hand slots
//  - one animation GLB: the chosen clips from the Rig_Medium packs retargeted onto one shared skeleton, redundant keys resampled away
//  - one prop GLB: graveyard props + forest rocks, one top-level node per prop, named by key
// Usage: node tools/kaykit_pack.mjs   (sources in art/kaykit_src, see tools/itch_free.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { mergeDocuments, prune, dedup, resample, unpartition } from '@gltf-transform/functions';
import { PNG } from 'pngjs';

const SRC = 'art/kaykit_src', OUT = 'src/assets/models';
const ADV = `${SRC}/kaykit-adventurers/KayKit_Adventurers_2.0_FREE`, SKL = `${SRC}/kaykit-skeletons/KayKit_Skeletons_1.1_FREE`;
const ANI = (() => { const r = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else r.push(p); } }; walk(`${SRC}/kaykit-character-animations`); return r; })();
const HAL = `${SRC}/halloween-bits/KayKit_HalloweenBits_1.0_FREE/Assets/gltf`;
const find = (root, name) => { let hit = null; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === name && !hit) hit = p; } }; walk(root); if (!hit) throw new Error('missing ' + name); return hit; };
const io = new NodeIO();

const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** bake base-colour textures into COLOR_0 (linear), drop the textures and UVs */
function bake(doc) {
  const imgs = new Map(), mats = new Set(), buf = doc.getRoot().listBuffers()[0];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial(), pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const fac = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1], tex = mat?.getBaseColorTexture(), uv = prim.getAttribute('TEXCOORD_0');
    let img = null;
    if (tex && uv) { img = imgs.get(tex); if (!img) { img = PNG.sync.read(Buffer.from(tex.getImage())); imgs.set(tex, img); } }
    const n = pos.getCount(), out = new Uint8Array(n * 4), e = [0, 0];
    for (let i = 0; i < n; i++) {
      let r = 1, g = 1, b = 1;
      if (img) {
        uv.getElement(i, e); const fu = e[0] - Math.floor(e[0]), fv = e[1] - Math.floor(e[1]);
        const u = e[0] >= 0 && e[0] <= 1 ? Math.min(e[0], 0.99999) : fu, v = e[1] >= 0 && e[1] <= 1 ? Math.min(e[1], 0.99999) : fv;
        const x = Math.floor(u * img.width), y = Math.floor(v * img.height), o = (y * img.width + x) * 4;
        r = s2l(img.data[o] / 255); g = s2l(img.data[o + 1] / 255); b = s2l(img.data[o + 2] / 255);
      }
      out[i * 4] = Math.round(Math.min(1, r * fac[0]) * 255); out[i * 4 + 1] = Math.round(Math.min(1, g * fac[1]) * 255); out[i * 4 + 2] = Math.round(Math.min(1, b * fac[2]) * 255); out[i * 4 + 3] = 255;
    }
    prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(out).setNormalized(true).setBuffer(buf));
    const w = prim.getAttribute('WEIGHTS_0');   // skin weights as normalized bytes, rounding error pushed onto the largest weight
    if (w && w.getComponentType() === 5126) {
      const wa = new Uint8Array(n * 4), we = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) { w.getElement(i, we); let sum = 0, big = 0; for (let k = 0; k < 4; k++) { wa[i * 4 + k] = Math.round(we[k] * 255); sum += wa[i * 4 + k]; if (we[k] > we[big]) big = k; } wa[i * 4 + big] += 255 - sum; }
      prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(wa).setNormalized(true).setBuffer(buf));
    }
    for (const k of prim.listSemantics()) if (k.startsWith('TEXCOORD')) prim.setAttribute(k, null);
    if (mat) mats.add(mat);
  }
  for (const m of mats) { m.setBaseColorTexture(null); const f = m.getBaseColorFactor(); m.setBaseColorFactor([1, 1, 1, f[3]]); m.setMetallicRoughnessTexture(null); m.setNormalTexture(null); m.setOcclusionTexture(null); }
}
/** merge another file into doc, return its scene's root nodes (detached, ready to re-parent) */
async function pull(doc, file) {
  const src = await io.read(file); bake(src);
  const map = mergeDocuments(doc, src), roots = [];
  for (const sc of src.getRoot().listScenes()) { const t = map.get(sc); for (const n of t.listChildren()) { t.removeChild(n); roots.push(n); } t.dispose(); }
  return roots;
}
async function finish(doc, out, extra = []) {
  await doc.transform(unpartition(), dedup(), ...extra, prune({ keepAttributes: true, keepLeaves: true }));
  // prune keeps orphaned accessors with keepAttributes; a write/read round trip lets us find and drop them
  const again = await io.readBinary(await io.writeBinary(doc));
  for (const a of again.getRoot().listAccessors()) if (!a.listParents().some(p => p.propertyType !== 'Root')) a.dispose();
  const bin = await io.writeBinary(again); fs.writeFileSync(out, bin); console.log(out, (bin.length / 1024).toFixed(0) + ' KB');
}

// ---------------------------------------------------------------- characters (+ weapons in the hand slots)
const CHARS = {
  hero: { file: find(ADV, 'Barbarian.glb'), r: find(ADV, 'axe_2handed.gltf') },
  lich: { file: find(SKL, 'Skeleton_Mage.glb'), r: find(SKL, 'Skeleton_Staff.gltf') },
  minion: { file: find(SKL, 'Skeleton_Minion.glb'), r: find(SKL, 'Skeleton_Blade.gltf') },
  warrior: { file: find(SKL, 'Skeleton_Warrior.glb'), r: find(SKL, 'Skeleton_Axe.gltf'), l: find(SKL, 'Skeleton_Shield_Small_A.gltf') },
};
for (const [key, c] of Object.entries(CHARS)) {
  const doc = await io.read(c.file); bake(doc);
  for (const n of doc.getRoot().listNodes()) if (n.getMesh() === null && n.getName() === 'Mannequin') n.dispose();
  for (const side of ['r', 'l']) {
    if (!c[side]) continue;
    const slot = doc.getRoot().listNodes().find(n => n.getName() === `handslot.${side}`); if (!slot) throw new Error(`${key}: no handslot.${side}`);
    for (const w of await pull(doc, c[side])) { w.setName('W_' + w.getName()); slot.addChild(w); }
  }
  await finish(doc, `${OUT}/kk_${key}.glb`);
}

// ---------------------------------------------------------------- animations: the chosen clips on one skeleton
const KEEP = new Set([
  'Idle_A', 'Idle_B', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Spawn_Ground', 'Throw',
  'Melee_2H_Attack_Chop', 'Melee_2H_Attack_Slice', 'Melee_2H_Attack_Spin', 'Melee_2H_Attack_Spinning', 'Melee_2H_Idle', 'Melee_Block', 'Melee_Block_Hit', 'Melee_Blocking', 
  'Melee_1H_Attack_Chop', 'Melee_1H_Attack_Jump_Chop', 
  'Ranged_Magic_Raise', 'Ranged_Magic_Shoot', 'Ranged_Magic_Spellcasting', 'Ranged_Magic_Summon',
  'Running_A', 'Walking_A', 'Jump_Full_Short', 'Dodge_Backward', 'Cheering',
  'Skeletons_Awaken_Floor', 'Skeletons_Awaken_Standing', 'Skeletons_Death', 'Skeletons_Idle', 'Skeletons_Taunt', 'Skeletons_Walking', 'Skeletons_Spawn_Ground', 'Skeletons_Death_Resurrect',
]);
{
  const files = ['General', 'CombatMelee', 'CombatRanged', 'MovementBasic', 'MovementAdvanced', 'Simulation', 'Special'].map(k => ANI.find(f => path.basename(f) === `Rig_Medium_${k}.glb`));
  const doc = await io.read(files[0]);
  const strip = d => { for (const a of d.getRoot().listAnimations()) if (!KEEP.has(a.getName())) a.dispose(); for (const n of d.getRoot().listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); } };
  strip(doc);
  const byName = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
  for (const f of files.slice(1)) {
    const src = await io.read(f); strip(src);
    const srcAnims = src.getRoot().listAnimations(), map = mergeDocuments(doc, src);
    for (const a of srcAnims) for (const ch of map.get(a).listChannels()) { const t = byName.get(ch.getTargetNode().getName()); if (!t) throw new Error('unmatched bone ' + ch.getTargetNode().getName()); ch.setTargetNode(t); }
    for (const sc of src.getRoot().listScenes()) { const t = map.get(sc); const kill = n => { for (const c of n.listChildren()) kill(c); n.dispose(); }; for (const n of t.listChildren()) kill(n); t.dispose(); }
  }
  await doc.transform(unpartition(), resample({ tolerance: 2e-4 }));
  for (const s of doc.getRoot().listSkins()) s.dispose();
  for (const m of doc.getRoot().listMeshes()) m.dispose();
  // channels that never leave the rest pose are dropped (the runtime resets bones to rest before the mixer runs); rotations → int16
  let dropped = 0; const buf = doc.getRoot().listBuffers()[0];
  for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
    const n = ch.getTargetNode(), p = ch.getTargetPath(), o = ch.getSampler().getOutput(), rest = p === 'translation' ? n.getTranslation() : p === 'rotation' ? n.getRotation() : n.getScale(), e = [];
    let still = true; for (let i = 0; i < o.getCount() && still; i++) { o.getElement(i, e); for (let k = 0; k < e.length; k++) if (Math.abs(e[k] - rest[k]) > 2e-4) still = false; }
    if (still) { const s2 = ch.getSampler(); ch.dispose(); s2.dispose(); dropped++; continue; }
    if (p === 'rotation') { const q = new Int16Array(o.getCount() * 4); for (let i = 0; i < o.getCount(); i++) { o.getElement(i, e); for (let k = 0; k < 4; k++) q[i * 4 + k] = Math.round(Math.max(-1, Math.min(1, e[k])) * 32767); } ch.getSampler().setOutput(doc.createAccessor().setType('VEC4').setArray(q).setNormalized(true).setBuffer(buf)); }
  }
  console.log('clips', doc.getRoot().listAnimations().length, 'dropped still channels', dropped);
  await finish(doc, `${OUT}/kk_anims.glb`);
}

// ---------------------------------------------------------------- props
const PROPS = ['gravestone', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'fence', 'fence_broken', 'fence_pillar', 'fence_pillar_broken', 'fence_gate',
  'tree_dead_large', 'tree_dead_large_decorated', 'tree_dead_medium', 'tree_dead_small', 'crypt', 'arch', 'arch_gate', 'lantern_standing', 'lantern_hanging', 'post', 'post_lantern', 'post_skull',
  'candle_triple', 'candle_melted', 'candle', 'skull_candle', 'bone_A', 'bone_B', 'bone_C', 'ribcage', 'skull', 'coffin', 'coffin_decorated', 'shrine', 'shrine_candles', 'pillar', 'plaque_candles',
  'floor_dirt_grave', 'bench', 'pumpkin_orange_jackolantern', 'pumpkin_orange_small'];
const FOREST = ['Rock_1_A_Color1', 'Rock_1_D_Color1', 'Rock_1_J_Color1', 'Rock_2_B_Color1', 'Rock_3_C_Color1', 'Bush_1_A_Color1', 'Bush_2_C_Color1', 'Grass_1_A_Color1', 'Grass_2_B_Color1', 'Tree_Bare_1_A_Color1', 'Tree_Bare_2_B_Color1'];
{
  const { Document } = await import('@gltf-transform/core');
  const d = new Document(); d.createBuffer(); const scene = d.createScene('props');
  const add = async (key, file) => { const roots = await pull(d, file); const g = d.createNode(key); for (const n of roots) g.addChild(n); scene.addChild(g); };
  for (const k of PROPS) await add(k, `${HAL}/${k}.gltf`);
  for (const k of FOREST) await add(k.replace('_Color1', ''), find(`${SRC}/kaykit-forest`, `${k}.gltf`));
  await finish(d, `${OUT}/kk_props.glb`);
}
