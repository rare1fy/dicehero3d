// The battle show: title → intro (hero walks in, camera swoops to the lich rising from its altar) → turns → phase two → the kill →
// victory and a relic reward. Rules come only from core/Battle events; every event becomes a staged beat with the director, actors,
// dice, relic flights, text, HUD and sound in step.
import * as THREE from 'three';
import { camera, scene, view, V3, R, onUpdate } from './engine/world';
import { wait, anim, animP, ease, lerp, shake, hitstop, slowmo, after, clock, FX } from './engine/clock';
import { lightPulse, decalFx } from './engine/prims';
import { PADD, PALPHA, TILE } from './engine/particles';
import { Battle, STATUS_CN } from '../core/battle';
import { sliceSetup } from '../core/slice';
import { botStep, bestPlay } from '../core/bot';
import type { BattleEvent } from '../core/events';
import { DATA, enemyCfg } from '../core/data';
import { handDisp, type HandResult } from '../core/hands';
import type { Outcome } from '../core/types';
import { Die3D, flyDie, throwHooks, DICE3D } from './dice/die3d';
import { simThrow, playThrow, FIELD } from './dice/throw';
import { presentQuat } from './dice/faces';
import { DIE } from './dice/signature';
import type { Cast, HeroLike, LichLike, GhoulLike } from './actors/cast';
import type { Actor } from './actors/actor';
import { popText, slamTitle, fadeOut, flyText, Counter, speech } from './battle/text3d';
import { fxImpact, fxRing, fxGlow, fxSparks, fxStatus, fxHeal, fxShield, fxSmoke, fxEmbers, fxFlare, fxChips, trailSeg, COL } from './fx/fx';
import { shot, staticShot, orbitShot } from './director';
import { Hud } from './hud/hud';
import { RelicBar, relicModel } from './hud/relics';
import type { Span } from './hud/paint';
import { GRADE } from './look/post';
import { ARENA, type Env } from './look/env';
import { audio, VOICE_LINES } from '../audio/audio';
import { cue } from '../audio/cues';
import type { Platform } from '../platform/index';

const HERO_POS = V3(-2.0, 0, 3.0), LICH_POS = ARENA.lichAltar.clone();
const TIER_GRAD: Array<[string, string]> = [['#fff8e8', '#e8d8b8'], ['#e8fbff', '#5ac8ff'], ['#fff2b0', '#ffb030'], ['#ffe0c0', '#ff6a2a'], ['#ffe8ff', '#c860ff']];
const TIER_COL = [0xffe2a8, 0x6ac8ff, 0xffc040, 0xff7030, 0xd060ff];
const STATUS_COL: Record<string, string> = { poison: '#a8ff7a', burn: '#ffaa5a', vulnerable: '#ffaa5a', weak: '#c8c8e0', strength: '#ffaa5a', freeze: '#a8d8ff' };
const ghoulLaneX = [-3.2, 3.2, -2.3, 2.3];
const ghoulPos = (lane: number, d: number) => V3(ghoulLaneX[lane % 4], 0, -2.8 + (2 - d) * 1.8);

export const SHOTS: Record<string, (t: number) => { base: THREE.Vector3; look: THREE.Vector3; fov: number }> = {
  battle: staticShot(V3(0.6, 12.2, 11.8), V3(-0.1, 0.8, -0.6), 46),
  reveal: staticShot(V3(-0.5, 6.6, 9.0), V3(0, 2.2, -0.2), 46),
  enemy: staticShot(V3(1.6, 10.0, 10.2), V3(-0.4, 1.2, -0.6), 44),
  overview: staticShot(V3(0, 30, 30), V3(0, 0, -3), 34),
  bossClose: staticShot(V3(1.4, 4.0, 2.1), V3(0, 2.7, -4.7), 42),
  phase: staticShot(V3(0.4, 1.4, -0.3), V3(0, 3.6, -4.7), 48),
  reward: staticShot(V3(-1.2, 4.2, 9.2), V3(-0.9, 1.9, 2.6), 42),
};
/** the orientation a camera at `base` looking at `look` will have (cameras look down −Z, plain objects down +Z) */
const quatFor = (base: THREE.Vector3, look: THREE.Vector3) => { const o = new THREE.PerspectiveCamera(); o.position.copy(base); o.lookAt(look); return o.quaternion.clone(); };

export class BattleShow {
  b!: Battle; dice = new Map<number, Die3D>(); sel: number[] = []; busy = true; stage: 'title' | 'intro' | 'battle' | 'reward' | 'over' = 'title';
  hero: HeroLike; lich: LichLike; foes = new Map<number, Actor>(); lanes = new Map<number, number>();
  hud = new Hud(); relics = new RelicBar(); counter = new Counter(() => this.hero.weapon().add(V3(0.2, 0.9, 0)));
  private chain: Promise<void> = Promise.resolve(); private slide: { to: boolean } | null = null; private botOn = false; private seed: number; private rewardModels: THREE.Group[] = [];
  private bossUid = -1; private lastHeroHp = 0; private summoned = 0;

  constructor(private platform: Platform, private env: Env, private cast: Cast, seed?: number) {
    this.hero = cast.hero(); this.lich = cast.lich();
    this.seed = seed ?? ((Date.now() % 100000) | 0);
    throwHooks.impact = (d, v) => { cue('clack', Math.min(1, v / 9)); if (v > 3) fxSmoke(V3(d.root.position.x, 0.06, d.root.position.z), 0x6a6878, 2, { s: 0.2, alpha: 0.3, up: 0.4 }); };
    throwHooks.landed = d => d.fx('land');
    Object.assign(FIELD, { x0: -1.5, x1: 2.3, z0: -1.2, z1: 1.8 });
    onUpdate((dt, rdt) => this.frame(dt, rdt));
    this.hud.buttons.reroll.onTap = () => this.act('reroll');
    this.hud.buttons.play.onTap = () => this.act('play');
    this.hud.buttons.end.onTap = () => this.act('end');
    platform.onPointer(ev => { if (ev.type === 'down') this.cursorOn = false; return this.pointer(ev.type, ev.x, ev.y); });
    this.bindKeys();
    this.lich.root.visible = false; this.hero.place(HERO_POS.clone().add(V3(0, 0, 4)), Math.PI);
    this.resize(); platform.onResize(() => this.resize());
  }
  resize() {
    const s = this.platform.canvasSize(), sa = this.platform.safeArea(); this.hud.resize(s.w, s.h, this.platform.dpr(), sa.top, sa.bottom);
    const L = this.hud.landscape;
    this.relics.resize(s.w, s.h, L ? { x: 0, w: 300 } : this.hud.col, L ? 64 + sa.top : 10 + sa.top);
    // landscape: a wider, slightly lower battle framing (the HUD sits in the corners, not in a column under the field)
    SHOTS.battle = L ? staticShot(V3(0.3, 12.8, 14.2), V3(0, -0.6, -2.4), 42) : staticShot(V3(0.6, 12.2, 11.8), V3(-0.1, 0.8, -0.6), 46);
    SHOTS.enemy = L ? staticShot(V3(1.4, 11.4, 13.0), V3(-0.2, 0.4, -2.8), 40) : staticShot(V3(1.6, 10.0, 10.2), V3(-0.4, 1.2, -0.6), 44);
    if (this.stage === 'battle' && !this.busy) shot('battle', SHOTS.battle, { speed: 4 });
  }

