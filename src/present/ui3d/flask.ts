// 心形血瓶: a heart-shaped glass flask in the UI layer. A voxel metal frame round the heart, a cork and collar, a glass volume
// (see-through where empty) and the blood inside, whose surface sits at the HP fraction and sloshes when hit (a damped wave
// that stays level in screen space while the flask rocks). Low HP cracks the glass (straight orthogonal crack lines, two stages).
// Armour: an iron shield hung on the flask's lower right (its number in full-resolution pixel digits). Barrier (魔导): a blue
// light shell round the flask. HP digits sit on the flask.
import * as THREE from 'three';
import { V3, R } from '../engine/world';
import { ease, animP } from '../engine/clock';
import { UiLayer } from './layer';
import { voxModel, UiSparks, Spring, flat } from './vox';
import { cue } from '../../audio/cues';

// heart mask on a 19 × 17 grid (x −9..9, y 0..16)
const HW = 9, HH = 16, CELL = 1;
function inHeart(x: number, y: number) { const X = (x + 0.5) / (HW + 0.5) * 1.2, Y = ((y + 0.5) / HH) * 2.3 - 1.05; return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0; }
const MASK: boolean[][] = []; for (let y = 0; y < HH; y++) { MASK[y] = []; for (let x = -HW; x <= HW; x++) MASK[y][x + HW] = inHeart(x, y); }
const m = (x: number, y: number) => y >= 0 && y < HH && x >= -HW && x <= HW && MASK[y][x + HW];
/** distance (cells, 4-connected) to the outside */
const DIST: number[][] = (() => {
  const D: number[][] = MASK.map(r => r.map(v => (v ? 99 : 0)));
  for (let it = 0; it < 12; it++) for (let y = 0; y < HH; y++) for (let x = -HW; x <= HW; x++) {
    if (!m(x, y)) continue; let d = 99;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; d = Math.min(d, m(xx, yy) ? D[yy][xx + HW] + 1 : 1); }
    D[y][x + HW] = Math.min(D[y][x + HW], d);
  }
  return D;
})();
const dist = (x: number, y: number) => (m(x, y) ? DIST[y][x + HW] : 0);
/** half depth of the pillow at (x, y) */
const hd = (x: number, y: number) => Math.min(4, 1 + Math.floor(dist(x, y) * 0.7));

