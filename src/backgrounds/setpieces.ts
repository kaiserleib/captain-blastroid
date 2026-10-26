import { createRng, type Rng } from '../engine/rng';
import { createBitmap, get, plot, type IndexedBitmap } from './bitmap';
import type { Rgb } from './color';
import { bayer4, ditherLevel, PeriodicValueNoise } from './noise';

export type SetPieceKind = 'planet' | 'station' | 'belt';

export interface SetPieceSpec {
  kind: SetPieceKind;
  /**
   * Seconds into the level, at the theme's nominal scroll speed, when the piece's
   * top edge enters the top of the screen. Stored as scroll distance, so it stays
   * in place if the speed changes. Negative values start it already on screen.
   */
  at: number;
  /** Left edge in px; negative or > 240 - width crops it, e.g. for a planet limb. */
  x: number;
  /** Planet radius, station height, or belt band height, px. */
  size: number;
  /** Ramp, dark → light. Planet and belt use 4, station uses 3 (hull, lit edge, window). */
  colors: readonly Rgb[];
}

// Light comes from the top-left, per the art rules.
const LX = -0.55;
const LY = -0.6;
const LZ = 0.58;

export function generateSetPiece(seed: number, spec: SetPieceSpec): IndexedBitmap {
  const rng = createRng(seed);
  switch (spec.kind) {
    case 'planet':
      return planet(rng, spec.size, spec.colors.length);
    case 'station':
      return station(rng, spec.size);
    case 'belt':
      return belt(rng, spec.size, spec.colors.length);
  }
}

export function setPiecePalette(spec: SetPieceSpec): (Rgb | null)[] {
  return [null, ...spec.colors];
}

/** A shaded gas giant with banding, a dithered terminator and a thin lit rim. */
function planet(rng: Rng, radius: number, levels: number): IndexedBitmap {
  const d = radius * 2;
  const b = createBitmap(d, d);
  const bands = new PeriodicValueNoise(rng, 6, 4, 64);
  const tilt = rng.range(-0.25, 0.25);
  const top = levels - 1;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const nx = (x + 0.5 - radius) / radius;
      const ny = (y + 0.5 - radius) / radius;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const lam = nx * LX + ny * LY + nz * LZ;
      // Latitude bands, slightly tilted; sampled in sphere space so they curve with the limb.
      const lat = (ny + nx * tilt) * 32 + 32;
      const band = (bands.sample(nx * 3, lat) - 0.5) * 0.35;
      let v = lam * 1.1 - 0.15 + band;
      // Lit rim: a thin atmosphere line on the sunward edge.
      const edge = radius * (1 - Math.sqrt(rr));
      if (edge < 1.2 && lam > 0.05) v = 1;
      if (v < 0) v = 0;
      // Level 0 would be transparent; the night side keeps the darkest ramp step so it occludes stars.
      const lvl = 1 + ditherLevel(v > 1 ? 1 : v, top, x, y);
      b.data[y * d + x] = lvl;
    }
  }
  return b;
}

