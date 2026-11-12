// Run2: one run of the prototype slice (SPEC 3.6): normal → elite → shop (or camp) → mid boss. Owns RunState between fights:
// HP, gold, xp / level, loadout (tablet rows and their levels), talents, relics, potions. Rules only; deterministic per seed.
import { createRng, type Rng } from '../rng';
import { Battle2, type FightKind } from './battle2';
import { CLASSES, ECON, PROTO_RELICS, TABLETS, TALENTS, TALENT_FILLERS, addableRows, loadoutA, loadoutB, relicV2, rowDef, slotRow, xpToNext } from './data';
import type { ClassId, Level, Loadout, RowSlot } from './types';

export type NodeKind = 'normal' | 'elite' | 'shop' | 'camp' | 'midBoss';
export interface RunNode { kind: NodeKind; waves?: string[][] }

export const SLICE_NODES: RunNode[] = [
  { kind: 'normal', waves: [['forest_ghoul'], ['forest_ghoul', 'forest_ghoul']] },
  { kind: 'elite', waves: [['elite_alpha_wolf', 'forest_ghoul']] },
  { kind: 'shop' },
  { kind: 'midBoss', waves: [['boss_lich_forest']] },
];

export interface RunState {
  seed: number; classId: ClassId;
  hp: number; maxHp: number; gold: number;
  xp: number; level: number; pendingLevelUps: number;
  loadout: Loadout;
  talents: Record<string, 1 | 2>;
  relics: string[];
  chapter: 1; node: number;
  potions: number;
  phase: 'battle' | 'choice' | 'shop' | 'camp' | 'win' | 'dead';
  nodes: RunNode[];
  /** pending choices, first = current */
  queue: Choice[];
  shop: ShopItem[] | null; shopBought: { potions: number; engrave: number; refresh: number };
  log: string[];
}

export type LevelCard =
  | { kind: 'addRow'; tablet: number; rowId: string; borrowed: boolean }
  | { kind: 'upgrade'; tablet: number; slot: number; from: Level }
  | { kind: 'evolve'; tablet: number; slot: number; options: [string, string] };
export type Choice =
  | { kind: 'levelUp'; cards: LevelCard[] }
  | { kind: 'talent'; options: Array<{ id: string; level: 1 | 2 }> }
  | { kind: 'relic'; options: string[] };
export type ShopItem =
  | { kind: 'relic'; id: string; price: number; sold: boolean; sale?: boolean }
  | { kind: 'potion'; price: number; sold: boolean }
  | { kind: 'engrave'; price: number; tablet: number; slot: number; sold: boolean };
export interface BattleReward { result: 'win' | 'lose'; gold: number; xp: number; levelUps: number }

export interface Run2Options {
  seed: number; classId: ClassId; tablet?: string; version?: 'A' | 'B'; nodes?: RunNode[]; full?: boolean;
  /** start state overrides (SPEC §7「成型构筑」: full rows, level II, 2 talents, 3 relics) */
  rowLevel?: Level; talents?: Record<string, 1 | 2>; relics?: string[];
}

export class Run2 {
  s: RunState;
  rng: Rng;
  battle: Battle2 | null = null;

  constructor(o: Run2Options) {
    const cls = CLASSES[o.classId];
    this.rng = createRng((o.seed * 7919 + 17) >>> 0);
    const loadout = o.version === 'A' ? loadoutA(o.classId) : loadoutB(o.tablet || cls.tablets[0], { full: o.full, level: o.rowLevel });
    this.s = {
      seed: o.seed, classId: o.classId, hp: cls.hp, maxHp: cls.hp, gold: ECON.startGold, xp: 0, level: 1, pendingLevelUps: 0,
      loadout, talents: { ...(o.talents || {}) }, relics: (o.relics || []).slice(), chapter: 1, node: 0, potions: 0,
      phase: 'battle', nodes: (o.nodes || SLICE_NODES).map(n => ({ ...n })), queue: [], shop: null, shopBought: { potions: 0, engrave: 0, refresh: 0 }, log: [],
    };
    this.enterNode();
  }

