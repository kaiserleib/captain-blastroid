import { clamp } from '../../../engine/math';
import type { ShadowPlayerParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

/**
 * Lags toward the player's x (plus a per-instance offset in ax, picked from
 * the entity id so it stays deterministic) while descending slowly.
 */
export function shadowPlayer(w: World, e: Enemy, p: ShadowPlayerParams, _dt: number): void {
  if (e.state === 0) {
    e.ax = ((e.id % 3) - 1) * p.spread;
    e.state = 1;
  }
  e.vx = clamp((w.player.x + e.ax - e.x) * p.lag, -p.maxVx, p.maxVx);
  e.vy = p.descendSpeed;
}
