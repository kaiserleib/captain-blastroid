import { PULSAR, PULSAR_SPOKE_LEN } from '../../content/obstacles';
import { flags } from '../../debug/flags';
import type { Renderer } from '../../gfx/renderer';
import { registerAnomalyContact, registerAsteroidHeld } from '../../sim/hooks';
import type { Anomaly } from '../../sim/types';
import { WORLD_H, WORLD_W, type DrawLayer, type World } from '../../sim/world';
import { blackHoleContact, updateBlackHole } from './anomalies/blackhole';
import {
  gapAnglesAt,
  pulsarContact,
  pulsarEchoRadius,
  pulsarEchoRot,
  pulsarGapCount,
  pulsarGapWidth,
  pulsarGlow,
  pulsarNextRot,
  pulsarRingRadius,
  pulsarRingRot,
  updatePulsar,
} from './anomalies/pulsar';
import { ext } from './anomalies/state';
import {
  BLACKHOLE_FRAMES,
  BLACKHOLE_MAX_R,
  PULSAR_GLOW_FRAMES,
  PULSAR_IDLE_FRAMES,
  PULSAR_RAMP,
  blackHoleSprite,
} from './obstacles.sprites';
import { drawBubbles, drawFlareBackdrop, drawPortals } from './hazards2/draw';
import { drawObstacleSandbox } from './sandbox';
import { towedHeldCheck } from './tractor';

/** Registers the module's sim hooks (anomaly contact, towed-rock exemptions). Safe to call again. */
export function registerAnomalyHooks(): void {
  registerAnomalyContact('blackhole', blackHoleContact);
  registerAnomalyContact('pulsar', pulsarContact);
  registerAsteroidHeld(towedHeldCheck);
}

/**
 * Shrinks the anomaly's core and field (pulsars: core and ring reach) to 0
 * over `dur` seconds, then releases it. Pulsars stop pulsing at once. Used
 * for boss defeats and dying gravity buoys. Calling it again restarts the
 * shrink from the current size.
 */
export function collapseAnomaly(w: World, a: Anomaly, dur: number): void {
  if (!a.active) return;
  if (dur <= 0) {
    w.anomalies.release(a);
    return;
  }
  const e = ext(a);
  e.collapseDur = dur;
  e.collapseT = 0;
  e.baseR = a.r;
  e.baseRadius = a.radius;
  e.basePull = e.playerPull;
}

/** True while `collapseAnomaly` is shrinking it. */
export function isCollapsing(a: Anomaly): boolean {
  return a.active && ext(a).collapseDur > 0;
}

/** Ages, moves and runs every anomaly's effect. Anomalies are indestructible. */
export function updateAnomalies(w: World, dt: number): void {
  const items = w.anomalies.items;
  const n = w.anomalies.count;
  for (let i = 0; i < n; i++) {
    const a = items[i] as Anomaly;
    if (!a.active) continue;
    a.t += dt;
    a.prevX = a.x;
    a.prevY = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    const e = ext(a);
    if (e.collapseDur > 0) {
      e.collapseT += dt;
      const k = 1 - e.collapseT / e.collapseDur;
      if (k <= 0) {
        w.anomalies.release(a);
        continue;
      }
      a.r = e.baseR * k;
      a.radius = e.baseRadius * k;
      e.playerPull = e.basePull * k;
    }
    if (a.kind === 'blackhole') updateBlackHole(w, a, dt);
    else updatePulsar(w, a, dt);
  }
}

// ---------------------------------------------------------------------------
// Drawing

const spriteOpts = { frame: 0 };
const gapScratch: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
const gapUx: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
const gapUy: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
const MAX_GAPS = gapScratch.length;

function setGaps(gaps: number, rot: number): number {
  const n = gapAnglesAt(Math.min(gaps, MAX_GAPS), rot, gapScratch);
  for (let i = 0; i < n; i++) {
    gapUx[i] = Math.cos(gapScratch[i] as number);
    gapUy[i] = Math.sin(gapScratch[i] as number);
  }
  return n;
}

/**
 * A midpoint circle of radius R with the gaps cut out. A pixel is in gap i
 * when its direction is within half a gap of the gap center: dot > R·cos(w/2).
 */
function ringPixels(
  r: Renderer,
  cx: number,
  cy: number,
  R: number,
  color: string,
  gaps: number,
  cosHalf: number,
): void {
  let dx = Math.round(R);
  let dy = 0;
  let err = 1 - dx;
  const lim = R * cosHalf;
  while (dx >= dy) {
    ringPx(r, cx, cy, dx, dy, color, gaps, lim);
    ringPx(r, cx, cy, -dx, dy, color, gaps, lim);
    ringPx(r, cx, cy, dx, -dy, color, gaps, lim);
    ringPx(r, cx, cy, -dx, -dy, color, gaps, lim);
    ringPx(r, cx, cy, dy, dx, color, gaps, lim);
    ringPx(r, cx, cy, -dy, dx, color, gaps, lim);
    ringPx(r, cx, cy, dy, -dx, color, gaps, lim);
    ringPx(r, cx, cy, -dy, -dx, color, gaps, lim);
    dy++;
    if (err < 0) err += 2 * dy + 1;
    else {
      dx--;
      err += 2 * (dy - dx) + 1;
    }
  }
}

