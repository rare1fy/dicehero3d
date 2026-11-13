// Suit dice faces (SPEC_v2 §1.2): two painting schemes for the same data (suitData.ts), so they can be compared side by side.
//   A: the whole face in the suit colour, the suit silhouette in relief filling the face, a big thick-outlined pixel numeral in the middle.
//   B: the suit icon used as pips, laid out like ordinary die pips (3 = three axes on the diagonal), on a dark stone face.
// Special dice (怒火 / 泰坦 / 星辰 / 暗影残骰 / 金骰) mix their body colour into every face and get a glowing 1-texel frame (emissive).
// Faces are authored at the texel size they are shown at (A 24, B 32 texels) so nearest sampling keeps clean pixel art.
// R5 plain dice (rules v3, TARGET_MOCKUP): an 80-texel HD face sampled smoothly (mipmaps) on a chamfered block (dice/faces.ts): the value
// face shows one big dark numeral (NUM68), the other faces show square pips; the emissive map carries a grey body so the die can be tinted
// by its selection glow (die3d.ts) while numerals and pips stay dark.
import { SUITS, SPECIALS, NUM45, NUM68, PIPS, suitOf, type SuitSkin, type Suit } from './suitData';

export const SUIT_T: Record<'A' | 'B', number> = { A: 24, B: 32 };
/** texels per face of the HD plain dice */
export const PLAIN_T = 80;
/** atlas tile size for a skin, and whether it is sampled smoothly (HD plain) or nearest (pixel-art suit faces) */
export const tileSize = (s: SuitSkin) => (s.plain ? PLAIN_T : SUIT_T[s.scheme]);
export const smoothFaces = (s: SuitSkin) => !!s.plain;

/** 6×6 icons for small pips (B, 3 / 5 / 6 pips). */
const MINI: Record<string, string[]> = {
  axe: ['#.##.#', '######', '######', '#.##.#', '..##..', '..##..'],
  blood: ['..##..', '.####.', '.####.', '######', '######', '.####.'],
  rage: ['.#..#.', '.##.##', '######', '######', '##oo##', '.####.'],
  star: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  moon: ['.####.', '###...', '##....', '##....', '###...', '.####.'],
  sun: ['#.##.#', '.####.', '##oo##', '##oo##', '.####.', '#.##.#'],
  void: ['.####.', '##..##', '#.##.#', '#.##.#', '##..##', '.####.'],
  poison: ['.####.', '######', '#d##d#', '######', '.#dd#.', '.####.'],
  blade: ['..##..', '..##..', '..##..', '######', '..##..', '..##..'],
  shadow: ['.####.', '######', '#dddd#', '#oddo#', '#dddd#', '##..##'],
};

const hex = (h: string) => parseInt(h.slice(1), 16);
function mix(a: string, b: string, k: number) {
  const pa = hex(a), pb = hex(b), ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}
const lum = (h: string) => { const p = hex(h); return (((p >> 16) & 255) * 0.3 + ((p >> 8) & 255) * 0.59 + (p & 255) * 0.11) / 255; };

/** Draw a pixel icon: cells of `s` texels at (x, y); `col(ch)` picks the colour per cell char (null = skip). */
function icon(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, s: number, col: (ch: string) => string | null) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '.') return; const k = col(ch); if (!k) return; g.fillStyle = k; g.fillRect(x + c * s, y + r * s, s, s); }));
}
/** Same icon, every cell grown by `w` texels on all sides (outlines). */
function iconGrow(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, s: number, w: number, colr: string) {
  g.fillStyle = colr; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') g.fillRect(x + c * s - w, y + r * s - w, s + 2 * w, s + 2 * w); }));
}

/** The visible face colour of a suit on this skin (special dice tint every face toward their body colour). */
export function faceColour(skin: SuitSkin, v: number) {
  const S = SUITS[suitOf(skin, v)], sp = skin.special ? SPECIALS[skin.special] : null;
  return sp ? mix(S.col, sp.body, 0.5) : S.col;
}

/** Paint one suit face tile at x-offset ox (T texels square). g = albedo, eg = emissive (black = no glow).
 *  numeral: this is the value face (HD plain dice paint the numeral there and pips elsewhere; other schemes ignore it). */
export function paintSuitFace(g: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, ox: number, T: number, value: number, skin: SuitSkin, numeral = true) {
  const S: Suit = SUITS[suitOf(skin, value)], sp = skin.special ? SPECIALS[skin.special] : null;
  g.save(); g.translate(ox, 0); eg.save(); eg.translate(ox, 0);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, T, T);
  if (skin.plain && T >= 48) { paintPlainHD(g, eg, T, value, sp, numeral); g.restore(); eg.restore(); return; }
  if (skin.plain) paintPlain(g, eg, T, value, sp);
  else if (skin.scheme === 'A') paintA(g, eg, T, value, S, sp?.body);
  else paintB(g, eg, T, value, S, skin, sp?.body);
  // hard 1-texel bevel: crisp cube edges without rounding
  g.fillStyle = 'rgba(255,255,255,0.32)'; g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T);
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, T - 1, T, 1); g.fillRect(T - 1, 0, 1, T);
  if (sp) {   // special dice: a glowing frame on every face (albedo + emissive), so the whole die reads as "not an ordinary die"
    for (const [ctx, c] of [[g, mix(sp.glow, '#ffffff', 0.2)], [eg, sp.glow]] as const) { ctx.fillStyle = c; ctx.fillRect(0, 0, T, 1); ctx.fillRect(0, T - 1, T, 1); ctx.fillRect(0, 0, 1, T); ctx.fillRect(T - 1, 0, 1, T); }
    eg.fillStyle = mix(sp.glow, '#000000', 0.55); eg.fillRect(1, 1, T - 2, 1); eg.fillRect(1, T - 2, T - 2, 1); eg.fillRect(1, 1, 1, T - 2); eg.fillRect(T - 2, 1, 1, T - 2);
  }
  g.restore(); eg.restore();
}

