import type { CrossingParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

/** Keeps the cruise height after a nudge, 1/s. */
const HOLD_K = 2;

/** Side-to-side transit at the spawn height. ax = direction (±1), ay = cruise y. */
export function crossing(w: World, e: Enemy, p: CrossingParams, _dt: number): void {
  if (e.state === 0) {
    e.ax = e.x < w.width / 2 ? 1 : -1;
    e.ay = e.y;
    e.state = 1;
  }
  e.vx = e.ax * p.speed;
  e.vy = (e.ay - e.y) * HOLD_K;
}
