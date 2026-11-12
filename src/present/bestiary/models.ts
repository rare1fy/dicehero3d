// Chapter 1 (幽暗森林) roster + the three classes, as chunky voxel models on one shared block size (kit.ts CELL).
// Names, roles and lines come from the 2D original (src/config/enemy*.ts, src/data/classes.ts); the designs are original.
import { P, newChar, biped, eyes, mouth, axe, sword, staff, rbox, srbox, taper, speckle, foliage, rowOct, type V, type Anchors } from './kit';
import type { Col } from '../look/voxkit';

export type Kind = 'biped' | 'robe' | 'ghost' | 'quad' | 'spider' | 'sprite';
export type Attack = 'swing' | 'slam' | 'claw' | 'dual' | 'shoot' | 'cast' | 'bite' | 'strike';
export interface ModelDef {
  id: string; name: string; group: '职业' | '普通' | '精英' | '首领'; role: string; line: string;
  kind: Kind; attack: Attack; build: () => V; glow?: number; self?: number; hover?: number; bowL?: boolean;
}

// ------------------------------------------------------------------ shared bits
function hoodShell(v: V, A: Anchors, c: Col, o: { extra?: number; peak?: number; dark?: Col } = {}) {
  const e = o.extra ?? 1, x0 = -A.headW / 2 - e, x1 = A.headW / 2 - 1 + e, z0 = A.headZ - A.headD / 2 - e, z1 = A.faceZ;
  v.part('head');
  for (let x = x0; x <= x1; x++) for (let y = A.headY0 - 1; y <= A.headY1 + e; y++) for (let z = z0; z <= z1; z++) {
    const inside = x > x0 && x < x1 && y < A.headY1 + e && z > z0;
    if (inside && z >= A.faceZ - 1 && y >= A.headY0) continue;   // leave the face open
    if (!inside || !v.get(x, y, z)) v.set(x, y, z, c);
  }
  if (o.peak) for (let i = 1; i <= o.peak; i++) v.box(-1, A.headY1 + e + i, z0 + i, 0, A.headY1 + e + i, z0 + i + 1, c);
  if (o.dark) v.box(-A.headW / 2 + 1, A.headY0, A.faceZ - 1, A.headW / 2 - 2, A.headY1, A.faceZ - 1, o.dark);
}
function ghostTail(v: V, A: Anchors, w: number, d: number, c: Col, tip: Col, back = 4) {
  v.part('hips');
  const top = A.torsoY0 - 1;
  for (let y = 0; y <= top; y++) {
    const t = y / top, ww = Math.max(1, Math.round(1 + (w - 1) * t)), dd = Math.max(1, Math.round(1 + (d - 1) * t)), zo = -Math.round(back * (1 - t));
    for (let x = -ww; x < ww; x++) for (let z = -dd; z < dd; z++) if (Math.abs(x + 0.5) / ww + Math.abs(z + 0.5) / dd <= 1.25) v.set(x, y, z + zo, y < 3 ? tip : c);
  }
}
/** claws: a few dark spikes under / in front of a hand */
function claws(v: V, A: Anchors, side: 1 | -1, c: Col, n = 3, len = 2) {
  const x0 = side > 0 ? A.chestW / 2 : -A.chestW / 2 - 3;
  v.part(side > 0 ? 'handL' : 'handR');
  for (let i = 0; i < n; i++) for (let k = 1; k <= len; k++) v.set(x0 + i, A.handY - k, 1 + (k > 1 ? 1 : 0), c);
}

// ================================================================== classes
function warrior(): V {
  const v = newChar(), SK = 0xe8a878, SKD = 0xc07c52;
  const A = biped(v, { skin: SK, legs: 0x5a4636, boots: P.LEATH_D, hips: 0x8a2a2a, belt: P.LEATH_D, torsoW: 10, chestW: 12, torsoH: 7, torsoD: 6, headW: 10, headH: 8, headD: 8, armW: 4, upper: 4, fore: 3, hand: 3, legW: 4, legGap: 1 });
  // kilt flaps, buckle, chest strap, scars
  v.part('hips').box(-1, A.hipY - 3, 3, 0, A.hipY - 1, 3, 0x6a1e1e).box(-1, A.hipY - 3, -4, 0, A.hipY - 1, -4, 0x6a1e1e).box(-1, A.hipY + 1, 3, 0, A.hipY + 1, 3, P.GOLD);
  for (let i = 0; i <= 11; i++) { const x = 5 - i, y = A.torsoY1 - Math.round((i * 5) / 11); v.part(y >= A.torsoY0 + 3 ? 'chest' : 'spine').set(x, y, 2, P.LEATH).set(x, y, -3, P.LEATH); }
  v.part('chest').set(-3, A.torsoY1 - 2, 2, P.BLOOD).set(-2, A.torsoY1 - 3, 2, P.BLOOD).set(-1, A.torsoY1 - 4, 2, P.BLOOD);
  v.paint(c => c.z === 2 && c.y === A.torsoY1 - 1 && Math.abs(c.x + 0.5) > 1 && Math.abs(c.x + 0.5) < 5 ? SKD : null, 'chest');
  // fur mantle + horn on the left shoulder, iron cap on the right
  v.part('shL').box(5, A.shoulderY - 1, -3, 10, A.shoulderY + 1, 2, 0xe8dcc0).box(6, A.shoulderY + 1, -3, 10, A.shoulderY + 1, 2, 0xb8a684).set(8, A.shoulderY + 2, -1, P.BONE).set(8, A.shoulderY + 3, -1, P.BONE).set(8, A.shoulderY + 4, -2, P.BONE_D);
  v.part('shR').box(-10, A.shoulderY, -2, -6, A.shoulderY, 1, P.IRON_D).box(-9, A.shoulderY + 1, -1, -7, A.shoulderY + 1, 0, P.IRON);
  for (const s of ['foreL', 'foreR']) v.part(s).box(s === 'foreL' ? 6 : -10, A.handY + 3, -2, s === 'foreL' ? 9 : -7, A.handY + 4, 1, P.IRON_D);
  // face: two fierce eyes, woad stripe, nose, ears, shaved sides
  eyes(v, A, { y: 3, w: 2, h: 3, gap: 2, brow: 0xb8300e, angry: true });
  v.part('head').sym(3, A.headY0 + 3, A.faceZ, 0x2a3c8a).sym(3, A.headY0 + 4, A.faceZ, 0x2a3c8a).sym(4, A.headY0 + 4, A.faceZ, 0x2a3c8a).sym(0, A.headY0 + 5, A.faceZ, 0x2a3c8a)
    .box(-1, A.headY0 + 2, A.faceZ + 1, 0, A.headY0 + 3, A.faceZ + 1, SKD).symBox(5, A.headY0 + 3, 0, 5, A.headY0 + 4, 1, SK);
  v.paint(c => (c.y >= A.headY0 + 6 && Math.abs(c.x + 0.5) > 2.5 && c.z < A.faceZ) ? SKD : null, 'head');
  // jaw: braided auburn beard
  v.part('jaw').box(-4, A.headY0, A.faceZ, 3, A.headY0 + 1, A.faceZ + 1, 0x8a3418).box(-3, A.headY0 - 3, A.faceZ, 2, A.headY0 - 1, A.faceZ + 1, 0x8a3418)
    .box(-1, A.headY0 - 6, A.faceZ + 1, 0, A.headY0 - 4, A.faceZ + 1, 0x5e2010).box(-1, A.headY0 - 5, A.faceZ + 2, 0, A.headY0 - 5, A.faceZ + 2, P.GOLD)
    .box(-1, A.headY0 + 1, A.faceZ + 1, 0, A.headY0 + 1, A.faceZ + 1, P.DARK).symBox(4, A.headY0, A.faceZ - 2, 4, A.headY0 + 2, A.faceZ, 0x8a3418);
  // flame mohawk
  v.part('hat').box(-1, A.headY1 + 1, -4, 0, A.headY1 + 2, 3, 0xff5a1e).box(-1, A.headY1 + 3, -3, 0, A.headY1 + 3, 2, 0xff8a2a).box(-1, A.headY1 + 4, -2, 0, A.headY1 + 4, 1, 0xffc23a)
    .box(-1, A.headY0 + 2, -5, 0, A.headY1, -5, 0xb8300e);
  axe(v, A, { len: 20, blade: 7 });
  v.part('weapon').set(A.wR[0], A.wR[1] - 4, A.wR[2] + 18, P.BLOOD).set(A.wR[0], A.wR[1] - 3, A.wR[2] + 18, P.BLOOD);
  return v;
}

