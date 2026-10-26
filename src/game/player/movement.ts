import { PLAYER_TUNING as T } from '../../content/player';
import type { MoveIntent } from '../../sim/types';
import { WORLD_H, WORLD_W } from '../../sim/world';

export interface Kinematics {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Commanded velocity for one tick. Keys/stick: intent × speed. Mouse target:
 * full speed toward it, easing in proportionally (d × arriveGain, capped) so
 * the approach is first-order and can't overshoot or jitter around a resting
 * cursor. Writes into `out`.
 */
export function desiredVelocity(
  k: Kinematics,
  intent: MoveIntent,
  speed: number,
  out: { x: number; y: number },
): void {
  if (intent.targetX === null || intent.targetY === null) {
    out.x = intent.x * speed;
    out.y = intent.y * speed;
    return;
  }
  const dx = clampX(intent.targetX) - k.x;
  const dy = clampY(intent.targetY + T.mouseOffsetY) - k.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) {
    out.x = out.y = 0;
    return;
  }
  const s = Math.min(speed, d * T.arriveGain) / d;
  out.x = dx * s;
  out.y = dy * s;
}

/**
 * Moves velocity toward the desired one: gaining speed takes `accelTime` from
 * rest to full, anything that sheds speed along the current heading (stopping,
 * reversing, turning) brakes at the faster `stopTime` rate.
 */
export function approachVelocity(
  k: Kinematics,
  dvx: number,
  dvy: number,
  speed: number,
  dt: number,
): void {
  const ex = dvx - k.vx;
  const ey = dvy - k.vy;
  const err = Math.sqrt(ex * ex + ey * ey);
  if (err === 0) return;
  const v2 = k.vx * k.vx + k.vy * k.vy;
  const braking = dvx * k.vx + dvy * k.vy < v2;
  const step = (speed / (braking ? T.stopTime : T.accelTime)) * dt;
  if (err <= step) {
    k.vx = dvx;
    k.vy = dvy;
  } else {
    k.vx += (ex / err) * step;
    k.vy += (ey / err) * step;
  }
}

const MIN_X = T.margin;
const MAX_X = WORLD_W - T.margin;
const MIN_Y = T.margin;
const MAX_Y = WORLD_H - T.margin;

function clampX(x: number): number {
  return x < MIN_X ? MIN_X : x > MAX_X ? MAX_X : x;
}

function clampY(y: number): number {
  return y < MIN_Y ? MIN_Y : y > MAX_Y ? MAX_Y : y;
}

/** Keeps the ship 8 px inside the playfield and kills velocity into the wall. */
export function clampToPlayfield(k: Kinematics): void {
  if (k.x < MIN_X) {
    k.x = MIN_X;
    if (k.vx < 0) k.vx = 0;
  } else if (k.x > MAX_X) {
    k.x = MAX_X;
    if (k.vx > 0) k.vx = 0;
  }
  if (k.y < MIN_Y) {
    k.y = MIN_Y;
    if (k.vy < 0) k.vy = 0;
  } else if (k.y > MAX_Y) {
    k.y = MAX_Y;
    if (k.vy > 0) k.vy = 0;
  }
}

const desired = { x: 0, y: 0 };

/** One tick of flight: steer, integrate, clamp. Snaps onto a resting mouse target. */
export function stepMovement(k: Kinematics, intent: MoveIntent, speed: number, dt: number): void {
  desiredVelocity(k, intent, speed, desired);
  approachVelocity(k, desired.x, desired.y, speed, dt);
  k.x += k.vx * dt;
  k.y += k.vy * dt;
  if (intent.targetX !== null && intent.targetY !== null) {
    const dx = clampX(intent.targetX) - k.x;
    const dy = clampY(intent.targetY + T.mouseOffsetY) - k.y;
    if (dx * dx + dy * dy < T.arriveSnap * T.arriveSnap) {
      k.x += dx;
      k.y += dy;
      k.vx = k.vy = 0;
    }
  }
  clampToPlayfield(k);
}
