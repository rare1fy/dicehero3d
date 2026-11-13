// R7B 第 3 条（用户：「既然是 3D UI，重投和结束回合点了以后就应该要翻转一下嘛」）：按钮外壳绕横轴翻转。
// spin() = 整块转一圈（重投，约 0.38 秒，带回弹）。
// over() / home() = 结束回合：点下去翻到背面（敌方回合期间一直停在背面），轮到玩家时再翻回正面
// （用户：「结束回合按钮的翻转只做了翻到背面，没有做从背面翻回来」）。两次都朝同一方向转，整圈后角度归零。
// 主人每帧调 step(dt)，把 angle 写到外壳的 rotation.x，把 lift() 加到外壳的 z（转起来时抬离底面，不穿进投影）。
const back = (t: number) => { const s = 1.7; t -= 1; return 1 + (s + 1) * t * t * t + s * t * t; };
const TAU = Math.PI * 2;
export class Flip {
  angle = 0; private from = 0; private to = 0; private ft = 1; private dur = 0.3;
  /** an animation is running */
  get busy() { return this.ft < 1; }
  /** resting on (or turning to) the back face */
  get onBack() { return Math.abs(this.to - Math.PI) < 1e-3; }
  private go(to: number, dur: number) { this.from = this.angle; this.to = to; this.ft = 0; this.dur = dur; }
  spin(dur = 0.38) { this.angle = 0; this.go(TAU, dur); }
  over(dur = 0.3) { if (!this.onBack) this.go(Math.PI, dur); }
  home(dur = 0.34) { if (this.onBack) this.go(TAU, dur); }
  step(dt: number) {
    if (this.ft >= 1) return this.angle;
    this.ft = Math.min(1, this.ft + dt / this.dur); this.angle = this.from + (this.to - this.from) * back(this.ft);
    if (this.ft >= 1) { this.angle = this.to; if (this.to >= TAU - 1e-3) this.angle = this.to = 0; }
    return this.angle;
  }
  /** how far the shell must rise (in cells) so a H-tall, D-deep plate turned by angle clears the plane behind it */
  lift(H: number, D: number) { const s = Math.abs(Math.sin(this.angle)), c = Math.abs(Math.cos(this.angle)); return Math.max(0, s * H / 2 + c * D / 2 - D / 2); }
}
