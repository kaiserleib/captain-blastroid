import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { aimAt, canFire, emitEnemyShotSfx, muzzleY, shootDir, SHOT_SMALL } from '../../enemies';
import {
  flarePhase,
  flareState,
  isFlareBurning,
  nearestShadeSpot,
  type ShadeSpot,
} from '../../obstacles';

// Sector 6 behaviors. Extra per-entity state lives in a side record (pool
// slots are permanent, so one record per slot, reset on a new id).

const DEG = Math.PI / 180;

type P = Readonly<Record<string, number>>;

/** Per-entity scratch beyond Enemy's ax/ay/state/fireT. */
export interface CoronaMem {
  id: number;
  /** Skimmer: shot fired. Lens: beam phase (LensPhase). */
  phase: number;
  /** Seconds in the current phase. */
  since: number;
  /** Lens: locked beam heading, degrees. */
  heading: number;
  /** Lens: flare count it last answered (one beam per burn). */
  flare: number;
  /** Lens: seconds to the next beam shot. */
  emitT: number;
  /** Shade: whether it holds a strip now (for the draw). */
  tucked: boolean;
  /** Shade: the strip spot it steers to. */
  readonly spot: ShadeSpot;
}

const mems = new WeakMap<Enemy, CoronaMem>();

export function mem(e: Enemy): CoronaMem {
  let m = mems.get(e);
  if (m === undefined) {
    m = {
      id: -1,
      phase: 0,
      since: 0,
      heading: 90,
      flare: -1,
      emitT: 0,
      tucked: false,
      spot: { x: 0, y: 0, d: 0 },
    };
    mems.set(e, m);
  }
  if (m.id !== e.id) {
    m.id = e.id;
    m.phase = 0;
    m.since = 0;
    m.heading = 90;
    m.flare = -1;
    m.emitT = 0;
    m.tucked = false;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Sunskimmer: a fast diagonal pass from its side of the screen toward the
// other, ×burnMul while a flare burns (it is immune to them). One aimed shot
// as it crosses the middle.

export function skimmerBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const m = mem(e);
  if (e.state === 0) {
    e.state = 1;
    // ax: the direction across (+1 = rightward).
    e.ax = e.x < w.width / 2 ? 1 : -1;
  }
  const mul = isFlareBurning(w) ? (p.burnMul as number) : 1;
  const a = (p.dive as number) * DEG;
  const s = (p.speed as number) * mul;
  e.vx = Math.cos(a) * s * e.ax;
  e.vy = Math.sin(a) * s;
  if (m.phase === 0) {
    const mid = w.width / 2;
    const nx = e.x + e.vx * dt;
    if ((e.x - mid) * e.ax <= 0 && (nx - mid) * e.ax > 0) {
      m.phase = 1;
      if (canFire(w, e)) {
        shootDir(w, e.x, muzzleY(e), aimAt(w, e.x, muzzleY(e)), p.shotSpeed as number, SHOT_SMALL);
        emitEnemyShotSfx(w, e.x);
      }
    }
  }
}

/** Heading of a skimmer in radians off nose-down (its sprite is painted nose-down). */
export function skimmerRot(e: Enemy): number {
  return Math.atan2(e.vy, e.vx) - Math.PI / 2;
}

// ---------------------------------------------------------------------------
// Shade: descends, then tucks into the nearest shadow strip high enough up the
// screen and holds it as it drifts, competing with the player for cover. Its
// aimed pair is the def's `fire`. Leaves after `leaveAfter` s.

export const ShadeState = { Spawn: 0, Descend: 1, Hunt: 2, Leave: 3 } as const;

export function shadeBehavior(w: World, e: Enemy, p: P, _dt: number): void {
  const m = mem(e);
  if (e.state === ShadeState.Spawn) e.state = ShadeState.Descend;
  if (e.state !== ShadeState.Leave && e.t >= (p.leaveAfter as number)) e.state = ShadeState.Leave;
  if (e.state === ShadeState.Leave) {
    m.tucked = false;
    e.vx *= 0.9;
    e.vy = p.exitVy as number;
    return;
  }
  const tuck = p.tuck as number;
  // Strips are only worth taking once it is on screen.
  if (e.y > 0) {
    const found = nearestShadeSpot(w, e.x, e.y, e.r, m.spot, p.pad as number, p.reach as number);
    if (found && m.spot.y <= (p.maxY as number)) {
      e.state = ShadeState.Hunt;
      const dx = m.spot.x - e.x;
      const dy = m.spot.y - e.y;
      e.vx = Math.max(-tuck, Math.min(tuck, dx * 3));
      // Strips drift with their casters: ride along with the scroll, then close in.
      e.vy = Math.max(-tuck, Math.min(tuck + w.scrollSpeed, dy * 3 + w.scrollSpeed));
      m.tucked = Math.abs(dx) < 3 && Math.abs(dy) < 3;
      return;
    }
  }
  m.tucked = false;
  const holdY = p.holdY as number;
  if (e.state === ShadeState.Descend && e.y < holdY) {
    e.vx = 0;
    e.vy = p.descend as number;
    return;
  }
  e.state = ShadeState.Hunt;
  // No strip in reach: hover, sliding gently.
  e.vy = (holdY - e.y) * 2;
  e.vx = Math.sin(e.t * 0.9 + e.id) * 18;
}

// ---------------------------------------------------------------------------
// Lens Drone: holds near the top. On each damaging burn it focuses the light:
// the aim locks at the burn's start (the telegraph line, `telegraph` s), then
// a beam, a dense line of shots along that line for `beam` s.

export const LensPhase = { Idle: 0, Telegraph: 1, Beam: 2 } as const;

export function lensBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const m = mem(e);
  if (e.state === 0) {
    e.state = 1;
    if (e.ay <= 0) e.ay = p.holdY as number;
    const f = flareState(w);
    // A burn already under way when it arrives doesn't count.
    m.flare = f !== undefined && f.phase === 'burn' ? f.count : -1;
  }
  if (e.state === 1) {
    e.vx = 0;
    e.vy = p.descend as number;
    if (e.y >= e.ay) {
      e.state = 2;
      e.vy = 0;
    }
    return;
  }
  if (e.state === 3) {
    e.vx = 0;
    e.vy = p.exitVy as number;
    m.phase = LensPhase.Idle;
    return;
  }
  m.since += dt;
  e.vy = (e.ay - e.y) * 2;
  if (m.phase === LensPhase.Idle) {
    const dx = w.player.x - e.x;
    const d = p.drift as number;
    e.vx = Math.max(-d, Math.min(d, dx * 0.8));
    const f = flareState(w);
    if (
      flarePhase(w) === 'burn' &&
      f !== undefined &&
      !f.practice &&
      f.count !== m.flare &&
      canFire(w, e)
    ) {
      m.flare = f.count;
      m.heading = aimAt(w, e.x, muzzleY(e));
      m.phase = LensPhase.Telegraph;
      m.since = 0;
      return;
    }
    if (e.t >= (p.leaveAfter as number)) e.state = 3;
    return;
  }
  e.vx = 0;
  if (m.phase === LensPhase.Telegraph) {
    if (m.since < (p.telegraph as number)) return;
    m.phase = LensPhase.Beam;
    m.since = 0;
    m.emitT = 0;
  }
  const beam = p.beam as number;
  m.emitT -= dt;
  let n = 0;
  while (m.emitT <= 0 && m.since <= beam) {
    if (canFire(w, e)) n += shootDir(w, e.x, muzzleY(e), m.heading, p.speed as number, SHOT_SMALL);
    m.emitT += p.gap as number;
  }
  if (n > 0 && Math.round(m.since / (p.gap as number)) % 4 === 0) emitEnemyShotSfx(w, e.x);
  if (m.since >= beam) {
    m.phase = LensPhase.Idle;
    m.since = 0;
  }
}

/** 0..1 through the lens telegraph (1 while beaming), for the draw. */
export function lensCharge(e: Enemy, telegraph: number): number {
  const m = mem(e);
  if (m.phase === LensPhase.Beam) return 1;
  if (m.phase !== LensPhase.Telegraph) return 0;
  return Math.min(1, m.since / telegraph);
}
