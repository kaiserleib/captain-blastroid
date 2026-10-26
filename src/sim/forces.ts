import type { Pool } from '../engine/pool';
import type { Body } from './types';

export type Falloff = 'linear' | 'inverse';

/** Inside this distance 'inverse' falloff is capped at full strength. */
export const INVERSE_FALLOFF_MIN = 8;

function factor(d: number, radius: number, falloff: Falloff): number {
  if (falloff === 'linear') return 1 - d / radius;
  return INVERSE_FALLOFF_MIN / (d > INVERSE_FALLOFF_MIN ? d : INVERSE_FALLOFF_MIN);
}

/**
 * Radial velocity change for one body. Positive strength pushes away from
 * (x, y), negative pulls toward it. The change is `strength * falloff * dt`:
 * pass the tick dt to treat strength as an acceleration (px/s²) applied every
 * tick, or leave dt = 1 for a one-off impulse (px/s). Bodies outside `radius`
 * or exactly at the center are untouched. Returns true if the body was affected.
 */
export function applyRadialForceTo(
  b: Body,
  x: number,
  y: number,
  radius: number,
  strength: number,
  falloff: Falloff,
  dt = 1,
): boolean {
  const dx = b.x - x;
  const dy = b.y - y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const k = (strength * factor(d, radius, falloff) * dt) / d;
  b.vx += dx * k;
  b.vy += dy * k;
  return true;
}

/**
 * `applyRadialForceTo` for every live body in a pool (repulsor, magnet, black
 * holes). Only velocity changes, so asteroids keep flying straight afterward.
 * Returns how many bodies were affected.
 */
export function applyRadialForce<T extends Body>(
  pool: Pool<T>,
  x: number,
  y: number,
  radius: number,
  strength: number,
  falloff: Falloff,
  dt = 1,
): number {
  const items = pool.items;
  const n = pool.count;
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const b = items[i] as T;
    if (b.active && applyRadialForceTo(b, x, y, radius, strength, falloff, dt)) hit++;
  }
  return hit;
}
