// #ui3d demo: the lich graveyard with every UI-layer component on screen, each driven by keys (and by window.__ui3d for captures).
//   Space 掷骰 (the tray dice fly into the world and land, then come back)   G 挣骰   H 挨打   J 回血 / 护甲 / 屏障   K 击杀爆金币
//   F 切换花色方案 A/B   C 切换职业   T 技能碑换一组亮行   R 重投钮切换免费/卖血   1..5 职业机制 +1   0 清零
import * as THREE from 'three';
import { V3, R, RI, onUpdate } from '../engine/world';
import { clock, wait } from '../engine/clock';
import { shot, staticShot } from '../director';
import { FIELD } from '../dice/throw';
import { throwHooks, type Die3D } from '../dice/die3d';
import type { Env } from '../look/env';
import type { Cast, HeroLike, GhoulLike, LichLike } from '../actors/cast';
import { UiLayer } from './layer';
import { DiceTray } from './tray';
import { HeartFlask } from './flask';
import { SkillTablet, type TabletRow, type RowView } from './tablet';
import { StoneButton, LOOKS } from './buttons';
import { Loot } from './loot';
import { ClassMech } from './classMech';
import { CLASS_FACES, SPECIALS, type ClassId, type FaceScheme, type SpecialId, type SuitSkin } from './suitData';
import { cue } from '../../audio/cues';

const CLASSES: ClassId[] = ['warrior', 'mage', 'rogue'];
const CLASS_SPECIAL: Record<ClassId, SpecialId> = { warrior: 'fury', mage: 'starry', rogue: 'shadowres' };
const EYE = V3(0.3, 13.4, 14.9);

/** demo rows per class: suit rows first (SPEC_v2 §2 style), then a shape row */
function rowsFor(c: ClassId): TabletRow[] {
  const f = CLASS_FACES[c], uniq = [...new Set(f)];
  return [...uniq.map(s => ({ id: s, cond: { kind: 'suit' as const, suit: s } })), { id: 'pair', cond: { kind: 'pair' as const } }, { id: 'straight', cond: { kind: 'straight' as const } }].slice(0, 5);
}

export interface Ui3DDemo {
  L: UiLayer; tray: DiceTray; flask: HeartFlask; tablet: SkillTablet; end: StoneButton; reroll: StoneButton; loot: Loot; mech: ClassMech;
  roll(): Promise<void>; earn(sp?: SpecialId): void; hit(d?: number): void; heal(): void; kill(): void; scheme(s?: FaceScheme): void; cls(c?: ClassId): void; rows(k?: number): void;
  state: { cls: ClassId; scheme: FaceScheme; hp: number; maxHp: number; armor: number; barrier: number; field: Die3D[] };
}

