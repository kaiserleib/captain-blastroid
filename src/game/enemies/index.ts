import { ENEMIES } from '../../content/enemies';
import { flags } from '../../debug/flags';
import '../../gfx/reference.sprites';
import type { DrawLayer, System } from '../../sim/world';
import { enemiesLayer, enemyShotsLayer } from './draw';
import './enemies.sprites';
import { updateEnemies } from './enemySystem';
import { registerRoster } from './roster';
import { enemySandboxLayer, enemySandboxSystem } from './sandbox';

// Level 1's roster; later sectors reuse it, so the level's enemyHpMul applies.
registerRoster(ENEMIES, { hpScaled: true });

export type {
  BehaviorParams,
  CustomParams,
  EnemyDef,
  EnemyFireDef,
  PatternDef,
} from '../../content/enemies';
export { computeAvoidance, type Steer } from './avoidance';
export { registerBehavior, runBehavior, type BehaviorFn } from './behaviors';
export {
  enemyDrawFn,
  enemyHpMul,
  registerEnemyDraw,
  registerRoster,
  rosterDef,
  rosterIds,
  scaleHp,
  setEnemyHpMul,
  type EnemyDrawFn,
  type RosterOptions,
} from './roster';
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
  emitEnemyShotSfx,
  enemyShotSpeedMul,
  fan,
  fireAt,
  firePattern,
  muzzleY,
  ring,
  setEnemyShotSpeedMul,
  SHOT_LARGE,
  SHOT_SMALL,
  shootDir,
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
