// Placeholder figures for the neutral look (the real characters come with the art directions in step 5): a fishman berserker,
// the lich and the ghoul, built from boxes, with procedural idle / attack / hit / cast / death motion.
import * as THREE from 'three';
import { scene, V3, C, R } from '../engine/world';
import { anim, ease, lerp, clock } from '../engine/clock';
import { fxChips, fxSmoke, fxGlow } from '../fx/fx';

export interface Figure {
  root: THREE.Group; body: THREE.Group; mats: THREE.MeshStandardMaterial[]; h: number;
  home: THREE.Vector3; flash: number; lunge: number; squash: number; dead: boolean; facing: number;
  head(): THREE.Vector3; chest(): THREE.Vector3; weapon(): THREE.Vector3;
}

function part(g: THREE.Object3D, mats: THREE.MeshStandardMaterial[], w: number, h: number, d: number, col: number, x: number, y: number, z: number, o: { emissive?: number; rough?: number; metal?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000 });
  m.userData.baseEmissive = new THREE.Color(o.emissive ?? 0x000000);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh); mats.push(m); return mesh;
}

function base(h: number, home: THREE.Vector3): Figure {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.position.copy(home); scene.add(root);
  const f: Figure = {
    root, body, mats: [], h, home: home.clone(), flash: 0, lunge: 0, squash: 0, dead: false, facing: 1,
    head: () => root.localToWorld(V3(0, h * 0.92, 0)), chest: () => root.localToWorld(V3(0, h * 0.6, 0)), weapon: () => root.localToWorld(V3(0.5, h * 0.75, 0.2)),
  };
  return f;
}

/** 鱼人狂战 placeholder: teal scaled body, dorsal fin, bulging eyes, a bone cleaver. */
export function makeHero(home: THREE.Vector3): Figure {
  const f = base(1.7, home), g = f.body, M = f.mats;
  part(g, M, 0.34, 0.6, 0.34, 0x1e4a52, -0.2, 0.3, 0); part(g, M, 0.34, 0.6, 0.34, 0x1e4a52, 0.2, 0.3, 0);       // legs
  part(g, M, 0.95, 0.72, 0.6, 0x2f8a8a, 0, 0.95, 0);                                                                // torso
  part(g, M, 0.7, 0.42, 0.5, 0xd8c8a0, 0, 0.88, 0.08);                                                              // belly
  part(g, M, 0.1, 0.55, 0.5, 0xd85a3a, 0, 1.45, -0.05);                                                             // dorsal fin
  part(g, M, 0.78, 0.52, 0.62, 0x37a0a0, 0, 1.48, 0.06);                                                            // head
  part(g, M, 0.16, 0.16, 0.16, 0xf6f0d0, -0.24, 1.6, 0.36); part(g, M, 0.16, 0.16, 0.16, 0xf6f0d0, 0.24, 1.6, 0.36);   // eyes
  part(g, M, 0.07, 0.07, 0.06, 0x101010, -0.24, 1.6, 0.45); part(g, M, 0.07, 0.07, 0.06, 0x101010, 0.24, 1.6, 0.45);
  part(g, M, 0.5, 0.08, 0.12, 0x6a1a1a, 0, 1.36, 0.36);                                                            // mouth
  part(g, M, 0.24, 0.6, 0.26, 0x2f8a8a, -0.62, 0.98, 0);                                                            // arm L
  const arm = new THREE.Group(); arm.position.set(0.62, 1.2, 0); g.add(arm);
  part(arm, M, 0.24, 0.6, 0.26, 0x2f8a8a, 0, -0.22, 0);
  part(arm, M, 0.1, 0.9, 0.1, 0xe8dcc0, 0, 0.1, 0.25);                                                              // cleaver handle
  part(arm, M, 0.12, 0.5, 0.42, 0xc8c0b0, 0, 0.45, 0.42, { metal: 0.6, rough: 0.35 });                             // blade
  f.body.userData.arm = arm;
  f.weapon = () => arm.localToWorld(V3(0, 0.55, 0.45));
  return f;
}

