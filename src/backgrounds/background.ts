import { hashSeed } from '../engine/rng';
import { bitmapToCanvas } from './bitmap';
import { toCss } from './color';
import { generateNebula, nebulaPalette } from './nebula';
import { createRng } from '../engine/rng';
import {
  generateSetPiece,
  hasLights,
  LIGHT_PHASES,
  LIGHT_STEP,
  setPiecePalette,
  type SetPieceSpec,
} from './setpieces';
import {
  generateStars,
  generateStreaks,
  starPalette,
  streakPalette,
  TWINKLE_PHASES,
} from './starfield';
import { getTheme, type BackgroundTheme, type ThemeId } from './themes';

/** Scroll multipliers per layer, relative to `world.scrollY`. */
export const PARALLAX = { setPiece: 0.1, stars: 0.25, nebula: 0.5, streaks: 1.5 } as const;
/** Strip height: ≥ the 520 px max logical buffer, so two drawImage calls always cover it. */
export const STRIP_H = 640;
export const STRIP_W = 240;
/** Seconds per twinkle palette step. */
export const TWINKLE_STEP = 0.3;

/** Speed lines: none at or below `from` px/s, full strength from `full` up. */
export const SPEED_LINES = {
  from: 50,
  full: 60,
  count: 18,
  minLen: 6,
  maxLen: 14,
  /** Extra length per px/s above `from`. */
  lenPerSpeed: 0.2,
  alpha: 0.22,
} as const;

