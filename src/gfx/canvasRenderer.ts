import { drawText } from './font';
import type { Renderer, SpriteOpts, TextOpts } from './renderer';
import {
  flashSheet,
  getCompiled,
  rotFlashSheet,
  rotSheet,
  rotationBucket,
  type CompiledSprite,
} from './spriteCache';

const MISSING_SPRITE_COLOR = '#f800f8';
const warnedMissing = new Set<string>();

// Reused for every text() call so it doesn't allocate an options object.
const textScratch: {
  font: TextOpts['font'];
  color: string | undefined;
  align: TextOpts['align'];
  shadow: boolean | undefined;
} = { font: undefined, color: undefined, align: undefined, shadow: undefined };

/** Canvas 2D renderer: cached sprite sheets, bitmap fonts, whole-pixel primitives. */
export class CanvasRenderer implements Renderer {
  offsetY = 0;
  shakeX = 0;
  shakeY = 0;

  constructor(readonly ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
  }

  get width(): number {
    return this.ctx.canvas.width;
  }

  get height(): number {
    return this.ctx.canvas.height;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.px(x), this.py(y), Math.round(w), Math.round(h));
  }

  /** Midpoint circle with whole-pixel rects, since `arc` would anti-alias. */
  circle(x: number, y: number, r: number, color: string, fill = true): void {
    const ctx = this.ctx;
    const cx = this.px(x);
    const cy = this.py(y);
    ctx.fillStyle = color;
    let dx = Math.round(r);
    let dy = 0;
    let err = 1 - dx;
    while (dx >= dy) {
      if (fill) {
        ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
        ctx.fillRect(cx - dx, cy - dy, dx * 2 + 1, 1);
        ctx.fillRect(cx - dy, cy + dx, dy * 2 + 1, 1);
        ctx.fillRect(cx - dy, cy - dx, dy * 2 + 1, 1);
      } else {
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
        ctx.fillRect(cx - dx, cy + dy, 1, 1);
        ctx.fillRect(cx + dx, cy - dy, 1, 1);
        ctx.fillRect(cx - dx, cy - dy, 1, 1);
        ctx.fillRect(cx + dy, cy + dx, 1, 1);
        ctx.fillRect(cx - dy, cy + dx, 1, 1);
        ctx.fillRect(cx + dy, cy - dx, 1, 1);
        ctx.fillRect(cx - dy, cy - dx, 1, 1);
      }
      dy++;
      if (err < 0) {
        err += 2 * dy + 1;
      } else {
        dx--;
        err += 2 * (dy - dx) + 1;
      }
    }
  }

  sprite(id: string, x: number, y: number, opts?: SpriteOpts): void {
    const c = getCompiled(id);
    if (!c) {
      this.missing(id, x, y, opts?.flash ?? false);
      return;
    }
    const ctx = this.ctx;
    const n = c.frames;
    const f = opts?.frame ? ((Math.floor(opts.frame) % n) + n) % n : 0;
    const flash = opts?.flash ?? false;
    const bucket = c.rotations === 16 && opts?.rot ? rotationBucket(opts.rot) : 0;

    let img: HTMLCanvasElement;
    let sx: number, sy: number, w: number, h: number, ox: number, oy: number;
    if (bucket !== 0) {
      img = flash ? rotFlashSheet(c) : rotSheet(c);
      w = c.rw;
      h = c.rh;
      sx = bucket * w;
      sy = f * h;
      ox = c.rox;
      oy = c.roy;
    } else {
      img = flash ? flashSheet(c) : c.sheet;
      w = c.w;
      h = c.h;
      sx = f * w;
      sy = 0;
      ox = c.ox;
      oy = c.oy;
    }

    const alpha = opts?.alpha ?? 1;
    if (alpha <= 0) return;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    const px = this.px(x);
    const dy = this.py(y) - oy;
    if (opts?.flipX) {
      // Mirror around the pivot column.
      ctx.setTransform(-1, 0, 0, 1, px * 2, 0);
      ctx.drawImage(img, sx, sy, w, h, px - ox, dy, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(img, sx, sy, w, h, px - ox, dy, w, h);
    }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  text(str: string, x: number, y: number, opts?: TextOpts): void {
    textScratch.font = opts?.font;
    textScratch.color = opts?.color;
    textScratch.align = opts?.align;
    textScratch.shadow = opts?.shadow;
    drawText(this.ctx, str, this.px(x), this.py(y), textScratch);
  }

  /** Size of a sprite's unrotated cell (after auto-outline), or null if unknown. */
  spriteSize(id: string): Pick<CompiledSprite, 'w' | 'h' | 'ox' | 'oy' | 'frames'> | null {
    return getCompiled(id);
  }

  private missing(id: string, x: number, y: number, flash: boolean): void {
    if (!warnedMissing.has(id)) {
      warnedMissing.add(id);
      console.warn(`sprite "${id}" is not defined`);
    }
    this.ctx.fillStyle = flash ? '#f8f8f8' : MISSING_SPRITE_COLOR;
    this.ctx.fillRect(this.px(x) - 4, this.py(y) - 4, 8, 8);
  }

  private px(x: number): number {
    return Math.round(x + this.shakeX);
  }

  private py(y: number): number {
    return Math.round(y + this.offsetY + this.shakeY);
  }
}
