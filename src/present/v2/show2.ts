// The v2 slice (#v2): class select → normal fight (2 waves) → elite (狼人首领 + 食尸鬼) → level-up / talent picks → merchant →
// boss (枯骨巫妖) → result. Rules come only from Run2 / Battle2 (core/v2): every action returns events, and every event becomes a
// staged beat (actors, dice, the UI-layer kit from ui3d, the 2D overlay, sound). Live state is read back only at the end of a batch.
import * as THREE from 'three';
import { V3, R, onUpdate, camera as CAMERA, scene as SCENE } from '../engine/world';
import { wait, anim, animP, ease, lerp, shake, hitstop, slowmo, after, clock, FX } from '../engine/clock';
import { CAM } from '../engine/gfx';
import { shot, staticShot } from '../director';
import { FIELD, simThrow, playThrow } from '../dice/throw';
import { Die3D, throwHooks, flyDie, DICE3D } from '../dice/die3d';
import { presentQuat } from '../dice/faces';
import { DiceFlow } from './diceFlow';
import { fxImpact, fxSparks, fxGlow, fxShield, fxHeal, fxRing, fxSmoke, fxStatus, COL } from '../fx/fx';
import { GRADE } from '../look/post';
import { SCENES } from '../scenes/defs';
import { showStage, type Stage } from '../scenes/stage';
import { BattleActor } from '../bestiary/battle';
import { ROSTER } from '../bestiary/models';
import { UiLayer, worldToUi, uiRayPlane } from '../ui3d/layer';
import { DiceTray } from '../ui3d/tray';
import { HeartFlask } from '../ui3d/flask';
import { SkillTablet, type RowView } from '../ui3d/tablet';
import { Loot } from '../ui3d/loot';
import { ClassMech } from '../ui3d/classMech';
import { CLASS_COL, type SpecialId, type SuitSkin } from '../ui3d/suitData';
import { cue } from '../../audio/cues';
import { audio } from '../../audio/audio';
import type { Platform } from '../../platform/index';
import type { Battle2, BoardRow, RowRef } from '../../core/v2/battle2';
import { Run2, type Choice, type ShopItem, type LevelCard } from '../../core/v2/run2';
import { Menu, type MenuKey } from './meta/menu';
import { titleMenu, pauseMenu, type MetaHost } from './meta/screens';
import { PREFS, SPEEDS, loadPrefs, tickPrefs } from './meta/prefs';
import { saveRun, clearRun, loadRun } from './meta/save';
import { PauseButton } from './meta/pauseBtn';
import { DieTip } from './meta/dieTip';
import { ClassPick } from './meta/classPick';
import { TitleScene, TITLE_SPOTS, TITLE_FACE } from './meta/titleScene';
import { safeInsets } from './hud/hud';
import type { Ev2, GainReason } from '../../core/v2/events2';
import type { ClassId, DieKind, StatusV2 } from '../../core/v2/types';
import { CLASSES, TALENT_FILLERS, talentDef, relicV2, rowDef, slotRow, xpToNext, ECON, enemyCfgV2 } from '../../core/v2/data';
import { Overlay, Pane, Banner, Toast, Screen, panel, icon, ICON, text, textW, pixWrap, PIX_H, type Rect } from './overlay';
import { popPix } from './pix';
import { uiSpecial, tabletRow, BASIC_ROW, lampsFor, recordBotTurn, gotoNode, type BotAct } from './adapt';
import { KIND_CN, type SkillKind } from './skills';
import { BattleHud, skillTag, skillUp, extraGlyph } from './hud/hud';
import { throwPlan, simTo, nearestDie } from './hud/diceArc';
import type { SlotDef, SlotState, TipDef } from './hud/skillBar';
import { warriorLine } from './hud/slot3d';
import type { FoeView } from './hud/plates';
import { HeroFx } from './heroFx';   // fx4
import { playDeath, lastHit } from './death';   // fx4
import { HpDisplay, type FoeDisp } from './hpDisplay';
import { displayTarget, canAim, displayPreview, modelHit } from './targeting';
import { statusFlight } from './statusFlight';
import { HERO_POS, foePosition, entranceFrom, actorSubject, fitBattle, type FramingSubject, type CameraFit } from './battleCamera';
import { DiceField } from './diceField';

const EYE = V3(0.3, 13.4, 14.9), LOOK = V3(0, -0.6, -3.6);   // mutable in place by cam() (tuning)
/** R5 (UX_V3 §1b): tighter than the old 42° so the dice on the near arc are ≥ 72 px on screen */
let BATTLE_FOV = 36;
/** R5 (UX_V3 §1b): the hero stands left of the dice arc so the arc can sit low, near the thumbs */
const TIER_COL = ['#fff2d0', '#7ad0ff', '#ffc848', '#ff8040', '#e070ff'];
const ST_CN: Record<StatusV2, string> = { poison: '毒', burn: '灼', freeze: '冻', stun: '晕', vulnerable: '易伤', weak: '虚弱', berserk: '狂暴' };
const ST_COL: Record<StatusV2, string> = { poison: '#a8ff7a', burn: '#ffaa5a', freeze: '#a8d8ff', stun: '#ffe07a', vulnerable: '#ffaa5a', weak: '#c8c8e0', berserk: '#ff6a5a' };
const GAIN_CN: Record<GainReason, string> = { behead: '斩首', guard: '格挡', stun: '震慑', tier: '高档', resonance: '共鸣', shadow: '残骰', fury: '怒火', furyUlt: '怒火', chant: '吟唱', titan: '泰坦', precise: '精准', mark: '标记' };
const NODE_SCENE: Record<string, string> = { normal: 'n_trail', elite: 'n_lumber', shop: 'c_merchant', midBoss: 'b_lich' };
const NODE_CN: Record<string, [string, string]> = { normal: ['雾林小径', '普通战 · 两波'], elite: ['废弃伐木场', '精英 · 狼人首领'], midBoss: ['墓园祭坛', '首领 · 枯骨巫妖'], shop: ['林边货车', '商人'] };
const CLASS_IDS: ClassId[] = ['warrior', 'mage', 'rogue'];
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const gainSpecial = (r: GainReason): SpecialId | undefined => (r === 'fury' || r === 'furyUlt' ? 'fury' : r === 'shadow' || r === 'precise' || r === 'mark' ? 'shadowres' : r === 'titan' ? 'titan' : undefined);
const hex = (s: string) => parseInt(s.slice(1), 16);

type Mode = 'title' | 'select' | 'battle' | 'choice' | 'shop' | 'over';

export class V2Show {
  run: Run2 | null = null; b: Battle2 | null = null; mode: Mode = 'select'; busy = true; flying = false; result: null | 'win' | 'lose' = null;
  L = new UiLayer(); ov = new Overlay(); hfx = new HeroFx(this.ov);   // fx4: class state on the hero model
  tray: DiceTray; flask: HeartFlask; tablet: SkillTablet; loot: Loot; mech: ClassMech; hud: BattleHud;
  banner: Banner; toast: Toast; screen: Screen;
  stage: Stage | null = null; hero: BattleActor | null = null; picks: BattleActor[] = [];
  foes = new Map<number, BattleActor>(); disp = new Map<number, FoeDisp>(); plates = new Map<number, Pane>();
  dice = new Map<number, Die3D>(); sel: number[] = []; keep: number[] | null = null;
  pd = { hp: 1, maxHp: 1, armor: 0, barrier: 0 };
  display = new HpDisplay(); targetUid: number | null = null;
  private tauntSeen = false; private entrances: Promise<void>[] = []; private framing = new Map<number, FramingSubject>(); private reframePending = false;
  /** for captures / bot logs: the last staged event and how many of each */
  beatName = ''; beats: Record<string, number> = {}; errors: string[] = []; log: string[] = [];
  private cls: ClassId = 'warrior'; private rows: BoardRow[] = []; private rowPanes: Pane[] = []; private info: Pane; private relicPane: Pane;
  private chain: Promise<void> = Promise.resolve(); private batch: Ev2[] = []; private bi = 0;
  private botOn = false; private botRnd = mulberry(1234); private botBusy = false;
  private pendingGold: { from: number; amount: number; overflow: number } | null = null; private lastDeath = V3(0, 1, -2.5);
  private screenResolve: ((v: number) => void) | null = null;
  /** rules v3: the four skill slots (散骰 / 同点 / 连环 / 阵列) and the lit cards; slotRefs[i] = the engine ref of slot i */
  private slotRefs: RowRef[] = []; private readyWas: boolean[] = []; private hoverUid: number | null = null; private slotAll: boolean[] = [];
  private drag: { i: number; x0: number; y0: number; moved: boolean; foe: number | null; held: number; tip: boolean } | null = null;
  private giveUp: Pane; private endPane: Pane; private giveUpRect: Rect | null = null;
  /** v4 (SHOW3 #14): every move of a die between the field and the prep tray goes through this ordered queue */
  flow = new DiceFlow(); private endDone = false;
  /** R6S 骰场: the stone dais with six sockets in front of everyone (dice land only there) */
  field = new DiceField(); private camDist = 0; private pre = new Map<number, { a: BattleActor; lane: number }>();

  constructor(private platform: Platform) {
    const L = this.L, skin: SuitSkin = { cls: 'warrior', scheme: 'A', plain: true };
    this.tray = new DiceTray(L, skin, { sizePx: 70, bottom: 70 });
    this.flask = new HeartFlask(L); this.tablet = new SkillTablet(L);
    this.hud = new BattleHud(L, this.ov);
    this.loot = new Loot(L, 'warrior'); this.mech = new ClassMech(L, skin);
    this.banner = new Banner(this.ov); this.toast = new Toast(this.ov); this.screen = new Screen(this.ov);
    this.menu = new Menu(this.ov); this.pauseBtn = new PauseButton(this.ov); this.dieTip = new DieTip(this.ov); loadPrefs();
    this.titleScene = new TitleScene(this.ov);
    this.classPick = new ClassPick({ L: this.L, ov: this.ov, menu: this.menu, scene: SCENE, actors: () => this.picks, pick: c => this.pick(c), back: () => this.toTitle() });
    this.info = this.ov.pane(10); this.relicPane = this.ov.pane(10);
    this.giveUp = this.ov.pane(11, true); this.endPane = this.ov.pane(11);
    this.loot.heroAt = () => (this.hero ? this.hero.chest() : V3(-2, 1.2, 3));
    this.flow.onError = (st, err) => { const m = '[flow] ' + st + ' ' + ((err as Error).stack || err); this.errors.push(m); this.platform.log(m); };
    this.tablet.onPick = (i) => this.playRow(i);
    this.hud.chant.onTap = () => this.act({ k: 'end' });
    this.hud.reroll.onTap = () => this.act({ k: 'reroll', uids: this.sel.slice() });
    throwHooks.impact = (d, v) => { cue('clack', Math.min(1, v / 9)); if (v > 3) fxSmoke(V3(d.root.position.x, 0.06, d.root.position.z), 0x6a6878, 2, { s: 0.2, alpha: 0.3, up: 0.4 }); };
    throwHooks.landed = d => { d.fx('land'); this.field.landed(d); };
    onUpdate((dt) => this.frame(dt));
    platform.onPointer(ev => this.pointer(ev.type, ev.x, ev.y));
    platform.onResize(() => this.layout());
    this.bindKeys();
    this.layout();
    this.title();
  }

