import type { StraightParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

const DEG = Math.PI / 180;

/** ax = heading (rad), ay = speed. A non-zero spawn velocity sets both. */
export function straight(w: World, e: Enemy, p: StraightParams, _dt: number): void {
  if (e.state === 0) {
    if (e.vx !== 0 || e.vy !== 0) {
      e.ax = Math.atan2(e.vy, e.vx);
      e.ay = Math.hypot(e.vx, e.vy);
    } else {
      e.ax = p.heading * DEG;
      e.ay = p.speed;
    }
    e.state = 1;
  }
  e.vx = Math.cos(e.ax) * e.ay;
  e.vy = Math.sin(e.ax) * e.ay + w.scrollSpeed * p.drift;
}
