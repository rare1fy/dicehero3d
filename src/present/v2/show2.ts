// The v2 slice (#v2): class select → normal fight (2 waves) → elite (狼人首领 + 食尸鬼) → level-up / talent picks → merchant →
// boss (枯骨巫妖) → result. Rules come only from Run2 / Battle2 (core/v2): every action returns events, and every event becomes a
// staged beat (actors, dice, the UI-layer kit from ui3d, the 2D overlay, sound). Live state is read back only at the end of a batch.
import * as THREE from 'three';
import { V3, R, onUpdate, camera as CAMERA } from '../engine/world';
import { wait, anim, animP, ease, lerp, shake, hitstop, slowmo, after, clock, FX } from '../engine/clock';
import { CAM } from '../engine/gfx';
import { shot, staticShot } from '../director';
import { FIELD, simThrow, playThrow } from '../dice/throw';
import { Die3D, throwHooks, flyDie, DICE3D } from '../dice/die3d';
import { fxImpact, fxSparks, fxGlow, fxShield, fxHeal, fxRing, fxSmoke, fxStatus, COL } from '../fx/fx';
import { GRADE } from '../look/post';
import { SCENES } from '../scenes/defs';
import { showStage, type Stage } from '../scenes/stage';
import { BattleActor } from '../bestiary/battle';
import { ROSTER } from '../bestiary/models';
import { UiLayer, worldToUi } from '../ui3d/layer';
import { DiceTray } from '../ui3d/tray';
import { HeartFlask } from '../ui3d/flask';
import { SkillTablet, type RowView } from '../ui3d/tablet';
import { StoneButton, LOOKS } from '../ui3d/buttons';
import { Loot } from '../ui3d/loot';
import { ClassMech } from '../ui3d/classMech';
import { CLASS_COL, type SpecialId, type SuitSkin } from '../ui3d/suitData';
import { cue } from '../../audio/cues';
import { audio } from '../../audio/audio';
import type { Platform } from '../../platform/index';
import type { Battle2, BoardRow, RowRef } from '../../core/v2/battle2';
import { Run2, type Choice, type ShopItem, type LevelCard } from '../../core/v2/run2';
import type { Ev2, GainReason } from '../../core/v2/events2';
import type { ClassId, DieKind, StatusV2 } from '../../core/v2/types';
import { CLASSES, TALENT_FILLERS, talentDef, relicV2, rowDef, slotRow, xpToNext, ECON, enemyCfgV2 } from '../../core/v2/data';
import { Overlay, Pane, Banner, Toast, Screen, panel, icon, ICON, text, textW, pixWrap, PIX_H, type Rect } from './overlay';
import { popPix } from './pix';
import { uiSpecial, tabletRow, BASIC_ROW, lampsFor, recordBotTurn, gotoNode, type BotAct } from './adapt';

const EYE = V3(0.3, 13.4, 14.9), LOOK = V3(0, -0.6, -2.4);
const HERO_POS = V3(-2.0, 0, 3.0), BOSS_POS = V3(0, 0.56, -4.7);
const LANES = [V3(0.9, 0, -2.4), V3(-1.5, 0, -3.0), V3(2.9, 0, -3.2), V3(-3.3, 0, -2.3)];
const TIER_COL = ['#fff2d0', '#7ad0ff', '#ffc848', '#ff8040', '#e070ff'];
const ST_CN: Record<StatusV2, string> = { poison: '毒', burn: '灼', freeze: '冻', stun: '晕', vulnerable: '易伤', weak: '虚弱', berserk: '狂暴' };
const ST_COL: Record<StatusV2, string> = { poison: '#a8ff7a', burn: '#ffaa5a', freeze: '#a8d8ff', stun: '#ffe07a', vulnerable: '#ffaa5a', weak: '#c8c8e0', berserk: '#ff6a5a' };
const GAIN_CN: Record<GainReason, string> = { behead: '斩首', guard: '格挡', stun: '震慑', tier: '高档', resonance: '共鸣', shadow: '残骰', fury: '怒火', furyUlt: '怒火', chant: '吟唱', titan: '泰坦', precise: '精准', mark: '标记' };
const NODE_SCENE: Record<string, string> = { normal: 'n_trail', elite: 'n_lumber', shop: 'c_merchant', midBoss: 'b_lich' };
const NODE_CN: Record<string, [string, string]> = { normal: ['雾林小径', '普通战 · 两波'], elite: ['废弃伐木场', '精英 · 狼人首领'], midBoss: ['墓园祭坛', '首领 · 枯骨巫妖'], shop: ['林边货车', '商人'] };
const CLASS_IDS: ClassId[] = ['warrior', 'mage', 'rogue'];
const CLASS_LINES: Record<ClassId, string[]> = {
  warrior: ['卖血重投，攒血怒', '斩首 / 格挡挣骰子', '骰子溢出变伤害'],
  mage: ['不出手 = 吟唱，骰子留在环上', '屏障挡伤，反噬越叠越深', '攒满一波爆发'],
  rogue: ['一回合两刀', '第一刀后白送一次重投', '精准连击产暗影残骰'],
};
const ROMAN = ['', 'I', 'II', 'III'];
const gainSpecial = (r: GainReason): SpecialId | undefined => (r === 'fury' || r === 'furyUlt' ? 'fury' : r === 'shadow' || r === 'precise' || r === 'mark' ? 'shadowres' : r === 'titan' ? 'titan' : undefined);
const hex = (s: string) => parseInt(s.slice(1), 16);

type Mode = 'select' | 'battle' | 'choice' | 'shop' | 'over';
interface FoeDisp { hp: number; maxHp: number; armor: number; lane: number; boss: boolean }

export class V2Show {
  run: Run2 | null = null; b: Battle2 | null = null; mode: Mode = 'select'; busy = true; flying = false; result: null | 'win' | 'lose' = null;
  L = new UiLayer(); ov = new Overlay();
  tray: DiceTray; flask: HeartFlask; tablet: SkillTablet; end: StoneButton; reroll: StoneButton; loot: Loot; mech: ClassMech;
  banner: Banner; toast: Toast; screen: Screen;
  stage: Stage | null = null; hero: BattleActor | null = null; picks: BattleActor[] = [];
  foes = new Map<number, BattleActor>(); disp = new Map<number, FoeDisp>(); plates = new Map<number, Pane>();
  dice = new Map<number, Die3D>(); sel: number[] = []; keep: number[] | null = null;
  pd = { hp: 1, maxHp: 1, armor: 0, barrier: 0 };
  /** for captures / bot logs: the last staged event and how many of each */
  beatName = ''; beats: Record<string, number> = {}; errors: string[] = []; log: string[] = [];
  private cls: ClassId = 'warrior'; private rows: BoardRow[] = []; private rowPanes: Pane[] = []; private info: Pane; private relicPane: Pane;
  private chain: Promise<void> = Promise.resolve(); private batch: Ev2[] = []; private bi = 0;
  private botOn = false; private botRnd = mulberry(1234); private botBusy = false;
  private pendingGold: { from: number; amount: number; overflow: number } | null = null; private lastDeath = V3(0, 1, -2.5);
  private screenResolve: ((v: number) => void) | null = null;

  constructor(private platform: Platform) {
    const L = this.L, skin: SuitSkin = { cls: 'warrior', scheme: 'A' };
    this.tray = new DiceTray(L, skin, { sizePx: 70, bottom: 70 });
    this.flask = new HeartFlask(L); this.tablet = new SkillTablet(L);
    this.end = new StoneButton(L, LOOKS.end, 'end'); this.reroll = new StoneButton(L, LOOKS.reroll, 'reroll');
    this.loot = new Loot(L, 'warrior'); this.mech = new ClassMech(L, skin);
    this.banner = new Banner(this.ov); this.toast = new Toast(this.ov); this.screen = new Screen(this.ov);
    this.info = this.ov.pane(10); this.relicPane = this.ov.pane(10);
    this.loot.heroAt = () => (this.hero ? this.hero.chest() : V3(-2, 1.2, 3));
    this.tablet.onPick = (i) => this.playRow(i);
    this.end.onTap = () => this.act({ k: 'end' });
    this.reroll.onTap = () => this.act({ k: 'reroll', uids: this.sel.slice() });
    Object.assign(FIELD, { x0: -1.5, x1: 2.3, z0: -1.2, z1: 1.8 });
    throwHooks.impact = (d, v) => { cue('clack', Math.min(1, v / 9)); if (v > 3) fxSmoke(V3(d.root.position.x, 0.06, d.root.position.z), 0x6a6878, 2, { s: 0.2, alpha: 0.3, up: 0.4 }); };
    throwHooks.landed = d => d.fx('land');
    onUpdate((dt) => this.frame(dt));
    platform.onPointer(ev => this.pointer(ev.type, ev.x, ev.y));
    platform.onResize(() => this.layout());
    this.bindKeys();
    this.layout();
    this.classSelect();
  }

  // ------------------------------------------------------------ layout
  layout() {
    const s = this.platform.canvasSize(), dpr = Math.min(this.platform.dpr(), 2), W = s.w, H = s.h, k = Math.min(1, H / 720);
    this.L.resize(W, H, dpr); this.ov.resize(W, H, dpr);
    this.flask.place(96 * k + 10, H - 120 * k, 170 * k);
    this.mech.place(190 * k + 10, H - 64 * k, Math.max(3, 4 * k));
    this.loot.purse = { x: 54 * k + 10, y: 52 * k + 8 }; this.loot.emblem = { x: 230 * k + 10, y: H - 150 * k };
    this.tablet.place(W - 260 * k, H * 0.42, 250 * k);
    this.end.place(W - 58 * k, H * 0.5, 76 * k);
    this.reroll.place(W / 2 + 70 * k * 4.4, H - 70 * k, 70 * k);
    this.tray.sizePx = 70 * k; this.tray.bottom = 70 * k;
    CAM.shift = W > H ? Math.round(H * 0.06) : 0;
    if (this.screen.on) this.reopen?.();
  }
  private reopen: (() => void) | null = null;
  private get k() { return Math.min(1, this.ov.h / 720); }

