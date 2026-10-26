import { BAR, STREAKER_MIN_DX } from '../../../content/levels/pulsarNursery';
import { OFFSCREEN_MARGIN } from '../../../sim/cleanup';
import { spawnEnemy } from '../../../sim/spawn';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import {
  aimAt,
  canFire,
  emitEnemyShotSfx,
  muzzleY,
  ring,
  shootDir,
  SHOT_SMALL,
} from '../../enemies';
import { pulsarGlow, pulseIndex } from '../../obstacles';

// Sector 4 behaviors. Each keeps its extra per-entity state in a side record
// (pool slots are permanent, so one record per slot, reset on a new id).

const DEG = Math.PI / 180;

/** Per-entity scratch beyond Enemy's ax/ay/state/fireT. Fields are per behavior. */
export interface NurseryMem {
  id: number;
  /** Drone: 0..1 charge glow before a ring. Ray: 0..1 telegraph progress. */
  charge: number;
  /** Drone: tracked pulsar id (-1 = on the song's bar). */
  track: number;
  /** Drone: last pulse / bar index seen. */
  last: number;
  /** Drone: seconds since the last ring; ray: seconds in the current beam phase. */
  since: number;
  /** Drone: rings fired. Ray: beam cycles started. */
  count: number;
  /** Streaker: launch tilt, degrees. Ray: beam phase (0 off, 1 telegraph, 2 on). */
  a: number;
  /** Ray: fan side (+1 / -1), the far edge and the near edge (degrees). */
  side: number;
  far: number;
  near: number;
  /** Ray: seconds to the next beam bullet. */
  emitT: number;
}

const mems = new WeakMap<Enemy, NurseryMem>();

export function mem(e: Enemy): NurseryMem {
  let m = mems.get(e);
  if (m === undefined) {
    m = {
      id: -1,
      charge: 0,
      track: -1,
      last: 0,
      since: 0,
      count: 0,
      a: 0,
      side: 1,
      far: 90,
      near: 90,
      emitT: 0,
    };
    mems.set(e, m);
  }
  if (m.id !== e.id) {
    m.id = e.id;
    m.charge = 0;
    m.track = -1;
    m.last = 0;
    m.since = 0;
    m.count = 0;
    m.a = 0;
    m.side = 1;
    m.far = 90;
    m.near = 90;
    m.emitT = 0;
  }
  return m;
}

type P = Readonly<Record<string, number>>;

// ---------------------------------------------------------------------------
// Pulse Drone: drifts down; a 10-shot ring on each pulse of the nearest pulsar
// (pulsars are placed on the song's grid), or on the song's bar with none near.

function nearestPulsar(w: World, x: number, y: number, reach: number): Anomaly | null {
  const items = w.anomalies.items;
  let best: Anomaly | null = null;
  let bd = reach * reach;
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = items[i] as Anomaly;
    if (!a.active || a.kind !== 'pulsar') continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

export function droneBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const m = mem(e);
  if (e.state === 0) {
    e.state = 1;
    m.since = p.minGap as number;
    m.last = Math.floor(w.time / BAR);
  }
  e.vy = p.vy as number;
  e.vx = Math.sin(e.t * 1.3 + e.id) * 6;
  m.since += dt;

  const a = nearestPulsar(w, e.x, e.y, p.reach as number);
  let beat = false;
  if (a !== null) {
    const k = pulseIndex(a);
    // A new pulsar to follow: remember where its count is, don't fire on the switch.
    if (a.id !== m.track) m.track = a.id;
    else if (k !== m.last) beat = true;
    m.last = k;
    m.charge = pulsarGlow(a);
  } else {
    const bar = Math.floor(w.time / BAR);
    if (m.track !== -1) m.track = -1;
    else if (bar !== m.last) beat = true;
    m.last = bar;
    const left = BAR - (w.time - bar * BAR);
    const ch = p.charge as number;
    m.charge = left < ch ? 1 - left / ch : 0;
  }
  if (e.y > (p.maxY as number)) m.charge = 0;
  // It falls silent in the lower field: the rings are for reading from a distance.
  if (beat && m.since >= (p.minGap as number) && e.y <= (p.maxY as number) && canFire(w, e)) {
    const rot = (m.count & 1) * (180 / (p.n as number));
    if (ring(w, e.x, e.y, p.n as number, p.speed as number, rot, SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, e.x);
    m.count++;
    m.since = 0;
  }
}

// ---------------------------------------------------------------------------
// Streaker: waits just under the bottom edge behind a blinking chevron
// (`warn` s), then rockets up at ±tilt°, firing one aimed shot crossing shotY.

/** Spawn y: just below the playfield, inside the cull margin. */
export function streakerLurkY(r: number): number {
  return 400 + OFFSCREEN_MARGIN + r - 2;
}

export function streakerBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const m = mem(e);
  if (e.state === 0) {
    e.state = 1;
    const tilt = p.tilt as number;
    // A spawner may pass the tilt in `ax`; otherwise lean toward mid-screen so
    // it is still on screen (and can fire) when it crosses shotY.
    m.a = e.ax !== 0 ? Math.max(-tilt, Math.min(tilt, e.ax)) : e.x < w.width / 2 ? tilt : -tilt;
    // A spawn `fireT` staggers a group: it adds to the warning time.
    e.fireT = (p.warn as number) + Math.max(0, e.fireT);
    e.y = e.prevY = streakerLurkY(e.r);
  }
  if (e.state === 1) {
    e.vx = 0;
    e.vy = 0;
    e.fireT -= dt;
    if (e.fireT > 0) return;
    e.state = 2;
  }
  const s = p.speed as number;
  e.vx = Math.sin(m.a * DEG) * s;
  e.vy = -Math.cos(m.a * DEG) * s;
  if (e.state === 2) {
    const y0 = p.shotY as number;
    if (e.y > y0 && e.y + e.vy * dt <= y0) {
      e.state = 3;
      if (canFire(w, e)) {
        shootDir(w, e.x, e.y, aimAt(w, e.x, e.y), p.shotSpeed as number, SHOT_SMALL);
        emitEnemyShotSfx(w, e.x);
      }
    }
  }
}