function mage(): V {
  const v = newChar(), SK = 0xf2cfa8, ROBE = 0x3a2a96, ROBE_D = 0x261c6a, HAIR = 0xe6ecf8;
  const A = biped(v, { skin: SK, robe: { c: ROBE, flare: 3, trim: P.GOLD, hem: ROBE_D }, torso: ROBE, sleeve: ROBE, fore_: ROBE_D, hands: SK, boots: 0x2a2440, belt: P.GOLD_D, torsoW: 8, chestW: 10, torsoH: 7, torsoD: 6, headW: 10, headH: 9, headD: 9, armW: 3, upper: 3, fore: 4, hand: 2 });
  // star-dusted robe, gold stole, collar
  v.part('hips').paint(c => (c.x === -1 || c.x === 0) && c.z >= 2 && c.y > 2 ? P.GOLD_D : null, 'hips');
  speckle(v, ROBE, 0xfff2b0, 0.05, 3); speckle(v, ROBE_D, 0xbfd8ff, 0.05, 5);
  v.part('chest').box(-4, A.torsoY1, -3, 3, A.torsoY1 + 1, 3, ROBE_D).box(-1, A.torsoY1 - 2, 3, 0, A.torsoY1, 3, P.GOLD).set(-1, A.torsoY1 - 1, 4, 0x8af0ff, 1).set(0, A.torsoY1 - 1, 4, 0x8af0ff, 1);
  // face and silver hair with bangs
  eyes(v, A, { y: 3, w: 2, h: 3, gap: 2, pupil: 0x7a5aff, brow: 0xb8c4dc });
  v.part('head').box(-1, A.headY0 + 2, A.faceZ, 0, A.headY0 + 2, A.faceZ, 0xe0a888).box(-1, A.headY0 + 1, A.faceZ, 0, A.headY0 + 1, A.faceZ, 0xc06a6a)
    .box(-5, A.headY0 + 6, A.faceZ, 4, A.headY1, A.faceZ, HAIR).sym(2, A.headY0 + 6, A.faceZ, SK).sym(3, A.headY0 + 6, A.faceZ, null)
    .box(-6, A.headY0 - 4, -5, 5, A.headY1, -4, HAIR).symBox(5, A.headY0 - 2, -4, 5, A.headY1, 3, HAIR);
  // tall pointed hat, bending back, with a gold band and a glowing star
  v.part('hat'); rowOct(v, 8, 8, A.headY1 + 1, ROBE_D);
  for (let i = 0; i < 10; i++) { const r = Math.max(0.6, 5.2 - i * 0.5); taper(v, -0.5, A.headY1 + 2 + i, -0.5 - Math.round(i * i * 0.05), 1, r, r, i < 2 ? P.GOLD : ROBE); }
  v.set(-1, A.headY1 + 3, 4, 0xfff2a0, 1).set(0, A.headY1 + 3, 4, 0xfff2a0, 1).set(-1, A.headY1 + 4, 4, 0xfff2a0, 1).set(0, A.headY1 + 2, 4, 0xfff2a0, 1);
  // star staff: a crescent and a floating star
  const top = staff(v, A, { len: 20, wood: 0x8a7aa8, back: 6 });
  v.part('weapon').box(top[0], top[1] - 2, top[2] - 1, top[0], top[1] + 2, top[2] - 1, P.GOLD).box(top[0], top[1] - 3, top[2], top[0], top[1] - 3, top[2] + 1, P.GOLD).box(top[0], top[1] + 3, top[2], top[0], top[1] + 3, top[2] + 1, P.GOLD)
    .box(top[0] - 1, top[1] - 1, top[2] + 2, top[0] + 1, top[1] + 1, top[2] + 4, 0xbff4ff, 1);
  // constellation cape
  v.part('cape').box(-5, A.hipY - 4, -4, 4, A.torsoY1, -4, ROBE_D);
  for (const [x, y] of [[-3, -2], [1, -5], [3, -9], [-1, -11], [-4, -14]]) v.set(x, A.torsoY1 + y, -5, 0xfff2b0, 1);
  return v;
}

function rogue(): V {
  const v = newChar(), SK = 0xe8b088, CLOAK = 0x2e7a46, CLOAK_D = 0x1e5030, LEA = 0x4a3a30;
  const A = biped(v, { skin: SK, legs: 0x2e2e38, boots: 0x22222a, hips: LEA, torso: LEA, chest: 0x3a4a3a, belt: P.LEATH_D, sleeve: CLOAK_D, fore_: LEA, hands: 0x2a2a30, torsoW: 8, chestW: 10, torsoH: 7, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 3, upper: 3, fore: 4, hand: 2, legW: 3 });
  // cross straps with daggers' sheaths, pouches
  for (let i = 0; i <= 9; i++) { const x = 4 - i, y = A.torsoY1 - Math.round((i * 4) / 9); v.part(y >= A.torsoY0 + 3 ? 'chest' : 'spine').set(x, y, 2, P.LEATH_D).set(-1 - x, y, 2, P.LEATH_D); }
  v.part('hips').box(3, A.hipY, 3, 4, A.hipY + 1, 3, P.LEATH).box(-5, A.hipY, 3, -4, A.hipY + 1, 3, P.LEATH);
  // hood, mask over the lower face, green-lit eyes
  hoodShell(v, A, CLOAK, { extra: 1, peak: 2 });
  eyes(v, A, { y: 3, w: 2, h: 2, gap: 2, pupil: 0x2aa860, brow: 0x1e2a24 });
  v.part('head').box(-4, A.headY0, A.faceZ, 3, A.headY0 + 2, A.faceZ, 0x1e2a24).box(-1, A.headY0 + 1, A.faceZ + 1, 0, A.headY0 + 2, A.faceZ + 1, 0x1e2a24);
  // trailing scarf (cape bone) and shoulder cloak
  v.part('chest').box(-5, A.torsoY1, -3, 4, A.torsoY1 + 1, 2, CLOAK);
  v.part('cape').box(-2, A.hipY - 6, -4, 1, A.torsoY1, -4, CLOAK).box(-3, A.hipY - 9, -5, -2, A.hipY - 5, -5, CLOAK_D).box(1, A.hipY - 8, -5, 2, A.hipY - 5, -5, CLOAK_D);
  // twin curved daggers
  sword(v, A, { len: 7, blade: 0xd8f0e0, guard: P.IRON_D, curve: 2 });
  sword(v, A, { len: 7, blade: 0xd8f0e0, guard: P.IRON_D, curve: 2, part: 'offhand', at: A.wL });
  return v;
}

// ================================================================== chapter 1 — normals
function ghoul(): V {
  const v = newChar(), H = 0x7c9a52, HD = 0x4c6236;
  const A = biped(v, { skin: H, legs: H, hips: 0x4a3a32, torso: H, belt: 0x4a3a32, legH: 7, legW: 3, hipH: 2, torsoH: 6, torsoW: 8, chestW: 10, torsoD: 6, headW: 8, headH: 7, headD: 8, headZ: 2, armW: 2, upper: 5, fore: 4, hand: 3 });
  v.paint(c => c.z === 2 && (c.y - A.torsoY0) % 2 === 1 && Math.abs(c.x + 0.5) > 0.6 ? HD : null, 'chest');
  v.paint(c => c.z === 2 && (c.y - A.torsoY0) % 2 === 1 && Math.abs(c.x + 0.5) > 0.6 ? HD : null, 'spine');
  for (let y = A.torsoY0; y <= A.torsoY1 + 1; y += 2) v.part(y >= A.torsoY0 + 3 ? 'chest' : 'spine').box(-1, y, -4, 0, y, -4, HD);
  v.part('hips').box(-1, A.hipY - 3, 3, 0, A.hipY, 3, 0x4a3a32).box(-2, A.hipY - 2, -4, 1, A.hipY, -4, 0x3a2e28);
  eyes(v, A, { y: 3, w: 2, h: 1, gap: 2, style: 'glow', glow: 0xff3a20 });
  v.part('head').symBox(1, A.headY0 + 4, A.faceZ, 3, A.headY0 + 4, A.faceZ + 1, HD).box(-1, A.headY0 + 2, A.faceZ + 1, 0, A.headY0 + 2, A.faceZ + 1, HD)
    .symBox(4, A.headY0 + 4, 0, 5, A.headY0 + 5, 1, H).sym(6, A.headY0 + 6, 0, H);
  for (let x = -4; x <= 3; x++) v.set(x, A.headY0, A.faceZ, (x & 1) ? 0xeee2c0 : 0x8a2030);
  v.part('jaw').box(-3, A.headY0 - 2, A.faceZ - 3, 2, A.headY0 - 1, A.faceZ, HD).box(-3, A.headY0 - 1, A.faceZ, 2, A.headY0 - 1, A.faceZ, 0x8a2030).sym(2, A.headY0 - 1, A.faceZ, 0xeee2c0).sym(0, A.headY0 - 1, A.faceZ + 1, 0xeee2c0);
  claws(v, A, 1, 0x201a1e, 2, 3); claws(v, A, -1, 0x201a1e, 2, 3);
  return v;
}

