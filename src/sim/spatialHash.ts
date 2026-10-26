import { Layer, type Anomaly, type Asteroid, type Body, type Enemy, type Pickup } from './types';
import type { World } from './world';

export const CELL = 32;
// Covers the playfield plus generous off-screen margins (spawns above the top
// edge, wide entries). Anything outside is clamped into the edge cells, so
// results stay correct, just slower out there.
const MIN_X = -96;
const MIN_Y = -160;
const COLS = 14; // -96..352
const ROWS = 22; // -160..544

/** Layers stored in the hash. Shots are never hashed; they query it. */
export const HASHED_LAYERS = Layer.Enemy | Layer.Asteroid | Layer.Anomaly | Layer.Pickup;

/** Return true to stop the query early. */
export type QueryCallback = (b: Body, layer: number) => boolean | void;
export type NearestFilter = (b: Body, layer: number) => boolean;

function cellCol(x: number): number {
  const c = Math.floor((x - MIN_X) / CELL);
  return c < 0 ? 0 : c >= COLS ? COLS - 1 : c;
}

function cellRow(y: number): number {
  const r = Math.floor((y - MIN_Y) / CELL);
  return r < 0 ? 0 : r >= ROWS ? ROWS - 1 : r;
}

/**
 * Uniform grid, rebuilt every tick by the collision system. Entities are
 * binned by center only; queries widen their search by the largest radius
 * seen per layer, so big bodies are still found without duplicate visits.
 *
 * Positions and radii are snapshotted into typed arrays at insert time. That
 * keeps queries allocation-free: reading doubles off several entity shapes at
 * one megamorphic site makes V8 box every read. The cost is that systems
 * running before `collision` see last tick's positions; released entities
 * are always skipped.
 */
export class SpatialHash {
  private readonly head = new Int32Array(COLS * ROWS);
  private next: Int32Array;
  private bodies: Body[];
  private layers: Uint8Array;
  private xs: Float64Array;
  private ys: Float64Array;
  private rs: Float64Array;
  private n = 0;
  /** Largest radius per layer bit index, refreshed on rebuild. */
  private readonly maxR = new Float64Array(8);

  /**
   * Query circle for `queryAt`. Hot loops assign these directly instead of
   * calling `query(x, y, r)`: double arguments to a call that isn't inlined
   * get boxed, plain field writes don't.
   */
  qx = 0.5;
  qy = 0.5;
  qr = 0.5;

  constructor(capacity: number) {
    this.next = new Int32Array(capacity);
    this.bodies = new Array<Body>(capacity);
    this.layers = new Uint8Array(capacity);
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
    this.rs = new Float64Array(capacity);
    this.head.fill(-1);
  }

  get size(): number {
    return this.n;
  }

  clear(): void {
    this.head.fill(-1);
    this.maxR.fill(0);
    this.n = 0;
  }

  private reserve(): number {
    if (this.n >= this.bodies.length) this.grow();
    return this.n++;
  }

  /** Bins slot i, whose xs/ys/rs are already written. */
  private link(i: number, b: Body, layer: number): void {
    const cell = cellRow(this.ys[i] as number) * COLS + cellCol(this.xs[i] as number);
    this.bodies[i] = b;
    this.layers[i] = layer;
    this.next[i] = this.head[cell] as number;
    this.head[cell] = i;
    const bit = 31 - Math.clz32(layer);
    const r = this.rs[i] as number;
    if (r > (this.maxR[bit] as number)) this.maxR[bit] = r;
  }

  insert(b: Body, layer: number): void {
    const i = this.reserve();
    this.xs[i] = b.x;
    this.ys[i] = b.y;
    this.rs[i] = b.r;
    this.link(i, b, layer);
  }

  private grow(): void {
    const cap = this.bodies.length * 2 || 64;
    const grown = <A extends Int32Array | Uint8Array | Float64Array>(
      a: A,
      make: new (n: number) => A,
    ) => {
      const out = new make(cap);
      out.set(a);
      return out;
    };
    this.next = grown(this.next, Int32Array);
    this.layers = grown(this.layers, Uint8Array);
    this.xs = grown(this.xs, Float64Array);
    this.ys = grown(this.ys, Float64Array);
    this.rs = grown(this.rs, Float64Array);
    this.bodies.length = cap;
  }

  /**
   * Visits every active body in `mask` whose circle overlaps the circle
   * (x, y, r). Pass a hoisted callback (module-level state for context).
   * Returns true if the callback stopped the query. Re-entrant.
   */
  query(x: number, y: number, r: number, mask: number, cb: QueryCallback): boolean {
    this.qx = x;
    this.qy = y;
    this.qr = r;
    return this.queryAt(mask, cb);
  }

