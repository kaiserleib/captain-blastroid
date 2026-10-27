// A small bake-time painter for the Foundry's procedural sprites (a local
// copy of the sector painters' approach): bevelled shapes and sphere
// lighting with ordered dithering, in 15-bit colors, lit from the top-left.
import { snes } from '../../../gfx/palette';
import { defineProcSprite } from '../../../gfx/sprite';

/** shadow → dark → base → light → highlight, packed 0xRRGGBB. */
export type Ramp5 = readonly [number, number, number, number, number];
export type Mask = (x: number, y: number) => boolean;

export function c(hex: string): number {
  return parseInt(snes(hex).slice(1), 16);
}

export function ramp(...hex: [string, string, string, string, string]): Ramp5 {
  return hex.map(c) as unknown as Ramp5;
}

export const S = 0;
export const D = 1;
export const B = 2;
export const L = 3;
export const H = 4;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;
}

const LX = -0.48;
const LY = -0.56;
const LZ = 0.67;

function level(lum: number, x: number, y: number): number {
  const t = (lum + 0.15) / 1.1;
  const k = Math.floor(t * 5 + (bayer(x, y) - 0.5) * 0.7);
  return k < 0 ? 0 : k > 4 ? 4 : k;
}

export class Paint {
  readonly d: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Int32Array(w * h).fill(-1);
  }

  set(x: number, y: number, col: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = col;
  }

  /** Fills a mask with a bevel: top/left edges lit, bottom/right edges dark. */
  shape(inside: Mask, r: Ramp5, base = B): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!inside(x, y)) continue;
        const up = inside(x, y - 1);
        const lf = inside(x - 1, y);
        const dn = inside(x, y + 1);
        const rt = inside(x + 1, y);
        let k = base;
        if (!up && !lf) k = H;
        else if (!up || !lf) k = Math.min(H, base + 1);
        else if (!dn && !rt) k = S;
        else if (!dn || !rt) k = Math.max(S, base - 1);
        this.set(x, y, r[k] as number);
      }
    }
  }

  /** A bevelled axis-aligned box. */
  box(x0: number, y0: number, w: number, h: number, r: Ramp5, base = B): void {
    this.shape((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h, r, base);
  }

  /** Sphere-lit disc centered on (cx, cy) in pixel-edge coordinates. */
  sphere(cx: number, cy: number, rx: number, ry: number, r: Ramp5, bias = 0): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        this.set(x, y, r[level(nx * LX + ny * LY + nz * LZ + bias, x, y)] as number);
      }
    }
  }

  /** A 1 px ring of radius r around (cx, cy). */
  ring(cx: number, cy: number, rad: number, col: number, from = 0, to = Math.PI * 2): void {
    const n = Math.max(8, Math.ceil(rad * 8));
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      this.set(cx + Math.cos(a) * rad - 0.5, cy + Math.sin(a) * rad - 0.5, col);
    }
  }

  /** A rivet: a lit head with a shadow below-right. */
  rivet(x: number, y: number, r: Ramp5): void {
    this.set(x, y, r[H] as number);
    this.set(x + 1, y + 1, r[S] as number);
  }

  flush(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const col = this.d[y * this.w + x] as number;
        let e = x + 1;
        while (e < this.w && this.d[y * this.w + e] === col) e++;
        if (col >= 0) {
          ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
          ctx.fillRect(x, y, e - x, 1);
        }
        x = e;
      }
    }
  }
}

/** Registers a procedural sprite painted with `Paint` (auto outline, no rotations). */
export function proc(
  id: string,
  w: number,
  h: number,
  frames: number,
  paint: (p: Paint, f: number) => void,
  outline: string | false = '#100818',
): void {
  defineProcSprite(
    id,
    w,
    h,
    (ctx, f) => {
      const p = new Paint(w, h);
      paint(p, f);
      p.flush(ctx);
    },
    { frames, outline: outline === false ? undefined : outline },
  );
}
