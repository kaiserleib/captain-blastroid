export interface SpriteOpts {
  rot?: number;
  flash?: boolean;
  alpha?: number;
  frame?: number;
  flipX?: boolean;
}

export interface TextOpts {
  color?: string;
  align?: 'left' | 'center' | 'right';
  shadow?: boolean;
}

/**
 * All primitives take playfield coordinates: they are drawn at
 * (x + shakeX, y + offsetY + shakeY) in the logical buffer and rounded to whole
 * pixels. HUD code that targets the bands sets `offsetY`/shake to 0 around its draws.
 */
export interface Renderer {
  /** Logical-res offscreen buffer. */
  readonly ctx: CanvasRenderingContext2D;
  /** Logical buffer size (width 240, height 400..520). */
  readonly width: number;
  readonly height: number;
  /** Centered at x,y. */
  sprite(id: string, x: number, y: number, opts?: SpriteOpts): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  text(str: string, x: number, y: number, opts?: TextOpts): void;
  circle(x: number, y: number, r: number, color: string, fill?: boolean): void;
  /** Playfield origin inside the logical canvas (top HUD band height). */
  offsetY: number;
  shakeX: number;
  shakeY: number;
}

const MISSING_SPRITE_COLOR = '#f800f8';

/** Minimal Canvas 2D renderer. T02 replaces `sprite` and `text` with the sprite cache and bitmap font. */
export class CanvasRenderer implements Renderer {
  offsetY = 0;
  shakeX = 0;
  shakeY = 0;

  constructor(readonly ctx: CanvasRenderingContext2D) {}

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

  // Placeholder: a magenta 8x8 square marks every sprite until T02 lands.
  sprite(_id: string, x: number, y: number, opts?: SpriteOpts): void {
    const ctx = this.ctx;
    const alpha = opts?.alpha ?? 1;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = opts?.flash ? '#f8f8f8' : MISSING_SPRITE_COLOR;
    ctx.fillRect(this.px(x) - 4, this.py(y) - 4, 8, 8);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  // Placeholder: canvas text is anti-aliased; T02 swaps in the bitmap font.
  text(str: string, x: number, y: number, opts?: TextOpts): void {
    const ctx = this.ctx;
    const px = this.px(x);
    const py = this.py(y);
    ctx.font = '8px monospace';
    ctx.textAlign = opts?.align ?? 'left';
    ctx.textBaseline = 'top';
    if (opts?.shadow ?? true) {
      ctx.fillStyle = '#000';
      ctx.fillText(str, px + 1, py + 1);
    }
    ctx.fillStyle = opts?.color ?? '#f8f8f8';
    ctx.fillText(str, px, py);
  }

  private px(x: number): number {
    return Math.round(x + this.shakeX);
  }

  private py(y: number): number {
    return Math.round(y + this.offsetY + this.shakeY);
  }
}
