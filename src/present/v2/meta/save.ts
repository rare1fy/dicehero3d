// Run save / continue (console standard: the run is saved automatically at the start of every node — battle, shop, reward — and
// "继续旅程" on the title screen resumes there; a finished or abandoned run deletes the save).
import { Run2, type RunState } from '../../../core/v2/run2';
import { CLASSES } from '../../../core/v2/data';
import { store } from './prefs';

const KEY = 'dh3d.run.v1';
export interface RunSave { v: 1; at: number; s: RunState; rng: number }

export function saveRun(run: Run2) {
  if (run.s.phase === 'win' || run.s.phase === 'dead') { clearRun(); return; }
  const data: RunSave = { v: 1, at: Date.now(), s: run.s, rng: run.rng.state() };
  try { store.set(KEY, JSON.stringify(data)); } catch { /* storage full or blocked: the run just isn't resumable */ }
}
export function clearRun() { store.del(KEY); }
export function peekRun(): RunSave | null {
  const raw = store.get(KEY); if (!raw) return null;
  try { const d = JSON.parse(raw) as RunSave; return d && d.v === 1 && d.s && typeof d.rng === 'number' && CLASSES[d.s.classId] ? d : null; } catch { return null; }
}
export function loadRun(): Run2 | null { const d = peekRun(); return d ? Run2.restore(d.s, d.rng) : null; }

const KIND_CN: Record<string, string> = { normal: '雾林小径', elite: '废弃伐木场', shop: '林边货车', camp: '营火', midBoss: '墓园祭坛' };
/** one line for the title screen's continue button */
export function saveSummary(d: RunSave) {
  const s = d.s, n = s.nodes[s.node];
  return `${CLASSES[s.classId].name} ${s.level}级 · ${n ? KIND_CN[n.kind] ?? "" : ""} ${s.node + 1}/${s.nodes.length}`;
}
