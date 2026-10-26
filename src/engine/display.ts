import { clamp } from './math';

export const LOGICAL_W = 240;
export const PLAYFIELD_H = 400;
export const MAX_LOGICAL_H = 520;
/** Prefer a crisp integer scale while it keeps at least this share of the best fractional fit. */
export const INTEGER_SCALE_MIN_FILL = 0.85;
export const LETTERBOX_COLOR = '#000';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Readonly<Insets> = { top: 0, right: 0, bottom: 0, left: 0 };

export interface Layout {
  /** Display canvas backing size, device px. */
  canvasW: number;
  canvasH: number;
  dpr: number;
  /** Logical buffer size. Width is always 240; height is 400..520. */
  logicalW: number;
  logicalH: number;
  /** Height of the top HUD band; the playfield starts here in the logical buffer. */
  playfieldOffsetY: number;
  /** Device px per logical px. */
  scale: number;
  integerScale: boolean;
  /** Where the logical buffer lands on the display canvas, device px. */
  destX: number;
  destY: number;
  destW: number;
  destH: number;
}

/** Pure layout math for a CSS-px viewport, device pixel ratio and safe-area insets. */
export function computeLayout(
  cssW: number,
  cssH: number,
  dpr: number,
  insets: Readonly<Insets> = NO_INSETS,
): Layout {
  const canvasW = Math.max(1, Math.round(cssW * dpr));
  const canvasH = Math.max(1, Math.round(cssH * dpr));
  const availX = insets.left * dpr;
  const availY = insets.top * dpr;
  const availW = Math.max(1, (cssW - insets.left - insets.right) * dpr);
  const availH = Math.max(1, (cssH - insets.top - insets.bottom) * dpr);

  let logicalH = clamp(Math.round((LOGICAL_W * availH) / availW), PLAYFIELD_H, MAX_LOGICAL_H);
  const fit = Math.min(availW / LOGICAL_W, availH / logicalH);
  const k = Math.floor(fit);
  const integerScale = k >= 1 && k / fit >= INTEGER_SCALE_MIN_FILL;
  const scale = integerScale ? k : fit;
  // A smaller integer scale leaves vertical room; give it to the HUD bands.
  if (integerScale) logicalH = clamp(Math.floor(availH / k), logicalH, MAX_LOGICAL_H);

  const destW = Math.round(LOGICAL_W * scale);
  const destH = Math.round(logicalH * scale);
  return {
    canvasW,
    canvasH,
    dpr,
    logicalW: LOGICAL_W,
    logicalH,
    playfieldOffsetY: Math.floor((logicalH - PLAYFIELD_H) / 2),
    scale,
    integerScale,
    destX: Math.round(availX + (availW - destW) / 2),
    destY: Math.round(availY + (availH - destH) / 2),
    destW,
    destH,
  };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * CSS px relative to the display canvas -> logical buffer px (not playfield:
 * subtract `playfieldOffsetY` for that). Writes into `out` to avoid allocating.
 */
export function cssToLogical(
  layout: Layout,
  cssX: number,
  cssY: number,
  out: Point = { x: 0, y: 0 },
): Point {
  out.x = (cssX * layout.dpr - layout.destX) * (layout.logicalW / layout.destW);
  out.y = (cssY * layout.dpr - layout.destY) * (layout.logicalH / layout.destH);
  return out;
}

function readSafeAreaInsets(probe: HTMLElement): Insets {
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
}

/**
 * Owns the full-screen display canvas and the logical-resolution offscreen
 * buffer that everything renders into. `present()` upscales nearest-neighbor.
 */
export class Display {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  layout: Layout;
  private readonly displayCtx: CanvasRenderingContext2D;
  private readonly probe: HTMLElement;
  private readonly listeners: ((layout: Layout) => void)[] = [];
  private canvasRect = { left: 0, top: 0 };
  private dprQuery: MediaQueryList | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.displayCtx = get2d(canvas);
    this.buffer = document.createElement('canvas');
    this.ctx = get2d(this.buffer);

    // env() is only readable through computed style, so measure a hidden element.
    this.probe = document.createElement('div');
    this.probe.style.cssText =
      'position:fixed;inset:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(this.probe);

    this.layout = computeLayout(1, 1, 1);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    this.resize();
  }

  /** Called immediately with the current layout, then on every change. */
  onResize(fn: (layout: Layout) => void): void {
    this.listeners.push(fn);
    fn(this.layout);
  }

  screenToLogical(clientX: number, clientY: number, out?: Point): Point {
    return cssToLogical(
      this.layout,
      clientX - this.canvasRect.left,
      clientY - this.canvasRect.top,
      out,
    );
  }

  present(): void {
    const l = this.layout;
    this.displayCtx.drawImage(this.buffer, l.destX, l.destY, l.destW, l.destH);
  }

  readonly resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const l = computeLayout(
      window.innerWidth,
      window.innerHeight,
      dpr,
      readSafeAreaInsets(this.probe),
    );
    this.layout = l;

    // Resizing a canvas resets its context state, including smoothing.
    this.canvas.width = l.canvasW;
    this.canvas.height = l.canvasH;
    this.buffer.width = l.logicalW;
    this.buffer.height = l.logicalH;
    this.displayCtx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
    this.displayCtx.fillStyle = LETTERBOX_COLOR;
    this.displayCtx.fillRect(0, 0, l.canvasW, l.canvasH);

    const rect = this.canvas.getBoundingClientRect();
    this.canvasRect = { left: rect.left, top: rect.top };
    this.watchDpr(dpr);
    for (const fn of this.listeners) fn(l);
  };

  // Moving between monitors or browser zoom changes DPR without a resize event.
  private watchDpr(dpr: number): void {
    this.dprQuery?.removeEventListener('change', this.resize);
    this.dprQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    this.dprQuery.addEventListener('change', this.resize);
  }
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  return ctx;
}
