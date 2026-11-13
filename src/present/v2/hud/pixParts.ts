// R6 高清像素按钮件（UX_V3 §5b / §6b）：八角石钮 = 挤出的像素画。每格 = 1 美术像素；厚度 ≥ 宽的 40%（侧面上段是边框色往暗两档、
// 下段是深色石身），正面外沿两级 1 格倒角台阶（最外圈 1u 深色描边、再一圈带 1u 高光 / 暗边），金属边框 3 格，内沿 1u 暗线，石面下凹
// 1 格。另有：阶梯发光圈（2～3 圈，不用柔光）、接触投影、像素小灯、各种挤出的像素记号（重投双箭头、四角星、沙漏、吟唱弧）。
import * as THREE from 'three';
import { buildPix, pixFlat, type PixModel, type PCell } from '../../ui3d/pixMesh';
import { PAL, ramp } from '../../ui3d/pixelGrid';
import { cutDist, cutMask } from '../../ui3d/pixDraw';

export const G_RIM = 0, G_FACE = 1, G_BODY = 2, G_INK = 3;
export const octCut = (W: number, H: number) => Math.round(Math.min(W, H) * 0.29);

export interface OctPix { model: PixModel; W: number; H: number; D: number; cut: number }
/** 八角石钮：W×H 格，厚 D 格（默认 0.42W）。组：0 边框、1 石面、2 石身、3 描边 */
export function octPlatePix(W: number, H: number, o: { D?: number; rim?: number[]; face?: number[]; body?: number[]; rimW?: number } = {}): OctPix {
  const D = o.D ?? Math.max(6, Math.round(W * 0.42)), cut = octCut(W, H), dist = cutDist(W, H, cut), rw = o.rimW ?? (W >= 40 ? 4 : 3);
  // light from the top left: a ring cell is lit when its outward direction points up / left
  const lit = (x: number, y: number) => { const a = Math.min(x, W - 1 - x), b = Math.min(y, H - 1 - y), left = x < W / 2, top = y < H / 2; return a <= b ? left : top; };
  const at = (x: number, y: number): PCell | null => {
    const d = dist(x, y); if (d < 0) return null;
    if (d === 0) return { g: G_INK, t: 1, h: D - 2 };
    if (d === 1) return { g: G_RIM, t: lit(x, y) ? 0 : 2, h: D - 1 };
    if (d <= rw) return { g: G_RIM, t: d === 2 && lit(x, y) ? 0 : 1, h: D };
    if (d === rw + 1) return { g: G_INK, t: 1, h: D - 1 };
    if (d === rw + 2) return { g: G_FACE, t: lit(x, y) ? 3 : 0, h: D - 2 };   // inset panel: shadowed top-left inner edge, lit bottom-right
    return { g: G_FACE, t: 1, h: D - 2 };
  };
  const gold = Math.max(2, Math.round(D * 0.38));
  const model = buildPix(W, H, at, [o.rim ?? PAL.gold, o.face ?? PAL.face, o.body ?? PAL.stoneDark, [0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710]], {
    bands: [D - 2 - gold], back: { g: G_BODY, t: 3 },
    // the outer wall: the rim colour two tones down on top, the dark stone body below (a gold-trimmed thick slab)
    side: (c, _x, _y, dir, z0) => (c.g === G_INK && c.h === D - 2 ? (z0 >= D - 2 - gold ? { g: G_RIM, t: dir === 2 ? 2 : dir === 3 ? 4 : 3 } : { g: G_BODY, t: dir === 2 ? 1 : dir === 3 ? 3 : 2 }) : null),
  });
  return { model, W, H, D, cut };
}

