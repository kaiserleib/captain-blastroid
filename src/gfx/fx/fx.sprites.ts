// Procedural explosion and smoke frames. Every pixel is a palette color; the
// fireball is a cluster of overlapping blobs shaded in hard bands, lit from
// the top-left, that burns down and erodes into dithered smoke.
import { createRng } from '../../engine/rng';
import { FLAME, FX, ROCK, SYNDICATE } from '../palette';
import { defineProcSprite } from '../sprite';

export const BOOM_SIZES = [16, 32, 48] as const;
export type BoomSize = (typeof BOOM_SIZES)[number];
export const BOOM_FRAMES = 8;

export function boomSprite(size: BoomSize): string {
  return `fx_boom_${size}`;
}

// Per-frame shape: blob scale, heat multiplier, and erosion threshold.
const GROW = [0.4, 0.72, 0.9, 1, 1.04, 1.08, 1.1, 1.12];
const HEAT = [3, 1.7, 1.2, 0.95, 0.75, 0.55, 0.38, 0.26];
const ERODE = [0, 0, 0, 0.04, 0.16, 0.34, 0.54, 0.74];
const MAX_GROW = 1.12;

interface Blob {
  x: number;
  y: number;
  r: number;
}

function layout(size: number): { blobs: Blob[]; noise: Float32Array } {
  const rng = createRng(`fx_boom_layout_${size}`);
  const half = size / 2;
  const blobs: Blob[] = [{ x: 0, y: 0, r: (half - 0.5) / MAX_GROW - size * 0.06 }];
  const n = size >= 32 ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const d = size * rng.range(0.12, 0.22);
    const maxR = (half - 0.5 - d) / MAX_GROW;
    blobs.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      r: Math.min(maxR, size * rng.range(0.16, 0.26)),
    });
  }
  // Value noise in 2×2 cells so erosion eats chunky holes, not single pixels.
  const noise = new Float32Array(size * size);
  const cells = Math.ceil(size / 2);
  const cell = new Float32Array(cells * cells);
  for (let i = 0; i < cell.length; i++) cell[i] = rng.next();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++)
      noise[y * size + x] = cell[(y >> 1) * cells + (x >> 1)] as number;
  }
  return { blobs, noise };
}

function boomDraw(size: number) {
  const { blobs, noise } = layout(size);
  const c = size / 2;
  return (ctx: CanvasRenderingContext2D, frame: number): void => {
    const px = (x: number, y: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };

    if (frame === 0) {
      // Flash: hot white core with a 4-point glint.
      const r = size * 0.22;
      const arm = size * 0.48;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - c;
          const dy = y + 0.5 - c;
          const d = Math.hypot(dx, dy);
          if (d <= r) px(x, y, FX.white);
          else if (d <= r + 1.2) px(x, y, FX.yellow);
          else if (
            (Math.abs(dx) < 1 && Math.abs(dy) < arm) ||
            (Math.abs(dy) < 1 && Math.abs(dx) < arm)
          ) {
            px(x, y, d < arm * 0.6 ? FX.white : FX.yellow);
          }
        }
      }
      return;
    }

    const grow = GROW[frame] as number;
    const heat = HEAT[frame] as number;
    const erode = ERODE[frame] as number;
    const late = frame >= 5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        let v = 0;
        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i] as Blob;
          const f = 1 - Math.hypot(dx - b.x * grow, dy - b.y * grow) / (b.r * grow);
          if (f > v) v = f;
        }
        if (v <= 0) continue;
        // Edges burn away first.
        if ((noise[y * size + x] as number) < erode * (1.5 - v)) continue;
        // Top-left light, plus a checker dither so band edges read as SNES shading.
        let h = v * heat - ((dx + dy) / size) * 0.25;
        if (((x + y) & 1) === 0) h += 0.04;
        let color: string;
        if (h > 0.9) color = FX.white;
        else if (h > 0.62) color = FX.yellow;
        else if (h > 0.4) color = FX.orange;
        else if (h > 0.22) color = late ? FLAME.dark : FX.red;
        else if (late) color = h > 0.1 ? FX.smoke : FX.smokeDark;
        else color = SYNDICATE.dark;
        px(x, y, color);
      }
    }
  };
}

for (const s of BOOM_SIZES) {
  defineProcSprite(boomSprite(s), s, s, boomDraw(s), { frames: BOOM_FRAMES });
}

/** Dithered puff that thins out and shrinks over its 4 frames. */
function puffDraw(light: string, dark: string) {
  const size = 8;
  const c = size / 2;
  return (ctx: CanvasRenderingContext2D, frame: number): void => {
    const r = 3.8 - frame * 0.6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        // Solid early, then a checkerboard, then a sparse quarter dither.
        if (frame >= 2 && ((x + y) & 1) !== 0) continue;
        if (frame >= 3 && (x & 1) !== 0) continue;
        ctx.fillStyle = dx + dy > 0.5 || d > r - 1 ? dark : light;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
}

defineProcSprite('fx_smoke', 8, 8, puffDraw(FX.smoke, FX.smokeDark), { frames: 4 });
defineProcSprite('fx_dust', 8, 8, puffDraw(ROCK.light, ROCK.dark), { frames: 4 });

export const FX_SPRITE_IDS: readonly string[] = [
  ...BOOM_SIZES.map(boomSprite),
  'fx_smoke',
  'fx_dust',
];
