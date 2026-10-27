// Act II set pieces (T37): the corona limb, ring gates, lens flares, clock-face
// arcs, the Foundry's red sun and Dyson-ring girders. Bitmap indices follow
// setpieces.ts: 0 transparent, 1..n the ramp, LIGHT_A/LIGHT_B blinking lights.
import type { Rng } from '../engine/rng';
import { createBitmap, get, plot, type IndexedBitmap } from './bitmap';
import { LIGHT_A, LIGHT_B } from './lights';
import { bayer4, ditherLevel, PeriodicValueNoise } from './noise';

/** Heat-shimmer frames of the limb, and seconds per frame. */
export const SHIMMER_PHASES = 4;
export const SHIMMER_STEP = 0.15;
/**
 * Rows a top-anchored piece keeps above the playfield: the tallest HUD band
 * ((MAX_LOGICAL_H − PLAYFIELD_H) / 2), so the star fills it on tall phones too.
 */
export const TOP_ANCHOR_BAND = 60;

// Light comes from the top-left, per the art rules.
const LX = -0.55;
const LY = -0.6;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The star's limb across the top: a huge disc whose lower edge sags across the
 * playfield's top `depth` px, brightest deep inside (5) and darkening to gold
 * at the edge, then a ragged amber corona glow (3 → 1) that rises with `phase`.
 * A few prominence loops stand off the edge.
 */
export function limb(rng: Rng, depth: number, phase: number): IndexedBitmap {
  const w = 240;
  const glow = 30;
  const h = TOP_ANCHOR_BAND + depth + glow;
  const b = createBitmap(w, h);
  const r = 600;
  const cx = 120 + rng.range(-50, 50);
  const cy = TOP_ANCHOR_BAND + depth - r;
  const gran = new PeriodicValueNoise(rng, 5, 50, 40);
  const heat = new PeriodicValueNoise(rng, 8, 32, 8);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = r - Math.sqrt(dx * dx + dy * dy);
      if (d >= 0) {
        // Limb darkening: dimmer toward the edge, with granulation on top.
        const t = d / depth;
        const v = 0.1 + 0.65 * Math.sqrt(t > 1 ? 1 : t) + (gran.sample(x, y) - 0.5) * 0.25;
        b.data[y * w + x] = 3 + ditherLevel(clamp01(v), 2, x, y);
        continue;
      }
      // Sampling further down each frame makes the glow's ragged texture rise.
      const g = Math.exp(d / 12) * (0.45 + heat.sample(x, y + phase * 4)) - 0.06;
      if (g <= 0) continue;
      const lvl = ditherLevel(clamp01(g), 3, x, y);
      if (lvl > 0) b.data[y * w + x] = lvl;
    }
  }
  const proms = rng.int(2, 3);
  for (let i = 0; i < proms; i++) {
    const px = rng.range(24, 216);
    const pw = rng.range(5, 12);
    const ph = rng.range(6, 14);
    for (let a = 0; a <= Math.PI; a += 0.04) {
      const x = Math.round(px + Math.cos(a) * pw);
      const ex = x + 0.5 - cx;
      const edge = cy + Math.sqrt(r * r - ex * ex);
      const y = Math.round(edge + Math.sin(a) * ph);
      if (get(b, x, y) < 2) plot(b, x, y, 2);
    }
  }
  return b;
}

/**
 * A distant ring gate seen at an angle: a segmented, tilted torus with a lit
 * top-left rim, portal haze inside (3), and lights at some segment joints.
 */
