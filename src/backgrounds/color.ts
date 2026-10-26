import { snesChannel } from '../gfx/palette';

export type Rgb = readonly [number, number, number];

/** Quantize one channel to SNES BGR555: a multiple of 8 in 0..248 (gfx/palette's rule). */
export const q5 = snesChannel;

export function snes(r: number, g: number, b: number): Rgb {
  return [q5(r), q5(g), q5(b)];
}

export function isQuantized(c: Rgb): boolean {
  return c.every((v) => v >= 0 && v <= 248 && v % 8 === 0);
}

/** HSV value, 0..1. */
export function rgbValue(c: Rgb): number {
  return Math.max(c[0], c[1], c[2]) / 255;
}

export function toCss(c: Rgb): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Opaque pixel for a little-endian Uint32 view over ImageData. */
export function packRgba(c: Rgb): number {
  return ((0xff << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
}
