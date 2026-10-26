import type { BehaviorParams } from '../../../content/enemies';
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
  }
}
