// Bitmap fonts as glyph grids ('#' = lit). Proportional widths come from each grid's
// row length; digits share one width so scores don't jitter.
//
// `ui` is the main font: thin 1 px strokes, 6 px caps, 1 px ascenders/descenders in an
// 8 px cell, modeled on the 8px monospace look of the T00 debug overlay (sampled and
// hand-tidied so it is pixel-identical on every browser). `small` is the 3×5 HUD font.

export type FontId = 'ui' | 'small';

interface GlyphSrc {
  readonly [ch: string]: readonly string[];
}

const UI_GLYPHS: GlyphSrc = {
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'],
  L: ['#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '#..#', '###.', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#..#', '#.#.', '.#.#'],
  R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '...#', '###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['####', '...#', '..#.', '.#..', '#...', '####'],

  a: ['....', '.##.', '...#', '.###', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '###.'],
  c: ['....', '.###', '#...', '#...', '#...', '.###'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '.###'],
  e: ['....', '.##.', '#..#', '####', '#...', '.###'],
  f: ['.##', '#..', '###', '#..', '#..', '#..'],
  g: ['....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '###'],
  j: ['..#', '...', '.##', '..#', '..#', '..#', '..#', '##.'],
  k: ['#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#.', '###', '.#.', '.#.', '.#.', '..#'],
  u: ['....', '#..#', '#..#', '#..#', '#..#', '.###'],
  v: ['.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  w: ['.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  z: ['....', '####', '...#', '.##.', '#...', '####'],

  '0': ['.##.', '#..#', '#.##', '##.#', '#..#', '.##.'],
  '1': ['.#..', '##..', '.#..', '.#..', '.#..', '###.'],
  '2': ['.##.', '#..#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['..#.', '.##.', '#.#.', '####', '..#.', '..#.'],
  '5': ['####', '#...', '###.', '...#', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],

  '.': ['.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '#', '.', '.', '#', '.'],
  ';': ['..', '.#', '..', '..', '.#', '.#', '#.'],
  '!': ['#', '#', '#', '#', '.', '#'],
  '?': ['.##.', '#..#', '..#.', '.#..', '....', '.#..'],
  '-': ['...', '...', '...', '###'],
  '+': ['...', '.#.', '###', '.#.'],
  '×': ['...', '...', '#.#', '.#.', '#.#'],
  '/': ['...#', '..#.', '..#.', '.#..', '.#..', '#...'],
  '%': ['##..#', '##.#.', '..#..', '..#..', '.#.##', '#..##'],
  '(': ['.#', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '#.'],
  "'": ['#', '#'],
  '"': ['#.#', '#.#'],
  '<': ['...', '..#', '.#.', '#..', '.#.', '..#'],
  '>': ['...', '#..', '.#.', '..#', '.#.', '#..'],
  '=': ['....', '....', '####', '....', '####'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.'],
  '*': ['...', '#.#', '.#.', '#.#'],
  _: ['....', '....', '....', '....', '....', '....', '....', '####'],
  $: ['.###.', '#.#..', '.###.', '..#.#', '.###.', '..#..'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '▶': ['#..', '##.', '###', '##.', '#..'],
  '⬢': ['.###.', '#####', '#####', '#####', '.###.'],
  '⬡': ['.###.', '#...#', '#...#', '#...#', '.###.'],
};

// Shifts the 5-row pips and cursor down a row so they center on the 6 px caps.
const UI_YOFF: Readonly<Record<string, number>> = { '▶': 1, '⬢': 1, '⬡': 1 };

const SMALL_GLYPHS: GlyphSrc = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '.#.', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '#', '.'],
  ';': ['.', '#', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '-': ['...', '...', '###'],
  '+': ['...', '.#.', '###', '.#.'],
  '×': ['...', '#.#', '.#.', '#.#'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  "'": ['#', '#'],
  '"': ['#.#', '#.#'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '=': ['...', '###', '...', '###'],
  $: ['.##', '##.', '.#.', '.##', '##.'],
  '→': ['..#..', '...#.', '#####', '...#.', '..#..'],
  '←': ['..#..', '.#...', '#####', '.#...', '..#..'],
  '↑': ['.#.', '###', '.#.', '.#.', '.#.'],
  '↓': ['.#.', '.#.', '.#.', '###', '.#.'],
  '▶': ['#..', '##.', '###', '##.', '#..'],
  '⬢': ['.###.', '#####', '#####', '#####', '.###.'],
  '⬡': ['.###.', '#...#', '#...#', '#...#', '.###.'],
};

export interface Glyph {
  readonly w: number;
  /** Lit pixels as (x, y) pairs. */
  readonly bits: Uint8Array;
  /** X position in the tinted atlas. */
  readonly ax: number;
}

export interface BitmapFont {
  readonly id: FontId;
  /** Glyph cell height (rows incl. descenders). */
  readonly cellH: number;
  /** Baseline-to-baseline distance for multi-line text. */
  readonly lineHeight: number;
  /** Gap between glyphs. */
  readonly spacing: number;
  readonly spaceW: number;
  readonly atlasW: number;
  /** Glyph by char code, ASCII fast path; `extra` holds the rest. */
  readonly ascii: (Glyph | undefined)[];
  readonly extra: Map<number, Glyph>;
  readonly fallback: Glyph;
}

function buildFont(
  id: FontId,
  src: GlyphSrc,
  cellH: number,
  lineHeight: number,
  spaceW: number,
  yoff: Readonly<Record<string, number>> = {},
  digitW = 0,
): BitmapFont {
  const ascii: (Glyph | undefined)[] = new Array(128);
  const extra = new Map<number, Glyph>();
  let ax = 0;
  for (const ch of Object.keys(src)) {
    const rows = src[ch] as readonly string[];
    const dy = yoff[ch] ?? 0;
    let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    if (digitW && ch >= '0' && ch <= '9') w = Math.max(w, digitW);
    if (rows.length + dy > cellH) throw new Error(`font ${id}: glyph "${ch}" taller than cell`);
    const bits: number[] = [];
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const c = r[x];
        if (c === '#') bits.push(x, y + dy);
        else if (c !== '.') throw new Error(`font ${id}: glyph "${ch}" has bad char "${c}"`);
      }
    });
    const g: Glyph = { w, bits: Uint8Array.from(bits), ax };
    ax += w + 1;
    const code = ch.charCodeAt(0);
    if (code < 128) ascii[code] = g;
    else extra.set(code, g);
  }
  // Fonts without lowercase render it as uppercase.
  for (let c = 97; c <= 122; c++) ascii[c] ??= ascii[c - 32];
  const fallback = ascii[63] as Glyph; // '?'
  return { id, cellH, lineHeight, spacing: 1, spaceW, atlasW: ax, ascii, extra, fallback };
}

export const FONT_UI = buildFont('ui', UI_GLYPHS, 8, 9, 3, UI_YOFF, 4);
export const FONT_SMALL = buildFont('small', SMALL_GLYPHS, 6, 7, 2, {}, 3);

export const FONTS: Readonly<Record<FontId, BitmapFont>> = { ui: FONT_UI, small: FONT_SMALL };

export function getFont(font: FontId | BitmapFont = 'ui'): BitmapFont {
  return typeof font === 'string' ? FONTS[font] : font;
}

const SPACE = 32;

/** Glyph for a char code; null for space. Unknown chars render as '?'. */
export function glyphFor(f: BitmapFont, code: number): Glyph | null {
  if (code === SPACE) return null;
  return (code < 128 ? f.ascii[code] : f.extra.get(code)) ?? f.fallback;
}

function advance(f: BitmapFont, code: number): number {
  const g = glyphFor(f, code);
  return (g ? g.w : f.spaceW) + f.spacing;
}

/** Width in px of the widest line (no trailing spacing, no shadow), at scale 1. */
export function measure(str: string, font: FontId | BitmapFont = 'ui'): number {
  const f = getFont(font);
  let best = 0;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 10) {
      if (w > 0) w -= f.spacing;
      if (w > best) best = w;
      w = 0;
      continue;
    }
    w += advance(f, code);
  }
  if (w > 0) w -= f.spacing;
  return w > best ? w : best;
}

export function lineCount(str: string): number {
  let n = 1;
  for (let i = 0; i < str.length; i++) if (str.charCodeAt(i) === 10) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Drawing: one tinted atlas per (font, color), built on first use.

const atlases = new Map<BitmapFont, Map<string, HTMLCanvasElement>>();

function atlas(f: BitmapFont, color: string): HTMLCanvasElement {
  let byColor = atlases.get(f);
  if (!byColor) atlases.set(f, (byColor = new Map()));
  let c = byColor.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = f.atlasW;
  c.height = f.cellH;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.fillStyle = color;
  const all = [...f.ascii.filter((g): g is Glyph => !!g), ...f.extra.values()];
  for (const g of new Set(all)) {
    for (let i = 0; i < g.bits.length; i += 2) {
      ctx.fillRect(g.ax + (g.bits[i] as number), g.bits[i + 1] as number, 1, 1);
    }
  }
  byColor.set(color, c);
  return c;
}

export interface DrawTextOpts {
  font?: FontId | BitmapFont;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** 1 px (× scale) drop shadow, down-right. Default on. */
  shadow?: boolean;
  shadowColor?: string;
  /** Integer upscale, for titles. */
  scale?: number;
}

const DEFAULT_COLOR = '#f8f8f8';
const DEFAULT_SHADOW = '#000000';

function drawRun(
  ctx: CanvasRenderingContext2D,
  f: BitmapFont,
  img: HTMLCanvasElement,
  str: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  s: number,
): void {
  let start = 0;
  let line = 0;
  for (let i = 0; i <= str.length; i++) {
    const code = i < str.length ? str.charCodeAt(i) : 10;
    if (code !== 10) continue;
    // Measure this line without slicing the string.
    let w = 0;
    for (let j = start; j < i; j++) w += advance(f, str.charCodeAt(j));
    if (w > 0) w -= f.spacing;
    let cx = align === 'left' ? x : align === 'center' ? x - Math.floor((w * s) / 2) : x - w * s;
    const cy = y + line * f.lineHeight * s;
    for (let j = start; j < i; j++) {
      const c = str.charCodeAt(j);
      const g = glyphFor(f, c);
      if (g) ctx.drawImage(img, g.ax, 0, g.w, f.cellH, cx, cy, g.w * s, f.cellH * s);
      cx += ((g ? g.w : f.spaceW) + f.spacing) * s;
    }
    start = i + 1;
    line++;
  }
}

/** Draws text with its top-left (or top-center/right per `align`) at integer (x, y). */
export function drawText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  opts?: DrawTextOpts,
): void {
  const f = getFont(opts?.font);
  const s = opts?.scale ?? 1;
  const align = opts?.align ?? 'left';
  x = Math.round(x);
  y = Math.round(y);
  if (opts?.shadow ?? true) {
    drawRun(ctx, f, atlas(f, opts?.shadowColor ?? DEFAULT_SHADOW), str, x + s, y + s, align, s);
  }
  drawRun(ctx, f, atlas(f, opts?.color ?? DEFAULT_COLOR), str, x, y, align, s);
}
