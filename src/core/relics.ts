// Relic effects (ids, names and numbers from the original data/relics*.ts; table as in the 3D prototypes' RELIC_FX).
// Each effect returns plain numbers; battle.ts applies them and emits a `relic` event so the presentation can fly the relic model
// to where the effect lands (weapon for damage / multiplier, hero for armor / heal, coin pile for gold).
import type { RelicTarget } from './types';

export interface RelicCtx {
  handType: string; diceCount: number; pointSum: number; rerollsThisTurn: number; currentHp: number; maxHp: number;
  hpLostThisTurn: number; currentDepth: number; overkill: number; currentGold: number;
}
export interface RelicRes {
  damage?: number; multiplier?: number; armor?: number; heal?: number; goldBonus?: number; purifyDebuff?: number;
  grantFreeReroll?: number; grantExtraPlay?: number;
}
type Fx = Partial<Record<'on_play' | 'on_kill' | 'on_damage_taken' | 'on_battle_end', (c: RelicCtx) => RelicRes>> & { passive?: Record<string, number> };

export const RELIC_FX: Record<string, Fx> = {
  grindstone: { on_play: c => ({ damage: c.diceCount <= 2 ? 12 : 0 }) },
  iron_skin_relic: { on_play: c => ({ grantFreeReroll: c.rerollsThisTurn === 0 ? 1 : 0 }) },
  healing_breeze: { on_play: () => ({ heal: 3 }) },
  twin_stars_relic: { on_play: c => ({ multiplier: c.handType === '对子' ? 1.5 : 1 }) },
  void_echo_relic: { on_play: c => ({ multiplier: c.handType === '连对' ? 1.8 : 1 }) },
  glass_cannon_relic: { on_play: () => ({ multiplier: 2.0, heal: -10 }) },
  greedy_hand: { on_play: c => (c.diceCount >= 4 ? { damage: 20 } : {}) },
  basic_instinct_relic: { on_play: c => ({ damage: c.handType === '普通攻击' ? Math.ceil(c.pointSum * 1.5) : 0 }) },
  thick_hide_relic: { on_play: c => ({ armor: c.handType === '对子' ? 10 : 0 }) },
  minimalist_relic: { on_play: c => ({ damage: c.diceCount === 1 ? 15 : 0, multiplier: c.diceCount === 1 ? 2.0 : 1 }) },
  lucky_coin_relic: { on_play: () => ({ goldBonus: 2 }) },
  merchants_eye_relic: { on_play: c => (c.handType === '普通攻击' ? { goldBonus: 5 } : {}) },
  chaos_pendulum: { on_play: c => (c.pointSum % 2 === 1 ? { damage: 12 } : { heal: 3, purifyDebuff: 1 }) },
  crimson_grail: { on_play: c => ({ multiplier: 1 + Math.min(0.8, (1 - c.currentHp / c.maxHp) * 1.5) }) },
  point_accumulator: { on_play: c => ({ armor: 3 + Math.floor(c.currentDepth / 6) }) },
  dice_master_relic: { on_play: c => (c.diceCount >= 3 ? { damage: 15, multiplier: 1.3 } : {}) },
  purify_water_relic: { on_play: () => ({ purifyDebuff: 1 }) },
  masochist_relic: { on_play: c => ({ armor: Math.floor(c.hpLostThisTurn * 0.5), heal: Math.floor(c.hpLostThisTurn * 0.2) }) },
  sharp_edge_relic: { on_kill: () => ({ grantExtraPlay: 1 }) },
  battle_medic_relic: { on_kill: () => ({ heal: 8 }) },
  vampire_fangs: { on_kill: c => ({ heal: Math.floor(c.overkill * 0.25) }) },
  rage_fire_relic: { on_damage_taken: () => ({ damage: 15 }) },
  emergency_hourglass: {},
  double_strike: { passive: { extraPlay: 1 } },
  haggler_relic: { passive: { shopDiscount: 0.2 } },
  interest_relic: { on_battle_end: c => ({ goldBonus: Math.floor(c.currentGold / 10) }) },
};
export const RELIC_POOL = Object.keys(RELIC_FX);

/** Which way a relic's effect flies (v5 relicPop: damage / multiplier → weapon, armor / heal → hero, gold → coin pile). */
export function relicTarget(r: RelicRes): RelicTarget {
  if (r.damage || (r.multiplier && r.multiplier !== 1)) return 'weapon';
  if (r.goldBonus) return 'gold';
  return 'hero';
}

/** Short Chinese summary of a relic result, e.g. "+12 伤害 ×1.5 伤害". */
export function relicText(r: RelicRes): string {
  const b: string[] = [];
  if (r.damage) b.push('+' + r.damage + ' 伤害');
  if (r.multiplier && r.multiplier !== 1) b.push('×' + +r.multiplier.toFixed(2) + ' 伤害');
  if (r.armor) b.push('+' + r.armor + ' 护甲');
  if (r.heal) b.push((r.heal > 0 ? '+' : '') + r.heal + ' 生命');
  if (r.goldBonus) b.push('+' + r.goldBonus + ' 金币');
  if (r.purifyDebuff) b.push('净化');
  if (r.grantFreeReroll) b.push('+1 免费重投');
  if (r.grantExtraPlay) b.push('+1 出牌');
  return b.join(' ');
}
