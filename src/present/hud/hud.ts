// The battle HUD, drawn in an orthographic overlay (no DOM, works in mini-games): a boss bar across the top, the hero's vitals bottom-left,
// three chunky buttons, the hand preview, banners, toasts, and small world-anchored plates over the ghouls. Canvases are only
// repainted when their content changes; bars are plain quads that animate every frame.
import * as THREE from 'three';
import { canvasOf, drawSpans, measure, roundRect, type Span, type TextStyle } from './paint';
import { anim, ease, lerp } from '../engine/clock';

export interface Rect { x: number; y: number; w: number; h: number }

/** A textured quad whose canvas is repainted on demand; positioned in CSS px (top-left origin). */
class Pane {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.CanvasTexture | null = null; w = 1; h = 1; key = ''; x = 0; y = 0; scale = 1; alpha = 1; visible = true;
  constructor(private hud: Hud, order = 0) {
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat); this.mesh.renderOrder = order; hud.scene.add(this.mesh);
  }
  paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, k: number) => void) {
    if (key === this.key && this.tex) return; this.key = key;
    const k = this.hud.dpr, { c, g } = canvasOf(w * k, h * k); draw(g, k);
    this.tex?.dispose(); this.tex = new THREE.CanvasTexture(c as HTMLCanvasElement); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.mat.map = this.tex; this.mat.needsUpdate = true; this.w = w; this.h = h;
  }
  at(x: number, y: number) { this.x = x; this.y = y; return this; }
  sync() {
    this.mesh.visible = this.visible && this.alpha > 0.01 && !!this.tex;
    this.mesh.scale.set(this.w * this.scale, this.h * this.scale, 1); this.mesh.position.set(this.x + this.w / 2, -(this.y + this.h / 2), 0); this.mat.opacity = this.alpha;
  }
  rect(): Rect { return { x: this.x + (this.w - this.w * this.scale) / 2, y: this.y + (this.h - this.h * this.scale) / 2, w: this.w * this.scale, h: this.h * this.scale }; }
}

/** A flat colour quad (bars). */
class Quad {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial;
  constructor(hud: Hud, color: THREE.ColorRepresentation, order = 0, opacity = 1) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat); this.mesh.renderOrder = order; hud.scene.add(this.mesh);
  }
  set(x: number, y: number, w: number, h: number) { this.mesh.visible = w > 0.5; this.mesh.scale.set(Math.max(0.001, w), h, 1); this.mesh.position.set(x + w / 2, -(y + h / 2), 0); }
}

