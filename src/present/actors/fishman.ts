// 鱼人狂战 as a real model: built in Blender in the KayKit idiom (tools/blender/build_fishman.py), skinned to KayKit's Rig_Medium, so it
// plays KayKit's animation clips (CC0). Same public surface as the procedural Hero it replaces: the show calls attack / spin / toss /
// hurt / block / cheer / bleed / fall and awaits .impact; root lunges and the hit flash stay procedural on top of the clips.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Actor } from './actor';
import { Action, curve } from './rig';
import { toon } from '../look/toon';
import { V3 } from '../engine/world';
import modelUrl from '../../assets/models/fishman.glb?url';

let cached: { scene: THREE.Group; clips: THREE.AnimationClip[] } | null = null;
export async function loadFishman() {
  if (cached) return cached;
  // the single-file build inlines the model as a data: URL; decode it directly — the artifact sandbox blocks fetch()
  let buf: ArrayBuffer;
  if (modelUrl.startsWith('data:')) {
    const bin = atob(modelUrl.slice(modelUrl.indexOf(',') + 1)), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buf = u8.buffer;
  } else buf = await (await fetch(modelUrl)).arrayBuffer();
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) => new GLTFLoader().parse(buf, '', g => res(g as never), rej));
  cached = { scene: gltf.scene, clips: gltf.animations };
  return cached;
}

/** clip, playback speed, and the fraction of the clip where the hit lands */
const CLIPS = {
  idle: { name: 'Idle', speed: 1 },
  attack: { name: '2H_Melee_Attack_Chop', speed: 1.35, at: 0.5 },
  spin: { name: '2H_Melee_Attack_Chop', speed: 1.2, at: 0.55 },
  toss: { name: 'Throw', speed: 1.8, at: 0.42 },
  hurt: { name: 'Hit_A', speed: 1.2, at: 0.1 },
  block: { name: 'Block', speed: 1.2, at: 0.3 },
  cheer: { name: 'Cheer', speed: 1, at: 0.3 },
  bleed: { name: 'Taunt', speed: 1.3, at: 0.4 },
  fall: { name: 'Death_A', speed: 0.8, at: 0.6 },
  run: { name: 'Running_A', speed: 1 },
} as const;
type ClipKey = keyof typeof CLIPS;

export class Fishman extends Actor {
  readonly height = 2.2;
  aim = 0; breath = 1;
  mixer: THREE.AnimationMixer; private acts = new Map<string, THREE.AnimationAction>(); private cur: THREE.AnimationAction | null = null;
  private bonesBy = new Map<string, THREE.Object3D>(); private cleaver: THREE.Object3D | null = null; running = false;

