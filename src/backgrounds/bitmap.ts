import { packRgba, type Rgb } from './color';

/** Palette-indexed pixels. Index 0 is transparent. */
export interface IndexedBitmap {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
}

export function createBitmap(w: number, h: number): IndexedBitmap {
  return { w, h, data: new Uint8Array(w * h) };
}

/** Writes with vertical wrap so strips tile seamlessly; x outside the bitmap is dropped. */
export function plotWrapY(b: IndexedBitmap, x: number, y: number, idx: number): void {
  if (x < 0 || x >= b.w) return;
  const yy = ((y % b.h) + b.h) % b.h;
  b.data[yy * b.w + x] = idx;
}

export function plot(b: IndexedBitmap, x: number, y: number, idx: number): void {
  if (x < 0 || x >= b.w || y < 0 || y >= b.h) return;
  b.data[y * b.w + x] = idx;
}

export function get(b: IndexedBitmap, x: number, y: number): number {
  if (x < 0 || x >= b.w || y < 0 || y >= b.h) return 0;
  return b.data[y * b.w + x] as number;
}

/** `palette[i]` colors index i; null or missing entries stay transparent. */
export function bitmapToCanvas(
  b: IndexedBitmap,
  palette: readonly (Rgb | null | undefined)[],
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = b.w;
  canvas.height = b.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const img = ctx.createImageData(b.w, b.h);
  const px = new Uint32Array(img.data.buffer);
  const lut = new Uint32Array(256);
  for (let i = 1; i < palette.length && i < 256; i++) {
    const c = palette[i];
    if (c) lut[i] = packRgba(c);
  }
  for (let i = 0; i < b.data.length; i++) px[i] = lut[b.data[i] as number] as number;
  ctx.putImageData(img, 0, 0);
  return canvas;
}