function spider(): V {
  const v = newChar(), B = 0x2a1a34, BL = 0x4a2a5a, LEG = 0x221628, BAND = 0x6a3a8a, TOX = 0x9aff3a;
  v.bone('body', 'root', 0, 9, 0).bone('abdomen', 'body', 0, 10, -5).bone('head', 'body', 0, 9, 5).bone('jaw', 'head', 0, 8, 9);
  // abdomen: big round, glowing toxic markings on top
  v.part('abdomen').ell(-0.0, 13, -11, 9, 8, 10, B);
  v.paint(c => (c.y > 19 && Math.abs(c.x + 0.5) < 1 && c.z < -7 && c.z > -16 && (c.z & 1)) || (c.y > 18 && Math.abs(Math.abs(c.x + 0.5) - 4) < 0.6 && Math.abs(c.z + 11) < 1.5) ? TOX : null, 'abdomen');
  v.paint(c => c.c === TOX ? null : (c.y > 18 && (c.x + c.z) % 5 === 0 ? BL : null), 'abdomen');
  v.paint(c => c.c === TOX ? null : null, 'abdomen');
  for (const c of v.cells.values()) if (c.part === 'abdomen' && c.c === TOX) c.g = 1;
  // thorax + head with six red eyes
  v.part('body').ell(0, 10, 0, 6, 4.5, 6, B);
  v.part('head').ell(0, 10, 7, 4.5, 4, 4, BL);
  v.symBox(1, 11, 10, 2, 12, 10, 0xff2a2a, 1).sym(3, 13, 9, 0xff2a2a, 1).sym(1, 14, 9, 0xff6a3a, 1);
  v.part('jaw').symBox(1, 6, 10, 2, 8, 11, 0x1a1020).sym(1, 5, 11, TOX, 1).sym(1, 4, 11, TOX, 1);
  // eight legs: out and up to the knee, then down to the tip
  const zs = [5, 1, -3, -7];
  for (let i = 0; i < 4; i++) for (const sx of [1, -1]) {
    const name = `leg${sx > 0 ? 'L' : 'R'}${i}`, z0 = zs[i], zk = z0 + (i - 1.5) * 3, zt = z0 + (i - 1.5) * 6;
    v.bone(name, 'body', sx * 5, 10, z0);
    v.part(name);
    const seg = (a: number[], b: number[], c: Col, th: number) => { const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]))); for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t), z = Math.round(a[2] + (b[2] - a[2]) * t); v.box(Math.min(x, x - sx * (th - 1)), y - th + 1, z, Math.max(x, x - sx * (th - 1)), y, z, c); } };
    const knee = [sx * 13, 17, zk], tip = [sx * 19, 0, zt];
    seg([sx * 5, 10, z0], knee, LEG, 2); seg(knee, tip, LEG, 2);
    v.set(knee[0], knee[1] + 1, knee[2], BAND).set(Math.round(sx * 16), 9, Math.round((zk + zt) / 2), BAND);
  }
  return v;
}

function treant(): V {
  const v = newChar(), BK = P.BARK, BD = P.BARK_D, VEIN = 0xb05aff;
  const A = biped(v, { skin: BK, legs: BD, hips: BK, torso: BK, belt: null, legH: 8, legW: 4, legD: 5, legGap: 1, hipH: 2, torsoH: 9, torsoW: 12, chestW: 14, torsoD: 10, headW: 10, headH: 9, headD: 10, armW: 4, upper: 5, fore: 5, hand: 3, round: 1 });
  v.paint(c => (c.x * 3 + c.z * 2 + Math.floor(c.y / 3)) % 4 === 0 && c.c === BK ? BD : null);
  // corruption veins
  for (const [x, y0, y1] of [[-3, A.torsoY0, A.torsoY1], [2, A.torsoY0 + 2, A.torsoY1 - 1], [-1, A.torsoY1 - 3, A.torsoY1]]) for (let y = y0; y <= y1; y++) v.part(y >= A.torsoY0 + 4 ? 'chest' : 'spine').set(x + ((y >> 1) & 1), y, 4, VEIN, 1);
  // face: hollow eyes with a sickly glow, jagged mouth
  v.part('head').symBox(1, A.headY0 + 4, A.faceZ, 3, A.headY0 + 6, A.faceZ, P.DARK).symBox(2, A.headY0 + 5, A.faceZ, 2, A.headY0 + 5, A.faceZ, 0xc8ff40, 1)
    .box(-3, A.headY0 + 1, A.faceZ, 2, A.headY0 + 2, A.faceZ, P.DARK).set(-2, A.headY0 + 3, A.faceZ, P.DARK).set(1, A.headY0 + 3, A.faceZ, P.DARK).set(-1, A.headY0, A.faceZ, P.DARK)
    .symBox(1, A.headY0 + 7, A.faceZ, 4, A.headY0 + 7, A.faceZ + 1, BD);
  // crown of broken branches, sparse dying leaves and violet fungus
  v.part('hat');
  for (const [dx, dz, h, lean] of [[-4, 0, 7, -2], [3, -2, 9, 2], [0, 2, 5, 0], [-1, -3, 8, -1]]) taper(v, dx, A.headY1 + 1, dz, h, 1.4, 0.6, BD, { dx: lean });
  foliage(v, -6, A.headY1 + 7, 0, 3, P.MOSS_D, 0x6a8a3a); foliage(v, 5, A.headY1 + 9, -2, 3.5, P.MOSS_D, 0x6a8a3a); foliage(v, 0, A.headY1 + 5, 3, 2.5, 0x5a3a6a, 0x8a5aa8);
  // branch arms ending in twig claws
  for (const [s, sx] of [['handL', 1], ['handR', -1]] as Array<[string, number]>) { const x0 = sx > 0 ? A.chestW / 2 : -A.chestW / 2 - 4; v.part(s); for (let i = 0; i < 3; i++) v.box(x0 + i + (i > 0 ? 1 : 0) - (i > 1 ? 1 : 0), A.handY - 3, i - 1, x0 + i + (i > 0 ? 1 : 0) - (i > 1 ? 1 : 0), A.handY - 1, i - 1, BD); }
  v.part('shL').box(7, A.shoulderY - 1, -3, 11, A.shoulderY, 2, P.MOSS); v.part('shR').box(-12, A.shoulderY - 1, -2, -8, A.shoulderY, 1, P.MOSS_D);
  return v;
}

function banshee(): V {
  const v = newChar(), SK = 0x8ab4cc, DR = 0x5a6a9a, DRD = 0x3a4878, HAIR = 0xa8bcd8;
  const A = biped(v, { skin: SK, robe: { c: DR }, torso: DR, chest: DR, sleeve: DRD, fore_: SK, hands: SK, belt: null, legH: 9, hipH: 2, torsoH: 6, torsoW: 8, chestW: 8, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 2, upper: 5, fore: 5, hand: 2 });
  for (const c of [...v.cells.values()]) if (c.part === 'hips' || c.part === 'footL' || c.part === 'footR') v.set(c.x, c.y, c.z, null);
  ghostTail(v, A, 5, 4, DR, 0x7ad8ff, 5);
  v.paint(c => c.y < 2 ? 0x7ad8ff : c.y < 5 ? DRD : null, 'hips');
  for (const c of v.cells.values()) if (c.part === 'hips' && c.y < 2) c.g = 1;
  eyes(v, A, { y: 4, w: 2, h: 2, gap: 2, style: 'glow', glow: 0x6ae8ff });
  v.part('head').box(-2, A.headY0 + 1, A.faceZ, 1, A.headY0 + 2, A.faceZ, P.DARK).box(-1, A.headY0, A.faceZ, 0, A.headY0, A.faceZ, P.DARK).box(-1, A.headY0 + 1, A.faceZ, 0, A.headY0 + 2, A.faceZ, 0x2a4a6a);
  // long flowing hair down the back (cape bone so it streams)
  v.part('head').box(-5, A.headY0 + 2, -5, 4, A.headY1 + 1, -4, HAIR).symBox(4, A.headY0 - 2, -4, 4, A.headY1, 2, HAIR).box(-4, A.headY1 + 1, -4, 3, A.headY1 + 1, 3, HAIR);
  v.part('cape').box(-5, A.torsoY0 - 6, -5, 4, A.torsoY1 + 1, -4, HAIR).box(-4, A.torsoY0 - 9, -5, -2, A.torsoY0 - 7, -5, HAIR).box(1, A.torsoY0 - 8, -5, 3, A.torsoY0 - 7, -5, HAIR);
  // tattered sleeves
  for (const s of ['armL', 'armR']) v.part(s).box(s === 'armL' ? 4 : -7, A.shoulderY - 6, -1, s === 'armL' ? 6 : -5, A.shoulderY - 5, 1, DRD);
  return v;
}

