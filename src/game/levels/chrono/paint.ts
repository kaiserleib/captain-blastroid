// Index-buffer painter for the Chrono Rift's procedural sprites, in the Rock
// Hauler's style (copied from the Armada's, since sector folders don't share
// internals): shapes get automatic top-left bevels, round things per-pixel
// sphere lighting with ordered dithering. Colors are 0xRRGGBB ints from 15-bit
// ramps (shadow → dark → base → light → highlight).
import type { Rng } from '../../../engine/rng';
import { GLOW, GUNMETAL, OLIVE, OUTLINE, snes, SYNDICATE, WHITE } from '../../../gfx/palette';
import { defineProcSprite } from '../../../gfx/sprite';

export type Ramp5 = readonly [number, number, number, number, number];
export type Mask = (x: number, y: number) => boolean;

export function c(hex: string): number {
  return parseInt(snes(hex).slice(1), 16);
}

export function ramp5(a: string, b: string, cc: string, d: string, e: string): Ramp5 {
  return [c(a), c(b), c(cc), c(d), c(e)];
}

export const S = 0;
export const D = 1;
export const B = 2;
export const L = 3;
export const H = 4;

/** Syndicate rust, gunmetal and olive: the faction look every sector keeps. */
export const RUST: Ramp5 = [
  c(SYNDICATE.shadow),
  c(SYNDICATE.dark),
  c(SYNDICATE.base),
  c(SYNDICATE.light),
  c(SYNDICATE.highlight),
];
export const GUN: Ramp5 = [
  c('#100c18'),
  c(GUNMETAL.dark),
  c(GUNMETAL.base),
  c(GUNMETAL.light),
  c(GUNMETAL.highlight),
];
export const OLV: Ramp5 = [
  c('#181808'),
  c(OLIVE.dark),
  c(OLIVE.base),
  c(OLIVE.light),
  c(OLIVE.highlight),
];
export const GLOWR: Ramp5 = [
  c('#103008'),
  c(GLOW.greenDark),
  c(GLOW.green),
  c(GLOW.greenHot),
  c(WHITE),
];
/** Rift tech: desaturated violet and chrome. */
export const VIOLET = ramp5('#100818', '#281840', '#483070', '#7058a0', '#a890d0');
/** Echo palette: violet, black and white. */
export const ECHO_R = ramp5('#080410', '#201030', '#503878', '#9078c0', '#f0e8f8');
/** Slow-time blue (the slow bubble's ring) and fast-time amber. */
export const SLOWB = ramp5('#081028', '#103870', '#2870c0', '#68b0f0', '#d0e8f8');
export const AMBERR = ramp5('#301000', '#784000', '#c87000', '#f8a800', '#f8e088');
export const INK = c(OUTLINE);
export const WHITE_I = c(WHITE);
export const RED = c(GLOW.red);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;
}

// Light from the top-left, slightly toward the viewer.
export const LX = -0.48;
export const LY = -0.56;
export const LZ = 0.67;

/** Light value → ramp index, dithered across the band edges. */
export function level(lum: number, x: number, y: number): number {
  const t = (lum + 0.15) / 1.1;
  const k = Math.floor(t * 5 + (bayer(x, y) - 0.5) * 0.7);
  return k < 0 ? 0 : k > 4 ? 4 : k;
}

