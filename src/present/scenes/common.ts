// Shared scene vocabulary: moods (light / fog / sky), the chapter palette, and small helpers every scene file uses.
// Owned by the lead; scene files may define their own extra colours and moods locally instead of editing this file.
import { type Mood, type Ctx } from './stage';
import { AREA, patches } from './props';
import { CELL } from '../bestiary/kit';

export const NIGHT: Mood = { sky: true, bg: 0x0e0c1c, fog: 0x1a1630, fogD: 0.019, hemiSky: 0x6a70a8, hemiGround: 0x221a20, hemiI: 1.2, moon: 0xb8c4ff, moonI: 2.4, key: 0xffd2a8, keyI: 0.8, earth: [0x2a2c2a, 0x2e3a2a, 0x262226], mist: 0x5a5c8c, mistA: 0.08 };
export const SWAMP: Mood = { ...NIGHT, fog: 0x1a2a22, fogD: 0.024, hemiSky: 0x4a7a6a, hemiGround: 0x141a14, moon: 0xa8d8c0, moonI: 2.2, earth: [0x262a20, 0x2a3222, 0x20241c], mist: 0x5a8a6a, mistA: 0.08 };
export const DUNGEON: Mood = { sky: false, bg: 0x07060b, fog: 0x0c0a12, fogD: 0.03, hemiSky: 0x7a7a9a, hemiGround: 0x221e22, hemiI: 1.5, moon: 0xa8a8c8, moonI: 2.0, key: 0xffc890, keyI: 0.55, earth: [0x121016, 0x16141a, 0x100e12], mist: 0x3a3a50, mistA: 0.06 };
export const CAVE: Mood = { sky: false, bg: 0x050408, fog: 0x0a0a10, fogD: 0.028, hemiSky: 0x7a8ab0, hemiGround: 0x22222a, hemiI: 1.75, moon: 0x8a9ac0, moonI: 1.9, key: 0xc8d0ff, keyI: 0.4, earth: [0x141216, 0x18161a, 0x121014], mist: 0x3a4a5a, mistA: 0.07 };
export const HOUSE: Mood = { ...NIGHT, keyI: 0.6, mistA: 0.05 };

export const BARK = 0x3e3434, BARK_D = 0x2a2224, PINE = 0x1e3a2e, PINE_T = 0x2e5a40, MOSS = 0x3e5a30, MOSS_D = 0x2e4426, EARTH = [0x3e3634, 0x36422e, 0x342e2c];
export const STONE = [0x6c6a7c, 0x666478, 0x716f84], GROUT = 0x2a2832, WOOD = 0x6a4a32, WOOD_D = 0x4a3222, WOOD_L = 0x86603e, ROCK = [0x46444e, 0x3e3c46, 0x52505a], IRON = 0x2c2a36, BONE = 0xe6dcc4, FIRE = 0xffa040, SOUL = 0x5affb0, CURSE = 0xb060ff;

export function floorEarth(c: Ctx, cols = EARTH) { patches(c.w, AREA, cols); }
/** a cobweb card where the old block web stood (y0 and s in blocks, as the block web took them) */
export const cweb = (c: Ctx, x: number, z: number, y0: number, s: number, alongX: boolean) => c.cards.add('web', x, z, { y: (y0 + 2 * s + 1) * CELL, s: ((2 * s + 1) / 32) * 1.25, ry: alongX ? 0 : Math.PI / 2 });
/** the cave rock ring's inner faces, for hanging growth */
export const RING: Array<[number, number, number, number, 'n' | 's' | 'e' | 'w']> = [[-8.4, -11.6, 8.4, -11.6, 's'], [-9.8, -10, -9.8, 4.5, 'e'], [9.8, -10, 9.8, 4.5, 'w']];
