import { PULSAR, PULSAR_DOUBLE_DELAY, PULSAR_VARIANTS } from '../../../content/obstacles';
import { damagePlayer } from '../../../sim/damage';
import { spawnAnomaly } from '../../../sim/spawn';
import type { Anomaly, PlayerState } from '../../../sim/types';
import type { World } from '../../../sim/world';
import type { AnomalyPlacement } from './blackhole';
import { DEG, ext, initExt, pulsarVariantId, type AnomalyExt } from './state';

// Each pulsar runs its own pulse clock (in the side table): a pulse fires each
// time the clock reaches `period`, the glow runs for `telegraph` seconds
// before it, and the ring expands from the core until `maxRadius`. A clock
// rather than `a.t / period` lets the boss change the period mid-fight.
// Only one ring (plus its `double` echo) is out at a time.

const init = {
  kind: 'pulsar' as Anomaly['kind'],
  x: 0,
  y: 0,
  r: 0,
  radius: 0,
  strength: 0,
  vx: 0,
  vy: 0,
};

/**
 * `radius` holds the ring's max radius and `strength` its speed. `phase`
 * pre-runs the pulse clock (whole pulses included), so a timeline can lock
 * rings to the music.
 */
export function spawnPulsar(w: World, x: number, y: number, o?: AnomalyPlacement): Anomaly | null {
  const v = PULSAR_VARIANTS[pulsarVariantId(o?.variant)];
  init.kind = 'pulsar';
  init.x = x;
  init.y = y;
  init.r = PULSAR.r;
  init.radius = v.maxRadius;
  init.strength = v.ringSpeed;
  init.vx = o?.vx ?? 0;
  init.vy = o?.vy ?? w.scrollSpeed;
  const a = spawnAnomaly(w, init);
  if (a === null) return null;
  const e = ext(a);
  initExt(e, a, o?.variant);
  const phase = o?.phase ?? 0;
  if (phase > 0) {
    e.clock = phase;
    firePulses(e);
    // Rings already out at spawn can't hit retroactively.
    e.hitPulse = e.hitPulse2 = e.pulse;
  }
  return a;
}

export interface PulsarPattern {
  period: number;
  gaps: number;
  gapDeg: number;
  gapSpin: number;
  /** A second ring 0.5 s after each pulse, its gaps turned by half a gap width. */
  double?: boolean;
  /** Optional overrides; default: unchanged. */
  telegraph?: number;
  ringSpeed?: number;
}

/**
 * Reprograms a pulsar (the Magnetar boss, per phase). Takes effect from the
 * next pulse; the pulse clock keeps running, so a shorter period may fire the
 * next pulse right away.
 */
export function setPulsarPattern(a: Anomaly, p: PulsarPattern): void {
  const e = ext(a);
  e.period = p.period > 0.05 ? p.period : 0.05;
  e.gaps = p.gaps > 0 ? Math.floor(p.gaps) : 0;
  e.gapW = p.gapDeg * DEG;
  e.gapSpin = p.gapSpin * DEG;
  e.double = p.double === true;
  if (p.telegraph !== undefined) e.telegraph = p.telegraph;
  if (p.ringSpeed !== undefined) a.strength = p.ringSpeed;
}

function firePulses(e: AnomalyExt): void {
  while (e.clock >= e.period) {
    e.clock -= e.period;
    e.pulse++;
    e.ringRot = e.nextRot;
    e.nextRot = wrap(e.nextRot + e.gapSpin);
  }
}

function wrap(ang: number): number {
  const TAU = Math.PI * 2;
  ang %= TAU;
  return ang < 0 ? ang + TAU : ang;
}

/** Index of the latest pulse (0 = none fired yet). */
export function pulseIndex(a: Anomaly): number {
  return ext(a).pulse;
}

/** Current ring radius, or -1 when no ring is out. */
export function pulsarRingRadius(a: Anomaly): number {
  const e = ext(a);
  if (e.pulse < 1) return -1;
  const R = a.r + e.clock * a.strength;
  return R <= a.radius ? R : -1;
}

/** The `double` echo ring's radius, or -1. */
export function pulsarEchoRadius(a: Anomaly): number {
  const e = ext(a);
  if (!e.double || e.pulse < 1 || e.clock < PULSAR_DOUBLE_DELAY) return -1;
  const R = a.r + (e.clock - PULSAR_DOUBLE_DELAY) * a.strength;
  return R <= a.radius ? R : -1;
}

