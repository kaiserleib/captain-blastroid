// Procedural obstacle art: lumpy cratered rocks, the black hole and the pulsar.
// Rocks bake their 16 rotations as frames, re-lit from the top-left every
// frame, so the light stays put while the rock spins (cache rotation would
// spin the highlight with it).
import {
  ASTEROID_SIZES,
  ASTEROID_SIZE_IDS,
  ROCK_THEME_IDS,
  ROCK_VARIANTS,
  type AsteroidSize,
  type RockTheme,
} from '../../content/obstacles';
import { createRng, type Rng } from '../../engine/rng';
import { BASALT, ICE, OUTLINE, ROCK, mix, snes } from '../../gfx/palette';
import { defineProcSprite } from '../../gfx/sprite';

export const ROCK_FRAMES = 16;
const TAU = Math.PI * 2;
const ROT_STEP = TAU / ROCK_FRAMES;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// Light from the top-left, a little toward the viewer.
const LX = -0.55;
const LY = -0.68;
const LZ = 0.72;
const LN = Math.hypot(LX, LY, LZ);

interface Crater {
  x: number;
  y: number;
  r: number;
  depth: number;
}

interface RockShape {
  /** Inner size; the outline adds 1 px per side. */
  n: number;
  rmax: number;
  amp: number[];
  phase: number[];
  /** Sum of amplitudes, so the radius never exceeds rmax. */
  ampSum: number;
  craters: Crater[];
  seed: number;
}

const CRATERS: Record<AsteroidSize, [number, number, number, number]> = {
  // count min, count max, radius min, radius max
  small: [1, 1, 1.4, 2],
  medium: [2, 3, 1.8, 3.4],
  large: [4, 6, 2.2, 5.5],
};

export function rockShape(size: AsteroidSize, variant: number): RockShape {
  const rng = createRng(`rock|${size}|${variant}`);
  const n = ASTEROID_SIZES[size].sprite - 2;
  const rmax = n / 2 - 0.2;
  const amp: number[] = [];
  const phase: number[] = [];
  let ampSum = 0;
  // Low harmonics give the lumpy silhouette; small rocks stay rounder so they read at 10 px.
  const lump = size === 'small' ? 0.06 : 0.1;
  for (let k = 2; k <= 5; k++) {
    const a = (rng.range(0.3, 1) * lump) / (k - 1);
    amp.push(a);
    phase.push(rng.range(0, TAU));
    ampSum += a;
  }
  const [cmin, cmax, rmin, rmaxC] = CRATERS[size];
  const craters: Crater[] = [];
  const count = rng.int(cmin, cmax);
  for (let i = 0; i < count; i++) {
    const r = rng.range(rmin, rmaxC);
    const ang = rng.range(0, TAU);
    const dist = rng.range(0, Math.max(0, rmax * 0.95 - r));
    craters.push({
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      r,
      depth: rng.range(0.55, 0.9),
    });
  }
  return { n, rmax, amp, phase, ampSum, craters, seed: (rng.next() * 0x7fffffff) | 0 };
}

