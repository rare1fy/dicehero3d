// Post pipeline: scene → HDR target (+ depth) → bloom (added in place) → final pass to screen:
// depth-edge ink outlines, colour grade, vignette, impact flash / chromatic split, ACES tone map, sRGB.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS = `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear, uFar;
uniform float uInk, uExposure, uSat, uVig, uFlash, uSplit, uTime, uDesat; uniform vec3 uFlashCol, uLift, uGain, uInkCol;
varying vec2 vUv;
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 px = 1.0 / uRes;
  // chromatic split on big impacts (radial)
  vec2 dir = (vUv - 0.5) * uSplit * 0.012;
  vec3 col = vec3(texture2D(tColor, vUv + dir).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - dir).b);
  // ink outlines from linear depth discontinuities (relative, so far things get thin lines and near things bold ones)
  float d0 = lin(texture2D(tDepth, vUv).r);
  float w = 1.0;
  float dl = lin(texture2D(tDepth, vUv - vec2(px.x*w,0.0)).r), dr = lin(texture2D(tDepth, vUv + vec2(px.x*w,0.0)).r);
  float du = lin(texture2D(tDepth, vUv + vec2(0.0,px.y*w)).r), dd = lin(texture2D(tDepth, vUv - vec2(0.0,px.y*w)).r);
  float edge = max(max(abs(dl - d0), abs(dr - d0)), max(abs(du - d0), abs(dd - d0))) / max(d0, 0.001);
  float ink = smoothstep(0.03, 0.09, edge) * uInk * (1.0 - smoothstep(30.0, 60.0, d0));
  col = mix(col, uInkCol * (0.6 + 0.4 * col), ink);
  // grade
  col *= uExposure;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat * (1.0 - uDesat));
  col = aces(col);
  col = col * uGain + uLift * (1.0 - col);
  // vignette
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.75;
  col *= 1.0 - uVig * smoothstep(0.25, 0.85, length(q));
  // flash
  col = mix(col, uFlashCol, uFlash);
  col = toSRGB(clamp(col, 0.0, 1.0));
  col += (hash(vUv * uRes + uTime) - 0.5) / 255.0;   // dither against banding
  gl_FragColor = vec4(col, 1.0);
}`;

export const GRADE = {
  ink: 0.85, exposure: 1.05, sat: 1.12, vig: 0.55, desat: 0,
  lift: new THREE.Color(0.02, 0.015, 0.05), gain: new THREE.Color(1.0, 0.98, 1.02), inkCol: new THREE.Color(0.05, 0.03, 0.08),
  flash: 0, flashCol: new THREE.Color(1, 1, 1), split: 0,
  bloomStrength: 0.85, bloomRadius: 0.55, bloomThreshold: 0.85,
};

export class Post {
  rt: THREE.WebGLRenderTarget; bloom: UnrealBloomPass; mat: THREE.ShaderMaterial; quad: THREE.Mesh; cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs = new THREE.Scene();
  constructor(private renderer: THREE.WebGLRenderer) {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4), samples: 0 });
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), GRADE.bloomStrength, GRADE.bloomRadius, GRADE.bloomThreshold);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(4, 4) }, uNear: { value: 0.1 }, uFar: { value: 400 },
        uInk: { value: 1 }, uExposure: { value: 1 }, uSat: { value: 1 }, uVig: { value: 0.5 }, uFlash: { value: 0 }, uSplit: { value: 0 }, uTime: { value: 0 }, uDesat: { value: 0 },
        uFlashCol: { value: new THREE.Color() }, uLift: { value: new THREE.Color() }, uGain: { value: new THREE.Color(1, 1, 1) }, uInkCol: { value: new THREE.Color() } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false; this.qs.add(this.quad);
  }
  setSize(w: number, h: number, dpr: number) {
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    this.rt.setSize(W, H); this.bloom.setSize(Math.round(W / 2), Math.round(H / 2)); (this.mat.uniforms.uRes.value as THREE.Vector2).set(W, H);
  }
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, time: number) {
    const r = this.renderer, u = this.mat.uniforms;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    this.bloom.strength = GRADE.bloomStrength; this.bloom.radius = GRADE.bloomRadius; this.bloom.threshold = GRADE.bloomThreshold;
    this.bloom.render(r, null as unknown as THREE.WebGLRenderTarget, this.rt, 0, false);
    u.uNear.value = camera.near; u.uFar.value = camera.far; u.uInk.value = GRADE.ink; u.uExposure.value = GRADE.exposure; u.uSat.value = GRADE.sat; u.uVig.value = GRADE.vig;
    u.uFlash.value = GRADE.flash; u.uSplit.value = GRADE.split; u.uTime.value = time % 100; u.uDesat.value = GRADE.desat;
    (u.uFlashCol.value as THREE.Color).copy(GRADE.flashCol); (u.uLift.value as THREE.Color).copy(GRADE.lift); (u.uGain.value as THREE.Color).copy(GRADE.gain); (u.uInkCol.value as THREE.Color).copy(GRADE.inkCol);
    r.setRenderTarget(null); r.render(this.qs, this.cam);
  }
}