/** Telegraph progress 0..1 (0 = not glowing). Never glows while collapsing. */
export function pulsarGlow(a: Anomaly): number {
  const e = ext(a);
  if (e.collapseDur > 0 || e.telegraph <= 0) return 0;
  const start = e.period - e.telegraph;
  return e.clock >= start ? Math.min(1, (e.clock - start) / e.telegraph) : 0;
}

/** Gap rotation (radians) of the live ring, its echo, and the telegraphed next pulse. */
export function pulsarRingRot(a: Anomaly): number {
  return ext(a).ringRot;
}
export function pulsarEchoRot(a: Anomaly): number {
  const e = ext(a);
  return e.ringRot + e.gapW / 2;
}
export function pulsarNextRot(a: Anomaly): number {
  return ext(a).nextRot;
}

export function pulsarGapCount(a: Anomaly): number {
  return ext(a).gaps;
}

/** Gap width in radians. */
export function pulsarGapWidth(a: Anomaly): number {
  return ext(a).gapW;
}

/**
 * Writes the gap center angles (radians, canvas y down) into `out` and returns
 * how many. While the telegraph glows these are the *next* pulse's gaps;
 * otherwise the live ring's. `out` needs room for the gap count (≤ 8 is plenty).
 */
export function pulsarGapAngles(a: Anomaly, out: number[]): number {
  const e = ext(a);
  const rot = pulsarGlow(a) > 0 ? e.nextRot : e.ringRot;
  return gapAnglesAt(e.gaps, rot, out);
}

export function gapAnglesAt(gaps: number, rot: number, out: number[]): number {
  const step = gaps > 0 ? (Math.PI * 2) / gaps : 0;
  for (let i = 0; i < gaps; i++) out[i] = wrap(rot + i * step);
  return gaps;
}

/**
 * Pure gap test: is a body of radius `br` at offset (dx, dy) from the core
 * wholly inside one of `gaps` evenly spaced gaps of width `gapW` (radians),
 * the first centered on `rot`? The body's angular half-width at its distance
 * is asin(br / d), so a ship near the core needs a wider gap than one far out.
 */
export function inPulsarGap(
  dx: number,
  dy: number,
  br: number,
  gaps: number,
  gapW: number,
  rot: number,
): boolean {
  if (gaps <= 0 || gapW <= 0) return false;
  const d = Math.hypot(dx, dy);
  if (d <= br) return false;
  const half = Math.asin(br / d);
  const room = gapW / 2 - half;
  if (room < 0) return false;
  const step = (Math.PI * 2) / gaps;
  // Angle from the first gap center, folded into one gap period.
  let rel = (Math.atan2(dy, dx) - rot) % step;
  if (rel < 0) rel += step;
  const off = rel > step / 2 ? step - rel : rel;
  return off <= room;
}

/** Rings vs player: one hit chance per ring per pulse, only where the ring is solid. */
export function updatePulsar(w: World, a: Anomaly, dt: number): void {
  const e = ext(a);
  e.clock += dt;
  if (e.collapseDur <= 0) firePulses(e);
  const p = w.player;
  if (!p.alive || e.pulse < 1) return;
  const dx = p.x - a.x;
  const dy = p.y - a.y;
  const d = Math.hypot(dx, dy);
  const band = PULSAR.ringThickness / 2 + p.r;
  if (e.hitPulse !== e.pulse) {
    const R = pulsarRingRadius(a);
    if (R >= 0 && Math.abs(d - R) <= band && !inPulsarGap(dx, dy, p.r, e.gaps, e.gapW, e.ringRot)) {
      e.hitPulse = e.pulse;
      damagePlayer(w, PULSAR.damage);
    }
  }
  if (e.double && e.hitPulse2 !== e.pulse) {
    const R2 = pulsarEchoRadius(a);
    if (
      R2 >= 0 &&
      Math.abs(d - R2) <= band &&
      !inPulsarGap(dx, dy, p.r, e.gaps, e.gapW, e.ringRot + e.gapW / 2)
    ) {
      e.hitPulse2 = e.pulse;
      damagePlayer(w, PULSAR.damage);
    }
  }
}

export function pulsarContact(w: World, _a: Anomaly, _p: PlayerState): void {
  damagePlayer(w, PULSAR.contactDamage);
}
