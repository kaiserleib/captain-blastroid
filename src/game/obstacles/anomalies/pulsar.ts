import { PULSAR } from '../../../content/obstacles';
import { damagePlayer } from '../../../sim/damage';
import { spawnAnomaly } from '../../../sim/spawn';
import type { Anomaly, PlayerState } from '../../../sim/types';
import type { World } from '../../../sim/world';
import type { AnomalyPlacement } from './blackhole';

// Timeline: pulse k fires at t = k * period (k >= 1), and the glow runs for
// `telegraph` seconds before it. Only one ring is out at a time as long as
// maxRadius < period * ringSpeed.

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

/** `radius` holds the ring's max radius and `strength` its speed. */
export function spawnPulsar(w: World, x: number, y: number, o?: AnomalyPlacement): Anomaly | null {
  init.kind = 'pulsar';
  init.x = x;
  init.y = y;
  init.r = PULSAR.r;
  init.radius = PULSAR.maxRadius;
  init.strength = PULSAR.ringSpeed;
  init.vx = o?.vx ?? 0;
  init.vy = o?.vy ?? w.scrollSpeed;
  return spawnAnomaly(w, init);
}

/** Index of the latest pulse (0 = none fired yet). */
export function pulseIndex(a: Anomaly): number {
  return Math.floor(a.t / PULSAR.period);
}

/** Current ring radius, or -1 when no ring is out. */
export function pulsarRingRadius(a: Anomaly): number {
  const k = pulseIndex(a);
  if (k < 1) return -1;
  const R = a.r + (a.t - k * PULSAR.period) * a.strength;
  return R <= a.radius ? R : -1;
}

/** Telegraph progress 0..1 (0 = not glowing). */
export function pulsarGlow(a: Anomaly): number {
  const start = PULSAR.period - PULSAR.telegraph;
  const ph = a.t - pulseIndex(a) * PULSAR.period;
  return ph >= start ? (ph - start) / PULSAR.telegraph : 0;
}

// Pool slots are permanent objects, so per-slot state is allocated once and
// reset whenever the slot holds a new entity id.
const hitState = new WeakMap<Anomaly, { id: number; pulse: number }>();

/** Ring vs player: one hit chance per pulse, while the band overlaps the ship. */
export function updatePulsar(w: World, a: Anomaly, _dt: number): void {
  const R = pulsarRingRadius(a);
  if (R < 0) return;
  const p = w.player;
  if (!p.alive) return;
  const d = Math.hypot(p.x - a.x, p.y - a.y);
  if (Math.abs(d - R) > PULSAR.ringThickness / 2 + p.r) return;
  let st = hitState.get(a);
  if (!st) hitState.set(a, (st = { id: -1, pulse: 0 }));
  if (st.id !== a.id) {
    st.id = a.id;
    st.pulse = 0;
  }
  const k = pulseIndex(a);
  if (st.pulse === k) return;
  st.pulse = k;
  damagePlayer(w, PULSAR.damage);
}

export function pulsarContact(w: World, _a: Anomaly, _p: PlayerState): void {
  damagePlayer(w, PULSAR.contactDamage);
}