/** 阶梯发光圈：八角外扩 gap 格起、rings 圈、每圈 w 格，强度逐圈递减（2～3 圈阶梯光，不用柔光晕） */
export function stepGlow(W: number, H: number, o: { gap?: number; rings?: number; w?: number; col?: number; k?: number } = {}) {
  const gap = o.gap ?? 1, rings = o.rings ?? 3, w = o.w ?? 1, pad = gap + rings * w, W2 = W + pad * 2, H2 = H + pad * 2, cut = octCut(W, H) + pad;
  const dist = cutDist(W2, H2, cut), lv = [1, 0.55, 0.25, 0.12];
  const m = pixFlat(W2, H2, (x, y) => { const d = dist(x, y); if (d < 0 || d >= rings * w) return null; return lv[rings - 1 - Math.floor(d / w)] ?? 0.1; });
  (m.material as THREE.MeshBasicMaterial).color.set(o.col ?? 0xffc040).multiplyScalar(o.k ?? 1.6);
  return m;
}
/** 接触投影：同形状的暗色平面，往右下错开 */
export function contactShadow(W: number, H: number, alpha = 0.5) {
  const cut = octCut(W, H), m = pixFlat(W + 2, H + 2, (x, y) => (cutMask(W + 2, H + 2, cut + 1)(x, y) ? 1 : null), { additive: false, color: 0x000000, opacity: alpha });
  return m;
}

/** 一排像素小灯：n 颗 s×s 格方灯嵌在深色灯条里；返回模型（组 0 灯条、组 1..n 各灯，方便单独亮灭） */
export function lampRow(n: number, s = 3, gapC = 1) {
  const W = n * s + (n + 1) * gapC + 2, H = s + 2 * gapC + 2;
  const pals = [ramp(0x1a1622, { hi: 0x2c2838 }), ...Array.from({ length: n }, () => PAL.cyan)];
  const at = (x: number, y: number): PCell | null => {
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return (x === 0 || x === W - 1) && (y === 0 || y === H - 1) ? null : { g: 0, t: 3, h: 3 };
    const lx = x - 1 - gapC, ly = y - 1 - gapC;
    if (ly >= 0 && ly < s && lx >= 0) { const i = Math.floor(lx / (s + gapC)), r = lx % (s + gapC); if (i < n && r < s) return { g: 1 + i, t: r === 0 && ly === 0 ? 0 : 1, h: 4 }; }
    return { g: 0, t: 1, h: 3 };
  };
  return buildPix(W, H, at, pals);
}

/** 从字符行挤出像素记号：pal 把字符映射到 [色组, 色阶]；depth = 厚度（格），edge = 外圈台阶（1 = 最外圈低 1 格） */
export function reliefPix(rows: string[], pals: number[][], map: Record<string, [number, number]>, depth = 3, edge = 1) {
  const H = rows.length, W = rows[0].length, on = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && rows[y][x] !== '.' && !!map[rows[y][x]];
  return buildPix(W, H, (x, y) => {
    if (!on(x, y)) return null; const [g, t] = map[rows[y][x]];
    const rim = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
    return { g, t, h: rim ? depth - edge : depth };
  }, pals);
}

// ---------------------------------------------------------------- marks (rows: top row first)
/** 重投记号：两段沿八角环追逐的箭头（只走横竖和 45°） */
export const REROLL_ROWS = [
  '.......####.....',
  '.....##oooo##...',
  '....#oo####oo#..',
  '...#o##....##o#.',
  '..#o#........#..',
  '.#o#...........',
  '.#o#.....#####..',
  '#o#......#ooo#..',
  '..#ooo#......#o#',
  '..#####.....#o#.',
  '...........#o#..',
  '..#........#o#..',
  '.#o##....##o#...',
  '..#oo####oo#....',
  '...##oooo##.....',
  '.....####.......',
].map(r => r.padEnd(16, '.'));
/** 四角星（吟唱） */
export const STAR_ROWS = [
  '.....#.....', '.....#.....', '....#o#....', '....#o#....', '...#ooo#...', '##ooowooo##', '...#ooo#...', '....#o#....', '....#o#....', '.....#.....', '.....#.....',
];
/** 沙漏（结束回合） */
export const HOURGLASS_ROWS = [
  '###########', '.#ooooooo#.', '..#ooooo#..', '...#ooo#...', '....#w#....', '.....#.....', '....#.#....', '...#...#...', '..#..w..#..', '.#.wwwww.#.', '###########',
];
