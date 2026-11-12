// Battle events: the only thing the rules layer hands to the presentation. The stage (present/stage) turns each event into a
// staged beat with wind-up → impact → follow-through, and its source, path and target on screen. Events carry ids, not objects;
// the presentation reads current numbers from the battle state when it needs them.
import type { Outcome, QuoteKind, RelicTarget, Status, StatusType } from './types';

/** 'player' or an enemy uid. */
export type Who = 'player' | number;
export interface DieSnap { uid: number; defId: string; value: number }

export type BattleEvent =
  | { t: 'battleStart'; enemies: number[]; isBoss: boolean }
  | { t: 'enemyEnter'; uid: number; summonedBy?: number }
  | { t: 'quote'; uid: number; kind: QuoteKind; index: number }
  | { t: 'turnStart'; turn: number; playsLeft: number; drawBonus: number; overflowMult: number }
  | { t: 'discard'; uids: number[]; destroyed: number[] }
  | { t: 'draw'; dice: DieSnap[]; reshuffled: boolean; reason: 'turn' | 'reroll' }
  | { t: 'reroll'; uids: number[]; hpCost: number; blood: number; bloodCapped: boolean }
  | { t: 'play'; uids: number[]; target: number | null; outcome: Outcome }
  | { t: 'relic'; id: string; trigger: string; to: RelicTarget; text: string }
  | { t: 'hit'; uid: number; dmg: number; absorbed: number; hpDmg: number; armorBroke: boolean; killed: boolean; aoe: boolean; source: 'play' | 'splinter' }
  | { t: 'statusAdd'; who: Who; status: Status }
  | { t: 'statusTick'; who: Who; type: StatusType; dmg: number }
  | { t: 'statusExpire'; who: Who; type: StatusType }
  | { t: 'armor'; who: Who; delta: number; total: number; reason: string }
  | { t: 'hp'; who: 'player'; delta: number; hp: number; reason: 'heal' | 'self' | 'reroll' | 'maxHp' }
  | { t: 'purify'; removed: StatusType[]; junk?: { id: string; where: string; uid?: number } }
  | { t: 'reap'; kind: 'kill' | 'block' }
  | { t: 'spent'; uids: number[] }
  | { t: 'enemyTurn'; turn: number }
  | { t: 'enemyMove'; uid: number; distance: number }
  | { t: 'enemyAct'; uid: number; kind: 'attack' | 'skill' | 'defend' | 'frozen' | 'curse'; desc?: string; value?: number }
  | { t: 'playerHit'; from: number | null; dmg: number; byArmor: number; hpDmg: number; isDot: boolean; perfectBlock: boolean }
  | { t: 'junk'; id: string; from: number }
  | { t: 'summon'; by: number; uid: number }
  | { t: 'phase'; uid: number; phaseIdx: number }
  | { t: 'death'; uid: number; direct: boolean; overkill: number; gold: number }
  | { t: 'victory'; gold: number; relicChoices: string[] }
  | { t: 'defeat' };

export type BattleEventType = BattleEvent['t'];
