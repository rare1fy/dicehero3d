// #actors — a turntable of the three characters on the arena, cycling their actions (for screenshots and tuning).
import { V3, onUpdate } from '../engine/world';
import { shot as dirShot, staticShot } from '../director';
import { clock } from '../engine/clock';
import type { Cast } from './cast';

export function actorGallery(shot: string | null, cast: Cast) {
  const hero = cast.hero(), lich = cast.lich(), ghoul = cast.ghoul(0), ghoul2 = cast.ghoul(1);
  hero.place(V3(-1.6, 0, 1.2), 0.35); lich.place(V3(0.6, 0.55, -5.4), 0.1); ghoul.place(V3(1.8, 0, 1.0), -0.4); ghoul2.place(V3(3.4, 0, -0.6), -0.6);
  if (shot === 'hero') { hero.place(V3(0, 0, 1.6), 0); lich.root.visible = false; ghoul.root.visible = false; ghoul2.root.visible = false; }
  const all = [hero, lich, ghoul, ghoul2];
  onUpdate(dt => { if (shot === 'hero') hero.yaw = Math.sin(clock.time * 0.35) * 1.2; all.forEach(a => a.update(dt)); });
  const frames: Record<string, { base: [number, number, number]; look: [number, number, number]; fov: number }> = {
    all: { base: [0.5, 5.5, 11], look: [0.5, 1.6, -1.5], fov: 40 },
    hero: { base: [0, 2.0, 7.4], look: [0, 1.15, 1.6], fov: 40 },
    lich: { base: [0.6, 3.2, 1.2], look: [0.6, 2.6, -5.4], fov: 40 },
    ghoul: { base: [3.2, 1.8, 4.6], look: [2.4, 0.8, 0.4], fov: 38 },
  };
  const f = frames[shot || 'all'] || frames.all;
  dirShot('gallery', staticShot(V3(...f.base), V3(...f.look), f.fov), { cut: true });
  let next = 1.5, i = 0;
  onUpdate(() => {
    if (clock.time < next) return; next = clock.time + 2.2; i++;
    const h = ['attack', 'spin', 'hurt', 'block', 'cheer'][i % 5];
    if (h === 'attack') hero.attack(1.2); else if (h === 'spin') hero.spin(0.6); else if (h === 'hurt') hero.hurt(1); else if (h === 'block') hero.block(); else hero.cheer();
    const l = ['cast', 'summon', 'hurt', 'roar', 'shield'][i % 5];
    if (l === 'cast') lich.cast(); else if (l === 'summon') lich.summon(); else if (l === 'hurt') lich.hurt(1); else if (l === 'roar') { lich.roar(); lich.robeFire = 1; } else lich.shield();
    if (i % 2) ghoul.lunge(1.0); else ghoul.hurt(1);
    if (i % 3 === 0) ghoul2.rise?.(); else ghoul2.shriek();
  });
  return { hero, lich, ghoul, ghoul2 };
}