/** 枯骨巫妖 placeholder: tall dark robe, skull, glowing eyes, staff with a soul gem. */
export function makeLich(home: THREE.Vector3): Figure {
  const f = base(3.1, home), g = f.body, M = f.mats;
  part(g, M, 1.5, 1.6, 1.1, 0x2a1f3a, 0, 0.8, 0); part(g, M, 1.2, 1.0, 0.9, 0x34264a, 0, 1.95, 0);                 // robe
  part(g, M, 1.6, 0.3, 0.6, 0x4a3a62, 0, 2.45, 0);                                                                  // shoulders
  part(g, M, 0.7, 0.72, 0.66, 0xe8e0c8, 0, 2.9, 0.05);                                                              // skull
  part(g, M, 0.16, 0.14, 0.05, 0x6aff9a, -0.16, 2.95, 0.39, { emissive: 0x3aff7a }); part(g, M, 0.16, 0.14, 0.05, 0x6aff9a, 0.16, 2.95, 0.39, { emissive: 0x3aff7a });
  part(g, M, 0.9, 0.18, 0.8, 0x6a5a8a, 0, 3.32, 0.02);                                                              // crown band
  for (const x of [-0.3, 0, 0.3]) part(g, M, 0.1, 0.32, 0.1, 0xb89a4a, x, 3.52, 0.02, { metal: 0.7 });
  part(g, M, 0.12, 3.0, 0.12, 0x4a3a2a, 1.0, 1.5, 0.3);                                                             // staff
  const gem = part(g, M, 0.32, 0.32, 0.32, 0x7affb0, 1.0, 3.15, 0.3, { emissive: 0x2aff8a }); gem.rotation.set(0.6, 0.6, 0);
  f.body.userData.gem = gem;
  f.weapon = () => gem.getWorldPosition(V3());
  return f;
}

/** 食尸鬼 placeholder: hunched green body, long arms. */
export function makeGhoul(home: THREE.Vector3): Figure {
  const f = base(1.5, home), g = f.body, M = f.mats;
  part(g, M, 0.3, 0.5, 0.3, 0x3a4a2a, -0.2, 0.25, 0); part(g, M, 0.3, 0.5, 0.3, 0x3a4a2a, 0.2, 0.25, 0);
  const torso = part(g, M, 0.9, 0.7, 0.6, 0x4a6a3a, 0, 0.85, 0.1); torso.rotation.x = 0.35;
  part(g, M, 0.55, 0.45, 0.5, 0x6a8a4a, 0, 1.25, 0.45);
  part(g, M, 0.1, 0.08, 0.05, 0xff4040, -0.12, 1.3, 0.71, { emissive: 0xc81010 }); part(g, M, 0.1, 0.08, 0.05, 0xff4040, 0.12, 1.3, 0.71, { emissive: 0xc81010 });
  part(g, M, 0.2, 0.9, 0.2, 0x4a6a3a, -0.6, 0.7, 0.3); part(g, M, 0.2, 0.9, 0.2, 0x4a6a3a, 0.6, 0.7, 0.3);
  return f;
}

/** Per-frame motion: breathing, lunge offset along facing, hit flash, squash. */
export function updateFigure(f: Figure, dt: number) {
  if (!f.root.visible) return;
  const t = clock.time + f.home.x * 1.7;
  const breathe = f.dead ? 0 : Math.sin(t * 2.2) * 0.025;
  f.body.scale.set(1 + f.squash * 0.18 - breathe * 0.5, 1 - f.squash * 0.22 + breathe, 1 + f.squash * 0.18 - breathe * 0.5);
  f.squash = Math.max(0, f.squash - dt * 4);
  f.root.position.set(f.home.x, f.home.y, f.home.z + f.lunge * f.facing);
  f.flash = Math.max(0, f.flash - dt * 5);
  for (const m of f.mats) m.emissive.copy(m.userData.baseEmissive).lerp(C(0xffffff), Math.min(1, f.flash));
  const gem = f.body.userData.gem as THREE.Mesh | undefined; if (gem) { gem.rotation.y += dt * 1.5; }
}

/** Swing the hero's weapon arm (wind-up → strike → recover). */
export function swing(f: Figure) {
  const arm = f.body.userData.arm as THREE.Group | undefined; if (!arm) return;
  anim(0.42, k => { arm.rotation.x = k < 0.35 ? lerp(0, 1.4, ease.outCubic(k / 0.35)) : k < 0.55 ? lerp(1.4, -1.6, ease.inCubic((k - 0.35) / 0.2)) : lerp(-1.6, 0, ease.outCubic((k - 0.55) / 0.45)); });
}

/** Rise from the ground (summons / entrance). */
export function riseFrom(f: Figure, dur = 0.6) {
  const y1 = f.home.y; f.home.y = y1 - f.h; f.root.visible = true;
  fxSmoke(V3(f.home.x, 0.1, f.home.z), 0x3a2a3a, 8, { r: 0.6, alpha: 0.6 });
  return new Promise<void>(res => anim(dur, k => { f.home.y = lerp(y1 - f.h, y1, ease.outBack(k)); }, res));
}

/** Death: break into chips, sink and vanish. */
export function shatter(f: Figure, colors: number[]) {
  f.dead = true;
  fxChips(f.chest(), colors, 40, { speed: 5, up: 4, size: 0.16, glow: 0.4 }); fxGlow(f.chest(), 0xffffff, 2.5, 0.3, 2);
  const s0 = f.root.scale.x;
  anim(0.45, k => { f.root.scale.setScalar(Math.max(0.01, s0 * (1 - ease.inCubic(k)))); f.root.rotation.z = k * R(-0.6, 0.6); }, () => { f.root.visible = false; });
}
