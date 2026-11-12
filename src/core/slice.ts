// The stage-1 slice setup: 嗜血狂战 (6 starting dice + 4 representative warrior dice, 3 starting relics) vs 枯骨巫妖.
// Confirmed by the user on 2026-11-12 (docs/迁移计划_阶段1.md §一).
import type { BattleSetup } from './battle';

export const SLICE_DICE = ['standard', 'standard', 'standard', 'standard', 'w_bloodthirst', 'w_ironwall', 'w_fury', 'w_titanfist', 'w_whirlwind', 'w_execute'];
export const SLICE_RELICS = ['crimson_grail', 'rage_fire_relic', 'point_accumulator'];
/** Map depth of the boss node. SPEC: the lich is the chapter-1 mid boss (depth 7 in the original map); final value after the rules check. */
export const SLICE_DEPTH = 7;

export function sliceSetup(seed: number, o: Partial<BattleSetup> = {}): BattleSetup {
  return { seed, cls: 'warrior', owned: SLICE_DICE.slice(), relics: SLICE_RELICS.slice(), waves: [['boss_lich_forest']], depth: SLICE_DEPTH, isBoss: true, ...o };
}
