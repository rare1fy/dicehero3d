// 演出状态与同步结算的规则状态隔离。只在相应 beat 生效，批次末尾对账。
import type { Battle2 } from '../../core/v2/battle2';
import type { Ev2, Who } from '../../core/v2/events2';
import type { Status, Die } from '../../core/v2/types';

export interface FoeDisp {
  hp: number; maxHp: number; armor: number; lane: number; boss: boolean;
  statuses: Status[]; ct: string; ready: boolean; dying: boolean; gone: boolean;
}
export class HpTrail {
  hp = 0; ghost = 0; private from = 0; private age = 1; private initialized = false;
  update(hp: number, dt: number) {
    if (!this.initialized) { this.hp = this.ghost = hp; this.initialized = true; }
    if (hp < this.hp) { this.from = Math.max(this.ghost, this.hp); this.age = 0; }
    else if (hp > this.hp) { this.ghost = hp; this.age = 1; }
    this.hp = hp; this.age = Math.min(1, this.age + dt / 0.4);
    this.ghost = this.age >= 1 ? hp : hp + (this.from - hp) * (1 - this.age) ** 2;
    return this.ghost;
  }
}

export class HpDisplay {
  state: Battle2['s'] | null = null;
  private pendingDot: 'poison' | 'burn' | null = null;
  reset(b: Battle2) { this.state = structuredClone(b.s); this.pendingDot = null; }
  sync(b: Battle2, foes: Map<number, FoeDisp>) {
    this.reset(b);
    for (const [uid, d] of foes) { const e = b.enemy(uid); if (e) Object.assign(d, { hp: e.hp, maxHp: e.maxHp, armor: e.armor, statuses: structuredClone(e.statuses) }); }
  }
  seed(b: Battle2, uid: number, lane: number, boss: boolean, remaining: Ev2[]): FoeDisp {
    const e = b.enemy(uid)!; let hp = e.hp, armor = e.armor;
    // 新波/召唤可能已经被同一批事件击中，按事件逆推入场值，不能拿结算后的 HP 当初值。
    for (const ev of remaining.slice().reverse()) {
      if (ev.t === 'hit' && ev.uid === uid) { hp += ev.hpDmg; armor += ev.absorbed; }
      if (ev.t === 'statusTick' && ev.who === uid) hp += ev.dmg;
      if (ev.t === 'armor' && ev.who === uid) armor = ev.total - ev.delta;
    }
    return { hp: Math.min(e.maxHp, hp), maxHp: e.maxHp, armor, lane, boss, ct: e.ct, statuses: [], ready: false, dying: false, gone: false };
  }
  event(e: Ev2, foes: Map<number, FoeDisp>) {
    const s = this.state; if (!s) return;
    const statuses = (who: Who) => who === 'player' ? s.player.statuses : foes.get(who)?.statuses;
    const tick = (who: Who, type: string) => { const list=statuses(who), st=list?.find(x=>x.type===type); if(!list||!st)return; if(type==='poison')st.value--; else if(type==='burn') { st.value=Math.min(st.value,(st.held??0)+(st.heldNew??0)); st.held=st.value; st.heldNew=0; } if(st.value<=0)list.splice(list.indexOf(st),1); };
    if (e.t === 'statusAdd') {
      if (e.status.value <= 0) return;
      const list = statuses(e.who); if (!list) return;
      const old = list.find(x => x.type === e.status.type);
      if (old) { old.value += e.status.value; if (e.status.duration != null) old.duration = Math.max(old.duration ?? 0, e.status.duration); }
      else list.push({ ...e.status });
    } else if (e.t === 'statusExpire') {
      const list = statuses(e.who), i = list?.findIndex(x => x.type === e.type) ?? -1; if (i >= 0) list!.splice(i, 1);
    } else if(e.t==='statusTick') {
      if(e.who==='player' && (e.type==='poison'||e.type==='burn'))this.pendingDot=e.type; else tick(e.who,e.type);
    } else if(e.t==='playerHit' && e.isDot && this.pendingDot) { tick('player',this.pendingDot); this.pendingDot=null;
    } else if (e.t === 'purify') s.player.statuses = s.player.statuses.filter(x => !e.removed.includes(x.type));
    else if (e.t === 'rowPlay') { s.strikesUsed = e.strike; s.comboThisTurn = e.combo; if (e.v4?.cast === 'release') { s.chantRing = 0; s.player.backlash = 0; } }
    else if (e.t === 'turnStart') { s.phase = 'player'; s.turn = e.turn; s.maxStrikes = e.strikes; s.strikesUsed = 0; s.overflow = e.overflow; }
    else if (e.t === 'enemyTurn') s.phase = 'enemy';
    else if (e.t === 'strikeGain') s.maxStrikes += e.n;
    else if (e.t === 'rage') s.player.rage = e.stacks;
    else if (e.t === 'chant') { s.chantRing = e.ring; s.overcharge = e.overcharge; }
    else if (e.t === 'backlash') s.player.backlash = e.stacks;
    else if (e.t === 'spent') s.dice = s.dice.filter(d => !e.uids.includes(d.uid));
    else if (e.t === 'roll') {
      const snaps: Die[] = e.dice.map(d => ({ uid: d.uid, kind: d.kind, face: { value: d.value, suit: d.suit }, persist: 'turn', source: 'base', carried: 0 }));
      if (e.reason === 'turn') s.dice = snaps;
      else for (const d of snaps) { const old = s.dice.find(x => x.uid === d.uid); if (old) Object.assign(old, d); else s.dice.push(d); }
    }
  }
}
