// The battle cast as toy-brick builds (look/legokit.ts): one stud = 15 cm, one plate = 6 cm, three plates = a brick. Big chunky
// shapes, printed-style faces (flat 1×1 eyes), translucent glowing pieces for soul fire. Same joints as the voxel cast, so the same
// poses and the same battle adapter drive them.
import { LegoChar } from '../look/legokit';
import { biped, eyes, type V, type Anchors } from './kit';
import { BattleActor } from './battle';
import type { ModelDef } from './models';
import type { Cast } from '../actors/cast';

const U = 0.15, PL = 0.06;
const L = {
  WHITE: 0xf4f4f4, BLACK: 0x1b1b1f, RED: 0xc91a09, DRED: 0x720e0f, ORANGE: 0xfe8a18, YELLOW: 0xf2cd37, TAN: 0xe4cd9e, NOUGAT: 0xd09168, DNOUGAT: 0xaa7d55,
  RBROWN: 0x582a12, DBROWN: 0x352100, LGRAY: 0xa0a5a9, DGRAY: 0x6c6e68, BLUE: 0x0055bf, DBLUE: 0x0a3463, PURPLE: 0x6a2c8a, DPURPLE: 0x3f1f5a,
  GREEN: 0x237841, SAND: 0x708e7c, OLIVE: 0x9b9a5a, LIME: 0xbbe90b, GOLD: 0xdbac34, TGREEN: 0x84f5a0, TRED: 0xff4a2a,
};
const lego = () => new LegoChar(U, PL);

function hood(v: V, A: Anchors, c: number) {
  const x0 = -A.headW / 2 - 1, x1 = A.headW / 2, z0 = -A.headD / 2 - 1 + A.headZ;
  v.part('head').box(x0, A.headY0, z0, x1, A.headY1 + 1, z0 + 1, c).box(x0, A.headY0, z0, x0, A.headY1 + 1, A.faceZ - 1, c).box(x1, A.headY0, z0, x1, A.headY1 + 1, A.faceZ - 1, c).box(x0, A.headY1 + 1, z0, x1, A.headY1 + 2, A.faceZ - 1, c);
}

function warrior(): V {
  const v = lego();
  const A = biped(v, { skin: L.NOUGAT, legs: L.RBROWN, boots: L.DBROWN, hips: L.DRED, belt: L.DBROWN, legH: 6, legW: 2, legD: 2, legGap: 0, hipH: 3, torsoH: 9, torsoW: 6, chestW: 6, torsoD: 4, headW: 6, headH: 12, headD: 6, armW: 2, upper: 4, fore: 3, hand: 3, round: 0 });
  v.part('hips').box(-1, A.hipY - 3, 2, 0, A.hipY - 1, 2, L.DRED).set(-1, A.hipY + 2, 2, L.GOLD).set(0, A.hipY + 2, 2, L.GOLD);
  v.part('chest').box(1, A.torsoY0 + 3, 2, 1, A.torsoY1, 2, L.DBROWN);
  // fur mantle with a horn on the left shoulder, iron cap on the right
  v.part('shL').box(3, A.shoulderY - 1, -2, 5, A.shoulderY + 1, 1, L.TAN).box(4, A.shoulderY + 2, -1, 4, A.shoulderY + 4, -1, L.WHITE);
  v.part('shR').box(-6, A.shoulderY - 1, -2, -4, A.shoulderY + 1, 1, L.DGRAY);
  v.part('foreL').box(3, A.handY + 3, -1, 4, A.handY + 3, 0, L.DGRAY); v.part('foreR').box(-5, A.handY + 3, -1, -4, A.handY + 3, 0, L.DGRAY);
  // printed face: black eyes in a blue war-paint band, angry brows, nose, ears
  v.part('head').box(-3, A.headY0 + 5, A.faceZ, 2, A.headY0 + 7, A.faceZ, L.BLUE);
  eyes(v, A, { y: 5, w: 1, h: 3, gap: 2, style: 'dot', pupil: L.BLACK });
  v.part('head').box(-3, A.headY0 + 8, A.faceZ, -2, A.headY0 + 8, A.faceZ, L.DRED).box(1, A.headY0 + 8, A.faceZ, 2, A.headY0 + 8, A.faceZ, L.DRED)
    .box(-1, A.headY0 + 4, A.faceZ + 1, 0, A.headY0 + 6, A.faceZ + 1, L.DNOUGAT).box(-4, A.headY0 + 5, -1, -4, A.headY0 + 7, 0, L.NOUGAT).box(3, A.headY0 + 5, -1, 3, A.headY0 + 7, 0, L.NOUGAT);
  // beard (on the jaw) with a gold-beaded braid
  v.part('jaw').box(-3, A.headY0, A.faceZ, 2, A.headY0 + 3, A.faceZ + 1, L.RBROWN).box(-2, A.headY0 - 3, A.faceZ, 1, A.headY0 - 1, A.faceZ + 1, L.RBROWN)
    .box(-1, A.headY0 + 3, A.faceZ + 1, 0, A.headY0 + 3, A.faceZ + 1, L.BLACK).box(-1, A.headY0 - 6, A.faceZ + 1, 0, A.headY0 - 4, A.faceZ + 1, L.RBROWN).box(-1, A.headY0 - 5, A.faceZ + 2, 0, A.headY0 - 5, A.faceZ + 2, L.GOLD);
  // flame mohawk: red, orange, yellow bricks
  v.part('hat').box(-1, A.headY1 + 1, -3, 0, A.headY1 + 3, 2, L.RED).box(-1, A.headY1 + 4, -2, 0, A.headY1 + 6, 1, L.ORANGE).box(-1, A.headY1 + 7, -1, 0, A.headY1 + 9, 0, L.YELLOW);
  // great axe: brown haft through the right fist, a grey blade with a light edge
  const [x, y, z] = A.wR;
  v.part('weapon').box(x, y, z - 2, x, y, z + 10, L.RBROWN).box(x, y - 9, z + 6, x, y - 1, z + 9, L.DGRAY).box(x, y - 9, z + 10, x, y - 1, z + 10, L.LGRAY).box(x, y + 1, z + 7, x, y + 3, z + 8, L.DGRAY);
  return v;
}

