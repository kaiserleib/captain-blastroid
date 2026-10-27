import { angleDiff } from '../engine/math';
import type { Pool } from '../engine/pool';
import { timeScaleAt } from './hooks';
import { getSpatialHash } from './spatialHash';
import { isTargetable, targetFilterFor } from './targeting';
import { Layer, type Body, type Bullet, type Enemy } from './types';
import type { System, World } from './world';

/** Sets prev, then moves every live body by its velocity. */
export function integrate<T extends Body>(pool: Pool<T>, dt: number): void {
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as T;
    if (!b.active) continue;
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

function findEnemy(w: World, id: number): Enemy | null {
  if (id < 0) return null;
  const items = w.enemies.items;
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (e.id === id) return e.active ? e : null;
  }
  return null;
}

/**
 * Rotates the bullet's velocity toward its target by at most homing*dt.
 * Player shots chase `targetId`, retargeting to the nearest enemy when it
 * dies; enemy shots chase the live player.
 */
export function steerHoming(w: World, b: Bullet, dt: number): void {
  let target: Body | null;
  if (b.owner === 'enemy') {
    target = w.player.alive ? w.player : null;
    if (target === null) return;
  } else {
    const e = findEnemy(w, b.targetId);
    if (e !== null && isTargetable(w, e)) {
      target = e;
    } else {
      target = getSpatialHash(w).nearest(b.x, b.y, Layer.Enemy, Infinity, targetFilterFor(w));
      b.targetId = target === null ? -1 : target.id;
      if (target === null) return;
    }
  }
  const speed = Math.hypot(b.vx, b.vy);
  if (speed === 0) return;
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(target.y - b.y, target.x - b.x);
  const maxTurn = b.homing * dt;
  let d = angleDiff(cur, want);
  if (d > maxTurn) d = maxTurn;
  else if (d < -maxTurn) d = -maxTurn;
  const a = cur + d;
  b.vx = Math.cos(a) * speed;
  b.vy = Math.sin(a) * speed;
}

/** ttl countdown, homing, integration and render rotation for one shot pool. */
export function updateBullets(w: World, pool: Pool<Bullet>, dt: number): void {
  const items = pool.items;
  const n = pool.count;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Bullet;
    if (!b.active) continue;
    // Time bubbles (T33) and, for enemy shots, bullet time (T36). Exactly dt by default.
    let s = timeScaleAt(w, b.x, b.y);
    if (b.owner === 'enemy') s *= w.enemyBulletTimeScale;
    const bdt = dt * s;
    b.ttl -= bdt;
    if (b.ttl <= 0) {
      pool.release(b);
      continue;
    }
    if (b.homing > 0) steerHoming(w, b, bdt);
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * bdt;
    b.y += b.vy * bdt;
    b.rot = Math.atan2(b.vx, -b.vy); // = velocityRot(); inline so the result isn't boxed
  }
}

export const bulletsSystem: System = {
  name: 'bullets',
  update(w, dt) {
    updateBullets(w, w.playerShots, dt);
    updateBullets(w, w.enemyShots, dt);
  },
};
