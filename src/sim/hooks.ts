import type { Anomaly, Asteroid, Bullet, Enemy, PlayerState } from './types';
import type { World } from './world';

// Module-level registries so features can plug into collision/damage without
// T03 importing them. Register once at module load (a feature's index.ts),
// not per scene enter.

/** Return true to consume the enemy shot (drones, escape pods). */
export type ShotBlocker = (w: World, shot: Bullet) => boolean;
export type AnomalyContact = (w: World, a: Anomaly, player: PlayerState) => void;
/** Return true when the boss handled the hit (and any death) itself. */
export type BossDamageHook = (w: World, part: Enemy, amount: number) => boolean;

/**
 * Return false to hide an `isBoss` enemy from auto-targeting (seekers, homing
 * retargets): armor plates and shielded cores would otherwise soak missiles.
 */
export type TargetFilter = (w: World, e: Enemy) => boolean;

/**
 * True while a rock is held by a tractor beam (T23): cleanup never culls it,
 * and it passes through enemies instead of colliding.
 */
export type AsteroidHeldCheck = (w: World, a: Asteroid) => boolean;

/** Multiplier on damage to an `isBoss` enemy, applied before the boss damage hooks. */
export type BossDamageScale = (w: World, part: Enemy) => number;

/** Ray hit against solid geometry (terrain, slabs). `t` is 0..1 along the ray. */
export interface RayHit {
  x: number;
  y: number;
  nx: number;
  ny: number;
  t: number;
}

/** Solid geometry query (T34 terrain). Defaults: nothing is solid. */
export interface SolidQuery {
  isSolidAt(w: World, x: number, y: number): boolean;
  /** True on a hit, written into `out`. */
  raycastSolid(w: World, x0: number, y0: number, x1: number, y1: number, out: RayHit): boolean;
}

/** Rate multiplier for bodies at (x, y) (T33 time bubbles). 1 = normal. */
export type TimeScaleFn = (w: World, x: number, y: number) => number;

/** Runs one Act II timeline event; `ev` is the event's payload object. */
export type TimelineAction = (w: World, ev: unknown) => void;

/**
 * A pass the collision system runs before its broad phase, after every body
 * has moved (T34 terrain: scroll, push-out, tile hits). Must be a no-op for
 * worlds it has no state for.
 */
export type CollisionPass = (w: World, dt: number) => void;

let asteroidHeld: AsteroidHeldCheck | null = null;
let solidQuery: SolidQuery | null = null;
let timeScale: TimeScaleFn | null = null;
const timelineActions: Record<string, TimelineAction> = {};
let bossDamageScale: BossDamageScale | null = null;

const shotBlockers: ShotBlocker[] = [];
const targetFilters: TargetFilter[] = [];
const anomalyContacts: Partial<Record<Anomaly['kind'], AnomalyContact>> = {};
const bossDamageHooks: BossDamageHook[] = [];
const collisionPasses: CollisionPass[] = [];

function remover<T>(list: T[], fn: T): () => void {
  return () => {
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

export function registerShotBlocker(fn: ShotBlocker): () => void {
  shotBlockers.push(fn);
  return remover(shotBlockers, fn);
}

/** One handler per kind; registering again replaces it. */
export function registerAnomalyContact(kind: Anomaly['kind'], fn: AnomalyContact): () => void {
  anomalyContacts[kind] = fn;
  return () => {
    if (anomalyContacts[kind] === fn) delete anomalyContacts[kind];
  };
}

export function registerBossDamage(fn: BossDamageHook): () => void {
  bossDamageHooks.push(fn);
  return remover(bossDamageHooks, fn);
}

export function registerTargetFilter(fn: TargetFilter): () => void {
  targetFilters.push(fn);
  return remover(targetFilters, fn);
}

export function getTargetFilters(): readonly TargetFilter[] {
  return targetFilters;
}

export function getShotBlockers(): readonly ShotBlocker[] {
  return shotBlockers;
}

export function getAnomalyContact(kind: Anomaly['kind']): AnomalyContact | undefined {
  return anomalyContacts[kind];
}

export function getBossDamageHooks(): readonly BossDamageHook[] {
  return bossDamageHooks;
}

/** One check; registering again replaces it. */
export function registerAsteroidHeld(fn: AsteroidHeldCheck): () => void {
  asteroidHeld = fn;
  return () => {
    if (asteroidHeld === fn) asteroidHeld = null;
  };
}

export function isAsteroidHeld(w: World, a: Asteroid): boolean {
  return asteroidHeld !== null && asteroidHeld(w, a);
}

/** One scale; registering again replaces it. */
export function registerBossDamageScale(fn: BossDamageScale): () => void {
  bossDamageScale = fn;
  return () => {
    if (bossDamageScale === fn) bossDamageScale = null;
  };
}

export function scaleBossDamage(w: World, part: Enemy, amount: number): number {
  return bossDamageScale === null ? amount : amount * bossDamageScale(w, part);
}

/** One query; registering again replaces it. */
export function registerSolidQuery(q: SolidQuery): () => void {
  solidQuery = q;
  return () => {
    if (solidQuery === q) solidQuery = null;
  };
}

export function isSolidAt(w: World, x: number, y: number): boolean {
  return solidQuery !== null && solidQuery.isSolidAt(w, x, y);
}

export function raycastSolid(
  w: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  out: RayHit,
): boolean {
  return solidQuery !== null && solidQuery.raycastSolid(w, x0, y0, x1, y1, out);
}

/** One scale; registering again replaces it. */
export function registerTimeScale(fn: TimeScaleFn): () => void {
  timeScale = fn;
  return () => {
    if (timeScale === fn) timeScale = null;
  };
}

export function timeScaleAt(w: World, x: number, y: number): number {
  return timeScale === null ? 1 : timeScale(w, x, y);
}

/** One handler per timeline kind; registering again replaces it. */
export function registerTimelineAction(kind: string, fn: TimelineAction): () => void {
  timelineActions[kind] = fn;
  return () => {
    if (timelineActions[kind] === fn) delete timelineActions[kind];
  };
}

export function getTimelineAction(kind: string): TimelineAction | undefined {
  return timelineActions[kind];
}

export function registerCollisionPass(fn: CollisionPass): () => void {
  if (!collisionPasses.includes(fn)) collisionPasses.push(fn);
  return remover(collisionPasses, fn);
}

export function getCollisionPasses(): readonly CollisionPass[] {
  return collisionPasses;
}

/** For tests. */
export function clearHooks(): void {
  asteroidHeld = null;
  bossDamageScale = null;
  solidQuery = null;
  timeScale = null;
  for (const k of Object.keys(timelineActions)) delete timelineActions[k];
  shotBlockers.length = 0;
  bossDamageHooks.length = 0;
  collisionPasses.length = 0;
  targetFilters.length = 0;
  delete anomalyContacts.blackhole;
  delete anomalyContacts.pulsar;
}
