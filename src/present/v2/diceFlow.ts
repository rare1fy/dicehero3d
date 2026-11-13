// The dice choreography queue (SHOW3 #14): every move of a die between the field and the prep tray is one named step, played
// strictly one after another (each 0.3–0.6 s). A tap while steps are queued hurries them (the global speed doubles until the
// queue drains). New rules only add a step; nothing else moves dice. Steps must not push steps (that would wait on itself).
import { FX, wait } from '../engine/clock';

export type FlowStep =
  | 'play.show' | 'play.gather' | 'play.spawn'          // a strike: name + pattern + points → dice fly to the hero → (the hit plays) / dice spawned onto the field
  | 'earn'                                              // a die won for next turn condenses in the prep tray (or bursts into the hero past 6)
  | 'end.vanish' | 'end.refill' | 'end.recall' | 'end.stay'   // turn end ①–④
  | 'start.throw'                                       // turn start: the prep tray is thrown onto the field
  | 'fade';                                             // battle won: field + tray fade out

export class DiceFlow {
  private chain: Promise<void> = Promise.resolve(); private depth = 0; private base: number | null = null;
  /** recent step names (captures / bot logs) */
  log: string[] = [];
  onError: (step: string, err: unknown) => void = () => {};
  get busy() { return this.depth > 0; }
  /** queue a step; resolves when it has played */
  step(name: FlowStep, fn: () => Promise<unknown> | unknown): Promise<void> {
    this.depth++; this.log.push(name); if (this.log.length > 80) this.log.shift();
    const p = this.chain.then(async () => { await fn(); }).catch(err => this.onError(name, err)).finally(() => { if (--this.depth === 0) this.calm(); });
    this.chain = p; return p;
  }
  /** a short beat inside a step, clamped to the 0.3–0.6 s rhythm */
  beat(s = 0.4) { return wait(Math.max(0.3, Math.min(0.6, s))); }
  /** player tapped while dice are moving: play the queue faster */
  hurry() { if (!this.busy || this.base != null) return; this.base = FX.speed; FX.speed = this.base * 2.2; }
  private calm() { if (this.base != null) { FX.speed = this.base; this.base = null; } }
}
