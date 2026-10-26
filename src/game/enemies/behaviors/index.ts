import type { BehaviorParams, CustomParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { crossing } from './crossing';
import { holdAndStrafe } from './holdAndStrafe';
import { shadowPlayer } from './shadowPlayer';
import { sineDive } from './sineDive';
import { straight } from './straight';
import { swoop } from './swoop';

export { crossing, holdAndStrafe, shadowPlayer, sineDive, straight, swoop };

/**
 * A sector behavior. Like the built-ins it owns `e.vx/e.vy` (desired
 * velocity; the enemy system integrates), `e.state` (0 = first tick) and the
 * `e.ax/e.ay` scratch, and reads `e.t` (seconds alive, before this tick). `p`
 * is the def's `behavior.p` (or an empty object). It may also fire (the
 * pattern API in game/enemies), spawn or tow, and must not allocate per call.
 */
export type BehaviorFn = (
  w: World,
  e: Enemy,
  p: Readonly<Record<string, number>>,
  dt: number,
) => void;

const custom = new Map<string, BehaviorFn>();
const NO_P: Readonly<Record<string, number>> = Object.freeze({});

/** Registers a `{ kind: 'custom', behavior: name }` behavior. A second, different fn throws. */
export function registerBehavior(name: string, fn: BehaviorFn): void {
  const had = custom.get(name);
  if (had !== undefined && had !== fn) throw new Error(`registerBehavior: duplicate "${name}"`);
  custom.set(name, fn);
}

/** Dev: throws for an unknown custom behavior. Prod: the enemy keeps its spawn velocity. */
export function checkBehavior(p: BehaviorParams): void {
  if (p.kind !== 'custom' || custom.has(p.behavior)) return;
  if (import.meta.env.DEV) throw new Error(`Unknown enemy behavior "${p.behavior}"`);
}

function runCustom(w: World, e: Enemy, p: CustomParams, dt: number): void {
  const fn = custom.get(p.behavior);
  if (fn !== undefined) fn(w, e, p.p ?? NO_P, dt);
}

/**
 * Writes the behavior's desired velocity into e.vx/e.vy and advances
 * e.state. state 0 means "not initialized yet"; each behavior documents how
 * it uses ax/ay. Reads e.t (seconds alive, before this tick).
 */
export function runBehavior(w: World, e: Enemy, p: BehaviorParams, dt: number): void {
  switch (p.kind) {
    case 'straight':
      return straight(w, e, p, dt);
    case 'sineDive':
      return sineDive(w, e, p, dt);
    case 'swoop':
      return swoop(w, e, p, dt);
    case 'holdAndStrafe':
      return holdAndStrafe(w, e, p, dt);
    case 'shadowPlayer':
      return shadowPlayer(w, e, p, dt);
    case 'crossing':
      return crossing(w, e, p, dt);
    case 'custom':
      return runCustom(w, e, p, dt);
  }
}
