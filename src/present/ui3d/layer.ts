// The UI-layer 3D scene: its own scene, lights and perspective camera, drawn over the world through the same pixel art buffer
// (look/post.ts renderUi3D). Everything here is placed in CSS px (top-left origin) on the z = 0 plane; `upp` converts px to scene
// units. The perspective is real, so models away from the centre show their sides (the "透视立体感" of the stone buttons).
// Also the hand-over between the UI layer and the world: a UI model at screen px (x, y) of size S px ↔ a world pose on the main
// camera's ray through that pixel at distance d, scaled so it covers the same S px (uiToWorld / worldToUi).
import * as THREE from 'three';
import { camera, view, V3 } from '../engine/world';
import { setUi3DLayer, type Ui3DLayer } from '../look/pixel';
import { UiText } from './pixfont';

const CAM_Z = 40, FOV = 24;

export class UiLayer implements Ui3DLayer {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 1, 200);
  on = true;
  text = new UiText();
  w = 1; h = 1; dpr = 1;
  /** scene units per CSS px on the z = 0 plane */
  upp = 0.01;
  key: THREE.DirectionalLight; fill: THREE.DirectionalLight; hemi: THREE.HemisphereLight;
  constructor() {
    this.camera.position.set(0, 0, CAM_Z);
    this.hemi = new THREE.HemisphereLight(0xd8d0ff, 0x30202a, 1.5); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffe2b8, 2.6); this.key.position.set(-6, 10, 14); this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0x7aa0ff, 0.9); this.fill.position.set(8, -4, 6); this.scene.add(this.fill);
    setUi3DLayer(this);
  }
  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr; this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
    this.upp = (2 * CAM_Z * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, h);
    this.text.resize(w, h, dpr);
  }
  /** CSS px → scene point at depth z (z toward the camera; the point projects back onto the same px) */
  at(x: number, y: number, z = 0, out = V3()) {
    const k = (CAM_Z - z) / CAM_Z;
    return out.set((x - this.w / 2) * this.upp * k, (this.h / 2 - y) * this.upp * k, z);
  }
  /** scene point → CSS px */
  toPx(p: THREE.Vector3) { const v = p.clone().project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, z: v.z }; }
  /** px size at depth z → scene units */
  px(n: number, z = 0) { return n * this.upp * (CAM_Z - z) / CAM_Z; }
  /** draw the full-resolution text (call after the 3D frame) */
  renderText(r: THREE.WebGLRenderer) { if (this.on) this.text.render(r); }
  dispose() { setUi3DLayer(null); }
}

// ---------------------------------------------------------------- UI ↔ world hand-over
/** The world pose that covers screen px (x, y) with an object of `sizePx` whose model size is `modelSize` (world units at scale 1). */
export function uiToWorld(x: number, y: number, sizePx: number, modelSize: number, dist = 6) {
  const ndc = V3((x / view.w) * 2 - 1, -(y / view.h) * 2 + 1, 0.5).unproject(camera), dir = ndc.sub(camera.position).normalize();
  const pos = camera.position.clone().addScaledVector(dir, dist);
  // distance along the view axis (perspective size depends on depth, not on the ray length)
  const fwd = V3(0, 0, -1).applyQuaternion(camera.quaternion), depth = dist * dir.dot(fwd);
  const worldPerPx = (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, view.h);
  return { pos, scale: (sizePx * worldPerPx) / modelSize };
}
/** World point → CSS px of the main view (z > 1 = behind the camera). */
export function worldToUi(p: THREE.Vector3) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * view.w, y: (1 - v.y) / 2 * view.h, z: v.z }; }
/** The world point under screen px (x, y) on the horizontal plane y = h (null if the ray misses it), and world units per px there. */
export function uiRayPlane(x: number, y: number, h: number) {
  const ndc = V3((x / view.w) * 2 - 1, -(y / view.h) * 2 + 1, 0.5).unproject(camera), dir = ndc.sub(camera.position).normalize();
  if (Math.abs(dir.y) < 1e-4) return null;
  const t = (h - camera.position.y) / dir.y; if (t <= 0) return null;
  const pos = camera.position.clone().addScaledVector(dir, t);
  return { pos, worldPerPx: worldPerPxAt(pos) };
}
/** World size of `sizePx` at world point p (for scaling a world object to cover a UI px size). */
export function worldPerPxAt(p: THREE.Vector3) {
  const fwd = V3(0, 0, -1).applyQuaternion(camera.quaternion), depth = p.clone().sub(camera.position).dot(fwd);
  return (2 * Math.max(0.01, depth) * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, view.h);
}
/** UI-layer orientation → the world orientation that looks the same on screen (the UI camera has identity rotation). */
export function uiQuatToWorld(q: THREE.Quaternion) { return camera.quaternion.clone().multiply(q); }
export function worldQuatToUi(q: THREE.Quaternion) { return camera.quaternion.clone().invert().multiply(q); }