/** A derelict station silhouette: spine, modules, a broken ring, a few lit windows. */
function station(rng: Rng, height: number): IndexedBitmap {
  const w = Math.round(height * 0.75);
  const b = createBitmap(w, height);
  const cx = w >> 1;
  const fill = (x0: number, y0: number, ww: number, hh: number): void => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) plot(b, x, y, 1);
  };
  // Spine and antenna.
  fill(cx - 2, Math.round(height * 0.08), 4, Math.round(height * 0.84));
  fill(cx, 0, 1, Math.round(height * 0.1));
  // Habitat ring, seen nearly edge-on, with a gap blown out of it.
  const ringY = Math.round(height * rng.range(0.3, 0.42));
  const rx = w / 2 - 2;
  const ry = Math.max(3, Math.round(height * 0.06));
  const gapA = rng.range(0, Math.PI * 2);
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    let da = Math.abs(a - gapA);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.45) continue;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(ringY + Math.sin(a) * ry);
    plot(b, x, y, 1);
    plot(b, x, y + 1, 1);
  }
  // Spokes.
  fill(Math.round(cx - rx * 0.7), ringY, Math.round(rx * 1.4), 1);
  // Modules hung off the spine, roughly mirrored.
  const modules = rng.int(4, 6);
  for (let i = 0; i < modules; i++) {
    const my = Math.round(height * rng.range(0.12, 0.85));
    const mw = rng.int(4, Math.max(5, Math.round(w * 0.3)));
    const mh = rng.int(3, Math.max(4, Math.round(height * 0.09)));
    const side = rng.chance(0.5) ? 1 : -1;
    fill(side > 0 ? cx + 2 : cx - 2 - mw, my, mw, mh);
    if (rng.chance(0.6)) fill(side > 0 ? cx - 2 - mw : cx + 2, my + rng.int(-2, 2), mw, mh);
  }
  // Solar panels: hatched with a checker so they read as lattice, not slabs.
  const py = Math.round(height * rng.range(0.6, 0.78));
  const pw = Math.round(w * 0.38);
  for (let y = py; y < py + Math.round(height * 0.1); y++) {
    for (let x = 0; x < pw; x++) {
      if (((x + y) & 1) === 0 || y === py) {
        plot(b, cx - 3 - x, y, 1);
        plot(b, cx + 3 + x, y, 1);
      }
    }
  }
  // Damage: bite holes out of the hull.
  const holes = rng.int(3, 6);
  for (let i = 0; i < holes; i++) {
    const hx = rng.int(0, w - 1);
    const hy = rng.int(0, height - 1);
    const hr = rng.int(1, 3);
    for (let y = -hr; y <= hr; y++)
      for (let x = -hr; x <= hr; x++) if (x * x + y * y <= hr * hr) plot(b, hx + x, hy + y, 0);
  }
  // Lit edges face the top-left light.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (get(b, x, y) === 1 && (get(b, x - 1, y) === 0 || get(b, x, y - 1) === 0)) {
        b.data[y * w + x] = 2;
      }
    }
  }
  // A handful of windows still lit: the only bright pixels, and very few.
  const windows = rng.int(3, 7);
  for (let i = 0; i < windows; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, height - 1);
    if (get(b, x, y) === 1) b.data[y * w + x] = 3;
  }
  return b;
}

/** A full-width band of distant rocks, densest along a wavy centerline, with dithered dust. */
function belt(rng: Rng, height: number, levels: number): IndexedBitmap {
  const w = 240;
  const b = createBitmap(w, height);
  const phase = rng.range(0, Math.PI * 2);
  const amp = height * 0.12;
  const half = height * 0.32;
  const centerAt = (x: number): number => height / 2 + Math.sin(x / 38 + phase) * amp;
  const density = (x: number, y: number): number => {
    const t = (y - centerAt(x)) / half;
    return Math.exp(-t * t);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (bayer4(x, y) < density(x, y) * 0.3 && ((x * 7 + y * 13) & 7) < 3) b.data[y * w + x] = 1;
    }
  }
  const rocks = Math.round(w * height * 0.02);
  const lit = Math.min(levels, 4);
  for (let i = 0; i < rocks; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, height - 1);
    if (!rng.chance(density(x, y))) continue;
    const s = rng.chance(0.15) ? 3 : rng.chance(0.45) ? 2 : 1;
    for (let yy = 0; yy < s; yy++) {
      for (let xx = 0; xx < s; xx++) {
        if (s === 3 && (xx + yy === 0 || xx + yy === 4)) continue;
        // Top-left pixel of each rock catches the light.
        plot(b, x + xx, y + yy, xx + yy === 0 || (s === 3 && xx + yy === 1) ? lit : lit - 1);
      }
    }
  }
  return b;
}
