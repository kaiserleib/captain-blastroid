import {
  ENEMY_BULLETS,
  ENEMY_FAIRNESS,
  type AimedPattern,
  type EnemyBulletSize,
  type FanPattern,
  type PatternDef,
  type RingPattern,
} from '../../content/enemies';
import { spawnEnemyShot, type ShotInit } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';

// Bullet patterns shared by enemies (T11), the director (T15) and the boss
// (T16). Angles are degrees in screen space: 0 = right, 90 = straight down.
// Every function returns the number of shots actually spawned (the pool can
// be full).

const DEG = Math.PI / 180;

export interface ShotStyle {
  sprite: string;
  r: number;
  /** Shield segments removed on hit. Default 1. */
  damage?: number;
  /** Seconds. Default ENEMY_FAIRNESS.shotTtl. */
  ttl?: number;
}

export const SHOT_SMALL: Readonly<ShotStyle> = ENEMY_BULLETS.s;
export const SHOT_LARGE: Readonly<ShotStyle> = ENEMY_BULLETS.l;

export function shotStyle(size: EnemyBulletSize): Readonly<ShotStyle> {
  return size === 'l' ? SHOT_LARGE : SHOT_SMALL;
}

const init: ShotInit = { x: 0, y: 0, vx: 0, vy: 0, r: 2, damage: 1, ttl: 4, sprite: '' };

// Level `enemyShotSpeedMul`, per world. Read once per shot, so the last
// world's value is cached instead of hitting the WeakMap every bullet.
const shotMuls = new WeakMap<World, number>();
let mulWorld: World | null = null;
let mulValue = 1;

/** Multiplies the speed of every enemy and boss shot fired through this module (the director sets it). */
export function setEnemyShotSpeedMul(w: World, mul: number): void {
  shotMuls.set(w, mul);
  if (mulWorld === w) mulValue = mul;
}

export function enemyShotSpeedMul(w: World): number {
  if (mulWorld !== w) {
    mulWorld = w;
    mulValue = shotMuls.get(w) ?? 1;
  }
  return mulValue;
}

function shoot(w: World, x: number, y: number, angle: number, speed: number, s: ShotStyle): number {
  const v = speed * enemyShotSpeedMul(w);
  init.x = x;
  init.y = y;
  init.vx = Math.cos(angle) * v;
  init.vy = Math.sin(angle) * v;
  init.r = s.r;
  init.damage = s.damage ?? 1;
  init.ttl = s.ttl ?? ENEMY_FAIRNESS.shotTtl;
  init.sprite = s.sprite;
  return spawnEnemyShot(w, init) === null ? 0 : 1;
}

/** n shots spread evenly across `arcDeg`, centered on `centerDeg`. */
function spread(
  w: World,
  x: number,
  y: number,
  n: number,
  arcDeg: number,
  centerDeg: number,
  speed: number,
  s: ShotStyle,
): number {
  if (n <= 0) return 0;
  const c = centerDeg * DEG;
  if (n === 1) return shoot(w, x, y, c, speed, s);
  const step = (arcDeg * DEG) / (n - 1);
  const a0 = c - (arcDeg * DEG) / 2;
  let fired = 0;
  for (let i = 0; i < n; i++) fired += shoot(w, x, y, a0 + step * i, speed, s);
  return fired;
}

/**
 * One shot from (x, y) heading `deg` (0 = right, 90 = down) at `speed` (the
 * level's shot-speed multiplier applies). Returns 1, or 0 if the pool is full.
 * Custom behaviors that fire bespoke shapes build them from this.
 */
export function shootDir(
  w: World,
  x: number,
  y: number,
  deg: number,
  speed: number,
  s: ShotStyle = SHOT_SMALL,
): number {
  return shoot(w, x, y, deg * DEG, speed, s);
}

/** Degrees from (x, y) to the player's current position (no lead). Straight down if dead. */
export function aimAt(w: World, x: number, y: number): number {
  const p = w.player;
  if (!p.alive) return 90;
  return Math.atan2(p.y - y, p.x - x) / DEG;
}