function wolfSpirit(): V {
  const v = newChar(), F = 0x5e6e9e, FL = 0x9aaad0, FD = 0x3a4672, MOON = 0xc8ecff;
  v.bone('hips', 'root', 0, 10, -6).bone('chest', 'hips', 0, 10, 2).bone('neck', 'chest', 0, 13, 7).bone('head', 'neck', 0, 14, 9).bone('jaw', 'head', 0, 13, 13)
    .bone('legFL', 'chest', 3, 9, 5).bone('legFR', 'chest', -3, 9, 5).bone('legBL', 'hips', 3, 9, -8).bone('legBR', 'hips', -3, 9, -8).bone('tail', 'hips', 0, 12, -13).bone('tail2', 'tail', 0, 14, -18);
  v.part('hips'); rbox(v, -4, 7, -13, 3, 13, -2, F, 2);
  v.part('chest'); rbox(v, -5, 7, -2, 4, 15, 8, F, 2); v.box(-3, 7, 3, 2, 10, 8, FL);
  v.part('neck'); rbox(v, -3, 12, 6, 2, 17, 10, FL, 1);
  v.part('head'); rbox(v, -4, 13, 8, 3, 19, 14, F, 1); v.box(-2, 13, 15, 1, 16, 18, F).box(-2, 16, 18, 1, 16, 18, P.DARK).box(-2, 13, 15, 1, 13, 17, FL);
  v.sym(1, 17, 14, 0x9af0ff, 1).sym(2, 17, 14, P.DARK).symBox(2, 20, 9, 3, 23, 11, F).sym(2, 22, 10, FD).box(-1, 19, 14, 0, 19, 14, MOON, 1);
  v.part('jaw').box(-2, 12, 13, 1, 12, 17, FL).sym(1, 13, 17, P.WHITE);
  for (const [n, x, z] of [['legFL', 2, 4], ['legFR', -4, 4], ['legBL', 2, -9], ['legBR', -4, -9]] as Array<[string, number, number]>) { v.part(n).box(x, 1, z - 1, x + 2, 9, z + 1, F).box(x, 0, z - 1, x + 2, 0, z + 2, FD).box(x, 5, z - 1, x + 2, 5, z + 1, FL); }
  v.part('tail'); taper(v, -0.5, 11, -14, 1, 2, 2, F); v.box(-2, 11, -18, 1, 14, -14, F);
  v.part('tail2').box(-2, 13, -23, 1, 16, -19, FL).box(-1, 14, -24, 0, 16, -24, MOON, 1);
  // glowing moon markings along the back
  for (let z = -11; z <= 6; z += 3) v.part(z < -2 ? 'hips' : 'chest').set(-1, z < -2 ? 13 : 15, z, MOON, 1).set(0, z < -2 ? 13 : 15, z + 1, MOON, 1);
  speckle(v, F, FD, 0.12, 7);
  return v;
}

function boneReaver(): V {
  const v = newChar(), B = P.BONE, BD = P.BONE_D, RAG = 0x8a1a1a;
  const A = biped(v, { skin: B, legs: B, boots: P.IRON_DD, hips: BD, torso: P.DARK, chest: P.DARK, belt: P.LEATH_D, legW: 2, legD: 2, legGap: 2, legH: 8, hipH: 2, torsoH: 7, torsoW: 8, chestW: 10, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 2, upper: 4, fore: 4, hand: 2 });
  // ribcage: bone rings around a dark hollow, spine behind
  v.paint(c => (c.y - A.torsoY0) % 2 === 0 && c.y > A.torsoY0 + 1 ? B : null, 'chest');
  v.paint(c => (c.y - A.torsoY0) % 2 === 0 && c.y > A.torsoY0 + 1 ? B : null, 'spine');
  v.part('spine').box(-1, A.torsoY0, -3, 0, A.torsoY1, -3, BD);
  v.part('hips').box(-2, A.hipY - 4, 3, 1, A.hipY, 3, RAG).box(-3, A.hipY - 3, -4, 2, A.hipY, -4, RAG).set(-2, A.hipY - 5, 3, RAG);
  // skull: dark sockets with red embers, nose, teeth
  v.part('head').symBox(1, A.headY0 + 3, A.faceZ, 2, A.headY0 + 4, A.faceZ, P.DARK).sym(1, A.headY0 + 3, A.faceZ, 0xff3020, 1)
    .box(-1, A.headY0 + 2, A.faceZ, 0, A.headY0 + 2, A.faceZ, P.DARK);
  for (let x = -3; x <= 2; x++) v.set(x, A.headY0, A.faceZ, (x & 1) ? P.DARK : B);
  // horned iron helm
  v.part('hat'); rbox(v, -5, A.headY1 - 2, -5, 4, A.headY1 + 1, 4, P.IRON_DD, 1);
  v.box(-5, A.headY1 - 2, 4, 4, A.headY1 - 2, 4, P.IRON).box(-1, A.headY1 - 1, 4, 0, A.headY1 + 1, 4, P.IRON);
  for (const sx of [1, -1]) { for (let i = 0; i < 6; i++) v.set(sx > 0 ? 5 + Math.min(i, 3) : -6 - Math.min(i, 3), A.headY1 + i - 1, -1 - (i > 3 ? 1 : 0), i > 3 ? BD : B); }
  // spiked pauldron
  v.part('shR').box(-10, A.shoulderY - 1, -2, -6, A.shoulderY + 1, 1, P.IRON_D).set(-8, A.shoulderY + 2, -1, B).set(-8, A.shoulderY + 3, -1, BD).set(-10, A.shoulderY + 2, 0, B);
  // serrated bone cleaver
  sword(v, A, { len: 14, w: 3, blade: B, guard: P.IRON_DD, grip: P.LEATH_D });
  v.part('weapon'); for (let i = 0; i < 14; i += 3) v.set(A.wR[0], A.wR[1] + 2, A.wR[2] + 3 + i, BD);
  v.set(A.wR[0], A.wR[1] - 1, A.wR[2] + 10, P.BLOOD).set(A.wR[0], A.wR[1], A.wR[2] + 11, P.BLOOD);
  return v;
}

function poisonSprite(): V {
  const v = newChar(), LEAF = 0x4a8a2e, LEAF_D = 0x2e6020, CAP = 0x7a2a98, SPOT = 0xe0c8f0;
  v.bone('body', 'root', 0, 7, 0).bone('head', 'body', 0, 7, 0).bone('hat', 'head', 0, 13, 0).bone('armL', 'body', 5, 9, 0).bone('armR', 'body', -5, 9, 0).bone('tail', 'body', 0, 3, 0);
  v.part('head').ell(0, 9, 0, 5.2, 5, 5, LEAF);
  speckle(v, LEAF, LEAF_D, 0.25, 11, 'head');
  v.symBox(1, 9, 4, 2, 10, 4, P.DARK).sym(1, 10, 4, 0xffd040, 1).sym(2, 9, 4, 0xffd040, 1).box(-1, 7, 5, 0, 7, 5, 0x1a2a10);
  v.part('hat'); rowOct(v, 7, 7, 13, CAP); rowOct(v, 6, 6, 14, CAP); rowOct(v, 4, 4, 15, CAP); rowOct(v, 2, 2, 16, CAP);
  v.paint(c => ((c.x * 7 + c.z * 5 + c.y * 3) % 6 === 0) ? SPOT : null, 'hat'); v.part('hat').box(-5, 12, -5, 4, 12, 4, 0xe0c8f0);
  for (const [s, sx] of [['armL', 1], ['armR', -1]] as Array<[string, number]>) v.part(s).box(sx > 0 ? 5 : -7, 8, -1, sx > 0 ? 6 : -6, 9, 0, LEAF_D).set(sx > 0 ? 7 : -8, 8, 0, LEAF);
  // trailing poison mist
  v.part('tail'); for (const [x, y, z] of [[-1, 3, 0], [0, 3, -1], [-2, 2, 1], [1, 1, -1], [0, 0, 1], [2, 2, 0]]) v.set(x, y, z, (x + y) & 1 ? 0x6ad82a : P.POISON, (x + y) & 1 ? 0 : 1);
  return v;
}