function lich(): V {
  const v = lego();
  const A = biped(v, { skin: L.WHITE, robe: { c: L.PURPLE, flare: 1, trim: L.GOLD, hem: L.DPURPLE }, torso: L.PURPLE, chest: L.PURPLE, sleeve: L.PURPLE, fore_: L.DPURPLE, hands: L.WHITE, boots: L.DPURPLE, belt: L.GOLD, legH: 15, hipH: 3, torsoH: 15, torsoW: 8, chestW: 10, torsoD: 6, headW: 8, headH: 15, headD: 6, armW: 2, upper: 6, fore: 6, hand: 3, round: 0 });
  for (const c of [...v.cells.values()]) if (c.part === 'footL' || c.part === 'footR') v.set(c.x, c.y, c.z, null);
  v.part('hips').box(-1, 3, 4, 0, A.hipY + 2, 4, L.GOLD);
  // an open collar on a ribcage
  v.part('chest').box(-3, A.torsoY0 + 6, 3, 2, A.torsoY1 - 2, 3, L.BLACK).box(-3, A.torsoY0 + 7, 3, 2, A.torsoY0 + 7, 3, L.WHITE).box(-3, A.torsoY0 + 10, 3, 2, A.torsoY0 + 10, 3, L.WHITE).box(-1, A.torsoY0 + 6, 3, 0, A.torsoY1 - 2, 3, L.WHITE);
  for (const [s, x0] of [['shL', 5], ['shR', -8]] as Array<[string, number]>) v.part(s).box(x0, A.shoulderY - 1, -2, x0 + 2, A.shoulderY + 2, 2, L.DGRAY).box(x0 + 1, A.shoulderY + 3, 0, x0 + 1, A.shoulderY + 5, 0, L.WHITE);
  // hood, skull with glowing soul eyes, teeth, crown with a gem
  hood(v, A, L.DPURPLE);
  v.part('head').box(-3, A.headY0 + 7, A.faceZ, -2, A.headY0 + 10, A.faceZ, L.BLACK).box(1, A.headY0 + 7, A.faceZ, 2, A.headY0 + 10, A.faceZ, L.BLACK)
    .box(-2, A.headY0 + 8, A.faceZ, -2, A.headY0 + 9, A.faceZ, L.TGREEN, 1).box(1, A.headY0 + 8, A.faceZ, 1, A.headY0 + 9, A.faceZ, L.TGREEN, 1)
    .box(-1, A.headY0 + 5, A.faceZ, 0, A.headY0 + 6, A.faceZ, L.BLACK);
  for (let x = -4; x <= 3; x++) v.part('jaw').box(x, A.headY0, A.faceZ, x, A.headY0 + 2, A.faceZ, x & 1 ? L.BLACK : L.WHITE);
  v.part('hat').box(-4, A.headY1 + 3, -3, 3, A.headY1 + 3, 2, L.GOLD).box(-3, A.headY1 + 3, -2, 2, A.headY1 + 3, 1, null)
    .box(-4, A.headY1 + 4, 2, -4, A.headY1 + 6, 2, L.GOLD).box(3, A.headY1 + 4, 2, 3, A.headY1 + 6, 2, L.GOLD).box(-1, A.headY1 + 4, 2, 0, A.headY1 + 7, 2, L.GOLD).box(-1, A.headY1 + 4, 3, 0, A.headY1 + 5, 3, L.TGREEN, 1);
  // staff: dark haft, a trans-green gem in a white bone cage
  const [x, y, z] = A.wR;
  v.part('weapon').box(x, y, z - 5, x, y, z + 17, L.DBROWN).box(x - 1, y - 1, z + 18, x + 1, y + 1, z + 20, L.TGREEN, 1);
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) v.box(x + dx, y + dy, z + 17, x + dx, y + dy, z + 21, L.WHITE);
  return v;
}

