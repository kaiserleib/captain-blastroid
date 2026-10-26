import { ENEMY_FAIRNESS } from '../../../content/enemies';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy, spawnEnemyShot, type EnemyOverrides, type ShotInit } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import {
  emitEnemyShotSfx,
  enemyShotSpeedMul,
  ring,
  SHOT_SMALL,
  type ShotStyle,
} from '../../enemies';

// Custom behaviors for the Armada roster. Each owns e.vx/e.vy (desired
// velocity; the enemy system integrates), e.state (0 = first tick) and the
// e.ax/e.ay scratch, and reads e.t (seconds alive before this tick).

type P = Readonly<Record<string, number>>;

// ---------------------------------------------------------------------------
// Escort Fighter: dives in on an outward arc to its hold line, then strafes
// off the far side (the wing keeps formation: every member strafes the same
// way). ax = strafe direction (±1; a spawn override sets it, 0 = toward the
// far side), ay = hold y.

export const ESCORT_DIVE = 1;
export const ESCORT_STRAFE = 2;

export function escort(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    if (e.ax === 0) e.ax = e.x < w.width / 2 ? 1 : -1;
    if (e.ay <= 0) e.ay = p.holdY as number;
    // A wing's members fire one after another, not as one six-shot wall.
    e.fireT += (e.id % 3) * (p.stagger ?? 0);
    e.state = ESCORT_DIVE;
  }
  const dir = e.ax;
  if (e.state === ESCORT_DIVE) {
    // Eases into the hold line, swinging out against the strafe direction.
    const left = e.ay - e.y;
    e.vy = Math.max(26, Math.min(p.dive as number, left * 2.4));
    const k = Math.max(0, Math.min(1, left / Math.max(1, e.ay + 16)));
    e.vx = -dir * (p.arc as number) * k;
    if (left <= 3 || e.t + dt > 3) e.state = ESCORT_STRAFE;
    return;
  }
  if (e.t >= (p.cease ?? Infinity)) e.fireT = Infinity;
  // Strafe: accelerate sideways, sinking slowly.
  const target = dir * (p.strafe as number);
  e.vx += (target - e.vx) * Math.min(1, 4 * dt);
  e.vy = p.sink as number;
}

// ---------------------------------------------------------------------------
// Minelayer: crosses at its spawn height toward the far side, dropping an Ion
// Mine every `every` s while it's over the playfield. ax = direction, ay =
// seconds until the next drop.

export const LAYER_CROSS = 1;
const mineO: EnemyOverrides = {};

export function minelayer(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.ax = e.x < w.width / 2 ? 1 : -1;
    e.ay = p.first as number;
    e.state = LAYER_CROSS;
  }
  e.vx = e.ax * (p.speed as number);
  e.vy = 0;
  const edge = p.edge as number;
  if (e.x < edge || e.x > w.width - edge) return;
  e.ay -= dt;
  if (e.ay > 0) return;
  e.ay += p.every as number;
  for (const k in mineO) delete mineO[k as keyof EnemyOverrides];
  spawnEnemy(w, 'ar_mine', e.x, e.y + e.r, mineO);
}

// ---------------------------------------------------------------------------
// Ion Mine: drifts with the scroll and blinks. The player coming within
// `trigger` px arms it (white lamp); `arm` s later, or `fuse` s after spawn
// (the last `warn` s blinking red), it bursts into an n-shot ring. Shot down
// first, it just pops. ay = seconds since armed.

export const MINE_DRIFT = 1;
export const MINE_ARMED = 2;

export function mine(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) e.state = MINE_DRIFT;
  e.vx = 0;
  e.vy = w.scrollSpeed;
  const pl = w.player;
  if (e.state === MINE_DRIFT) {
    const trig = p.trigger as number;
    const dx = pl.x - e.x;
    const dy = pl.y - e.y;
    if (pl.alive && dx * dx + dy * dy <= trig * trig) {
      e.state = MINE_ARMED;
      e.ay = 0;
    } else if (e.t + dt >= (p.fuse as number)) {
      burstMine(w, e, p);
    }
    return;
  }
  e.ay += dt;
  if (e.ay >= (p.arm as number)) burstMine(w, e, p);
}

function burstMine(w: World, e: Enemy, p: P): void {
  // The mine's own flash and pop come from the hazard kill (no score, no drop).
  if (e.y >= 0 && e.y <= w.height && w.player.alive) {
    if (ring(w, e.x, e.y, p.n as number, p.speed as number, (e.id * 17) % 45, SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, e.x);
  }
  damageEnemy(w, e, e.hp, 'hazard');
}

/** Sprite frame for a mine: slow blink, red in the last `warn` s, white once armed. */
export function mineFrame(e: Enemy, fuse: number, warn: number, time: number): number {
  if (e.state === MINE_ARMED) return Math.floor(time * 16) % 2 === 0 ? 3 : 2;
  if (e.t >= fuse - warn) return Math.floor(time * 10) % 2 === 0 ? 2 : 0;
  return Math.floor(time * 3 + e.id) % 2;
}

// ---------------------------------------------------------------------------
// Homing missile: turns toward the player at `turn` rad/s at a constant
// `speed`, self-destructing after `ttl` s. ax = heading (radians, canvas).

export const MISSILE_FLY = 1;

export function homing(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.ax = e.vx === 0 && e.vy === 0 ? Math.PI / 2 : Math.atan2(e.vy, e.vx);
    e.state = MISSILE_FLY;
  }
  if (e.t + dt >= (p.ttl as number)) {
    damageEnemy(w, e, e.hp, 'hazard');
    return;
  }
  const pl = w.player;
  if (pl.alive) {
    const want = Math.atan2(pl.y - e.y, pl.x - e.x);
    let da = want - e.ax;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const max = (p.turn as number) * dt;
    e.ax += da > max ? max : da < -max ? -max : da;
  }
  const s = p.speed as number;
  e.vx = Math.cos(e.ax) * s;
  e.vy = Math.sin(e.ax) * s;
}

// ---------------------------------------------------------------------------
// A burst fired down one line: `count` rounds `gap` s apart along `deg`. All
// rounds spawn now, each trailing the last by gap × speed (the later ones
// start inside the gun and emerge on time), so the burst keeps its aim
// instead of re-aiming at a moving player like `burst` does.

const lineShot: ShotInit = { x: 0, y: 0, vx: 0, vy: 0, r: 2, damage: 1, ttl: 6, sprite: '' };

export function lineBurst(
  w: World,
  x: number,
  y: number,
  deg: number,
  speed: number,
  count: number,
  gap: number,
  s: ShotStyle = SHOT_SMALL,
): number {
  const v = speed * enemyShotSpeedMul(w);
  const a = (deg * Math.PI) / 180;
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  let n = 0;
  for (let k = 0; k < count; k++) {
    const back = k * gap * v;
    lineShot.x = x - cx * back;
    lineShot.y = y - cy * back;
    lineShot.vx = cx * v;
    lineShot.vy = cy * v;
    lineShot.r = s.r;
    lineShot.damage = s.damage ?? 1;
    // Trailing rounds live longer by their delay, so every round travels as far.
    lineShot.ttl = (s.ttl ?? ENEMY_FAIRNESS.shotTtl) + k * gap;
    lineShot.sprite = s.sprite;
    if (spawnEnemyShot(w, lineShot) !== null) n++;
  }
  if (n > 0) emitEnemyShotSfx(w, x);
  return n;
}
