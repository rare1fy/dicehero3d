// Relics (SPEC_v2.2 4) and the economy tables (SPEC_v2.2 3.1–3.3). The prototype shop / reward pool is the 3 relics with
// `prototype: true` (4.4); `prototypeBanned` ones never appear. All "on strike" effects fire once per whole play (4.1).
import type { RelicDefV2 } from '../types';

export const RELICS_V2: RelicDefV2[] = [
  // 4.4 prototype pool
  { id: 'greedy_hand', name: '贪婪之手', desc: '交出 4 颗以上的出手：+20 基础伤害', rarity: 'common', tag: '通用', trigger: 'onStrike', prototype: true },
  { id: 'wildfire', name: '怒火燎原', desc: '受到伤害后，下一次交出 ≥2 颗的出手 +15 伤害（不叠加）', rarity: 'common', tag: '通用', trigger: 'onHit' },
  { id: 'iron_charm', name: '铁壁护符', desc: '被攻击 → 下回合免费重投 +1（每回合最多 1 次）', rarity: 'common', tag: '通用', trigger: 'onHit', prototype: true },
  { id: 'steady_heart', name: '稳健之心', desc: '本回合一次重投都没用就出手 → 下回合免费重投 +1', rarity: 'common', tag: '通用', trigger: 'onStrike' },
  { id: 'field_aid', name: '战场急救', desc: '击杀回 8 血；每场最多 3 次', rarity: 'common', tag: '通用', trigger: 'onKill', perBattleCap: 3, prototype: true },
  // kept for later (not in the prototype pool)
  { id: 'dice_master', name: '骰子大师', desc: '交出 5 颗以上：+15 伤害、+30%', rarity: 'uncommon', tag: '通用', trigger: 'onStrike' },
  { id: 'loot_die', name: '战利品骰', desc: '击杀时 +1 次免费重投', rarity: 'uncommon', tag: '通用', trigger: 'onKill' },
  { id: 'emergency_hourglass', name: '急救沙漏', desc: '免疫一次致命伤害', rarity: 'rare', tag: '通用', trigger: 'passive' },
  { id: 'twin_stars', name: '双子星', desc: '同点数条件的行伤害 +50%', rarity: 'uncommon', tag: '点数', trigger: 'onStrike' },
  { id: 'elemental_overload', name: '元素过载', desc: '交出的骰子全是同一花色（3 颗以上）：伤害 +60%', rarity: 'uncommon', tag: '花色', trigger: 'onStrike' },
  { id: 'war_crest', name: '战神纹章', desc: '斩首、完防上限各 +1', rarity: 'rare', classId: 'warrior', tag: '狂战', trigger: 'passive' },
  { id: 'charge_core', name: '蓄力晶核', desc: '吟唱回合 +4 护甲、回 3 血', rarity: 'uncommon', classId: 'mage', tag: '魔导', trigger: 'onTurnStart' },
  // 4.2 prototype banned
  { id: 'grindstone', name: '磨刀石', desc: '交出 2 颗及以下：+12 基础伤害', rarity: 'common', tag: '通用', trigger: 'onStrike', prototypeBanned: true },
  { id: 'healing_breeze', name: '治愈之风', desc: '每次出手回 3 血', rarity: 'common', tag: '通用', trigger: 'onStrike', prototypeBanned: true },
  { id: 'lucky_coin', name: '幸运铜板', desc: '每次出手 +2 金', rarity: 'common', tag: '经济', trigger: 'onStrike', economy: true, prototypeBanned: true },
  { id: 'shadow_drain', name: '暗影吸取', desc: '第 2 刀是技能时回 6 血', rarity: 'common', classId: 'rogue', tag: '刺客', trigger: 'onStrike', prototypeBanned: true },
];
export const relicV2 = (id: string) => { const r = RELICS_V2.find(x => x.id === id); if (!r) throw new Error('unknown relic ' + id); return r; };
/** relics that may be offered in the prototype (shop and boss reward) */
export const PROTO_RELICS = RELICS_V2.filter(r => r.prototype && !r.prototypeBanned);

/** xp needed to go from level L to L+1 = 40 × L − 10 */
export const xpToNext = (level: number) => 40 * level - 10;

export const ECON = {
  startGold: 0,            // v2.1: no starting gold
  relicPrice: { common: 70, uncommon: 100, rare: 140 } as Record<string, number>,
  salePrice: 42,           // 特价 = common × 0.6
  potionPrice: 35, potionStep: 20, potionHealPct: 0.25,
  refreshPrice: 20, refreshStep: 20,
  engravePrice: [50, 100] as [number, number],   // → II / → III
  engraveMax: 2,
  campRestPct: 0.35, campTrainXp: 60,
  bossHealPct: 0.6,
  /** per-battle caps (3.2) */
  overflowGoldCap: { normal: 6, elite: 15, midBoss: 20, boss: 20 } as Record<string, number>,
  relicGoldCap: 15,
  summonCap: { gold: 5, xp: 5 },
  /** 战场急救 heal per kill */
  fieldAidHeal: 8,
  wildfireFlat: 15,
};
