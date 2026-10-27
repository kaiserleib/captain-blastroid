import { createRng } from '../engine/rng';
import { createBitmap, type IndexedBitmap } from './bitmap';
import type { Rgb } from './color';
import { LIGHT_PHASES, lightCycle } from './lights';
import { ditherLevel, verticalTilingNoise } from './noise';

export interface NebulaSpec {
  /** Dark → light; index 1..n in the bitmap. */
  colors: readonly Rgb[];
  /** 0..1, how much of the sky has any cloud. */
  coverage: number;
  /** Lattice size of the broad patches, px; must divide the strip height. */
  patch: number;
  /** `clouds` (default) or `strata`: horizontal rock layers with cave gaps (the Warrens). */
  style?: 'clouds' | 'strata';
  /** Clouds only: horizontal stretch factor; > 1 draws long dust bands. */
  stretch?: number;
  /**
   * Seconds into the level, at the theme's nominal speed, before which the layer
   * isn't drawn. Its leading edge gets a ragged lip, so it reads as a wall the
   * ship flies into (the Warrens' asteroid face).
   */
  start?: number;
  /** Strata only: blinking point lights (mining lamps), split into two groups. */
  lights?: { color: Rgb; count: number };
}

/** Bayer-dithered value-noise clouds (or strata) that tile vertically with period `h`. */
export function generateNebula(
  seed: number,
  w: number,
  h: number,
  spec: NebulaSpec,
): IndexedBitmap {
  if (spec.style === 'strata') return generateStrata(seed, w, h, spec);
  const rng = createRng(seed);
  const patch = verticalTilingNoise(rng, spec.patch, w, h);
  const o1 = verticalTilingNoise(rng, 64, w, h);
  const o2 = verticalTilingNoise(rng, 32, w, h);
  const o3 = verticalTilingNoise(rng, 16, w, h);
  const o4 = verticalTilingNoise(rng, 8, w, h);
  const levels = spec.colors.length;
  const lo = 1 - spec.coverage;
  const sx = 1 / (spec.stretch ?? 1);
  const b = createBitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x * sx;
      const detail =
        0.5 * o1.sample(nx, y) +
        0.27 * o2.sample(nx, y) +
        0.15 * o3.sample(nx, y) +
        0.08 * o4.sample(nx, y);
      // Patches gate where clouds may form, so the sky has clear lanes between them.
      const d = detail * (0.4 + 0.8 * patch.sample(nx, y));
      let v = (d - lo) / (1 - lo + 1e-6) / 0.55;
      if (v <= 0) continue;
      if (v > 1) v = 1;
      b.data[y * w + x] = ditherLevel(v, levels, x, y);
    }
  }
  return b;
}

/** Strata bands per strip; the strip height over this is the mean band thickness. */
const STRATA_BANDS = 20;

/**
 * Layered rock: wavy, slightly tilted bands, each with its own shade, dark
 * fissures between them, and cave gaps where the stars show through.
 */
function generateStrata(seed: number, w: number, h: number, spec: NebulaSpec): IndexedBitmap {
  const rng = createRng(seed);
  const warp = verticalTilingNoise(rng, 32, w, h);
  const grain = verticalTilingNoise(rng, 8, w, h);
  const gaps = verticalTilingNoise(rng, spec.patch, w, h);
  const gaps2 = verticalTilingNoise(rng, 32, w, h);
  const shade = new Float32Array(STRATA_BANDS);
  const fissure = new Uint8Array(STRATA_BANDS);
  for (let i = 0; i < STRATA_BANDS; i++) {
    shade[i] = rng.range(0.1, 1);
    fissure[i] = rng.chance(0.45) ? 1 : 0;
  }
  const levels = spec.colors.length;
  const lo = 1 - spec.coverage;
  const b = createBitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Two octaves, so cave mouths have ragged edges rather than lattice-straight ones.
      if (gaps.sample(x, y) * 0.75 + gaps2.sample(x, y) * 0.25 < lo) continue;
      // The warp is periodic in y, so the bands still tile with period h.
      const yy = y + (warp.sample(x, y) - 0.5) * 28 + x * 0.06;
      const f = ((((yy * STRATA_BANDS) / h) % STRATA_BANDS) + STRATA_BANDS) % STRATA_BANDS;
      const band = Math.floor(f);
      if (fissure[band] && f - band < 0.06) {
        b.data[y * w + x] = 1;
        continue;
      }
      const v = (shade[band] as number) * 0.75 + (grain.sample(x, y) - 0.5) * 0.4 + 0.1;
      b.data[y * w + x] = 1 + ditherLevel(v < 0 ? 0 : v > 1 ? 1 : v, levels - 1, x, y);
    }
  }
  const lights = spec.lights?.count ?? 0;
  let placed = 0;
  for (let tries = 0; tries < lights * 50 && placed < lights; tries++) {
    const x = rng.int(1, w - 2);
    const y = rng.int(0, h - 1);
    if (!b.data[y * w + x]) continue;
    b.data[y * w + x] = levels + 1 + (placed & 1);
    placed++;
  }
  return b;
}

/** Strata lamps use the two indices after the ramp; an unlit lamp shows as rock. */
export function nebulaPalette(spec: NebulaSpec, phase = 0): (Rgb | null)[] {
  const pal: (Rgb | null)[] = [null, ...spec.colors];
  if (spec.lights) {
    const off = spec.colors[1] ?? spec.colors[0] ?? null;
    const on = lightCycle(phase);
    pal.push(on[0] ? spec.lights.color : off, on[1] ? spec.lights.color : off);
  }
  return pal;
}

/** Palette phases the nebula strip needs: one per light phase if it has lamps. */
export function nebulaPhases(spec: NebulaSpec): number {
  return spec.lights ? LIGHT_PHASES : 1;
}

/** Height of the ragged lip drawn under a `start`-gated layer's leading edge. */
export const EDGE_H = 18;

/**
 * The lip of a `start`-gated layer: strip rows from `row0` down (wrapping), cut
 * to a jagged profile, with lamps flattened to rock and a dark last row.
 */
export function nebulaEdge(
  seed: number,
  strip: IndexedBitmap,
  row0: number,
  levels: number,
): IndexedBitmap {
  const rng = createRng(seed);
  const w = strip.w;
  const e = createBitmap(w, EDGE_H);
  let depth = rng.range(4, EDGE_H - 2);
  for (let x = 0; x < w; x++) {
    depth += rng.range(-1.6, 1.6);
    if (depth < 2) depth = 2;
    if (depth > EDGE_H) depth = EDGE_H;
    const d = Math.floor(depth);
    for (let k = 0; k < d; k++) {
      const r = (((row0 + k) % strip.h) + strip.h) % strip.h;
      const v = strip.data[r * w + x] as number;
      e.data[k * w + x] = v === 0 ? 0 : k === d - 1 || v > levels ? 1 : v;
    }
  }
  return e;
}
