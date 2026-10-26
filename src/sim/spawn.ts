import { getDef } from '../content';
import type { Anomaly, Asteroid, Bullet, Enemy, EntityId, Pickup, PickupKind } from './types';
import type { World } from './world';

// Spawn helpers reset EVERY field: pooled objects come back with stale state.
// Init objects are read, never kept, so hot callers can reuse one scratch init.

/**
 * The fields the sim core reads from an enemy definition. T11's
 * `content/enemies.ts` defs are a superset; register them with
 * `registerEnemyDefs` so `spawnEnemy` and kill scoring can find them.
 */
export interface SimEnemyDef {
  hp: number;
  r: number;
  /** Base score per kill, before the chain multiplier. */
  score?: number;
  avoidsAsteroids?: boolean;
  /** Shield segments the player loses on contact. Default 1. */
  contactDamage?: number;
  isBoss?: boolean;
}

export const FALLBACK_ENEMY_ID = 'dummy';
export const FALLBACK_ENEMY_DEF: Readonly<SimEnemyDef> = Object.freeze({
  hp: 1,
  r: 6,
  score: 10,
  avoidsAsteroids: false,
  contactDamage: 1,
  isBoss: false,
});

const enemyDefs: Record<string, SimEnemyDef> = { [FALLBACK_ENEMY_ID]: FALLBACK_ENEMY_DEF };

/** Adds (or replaces) enemy definitions. Call once at module load. */
export function registerEnemyDefs(table: Readonly<Record<string, SimEnemyDef>>): void {
  Object.assign(enemyDefs, table);
}

export function getEnemyDef(id: string): SimEnemyDef {
  return getDef(enemyDefs, id, 'enemy');
}

export interface ShotInit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Default 2. */
  r?: number;
  /** Default 1. */
  damage?: number;
  /** Default 0. */
  pierce?: number;
  /** Seconds. Default 4. */
  ttl?: number;
  sprite?: string;
  weaponId?: string | null;
  /** rad/s. Default 0. */
  homing?: number;
  targetId?: EntityId;
}

function resetShot(b: Bullet, w: World, o: ShotInit, owner: Bullet['owner']): Bullet {
  b.id = w.nextId();
  b.x = o.x;
  b.y = o.y;
  b.prevX = o.x;
  b.prevY = o.y;
  b.vx = o.vx;
  b.vy = o.vy;
  b.r = o.r ?? 2;
  b.owner = owner;
  b.damage = o.damage ?? 1;
  b.pierce = o.pierce ?? 0;
  b.ttl = o.ttl ?? 4;
  b.sprite = o.sprite ?? '';
  b.rot = velocityRot(o.vx, o.vy);
  b.weaponId = o.weaponId ?? null;
  b.homing = o.homing ?? 0;
  b.targetId = o.targetId ?? -1;
  clearHitIds(b.hitIds);
  return b;
}

/** Unused `hitIds` slot. Entity ids start at 1. */
export const NO_HIT = -1;

// `length = 0` would make V8 drop the backing store, so the next pierce hit
// reallocates. Slots are blanked instead and reused.
function clearHitIds(ids: number[]): void {
  for (let i = 0; i < ids.length; i++) ids[i] = NO_HIT;
}

/** Render rotation: 0 = pointing up (-y), clockwise positive. */
export function velocityRot(vx: number, vy: number): number {
  return Math.atan2(vx, -vy);
}

export function spawnPlayerShot(w: World, init: ShotInit): Bullet | null {
  const b = w.playerShots.spawn();
  return b && resetShot(b, w, init, 'player');
}

export function spawnEnemyShot(w: World, init: ShotInit): Bullet | null {
  const b = w.enemyShots.spawn();
  return b && resetShot(b, w, init, 'enemy');
}