function edgeRadius(s: RockShape, ang: number): number {
  let f = 1 - s.ampSum;
  for (let i = 0; i < s.amp.length; i++) {
    f += (s.amp[i] as number) * Math.sin((i + 2) * ang + (s.phase[i] as number));
  }
  return s.rmax * f;
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Surface height in rock-local coords; NaN outside the silhouette. */
function height(s: RockShape, lx: number, ly: number): number {
  const d = Math.hypot(lx, ly);
  const er = edgeRadius(s, Math.atan2(ly, lx));
  if (d >= er) return NaN;
  const u = d / er;
  let h = Math.sqrt(1 - u * u) * s.rmax;
  for (const c of s.craters) {
    const dc = Math.hypot(lx - c.x, ly - c.y) / c.r;
    if (dc < 1) h -= c.depth * c.r * (1 - dc * dc);
    else if (dc < 1.5) h += 0.3 * c.depth * c.r * (1 - Math.abs(dc - 1.15) / 0.35);
  }
  h += (noise(lx / 2.5, ly / 2.5, s.seed) - 0.5) * 1.1;
  return h;
}

function craterFloor(s: RockShape, lx: number, ly: number): boolean {
  for (const c of s.craters) {
    if (Math.hypot(lx - c.x, ly - c.y) < c.r * 0.6) return true;
  }
  return false;
}

/**
 * Light level per pixel (0 shadow .. 4 highlight, -1 transparent) for one
 * rotation frame, row-major n×n. Pure, so it is unit-tested without a canvas.
 */
export function rockLevels(size: AsteroidSize, variant: number, frame: number): Int8Array {
  const s = rockShape(size, variant);
  const n = s.n;
  const out = new Int8Array(n * n).fill(-1);
  const phi = frame * ROT_STEP;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const half = n / 2;
  // Screen → rock-local (inverse of a clockwise rotation in y-down space).
  const H = (sx: number, sy: number): number =>
    height(s, sx * cos + sy * sin, -sx * sin + sy * cos);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const sx = x + 0.5 - half;
      const sy = y + 0.5 - half;
      const h = H(sx, sy);
      if (Number.isNaN(h)) continue;
      const hl = H(sx - 0.7, sy);
      const hr = H(sx + 0.7, sy);
      const hu = H(sx, sy - 0.7);
      const hd = H(sx, sy + 0.7);
      // Off the silhouette counts as height 0, which darkens the far rim.
      const gx = ((Number.isNaN(hr) ? 0 : hr) - (Number.isNaN(hl) ? 0 : hl)) / 1.4;
      const gy = ((Number.isNaN(hd) ? 0 : hd) - (Number.isNaN(hu) ? 0 : hu)) / 1.4;
      const nl = Math.hypot(gx, gy, 1);
      const b = (-gx * LX - gy * LY + LZ) / (nl * LN);
      let v = 0.08 + 0.86 * Math.pow(Math.max(0, b), 1.35);
      const lx = sx * cos + sy * sin;
      const ly = -sx * sin + sy * cos;
      if (craterFloor(s, lx, ly)) v -= 0.12;
      const t = Math.max(0, Math.min(1, v)) * 4;
      let lv = Math.floor(t);
      // Dither only near level boundaries, so flat faces stay clean.
      if (t - lv > 0.3 + 0.4 * (BAYER4[(y & 3) * 4 + (x & 3)] as number)) lv++;
      out[y * n + x] = Math.min(4, lv);
    }
  }
  return out;
}

type Ramp5 = readonly [string, string, string, string, string];

function ramp5(r: {
  shadow: string;
  dark: string;
  base: string;
  light: string;
  highlight: string;
}): Ramp5 {
  return [r.shadow, r.dark, r.base, r.light, r.highlight];
}

function tint(r: Ramp5, toward: string, t: number): Ramp5 {
  return r.map((c, i) => (i === 4 ? c : mix(c, toward, t))) as unknown as Ramp5;
}

/** Per theme, one ramp per variant, so a field of rocks isn't all one color. */
export const ROCK_PALETTES: Readonly<Record<RockTheme, readonly Ramp5[]>> = {
  kessler: [
    ramp5(ROCK),
    tint(ramp5(ROCK), snes('#707078'), 0.35),
    tint(ramp5(ROCK), snes('#904820'), 0.2),
  ],
  ion: [
    ramp5(ICE),
    tint(ramp5(ICE), snes('#58a0a0'), 0.3),
    tint(ramp5(ICE), snes('#7068c0'), 0.25),
  ],
  basalt: [
    ramp5(BASALT),
    tint(ramp5(BASALT), snes('#483830'), 0.35),
    tint(ramp5(BASALT), snes('#283850'), 0.3),
  ],
};

export function rockSpriteId(theme: RockTheme, size: AsteroidSize, v: number): string {
  return `rock_${theme}_${size}_${v}`;
}

