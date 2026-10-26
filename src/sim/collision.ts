import {
  enemyShotVsObstacle,
  enemyShotVsPlayer,
  enemyVsAsteroid,
  playerShotVsAnomaly,
  playerShotVsAsteroid,
  playerShotVsEnemy,
  playerVsAnomaly,
  playerVsAsteroid,
  playerVsEnemy,
} from './collisionRules';
import { tickChain } from './damage';
import { getShotBlockers } from './hooks';
import { rebuildSpatialHash, type SpatialHash } from './spatialHash';
import { Layer, type Anomaly, type Asteroid, type Body, type Bullet, type Enemy } from './types';
import type { System, World } from './world';

// Broad phase: rebuild the hash, then every shot / enemy / the player queries
// it. Callbacks are hoisted and read context from module state so the tick
// allocates nothing.

const PLAYER_SHOT_MASK = Layer.Enemy | Layer.Asteroid | Layer.Anomaly;
const ENEMY_SHOT_MASK = Layer.Asteroid | Layer.Anomaly;
const PLAYER_MASK = Layer.Enemy | Layer.Asteroid | Layer.Anomaly;

let cw: World;
let curShot: Bullet;
let curEnemy: Enemy;

function onPlayerShot(b: Body, layer: number): boolean {
  if (layer === Layer.Enemy) return playerShotVsEnemy(cw, curShot, b as Enemy);
  if (layer === Layer.Asteroid) return playerShotVsAsteroid(cw, curShot, b as Asteroid);
  return playerShotVsAnomaly(cw, curShot, b as Anomaly);
}

function onEnemyShot(): boolean {
  return enemyShotVsObstacle(cw, curShot);
}

function onEnemyAsteroid(b: Body): boolean {
  enemyVsAsteroid(cw, curEnemy, b as Asteroid);
  return !curEnemy.active;
}

function onPlayer(b: Body, layer: number): boolean {
  if (layer === Layer.Enemy) playerVsEnemy(cw, b as Enemy);
  else if (layer === Layer.Asteroid) playerVsAsteroid(cw, b as Asteroid);
  else playerVsAnomaly(cw, b as Anomaly);
  return !cw.player.alive;
}

function playerShots(w: World, h: SpatialHash): void {
  const items = w.playerShots.items;
  const n = w.playerShots.count;
  for (let i = 0; i < n; i++) {
    const s = items[i] as Bullet;
    if (!s.active) continue;
    curShot = s;
    h.qx = s.x;
    h.qy = s.y;
    h.qr = s.r;
    h.queryAt(PLAYER_SHOT_MASK, onPlayerShot);
  }
}

function enemyShots(w: World, h: SpatialHash): void {
  const blockers = getShotBlockers();
  const nb = blockers.length;
  const p = w.player;
  const items = w.enemyShots.items;
  const n = w.enemyShots.count;
  for (let i = 0; i < n; i++) {
    const s = items[i] as Bullet;
    if (!s.active) continue;
    let blocked = false;
    for (let j = 0; j < nb && !blocked; j++) {
      blocked = (blockers[j] as (typeof blockers)[number])(w, s);
    }
    if (blocked) {
      w.enemyShots.release(s);
      continue;
    }
    curShot = s;
    // Obstacles first: a rock between bullet and ship is cover.
    h.qx = s.x;
    h.qy = s.y;
    h.qr = s.r;
    if (h.queryAt(ENEMY_SHOT_MASK, onEnemyShot)) continue;
    if (p.alive) {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const rr = p.r + s.r;
      if (dx * dx + dy * dy < rr * rr) enemyShotVsPlayer(w, s);
    }
  }
}

function enemiesVsAsteroids(w: World, h: SpatialHash): void {
  const items = w.enemies.items;
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (!e.active) continue;
    curEnemy = e;
    h.qx = e.x;
    h.qy = e.y;
    h.qr = e.r;
    h.queryAt(Layer.Asteroid, onEnemyAsteroid);
  }
}

export function collide(w: World, dt: number): void {
  cw = w;
  tickChain(w, dt);
  const h = rebuildSpatialHash(w);
  playerShots(w, h);
  enemyShots(w, h);
  enemiesVsAsteroids(w, h);
  const p = w.player;
  if (p.alive) h.query(p.x, p.y, p.r, PLAYER_MASK, onPlayer);
}

export const collisionSystem: System = { name: 'collision', update: collide };