function ghoul(): V {
  const v = lego();
  const A = biped(v, { skin: L.SAND, legs: L.SAND, hips: L.RBROWN, torso: L.SAND, belt: L.RBROWN, legH: 6, legW: 2, legD: 2, legGap: 0, hipH: 3, torsoH: 9, torsoW: 4, chestW: 6, torsoD: 4, headW: 6, headH: 9, headD: 6, headZ: 1, armW: 2, upper: 6, fore: 6, hand: 3, round: 0 });
  v.part('chest').box(-3, A.torsoY0 + 5, 1, 2, A.torsoY0 + 5, 1, L.OLIVE);
  v.part('head').box(-3, A.headY0 + 4, A.faceZ, 2, A.headY0 + 6, A.faceZ, L.OLIVE);
  eyes(v, A, { y: 5, w: 1, h: 1, gap: 2, style: 'glow', glow: L.TRED });
  v.part('head').box(-4, A.headY0 + 5, 0, -4, A.headY0 + 8, 1, L.SAND).box(3, A.headY0 + 5, 0, 3, A.headY0 + 8, 1, L.SAND);
  for (let x = -3; x <= 2; x++) v.set(x, A.headY0 + 1, A.faceZ, x === -3 || x === 2 ? L.WHITE : L.DRED);
  v.part('jaw').box(-3, A.headY0 - 3, A.faceZ - 2, 2, A.headY0 - 1, A.faceZ, L.OLIVE).box(-2, A.headY0 - 1, A.faceZ, -2, A.headY0 - 1, A.faceZ, L.WHITE).box(1, A.headY0 - 1, A.faceZ, 1, A.headY0 - 1, A.faceZ, L.WHITE);
  for (const [s, x0] of [['handL', 3], ['handR', -5]] as Array<[string, number]>) v.part(s).box(x0, A.handY - 2, 0, x0, A.handY - 1, 1, L.BLACK).box(x0 + 1, A.handY - 2, 0, x0 + 1, A.handY - 1, 1, L.BLACK);
  return v;
}

export const LEGO: ModelDef[] = [
  { id: 'lego_warrior', name: '嗜血狂战', group: '职业', role: '积木版', line: '', kind: 'biped', attack: 'swing', build: warrior },
  { id: 'lego_lich', name: '枯骨巫妖', group: '首领', role: '积木版', line: '', kind: 'robe', attack: 'cast', build: lich, hover: 0.35 },
  { id: 'lego_ghoul', name: '食尸鬼', group: '普通', role: '积木版', line: '', kind: 'biped', attack: 'claw', build: ghoul },
];
export const legoCast = (): Cast => ({ hero: () => new BattleActor(LEGO[0]), lich: () => new BattleActor(LEGO[1]), ghoul: () => new BattleActor(LEGO[2]) });
