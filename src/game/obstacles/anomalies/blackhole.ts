import {
  BLACK_HOLE,
  BLACK_HOLE_VARIANTS,
  FIELD_ONLY_STRENGTH_MUL,
} from '../../../content/obstacles';
import { damagePlayer } from '../../../sim/damage';
import { applyRadialForce, applyRadialForceTo } from '../../../sim/forces';
import { spawnAnomaly } from '../../../sim/spawn';
import type { Anomaly, Asteroid, Pickup, PlayerState } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { blackHoleVariantId, ext, initExt } from './state';

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

export interface FieldOnlyOptions {
  /** Black-hole variant whose field radius and pull are used. Default `small`. */
  variant?: string;
  /** Scales strength and player pull. Default FIELD_ONLY_STRENGTH_MUL (0.5). */
  strengthMul?: number;
  /** Default 0 / 0: the owner writes `a.x`/`a.y` each tick. */
  vx?: number;
  vy?: number;
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

/** A black hole of the given variant (`small` / `standard` / `massive`, default `standard`). */
export function spawnBlackHole(
  w: World,
  x: number,
  y: number,
  o?: AnomalyPlacement,
): Anomaly | null {
  const v = BLACK_HOLE_VARIANTS[blackHoleVariantId(o?.variant)];
  init.kind = 'blackhole';
  init.x = x;
  init.y = y;
  init.r = v.r;
  init.radius = v.radius;
  init.strength = v.strength;
  init.vx = o?.vx ?? 0;
  init.vy = o?.vy ?? w.scrollSpeed;
  const a = spawnAnomaly(w, init);
  if (a !== null) initExt(ext(a), a, o?.variant);
  return a;
}

/**
 * A coreless black-hole field (gravity buoys): it bends shots, rocks and
 * pickups and drifts the player, but has no core to swallow or hurt anything
 * and isn't drawn. The owner moves it by writing `a.x`/`a.y` each tick and
 * calls `collapseAnomaly` when it dies.
 */
export function spawnFieldOnly(
  w: World,
  x: number,
  y: number,
  o?: FieldOnlyOptions,
): Anomaly | null {
  const variant = o?.variant ?? 'small';
  const v = BLACK_HOLE_VARIANTS[blackHoleVariantId(variant)];
  const mul = o?.strengthMul ?? FIELD_ONLY_STRENGTH_MUL;
  init.kind = 'blackhole';
  init.x = x;
  init.y = y;
  init.r = 0;
  init.radius = v.radius;
  init.strength = v.strength * mul;
  init.vx = o?.vx ?? 0;
  init.vy = o?.vy ?? 0;
  const a = spawnAnomaly(w, init);
  if (a === null) return null;
  const e = ext(a);
  initExt(e, a, variant);
  e.fieldOnly = true;
  e.playerPull = v.playerPull * mul;
  return a;
}

/**
 * Pulls shots, rocks and pickups toward the core (inverse falloff, so the
 * curve tightens near the hole), drifts the player gently toward it, and
 * swallows rocks that reach the core. Shots are swallowed by T03's
 * shot × anomaly collision rule.
 */
export function updateBlackHole(w: World, a: Anomaly, dt: number): void {
  const e = ext(a);
  const s = -a.strength;
  applyRadialForce(w.playerShots, a.x, a.y, a.radius, s, 'inverse', dt);
  applyRadialForce(w.enemyShots, a.x, a.y, a.radius, s, 'inverse', dt);
  applyRadialForce(w.asteroids, a.x, a.y, a.radius, s * BLACK_HOLE.rockMul, 'inverse', dt);
  pullPickups(w, a, s * BLACK_HOLE.pickupMul, dt);
  pullPlayer(w.player, a, e.playerPull, dt);
  if (!e.fieldOnly && a.r > 0) absorbRocks(w, a);
}

// Pods coast through the core zone untouched, so they slide past instead of
// getting pinned on the capped inverse pull at the center.
function pullPickups(w: World, a: Anomaly, s: number, dt: number): void {
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (!k.active) continue;
    if (k.kind === 'escapePod') {
      const dx = k.x - a.x;
      const dy = k.y - a.y;
      const rr = a.r + k.r;
      if (dx * dx + dy * dy < rr * rr) continue;
    }
    applyRadialForceTo(k, a.x, a.y, a.radius, s, 'inverse', dt);
  }
}

// T08 sets the player's velocity from input every tick, so a velocity nudge
// would be overwritten; the pull is applied as a positional drift instead.
function pullPlayer(p: PlayerState, a: Anomaly, pull: number, dt: number): void {
  if (!p.alive || a.radius <= 0) return;
  const dx = a.x - p.x;
  const dy = a.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= a.radius || d < 0.5) return;
  const step = pull * (1 - d / a.radius) * dt;
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

export function blackHoleContact(w: World, a: Anomaly, _p: PlayerState): void {
  if (ext(a).fieldOnly || a.r <= 0) return;
  damagePlayer(w, BLACK_HOLE.contactDamage);
}