/** rules v3: a plain bone-white face with a big dark numeral; special dice use their body colour, a light numeral and a small
 *  effect icon in the corner (怒火 → flame, 星辰 → star, 暗影 → shadow) */
function paintPlain(g: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, T: number, value: number, sp: (typeof SPECIALS)[keyof typeof SPECIALS] | null) {
  const base = sp ? mix(sp.body, '#000000', 0.1) : '#eadfc8', ink = sp ? '#fff4e0' : '#2a1c18', rim = sp ? '#07050a' : '#fffaf0';
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  if (!sp) { g.fillStyle = mix(base, '#7a6450', 0.25); g.fillRect(1, T - 3, T - 2, 2); g.fillRect(T - 3, 1, 2, T - 2); }
  const n = NUM45[String(value)] || NUM45['1'], cs = Math.max(2, Math.floor(T / 6.5)), w = 4 * cs, h = 5 * cs;
  const nx = Math.round((T - w) / 2), ny = Math.round((T - h) / 2);
  iconGrow(g, n, nx, ny, cs, 1, rim);
  icon(g, n, nx, ny, cs, () => ink);
  if (sp) {
    icon(eg, n, nx, ny, cs, () => mix(sp.glow, '#000000', 0.55));
    const key = sp.glow === SPECIALS.fury.glow ? 'rage' : sp.glow === SPECIALS.starry.glow ? 'star' : sp.glow === SPECIALS.shadowres.glow ? 'shadow' : null;
    if (key) { const m = MINI[key]; icon(g, m, T - 8, 2, 1, ch => (ch === '.' ? null : sp.glow)); icon(eg, m, T - 8, 2, 1, ch => (ch === '.' ? null : sp.glow)); }
  }
}

/** R5 HD plain face: warm white block (special dice: body colour + glowing frame), a big NUM68 numeral with a carved drop shade on the value
 *  face, square pips on the others. No painted bevel: the geometry has a real chamfer. */
function paintPlainHD(g: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, T: number, value: number, sp: (typeof SPECIALS)[keyof typeof SPECIALS] | null, numeral: boolean) {
  const base = sp ? mix(sp.body, '#000000', 0.05) : '#efebe2', ink = sp ? '#fff4e0' : '#1d2130', shade = sp ? mix(base, '#000000', 0.55) : mix(base, '#6a6252', 0.42);
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  // emissive: plain dice keep a grey body (tinted by the selection glow in die3d.ts), special dice glow only on their marks
  eg.fillStyle = sp ? '#000' : '#5c5c5c'; eg.fillRect(0, 0, T, T);
  const glowInk = sp ? mix(sp.glow, '#000000', 0.62) : '#000';
  const cells = (rows: string[], x: number, y: number, cw: number, chh: number, ctx: CanvasRenderingContext2D, col: string) => {
    ctx.fillStyle = col; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') ctx.fillRect(Math.round(x + c * cw), Math.round(y + r * chh), Math.ceil(cw), Math.ceil(chh)); }));
  };
  if (numeral) {
    const n = NUM68[String(value)] || NUM68['1'], cw = T * 0.085, chh = T * 0.092, w = 6 * cw, h = 8 * chh;
    const nx = (T - w) / 2, ny = (T - h) / 2, o = Math.max(2, Math.round(T * 0.03));
    cells(n, nx + o, ny + o, cw, chh, g, shade);   // carved drop shade (down-right)
    cells(n, nx, ny, cw, chh, g, ink);
    cells(n, nx, ny, cw, chh, eg, glowInk);
  } else {
    const ps = Math.round(T * 0.15), notch = Math.max(2, Math.round(ps * 0.22)), o = Math.max(1, Math.round(T * 0.02));
    for (const [u, v] of PIPS[value] || PIPS[1]) {
      const x = Math.round(u * T - ps / 2), y = Math.round(v * T - ps / 2);
      const sq = (ctx: CanvasRenderingContext2D, col: string, dx: number, dy: number) => { ctx.fillStyle = col; ctx.fillRect(x + dx + notch, y + dy, ps - 2 * notch, ps); ctx.fillRect(x + dx, y + dy + notch, ps, ps - 2 * notch); };
      sq(g, shade, o, o); sq(g, sp ? mix(sp.glow, '#ffffff', 0.3) : '#2a2c38', 0, 0);
      if (sp) sq(eg, glowInk, 0, 0); else sq(eg, '#000', 0, 0);
    }
  }
  if (sp) {   // a glowing frame (it also lights the chamfers, which sample the tile border) + the small effect icon on the value face
    const fw = Math.max(3, Math.round(T * 0.075));
    for (const [ctx, c] of [[g, mix(sp.glow, '#ffffff', 0.25)], [eg, mix(sp.glow, '#000000', 0.5)]] as const) { ctx.fillStyle = c; ctx.fillRect(0, 0, T, fw); ctx.fillRect(0, T - fw, T, fw); ctx.fillRect(0, 0, fw, T); ctx.fillRect(T - fw, 0, fw, T); }
    const key = sp.glow === SPECIALS.fury.glow ? 'rage' : sp.glow === SPECIALS.starry.glow ? 'star' : sp.glow === SPECIALS.shadowres.glow ? 'shadow' : null;
    if (key && numeral) { const m = MINI[key], k = Math.round(T * 0.035); icon(g, m, T - fw - 2 - 6 * k, fw + 2, k, ch => (ch === '.' ? null : sp.glow)); icon(eg, m, T - fw - 2 - 6 * k, fw + 2, k, ch => (ch === '.' ? null : sp.glow)); }
  }
}