/** An RGB index buffer with painting helpers. -1 is transparent. */
export class Paint {
  readonly d: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Int32Array(w * h).fill(-1);
  }

  set(x: number, y: number, col: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = col;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.d[y * this.w + x] as number;
  }

  rect(x: number, y: number, w: number, h: number, col: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }

  /** Fills a mask with a bevel: top/left edges lit, bottom/right edges dark. */
  shape(x0: number, y0: number, x1: number, y1: number, inside: Mask, r: Ramp5, base = B): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        const up = inside(x, y - 1);
        const lf = inside(x - 1, y);
        const dn = inside(x, y + 1);
        const rt = inside(x + 1, y);
        let k = base;
        if (!up && !lf) k = H;
        else if (!up || !lf) k = L;
        else if (!dn && !rt) k = S;
        else if (!dn || !rt) k = D;
        this.set(x, y, r[k] as number);
      }
    }
  }

  /** Bevelled axis-aligned box. */
  box(x: number, y: number, w: number, h: number, r: Ramp5, base = B): void {
    this.shape(x, y, x + w - 1, y + h - 1, () => true, r, base);
  }

  /** Sphere-lit disc (cx, cy in pixel-edge coordinates). `bias` brightens or darkens. */
  sphere(cx: number, cy: number, rad: number, r: Ramp5, bias = 0, mask?: Mask): void {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        const nx = (x + 0.5 - cx) / rad;
        const ny = (y + 0.5 - cy) / rad;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1 || (mask && !mask(x, y))) continue;
        const nz = Math.sqrt(1 - d2);
        const lum = nx * LX + ny * LY + nz * LZ;
        this.set(x, y, r[level(lum + bias, x, y)] as number);
      }
    }
  }

  /** Vertical cylinder shading across [x0, x0 + w). */
  cylinder(x0: number, y0: number, w: number, h: number, r: Ramp5, mask?: Mask): void {
    for (let x = x0; x < x0 + w; x++) {
      const nx = ((x + 0.5 - x0) / w) * 2 - 1;
      const lum = nx * LX * 1.3 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.75;
      for (let y = y0; y < y0 + h; y++) {
        if (mask && !mask(x, y)) continue;
        this.set(x, y, r[level(lum, x, y)] as number);
      }
    }
  }

  /** Horizontal cylinder shading across [y0, y0 + h). */
  hcylinder(x0: number, y0: number, w: number, h: number, r: Ramp5, mask?: Mask): void {
    for (let y = y0; y < y0 + h; y++) {
      const ny = ((y + 0.5 - y0) / h) * 2 - 1;
      const lum = ny * LY * 1.3 + Math.sqrt(Math.max(0, 1 - ny * ny)) * 0.75;
      for (let x = x0; x < x0 + w; x++) {
        if (mask && !mask(x, y)) continue;
        this.set(x, y, r[level(lum, x, y)] as number);
      }
    }
  }

  /** A rivet: a lit head with a shadow below-right. */
  rivet(x: number, y: number, r: Ramp5): void {
    this.set(x, y, r[H]);
    this.set(x + 1, y + 1, r[S]);
  }

  /** Swaps `from` for `to` at random with probability `p`. */
  speckle(rng: Rng, from: number, to: number, p: number, x0 = 0, y0 = 0, x1 = 1e9, y1 = 1e9): void {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) {
        if (this.get(x, y) === from && rng.next() < p) this.set(x, y, to);
      }
    }
  }

  /** Mirrors the left half onto the right (for symmetric parts). */
  mirror(): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w >> 1; x++) {
        this.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x] as number;
      }
    }
  }

  copyFrom(o: Paint): void {
    this.d.set(o.d);
  }

  flush(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const col = this.d[y * this.w + x] as number;
        let e = x + 1;
        while (e < this.w && this.d[y * this.w + e] === col) e++;
        if (col >= 0) {
          ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
          ctx.fillRect(x, y, e - x, 1);
        }
        x = e;
      }
    }
  }
}

/** Defines a painted sprite with the standard outline. */
export function proc(
  id: string,
  w: number,
  h: number,
  frames: number,
  paint: (p: Paint, f: number) => void,
  rotations: 0 | 16 = 0,
  outline: boolean = true,
): void {
  defineProcSprite(
    id,
    w,
    h,
    (ctx, f) => {
      const p = new Paint(w, h);
      paint(p, f);
      p.flush(ctx);
    },
    { frames, outline: outline ? OUTLINE : false, rotations },
  );
}