  // ------------------------------------------------------------ meta screens (console shell: title / pause / settings / save)
  menu: Menu; pauseBtn: PauseButton; paused = false; classPick: ClassPick; titleScene: TitleScene;
  private host(): MetaHost {
    return { menu: this.menu, newRun: () => { this.menu.close(); this.classSelect(); }, continueRun: () => this.continueRun(), toTitle: () => this.toTitle(),
      titleBack: () => { this.menu.close(); this.titleScene.unpress(); },
      abandonRun: () => { clearRun(); this.toTitle(); }, resume: () => this.resume() };
  }
  /** title screen over the forest path, the camera drifting slowly */
  title() {
    this.mode = 'title'; this.paused = false; this.result = null; this.botBusy = false; this.screen.close(); this.reopen = null; if (this.classPick.on) this.classPick.close(); this.cleanupWorld(); GRADE.desat = 0;
    this.hudRun(false); this.hudBattle(false); this.pauseBtn.show(false); FX.speed = SPEEDS[PREFS.speed];
    // the camp at night: the heroes round a dying fire, the sigil die over the embers (meta/titleScene.ts); any key → the menu
    this.stage = showStage(SCENES.find(s => s.id === 'c_camp')!);
    this.picks = CLASS_IDS.map(c => { const [x, z] = TITLE_SPOTS[c], a = new BattleActor(c); a.place(V3(x, 0, z)); a.faceToward(TITLE_FACE); return a; });
    this.titleScene.enter(() => titleMenu(this.host()));
  }
  private continueRun() {
    const run = loadRun(); if (!run) { this.toast.show('没有可继续的存档'); titleMenu(this.host()); return; }
    this.menu.close(); this.startRun(run, `continue ${run.s.classId} node ${run.s.node}`);
  }
  private toTitle() { this.menu.close(); this.paused = false; this.b = null; this.batch = []; this.botQ = []; this.title(); }
  private pause() {
    if (this.menu.on || !(this.mode === 'battle' || this.mode === 'shop' || this.mode === 'choice')) return;
    this.paused = true; this.drag = null; pauseMenu(this.host()); cue('click', 0.5);
  }
  private resume() { this.menu.close(); this.paused = false; FX.speed = SPEEDS[PREFS.speed]; if (this.mode === 'choice' || this.mode === 'shop') this.reopen?.(); }
  private menuKey(e: KeyboardEvent): boolean {
    const map: Record<string, MenuKey> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', enter: 'ok', ' ': 'ok', escape: 'back', backspace: 'back' };
    const k = map[e.key.toLowerCase()]; if (!k) return false; e.preventDefault(); this.menu.key(k); return true;
  }
  /** Start on a gamepad = pause (menus handle their own D-pad / A / B) */
  private startWas = false;
  private pollStart() {
    const p = Array.from((globalThis.navigator as Navigator | undefined)?.getGamepads?.() ?? []).find(x => x && x.connected); if (!p) return;
    const st = !!p.buttons[9]?.pressed; if (st && !this.startWas) { if (this.paused) this.resume(); else this.pause(); } this.startWas = st;
  }

  // ------------------------------------------------------------ layout
  layout() {
    const s = this.platform.canvasSize(), dpr = Math.min(this.platform.dpr(), 2), W = s.w, H = s.h, k = Math.min(1, H / 720);
    this.L.resize(W, H, dpr); this.ov.resize(W, H, dpr);
    // R5: the HUD rebuilt to the approved mockup (hud/hud.ts lays out the flask, prep dice, purse and the new widgets)
    this.hud.layout(W, H, this.flask, this.tray, this.loot);
    this.pauseBtn.layout(W, safeInsets().r, k); this.menu.refresh();
    this.mech.place(-500, -500, 3); this.tablet.place(W - 260 * k, H * 0.42, 250 * k);
    CAM.shift = W > H ? Math.round(H * 0.06) : 0;
    if (this.mode === 'battle' && this.hero && this.b) { this.reframePending = true; void this.reframe(true, 0); }
    if (this.screen.on) this.reopen?.();
    if (this.classPick.on) this.classPick.relayout();
    if (this.titleScene.on) this.titleScene.paint();
  }
  private reopen: (() => void) | null = null;
  private get k() { return Math.min(1, this.ov.h / 720); }

  // ------------------------------------------------------------ HUD visibility
  private hudBattle(on: boolean) {
    this.mech.root.visible = false; this.tablet.root.visible = false; this.hud.battle(on, this.cls === 'mage');
    if (!on) { this.giveUp.visible = false; this.endPane.visible = false; this.drag = null; this.info.visible = false; }
    if (!on) { for (let i = 0; i < 8; i++) this.L.text.hide(`tab.${i}`); this.tray.clear(); this.mech.setKept([]); for (const p of this.rowPanes) p.visible = false; this.info.visible = false; }
  }
  private hudRun(on: boolean) { this.L.on = on; this.relicPane.visible = false; this.hud.runOn(on); this.loot.visible = on; }

  // ------------------------------------------------------------ class select
  classSelect() {
    this.mode = 'select'; this.result = null; this.botBusy = false; this.cleanupWorld(); GRADE.desat = 0;
    this.hudRun(false); this.hudBattle(false);
    this.stage = showStage(SCENES.find(s => s.id === 'n_trail')!);
    this.picks = CLASS_IDS.map((c, i) => { const a = new BattleActor(c); a.place(V3(-3.4 + i * 3.4, 0, 0.6)); a.faceToward(V3(-3.4 + i * 3.4, 0, 12)); return a; });
    this.titleScene.exit();
    // user: 「不要常显介绍面板，点一个职业再拉近，然后出介绍的UI面板」 → meta/classPick.ts (name plates, zoom, tilted info card)
    this.screen.close(); this.reopen = null; this.L.on = true; this.flask.root.visible = false;   // the info card lives in the UI 3D layer (nothing else of it shows here)
    this.classPick.focus = Math.max(0, CLASS_IDS.indexOf(this.cls)); this.classPick.open();
  }

  pick(c: ClassId, seed = (Date.now() % 100000) | 0) {
    this.startRun(new Run2({ seed, classId: c }), `pick ${c} seed ${seed}`);
  }
  private startRun(run: Run2, logLine: string) {
    const c = run.s.classId;
    if (this.classPick.on) this.classPick.close();
    this.titleScene.exit(); this.flask.root.visible = true;
    this.menu.close(); this.screen.close(); this.reopen = null; cue('select', 0.8); void audio.unlock().then(() => audio.playMusic('bgm_battle', 0.6));
    this.cls = c; this.run = run; this.result = null; this.tauntSeen = false; this.paused = false; FX.speed = SPEEDS[PREFS.speed];
    const skin: SuitSkin = { cls: c, scheme: 'A', plain: true };
    this.tray.skin = skin; this.mech.setClass(c); this.mech.setSkin(skin); this.loot.setClass(c);
    this.loot.gold = this.loot.shownGold = this.run.s.gold; this.loot.level = this.run.s.level; this.loot.xp = this.loot.shownXp = this.run.s.xp; this.loot.xpMax = xpToNext(this.run.s.level);
    this.log.push(logLine);
    void this.nextNode();
  }

  // ------------------------------------------------------------ nodes
  private cleanupWorld() {
    this.entrances = []; this.framing.clear(); this.reframePending = false; this.targetUid = null; this.hud.plates.clear(); this.field.show(false);
    for (const p of this.pre.values()) p.a.dispose(); this.pre.clear();
    for (const d of [...this.dice.values()]) d.dispose(); this.dice.clear(); this.sel = []; this.keep = null;
    for (const a of this.foes.values()) a.dispose(); this.foes.clear(); this.disp.clear();
    for (const p of this.plates.values()) this.ov.drop(p); this.plates.clear();
    for (const a of this.picks) a.dispose(); this.picks = [];
    this.hero?.dispose(); this.hero = null;
    for (const o of [...DICE3D]) if (o.mode === 'rest' || o.mode === 'play' || o.mode === 'fly') o.dispose();
  }
  private setStage(id: string) {
    this.cleanupWorld();
    this.stage = showStage(SCENES.find(s => s.id === id)!, { combat: true });
    this.hero = new BattleActor(this.cls); this.hero.place(HERO_POS.clone(), Math.PI); this.hero.faceToward(V3(0, 0, -3)); heroReadable(this.hero);
    const fit = this.fitNow([{ box: new THREE.Box3(V3(-0.2, 0, -1.6), V3(4.6, 2.0, 0)), platePx: 92, plateW: 170 }]);
    this.applyFit(fit); shot('battle', staticShot(EYE, LOOK, BATTLE_FOV), { cut: true });
  }
  async nextNode(): Promise<void> {
    const run = this.run!; const ph = run.s.phase;
    saveRun(run);   // console standard: autosave at the start of every node (deleted on win / death)
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
    this.display.reset(b);
    this.rows = b.rows().slice(); this.setupSlots(b);
    for (const p of this.rowPanes) this.ov.drop(p); this.rowPanes = [];
    this.pd = { hp: b.s.player.hp, maxHp: b.s.player.maxHp, armor: 0, barrier: 0 };
    this.flask.set({ ...this.pd }); this.mech.setRage(0); this.mech.setChant(0); this.mech.setStrikes(0); this.mech.setKept([]);
    this.tray.fill(3);
    const [t, sub] = NODE_CN[node.kind] || ['', '']; this.banner.show(t, sub, 1.4);
    this.log.push(`node ${node.idx} ${node.kind}`);
    const evs = b.start(); this.planOpening(b); this.field.show(true);
    after(0.9, () => this.runEvents(evs));
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
    await Promise.all(this.entrances); this.entrances = [];
    await this.reframe();
    this.syncLive();
    if (b.s.result) { await wait(0.9); await this.battleOver(); return; }
    this.busy = false; this.syncPreview(); this.refresh();
  }
  /** after a batch: the plates, flask and mech take the live values (the beats only tracked deltas) */
  private syncLive() {
    const b = this.b!, p = b.s.player;
    this.display.sync(b, this.disp); this.targetUid = displayTarget(this.disp, this.targetUid ?? b.s.targetUid);
    this.pd = { hp: p.hp, maxHp: p.maxHp, armor: p.armor, barrier: p.barrier }; this.flask.set({ ...this.pd });
    for (const [uid, d] of this.disp) { const e = b.enemy(uid); if (e) { d.hp = e.hp; d.maxHp = e.maxHp; d.armor = e.armor; } }
    this.mech.setRage(p.rage); this.mech.setChant(b.s.chantRing); this.mech.setStrikes(b.s.strikesUsed, b.s.comboThisTurn);
  }