function mossGolem(): V {
  const v = newChar(), S = 0x6a6c78, SD = 0x4a4c58;
  const A = biped(v, { skin: S, legs: S, hips: SD, torso: S, belt: null, legH: 7, legW: 5, legD: 6, legGap: 1, hipH: 3, torsoH: 11, torsoW: 16, chestW: 20, torsoD: 12, headW: 8, headH: 6, headD: 8, headZ: 3, armW: 6, upper: 5, fore: 6, hand: 5, round: 2 });
  // moss on everything facing up, cracks, an amber rune core
  v.paint(c => (!v.get(c.x, c.y + 1, c.z) && c.c === S) ? P.MOSS : null);
  v.paint(c => (!v.get(c.x, c.y + 1, c.z) && c.c === P.MOSS && ((c.x + c.z) & 3) === 0) ? P.MOSS_L : null);
  speckle(v, S, SD, 0.12, 4);
  v.part('chest').box(-1, A.torsoY1 - 4, 6, 0, A.torsoY1 - 3, 6, 0xffb040, 1).box(-3, A.torsoY1 - 5, 6, 2, A.torsoY1 - 5, 6, SD).box(-3, A.torsoY1 - 1, 6, 2, A.torsoY1 - 1, 6, SD);
  eyes(v, A, { y: 2, w: 2, h: 1, gap: 2, style: 'glow', glow: 0xffa030 });
  v.part('head').box(-4, A.headY0 + 3, A.faceZ, 3, A.headY0 + 3, A.faceZ + 1, SD);
  // vines hanging from the arms
  for (const [s, x] of [['armL', 12], ['armR', -13]] as Array<[string, number]>) v.part(s).box(x, A.shoulderY - 7, 3, x, A.shoulderY - 1, 3, P.MOSS_D);
  return v;
}

function wraithCultist(): V {
  const v = newChar(), R = 0x2a1a3a, RD = 0x1a1026, HAND = 0xa8a0b8;
  const A = biped(v, { skin: HAND, robe: { c: R }, torso: R, sleeve: R, fore_: RD, hands: HAND, belt: 0x5a3a7a, legH: 9, hipH: 2, torsoH: 7, torsoW: 8, chestW: 10, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 3, upper: 3, fore: 4, hand: 2 });
  for (const c of [...v.cells.values()]) if (c.part === 'hips' || c.part === 'footL' || c.part === 'footR') v.set(c.x, c.y, c.z, null);
  ghostTail(v, A, 6, 5, R, 0x6a3aa8, 3);
  for (const c of v.cells.values()) if (c.part === 'hips' && c.y < 3) c.g = 1;
  for (const [x, y] of [[-3, 5], [2, 6], [-1, 8], [3, 9]]) v.part('hips').set(x, y, 4, P.CURSE, 1);
  hoodShell(v, A, R, { extra: 1, peak: 3, dark: P.DARK });
  v.part('head').box(-4, A.headY0, A.faceZ, 3, A.headY1, A.faceZ, P.DARK);
  eyes(v, A, { y: 4, w: 2, h: 1, gap: 2, style: 'glow', glow: P.CURSE });
  // a cursed tome floating at the left hand
  v.part('offhand').box(A.wL[0] - 2, A.wL[1] - 1, 2, A.wL[0] + 2, A.wL[1] + 3, 3, 0x3a2418).box(A.wL[0] - 1, A.wL[1], 4, A.wL[0] + 1, A.wL[1] + 2, 4, P.CURSE, 1);
  return v;
}

function oldWillow(): V {
  const v = newChar(), BK = 0x7a5a3a, BD = 0x4e3622, W = 0x5e8e34, WD = 0x3e6a24;
  const A = biped(v, { skin: BK, robe: { c: 0x5a4a2a, flare: 2, trim: WD, hem: 0x3e3420 }, torso: 0x6a5434, sleeve: 0x5a4a2a, hands: BK, boots: BD, belt: WD, torsoW: 8, chestW: 10, torsoH: 7, torsoD: 6, headW: 8, headH: 9, headD: 8, headZ: 1, armW: 3, upper: 3, fore: 4, hand: 2 });
  v.paint(c => (c.x * 5 + c.y * 2) % 7 === 0 && c.c === BK ? BD : null);
  // wise squinting eyes under heavy bark brows, a long knobby nose
  eyes(v, A, { y: 4, w: 2, h: 1, gap: 2, style: 'glow', glow: 0xffd860 });
  v.part('head').symBox(1, A.headY0 + 5, A.faceZ, 3, A.headY0 + 5, A.faceZ + 1, BD).box(-1, A.headY0 + 2, A.faceZ + 1, 0, A.headY0 + 4, A.faceZ + 1, BK).box(-1, A.headY0 + 2, A.faceZ + 2, 0, A.headY0 + 2, A.faceZ + 2, BD);
  // drooping willow strands: crown, sides, a long beard
  v.part('hat'); rowOct(v, 6, 6, A.headY1 + 1, W); rowOct(v, 4, 4, A.headY1 + 2, WD);
  for (let x = -5; x <= 4; x += 2) for (const z of [-5, 4]) if (z < 0 || Math.abs(x + 0.5) > 3) v.box(x, A.headY0 - 6 + ((x * 3) & 3), z, x, A.headY1 + 1, z, ((x + z) & 2) ? W : WD);
  v.symBox(5, A.headY0 - 4, -4, 5, A.headY1, 3, W);
  v.part('jaw').box(-2, A.headY0 - 7, A.faceZ, 1, A.headY0 + 1, A.faceZ + 1, W).box(-1, A.headY0 - 9, A.faceZ, 0, A.headY0 - 8, A.faceZ, WD).box(-2, A.headY0 + 1, A.faceZ + 1, 1, A.headY0 + 1, A.faceZ + 1, BD);
  // gnarled staff with a glowing sap orb
  const top = staff(v, A, { len: 18, wood: BD, back: 8 });
  v.part('weapon').box(top[0], top[1], top[2] - 1, top[0], top[1] + 2, top[2] - 1, BD).box(top[0] - 1, top[1] - 1, top[2], top[0] + 1, top[1] + 1, top[2] + 2, 0xd8ff6a, 1).set(top[0], top[1] + 2, top[2] + 1, W);
  return v;
}

// ================================================================== chapter 1 — elites
function necromancer(): V {
  const v = newChar(), R = 0x1e4a34, RD = 0x12261c, SK = 0xb8c0b0;
  const A = biped(v, { skin: SK, robe: { c: R, flare: 3, trim: P.BONE_D, hem: RD }, torso: RD, chest: R, sleeve: R, fore_: RD, hands: SK, boots: P.DARK, belt: P.BONE_D, torsoW: 8, chestW: 10, torsoH: 8, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 3, upper: 3, fore: 4, hand: 2 });
  hoodShell(v, A, RD, { extra: 1 });
  eyes(v, A, { y: 4, w: 2, h: 1, gap: 2, style: 'glow', glow: P.SOUL, brow: 0x6a7068 });
  v.part('head').symBox(1, A.headY0 + 3, A.faceZ, 2, A.headY0 + 3, A.faceZ, 0x8a9488).box(-1, A.headY0 + 1, A.faceZ, 0, A.headY0 + 1, A.faceZ, 0x4a5048)
    .box(-5, A.headY0 - 3, -4, 4, A.headY0 + 2, -4, 0x1a1a20);
  // ram horns curling out of the hood
  for (const sx of [1, -1]) { const pts = [[5, 7, 0], [6, 8, 0], [7, 8, 1], [8, 7, 2], [8, 6, 3], [7, 5, 3], [6, 5, 2]]; for (const [x, y, z] of pts) v.part('head').box(sx > 0 ? x : -1 - x, A.headY0 + y, z - 1, sx > 0 ? x : -1 - x, A.headY0 + y, z, P.BONE_D); }
  // skull pauldrons
  for (const [s, x0] of [['shL', 5], ['shR', -9]] as Array<[string, number]>) { v.part(s); rbox(v, x0, A.shoulderY - 1, -2, x0 + 3, A.shoulderY + 2, 2, P.BONE, 1); v.box(x0 + 1, A.shoulderY, 2, x0 + 1, A.shoulderY, 2, P.DARK).box(x0 + 2, A.shoulderY, 2, x0 + 2, A.shoulderY, 2, P.DARK); }
  v.part('chest').box(-1, A.torsoY0 + 3, 3, 0, A.torsoY1, 3, P.BONE_D);
  // ram-skull staff with a green flame
  const top = staff(v, A, { len: 20, wood: 0x2a2a30, back: 8 });
  v.part('weapon'); rbox(v, top[0] - 2, top[1] - 1, top[2] - 1, top[0] + 2, top[1] + 2, top[2] + 2, P.BONE, 1);
  v.box(top[0] - 1, top[1] + 1, top[2] + 2, top[0] + 1, top[1] + 1, top[2] + 2, P.DARK).box(top[0] - 1, top[1] + 3, top[2], top[0] + 1, top[1] + 5, top[2] + 1, P.SOUL, 1).set(top[0], top[1] + 6, top[2], P.SOUL, 1);
  return v;
}