  node(): RunNode & { idx: number } { return { idx: this.s.node, ...this.s.nodes[this.s.node] }; }
  pending(): Choice | null { return this.s.queue[0] || null; }

  /** Battle for the current node (creates it on first call). */
  startBattle(): Battle2 {
    const n = this.s.nodes[this.s.node];
    if (!n.waves) throw new Error('not a battle node');
    if (this.battle) return this.battle;
    const kind: FightKind = n.kind === 'normal' ? 'normal' : n.kind === 'elite' ? 'elite' : 'midBoss';
    this.battle = new Battle2({
      seed: (this.s.seed * 1000003 + this.s.node * 7717) >>> 0, classId: this.s.classId, loadout: structuredClone(this.s.loadout),
      talents: { ...this.s.talents }, relics: this.s.relics.slice(), hp: this.s.hp, maxHp: this.s.maxHp, waves: n.waves, kind,
    });
    return this.battle;
  }

  /** Write the fight result back and queue the rewards. */
  endBattle(b: Battle2 = this.battle!): BattleReward {
    const s = this.s, n = s.nodes[s.node];
    this.battle = null;
    if (b.s.result !== 'win') { s.hp = 0; s.phase = 'dead'; return { result: 'lose', gold: 0, xp: 0, levelUps: 0 }; }
    s.hp = Math.max(1, b.s.player.hp);
    s.gold += b.s.goldEarned;
    const lv = this.addXp(b.s.xpEarned);
    if (n.kind === 'elite' || n.kind === 'midBoss') this.queueTalent();
    if (n.kind === 'midBoss') this.queueRelic();
    s.log.push(`node ${s.node} ${n.kind}: +${b.s.goldEarned} gold +${b.s.xpEarned} xp, hp ${s.hp}`);
    if (s.queue.length) s.phase = 'choice'; else this.advance();
    return { result: 'win', gold: b.s.goldEarned, xp: b.s.xpEarned, levelUps: lv };
  }

  addXp(n: number): number {
    const s = this.s; s.xp += n; let ups = 0;
    while (s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; ups++; this.queueLevelUp(); }
    return ups;
  }

  // ───────────────────────────── choices
  choose(index: number, sub = 0): { ok: boolean; reason?: string } {
    const c = this.s.queue[0]; if (!c) return { ok: false, reason: '没有待选项' };
    const s = this.s;
    if (c.kind === 'levelUp') {
      const card = c.cards[index]; if (!card) return { ok: false, reason: '没有这张卡' };
      const t = s.loadout.tablets[card.tablet];
      if (card.kind === 'addRow') t.slots.push({ rowId: card.rowId, level: 1, borrowed: card.borrowed || undefined });
      else if (card.kind === 'upgrade') t.slots[card.slot].level = Math.min(3, t.slots[card.slot].level + 1) as Level;
      else t.slots[card.slot].evolvedTo = card.options[sub === 1 ? 1 : 0];
    } else if (c.kind === 'talent') {
      const o = c.options[index]; if (!o) return { ok: false, reason: '没有这个天赋' };
      if (o.id === TALENT_FILLERS.grind.id) this.addXp(TALENT_FILLERS.grind.xp);
      else if (o.id === TALENT_FILLERS.gold.id) s.gold += TALENT_FILLERS.gold.gold;
      else s.talents[o.id] = o.level;
    } else {
      const id = c.options[index]; if (!id) return { ok: false, reason: '没有这个遗物' };
      s.relics.push(id);
    }
    s.queue.shift();
    if (!s.queue.length && s.phase === 'choice') this.advance();
    return { ok: true };
  }