function paintA(g: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, T: number, value: number, S: Suit, body?: string) {
  const base = body ? mix(S.col, body, 0.5) : S.col, dark = S.dark, light = S.light;
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  // the suit silhouette in relief, filling the face (10×10 at 2 texels per cell = 20, 2 texels margin)
  const s = Math.floor((T - 4) / 10), x0 = Math.floor((T - 10 * s) / 2), y0 = x0;
  const relief = mix(base, light, lum(base) > 0.6 ? 0.55 : 0.32), shade = mix(base, dark, 0.45);
  icon(g, S.icon, x0 + 1, y0 + 1, s, () => shade);                    // cast shadow down-right: the shape stands out of the face
  icon(g, S.icon, x0, y0, s, ch => (ch === 'd' ? shade : ch === 'o' ? mix(relief, S.accent || light, 0.5) : relief));
  if (S.edge) { // 虚空: bright violet outline around the silhouette, glowing
    const tmp: string[] = S.icon; icon(eg, tmp, x0, y0, s, ch => (ch === '#' ? mix(S.edge!, '#000000', 0.6) : null));
  }
  // the numeral: 4×5 cells at 3 texels (12×15), a 2-texel near-black outline, cream fill
  const n = NUM45[String(value)] || NUM45['1'], cs = Math.max(2, Math.floor(T / 8)), w = 4 * cs, h = 5 * cs;
  const nx = Math.round((T - w) / 2), ny = Math.round((T - h) / 2);
  iconGrow(g, n, nx, ny, cs, 2, '#140c10');
  icon(g, n, nx, ny, cs, () => '#fff6e2');
  // a 1-texel lower shade on each stroke gives the numeral weight
  g.fillStyle = 'rgba(120,90,60,0.35)'; n.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#' && (r === 4 || n[r + 1][c] !== '#')) g.fillRect(nx + c * cs, ny + r * cs + cs - 1, cs, 1); }));
  if (body) icon(eg, n, nx, ny, cs, () => '#2a2018');
}

function paintB(g: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, T: number, value: number, S: Suit, skin: SuitSkin, body?: string) {
  const bg = body ? mix('#2a2430', body, 0.6) : '#2a2430';
  g.fillStyle = bg; g.fillRect(0, 0, T, T);
  g.fillStyle = mix(bg, '#000000', 0.25); g.fillRect(2, 2, T - 4, T - 4);   // a shallow carved well
  g.fillStyle = bg; g.fillRect(3, 3, T - 6, T - 6);
  const pipCol = lum(S.col) < 0.28 ? S.light : S.col, hi = mix(pipCol, '#ffffff', 0.45), sh = mix(S.dark, '#000000', 0.4);
  const pts = PIPS[value] || PIPS[1], big = value === 1, small = value === 3 || value === 5 || value === 6;
  const rows = small ? MINI[suitOf(skin, value)] : S.icon, cells = rows.length, s = big ? 2 : 1, size = cells * s;
  for (const [u, v] of pts) {
    const x = Math.round(u * T - size / 2), y = Math.round(v * T - size / 2);
    iconGrow(g, rows, x, y, s, 1, '#0c0810');
    icon(g, rows, x, y, s, ch => (ch === 'd' ? sh : ch === 'o' ? (S.accent || hi) : pipCol));
    // top-left highlight cells: the pip reads as a raised gem, not a flat dot
    g.fillStyle = hi; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#' && (r === 0 || rows[r - 1][c] === '.')) g.fillRect(x + c * s, y + r * s, s, 1); }));
    if (S.edge || S.accent) icon(eg, rows, x, y, s, ch => (ch === 'o' ? mix(S.accent || S.edge!, '#000000', 0.3) : S.edge ? mix(S.edge, '#000000', 0.75) : null));
  }
}