/** n shots across `spreadDeg`, centered on the player's current position. */
export function aimed(
  w: World,
  x: number,
  y: number,
  n: number,
  spreadDeg: number,
  speed: number,
  s: ShotStyle = SHOT_SMALL,
): number {
  return spread(w, x, y, n, spreadDeg, aimAt(w, x, y), speed, s);
}

/** n shots across `arcDeg`, centered on `centerDeg` (default straight down). */
export function fan(
  w: World,
  x: number,
  y: number,
  n: number,
  arcDeg: number,
  speed: number,
  s: ShotStyle = SHOT_SMALL,
  centerDeg = 90,
): number {
  return spread(w, x, y, n, arcDeg, centerDeg, speed, s);
}

/** n shots evenly around the circle, the first at `rotOffsetDeg`. */
export function ring(
  w: World,
  x: number,
  y: number,
  n: number,
  speed: number,
  rotOffsetDeg: number,
  s: ShotStyle = SHOT_SMALL,
): number {
  if (n <= 0) return 0;
  const step = (Math.PI * 2) / n;
  const a0 = rotOffsetDeg * DEG;
  let fired = 0;
  for (let i = 0; i < n; i++) fired += shoot(w, x, y, a0 + step * i, speed, s);
  return fired;
}

type VolleyPattern = AimedPattern | FanPattern | RingPattern;

const sfxP: { id: string; x?: number } = { id: 'enemy_shot', x: 0 };

/** One quiet `enemy_shot` per volley (never per bullet); T04 voice-limits it further. */
export function emitEnemyShotSfx(w: World, x: number): void {
  sfxP.x = x;
  w.events.emit('sfx', sfxP);
}

function volleyShots(w: World, x: number, y: number, p: VolleyPattern, s: ShotStyle): number {
  switch (p.kind) {
    case 'aimed':
      return aimed(w, x, y, p.n, p.spreadDeg, p.speed, s);
    case 'fan':
      return fan(w, x, y, p.n, p.arcDeg, p.speed, s, p.centerDeg ?? 90);
    case 'ring':
      return ring(w, x, y, p.n, p.speed, p.rotOffset, s);
  }
}

function volley(w: World, x: number, y: number, p: VolleyPattern, s: ShotStyle): number {
  const n = volleyShots(w, x, y, p, s);
  if (n > 0) emitEnemyShotSfx(w, x);
  return n;
}

/** Where an enemy's shots leave from: a little ahead (below) its center. */
export function muzzleY(e: Enemy): number {
  return e.y + e.r * 0.5;
}

/**
 * Enemy fire fairness: alive at least `minAge`, center on screen, at least
 * `minAbovePlayer` px above a live player.
 */
export function canFire(w: World, e: Enemy): boolean {
  const p = w.player;
  return (
    e.active &&
    p.alive &&
    e.t >= ENEMY_FAIRNESS.minAge &&
    e.x >= 0 &&
    e.x <= w.width &&
    e.y >= 0 &&
    e.y <= w.height &&
    e.y <= p.y - ENEMY_FAIRNESS.minAbovePlayer
  );
}

// ---------------------------------------------------------------------------
// Bursts: repeat a volley from a live shooter over time. Pending bursts live
// in a fixed per-world table, ticked by the enemies system.

interface PendingBurst {
  active: boolean;
  source: Enemy;
  sourceId: number;
  left: number;
  interval: number;
  timer: number;
  inner: VolleyPattern;
  style: ShotStyle;
  fair: boolean;
}

const MAX_BURSTS = 64;
const bursts = new WeakMap<World, PendingBurst[]>();

function burstTable(w: World): PendingBurst[] {
  let t = bursts.get(w);
  if (t === undefined) {
    t = [];
    for (let i = 0; i < MAX_BURSTS; i++) {
      t.push({
        active: false,
        source: null as unknown as Enemy,
        sourceId: -1,
        left: 0,
        interval: 0,
        timer: 0,
        inner: null as unknown as VolleyPattern,
        style: SHOT_SMALL,
        fair: true,
      });
    }
    bursts.set(w, t);
  }
  return t;
}