  act(a: BotAct) {
    const b = this.b; if (!b || this.mode !== 'battle' || this.busy) return false;
    const r = a.k === 'reroll' ? b.reroll(a.uids) : a.k === 'play' ? b.play(a.ref, a.uids, a.target, a.mark || a.loose ? { ...(a.mark ? { mark: a.mark } : {}), ...(a.loose ? { loose: a.loose } : {}) } : undefined) : b.endTurn(this.keep ? { keep: this.keep } : undefined);
    if (!r.ok) { this.toast.show(r.reason, 1.0); cue('deny', 0.5); return false; }
    // user 2026-11-13: 「重投了以后不要再默认让骰子是选择状态」 (replaces UX_V3 2.2's kept selection)
    if (a.k === 'play' || a.k === 'reroll') this.clearSel(); else if (a.k === 'end') { this.clearSel(); this.keep = null; }
    this.runEvents(r.events); return true;
  }
  private playRow(i: number) {
    const b = this.b; if (!b || this.busy) return;
    const ref: RowRef = i >= this.rows.length ? 'basic' : this.rows[i].ref;
    const t = b.target(); this.act({ k: 'play', ref, uids: this.sel.slice(), target: t ? t.uid : undefined });
  }
  /** v3: play the skill in slot i at a target (null = the current target) */
  playSlot(i: number, target: number | null = null) {
    const b = this.b; if (!b || this.busy) return false;
    const ref = this.slotRefs[i]; if (ref == null) return false;
    if (target != null && !this.chooseTarget(target, ref)) return false;
    const uid = target ?? this.targetUid ?? b.target()?.uid;
    return this.act({ k: 'play', ref, uids: this.sel.slice(), target: uid ?? undefined, loose: this.slotLoose[i] });
  }
  /** v4.1 狂战: which loose-dice side a slot plays (the 劈砍 slot is slot 0, hidden unless lit; the class loose slot is 铁壁) */
  private slotLoose: Array<'chop' | 'guard' | undefined> = [];
  private setupSlots(b: Battle2) {
    const kindOf = (r: BoardRow): SkillKind => (r.def.cond.t === 'straight' ? 'straight' : r.def.cond.t === 'array' ? 'array' : 'same');
    const order: SkillKind[] = ['same', 'straight', 'array'];
    const rows = this.rows.slice().sort((x, y) => order.indexOf(kindOf(x)) - order.indexOf(kindOf(y))).slice(0, 3);
    const ba = b.cls.basicAttack, two = b.options([]).filter(o => o.ref === 'basic').length > 1;
    // R5: slot = icon + pattern badge + ≤4-char tag; the full name and the tier notes live in the tap tip
    const defs: SlotDef[] = [{ name: ba.name, kind: 'basic', tag: skillTag(ba.name), tagCol: '', up: skillUp(ba.name), badge: ba.maxDice > 1 ? 'handful' : undefined }];   // UX_V3 §8: 1–3 loose dice = a handful badge
    const tips: TipDef[] = [{ title: `${KIND_CN.basic} · ${ba.name}`, lines: [ba.maxDice > 1 ? `一次可交 1～${ba.maxDice} 颗，单体 ×${ba.coef}` : `只能交 1 颗，单体 ×${ba.coef}`, ...(ba.shadowify ? ['第一刀用它：补 1 颗暗影残骰'] : [])] }];
    this.slotRefs = ['basic']; this.slotLoose = [two ? 'guard' : undefined];
    if (two) {   // FIX6 §8 / UX_V3 6.0: 散骰 = 劈砍 or 铁壁, two medium buttons side by side (劈砍 left, 铁壁 on the thumb)
      if (defs[0].name === '铁壁') tips[0] = { title: `${KIND_CN.basic} · 铁壁`, lines: [`一次可交 1～${ba.maxDice} 颗，点数和 ×0.9 护甲`] };
      defs.unshift({ name: '劈砍', kind: 'basic', tag: skillTag('劈砍'), tagCol: '', badge: 'handful' });
      tips.unshift({ title: `${KIND_CN.basic} · 劈砍`, lines: [`一次可交 1～${ba.maxDice} 颗，单体伤害`] });
      this.slotRefs.unshift('basic'); this.slotLoose.unshift('chop');
    }
    for (const r of rows) {
      const k = kindOf(r), cn = KIND_CN[k], nm = r.name || r.def.name;
      defs.push({ name: nm, kind: k, tag: skillTag(nm), tagCol: '', up: skillUp(nm) });
      tips.push({ title: `${cn} · ${nm} ${ROMAN[r.level] || ''}`, lines: [`${k === 'same' ? '全部同一点数' : k === 'straight' ? '点数各不相同且连续' : '≥2 组同点，每组 ≥2 颗'}`, ...r.def.tierRule.steps.map(s => `${s.label} 颗：${tierText(r.def.tiers[s.tier]?.effects || [])}`)] });
      this.slotRefs.push(r.ref);
    }
    this.hud.bar.setSlots(defs, tips);
  }

