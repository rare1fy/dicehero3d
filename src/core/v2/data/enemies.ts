// Chapter-1 enemies for v2. The ghoul and the lich are read from the v1 extracted data (read-only); the alpha wolf is ported
// from the 2D config (config/enemyEliteBoss.ts elite_alpha_wolf: 100 HP, 11 dmg, warrior / berserker).
import raw from '../../data/gameData.json';
import type { EnemyCfgV2, EnemyRank } from '../types';

const V1 = (raw as unknown as { enemies: Record<string, EnemyCfgV2> }).enemies;
const pick = (id: string): EnemyCfgV2 => { const e = V1[id]; if (!e) throw new Error('missing v1 enemy ' + id); return JSON.parse(JSON.stringify(e)); };

export const ENEMIES: Record<string, EnemyCfgV2> = {
  forest_ghoul: pick('forest_ghoul'),
  boss_lich_forest: pick('boss_lich_forest'),
  elite_alpha_wolf: {
    id: 'elite_alpha_wolf', name: '狼人首领', hp: 100, dmg: 11, ct: 'warrior', arch: 'berserker', cat: 'elite',
    phases: [{ actions: [
      { type: '攻击', baseValue: 11 },
      { type: '攻击', baseValue: 14, description: '狂暴撕咬' },
      { type: '攻击', baseValue: 9 },
    ] }],
    q: {
      enter: ['月光之下……狼群为王！', '嗅到了……恐惧的味道……'],
      death: ['狼王……倒下了……', '（最后一声长嚎）'],
      attack: ['撕碎！', '狂暴！', '嗷——！'],
      hurt: ['疼痛……让我更愤怒！', '嗷呜！'],
      lowHp: ['月光……赐予我……最后的狂暴！'],
    },
  },
};

export function enemyCfgV2(id: string): EnemyCfgV2 { const e = ENEMIES[id]; if (!e) throw new Error('unknown v2 enemy ' + id); return e; }

/**
 * Per-fight scaling [hp, dmg] (tunable; the bot calibrates these). The lich keeps its spec HP (120). Damage scales mirror the v1
 * depth table at the slice's depths (normal ≈ depth 1, elite ≈ depth 4, mid boss = depth 7 → 1.0).
 */
export const FIGHT_SCALE: Record<'normal' | 'elite' | 'midBoss' | 'boss', { hp: number; dmg: number }> = {
  normal: { hp: 1.0, dmg: 0.6 },
  elite: { hp: 1.0, dmg: 0.75 },
  midBoss: { hp: 1.0, dmg: 1.0 },
  boss: { hp: 1.0, dmg: 1.0 },
};

/** Enemy traits from v1 (warrior blood fury, berserker vengeance). Off by default for v2: they are tuned for the v1 hand sizes. */
export const ENEMY_TRAITS = { bloodFury: false, vengeance: true };

/** Gold / xp per kill (SPEC 3.2): base, max overkill bonus (1 gold per 4 overkill), xp. */
export const DROPS: Record<EnemyRank, { gold: number; maxBonus: number; xp: number }> = {
  normal: { gold: 5, maxBonus: 3, xp: 5 },
  summon: { gold: 1, maxBonus: 0, xp: 1 },
  elite: { gold: 35, maxBonus: 15, xp: 30 },
  eliteMinion: { gold: 5, maxBonus: 3, xp: 5 },
  midBoss: { gold: 70, maxBonus: 35, xp: 70 },
  boss: { gold: 90, maxBonus: 45, xp: 90 },
};
export const OVERKILL_PER_GOLD = 4;
/** melee enemies walk this many enemy turns before attacking (v1 used 2; v2 fights are shorter) */
export const MELEE_START_DISTANCE = 1;

/** Enemy junk-die rhythm (SPEC 5, from logic/elites.ts). v2.1 prototype: off (`on: false`). */
export const JUNK = { on: false, eliteCycle: 3, bossCurseHpRatio: 0.4, bossCurseCycle: 2, bossCrackedCycle: 3 };
/** v2.1 0.2: per-enemy summon caps for the prototype (overrides gameData maxTotal) */
export const SUMMON_MAX_TOTAL: Record<string, number> = { boss_lich_forest: 3 };