/**
 * Fires `inner` from `source` now, then `count - 1` more times `interval`
 * seconds apart from the source's live position. Follow-ups stop if the
 * source dies; with `fair` (bosses pass false), a follow-up that fails
 * `canFire` is skipped.
 * Returns shots spawned by the first volley.
 */
export function burst(
  w: World,
  source: Enemy,
  count: number,
  interval: number,
  inner: VolleyPattern,
  s: ShotStyle = SHOT_SMALL,
  fair = true,
): number {
  if (count <= 0) return 0;
  const fired = volley(w, source.x, muzzleY(source), inner, s);
  if (count > 1) scheduleBurst(w, source, count - 1, interval, inner, s, fair);
  return fired;
}

/** Queues `left` follow-up volleys of `inner` from `source`, `interval` s apart. */
function scheduleBurst(
  w: World,
  source: Enemy,
  left: number,
  interval: number,
  inner: VolleyPattern,
  s: ShotStyle,
  fair: boolean,
): void {
  const t = burstTable(w);
  for (let i = 0; i < t.length; i++) {
    const b = t[i] as PendingBurst;
    if (b.active) continue;
    b.active = true;
    b.source = source;
    b.sourceId = source.id;
    b.left = left;
    b.interval = interval;
    b.timer = interval;
    b.inner = inner;
    b.style = s;
    b.fair = fair;
    break;
  }
}

/** Advances pending bursts. Called once per tick by the enemies system. */
export function tickBursts(w: World, dt: number): void {
  const t = bursts.get(w);
  if (t === undefined) return;
  for (let i = 0; i < t.length; i++) {
    const b = t[i] as PendingBurst;
    if (!b.active) continue;
    const e = b.source;
    if (!e.active || e.id !== b.sourceId) {
      b.active = false;
      continue;
    }
    b.timer -= dt;
    while (b.timer <= 0 && b.left > 0) {
      if (!b.fair || canFire(w, e)) volley(w, e.x, muzzleY(e), b.inner, b.style);
      b.left--;
      b.timer += b.interval > 0 ? b.interval : 1;
    }
    if (b.left <= 0) b.active = false;
  }
}

/** Fires any pattern from `source` (bursts are scheduled). Returns shots spawned now. */
export function firePattern(
  w: World,
  source: Enemy,
  p: PatternDef,
  s: ShotStyle = SHOT_SMALL,
  fair = true,
): number {
  if (p.kind === 'burst') return burst(w, source, p.count, p.interval, p.inner, s, fair);
  return volley(w, source.x, muzzleY(source), p, s);
}

/**
 * Fires a pattern from `source` toward (targetX, targetY) instead of the
 * player: `aimed` spreads around the target, `fan` centers on it, `ring`
 * turns its first shot toward it. A `burst` fires its first volley at the
 * target; its follow-ups aim at the player. Returns shots spawned now.
 */
export function fireAt(
  w: World,
  source: Enemy,
  p: PatternDef,
  targetX: number,
  targetY: number,
  s: ShotStyle = SHOT_SMALL,
  fair = true,
): number {
  const x = source.x;
  const y = muzzleY(source);
  const deg = Math.atan2(targetY - y, targetX - x) / DEG;
  const v = p.kind === 'burst' ? p.inner : p;
  let n: number;
  switch (v.kind) {
    case 'aimed':
      n = spread(w, x, y, v.n, v.spreadDeg, deg, v.speed, s);
      break;
    case 'fan':
      n = spread(w, x, y, v.n, v.arcDeg, deg, v.speed, s);
      break;
    case 'ring':
      n = ring(w, x, y, v.n, v.speed, v.rotOffset + deg, s);
      break;
  }
  if (n > 0) emitEnemyShotSfx(w, x);
  if (p.kind === 'burst' && p.count > 1)
    scheduleBurst(w, source, p.count - 1, p.interval, p.inner, s, fair);
  return n;
}
