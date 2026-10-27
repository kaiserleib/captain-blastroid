import { createRng } from '../engine/rng';
import { createBitmap, plotWrapY, type IndexedBitmap } from './bitmap';
import type { Rgb } from './color';

export interface StarSpec {
  /** Dim, mid, bright. */
  colors: readonly [Rgb, Rgb, Rgb];
  /** Stars per 10 000 px². */
  density: number;
  /** Share of stars that twinkle, 0..1. */
  twinkle: number;
  /**
   * Afterimage spacing, px: steady mid and bright stars leave dim ghost copies
   * this far above them (where they just were). Bright stars leave two.
   */
  ghosts?: number;
}

export interface StreakSpec {
  /** Head (leading, lower end) and tail. */
  head: Rgb;
  tail: Rgb;
  /** Streaks per 10 000 px². */
  density: number;
}

/** Twinkling stars are split into this many groups whose palette entries cycle out of phase. */
export const TWINKLE_PHASES = 4;
/** Star palette indices: 1..3 steady brightness levels, then one per twinkle group. */
export const TWINKLE_BASE_INDEX = 4;
// Brightness level (1..3, 0 = off) a twinkle group shows at each phase.
const TWINKLE_CYCLE = [3, 2, 1, 2] as const;

export function generateStars(seed: number, w: number, h: number, spec: StarSpec): IndexedBitmap {
  const rng = createRng(seed);
  const b = createBitmap(w, h);
  const n = Math.round((w * h * spec.density) / 10000);
  for (let i = 0; i < n; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, h - 1);
    const roll = rng.next();
    if (rng.chance(spec.twinkle)) {
      plotWrapY(b, x, y, TWINKLE_BASE_INDEX + rng.int(0, TWINKLE_PHASES - 1));
    } else {
      // Mostly dim; a bright star is rare enough to feel special.
      const lvl = roll < 0.62 ? 1 : roll < 0.92 ? 2 : 3;
      plotWrapY(b, x, y, lvl);
      const g = spec.ghosts ?? 0;
      if (g > 0 && lvl > 1) {
        ghost(b, x, y - g);
        if (lvl === 3) ghost(b, x, y - 2 * g);
      }
    }
  }
  return b;
}

function ghost(b: IndexedBitmap, x: number, y: number): void {
  const yy = ((y % b.h) + b.h) % b.h;
  if (!b.data[yy * b.w + x]) b.data[yy * b.w + x] = 1;
}

/** Palette for one twinkle phase: the "palette cycle" swaps these, never per-star draws. */
export function starPalette(spec: StarSpec, phase: number): (Rgb | null)[] {
  const [dim, mid, bright] = spec.colors;
  const levels: (Rgb | null)[] = [null, dim, mid, bright];
  const pal: (Rgb | null)[] = [null, dim, mid, bright];
  for (let g = 0; g < TWINKLE_PHASES; g++) {
    pal[TWINKLE_BASE_INDEX + g] =
      levels[TWINKLE_CYCLE[(phase + g) % TWINKLE_PHASES] as number] ?? null;
  }
  return pal;
}

/** Sparse 1×2 / 1×3 vertical streaks: index 1 head, 2 tail. */
export function generateStreaks(
  seed: number,
  w: number,
  h: number,
  spec: StreakSpec,
): IndexedBitmap {
  const rng = createRng(seed);
  const b = createBitmap(w, h);
  const n = Math.round((w * h * spec.density) / 10000);
  for (let i = 0; i < n; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, h - 1);
    const len = rng.chance(0.5) ? 2 : 3;
    // Motion is downward, so the bright head sits at the bottom.
    plotWrapY(b, x, y + len - 1, 1);
    for (let k = 0; k < len - 1; k++) plotWrapY(b, x, y + k, 2);
  }
  return b;
}

export function streakPalette(spec: StreakSpec): (Rgb | null)[] {
  return [null, spec.head, spec.tail];
}
