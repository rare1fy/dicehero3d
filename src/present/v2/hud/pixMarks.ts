// R7 按钮上的像素记号（UX_V3 §6b）：按规则生成的字符画，再用 pixParts.reliefPix 挤出。只走横竖和正 45°（八角环的切角就是 1:1
// 台阶），'#' = 1 格深色描边，'o' = 本色，'h' = 高光。另有：按格数精确生成八角石钮（静止时 1 体素 = 1 美术像素）的小缓存、
// 吟唱环（八角环分 3 段，每段一个色组，可单独亮灭）、数字小骰（重投环绕、缩影用，六面都是方正数字）。
import * as THREE from 'three';
import { buildPix, type PCell, type PixModel } from '../../ui3d/pixMesh';
import { numeralFaceTexture } from '../../dice/numFace';

/** 八角环到外沿的距离（R×R，四角切 cut 格） */
function octRing(R: number, cut: number) {
  return (X: number, Y: number) => { if (X < 0 || Y < 0 || X >= R || Y >= R) return -1; const a = Math.min(X, R - 1 - X), b = Math.min(Y, R - 1 - Y); return Math.min(a, b, a + b - cut); };
}

/**
 * 重投记号：两段沿八角环追逐的箭头（环宽 2 格 + 两侧 1 格描边，箭头头部 = 正 45° 的三角）。R = 环外径（格），返回字符行。
 * 上半段从左上走到右侧、箭头朝下；下半段与它中心对称。
 */
export function rerollRows(R = 18, cut = 6, hw = 3) {
  R += R & 1;   // even: the two arrowheads sit on whole rows
  const o = hw, W = R + 2 * o, g = Array.from({ length: W }, () => Array<string>(W).fill('.')), ring = octRing(R, cut), mid = W / 2;
  const upper = (x: number, y: number) => (x >= mid ? y < mid - 2 : y < mid - 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const d = ring(x - o, y - o); if (d < 0 || d > 3) continue;
    if (!upper(x, y) && !upper(W - 1 - x, W - 1 - y)) continue;
    g[y][x] = d === 0 || d === 3 ? '#' : d === 1 && y < mid ? 'h' : 'o';
  }
  const head = (cx: number, y0: number, dir: number) => {
    for (let j = 0; j <= hw + 1; j++) {
      const h = hw + 1 - j, y = y0 + dir * j, a = Math.round(cx - h - 0.5), b = Math.round(cx + h + 0.5) - 1;
      for (let x = a; x <= b; x++) g[y][x] = x === a || x === b || j === hw + 1 ? '#' : 'o';
    }
  };
  const cx = o + R - 2.5; head(cx, mid - 2, 1); head(W - 1 - cx, W - 1 - (mid - 2), -1);
  return g.map(r => r.join(''));
}

/** 字符行 → 挤出：'#' 描边（低 1 格）、'o' 本色、'h' 高光；pal = 记号色阶 [高光, 本色, 暗1, 暗2, 暗3]，ink = 描边色阶 */
export function markPix(rows: string[], pal: number[], depth = 4, ink: number[] = [0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710]) {
  const H = rows.length, W = rows[0].length;
  return buildPix(W, H, (x, y): PCell | null => {
    const ch = rows[y][x]; if (ch === '.') return null;
    if (ch === '#') return { g: 1, t: 1, h: depth - 1 };
    return { g: 0, t: ch === 'h' ? 0 : ch === 'w' ? 0 : 1, h: depth };
  }, [pal, ink]);
}

/**
 * 吟唱环：R×R 的八角环（宽 w 格 + 内外 1 格描边），按角度分 3 段（每段之间留 2 格缺口），段 i = 色组 1 + i，描边 = 色组 0。
 * 从正上方顺时针：第 1 段 → 第 3 段。
 */
export function chantRingPix(R: number, w: number, pal: number[], depth = 3): PixModel {
  const cut = Math.round(R * 0.29), ring = octRing(R, cut), c = (R - 1) / 2;
  const seg = (x: number, y: number) => {   // angle from 12 o'clock, clockwise, in turns; a 2-ish cell gap at each segment boundary
    const a = ((Math.atan2(x - c, c - y) / (Math.PI * 2) + 1 + 1 / 12) % 1) * 3, s = Math.min(2, Math.floor(a)), f = a - s;
    return { s, gap: f < 0.035 || f > 0.965 };
  };
  const ink = [0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710, 0x0a0710];
  return buildPix(R, R, (x, y): PCell | null => {
    const d = ring(x, y); if (d < 0 || d > w + 1) return null;
    const { s, gap } = seg(x, y); if (gap) return d === 0 || d === w + 1 ? null : { g: 0, t: 1, h: depth - 1 };
    if (d === 0 || d === w + 1) return { g: 0, t: 1, h: depth - 1 };
    return { g: 1 + s, t: d === 1 ? 0 : 1, h: depth };
  }, [ink, pal, pal, pal]);
}

// ---------------------------------------------------------------- numeral mini dice (the reroll orbit, thumbnails)
const DIE_GEO = new THREE.BoxGeometry(1, 1, 1);
/** 一颗小数字骰（边长 1，六面都是方正数字，nearest 采样）；BoxGeometry 面序 +x −x +y −y +z −z = 3 4 2 5 1 6 */
export function numeralDie(tone: 'normal' | 'dim' = 'normal') {
  const mats = [3, 4, 2, 5, 1, 6].map(v => new THREE.MeshBasicMaterial({ map: numeralFaceTexture(v, { T: 12, tone }), toneMapped: false }));
  const m = new THREE.Mesh(DIE_GEO, mats); m.userData.faceMats = mats; return m;
}
/** 把小骰正对镜头的那面换成 v（换 +z 面贴图） */
export function setNumeralTop(m: THREE.Mesh, v: number, tone: 'normal' | 'dim' = 'normal') {
  const mats = m.userData.faceMats as THREE.MeshBasicMaterial[]; if (!mats) return;
  const t = numeralFaceTexture(v, { T: 12, tone }); if (mats[4].map !== t) { mats[4].map = t; mats[4].needsUpdate = true; }
}