function werewolf(): V {
  const v = newChar(), F = 0x5a4840, FD = 0x3a2e2a, FL = 0xb09878, PANTS = 0x3a3a4a;
  const A = biped(v, { skin: F, legs: PANTS, boots: FD, hips: PANTS, torso: F, chest: F, belt: P.LEATH_D, legH: 9, legW: 4, legD: 5, legGap: 1, hipH: 2, torsoH: 9, torsoW: 12, chestW: 16, torsoD: 10, headW: 8, headH: 7, headD: 8, headZ: 3, armW: 4, upper: 5, fore: 5, hand: 3 });
  v.part('chest').box(-4, A.torsoY0 + 3, 5, 3, A.torsoY1 - 1, 5, FL); v.part('spine').box(-3, A.torsoY0, 5, 2, A.torsoY0 + 3, 5, FL);
  // shaggy mane over the shoulders
  v.part('chest'); for (let x = -8; x <= 7; x++) for (let z = -5; z <= 3; z++) if ((x * 7 + z * 3) % 3 !== 0) v.set(x, A.torsoY1 + 1, z, x % 2 ? F : FD);
  // snout, fangs, glowing eyes, tall ears, a scar
  v.part('head').box(-2, A.headY0, A.faceZ + 1, 1, A.headY0 + 3, A.faceZ + 4, F).box(-2, A.headY0 + 3, A.faceZ + 4, 1, A.headY0 + 3, A.faceZ + 4, P.DARK)
    .box(-2, A.headY0, A.faceZ + 1, 1, A.headY0, A.faceZ + 4, FL).sym(1, A.headY0, A.faceZ + 4, P.WHITE).sym(1, A.headY0 - 1, A.faceZ + 4, P.WHITE);
  eyes(v, A, { y: 4, w: 2, h: 1, gap: 2, style: 'glow', glow: 0xffd040, brow: FD });
  v.part('head').set(2, A.headY0 + 3, A.faceZ, 0xb06a5a).set(2, A.headY0 + 5, A.faceZ, 0xb06a5a).set(3, A.headY0 + 6, A.faceZ, 0xb06a5a);
  v.part('hat').symBox(2, A.headY1 + 1, 0, 3, A.headY1 + 3, 1, F).sym(3, A.headY1 + 4, 0, FD).sym(2, A.headY1 + 1, 1, 0x8a5a5a);
  v.part('jaw').box(-2, A.headY0 - 1, A.faceZ + 1, 1, A.headY0 - 1, A.faceZ + 3, FD).sym(1, A.headY0 - 1, A.faceZ + 4, P.WHITE);
  // torn trousers: fur at the shins, spiked collar
  v.paint(c => c.y < 5 && c.c === PANTS ? F : null);
  v.part('chest').box(-4, A.torsoY1, -3, 3, A.torsoY1, 4, P.IRON_DD).sym(3, A.torsoY1 + 1, 4, P.IRON).sym(1, A.torsoY1 + 1, 5, P.IRON);
  claws(v, A, 1, P.WHITE, 3, 2); claws(v, A, -1, P.WHITE, 3, 2);
  v.bone('tail', 'hips', 0, A.hipY + 1, -5); v.part('tail').box(-1, A.hipY - 3, -9, 0, A.hipY + 1, -6, F).box(-1, A.hipY - 5, -10, 0, A.hipY - 3, -10, FD);
  return v;
}

function phantomHunter(): V {
  const v = newChar(), C = 0x1e4a5a, CD = 0x12303c, SK = 0x9ac0c8, GH = 0x7af0ff;
  const A = biped(v, { skin: SK, legs: 0x22303a, boots: 0x16202a, hips: CD, torso: 0x2a3a44, chest: 0x2a3a44, belt: P.LEATH_D, sleeve: CD, fore_: 0x2a3a44, hands: 0x22303a, torsoW: 8, chestW: 10, torsoH: 7, torsoD: 6, headW: 8, headH: 8, headD: 8, armW: 3, upper: 3, fore: 4, hand: 2 });
  hoodShell(v, A, C, { extra: 1, peak: 3 });
  v.part('head').box(-4, A.headY0, A.faceZ, 3, A.headY0 + 2, A.faceZ, 0x16202a);
  eyes(v, A, { y: 3, w: 2, h: 1, gap: 2, style: 'glow', glow: GH });
  // long tattered cloak that dissolves into spectral wisps
  v.part('cape').box(-5, 2, -4, 4, A.torsoY1, -4, C);
  v.paint(c => (c.y < 3 && ((c.x * 3 + c.y) & 3) === 0) ? GH : (c.y < 6 ? CD : null), 'cape');
  for (const c of v.cells.values()) if (c.part === 'cape' && c.c === GH) c.g = 1;
  v.part('chest').box(-5, A.torsoY1, -3, 4, A.torsoY1 + 1, 2, C);
  // quiver of glowing arrows on the back
  v.part('chest').box(2, A.torsoY0 + 1, -5, 4, A.torsoY1 + 2, -4, P.LEATH_D).box(2, A.torsoY1 + 3, -5, 4, A.torsoY1 + 4, -5, GH, 1);
  // longbow in the left hand (built along z; the pose holds it upright)
  v.part('offhand'); const [bx, by] = A.wL;
  for (let z = -11; z <= 11; z++) { const bow = Math.round(3 * (1 - (z / 11) ** 2)); v.set(bx, by + bow, z, Math.abs(z) < 2 ? P.LEATH_D : 0x4a6a74); }
  v.box(bx, by, -11, bx, by, 11, 0xd8f8ff, 0); for (let z = -10; z <= 10; z++) if (Math.abs(z) > 1) v.set(bx, by, z, null);
  for (let z = -10; z <= 10; z += 1) v.set(bx, by - 1 + (Math.abs(z) > 9 ? 1 : 0), z, Math.abs(z) > 9 ? 0x4a6a74 : 0xa8c8d0);
  return v;
}

// ================================================================== chapter 1 — bosses
function lich(): V {
  const v = newChar(), R = 0x5a2488, RD = 0x36145c, RDD = 0x220c3a, MET = 0x3a3448, SOUL = 0x5affa0;
  const A = biped(v, { skin: P.BONE, robe: { c: R, flare: 4, trim: P.GOLD, hem: RD }, torso: R, chest: R, sleeve: R, fore_: R, hands: P.BONE, boots: RDD, belt: P.GOLD_D, legH: 12, hipH: 3, torsoH: 9, torsoW: 12, chestW: 14, torsoD: 8, headW: 10, headH: 10, headD: 10, armW: 4, upper: 4, fore: 5, hand: 3 });
  for (const c of [...v.cells.values()]) if (c.part === 'footL' || c.part === 'footR') v.set(c.x, c.y, c.z, null);
  v.paint(c => c.y < 2 && ((c.x * 7 + c.z * 3) & 3) === 0 ? null : null, 'hips');
  v.part('hips').paint(c => (c.x === -1 || c.x === 0) && c.z >= 3 && c.y > 3 ? P.GOLD_D : null, 'hips');
  // ribcage behind an open collar, tall spiked collar
  v.part('chest').box(-3, A.torsoY0 + 5, 3, 2, A.torsoY1 - 1, 3, P.DARK);
  for (let y = A.torsoY0 + 5; y <= A.torsoY1 - 1; y += 2) v.box(-3, y, 3, 2, y, 3, P.BONE);
  v.box(-1, A.torsoY0 + 5, 3, 0, A.torsoY1 - 1, 3, P.BONE_D).box(-1, A.torsoY1, 4, 0, A.torsoY1, 4, P.GOLD);
  v.box(-7, A.torsoY1 - 1, -5, 6, A.torsoY1 + 4, -5, RD).box(-8, A.torsoY1 - 1, -5, -8, A.torsoY1 + 3, 0, RD).box(7, A.torsoY1 - 1, -5, 7, A.torsoY1 + 3, 0, RD);
  for (const x of [-8, -5, -2, 1, 4, 7]) v.set(x, A.torsoY1 + 5, -5, RDD).set(x, A.torsoY1 + 6, -5, RDD);
  // spiked pauldrons, flared sleeves
  for (const [s, x0] of [['shL', 7], ['shR', -12]] as Array<[string, number]>) { v.part(s).box(x0, A.shoulderY - 2, -3, x0 + 4, A.shoulderY + 1, 2, MET).box(x0, A.shoulderY - 2, -3, x0 + 4, A.shoulderY - 2, 2, P.GOLD_D); for (let i = 0; i < 3; i++) v.set(x0 + 1 + i, A.shoulderY + 2 + (i & 1), -1, P.BONE).set(x0 + 1 + i, A.shoulderY + 3 + (i & 1), -1, P.BONE_D); }
  for (const [s, x0] of [['foreL', 7], ['foreR', -12]] as Array<[string, number]>) v.part(s).box(x0 - (x0 > 0 ? 0 : 1), A.handY + 3, -3, x0 + 4 + (x0 > 0 ? 1 : 0), A.handY + 4, 2, RD).box(x0 - (x0 > 0 ? 0 : 1), A.handY + 3, -3, x0 + 4 + (x0 > 0 ? 1 : 0), A.handY + 3, 2, P.GOLD_D);
  claws(v, A, 1, P.BONE_D, 4, 2); claws(v, A, -1, P.BONE_D, 4, 2);
  // hood, skull with two soul-fire eyes, crown
  hoodShell(v, A, RD, { extra: 1 });
  v.part('head').symBox(1, A.headY0 + 4, A.faceZ, 3, A.headY0 + 6, A.faceZ, P.DARK).symBox(1, A.headY0 + 4, A.faceZ, 2, A.headY0 + 5, A.faceZ, SOUL, 1)
    .box(-1, A.headY0 + 2, A.faceZ, 0, A.headY0 + 3, A.faceZ, P.DARK).symBox(1, A.headY0 + 7, A.faceZ, 4, A.headY0 + 7, A.faceZ, P.BONE_D).sym(4, A.headY0 + 3, A.faceZ, P.BONE_D);
  for (let x = -4; x <= 3; x++) v.set(x, A.headY0 + 1, A.faceZ, (x & 1) ? P.DARK : P.BONE);
  v.part('jaw').box(-3, A.headY0 - 2, A.faceZ - 3, 2, A.headY0, A.faceZ, P.BONE); for (let x = -3; x <= 2; x++) v.set(x, A.headY0, A.faceZ, (x & 1) ? P.DARK : P.BONE);
  v.part('hat'); rowOct(v, 6, 6, A.headY1 + 2, P.GOLD); rowOct(v, 5, 5, A.headY1 + 2, null as unknown as Col);
  for (const [x, z, h] of [[-6, 0, 3], [5, 0, 3], [-4, 4, 2], [3, 4, 2], [-1, 5, 4], [0, 5, 4], [-4, -4, 2], [3, -4, 2]]) v.box(x, A.headY1 + 3, z, x, A.headY1 + 2 + h, z, P.GOLD);
  v.box(-1, A.headY1 + 3, 6, 0, A.headY1 + 4, 6, SOUL, 1);
  // staff with a bone cage around the soul gem
  const top = staff(v, A, { len: 26, wood: P.WOOD_D, back: 10 });
  v.part('weapon').box(top[0] - 2, top[1] - 2, top[2], top[0] + 2, top[1] + 2, top[2] + 4, SOUL, 1).box(top[0] - 1, top[1] - 1, top[2] + 1, top[0] + 1, top[1] + 1, top[2] + 3, 0xd8ffe8, 1);
  for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) v.box(top[0] + dx, top[1] + dy, top[2] - 1, top[0] + dx, top[1] + dy, top[2] + 6, P.BONE);
  v.box(top[0] - 3, top[1] - 3, top[2] + 6, top[0] + 3, top[1] + 3, top[2] + 6, P.BONE_D).box(top[0] - 2, top[1] - 2, top[2] + 6, top[0] + 2, top[1] + 2, top[2] + 6, null);
  return v;
}

