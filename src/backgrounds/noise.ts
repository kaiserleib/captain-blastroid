import type { Rng } from '../engine/rng';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in (0, 1). */
export function bayer4(x: number, y: number): number {
  return ((BAYER4[((y & 3) << 2) | (x & 3)] as number) + 0.5) / 16;
}

/** Dither v in 0..1 to an integer level in 0..levels. */
export function ditherLevel(v: number, levels: number, x: number, y: number): number {
  const s = v * levels;
  const base = Math.floor(s);
  const q = s - base > bayer4(x, y) ? base + 1 : base;
  return q < 0 ? 0 : q > levels ? levels : q;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise on a lattice that wraps on both axes, with period cols*cell × rows*cell. */
export class PeriodicValueNoise {
  private readonly lattice: Float32Array;

  constructor(
    rng: Rng,
    readonly cell: number,
    readonly cols: number,
    readonly rows: number,
  ) {
    this.lattice = new Float32Array(cols * rows);
    for (let i = 0; i < this.lattice.length; i++) this.lattice[i] = rng.next();
  }

  /** 0..1 */
  sample(x: number, y: number): number {
    const gx = x / this.cell;
    const gy = y / this.cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = smooth(gx - ix);
    const fy = smooth(gy - iy);
    const c = this.cols;
    const r = this.rows;
    const x0 = ((ix % c) + c) % c;
    const x1 = (x0 + 1) % c;
    const y0 = ((iy % r) + r) % r;
    const y1 = (y0 + 1) % r;
    const l = this.lattice;
    const a = l[y0 * c + x0] as number;
    const b = l[y0 * c + x1] as number;
    const d = l[y1 * c + x0] as number;
    const e = l[y1 * c + x1] as number;
    const top = a + (b - a) * fx;
    const bot = d + (e - d) * fx;
    return top + (bot - top) * fy;
  }
}

/** Noise that tiles vertically with period `h`; `cell` must divide `h`. */
export function verticalTilingNoise(
  rng: Rng,
  cell: number,
  w: number,
  h: number,
): PeriodicValueNoise {
  if (h % cell !== 0) throw new Error(`noise cell ${cell} must divide strip height ${h}`);
  return new PeriodicValueNoise(rng, cell, Math.ceil(w / cell) + 1, h / cell);
}
