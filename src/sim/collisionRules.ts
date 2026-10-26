import { getAnomalyContact } from './hooks';
import { damageAsteroid, damageEnemy, damagePlayer, isDestructible } from './damage';
import { NO_HIT } from './spawn';
import type { Anomaly, Asteroid, Bullet, Enemy } from './types';
import type { World } from './world';

// The collision matrix, one function per pair. The broad phase in
// collision.ts calls these only for overlapping, active pairs. Each shot
// rule returns true when the shot was consumed.

/** Damage an enemy takes from ramming the player. */
export const RAM_DAMAGE = 5;

function alreadyHit(shot: Bullet, id: number): boolean {
  const ids = shot.hitIds;
  for (let i = 0; i < ids.length; i++) if (ids[i] === id) return true;
  return false;
}

/** hitIds keeps its length across respawns; blank slots hold NO_HIT. */
function recordHit(ids: number[], id: number): void {
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === NO_HIT) {
      ids[i] = id;
      return;
    }
  }
  ids.push(id);
}

/** Records the hit and spends one pierce; the shot dies when pierce drops below 0. */
function spendPierce(w: World, shot: Bullet, id: number): boolean {
  recordHit(shot.hitIds, id);
  shot.pierce--;
  if (shot.pierce < 0) {
    w.playerShots.release(shot);
    return true;
  }
  return false;
}

/** playerShot × enemy: damage, pierce through, never hit the same enemy twice. */
export function playerShotVsEnemy(w: World, shot: Bullet, e: Enemy): boolean {
  if (alreadyHit(shot, e.id)) return false;
  damageEnemy(w, e, shot.damage, 'player');
  return spendPierce(w, shot, e.id);
}

/** playerShot × asteroid: destructible rocks take damage (pierce applies); others absorb. */
export function playerShotVsAsteroid(w: World, shot: Bullet, a: Asteroid): boolean {
  if (!isDestructible(a)) {
    w.playerShots.release(shot);
    return true;
  }
  if (alreadyHit(shot, a.id)) return false;
  damageAsteroid(w, a, shot.damage, true);
  return spendPierce(w, shot, a.id);
}

/** playerShot × anomaly: absorbed. */
export function playerShotVsAnomaly(w: World, shot: Bullet, _a: Anomaly): boolean {
  w.playerShots.release(shot);
  return true;
}

/** enemyShot × player: damage (invulnerability respected) and the shot is spent either way. */
export function enemyShotVsPlayer(w: World, shot: Bullet): boolean {
  damagePlayer(w, shot.damage);
  w.enemyShots.release(shot);
  return true;
}

/** enemyShot × asteroid / anomaly: absorbed, the obstacle is untouched (cover). */
export function enemyShotVsObstacle(w: World, shot: Bullet): boolean {
  w.enemyShots.release(shot);
  return true;
}

/**
 * enemy × asteroid: both take the other's current HP (min 1), credited to
 * nobody. Bosses are immune; a rock moving into a boss just breaks, while a
 * rock moving away (flung from the hopper) passes through.
 */
export function enemyVsAsteroid(w: World, e: Enemy, a: Asteroid): void {
  if (e.isBoss) {
    const closing = (a.vx - e.vx) * (e.x - a.x) + (a.vy - e.vy) * (e.y - a.y) > 0;
    if (closing) damageAsteroid(w, a, a.hp, false);
    return;
  }
  const toEnemy = isDestructible(a) ? Math.max(1, a.hp) : e.hp;
  const toAsteroid = Math.max(1, e.hp);
  damageEnemy(w, e, toEnemy, 'asteroid');
  damageAsteroid(w, a, toAsteroid, false);
}

/** player × enemy: player loses contactDamage segments; non-boss enemies take RAM_DAMAGE. */
export function playerVsEnemy(w: World, e: Enemy): void {
  if (damagePlayer(w, e.contactDamage) && !e.isBoss) damageEnemy(w, e, RAM_DAMAGE, 'player');
}

/** player × asteroid: one segment; a destructible rock is destroyed. */
export function playerVsAsteroid(w: World, a: Asteroid): void {
  if (damagePlayer(w, 1) && isDestructible(a)) damageAsteroid(w, a, a.hp, true);
}

/** player × anomaly: per-kind behavior registered by T10. Called every overlapping tick. */
export function playerVsAnomaly(w: World, a: Anomaly): void {
  const fn = getAnomalyContact(a.kind);
  if (fn !== undefined) fn(w, a, w.player);
}