/** Picks a launch x at least STREAKER_MIN_DX from the player (world.rng), inside the edges. */
export function streakerX(w: World, margin = 16): number {
  const px = w.player.x;
  const lo = margin;
  const hi = w.width - margin;
  // Two candidate spans, left and right of the player's exclusion band.
  const l1 = px - STREAKER_MIN_DX - lo;
  const r1 = hi - (px + STREAKER_MIN_DX);
  const left = Math.max(0, l1);
  const right = Math.max(0, r1);
  if (left + right <= 0) return px < w.width / 2 ? hi : lo;
  const u = w.rng.next() * (left + right);
  return u < left ? lo + u : px + STREAKER_MIN_DX + (u - left);
}

const streakerInit = { fireT: 0 };

/** Launches `n` streakers from the bottom edge, 0.35 s apart (level script and sandbox). */
export function spawnStreakers(w: World, n: number): number {
  let made = 0;
  for (let i = 0; i < n; i++) {
    streakerInit.fireT = i * STREAKER_STAGGER;
    if (spawnEnemy(w, 'pn_streaker', streakerX(w), streakerLurkY(6), streakerInit) === null) break;
    made++;
  }
  return made;
}

// ---------------------------------------------------------------------------
// Warden Ray: descends, holds near the top and sweeps a beam (a line of shots
// every `gap` s). Each cycle locks a fan beside the player's bearing during
// the telegraph (both edges drawn), then sweeps from the far edge in toward
// the near edge, which stops `lead`° short of where the player was.

const STREAKER_STAGGER = 0.35;
const RAY_MIN_DEG = 22;
const RAY_MAX_DEG = 158;

function lockFan(w: World, e: Enemy, m: NurseryMem, p: P): void {
  const aim = Math.max(RAY_MIN_DEG, Math.min(RAY_MAX_DEG, aimAt(w, e.x, muzzleY(e))));
  const lead = p.lead as number;
  const sweep = p.sweep as number;
  // Alternate sides; flip when the far edge would leave the lower half.
  let side = m.count & 1 ? -1 : 1;
  const far = (s: number) => aim + s * (lead + sweep);
  if (far(side) > RAY_MAX_DEG || far(side) < RAY_MIN_DEG) side = -side;
  m.side = side;
  m.near = Math.max(RAY_MIN_DEG, Math.min(RAY_MAX_DEG, aim + side * lead));
  m.far = Math.max(RAY_MIN_DEG, Math.min(RAY_MAX_DEG, far(side)));
  m.count++;
}

/** Current beam heading while on (degrees). */
export function rayHeading(m: NurseryMem, onT: number, on: number): number {
  const k = Math.min(1, Math.max(0, onT / on));
  return m.far + (m.near - m.far) * k;
}

export const RayPhase = { Off: 0, Telegraph: 1, On: 2 } as const;

export function rayBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const m = mem(e);
  if (e.state === 0) {
    e.state = 1;
    if (e.ay <= 0) e.ay = p.holdY as number;
    m.a = RayPhase.Off;
    m.since = (p.off as number) - (p.firstDelay as number);
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
    m.a = RayPhase.Off;
    return;
  }
  m.since += dt;
  e.vy = (e.ay - e.y) * 2;
  if (m.a === RayPhase.Off) {
    // Only drift while the beam is idle, so a locked fan stays where it was drawn.
    const dx = w.player.x - e.x;
    const d = p.drift as number;
    e.vx = Math.max(-d, Math.min(d, dx * 0.8));
    m.charge = 0;
    if (e.t >= (p.leaveAfter as number)) {
      e.state = 3;
      return;
    }
    if (m.since >= (p.off as number) && canFire(w, e)) {
      lockFan(w, e, m, p);
      m.a = RayPhase.Telegraph;
      m.since = 0;
    }
    return;
  }
  e.vx = 0;
  if (m.a === RayPhase.Telegraph) {
    m.charge = m.since / (p.telegraph as number);
    if (m.since >= (p.telegraph as number)) {
      m.a = RayPhase.On;
      m.since = 0;
      m.emitT = 0;
      m.charge = 1;
    }
    return;
  }
  // On: one shot every `gap` s along the sweeping heading.
  const on = p.on as number;
  m.emitT -= dt;
  while (m.emitT <= 0 && m.since <= on) {
    if (canFire(w, e)) {
      shootDir(w, e.x, muzzleY(e), rayHeading(m, m.since, on), p.speed as number, SHOT_SMALL);
      // One quiet sfx per three beam shots, not per bullet.
      if (Math.round(m.since / (p.gap as number)) % 3 === 0) emitEnemyShotSfx(w, e.x);
    }
    m.emitT += p.gap as number;
  }
  if (m.since >= on) {
    m.a = RayPhase.Off;
    m.since = 0;
    m.charge = 0;
  }
}