  private async beat(e: Ev2): Promise<void> {
    const b = this.b!;
    if (e.t !== 'statusAdd') this.display.event(e, this.disp);
    switch (e.t) {
      case 'battleStart': if (e.wave > 0) { this.banner.show(`第 ${e.wave + 1} 波`, '', 0.9); await wait(0.5); } return;
      case 'enemyEnter': this.entrances.push(this.spawnFoe(e.uid, e.summonedBy)); await wait(0.15); return;
      case 'quote': {
        const a = this.foes.get(e.uid), en = b.enemy(e.uid); if (!a || !en || (e.kind !== 'enter' && e.kind !== 'death')) return;
        const lines = enemyCfgV2(en.cfgId).q?.[e.kind]; const ln = lines?.[e.index];
        if (ln && (en.rank !== 'normal' && en.rank !== 'summon')) {
          const say=()=>{ popPix(ln,a.head().add(V3(0,0.6,0)),{h:0.32,life:2,rise:0.3,color:'#ffe0c8'}); if(e.kind==='enter'){a.roar();cue('roar',0.6);} };
          if(e.kind==='enter')void Promise.all(this.entrances).then(say); else say();
        }
        return;
      }
      case 'turnStart': {
        await Promise.all(this.entrances); this.entrances = []; await this.reframe();
        this.mech.setStrikes(0); this.keep = null; this.endDone = false;
        this.lampsMax = 1;
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
        for (const u of e.uids) { const d = this.dice.get(u); if (d) { if (d.root.visible) fxSparks(d.root.position, 0xffe0a0, 6, 2, { life: 0.3 }); d.dispose(); this.dice.delete(u); } }
        return;
      }
      case 'hit': return this.impact(e);
      case 'statusAdd': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.status.type);
        popPix(`${ST_CN[e.status.type]}${e.status.value > 1 ? ' ' + e.status.value : ''}`, a.head().add(V3(0.5, 0.4, 0)), { color: ST_COL[e.status.type], h: 0.36, life: 1.1 });
        await statusFlight(this.ov, e.status.type, a.chest(), () => e.who === 'player' ? this.hud.status.landing(e.status.type, this.display.state!.player) : this.hud.plates.statusAt(e.who, e.status.type), this.hud.k);
        this.display.event(e, this.disp); return;
      }
      case 'statusTick': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.type); a.tint(e.type === 'burn' ? 0xff7a20 : 0x7aff4a, 0.8);
        // 玩家 DoT 随后还有 playerHit（含屏障吸收），不能在这里再扣一次。
        if (e.who !== 'player') { const d = this.disp.get(e.who); if (d) { d.hp = Math.max(0, d.hp - e.dmg); if (d.hp === 0) this.targetUid = displayTarget(this.disp, this.targetUid); } popPix(`-${e.dmg}`, a.head(), { color: ST_COL[e.type], h: 0.5 }); }
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
        if (this.endAhead()) await this.turnEndVanish();
        popPix(`${GAIN_CN[e.reason]} +${e.n} 骰`, src.clone().add(V3(0, 1.0, 0)), { color: '#ffe08a', h: 0.42, life: 1.3 });
        for (let i = 0; i < e.n; i++) await this.condense(src, gainSpecial(e.reason));
        return;
      }
      case 'special': {
        const d = this.dice.get(e.uid);
        if (e.action === 'transform' && d) { d.setSuit(this.skinFor(e.kind)); d.glow = 1; d.glowCol.set(0xff5a10); fxSparks(d.root.position, 0xff6a1a, 18, 4, { life: 0.6 }); popPix('怒火骰', d.root.position.clone().add(V3(0, 0.7, 0)), { color: '#ff9a40', h: 0.36 }); cue('roar', 0.4); await wait(0.3); }
        else if (e.action === 'vanish' && d) { if (this.endAhead()) { await this.turnEndVanish(); return; } fxSmoke(d.root.position, 0x6a5a7a, 4, { alpha: 0.4 }); d.dispose(); this.dice.delete(e.uid); }
        return;
      }
      case 'rage': this.mech.setRage(e.stacks); if (e.stacks > 0) popPix(`血怒 ${e.stacks}`, this.hero!.head().add(V3(-0.5, 0.9, 0)), { color: '#ff7a6a', h: 0.36 }); return;
      case 'chant': this.mech.setChant(e.ring); popPix(e.overcharge ? `过充 ${e.overcharge}` : `吟唱 ${e.ring}/3`, this.hero!.head().add(V3(0, 1.0, 0)), { color: '#8ac8ff', h: 0.4 }); fxGlow(this.hero!.chest(), COL.blue, 2, 0.6, 2); await wait(0.3); return;
      case 'backlash': if (e.stacks > 0) popPix(`反噬 ${e.stacks}`, this.hero!.head().add(V3(0.6, 0.4, 0)), { color: '#d080ff', h: 0.36 }); return;
      case 'overload': this.banner.show('过载', `${e.turns} 回合星辰骰`, 1.0, '#a8d8ff'); await wait(0.6); return;
      case 'strikeGain': popPix(`+${e.n} 刀`, this.hero!.head().add(V3(0, 1.0, 0)), { color: '#e0a8ff', h: 0.4 }); return;
      case 'freeReroll': popPix(`免费重投 +${e.n}`, this.hero!.head().add(V3(0.6, 1.2, 0)), { color: '#8ad8ff', h: 0.36 }); cue('magic', 0.3); return;
      case 'enemyTurn': return this.enemyTurnBeat();
      case 'enemyMove': return;
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
      case 'relic': { this.hud.top.fire(e.id); cue('relic', 0.6); await wait(0.25); return; }   // R5: the relic model rises and sparks (tap it for the text)
      case 'waveClear': return this.wavePayoff(e);
      case 'victory': {
        void this.flow.step('fade', async () => { for (const [u, d] of [...this.dice]) { fxSmoke(d.root.position, 0x6a5a7a, 3, { alpha: 0.3 }); d.dispose(); this.dice.delete(u); } while (this.tray.count) void this.tray.drop(); await this.flow.beat(0.3); });
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
  private skinFor(kind: DieKind): SuitSkin { return { cls: this.cls, scheme: 'A', plain: true, special: uiSpecial(kind) }; }
  /** turn start: the tray already holds the dice won last turn; the base dice join them (front), then specials are matched */
  private reconcileTray(n: number, sp: Array<SpecialId | undefined>) {
    const t = this.tray; n = Math.min(6, n);
    while (t.count > n) { const d = t.dice.shift()!; d.die.dispose(); }
    if (t.count < n) t.topUp(n - t.count);
    t.dice.forEach((d, i) => { if (d.special !== sp[i]) { d.special = sp[i]; d.die.setSuit({ ...t.skin, special: sp[i] }); } });
    for (const d of t.dice) ghost(d.die, false, d.special);
  }
  private async onRoll(e: Extract<Ev2, { t: 'roll' }>) {
    if (e.reason === 'turn') {
      // v4: dice kept on the field stay (a re-rolled carried die hops in place); only the rest come out of the prep tray
      const stay = e.dice.filter(s => this.dice.has(s.uid)), fresh = e.dice.filter(s => !this.dice.has(s.uid)), keptSet = new Set(e.kept);
      for (const [u, d] of [...this.dice]) if (!e.dice.some(s => s.uid === u)) { d.dispose(); this.dice.delete(u); }
      await this.reframe();
      await this.flow.step('start.throw', async () => {
        for (const s of stay) { const d = this.dice.get(s.uid)!; d.setSuit(this.skinFor(s.kind)); if (d.value !== s.value || !keptSet.has(s.uid)) { d.setValue(s.value, d.topIdx, d.topTurns); fxSparks(d.root.position, 0xc8b0ff, 8, 2, { life: 0.35 }); } d.glow = 0; d.lift = 0; }
        if (!fresh.length) { while (this.tray.count) void this.tray.drop(); return; }
        this.reconcileTray(fresh.length, fresh.map(d => uiSpecial(d.kind)));
        await wait(0.08); this.hero!.toss(); await wait(0.06);   // user 11-13: 「吐骰子的过程过慢」 (was 0.3 + 0.12)
        this.flying = true;
        // UX_V3 §1b 骰场: the new dice land in the free sockets of the dais (dice staying on the field keep theirs); the throws are
        // simulated in the field's unit frame and mapped into the world by the field (diceField.ts)
        const plan = throwPlan(this.field, fresh.length, stay.map(s => this.dice.get(s.uid)!));
        this.tray.dice.slice(0, fresh.length).forEach((t, i) => this.field.track(t.die, plan.slots[i] ?? 0));
        const ds = await this.tray.launch(fresh.map(d => d.value), { eye: EYE, kept: plan.kept, stagger: 0.06, rate: 1.2, targets: plan.targets, targetR: 0.1, from: this.field.c.clone().add(V3(-2.2, 2.4, 1.6)) });
        this.flying = false;
        ds.forEach((d, i) => { const s = fresh[i]; if (!s) { d.dispose(); return; } d.uid = s.uid; this.dice.set(s.uid, d); });
      });
      return;
    }
    if (e.reason === 'flip') { for (const s of e.dice) { const d = this.dice.get(s.uid); if (d) { d.setValue(s.value, d.topIdx, d.topTurns); fxSparks(d.root.position, 0x8ad8ff, 10, 3, { life: 0.4 }); } } return; }
    // reroll / spawn / return: (re)thrown from above the near edge, avoiding the dice at rest
    const ids = new Set(e.dice.map(s => s.uid)), F = this.field;
    const restD = [...this.dice.values()].filter(d => d.mode === 'rest' && !ids.has(d.uid!));
    const spawn = e.reason === 'spawn';
    // UX_V3 §1b / 2.1: a rerolled die bounces up and lands back in its own socket; new dice take free sockets (all in the unit frame)
    const inPlace = e.dice.map(s => { const d = this.dice.get(s.uid); return !!d && d.mode === 'rest' && e.reason === 'reroll'; });
    const own = e.dice.map((s, i) => (inPlace[i] ? this.dice.get(s.uid)! : null));
    const free = F.freeSlots(inPlace.filter(x => !x).length, [...restD, ...own.filter((d): d is Die3D => !!d)]);
    const slots = own.map(d => (d ? F.slotIndex(d) : free.shift() ?? 0));
    const targets = slots.map(i => F.toUnit(F.slot(i)));
    const kept = restD.map(d => ({ p: F.toUnit(d.home).setY(0.4), q: d.homeQ.clone() }));
    const from = spawn && this.hero ? this.hero.home.clone().add(V3(0.7, 0.45, -0.2)) : F.slot(2).add(V3(-2.2, 2.0, 1.6).multiplyScalar(F.s));
    const fromU = F.toUnit(from);
    const recs = simTo(targets, kept, i => (inPlace[i] ? targets[i].clone().add(V3(0, 1.5, 0.35)) : fromU), 0.1); let dur = 0;
    const go = async () => {
    e.dice.forEach((s, i) => {
      let d = this.dice.get(s.uid);
      if (!d) { d = new Die3D('standard', { suit: this.skinFor(s.kind) }); d.uid = s.uid; this.dice.set(s.uid, d); if (e.reason === 'spawn') { d.glow = 0.8; d.glowCol.set(0xb860ff); } }
      else d.setSuit(this.skinFor(s.kind));
      F.track(d, slots[i]); d.root.position.copy(from); playThrow(d, recs[i], s.value, EYE); dur = Math.max(dur, recs[i].rel + recs[i].dur);
    });
    if (spawn && this.hero) { fxSmoke(this.hero.home.clone().add(V3(0.4, 0.08, 0)), 0x2a1838, 6, { s: 0.35, alpha: 0.55, up: 0.6 }); cue('magic', 0.5); }   // UX_V3 §8: the shadow die rises out of the hero's shadow (no text)
    cue('whoosh', 0.6); await wait(dur + 0.05);
    };
    if (spawn) await this.flow.step('play.spawn', go); else await go();
  }
  /** v4: the prep tray only holds the dice won for next turn (they condense as they are won); no faint 'maybe' dice any more */
  private syncPreview() { /* intentionally empty: see condense() / turnEndVanish() */ }
  /** is this beat part of a turn end (the batch goes on into the enemy turn)? */
  private endAhead() { return !this.endDone && this.batch.slice(this.bi).some(x => x.t === 'enemyTurn'); }
  /** a die won for next turn condenses in the prep tray; past 6 it bursts into sparks that fly into the hero (溢出加伤) */
  private condense(src: THREE.Vector3, sp?: SpecialId) {
    return this.flow.step('earn', async () => {
      const onField = this.endDone ? this.dice.size : 0;
      if (this.tray.earnedCount + onField >= 6) {
        const p = this.tray.slotPx(Math.min(5, this.tray.count), Math.min(6, this.tray.count + 1)), w = this.L.at(p.x, p.y, 2);
        this.tray.sparks.burst(w, 18, this.L.px(220), this.L.px(5), '#ff9a40', { life: 0.5 });
        const to = this.hero!.chest(); fxSparks(to, 0xff7a30, 20, 4, { life: 0.5 }); fxGlow(to, 0xff7a30, 1.8, 0.4, 3); cue('roar', 0.3);
        popPix('溢出 → 加伤', this.hero!.head().add(V3(0, 0.8, 0)), { color: '#ff9a6a', h: 0.36 }); await this.flow.beat(0.4); return;
      }
      await this.tray.earn(src, sp);
    });
  }
  private endKeep = new Set<number>();
  /** turn end step 4 (after the gains have condensed): the dice that stay on the field get a ring of light */
  private turnEndStay() {
    const keep = this.endKeep;
    return this.flow.step('end.stay', async () => {
      const ds = [...this.dice.values()]; if (!ds.length) return;
      for (const d of ds) { const c = keep.has(d.uid!) ? 0x6ad8ff : 0xb860ff; d.glow = 1.1; d.glowCol.set(c); fxRing(d.home.clone().add(V3(0, 0.05, 0)), c, 0.7, { life: 0.5, width: 0.08 }); }
      cue('tick', 0.4); await this.flow.beat(0.4); for (const d of ds) d.glow = 0.35;
    });
  }
  /** turn end step 1: the dice that do not stay fade on the field; step 4: the ones that stay get a ring of light */
  private turnEndVanish() {
    if (this.endDone) return Promise.resolve(); this.endDone = true;
    const next = this.batch.slice(this.bi).find((x): x is Extract<Ev2, { t: 'roll' }> => x.t === 'roll' && x.reason === 'turn');
    const stay = new Set(next ? next.dice.map(s => s.uid) : []), keep = new Set(next ? next.kept : []);
    this.clearSel();
    const p = this.flow.step('end.vanish', async () => {
      let any = false;
      // user 11-13: 「回合末没用的骰子 / 挣到的骰子和队列要有往返的交互」 — the dice that do not stay fly back into the prep tray (next
      // turn's dice: the turn start throws them out again), one after another, instead of fading on the field
      let j = 0;
      for (const [u, d] of [...this.dice]) if (!stay.has(u)) { any = true; const at = d.root.position.clone(); fxSparks(at, 0xc8d8ff, 5, 2, { life: 0.3 }); d.dispose(); this.dice.delete(u); void this.tray.recall(at, j++ * 0.06); }
      if (any) await this.flow.beat(0.32 + j * 0.06);
    });
    this.endKeep = keep;
    return p;
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
  /** v4 (SHOW3 #10): ① pattern + skill name + points, the dice lined up → ② the dice fly into the hero, energy gathers → ③ the attack */
  private async presentPlay(e: Extract<Ev2, { t: 'rowPlay' }>) {
    const hero = this.hero!, row = e.ref === 'basic' ? null : this.rows[e.ref];
    const lamps = row ? lampsFor(row, e.tier) : 1, tc = TIER_COL[Math.max(0, Math.min(4, lamps - 1 + (e.ultimate ? 4 : 0)))], col = hex(tc);
    const kind: SkillKind = !row ? 'basic' : row.def.cond.t === 'straight' ? 'straight' : row.def.cond.t === 'array' ? 'array' : 'same';
    const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
    const pts = ds.reduce((a, d) => a + d.value, 0);
    if (this.cls === 'rogue') this.mech.setStrikes(e.strike, e.combo);
    await this.flow.step('play.show', async () => {
      // the handed dice line up in the air above the field, value up, in the tier colour
      const n = ds.length, gap = 0.95, c0 = hero.home.clone().add(V3(1.7, 2.3, -0.6));
      for (const d of ds) { d.glow = 1.2; d.glowCol.set(col); }
      await Promise.all(ds.map((d, i) => flyDie(d, c0.clone().add(V3((i - (n - 1) / 2) * gap, 0, 0)), 0.3, { arc: 0.4, ease: ease.outCubic, q: presentQuat(d.topIdx, d.topTurns, CAMERA.quaternion.clone()) })));
      const top = c0.clone().add(V3(0, 1.0, 0));
      popPix(e.name, top, { color: tc, h: 0.5, big: e.ultimate, life: 1.5, rise: 0.3 }); void pts; void kind;   // R5: no 「2颗 1档」 / points text
      if (e.combo) popPix('精准连击', top.clone().add(V3(0, 0.6, 0)), { color: '#e070ff', h: 0.4, life: 1.4 });
      if (e.bonusPct) popPix(`+${e.bonusPct}%`, c0.clone().add(V3((n / 2) * gap + 0.6, 0.2, 0)), { color: '#ffb070', h: 0.38 });
      cue('reveal', Math.min(4, lamps)); for (const d of ds) fxSparks(d.root.position, col, 6, 2, { life: 0.3 });
      await this.flow.beat(0.5);
    });
    await this.flow.step('play.gather', async () => {
      const to = hero.chest();
      await Promise.all(ds.map((d, i) => wait(i * 0.05).then(() => flyDie(d, to, 0.32, { arc: 0.6, ease: ease.inCubic, scale: d.root.scale.x * 0.4, turns: 0.8 })).then(() => { d.root.visible = false; fxGlow(to, col, 1.4, 0.3, 3); })));
      // energy gathering on the hero: motes pulled in, a ring at the feet
      for (let i = 0; i < 3; i++) after(i * 0.08, () => fxSparks(to.clone().add(V3(R(-1.2, 1.2), R(0.2, 1.4), R(-1, 1))), col, 6, 2, { life: 0.3, dir: V3(0, -1, 0) }));
      fxRing(hero.home.clone().add(V3(0, 0.1, 0)), col, 1.4, { life: 0.5, width: 0.14 }); fxGlow(to, col, 2.4, 0.5, 3); cue('magic', 0.5);
      if (e.ultimate) { shake(0.4); slowmo(0.5, 0.35); GRADE.flashCol.set(1, 0.9, 0.8); this.flash(0.35); }
      await this.flow.beat(0.3);
    });
    // ③ the attack: the hits / effects that follow are their own engine events
    const tA = e.target != null ? this.foes.get(e.target) : [...this.foes.values()].find(a => a.root.visible);
    const aim = tA ? tA.home.clone() : V3(0, 0, -3); hero.faceToward(aim);
    const melee = this.cls !== 'mage', dist = melee ? Math.max(0, hero.home.distanceTo(aim) - (tA && this.disp.get(e.target!)?.boss ? 2.6 : 1.6)) : 0;
    const act = hero.attack(dist); cue('whoosh', 0.9);
    await act.impact;
    if (!melee && tA) await this.orb(hero.weapon(), tA.chest(), col);
  }
  private async impact(e: Extract<Ev2, { t: 'hit' }>) {
    const a = this.foes.get(e.uid), d = this.disp.get(e.uid); if (!a) return;
    lastHit.set(e.uid, e.dmg);   // fx4: the killing blow's size picks the death form
    if (d) { d.armor = Math.max(0, d.armor - e.absorbed); d.hp = Math.max(0, d.hp - e.hpDmg); }
    if(d?.hp===0)this.targetUid=displayTarget(this.disp,this.targetUid);
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
  private freeLane() { const used = new Set([...this.disp.entries()].filter(([u]) => { const a = this.foes.get(u); return a && a.root.visible && !a.dead; }).map(([, d]) => d.lane)); for (let i = 0; i < 8; i++) if (!used.has(i)) return i; return 0; }
  private async spawnFoe(uid: number, by?: number) {
    const en = this.b!.enemy(uid); if (!en) return;
    const def = ROSTER.find(d => d.id === en.cfgId) ? en.cfgId : 'forest_ghoul';
    const pre = this.pre.get(uid); if (pre) this.pre.delete(uid);
    const boss = en.rank === 'midBoss' || en.rank === 'boss', lane = pre ? pre.lane : boss ? -1 : this.freeLane();
    const withBoss = !boss && this.b!.alive().some(x => x.uid !== uid && (x.rank === 'midBoss' || x.rank === 'boss'));
    const a = pre ? pre.a : new BattleActor(def), to = foePosition(Math.max(0, lane), boss, withBoss); a.root.visible = true;
    this.foes.set(uid, a); const d = this.display.seed(this.b!, uid, Math.max(0, lane), boss, this.batch.slice(this.bi + 1)); this.disp.set(uid, d);
    a.place(to); a.faceToward(this.hero!.home); a.update(0); this.framing.set(uid, actorSubject(a, to)); this.reframePending = true;
    if (boss) { // 留场骰期间镜头须锁定，先把首领可能召唤的完整阵位纳入安全区。
      const cfg = enemyCfgV2(en.cfgId).summons;
      if (cfg) { const minion = new BattleActor(cfg.minionId); for(let i=1;i<=3;i++) { const pos=foePosition(i,false,true); minion.place(pos); minion.faceToward(this.hero!.home); minion.update(0); this.framing.set(-i,actorSubject(minion,pos)); } minion.dispose(); }
    }
    this.targetUid = displayTarget(this.disp, this.targetUid);
    this.plates.set(uid, this.ov.pane(5));
    if (by != null) {   // a summon rises out of the ground next to its master
      const m = this.foes.get(by); if (m) { m.summon(); fxGlow(m.weapon(), COL.green, 2.4, 0.6, 2.4); }
      a.place(V3(to.x, -1.8, to.z)); a.faceToward(this.hero!.home); cue('summon');
      fxRing(V3(to.x, 0.05, to.z), COL.green, 2, { life: 0.8, width: 0.15, fill: 0.3 });
      await animP(0.7, k => { a.home.y = lerp(-1.8, 0, ease.outBack(k)); }); a.roar(); d.ready = true;
    } else {
      a.place(entranceFrom(to)); a.faceToward(to);
      a.walkK = 1; const from = a.home.clone(); await animP(0.75, k => { a.home.lerpVectors(from, to, ease.inOut(k)); }); a.walkK = 0; a.faceToward(this.hero!.home); d.ready = true;
    }
    if (en.ct === 'guardian' && !this.tauntSeen) { this.tauntSeen = true; popPix('嘲讽', a.head().add(V3(0, 0.5, 0)), { color: '#8ac8ff', h: 0.48, life: 1.6 }); }
  }
  private async enemyTurnBeat() {
    this.clearSel(); this.banner.show('敌方回合', '', 0.45, '#ffb0a0');
    // turn end (SHOW3 #14): vanish -> condense (gainDice beats) -> recall (no rule yet) -> the dice that stay glow
    await this.turnEndVanish(); await this.turnEndStay(); this.mech.setKept([]);
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
    if (e.isDot) this.hfx.dotPierce();   // FIX6 §7: poison / burn go through the barrier: the dome thins, nothing reads as a block
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
    if (d) d.dying = true;
    this.targetUid = displayTarget(this.disp, this.targetUid); this.hud.plates.freeze(uid);
    this.lastDeath = a.chest(); const pl = this.plates.get(uid); if (pl) { this.ov.drop(pl); this.plates.delete(uid); }
    cue('shatter', d?.boss ? 1.4 : 0.8);
    if (d?.boss) {
      a.collapse(); slowmo(1.6, 0.25); shake(0.8); GRADE.flashCol.set(1, 1, 1); this.flash(0.5);
      fxSparks(a.chest(), 0xa0ffc0, 60, 8, { life: 0.9, grav: 3 }); await wait(1.0);
      await playDeath(a, { boss: true, from: this.hero?.home, ratio: (lastHit.get(uid) ?? 0) / Math.max(1, d.maxHp) });
      const st = this.stage; anim(1.6, k => st?.phase2(1 - k), undefined, { real: true });
    } else {
      // user: 「击杀了敌人过后后续的流程现在一直在等敌人的尸体消失」 — the flow goes on after the fall; the body sinks in the background
      const fall = playDeath(a, { from: this.hero?.home, ratio: (lastHit.get(uid) ?? 0) / Math.max(1, d?.maxHp ?? 1) });
      void fall.then(() => { if (d) d.gone = true; this.framing.delete(uid); if (a.top > 3.0) this.reframePending = true; });
      await wait(0.35);
      return;
    }
    if (d) d.gone = true; this.framing.delete(uid);
    if (d?.boss) for(const key of this.framing.keys()) if(key<0) this.framing.delete(key);
    if (d?.boss || a.top > 3.0) this.reframePending = true;
  }
  /** 跨波兑现: the dice earned this turn burst out of the last kill and settle into the prep tray, then follow into the next wave */
  private async wavePayoff(e: Extract<Ev2, { t: 'waveClear' }>) {
    const extra = Math.max(0, e.nextDice - 3), from = this.lastDeath.clone();
    this.banner.show(`第 ${e.wave + 1} 波 清场`, '', 1.4, '#ffe08a'); await wait(0.6);
    await this.flow.step('end.vanish', async () => { for (const [u, d] of [...this.dice]) { fxSmoke(d.root.position, 0x6a5a7a, 3, { alpha: 0.35 }); d.dispose(); this.dice.delete(u); } await this.flow.beat(0.3); });
    this.endDone = true;
    // each die won this turn condenses in the prep tray with its reason (the next wave's base dice come out with the throw)
    const reasons = e.reasons.slice();
    // dice already condensed during the turn (斩首 …) are in the tray; only the missing ones condense now
    for (let i = this.tray.count; i < extra; i++) {
      const r = reasons[i] as GainReason | undefined;
      popPix(r ? `${GAIN_CN[r]} +1` : '+1', from.clone().add(V3(R(-0.4, 0.4), 1.0 + i * 0.3, 0)), { color: '#ffe08a', h: 0.45, life: 1.2 });
      fxSparks(from, 0xffe08a, 20, 5, { life: 0.5 }); cue('reveal', 0.8);
      await this.condense(from, r ? gainSpecial(r) : undefined);
    }
    await wait(0.3);
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
        const cw = Math.min(300, (W - 80) / n - 20), ch = Math.min(280, H * 0.44), y0 = H * 0.5 - ch / 2 + 20 * k;
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
    clearRun(); this.pauseBtn.show(false);
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
  private botGen = 0; private freeRolls = 0; private autoEndArmed = false; private botQ: BotAct[] = []; private botTurnNo = -1;
  bot(on = true) {
    this.botOn = on; const gen = ++this.botGen;
    const loop = () => { if (!this.botOn || gen !== this.botGen) return; try { this.botTick(); } catch (e) { this.errors.push('[bot] ' + ((e as Error).stack || e)); } after(0.3, loop); };
    if (on) after(0.2, loop); return on;
  }
  /** one bot step (called every 0.3 s while the bot is on): tap a screen button, or play the next action of botTurn */
  private botTick() {
    if (this.mode === 'select' && this.classPick.on) { this.pick(this.cls); return; }
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
    const opts = live ? b.options(this.sel) : null, n = this.rows.length, tid = this.targetUid ?? b.target()?.uid;
    this.hud.plates.selectionPreview = [];
    const states: SlotState[] = [];
    let topTier = 0, anyLit = false;
    this.slotRefs.forEach((ref, si) => {
      const lo = this.slotLoose[si], i = ref === 'basic' ? (lo ? opts?.findIndex(x => x.ref === 'basic' && x.loose === lo) ?? -1 : n) : ref, o = opts?.[i], row = ref === 'basic' ? null : this.rows.find(r => r.ref === ref) || null;
      if (!o) { states.push({ lit: false, tier: 0, dead: !live, ready: false }); return; }
      const dead = o.reason === 'strike' || o.reason === 'chant' || (o.reason as string) === 'used', ready = !dead && (row ? !!o.bestTier : b.dice().length > 0);
      if (!o.ok) { states.push({ lit: false, tier: 0, dead, ready }); if (ready && !this.readyWas[si]) cue('tick', 0.25); this.readyWas[si] = ready; return; }
      this.readyWas[si] = ready;
      const tier = row ? lampsFor(row, o.tier) : 1, pv = displayPreview(b, o.ref, this.sel, tid, this.disp, lo);
      if (pv) for (const h of pv.hpHits) { const old = this.hud.plates.selectionPreview.find(p => p.uid === h.uid); if (old) old.dmg = Math.max(old.dmg,h.dmg); else this.hud.plates.selectionPreview.push({uid:h.uid,dmg:h.dmg}); }
      const fx = row ? row.def.tiers[o.tier!]?.effects || [] : [], all = fx.some(e => e.t === 'dmg' && e.target === 'all');
      const value = pv ? pv.total || pv.armor || pv.barrier || pv.heal : 0, valKind = !pv || pv.total ? 'dmg' as const : pv.armor ? 'armor' as const : pv.barrier ? 'barrier' as const : 'heal' as const;
      const oc = (o as { v4?: { comboPct?: number; lastStrike?: boolean } }).v4, combo = this.cls === 'rogue' && oc?.comboPct != null ? { pct: oc.comboPct, last: !!oc.lastStrike } : null;
      states.push({ lit: true, tier: pv?.ultimate ? 3 : tier, dead: false, ready: true, value, valKind, all, ultimate: !!pv?.ultimate, extra: extraGlyph(fx), combo, line: this.cls === 'warrior' ? warriorLine((o as { v4?: Parameters<typeof warriorLine>[0] }).v4, lo === 'guard' || (ref === 'basic' && !lo && b.cls.basicAttack.name === '铁壁')) : null, targetKind: tid != null ? b.enemy(tid)?.ct : '', targetId: tid != null ? b.enemy(tid)?.cfgId : '' });
      this.slotAll[si] = all; anyLit = true; topTier = Math.max(topTier, pv?.ultimate ? 4 : tier);
    });
    this.sel = this.sel.filter(u => this.dice.has(u));
    for (const u of this.sel) { const d = this.dice.get(u); if (d && d.mode === 'rest' && live) { d.lift = 1; d.glow = 1; } }   // kept after a reroll
    this.hud.bar.set(states, live ? this.sel.map(u => this.dice.get(u)?.value ?? 1) : []);
    // dice of the lit skill glow in its tier colour; selected dice that make nothing glow grey
    const selCol = anyLit ? hex(TIER_COL[Math.max(0, Math.min(4, topTier - 1))]) : 0x8a8090;
    for (const u of this.sel) { const d = this.dice.get(u); if (d) d.glowCol.set(anyLit ? (topTier <= 1 ? 0xffd860 : selCol) : 0xffd860); }
    const ri = b.rerollInfo(), can = live && (ri.free > 0 || ri.bloodCost != null);
    this.freeRolls = live ? ri.free : 0;
    this.lampsMax = Math.max(this.lampsMax, ri.free, 1);
    this.hud.reroll.set({ free: live ? ri.free : 0, blood: ri.free > 0 ? null : ri.bloodCost, can, sel: this.sel.length, maxLamps: this.lampsMax });
    // v3 auto end: no strikes left or no dice on the field → end the turn by itself (the mage's keep pick waits for its button)
    const kiA = live ? b.keepInfo() : null;
    if (live && PREFS.autoEnd && b.mustEndTurn() && !(kiA?.need) && !this.autoEndArmed) { this.autoEndArmed = true; after(0.45, () => { this.autoEndArmed = false; const bb = this.b; if (bb && !this.busy && bb.s.phase === 'player' && bb.mustEndTurn() && !bb.keepInfo()?.need) this.act({ k: 'end' }); }); }
    // mage after the strike: which leftovers stay (cyan)
    const ki = live ? b.keepInfo() : null, keepSet = new Set(ki?.need ? (this.keep ?? ki.selected) : []);
    for (const d of this.dice.values()) if (!this.sel.includes(d.uid!)) { const kp = keepSet.has(d.uid!); d.glow = kp ? 1.1 : (d.suit?.special ? 0.5 : 0); d.glowCol.set(kp ? 0x6ad8ff : 0xb860ff); d.lift = kp ? 0.55 : 0; }
  }
  private lampsMax = 1;

  // ------------------------------------------------------------ R6S: stage bands, dice field, camera (battleCamera.ts / diceField.ts)
  private fitNow(extra: FramingSubject[] = []): CameraFit {
    const subs = [actorSubject(this.hero!, this.hero!.home, true), ...this.framing.values(), ...extra];
    return fitBattle(subs, { W: this.ov.w, H: this.ov.h, k: this.hud.k, shift: CAM.shift, portrait: this.ov.h > this.ov.w });
  }
  private applyFit(fit: CameraFit) { EYE.copy(fit.eye); LOOK.copy(fit.look); BATTLE_FOV = fit.fov; this.camDist = fit.distance; this.field.place(fit.field.c, fit.field.s); }
  /** before the opening walk-in: build the enemies at their stand points (hidden) so the camera frames the final line-up once */
  private planOpening(b: Battle2) {
    for (const p of this.pre.values()) p.a.dispose(); this.pre.clear();
    const live = b.alive(), anyBoss = live.some(e => e.rank === 'midBoss' || e.rank === 'boss'); let lane = 0;
    for (const en of live) {
      const def = ROSTER.find(d => d.id === en.cfgId) ? en.cfgId : 'forest_ghoul', boss = en.rank === 'midBoss' || en.rank === 'boss', ln = boss ? -1 : lane++;
      const a = new BattleActor(def), to = foePosition(Math.max(0, ln), boss, anyBoss && !boss);
      a.place(to); a.faceToward(this.hero!.home); a.update(0); a.root.visible = false;
      this.pre.set(en.uid, { a, lane: ln }); this.framing.set(en.uid, actorSubject(a, to));
    }
    this.applyFit(this.fitNow()); shot('battle', staticShot(EYE, LOOK, BATTLE_FOV), { cut: true }); this.reframePending = false;
  }
  /** UX_V3 §1b: reframe only at entrances, summons / new waves and big deaths, never while the player is picking or aiming; dice
   *  resting on the dais move with it. force (resize): at once. */
  private async reframe(force = false, dur = 0.6) {
    if (!this.reframePending || !this.hero) return;
    if (!force && (this.sel.length || this.drag || this.flying)) return;
    this.reframePending = false;
    const fit = this.fitNow(), from = EYE.clone(), look = LOOK.clone();
    EYE.copy(fit.eye); LOOK.copy(fit.look); BATTLE_FOV = fit.fov; this.camDist = fit.distance;
    const mv = this.field.moveTo(fit.field.c, fit.field.s, this.dice.values(), dur);
    if (dur <= 0) { shot('battle', staticShot(EYE, LOOK, BATTLE_FOV), { cut: true }); await mv; return; }
    await Promise.all([mv, animP(dur, t => shot('battle', staticShot(from.clone().lerp(EYE, ease.inOut(t)), look.clone().lerp(LOOK, ease.inOut(t)), BATTLE_FOV), { cut: true }))]);
    await wait(0.02);
  }
  private chooseTarget(uid: number, ref?: RowRef) {
    const b = this.b!;
    if (!canAim(b, uid, ref, this.sel)) {
      this.hud.plates.deny(uid); this.toast.show('先打盾卫', 1.0, '#a8d8ff'); cue('deny', 0.4); return false;
    }
    b.s.targetUid = uid; this.targetUid = uid; this.refresh(); return true;
  }

  // ------------------------------------------------------------ per frame
  private frame(dt: number) {
    const t = clock.time;
    this.menu.update(clock.rdt); tickPrefs(); this.pollStart(); this.dieHold();
    if (this.classPick.on) this.classPick.tick();
    this.titleScene.tick();
    if (this.paused) FX.speed = 0;
    this.pauseBtn.show(!this.menu.on && (this.mode === 'battle' || this.mode === 'shop' || this.mode === 'choice'));
    // R7B #6 (user: 「放大的技能按钮长按不动的时候要出 tips 才行吧」): holding the play button still for 0.4 s opens its tip
    const D = this.drag; if (D && !D.moved && !D.tip) { D.held += dt; if (D.held >= 0.4 && this.hud.bar.tips[D.i]) { D.tip = true; this.hud.bar.tipOn = D.i; this.hud.bar.endAim(); cue('tick', 0.4); } }
    this.hero?.update(dt); for (const a of this.foes.values()) a.update(dt); for (const a of this.picks) a.update(dt);
    for (const d of this.dice.values()) if(d.mode==='rest') d.foot.position.y=0.012;
    if (this.display.state) Object.assign(this.display.state.player, this.pd);
    this.hfx.update(dt, this.hero, this.b, this.cls, this.mode === 'battle', this.display.state);
    this.tray.update(dt, t); this.flask.update(dt); this.loot.update(dt, t);
    const H = this.hud, b = this.b, inBattle = this.mode === 'battle' && !!b;
    H.top.gold = this.loot.shownGold; H.top.setRelics(this.run ? this.run.s.relics.map(id => { try { const r = relicV2(id); return { id, name: r.name, desc: r.desc }; } catch { return { id, name: id, desc: '' }; } }) : []);
    H.update(dt);
    // v4.1 狂战: the 劈砍 slot only shows while it is lit (beside 铁壁); otherwise the bar reads as the usual four slots
    if (this.slotLoose[0] === 'chop' && H.bar.slots[0]) H.bar.slots[0].tVis = H.bar.on && H.bar.slots[0].st.lit ? 1 : 0;
    if (inBattle) {
      const live = !this.busy && b!.s.phase === 'player' && !b!.s.result;
      const kiEnd = live ? b!.keepInfo() : null;
      H.chant.v = { mage: this.cls === 'mage', ring: this.display.state?.chantRing ?? 0, live, struck: (this.display.state?.strikesUsed ?? 0) > 0, keep: !!kiEnd?.need, risk: live ? b!.chantRisk() : 0, keepN: kiEnd?.need ? (this.keep ?? kiEnd.selected).length : 0, urgent: live && b!.mustEndTurn() && b!.rerollInfo().free <= 0 };
      // the flask rows (buffs left, debuffs right) and the DoT cut on the blood
      const p = this.display.state!.player;
      this.flask.dot = H.status.update({ hp: this.pd.hp, maxHp: this.pd.maxHp, armor: this.pd.armor, barrier: this.pd.barrier, rage: p.rage, backlash: p.backlash, statuses: p.statuses }, this.pd.hp);
      // field marks: reroll badges over the selected dice (when a reroll is available), cyan rings under the dice that stay
      const ri = live ? b!.rerollInfo() : null, canRr = !!ri && (ri.free > 0 || ri.bloodCost != null);
      const selP = canRr ? this.sel.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d && d.mode === 'rest').map(d => d.root.position) : [];
      const ki = live ? b!.keepInfo() : null, keepSet = new Set(ki?.need ? (this.keep ?? ki.selected) : []);
      const keepP = [...this.dice.values()].filter(d => d.mode === 'rest' && (keepSet.has(d.uid!) || (!live && d.glow > 0.3 && d.glowCol.getHex() === 0x6ad8ff))).map(d => d.home);
      H.marks.update(dt, selP, keepP);
    } else { H.status.update(null, 0); this.giveUp.visible = false; }
    this.banner.update(dt); this.toast.update(dt); this.screen.update(dt);
    if (this.drag?.foe != null && canAim(this.b!, this.drag.foe, this.slotRefs[this.drag.i], this.sel)) this.foes.get(this.drag.foe)?.tint(0xff0a0a, 0.8);
    this.syncPlates(dt);
  }
  private syncPlates(dt: number) {
    const b = this.b; if (!b || this.mode !== 'battle') { this.hud.plates.sync([], null, false, dt); return; }
    const live = !this.busy && b.s.phase === 'player', list: FoeView[] = [];
    for (const [uid, a] of this.foes) {
      const fd = this.disp.get(uid), en = b.enemy(uid); if (!fd || !en || fd.gone) continue;
      const it = live && fd.ready && !fd.dying ? b.intent(en) : null;
      const guard = fd.ct === 'guardian' && fd.hp > 0 && !fd.dying, protectedBy = !guard && [...this.disp.values()].some(d => d.ct === 'guardian' && d.hp > 0 && !d.dying && !d.gone);
      list.push({ uid, at: a.root.position.clone().add(V3(0, a.top + 0.3, 0)), foot: a.root.position, width: a.width, hp: fd.hp, maxHp: fd.maxHp, armor: fd.armor, big: fd.boss || en.rank === 'elite', boss: fd.boss, taunt: guard, protected: protectedBy, dying: fd.dying,
        intent: it && it.kind !== 'mov' ? { kind: it.kind, value: it.value, status: it.status } : null, statuses: fd.statuses });
    }
    this.hud.plates.sync(list, this.targetUid, live, dt);
  }
  /** tap an enemy: a short tip with its intent spelled out (the plate keeps only icon + number) */
  private foeTip(uid: number) {
    const b = this.b!, en = b.enemy(uid); if (!en) return; const it = b.intent(en);
    const what = it.kind === 'atk' ? `下回合攻击 ${it.value ?? ''}${it.status ? ' 并附加' + (ST_CN[it.status as StatusV2] || '') : ''}` : it.kind === 'def' ? `下回合防御 +${it.value ?? ''} 护甲` : it.kind === 'frz' ? '被控制，下回合不行动' : it.kind === 'curse' ? '往你的骰子里塞诅咒骰' : `施法：${cnText(it.desc || it.text)}`;
    this.toast.show(`${en.name}：${what}`, 1.6, '#ffe0c8');
  }
  private flash(k: number) { anim(0.28, t => { GRADE.flash = k * (1 - t) * (1 - t); }, () => { GRADE.flash = 0; }, { real: true }); }

  // ------------------------------------------------------------ input
  private pickDie(x: number, y: number) {
    // UX_V3 §1b: the nearest resting die by screen distance (radius 60 reference px), so taps between dice still pick one
    const rest = [...this.dice.values()].filter(d => d.mode === 'rest' && d.uid != null);
    return nearestDie(rest, x, y, 60 * this.hud.k);
  }
  private pickFoe(x: number, y: number) {
    const card = this.hud.plates.hit(x, y); if (card != null) return card;
    let best: number | null = null, bd = Infinity;
    for (const [uid, a] of this.foes) { if (!a.root.visible || a.dead || !this.disp.get(uid)?.hp) continue; const dd = modelHit(a.root, x, y, this.hud.k, worldToUi); if (dd < bd) { bd = dd; best = uid; } }
    return best;
  }
  dieTip: DieTip;
  /** swipe-select state; t / x / y / die = the press, for the long-press die tip */
  /** long-press a die (0.45 s, still, no other die swept) → its tip; the tap's select toggle is undone */
  private dieHold() {
    const S = this.swipe; if (!S || S.tip || S.seen.size > 1 || performance.now() - S.t < 450 || !this.b) return;
    S.tip = true; this.setSel(S.die, !S.on);
    const cd = this.b.s.dice.find(x => x.uid === S.die.uid), v = worldToUi(S.die.root.position);
    this.dieTip.show(cd?.face?.value ?? S.die.value, cd?.kind ?? 'normal', v.x, v.y, this.cls === 'mage' && !!cd && (cd as { persist?: string }).persist === 'retained');
  }
  private swipe: { on: boolean; seen: Set<number>; t: number; x: number; y: number; die: Die3D; tip: boolean } | null = null;
  private pointer(type: string, x: number, y: number): boolean {
    if (type === 'down') void audio.unlock();
    if (this.mode === 'title' && this.titleScene.on && !this.titleScene.pressed) { if (type === 'up') this.titleScene.press(); return true; }
    if (this.mode === 'select' && this.classPick.on) return this.classPick.pointer(type, x, y);
    if (this.menu.on) return this.menu.pointer(type, x, y);
    if (this.pauseBtn.on && this.pauseBtn.hit(x, y)) { if (type === 'down') this.pauseBtn.press(true); else if (type === 'up') { this.pauseBtn.press(false); this.pause(); } else if (type === 'cancel') this.pauseBtn.press(false); return true; }
    if (type === 'down') this.flow.hurry();
    if (this.screen.pointer(type, x, y)) return true;
    if (this.mode !== 'battle' || !this.b) return false;
    if (this.drag) return this.dragPointer(type, x, y);
    if (this.hud.tips.pointer(type, x, y, this.b)) return true;   // user 11-14: 「看看还有哪些是没做长按tips的」 (hud/holdTips.ts)
    if (type === 'down' && this.hfx.pointer(x, y, this.hero)) { cue('click', 0.4); return true; }   // fx4: tap the hero → class-state tips
    if (this.hud.chant.pointer(type, x, y) || this.hud.reroll.pointer(type, x, y)) return true;
    // swipe-select (CLAUDE.md 定稿: 按住滑过多选; user: 「按住滑动选择多个骰子的功能也没实现」): press on a die, slide over others —
    // they all take the state the first die got (select or deselect)
    if (this.swipe) {
      if (type === 'move' && this.swipe.tip) return true;
      if (type === 'move') { const h = this.pickDie(x, y); if (h && !this.swipe.seen.has(h.uid!)) { this.swipe.seen.add(h.uid!); if (this.sel.includes(h.uid!) !== this.swipe.on) this.setSel(h, this.swipe.on); } return true; }
      if (type === 'up' || type === 'cancel') { this.swipe = null; this.dieTip.hide(); return true; }
    }
    if (type === 'move' && !this.busy && this.b.s.phase === 'player') {   // hover: a resting die rises a little
      const h = this.pickDie(x, y), u = h?.uid ?? null;
      if (u !== this.hoverUid) { const o = this.hoverUid != null ? this.dice.get(this.hoverUid) : null; if (o && !this.sel.includes(o.uid!)) o.lift = 0; if (h && !this.sel.includes(u!)) { h.lift = 0.3; cue('tick', 0.15); } this.hoverUid = u; }
    }
    if (type !== 'down') return false;
    if (this.giveUpRect && !this.busy) { const r = this.giveUpRect; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.clearSel(); this.act({ k: 'end' }); return true; } }
    const bar = this.hud.bar, ci = bar.hitButton(x, y);
    if (ci >= 0 && !this.busy) { this.drag = { i: ci, x0: x, y0: y, moved: false, foe: null, held: 0, tip: false }; bar.aiming = ci; cue('click', 0.4); return true; }
    const si = bar.hitSlot(x, y); if (si >= 0) { bar.toggleTip(si); return true; }
    if (bar.tipOn >= 0) bar.toggleTip(bar.tipOn);
    const ri = this.hud.top.hitRelic(x, y); if (ri >= 0) { this.hud.top.toggleTip(ri); cue('click', 0.4); return true; } this.hud.top.closeTip();
    if (this.busy || this.b.s.phase !== 'player') return false;
    const d = this.pickDie(x, y);
    if (d) { const ki = this.b.keepInfo(); if (ki?.need && this.b.strikesLeft() === 0) this.toggleKeep(d); else { this.setSel(d, !this.sel.includes(d.uid!)); this.swipe = { on: this.sel.includes(d.uid!), seen: new Set([d.uid!]), t: performance.now(), x, y, die: d, tip: false }; } return true; }
    const f = this.pickFoe(x, y); if (f != null) { if (this.chooseTarget(f)) { cue('click', 0.5); this.foeTip(f); } return true; }
    if (this.sel.length) { this.clearSel(); cue('deselect', 0.4); this.refresh(); return true; }
    return false;
  }
  /** R5 drag-to-cast: press the play button, drag out = aim (the button stays, pressed; the voxel arc follows the finger; the hovered
   *  enemy turns red with the predicted damage); release on an enemy (or up-field for an all-target skill) = play, elsewhere = cancel */
  private dragPointer(type: string, x: number, y: number) {
    const D = this.drag!, bar = this.hud.bar, s = bar.slots[D.i], b = this.b!;
    if (!s || !s.st.lit) { this.drag = null; bar.endAim(); this.hud.plates.preview = null; return true; }
    const all = !!this.slotAll[D.i], upField = all && y < this.ov.h * 0.62;
    if (type === 'move') {
      if (Math.hypot(x - D.x0, y - D.y0) > 8) { D.moved = true; if (D.tip) { D.tip = false; bar.tipOn = -1; } }
      if (D.moved) {
        const foe = this.pickFoe(x, y); D.foe = foe;
        const allowed = foe != null && canAim(b, foe, this.slotRefs[D.i], this.sel);
        bar.aim(D.i, x, y, allowed || upField, foe != null && !allowed);
        if (foe != null && allowed) {
          this.foes.get(foe)?.tint(0xff0a0a, 0.8);
          const ref = this.slotRefs[D.i], pv = ref != null ? displayPreview(b, ref, this.sel, foe, this.disp, this.slotLoose[D.i]) : null, hit = pv?.hpHits.find(h => h.uid === foe);
          this.hud.plates.preview = hit ? { uid: foe, dmg: hit.dmg } : null;
        } else this.hud.plates.preview = null;
      }
      return true;
    }
    if (type === 'up' || type === 'cancel') {
      this.drag = null; bar.endAim(); this.hud.plates.preview = null;
      if (D.tip) { bar.tipOn = -1; return true; }   // R7B #6: let go after reading the long-press tip = nothing played
      if (type === 'cancel') return true;
      if (!D.moved) { if (bar.hitButton(x, y) === D.i) this.playSlot(D.i); return true; }
      const foe = this.pickFoe(x, y);
      if (foe != null && !canAim(b, foe, this.slotRefs[D.i], this.sel)) { this.hud.plates.deny(foe); this.toast.show('先打盾卫', 1.0, '#a8d8ff'); cue('deny', 0.4); bar.bounce(D.i); }
      else if (foe != null) { bar.release(D.i, x, y); this.playSlot(D.i, foe); }
      else if (upField) { bar.release(D.i, x, y); this.playSlot(D.i); }
      else { cue('deny', 0.4); bar.bounce(D.i); }
      return true;
    }
    return true;
  }
  private bindKeys() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', e => {
      if (this.mode === 'title' && this.titleScene.on && !this.titleScene.pressed) { if (!e.repeat) { e.preventDefault(); this.titleScene.press(); } return; }
      if (this.mode === 'select' && this.classPick.on && !this.menu.on) {
        const ck = ({ arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', enter: 'ok', ' ': 'ok', escape: 'back', backspace: 'back' } as const)[e.key.toLowerCase() as 'a'];
        if (ck) { e.preventDefault(); this.classPick.key(ck); } return;
      }
      if (this.menu.on) { this.menuKey(e); return; }
      if (e.key === 'Escape' && (this.mode === 'shop' || this.mode === 'choice' || (this.mode === 'battle' && !this.sel.length))) { e.preventDefault(); this.pause(); return; }
      if (this.mode !== 'battle' || !this.b) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.hud.reroll.tap(); else if (k === 'e') this.hud.chant.tap();
      else if (k === ' ' || k === 'enter') { e.preventDefault(); const c = this.hud.bar.slots.findIndex(x => x.st.lit); if (c >= 0) this.playSlot(c); }
      else if (k === 'escape') { this.clearSel(); this.refresh(); }
      else if (k === 'tab') { e.preventDefault(); if (this.busy) return; const al = this.b.alive().filter(x => this.b!.canTarget(x.uid)); if (al.length) { const i = al.findIndex(x => x.uid === this.targetUid); this.chooseTarget(al[(i + 1) % al.length].uid); } }
      else { const n = parseInt(k, 10); if (n >= 1 && n <= 6 && !this.busy) { const ds = [...this.dice.values()].filter(d => d.mode === 'rest').sort((a, b) => a.home.x - b.home.x); const d = ds[n - 1]; if (d) this.setSel(d, !this.sel.includes(d.uid!)); } }
    });
  }

  // ------------------------------------------------------------ capture helpers (CSS px)
  rowPx(i: number) { return this.tablet.rowPx(i); }
  /** v3 capture helpers: the lit cards (slot, centre px), a slot's px, an enemy's chest px */
  cardsPx() { return this.hud.bar.slots.map((c, i) => ({ c, i })).filter(o => o.c.st.lit).map(({ c, i }) => ({ slot: i, name: c.def.name, x: Math.round(c.tx), y: Math.round(c.ty), all: !!this.slotAll[i] })); }
  foePx(uid?: number) { const u = uid ?? this.b?.target()?.uid; const a = u != null ? this.foes.get(u) : null; if (!a) return null; const v = worldToUi(a.chest()); return [Math.round(v.x), Math.round(v.y)]; }
  dragPath() { const c = this.cardsPx().find(x => !x.all) || this.cardsPx()[0], f = this.foePx(); if (!c || !f) return []; return Array.from({ length: 16 }, (_, i) => [Math.round(c.x + (f[0] - c.x) * i / 15), Math.round(c.y + (f[1] - c.y) * i / 15)]); }
  playCard(slot?: number) { const cs = this.cardsPx().filter(c => slot == null || c.slot === slot), c = cs[cs.length - 1]; return c ? this.playSlot(c.slot) : false; }
  /** capture helper: press a lit card and drag partway toward the target without releasing (then simDrop() releases on it) */
  simDrag(k = 0.85) { const c = this.cardsPx().find(x => !x.all) || this.cardsPx()[0], f = this.foePx(); if (!c || !f) return false; this.pointer('down', c.x, c.y); for (let i = 1; i <= 8; i++) this.pointer('move', c.x + (f[0] - c.x) * k * i / 8, c.y + (f[1] - c.y) * k * i / 8); this.pointer('move', f[0], f[1]); return true; }
  simDrop() { const f = this.foePx(); if (!f || !this.drag) return false; this.pointer('up', f[0], f[1]); return true; }
  readyRow() { return this.tablet.rows.findIndex(r => r.view.state === 'ready'); }
  diePx(uid: number) { const d = this.dice.get(uid); return d ? worldToUi(d.root.position) : null; }
  btnPx(id: string) { const b = this.screen.btns.find(x => x.id === id); return b ? [b.r.x + b.r.w / 2, b.r.y + b.r.h / 2] : null; }
  idle() { return this.mode === 'battle' && !this.busy && !!this.b && this.b.s.phase === 'player'; }
  /** tuning: set the battle camera (eye, look, fov) and cut to it */
  cam(eye: number[], look: number[], fov: number) { EYE.set(eye[0], eye[1], eye[2]); LOOK.set(look[0], look[1], look[2]); BATTLE_FOV = fov; shot('battle', staticShot(EYE, LOOK, BATTLE_FOV), { cut: true }); return true; }
  /** capture / tuning helpers: world → px, px → ground point */
  px(x: number, y: number, z: number) { const v = worldToUi(V3(x, y, z)); return [Math.round(v.x), Math.round(v.y)]; }
  ground(x: number, y: number, h = 0) { const r = uiRayPlane(x, y, h); return r ? [+r.pos.x.toFixed(2), +r.pos.z.toFixed(2), +r.worldPerPx.toFixed(4)] : null; }
  /** select the dice of the bot's first play this turn (captures: "dice selected, a row lit") */
  botSelect() {
    const b = this.b; if (!b || !this.idle()) return false;
    const a = recordBotTurn(b, mulberry(7)).find(x => x.k === 'play') as Extract<BotAct, { k: 'play' }> | undefined;
    // capture helper: the subset (of the dice as they lie now) that lights a pattern skill with the biggest preview; else the bot's pick
    const ds = b.dice().map(d => d.uid); let best: number[] | null = null, bv = 0;
    for (let m = 1; m < 1 << ds.length; m++) {
      const u = ds.filter((_, i) => m & (1 << i)), o = b.options(u).find(x => x.ok && x.ref !== 'basic'); if (!o) continue;
      const v = (b.preview(o.ref, u, b.target()?.uid)?.total ?? 0) + u.length * 100; if (v > bv) { bv = v; best = u; }
    }
    const pick = best ?? a?.uids ?? ds.slice(0, 1); this.selectUids(pick); return true;
  }
}

