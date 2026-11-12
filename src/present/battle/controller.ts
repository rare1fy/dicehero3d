// Battle controller: owns the rules Battle, turns its events into staged beats (sequentially, awaited), and routes input.
// First playable pass — mechanics are complete; each beat gets upgraded to the locked v5 / v6 presentation module by module.
import * as THREE from 'three';
import { camera, V3, R, onUpdate } from '../engine/world';
import { wait, anim, animP, ease, lerp, shake, hitstop, slowmo, after, clock } from '../engine/clock';
import { Battle, STATUS_CN } from '../../core/battle';
import { sliceSetup } from '../../core/slice';
import { botStep, bestPlay } from '../../core/bot';
import type { BattleEvent } from '../../core/events';
import { DATA, enemyCfg } from '../../core/data';
import { handDisp, type HandResult } from '../../core/hands';
import { Die3D, flyDie, throwHooks, DICE3D } from '../dice/die3d';
import { simThrow, playThrow } from '../dice/throw';
import { presentQuat } from '../dice/faces';
import { DIE } from '../dice/signature';
import * as FG from './figures';
import { popText, slamTitle, fadeOut, speech } from './text3d';
import { fxImpact, fxRing, fxGlow, fxSparks, fxStatus, fxHeal, fxShield, fxSmoke, trailSeg, COL } from '../fx/fx';
import { lightPulse } from '../engine/prims';
import { HERO_HOME, LICH_HOME, THROW_FROM, ghoulPos, DISCARD_AT, BAG_AT, battleCamera } from './stageSet';
import { cue } from '../../audio/cues';
import type { PxUI, PxWorldInst } from 'pxui/core/pxui.js';
import type { Platform } from '../../platform/index';

const TIER_COL = [0xffe2a8, 0x6ac8ff, 0xffc040, 0xff7030, 0xd060ff];
const STATUS_COL: Record<string, string> = { poison: '#b8ff8a', burn: '#ffaa5a', vulnerable: '#ffaa5a', weak: '#c8c8e0', strength: '#ffaa5a', freeze: '#a8d8ff' };

export class BattleController {
  b!: Battle;
  dice = new Map<number, Die3D>();
  sel: number[] = [];
  hero!: FG.Figure;
  foes = new Map<number, FG.Figure>();
  lanes = new Map<number, number>();
  busy = true;
  private chain: Promise<void> = Promise.resolve();
  private slide: { on: boolean; to: boolean } | null = null;
  private seed: number;
  private botOn = false;
  private plates = new Map<number, PxWorldInst>();

  constructor(private UI: PxUI, private platform: Platform, seed?: number) {
    this.seed = seed ?? ((Date.now() % 100000) | 0);
    throwHooks.impact = (d, v) => { cue('clack', Math.min(1, v / 9)); if (v > 3) fxSmoke(V3(d.root.position.x, 0.06, d.root.position.z), 0x8a8478, 2, { s: 0.18, alpha: 0.3, up: 0.4 }); };
    throwHooks.landed = d => d.fx('land');
    onUpdate(dt => { this.hero && FG.updateFigure(this.hero, dt); for (const f of this.foes.values()) FG.updateFigure(f, dt); });
    this.bindUI();
    this.platform.onResize(() => battleCamera());
  }

  // ------------------------------------------------------------ lifecycle
  start(seed = this.seed) {
    this.seed = seed;
    for (const d of [...DICE3D]) d.dispose(); this.dice.clear(); this.sel = [];
    for (const f of this.foes.values()) f.root.parent?.remove(f.root); this.foes.clear(); this.lanes.clear();
    for (const p of this.plates.values()) p.remove(); this.plates.clear();
    if (this.hero) this.hero.root.parent?.remove(this.hero.root);
    this.hero = FG.makeHero(HERO_HOME); this.hero.facing = -1; this.hero.root.rotation.y = Math.PI;
    this.UI.world('hero_plate').follow(() => this.project(V3(HERO_HOME.x - 2.3, 0.6, HERO_HOME.z)));
    battleCamera();
    this.b = new Battle(sliceSetup(seed));
    this.UI.node('b_play').set({ label: '出牌' }); this.UI.node('banner').visible = false;
    this.run(this.b.start());
  }