/** HP bar: dark trough, a delayed "ghost" chunk, the live fill with a highlight, an armor segment, text. */
class Bar {
  bg: Pane; ghost: Quad; fill: Quad; hi: Quad; armor: Quad; label: Pane; marker: Quad | null = null;
  v = 1; max = 1; ghostV = 1; shown = 1; armorV = 0; r: Rect = { x: 0, y: 0, w: 100, h: 14 };
  constructor(private hud: Hud, private col: string, private o: { marker?: number; text?: boolean } = {}) {
    this.bg = new Pane(hud, 10); this.ghost = new Quad(hud, 0xfff0d0, 11, 0.85); this.fill = new Quad(hud, col, 12); this.hi = new Quad(hud, 0xffffff, 13, 0.22); this.armor = new Quad(hud, 0x6ab4ff, 14, 0.9);
    this.label = new Pane(hud, 15); if (o.marker != null) this.marker = new Quad(hud, 0xfff6d0, 15, 0.8);
  }
  layout(r: Rect) { this.r = r; this.bg.paint(`bg${r.w}x${r.h}`, r.w + 8, r.h + 8, (g, k) => { roundRect(g, 1 * k, 1 * k, (r.w + 6) * k, (r.h + 6) * k, 5 * k); g.fillStyle = 'rgba(8,6,14,0.85)'; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = '#b8964e'; g.stroke(); }); this.bg.at(r.x - 4, r.y - 4); }
  set(v: number, max: number, armor = 0) { if (v < this.v) { /* ghost lingers then drains */ } this.v = v; this.max = Math.max(1, max); this.armorV = armor; }
  update(dt: number) {
    const r = this.r, f = this.v / this.max;
    this.shown += (f - this.shown) * Math.min(1, dt * 14);
    if (this.ghostV < this.shown) this.ghostV = this.shown; else this.ghostV += (this.shown - this.ghostV) * Math.min(1, dt * 2.2);
    this.fill.set(r.x, r.y, r.w * this.shown, r.h); this.hi.set(r.x, r.y, r.w * this.shown, r.h * 0.35); this.ghost.set(r.x, r.y, r.w * this.ghostV, r.h);
    const aw = Math.min(r.w, (this.armorV / this.max) * r.w); this.armor.set(r.x + r.w - aw, r.y + r.h * 0.55, aw, r.h * 0.45);
    if (this.marker && this.o.marker != null) this.marker.set(r.x + r.w * this.o.marker - 1, r.y - 2, 2, r.h + 4);
    if (this.o.text !== false) {
      const txt = `${Math.max(0, Math.round(this.v))} / ${this.max}${this.armorV ? `   护甲 ${this.armorV}` : ''}`;
      this.label.paint('t' + txt + r.w, r.w, r.h + 4, (g, k) => { g.textAlign = 'center'; drawSpans(g, [{ t: txt }], { size: Math.min(13, r.h - 1), color: '#fff8e8', stroke: 'rgba(0,0,0,0.85)', strokeW: 3, weight: 800 }, (r.w * k) / 2 - (measure([{ t: txt }], { size: Math.min(13, r.h - 1) }).w * k) / 2, (r.h - 1) * k, k); });
      this.label.at(r.x, r.y - 1);
    }
    for (const p of [this.bg, this.label]) p.sync();
  }
  setVisible(v: boolean) { for (const m of [this.bg.mesh, this.ghost.mesh, this.fill.mesh, this.hi.mesh, this.armor.mesh, this.label.mesh, this.marker?.mesh]) if (m) m.visible = v; this.bg.visible = v; this.label.visible = v; }
}