export function ring(rng: Rng, size: number): IndexedBitmap {
  const b = createBitmap(size, size);
  const c = size / 2;
  const outer = size / 2 - 1;
  const thick = Math.max(2, size * 0.07);
  const mid = outer - thick / 2;
  const tilt = rng.range(0.35, 0.6);
  const rot = rng.range(-0.4, 0.4);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const segs = rng.int(6, 10);
  const swirl = new PeriodicValueNoise(rng, 6, 8, 8);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const u = dx * cos + dy * sin;
      const v = (-dx * sin + dy * cos) / tilt;
      const rr = Math.sqrt(u * u + v * v);
      if (Math.abs(rr - mid) <= thick / 2) {
        const a = Math.atan2(v, u) / (Math.PI * 2) + 1;
        if ((a * segs) % 1 < 0.1) continue;
        const dl = Math.sqrt(dx * dx + dy * dy) || 1;
        b.data[y * size + x] = (dx / dl) * LX + (dy / dl) * LY > 0.3 ? 2 : 1;
      } else if (rr < mid - thick / 2) {
        const hz = (1 - rr / mid) * 0.35 + (swirl.sample(x, y) - 0.5) * 0.3;
        if (bayer4(x, y) < hz * 0.6) b.data[y * size + x] = 3;
      }
    }
  }
  let n = 0;
  for (let k = 0; k < segs; k++) {
    if (!rng.chance(0.6)) continue;
    const a = ((k + 0.05) / segs) * Math.PI * 2;
    const u = Math.cos(a) * mid;
    const vs = Math.sin(a) * mid * tilt;
    const x = Math.floor(c + u * cos - vs * sin);
    const y = Math.floor(c + u * sin + vs * cos);
    plot(b, x, y, n++ % 2 === 0 ? LIGHT_A : LIGHT_B);
  }
  return b;
}

/**
 * A lens flare in a band `h` tall: a soft core, a long anamorphic streak across
 * the full width, and ghost discs strung along the line through screen center.
 */
export function flare(rng: Rng, h: number, levels: number): IndexedBitmap {
  const w = 240;
  const b = createBitmap(w, h);
  const cx = rng.range(30, 210);
  const cy = Math.floor(h / 2);
  const top = levels;
  const set = (x: number, y: number, v: number): void => {
    const l = ditherLevel(clamp01(v), top, x, y);
    if (l > get(b, x, y)) plot(b, x, y, l);
  };
  for (let x = 0; x < w; x++) {
    const s = Math.exp(-Math.abs(x + 0.5 - cx) / 70);
    set(x, cy, s);
    set(x, cy - 1, s * 0.4);
    set(x, cy + 1, s * 0.4);
  }
  for (let y = cy - 7; y <= cy + 7; y++) {
    for (let x = Math.floor(cx) - 7; x <= cx + 7; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < 7) set(x, y, 1 - d / 7);
    }
  }
  for (let k = -4; k <= 4; k++) {
    plot(b, Math.floor(cx) + k, cy, top);
    plot(b, Math.floor(cx), cy + k, top);
  }
  for (const f of [-0.5, 0.45, 1.1]) {
    const gx = cx + (120 - cx) * 2 * f;
    const gy = cy + rng.range(-h / 5, h / 5);
    const gr = rng.range(3, 7);
    for (let y = Math.floor(gy - gr); y <= gy + gr; y++) {
      for (let x = Math.floor(gx - gr); x <= gx + gr; x++) {
        const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (d > gr) continue;
        set(x, y, d > gr - 1 ? 0.55 : 0.2);
      }
    }
  }
  return b;
}

/**
 * Faint clock-face arcs: broken outer arcs (2), a dotted inner ring and twelve
 * ticks (2/1), two hands (2/1) and a hub (3). Diameter `size`.
 */
export function clock(rng: Rng, size: number): IndexedBitmap {
  const b = createBitmap(size, size);
  const c = size / 2;
  const r = size / 2 - 1;
  const step = 0.5 / r;
  const arcs = rng.int(2, 3);
  for (let i = 0; i < arcs; i++) {
    const a0 = rng.range(0, Math.PI * 2);
    const len = rng.range(1, 2.4);
    for (let a = a0; a < a0 + len; a += step) {
      plot(b, Math.floor(c + Math.cos(a) * r), Math.floor(c + Math.sin(a) * r), 2);
    }
  }
  const inner = r * 0.82;
  let k = 0;
  for (let a = 0; a < Math.PI * 2; a += step * 2) {
    if (k++ % 2 === 0)
      plot(b, Math.floor(c + Math.cos(a) * inner), Math.floor(c + Math.sin(a) * inner), 1);
  }
  for (let t = 0; t < 12; t++) {
    const a = (t / 12) * Math.PI * 2;
    const len = t % 3 === 0 ? 5 : 2;
    for (let d = 0; d < len; d++) {
      const rr = r - 3 - d;
      plot(
        b,
        Math.floor(c + Math.cos(a) * rr),
        Math.floor(c + Math.sin(a) * rr),
        t % 3 === 0 ? 2 : 1,
      );
    }
  }
  const hand = (a: number, len: number, idx: number): void => {
    for (let d = 0; d < len; d += 0.5) {
      plot(b, Math.floor(c + Math.cos(a) * d), Math.floor(c + Math.sin(a) * d), idx);
    }
  };
  hand(rng.range(0, Math.PI * 2), r * 0.45, 2);
  hand(rng.range(0, Math.PI * 2), r * 0.7, 1);
  for (let y = -1; y <= 0; y++)
    for (let x = -1; x <= 0; x++) plot(b, Math.floor(c) + x, Math.floor(c) + y, 3);
  return b;
}