  // ------------------------------------------------------------ HUD visibility
  private hudBattle(on: boolean) {
    for (const o of [this.tablet.root, this.end.root, this.reroll.root, this.mech.root]) o.visible = on;
    if (!on) { for (let i = 0; i < 8; i++) this.L.text.hide(`tab.${i}`); this.L.text.hide('reroll.badge'); this.L.text.hide('end.badge'); this.tray.clear(); this.mech.setKept([]); for (const p of this.rowPanes) p.visible = false; this.info.visible = false; }
  }
  private hudRun(on: boolean) { this.L.on = on; this.relicPane.visible = on; }

  // ------------------------------------------------------------ class select
  classSelect() {
    this.mode = 'select'; this.result = null; this.botBusy = false; this.cleanupWorld(); GRADE.desat = 0;
    this.hudRun(false); this.hudBattle(false);
    this.stage = showStage(SCENES.find(s => s.id === 'n_trail')!);
    this.picks = CLASS_IDS.map((c, i) => { const a = new BattleActor(c); a.place(V3(-3.4 + i * 3.4, 0, 0.6)); a.faceToward(V3(-3.4 + i * 3.4, 0, 12)); return a; });
    shot('select', staticShot(V3(0, 3.6, 10.5), V3(0, 1.6, 0), 40), { cut: true });
    const open = () => {
      const ov = this.ov, k = this.k, W = ov.w, H = ov.h, cw = Math.min(360, W * 0.3), ch = 210 * k + 40;
      this.screen.open(0);
      this.screen.add('title' + W, { x: W / 2 - 300, y: 18 * k, w: 600, h: 70 * k + 20 }, (g, d, w) => { text(g, '选择职业', w / 2, 10 * d, Math.round(ov.fp * 2 * d), '#ffe6a0', 'center'); });
      CLASS_IDS.forEach((c, i) => {
        const x = W / 2 + (i - 1) * (cw + 24 * k) - cw / 2, y = H - ch - 24 * k;
        this.screen.button('cls' + i, { x, y, w: cw, h: ch }, (g, d, w, h) => {
          const u = ov.fp / 2; panel(g, 0, 0, w, h, 3 * d, { body: '#1a1422', rim: CLASS_COL[c], line: '#07050a', hi: '#2a2234' });
          const s2 = Math.max(1, Math.round(2 * u * d)), s1 = Math.max(1, Math.round(1.5 * u * d)) ;
          text(g, CLASSES[c].name, w / 2, 14 * d, s2, '#fff2d8', 'center');
          text(g, `生命 ${CLASSES[c].hp}`, w / 2, 14 * d + PIX_H * s2 + 6 * d, s1, '#ff9a8a', 'center');
          let yy = 14 * d + PIX_H * (s2 + s1) + 18 * d;
          for (const ln of CLASS_LINES[c]) {
            icon(g, ICON.star, 16 * d, yy + 2 * d, s1 * 1.0, { main: CLASS_COL[c] });
            for (const part of pixWrap(ln, (w - 16 * d - 14 * s1 - 12 * d) / s1)) { text(g, part, 16 * d + 14 * s1, yy, s1, '#e8dcc8'); yy += PIX_H * s1 + 4 * d; }
            yy += 2 * d;
          }
        }, () => this.pick(c));
      });
    };
    this.reopen = open; open();
  }

  pick(c: ClassId, seed = (Date.now() % 100000) | 0) {
    this.screen.close(); this.reopen = null; cue('select', 0.8); void audio.unlock().then(() => audio.playMusic('bgm_battle', 0.6));
    this.cls = c; this.run = new Run2({ seed, classId: c }); this.result = null;
    const skin: SuitSkin = { cls: c, scheme: 'A' };
    this.tray.skin = skin; this.mech.setClass(c); this.mech.setSkin(skin); this.loot.setClass(c);
    this.loot.gold = this.loot.shownGold = this.run.s.gold; this.loot.level = this.run.s.level; this.loot.xp = this.loot.shownXp = this.run.s.xp; this.loot.xpMax = xpToNext(this.run.s.level);
    this.log.push(`pick ${c} seed ${seed}`);
    void this.nextNode();
  }

  // ------------------------------------------------------------ nodes
  private cleanupWorld() {
    for (const d of [...this.dice.values()]) d.dispose(); this.dice.clear(); this.sel = []; this.keep = null;
    for (const a of this.foes.values()) a.dispose(); this.foes.clear(); this.disp.clear();
    for (const p of this.plates.values()) this.ov.drop(p); this.plates.clear();
    for (const a of this.picks) a.dispose(); this.picks = [];
    this.hero?.dispose(); this.hero = null;
    for (const o of [...DICE3D]) if (o.mode === 'rest' || o.mode === 'play' || o.mode === 'fly') o.dispose();
  }
  private setStage(id: string) {
    this.cleanupWorld();
    this.stage = showStage(SCENES.find(s => s.id === id)!);
    this.hero = new BattleActor(this.cls); this.hero.place(HERO_POS.clone(), Math.PI); this.hero.faceToward(V3(0, 0, -3));
    shot('battle', staticShot(EYE, LOOK, 42), { cut: true });
  }
  async nextNode(): Promise<void> {
    const run = this.run!; const ph = run.s.phase;
    if (ph === 'win') return this.resultScreen(true);
    if (ph === 'dead') return this.resultScreen(false);
    if (ph === 'shop') return this.enterShop();
    if (ph === 'choice') { await this.choices(); return this.nextNode(); }
    return this.enterBattle();
  }
  private enterBattle() {
    const run = this.run!, node = run.node();
    this.mode = 'battle'; this.setStage(NODE_SCENE[node.kind] || 'n_trail');
    this.hudRun(true); this.hudBattle(true);
    const b = run.startBattle(); this.b = b;
    this.rows = b.rows().slice(); this.tablet.setRows([...this.rows.map(tabletRow), { ...BASIC_ROW, id: 'basic' }]);
    for (const p of this.rowPanes) this.ov.drop(p); this.rowPanes = [...this.rows, null].map(() => this.ov.pane(8));
    this.pd = { hp: b.s.player.hp, maxHp: b.s.player.maxHp, armor: 0, barrier: 0 };
    this.flask.set({ ...this.pd }); this.mech.setRage(0); this.mech.setChant(0); this.mech.setStrikes(0); this.mech.setKept([]);
    this.tray.fill(3);
    const [t, sub] = NODE_CN[node.kind] || ['', '']; this.banner.show(t, sub, 1.4);
    this.log.push(`node ${node.idx} ${node.kind}`);
    after(0.9, () => this.runEvents(b.start()));
  }

  // ------------------------------------------------------------ the event queue
  private runEvents(evs: Ev2[]) {
    this.busy = true; this.refresh();
    this.chain = this.chain.then(async () => {
      this.batch = evs;
      for (let i = 0; i < evs.length; i++) {
        this.bi = i; const e = evs[i]; this.beatName = e.t; this.beats[e.t] = (this.beats[e.t] || 0) + 1;
        try { await this.beat(e); } catch (err) { const m = '[beat] ' + e.t + ' ' + ((err as Error).stack || err); this.errors.push(m); this.platform.log(m); }
      }
      this.batch = [];
      await this.afterBatch();
    });
    return this.chain;
  }
  private async afterBatch() {
    const b = this.b; if (!b || this.mode !== 'battle') return;
    if (b.s.result) { await wait(0.9); await this.battleOver(); return; }
    this.syncLive(); this.busy = false; this.syncPreview(); this.refresh();
  }
  /** after a batch: the plates, flask and mech take the live values (the beats only tracked deltas) */
  private syncLive() {
    const b = this.b!, p = b.s.player;
    this.pd = { hp: p.hp, maxHp: p.maxHp, armor: p.armor, barrier: p.barrier }; this.flask.set({ ...this.pd });
    for (const [uid, d] of this.disp) { const e = b.enemy(uid); if (e) { d.hp = e.hp; d.maxHp = e.maxHp; d.armor = e.armor; } }
    this.mech.setRage(p.rage); this.mech.setChant(b.s.chantRing); this.mech.setStrikes(b.s.strikesUsed, b.s.comboThisTurn);
  }

  act(a: BotAct) {
    const b = this.b; if (!b || this.mode !== 'battle' || this.busy) return false;
    const r = a.k === 'reroll' ? b.reroll(a.uids) : a.k === 'play' ? b.play(a.ref, a.uids, a.target, a.mark ? { mark: a.mark } : undefined) : b.endTurn(this.keep ? { keep: this.keep } : undefined);
    if (!r.ok) { this.toast.show(r.reason, 1.0); cue('deny', 0.5); return false; }
    if (a.k !== 'end') this.clearSel(); else this.keep = null;
    this.runEvents(r.events); return true;
  }
  private playRow(i: number) {
    const b = this.b; if (!b || this.busy) return;
    const ref: RowRef = i >= this.rows.length ? 'basic' : this.rows[i].ref;
    const t = b.target(); this.act({ k: 'play', ref, uids: this.sel.slice(), target: t ? t.uid : undefined });
  }

