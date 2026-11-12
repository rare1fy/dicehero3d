// Rules v2 types (SPEC_v2 §6). Plain data only: no three.js, no DOM. Data tables live in ./data/*, logic in cond.ts / battle2.ts / run2.ts.

export type ClassId = 'warrior' | 'mage' | 'rogue';
export type Suit =
  | 'axe' | 'blood' | 'fury'
  | 'star' | 'moon' | 'sun' | 'void'
  | 'poison' | 'blade' | 'shadow'
  | 'none';

export interface Face { value: number; suit: Suit }

export type DieKind = 'normal' | 'furyDie' | 'titanDie' | 'starDie' | 'shadowDie' | 'cracked' | 'cursed';
/** turn: gone at turn end · untilUsed: may stay one more turn (fury die, shadow die) · retained: mage chant keeps it */
export type Persist = 'turn' | 'untilUsed' | 'retained';
export type DieSource = 'base' | 'earned' | 'mechanic' | 'enemy';

export interface Die {
  uid: number; kind: DieKind; face: Face;
  persist: Persist; source: DieSource;
  /** turns this die has already been carried over (fury die: max 1, or 2 with 余烬怒火) */
  carried: number;
}

// ── conditions and tiers ─────────────────────────────────
export type Condition =
  | { t: 'suit'; suit: Suit; companions?: number }
  | { t: 'sameValue' }
  | { t: 'straight' }
  | { t: 'allAtLeast'; value: number }
  | { t: 'everyValuePaired' }
  | { t: 'suitMix'; need: Partial<Record<Suit, number>>; atLeast?: boolean }
  | { t: 'twoPair' } | { t: 'fullHouse' }
  /** 千钧: hand in n dice whose points sum to at least byCount[n] */
  | { t: 'sumAtLeast'; byCount: Record<number, number> }
  /** 元素交汇: ≥ minDice dice, at least minSuits suits with ≥ perSuit dice each; other dice may ride along */
  | { t: 'mixedRelease'; minDice: number; minSuits: number; perSuit: number }
  | { t: 'any'; min: number; max: number };

/** Tier ids. v2.1: each row writes its own steps (count → tier); the names are ids only, `ultimate` = 终极特权. */
export type TierName = 'single' | 'feed' | 'area' | 'earn' | 'ultimate';
export const TIER_ORDER: TierName[] = ['single', 'feed', 'area', 'earn', 'ultimate'];

/** One lamp on the row: from `min` dice handed in, the row plays `tier`. */
export interface TierStep { min: number; tier: TierName; label: string }
export interface TierRule {
  /** ascending by min; steps[0].min is the row's minimum dice */
  steps: TierStep[];
  /** combo rows: exactly this many dice */
  fixedCount?: number;
  /** counted dice bonus (降维: straight counts one longer) */
  countBonus?: number;
  /** max dice that can be handed in */
  maxDice?: number;
}

// ── effects ──────────────────────────────────────────────
export type Target = 'one' | 'all' | 'adjacent' | 'others' | 'second';
export type StatusV2 = 'poison' | 'burn' | 'freeze' | 'stun' | 'vulnerable' | 'weak' | 'berserk';
export interface Status { type: StatusV2; value: number; duration?: number }

export type Effect =
  /** damage = (X × coef × mul + flat) × bonus × modifiers */
  | { t: 'dmg'; target: Target; mul?: number; flat?: number; ignoreArmor?: boolean; armorBreak?: boolean; raw?: boolean }
  /** armor = X × coef2 × mul (of 'coef2'), points of one suit × mul, or a flat mul */
  | { t: 'armor'; mul: number; of: 'coef2' | 'suitPoints' | 'flat'; suit?: Suit }
  | { t: 'barrier'; mul: number }
  | { t: 'heal'; mul: number; of: 'X' | 'dmg' | 'suitPoints' | 'flat'; suit?: Suit; overArmor?: number }
  /** value, or X × ofX when ofX is set */
  | { t: 'status'; status: StatusV2; value: number; ofX?: number; duration?: number; target: Target | 'self' }
  | { t: 'stun'; target: Target; look?: 'freeze' | 'stun'; turns?: number; elseWeak?: number }
  | { t: 'taunt' }
  | { t: 'purify'; n: number }
  | { t: 'earnDie' }
  | { t: 'capUp'; which: 'behead' | 'guard'; n: number }
  | { t: 'rage'; n: number }
  | { t: 'freeBlood' }
  | { t: 'spawnShadow'; n: number }
  | { t: 'extraStrike'; n: number }
  | { t: 'resonance'; n: number }
  | { t: 'hook'; id: string; p?: Record<string, number> };

export interface Tier { effects: Effect[]; coefMul?: number; coefAdd?: number }