function ringPx(
  r: Renderer,
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  color: string,
  gaps: number,
  lim: number,
): void {
  const x = cx + ox;
  const y = cy + oy;
  if (x < -1 || x > WORLD_W || y < -1 || y > WORLD_H) return;
  for (let i = 0; i < gaps; i++) {
    if (ox * (gapUx[i] as number) + oy * (gapUy[i] as number) > lim) return;
  }
  r.rect(x, y, 1, 1, color);
}

function drawRing(
  r: Renderer,
  a: Anomaly,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  dim: number,
): void {
  const gaps = setGaps(pulsarGapCount(a), rot);
  const cosHalf = Math.cos(pulsarGapWidth(a) / 2);
  // Leading edge white, trailing edge falls off; the whole ring dims near max radius.
  const fade = (R > a.radius * 0.75 ? 1 : 0) + dim;
  const th = PULSAR.ringThickness;
  for (let i = 0; i < th; i++) {
    const level = Math.max(0, 4 - i - fade);
    if (R - i > 0) ringPixels(r, cx, cy, R - i, PULSAR_RAMP[level] as string, gaps, cosHalf);
  }
}

/** Telegraph: a bright 1 px spoke down each upcoming gap, growing with the glow, dim edge spokes. */
function drawSpokes(r: Renderer, a: Anomaly, cx: number, cy: number, glow: number): void {
  const gaps = pulsarGapCount(a);
  if (gaps <= 0) return;
  const len = a.r + (PULSAR_SPOKE_LEN - a.r) * glow;
  const halfW = pulsarGapWidth(a) / 2;
  const n = setGaps(gaps, pulsarNextRot(a));
  for (let i = 0; i < n; i++) {
    const ang = gapScratch[i] as number;
    spoke(r, cx, cy, gapUx[i] as number, gapUy[i] as number, a.r + 1, len, PULSAR_RAMP[4]);
    const el = len * 0.6;
    spoke(r, cx, cy, Math.cos(ang - halfW), Math.sin(ang - halfW), a.r + 3, el, PULSAR_RAMP[2]);
    spoke(r, cx, cy, Math.cos(ang + halfW), Math.sin(ang + halfW), a.r + 3, el, PULSAR_RAMP[2]);
  }
}

function spoke(
  r: Renderer,
  cx: number,
  cy: number,
  ux: number,
  uy: number,
  from: number,
  to: number,
  color: string,
): void {
  let lx = 1e9;
  let ly = 1e9;
  for (let d = from; d <= to; d += 0.7) {
    const x = Math.round(cx + ux * d);
    const y = Math.round(cy + uy * d);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    r.rect(x, y, 1, 1, color);
  }
}

function drawPulsar(r: Renderer, a: Anomaly, x: number, y: number): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const R = pulsarRingRadius(a);
  if (R >= 0) drawRing(r, a, cx, cy, R, pulsarRingRot(a), 0);
  const R2 = pulsarEchoRadius(a);
  if (R2 >= 0) drawRing(r, a, cx, cy, R2, pulsarEchoRot(a), 1);
  const g = pulsarGlow(a);
  if (g > 0) drawSpokes(r, a, cx, cy, g);
  if (a.r < 1) return;
  spriteOpts.frame =
    g > 0
      ? PULSAR_IDLE_FRAMES + Math.min(PULSAR_GLOW_FRAMES - 1, Math.floor(g * PULSAR_GLOW_FRAMES))
      : Math.floor(a.t * 8) % PULSAR_IDLE_FRAMES;
  r.sprite('anomaly_pulsar', x, y, spriteOpts);
}

export const anomalyLayer: DrawLayer = {
  name: 'anomalies',
  z: 10,
  draw(w: World, r: Renderer, alpha: number) {
    // Act II: flare light and shade under everything, then bubbles and portals.
    drawFlareBackdrop(w, r);
    drawBubbles(w, r, alpha);
    drawPortals(w, r, alpha);
    const items = w.anomalies.items;
    const n = w.anomalies.count;
    for (let i = 0; i < n; i++) {
      const a = items[i] as Anomaly;
      if (!a.active) continue;
      const x = a.prevX + (a.x - a.prevX) * alpha;
      const y = a.prevY + (a.y - a.prevY) * alpha;
      if (a.kind === 'blackhole') {
        // Fields aren't drawn (design: the bending shots show them); buoys have no hole.
        const core = Math.min(BLACKHOLE_MAX_R, Math.round(a.r));
        if (core < 1 || ext(a).fieldOnly) continue;
        spriteOpts.frame = Math.floor(a.t * 6) % BLACKHOLE_FRAMES;
        r.sprite(blackHoleSprite(core), x, y, spriteOpts);
      } else {
        drawPulsar(r, a, x, y);
      }
    }
    if (flags.sandbox) drawObstacleSandbox(w, r);
  },
};
