import { TAU } from '../../../engine/math';
import type { SineDiveParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

/** Pulls drift (avoidance, knockback) back onto the sine path, 1/s. */
const CORRECT = 4;

/** ax = center line x. */
export function sineDive(_w: World, e: Enemy, p: SineDiveParams, _dt: number): void {
  if (e.state === 0) {
    e.ax = e.x;
    e.state = 1;
  }
  const om = TAU * p.frequency;
  const ph = om * e.t;
  const targetX = e.ax + p.amplitude * Math.sin(ph);
  e.vx = p.amplitude * om * Math.cos(ph) + (targetX - e.x) * CORRECT;
  e.vy = p.speed;
}
