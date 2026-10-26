import { createRng } from '../engine/rng';
import { createBitmap, type IndexedBitmap } from './bitmap';
import type { Rgb } from './color';
import { ditherLevel, verticalTilingNoise } from './noise';

export interface NebulaSpec {
  /** Dark → light; index 1..3 in the bitmap. */
  colors: readonly Rgb[];
  /** 0..1, how much of the sky has any cloud. */
  coverage: number;
  /** Lattice size of the broad patches, px; must divide the strip height. */
  patch: number;
}

/** Bayer-dithered value-noise clouds that tile vertically with period `h`. */
export function generateNebula(
  seed: number,
  w: number,
  h: number,
  spec: NebulaSpec,
): IndexedBitmap {
  const rng = createRng(seed);
  const patch = verticalTilingNoise(rng, spec.patch, w, h);
  const o1 = verticalTilingNoise(rng, 64, w, h);
  const o2 = verticalTilingNoise(rng, 32, w, h);
  const o3 = verticalTilingNoise(rng, 16, w, h);
  const o4 = verticalTilingNoise(rng, 8, w, h);
  const levels = spec.colors.length;
  const lo = 1 - spec.coverage;
  const b = createBitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const detail =
        0.5 * o1.sample(x, y) +
        0.27 * o2.sample(x, y) +
        0.15 * o3.sample(x, y) +
        0.08 * o4.sample(x, y);
      // Patches gate where clouds may form, so the sky has clear lanes between them.
      const d = detail * (0.4 + 0.8 * patch.sample(x, y));
      let v = (d - lo) / (1 - lo + 1e-6) / 0.55;
      if (v <= 0) continue;
      if (v > 1) v = 1;
      b.data[y * w + x] = ditherLevel(v, levels, x, y);
    }
  }
  return b;
}

export function nebulaPalette(spec: NebulaSpec): (Rgb | null)[] {
  return [null, ...spec.colors];
}
