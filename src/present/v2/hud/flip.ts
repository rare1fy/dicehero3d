// R7B 第 3 条（用户：「既然是 3D UI，重投和结束回合点了以后就应该要翻转一下嘛」）：按钮外壳绕横轴翻转。
// spin() = 整块转一圈（重投，约 0.35 秒，带回弹）；over() = 翻到背面停一下再翻回来（结束回合 / 吟唱）。
// 主人每帧调 step(dt)，把 angle 写到外壳的 rotation.x，把 lift 加到外壳的 z（转起来时抬离底面，不穿进投影）。
const back = (t: number) => { const s = 1.7; t -= 1; return 1 + (s + 1) * t * t * t + s * t * t; };
interface Step { d: number; dur: number; hold: number }
export class Flip {
  angle = 0; private from = 0; private steps: Step[] = []; private ft = 0; private hold = 0;
  get busy() { return this.steps.length > 0; }
  spin(dur = 0.38) { this.start([{ d: Math.PI * 2, dur, hold: 0 }]); }
  over(dur = 0.26, hold = 0.22) { this.start([{ d: Math.PI, dur, hold }, { d: Math.PI, dur, hold: 0 }]); }
  private start(s: Step[]) { this.angle = 0; this.from = 0; this.steps = s; this.ft = 0; this.hold = 0; }
  step(dt: number) {
    const st = this.steps[0]; if (!st) return this.angle;
    if (this.ft < 1) { this.ft = Math.min(1, this.ft + dt / st.dur); this.angle = this.from + st.d * back(this.ft); }
    else { this.hold += dt; if (this.hold >= st.hold) { this.from += st.d; this.angle = this.from; this.steps.shift(); this.ft = 0; this.hold = 0; } }
    if (!this.steps.length) this.angle = 0;
    return this.angle;
  }
  /** how far the shell must rise (in cells) so a W-tall, D-deep plate turned by angle clears the plane behind it */
  lift(H: number, D: number) { const s = Math.abs(Math.sin(this.angle)), c = Math.abs(Math.cos(this.angle)); return Math.max(0, s * H / 2 + c * D / 2 - D / 2); }
}
