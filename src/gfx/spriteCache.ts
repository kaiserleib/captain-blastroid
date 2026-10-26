import { createRng } from '../engine/rng';
import {
  anchorPoint,
  getSpriteEntry,
  onSpriteDefined,
  parseHex,
  spriteIds,
  type PixelBuffer,
  type SpriteEntry,
} from './sprite';

export const ROTATION_STEPS = 16;
const STEP = (Math.PI * 2) / ROTATION_STEPS;
const FLASH_RGB = 0xf8f8f8;

// ---------------------------------------------------------------------------
// Pure pixel ops (no DOM), unit-tested.

export function createBuffer(w: number, h: number): PixelBuffer {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

/** Every opaque pixel becomes `rgb`; used for the white hit-flash. */
export function silhouette(src: PixelBuffer, rgb = FLASH_RGB): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  const s = src.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    if ((s[i + 3] as number) === 0) continue;
    d[i] = (rgb >> 16) & 255;
    d[i + 1] = (rgb >> 8) & 255;
    d[i + 2] = rgb & 255;
    d[i + 3] = s[i + 3] as number;
  }
  return out;
}

/** Grows by 1 px per side and paints `rgb` on transparent pixels 4-adjacent to opaque ones. */
export function addOutline(src: PixelBuffer, rgb: number): PixelBuffer {
  const w = src.w + 2;
  const h = src.h + 2;
  const out = createBuffer(w, h);
  const s = src.data;
  const d = out.data;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = ((y + 1) * w + x + 1) * 4;
      d[di] = s[si] as number;
      d[di + 1] = s[si + 1] as number;
      d[di + 2] = s[si + 2] as number;
      d[di + 3] = s[si + 3] as number;
    }
  }
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (d[(y * w + x) * 4 + 3] as number) > 0;
  const mark: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
        mark.push((y * w + x) * 4);
      }
    }
  }
  for (const i of mark) {
    d[i] = (rgb >> 16) & 255;
    d[i + 1] = (rgb >> 8) & 255;
    d[i + 2] = rgb & 255;
    d[i + 3] = 255;
  }
  return out;
}

/** Output size that holds `w`×`h` rotated about (px, py) at any angle, with the pivot at its center. */
export function rotatedSize(
  w: number,
  h: number,
  px: number,
  py: number,
): { w: number; h: number } {
  let r = 0;
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    r = Math.max(r, Math.hypot(cx - px, cy - py));
  }
  const half = Math.ceil(r - 1e-9);
  // Matching the pivot's half-pixel phase keeps 90° steps exact.
  return { w: half * 2 + (px % 1 !== 0 ? 1 : 0), h: half * 2 + (py % 1 !== 0 ? 1 : 0) };
}

/**
 * Nearest-neighbor rotation by inverse mapping: each output pixel center samples the
 * source pixel under it. Clockwise for positive `angle` (screen y-down). The pivot lands
 * at (outW/2, outH/2).
 */
export function rotateBuffer(
  src: PixelBuffer,
  px: number,
  py: number,
  angle: number,
  outW: number,
  outH: number,
): PixelBuffer {
  const out = createBuffer(outW, outH);
  // Snap tiny float error so 90° multiples are exact.
  let cos = Math.cos(angle);
  let sin = Math.sin(angle);
  if (Math.abs(cos) < 1e-9) cos = 0;
  if (Math.abs(sin) < 1e-9) sin = 0;
  const cx = outW / 2;
  const cy = outH / 2;
  const s = src.data;
  const d = out.data;
  for (let y = 0; y < outH; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < outW; x++) {
      const dx = x + 0.5 - cx;
      const sx = Math.floor(dx * cos + dy * sin + px + 1e-7);
      const sy = Math.floor(-dx * sin + dy * cos + py + 1e-7);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const si = (sy * src.w + sx) * 4;
      const di = (y * outW + x) * 4;
      d[di] = s[si] as number;
      d[di + 1] = s[si + 1] as number;
      d[di + 2] = s[si + 2] as number;
      d[di + 3] = s[si + 3] as number;
    }
  }
  return out;
}

/** Rotation bucket 0..15 for an angle in radians (0 = as authored, clockwise positive). */
export function rotationBucket(rot: number): number {
  return Math.round(rot / STEP) & (ROTATION_STEPS - 1);
}

// ---------------------------------------------------------------------------
// Canvas bakes.

export interface CompiledSprite {
  readonly id: string;
  readonly frames: number;
  /** Cell size and integer draw offset (pivot) for unrotated frames. */
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  /** Frames side by side. */
  readonly sheet: HTMLCanvasElement;
  flashSheet: HTMLCanvasElement | null;
  readonly rotations: 0 | 16;
  /** Rotated cell size and offset; 16 columns × `frames` rows. */
  readonly rw: number;
  readonly rh: number;
  readonly rox: number;
  readonly roy: number;
  rotSheet: HTMLCanvasElement | null;
  rotFlashSheet: HTMLCanvasElement | null;
  readonly pixels: readonly PixelBuffer[];
  readonly pivotX: number;
  readonly pivotY: number;
}

