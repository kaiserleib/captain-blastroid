import { POWERUP_TUNING } from '../../content/pickups';
import type { Renderer } from '../../gfx/renderer';
import { applyRadialForce } from '../../sim/forces';
import type { Pickup } from '../../sim/types';
import type { World } from '../../sim/world';

/** Counts the magnet/repulsor timers down; the repulsor shoves shots and rocks while it runs. */
export function updatePowerups(w: World, dt: number): void {
  const p = w.player;
  if (p.magnetT > 0) p.magnetT = p.magnetT > dt ? p.magnetT - dt : 0;
  if (p.repulsorT > 0) {
    p.repulsorT = p.repulsorT > dt ? p.repulsorT - dt : 0;
    if (p.alive) {
      const R = POWERUP_TUNING.repulsorRadius;
      applyRadialForce(w.enemyShots, p.x, p.y, R, POWERUP_TUNING.repulsorShotForce, 'linear', dt);
      applyRadialForce(
        w.asteroids,
        p.x,
        p.y,
        R,
        POWERUP_TUNING.repulsorAsteroidForce,
        'linear',
        dt,
      );
    }
  }
}

const MAGNET_TURN = 8;

/** Steers a magnetized pickup at the player, speeding up toward `magnetMaxSpeed`. */
export function homePickup(w: World, k: Pickup, dt: number): void {
  const p = w.player;
  const dx = p.x - k.x;
  const dy = p.y - k.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return;
  const speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
  let want = speed + POWERUP_TUNING.magnetAccel * dt;
  if (want > POWERUP_TUNING.magnetMaxSpeed) want = POWERUP_TUNING.magnetMaxSpeed;
  // Lerping the velocity (rather than adding acceleration) keeps pickups from orbiting the ship.
  const t = MAGNET_TURN * dt < 1 ? MAGNET_TURN * dt : 1;
  k.vx += ((dx / d) * want - k.vx) * t;
  k.vy += ((dy / d) * want - k.vy) * t;
}

const SHIMMER = ['#a8f8f8', '#f8f8f8'];
const SHIMMER_STEP = 6;

/** Faint dotted line from a magnetized pickup to the ship; the dots crawl toward the ship. */
export function drawShimmer(
  r: Renderer,
  x: number,
  y: number,
  px: number,
  py: number,
  t: number,
): void {
  const dx = px - x;
  const dy = py - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < SHIMMER_STEP * 2) return;
  const ux = dx / d;
  const uy = dy / d;
  const phase = (t * 40) % SHIMMER_STEP;
  const ctx = r.ctx;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = 0.35;
  for (let s = SHIMMER_STEP + phase, i = 0; s < d - 8; s += SHIMMER_STEP, i++) {
    r.rect(x + ux * s, y + uy * s, 1, 1, SHIMMER[i & 1] as string);
  }
  ctx.globalAlpha = prev;
}

const RING_COLORS = ['#a060f8', '#d8b0f8', '#f8f8f8'];

/** Pulsing pixel rings around the ship while the repulsor runs; flickers in the last second. */
export function drawRepulsor(r: Renderer, x: number, y: number, timeLeft: number, t: number): void {
  if (timeLeft < 1 && Math.floor(t * 12) % 2 === 0) return;
  const R = POWERUP_TUNING.repulsorRadius;
  // Two rings expand outward from half radius to the full field, staggered by half a period.
  for (let i = 0; i < 2; i++) {
    const f = (t * 1.6 + i * 0.5) % 1;
    const rad = R * (0.5 + 0.5 * f);
    r.circle(x, y, rad, RING_COLORS[f < 0.33 ? 2 : f < 0.66 ? 1 : 0] as string, false);
  }
  r.circle(x, y, R, RING_COLORS[0] as string, false);
}
