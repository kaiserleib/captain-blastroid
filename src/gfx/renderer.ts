export interface SpriteOpts {
  rot?: number;
  flash?: boolean;
  alpha?: number;
  frame?: number;
  flipX?: boolean;
}

/** `x, y` is the text's top-left (top-center/right with `align`); 1 px drop shadow by default. */
export interface TextOpts {
  color?: string;
  align?: 'left' | 'center' | 'right';
  shadow?: boolean;
  /** Bitmap font (gfx/font.ts). Default 'ui'; 'small' is the 3×5 HUD font. */
  font?: 'ui' | 'small';
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
  /** Drawn with its anchor (default: center) at x,y. */
  sprite(id: string, x: number, y: number, opts?: SpriteOpts): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  text(str: string, x: number, y: number, opts?: TextOpts): void;
  circle(x: number, y: number, r: number, color: string, fill?: boolean): void;
  /** Playfield origin inside the logical canvas (top HUD band height). */
  offsetY: number;
  shakeX: number;
  shakeY: number;
}

// T02: the full implementation (sprite cache + bitmap fonts) lives in canvasRenderer.ts.
export { CanvasRenderer } from './canvasRenderer';