function rootColossus(): V {
  const v = newChar(), R = 0x6a4a30, RD = 0x3e2a1a, RL = 0x9a7048, S = P.STONE;
  const A = biped(v, { skin: R, legs: R, hips: RD, torso: R, belt: null, legH: 14, legW: 7, legD: 8, legGap: 2, hipH: 4, torsoH: 16, torsoW: 22, chestW: 28, torsoD: 16, headW: 10, headH: 8, headD: 10, headZ: 4, armW: 8, upper: 9, fore: 9, hand: 7, round: 2 });
  // twisted roots: diagonal bands, stone plates on the chest and shoulders, a glowing amber heart
  // root strands: vertical bands that wander a little with height, a few lighter fibres
  v.paint(c => c.c !== R ? null : (((c.x + c.z * 2 + Math.floor(c.y / 6)) % 4 + 4) % 4 === 0 ? RD : (((c.x * 3 + c.z + Math.floor(c.y / 9)) % 11 + 11) % 11 === 0 ? RL : null)));
  v.part('chest'); rbox(v, -9, A.torsoY0 + 9, 7, 8, A.torsoY1, 8, S, 2); v.box(-3, A.torsoY0 + 10, 9, 2, A.torsoY0 + 14, 9, P.DARK).box(-2, A.torsoY0 + 11, 9, 1, A.torsoY0 + 13, 9, 0xffb040, 1);
  for (const [s, x0] of [['shL', 14], ['shR', -22]] as Array<[string, number]>) { v.part(s); rbox(v, x0, A.shoulderY - 2, -6, x0 + 7, A.shoulderY + 2, 5, S, 2); speckle(v, S, P.STONE_D, 0.2, 9, s); }
  v.paint(c => (!v.get(c.x, c.y + 1, c.z) && (c.c === S || c.c === R)) ? P.MOSS : null);
  // small sunken head with ember eyes and a root beard
  eyes(v, A, { y: 3, w: 2, h: 1, gap: 2, style: 'glow', glow: 0xffa030 });
  v.part('head').box(-5, A.headY0 + 4, A.faceZ, 4, A.headY0 + 4, A.faceZ + 1, RD);
  v.part('jaw'); for (const x of [-4, -2, 1, 3]) v.box(x, A.headY0 - 4 - (x & 1), A.faceZ, x, A.headY0, A.faceZ, RD);
  // a crown of roots and two mushrooms
  v.part('hat'); for (const [x, z, h] of [[-4, 0, 5], [3, -2, 6], [0, 3, 3], [-2, -4, 4]]) taper(v, x, A.headY1 + 1, z, h, 1, 0.5, RD);
  v.ell(-12, A.shoulderY + 4, 0, 2, 1, 2, 0xd85a3a).ell(13, A.shoulderY + 4, -1, 1.6, 1, 1.6, 0xe8c8a0);
  // root tendrils dragging from the fists
  for (const [s, x0] of [['handL', 15], ['handR', -23]] as Array<[string, number]>) { v.part(s); for (let i = 0; i < 4; i++) v.box(x0 + i * 2, A.handY - 3 - (i & 1) * 2, -1 + (i & 1) * 2, x0 + i * 2, A.handY - 1, -1 + (i & 1) * 2, RD); }
  return v;
}

function covenMatriarch(): V {
  const v = newChar(), SK = 0x8aa08a, D = 0x3a1a4a, DD = 0x22102e, HAIR = 0xb8b8c0, HAT = 0x2a1a34;
  const A = biped(v, { skin: SK, robe: { c: D, flare: 4, trim: 0x5a8a3a, hem: DD }, torso: D, chest: D, sleeve: DD, fore_: D, hands: SK, belt: 0x5a8a3a, legH: 12, hipH: 2, torsoH: 10, torsoW: 10, chestW: 10, torsoD: 6, headW: 8, headH: 9, headD: 8, armW: 3, upper: 4, fore: 5, hand: 2 });
  // face: glowing violet eyes, hooked nose, wicked grin, long grey hair
  eyes(v, A, { y: 4, w: 2, h: 1, gap: 2, style: 'glow', glow: P.CURSE, brow: 0x4a4a52 });
  v.part('head').box(-1, A.headY0 + 2, A.faceZ + 1, 0, A.headY0 + 4, A.faceZ + 1, SK).box(-1, A.headY0 + 1, A.faceZ + 2, 0, A.headY0 + 2, A.faceZ + 2, 0x6a806a)
    .box(-3, A.headY0 + 1, A.faceZ, 2, A.headY0 + 1, A.faceZ, P.DARK).sym(3, A.headY0 + 2, A.faceZ, P.DARK).sym(1, A.headY0 + 1, A.faceZ, 0xd8d0b0)
    .box(-5, A.headY0 - 6, -5, 4, A.headY1, -4, HAIR).symBox(4, A.headY0 - 5, -4, 4, A.headY1, 2, HAIR);
  // crooked witch hat with a web and a little spider
  v.part('hat'); rowOct(v, 10, 10, A.headY1 + 1, HAT);
  for (let i = 0; i < 12; i++) { const r = Math.max(0.6, 5 - i * 0.4); taper(v, -0.5 + (i > 7 ? (i - 7) : 0), A.headY1 + 2 + i, -0.5 - (i > 5 ? (i - 5) * 0.6 : 0), 1, r, r, i === 1 ? 0x5a8a3a : HAT); }
  for (let k = -9; k <= 9; k++) v.set(k, A.headY1 + 1, 0, 0xc8c8d0).set(0, A.headY1 + 1, k, 0xc8c8d0);
  v.box(5, A.headY1 + 2, 4, 6, A.headY1 + 3, 5, P.DARK).set(5, A.headY1 + 3, 6, 0xff2a2a, 1);
  // six spider legs from her back
  for (let i = 0; i < 3; i++) for (const sx of [1, -1]) {
    const n = `sp${sx > 0 ? 'L' : 'R'}${i}`, y0 = A.torsoY1 - 1 - i * 3; v.bone(n, 'chest', sx * 3, y0, -3); v.part(n);
    for (let k = 0; k < 8; k++) v.set(sx * (3 + k), y0 + Math.round(4 * Math.sin((k / 7) * Math.PI)) + (k > 5 ? -(k - 5) * 2 : 0), -4 - Math.floor(k / 2) + i, k === 4 ? 0x6a3a8a : DD);
  }
  // crooked staff with a glowing egg sac
  const top = staff(v, A, { len: 22, wood: 0x3a2a24, back: 8 });
  v.part('weapon').set(top[0], top[1] + 1, top[2] - 1, 0x3a2a24).ell(top[0] + 0.5, top[1] + 0.5, top[2] + 2.5, 2.4, 2.4, 2.6, P.POISON, 1);
  return v;
}

