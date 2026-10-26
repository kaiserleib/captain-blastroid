import { AVOIDANCE, ENEMIES, ENEMY_FAIRNESS, type EnemyDef } from '../../content/enemies';
import type { Enemy } from '../../sim/types';
import type { System, World } from '../../sim/world';
import { computeAvoidance, type Steer } from './avoidance';
import { runBehavior } from './behaviors';
import { tickFormationSpawns } from './formations';
import { canFire, firePattern, shotStyle, tickBursts } from './patterns';

const steer: Steer = { x: 0, y: 0 };

/** Roster def for an enemy, or undefined for ones T11 doesn't drive (boss parts, `dummy`). */
export function enemyDef(e: Enemy): EnemyDef | undefined {
  return ENEMIES[e.defId];
}

function updateFire(w: World, e: Enemy, def: EnemyDef, dt: number): void {
  const f = def.fire;
  if (f === null) return;
  if (e.fireT > 0) e.fireT -= dt;
  if (e.fireT > 0 || !canFire(w, e)) return;
  firePattern(w, e, f.pattern, shotStyle(f.bullet));
  e.fireT = f.interval > 0 ? f.interval : Infinity;
}

/**
 * One enemy tick: behavior → (smart) avoidance blend → integrate → age →
 * fire. Dumb enemies take the behavior's velocity directly; smart ones ease
 * toward desired + steer, which also eases them back once clear.
 */
export function updateEnemy(w: World, e: Enemy, def: EnemyDef, dt: number): void {
  if (e.t === 0 && e.fireT === 0 && def.fire !== null) {
    e.fireT = Math.max(def.fire.firstDelay, ENEMY_FAIRNESS.minAge);
  }
  const ox = e.vx;
  const oy = e.vy;
  runBehavior(w, e, def.behavior, dt);
  if (e.avoidsAsteroids) {
    computeAvoidance(w, e, e.vx, e.vy, steer, ox, oy);
    const k = Math.min(1, AVOIDANCE.blend * dt);
    e.vx = ox + (e.vx + steer.x - ox) * k;
    e.vy = oy + (e.vy + steer.y - oy) * k;
  }
  e.prevX = e.x;
  e.prevY = e.y;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.t += dt;
  updateFire(w, e, def, dt);
}

export function updateEnemies(w: World, dt: number): void {
  tickFormationSpawns(w, dt);
  tickBursts(w, dt);
  const items = w.enemies.items;
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (!e.active) continue;
    const def = ENEMIES[e.defId];
    if (def === undefined) continue;
    updateEnemy(w, e, def, dt);
  }
}

export const enemySystem: System = { name: 'enemies', update: updateEnemies };