/** Speed-line strength 0..1 for a scroll speed: 0 up to 50 px/s, fading in to 1 at 60. */
export function speedLineAlpha(speed: number): number {
  const t = (speed - SPEED_LINES.from) / (SPEED_LINES.full - SPEED_LINES.from);
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** Speed-line length in px for a scroll speed, before the per-line 0.7..1 jitter. */
export function speedLineLength(speed: number): number {
  const l = SPEED_LINES.minLen + (speed - SPEED_LINES.from) * SPEED_LINES.lenPerSpeed;
  return l < SPEED_LINES.minLen
    ? SPEED_LINES.minLen
    : l > SPEED_LINES.maxLen
      ? SPEED_LINES.maxLen
      : l;
}

interface BuiltSetPiece {
  /** One canvas, or one per light phase for pieces with blinking lights. */
  frames: HTMLCanvasElement[];
  spec: SetPieceSpec;
  parallax: number;
  /** Scroll distance at which the top edge enters the screen. */
  atScroll: number;
}

/** Layer seeds derive from the run seed and theme only, never from `world.rng`, so drawing can't perturb the sim. */
export function layerSeed(seed: string, theme: ThemeId, layer: string): number {
  return hashSeed(`${seed}|bg|${theme}|${layer}`);
}

/**
 * Pre-rendered parallax background. Building costs a few ms (on `prebuild()` or the
 * first draw); after that each frame is one fill plus ~2 drawImage calls per layer.
 */
export class Background {
  private themeIdV: ThemeId;
  private seedV: string;
  private built = false;
  private baseCss = '';
  private starStrips: HTMLCanvasElement[] = [];
  private nebulaStrip: HTMLCanvasElement | null = null;
  private streakStrip: HTMLCanvasElement | null = null;
  private pieces: BuiltSetPiece[] = [];
  private speedCss = '';
  // Speed lines: fixed x, strip y and length factor per line, built once per theme/seed.
  private readonly lineX = new Uint8Array(SPEED_LINES.count);
  private readonly lineY = new Uint16Array(SPEED_LINES.count);
  private readonly lineLen = new Float32Array(SPEED_LINES.count);

  constructor(themeId: ThemeId = 'kessler', seed = '') {
    this.themeIdV = themeId;
    this.seedV = seed;
  }

  get themeId(): ThemeId {
    return this.themeIdV;
  }

  get seed(): string {
    return this.seedV;
  }

  get theme(): BackgroundTheme {
    return getTheme(this.themeIdV);
  }

  /** Swap theme and/or seed. Rebuilds lazily; a no-op if nothing changed. */
  setTheme(themeId: ThemeId, seed: string = this.seedV): void {
    if (themeId === this.themeIdV && seed === this.seedV) return;
    this.themeIdV = themeId;
    this.seedV = seed;
    this.built = false;
  }

  prebuild(): void {
    // Headless (Vitest, bots): nothing to draw into.
    if (this.built || typeof document === 'undefined') return;
    const t = this.theme;
    const id = t.id;
    const s = this.seedV;
    this.baseCss = toCss(t.base);
    const stars = generateStars(layerSeed(s, id, 'stars'), STRIP_W, STRIP_H, t.stars);
    this.starStrips = [];
    for (let p = 0; p < TWINKLE_PHASES; p++) {
      this.starStrips.push(bitmapToCanvas(stars, starPalette(t.stars, p)));
    }
    const neb = generateNebula(layerSeed(s, id, 'nebula'), STRIP_W, STRIP_H, t.nebula);
    this.nebulaStrip = bitmapToCanvas(neb, nebulaPalette(t.nebula));
    const streaks = generateStreaks(layerSeed(s, id, 'streaks'), STRIP_W, STRIP_H, t.streaks);
    this.streakStrip = bitmapToCanvas(streaks, streakPalette(t.streaks));
    this.pieces = t.setPieces.map((spec, i) => {
      const bmp = generateSetPiece(layerSeed(s, id, `piece${i}`), spec);
      const frames: HTMLCanvasElement[] = [];
      const n = hasLights(spec) ? LIGHT_PHASES : 1;
      for (let p = 0; p < n; p++) frames.push(bitmapToCanvas(bmp, setPiecePalette(spec, p)));
      return {
        frames,
        spec,
        parallax: spec.parallax ?? PARALLAX.setPiece,
        atScroll: spec.at * t.scrollSpeed,
      };
    });
    this.speedCss = toCss(t.streaks.head);
    const rng = createRng(layerSeed(s, id, 'speedlines'));
    for (let i = 0; i < SPEED_LINES.count; i++) {
      this.lineX[i] = rng.int(0, STRIP_W - 1);
      this.lineY[i] = rng.int(0, STRIP_H - 1);
      this.lineLen[i] = rng.range(0.7, 1);
    }
    this.built = true;
  }

  /**
   * Fills the whole logical buffer, HUD bands included, ignoring `offsetY` and shake.
   * `scrollY` should already be interpolated; `time` drives the twinkle cycle.
   * `scrollSpeed` (px/s, usually `world.scrollSpeed`) only drives the speed lines.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    scrollY: number,
    time: number,
    height: number,
    scrollSpeed = 0,
  ): void {
    if (!this.built) this.prebuild();
    ctx.fillStyle = this.baseCss;
    ctx.fillRect(0, 0, STRIP_W, height);

    const phase = Math.floor(time / TWINKLE_STEP) % TWINKLE_PHASES;
    const stars = this.starStrips[phase < 0 ? 0 : phase];
    if (stars) drawTiled(ctx, stars, scrollY * PARALLAX.stars, height);

    // Set pieces sit behind the nebula so the haze passes in front of them.
    const lightPhase = Math.floor(time / LIGHT_STEP) % LIGHT_PHASES;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i] as BuiltSetPiece;
      const canvas = p.frames.length > 1 ? p.frames[lightPhase < 0 ? 0 : lightPhase] : p.frames[0];
      if (!canvas) continue;
      const h = canvas.height;
      const y = Math.floor((scrollY - p.atScroll) * p.parallax) - h;
      if (y >= height || y + h <= 0) continue;
      ctx.drawImage(canvas, p.spec.x, y);
    }

    if (this.nebulaStrip) drawTiled(ctx, this.nebulaStrip, scrollY * PARALLAX.nebula, height);
    if (this.streakStrip) drawTiled(ctx, this.streakStrip, scrollY * PARALLAX.streaks, height);
    this.drawSpeedLines(ctx, scrollY, height, scrollSpeed);
  }

  private drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    scrollY: number,
    height: number,
    speed: number,
  ): void {
    const a = speedLineAlpha(speed);
    if (a <= 0) return;
    const len = speedLineLength(speed);
    const off = stripOffset(scrollY * PARALLAX.streaks);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = a * SPEED_LINES.alpha;
    ctx.fillStyle = this.speedCss;
    for (let i = 0; i < SPEED_LINES.count; i++) {
      const l = Math.round(len * (this.lineLen[i] as number));
      let y = (this.lineY[i] as number) + off;
      if (y >= STRIP_H) y -= STRIP_H;
      // The strip is taller than the buffer, so a line shows at most once.
      if (y - l >= height) continue;
      ctx.fillRect(this.lineX[i] as number, y - l, 1, l);
    }
    ctx.globalAlpha = prevAlpha;
  }
}

/** Integer offset per layer, so pixels never land between texels and shimmer. */
export function stripOffset(layerScroll: number): number {
  const off = Math.floor(layerScroll) % STRIP_H;
  return off < 0 ? off + STRIP_H : off;
}

function drawTiled(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  layerScroll: number,
  height: number,
): void {
  const off = stripOffset(layerScroll);
  // Content moves down as scroll grows: we fly upward.
  if (off < height) ctx.drawImage(img, 0, off);
  if (off > 0) ctx.drawImage(img, 0, off - STRIP_H);
}