export function sizeIndex(size: AsteroidSize): number {
  return size === 'small' ? 0 : size === 'medium' ? 1 : 2;
}

/** `ROCK_IDS[asteroid.variant][sizeIndex]`; variant = theme * ROCK_VARIANTS + shape. */
export const ROCK_IDS: readonly (readonly string[])[] = ROCK_THEME_IDS.flatMap((theme) => {
  const rows: string[][] = [];
  for (let v = 0; v < ROCK_VARIANTS; v++) {
    rows.push(ASTEROID_SIZE_IDS.map((size) => rockSpriteId(theme, size, v)));
  }
  return rows;
});

export function rockIdsForTheme(theme: RockTheme): string[] {
  const ids: string[] = [];
  for (const size of ASTEROID_SIZE_IDS) {
    for (let v = 0; v < ROCK_VARIANTS; v++) ids.push(rockSpriteId(theme, size, v));
  }
  return ids;
}

/** Rotation frame for a rock: 0 = as authored, clockwise, same buckets as the renderer. */
export function rockFrame(rot: number): number {
  const b = Math.round(rot / ROT_STEP) % ROCK_FRAMES;
  return b < 0 ? b + ROCK_FRAMES : b;
}

for (const theme of ROCK_THEME_IDS) {
  for (const size of ASTEROID_SIZE_IDS) {
    for (let v = 0; v < ROCK_VARIANTS; v++) {
      const pal = (ROCK_PALETTES[theme][v] as Ramp5).slice();
      const n = ASTEROID_SIZES[size].sprite - 2;
      defineProcSprite(
        rockSpriteId(theme, size, v),
        n,
        n,
        (ctx, frame) => {
          const lv = rockLevels(size, v, frame);
          for (let i = 0; i < lv.length; i++) {
            const l = lv[i] as number;
            if (l < 0) continue;
            ctx.fillStyle = pal[l] as string;
            ctx.fillRect(i % n, Math.floor(i / n), 1, 1);
          }
        },
        { frames: ROCK_FRAMES, outline: OUTLINE },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Black hole (T23 lensing look): a lightless core, a 1 px hot accretion ring
// at the core edge with two highlights slowly turning around it, and a
// dithered dark halo out to twice the core radius, edged by sparse violet
// lensing glints. One sprite per whole core radius, so variants and
// collapsing holes all use the same art. The field itself isn't drawn.

export const BLACKHOLE_FRAMES = 8;
/** Largest baked core radius (the `massive` variant). */
export const BLACKHOLE_MAX_R = 12;

/** Dim → hot. Violet outer disk, amber inner disk; never magenta-with-white (enemy bullets). */
export const ACCRETION = [
  snes('#180828'),
  snes('#381060'),
  snes('#6020a0'),
  snes('#b04818'),
  snes('#f09028'),
  snes('#f8d070'),
  snes('#f8f0c8'),
] as const;
const VOID = snes('#000000');
const HALO_OUTER = snes('#080410');

/** Sprite cell for a core radius: halo to 2c plus a glint ring and a pixel of slack. */
export function blackHoleSize(core: number): number {
  return 4 * core + 6;
}

/**
 * Pixel color (or null) at offset (dx, dy) from the center of a core-radius
 * `core` hole on `frame`. Exposed for tests.
 */
export function blackHolePixel(
  core: number,
  dx: number,
  dy: number,
  frame: number,
  bx: number,
  by: number,
): string | null {
  const d = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  // Two highlights, half a turn apart, turning a half-turn per frame cycle.
  const spin = (frame / BLACKHOLE_FRAMES) * Math.PI;
  if (d < core - 0.5) return VOID;
  if (d < core + 0.55) {
    let off = Math.abs((((th - spin) % Math.PI) + Math.PI) % Math.PI);
    if (off > Math.PI / 2) off = Math.PI - off;
    const hot = off < 0.32 ? 6 : off < 0.75 ? 5 : 4;
    return ACCRETION[hot] as string;
  }
  const outer = core * 2;
  if (d < outer) {
    // Dense at the ring, thinning to nothing at 2c.
    const v = 1 - (d - core - 0.55) / (outer - core - 0.55);
    const thr = BAYER4[(by & 3) * 4 + (bx & 3)] as number;
    if (v * 1.15 > thr) return v > 0.5 ? VOID : HALO_OUTER;
    return null;
  }
  if (
    d < outer + 1 &&
    core >= 4 &&
    hash2(Math.floor(th * (core + 6) + frame * 0.5), 1, 0x51ab) > 0.7
  )
    return ACCRETION[2];
  return null;
}

function bakeBlackHole(core: number) {
  const size = blackHoleSize(core);
  return (ctx: CanvasRenderingContext2D, frame: number, _rng: Rng): void => {
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const col = blackHolePixel(core, x + 0.5 - c, y + 0.5 - c, frame, x, y);
        if (col === null) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
}

const BLACKHOLE_IDS: string[] = [];
for (let core = 1; core <= BLACKHOLE_MAX_R; core++) {
  const id = `anomaly_blackhole_r${core}`;
  BLACKHOLE_IDS[core] = id;
  defineProcSprite(id, blackHoleSize(core), blackHoleSize(core), bakeBlackHole(core), {
    frames: BLACKHOLE_FRAMES,
  });
}

/** Sprite id for a whole core radius 1..BLACKHOLE_MAX_R (clamped). */
export function blackHoleSprite(core: number): string {
  const c = core < 1 ? 1 : core > BLACKHOLE_MAX_R ? BLACKHOLE_MAX_R : core;
  return BLACKHOLE_IDS[c] as string;
}

// ---------------------------------------------------------------------------
// Pulsar: a white-blue neutron star with turning beams. Frames 0–3 idle,
// 4–7 the telegraph glow building toward a pulse.

export const PULSAR_SIZE = 24;
export const PULSAR_IDLE_FRAMES = 4;
export const PULSAR_GLOW_FRAMES = 4;

/** Dim → hot, cold blue-violet so it never reads as a bullet. */
export const PULSAR_RAMP = [
  snes('#100850'),
  snes('#283098'),
  snes('#5868e8'),
  snes('#a8c0f8'),
  snes('#f8f8f8'),
] as const;

function drawPulsar(ctx: CanvasRenderingContext2D, frame: number, _rng: Rng): void {
  const c = PULSAR_SIZE / 2;
  const glow =
    frame < PULSAR_IDLE_FRAMES ? 0 : (frame - PULSAR_IDLE_FRAMES + 1) / PULSAR_GLOW_FRAMES;
  const beam = ((frame % PULSAR_IDLE_FRAMES) / PULSAR_IDLE_FRAMES) * (Math.PI / 2);
  for (let y = 0; y < PULSAR_SIZE; y++) {
    for (let x = 0; x < PULSAR_SIZE; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      // Four-point beam cross, narrowing with distance.
      const off = Math.abs(Math.sin(2 * (th - beam)));
      const beamV = Math.max(0, 1 - off * (2 + d * 0.6)) * Math.max(0, 1 - d / (9 + glow * 3));
      const halo = Math.max(0, 1 - d / (5 + glow * 6)) * (0.6 + glow * 0.6);
      let v = Math.max(beamV, halo);
      if (d < 2.3) v = 1.2;
      else if (d < 3.4) v = Math.max(v, 0.85);
      const thr = BAYER4[(y & 3) * 4 + (x & 3)] as number;
      if (v * 1.1 <= thr * 0.5) continue;
      const lv = Math.max(0, Math.min(4, Math.floor(v * 4 + thr - 0.3)));
      ctx.fillStyle = PULSAR_RAMP[lv] as string;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

defineProcSprite('anomaly_pulsar', PULSAR_SIZE, PULSAR_SIZE, drawPulsar, {
  frames: PULSAR_IDLE_FRAMES + PULSAR_GLOW_FRAMES,
});
