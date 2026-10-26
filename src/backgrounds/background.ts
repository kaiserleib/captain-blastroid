import { hashSeed } from '../engine/rng';
import { bitmapToCanvas } from './bitmap';
import { toCss } from './color';
import { generateNebula, nebulaPalette } from './nebula';
import { generateSetPiece, setPiecePalette, type SetPieceSpec } from './setpieces';
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

interface BuiltSetPiece {
  canvas: HTMLCanvasElement;
  spec: SetPieceSpec;
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
    this.pieces = t.setPieces.map((spec, i) => ({
      canvas: bitmapToCanvas(
        generateSetPiece(layerSeed(s, id, `piece${i}`), spec),
        setPiecePalette(spec),
      ),
      spec,
      atScroll: spec.at * t.scrollSpeed,
    }));
    this.built = true;
  }

  /**
   * Fills the whole logical buffer, HUD bands included, ignoring `offsetY` and shake.
   * `scrollY` should already be interpolated; `time` drives the twinkle cycle.
   */
  draw(ctx: CanvasRenderingContext2D, scrollY: number, time: number, height: number): void {
    if (!this.built) this.prebuild();
    ctx.fillStyle = this.baseCss;
    ctx.fillRect(0, 0, STRIP_W, height);

    const phase = Math.floor(time / TWINKLE_STEP) % TWINKLE_PHASES;
    const stars = this.starStrips[phase < 0 ? 0 : phase];
    if (stars) drawTiled(ctx, stars, scrollY * PARALLAX.stars, height);

    // Set pieces sit behind the nebula so the haze passes in front of them.
    const sp = scrollY * PARALLAX.setPiece;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i] as BuiltSetPiece;
      const h = p.canvas.height;
      const y = Math.floor(sp - p.atScroll * PARALLAX.setPiece) - h;
      if (y >= height || y + h <= 0) continue;
      ctx.drawImage(p.canvas, p.spec.x, y);
    }

    if (this.nebulaStrip) drawTiled(ctx, this.nebulaStrip, scrollY * PARALLAX.nebula, height);
    if (this.streakStrip) drawTiled(ctx, this.streakStrip, scrollY * PARALLAX.streaks, height);
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