  private queueLevelUp() {
    const s = this.s, cards: LevelCard[] = [];
    // version B edits tablet 0; version A: the "add row" card swaps the other row in (SPEC 2.4), kept simple: upgrades / evolves only
    const slots: Array<{ tablet: number; slot: number; sl: RowSlot }> = [];
    s.loadout.tablets.forEach((t, ti) => t.slots.forEach((sl, si) => slots.push({ tablet: ti, slot: si, sl })));
    const upg = () => { const c = slots.filter(x => x.sl.level < 3 && !cards.some(k => k.kind === 'upgrade' && k.tablet === x.tablet && k.slot === x.slot)); return c.length ? this.rng.pick(c) : null; };
    const t0 = s.loadout.tablets[0], tdef = TABLETS[t0.tabletId];
    // left: add a row
    const add = s.loadout.version === 'B' && t0.slots.length < tdef.maxRows ? addableRows(t0.tabletId, t0.slots) : [];
    if (add.length) { const a = this.rng.pick(add); cards.push({ kind: 'addRow', tablet: 0, rowId: a.rowId, borrowed: a.borrowed }); }
    else { const u = upg(); if (u) cards.push({ kind: 'upgrade', tablet: u.tablet, slot: u.slot, from: u.sl.level }); }
    // middle: upgrade
    const u2 = upg(); if (u2) cards.push({ kind: 'upgrade', tablet: u2.tablet, slot: u2.slot, from: u2.sl.level });
    // right: evolve
    const ev = slots.filter(x => x.sl.level === 3 && !x.sl.evolvedTo);
    if (ev.length) { const e = this.rng.pick(ev); const d = rowDef(e.sl.rowId); cards.push({ kind: 'evolve', tablet: e.tablet, slot: e.slot, options: [d.evolutions[0].id, d.evolutions[1].id] }); }
    else { const u3 = upg(); if (u3) cards.push({ kind: 'upgrade', tablet: u3.tablet, slot: u3.slot, from: u3.sl.level }); }
    if (cards.length) { s.queue.push({ kind: 'levelUp', cards }); s.pendingLevelUps++; }
  }
  private queueTalent() {
    const s = this.s;
    // v2.1 3.5: only talents valid for the current loadout; fill with 磨炼 (+40 xp); none valid → also +30 金
    const pool = TALENTS.filter(t => t.classId === s.classId && (s.talents[t.id] || 0) < 2 && t.validFor(s.loadout)).map(t => ({ id: t.id, level: ((s.talents[t.id] || 0) + 1) as 1 | 2 }));
    const options = this.rng.shuffle(pool).slice(0, 3);
    const none = !options.length;
    while (options.length < 3) options.push({ id: TALENT_FILLERS.grind.id, level: 1 });
    if (none) options.push({ id: TALENT_FILLERS.gold.id, level: 1 });
    s.queue.push({ kind: 'talent', options });
  }
  private queueRelic() {
    const s = this.s;
    const pool = PROTO_RELICS.filter(r => !s.relics.includes(r.id) && (!r.classId || r.classId === s.classId)).map(r => r.id);
    if (pool.length) s.queue.push({ kind: 'relic', options: this.rng.shuffle(pool).slice(0, 3) });
  }

  // ───────────────────────────── shop
  /** v2.1 3.3 prototype shop: 4 fixed slots — sale relic 42, relic 70, potion 35, engrave → II 50 (relics from the 4.4 pool) */
  private makeShop(): ShopItem[] {
    const s = this.s;
    const pool = this.rng.shuffle(PROTO_RELICS.filter(r => !s.relics.includes(r.id) && (!r.classId || r.classId === s.classId)));
    const items: ShopItem[] = [];
    if (pool[0]) items.push({ kind: 'relic', id: pool[0].id, price: ECON.salePrice, sold: false, sale: true });
    if (pool[1]) items.push({ kind: 'relic', id: pool[1].id, price: ECON.relicPrice[pool[1].rarity], sold: false });
    items.push({ kind: 'potion', price: ECON.potionPrice, sold: false });
    const up = s.loadout.tablets.flatMap((t, ti) => t.slots.map((sl, si) => ({ ti, si, sl }))).filter(x => x.sl.level < 3);
    if (up.length) { const x = this.rng.pick(up); items.push({ kind: 'engrave', tablet: x.ti, slot: x.si, price: ECON.engravePrice[x.sl.level - 1], sold: false }); }
    return items;
  }
  shop(): ShopItem[] { return this.s.shop || []; }
  buy(i: number): { ok: boolean; reason?: string } {
    const s = this.s; const it = s.shop?.[i]; if (!it || s.phase !== 'shop') return { ok: false, reason: '不在商店' };
    if (it.sold) return { ok: false, reason: '已售出' };
    if (s.gold < it.price) return { ok: false, reason: '金币不够' };
    s.gold -= it.price;
    if (it.kind === 'relic') { s.relics.push(it.id); it.sold = true; }
    else if (it.kind === 'potion') { s.potions++; s.shopBought.potions++; it.price += ECON.potionStep; }
    else { const sl = s.loadout.tablets[it.tablet].slots[it.slot]; sl.level = Math.min(3, sl.level + 1) as Level; s.shopBought.engrave++; it.sold = true; }
    return { ok: true };
  }
  refreshShop(): { ok: boolean; reason?: string } {
    const s = this.s; if (s.phase !== 'shop') return { ok: false, reason: '不在商店' };
    const price = ECON.refreshPrice + ECON.refreshStep * s.shopBought.refresh;
    if (s.gold < price) return { ok: false, reason: '金币不够' };
    s.gold -= price; s.shopBought.refresh++; s.shop = this.makeShop(); return { ok: true };
  }
  /** drink a potion between fights (25% max HP) */
  drink(): boolean { const s = this.s; if (!s.potions) return false; s.potions--; s.hp = Math.min(s.maxHp, s.hp + Math.ceil(s.maxHp * ECON.potionHealPct)); return true; }