function treeKing(): V {
  const v = newChar(), BK = 0x5e4430, BD = 0x3a2a1c, BL = 0x86643e, MOSS = P.MOSS, LEAF = 0x2e6a2a, LEAF_L = 0x6aa83a, GOLDL = 0xe8b830;
  const A = biped(v, { skin: BK, legs: BD, hips: BK, torso: BK, belt: null, legH: 16, legW: 8, legD: 10, legGap: 2, hipH: 5, torsoH: 20, torsoW: 26, chestW: 30, torsoD: 20, headW: 16, headH: 14, headD: 14, headZ: 3, armW: 8, upper: 11, fore: 11, hand: 8, round: 3 });
  // bark grain, glowing golden runes
  v.paint(c => ((c.x * 2 + c.z + Math.floor(c.y / 4)) % 5 + 5) % 5 === 0 && c.c === BK ? BD : ((c.x + c.z * 3) % 9 + 9) % 9 === 0 && c.c === BK ? BL : null);
  for (const [x, y] of [[-8, 4], [-7, 6], [-8, 8], [6, 10], [7, 12], [6, 14], [-2, 16], [1, 17]]) v.part(y > 10 ? 'chest' : 'spine').set(x, A.torsoY0 + y, A.torsoD / 2 - 1, GOLDL, 1);
  // a carved face: deep brows, great green eyes, a hollow mouth, a mossy beard
  v.part('head').symBox(2, A.headY0 + 7, A.faceZ, 5, A.headY0 + 9, A.faceZ, P.DARK).symBox(2, A.headY0 + 7, A.faceZ, 4, A.headY0 + 8, A.faceZ, 0x7aff6a, 1)
    .symBox(1, A.headY0 + 10, A.faceZ, 7, A.headY0 + 11, A.faceZ + 2, BD).box(-1, A.headY0 + 5, A.faceZ + 1, 0, A.headY0 + 8, A.faceZ + 2, BK)
    .box(-4, A.headY0 + 2, A.faceZ, 3, A.headY0 + 3, A.faceZ, P.DARK);
  v.part('jaw'); for (let x = -7; x <= 6; x++) v.box(x, A.headY0 - 6 + ((x * 5) & 3), A.faceZ - 1, x, A.headY0 + 1, A.faceZ, (x & 1) ? MOSS : P.MOSS_D);
  // the canopy crown: branches carrying great leaf clusters with golden leaves
  v.part('hat');
  for (const [dx, dz, h, lean] of [[-6, 0, 8, -6], [5, -2, 10, 6], [0, 2, 12, 0], [-2, -5, 9, -2], [4, 4, 7, 3]]) taper(v, dx, A.headY1 + 1, dz, h, 2, 1, BD, { dx: lean });
  for (const [x, y, z, r] of [[-13, 9, 0, 6], [12, 11, -2, 6.5], [0, 14, 1, 7], [-4, 10, -7, 5], [6, 8, 6, 5], [-7, 7, 7, 4.5]]) foliage(v, x, A.headY1 + y, z, r, LEAF, LEAF_L);
  speckle(v, LEAF_L, GOLDL, 0.15, 13, 'hat'); speckle(v, LEAF, 0x245a22, 0.2, 17, 'hat');
  // branch hands with long twig fingers; moss on the shoulders
  for (const [s, x0] of [['handL', 15], ['handR', -23]] as Array<[string, number]>) { v.part(s); for (let i = 0; i < 4; i++) v.box(x0 + i * 2 + 1, A.handY - 5 + (i === 0 || i === 3 ? 2 : 0), -2 + i, x0 + i * 2 + 1, A.handY - 1, -2 + i, BD); }
  v.paint(c => (!v.get(c.x, c.y + 1, c.z) && c.c !== LEAF && c.c !== LEAF_L && c.c !== GOLDL && c.y < A.headY1 && (c.part === 'shL' || c.part === 'shR' || c.part === 'chest' || c.part === 'armL' || c.part === 'armR')) ? MOSS : null);
  return v;
}

export const ROSTER: ModelDef[] = [
  { id: 'warrior', name: '嗜血狂战', group: '职业', role: '铁血征服者', line: '以血换伤，一击致命。嗜血越多，越凶。', kind: 'biped', attack: 'swing', build: warrior },
  { id: 'mage', name: '星界魔导', group: '职业', role: '星界禁咒师', line: '耐心吟唱2-3回合，攒齐完美手牌一波超载。', kind: 'biped', attack: 'cast', build: mage },
  { id: 'rogue', name: '影锋刺客', group: '职业', role: '暗影连击者', line: '一回合出牌2次，连击层层加成。', kind: 'biped', attack: 'dual', build: rogue },
  { id: 'forest_ghoul', name: '食尸鬼', group: '普通', role: '战士型', line: '嘎嘎……新鲜的肉……', kind: 'biped', attack: 'claw', build: ghoul },
  { id: 'forest_spider', name: '剧毒蛛母', group: '普通', role: '游侠型', line: '嘶嘶……陷阱已经布好了……', kind: 'spider', attack: 'strike', build: spider },
  { id: 'forest_treant', name: '腐化树人', group: '普通', role: '守护型', line: '这片……森林……不欢迎你……', kind: 'biped', attack: 'slam', build: treant },
  { id: 'forest_banshee', name: '哀嚎女妖', group: '普通', role: '施法型', line: '听到了吗……死亡的歌声……', kind: 'ghost', attack: 'cast', build: banshee, hover: 0.35 },
  { id: 'forest_wolf_priest', name: '月光狼灵', group: '普通', role: '祭司型', line: '呜——月光指引着我……', kind: 'quad', attack: 'bite', build: wolfSpirit, glow: 1.5 },
  { id: 'forest_bone_reaver', name: '骸骨狂战', group: '普通', role: '战士型', line: '骨刃——饥渴已久！', kind: 'biped', attack: 'swing', build: boneReaver },
  { id: 'forest_poison_sprite', name: '毒雾林精', group: '普通', role: '游侠型', line: '吸一口……就够了。', kind: 'sprite', attack: 'cast', build: poisonSprite, hover: 0.5, glow: 1.3 },
  { id: 'forest_moss_golem', name: '苔岩泥像', group: '普通', role: '守护型', line: '土……吞噬入侵者。', kind: 'biped', attack: 'slam', build: mossGolem },
  { id: 'forest_wraith_cultist', name: '幽冥诅祝', group: '普通', role: '施法型', line: '诅咒……降临！', kind: 'ghost', attack: 'cast', build: wraithCultist, hover: 0.3 },
  { id: 'forest_old_willow', name: '老槐祭司', group: '普通', role: '祭司型', line: '孩儿们，饮下我的树液……', kind: 'biped', attack: 'cast', build: oldWillow },
  { id: 'elite_necromancer', name: '亡灵巫师', group: '精英', role: '施法型', line: '死者……听从我的召唤！', kind: 'biped', attack: 'cast', build: necromancer },
  { id: 'elite_alpha_wolf', name: '狼人首领', group: '精英', role: '战士型', line: '月光之下……狼群为王！', kind: 'biped', attack: 'claw', build: werewolf },
  { id: 'elite_phantom_hunter', name: '魅影猎手', group: '精英', role: '游侠型', line: '你进入了我的猎场。', kind: 'biped', attack: 'shoot', build: phantomHunter, bowL: true },
  { id: 'boss_lich_forest', name: '枯骨巫妖', group: '首领', role: '施法型', line: '千年的死寂，被你这小小的活人惊扰了……不可饶恕。', kind: 'robe', attack: 'cast', build: lich, hover: 0.4, self: 0.15 },
  { id: 'boss_root_colossus', name: '根须巨像', group: '首领', role: '守护型', line: '森林把你交给了我——这片土地上，每一块石头都记得我的名字。', kind: 'biped', attack: 'slam', build: rootColossus },
  { id: 'boss_coven_matriarch', name: '魇森巫母', group: '首领', role: '施法型', line: '我养育了这片森林里所有的毒草，也养育了每一个诅咒。', kind: 'biped', attack: 'cast', build: covenMatriarch },
  { id: 'boss_ancient_treant', name: '远古树王', group: '首领', role: '守护型 · 终章首领', line: '这片森林从我萌芽的那一刻起，就吞噬了无数像你这样的来客。', kind: 'biped', attack: 'slam', build: treeKing },
];
