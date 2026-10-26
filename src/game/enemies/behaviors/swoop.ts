import type { SwoopParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

const MIRRORED = 2;

function bez(a: number, b: number, c: number, d: number, u: number): number {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
}

/**
 * Tracks a cubic Bézier from the spawn point (ax/ay), then keeps the exit
 * tangent. Spawning right of center mirrors the curve (state 2).
 */
export function swoop(w: World, e: Enemy, p: SwoopParams, dt: number): void {
  if (e.state === 0) {
    e.ax = e.x;
    e.ay = e.y;
    e.state = e.x > w.width / 2 ? MIRRORED : 1;
  }
  const m = e.state === MIRRORED ? -1 : 1;
  const u = (e.t + dt) / p.duration;
  if (u < 1 && dt > 0) {
    const tx = e.ax + m * bez(0, p.c1x, p.c2x, p.endX, u);
    const ty = e.ay + bez(0, p.c1y, p.c2y, p.endY, u);
    e.vx = (tx - e.x) / dt;
    e.vy = (ty - e.y) / dt;
  } else {
    e.vx = (m * 3 * (p.endX - p.c2x)) / p.duration;
    e.vy = (3 * (p.endY - p.c2y)) / p.duration;
  }
}
