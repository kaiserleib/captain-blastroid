import { ENEMIES } from '../../content/enemies';
import { flags } from '../../debug/flags';
import '../../gfx/reference.sprites';
import { registerEnemyDefs } from '../../sim/spawn';
import type { DrawLayer, System } from '../../sim/world';
import { enemiesLayer, enemyShotsLayer } from './draw';
import './enemies.sprites';
import { updateEnemies } from './enemySystem';
import { enemySandboxLayer, enemySandboxSystem } from './sandbox';

registerEnemyDefs(ENEMIES);

export type { BehaviorParams, EnemyDef, EnemyFireDef, PatternDef } from '../../content/enemies';
export { computeAvoidance, type Steer } from './avoidance';
export { runBehavior } from './behaviors';
export { ENEMY_SPRITE_IDS } from './enemies.sprites';
export { enemyDef, updateEnemy, updateEnemies } from './enemySystem';
export {
  FORMATION_ENTRY_Y,
  formationOffset,
  spawnFormation,
  type FormationSpec,
  type FormationType,
} from './formations';
export {
  aimAt,
  aimed,
  burst,
  canFire,
  fan,
  firePattern,
  muzzleY,
  ring,
  SHOT_LARGE,
  SHOT_SMALL,
  shotStyle,
  type ShotStyle,
} from './patterns';

/** Slot: after weapons, before boss. Also drives `?sandbox` keys 1–6 and R. */
export const enemySystem: System = {
  name: 'enemies',
  update(w, dt) {
    if (flags.sandbox) enemySandboxSystem.update(w, dt);
    updateEnemies(w, dt);
  },
};

/** enemies z 40, enemy shots z 50 (+ sandbox rock outlines z 29 under `?sandbox`). */
export const enemyLayers: DrawLayer[] = flags.sandbox
  ? [enemiesLayer, enemyShotsLayer, enemySandboxLayer]
  : [enemiesLayer, enemyShotsLayer];
