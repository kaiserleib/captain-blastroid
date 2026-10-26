import { LANCER_P } from '../../../content/levels/eventHorizon';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { DrawLayer, World } from '../../../sim/world';
import { buoyFields, fieldAlive, Lance, lanceTelegraph } from './behaviors';
import { HZ_SPRITES, HZ_VIOLET, HZ_WARN } from './eventHorizon.sprites';

// Sector 3 extra drawing: the Lancer's telegraph line and dash afterimages
// (enemy draw, z 40) and the Gravity Buoy fields (a level layer just above the
// anomalies, since a field-only anomaly isn't drawn by the obstacle layer).

const opts: SpriteOpts = { frame: 0, alpha: 1 };
const W = 240;
const H = 400;
/** The small hole's field radius: buoy rings scale with what's left of it. */
const BUOY_FIELD_R = 96;

/** Dashed line from (x, y) along (ux, uy) to the playfield edge; dashes march toward the dash. */
function telegraphLine(
  r: Renderer,
  x: number,
  y: number,
  ux: number,
  uy: number,
  k: number,
  t: number,
): void {
  const blink = k > 0.7 && Math.floor(t * 18) % 2 === 0;
  const col = blink ? HZ_WARN.hot : k > 0.4 ? HZ_WARN.amber : HZ_WARN.red;
  const dim = k > 0.4 ? HZ_WARN.red : HZ_WARN.dim;
  const march = Math.floor(t * 40) % 7;
  // Reveal outward over the first fifth so the eye follows it to the end.
  const reach = Math.min(1, k * 5) * 460;
  for (let s = 10; s < reach; s++) {
    const px = Math.round(x + ux * s);
    const py = Math.round(y + uy * s);
    if (px < -2 || px > W + 2 || py < -2 || py > H + 2) break;
    const on = (s - march + 70) % 7 < 4;
    if (!on) continue;
    r.rect(px, py, 1, 1, col);
    // A 1 px shadow under the line keeps it legible on bright rocks.
    r.rect(px + 1, py + 1, 1, 1, dim);
  }
}

export function drawLancer(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const k = lanceTelegraph(e, LANCER_P);
  if (k >= 0) {
    telegraphLine(r, x, y, e.ax, e.ay, k, w.time);
    opts.frame = Math.min(2, Math.floor(k * 3));
    opts.alpha = 1;
    r.sprite(HZ_SPRITES.lancerCharge, x + e.ax * 11, y + e.ay * 11, opts);
    return;
  }
  if (e.state === Lance.Dash) {
    opts.frame = 0;
    for (let j = 1; j <= 3; j++) {
      opts.alpha = 0.5 - j * 0.14;
      r.sprite(HZ_SPRITES.lancer, x - e.vx * 0.022 * j, y - e.vy * 0.022 * j, opts);
    }
    opts.alpha = 1;
  }
}

function dottedRing(
  r: Renderer,
  x: number,
  y: number,
  rad: number,
  n: number,
  rot: number,
  col: string,
): void {
  if (rad < 1) return;
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = rot + step * i;
    r.rect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad), 1, 1, col);
  }
}

/** Two counter-turning dotted rings mark each buoy field; they cave in as it collapses. */
function drawField(r: Renderer, a: Anomaly, t: number, alpha: number): void {
  const x = a.prevX + (a.x - a.prevX) * alpha;
  const y = a.prevY + (a.y - a.prevY) * alpha;
  const k = Math.min(1, a.radius / BUOY_FIELD_R);
  const pulse = (t * 0.8) % 1;
  dottedRing(
    r,
    x,
    y,
    (16 + pulse * 22) * k,
    16,
    t * 1.3,
    pulse < 0.6 ? HZ_VIOLET.light : HZ_VIOLET.base,
  );
  dottedRing(r, x, y, 30 * k, 22, -t * 0.7, HZ_VIOLET.dark);
  if (k < 0.98) dottedRing(r, x, y, 10 * k + 2, 10, t * 4, HZ_VIOLET.highlight);
}

export const buoyFieldLayer: DrawLayer = {
  name: 'eventHorizon.buoyFields',
  z: 12,
  draw(w, r, alpha) {
    const t = buoyFields(w);
    for (let i = 0; i < t.length; i++) {
      const b = t[i]!;
      if (!fieldAlive(b)) continue;
      drawField(r, b.field as Anomaly, b.t, alpha);
    }
  },
};