  private async beat(e: Ev2): Promise<void> {
    const b = this.b!;
    switch (e.t) {
      case 'battleStart': if (e.wave > 0) { this.banner.show(`第 ${e.wave + 1} 波`, '', 0.9); await wait(0.5); } return;
      case 'enemyEnter': return this.spawnFoe(e.uid, e.summonedBy);
      case 'quote': {
        const a = this.foes.get(e.uid), en = b.enemy(e.uid); if (!a || !en || (e.kind !== 'enter' && e.kind !== 'death')) return;
        const lines = enemyCfgV2(en.cfgId).q?.[e.kind]; const ln = lines?.[e.index];
        if (ln && (en.rank !== 'normal' && en.rank !== 'summon')) { popPix(ln, a.head().add(V3(0, 0.6, 0)), { h: 0.32, life: 2.0, rise: 0.3, color: '#ffe0c8' }); if (e.kind === 'enter') { a.roar(); cue('roar', 0.6); await wait(0.6); } }
        return;
      }
      case 'turnStart': {
        this.mech.setStrikes(0); this.keep = null;
        if (e.turn > 1) this.toast.show(`第 ${e.turn} 回合 · ${e.diceCount} 颗骰`, 0.8, '#ffe8c0');
        shot('battle', staticShot(EYE, LOOK, 42), { speed: 2 });
        if (e.overflow > 0) { popPix(`溢出 ${e.overflow} 颗 → 加伤`, this.hero!.head().add(V3(0, 0.8, 0)), { color: '#ff9a6a', h: 0.34, life: 1.4 }); }
        return;
      }
      case 'roll': return this.onRoll(e);
      case 'reroll': {
        if (e.hpCost > 0) { this.hero!.bleed(); fxSparks(this.hero!.chest(), 0xff2020, 18, 4, { life: 0.5, grav: 6 }); GRADE.flashCol.set(0.5, 0, 0); this.flash(0.16); }
        for (const u of e.uids) { const d = this.dice.get(u); if (d) { d.glow = 0; d.lift = 0; fxSparks(d.root.position, e.free ? 0x8ad8ff : 0xff3030, 8, 3, { life: 0.4 }); } }
        cue('whoosh', 0.5); return;
      }
      case 'rowPlay': return this.presentPlay(e);
      case 'spent': {
        for (const u of e.uids) { const d = this.dice.get(u); if (d) { fxSparks(d.root.position, 0xffe0a0, 6, 2, { life: 0.3 }); d.dispose(); this.dice.delete(u); } }
        return;
      }
      case 'hit': return this.impact(e);
      case 'statusAdd': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.status.type);
        popPix(`${ST_CN[e.status.type]}${e.status.value > 1 ? ' ' + e.status.value : ''}`, a.head().add(V3(0.5, 0.4, 0)), { color: ST_COL[e.status.type], h: 0.36, life: 1.1 });
        await wait(0.18); return;
      }
      case 'statusTick': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.type); a.tint(e.type === 'burn' ? 0xff7a20 : 0x7aff4a, 0.8);
        popPix(`-${e.dmg}`, a.head(), { color: ST_COL[e.type], h: 0.5 });
        if (e.who === 'player') { this.pd.hp = Math.max(0, this.pd.hp - e.dmg); this.flask.hit(e.dmg, { hp: this.pd.hp }); }
        await wait(0.3); return;
      }
      case 'statusExpire': return;
      case 'armor': {
        if (e.who === 'player') { if (e.delta > 0) { fxShield(this.hero!.home, 1.0); popPix(`护甲 +${e.delta}`, this.hero!.head().add(V3(0.4, 0.3, 0)), { color: '#9ad0ff', h: 0.38 }); } this.pd.armor = e.total; this.flask.set({ armor: e.total }); if (e.delta > 0) await wait(0.2); return; }
        const a = this.foes.get(e.who), d = this.disp.get(e.who); if (d) d.armor = e.total;
        if (a && e.delta > 0) { fxShield(a.home, 1.6); popPix(`护甲 +${e.delta}`, a.head().add(V3(0.5, 0.3, 0)), { color: '#9ad0ff', h: 0.4 }); cue('armor', 0.7); await wait(0.25); }
        else if (a && e.reason === '破甲') { popPix('破甲', a.head().add(V3(-0.6, 0.6, 0)), { color: '#ffb060', h: 0.45 }); cue('block'); }
        return;
      }
      case 'barrier': {
        this.pd.barrier = e.total; this.flask.set({ barrier: e.total });
        if (e.delta > 0) { popPix(`屏障 +${e.delta}`, this.hero!.head().add(V3(-0.4, 0.6, 0)), { color: '#8ad8ff', h: 0.4 }); fxRing(this.hero!.home.clone().add(V3(0, 0.1, 0)), 0x6ab8ff, 1.6, { life: 0.6, width: 0.12 }); await wait(0.25); }
        return;
      }
      case 'hp': {
        this.pd.hp = e.hp;
        if (e.delta > 0) { fxHeal(this.hero!.chest()); popPix(`+${e.delta}`, this.hero!.head(), { color: '#7af09a', h: 0.5 }); this.flask.heal({ hp: e.hp }); }
        else { popPix(`${e.delta}`, this.hero!.head(), { color: '#ff6a5a', h: 0.5 }); this.flask.hit(-e.delta, { hp: e.hp }); this.hero!.tint(0xff2020, 0.8); }
        await wait(0.15); return;
      }
      case 'purify': popPix('净化', this.hero!.head().add(V3(0, 0.6, 0)), { color: '#fff4c0', h: 0.4 }); return;
      case 'gainDice': {
        const src = e.from != null && this.foes.get(e.from) ? this.foes.get(e.from)!.chest() : this.hero!.chest();
        popPix(`${GAIN_CN[e.reason]} +${e.n} 骰`, src.clone().add(V3(0, 1.0, 0)), { color: '#ffe08a', h: 0.42, life: 1.3 });
        for (let i = 0; i < e.n; i++) { void this.tray.earn(src, gainSpecial(e.reason)); await wait(0.12); }
        return;
      }
      case 'special': {
        const d = this.dice.get(e.uid);
        if (e.action === 'transform' && d) { d.setSuit(this.skinFor(e.kind)); d.glow = 1; d.glowCol.set(0xff5a10); fxSparks(d.root.position, 0xff6a1a, 18, 4, { life: 0.6 }); popPix('怒火骰', d.root.position.clone().add(V3(0, 0.7, 0)), { color: '#ff9a40', h: 0.36 }); cue('roar', 0.4); await wait(0.3); }
        else if (e.action === 'vanish' && d) { fxSmoke(d.root.position, 0x6a5a7a, 4, { alpha: 0.4 }); d.dispose(); this.dice.delete(e.uid); }
        return;
      }
      case 'rage': this.mech.setRage(e.stacks); if (e.stacks > 0) popPix(`血怒 ${e.stacks}`, this.hero!.head().add(V3(-0.5, 0.9, 0)), { color: '#ff7a6a', h: 0.36 }); return;
      case 'chant': this.mech.setChant(e.ring); popPix(e.overcharge ? `过充 ${e.overcharge}` : `吟唱 ${e.ring}/3`, this.hero!.head().add(V3(0, 1.0, 0)), { color: '#8ac8ff', h: 0.4 }); fxGlow(this.hero!.chest(), COL.blue, 2, 0.6, 2); await wait(0.3); return;
      case 'backlash': if (e.stacks > 0) popPix(`反噬 ${e.stacks}`, this.hero!.head().add(V3(0.6, 0.4, 0)), { color: '#d080ff', h: 0.36 }); return;
      case 'overload': this.banner.show('过载', `${e.turns} 回合星辰骰`, 1.0, '#a8d8ff'); await wait(0.6); return;
      case 'strikeGain': popPix(`+${e.n} 刀`, this.hero!.head().add(V3(0, 1.0, 0)), { color: '#e0a8ff', h: 0.4 }); return;
      case 'freeReroll': popPix(`免费重投 +${e.n}`, this.hero!.head().add(V3(0.6, 1.2, 0)), { color: '#8ad8ff', h: 0.36 }); cue('magic', 0.3); return;
      case 'enemyTurn': return this.enemyTurnBeat();
      case 'enemyMove': {
        const a = this.foes.get(e.uid), d = this.disp.get(e.uid); if (!a || !d) return;
        const to = this.foePos(d.lane, e.distance, d.boss), from = a.home.clone(); a.walkK = 1; a.faceToward(this.hero!.home);
        await animP(0.5, k => { a.home.lerpVectors(from, to, ease.inOut(k)); }); a.walkK = 0; return;
      }
      case 'enemyAct': return this.enemyAct(e);
      case 'playerHit': return this.playerHit(e);
      case 'junk': return;
      case 'summon': return;   // the minion actor arrives with its enemyEnter (summonedBy)
      case 'phase': {
        const a = this.foes.get(e.uid); if (!a) return;
        a.roar(); cue('roar'); shake(0.6); GRADE.flashCol.set(0.3, 1, 0.6); this.flash(0.4);
        const st = this.stage; anim(1.4, k => st?.phase2(ease.inOut(k)), undefined, { real: true });
        this.banner.show('第二阶段', b.enemy(e.uid)?.name || '', 1.4, '#a8ffc8'); await wait(1.0); return;
      }
      case 'death': return this.death(e.uid);
      case 'gold': this.pendingGold = { from: e.from, amount: e.amount, overflow: e.overflow }; return;
      case 'xp': {
        const g = this.pendingGold && this.pendingGold.from === e.from ? this.pendingGold : { amount: 0, overflow: 0 }; this.pendingGold = null;
        const a = this.foes.get(e.from), at = a ? a.chest() : this.lastDeath.clone();
        this.loot.burst(at, g.amount - g.overflow, e.amount, g.overflow);
        if (g.overflow > 0) popPix(`溢出 +${g.overflow} 金`, at.clone().add(V3(0, 1.4, 0)), { color: '#ffb060', h: 0.38 });
        await wait(0.35); return;
      }
      case 'relic': { let nm = e.id; try { nm = relicV2(e.id).name; } catch { /* unknown */ } this.toast.show(`${nm}  ${e.text}`, 1.0, '#ffe0a0'); cue('relic', 0.6); await wait(0.25); return; }
      case 'waveClear': return this.wavePayoff(e);
      case 'victory': {
        this.hero!.cheer(); cue('win'); this.banner.show('胜  利', `+${e.gold} 金  +${e.xp} 经验`, 1.6, '#fff0b0');
        shot('victory', staticShot(HERO_POS.clone().add(V3(2.6, 3.4, 5.6)), HERO_POS.clone().add(V3(0, 1.2, 0)), 40), { speed: 1.6 });
        await wait(1.4); return;
      }
      case 'defeat': {
        this.hero!.fall(); cue('lose'); slowmo(1.0, 0.3); anim(1.5, k => { GRADE.desat = k * 0.85; }, undefined, { real: true });
        this.banner.show('战  败', '', 1.6, '#d8c8f0'); await wait(1.4); return;
      }
    }
  }

  // ------------------------------------------------------------ dice
  private skinFor(kind: DieKind): SuitSkin { return { cls: this.cls, scheme: 'A', special: uiSpecial(kind) }; }
  private reconcileTray(n: number, sp: Array<SpecialId | undefined>) {
    const t = this.tray; n = Math.min(6, n);
    if (t.count !== n) t.fill(n, sp);
    else t.dice.forEach((d, i) => { if (d.special !== sp[i]) { d.special = sp[i]; d.die.setSuit({ ...t.skin, special: sp[i] }); } });
    for (const d of t.dice) ghost(d.die, false, d.special);
  }
  private async onRoll(e: Extract<Ev2, { t: 'roll' }>) {
    if (e.reason === 'turn') {
      for (const d of [...this.dice.values()]) d.dispose(); this.dice.clear(); this.mech.setKept([]);
      this.reconcileTray(e.dice.length, e.dice.map(d => uiSpecial(d.kind)));
      this.hero!.toss(); await wait(0.12);
      this.flying = true;
      const ds = await this.tray.launch(e.dice.map(d => d.value), { eye: EYE });
      this.flying = false;
      ds.forEach((d, i) => { const s = e.dice[i]; if (!s) { d.dispose(); return; } d.uid = s.uid; this.dice.set(s.uid, d); });
      return;
    }
    if (e.reason === 'flip') { for (const s of e.dice) { const d = this.dice.get(s.uid); if (d) { d.setValue(s.value, d.topIdx, d.topTurns); fxSparks(d.root.position, 0x8ad8ff, 10, 3, { life: 0.4 }); } } return; }
    // reroll / spawn / return: (re)thrown from above the near edge, avoiding the dice at rest
    const ids = new Set(e.dice.map(s => s.uid));
    const kept = [...this.dice.values()].filter(d => d.mode === 'rest' && !ids.has(d.uid!)).map(d => ({ p: d.home.clone(), q: d.homeQ.clone() }));
    const from = V3(lerp(FIELD.x0, FIELD.x1, 0.35), 2.4, FIELD.z1 + 0.9), recs = simThrow(e.dice.length, kept, from); let dur = 0;
    e.dice.forEach((s, i) => {
      let d = this.dice.get(s.uid);
      if (!d) { d = new Die3D('standard', { suit: this.skinFor(s.kind) }); d.uid = s.uid; this.dice.set(s.uid, d); if (e.reason === 'spawn') { d.glow = 0.8; d.glowCol.set(0xb860ff); } }
      else d.setSuit(this.skinFor(s.kind));
      d.root.position.copy(from); playThrow(d, recs[i], s.value, EYE); dur = Math.max(dur, recs[i].rel + recs[i].dur);
    });
    if (e.reason === 'spawn') { popPix('暗影残骰', from.clone().add(V3(0, 0.8, 0)), { color: '#d8a0ff', h: 0.36 }); cue('magic', 0.5); }
    cue('whoosh', 0.6); await wait(dur + 0.05);
  }
  /** next-turn dice in the prep tray: count from nextDice(); dice that depend on how this turn ends are drawn faint (ghost) */
  private syncPreview() {
    const b = this.b!; if (b.s.phase !== 'player') return;
    const nd = b.nextDice(), n = Math.max(0, Math.min(6, nd.count)), t = this.tray;
    const field = b.dice(), sp: Array<SpecialId | undefined> = [];
    const fury = field.filter(d => d.kind === 'furyDie').length + b.s.carry.filter(d => d.kind === 'furyDie').length, shadow = field.filter(d => d.kind === 'shadowDie').length + b.s.carry.filter(d => d.kind === 'shadowDie').length;
    for (let i = 0; i < n; i++) sp.push(undefined);
    let j = n - 1; for (let i = 0; i < fury && j >= 3; i++) sp[j--] = 'fury'; for (let i = 0; i < shadow && j >= 3; i++) sp[j--] = 'shadowres';
    while (t.count > n) void t.drop();
    while (t.count < n) void t.earn(this.hero!.chest(), sp[t.count]);
    t.dice.forEach((d, i) => { if (d.special !== sp[i]) { d.special = sp[i]; d.die.setSuit({ ...t.skin, special: sp[i] }); } });
    // presentation-side reading (see report): mage before the strike keeps the ring only by chanting; fury / shadow dice only carry if unused
    const onField = field.filter(d => d.kind === 'furyDie' || d.kind === 'shadowDie').length;
    const tent = this.cls === 'mage' && b.s.strikesUsed === 0 ? n - 3 : Math.min(Math.max(0, n - 3), onField);
    t.dice.forEach((d, i) => ghost(d.die, i >= n - tent, d.special));
  }
  private clearSel() { for (const u of this.sel) { const d = this.dice.get(u); if (d) { d.lift = 0; d.glow = 0; } } this.sel = []; }
  private setSel(d: Die3D, on: boolean) {
    const u = d.uid!; if (on && !this.sel.includes(u)) this.sel.push(u); if (!on) this.sel = this.sel.filter(x => x !== u);
    d.lift = on ? 1 : 0; d.glow = on ? 1 : 0; d.glowCol.set(0xffd860); cue(on ? 'select' : 'deselect', 0.5); this.refresh();
  }
  selectUids(uids: number[]) { this.clearSel(); for (const u of uids) { const d = this.dice.get(u); if (d) this.setSel(d, true); } }
  private toggleKeep(d: Die3D) {
    const b = this.b!, k = b.keepInfo(); if (!k) return;
    const cur = (this.keep ?? k.selected).slice(), u = d.uid!, i = cur.indexOf(u);
    if (i >= 0) cur.splice(i, 1); else { if (cur.length >= k.cap) cur.shift(); cur.push(u); }
    const r = b.setKeep(cur); if (!r.ok) { this.toast.show(r.reason); return; }
    this.keep = cur; cue('select', 0.4); this.refresh();
  }

  // ------------------------------------------------------------ the play
  private async presentPlay(e: Extract<Ev2, { t: 'rowPlay' }>) {
    const hero = this.hero!, idx = e.ref === 'basic' ? this.rows.length : e.ref, row = e.ref === 'basic' ? null : this.rows[e.ref];
    const lamps = row ? lampsFor(row, e.tier) : 1, tc = TIER_COL[Math.max(0, Math.min(4, lamps - 1 + (e.ultimate ? 4 : 0)))];
    this.tablet.flash(idx);
    const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
    for (const d of ds) { d.glow = 1; d.glowCol.set(hex(tc)); d.lift = 1; }
    const step = row?.def.tierRule.steps.find(s => s.tier === e.tier);
    popPix(e.name + (step && row && row.def.tierRule.steps.length > 1 ? ` ·${lamps}档` : ''), hero.head().add(V3(0.6, 1.1, 0)), { color: tc, h: 0.5, big: e.ultimate, life: 1.4, rise: 0.5 });
    if (e.combo) popPix('精准连击', hero.head().add(V3(0.6, 1.8, 0)), { color: '#e070ff', h: 0.42, life: 1.4 });
    if (e.bonusPct) popPix(`+${e.bonusPct}%`, hero.head().add(V3(-0.6, 1.5, 0)), { color: '#ffb070', h: 0.36 });
    if (this.cls === 'rogue') this.mech.setStrikes(e.strike, e.combo);
    cue('reveal', Math.min(4, lamps)); if (e.ultimate) { shake(0.4); slowmo(0.5, 0.35); GRADE.flashCol.set(1, 0.9, 0.8); this.flash(0.35); }
    await wait(0.28);
    const tA = e.target != null ? this.foes.get(e.target) : [...this.foes.values()].find(a => a.root.visible);
    const aim = tA ? tA.home.clone() : V3(0, 0, -3); hero.faceToward(aim);
    const melee = this.cls !== 'mage', dist = melee ? Math.max(0, hero.home.distanceTo(aim) - (tA && this.disp.get(e.target!)?.boss ? 2.6 : 1.6)) : 0;
    const act = hero.attack(dist); cue('whoosh', 0.9);
    const until = act.dur * act.at, to = tA ? tA.chest() : aim;
    const flights = ds.map((d, i) => wait(Math.max(0, until - 0.22) + i * 0.02).then(() => flyDie(d, to, 0.22, { arc: 0.5, ease: ease.inCubic, turns: 1.2 })).then(() => { d.root.visible = false; }));
    await act.impact; await Promise.all(flights);
  }
  private async impact(e: Extract<Ev2, { t: 'hit' }>) {
    const a = this.foes.get(e.uid), d = this.disp.get(e.uid); if (!a) return;
    if (d) { d.armor = Math.max(0, d.armor - e.absorbed); d.hp = Math.max(0, d.hp - e.hpDmg); }
    const heavy = e.hpDmg >= 30 || e.ultimate, mid = !heavy && e.hpDmg >= 14, p = a.chest();
    fxImpact(p.clone().add(V3(0, 0, 0.4)), e.aoe ? 0xffc040 : 0xffe2a8, Math.min(3, 0.6 + e.dmg / 22), { dir: V3(0, 0.1, -1) });
    a.hurt(Math.min(1.6, 0.6 + e.hpDmg / 30));
    if (e.absorbed) popPix(`-${e.absorbed}`, p.clone().add(V3(0.7, 0.5, 0)), { color: '#8ac8ff', h: 0.4 });
    popPix(String(e.hpDmg), a.head().add(V3(R(-0.2, 0.2), 0.4, 0)), { color: heavy ? '#ff7a3a' : mid ? '#ffd060' : '#fff6e0', h: 0.62, big: heavy, life: 1.2, rise: 1.0 });
    hitstop(heavy ? 0.14 : mid ? 0.08 : 0.05); shake(heavy ? 0.5 : mid ? 0.3 : 0.15);
    if (heavy) { GRADE.flashCol.set(1, 0.92, 0.8); this.flash(0.3); this.platform.vibrate('heavy'); }
    cue(heavy ? 'crit' : 'impact', heavy ? 1.3 : 0.8); await wait(heavy ? 0.32 : 0.14);
  }

  // ------------------------------------------------------------ enemies
  private foePos(lane: number, distance: number, boss: boolean) { return boss ? BOSS_POS.clone() : LANES[lane % LANES.length].clone().add(V3(0, 0, -distance * 1.3)); }
  private freeLane() { const used = new Set([...this.disp.entries()].filter(([u]) => { const a = this.foes.get(u); return a && a.root.visible && !a.dead; }).map(([, d]) => d.lane)); for (let i = 0; i < 8; i++) if (!used.has(i)) return i; return 0; }
  private async spawnFoe(uid: number, by?: number) {
    const en = this.b!.enemy(uid); if (!en) return;
    const def = ROSTER.find(d => d.id === en.cfgId) ? en.cfgId : 'forest_ghoul';
    const boss = en.rank === 'midBoss' || en.rank === 'boss', lane = boss ? -1 : this.freeLane();
    const a = new BattleActor(def), to = this.foePos(Math.max(0, lane), en.distance, boss);
    this.foes.set(uid, a); this.disp.set(uid, { hp: en.hp, maxHp: en.maxHp, armor: en.armor, lane: Math.max(0, lane), boss });
    this.plates.set(uid, this.ov.pane(5));
    if (by != null) {   // a summon rises out of the ground next to its master
      const m = this.foes.get(by); if (m) { m.summon(); fxGlow(m.weapon(), COL.green, 2.4, 0.6, 2.4); }
      a.place(V3(to.x, -1.8, to.z)); a.faceToward(this.hero!.home); cue('summon');
      fxRing(V3(to.x, 0.05, to.z), COL.green, 2, { life: 0.8, width: 0.15, fill: 0.3 });
      await animP(0.7, k => { a.home.y = lerp(-1.8, 0, ease.outBack(k)); }); a.roar(); return;
    }
    a.place(to.clone().add(V3(0, boss ? -3.5 : 0, boss ? 0 : -5))); a.faceToward(this.hero!.home);
    if (boss) { fxRing(V3(0, 0.6, to.z), COL.green, 4, { life: 1.2, width: 0.12, fill: 0.2 }); cue('summon'); shake(0.2); await animP(1.0, k => { a.home.y = lerp(to.y - 3.5, to.y, ease.outCubic(k)); }); a.roar(); cue('roar'); await wait(0.4); return; }
    a.walkK = 1; const from = a.home.clone(); await animP(0.55, k => { a.home.lerpVectors(from, to, ease.outCubic(k)); }); a.walkK = 0;
  }
  private async enemyTurnBeat() {
    this.clearSel(); this.banner.show('敌方回合', '', 0.45, '#ffb0a0');
    // leftover field dice: the mage's retained ones fly to the chant ring (the next turn's kept list), the rest fade out
    const next = this.batch.slice(this.bi).find((x): x is Extract<Ev2, { t: 'roll' }> => x.t === 'roll' && x.reason === 'turn');
    const kept = new Set(next ? next.kept : []), keepVals: number[] = [];
    for (const [u, d] of [...this.dice]) {
      if (this.cls === 'mage' && kept.has(u)) { keepVals.push(d.value); void flyDie(d, this.mechWorld(), 0.35, { arc: 1.2, scale: 0.4, ease: ease.inCubic }).then(() => d.dispose()); }
      else { fxSmoke(d.root.position, 0x6a5a7a, 3, { alpha: 0.35 }); d.dispose(); }
      this.dice.delete(u);
    }
    if (keepVals.length) after(0.35, () => this.mech.setKept(keepVals));
    shot('enemy', staticShot(V3(1.4, 12.4, 14.0), V3(-0.2, 0.2, -2.6), 40), { speed: 2.2 });
    await wait(0.5);
  }
  private mechWorld() { const m = this.mech.anchor(), v = V3((m.x / this.ov.w) * 2 - 1, -(m.y / this.ov.h) * 2 + 1, 0.5); return worldAlong(v, 6); }
  private async enemyAct(e: Extract<Ev2, { t: 'enemyAct' }>) {
    const a = this.foes.get(e.uid), d = this.disp.get(e.uid); if (!a || !d) return;
    const hero = this.hero!;
    if (e.desc) popPix(e.desc, a.head().add(V3(0, 0.9, 0)), { color: '#ffc8b0', h: 0.42, life: 1.1 });
    if (e.kind === 'frozen' || e.kind === 'stunned') { popPix(e.kind === 'frozen' ? '冻结' : '眩晕', a.head(), { color: '#a8d8ff', h: 0.45 }); await wait(0.3); return; }
    if (e.kind === 'defend') { a.roar(); fxShield(a.home, 1.8); cue('armor'); await wait(0.4); return; }
    if (d.boss || e.kind === 'skill' || e.kind === 'curse') {
      const act = a.cast(); cue('magic'); fxGlow(a.weapon(), COL.green, 2.2, 0.6, 2.6);
      await act.impact; await this.orb(a.weapon(), hero.chest(), e.kind === 'attack' ? 0x6aff9a : 0xc070ff); return;
    }
    a.faceToward(hero.home);
    const act = a.attack(Math.max(0, a.home.distanceTo(hero.home) - 1.4)); cue('whoosh', 0.7);
    await act.impact; fxSparks(hero.chest(), 0xff4030, 14, 5, { life: 0.4 });
  }
  private async orb(from: THREE.Vector3, to: THREE.Vector3, col: number) {
    const mid = from.clone().lerp(to, 0.5).add(V3(0, 2, 0));
    await animP(0.45, k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; fxGlow(V3(from.x * a + mid.x * b + to.x * c, from.y * a + mid.y * b + to.y * c, from.z * a + mid.z * b + to.z * c), col, 0.6, 0.25, 2.4); });
    fxImpact(to, col, 0.9, { ground: false, stop: false });
  }
  private async playerHit(e: Extract<Ev2, { t: 'playerHit' }>) {
    const hero = this.hero!, p = hero.chest(), pd = this.pd;
    pd.barrier = Math.max(0, pd.barrier - e.byBarrier); pd.armor = Math.max(0, pd.armor - e.byArmor); pd.hp = Math.max(0, pd.hp - e.hpDmg);
    if (e.dmg > 0) this.flask.hit(e.dmg, { ...pd });
    if (e.byBarrier) popPix(`-${e.byBarrier}`, p.clone().add(V3(-0.6, 0.8, 0)), { color: '#8ad8ff', h: 0.42 });
    if (e.byArmor) { popPix(`-${e.byArmor}`, p.clone().add(V3(0.6, 0.6, 0)), { color: '#9ad0ff', h: 0.42 }); fxShield(hero.home, 0.9); cue('block'); if (!e.hpDmg) hero.block(); }
    if (e.hpDmg > 0) {
      hero.hurt(Math.min(1.6, 0.6 + e.hpDmg / 15)); popPix(`-${e.hpDmg}`, hero.head(), { color: '#ff5a4a', h: 0.6, big: e.hpDmg >= 12 });
      if (!e.isDot) { shake(0.2 + Math.min(0.4, e.hpDmg / 25)); hitstop(0.06); GRADE.flashCol.set(0.6, 0.05, 0.02); this.flash(Math.min(0.3, 0.1 + e.hpDmg / 60)); this.platform.vibrate(e.hpDmg >= 12 ? 'heavy' : 'medium'); }
      cue('hurt', Math.min(1.4, 0.6 + e.hpDmg / 20));
    } else if (e.perfectBlock) popPix('完美格挡', p.clone().add(V3(0, 1.0, 0)), { color: '#bfe8ff', h: 0.45 });
    await wait(0.3);
  }
  private async death(uid: number) {
    const a = this.foes.get(uid), d = this.disp.get(uid); if (!a) return;
    this.lastDeath = a.chest(); const pl = this.plates.get(uid); if (pl) { this.ov.drop(pl); this.plates.delete(uid); }
    cue('shatter', d?.boss ? 1.4 : 0.8);
    if (d?.boss) {
      a.collapse(); slowmo(1.6, 0.25); shake(0.8); GRADE.flashCol.set(1, 1, 1); this.flash(0.5);
      fxSparks(a.chest(), 0xa0ffc0, 60, 8, { life: 0.9, grav: 3 }); await wait(1.0);
      anim(1.0, k => a.root.scale.setScalar(Math.max(0.01, 1 - ease.inCubic(k))), () => { a.root.visible = false; a.root.scale.setScalar(1); });
      const st = this.stage; anim(1.6, k => st?.phase2(1 - k), undefined, { real: true }); await wait(0.6); return;
    }
    a.dead = true; a.hurt(1.4);
    fxSmoke(a.chest(), 0x3a4a3a, 6, { alpha: 0.5 });
    anim(0.45, k => a.root.scale.setScalar(Math.max(0.01, 1 - ease.inCubic(k))), () => { a.root.visible = false; });
    await wait(0.3);
  }
  /** 跨波兑现: the dice earned this turn burst out of the last kill and settle into the prep tray, then follow into the next wave */
  private async wavePayoff(e: Extract<Ev2, { t: 'waveClear' }>) {
    for (const [u, d] of [...this.dice]) { fxSmoke(d.root.position, 0x6a5a7a, 3, { alpha: 0.35 }); d.dispose(); this.dice.delete(u); }
    await wait(0.5);
    const extra = Math.max(0, e.nextDice - 3), from = this.lastDeath.clone();
    this.banner.show(`第 ${e.wave + 1} 波 清场`, extra > 0 ? `挣到 ${extra} 颗骰 · 带进下一波` : `下一波 ${e.nextDice} 颗骰`, 1.6, '#ffe08a');
    this.tray.fill(3); await wait(0.45);
    const reasons = e.reasons.slice();
    for (let i = 0; i < extra; i++) {
      const r = reasons[i] as GainReason | undefined;
      popPix(r ? `${GAIN_CN[r]} +1` : '+1', from.clone().add(V3(R(-0.4, 0.4), 1.0 + i * 0.3, 0)), { color: '#ffe08a', h: 0.45, life: 1.2 });
      fxSparks(from, 0xffe08a, 20, 5, { life: 0.5 }); cue('reveal', 0.8);
      await this.tray.earn(from, r ? gainSpecial(r) : undefined); await wait(0.1);
    }
    await wait(0.5);
  }

  // ------------------------------------------------------------ battle over → rewards → next node
  private async battleOver() {
    const run = this.run!, b = this.b!; this.busy = true; this.botBusy = false;
    const res = run.endBattle(b); this.b = null;
    this.log.push(`battle ${res.result} gold ${res.gold} xp ${res.xp} hp ${run.s.hp} lv ${run.s.level}`);
    this.hudBattle(false);
    if (res.result === 'lose') { await wait(0.6); this.resultScreen(false); return; }
    await wait(1.2);
    this.loot.gold = run.s.gold; this.loot.level = run.s.level; this.loot.xp = run.s.xp; this.loot.xpMax = xpToNext(run.s.level);
    if (res.levelUps) this.toast.show(`升到 ${run.s.level} 级`, 1.0, '#bfffff');
    await this.choices(); await this.nextNode();
  }
  private async choices() {
    const run = this.run!;
    while (run.pending()) {
      const c = run.pending()!; this.mode = 'choice';
      const pick = await this.choiceScreen(c);
      const r = run.choose(pick.i, pick.sub); if (!r.ok) { this.toast.show(r.reason || ''); continue; }
      this.log.push(`choose ${c.kind} ${pick.i}/${pick.sub}`); cue('relic', 0.7);
      this.loot.gold = run.s.gold; this.loot.level = run.s.level; this.loot.xp = run.s.xp; this.loot.xpMax = xpToNext(run.s.level);
      await wait(0.25);
    }
  }
  private choiceScreen(c: Choice): Promise<{ i: number; sub: number }> {
    return new Promise(res => {
      const run = this.run!;
      const open = () => {
        const ov = this.ov, W = ov.w, H = ov.h, k = this.k, n = c.kind === 'levelUp' ? c.cards.length : c.options.length;
        const cw = Math.min(300, (W - 80) / n - 20), ch = Math.min(320, H * 0.5), y0 = H * 0.5 - ch / 2 + 20 * k;
        this.screen.open(0.55);
        const title = c.kind === 'levelUp' ? `升级 · 第 ${run.s.level} 级` : c.kind === 'talent' ? '天赋 · 三选一' : '遗物 · 三选一';
        const sub = c.kind === 'levelUp' ? '技能碑：加一行 / 强化 / 改写' : c.kind === 'talent' ? '精英奖励' : '首领奖励';
        this.screen.add('ct' + title + W, { x: W / 2 - 320, y: y0 - 110 * k, w: 640, h: 96 * k }, (g, d, w) => {
          text(g, title, w / 2, 4 * d, Math.round(ov.fp * 2 * d), '#ffe6a0', 'center');
          text(g, sub, w / 2, 4 * d + PIX_H * ov.fp * 2 * d + 8 * d, Math.round(ov.fp * d), '#c8b8a0', 'center');
        });
        for (let i = 0; i < n; i++) {
          const x = W / 2 + (i - (n - 1) / 2) * (cw + 20) - cw / 2, r: Rect = { x, y: y0, w: cw, h: ch };
          const cd = this.cardOf(c, i);
          if (cd.split) {
            const h2 = ch / 2 - 4;
            cd.split.forEach((s, j) => this.screen.button(`c${i}${j ? 'b' : 'a'}`, { x, y: y0 + j * (h2 + 8), w: cw, h: h2 }, (g, d, w, h) => drawCard(g, d, w, h, ov.fp, { ...s, col: cd.col }), () => { this.screen.close(); this.reopen = null; res({ i, sub: j }); }));
          } else this.screen.button(`c${i}`, r, (g, d, w, h) => drawCard(g, d, w, h, ov.fp, cd), () => { this.screen.close(); this.reopen = null; res({ i, sub: 0 }); });
        }
      };
      this.reopen = open; open();
      this.screenResolve = (i: number) => { this.screen.close(); this.reopen = null; res({ i, sub: 0 }); };
    });
  }
  private cardOf(c: Choice, i: number): CardData & { split?: CardData[] } {
    const run = this.run!, col = CLASS_COL[this.cls];
    if (c.kind === 'levelUp') {
      const card: LevelCard = c.cards[i], tab = run.s.loadout.tablets[card.tablet];
      if (card.kind === 'addRow') { const d = rowDef(card.rowId); return { title: `新行 · ${d.name}`, tag: '加一行', desc: rowCondCN(d.id), col, ico: ICON.quill }; }
      if (card.kind === 'upgrade') { const sl = tab.slots[card.slot], d = slotRow(sl); return { title: `${d.name} ${ROMAN[card.from]}→${ROMAN[card.from + 1]}`, tag: '强化', desc: '系数提高，档位效果更强', col, ico: ICON.gem }; }
      const base = rowDef(tab.slots[card.slot].rowId);
      const opts = card.options.map(id => base.evolutions.find(e => e.id === id)!).map(ev => ({ title: `改写 · ${ev?.name ?? '?'}`, tag: base.name, desc: ev?.desc ?? '', col, ico: ICON.star }));
      return { ...opts[0], split: opts };
    }
    if (c.kind === 'talent') {
      const o = c.options[i];
      if (o.id === TALENT_FILLERS.grind.id) return { title: TALENT_FILLERS.grind.name, tag: '补位', desc: TALENT_FILLERS.grind.desc, col: '#8ad8ff', ico: ICON.star };
      if (o.id === TALENT_FILLERS.gold.id) return { title: TALENT_FILLERS.gold.name, tag: '补位', desc: TALENT_FILLERS.gold.desc, col: '#ffd060', ico: ICON.coin };
      const t = talentDef(o.id); return { title: `${t.name} ${ROMAN[o.level]}`, tag: '天赋', desc: t.desc[o.level - 1], col, ico: ICON.star };
    }
    const r = relicV2(c.options[i]); return { title: r.name, tag: '遗物', desc: r.desc, col: '#ffd060', ico: ICON.gem };
  }

  private enterShop() {
    const run = this.run!; this.mode = 'shop';
    this.setStage('c_merchant'); this.hudRun(true); this.hudBattle(false);
    this.hero!.place(V3(-2.4, 0, 2.2)); this.hero!.faceToward(V3(1, 0, -2));
    shot('shop', staticShot(V3(-0.6, 5.0, 10.5), V3(0.6, 1.2, -1.5), 42), { cut: true });
    this.flask.set({ hp: run.s.hp, maxHp: run.s.maxHp, armor: 0, barrier: 0 });
    this.banner.show('林边货车', '商人', 1.0);
    const open = () => {
      const ov = this.ov, W = ov.w, H = ov.h, k = this.k, items = run.shop(), n = items.length;
      const cw = Math.min(250, (W - 120) / n - 18), ch = Math.min(280, H * 0.44), y0 = H * 0.36;
      this.screen.open(0.35);
      this.screen.add('st' + W, { x: W / 2 - 300, y: y0 - 80 * k, w: 600, h: 70 * k }, (g, d, w) => text(g, '商人 · 4 格', w / 2, 4 * d, Math.round(ov.fp * 2 * d), '#ffe6a0', 'center'));
      items.forEach((it, i) => {
        const x = W / 2 + (i - (n - 1) / 2) * (cw + 18) - cw / 2, cd = this.shopCard(it), can = !it.sold && run.s.gold >= it.price;
        this.screen.button(`buy${i}`, { x, y: y0, w: cw, h: ch }, (g, d, w, h) => drawCard(g, d, w, h, ov.fp, { ...cd, price: it.sold ? '已售' : `${it.price} 金`, dim: !can }), () => this.buy(i), can);
      });
      const bw = 200, bh = Math.max(64, 70 * k), by = Math.min(H - bh - 16, y0 + ch + 24 * k);
      if (run.s.potions > 0) this.screen.button('drink', { x: W / 2 - bw - 12, y: by, w: bw, h: bh }, (g, d, w, h) => drawBtn(g, d, w, h, ov.fp, `喝药 ×${run.s.potions}`, '#7af09a'), () => { run.drink(); this.flask.heal({ hp: run.s.hp }); this.reopen?.(); });
      this.screen.button('leave', { x: run.s.potions > 0 ? W / 2 + 12 : W / 2 - bw / 2, y: by, w: bw, h: bh }, (g, d, w, h) => drawBtn(g, d, w, h, ov.fp, '离开', '#ffe6a0'), () => this.leaveShop());
    };
    this.reopen = open; after(0.6, open);
  }
  private shopCard(it: ShopItem): CardData {
    const run = this.run!;
    if (it.kind === 'relic') { const r = relicV2(it.id); return { title: r.name, tag: it.sale ? '特价遗物' : '遗物', desc: r.desc, col: it.sale ? '#ff9a6a' : '#ffd060', ico: ICON.gem }; }
    if (it.kind === 'potion') return { title: '血瓶', tag: '药水', desc: `战斗之间喝，回复 ${Math.round(ECON.potionHealPct * 100)}% 生命`, col: '#ff6a5a', ico: ICON.potion };
    const sl = run.s.loadout.tablets[it.tablet].slots[it.slot]; const d = slotRow(sl);
    return { title: `描金 · ${d.name}`, tag: '强化', desc: `${ROMAN[sl.level]} → ${ROMAN[Math.min(3, sl.level + 1)]}`, col: '#ffd060', ico: ICON.quill };
  }
  buy(i: number) {
    const run = this.run!, it = run.shop()[i], r = run.buy(i);
    if (!r.ok) { this.toast.show(r.reason || ''); cue('deny'); return false; }
    this.log.push(`buy ${it.kind} ${it.kind === 'relic' ? it.id : ''} ${it.price}`);
    this.loot.gold = run.s.gold; cue('coin', 1); this.reopen?.(); return true;
  }
  leaveShop() { this.screen.close(); this.reopen = null; this.run!.next(); void this.nextNode(); }

  resultScreen(win: boolean) {
    this.mode = 'over'; this.result = win ? 'win' : 'lose'; this.busy = true; this.hudBattle(false);
    const run = this.run!; this.loot.gold = run.s.gold; this.botQ = []; this.log.push(`result ${this.result} lv ${run.s.level} gold ${run.s.gold}`);
    if (win && this.hero) { this.hero.cheer(); cue('win'); }
    const open = () => {
      const ov = this.ov, W = ov.w, H = ov.h, k = this.k, w = Math.min(560, W * 0.6), h = Math.min(420, H * 0.7), x = W / 2 - w / 2, y = H / 2 - h / 2;
      this.screen.open(0.6);
      this.screen.add('res' + win + W, { x, y, w, h }, (g, d, ww, hh) => {
        panel(g, 0, 0, ww, hh, 3 * d, { body: '#1a1422', rim: win ? '#e8b060' : '#8a7aa8', line: '#07050a', hi: '#2a2234' });
        const s2 = Math.round(ov.fp * 2 * d), s1 = Math.max(1, Math.round(ov.fp * d));
        text(g, win ? '通  关' : '战  败', ww / 2, 20 * d, s2, win ? '#ffe6a0' : '#d8c8f0', 'center');
        const lines = [`${CLASSES[this.cls].name} · ${run.s.level} 级`, `金币 ${run.s.gold}`, `生命 ${run.s.hp}/${run.s.maxHp}`, run.s.relics.length ? `遗物 ${run.relicNames().join('、')}` : '遗物 无', `技能碑 ${run.boardNames().join(' ')}`];
        let yy = 20 * d + PIX_H * s2 + 20 * d;
        for (const l of lines) for (const ln of pixWrap(l, (ww - 40 * d) / s1)) { text(g, ln, 24 * d, yy, s1, '#e8dcc8'); yy += PIX_H * s1 + 6 * d; }
      });
      const bw = 220, bh = Math.max(64, 70 * k);
      this.screen.button('again', { x: W / 2 - bw / 2, y: y + h + 12 * k, w: bw, h: bh }, (g, d, ww, hh) => drawBtn(g, d, ww, hh, ov.fp, '再来一局', '#ffe6a0'), () => { this.screen.close(); this.reopen = null; this.classSelect(); });
    };
    this.reopen = open; open();
  }

  /** debug: jump to a node (first of its kind) with the current class */
  goto(kind: 'normal' | 'elite' | 'shop' | 'boss') {
    if (!this.run) this.pick('warrior');
    this.screen.close(); this.reopen = null; this.busy = true; this.b = null; this.hudBattle(false);
    if (!gotoNode(this.run!, kind)) return false;
    this.chain = Promise.resolve(); void this.nextNode(); return true;
  }

  // ------------------------------------------------------------ bot
  private botGen = 0; private botQ: BotAct[] = []; private botTurnNo = -1;
  bot(on = true) {
    this.botOn = on; const gen = ++this.botGen;
    const loop = () => { if (!this.botOn || gen !== this.botGen) return; try { this.botTick(); } catch (e) { this.errors.push('[bot] ' + ((e as Error).stack || e)); } after(0.3, loop); };
    if (on) after(0.2, loop); return on;
  }
  /** one bot step (called every 0.3 s while the bot is on): tap a screen button, or play the next action of botTurn */
  private botTick() {
    if (this.screen.on) {
      if (this.screen.t < 0.5) return;
      if (this.mode === 'select') { this.screen.tap('cls' + CLASS_IDS.indexOf(this.cls)); return; }
      if (this.mode === 'choice') { if (!this.screen.tap('c0') && !this.screen.tap('c0a')) this.screen.tap('c1'); return; }
      if (this.mode === 'shop') { const run = this.run!, i = run.shop().findIndex(it => !it.sold && it.price <= run.s.gold && it.kind !== 'potion'); if (i >= 0) this.buy(i); else this.leaveShop(); return; }
      return;
    }
    if (this.mode !== 'battle' || this.busy || !this.b || this.b.s.phase !== 'player' || this.botBusy) return;
    // the whole turn is recorded once on a clone (same RNG state), then replayed step by step: the live outcome is identical
    if (!this.botQ.length || this.botTurnNo !== this.b.s.turn) { this.botQ = recordBotTurn(this.b, this.botRnd); this.botTurnNo = this.b.s.turn; }
    const a = this.botQ.shift() || { k: 'end' as const };
    this.botBusy = true;
    if (a.k !== 'end') this.selectUids(a.uids);
    after(a.k === 'end' ? 0.2 : 0.45, () => { this.botBusy = false; this.act(a); });
  }

  // ------------------------------------------------------------ refresh: tablet, buttons, info
  refresh() {
    const b = this.b; if (!b || this.mode !== 'battle') return;
    const live = !this.busy && b.s.phase === 'player' && !b.s.result;
    const opts = live ? b.options(this.sel) : null;
    const n = this.rows.length;
    for (let i = 0; i <= n; i++) {
      const row = i < n ? this.rows[i] : null, o = opts?.[i];
      let v: RowView;
      if (!o) v = { state: 'idle', tier: 0 };
      else if (o.ok) {
        const pv = b.preview(o.ref, this.sel, b.target()?.uid);
        v = { state: 'ready', tier: row ? lampsFor(row, o.tier) : 1, value: pv ? pv.total || pv.armor || pv.barrier || undefined : undefined };
      } else if (o.reason === 'strike' || o.reason === 'chant' || (row && !o.bestTier)) v = { state: 'dead', tier: 0 };
      else v = { state: 'idle', tier: row ? lampsFor(row, o.bestTier) : 0 };
      this.tablet.setView(i, v);
    }
    const ri = b.rerollInfo();
    this.reroll.setBadge(ri.free, ri.free > 0 ? 0 : ri.bloodCost ?? 0);
    this.reroll.setEnabled(live && (ri.free > 0 || ri.bloodCost != null));
    this.end.setEnabled(live); this.end.breathe(live && b.mustEndTurn());
    // mage after the strike: which leftovers stay (cyan)
    const ki = live ? b.keepInfo() : null, keepSet = new Set(ki?.need ? (this.keep ?? ki.selected) : []);
    for (const d of this.dice.values()) if (!this.sel.includes(d.uid!)) { const kp = keepSet.has(d.uid!); d.glow = kp ? 0.7 : (d.suit?.special ? 0.5 : 0); d.glowCol.set(kp ? 0x6ad8ff : 0xb860ff); d.lift = kp ? 0.3 : 0; }
  }

  // ------------------------------------------------------------ per frame
  private frame(dt: number) {
    const t = clock.time;
    this.hero?.update(dt); for (const a of this.foes.values()) a.update(dt); for (const a of this.picks) a.update(dt);
    this.tray.update(dt, t); this.flask.update(dt); this.loot.update(dt, t);
    if (this.mode === 'battle' && this.b) { this.tablet.update(dt, t); this.end.update(dt); this.reroll.update(dt); this.mech.update(dt); this.drawRowNames(); this.drawInfo(); }
    this.banner.update(dt); this.toast.update(dt); this.screen.update(dt);
    this.drawPlates(); this.drawRelics();
  }
  private drawRowNames() {
    const ov = this.ov, d = ov.dpr, s = Math.max(1, Math.round(ov.fp * 0.75 * d));
    this.rowPanes.forEach((p, i) => {
      const r = this.tablet.rows[i]; if (!r) { p.visible = false; return; }
      const row = i < this.rows.length ? this.rows[i] : null, name = row ? `${row.name}${ROMAN[row.level]}` : this.b!.cls.basicAttack.name;
      const st = r.view.state, col = st === 'ready' ? '#ffe9a8' : st === 'dead' ? '#6a6072' : '#c8bcd4', w = textW(name, s) / d + 8, h = PIX_H * s / d + 4;
      p.paint(name + st + d, w, h, g => text(g, name, w * d - 2 * d, 2 * d, s, col, 'right'));
      const c = this.L.toPx(r.g.getWorldPosition(V3()));
      p.at(c.x - this.tablet.widthPx / 2 - w - 2, c.y - h / 2); p.visible = r.open > 0.5;
    });
  }
  private drawInfo() {
    const b = this.b!, ov = this.ov, d = ov.dpr, s = Math.max(1, Math.round(ov.fp * 0.75 * d)), p = b.s.player, lines: Array<[string, string]> = [];
    if (this.cls === 'warrior') { lines.push([`血怒 ${p.rage}/5`, '#ff8a7a']); const nd = b.s.phase === 'player' ? b.nextDice() : null; if (b.s.overflow > 0) lines.push([`溢出 ${b.s.overflow} 颗 · 本回合加伤`, '#ffb070']); else if (nd && nd.overflow > 0) lines.push([`下回合溢出 ${nd.overflow}`, '#ffb070']); }
    else if (this.cls === 'mage') { lines.push([`吟唱 ${b.s.chantRing}/3${b.s.overcharge ? ' 过充' + b.s.overcharge : ''}`, '#8ac8ff']); const risk = b.s.phase === 'player' ? b.chantRisk() : 0; if (p.backlash || risk) lines.push([`反噬 ${p.backlash} 层${risk ? ` · 再吟唱多受 ${risk}` : ''}`, '#d090ff']); }
    else { lines.push([`第 ${Math.min(b.s.maxStrikes, b.s.strikesUsed + 1)}/${b.s.maxStrikes} 刀`, '#e0a8ff']); const sh = b.dice().filter(x => x.kind === 'shadowDie').length; if (sh) lines.push([`暗影残骰 ${sh}`, '#c890ff']); if (b.s.knifeMark) lines.push([`标记：${b.s.knifeMark.shape === 'straight' ? '顺子' : '同点'}`, '#ffd0ff']); }
    const sts = p.statuses.map(x => `${ST_CN[x.type]}${x.value > 1 ? x.value : ''}`).join(' '); if (sts) lines.push([sts, '#c8e0a8']);
    const key = lines.map(l => l[0]).join('|') + d, lh = PIX_H * s / d + 3, w = Math.max(...lines.map(l => textW(l[0], s) / d)) + 8, h = lines.length * lh + 4;
    this.info.paint(key, w, h, g => lines.forEach((l, i) => text(g, l[0], 4 * d, (2 + i * lh) * d, s, l[1])));
    const m = this.mech.anchor(); this.info.at(this.mech.x - 6, m.y - 44 * this.k - h); this.info.visible = true;
  }
  private drawRelics() {
    const run = this.run; if (!run || !this.L.on) { this.relicPane.visible = false; return; }
    const ov = this.ov, d = ov.dpr, s = Math.max(1, Math.round(ov.fp * 0.75 * d));
    const items = run.relicNames().concat(run.s.potions ? [`血瓶 ×${run.s.potions}`] : []); if (!items.length) { this.relicPane.visible = false; return; }
    const lh = PIX_H * s / d + 3, w = Math.max(...items.map(t => textW(t, s) / d)) + 22, h = items.length * lh + 4;
    this.relicPane.paint(items.join('|') + d, w, h, g => items.forEach((t, i) => { icon(g, t.startsWith('血瓶') ? ICON.potion : ICON.gem, 2 * d, (3 + i * lh) * d, s, { main: '#ffd060', acc: '#ff6a5a' }); text(g, t, 16 * d, (2 + i * lh) * d, s, '#f0e0c0'); }));
    this.relicPane.at(this.loot.purse.x - 30, this.loot.purse.y + 34 * this.k); this.relicPane.visible = true;
  }
  private drawPlates() {
    const b = this.b, ov = this.ov, d = ov.dpr; if (!b) { for (const p of this.plates.values()) p.visible = false; return; }
    const live = !this.busy && b.s.phase === 'player' && this.mode === 'battle', tgt = live ? b.target()?.uid : undefined;
    const s1 = Math.max(1, Math.round(ov.fp * 0.75 * d)), s2 = Math.max(1, Math.round(ov.fp * d));
    for (const [uid, p] of this.plates) {
      const a = this.foes.get(uid), fd = this.disp.get(uid), en = b.enemy(uid); if (!a || !fd || !en || !a.root.visible) { p.visible = false; continue; }
      const it = live ? b.intent(en) : null, sts = en.statuses.map(x => `${ST_CN[x.type]}${x.value > 1 ? x.value : ''}`).join(' ');
      const W = 150, bh = 10, ih = it ? PIX_H * s2 / d + 10 : 0, nh = PIX_H * s1 / d + 2, sh = sts ? PIX_H * s1 / d + 2 : 0, H = ih + nh + bh + sh + 10;
      const iTxt = it ? (it.desc && it.kind !== 'mov' ? `${it.desc} ${it.value ?? ''}`.trim() : it.text) : '';
      const key = [uid, fd.hp, fd.maxHp, fd.armor, iTxt, it?.kind, sts, tgt === uid, d].join('|');
      p.paint(key, W, H, g => {
        let y = 0;
        if (it) {
          const ic = it.kind === 'atk' ? ICON.sword : it.kind === 'def' ? ICON.shield : it.kind === 'mov' ? ICON.boot : it.kind === 'frz' ? ICON.zz : it.kind === 'curse' ? ICON.skull : ICON.star;
          const col = it.kind === 'atk' ? '#ff7a6a' : it.kind === 'def' ? '#8ac8ff' : it.kind === 'mov' ? '#ffd27a' : it.kind === 'frz' ? '#a8d8ff' : '#d4a8ff';
          const tw = textW(iTxt, s2) / d + 34, x0 = (W - tw) / 2;
          panel(g, x0 * d, 0, tw * d, ih * d, 2 * d, { body: '#140e18', rim: col, line: '#07050a', hi: '#221a28' });
          icon(g, ic, (x0 + 6) * d, (ih / 2 - 7) * d, 1.4 * d, { main: col, acc: '#fff0e0' });
          text(g, iTxt, (x0 + 26) * d, 5 * d, s2, '#fff2e0'); y = ih + 2;
        }
        text(g, en.name, (W / 2) * d, y * d, s1, tgt === uid ? '#ffe08a' : '#e8dcc8', 'center'); y += nh;
        // the HP bar: dark frame, red fill, armor as a blue cap
        const bx = 6, bw = W - 12, f = Math.max(0, fd.hp / Math.max(1, fd.maxHp));
        g.fillStyle = tgt === uid ? '#ffd060' : '#07050a'; g.fillRect((bx - 2) * d, (y - 2) * d, (bw + 4) * d, (bh + 4) * d);
        g.fillStyle = '#2a1418'; g.fillRect(bx * d, y * d, bw * d, bh * d);
        g.fillStyle = '#d0302a'; g.fillRect(bx * d, y * d, Math.round(bw * f) * d, bh * d); g.fillStyle = '#ff7a5a'; g.fillRect(bx * d, y * d, Math.round(bw * f) * d, 2 * d);
        const hpT = `${fd.hp}${fd.armor ? ' +' + fd.armor : ''}`;
        text(g, hpT, (W / 2) * d, (y - 1) * d, s1, fd.armor ? '#cfe6ff' : '#fff6e8', 'center'); y += bh + 4;
        if (sts) text(g, sts, (W / 2) * d, y * d, s1, '#c8e0a8', 'center');
      });
      const sp = worldToUi(a.root.position.clone().add(V3(0, a.height + 0.25, 0)));
      p.at(sp.x - W / 2, sp.y - H); p.visible = sp.z < 1;
    }
  }
  private flash(k: number) { anim(0.28, t => { GRADE.flash = k * (1 - t) * (1 - t); }, () => { GRADE.flash = 0; }, { real: true }); }

  // ------------------------------------------------------------ input
  private pickDie(x: number, y: number) {
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2((x / this.ov.w) * 2 - 1, -(y / this.ov.h) * 2 + 1); ray.setFromCamera(ndc, cameraRef());
    const rest = [...this.dice.values()].filter(d => d.mode === 'rest' && d.uid != null);
    const hit = ray.intersectObjects(rest.map(d => d.mesh), false)[0]; if (hit) return rest.find(d => d.mesh === hit.object) || null;
    const pt = V3(); if (!ray.ray.intersectPlane(new THREE.Plane(V3(0, 1, 0), -0.4), pt)) return null;
    let best: Die3D | null = null, bd = 0.8; for (const d of rest) { const dd = Math.hypot(d.home.x - pt.x, d.home.z - pt.z); if (dd < bd) { bd = dd; best = d; } } return best;
  }
  private pickFoe(x: number, y: number) {
    let best: number | null = null, bd = 80;
    for (const [uid, a] of this.foes) { if (!a.root.visible || a.dead) continue; const v = worldToUi(a.chest()), dd = Math.hypot(v.x - x, v.y - y); if (dd < bd) { bd = dd; best = uid; } }
    return best;
  }
  private pointer(type: string, x: number, y: number): boolean {
    if (type === 'down') void audio.unlock();
    if (this.screen.pointer(type, x, y)) return true;
    if (this.mode !== 'battle' || !this.b) return false;
    if (this.end.pointer(type, x, y) || this.reroll.pointer(type, x, y) || this.tablet.pointer(type, x, y)) return true;
    if (type !== 'down' || this.busy || this.b.s.phase !== 'player') return false;
    const d = this.pickDie(x, y);
    if (d) { const ki = this.b.keepInfo(); if (ki?.need && this.b.strikesLeft() === 0) this.toggleKeep(d); else this.setSel(d, !this.sel.includes(d.uid!)); return true; }
    const f = this.pickFoe(x, y); if (f != null) { this.b.s.targetUid = f; cue('click', 0.5); this.refresh(); return true; }
    return false;
  }
  private bindKeys() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', e => {
      if (this.mode !== 'battle' || !this.b) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.reroll.tap(); else if (k === 'e') this.end.tap();
      else if (k === ' ' || k === 'enter') { e.preventDefault(); const i = this.tablet.rows.findIndex(r => r.view.state === 'ready'); if (i >= 0) { this.tablet.flash(i); this.playRow(i); } }
      else if (k === 'escape') { this.clearSel(); this.refresh(); }
      else if (k === 'tab') { e.preventDefault(); const al = this.b.alive(); if (al.length) { const i = al.findIndex(x => x.uid === this.b!.s.targetUid); this.b.s.targetUid = al[(i + 1) % al.length].uid; this.refresh(); } }
      else { const n = parseInt(k, 10); if (n >= 1 && n <= 6 && !this.busy) { const ds = [...this.dice.values()].filter(d => d.mode === 'rest').sort((a, b) => a.home.x - b.home.x); const d = ds[n - 1]; if (d) this.setSel(d, !this.sel.includes(d.uid!)); } }
    });
  }

  // ------------------------------------------------------------ capture helpers (CSS px)
  rowPx(i: number) { return this.tablet.rowPx(i); }
  readyRow() { return this.tablet.rows.findIndex(r => r.view.state === 'ready'); }
  diePx(uid: number) { const d = this.dice.get(uid); return d ? worldToUi(d.root.position) : null; }
  btnPx(id: string) { const b = this.screen.btns.find(x => x.id === id); return b ? [b.r.x + b.r.w / 2, b.r.y + b.r.h / 2] : null; }
  idle() { return this.mode === 'battle' && !this.busy && !!this.b && this.b.s.phase === 'player'; }
  /** select the dice of the bot's first play this turn (captures: "dice selected, a row lit") */
  botSelect() { const b = this.b; if (!b || !this.idle()) return false; const a = recordBotTurn(b, mulberry(7)).find(x => x.k === 'play') as Extract<BotAct, { k: 'play' }> | undefined; if (!a) return false; this.selectUids(a.uids); return true; }
}