  constructor(src: { scene: THREE.Group; clips: THREE.AnimationClip[] }) {
    super();
    const model = cloneSkinned(src.scene); this.body.add(model);
    const meshes: THREE.Mesh[] = [];
    model.traverse(o => {
      if ((o as THREE.Bone).isBone) this.bonesBy.set(o.name, o);
      if (o.name === 'Fishman_Cleaver') this.cleaver = o;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(src => toon((src as THREE.MeshStandardMaterial).color, { rim: 0.9 }));
        m.material = Array.isArray(m.material) ? mats : mats[0]; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
        meshes.push(m);
      }
    });
    this.finishMulti(meshes);
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of src.clips) { const a = this.mixer.clipAction(c); this.acts.set(c.name, a); }
    this.loop('idle');
  }

  /** per-actor material clones for multi-material meshes (the hit flash must not light up other actors) */
  private finishMulti(meshes: THREE.Mesh[]) {
    const flat: THREE.Mesh[] = [];
    for (const m of meshes) {
      if (!Array.isArray(m.material)) { flat.push(m); continue; }
      m.material = m.material.map(x => { const c = x.clone() as THREE.MeshToonMaterial; c.onBeforeCompile = x.onBeforeCompile; c.customProgramCacheKey = x.customProgramCacheKey; this.extraFlash.push({ m: c, base: c.emissive.clone() }); return c; });
    }
    this.finish(flat);
  }
  private extraFlash: Array<{ m: THREE.MeshToonMaterial; base: THREE.Color }> = [];

  private loop(k: ClipKey, fade = 0.25) {
    const c = CLIPS[k], a = this.acts.get(c.name); if (!a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = c.speed; a.enabled = true; a.setEffectiveWeight(1);
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, fade, false); a.play(); this.cur = a;
  }
  private once(k: ClipKey, data: Record<string, unknown> = {}) {
    const c = CLIPS[k] as { name: string; speed: number; at?: number }, a = this.acts.get(c.name);
    const dur = a ? a.getClip().duration / c.speed : 0.6;
    if (a) { a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = c.speed; a.enabled = true; a.setEffectiveWeight(1); if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, 0.12, false); a.play(); this.cur = a; }
    const act = this.play(new Action(k, dur, c.at ?? 0.5, data));
    if (k !== 'fall') act.done.then(() => { if (this.act === null || this.act === act) this.loop(this.running ? 'run' : 'idle', 0.2); });
    return act;
  }
  setRunning(on: boolean) { this.running = on; this.loop(on ? 'run' : 'idle', 0.2); }

  attack(dist: number) { return this.once('attack', { dist }); }
  spin(dist: number) { return this.once('spin', { dist, spin: true }); }
  toss() { return this.once('toss'); }
  hurt(power = 1) { this.hit(power); return this.once('hurt', { power }); }
  block() { return this.once('block'); }
  cheer() { return this.once('cheer'); }
  bleed() { return this.once('bleed'); }
  fall() { this.dead = true; return this.once('fall'); }

  bonePos(name: string, x = 0, y = 0, z = 0) {
    const map: Record<string, string> = { head: 'head', chest: 'chest', handL: 'handl', handR: 'handr', weapon: 'handslotr' };
    const b = this.bonesBy.get(map[name] || name); return b ? b.localToWorld(V3(x, y, z)) : this.local(0, this.height * 0.6, 0);
  }
  head() { return this.bonePos('head', 0, 0.8, 0); }
  chest() { return this.bonePos('chest', 0, 0.1, 0); }
  weapon() { if (!this.cleaver) return this.bonePos('weapon'); const box = new THREE.Box3().setFromObject(this.cleaver); return box.getCenter(V3()); }

  protected pose(dt: number) {
    const a = this.act, k = a ? a.k : 0;
    if (this.cur === this.acts.get('Idle')) this.cur.timeScale = this.breath;
    this.mixer.update(dt);
    this.off.set(0, 0, 0);
    if (!a) return;
    if (a.name === 'attack') {   // leap in on the wind-up, land the chop, step back
      const d = (a.data.dist as number) || 0;
      this.off.z = curve(k, [[0, 0], [0.25, -0.15], [0.48, d], [0.72, d], [1, 0]]); this.off.y = curve(k, [[0, 0], [0.3, 0], [0.4, 0.5], [0.5, 0], [1, 0]]);
    } else if (a.name === 'spin') {
      const d = (a.data.dist as number) || 0; this.off.z = curve(k, [[0, 0], [0.3, -0.1], [0.55, d], [0.8, d], [1, 0]]);
      this.body.rotation.y = curve(k, [[0, 0], [0.25, 0], [0.75, Math.PI * 4], [1, Math.PI * 4]]);
    } else if (a.name === 'hurt') { this.off.z = -0.3 * curve(k, [[0, 0], [0.12, 1], [1, 0]]) * Math.min(1.5, (a.data.power as number) || 1); }
    if (a.name !== 'spin') this.body.rotation.y = 0;
  }
  update(dt: number) {
    super.update(dt);
    for (const f of this.extraFlash) f.m.emissive.copy(f.base).lerp(this.flashCol, Math.min(1, this.flash) * 0.55);
  }
}

/** SkeletonUtils-style clone: skinned meshes keep working bones in the copy */
function cloneSkinned(src: THREE.Object3D): THREE.Object3D {
  const map = new Map<THREE.Object3D, THREE.Object3D>(), clone = src.clone(true);
  const walk = (a: THREE.Object3D, b: THREE.Object3D) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); };
  walk(src, clone);
  clone.traverse(o => {
    const sm = o as THREE.SkinnedMesh; if (!sm.isSkinnedMesh) return;
    const orig = [...map.entries()].find(([, v]) => v === sm)![0] as THREE.SkinnedMesh;
    const bones = orig.skeleton.bones.map(b => map.get(b) as THREE.Bone);
    sm.bind(new THREE.Skeleton(bones, orig.skeleton.boneInverses), orig.bindMatrix);
  });
  return clone;
}
