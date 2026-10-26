import { BLACK_HOLE } from '../../../content/obstacles';
import { damagePlayer } from '../../../sim/damage';
import { applyRadialForce } from '../../../sim/forces';
import { spawnAnomaly } from '../../../sim/spawn';
import type { Anomaly, Asteroid, PlayerState } from '../../../sim/types';
import type { World } from '../../../sim/world';

export interface AnomalyPlacement {
  /** Default 0. */
  vx?: number;
  /** Default `world.scrollSpeed`: anomalies sit in the scrolling world. */
  vy?: number;
  /** Variant id from content/obstacles; unknown or missing = the default variant. */
  variant?: string;
  /** Pulsars: seconds already elapsed on the pulse clock at spawn. */
  phase?: number;
}

const init = {
  kind: 'blackhole' as Anomaly['kind'],
  x: 0,
  y: 0,
  r: 0,
  radius: 0,
  strength: 0,
  vx: 0,
  vy: 0,
};

export function spawnBlackHole(
  w: World,
  x: number,
  y: number,
  o?: AnomalyPlacement,
): Anomaly | null {
  init.kind = 'blackhole';
  init.x = x;
  init.y = y;
  init.r = BLACK_HOLE.r;
  init.radius = BLACK_HOLE.radius;
  init.strength = BLACK_HOLE.strength;
  init.vx = o?.vx ?? 0;
  init.vy = o?.vy ?? w.scrollSpeed;
  return spawnAnomaly(w, init);
}

/**
 * Pulls shots, rocks and pickups toward the core (inverse falloff, so the
 * curve tightens near the hole), drifts the player gently toward it, and
 * swallows rocks that reach the core. Shots are swallowed by T03's
 * shot × anomaly collision rule.
 */
export function updateBlackHole(w: World, a: Anomaly, dt: number): void {
  const s = -a.strength;
  applyRadialForce(w.playerShots, a.x, a.y, a.radius, s, 'inverse', dt);
  applyRadialForce(w.enemyShots, a.x, a.y, a.radius, s, 'inverse', dt);
  applyRadialForce(w.asteroids, a.x, a.y, a.radius, s * BLACK_HOLE.rockMul, 'inverse', dt);
  applyRadialForce(w.pickups, a.x, a.y, a.radius, s * BLACK_HOLE.pickupMul, 'inverse', dt);
  pullPlayer(w.player, a, dt);
  absorbRocks(w, a);
}

// T08 sets the player's velocity from input every tick, so a velocity nudge
// would be overwritten; the pull is applied as a positional drift instead.
function pullPlayer(p: PlayerState, a: Anomaly, dt: number): void {
  if (!p.alive) return;
  const dx = a.x - p.x;
  const dy = a.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= a.radius || d < 0.5) return;
  const step = BLACK_HOLE.playerPull * (1 - d / a.radius) * dt;
  const k = Math.min(step, d) / d;
  p.x += dx * k;
  p.y += dy * k;
}

function absorbRocks(w: World, a: Anomaly): void {
  const items = w.asteroids.items;
  const n = w.asteroids.count;
  for (let i = 0; i < n; i++) {
    const r = items[i] as Asteroid;
    if (!r.active) continue;
    const dx = r.x - a.x;
    const dy = r.y - a.y;
    const rr = a.r + r.r * 0.5;
    if (dx * dx + dy * dy < rr * rr) w.asteroids.release(r);
  }
}

export function blackHoleContact(w: World, _a: Anomaly, _p: PlayerState): void {
  damagePlayer(w, BLACK_HOLE.contactDamage);
}