  /** Queue a list of events; beats run strictly one after another. */
  private run(evs: BattleEvent[]) {
    this.busy = true; this.refresh();
    this.chain = this.chain.then(async () => {
      for (const e of evs) { try { await this.beat(e); } catch (err) { this.platform.log('[beat] ' + e.t + ' ' + (err as Error).stack); } }
      this.busy = !!this.b.s.result || this.b.s.phase !== 'player';
      this.refresh();
      if (!this.b.s.result && this.b.mustEndTurn()) { await wait(0.8); this.act('end'); return; }
      if (this.botOn) after(0.35, () => this.botTick());
    });
    return this.chain;
  }

  act(kind: 'reroll' | 'play' | 'end') {
    if (this.b.s.result) { if (kind === 'play') this.start(this.seed + 1); return; }
    if (this.busy) return;
    const r = kind === 'reroll' ? this.b.reroll(this.sel) : kind === 'play' ? this.b.play(this.sel, this.b.s.targetUid ?? undefined) : this.b.endTurn();
    if (!r.ok) { this.UI.node('toast').flash(1200, r.reason); cue('deny'); return; }
    if (kind !== 'end') this.sel = [];
    this.run(r.events);
  }

  // ------------------------------------------------------------ beats
  private async beat(e: BattleEvent): Promise<void> {
    const b = this.b;
    switch (e.t) {
      case 'battleStart': return;
      case 'enemyEnter': {
        const en = b.enemy(e.uid)!;
        const f = en.cfgId === 'boss_lich_forest' ? FG.makeLich(LICH_HOME.clone()) : FG.makeGhoul(ghoulPos(this.lane(e.uid), en.distance));
        f.root.visible = false; this.foes.set(e.uid, f); this.spawnPlate(e.uid);
        if (en.cfgId === 'boss_lich_forest') { this.banner(en.name, 1.6); shake(0.3); cue('roar'); await FG.riseFrom(f, 0.9); fxRing(V3(f.home.x, 0.05, f.home.z), COL.purple, 4, { life: 0.8, width: 0.15 }); await wait(0.4); }
        else await FG.riseFrom(f, 0.5);
        return;
      }
      case 'quote': {
        const en = b.enemy(e.uid), f = this.foes.get(e.uid); if (!en || !f) return;
        const lines = enemyCfg(en.cfgId).q?.[e.kind]; if (!lines) return;
        speech(lines[e.index], () => f.head().add(V3(0, 0.9, 0)), e.kind === 'death' ? 2.6 : 2.2);
        if (e.kind === 'enter' || e.kind === 'lowHp') await wait(0.9);
        return;
      }
      case 'turnStart': {
        for (const d of this.dice.values()) d.dodgeT.set(0, 0, 0);
        this.UI.node('turn_chip').set({ vars: { turn: e.turn } });
        if (e.drawBonus) popText(`收割 +${e.drawBonus} 手牌`, this.hero.head().add(V3(0, 0.6, 0)), { color: '#ffd860' });
        return;
      }
      case 'discard': {
        const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
        cue('whoosh', 0.5);
        await Promise.all(ds.map((d, i) => wait(i * 0.04).then(() => flyDie(d, DISCARD_AT, 0.32, { arc: 0.9, scale: 0.4, turns: 0.6, ease: ease.inCubic })).then(() => { d.dispose(); this.dice.delete(d.uid!); })));
        return;
      }
      case 'draw': {
        const kept = [...this.dice.values()].filter(d => d.mode === 'rest').map(d => ({ p: d.home.clone(), q: d.homeQ.clone() }));
        const recs = simThrow(e.dice.length, kept, THROW_FROM);
        let dur = 0;
        e.dice.forEach((s, i) => {
          const d = new Die3D(s.defId); d.uid = s.uid; d.root.position.copy(THROW_FROM); this.dice.set(s.uid, d);
          playThrow(d, recs[i], s.value, camera.position); dur = Math.max(dur, recs[i].rel + recs[i].dur);
        });
        if (e.dice.length) { cue('whoosh', 0.7); this.hero.squash = 0.4; }
        await wait(dur + 0.1);
        return;
      }
      case 'reroll': {
        if (e.hpCost > 0) { popText(`-${e.hpCost}`, this.hero.head(), { color: '#ff5a4a' }); popText(e.bloodCapped ? '血怒已满 +5 护甲' : `血怒 ${e.blood}/5`, this.hero.head().add(V3(0, 0.7, 0)), { color: '#ff8a7a', size: 0.36 }); this.hero.flash = 0.8; cue('hurt', 0.5); }
        const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d);
        for (const d of ds) { d.glow = 0; d.lift = 0; if (e.hpCost > 0) fxSparks(d.root.position, 0xff3030, 10, 3, { life: 0.5, grav: 4 }); }
        await Promise.all(ds.map((d, i) => wait(i * 0.03).then(() => flyDie(d, DISCARD_AT, 0.28, { arc: 0.8, scale: 0.4, turns: 0.5, ease: ease.inCubic })).then(() => { d.dispose(); this.dice.delete(d.uid!); })));
        return;
      }
      case 'play': return this.presentPlay(e);
      case 'relic': { const r = DATA.relics[e.id]; popText(`${r?.name || e.id}  ${e.text}`, this.hero.head().add(V3(0, 1.0, 0)), { color: '#ffd060', size: 0.34, life: 1.4 }); fxGlow(this.hero.weapon(), COL.gold, 1.2, 0.4, 2); cue('relic'); await wait(0.35); return; }
      case 'hit': {
        const f = this.foes.get(e.uid); if (!f) return;
        const p = f.chest(), power = Math.min(3.2, 0.5 + e.dmg / 25);
        fxImpact(p.clone().add(V3(0, 0, 0.3)), e.aoe ? 0xffc040 : 0xffe2a8, power, { dir: V3(0, 0.1, -1), chips: [0x6a5a8a, 0x3a2a4a] });
        f.flash = 1.4; f.squash = 0.7; const kb = 0.8 + 0.25 * power; f.lunge = -kb; anim(0.45, k => { f.lunge = -kb * (1 - ease.outCubic(k)); });
        if (e.absorbed) popText(`-${e.absorbed}`, p.clone().add(V3(0.5, 0.4, 0)), { color: '#9fd0ff', size: 0.4 });
        if (e.armorBroke) popText('破甲', p.clone().add(V3(-0.6, 0.6, 0)), { color: '#ffb070', size: 0.4 });
        popText(String(e.hpDmg), f.head().add(V3(0, 0.3, 0)), { big: e.hpDmg >= 30, color: e.hpDmg >= 30 ? '#ffd84a' : '#fff4dc', life: 1.1 });
        cue(e.dmg >= 40 ? 'crit' : 'impact', power / 2);
        this.refresh(); await wait(0.12); return;
      }
      case 'statusAdd': {
        const at = e.who === 'player' ? this.hero.chest() : this.foes.get(e.who)?.chest(); if (!at) return;
        fxStatus(at, e.status.type); popText(`${STATUS_CN[e.status.type]}${e.status.type === 'weak' || e.status.type === 'vulnerable' ? '' : ' ' + e.status.value}`, at.clone().add(V3(0, 1.0, 0)), { color: STATUS_COL[e.status.type], size: 0.4 });
        this.refresh(); await wait(0.25); return;
      }
      case 'statusTick': {
        const f = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!f) return;
        fxStatus(f.chest(), e.type); f.flash = 0.6; popText(`-${e.dmg}`, f.head(), { color: STATUS_COL[e.type] });
        if (e.who === 'player') shake(0.1);
        this.refresh(); await wait(0.4); return;
      }
      case 'statusExpire': this.refresh(); return;
      case 'armor': {
        const f = e.who === 'player' ? this.hero : this.foes.get(e.who); if (!f) return;
        if (e.who === 'player') fxShield(HERO_HOME, 0.9); else fxShield(f.home, 1.4);
        popText(`+${e.delta} 护甲`, f.head().add(V3(0.4, 0.2, 0)), { color: '#9fd0ff', size: 0.42 }); cue('armor');
        this.refresh(); await wait(0.25); return;
      }
      case 'hp': {
        if (e.delta > 0) { fxHeal(this.hero.chest()); popText(`+${e.delta}`, this.hero.head(), { color: '#7ef0a0' }); cue('heal'); }
        else if (e.reason === 'self') { popText(`${e.delta}`, this.hero.head(), { color: '#ff7a6a' }); this.hero.flash = 0.6; }
        this.refresh(); await wait(0.2); return;
      }
      case 'purify': popText('净化', this.hero.head().add(V3(0, 0.6, 0)), { color: '#fff4c0', size: 0.4 }); return;
      case 'reap': popText(e.kind === 'kill' ? '斩首：下回合 +1 手牌' : '完防：下回合 +1 手牌', this.hero.head().add(V3(0, 1.2, 0)), { color: '#ffb08a', size: 0.36, life: 1.5 }); await wait(0.3); return;
      case 'fury': popText(`怒火 +${e.bonus}`, this.hero.head().add(V3(-0.4, 0.9, 0)), { color: '#ff9a40', size: 0.36 }); return;
      case 'trait': { const f = this.foes.get(e.uid); if (f) popText(e.kind === 'bloodFury' ? `血怒 ×${e.stacks}` : `复仇 ×${e.stacks}`, f.head().add(V3(0, 0.6, 0)), { color: '#ff6a5a', size: 0.36 }); return; }
      case 'spent': { for (const u of e.uids) { const d = this.dice.get(u); if (d) { d.dispose(); this.dice.delete(u); } } return; }
      case 'enemyTurn': {
        // dice step aside so the enemy turn has the floor (user, 2026-11-12), and come back when the player's turn starts
        for (const d of this.dice.values()) { const side = d.home.x >= 0 ? 1 : -1; d.dodgeT.set(side * (1.6 + Math.abs(d.home.x) * 0.3), 0, 0.7); }
        this.toast('敌方回合', 0.9); await wait(0.5); return;
      }
      case 'enemyMove': {
        const f = this.foes.get(e.uid); if (!f) return;
        const to = ghoulPos(this.lane(e.uid), e.distance), from = f.home.clone();
        popText('逼近', f.head().add(V3(0, 0.5, 0)), { color: '#ffd27a', size: 0.34 });
        await animP(0.55, k => { f.home.lerpVectors(from, to, ease.inOut(k)); f.home.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.15; }); f.home.y = 0;
        return;
      }
      case 'enemyAct': {
        const f = this.foes.get(e.uid); if (!f) return;
        if (e.kind === 'frozen') { popText('冻结', f.head(), { color: '#a8d8ff' }); await wait(0.3); return; }
        if (e.kind === 'defend') { f.squash = 0.5; cue('armor'); return; }
        if (e.kind === 'skill') {
          f.squash = 0.4; fxGlow(f.weapon(), COL.purple, 1.6, 0.5, 2.2); fxRing(f.weapon(), COL.purple, 1.4, { billboard: true, life: 0.4, width: 0.12 }); cue('magic');
          if (e.desc) popText(e.desc, f.head().add(V3(0, 0.7, 0)), { color: '#d4a8ff', size: 0.4 });
          await wait(0.3); await this.orb(f.weapon(), this.hero.chest(), 0xb070ff); return;
        }
        // attack: wind up, lunge at the hero
        f.squash = 0.6; await wait(0.25); cue('whoosh');
        const dz = (HERO_HOME.z - 1.3) - f.home.z; await animP(0.18, k => { f.lunge = dz * ease.inCubic(k); });
        after(0.25, () => anim(0.35, k => { f.lunge = dz * (1 - ease.outCubic(k)); }));
        return;
      }
      case 'playerHit': {
        const p = this.hero.chest();
        if (e.byArmor) { popText(`-${e.byArmor}`, p.clone().add(V3(0.5, 0.5, 0)), { color: '#9fd0ff', size: 0.4 }); fxShield(HERO_HOME, 0.8); cue('block'); }
        if (e.hpDmg > 0) {
          popText(`-${e.hpDmg}`, this.hero.head(), { color: '#ff5040', big: e.hpDmg >= 15 }); this.hero.flash = 1; this.hero.squash = 0.6;
          if (!e.isDot) { fxImpact(p.clone().add(V3(0, 0, -0.3)), 0xff5040, 0.35 + e.hpDmg / 45, { ground: false, stop: false }); shake(0.2 + Math.min(0.4, e.hpDmg / 30)); hitstop(0.05 + Math.min(0.06, e.hpDmg / 200)); this.platform.vibrate(e.hpDmg >= 15 ? 'heavy' : 'medium'); }
          cue('hurt', Math.min(1.4, 0.6 + e.hpDmg / 20));
        } else if (e.perfectBlock) popText('完美格挡', p.clone().add(V3(0, 0.9, 0)), { color: '#9fd0ff', size: 0.42 });
        this.refresh(); await wait(0.3); return;
      }
      case 'junk': {
        const f = this.foes.get(e.from); if (!f) return;
        const d = new Die3D(e.id); d.root.visible = true; d.root.position.copy(f.weapon()); d.root.scale.setScalar(0.6);
        popText(`+${DATA.dice[e.id].name}`, f.head().add(V3(0, 0.7, 0)), { color: e.id === 'cursed' ? '#d4a8ff' : '#c8c8c8', size: 0.4 }); cue('curse');
        await flyDie(d, BAG_AT, 0.6, { arc: 2.2, turns: 1, scale: 0.4 }); d.dispose(); this.refresh(); return;
      }
      case 'summon': {
        const en = b.enemy(e.uid)!, f = FG.makeGhoul(ghoulPos(this.lane(e.uid), en.distance)); f.root.visible = false; this.foes.set(e.uid, f); this.spawnPlate(e.uid);
        const by = this.foes.get(e.by); if (by) { fxGlow(by.weapon(), COL.purple, 2, 0.6, 2.4); popText('召唤', by.head().add(V3(0, 0.6, 0)), { color: '#c8a0ff', size: 0.4 }); }
        cue('summon'); await FG.riseFrom(f, 0.6); return;
      }
      case 'phase': {
        const f = this.foes.get(e.uid); if (!f) return;
        this.banner('枯骨巫妖 · 灵魂宝石碎裂', 1.8); f.flash = 1.5; shake(0.5); slowmo(0.5, 0.35); cue('roar');
        fxRing(V3(f.home.x, 0.05, f.home.z), COL.purple, 6, { life: 1.0, width: 0.12 }); lightPulse(f.chest(), 0x9a5aff, 4, 0.8, 12);
        await wait(1.0); return;
      }
      case 'death': {
        const f = this.foes.get(e.uid); const en = b.enemy(e.uid); if (!f || !en) return;
        const boss = en.cfgId.startsWith('boss_');
        if (boss) { slowmo(1.2, 0.25); shake(0.6); hitstop(0.12); }
        FG.shatter(f, boss ? [0xe8e0c8, 0x34264a, 0x7affb0] : [0x4a6a3a, 0x6a8a4a]); cue('shatter', boss ? 1.4 : 0.8);
        this.plates.get(e.uid)?.remove(); this.plates.delete(e.uid);
        await wait(boss ? 1.4 : 0.5); return;
      }
      case 'victory': { this.banner('胜 利', 99); this.UI.node('b_play').set({ label: '再来一局' }); cue('win'); FG.swing(this.hero); return; }
      case 'defeat': { this.banner('战 败', 99); this.UI.node('b_play').set({ label: '再来一局' }); cue('lose'); return; }
    }
  }

  /** v5-style play: dice rise into a row facing the camera, the hand type slams in, values count up, relics stamp in, the dice fly at the target. */
  private async presentPlay(e: Extract<BattleEvent, { t: 'play' }>) {
    const out = e.outcome, tier = out.tier, tc = TIER_COL[tier];
    const ds = e.uids.map(u => this.dice.get(u)).filter((d): d is Die3D => !!d), n = ds.length;
    const center = V3(0, 3.0, 1.6), gap = Math.min(1.1, 5 / Math.max(1, n - 1)), sc = Math.min(1.15, gap / (DIE * 1.22));
    cue('whoosh', 0.6);
    await Promise.all(ds.map((d, i) => { d.glow = 1; d.glowCol.set(tc); const q = presentQuat(d.topIdx, d.topTurns, camera.quaternion); return wait(i * 0.04).then(() => flyDie(d, center.clone().add(V3((i - (n - 1) / 2) * gap, 0, 0)), 0.3, { q, arc: 0.3 + (i % 2) * 0.35, ease: ease.outCubic, scale: sc })); }));
    const handName = handDisp(out.hands as HandResult);
    const title = await slamTitle(handName, center.clone().add(V3(0, 1.0, 0)), { color: '#' + tc.toString(16).padStart(6, '0') });
    cue('reveal', tier);
    if (tier >= 1) { fxRing(center, tc, 1.6 + tier * 0.8, { billboard: true, life: 0.45 + tier * 0.1, width: 0.2, fill: 0.2, bright: 2 + tier * 0.4 }); fxGlow(center, tc, 1.1 + tier * 0.55, 0.35 + tier * 0.1, 0.9 + tier * 0.3); lightPulse(center.clone().add(V3(0, 0.6, 1.0)), tc, 8 + tier * 5, 0.45 + tier * 0.12, 7); }
    if (tier >= 2) shake(0.1 + tier * 0.05);
    if (tier >= 3) slowmo(0.35 + (tier - 3) * 0.3, 0.3);
    await wait(0.3 + tier * 0.06);
    // values count up at the hero's weapon
    let acc = 0; const wp = () => this.hero.weapon().add(V3(0, 0.8, 0));
    for (const d of ds) { acc += d.value; d.root.scale.multiplyScalar(1.2); after(0.12, () => d.root.scale.multiplyScalar(1 / 1.2)); popText(String(d.value), d.root.position.clone().add(V3(0, 0.6, 0)), { size: 0.5, life: 0.6, rise: 0.4 }); cue('count'); await wait(0.16); }
    if (Math.abs(out.handMult - 1) > 0.001) { popText(`×${out.handMult.toFixed(1)}`, wp(), { color: '#' + tc.toString(16).padStart(6, '0'), size: 0.5 }); await wait(0.26); }
    for (const st of out.steps) {
      if (st.kind === 'base' || st.kind === 'hand') continue;
      if (st.kind === 'die') { const d = ds.find(x => x.uid === st.uid); d?.fx('trig'); popText(`${st.label} ${st.txt}`, (d ? d.root.position.clone() : wp()).add(V3(0, 0.9, 0)), { color: '#ffe8a0', size: 0.34, life: 1.0 }); await wait(0.3); continue; }
      if (st.kind === 'relic') { await this.relicFly(st.label + ' ' + st.txt, st.to || 'weapon'); continue; }
      popText(`${st.label} ${st.txt}`, wp(), { color: '#ffd8a0', size: 0.34 }); await wait(0.22);
    }
    popText(String(out.damage) + (out.aoe ? ' 全体' : ''), center.clone().add(V3(0, 1.9, 0)), { big: true, color: '#ffd84a', life: 1.0, rise: 0.4 }); cue('count', 1);
    fadeOut(title, 0.35);
    await wait(0.25);
    // the attack: hero swings, dice fly at the target(s)
    const targets = out.aoe ? this.b.alive().map(x => x.uid) : e.target != null ? [e.target] : [];
    FG.swing(this.hero);
    const tPos = (u: number) => this.foes.get(u)?.chest() || LICH_HOME.clone().setY(1.2);
    await Promise.all(ds.map((d, i) => { const tgt = tPos(targets[i % Math.max(1, targets.length)]); let last = d.root.position.clone();
      return wait(i * 0.05).then(() => flyDie(d, tgt, 0.26, { arc: 0.6, ease: ease.inCubic, turns: 1.2, trail: dd => { const p = dd.root.position.clone(); trailSeg(last, p, tc, 0.12, { life: 0.25 }); last = p; } })).then(() => { d.root.visible = false; }); }));
  }

  /** A relic triggers: a glowing token pops beside the hero and flies to where its effect lands (v5 relicPop; the 3D model comes next). */
  private async relicFly(label: string, to: 'weapon' | 'hero' | 'gold') {
    const from = this.hero.head().add(V3(-0.9, 1.0, -0.4)), dest = to === 'hero' ? this.hero.chest() : this.hero.weapon();
    const token = new Die3D('standard'); token.root.visible = true; token.root.scale.setScalar(0.01); token.root.position.copy(from); token.glow = 1; token.glowCol.set(0xffd060);
    popText(label, from.clone().add(V3(0, 0.6, 0)), { color: '#ffd060', size: 0.34, life: 1.0 }); cue('relic'); fxGlow(from, COL.gold, 0.8, 0.4, 2);
    await animP(0.22, k => token.root.scale.setScalar(ease.outBack(k) * 0.42));
    await wait(0.18);
    let last = from.clone();
    await flyDie(token, dest, 0.36, { arc: 0.8, ease: ease.inCubic, turns: 0.8, trail: d => { const p = d.root.position.clone(); trailSeg(last, p, 0xffd060, 0.09, { life: 0.3, bright: 2 }); last = p; } });
    fxGlow(dest, COL.gold, 0.9, 0.3, 2.2); fxRing(dest, 0xffd060, 1.0, { billboard: true, life: 0.35, width: 0.15 }); cue('count');
    token.dispose();
  }

  private async orb(from: THREE.Vector3, to: THREE.Vector3, col: number) {
    let last = from.clone(); const mid = from.clone().lerp(to, 0.5).add(V3(0, 1.4, 0));
    await animP(0.4, k => { const a = (1 - k) * (1 - k), b2 = 2 * (1 - k) * k, c = k * k; const p = V3(from.x * a + mid.x * b2 + to.x * c, from.y * a + mid.y * b2 + to.y * c, from.z * a + mid.z * b2 + to.z * c); trailSeg(last, p, col, 0.2, { life: 0.3 }); last = p; });
    fxImpact(to, col, 0.6, { ground: false, stop: false });
  }

  // ------------------------------------------------------------ input
  private bindUI() {
    const UI = this.UI;
    UI.node('b_reroll').on('tap', () => this.act('reroll'));
    UI.node('b_play').on('tap', () => this.act('play'));
    UI.node('b_end').on('tap', () => this.act('end'));
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pickDie = (x: number, y: number) => {
      const s = this.platform.canvasSize(); ndc.set((x / s.w) * 2 - 1, -(y / s.h) * 2 + 1); ray.setFromCamera(ndc, camera);
      const rest = [...this.dice.values()].filter(d => d.mode === 'rest' && d.uid != null);
      const hit = ray.intersectObjects(rest.map(d => d.mesh), false)[0];
      if (hit) return rest.find(d => d.mesh === hit.object) || null;
      // generous touch target: nearest die within ~0.7 world units of the ground ray point
      const pt = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(V3(0, 1, 0), -DIE / 2), pt)) return null;
      let best: Die3D | null = null, bd = 0.75; for (const d of rest) { const dd = Math.hypot(d.home.x - pt.x, d.home.z - pt.z); if (dd < bd) { bd = dd; best = d; } } return best;
    };
    UI.onPointer(ev => {
      if (this.busy || this.b?.s.phase !== 'player') return;
      if (ev.type === 'down') { const d = pickDie(ev.x, ev.y); if (!d) return; const on = !this.sel.includes(d.uid!); this.setSel(d, on); this.slide = { on: true, to: on }; return true; }
      if (ev.type === 'move' && this.slide) { const d = pickDie(ev.x, ev.y); if (d && this.sel.includes(d.uid!) !== this.slide.to) this.setSel(d, this.slide.to); return true; }
      if ((ev.type === 'up' || ev.type === 'cancel') && this.slide) { this.slide = null; return true; }
    });
  }
  private setSel(d: Die3D, on: boolean) {
    if (on) { this.sel.push(d.uid!); d.lift = 1; d.glow = 1; d.glowCol.set(0xffd860); cue('select'); fxSparks(d.root.position.clone().add(V3(0, 0.3, 0)), 0xffe08a, 6, 2, { life: 0.3, grav: 2 }); }
    else { this.sel = this.sel.filter(u => u !== d.uid); d.lift = 0; d.glow = 0; cue('deselect'); }
    this.refresh();
  }

  // ------------------------------------------------------------ UI
  private lane(uid: number) { if (!this.lanes.has(uid)) this.lanes.set(uid, this.lanes.size); return this.lanes.get(uid)!; }
  private project(p: THREE.Vector3) { const v = p.clone().project(camera); return { nx: v.x, ny: v.y, hide: v.z > 1 }; }
  private spawnPlate(uid: number) {
    const w = this.UI.world('enemy_plate').spawn(uid).follow(() => { const f = this.foes.get(uid); return f && f.root.visible ? this.project(f.root.position.clone().add(V3(0, f.h * f.root.scale.y + 0.35, 0))) : { nx: 0, ny: 0, hide: true }; });
    this.plates.set(uid, w);
  }
  private banner(text: string, life: number) { const n = this.UI.node('banner'); n.set({ vars: { text } }); n.visible = true; if (life < 50) after(life, () => { n.visible = false; }, { real: true }); }
  private toast(text: string, life: number) { this.UI.node('toast').flash(life * 1000, text); }

  refresh() {
    const b = this.b; if (!b) return; const UI = this.UI, p = b.player, s = b.s;
    for (const [uid, w] of this.plates) {
      const e = b.enemy(uid); if (!e) continue;
      w.node('ep_name').set({ vars: { name: e.name + (e.armor ? `  护甲 ${e.armor}` : '') } });
      w.node('ep_hp').set({ value: e.hp, max: e.maxHp });
      const it = b.intent(e), st = e.statuses.map(x => STATUS_CN[x.type] + (x.type === 'weak' || x.type === 'vulnerable' ? '' : x.value)).join(' ');
      w.node('ep_info').set({ vars: { info: (s.phase === 'player' ? '意图：' + it.text : '') + (st ? '  ' + st : '') + (e.bloodFury ? `  血怒${e.bloodFury}` : '') } });
    }
    UI.node('hp_bar').set({ value: p.hp, max: p.maxHp });
    const extras = [s.armor ? `护甲 ${s.armor}` : '', ...p.statuses.map(x => STATUS_CN[x.type] + (x.type === 'weak' || x.type === 'vulnerable' ? '' : x.value)), s.bloodRerollCount ? `血怒 ${s.bloodRerollCount}` : '', p.rageFireBonus ? `怒火燎原 +${p.rageFireBonus}` : '', p.furyBonus ? `怒火 +${p.furyBonus}` : ''].filter(Boolean).join('  ');
    UI.node('hp_extra').set({ vars: { extra: extras } });
    UI.node('pile_chip').set({ vars: { bag: s.piles.bag.length, disc: s.piles.discard.length } });
    const cost = b.rerollHpCost();
    UI.node('b_reroll').set({ vars: { cost: cost === 0 ? '免费' : cost < 0 ? '不可' : `-${cost} 生命` } });
    const can = !this.busy && s.phase === 'player' && !s.result;
    UI.node('b_reroll').disabled = !can || !this.sel.length || cost < 0;
    UI.node('b_play').disabled = s.result ? false : !can || !this.sel.length;
    UI.node('b_end').disabled = !can;
    const pv = this.sel.length && can ? b.preview(this.sel) : null;
    const prev = UI.node('preview'), hint = UI.node('hint');
    if (pv) { prev.visible = true; prev.set({ vars: { text: `${handDisp(pv.hands as HandResult)}  预计 ${pv.damage}${pv.aoe ? ' 全体' : ''}${pv.armor ? `  护甲+${pv.armor}` : ''}` } }); }
    else prev.visible = false;
    hint.set({ vars: { text: s.result ? '' : can ? (this.sel.length ? '出牌，或重投选中的骰子' : '点骰子选中 · 按住滑过多选') : '' } });
  }

  // ------------------------------------------------------------ debug / bot
  bot(on = true) { this.botOn = on; if (on) this.botTick(); }
  private botTick() {
    if (!this.botOn || this.busy || this.b.s.result) return;
    const st = botStep(this.b);
    if (st.kind === 'reroll' && this.b.s.rerollCount >= 2) { const p = bestPlay(this.b); if (p) { this.selectUids(p.uids); after(0.4, () => this.act('play')); return; } }
    if (st.kind === 'end') { this.act('end'); return; }
    this.selectUids(st.uids); after(0.45, () => this.act(st.kind === 'reroll' ? 'reroll' : 'play'));
  }
  selectUids(uids: number[]) { for (const d of this.dice.values()) if (d.uid != null) { const on = uids.includes(d.uid); if (on !== this.sel.includes(d.uid)) this.setSel(d, on); } }
  idle() { return !this.busy || !!this.b.s.result; }
  clearSelection() { for (const d of this.dice.values()) if (this.sel.includes(d.uid!)) this.setSel(d, false); }
  get clockTime() { return clock.time; }
}