/** Per-spawn overrides on top of the def (velocity, formation, boss parts, ...). */
export interface EnemyOverrides {
  vx?: number;
  vy?: number;
  hp?: number;
  r?: number;
  state?: number;
  ax?: number;
  ay?: number;
  fireT?: number;
  avoidsAsteroids?: boolean;
  formationId?: number;
  isBoss?: boolean;
  contactDamage?: number;
}

export function spawnEnemy(
  w: World,
  defId: string,
  x: number,
  y: number,
  o?: EnemyOverrides,
): Enemy | null {
  const def = getEnemyDef(defId);
  const e = w.enemies.spawn();
  if (!e) return null;
  e.id = w.nextId();
  e.x = x;
  e.y = y;
  e.prevX = x;
  e.prevY = y;
  e.vx = o?.vx ?? 0;
  e.vy = o?.vy ?? 0;
  e.r = o?.r ?? def.r;
  e.hp = o?.hp ?? def.hp;
  e.maxHp = e.hp;
  e.flashT = 0;
  e.defId = defId;
  e.t = 0;
  e.state = o?.state ?? 0;
  e.ax = o?.ax ?? 0;
  e.ay = o?.ay ?? 0;
  e.fireT = o?.fireT ?? 0;
  e.avoidsAsteroids = o?.avoidsAsteroids ?? def.avoidsAsteroids ?? false;
  e.formationId = o?.formationId ?? -1;
  e.isBoss = o?.isBoss ?? def.isBoss ?? false;
  e.contactDamage = o?.contactDamage ?? def.contactDamage ?? 1;
  return e;
}

export interface AsteroidInit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** maxHp <= 0 makes the asteroid indestructible (absorbs shots). */
  hp: number;
  size?: Asteroid['size'];
  rot?: number;
  spin?: number;
  variant?: number;
}

export function spawnAsteroid(w: World, o: AsteroidInit): Asteroid | null {
  const a = w.asteroids.spawn();
  if (!a) return null;
  a.id = w.nextId();
  a.x = o.x;
  a.y = o.y;
  a.prevX = o.x;
  a.prevY = o.y;
  a.vx = o.vx;
  a.vy = o.vy;
  a.r = o.r;
  a.hp = o.hp;
  a.maxHp = o.hp;
  a.flashT = 0;
  a.size = o.size ?? 'small';
  a.rot = o.rot ?? 0;
  a.spin = o.spin ?? 0;
  a.variant = o.variant ?? 0;
  return a;
}

export interface AnomalyInit {
  kind: Anomaly['kind'];
  x: number;
  y: number;
  /** Core collision radius. */
  r: number;
  /** Effect field radius. */
  radius: number;
  strength: number;
  vx?: number;
  vy?: number;
}

export function spawnAnomaly(w: World, o: AnomalyInit): Anomaly | null {
  const a = w.anomalies.spawn();
  if (!a) return null;
  a.id = w.nextId();
  a.x = o.x;
  a.y = o.y;
  a.prevX = o.x;
  a.prevY = o.y;
  a.vx = o.vx ?? 0;
  a.vy = o.vy ?? 0;
  a.r = o.r;
  a.kind = o.kind;
  a.t = 0;
  a.strength = o.strength;
  a.radius = o.radius;
  return a;
}

export interface PickupInit {
  kind: PickupKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** Default 6. */
  r?: number;
  payload?: string;
  amount?: number;
  /** Seconds. Default 10. */
  ttl?: number;
}

export function spawnPickup(w: World, o: PickupInit): Pickup | null {
  const p = w.pickups.spawn();
  if (!p) return null;
  p.id = w.nextId();
  p.x = o.x;
  p.y = o.y;
  p.prevX = o.x;
  p.prevY = o.y;
  p.vx = o.vx ?? 0;
  p.vy = o.vy ?? 0;
  p.r = o.r ?? 6;
  p.kind = o.kind;
  p.payload = o.payload ?? '';
  p.amount = o.amount ?? 0;
  p.ttl = o.ttl ?? 10;
  p.magnetized = false;
  return p;
}