/**
 * A dying red sun: limb-darkened disc (2..n) with granulation and a sunspot or
 * two, inside a thin dithered glow (1). The bitmap pads the radius by 8 px.
 */
export function sun(rng: Rng, radius: number, levels: number): IndexedBitmap {
  const pad = 8;
  const d = (radius + pad) * 2;
  const b = createBitmap(d, d);
  const c = d / 2;
  const gran = new PeriodicValueNoise(rng, 4, 64, 64);
  const spots: [number, number, number][] = [];
  for (let i = rng.int(1, 3); i > 0; i--) {
    spots.push([rng.range(-0.5, 0.5), rng.range(-0.5, 0.5), rng.range(0.05, 0.1)]);
  }
  const top = levels - 2;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const nx = (x + 0.5 - c) / radius;
      const ny = (y + 0.5 - c) / radius;
      const rr = nx * nx + ny * ny;
      if (rr > 1) {
        const out = (Math.sqrt(rr) - 1) * radius;
        if (ditherLevel(Math.exp(-out / 3) * 0.9, 1, x, y) > 0) b.data[y * d + x] = 1;
        continue;
      }
      let v = 0.15 + 0.85 * Math.pow(1 - rr, 0.35) + (gran.sample(x, y) - 0.5) * 0.3;
      for (const [sx, sy, sr] of spots) {
        const q = ((nx - sx) ** 2 + (ny - sy) ** 2) / (sr * sr);
        if (q < 1) v -= q < 0.35 ? 0.35 : 0.15;
      }
      b.data[y * d + x] = 2 + ditherLevel(clamp01(v), top, x, y);
    }
  }
  return b;
}

/**
 * A slice of Dyson-ring truss crossing the screen, slightly tilted: two chords,
 * verticals and X-bracing (steel 1, lit edge 2), hanging hull plates, and
 * molten seams along the top chord that pulse in two groups.
 */
export function girder(rng: Rng, h: number): IndexedBitmap {
  const w = 240;
  const b = createBitmap(w, h);
  const bd = Math.max(6, Math.round(h * 0.45));
  const room = Math.max(0, (h - bd) / 2 - 7);
  const slope = rng.range(-1, 1) * Math.min(0.15, room / 120);
  const top = (x: number): number => Math.round(h / 2 - bd / 2 - 3 + (x - 120) * slope);
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      plot(b, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1);
    }
  };
  for (let x = 0; x < w; x++) {
    const y = top(x);
    plot(b, x, y, 1);
    plot(b, x, y + 1, 1);
    plot(b, x, y + bd - 2, 1);
    plot(b, x, y + bd - 1, 1);
  }
  const panel = rng.int(14, 20);
  for (let x = -rng.int(0, panel - 1); x < w; x += panel) {
    const y0 = top(x);
    line(x, y0, x, y0 + bd - 1);
    line(x, y0 + 1, x + panel, top(x + panel) + bd - 2);
    line(x, y0 + bd - 2, x + panel, top(x + panel) + 1);
    if (rng.chance(0.3)) {
      const ph = rng.int(3, 6);
      for (let yy = 0; yy < ph; yy++) {
        for (let xx = 2; xx < panel - 1; xx++) plot(b, x + xx, top(x + xx) + bd + yy, 1);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (get(b, x, y) === 1 && (get(b, x - 1, y) === 0 || get(b, x, y - 1) === 0)) {
        b.data[y * w + x] = 2;
      }
    }
  }
  const seams = rng.int(4, 6);
  for (let i = 0; i < seams; i++) {
    const x0 = rng.int(0, w - 8);
    const len = rng.int(6, 14);
    const idx = i % 2 === 0 ? LIGHT_A : LIGHT_B;
    for (let x = x0; x < x0 + len && x < w; x++) plot(b, x, top(x) + 1, idx);
  }
  return b;
}
