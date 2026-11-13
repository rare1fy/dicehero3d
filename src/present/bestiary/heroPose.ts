// 三职业共用握持约束，待机与动作都在同一架势上叠加。+z 是人物前方和武器长轴。
import * as THREE from 'three';
import { type Bone, type Action, rot, mov, curve, snap } from '../actors/rig';

export type GripHero = 'warrior' | 'rogue' | 'mage';
export const isGripHero = (id: string): id is GripHero => id === 'warrior' || id === 'rogue' || id === 'mage';

const parentQ = new THREE.Quaternion(), targetQ = new THREE.Quaternion(), targetEuler = new THREE.Euler();
/** 用手腕实现武器方向，武器节点始终不动，拳头与柄不会在呼吸、挥砍时分离。 */
function wrist(b: Record<string, Bone>, side: 'R' | 'L', elevation: number, yaw = 0, roll = 0) {
  const hand = b[`hand${side}`];
  parentQ.identity();
  for (let p = hand.parent; p && p !== b.root; p = p.parent) parentQ.premultiply(p.quaternion);
  targetQ.setFromEuler(targetEuler.set(-elevation, yaw, roll, 'YXZ'));
  hand.quaternion.copy(parentQ.invert().multiply(targetQ));
}

export function poseHero(id: GripHero, b: Record<string, Bone>, t: number, a: Action | null, off: THREE.Vector3) {
  const br = Math.sin(t * 2.2), rogue = id === 'rogue', mage = id === 'mage';
  let right = mage ? 1.62 : Math.PI / 4, rightYaw = mage ? -0.04 : -0.12;
  let left = Math.PI / 4, leftYaw = 0.16;
  mov(b.hips, 0, (rogue ? -0.045 : 0) + br * 0.008, 0);
  rot(b.spine, rogue ? 0.18 + br * 0.012 : 0.025 + br * 0.012, 0, 0);
  rot(b.neck, rogue ? -0.16 : -0.025, Math.sin(t * 0.5) * 0.025, 0);
  rot(b.cape, 0.08 + br * 0.035, 0, Math.sin(t * 1.2) * 0.025);
  if (rogue) {
    // 微屈膝、前压，双肘分开，前后错开半掌，匕首露在身体两侧。
    rot(b.legL, -0.26, 0, 0.08); rot(b.shinL, 0.48, 0, 0); rot(b.footL, -0.22, 0, 0);
    rot(b.legR, -0.38, 0, -0.08); rot(b.shinR, 0.56, 0, 0); rot(b.footR, -0.18, 0, 0);
    rot(b.armR, -0.35 + br * 0.018, 0, -0.16); rot(b.foreR, -1.05, 0, 0);
    rot(b.armL, -0.20 - br * 0.018, 0, 0.22); rot(b.foreL, -1.12, 0, 0);
  } else if (mage) {
    rot(b.armR, -0.40 + br * 0.012, 0, -0.20); rot(b.foreR, -1.25, 0, 0);
    rot(b.armL, -0.35 - br * 0.02, 0, 0.18); rot(b.foreL, -0.85, 0, 0);
  } else {
    rot(b.armR, -0.22 + br * 0.02, 0, -0.22); rot(b.foreR, -1.10, 0, 0);
    rot(b.armL, -0.40 - br * 0.02, 0, 0.16); rot(b.foreL, -1.10, 0, 0); rot(b.handL, 0.25, 0, 0);
  }

  if (a) {
    const k = a.k, n = a.name;
    if (n === 'hurt') {
      const s = snap(k, [[0, 0], [0.12, 1], [1, 0]]) * Math.min(1.6, (a.data.power as number) || 1);
      off.z = -0.35 * s; rot(b.spine, -0.28 * s, 0, 0.08 * s); rot(b.neck, -0.16 * s, 0, 0);
      right += 0.12 * s; left += 0.12 * s;
    } else if (n === 'attack' && rogue) {
      const r = snap(k, [[0, 0], [0.2, 1], [0.4, 0], [1, 0]]), l = snap(k, [[0, 0], [0.4, 0], [0.6, 1], [0.8, 0], [1, 0]]);
      off.z = curve(k, [[0, 0], [0.2, (a.data.dist as number) ?? 0.6], [0.6, (a.data.dist as number) ?? 0.8], [1, 0]]);
      rot(b.spine, 0.12 * (r + l), 0.16 * (r - l), 0);
      rot(b.armR, -0.95 * r, 0, -0.08 * r); rot(b.foreR, 0.65 * r, 0, 0);
      rot(b.armL, -1.10 * l, 0, 0.08 * l); rot(b.foreL, 0.75 * l, 0, 0);
      right -= 0.72 * r; left -= 0.72 * l;
    } else if (n === 'attack' && !mage) {
      const wind = curve(k, [[0, 0], [0.3, 1], [0.44, 1], [0.54, 0], [1, 0]]), hit = snap(k, [[0, 0], [0.44, 0], [0.54, 1], [0.74, 1], [1, 0]]);
      off.z = curve(k, [[0, 0], [0.3, -0.15], [0.52, (a.data.dist as number) ?? 0.7], [0.74, (a.data.dist as number) ?? 0.7], [1, 0]]);
      rot(b.spine, -0.15 * wind + 0.18 * hit, 0.12 * wind, 0);
      rot(b.armR, -0.80 * wind - 0.45 * hit, 0, -0.12 * wind); rot(b.foreR, 0.80 * wind + 0.65 * hit, 0, 0);
      rot(b.armL, -0.35 * wind, 0, 0.12 * hit);
      right += 0.65 * wind - 0.55 * hit; rightYaw -= 0.08 * wind;
    } else if (n === 'cast' || n === 'attack' || n === 'summon' || n === 'shield') {
      const up = curve(k, [[0, 0], [0.4, 1], [0.6, 0.75], [1, 0]]), push = snap(k, [[0, 0], [0.55, 0], [0.65, 1], [1, 0]]);
      rot(b.armL, -0.60 * up - 0.25 * push, 0, 0.12 * up); rot(b.foreL, 0.35 * push, 0, 0);
      rot(b.armR, -0.20 * up - 0.15 * push, 0, -0.08 * up); rot(b.foreR, 0.20 * up + 0.15 * push, 0, 0);
      rot(b.spine, -0.06 * up + 0.06 * push, 0, 0);
      right += 0.05 * up - 0.18 * push; left -= 0.30 * push;
    } else if (n === 'spin') {
      const out = curve(k, [[0, 0], [0.18, 1], [0.82, 1], [1, 0]]), turn = curve(k, [[0, 0], [0.22, 0], [0.78, 1], [1, 1]]);
      b.hips.rotation.y += turn * Math.PI * 4;
      off.z = curve(k, [[0, 0], [0.25, -0.1], [0.6, (a.data.dist as number) || 0], [0.8, (a.data.dist as number) || 0], [1, 0]]);
      rot(b.armR, 0.12 * out, 0, -1.05 * out); rot(b.foreR, 0.70 * out, 0, 0);
      rot(b.armL, 0.12 * out, 0, 0.85 * out); rot(b.foreL, 0.60 * out, 0, 0);
      // 长柄向外扫，绝不横穿胸口；方向跟随髋部的两圈旋转。
      right += ((mage ? 1.62 : 0.12) - right) * out; rightYaw += -1.20 * out + turn * Math.PI * 4;
      left += (0.16 - left) * out; leftYaw += 1.15 * out + turn * Math.PI * 4;
      mov(b.hips, 0, -0.04 * out, 0);
    } else if (n === 'block') {
      const s = curve(k, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]]);
      rot(b.armR, (mage ? -0.12 : -0.40) * s, 0, -0.10 * s); rot(b.foreR, (mage ? 0.12 : -0.10) * s, 0, 0);
      rot(b.armL, -0.35 * s, 0, 0.10 * s); rot(b.foreL, -0.12 * s, 0, 0);
      right += ((mage ? 1.62 : 1.25) - right) * s; left += (1.15 - left) * s; mov(b.hips, 0, -0.035 * s, 0);
    } else if (n === 'bleed') {
      const s = curve(k, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]);
      // 空手压胸、持械手留在身外，避免斧刃或匕首切进躯干。
      rot(b.armL, -0.25 * s, 0, -0.25 * s); rot(b.foreL, -0.15 * s, 0, 0);
      rot(b.armR, 0.08 * s, 0, -0.22 * s); rightYaw -= (mage ? 0.05 : 0.25) * s; leftYaw += 0.15 * s;
      rot(b.spine, 0.10 * s, 0, 0);
    } else if (n === 'toss') {
      const s = snap(k, [[0, 0], [0.35, -1], [0.5, 1], [1, 0]]);
      rot(b.armL, -0.60 * Math.max(0, s) + 0.25 * Math.max(0, -s), 0, 0);
      rot(b.foreL, 0.35 * Math.max(0, s), 0, 0); left += 0.20 * s;
    } else if (n === 'roar' || n === 'cheer') {
      const s = curve(k, [[0, 0], [0.25, 1], [0.70, 1], [1, 0]]);
      rot(b.armR, (mage ? -0.15 : -0.65) * s, 0, -0.25 * s); rot(b.foreR, (mage ? 0.15 : 0.65) * s, 0, 0);
      rot(b.armL, -1.10 * s, 0, 0.30 * s); right += ((mage ? 1.62 : 1.45) - right) * s; left += 0.50 * s;
      rot(b.spine, -0.08 * s, 0, 0);
      if (n === 'cheer') off.y += Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 0.18;
    } else if (n === 'fall' || n === 'collapse') {
      const s = curve(k, [[0, 0], [0.6, 1], [1, 1]]);
      rot(b.hips, -1.35 * s, 0, 0.20 * s); mov(b.hips, 0, -0.25 * s, -0.3 * s);
      rot(b.armR, 0, 0, -0.65 * s); rot(b.armL, 0, 0, 0.65 * s);
      right += 0.35 * s; left += 0.35 * s;
    }
  }
  wrist(b, 'R', right, rightYaw);
  if (rogue) wrist(b, 'L', left, leftYaw);
  if (mage) wrist(b, 'L', -Math.PI + 0.15, 0, 0.10); // 指尖朝上，掌心朝前。
}
