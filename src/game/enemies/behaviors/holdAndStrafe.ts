import type { HoldAndStrafeParams } from '../../../content/enemies';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

export const HS_DESCEND = 1;
export const HS_STRAFE_R = 2;
export const HS_STRAFE_L = 3;
export const HS_LEAVE = 4;

const SCREEN_MARGIN = 16;
/** Spring back to the hold height, 1/s. */
const HOLD_K = 3;

/** ax = spawn x (strafe center), ay = hold height. */
export function holdAndStrafe(w: World, e: Enemy, p: HoldAndStrafeParams, _dt: number): void {
  if (e.state === 0) {
    e.ax = e.x;
    if (e.ay <= 0) e.ay = p.anchorY;
    e.state = HS_DESCEND;
  }
  if (e.state !== HS_LEAVE && e.t >= p.leaveAfter) e.state = HS_LEAVE;

  if (e.state === HS_DESCEND) {
    e.vx = 0;
    e.vy = p.descendSpeed;
    if (e.y >= e.ay - 1) e.state = e.x < w.width / 2 ? HS_STRAFE_R : HS_STRAFE_L;
    return;
  }
  if (e.state === HS_LEAVE) {
    e.vx = 0;
    e.vy = p.exitVy;
    return;
  }
  const lo = Math.max(SCREEN_MARGIN, e.ax - p.strafeRange);
  const hi = Math.min(w.width - SCREEN_MARGIN, e.ax + p.strafeRange);
  if (e.state === HS_STRAFE_R && e.x >= hi) e.state = HS_STRAFE_L;
  else if (e.state === HS_STRAFE_L && e.x <= lo) e.state = HS_STRAFE_R;
  e.vx = e.state === HS_STRAFE_R ? p.strafeSpeed : -p.strafeSpeed;
  e.vy = (e.ay - e.y) * HOLD_K;
}
