// What just hit the ship, read from the world on `playerHit`. The sim bots' balance
// tables and the player-facing run log use the same names so their numbers compare.
import { PORTAL, PULSAR } from '../../content/obstacles';
import {
  bubbleTimeScale,
  flareState,
  inPulsarGap,
  pulsarEchoRadius,
  pulsarEchoRot,
  pulsarGapCount,
  pulsarGapWidth,
  pulsarRingRadius,
  pulsarRingRot,
  sinceShipPorted,
} from '../obstacles';
import { lastCrushTick } from '../terrain';
import type { Anomaly, Asteroid, Bullet, Enemy } from '../../sim/types';
import type { World } from '../../sim/world';

/**
 * Act II hazards, or null: `flare` (the burn's hit), `portal` (within the ship's
 * portal cooldown) and `bubble-shot` (the nearest enemy shot was in a time bubble).
 */
export function hazardsIIHitCause(w: World): string | null {
  const f = flareState(w);
  if (f !== undefined && f.hitTick === w.tick) return 'flare';
  if (sinceShipPorted(w) < PORTAL.shipCooldown) return 'portal';
  const p = w.player;
  let best = Infinity;
  let nearest: Bullet | null = null;
  for (let i = 0; i < w.enemyShots.count; i++) {
    const b = w.enemyShots.items[i] as Bullet;
    if (!b.active) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r;
    if (d < best) {
      best = d;
      nearest = b;
    }
  }
  if (nearest !== null && best < p.r + 2 && bubbleTimeScale(w, nearest.x, nearest.y) !== 1)
    return 'bubble-shot';
  return null;
}

/**
 * `crush`, an Act II hazard, `ring` (a pulsar's pulse), else the nearest body:
 * `shot`, `rock`, `hole`, `pulsar`, `hull` (a boss) or `ram-<enemy id>`.
 */
export function hitCause(w: World): string {
  const p = w.player;
  if (lastCrushTick(w) === w.tick) return 'crush';
  const h2 = hazardsIIHitCause(w);
  if (h2 !== null) return h2;
  // A pulse ring has no body: it's the cause when its solid part covers the ship
  // (the same test `updatePulsar` hits with).
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = w.anomalies.items[i] as Anomaly;
    if (!a.active || a.kind !== 'pulsar') continue;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = Math.hypot(dx, dy);
    const band = PULSAR.ringThickness / 2 + p.r;
    const n = pulsarGapCount(a);
    const gw = pulsarGapWidth(a);
    const R = pulsarRingRadius(a);
    if (R >= 0 && Math.abs(d - R) <= band && !inPulsarGap(dx, dy, p.r, n, gw, pulsarRingRot(a)))
      return 'ring';
    const R2 = pulsarEchoRadius(a);
    if (R2 >= 0 && Math.abs(d - R2) <= band && !inPulsarGap(dx, dy, p.r, n, gw, pulsarEchoRot(a)))
      return 'ring';
  }
  let best = Infinity;
  let cause = '?';
  for (let i = 0; i < w.enemyShots.count; i++) {
    const b = w.enemyShots.items[i] as Bullet;
    const d = gap(w, b);
    if (d < best) {
      best = d;
      cause = 'shot';
    }
  }
  for (let i = 0; i < w.asteroids.count; i++) {
    const d = gap(w, w.asteroids.items[i] as Asteroid);
    if (d < best) {
      best = d;
      cause = 'rock';
    }
  }
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = w.anomalies.items[i] as Anomaly;
    if (a.r <= 0) continue;
    const d = gap(w, a);
    if (d < best) {
      best = d;
      cause = a.kind === 'blackhole' ? 'hole' : 'pulsar';
    }
  }
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    const d = gap(w, e);
    if (d < best) {
      best = d;
      cause = e.isBoss ? 'hull' : `ram-${e.defId}`;
    }
  }
  return cause;
}

function gap(w: World, b: { active: boolean; x: number; y: number; r: number }): number {
  if (!b.active) return Infinity;
  return Math.hypot(b.x - w.player.x, b.y - w.player.y) - b.r;
}
