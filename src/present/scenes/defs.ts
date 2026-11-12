// Chapter 1 · 幽暗森林 — the scene set. Ten normal-fight scenes drawn at random (no repeats in a run; elites draw here too), four
// fixed boss scenes, three node scenes. Outdoor, indoor, dungeon and cave, all roofless. Battle staging is the same everywhere:
// the centre (PLAY) stays flat and clear; dressing lives on the sides and at the back; only low props in front.
// Each group of scenes lives in its own file (s_forest, s_village, s_under, s_wild); this file only lists them.
import { type SceneDef } from './stage';
import { trail, lumber, camp, merchant, shrine } from './s_forest';
import { village, cottage, chapel, covenNest } from './s_village';
import { catacomb, cells, spiderCave, grotto, rootDeep } from './s_under';
import { swamp, lichAltar, ancientGrove } from './s_wild';

export const SCENES: SceneDef[] = [trail, lumber, village, cottage, chapel, catacomb, cells, spiderCave, grotto, swamp, lichAltar, rootDeep, covenNest, ancientGrove, camp, merchant, shrine];
export const NORMAL_POOL = SCENES.filter(s => s.group === '普通');