  // ------------------------------------------------------------ keyboard and gamepad (console-style): a cursor walks the dice
  private cursor = -1; private cursorOn = false; private padPrev: boolean[] = []; private padRepeat = 0;
  private restDice() { return [...this.dice.values()].filter(d => d.mode === 'rest' && d.uid != null).sort((a, b) => a.home.x - b.home.x || a.home.z - b.home.z); }
  private input(k: 'left' | 'right' | 'toggle' | 'play' | 'reroll' | 'end' | 'target' | 'clear' | 'any') {
    if (this.stage === 'title') { void this.intro(); return; }
    if (this.stage === 'intro') { FX.speed = 3; return; }
    if (this.stage === 'over') { if (k === 'play' || k === 'toggle') this.restart(); return; }
    if (this.stage === 'reward') {
      if (k === 'left' || k === 'right') { this.cursor = ((this.cursor < 0 ? 0 : this.cursor) + (k === 'right' ? 1 : this.rewardModels.length - 1)) % Math.max(1, this.rewardModels.length); cue('click'); }
      else if ((k === 'toggle' || k === 'play') && this.rewardModels.length) void this.pickReward(this.rewardModels[Math.max(0, this.cursor)]);
      return;
    }
    if (this.stage !== 'battle' || this.busy || this.b.s.phase !== 'player') return;
    const ds = this.restDice();
    if (k === 'left' || k === 'right') { if (!ds.length) return; this.cursorOn = true; this.cursor = this.cursor < 0 ? 0 : (this.cursor + (k === 'right' ? 1 : ds.length - 1)) % ds.length; cue('click', 0.3); return; }
    if (k === 'toggle') { if (!ds.length) return; this.cursorOn = true; if (this.cursor < 0) this.cursor = 0; const d = ds[Math.min(this.cursor, ds.length - 1)]; this.setSel(d, !this.sel.includes(d.uid!)); return; }
    if (k === 'clear') { for (const d of ds) if (this.sel.includes(d.uid!)) this.setSel(d, false); return; }
    if (k === 'target') { const alive = [...this.foes.keys()].filter(u => { const e = this.b.enemy(u); return e && !e.dead; }); if (!alive.length) return; const i = alive.indexOf(this.b.s.targetUid ?? -1); this.b.s.targetUid = alive[(i + 1) % alive.length]; cue('click'); this.refresh(); return; }
    if (k === 'play' || k === 'reroll' || k === 'end') this.act(k);
  }
  private bindKeys() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', e => {
      const m: Record<string, Parameters<BattleShow['input']>[0]> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', Enter: 'toggle', ArrowUp: 'toggle', ' ': 'play', r: 'reroll', R: 'reroll', e: 'end', E: 'end', Tab: 'target', Escape: 'clear' };
      const k = m[e.key]; if (k) { e.preventDefault(); this.input(k); return; }
      const n = parseInt(e.key, 10); if (n >= 1 && n <= 9 && this.stage === 'battle') { const ds = this.restDice(); if (ds[n - 1]) { this.cursor = n - 1; this.cursorOn = true; this.input('toggle'); } }
    });
  }
  private pollPad(rdt: number) {
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads()[0] : null; if (!gp) return;
    const pr = gp.buttons.map(b => b.pressed), edge = (i: number) => pr[i] && !this.padPrev[i];
    if (edge(0)) this.input('toggle'); if (edge(1)) this.input('clear'); if (edge(2)) this.input('reroll'); if (edge(3)) this.input('play');
    if (edge(4)) this.input('target'); if (edge(5)) this.input('end'); if (edge(9)) this.input('any'); if (edge(14)) this.input('left'); if (edge(15)) this.input('right');
    const ax = gp.axes[0] ?? 0; this.padRepeat -= rdt;
    if (Math.abs(ax) > 0.55 && this.padRepeat <= 0) { this.input(ax > 0 ? 'right' : 'left'); this.padRepeat = 0.22; } else if (Math.abs(ax) < 0.3) this.padRepeat = 0;
    this.padPrev = pr;
  }
  /** the die under the cursor rises a little and glows cold blue (selected dice keep their gold) */
  private drawCursor() {
    if (!this.cursorOn || this.stage !== 'battle') return;
    const ds = this.restDice();
    ds.forEach((d, i) => { const on = i === this.cursor && !this.busy, sel = this.sel.includes(d.uid!); if (sel) return; d.lift = on ? 0.4 : 0; d.glow = on ? 0.7 : 0; if (on) d.glowCol.set(0x7ad8ff); });
  }

  // ------------------------------------------------------------ title and intro
  title() {
    this.stage = 'title'; shot('overview', SHOTS.overview, { cut: true });
    this.hud.setBoss(false); this.hud.showBanner('六面史诗', '点击任意处开始', 999, ['#fff2c0', '#e89a40']);
    this.setButtons(false);
  }
  private async intro() {
    this.stage = 'intro'; this.hud.hideBanner(); this.hud.uiOn = false; await audio.unlock(); audio.playMusic('bgm_start', 0.5);
    this.b = new Battle(sliceSetup(this.seed));
    this.hero.place(HERO_POS.clone().add(V3(0, 0, 4)), Math.PI); this.hero.root.visible = true; this.hero.lowHp = 0; this.hero.dead = false; this.hero.act = null;
    shot('walk', staticShot(V3(-3.5, 4.5, 11.5), V3(-1.4, 1.2, 4.2), 40), { speed: 1.2 });
    const from = this.hero.home.clone(); this.hero.setRunning(true); await animP(1.6, k => { this.hero.home.lerpVectors(from, HERO_POS, k); }); this.hero.setRunning(false);
    this.hero.faceToward(LICH_POS); await wait(0.2);
    // the lich rises from its altar
    shot('bossClose', SHOTS.bossClose, { speed: 1.6 }); await wait(0.6);
    const L = this.lich; L.place(LICH_POS.clone().add(V3(0, -4, 0)), 0); L.root.visible = true; L.dead = false; L.robeFire = 0; this.env.phase2(0);
    fxRing(V3(0, 0.6, LICH_POS.z), COL.green, 4, { life: 1.2, width: 0.12, fill: 0.2 }); lightPulse(V3(0, 1.5, LICH_POS.z), 0x4affa0, 14, 1.6, 12); cue('summon'); shake(0.25);
    for (let i = 0; i < 40; i++) PALPHA.emit({ p: V3(R(-2, 2), 0.6, LICH_POS.z + R(-2, 2)), v: V3(R(-0.3, 0.3), R(1.2, 3), R(-0.3, 0.3)), s0: 0.4, s1: 1.2, life: R(1, 2), c0: new THREE.Color(0x2a3a3a), alpha: 0.5, tile: TILE.smoke });
    await animP(1.5, k => { L.home.y = lerp(LICH_POS.y - 4, LICH_POS.y, ease.outCubic(k)); });
    L.roar(); cue('roar'); shake(0.4); audio.playMusic('bgm_battle', 0.8);
    await wait(0.6);
    this.hud.setBoss(true, '枯骨巫妖', '墓园之主 · 第一章首领'); this.hud.showBanner('枯骨巫妖', '墓园之主', 1.6, ['#d8ffe8', '#4affa0']);
    await this.say('enter');
    shot('battle', SHOTS.battle, { speed: 1.4 });
    this.relics.set(this.b.player.relics); this.counter.clear();
    await wait(0.8);
    this.stage = 'battle'; this.hud.uiOn = true; if (!this.botOn) FX.speed = 1;
    this.run(this.b.start());
  }
  private async say(kind: string) {
    const line = VOICE_LINES[kind]; if (!line) return;
    const d = await audio.speak(kind); this.lich.talk(Math.max(1.2, d));
    this.hud.subtitle(line, Math.max(2.2, d + 0.5));
    await wait(Math.min(2.4, Math.max(1.0, d * 0.75)));
  }

  // ------------------------------------------------------------ the event queue
  private run(evs: BattleEvent[]) {
    this.busy = true; this.refresh();
    this.chain = this.chain.then(async () => {
      for (const e of evs) { try { await this.beat(e); } catch (err) { this.platform.log('[beat] ' + e.t + ' ' + (err as Error).stack); } }
      this.busy = this.stage !== 'battle' || !!this.b.s.result || this.b.s.phase !== 'player';
      if (this.stage === 'battle' && this.b.s.phase === 'player') shot('battle', SHOTS.battle, { speed: 2.2 });
      this.refresh();
      if (this.stage === 'battle' && !this.b.s.result && this.b.mustEndTurn()) { await wait(0.6); this.act('end'); return; }
      if (this.botOn) after(0.4, () => this.botTick());
    });
    return this.chain;
  }
  act(kind: 'reroll' | 'play' | 'end') {
    if (this.stage === 'over') { if (kind === 'play') this.restart(); return; }
    if (this.stage !== 'battle' || this.busy) return;
    const r = kind === 'reroll' ? this.b.reroll(this.sel) : kind === 'play' ? this.b.play(this.sel, this.b.s.targetUid ?? undefined) : this.b.endTurn();
    if (!r.ok) { this.hud.toast(r.reason, 1.1); cue('deny'); return; }
    cue('click');
    if (kind !== 'end') this.sel = [];
    this.hero.aim = 0;
    this.run(r.events);
  }

  private async beat(e: BattleEvent): Promise<void> {
    const b = this.b;
    switch (e.t) {
      case 'battleStart': return;
      case 'enemyEnter': { const en = b.enemy(e.uid)!; if (en.cfgId === 'boss_lich_forest') { this.foes.set(e.uid, this.lich); this.bossUid = e.uid; } return; }
      case 'quote': {
        if (e.uid === this.bossUid) { if (e.kind === 'enter') return; if (e.kind === 'hurt' || e.kind === 'attack' || e.kind === 'lowHp' || e.kind === 'death') { if (e.kind !== 'lowHp' && e.kind !== 'death') void this.say(e.kind); } return; }
        const en = b.enemy(e.uid), a = this.foes.get(e.uid); const lines = en && enemyCfg(en.cfgId).q?.[e.kind]; if (a && lines) speech(lines[e.index], () => a.head().add(V3(0, 0.8, 0)), 1.8);
        return;
      }
      case 'turnStart': {
        for (const d of this.dice.values()) d.dodgeT.set(0, 0, 0);
        if (e.turn > 1 || e.drawBonus) this.hud.showBanner(`第 ${e.turn} 回合`, e.drawBonus ? `收割：多抽 ${e.drawBonus} 颗` : '', 0.6, ['#fff4d8', '#e8c070']);
        shot('battle', SHOTS.battle, { speed: 2 });
        return;
      }
      case 'discard': {
        const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
        if (ds.length) cue('whoosh', 0.4);
        await Promise.all(ds.map((d, i) => wait(i * 0.03).then(() => flyDie(d, this.discardWorld(), 0.3, { arc: 1.0, scale: 0.35, turns: 0.6, ease: ease.inCubic })).then(() => { d.dispose(); this.dice.delete(d.uid!); })));
        return;
      }
      case 'draw': {
        const kept = [...this.dice.values()].filter(d => d.mode === 'rest').map(d => ({ p: d.home.clone(), q: d.homeQ.clone() }));
        const from = this.hero.bonePos('handL', 0, -0.2, 0.2); from.y = Math.max(1.4, from.y);
        this.hero.toss(); await wait(0.18);
        const recs = simThrow(e.dice.length, kept, from); let dur = 0;
        const eye = quatEye(SHOTS.battle(0).base);
        e.dice.forEach((s, i) => { const d = new Die3D(s.defId); d.uid = s.uid; d.root.position.copy(from); this.dice.set(s.uid, d); playThrow(d, recs[i], s.value, eye); dur = Math.max(dur, recs[i].rel + recs[i].dur); });
        if (e.dice.length) cue('whoosh', 0.7);
        await wait(dur + 0.05);
        return;
      }
      case 'reroll': {
        if (e.hpCost > 0) {
          this.hero.bleed(); await wait(0.2);
          popText(`-${e.hpCost}`, this.hero.head(), { gradient: ['#ffd0c8', '#ff3a2a'] }); fxSparks(this.hero.chest(), 0xff2020, 18, 4, { life: 0.5, grav: 6 }); this.hero.tint(0xff2020, 0.9); cue('hurt', 0.5);
          popText(e.bloodCapped ? '血怒已满  护甲 +5' : `血怒 ${e.blood}/5  伤害 +${e.blood * 15}%`, this.hero.head().add(V3(0, 0.8, 0)), { color: '#ff9a8a', size: 0.32, life: 1.4, rise: 0.5 });
          GRADE.flashCol.set(0.5, 0, 0); this.pulseFlash(0.18);
        }
        const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
        for (const d of ds) { d.glow = 0; d.lift = 0; if (e.hpCost > 0) fxSparks(d.root.position, 0xff3030, 10, 3, { life: 0.5, grav: 4 }); }
        cue('whoosh', 0.5);
        await Promise.all(ds.map((d, i) => wait(i * 0.03).then(() => flyDie(d, this.discardWorld(), 0.26, { arc: 0.9, scale: 0.35, turns: 0.5, ease: ease.inCubic })).then(() => { d.dispose(); this.dice.delete(d.uid!); })));
        return;
      }
      case 'play': return this.presentPlay(e);
      case 'relic': {
        if (e.trigger === 'on_damage_taken') { await this.relics.trigger(e.id, `${DATA.relics[e.id].name}  ${e.text}`, this.hero.weapon(), 0xff7a30); return; }
        await this.relics.trigger(e.id, `${DATA.relics[e.id]?.name || e.id}  ${e.text}`, e.to === 'hero' ? this.hero.chest() : this.hero.weapon());
        return;
      }
      case 'hit': return this.impact(e);
      case 'statusAdd': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.status.type);
        popText(`${STATUS_CN[e.status.type]}${e.status.type === 'weak' || e.status.type === 'vulnerable' ? '' : ' ' + e.status.value}`, a.head().add(V3(0.3, 0.5, 0)), { color: STATUS_COL[e.status.type], size: 0.36, life: 1.2, rise: 0.6 });
        this.refresh(); await wait(0.22); return;
      }
      case 'statusTick': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        fxStatus(a.chest(), e.type); a.tint(e.type === 'burn' ? 0xff7a20 : 0x7aff4a, 0.8); popText(`-${e.dmg}`, a.head(), { color: STATUS_COL[e.type], size: 0.5 });
        if (e.who === 'player') { shake(0.12); this.hero.hurt(0.5); }
        this.refresh(); await wait(0.42); return;
      }
      case 'statusExpire': this.refresh(); return;
      case 'armor': {
        const a = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!a) return;
        if (e.who === 'player') { fxShield(this.hero.home, 1.0); } else { fxShield(a.home, 1.8); fxGlow(a.chest(), COL.blue, 3, 0.5, 2); (a as LichLike).shield?.(); }
        popText(`+${e.delta}`, a.head().add(V3(0.5, 0.2, 0)), { gradient: ['#e0f4ff', '#5aaaff'], size: 0.5 }); cue('armor');
        this.refresh(); await wait(0.28); return;
      }
      case 'hp': {
        if (e.delta > 0) { fxHeal(this.hero.chest()); popText(`+${e.delta}`, this.hero.head(), { gradient: ['#e8ffe8', '#5af07a'] }); cue('heal'); }
        else if (e.reason === 'self') { popText(`${e.delta}`, this.hero.head(), { gradient: ['#ffd0c8', '#ff3a2a'], size: 0.45 }); this.hero.tint(0xff2020, 0.8); }
        this.refresh(); await wait(0.18); return;
      }
      case 'purify': popText('净化', this.hero.head().add(V3(0, 0.6, 0)), { color: '#fff4c0', size: 0.4 }); return;
      case 'reap': popText(e.kind === 'kill' ? '斩首！下回合 +1 骰' : '完美格挡！下回合 +1 骰', this.hero.head().add(V3(0, 1.3, 0)), { gradient: ['#fff0d0', '#ffb070'], size: 0.36, life: 1.6, rise: 0.5 }); await wait(0.3); return;
      case 'fury': popText(`怒火 +${e.bonus}`, this.hero.head().add(V3(-0.5, 0.9, 0)), { gradient: ['#ffe0a0', '#ff7020'], size: 0.36 }); fxEmbers(this.hero.chest(), 0xff6a1a, 10, { r: 0.4 }); return;
      case 'trait': { const a = this.foes.get(e.uid); if (a) { popText(e.kind === 'bloodFury' ? `血怒 ×${e.stacks}` : `复仇 ×${e.stacks}`, a.head().add(V3(0, 0.6, 0)), { color: '#ff6a5a', size: 0.34 }); a.tint(0xff2020, 0.6); } return; }
      case 'spent': { for (const u of e.uids) { const d = this.dice.get(u); if (d) { fxSparks(d.root.position, 0xffe0a0, 6, 2, { life: 0.3 }); d.dispose(); this.dice.delete(u); } } return; }
      case 'enemyTurn': {
        for (const d of this.dice.values()) { const side = d.home.x >= 0 ? 1 : -1; d.dodgeT.set(side * (1.8 + Math.abs(d.home.x) * 0.25), 0, 1.2); d.glow = 0; d.lift = 0; }
        this.sel = []; shot('enemy', SHOTS.enemy, { speed: 2.2 });
        this.hud.showBanner('敌方回合', '', 0.5, ['#ffd8d0', '#e8584a']); await wait(0.55); return;
      }
      case 'enemyMove': {
        const a = this.foes.get(e.uid) as GhoulLike; if (!a) return;
        const to = ghoulPos(this.lane(e.uid), e.distance), from = a.home.clone(); a.walkK = 1; a.faceToward(this.hero.home);
        await animP(0.6, k => { a.home.lerpVectors(from, to, ease.inOut(k)); }); a.walkK = 0;
        return;
      }
      case 'enemyAct': return this.enemyAct(e);
      case 'playerHit': {
        const p = this.hero.chest();
        if (e.byArmor) { popText(`-${e.byArmor}`, p.clone().add(V3(0.6, 0.6, 0)), { gradient: ['#e0f4ff', '#5aaaff'], size: 0.42 }); fxShield(this.hero.home, 0.9); cue('block'); if (!e.hpDmg) this.hero.block(); }
        if (e.hpDmg > 0) {
          this.hero.hurt(Math.min(1.6, 0.6 + e.hpDmg / 15));
          popText(`-${e.hpDmg}`, this.hero.head(), { gradient: ['#ffe0d8', '#ff3a2a'], big: e.hpDmg >= 12 });
          if (!e.isDot) { fxImpact(p.clone(), 0xff5040, 0.4 + e.hpDmg / 40, { ground: false, stop: false }); shake(0.25 + Math.min(0.45, e.hpDmg / 25)); hitstop(0.06 + Math.min(0.08, e.hpDmg / 150)); GRADE.flashCol.set(0.6, 0.05, 0.02); this.pulseFlash(Math.min(0.35, 0.1 + e.hpDmg / 60)); this.platform.vibrate(e.hpDmg >= 12 ? 'heavy' : 'medium'); }
          cue('hurt', Math.min(1.4, 0.6 + e.hpDmg / 20));
        } else if (e.perfectBlock) popText('完美格挡', p.clone().add(V3(0, 1.0, 0)), { gradient: ['#e8f8ff', '#7ac8ff'], size: 0.42 });
        this.refresh(); await wait(0.32); return;
      }
      case 'junk': {
        const a = this.foes.get(e.from); if (!a) return;
        const d = new Die3D(e.id); d.root.visible = true; d.root.position.copy(a.weapon()); d.root.scale.setScalar(0.7); d.glow = 1; d.glowCol.set(e.id === 'cursed' ? 0xb040f0 : 0x9a9a9a);
        popText(`+${DATA.dice[e.id].name}`, a.head().add(V3(0, 0.8, 0)), { color: e.id === 'cursed' ? '#d4a8ff' : '#d0d0d0', size: 0.4, life: 1.4 }); cue('curse');
        let last = d.root.position.clone();
        await flyDie(d, this.bagWorld(), 0.75, { arc: 2.6, turns: 1.4, scale: 0.4, trail: dd => { const p = dd.root.position.clone(); trailSeg(last, p, e.id === 'cursed' ? 0xb040f0 : 0x8a8a9a, 0.1, { life: 0.3 }); last = p; } });
        d.dispose(); this.refresh(); return;
      }
      case 'summon': {
        const en = b.enemy(e.uid)!, g = this.cast.ghoul(this.summoned++); const p = ghoulPos(this.lane(e.uid), en.distance); g.place(V3(p.x, g.rise ? 0 : -1.8, p.z)); g.faceToward(this.hero.home); this.foes.set(e.uid, g);
        if (g.rise) g.rise();
        this.lich.summon(); fxGlow(this.lich.weapon(), COL.green, 2.5, 0.6, 2.4); cue('summon');
        fxRing(V3(p.x, 0.05, p.z), COL.green, 2.2, { life: 0.8, width: 0.15, fill: 0.3 }); decalFx(V3(p.x, 0, p.z), { radius: 2, alpha: 0.6, life: 4 });
        for (let i = 0; i < 18; i++) PADD.emit({ p: V3(p.x + R(-0.6, 0.6), 0.1, p.z + R(-0.6, 0.6)), v: V3(R(-0.5, 0.5), R(1.5, 3.5), R(-0.5, 0.5)), s0: 0.12, s1: 0.02, life: R(0.6, 1.1), c0: new THREE.Color(0xc0ffd8), c1: COL.green, bright: 2.4, tile: TILE.glow });
        if (g.rise) { for (let i = 0; i < 10; i++) PALPHA.emit({ p: V3(p.x + R(-0.7, 0.7), 0.2, p.z + R(-0.7, 0.7)), v: V3(R(-0.3, 0.3), R(0.6, 1.4), R(-0.3, 0.3)), s0: 0.4, s1: 1.0, life: R(0.8, 1.4), c0: new THREE.Color(0x3a3a34), alpha: 0.45, tile: TILE.smoke }); await wait(1.55); }
        else await animP(0.7, k => { g.home.y = lerp(-1.8, 0, ease.outBack(k)); });
        g.shriek(); cue('summon');
        this.refresh(); await wait(0.3); return;
      }
      case 'phase': return this.phaseTwo();
      case 'death': return this.death(e.uid);
      case 'victory': return this.victory(e.relicChoices);
      case 'defeat': return this.defeat();
    }
  }

  // ------------------------------------------------------------ the play: rise → title → count → relics → strike
  private async presentPlay(e: Extract<BattleEvent, { t: 'play' }>) {
    const out = e.outcome, tier = out.tier, tc = TIER_COL[tier];
    const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d), n = ds.length;
    const rv = SHOTS.reveal(0); shot('reveal', SHOTS.reveal, { speed: 3.2 });
    const camQ = quatFor(rv.base, rv.look), center = V3(0.2, 2.9, 0.9), gap = Math.min(1.05, 4.2 / Math.max(1, n - 1)), sc = Math.min(1.1, gap / (DIE * 1.2));
    this.hero.aim = 1; cue('whoosh', 0.6);
    await Promise.all(ds.map((d, i) => { d.glow = 1; d.glowCol.set(tc); return wait(i * 0.04).then(() => flyDie(d, center.clone().add(V3((i - (n - 1) / 2) * gap, Math.sin(i * 1.7) * 0.06, 0)), 0.32, { q: presentQuat(d.topIdx, d.topTurns, camQ), arc: 0.3 + (i % 2) * 0.35, ease: ease.outCubic, scale: sc })); }));
    const name = handDisp(out.hands as HandResult);
    const title = await slamTitle(name, center.clone().add(V3(0, 1.05, 0)), { gradient: TIER_GRAD[tier], glow: '#' + tc.toString(16).padStart(6, '0'), size: 0.55 + tier * 0.05 });
    cue('reveal', tier); shake(0.06 + tier * 0.06); this.platform.vibrate('light');
    fxRing(center, tc, 1.4 + tier * 0.7, { billboard: true, life: 0.45 + tier * 0.1, width: 0.16, fill: 0.05, bright: 1.4 + tier * 0.4 }); if (tier) { fxGlow(center, tc, 0.6 + tier * 0.3, 0.3 + tier * 0.08, 0.6 + tier * 0.2); lightPulse(center.clone().add(V3(0, 0.4, -1.0)), tc, 3 + tier * 3, 0.4 + tier * 0.12, 6); }
    for (const d of ds) fxSparks(d.root.position, tc, 6 + tier * 4, 2.5 + tier, { life: 0.5, grav: 2 });
    if (tier >= 3) { slowmo(0.35 + (tier - 3) * 0.3, 0.3); GRADE.flashCol.set(1, 0.95, 0.8); this.pulseFlash(0.35); }
    await wait(0.32 + tier * 0.05);
    // values fly into the counter over the cleaver
    let acc = 0;
    for (const [i, d] of ds.entries()) {
      const wp = d.root.position.clone(); d.root.scale.setScalar(sc * 1.3); anim(0.15, k => d.root.scale.setScalar(lerp(sc * 1.3, sc, k)));
      cue('count', 0); fxGlow(wp, tc, 0.8, 0.2, 2);
      await flyText(String(d.value), wp.add(V3(0, 0.5, 0)), () => this.counter.s ? this.counter.s.position.clone() : this.hero.weapon().add(V3(0.2, 0.9, 0)), 0.26, { gradient: TIER_GRAD[tier] });
      acc += d.value; this.counter.set(acc, 1.35); void i;
    }
    if (Math.abs(out.handMult - 1) > 0.001) { popText(`×${out.handMult.toFixed(1)}`, this.hero.weapon().add(V3(1.0, 1.1, 0)), { gradient: TIER_GRAD[tier], size: 0.6, life: 0.8, rise: 0.3 }); cue('count', 1); await wait(0.28); this.counter.set(out.baseDamage, 1.5); }
    for (const st of out.steps) {
      if (st.kind === 'base' || st.kind === 'hand') continue;
      if (st.kind === 'die') { const d = ds.find(x => x.uid === st.uid); if (d) { d.fx('trig'); const wp = d.root.position.clone(); await flyText(`${st.label} ${st.txt}`, wp.add(V3(0, 0.6, 0)), () => this.counter.s ? this.counter.s.position.clone() : this.hero.weapon(), 0.36, { color: '#ffe8a0', size: 0.3 }); } cue('count', 0); continue; }
      if (st.kind === 'relic') { await this.relics.trigger(st.id!, `${st.label}  ${st.txt}`, st.to === 'hero' ? this.hero.chest() : (this.counter.s ? this.counter.s.position.clone() : this.hero.weapon())); continue; }
      popText(`${st.label} ${st.txt}`, this.hero.weapon().add(V3(1.3, 0.2, 0)), { color: '#ffd8a0', size: 0.24, life: 0.9, rise: 0.4 }); cue('count', 0); await wait(0.22);
    }
    this.counter.set(out.damage, 1.9, { size: 0.95 }); cue('count', 1); shake(0.08);
    fadeOut(title, 0.3);
    await wait(0.3);
    // strike
    await this.strike(ds, out, e.target);
  }

  private async strike(ds: Die3D[], out: Outcome, target: number | null) {
    const tier = out.tier, tc = TIER_COL[tier], b = this.b;
    const targets = out.aoe ? b.alive().map(x => x.uid) : target != null ? [target] : [];
    const tA = target != null ? this.foes.get(target) : null;
    const aim = tA ? tA.home.clone() : LICH_POS.clone();
    const dist = Math.max(0, this.hero.home.distanceTo(aim) - (tA === this.lich ? 2.6 : 1.4));
    this.hero.faceToward(aim);
    shot('attack', t => { const h = this.hero.root.position, a = aim; const side = V3(a.z - h.z, 0, h.x - a.x).normalize(); return { base: h.clone().add(V3(0, 3.6 + t * 0.2, 0)).addScaledVector(side, 3.0).add(V3(0, 0, 2.8)), look: h.clone().lerp(a, 0.55).add(V3(0, 1.4, 0)), fov: 48 }; }, { speed: 3.5 });
    const act = out.aoe ? this.hero.spin(Math.min(dist, 3)) : this.hero.attack(dist);
    cue('whoosh', 1);
    // the dice become the attack: they orbit the cleaver, then streak into the targets on the impact frame
    const tPos = (u: number) => this.foes.get(u)?.chest() || LICH_POS.clone().add(V3(0, 2, 0));
    const until = act.dur * act.at;
    const flights = ds.map((d, i) => { const tgt = targets.length ? targets[i % targets.length] : -1; let last = d.root.position.clone();
      return wait(Math.max(0, until - 0.24) + i * 0.02).then(() => flyDie(d, tgt >= 0 ? tPos(tgt) : aim, 0.24, { arc: 0.5, ease: ease.inCubic, turns: 1.4, trail: dd => { const p = dd.root.position.clone(); trailSeg(last, p, tc, 0.16, { life: 0.3, bright: 2.6 }); last = p; } })).then(() => { d.root.visible = false; }); });
    await act.impact; await Promise.all(flights);
    this.counter.burst();
  }

  private async impact(e: Extract<BattleEvent, { t: 'hit' }>) {
    const a = this.foes.get(e.uid); if (!a) return;
    const en = this.b.enemy(e.uid)!, p = a.chest(), frac = e.hpDmg / Math.max(1, en.maxHp);
    const heavy = e.hpDmg >= 60 || frac >= 0.5, mid = !heavy && (e.hpDmg >= 25 || frac >= 0.25);
    const power = Math.min(3.2, 0.6 + e.dmg / 22);
    fxImpact(p.clone().add(V3(0, 0, 0.4)), e.aoe ? 0xffc040 : 0xffe2a8, power, { dir: V3(0, 0.1, -1), chips: a === this.lich ? [0xe6dcc4, 0x2c1f44, 0x4affa0] : [0x7a8c6c, 0x4a5a44] });
    (a as LichLike | GhoulLike).hurt?.(Math.min(1.6, 0.6 + e.hpDmg / 30));
    if (e.absorbed) popText(`-${e.absorbed}`, p.clone().add(V3(0.7, 0.6, 0)), { gradient: ['#e0f4ff', '#5aaaff'], size: 0.42 });
    if (e.armorBroke) { popText('破甲', p.clone().add(V3(-0.8, 0.9, 0)), { gradient: ['#fff0d0', '#ff9a40'], size: 0.5 }); fxSparks(p, 0x9ad0ff, 24, 6, { life: 0.5 }); cue('block'); }
    popText(String(e.hpDmg), a.head().add(V3(0, 0.5, 0)), { big: e.hpDmg >= 20, gradient: heavy ? ['#ffffff', '#ff4a20'] : mid ? ['#fff8d0', '#ffb030'] : ['#fffaf0', '#f0d8a8'], life: 1.3, rise: 1.0 });
    hitstop(heavy ? 0.16 : mid ? 0.1 : 0.06); shake(heavy ? 0.6 : mid ? 0.35 : 0.18);
    if (heavy || mid) { GRADE.flashCol.set(1, 0.92, 0.8); this.pulseFlash(heavy ? 0.4 : 0.18); this.pulseSplit(heavy ? 1.4 : 0.6); }
    if (heavy) { slowmo(0.3, 0.3); this.platform.vibrate('heavy'); decalFx(V3(a.home.x, 0, a.home.z + 0.5), { radius: 2.4, alpha: 0.5, life: 4 }); }
    cue(heavy ? 'crit' : 'impact', heavy ? 1.4 : Math.min(1.2, power / 2));
    this.refresh(); await wait(heavy ? 0.4 : 0.16);
  }

  private async enemyAct(e: Extract<BattleEvent, { t: 'enemyAct' }>) {
    const a = this.foes.get(e.uid); if (!a) return;
    if (e.kind === 'frozen') { popText('冻结', a.head(), { color: '#a8d8ff' }); await wait(0.3); return; }
    if (a === this.lich) {
      const L = this.lich;
      if (e.kind === 'defend') { shot('bossClose', SHOTS.bossClose, { speed: 2.5 }); L.shield(); cue('armor'); await wait(0.45); return; }
      // casting: staff raised, gem flares, a soul orb arcs to the hero
      shot('enemy', SHOTS.enemy, { speed: 2.4 });
      const act = L.cast(); cue('magic'); fxGlow(L.weapon(), COL.green, 2.2, 0.6, 2.6); lightPulse(L.weapon(), 0x4affa0, 10, 0.8, 9);
      if (e.desc) popText(e.desc, L.head().add(V3(0, 1.0, 0)), { gradient: ['#e8fff0', '#5affa0'], size: 0.5, life: 1.2 });
      if (Math.random() < 0.35) void this.say('attack');
      await act.impact; await this.orb(L.weapon(), this.hero.chest(), 0x6aff9a, 0.55);
      return;
    }
    const g = a as GhoulLike;
    if (e.kind === 'attack') {
      g.faceToward(this.hero.home);
      shot('ghoul', () => ({ base: this.hero.home.clone().add(V3(3.6, 4.2, 3.4)), look: this.hero.home.clone().lerp(g.home, 0.5).add(V3(0, 1, 0)), fov: 44 }), { speed: 3 });
      const act = g.lunge(Math.max(0, g.home.distanceTo(this.hero.home) - 1.3)); cue('summon');
      await act.impact;
      fxSparks(this.hero.chest(), 0xff4030, 14, 5, { life: 0.4 });
      return;
    }
    if (e.kind === 'skill') { g.shriek(); await wait(0.3); }
  }

  private async orb(from: THREE.Vector3, to: THREE.Vector3, col: number, dur = 0.45) {
    let last = from.clone(); const mid = from.clone().lerp(to, 0.5).add(V3(0, 2.0, 0));
    await animP(dur, k => { const a = (1 - k) * (1 - k), b2 = 2 * (1 - k) * k, c = k * k; const p = V3(from.x * a + mid.x * b2 + to.x * c, from.y * a + mid.y * b2 + to.y * c, from.z * a + mid.z * b2 + to.z * c); trailSeg(last, p, col, 0.28, { life: 0.4, bright: 2.6 }); last = p; });
    fxImpact(to, col, 0.9, { ground: false, stop: false }); fxSmoke(to, 0x2a4a3a, 6, { alpha: 0.4 });
  }

  private async phaseTwo() {
    const L = this.lich;
    shot('phase', SHOTS.phase, { speed: 2.4 }); await wait(0.35);
    L.roar(); cue('roar'); shake(0.7); slowmo(0.6, 0.4); GRADE.flashCol.set(0.3, 1, 0.6); this.pulseFlash(0.5); this.pulseSplit(1.2);
    lightPulse(L.chest(), 0x4affa0, 20, 1.6, 16); fxRing(V3(0, 0.6, LICH_POS.z), COL.green, 7, { life: 1.4, width: 0.1, fill: 0.15 });
    for (let i = 0; i < 60; i++) PADD.emit({ p: L.chest().add(V3(R(-1, 1), R(-1.5, 1.5), R(-0.6, 0.6))), v: V3(R(-3, 3), R(1, 5), R(-3, 3)), s0: 0.14, s1: 0.02, life: R(0.6, 1.4), c0: new THREE.Color(0xd0ffe0), c1: COL.green, bright: 3, tile: TILE.glow, grav: -1 });
    anim(1.6, k => { this.env.phase2(ease.inOut(k)); L.robeFire = k; }, undefined, { real: true });
    this.hud.showBanner('灵魂宝石碎裂', '枯骨巫妖 · 第二阶段', 1.8, ['#e0ffe8', '#4aff8a']);
    await this.say('lowHp'); await wait(0.4);
  }

  private async death(uid: number) {
    const a = this.foes.get(uid); if (!a) return;
    this.hud.dropPlate(uid);
    if (a === this.lich) {
      const L = this.lich; this.hud.setBoss(false);
      slowmo(2.2, 0.22); hitstop(0.18); shake(0.9); GRADE.flashCol.set(1, 1, 1); this.pulseFlash(0.6); this.pulseSplit(1.8);
      shot('kill', orbitShot(() => LICH_POS.clone().add(V3(0, 1.5, 0)), 7.5, 2.6, 0.35, 0.2, 40, 0.6), { speed: 2.2 });
      void audio.speak('death'); this.hud.subtitle(VOICE_LINES.death, 2.8); cue('shatter', 1.4);
      L.collapse();
      const gem = L.weapon(); fxFlare(gem, 0x4affa0, 4, 0.6); fxSparks(gem, 0xa0ffc0, 60, 8, { life: 0.9, grav: 3 }); lightPulse(gem, 0x4affa0, 30, 1.2, 16);
      // disintegrate into soul ash
      const t0 = clock.time; const ash = () => { if (clock.time - t0 > 2.4) return; for (let i = 0; i < 6; i++) PADD.emit({ p: L.chest().add(V3(R(-1, 1), R(-1.6, 1.4), R(-0.6, 0.6))), v: V3(R(-0.4, 0.4), R(1.5, 3.5), R(-0.4, 0.4)), s0: 0.1, s1: 0.02, life: R(0.8, 1.6), c0: new THREE.Color(0xe0ffe8), c1: COL.green, bright: 2.6, tile: TILE.glow, grav: -0.5 }); after(0.05, ash); };
      ash();
      await wait(1.0);
      anim(1.2, k => { L.root.scale.setScalar(Math.max(0.01, 1 - ease.inCubic(k))); }, () => { L.root.visible = false; L.root.scale.setScalar(1); });
      fxChips(L.chest(), [0xe6dcc4, 0x2c1f44, 0xc8a050], 50, { speed: 6, up: 5, size: 0.18, glow: 0.4 });
      anim(2.0, k => { this.env.phase2(1 - k); L.robeFire = 1 - k; }, undefined, { real: true });
      await wait(1.4);
      return;
    }
    const g = a as GhoulLike; cue('shatter', 0.8);
    if (g.die) {   // the skeleton clatters into a heap of bones, then crumbles into the ground
      const c = g.chest(); g.die(); fxChips(c, [0xe8e0cc, 0xb8b09c, 0x3a3440], 22, { speed: 4, up: 3, size: 0.12, glow: 0.2 }); fxSmoke(V3(g.home.x, 0.3, g.home.z), 0x3a4a3a, 6, { alpha: 0.4 });
      await wait(0.55);
      anim(1.0, k => { g.home.y = -0.9 * ease.inCubic(k); }, () => { g.root.visible = false; });
      after(0.6, () => fxSmoke(V3(g.home.x, 0.2, g.home.z), 0x4a4a44, 5, { alpha: 0.35 }));
    } else {
      g.dead = true;
      fxChips(g.chest(), [0x7a8c6c, 0x4a5a44, 0x2a1416], 30, { speed: 5, up: 4, size: 0.14, glow: 0.3 }); fxSmoke(g.chest(), 0x3a4a3a, 6, { alpha: 0.5 });
      anim(0.4, k => g.root.scale.setScalar(Math.max(0.01, 1 - ease.inCubic(k))), () => { g.root.visible = false; });
      await wait(0.45);
    }
  }

  private async victory(choices: string[]) {
    this.stage = 'reward'; this.hud.uiOn = false; audio.muffle(0); cue('win'); this.counter.clear();
    for (const d of [...this.dice.values()]) { fxSparks(d.root.position, 0xffe0a0, 6, 2, { life: 0.4 }); d.dispose(); } this.dice.clear(); this.sel = [];
    shot('victory', orbitShot(() => this.hero.home.clone(), 5.2, 2.3, 0.3, 0.7, 40, 1.3), { speed: 1.8 });
    this.hero.cheer(); for (let i = 0; i < 50; i++) PADD.emit({ p: this.hero.home.clone().add(V3(R(-3, 3), R(0, 0.5), R(-3, 3))), v: V3(R(-0.3, 0.3), R(1, 3), 0), s0: R(0.06, 0.12), s1: 0.02, life: R(1, 2), c0: new THREE.Color(1, 1, 1), c1: COL.gold, bright: 2.4, tile: TILE.flare, spin: 2 });
    this.hud.showBanner('胜  利', '枯骨巫妖已被击败', 2.0, ['#fff6c8', '#ffb43a']);
    await wait(2.6);
    // relic reward: three models float before the hero; tap one
    const H = this.hero.home.clone(); this.hero.faceToward(V3(H.x + 0.6, 0, H.z - 4));
    shot('reward', staticShot(H.clone().add(V3(0.8, 4.4, -11.5)), H.clone().add(V3(0.2, 1.3, -1.5)), 42), { speed: 2.5 });
    this.hud.showBanner('选择一件遗物', '点击遗物收下', 999, ['#fff0d0', '#e8b060'], 0.12);
    this.rewardModels = choices.map((id, i) => { const m = relicModel(id, 2); m.position.copy(H).add(V3(-0.7 + i * 0.92, 0.9, -5.0)); m.userData.y = m.position.y; m.scale.setScalar(0.01); m.userData.id = id; scene.add(m); anim(0.4, k => m.scale.setScalar(ease.outBack(k) * 0.62)); return m; });
    this.rewardModels.forEach(m => popText(DATA.relics[m.userData.id].name, m.position.clone().add(V3(0, -0.6, 0)), { color: '#ffe8b0', size: 0.2, life: 99, rise: 0, drift: 0 }));
    this.setButtons(false);
  }
  private async pickReward(m: THREE.Group) {
    const id = m.userData.id as string; this.hud.hideBanner(); cue('relic');
    for (const o of this.rewardModels) if (o !== m) anim(0.3, k => o.scale.setScalar(Math.max(0.01, 0.9 * (1 - k))), () => scene.remove(o));
    const to = this.relics.slotWorld(this.relics.slots.length, 4.5); let last = m.position.clone();
    await animP(0.6, k => { m.position.lerp(to, ease.inCubic(k) * 0.35); m.rotation.y += 0.3; m.scale.setScalar(lerp(0.9, 0.3, k)); trailSeg(last, m.position.clone(), 0xffd060, 0.1, { life: 0.3 }); last = m.position.clone(); });
    scene.remove(m); this.relics.add(id);
    this.hud.showBanner(`获得  ${DATA.relics[id].name}`, DATA.relics[id].desc, 999, ['#fff6c8', '#ffb43a'], 0.12);
    // clear the floating names
    for (const o of [...scene.children]) if ((o as THREE.Sprite).isSprite && (o as THREE.Sprite).userData.base) scene.remove(o);
    this.stage = 'over'; this.hud.uiOn = true; this.setButtons(true, '再战一场');
  }
  private async defeat() {
    this.stage = 'over'; this.hero.fall(); cue('lose'); slowmo(1.2, 0.3); audio.muffle(1);
    anim(1.5, k => { GRADE.desat = k * 0.85; }, undefined, { real: true });
    shot('defeat', orbitShot(() => this.hero.home.clone(), 4.5, 3.2, 0.15, 0.4, 40, 0.5), { speed: 1.5 });
    this.hud.showBanner('战  败', '墓园又多了一件藏品', 999, ['#e8e0f0', '#8a7aa8']);
    this.setButtons(true, '再战一场');
  }
  private restart() {
    for (const d of [...DICE3D]) d.dispose(); this.dice.clear(); this.sel = [];
    for (const [uid, a] of this.foes) { if (a !== this.lich) { const g = a as GhoulLike; if (g.dispose) g.dispose(); else a.root.parent?.remove(a.root); } this.hud.dropPlate(uid); } this.foes.clear(); this.lanes.clear(); this.summoned = 0;
    for (const m of this.rewardModels) scene.remove(m); this.rewardModels = [];
    for (const o of [...scene.children]) if ((o as THREE.Sprite).isSprite && (o as THREE.Sprite).userData.base) scene.remove(o);
    GRADE.desat = 0; audio.muffle(0); this.hero.dead = false; this.hero.act = null; this.lich.root.visible = false; this.lich.dead = false; this.hud.hideBanner();
    this.seed++; void this.intro();
  }

  // ------------------------------------------------------------ helpers
  private lane(uid: number) { if (!this.lanes.has(uid)) this.lanes.set(uid, this.lanes.size); return this.lanes.get(uid)!; }
  private screenWorld(x: number, y: number, dist: number) { const v = V3((x / view.w) * 2 - 1, -(y / view.h) * 2 + 1, 0.5).unproject(camera); return camera.position.clone().add(v.sub(camera.position).normalize().multiplyScalar(dist)); }
  private discardWorld() { return this.screenWorld(view.w * 0.86, view.h * 0.78, 9); }
  private bagWorld() { return this.screenWorld(view.w * 0.7, view.h * 0.8, 9); }
  private pulseFlash(k: number) { anim(0.28, t => { GRADE.flash = k * (1 - t) * (1 - t); }, () => { GRADE.flash = 0; }, { real: true }); }
  private pulseSplit(k: number) { anim(0.35, t => { GRADE.split = k * (1 - t); }, () => { GRADE.split = 0; }, { real: true }); }

  private setButtons(on: boolean, playLabel = '出牌') {
    const b = this.b, can = on && this.stage === 'battle' && !this.busy && b?.s.phase === 'player' && !b.s.result;
    if (this.stage === 'over') { this.hud.buttons.play.set({ label: playLabel, enabled: true, tone: 'primary' }); this.hud.buttons.reroll.set({ label: '重投', enabled: false, tone: 'teal' }); this.hud.buttons.end.set({ label: '结束回合', enabled: false, tone: 'stone' }); return; }
    const cost = b ? b.rerollHpCost() : 0;
    const L = this.hud.landscape;
    this.hud.buttons.reroll.set({ label: '重投', sub: cost === 0 ? '免费' : cost < 0 ? '不可' : `生命 -${cost}`, enabled: can && this.sel.length > 0 && cost >= 0, tone: 'teal', key: L ? 'R · X' : undefined });
    this.hud.buttons.play.set({ label: playLabel, enabled: can && this.sel.length > 0, tone: 'primary', key: L ? '空格 · Y' : undefined });
    this.hud.buttons.end.set({ label: '结束回合', enabled: can, tone: 'stone', key: L ? 'E · RB' : undefined });
  }

  refresh() {
    const b = this.b; if (!b) { this.setButtons(false); return; }
    const p = b.player, s = b.s;
    const L = this.bossUid >= 0 ? b.enemy(this.bossUid) : null;
    if (L && !L.dead && this.hud.boss.on) {
      const it = b.intent(L), st = statusText(L.statuses);
      this.hud.setBossBar(L.hp, L.maxHp, L.armor, `${s.phase === 'player' ? '意图：' + it.text + (it.kind === 'skl' && it.text === '施法' ? '（中毒 / 灼烧 / 虚弱）' : '') : ''}${st ? '    ' + st : ''}`);
    }
    for (const [uid, a] of this.foes) {
      if (a === this.lich) continue; const en = b.enemy(uid); if (!en || en.dead) continue;
      const it = b.intent(en), col = it.kind === 'atk' ? '#ff8a7a' : it.kind === 'def' ? '#8ac8ff' : it.kind === 'mov' ? '#ffd27a' : '#d4a8ff';
      this.hud.plate(uid).set({ name: en.name, hp: en.hp, max: en.maxHp, armor: en.armor, intent: s.phase === 'player' ? [{ t: (it.kind === 'atk' ? '⚔ ' : '') + it.text, c: col }] : [], status: [statusText(en.statuses), en.bloodFury ? `血怒${en.bloodFury}` : '', en.vengeance ? `复仇${en.vengeance}` : ''].filter(Boolean).join(' ') });
    }
    const lines: Span[] = [{ t: '嗜血狂战', c: '#f4e8d0', s: 13 }];
    const st = statusText(p.statuses); if (st) lines.push({ t: '  ' + st, c: '#d8c8f0' });
    if (s.bloodRerollCount) lines.push({ t: `  血怒 ${s.bloodRerollCount}`, c: '#ff8a7a' });
    if (p.rageFireBonus) lines.push({ t: `  怒火燎原 +${p.rageFireBonus}`, c: '#ffb070' });
    if (p.furyBonus) lines.push({ t: `  怒火 +${p.furyBonus}`, c: '#ffb070' });
    this.hud.setHero(p.hp, p.maxHp, s.armor, lines);
    this.hud.setPiles(s.piles.bag.length, s.piles.discard.length);
    const pv = this.sel.length && this.stage === 'battle' && !this.busy && s.phase === 'player' ? b.preview(this.sel) : null;
    if (pv) {
      const tags: Span[] = [];
      if (pv.aoe) tags.push({ t: '全体  ', c: '#ffc040' }); if (pv.armorBreak) tags.push({ t: '破甲  ', c: '#ff9a40' }); if (pv.armor) tags.push({ t: `护甲 +${pv.armor}  `, c: '#8ac8ff' }); if (pv.heal > 0) tags.push({ t: `回复 +${pv.heal}  `, c: '#7ef0a0' }); if (pv.heal < 0) tags.push({ t: `自伤 ${pv.heal}  `, c: '#ff8a7a' });
      for (const t of pv.tags) tags.push({ t: t + '  ', c: '#d8c8f0' });
      if (pv.skipOnPlay) tags.push({ t: '多选普攻：骰子特效不生效', c: '#a898c0' });
      this.hud.setPreview([[{ t: handDisp(pv.hands as HandResult) + '   ', c: '#ffe0a0' }, { t: '预计伤害 ', c: '#c8bce0', s: 13 }, { t: String(pv.damage), c: '#ffd04a', s: 24 }], tags.length ? tags : [{ t: ' ', c: '#fff' }]]);
    } else this.hud.setPreview(null);
    this.hud.setHint(this.stage !== 'battle' || s.result ? '' : this.busy ? '' : this.hud.landscape ? (this.sel.length ? '出牌攻击，或重投选中的骰子 · Tab 换目标' : '点选骰子 · ←→ 移动  回车/A 选骰') : this.sel.length ? '出牌攻击，或重投选中的骰子' : '点选骰子 · 按住滑过多选');
    this.setButtons(true, '出牌');
    // low HP: music closes in, hero pants
    const lowK = Math.max(0, Math.min(1, (0.35 - p.hp / p.maxHp) / 0.25)); this.hero.lowHp = lowK; this.hero.breath = 1 + lowK * 1.5; audio.muffle(lowK * 0.7);
    if (p.hp < this.lastHeroHp) { /* hud bar ghost handles the drain */ } this.lastHeroHp = p.hp;
  }

  // ------------------------------------------------------------ frame + input
  private frame(dt: number, rdt: number) {
    this.pollPad(rdt); this.drawCursor();
    this.hero.update(dt); if (this.lich.root.visible) this.lich.update(dt); for (const a of this.foes.values()) if (a !== this.lich) a.update(dt);
    this.hud.update(rdt); this.relics.update(rdt); this.counter.follow();
    for (const m of this.rewardModels) { m.rotation.y += rdt * 1.2; m.position.y = (m.userData.y ?? 2) + Math.sin(clock.rtime * 2 + m.position.x) * 0.1; }
    // plates follow their ghouls
    for (const [uid, a] of this.foes) {
      if (a === this.lich) continue; const pl = this.hud.plates.get(uid); if (!pl) continue;
      const v = a.root.position.clone().add(V3(0, a.height + 0.4, 0)).project(camera); pl.x = (v.x + 1) / 2 * view.w; pl.y = (1 - v.y) / 2 * view.h; pl.hide = v.z > 1 || !a.root.visible || this.stage !== 'battle';
    }
    // living statuses: they show on the body
    if (this.b && Math.random() < rdt * 8) for (const [who, a] of [['player', this.hero] as const, ...[...this.foes].map(([u, a]) => [u, a] as const)]) {
      const sts = who === 'player' ? this.b.player.statuses : this.b.enemy(who as number)?.statuses || [];
      for (const st of sts) { const p = a.chest().add(V3(R(-0.4, 0.4), R(-0.5, 0.6), R(-0.3, 0.3)));
        if (st.type === 'burn') PADD.emit({ p, v: V3(0, R(0.8, 1.6), 0), s0: 0.16, s1: 0.02, life: 0.6, c0: new THREE.Color(0xffd080), c1: new THREE.Color(0xff3010), bright: 2.4, tile: TILE.glow });
        else if (st.type === 'poison') PALPHA.emit({ p, v: V3(0, R(0.4, 0.9), 0), s0: 0.06, s1: 0.12, life: 0.9, c0: new THREE.Color(0xa8ff7a), alpha: 0.8, tile: TILE.ring });
        else if (st.type === 'weak') PADD.emit({ p: p.add(V3(0, 0.6, 0)), v: V3(0, -1, 0), s0: 0.08, s1: 0.03, life: 0.6, c0: new THREE.Color(0xb0a8c8), bright: 1.4, tile: TILE.streak, stretch: 0.2 });
        else if (st.type === 'vulnerable') PADD.emit({ p, v: V3(R(-1, 1), R(0, 1), R(-1, 1)), s0: 0.05, s1: 0.01, life: 0.4, c0: new THREE.Color(0xffa040), bright: 2.4, tile: TILE.spark, grav: 3 });
      }
    }
  }
  private pickDie(x: number, y: number) {
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2((x / view.w) * 2 - 1, -(y / view.h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const rest = [...this.dice.values()].filter(d => d.mode === 'rest' && d.uid != null);
    const hit = ray.intersectObjects(rest.map(d => d.mesh), false)[0]; if (hit) return rest.find(d => d.mesh === hit.object) || null;
    const pt = V3(); if (!ray.ray.intersectPlane(new THREE.Plane(V3(0, 1, 0), -DIE / 2), pt)) return null;
    let best: Die3D | null = null, bd = 0.8; for (const d of rest) { const dd = Math.hypot(d.home.x - pt.x, d.home.z - pt.z); if (dd < bd) { bd = dd; best = d; } } return best;
  }
  private pointer(type: string, x: number, y: number): boolean | void {
    if (this.stage === 'title') { if (type === 'down') void this.intro(); return true; }
    if (this.stage === 'intro') { if (type === 'down') FX.speed = 3; return true; }
    if (this.hud.pointer(type, x, y)) return true;
    if (this.stage === 'reward' && type === 'down') {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((x / view.w) * 2 - 1, -(y / view.h) * 2 + 1), camera);
      const hit = ray.intersectObjects(this.rewardModels, true)[0]; if (hit) { let o: THREE.Object3D | null = hit.object; while (o && !this.rewardModels.includes(o as THREE.Group)) o = o.parent; if (o) void this.pickReward(o as THREE.Group); }
      return true;
    }
    if (this.stage !== 'battle' || this.busy || this.b.s.phase !== 'player') return;
    if (type === 'down') { const d = this.pickDie(x, y); if (!d) { const t = this.pickFoe(x, y); if (t != null) { this.b.s.targetUid = t; cue('click'); this.refresh(); } return; } const on = !this.sel.includes(d.uid!); this.setSel(d, on); this.slide = { to: on }; return true; }
    if (type === 'move' && this.slide) { const d = this.pickDie(x, y); if (d && this.sel.includes(d.uid!) !== this.slide.to) this.setSel(d, this.slide.to); return true; }
    if ((type === 'up' || type === 'cancel') && this.slide) { this.slide = null; return true; }
  }
  private pickFoe(x: number, y: number) {
    let best: number | null = null, bd = 60;
    for (const [uid, a] of this.foes) { if (!a.root.visible) continue; const v = a.chest().project(camera), sx = (v.x + 1) / 2 * view.w, sy = (1 - v.y) / 2 * view.h, d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = uid; } }
    return best;
  }
  private setSel(d: Die3D, on: boolean) {
    if (on) { this.sel.push(d.uid!); d.lift = 1; d.glow = 1; d.glowCol.set(0xffd860); cue('select'); fxSparks(d.root.position.clone().add(V3(0, 0.3, 0)), 0xffe08a, 8, 2, { life: 0.3, grav: 2 }); this.platform.vibrate('light'); }
    else { this.sel = this.sel.filter(u => u !== d.uid); d.lift = 0; d.glow = 0; cue('deselect'); }
    this.hero.aim = this.sel.length ? 0.6 : 0;
    this.refresh();
  }

  // ------------------------------------------------------------ bot (QA / demo)
  bot(on = true) { this.botOn = on; if (on) { if (this.stage === 'title') void this.intro(); else this.botTick(); } }
  private botTick() {
    if (!this.botOn) return;
    if (this.stage === 'reward') { if (this.rewardModels[0]) void this.pickReward(this.rewardModels[0]); return; }
    if (this.stage !== 'battle' || this.busy || this.b.s.result) return;
    const st = botStep(this.b);
    if (st.kind === 'reroll' && this.b.s.rerollCount >= 2) { const p = bestPlay(this.b); if (p) { this.selectUids(p.uids); after(0.5, () => this.act('play')); return; } }
    if (st.kind === 'end') { this.act('end'); return; }
    if (st.kind === 'play') this.b.s.targetUid = st.target;
    this.selectUids(st.uids); after(0.6, () => this.act(st.kind === 'reroll' ? 'reroll' : 'play'));
  }
  selectUids(uids: number[]) { for (const d of this.dice.values()) if (d.uid != null) { const on = uids.includes(d.uid); if (on !== this.sel.includes(d.uid)) this.setSel(d, on); } }
  idle() { return this.stage === 'battle' && !this.busy; }
  refreshShot() { shot('battle', SHOTS.battle, { cut: true }); }
  start() { this.title(); }
}

function statusText(list: Array<{ type: string; value: number }>) { return list.map(x => (STATUS_CN as Record<string, string>)[x.type] + (x.type === 'weak' || x.type === 'vulnerable' ? '' : x.value)).join(' '); }
/** A viewer position used to paint landed dice upright (the battle camera). */
function quatEye(base: THREE.Vector3) { return base.clone(); }
void FX;