export interface ButtonState { label: string; sub?: string; enabled: boolean; tone: 'primary' | 'teal' | 'stone' }
class Button {
  pane: Pane; state: ButtonState = { label: '', enabled: true, tone: 'stone' }; press = 0; onTap: () => void = () => {}; r: Rect = { x: 0, y: 0, w: 100, h: 60 };
  constructor(private hud: Hud) { this.pane = new Pane(hud, 20); }
  set(s: ButtonState) { this.state = s; this.draw(); }
  layout(r: Rect) { this.r = r; this.draw(); }
  private draw() {
    const s = this.state, r = this.r, key = JSON.stringify(s) + r.w + 'x' + r.h;
    const tones = { primary: ['#e8643a', '#9a2a18', '#ffd27a'], teal: ['#3aa8a0', '#1a5a58', '#c8fff2'], stone: ['#6a6478', '#363244', '#e8e0f0'] }[s.tone];
    this.pane.paint(key, r.w, r.h, (g, k) => {
      const W = r.w * k, H = r.h * k, d = 6 * k;
      roundRect(g, 0, d, W, H - d, 12 * k); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill();                       // drop / thickness
      roundRect(g, 0, 0, W, H - d, 12 * k);
      const gr = g.createLinearGradient(0, 0, 0, H - d); gr.addColorStop(0, s.enabled ? tones[0] : '#4a4652'); gr.addColorStop(1, s.enabled ? tones[1] : '#2a2830'); g.fillStyle = gr; g.fill();
      g.lineWidth = 2 * k; g.strokeStyle = s.enabled ? '#e8c878' : '#5a5660'; g.stroke();
      roundRect(g, 4 * k, 3 * k, W - 8 * k, (H - d) * 0.42, 9 * k); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill();
      const main: Span[] = [{ t: s.label }], st: TextStyle = { size: s.sub ? 19 : 21, color: s.enabled ? '#fffaf0' : '#8a8690', stroke: 'rgba(20,8,4,0.9)', strokeW: 4, weight: 900 };
      const m = measure(main, st); drawSpans(g, main, st, W / 2 - (m.w * k) / 2, (s.sub ? (H - d) * 0.52 : (H - d) * 0.64) , k);
      if (s.sub) { const sub: Span[] = [{ t: s.sub }], ss: TextStyle = { size: 12, color: s.enabled ? tones[2] : '#77737c', weight: 700, stroke: 'rgba(0,0,0,0.7)', strokeW: 3 }; const m2 = measure(sub, ss); drawSpans(g, sub, ss, W / 2 - (m2.w * k) / 2, (H - d) * 0.86, k); }
    });
    this.pane.at(r.x, r.y);
  }
  update(dt: number) { this.press = Math.max(0, this.press - dt * 6); this.pane.scale = 1 - this.press * 0.08; this.pane.y = this.r.y + this.press * 4; this.pane.sync(); }
  hit(x: number, y: number) { const r = this.r; return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
}

export interface PlateData { name: string; hp: number; max: number; armor: number; intent: Span[]; status: string }
export class Plate {
  head: Pane; bar: Bar; intent: Pane; x = 0; y = 0; hide = false;
  constructor(hud: Hud) { this.head = new Pane(hud, 16); this.bar = new Bar(hud, '#c8302a', { text: false }); this.intent = new Pane(hud, 16); }
  set(d: PlateData) {
    this.bar.set(d.hp, d.max, d.armor);
    const head: Span[] = [{ t: d.name, c: '#f4e8d0' }, { t: `  ${Math.max(0, d.hp)}`, c: '#ffb0a0', s: 12 }], hs: TextStyle = { size: 13, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 };
    const m = measure(head, hs); this.head.paint(JSON.stringify(head), m.w + 8, 18, (g, k) => drawSpans(g, head, hs, 4 * k, 14 * k, k));
    const ms = measure(d.intent, { size: 13 }); this.intent.paint(JSON.stringify(d.intent) + d.status, Math.max(ms.w, measure([{ t: d.status }], { size: 11 }).w) + 12, 36, (g, k) => { drawSpans(g, d.intent, { size: 13, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 6 * k, 15 * k, k); if (d.status) drawSpans(g, [{ t: d.status, c: '#d8c8f0' }], { size: 11, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 6 * k, 31 * k, k); });
  }
  update(dt: number) {
    const w = 70; this.bar.layout({ x: this.x - w / 2, y: this.y, w, h: 7 }); this.bar.update(dt);
    this.head.at(this.x - this.head.w / 2, this.y - 20); this.intent.at(this.x - this.intent.w / 2, this.y + 12);
    for (const p of [this.head, this.intent]) { p.visible = !this.hide; p.sync(); }
    this.bar.setVisible(!this.hide);
  }
  dispose(hud: Hud) { for (const m of [this.head.mesh, this.intent.mesh, this.bar.bg.mesh, this.bar.fill.mesh, this.bar.ghost.mesh, this.bar.hi.mesh, this.bar.armor.mesh, this.bar.label.mesh]) hud.scene.remove(m); }
}

export class Hud {
  scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10); w = 1; h = 1; dpr = 1; safeTop = 0; safeBottom = 0;
  boss: { name: Pane; bar: Bar; status: Pane; on: boolean };
  hero: { bar: Bar; info: Pane };
  piles: Pane; preview: Pane; hint: Pane; banner: Pane; sub: Pane; toastP: Pane; subtitleP: Pane;
  private bannerSeq = 0; private subSeq = 0;
  buttons: { reroll: Button; play: Button; end: Button };
  plates = new Map<number, Plate>();
  /** battle widgets on/off (title and cutscenes show only banners) */
  uiOn = false;
  /** column: the phone-width strip the HUD lays out in (centred on desktop) */
  col = { x: 0, w: 1 };
  constructor() {
    this.boss = { name: new Pane(this, 15), bar: new Bar(this, '#b8283a', { marker: 0.4 }), status: new Pane(this, 15), on: false };
    this.hero = { bar: new Bar(this, '#d83a30'), info: new Pane(this, 15) };
    this.piles = new Pane(this, 15); this.preview = new Pane(this, 18); this.hint = new Pane(this, 18); this.banner = new Pane(this, 30); this.sub = new Pane(this, 30); this.toastP = new Pane(this, 31); this.subtitleP = new Pane(this, 29); this.subtitleP.alpha = 0;
    this.buttons = { reroll: new Button(this), play: new Button(this), end: new Button(this) };
    this.banner.alpha = 0; this.sub.alpha = 0; this.toastP.alpha = 0; this.preview.alpha = 0;
  }
  resize(w: number, h: number, dpr: number, safeTop = 0, safeBottom = 0) {
    this.w = w; this.h = h; this.dpr = Math.min(2, dpr); this.safeTop = safeTop; this.safeBottom = safeBottom;
    this.cam.left = 0; this.cam.right = w; this.cam.top = 0; this.cam.bottom = -h; this.cam.updateProjectionMatrix();
    this.col.w = Math.min(w, 460); this.col.x = (w - this.col.w) / 2;
    const c = this.col, top = 10 + safeTop, bot = h - 12 - safeBottom;
    this.boss.bar.layout({ x: c.x + 24, y: top + 30, w: c.w - 48, h: 14 });
    const bw = (c.w - 24 - 16) / 3;
    this.buttons.reroll.layout({ x: c.x + 12, y: bot - 66, w: bw * 0.92, h: 66 });
    this.buttons.play.layout({ x: c.x + 12 + bw * 0.92 + 8, y: bot - 72, w: bw * 1.16, h: 72 });
    this.buttons.end.layout({ x: c.x + 12 + bw * 2.08 + 16, y: bot - 66, w: bw * 0.92, h: 66 });
    this.hero.bar.layout({ x: c.x + 16, y: bot - 66 - 52, w: c.w * 0.46, h: 14 });
    this.repaintStatic();
  }
  private bossName = ''; private bossTitle = '';
  setBoss(on: boolean, name = '', title = '') { this.boss.on = on; this.bossName = name; this.bossTitle = title; this.repaintStatic(); }
  private repaintStatic() {
    const c = this.col, top = 10 + this.safeTop;
    const sp: Span[] = [{ t: this.bossName, c: '#f6e6c8', s: 18 }, { t: this.bossTitle ? '  ' + this.bossTitle : '', c: '#a898c0', s: 12, w: 700 }];
    this.boss.name.paint(JSON.stringify(sp) + c.w, c.w - 48, 26, (g, k) => drawSpans(g, sp, { stroke: 'rgba(0,0,0,0.9)', strokeW: 4, shadow: '#000' }, 0, 21 * k, k));
    this.boss.name.at(c.x + 24, top);
  }
  setBossBar(hp: number, max: number, armor: number, status: string) {
    this.boss.bar.set(hp, max, armor);
    const c = this.col, sp: Span[] = [{ t: status, c: '#d8c8f0' }];
    this.boss.status.paint('s' + status + c.w, c.w - 48, 18, (g, k) => drawSpans(g, sp, { size: 12, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 0, 13 * k, k));
    this.boss.status.at(c.x + 24, 10 + this.safeTop + 48);
  }
  setHero(hp: number, max: number, armor: number, lines: Span[]) {
    this.hero.bar.set(hp, max, armor);
    const c = this.col, r = this.hero.bar.r;
    this.hero.info.paint(JSON.stringify(lines) + c.w, c.w - 24, 22, (g, k) => drawSpans(g, lines, { size: 12, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 0, 15 * k, k));
    this.hero.info.at(r.x, r.y - 22);
  }
  setPiles(bag: number, disc: number) {
    const sp: Span[] = [{ t: '骰袋 ', c: '#a898c0' }, { t: String(bag), c: '#f4e8d0' }, { t: '   弃骰 ', c: '#a898c0' }, { t: String(disc), c: '#f4e8d0' }];
    const r = this.hero.bar.r;
    this.piles.paint(JSON.stringify(sp), 140, 20, (g, k) => drawSpans(g, sp, { size: 12, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 0, 14 * k, k));
    this.piles.at(this.col.x + this.col.w - 150, r.y - 4);
  }
  setPreview(lines: Span[][] | null) {
    if (!lines) { this.preview.alpha = Math.max(0, this.preview.alpha); this.previewOn = false; return; }
    this.previewOn = true;
    const c = this.col, W = c.w - 40;
    this.preview.paint(JSON.stringify(lines) + W, W, 58, (g, k) => {
      roundRect(g, 0, 0, W * k, 58 * k, 12 * k); const gr = g.createLinearGradient(0, 0, 0, 58 * k); gr.addColorStop(0, 'rgba(26,18,40,0.88)'); gr.addColorStop(1, 'rgba(12,8,20,0.88)'); g.fillStyle = gr; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = '#b8964e'; g.stroke();
      lines.forEach((ln, i) => { const st: TextStyle = { size: i ? 13 : 20, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }; const m = measure(ln, st); drawSpans(g, ln, st, (W * k) / 2 - (m.w * k) / 2, (i ? 49 : 26) * k, k); });
    });
    this.preview.at(c.x + 20, this.buttons.play.r.y - 66 - 40);
  }
  private previewOn = false;
  setHint(text: string) {
    const sp: Span[] = [{ t: text, c: '#c8bce0' }], m = measure(sp, { size: 12 });
    this.hint.paint('h' + text, m.w + 8, 18, (g, k) => drawSpans(g, sp, { size: 12, stroke: 'rgba(0,0,0,0.9)', strokeW: 3 }, 4 * k, 13 * k, k));
    this.hint.at(this.w / 2 - this.hint.w / 2, this.buttons.play.r.y - 22);
  }
  /** Big centred title with an optional subtitle; slams in, holds, fades. */
  showBanner(title: string, sub = '', hold = 1.2, color: [string, string] = ['#fff2c0', '#e8a040'], yFrac = 0.36) {
    const c = this.col, W = c.w, st: TextStyle = { size: 40, weight: 900, gradient: color, stroke: 'rgba(20,6,2,0.95)', strokeW: 7, shadow: '#000' };
    const m = measure([{ t: title }], st);
    this.banner.paint('b' + title + color.join(), Math.max(W, m.w + 40), 64, (g, k) => drawSpans(g, [{ t: title }], st, ((Math.max(W, m.w + 40) - m.w) / 2) * k, 50 * k, k));
    this.banner.at(this.w / 2 - this.banner.w / 2, this.h * yFrac);
    const ss: TextStyle = { size: 15, color: '#e8dcf8', stroke: 'rgba(0,0,0,0.9)', strokeW: 4, weight: 700 }, m2 = measure([{ t: sub }], ss);
    this.sub.paint('s' + sub, m2.w + 20, 26, (g, k) => drawSpans(g, [{ t: sub }], ss, 10 * k, 19 * k, k)); this.sub.at(this.w / 2 - this.sub.w / 2, this.h * yFrac + 62);
    const b = this.banner, s = this.sub, seq = ++this.bannerSeq;
    anim(0.22, k => { if (seq !== this.bannerSeq) return; b.alpha = k; b.scale = lerp(1.6, 1, ease.outBack(k)); s.alpha = k; }, undefined, { real: true });
    if (hold < 50) setTimeoutReal(hold + 0.22, () => anim(0.35, k => { if (seq !== this.bannerSeq) return; b.alpha = 1 - k; s.alpha = 1 - k; b.scale = 1 + k * 0.1; }, undefined, { real: true }));
  }
  hideBanner() { this.bannerSeq++; this.banner.alpha = 0; this.sub.alpha = 0; }
  /** Spoken line as a cinematic subtitle in the lower third. */
  subtitle(text: string, life = 2.5, who = '枯骨巫妖') {
    const sp: Span[] = [{ t: who + '  ', c: '#7affb0', s: 13 }, { t: text, c: '#f4ecdc' }], st: TextStyle = { size: 16, stroke: 'rgba(0,0,0,0.95)', strokeW: 4, weight: 700 }, m = measure(sp, st), W = Math.min(this.w - 16, m.w + 40);
    this.subtitleP.paint('st' + text, W, 40, (g, k) => { const gr = g.createLinearGradient(0, 0, W * k, 0); gr.addColorStop(0, 'rgba(6,4,12,0)'); gr.addColorStop(0.15, 'rgba(6,4,12,0.78)'); gr.addColorStop(0.85, 'rgba(6,4,12,0.78)'); gr.addColorStop(1, 'rgba(6,4,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, W * k, 40 * k); drawSpans(g, sp, st, ((W - m.w) / 2) * k, 27 * k, k); });
    this.subtitleP.at(this.w / 2 - this.subtitleP.w / 2, this.h * 0.6);
    const p = this.subtitleP, seq = ++this.subSeq; anim(0.2, k => { if (seq === this.subSeq) p.alpha = k; }, undefined, { real: true }); setTimeoutReal(life, () => anim(0.4, k => { if (seq === this.subSeq) p.alpha = 1 - k; }, undefined, { real: true }));
  }
  toast(text: string, life = 1.2) {
    const st: TextStyle = { size: 15, color: '#fff2e0', stroke: 'rgba(0,0,0,0.9)', strokeW: 4, weight: 800 }, m = measure([{ t: text }], st);
    this.toastP.paint('t' + text, m.w + 36, 36, (g, k) => { roundRect(g, 0, 0, (m.w + 36) * k, 36 * k, 18 * k); g.fillStyle = 'rgba(14,10,24,0.85)'; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = '#8a7ab0'; g.stroke(); drawSpans(g, [{ t: text }], st, 18 * k, 24 * k, k); });
    this.toastP.at(this.w / 2 - this.toastP.w / 2, this.h * 0.52);
    const p = this.toastP; anim(0.15, k => { p.alpha = k; }, undefined, { real: true }); setTimeoutReal(life, () => anim(0.3, k => { p.alpha = 1 - k; }, undefined, { real: true }));
  }
  plate(uid: number) { if (!this.plates.has(uid)) this.plates.set(uid, new Plate(this)); return this.plates.get(uid)!; }
  dropPlate(uid: number) { const p = this.plates.get(uid); if (p) { p.dispose(this); this.plates.delete(uid); } }

  pointer(type: string, x: number, y: number): boolean {
    if (!this.uiOn) return false;
    for (const b of Object.values(this.buttons)) if (b.hit(x, y)) { if (type === 'down' && b.state.enabled) { b.press = 1; b.onTap(); } return true; }
    return false;
  }
  update(dt: number) {
    const on = this.uiOn, showBoss = this.boss.on && on;
    this.boss.bar.setVisible(showBoss); this.boss.name.visible = showBoss; this.boss.status.visible = showBoss;
    if (showBoss) this.boss.bar.update(dt);
    this.boss.name.sync(); this.boss.status.sync();
    this.hero.bar.update(dt); this.hero.bar.setVisible(on); this.hero.info.visible = on; this.piles.visible = on; this.hint.visible = on; this.hero.info.sync(); this.piles.sync();
    this.preview.alpha += ((this.previewOn && on ? 1 : 0) - this.preview.alpha) * Math.min(1, dt * 12); this.preview.sync();
    this.hint.sync(); this.banner.sync(); this.sub.sync(); this.toastP.sync(); this.subtitleP.sync();
    for (const b of Object.values(this.buttons)) { b.pane.visible = on; b.update(dt); }
    for (const p of this.plates.values()) { if (!on) p.hide = true; p.update(dt); }
  }
  render(r: THREE.WebGLRenderer) { const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = ac; }
}

/** setTimeout in real seconds through the game clock (keeps working under hitstop and in mini-games). */
function setTimeoutReal(s: number, fn: () => void) { anim(s, () => {}, fn, { real: true }); }