const LIQ_VS = `varying vec3 vW; varying vec3 vN; varying vec3 vC;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LIQ_FS = `uniform float uLevel, uAmp, uTime, uK, uS; uniform vec3 uCol, uTop, uDeep; varying vec3 vW; varying vec3 vN; varying vec3 vC;
void main(){
  float surf = uLevel + uAmp * sin(vW.x * uK + uTime * 7.0) + uAmp * 0.5 * sin(vW.x * uK * 2.3 - uTime * 5.0);
  if (vW.y > surf) discard;
  if (!gl_FrontFacing) { gl_FragColor = vec4(uTop, 1.0); return; }   // seen through the cut: the liquid's surface
  float tone = vN.y > 0.6 ? 1.1 : vN.y < -0.6 ? 0.6 : vN.x > 0.6 ? 0.82 : vN.x < -0.6 ? 0.95 : 1.0;
  float depthK = clamp((surf - vW.y) / (uS * 12.0), 0.0, 1.0);
  vec3 c = mix(uCol, uDeep, depthK * 0.6) * tone * vC;
  if (surf - vW.y < uS * 1.2) c = mix(c, uTop, 0.55);                     // a bright band just under the surface
  gl_FragColor = vec4(c, 1.0);
}`;

export interface FlaskState { hp: number; maxHp: number; armor: number; barrier: number }

export class HeartFlask {
  root = new THREE.Group(); private body = new THREE.Group();
  private liquid: THREE.Mesh; private liqMat: THREE.ShaderMaterial; private glass: THREE.Group; private cracks: THREE.Group[] = [];
  private shield: THREE.Group; private dome: THREE.Group; private domeMats: THREE.MeshBasicMaterial[] = [];
  private sparks: UiSparks;
  /** layout: centre (CSS px) and height (px) */
  x = 110; y = 600; sizePx = 150;
  st: FlaskState = { hp: 1, maxHp: 1, armor: 0, barrier: 0 };
  private shown = 1; private ghost = 1; private wave = new Spring(90, 3.2); private rock = new Spring(140, 7); private pop = new Spring(260, 14);
  private shieldK = 0; private shieldPop = new Spring(300, 12); private domeK = 0; private time = 0; private crackK = [0, 0];
  constructor(private L: UiLayer) {
    this.sparks = new UiSparks(L.scene, 120);
    L.scene.add(this.root); this.root.add(this.body);
    // ---- frame: the heart rim (metal), the collar and the cork
    const IRON = 0x3a3446, IRON_L = 0x6a6278, GOLD = 0xd8a040, CORK = 0x8a5a32, CORK_D = 0x5e3a20;
    const frame = voxModel(CELL, set => {
      for (let y = 0; y < HH; y++) for (let x = -HW; x <= HW; x++) {
        if (!m(x, y) || dist(x, y) !== 1) continue;
        const h = hd(x, y), edgeTop = !m(x, y + 1);
        for (let z = -h; z <= h; z++) set(x, y, z, z === h || z === -h ? (edgeTop ? IRON_L : IRON) : IRON);
      }
      // gold studs on the rim front, on the straight-ish parts
      for (const [x, y] of [[-8, 11], [8, 11], [-5, 15], [5, 15], [-4, 5], [4, 5], [0, 1]]) if (m(x, y)) set(x, y, hd(x, y) + 1, GOLD);
      // collar + cork at the heart's dip
      for (let x = -2; x <= 1; x++) for (let z = -2; z <= 2; z++) { set(x, 13, z, GOLD); set(x, 14, z, GOLD); }
      for (let x = -2; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 15; y <= 17; y++) set(x, y, z, y === 17 ? CORK : CORK_D);
      for (let x = -3; x <= 2; x++) for (let z = -2; z <= 2; z++) set(x, 18, z, CORK);
    }, { centre: [0, 9, 0] });
    this.body.add(frame);
    // ---- the blood: interior cells, cut at the level by the shader
    const liq = voxModel(CELL, set => {
      for (let y = 0; y < HH; y++) for (let x = -HW; x <= HW; x++) { if (!m(x, y) || dist(x, y) < 2) continue; const h = hd(x, y) - 1; for (let z = -h; z <= h; z++) set(x, y, z, 0xffffff); }
    }, { centre: [0, 9, 0] });
    this.liqMat = new THREE.ShaderMaterial({ vertexShader: LIQ_VS, fragmentShader: LIQ_FS, side: THREE.DoubleSide, vertexColors: true,
      uniforms: { uLevel: { value: 0 }, uAmp: { value: 0 }, uTime: { value: 0 }, uK: { value: 1 }, uS: { value: 1 }, uCol: { value: new THREE.Color(0xc0142a) }, uTop: { value: new THREE.Color(0xff6a5a) }, uDeep: { value: new THREE.Color(0x4a0410) } } });
    let lm: THREE.Mesh | null = null; liq.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.material = this.liqMat; lm = mm; } });
    this.liquid = lm!; this.body.add(liq);
    // ---- glass: a faint volume over the interior + a straight highlight streak
    this.glass = voxModel(CELL, set => {
      for (let y = 0; y < HH; y++) for (let x = -HW; x <= HW; x++) { if (!m(x, y) || dist(x, y) < 2) continue; const h = hd(x, y); set(x, y, h, 0xb8d0ff); }
    }, { centre: [0, 9, 0] });
    this.glass.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.material = new THREE.ShaderMaterial({ vertexShader: LIQ_VS, vertexColors: true, transparent: true, depthWrite: false,
      // the glass tint shows only above the blood (over the blood it would wash the red out to pink)
      fragmentShader: `uniform float uLevel; varying vec3 vW; varying vec3 vN; varying vec3 vC; void main(){ if (vW.y < uLevel) discard; gl_FragColor = vec4(0.16, 0.24, 0.5, 0.14); }`,
      uniforms: { uLevel: this.liqMat.uniforms.uLevel } }); });
    const hl = voxModel(CELL, set => { for (let y = 8; y <= 12; y++) set(-6, y, 4, 0xffffff, 1); for (let y = 7; y <= 8; y++) set(-5, y, 4, 0xffffff, 1); set(-4, 13, 4, 0xffffff, 1); }, { centre: [0, 9, 0] });
    hl.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }); });
    this.glass.add(hl); this.body.add(this.glass);
    // ---- cracks: orthogonal zig-zag lines (no diagonals) in two stages
    const crackPaths: Array<Array<[number, number]>> = [
      [[-4, 13], [-4, 11], [-2, 11], [-2, 9], [-1, 9], [-1, 7]],
      [[5, 12], [5, 10], [3, 10], [3, 8], [5, 8], [5, 6], [4, 6]],
      [[-6, 7], [-3, 7], [-3, 5], [-1, 5], [-1, 3]],
      [[1, 13], [1, 12], [3, 12]],
    ];
    for (let s = 0; s < 2; s++) {
      const g = voxModel(CELL, set => {
        for (const path of crackPaths.slice(s * 2, s * 2 + 2)) for (let i = 1; i < path.length; i++) {
          const [x0, y0] = path[i - 1], [x1, y1] = path[i];
          for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (m(x, y)) set(x, y, hd(x, y) + 1, 0xf0f6ff, 1);
        }
      }, { centre: [0, 9, 0] });
      g.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb8ccf0), toneMapped: false }); });
      g.visible = false; g.scale.setScalar(1); this.cracks.push(g); this.body.add(g);
    }
    // ---- armour shield (hung on the lower right)
    const STEEL = 0x8a92a4, STEEL_D = 0x4a5062, RIM = 0xd0d6e2;
    this.shield = voxModel(CELL, set => {
      const rows = ['.########.', '##########', '##########', '##########', '##########', '.########.', '.########.', '..######..', '...####...', '....##....'];
      rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '#') return; const x = c - 5, y = 9 - r, edge = c === 0 || c === 9 || r === 0 || rows[r][c - 1] !== '#' || rows[r][c + 1] !== '#' || (r < 9 && rows[r + 1][c] !== '#');
        set(x, y, 0, STEEL_D); set(x, y, 1, edge ? RIM : STEEL); }));
      for (let y = 2; y <= 8; y++) set(-1, y, 2, STEEL_D), set(0, y, 2, STEEL_D);   // a raised spine
    }, { centre: [0, 5, 1] });
    this.shield.position.set(7.5, -5, 4); this.shield.rotation.set(0, -0.35, 0.12); this.shield.scale.setScalar(0.001); this.root.add(this.shield);
    // ---- barrier: a blue light shell
    this.dome = voxModel(CELL, set => {
      for (let y = -2; y < HH + 3; y++) for (let x = -HW - 2; x <= HW + 2; x++) {
        const inside = (xx: number, yy: number) => { const X = (xx + 0.5) / (HW + 2.5) * 1.2, Y = ((yy + 2.5) / (HH + 4)) * 2.3 - 1.05; return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0; };
        if (!inside(x, y)) continue; const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        if (edge) for (let z = -1; z <= 1; z++) set(x, y, z * 6, 0x6ab8ff, 1); else if ((x + y) % 4 === 0 && y % 2 === 0) set(x, y, 6, 0x6ab8ff, 1);
      }
    }, { centre: [0, 9, 0] });
    this.dome.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) { const mt = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4aa8ff).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); mm.material = mt; this.domeMats.push(mt); } });
    this.dome.visible = false; this.root.add(this.dome);
    void flat;
  }

  /** layout in CSS px: centre and height */
  place(x: number, y: number, sizePx: number) { this.x = x; this.y = y; this.sizePx = sizePx; }
  /** set the values (no animation of its own: use hit() / heal() for the beats) */
  set(s: Partial<FlaskState>) {
    const a0 = this.st.armor, b0 = this.st.barrier; Object.assign(this.st, s);
    if (this.st.armor > a0) { this.shieldPop.kick(14); cue('armor', 0.6); }
    if (this.st.barrier > 0 && b0 <= 0) cue('magic', 0.5);
  }
  /** take a hit: the blood drops, sloshes and splashes; armour / barrier soak first (pass what is left after the rules) */
  hit(dmg: number, s?: Partial<FlaskState>) {
    if (s) this.set(s);
    const k = Math.min(1, 0.35 + dmg / 25);
    this.wave.kick(26 * k); this.rock.kick((Math.random() < 0.5 ? -1 : 1) * 9 * k); this.pop.kick(-8 * k);
    const top = this.L.at(this.x, this.y - this.sizePx * 0.62, 6);
    this.sparks.burst(top, Math.round(10 + 16 * k), this.L.px(260), this.L.px(5), 0xd01a2a, { life: 0.7, grav: this.L.px(900), up: this.L.px(220), k: 1 });
    cue('hurt', 0.4 + k * 0.5);
  }
  heal(s?: Partial<FlaskState>) { if (s) this.set(s); this.wave.kick(10); this.sparks.burst(this.L.at(this.x, this.y - this.sizePx * 0.2, 6), 14, this.L.px(120), this.L.px(5), 0x7aff9a, { life: 0.6, up: this.L.px(140) }); cue('heal', 0.6); }
  /** where the flask sits (CSS px) — fly targets */
  anchor() { return { x: this.x, y: this.y }; }

  update(dt: number) {
    this.time += dt;
    const L = this.L, f = Math.max(0, Math.min(1, this.st.hp / Math.max(1, this.st.maxHp)));
    this.shown += (f - this.shown) * Math.min(1, dt * 6);
    this.ghost = this.ghost < this.shown ? this.shown : this.ghost + (this.shown - this.ghost) * Math.min(1, dt * 1.5);
    const w = this.wave.step(0, dt), rk = this.rock.step(0, dt), pp = this.pop.step(0, dt);
    const sc = L.px(this.sizePx) / 20;   // model is ~20 cells tall (heart 16 + cork)
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(sc * (1 + pp * 0.01));
    this.root.rotation.set(-0.12, 0.28 + Math.sin(this.time * 0.6) * 0.06, rk * 0.012);
    this.root.updateMatrixWorld(true);
    // blood level in world (scene) y: heart cells y 0..15 → model-local −9..+7 → world through the matrix (rotation ignored for y: small)
    const yBot = this.root.localToWorld(V3(0, -9 + 1.2, 0)).y, yTop = this.root.localToWorld(V3(0, -9 + 14.6, 0)).y;
    const u = this.liqMat.uniforms; u.uLevel.value = yBot + (yTop - yBot) * this.shown; u.uAmp.value = Math.min(sc * 1.6, Math.abs(w) * sc * 0.08 + sc * 0.12) * (this.shown > 0.01 ? 1 : 0);
    u.uTime.value = this.time; u.uK.value = 0.55 / sc; u.uS.value = sc;
    // cracks
    const low = f < 0.3 ? 1 : 0, vlow = f < 0.15 ? 1 : 0;
    for (const [i, on] of [low, vlow].entries()) { if (on && !this.crackK[i]) { cue('shatter', 0.4); this.sparks.burst(L.at(this.x, this.y - this.sizePx * 0.1, 8), 10, L.px(160), L.px(4), 0xe8f2ff, { life: 0.4 }); } this.crackK[i] = on; this.cracks[i].visible = !!on; }
    // armour shield
    const sp = this.shieldPop.step(0, dt);
    this.shieldK += ((this.st.armor > 0 ? 1 : 0) - this.shieldK) * Math.min(1, dt * 10);
    this.shield.scale.setScalar(Math.max(0.001, this.shieldK * (1 + sp * 0.02)));
    this.shield.rotation.z = 0.12 + Math.sin(this.time * 2.1) * 0.05;
    // barrier
    this.domeK += ((this.st.barrier > 0 ? 1 : 0) - this.domeK) * Math.min(1, dt * 6);
    this.dome.visible = this.domeK > 0.01; this.dome.scale.setScalar(0.92 + 0.08 * ease.outBack(Math.min(1, this.domeK)));
    for (const mt of this.domeMats) mt.opacity = this.domeK * (0.55 + 0.25 * Math.sin(this.time * 3.4));
    this.sparks.update(dt);
    // digits (full resolution)
    const T = L.text, hpTxt = `${Math.max(0, Math.round(this.st.hp))}`;
    T.set('flask.hp', { text: hpTxt, x: this.x + 2, y: this.y + this.sizePx * 0.02, cell: Math.max(3, Math.round(this.sizePx / 34)), color: f < 0.3 ? '#ffd0c8' : '#fff6e2' });
    T.set('flask.max', { text: `/${this.st.maxHp}`, x: this.x + 2, y: this.y + this.sizePx * 0.2, cell: 2, color: '#e8c8c8' });
    const shp = L.toPx(this.shield.getWorldPosition(V3()));
    T.set('flask.armor', { text: String(this.st.armor), x: shp.x, y: shp.y - 2, cell: 3, color: '#e8f0ff', alpha: this.shieldK, scale: 0.6 + 0.4 * this.shieldK });
    T.set('flask.barrier', { text: this.st.barrier > 0 ? String(this.st.barrier) : '', x: this.x - this.sizePx * 0.5, y: this.y - this.sizePx * 0.52, cell: 3, color: '#bfe4ff', alpha: this.domeK });
  }
}
void animP; void R;
