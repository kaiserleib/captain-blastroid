import { OUTLINE } from './palette';
import type { PortraitTraits } from './traits';

export const W = 48;
export const H = 56;

/**
 * A tiny software framebuffer. Layers paint here (integer coords only), which lets the
 * generator run an outline pass and makes output testable without a canvas.
 */
export class Pixels {
  readonly data: string[];
  /** 1 where the pilot (not the background) has been painted. */
  readonly mask: Uint8Array;
  figure = false;

  constructor(
    readonly w = W,
    readonly h = H,
  ) {
    this.data = new Array<string>(w * h).fill(OUTLINE);
    this.mask = new Uint8Array(w * h);
  }

  rect(color: string, x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x) + Math.floor(w));
    const y1 = Math.min(this.h, Math.floor(y) + Math.floor(h));
    const m = this.figure ? 1 : 0;
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = yy * this.w + xx;
        this.data[i] = color;
        if (m) this.mask[i] = 1;
      }
    }
  }

  px(color: string, x: number, y: number): void {
    this.rect(color, x, y, 1, 1);
  }

  /** Rect with its four corner pixels knocked off, for rounder hair and helmets. */
  rrect(color: string, x: number, y: number, w: number, h: number): void {
    this.rect(color, x + 1, y, w - 2, 1);
    this.rect(color, x, y + 1, w, h - 2);
    this.rect(color, x + 1, y + h - 1, w - 2, 1);
  }

  /** Integer Bresenham line. */
  line(color: string, x0: number, y0: number, x1: number, y1: number): void {
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(color, x, y);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  get(x: number, y: number): string | undefined {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return undefined;
    return this.data[y * this.w + x];
  }

  isFigure(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.mask[y * this.w + x] === 1;
  }

  /** 1 px selective outline around the pilot silhouette (art-direction rule 3). */
  outline(color = OUTLINE): void {
    const hits: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.isFigure(x, y)) continue;
        if (
          this.isFigure(x - 1, y) ||
          this.isFigure(x + 1, y) ||
          this.isFigure(x, y - 1) ||
          this.isFigure(x, y + 1)
        ) {
          hits.push(y * this.w + x);
        }
      }
    }
    for (const i of hits) this.data[i] = color;
  }
}

/** Shared anchor points every layer draws relative to. */
export interface Geo {
  cx: number; // first pixel right of the center line
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  chin: number;
  eyeY: number;
  eyeLX: number;
  eyeRX: number;
  ew: number;
  browY: number;
  noseY: number;
  mouthY: number;
  mouthX: number;
  earY: number;
  neckY: number;
  bodyTop: number;
}

const SHAPES = {
  oval: { w: 16, h: 20, chin: 3, inset: 2 },
  round: { w: 18, h: 18, chin: 2, inset: 3 },
  long: { w: 14, h: 21, chin: 4, inset: 1 },
  square: { w: 18, h: 19, chin: 1, inset: 2 },
  heavy: { w: 20, h: 19, chin: 2, inset: 3 },
} as const;

const FACE_BOTTOM = 37;
export const BODY_TOP = 41;

export function geometry(t: PortraitTraits): Geo {
  const s = SHAPES[t.head];
  const cx = W / 2;
  const fx = cx - s.w / 2;
  const fy = FACE_BOTTOM - s.h;
  const ew = t.eyes === 'large' || t.eyes === 'wide' ? 5 : 4;
  const eyeY = fy + Math.floor(s.h * 0.4);
  const inset = ew === 5 ? Math.max(1, s.inset - 1) : s.inset;
  return {
    cx,
    fx,
    fy,
    fw: s.w,
    fh: s.h,
    chin: s.chin,
    eyeY,
    eyeLX: fx + inset,
    eyeRX: fx + s.w - inset - ew,
    ew,
    browY: eyeY - 2,
    noseY: fy + Math.floor(s.h * 0.5),
    mouthY: fy + Math.floor(s.h * 0.75),
    mouthX: cx - 3,
    earY: eyeY - 1,
    neckY: FACE_BOTTOM - 3,
    bodyTop: BODY_TOP,
  };
}