  /** `query` using the circle in `qx/qy/qr`. */
  queryAt(mask: number, cb: QueryCallback): boolean {
    const x = this.qx;
    const y = this.qy;
    const r = this.qr;
    const maxR = this.maxR;
    let reach = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (mask & (1 << bit) && (maxR[bit] as number) > reach) reach = maxR[bit] as number;
    }
    reach += r;
    const c0 = cellCol(x - reach);
    const c1 = cellCol(x + reach);
    const r0 = cellRow(y - reach);
    const r1 = cellRow(y + reach);
    const head = this.head;
    const next = this.next;
    const bodies = this.bodies;
    const layers = this.layers;
    const xs = this.xs;
    const ys = this.ys;
    const rs = this.rs;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        let i = head[row * COLS + col] as number;
        while (i !== -1) {
          const layer = layers[i] as number;
          if (layer & mask) {
            const dx = (xs[i] as number) - x;
            const dy = (ys[i] as number) - y;
            const rr = r + (rs[i] as number);
            if (dx * dx + dy * dy < rr * rr) {
              const b = bodies[i] as Body;
              if (b.active && cb(b, layer) === true) return true;
            }
          }
          i = next[i] as number;
        }
      }
    }
    return false;
  }

  /** Allocation-free: writes overlapping bodies into `out`, returns the count. */
  queryInto(x: number, y: number, r: number, mask: number, out: Body[]): number {
    collectOut = out;
    collectN = 0;
    this.query(x, y, r, mask, collect);
    collectOut = null;
    return collectN;
  }

  private nBest: Body | null = null;
  private nBestD2 = 0.5;
  private nX = 0.5;
  private nY = 0.5;
  private nMask = 0;
  private nFilter: NearestFilter | null = null;

  /**
   * Nearest active body (by center distance) in `mask` within `maxDist`,
   * optionally passing `filter`. Searches outward in rings of cells.
   * Not re-entrant from inside `filter`.
   */
  nearest(
    x: number,
    y: number,
    mask: number,
    maxDist = Infinity,
    filter: NearestFilter | null = null,
  ): Body | null {
    const cc = cellCol(x);
    const cr = cellRow(y);
    this.nBest = null;
    this.nBestD2 = maxDist === Infinity ? Infinity : maxDist * maxDist;
    this.nX = x;
    this.nY = y;
    this.nMask = mask;
    this.nFilter = filter;
    for (let k = 0; ; k++) {
      // Every cell in ring k is at least (k-1)*CELL from the point; clamped
      // edge cells can hold farther bodies, never nearer ones.
      const ringMin = (k - 1) * CELL;
      if (k > 1 && ringMin * ringMin >= this.nBestD2) break;
      const rowLo = cr - k;
      const rowHi = cr + k;
      const colLo = cc - k;
      const colHi = cc + k;
      if (rowLo < 0 && rowHi >= ROWS && colLo < 0 && colHi >= COLS) break;
      for (let row = rowLo; row <= rowHi; row++) {
        if (row < 0 || row >= ROWS) continue;
        if (row === rowLo || row === rowHi) {
          for (let col = colLo; col <= colHi; col++) this.scanCell(row, col);
        } else {
          this.scanCell(row, colLo);
          this.scanCell(row, colHi);
        }
      }
    }
    const best = this.nBest;
    this.nBest = null;
    this.nFilter = null;
    return best;
  }

  private scanCell(row: number, col: number): void {
    if (col < 0 || col >= COLS) return;
    let i = this.head[row * COLS + col] as number;
    while (i !== -1) {
      const layer = this.layers[i] as number;
      if (layer & this.nMask) {
        const dx = (this.xs[i] as number) - this.nX;
        const dy = (this.ys[i] as number) - this.nY;
        const d2 = dx * dx + dy * dy;
        if (d2 < this.nBestD2) {
          const b = this.bodies[i] as Body;
          if (b.active && (this.nFilter === null || this.nFilter(b, layer))) {
            this.nBestD2 = d2;
            this.nBest = b;
          }
        }
      }
      i = this.next[i] as number;
    }
  }

  // One loop per pool so each property read sees a single entity shape.

  private addEnemies(items: readonly Enemy[], n: number): void {
    for (let j = 0; j < n; j++) {
      const b = items[j] as Enemy;
      if (!b.active) continue;
      const i = this.reserve();
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.rs[i] = b.r;
      this.link(i, b, Layer.Enemy);
    }
  }

  private addAsteroids(items: readonly Asteroid[], n: number): void {
    for (let j = 0; j < n; j++) {
      const b = items[j] as Asteroid;
      if (!b.active) continue;
      const i = this.reserve();
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.rs[i] = b.r;
      this.link(i, b, Layer.Asteroid);
    }
  }

  private addAnomalies(items: readonly Anomaly[], n: number): void {
    for (let j = 0; j < n; j++) {
      const b = items[j] as Anomaly;
      if (!b.active) continue;
      const i = this.reserve();
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.rs[i] = b.r;
      this.link(i, b, Layer.Anomaly);
    }
  }

  private addPickups(items: readonly Pickup[], n: number): void {
    for (let j = 0; j < n; j++) {
      const b = items[j] as Pickup;
      if (!b.active) continue;
      const i = this.reserve();
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.rs[i] = b.r;
      this.link(i, b, Layer.Pickup);
    }
  }

  /** Rebuilds from the world's enemy, asteroid, anomaly and pickup pools. */
  rebuild(w: World): void {
    this.clear();
    this.addEnemies(w.enemies.items, w.enemies.count);
    this.addAsteroids(w.asteroids.items, w.asteroids.count);
    this.addAnomalies(w.anomalies.items, w.anomalies.count);
    this.addPickups(w.pickups.items, w.pickups.count);
  }
}

let collectOut: Body[] | null = null;
let collectN = 0;
function collect(b: Body): void {
  (collectOut as Body[])[collectN++] = b;
}

// Per-world instance without widening the World contract.
const hashes = new WeakMap<World, SpatialHash>();

export function getSpatialHash(w: World): SpatialHash {
  let h = hashes.get(w);
  if (h === undefined) {
    const cap =
      w.enemies.capacity + w.asteroids.capacity + w.anomalies.capacity + w.pickups.capacity;
    h = new SpatialHash(cap);
    hashes.set(w, h);
  }
  return h;
}

export function rebuildSpatialHash(w: World): SpatialHash {
  const h = getSpatialHash(w);
  h.rebuild(w);
  return h;
}