interface CardData { title: string; tag: string; desc: string; col: string; ico: string[]; price?: string; dim?: boolean }
function drawCard(g: CanvasRenderingContext2D, d: number, w: number, h: number, fp: number, c: CardData) {
  const u = fp / 2, s2 = Math.max(1, Math.round(1.5 * u * d)), s1 = Math.max(1, Math.round(1 * u * d));
  panel(g, 0, 0, w, h, 3 * d, { body: c.dim ? '#141018' : '#1c1624', rim: c.dim ? '#4a4252' : c.col, line: '#07050a', hi: '#2c2234' });
  icon(g, c.ico, w / 2 - 20 * d, 14 * d, 4 * d, { main: c.dim ? '#5a5262' : c.col, acc: '#fff2d8', dark: '#07050a' });
  let y = 14 * d + 44 * d;
  text(g, c.tag, w / 2, y, s1, c.dim ? '#6a6272' : '#b8a890', 'center'); y += PIX_H * s1 + 6 * d;
  for (const ln of pixWrap(c.title, (w - 20 * d) / s2)) { text(g, ln, w / 2, y, s2, c.dim ? '#8a8292' : '#fff2d8', 'center'); y += PIX_H * s2 + 4 * d; }
  y += 6 * d;
  for (const ln of pixWrap(c.desc, (w - 24 * d) / s1)) { if (y > h - (c.price ? 40 : 14) * d) break; text(g, ln, w / 2, y, s1, c.dim ? '#7a7282' : '#e0d4c0', 'center'); y += PIX_H * s1 + 4 * d; }
  if (c.price) { icon(g, ICON.coin, w / 2 - textW(c.price, s2) / 2 - 16 * d, h - 30 * d, 1.2 * d, { main: '#ffc640', acc: '#fff0a0' }); text(g, c.price, w / 2 + 6 * d, h - 32 * d, s2, c.dim ? '#a08a60' : '#ffe08a', 'center'); }
}
function drawBtn(g: CanvasRenderingContext2D, d: number, w: number, h: number, fp: number, label: string, col: string) {
  const s = Math.max(1, Math.round(fp * d));
  panel(g, 0, 0, w, h, 3 * d, { body: '#2a2030', rim: col, line: '#07050a', hi: '#3a2e40' });
  text(g, label, w / 2, h / 2 - (PIX_H * s) / 2, s, col, 'center');
}
function rowCondCN(id: string) { try { const d = rowDef(id); return d.tierRule.steps.map(s => `${s.label}颗`).join(' / ') + ' 递进'; } catch { return ''; } }
function ghost(d: Die3D, on: boolean, special?: SpecialId) {
  d.mat.transparent = on; d.mat.opacity = on ? 0.38 : 1; d.mat.depthWrite = !on; d.mat.needsUpdate = true;
  d.glow = on ? 0.55 : special ? 0.6 : 0; if (on) d.glowCol.set(0xe8f0ff);
}
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cameraRef() { return CAMERA; }
function worldAlong(ndc: THREE.Vector3, dist: number) { const v = ndc.clone().unproject(CAMERA); return CAMERA.position.clone().add(v.sub(CAMERA.position).normalize().multiplyScalar(dist)); }
void FX; void fxHeal;
