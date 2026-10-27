import { CRANE_P, SENTINEL_P, type RIVETER_P } from '../../../content/levels/foundry';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import type { Asteroid, Bullet, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { aimed, canFire, emitEnemyShotSfx, muzzleY, SHOT_SMALL, shootDir } from '../../enemies';
import { drawTractorBeam, flingRock, isTowed, spawnRock, towRock } from '../../obstacles';
import { terrainActive } from '../../terrain';
import { CRANE_FRAMES, FD_SPRITES, MOLTEN5, STEEL5, TOW5 } from './foundry.sprites';

// Foundry roster behaviors (registered from index.ts). Each owns e.vx/e.vy
// (the enemy system integrates), e.state (0 = first tick) and e.ax/e.ay, and
// reads e.t (seconds alive before this tick). Per-enemy extras live in side
// tables keyed by the pooled Enemy object and checked by id, so nothing
// allocates per tick once a slot has been used.

type P<T> = { readonly [K in keyof T]: number };

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const MARGIN = 16;
const SFX_P = { id: '', x: 0 as number | undefined };

function sfx(w: World, id: string, x: number): void {
  SFX_P.id = id;
  SFX_P.x = x;
  w.events.emit('sfx', SFX_P);
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
}

// ---------------------------------------------------------------------------
// Riveter: crosses at a fixed row at 60 px/s. e.ax = direction (±1, default
// from the side it spawned on), e.ay = its row (re-read after a portal hop).

export function riveterBehavior(w: World, e: Enemy, p: P<typeof RIVETER_P>, _dt: number): void {
  if (e.state === 0) {
    e.state = 1;
    if (e.ax === 0) e.ax = e.x < w.width / 2 ? 1 : -1;
    e.ay = e.y;
  }
  // A portal moved it to another row: that's its row now.
  if (Math.abs(e.y - e.ay) > 12) e.ay = e.y;
  e.vx = (e.ax < 0 ? -1 : 1) * p.speed;
  const bob = Math.sin((e.t / p.bobPeriod) * TAU) * p.bob;
  e.vy = (e.ay + bob - e.y) * 8;
}

// ---------------------------------------------------------------------------
// Crane: brings its own hull scrap in on the hook, holds near the top, flings
// it (the hook glows `telegraph` s first), then snipes with one aimed shot at
// a time until it can grab more scrap. e.ax > 0 shortens its stay (chambers).

export const CraneState = {
  Descend: 1,
  Hold: 2,
  Snipe: 3,
  Leave: 4,
} as const;

interface CraneSide {
  id: number;
  rock: Asteroid | null;
  rockId: number;
  /** Seconds holding the current rock. */
  towT: number;
  /** Seconds until it looks for field scrap again. */
  regrab: number;
  shotT: number;
  flungT: number;
}

const cranes = new WeakMap<Enemy, CraneSide>();

export function craneSide(e: Enemy): CraneSide {
  let s = cranes.get(e);
  if (s === undefined) {
    s = { id: -1, rock: null, rockId: -1, towT: 0, regrab: 0, shotT: 0, flungT: 9 };
    cranes.set(e, s);
  }
  if (s.id !== e.id) {
    s.id = e.id;
    s.rock = null;
    s.rockId = -1;
    s.towT = 0;
    s.regrab = 0;
    s.shotT = 0;
    s.flungT = 9;
  }
  return s;
}

/** The scrap a crane holds right now, or null. */
export function craneRock(e: Enemy): Asteroid | null {
  const s = cranes.get(e);
  if (s === undefined || s.id !== e.id || s.rock === null) return null;
  return s.rock.active && s.rock.id === s.rockId ? s.rock : null;
}

/** True while the hook glows: the fling is less than `telegraph` s away. */
export function craneHot(e: Enemy, p: P<typeof CRANE_P> = CRANE_P): boolean {
  const s = cranes.get(e);
  if (s === undefined || s.id !== e.id || craneRock(e) === null) return false;
  return e.state === CraneState.Hold && s.towT >= p.towTime - p.telegraph;
}

const rockInit = { size: 'large' as const, x: 0, y: 0, vx: 0, vy: 0, hp: 0 };

/** Nearest medium/large rock in range that nobody holds, on screen and well above the ship. */
function findScrap(w: World, x: number, y: number, range: number): Asteroid | null {
  const items = w.asteroids.items;
  const py = w.player.y;
  let best: Asteroid | null = null;
  let bestD = range * range;
  for (let i = 0; i < w.asteroids.count; i++) {
    const a = items[i] as Asteroid;
    if (!a.active || a.size === 'small' || a.hp <= 0 || isTowed(a)) continue;
    if (a.y < 0 || a.y > py - 60) continue;
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function hook(w: World, e: Enemy, s: CraneSide, rock: Asteroid, p: P<typeof CRANE_P>): void {
  s.rock = rock;
  s.rockId = rock.id;
  towRock(w, rock, e.x, e.y + p.holdOy, p.k, e.vx, e.vy);
}

function fling(w: World, e: Enemy, s: CraneSide, rock: Asteroid, speed: number): void {
  const pl = w.player;
  // Aimed only from well above the ship (the fairness rule); otherwise it drops it.
  if (pl.alive && rock.y <= pl.y - 24) flingRock(w, rock, speed, pl.x, pl.y);
  else flingRock(w, rock, speed, rock.x, rock.y + 100);
  s.rock = null;
  s.rockId = -1;
  s.flungT = 0;
  sfx(w, 'boss_throw', e.x);
}

export function craneBehavior(w: World, e: Enemy, p: P<typeof CRANE_P>, dt: number): void {
  const s = craneSide(e);
  s.flungT += dt;
  if (e.state === 0) {
    if (e.ay <= 0) e.ay = w.rng.range(p.holdMin, p.holdMax);
    e.state = CraneState.Descend;
    rockInit.x = e.x;
    rockInit.y = e.y + p.holdOy;
    rockInit.vx = 0;
    rockInit.vy = p.descend;
    rockInit.hp = p.rockHp;
    const r = spawnRock(w, rockInit);
    if (r !== null) hook(w, e, s, r, p);
  }
  const stay = e.ax > 0 ? e.ax : p.leaveAfter;
  if (e.state !== CraneState.Leave && e.t >= stay) {
    const held = craneRock(e);
    if (held !== null) fling(w, e, s, held, p.flingSpeed);
    e.state = CraneState.Leave;
  }
  // Steering around its own catch would fight the tow; in terrain it must steer.
  e.avoidsAsteroids = e.state === CraneState.Leave || terrainActive(w);

  if (e.state === CraneState.Leave) {
    e.vx = 0;
    e.vy = p.exitVy;
    return;
  }
  if (e.state === CraneState.Descend) {
    e.vx = 0;
    e.vy = p.descend;
    if (e.y >= e.ay - 1) e.state = craneRock(e) !== null ? CraneState.Hold : CraneState.Snipe;
  } else {
    // Hold / Snipe: drift slowly toward the ship's x, spring back to the hold line.
    const pl = w.player;
    let vx = pl.alive ? (pl.x - e.x) * p.driftK : 0;
    vx = vx > p.drift ? p.drift : vx < -p.drift ? -p.drift : vx;
    if ((e.x <= MARGIN + 6 && vx < 0) || (e.x >= w.width - MARGIN - 6 && vx > 0)) vx = 0;
    e.vx = vx;
    const vy = (e.ay - e.y) * 3;
    e.vy = vy > p.descend ? p.descend : vy < -p.descend ? -p.descend : vy;
  }

  const rock = craneRock(e);
  if (rock !== null) {
    towRock(w, rock, e.x, e.y + p.holdOy, p.k, e.vx, e.vy);
    if (e.state !== CraneState.Hold) return;
    s.towT += dt;
    if (s.towT >= p.towTime && rock.y > 0) {
      fling(w, e, s, rock, p.flingSpeed);
      e.state = CraneState.Snipe;
      s.regrab = p.regrab;
      s.shotT = p.firstShot;
    }
    return;
  }
  if (s.rock !== null) {
    // Shot apart (or swallowed) on the hook.
    s.rock = null;
    s.rockId = -1;
    if (e.state === CraneState.Hold) {
      e.state = CraneState.Snipe;
      s.regrab = p.regrab;
      s.shotT = p.firstShot;
    }
  }
  if (e.state !== CraneState.Snipe) return;
  s.regrab -= dt;
  if (s.regrab <= 0) {
    const scrap = findScrap(w, e.x, e.y, p.range);
    if (scrap !== null) {
      hook(w, e, s, scrap, p);
      s.towT = 0;
      e.state = CraneState.Hold;
      return;
    }
  }
  s.shotT -= dt;
  if (s.shotT > 0) return;
  s.shotT = p.interval;
  if (canFire(w, e) && aimed(w, e.x, muzzleY(e) + 6, 1, 0, p.shotSpeed, SHOT_SMALL) > 0)
    emitEnemyShotSfx(w, e.x);
}

const sprOpts: SpriteOpts = { frame: 0, flash: false };

/** Crane: the trolley (glowing hook before a fling) and its tow beam. */
export function drawCrane(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const hot = craneHot(e);
  sprOpts.frame =
    (hot ? CRANE_FRAMES.hot : CRANE_FRAMES.idle) + (Math.floor(w.time * 4 + e.id) & 1);
  sprOpts.flash = e.flashT > 0;
  r.sprite(FD_SPRITES.crane, x, y, sprOpts);
  const rock = craneRock(e);
  if (rock !== null) drawTractorBeam(r, x, y + 9, rock.x, rock.y, w.time);
}

// ---------------------------------------------------------------------------
// Sentinel: descends to a hold line, turns toward the ship at `turn` rad/s,
// a 120° shield over its front, 3-way fans along its facing.

export const SentinelState = {
  Descend: 1,
  Hold: 2,
  Leave: 3,
} as const;

interface SentinelSide {
  id: number;
  /** Facing, radians (0 = right, π/2 = down). */
  facing: number;
  /** Seconds since the shield last stopped a shot. */
  blockT: number;
  blockX: number;
  blockY: number;
}

const sentinels = new WeakMap<Enemy, SentinelSide>();

export function sentinelSide(e: Enemy): SentinelSide {
  let s = sentinels.get(e);
  if (s === undefined) {
    s = { id: -1, facing: Math.PI / 2, blockT: 9, blockX: 0, blockY: 0 };
    sentinels.set(e, s);
  }
  if (s.id !== e.id) {
    s.id = e.id;
    s.facing = Math.PI / 2;
    s.blockT = 9;
  }
  return s;
}

/** Turns `from` toward `to` by at most `max` radians. */
export function turnToward(from: number, to: number, max: number): number {
  const d = wrapAngle(to - from);
  return wrapAngle(from + (d > max ? max : d < -max ? -max : d));
}

export function sentinelBehavior(w: World, e: Enemy, p: P<typeof SENTINEL_P>, dt: number): void {
  const s = sentinelSide(e);
  s.blockT += dt;
  if (e.state === 0) {
    if (e.ay <= 0) e.ay = w.rng.range(p.holdMin, p.holdMax);
    e.state = SentinelState.Descend;
    e.fireT = p.firstDelay;
    e.ax = e.x;
  }
  const pl = w.player;
  if (pl.alive) s.facing = turnToward(s.facing, Math.atan2(pl.y - e.y, pl.x - e.x), p.turn * dt);
  if (e.state !== SentinelState.Leave && e.t >= p.leaveAfter) e.state = SentinelState.Leave;
  switch (e.state) {
    case SentinelState.Descend:
      e.vx = 0;
      e.vy = p.descend;
      if (e.y >= e.ay - 1) e.state = SentinelState.Hold;
      return;
    case SentinelState.Leave:
      e.vx = 0;
      e.vy = p.exitVy;
      return;
  }
  e.vx = Math.cos(e.t * p.swayHz * TAU) * p.sway;
  if ((e.x <= MARGIN && e.vx < 0) || (e.x >= w.width - MARGIN && e.vx > 0)) e.vx = 0;
  e.vy = (e.ay - e.y) * 3;
  e.fireT -= dt;
  if (e.fireT > 0) return;
  e.fireT = p.interval;
  if (!canFire(w, e)) return;
  const bearing = Math.atan2(pl.y - e.y, pl.x - e.x);
  if (Math.abs(wrapAngle(bearing - s.facing)) > p.maxOffAim * DEG) return;
  const mx = e.x + Math.cos(s.facing) * (e.r + 3);
  const my = e.y + Math.sin(s.facing) * (e.r + 3);
  const deg = s.facing / DEG;
  const step = p.n > 1 ? p.spreadDeg / (p.n - 1) : 0;
  let n = 0;
  for (let i = 0; i < p.n; i++)
    n += shootDir(w, mx, my, deg - p.spreadDeg / 2 + step * i, p.shotSpeed, SHOT_SMALL);
  if (n > 0) emitEnemyShotSfx(w, e.x);
}

/**
 * True when a shot that came from (fromX, fromY) meets the sentinel's shield:
 * its approach point lies within `shieldHalf` of the facing.
 */
export function shieldCovers(
  e: Enemy,
  facing: number,
  fromX: number,
  fromY: number,
  p: P<typeof SENTINEL_P> = SENTINEL_P,
): boolean {
  const a = Math.atan2(fromY - e.y, fromX - e.x);
  return Math.abs(wrapAngle(a - facing)) <= p.shieldHalf * DEG;
}

let pingT = -1;

/**
 * Collision pass (before the broad phase): player shots entering a sentinel's
 * shield radius from the front are stopped. Shots from the flanks and the
 * back reach the hull as usual; Arc Coil never makes a shot at all.
 */
export function sentinelShieldPass(w: World, dt: number): void {
  const items = w.enemies.items;
  const shots = w.playerShots;
  pingT -= dt;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i] as Enemy;
    if (!e.active || e.defId !== 'fd_sentinel') continue;
    const s = sentinelSide(e);
    const R = e.r + SENTINEL_P.shieldPad;
    const sh = shots.items;
    for (let j = 0; j < shots.count; j++) {
      const b = sh[j] as Bullet;
      if (!b.active) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const rr = R + b.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (!shieldCovers(e, s.facing, b.prevX, b.prevY)) continue;
      s.blockT = 0;
      s.blockX = b.x;
      s.blockY = b.y;
      shots.release(b);
      if (pingT <= 0) {
        pingT = 0.12;
        sfx(w, 'armor_ping', e.x);
      }
    }
  }
}

const ARC_STEPS = 13;

/** Sentinel: hull, barrel along the facing, and the shield arc (bright for a beat after a block). */
export function drawSentinel(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const s = sentinelSide(e);
  sprOpts.frame = Math.floor(w.time * 3 + e.id) & 1;
  sprOpts.flash = e.flashT > 0;
  r.sprite(FD_SPRITES.sentinel, x, y, sprOpts);
  const fx = Math.cos(s.facing);
  const fy = Math.sin(s.facing);
  // Barrel: 2 px wide, 5 long, a hot muzzle when about to fire.
  for (let k = 7; k <= 12; k++) {
    const bx = Math.round(x + fx * k);
    const by = Math.round(y + fy * k);
    r.rect(bx, by, 2, 2, k === 12 && e.fireT < 0.3 ? MOLTEN5Hex.hot : STEELHex.light);
  }
  const R = e.r + SENTINEL_P.shieldPad + 1;
  const half = SENTINEL_P.shieldHalf * DEG;
  const bright = s.blockT < 0.12;
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = s.facing - half + (2 * half * i) / ARC_STEPS;
    const px = Math.round(x + Math.cos(a) * R);
    const py = Math.round(y + Math.sin(a) * R);
    const edge = i === 0 || i === ARC_STEPS;
    r.rect(px, py, 1, 1, bright ? '#f8f8f8' : edge ? TOWHex.base : TOWHex.light);
    if (!edge && (i + Math.floor(w.time * 10)) % 4 === 0) r.rect(px, py, 1, 1, TOWHex.hot);
  }
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
const MOLTEN5Hex = { hot: hex(MOLTEN5[4]) };
const STEELHex = { light: hex(STEEL5[3]) };
const TOWHex = { base: hex(TOW5[2]), light: hex(TOW5[3]), hot: hex(TOW5[4]) };
