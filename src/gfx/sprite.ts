import type { Rng } from '../engine/rng';

/** Where the sprite's (x, y) sits. `center` (default) is floor(w/2), floor(h/2). */
export type Anchor = 'center' | 'top' | 'bottom' | { x: number; y: number };

export interface SpriteDef {
  /** One char → `#rrggbb`. `.` is always transparent and can't be remapped. */
  palette: Readonly<Record<string, string>>;
  /** One grid string per frame. Rows are trimmed, blank lines dropped, ragged rows padded with `.`. */
  frames: readonly string[];
  anchor?: Anchor;
  /** 16 pre-bakes the rotations the renderer picks from `rot`. */
  rotations?: 0 | 16;
  /** Author the left half only. `true` mirrors every column; `'odd'` shares the last column as the center. */
  mirrorX?: boolean | 'odd';
  /** Adds a 1 px outline around opaque pixels (grows the sprite by 1 px per side). `true` uses OUTLINE. */
  outline?: boolean | string;
}

export interface ProcSpriteOpts {
  frames?: number;
  anchor?: Anchor;
  rotations?: 0 | 16;
  outline?: boolean | string;
}

/** Draws one frame at integer coords with fillRect. `rng` is seeded from the sprite id and frame. */
export type ProcDraw = (ctx: CanvasRenderingContext2D, frame: number, rng: Rng) => void;

/** RGBA, row-major, same layout as ImageData. */
export interface PixelBuffer {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

interface EntryBase {
  id: string;
  w: number;
  h: number;
  frameCount: number;
  anchor: Anchor;
  rotations: 0 | 16;
  /** RGBA string, or null for no auto-outline. */
  outline: string | null;
}

export interface GridSpriteEntry extends EntryBase {
  kind: 'grid';
  pixels: PixelBuffer[];
}

export interface ProcSpriteEntry extends EntryBase {
  kind: 'proc';
  draw: ProcDraw;
}

export type SpriteEntry = GridSpriteEntry | ProcSpriteEntry;

const DEFAULT_OUTLINE = '#100818';

const registry = new Map<string, SpriteEntry>();
const listeners: ((id: string) => void)[] = [];

/** Parses `#rrggbb` into packed 0xRRGGBB. */
export function parseHex(id: string, hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`sprite "${id}": bad color "${hex}" (want #rrggbb)`);
  return parseInt(m[1] as string, 16);
}

/** Splits a grid literal into trimmed, non-empty rows. */
export function gridRows(src: string): string[] {
  const rows: string[] = [];
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (t.length > 0) rows.push(t);
  }
  return rows;
}

function mirrorRows(rows: string[], mode: true | 'odd'): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => {
    const left = r.padEnd(w, '.');
    let right = '';
    for (let i = left.length - (mode === 'odd' ? 2 : 1); i >= 0; i--) right += left[i];
    return left + right;
  });
}

/**
 * Parses grid frames into RGBA buffers. Every frame is padded to the widest/tallest
 * row of any frame (top-left aligned), so all frames share one size.
 */
export function parseFrames(
  id: string,
  frames: readonly string[],
  palette: Readonly<Record<string, string>>,
  mirrorX: boolean | 'odd' = false,
): PixelBuffer[] {
  if (frames.length === 0) throw new Error(`sprite "${id}": no frames`);
  const colors = new Map<string, number>();
  for (const key in palette) {
    if (key.length !== 1) throw new Error(`sprite "${id}": palette key "${key}" must be one char`);
    if (key === '.') throw new Error(`sprite "${id}": "." is reserved for transparent`);
    colors.set(key, parseHex(id, palette[key] as string));
  }
  const grids = frames.map((f) => {
    const rows = gridRows(f);
    return mirrorX ? mirrorRows(rows, mirrorX) : rows;
  });
  let w = 0;
  let h = 0;
  for (const g of grids) {
    h = Math.max(h, g.length);
    for (const r of g) w = Math.max(w, r.length);
  }
  if (w === 0) throw new Error(`sprite "${id}": empty frames`);
  return grids.map((rows, fi) => {
    const data = new Uint8ClampedArray(w * h * 4);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x] as string;
        if (ch === '.') continue;
        const c = colors.get(ch);
        if (c === undefined) {
          throw new Error(
            `sprite "${id}": unknown char "${ch}" at frame ${fi} row ${y} col ${x} (not in palette)`,
          );
        }
        const i = (y * w + x) * 4;
        data[i] = (c >> 16) & 255;
        data[i + 1] = (c >> 8) & 255;
        data[i + 2] = c & 255;
        data[i + 3] = 255;
      }
    });
    return { w, h, data };
  });
}

function outlineColor(o: boolean | string | undefined): string | null {
  if (!o) return null;
  return o === true ? DEFAULT_OUTLINE : o;
}

function store(entry: SpriteEntry): void {
  registry.set(entry.id, entry);
  for (const fn of listeners) fn(entry.id);
}

/** Registers a string-grid sprite. Redefining an id replaces it (HMR-friendly). */
export function defineSprite(id: string, def: SpriteDef): void {
  const pixels = parseFrames(id, def.frames, def.palette, def.mirrorX ?? false);
  const first = pixels[0] as PixelBuffer;
  if (def.outline && def.outline !== true) parseHex(id, def.outline);
  store({
    kind: 'grid',
    id,
    w: first.w,
    h: first.h,
    frameCount: pixels.length,
    anchor: def.anchor ?? 'center',
    rotations: def.rotations ?? 0,
    outline: outlineColor(def.outline),
    pixels,
  });
}

/** Registers a procedural sprite drawn once per frame at compile time (seeded, deterministic). */
export function defineProcSprite(
  id: string,
  w: number,
  h: number,
  draw: ProcDraw,
  opts: ProcSpriteOpts = {},
): void {
  if (!(w > 0 && h > 0)) throw new Error(`sprite "${id}": bad size ${w}x${h}`);
  store({
    kind: 'proc',
    id,
    w: Math.round(w),
    h: Math.round(h),
    frameCount: Math.max(1, opts.frames ?? 1),
    anchor: opts.anchor ?? 'center',
    rotations: opts.rotations ?? 0,
    outline: outlineColor(opts.outline),
    draw,
  });
}

export function getSpriteEntry(id: string): SpriteEntry | undefined {
  return registry.get(id);
}

export function hasSprite(id: string): boolean {
  return registry.has(id);
}

/** All registered ids in definition order. */
export function spriteIds(): string[] {
  return [...registry.keys()];
}

/** Called with the id whenever a sprite is (re)defined; the cache uses it to drop stale bakes. */
export function onSpriteDefined(fn: (id: string) => void): void {
  listeners.push(fn);
}

/** Pivot in source pixels. Center is the exact geometric center so rotations stay symmetric. */
export function anchorPoint(anchor: Anchor, w: number, h: number): { x: number; y: number } {
  if (anchor === 'center') return { x: w / 2, y: h / 2 };
  if (anchor === 'top') return { x: w / 2, y: 0 };
  if (anchor === 'bottom') return { x: w / 2, y: h };
  return { x: anchor.x, y: anchor.y };
}