interface CardData { title: string; tag: string; desc: string; col: string; ico: string[]; price?: string; dim?: boolean }
function drawCard(g: CanvasRenderingContext2D, d: number, w: number, h: number, fp: number, c: CardData) {
  const u = fp / 2, tall = h > 200 * d, s2 = Math.max(1, Math.round((tall ? 3 : 2) * u * d)), s1 = Math.max(1, Math.round((tall ? 2 : 1.5) * u * d)), st = Math.max(1, Math.round(1.5 * u * d));
  panel(g, 0, 0, w, h, 3 * d, { body: c.dim ? '#141018' : '#1c1624', rim: c.dim ? '#4a4252' : c.col, line: '#07050a', hi: '#2c2234' });
  const ic = tall ? 4 : 2.6, tl = pixWrap(c.title, (w - 20 * d) / s2), dl = pixWrap(c.desc, (w - 24 * d) / s1), ps = c.price ? 44 * d : 0;
  const total = 10 * ic * d + 6 * d + PIX_H * st + 6 * d + tl.length * (PIX_H * s2 + 4 * d) + 6 * d + dl.length * (PIX_H * s1 + 4 * d);
  const y0 = Math.max(12 * d, (h - ps - total) / 2);
  icon(g, c.ico, w / 2 - 5 * ic * d, y0, ic * d, { main: c.dim ? '#5a5262' : c.col, acc: '#fff2d8', dark: '#07050a' });
  let y = y0 + (10 * ic + 6) * d;
  text(g, c.tag, w / 2, y, st, c.dim ? '#6a6272' : '#b8a890', 'center'); y += PIX_H * st + 6 * d;
  for (const ln of tl) { text(g, ln, w / 2, y, s2, c.dim ? '#8a8292' : '#fff2d8', 'center'); y += PIX_H * s2 + 4 * d; }
  y += 6 * d; const sd = s1;
  for (const ln of dl) { if (y > h - ps - 10 * d - PIX_H * sd) break; text(g, ln, w / 2, y, sd, c.dim ? '#7a7282' : '#e0d4c0', 'center'); y += PIX_H * sd + 4 * d; }
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
/** the battle camera looks down on the hero: tone down near-white materials (silver helm, white hair) so the silhouette reads, and
 *  add a dark contact disc under the feet to separate it from the ground. Only touches this actor's own material clones. */
function heroReadable(a: BattleActor) {
  // voxel actors use white material × vertex colours, so this scales the whole figure; keeps it under the bloom threshold
  for (const m of a.meshes) { const mat = m.material as THREE.MeshToonMaterial; if (mat?.color) mat.color.multiplyScalar(0.95); }
  // glow parts (staff orb, eyes) use shared unlit materials: clone per hero and halve them so the bloom stops swallowing the figure
  a.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material instanceof THREE.MeshBasicMaterial && m.material.vertexColors) { const c = m.material.clone(); c.color.multiplyScalar(0.7); m.material = c; } });
  for (const f of (a as unknown as { flashMats: Array<{ m: THREE.MeshToonMaterial; base: THREE.Color }> }).flashMats) f.base.multiplyScalar(0.4);
  // a dark contact disc with a pale rim under the feet: separates the figure from the ground from the top-down camera
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 24), new THREE.MeshBasicMaterial({ color: 0xe8d8b0, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; ring.renderOrder = 1; a.root.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: 0x07050a, transparent: true, opacity: 0.55, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; disc.renderOrder = 1; a.root.add(disc);
}
/** a short Chinese line for a tier's effects (slot tier notes) */
const TGT_CN: Record<string, string> = { one: '单体', all: '全体', two: '随机 2 个', three: '随机 3 个', second: '另 1 个', other: '另 1 个', others: '其余', adjacent: '相邻' };
function tierText(fx: import('../../core/v2/types').Effect[]) {
  const out: string[] = [];
  for (const e of fx) {
    if (e.t === 'dmg') out.push(`${TGT_CN[e.target] || e.target} ×${e.mul ?? 1}${e.ignoreArmor ? ' 无视护甲' : ''}${e.exec ? ` 生命<${Math.round(e.exec * 100)}%斩杀` : ''}`);
    else if (e.t === 'armor') out.push('护甲'); else if (e.t === 'heal') out.push(`回复 ×${e.mul}`); else if (e.t === 'barrier') out.push('屏障');
    else if (e.t === 'status') out.push(`${ST_CN[e.status as StatusV2] || e.status}${e.target === 'all' ? '（全体）' : ''}`);
    else if (e.t === 'stun') out.push(`${e.look === 'freeze' ? '冻结' : '眩晕'}${e.target === 'all' ? '全体' : ''}`);
    else if (e.t === 'taunt') out.push('嘲讽'); else if (e.t === 'spawnShadow') out.push(`+${e.n} 残骰`); else if (e.t === 'capUp') out.push(e.which === 'behead' ? '斩首 +1 骰' : '完防上限 +1');
    else if (e.t === 'earnDie') out.push('+1 骰');
  }
  return out.join('，') || '—';
}
/** no English ids on screen (SHOW3 #12): status ids inside engine strings become their Chinese names */
function cnText(t: string) { return t.replace(/(poison|burn|freeze|stun|vulnerable|weak|berserk)/g, m => ST_CN[m as StatusV2]); }
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cameraRef() { return CAMERA; }
function worldAlong(ndc: THREE.Vector3, dist: number) { const v = ndc.clone().unproject(CAMERA); return CAMERA.position.clone().add(v.sub(CAMERA.position).normalize().multiplyScalar(dist)); }
void FX; void fxHeal;
