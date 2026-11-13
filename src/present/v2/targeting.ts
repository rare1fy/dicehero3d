import type { Battle2, RowRef } from '../../core/v2/battle2';
import type { FoeDisp } from './hpDisplay';
import * as THREE from 'three';

/** 覆盖完整模型投影；小模型也补足 88 参考像素。只在输入时测量。 */
export function modelHit(root: THREE.Object3D, x: number, y: number, k: number, project: (v: THREE.Vector3) => { x: number; y: number }) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const px of [box.min.x, box.max.x]) for (const py of [box.min.y, box.max.y]) for (const pz of [box.min.z, box.max.z]) {
    const p = project(new THREE.Vector3(px, py, pz));
    left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
  }
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  return Math.abs(x-cx) <= Math.max(44*k, (right-left)/2) && Math.abs(y-cy) <= Math.max(44*k, (bottom-top)/2)
    ? Math.hypot(x-cx, y-cy) : Infinity;
}

export function displayTarget(foes: Map<number, FoeDisp>, uid: number | null) {
  const live = [...foes].filter(([, d]) => d.hp > 0 && !d.dying && !d.gone);
  const guards = live.filter(([, d]) => d.ct === 'guardian');
  const pool = guards.length ? guards : live;
  return pool.find(([u]) => u === uid)?.[0] ?? pool[0]?.[0] ?? null;
}
export function canAim(b: Battle2, uid: number, ref?: RowRef, uids: number[] = []) {
  if (!b.enemy(uid) || b.enemy(uid)!.dead) return false;
  if (b.canTarget(uid)) return true;
  if (ref == null || ref === 'basic') return false;
  const o = b.options(uids).find(x => x.ref === ref), row = b.rows().find(x => x.ref === ref);
  const effects = o?.tier ? row?.def.tiers[o.tier]?.effects ?? [] : [];
  // 群体/弹射的效果由规则层处理，嘲讽只拦单体技能。
  return effects.some(e => (e.t === 'dmg' || e.t === 'status' || e.t === 'stun') && e.target !== 'one');
}

/** 斩杀段用演出血量，并通过规则事件取实际掉血量（含护甲/无视护甲），不另写伤害规则。 */
export function displayPreview(b: Battle2, ref: RowRef, uids: number[], target: number | undefined, foes: Map<number, FoeDisp>) {
  const c=b.clone();
  for(const [uid,d] of foes) { const e=c.enemy(uid); if(e&&!d.gone) { e.hp=d.hp; e.maxHp=d.maxHp; e.armor=d.armor; e.statuses=structuredClone(d.statuses); e.dead=d.hp<=0; } }
  const pv=c.preview(ref,uids,target); if(!pv)return null;
  const r=c.play(ref,uids,target), hp=new Map<number,number>();
  if(r.ok)for(const e of r.events) { if(e.t==='enemyTurn'||e.t==='waveClear')break; if(e.t==='hit')hp.set(e.uid,(hp.get(e.uid)??0)+e.hpDmg); }
  return {...pv,hpHits:[...hp].map(([uid,dmg])=>({uid,dmg}))};
}