export type Level = 1 | 2 | 3;
export interface EvoDef {
  id: string; name: string; desc: string;
  /** returns the evolved row (pure function over data) */
  apply: (r: RowDef) => RowDef;
  /** false = data only, the engine does not implement the special part yet */
  implemented: boolean;
}
export interface RowDef {
  id: string; name: string; classId: ClassId;
  cond: Condition; tierRule: TierRule;
  strike?: 'first' | 'second';
  tiers: Partial<Record<TierName, Tier>>;
  coef: [number, number, number];
  /** second coefficient (axe row armor) */
  coef2?: [number, number, number];
  /** flags read by the engine (e.g. 'execute30', 'bolts') with numeric params */
  flags?: Record<string, number>;
  evolutions: [EvoDef, EvoDef];
  tags: Array<'suit' | 'point' | 'tool'>;
  /** short UI hint: condition icon kind */
  icon: { kind: 'suit' | 'same' | 'straight' | 'atLeast' | 'sum' | 'pairs' | 'mix' | 'twoPair' | 'fullHouse' | 'one'; suit?: Suit; suits?: Suit[]; value?: number };
}

export interface TabletDef {
  id: string; classId: ClassId; name: string; style: 'suit' | 'point';
  /** 动作逻辑 (v2.1) */
  question: string;
  startRows: string[];
  pool: string[];
  maxRows: number;
  allowBorrow: boolean;
  /** the other tablet whose rows may be borrowed (1 slot) */
  borrowFrom?: string;
  /** prototype tablet (战意 / 星界元素 / 影袭) */
  prototype: boolean;
}

export interface RowSlot { rowId: string; level: Level; evolvedTo?: string; borrowed?: boolean }
export interface TabletInstance { tabletId: string; slots: RowSlot[] }
export interface Loadout { version: 'A' | 'B'; tablets: TabletInstance[] }

export interface TalentDef {
  id: string; classId: ClassId; name: string; desc: [string, string];
  /** v2.1: only offered when it does something for this loadout */
  validFor: (l: Loadout) => boolean;
}

export interface ClassDefV2 {
  id: ClassId; name: string; hp: number;
  suitOf: (value: number) => Suit;
  suitTable: Suit[];            // index = value 1..6 → suit (index 0 unused)
  baseDice: number; maxDice: number;
  freeRerolls: number;
  strikesPerTurn: number; maxStrikes: number;
  leftover: 'dissipate' | 'retain' | 'secondStrike';
  overflow: 'damagePct' | 'discard';
  basicAttack: { minDice: number; maxDice: number; coef: number; name: string; shadowify?: boolean };
  specialDice: DieKind[];
  mechanics: string[];
  earnDieMode: 'nextTurnPlusOne' | 'resonance' | 'strikePlusShadow';
  tablets: string[];
  /** version A starting rows (two single-row tablets) */
  versionA: [string, string];
  talents: TalentDef[];
}

export interface RelicDefV2 {
  id: string; name: string; desc: string; rarity: 'common' | 'uncommon' | 'rare'; classId?: ClassId; tag: string;
  trigger: 'onStrike' | 'onKill' | 'onHit' | 'onTurnStart' | 'onBattleEnd' | 'passive';
  economy?: boolean; perBattleCap?: number;
  /** v2.1 4.2: never offered in the prototype */
  prototypeBanned?: boolean;
  /** v2.1 4.4: in the prototype shop pool */
  prototype?: boolean;
}

// ── enemies ──────────────────────────────────────────────
export interface EnemyAction { type: '攻击' | '技能' | '防御'; baseValue: number; description?: string; scalable?: boolean; curseDice?: string }
export interface EnemyPhase { hpThreshold?: number; actions: EnemyAction[] }
export type EnemyRank = 'normal' | 'summon' | 'elite' | 'eliteMinion' | 'midBoss' | 'boss';
export interface EnemyCfgV2 {
  id: string; name: string; hp: number; dmg: number; ct: string; arch?: string; cat: 'normal' | 'elite' | 'boss';
  phases: EnemyPhase[];
  summons?: { minionId: string; interval: number; offset?: number; count?: number; maxTotal?: number; waveCap?: number; hpThreshold?: number };
  q?: Record<string, string[]>;
}
export interface Enemy {
  uid: number; cfgId: string; name: string; hp: number; maxHp: number; armor: number; attackDmg: number;
  ct: string; arch?: string; cat: 'normal' | 'elite' | 'boss'; rank: EnemyRank;
  statuses: Status[]; distance: number;
  /** turns of freeze / stun immunity left */
  ctlImmune: number;
  /** boss hit by control: next action value halved */
  interrupted: boolean;
  /** set when the enemy skipped its action because of the player's stun (warrior 震慑) */
  skipped: boolean;
  taunted: boolean;
  /** burn does not go out at the next tick (mage sun row while chanting) */
  burnHold: boolean;
  summoned: number; isSummoned: boolean; justSummoned: boolean;
  dead: boolean; phaseIdx: number; vengeance: number; quotedLow: boolean;
  overkill: number; killedDirect: boolean;
  /** enemy turns this enemy has taken part in (action index, summon / junk rhythm) */
  age: number;
}
