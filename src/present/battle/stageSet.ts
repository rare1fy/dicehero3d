// The neutral battle set (placeholder until the art directions): ground, lights, fog, a few standing stones for depth, and the
// layout every module agrees on — where the hero stands, where enemies stand at each distance, the dice landing field, the camera.
import * as THREE from 'three';
import { scene, view, V3, canvasTex } from '../engine/world';
import { CAM } from '../engine/gfx';
import { FIELD } from '../dice/throw';

export const HERO_HOME = V3(0, 0, 4.9);
export const LICH_HOME = V3(0, 0, -5.4);
export const THROW_FROM = V3(0.6, 1.8, 4.0);
/** Ghoul ground position for a lane and a distance (2 = back line, 0 = in your face). */
export const GHOUL_LANES = [-2.6, 2.6, -1.4, 1.4];
export const ghoulPos = (lane: number, distance: number) => V3(GHOUL_LANES[lane % GHOUL_LANES.length], 0, -3.8 + (2 - distance) * 1.6);
/** Where dice go when they leave the hand (the floating discard queue comes later). */
export const DISCARD_AT = V3(3.0, 1.4, 4.6);
export const BAG_AT = V3(-3.0, 1.4, 4.6);

export function buildSet() {
  Object.assign(FIELD, { x0: -2.4, x1: 2.4, z0: -0.6, z1: 2.9 });
  scene.background = new THREE.Color(0x14121a);
  scene.fog = new THREE.Fog(0x14121a, 16, 34);
  scene.add(new THREE.HemisphereLight(0x8a90b8, 0x2a1e16, 1.1));
  const sun = new THREE.DirectionalLight(0xffe0bc, 2.4); sun.position.set(-4, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sun.shadow.bias = -0.0008;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7ad8c0, 1.0); rim.position.set(3, 4, -8); scene.add(rim);
  const groundTex = canvasTex(256, 256, g => {
    g.fillStyle = '#3a3128'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,210,0.05)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6); }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // standing stones framing the arena (depth cues)
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.9 });
  for (const [x, z, h] of [[-5.2, -5.5, 3.2], [5.0, -6.2, 4.0], [-6.4, -1.0, 2.2], [6.2, -0.4, 2.6], [-5.8, 3.6, 1.6], [5.9, 4.2, 1.8], [-2.8, -8.5, 3.6], [3.4, -9.0, 2.8]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random() * 0.6, h, 0.9 + Math.random() * 0.5), stone);
    m.position.set(x, h / 2, z); m.rotation.y = Math.random() * 3; m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
}

/** The battle camera: frames the whole front so dice stay readable on a phone in portrait. */
export function battleCamera() {
  // same vertical framing at every aspect: on a PC the phone-width column is the main picture and the set extends to the sides
  void view;
  CAM.base.set(0, 19, 12.8);
  CAM.look.set(0, 0, 0.1);
  CAM.fov = 34;
}