  // ───────────────────────────── camp
  campOptions() { return [{ kind: 'rest' as const, hp: Math.ceil(this.s.maxHp * ECON.campRestPct) }, { kind: 'train' as const, xp: ECON.campTrainXp }, { kind: 'reforge' as const, to: this.otherTablet() }]; }
  camp(kind: 'rest' | 'train' | 'reforge'): { ok: boolean } {
    const s = this.s; if (s.phase !== 'camp') return { ok: false };
    if (kind === 'rest') s.hp = Math.min(s.maxHp, s.hp + Math.ceil(s.maxHp * ECON.campRestPct));
    else if (kind === 'train') this.addXp(ECON.campTrainXp);
    else this.reforge();
    if (s.queue.length) s.phase = 'choice'; else this.advance();
    return { ok: true };
  }
  private otherTablet() { const id = this.s.loadout.tablets[0].tabletId; return CLASSES[this.s.classId].tablets.find(t => t !== id)!; }
  /** 改修: keep each slot's level; start rows → new start rows; added slots re-picked from the new pool; evolutions re-chosen (first option). */
  private reforge() {
    const s = this.s; if (s.loadout.version !== 'B') return;
    const t = s.loadout.tablets[0], to = TABLETS[this.otherTablet()];
    const old = t.slots; const slots: RowSlot[] = [];
    old.forEach((sl, i) => {
      let rowId: string;
      if (i < to.startRows.length) rowId = to.startRows[i];
      else { const c = addableRows(to.id, slots).filter(a => !a.borrowed); rowId = c.length ? c[0].rowId : to.startRows[0]; }
      const d = rowDef(rowId);
      slots.push({ rowId, level: sl.level, evolvedTo: sl.evolvedTo ? d.evolutions[0].id : undefined });
    });
    s.loadout.tablets[0] = { tabletId: to.id, slots };
  }

  /** Leave a shop / camp node. */
  next() { const s = this.s; if (s.phase === 'shop' || s.phase === 'camp') this.advance(); }

  private advance() {
    const s = this.s;
    s.node++;
    if (s.node >= s.nodes.length) { s.phase = 'win'; return; }
    this.enterNode();
  }
  private enterNode() {
    const s = this.s, n = s.nodes[s.node];
    if (n.kind === 'shop') { s.phase = 'shop'; s.shop = this.makeShop(); s.shopBought = { potions: 0, engrave: 0, refresh: 0 }; }
    else if (n.kind === 'camp') s.phase = 'camp';
    else s.phase = 'battle';
  }

  /** Row names on the tablet, for UI / logs. */
  boardNames(): string[] { return this.s.loadout.tablets.flatMap(t => t.slots.map(sl => `${slotRow(sl).name}${'I'.repeat(sl.level)}`)); }
  relicNames(): string[] { return this.s.relics.map(id => relicV2(id).name); }
}
