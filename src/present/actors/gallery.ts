// ?view=actors — a turntable of the three characters on the arena, cycling their actions (for screenshots and tuning).
import { V3, onUpdate } from '../engine/world';
import { CAM } from '../engine/gfx';
import { clock } from '../engine/clock';
import { Hero } from './hero';
import { Lich } from './lich';
import { Ghoul } from './ghoul';

export function actorGallery(shot: string | null) {
  const hero = new Hero(), lich = new Lich(), ghoul = new Ghoul();
  hero.place(V3(-1.6, 0, 1.2), 0.35); lich.place(V3(0.6, 0.55, -5.4), 0.1); ghoul.place(V3(1.8, 0, 1.0), -0.4);
  const all = [hero, lich, ghoul];
  onUpdate(dt => all.forEach(a => a.update(dt)));
  const frames: Record<string, { base: [number, number, number]; look: [number, number, number]; fov: number }> = {
    all: { base: [0, 5.5, 11], look: [0, 1.6, -1.5], fov: 40 },
    hero: { base: [-0.4, 2.4, 5.0], look: [-1.6, 1.1, 1.2], fov: 38 },
    lich: { base: [0.6, 3.2, 1.2], look: [0.6, 2.6, -5.4], fov: 40 },
    ghoul: { base: [2.6, 1.8, 4.2], look: [1.8, 0.8, 1.0], fov: 38 },
  };
  const f = frames[shot || 'all'] || frames.all;
  CAM.base.set(...f.base); CAM.look.set(...f.look); CAM.fov = f.fov;
  let next = 1.5, i = 0;
  onUpdate(() => {
    if (clock.time < next) return; next = clock.time + 1.8; i++;
    const h = ['attack', 'spin', 'hurt', 'block', 'cheer'][i % 5];
    if (h === 'attack') hero.attack(1.2); else if (h === 'spin') hero.spin(0.6); else if (h === 'hurt') hero.hurt(1); else if (h === 'block') hero.block(); else hero.cheer();
    const l = ['cast', 'summon', 'hurt', 'roar', 'shield'][i % 5];
    if (l === 'cast') lich.cast(); else if (l === 'summon') lich.summon(); else if (l === 'hurt') lich.hurt(1); else if (l === 'roar') { lich.roar(); lich.robeFire = 1; } else lich.shield();
    if (i % 2) ghoul.lunge(1.0); else ghoul.hurt(1);
  });
  return { hero, lich, ghoul };
}
