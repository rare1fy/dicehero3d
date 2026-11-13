// Battle events for rules v2. Same shape as v1 (src/core/events.ts) where the meaning is the same; v2-only events are marked.
import type { DieKind, Status, StatusV2, Suit, TierName } from './types';

export type Who = 'player' | number;
export interface DieSnap2 { uid: number; kind: DieKind; value: number; suit: Suit }
export type GainReason = 'behead' | 'guard' | 'stun' | 'tier' | 'resonance' | 'shadow' | 'fury' | 'furyUlt' | 'chant' | 'titan' | 'precise' | 'mark';

export type Ev2 =
  | { t: 'battleStart'; enemies: number[]; isBoss: boolean; wave: number }
  /** v2.1 (1.9): a wave was cleared and another follows; emitted before its battleStart. nextDice = dice the next wave's first turn starts with */
  | { t: 'waveClear'; wave: number; nextDice: number; reasons: GainReason[] }
  | { t: 'enemyEnter'; uid: number; summonedBy?: number }
  | { t: 'quote'; uid: number; kind: string; index: number }
  /** v2: diceCount = dice on the field this turn; reasons = where the extra dice came from */
  | { t: 'turnStart'; turn: number; diceCount: number; overflow: number; strikes: number; reasons: GainReason[] }
  /** v2: every die's value and suit. kept = uids that stayed on the field without rolling (retained / carried) */
  | { t: 'roll'; dice: DieSnap2[]; reason: 'turn' | 'reroll' | 'spawn' | 'flip' | 'return'; kept: number[] }
  | { t: 'reroll'; uids: number[]; hpCost: number; rage: number; capped: boolean; free: boolean }
  /** v2: which row, which tier, which dice */
  | { t: 'rowPlay'; ref: number | 'basic'; rowId: string; name: string; tier: TierName | null; count: number; uids: number[]; companions: number; target: number | null; strike: number; ultimate: boolean; combo: boolean; X: number; bonusPct: number; /** v3: special dice handed in and their damage bonus (integer %) */ special?: Array<{ uid: number; kind: DieKind; pct: number }> }
  | { t: 'hit'; uid: number; dmg: number; absorbed: number; hpDmg: number; killed: boolean; aoe: boolean; ultimate: boolean; source: 'play' | 'cleave' | 'thorns' | 'dot' | 'detonate' }
  | { t: 'statusAdd'; who: Who; status: Status }
  | { t: 'statusTick'; who: Who; type: StatusV2; dmg: number }
  | { t: 'statusExpire'; who: Who; type: StatusV2 }
  | { t: 'armor'; who: Who; delta: number; total: number; reason: string }
  | { t: 'barrier'; delta: number; total: number }
  | { t: 'hp'; who: 'player'; delta: number; hp: number; reason: 'heal' | 'self' | 'reroll' | 'potion' }
  | { t: 'purify'; removed: StatusV2[] }
  /** v2: next turn +n dice */
  | { t: 'gainDice'; n: number; reason: GainReason; from?: number }
  /** v2: special die created / gone / turned into another kind / carried to next turn */
  | { t: 'special'; action: 'spawn' | 'vanish' | 'transform' | 'carry'; uid: number; kind: DieKind; value: number; suit: Suit }
  | { t: 'spent'; uids: number[] }
  | { t: 'rage'; stacks: number }
  | { t: 'chant'; ring: number; barrier: number; overcharge: number }
  | { t: 'backlash'; stacks: number }
  | { t: 'overload'; turns: number }
  | { t: 'strikeGain'; n: number; reason: string }
  | { t: 'freeReroll'; n: number; reason: string }
  | { t: 'enemyTurn'; turn: number }
  | { t: 'enemyMove'; uid: number; distance: number }
  | { t: 'enemyAct'; uid: number; kind: 'attack' | 'skill' | 'defend' | 'frozen' | 'stunned' | 'curse'; desc?: string; value?: number; interrupted?: boolean; taunted?: boolean }
  | { t: 'playerHit'; from: number | null; dmg: number; byBarrier: number; byArmor: number; hpDmg: number; isDot: boolean; perfectBlock: boolean }
  /** v2: enemy junk die — replaces one fresh die next turn */
  | { t: 'junk'; kind: 'cracked' | 'cursed'; from: number }
  | { t: 'summon'; by: number; uid: number }
  | { t: 'phase'; uid: number; phaseIdx: number }
  | { t: 'death'; uid: number; direct: boolean; overkill: number }
  /** v2: coins burst from an enemy */
  | { t: 'gold'; amount: number; from: number; overflow: number }
  /** v2: xp motes */
  | { t: 'xp'; amount: number; from: number }
  | { t: 'relic'; id: string; text: string }
  | { t: 'victory'; gold: number; xp: number }
  | { t: 'defeat' };

export type Ev2Type = Ev2['t'];