export function ui3dDemo(env: Env, cast: Cast, size: () => { w: number; h: number; dpr: number }): Ui3DDemo {
  void env;
  // ---- the world: hero, the lich on its altar, two ghouls
  const hero: HeroLike = cast.hero(), lich: LichLike = cast.lich();
  hero.place(V3(-2.0, 0, 3.0), Math.PI); lich.place(V3(0, 0.55, -4.7), 0);
  const foes: GhoulLike[] = [cast.ghoul(0), cast.ghoul(1)];
  foes[0].place(V3(1.6, 0, -1.6)); foes[1].place(V3(-0.8, 0, -2.4));
  for (const f of foes) f.faceToward(hero.home);
  hero.faceToward(V3(0, 0, -2));
  onUpdate(dt => { hero.update(dt); lich.update(dt); for (const f of foes) f.update(dt); });
  Object.assign(FIELD, { x0: -1.5, x1: 2.3, z0: -1.2, z1: 1.8 });
  throwHooks.impact = (_d, v) => cue('clack', Math.min(1, v / 9));
  shot('battle', staticShot(EYE, V3(0, -0.6, -2.4), 42), { cut: true });

  // ---- the UI layer
  const L = new UiLayer();
  const state = { cls: 'warrior' as ClassId, scheme: 'A' as FaceScheme, hp: 96, maxHp: 120, armor: 0, barrier: 0, field: [] as Die3D[] };
  const skin = (): SuitSkin => ({ cls: state.cls, scheme: state.scheme });
  const tray = new DiceTray(L, skin(), { sizePx: 72, bottom: 70 });
  const flask = new HeartFlask(L);
  const tablet = new SkillTablet(L);
  const end = new StoneButton(L, LOOKS.end, 'end'), reroll = new StoneButton(L, LOOKS.reroll, 'reroll');
  const loot = new Loot(L, state.cls);
  const mech = new ClassMech(L, skin());
  loot.heroAt = () => hero.chest();
  flask.set({ hp: state.hp, maxHp: state.maxHp });
  reroll.setBadge(2, 0);

  const layout = () => {
    const s = size(); L.resize(s.w, s.h, s.dpr);
    const W = s.w, H = s.h, k = Math.min(1, H / 720);
    flask.place(96 * k + 10, H - 120 * k, 170 * k);
    mech.place(190 * k + 10, H - 64 * k, Math.max(3, 4 * k));
    loot.purse = { x: 54 * k + 10, y: 52 * k + 8 }; loot.emblem = { x: 230 * k + 10, y: H - 150 * k };
    tablet.place(W - 260 * k, H * 0.42, 250 * k);
    end.place(W - 58 * k, H * 0.5, 76 * k);
    reroll.place(W / 2 + 70 * k * 4.4, H - 70 * k, 70 * k);
    tray.sizePx = 70 * k; tray.bottom = 70 * k;
  };
  layout();

  // ---- tablet demo states
  let rowSet = 0;
  const rows = (kk?: number) => {
    rowSet = kk ?? (rowSet + 1) % 3;
    const n = tablet.rows.length, views: RowView[] = [];
    for (let i = 0; i < n; i++) {
      const pat = rowSet === 0 ? ['ready', 'idle', 'dead', 'ready', 'idle'] : rowSet === 1 ? ['idle', 'ready', 'idle', 'dead', 'dead'] : ['dead', 'dead', 'ready', 'idle', 'ready'];
      const st = pat[i % 5] as RowView['state'], tier = st === 'dead' ? 0 : st === 'ready' ? RI(2, 5) : RI(0, 2);
      views.push({ state: st, tier, value: st === 'dead' ? undefined : tier * 6 + RI(2, 8) });
    }
    views.forEach((v, i) => tablet.setView(i, v));
    end.breathe(views.every(v => v.state !== 'ready'));
  };
  tablet.setRows(rowsFor(state.cls)); rows(0);
  tablet.onPick = i => { cue('impact', 0.5); void i; };
  end.onTap = () => { void roll(); };
  reroll.onTap = () => { if (reroll.badge.free > 0) reroll.setBadge(reroll.badge.free - 1, reroll.badge.free - 1 > 0 ? 0 : 3); else { reroll.setBadge(0, Math.min(39, reroll.badge.blood * 2)); hit(3); mech.setRage(mech.rage + 1); } };

  tray.fill(4, [undefined, undefined, undefined, CLASS_SPECIAL[state.cls]]);

  // ---- actions
  let rolling = false;
  async function roll() {
    if (rolling || !tray.count) return; rolling = true;
    for (const d of state.field) d.dispose(); state.field = [];
    const n = tray.count, vals = Array.from({ length: n }, () => RI(1, 6)), sp = tray.dice.map(t => t.special);
    hero.toss();
    state.field = await tray.launch(vals, { eye: EYE });
    await wait(1.6);
    for (const d of state.field) d.dispose(); state.field = [];
    tray.fill(n, sp); rows(); rolling = false;
  }
  const earn = (sp?: SpecialId) => { const f = foes.find(g => g.root.visible) ?? foes[0]; void tray.earn(f.chest(), sp); };
  const hit = (dmg = RI(6, 18)) => {
    let left = dmg;
    if (state.barrier > 0) { const a = Math.min(state.barrier, left); state.barrier -= a; left -= a; }
    if (state.armor > 0) { const a = Math.min(state.armor, left); state.armor -= a; left -= a; }
    state.hp = Math.max(0, state.hp - left); if (state.hp <= 0) state.hp = state.maxHp;
    flask.hit(dmg, { hp: state.hp, armor: state.armor, barrier: state.barrier }); hero.hurt(0.6);
  };
  const heal = () => {
    state.hp = Math.min(state.maxHp, state.hp + 20); state.armor += 6; if (state.cls === 'mage') state.barrier += 6;
    flask.heal({ hp: state.hp, armor: state.armor, barrier: state.barrier });
  };
  let killN = 0;
  const kill = () => {
    const f = foes[killN++ % foes.length]; f.hurt(1.4);
    loot.burst(f.chest(), RI(8, 18), RI(6, 14), killN % 2 ? 6 : 0);
  };
  const scheme = (s?: FaceScheme) => { state.scheme = s ?? (state.scheme === 'A' ? 'B' : 'A'); tray.setSkin(skin()); mech.setSkin(skin()); cue('select', 0.5); };
  const cls = (c?: ClassId) => {
    state.cls = c ?? CLASSES[(CLASSES.indexOf(state.cls) + 1) % 3];
    tray.skin = skin(); const n = tray.count; tray.fill(n, Array.from({ length: n }, (_, i) => (i === n - 1 ? CLASS_SPECIAL[state.cls] : undefined)));
    tablet.setRows(rowsFor(state.cls)); rows(0); mech.setClass(state.cls); loot.setClass(state.cls);
    mech.setRage(0); mech.setChant(0); mech.setStrikes(0); mech.setKept([]);
    if (state.cls === 'mage') { mech.setChant(2); mech.setKept([5, 6]); state.barrier = 8; } else state.barrier = 0;
    if (state.cls === 'warrior') mech.setRage(2); if (state.cls === 'rogue') mech.setStrikes(1);
    flask.set({ barrier: state.barrier });
  };
  const mechUp = () => { if (state.cls === 'warrior') mech.setRage(mech.rage + 1); else if (state.cls === 'mage') { mech.setChant(mech.chant + 1); mech.setKept([...Array(Math.min(3, mech.chant + 1))].map(() => RI(3, 6))); } else mech.setStrikes(mech.strikesUsed + 1, mech.strikesUsed === 1); };
  mech.setRage(2);

  // ---- input
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); void roll(); }
    else if (k === 'g') earn(Math.random() < 0.3 ? CLASS_SPECIAL[state.cls] : undefined);
    else if (k === 'h') hit(); else if (k === 'j') heal(); else if (k === 'k') kill();
    else if (k === 'f') scheme(); else if (k === 'c') cls(); else if (k === 't') rows();
    else if (k === 'r') reroll.tap(); else if (k === 'e') end.tap();
    else if (k >= '1' && k <= '5') mechUp();
    else if (k === '0') { mech.setRage(0); mech.setChant(0); mech.setStrikes(0); mech.setKept([]); }
  });

  onUpdate(dt => {
    const t = clock.time;
    tray.update(dt, t); flask.update(dt); tablet.update(dt, t); end.update(dt); reroll.update(dt); loot.update(dt, t); mech.update(dt);
  });
  void R; void SPECIALS; void THREE;
  return { L, tray, flask, tablet, end, reroll, loot, mech, roll, earn, hit, heal, kill, scheme, cls, rows, state, layout } as Ui3DDemo & { layout: () => void };
}

/** pointer routing for the demo (CSS px): buttons, then the tablet, then the tray */
export function ui3dPointer(D: Ui3DDemo, type: string, x: number, y: number) {
  if (D.end.pointer(type, x, y)) return true;
  if (D.reroll.pointer(type, x, y)) return true;
  if (D.tablet.pointer(type, x, y)) return true;
  if (type === 'down' && D.tray.hit(x, y) >= 0) { void D.roll(); return true; }
  return false;
}
