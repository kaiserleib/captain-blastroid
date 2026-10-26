import type { Pool } from '../engine/pool';
import { formationMemberGone } from './damage';
import { isAsteroidHeld } from './hooks';
import type { Anomaly, Asteroid, Body, Bullet, Enemy, Pickup } from './types';
import { WORLD_H, WORLD_W, type System, type World } from './world';

export const OFFSCREEN_MARGIN = 16;
/** Bodies above this y are culled only while moving up. */
export const TOP_CULL_Y = -64;

/**
 * Fully off-screen: past the bottom or sides by margin + r, or above
 * TOP_CULL_Y while heading up (entries from the top are never culled).
 */
export function offscreen(x: number, y: number, r: number, vy: number): boolean {
  const m = OFFSCREEN_MARGIN + r;
  return y > WORLD_H + m || x < -m || x > WORLD_W + m || (vy < 0 && y < TOP_CULL_Y);
}

export function isOffscreen(b: Body): boolean {
  return offscreen(b.x, b.y, b.r, b.vy);
}

// One loop per entity type, so every property read sees a single shape
// (a shared generic loop goes megamorphic and boxes each double it reads).

function cullShots(pool: Pool<Bullet>): void {
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Bullet;
    if (b.active && offscreen(b.x, b.y, b.r, b.vy)) pool.release(b);
  }
}

function cullAsteroids(w: World, dt: number): void {
  const pool = w.asteroids;
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Asteroid;
    if (!b.active) continue;
    // Towed rocks are hauled in from anywhere (boss rocks start above the top edge).
    if (offscreen(b.x, b.y, b.r, b.vy) && !isAsteroidHeld(w, b)) pool.release(b);
    else if (b.flashT > 0) b.flashT = b.flashT > dt ? b.flashT - dt : 0;
  }
}

function cullEnemies(w: World, dt: number): void {
  const pool = w.enemies;
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (!e.active) continue;
    // Bosses manage their own lifetime (they enter from far above).
    if (!e.isBoss && offscreen(e.x, e.y, e.r, e.vy)) {
      formationMemberGone(w, e, false);
      pool.release(e);
    } else if (e.flashT > 0) e.flashT = e.flashT > dt ? e.flashT - dt : 0;
  }
}

function cullAnomalies(pool: Pool<Anomaly>): void {
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Anomaly;
    if (b.active && offscreen(b.x, b.y, b.r, b.vy)) pool.release(b);
  }
}

function cullPickups(pool: Pool<Pickup>): void {
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Pickup;
    if (b.active && offscreen(b.x, b.y, b.r, b.vy)) pool.release(b);
  }
}

/** Releases off-screen entities, decays hit flashes, then compacts every pool. */
export function cleanup(w: World, dt: number): void {
  cullShots(w.playerShots);
  cullShots(w.enemyShots);
  cullEnemies(w, dt);
  cullAsteroids(w, dt);
  cullAnomalies(w.anomalies);
  cullPickups(w.pickups);

  w.playerShots.compact();
  w.enemyShots.compact();
  w.enemies.compact();
  w.asteroids.compact();
  w.anomalies.compact();
  w.pickups.compact();
}

export const cleanupSystem: System = { name: 'cleanup', update: cleanup };