const cache = new Map<string, CompiledSprite>();
onSpriteDefined((id) => cache.delete(id));

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function blit(ctx: CanvasRenderingContext2D, buf: PixelBuffer, x: number, y: number): void {
  const img = ctx.createImageData(buf.w, buf.h);
  img.data.set(buf.data);
  ctx.putImageData(img, x, y);
}

function sheetOf(bufs: readonly PixelBuffer[], cols: number, cw: number, ch: number) {
  const rows = Math.ceil(bufs.length / cols);
  const c = createCanvas(cw * cols, ch * rows);
  const ctx = ctx2d(c);
  bufs.forEach((b, i) => blit(ctx, b, (i % cols) * cw, Math.floor(i / cols) * ch));
  return c;
}

function rasterize(e: SpriteEntry): PixelBuffer[] {
  if (e.kind === 'grid') return e.pixels;
  const out: PixelBuffer[] = [];
  const c = createCanvas(e.w, e.h);
  const ctx = ctx2d(c);
  for (let f = 0; f < e.frameCount; f++) {
    ctx.clearRect(0, 0, e.w, e.h);
    ctx.save();
    e.draw(ctx, f, createRng(`${e.id}#${f}`));
    ctx.restore();
    const img = ctx.getImageData(0, 0, e.w, e.h);
    out.push({ w: e.w, h: e.h, data: new Uint8ClampedArray(img.data) });
  }
  return out;
}

function compile(e: SpriteEntry): CompiledSprite {
  let pixels = rasterize(e);
  let pivot = anchorPoint(e.anchor, e.w, e.h);
  if (e.outline) {
    const rgb = parseHex(e.id, e.outline);
    pixels = pixels.map((p) => addOutline(p, rgb));
    pivot = { x: pivot.x + 1, y: pivot.y + 1 };
  }
  const first = pixels[0] as PixelBuffer;
  const rs =
    e.rotations === 16
      ? rotatedSize(first.w, first.h, pivot.x, pivot.y)
      : { w: first.w, h: first.h };
  return {
    id: e.id,
    frames: pixels.length,
    w: first.w,
    h: first.h,
    ox: Math.floor(pivot.x),
    oy: Math.floor(pivot.y),
    sheet: sheetOf(pixels, pixels.length, first.w, first.h),
    flashSheet: null,
    rotations: e.rotations,
    rw: rs.w,
    rh: rs.h,
    rox: Math.floor(rs.w / 2),
    roy: Math.floor(rs.h / 2),
    rotSheet: null,
    rotFlashSheet: null,
    pixels,
    pivotX: pivot.x,
    pivotY: pivot.y,
  };
}

function rotatedBuffers(c: CompiledSprite): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  for (const p of c.pixels) {
    for (let i = 0; i < ROTATION_STEPS; i++) {
      out.push(rotateBuffer(p, c.pivotX, c.pivotY, i * STEP, c.rw, c.rh));
    }
  }
  return out;
}

/** Compiled sprite, baking its base sheet on first use; null if the id isn't registered. */
export function getCompiled(id: string): CompiledSprite | null {
  let c = cache.get(id);
  if (c) return c;
  const e = getSpriteEntry(id);
  if (!e) return null;
  c = compile(e);
  cache.set(id, c);
  return c;
}

export function flashSheet(c: CompiledSprite): HTMLCanvasElement {
  if (!c.flashSheet) {
    c.flashSheet = sheetOf(
      c.pixels.map((p) => silhouette(p)),
      c.frames,
      c.w,
      c.h,
    );
  }
  return c.flashSheet;
}

export function rotSheet(c: CompiledSprite): HTMLCanvasElement {
  if (!c.rotSheet) c.rotSheet = sheetOf(rotatedBuffers(c), ROTATION_STEPS, c.rw, c.rh);
  return c.rotSheet;
}

export function rotFlashSheet(c: CompiledSprite): HTMLCanvasElement {
  if (!c.rotFlashSheet) {
    c.rotFlashSheet = sheetOf(
      rotatedBuffers(c).map((p) => silhouette(p)),
      ROTATION_STEPS,
      c.rw,
      c.rh,
    );
  }
  return c.rotFlashSheet;
}

/** Bakes everything (frames, flash, rotations) up front, e.g. at scene load. Default: all sprites. */
export function warm(ids: readonly string[] = spriteIds()): void {
  for (const id of ids) {
    const c = getCompiled(id);
    if (!c) throw new Error(`warm(): unknown sprite "${id}"`);
    flashSheet(c);
    if (c.rotations === 16) {
      rotSheet(c);
      rotFlashSheet(c);
    }
  }
}

/** Drops every bake (e.g. after a palette tweak in the gallery). */
export function clearSpriteCache(): void {
  cache.clear();
}
