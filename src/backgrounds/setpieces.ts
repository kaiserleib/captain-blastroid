import { createRng, type Rng } from '../engine/rng';
import { createBitmap, get, plot, type IndexedBitmap } from './bitmap';
import type { Rgb } from './color';
import { bayer4, ditherLevel, PeriodicValueNoise } from './noise';

export type SetPieceKind = 'planet' | 'station' | 'belt' | 'giant' | 'fleet' | 'disk';

export interface SetPieceSpec {
  kind: SetPieceKind;
  /**
   * Seconds into the level, at the theme's nominal scroll speed, when the piece's
   * top edge enters the top of the screen. Stored as scroll distance, so it stays
   * in place if the speed changes. Negative values start it already on screen.
   */
  at: number;
  /** Left edge in px; negative or > 240 - width crops it, e.g. for a planet limb. */
  x: number;
  /** Planet radius, station height, or belt band height, px. */
  size: number;
  /**
   * Ramp, dark → light. Planet, giant, belt and disk use 4; station uses 3 (hull, lit
   * edge, window); fleet uses 3 (hull, lit edge, rust).
   */
  colors: readonly Rgb[];
  /** Scroll multiplier; defaults to `PARALLAX.setPiece` (0.1). */
  parallax?: number;
  /** Fleet only: blinking running-light color, a point color (≤ MAX_POINT_VALUE). */
  light?: Rgb;
}

/** Fleet running lights blink in two groups across this many palette phases. */
export const LIGHT_PHASES = 4;
/** Seconds per running-light phase. */
export const LIGHT_STEP = 0.4;
// Which of the two light groups is lit at each phase.
const LIGHT_CYCLE: readonly (readonly [boolean, boolean])[] = [
  [true, false],
  [false, false],
  [false, true],
  [false, false],
];

// Light comes from the top-left, per the art rules.
const LX = -0.55;
const LY = -0.6;
const LZ = 0.58;

export function generateSetPiece(seed: number, spec: SetPieceSpec): IndexedBitmap {
  const rng = createRng(seed);
  switch (spec.kind) {
    case 'planet':
      return planet(rng, spec.size, spec.colors.length);
    case 'station':
      return station(rng, spec.size);
    case 'belt':
      return belt(rng, spec.size, spec.colors.length);
    case 'giant':
      return giant(rng, spec.size, spec.colors.length);
    case 'fleet':
      return fleet(rng, spec.size);
    case 'disk':
      return disk(rng, spec.size, spec.colors.length);
  }
}

/** True for kinds whose bitmap carries blinking-light indices, so they need one canvas per phase. */
export function hasLights(spec: SetPieceSpec): boolean {
  return spec.kind === 'fleet';
}

/**
 * Palette for one light phase. Fleet bitmaps use index 4 and 5 for the two light
 * groups; an unlit light shows as hull so the ship doesn't get holes.
 */
export function setPiecePalette(spec: SetPieceSpec, phase = 0): (Rgb | null)[] {
  const pal: (Rgb | null)[] = [null, ...spec.colors];
  if (hasLights(spec)) {
    const hull = spec.colors[0] ?? null;
    const lit = spec.light ?? spec.colors[spec.colors.length - 1] ?? null;
    const on = LIGHT_CYCLE[((phase % LIGHT_PHASES) + LIGHT_PHASES) % LIGHT_PHASES]!;
    pal[FLEET_LIGHT_A] = on[0] ? lit : hull;
    pal[FLEET_LIGHT_B] = on[1] ? lit : hull;
  }
  return pal;
}

const FLEET_LIGHT_A = 4;
const FLEET_LIGHT_B = 5;

/** A shaded gas giant with banding, a dithered terminator and a thin lit rim. */
function planet(rng: Rng, radius: number, levels: number): IndexedBitmap {
  const d = radius * 2;
  const b = createBitmap(d, d);
  const bands = new PeriodicValueNoise(rng, 6, 4, 64);
  const tilt = rng.range(-0.25, 0.25);
  const top = levels - 1;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const nx = (x + 0.5 - radius) / radius;
      const ny = (y + 0.5 - radius) / radius;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const lam = nx * LX + ny * LY + nz * LZ;
      // Latitude bands, slightly tilted; sampled in sphere space so they curve with the limb.
      const lat = (ny + nx * tilt) * 32 + 32;
      const band = (bands.sample(nx * 3, lat) - 0.5) * 0.35;
      let v = lam * 1.1 - 0.15 + band;
      // Lit rim: a thin atmosphere line on the sunward edge.
      const edge = radius * (1 - Math.sqrt(rr));
      if (edge < 1.2 && lam > 0.05) v = 1;
      if (v < 0) v = 0;
      // Level 0 would be transparent; the night side keeps the darkest ramp step so it occludes stars.
      const lvl = 1 + ditherLevel(v > 1 ? 1 : v, top, x, y);
      b.data[y * d + x] = lvl;
    }
  }
  return b;
}

/** A derelict station silhouette: spine, modules, a broken ring, a few lit windows. */
function station(rng: Rng, height: number): IndexedBitmap {
  const w = Math.round(height * 0.75);
  const b = createBitmap(w, height);
  const cx = w >> 1;
  const fill = (x0: number, y0: number, ww: number, hh: number): void => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) plot(b, x, y, 1);
  };
  // Spine and antenna.
  fill(cx - 2, Math.round(height * 0.08), 4, Math.round(height * 0.84));
  fill(cx, 0, 1, Math.round(height * 0.1));
  // Habitat ring, seen nearly edge-on, with a gap blown out of it.
  const ringY = Math.round(height * rng.range(0.3, 0.42));
  const rx = w / 2 - 2;
  const ry = Math.max(3, Math.round(height * 0.06));
  const gapA = rng.range(0, Math.PI * 2);
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    let da = Math.abs(a - gapA);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.45) continue;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(ringY + Math.sin(a) * ry);
    plot(b, x, y, 1);
    plot(b, x, y + 1, 1);
  }
  // Spokes.
  fill(Math.round(cx - rx * 0.7), ringY, Math.round(rx * 1.4), 1);
  // Modules hung off the spine, roughly mirrored.
  const modules = rng.int(4, 6);
  for (let i = 0; i < modules; i++) {
    const my = Math.round(height * rng.range(0.12, 0.85));
    const mw = rng.int(4, Math.max(5, Math.round(w * 0.3)));
    const mh = rng.int(3, Math.max(4, Math.round(height * 0.09)));
    const side = rng.chance(0.5) ? 1 : -1;
    fill(side > 0 ? cx + 2 : cx - 2 - mw, my, mw, mh);
    if (rng.chance(0.6)) fill(side > 0 ? cx - 2 - mw : cx + 2, my + rng.int(-2, 2), mw, mh);
  }
  // Solar panels: hatched with a checker so they read as lattice, not slabs.
  const py = Math.round(height * rng.range(0.6, 0.78));
  const pw = Math.round(w * 0.38);
  for (let y = py; y < py + Math.round(height * 0.1); y++) {
    for (let x = 0; x < pw; x++) {
      if (((x + y) & 1) === 0 || y === py) {
        plot(b, cx - 3 - x, y, 1);
        plot(b, cx + 3 + x, y, 1);
      }
    }
  }
  // Damage: bite holes out of the hull.
  const holes = rng.int(3, 6);
  for (let i = 0; i < holes; i++) {
    const hx = rng.int(0, w - 1);
    const hy = rng.int(0, height - 1);
    const hr = rng.int(1, 3);
    for (let y = -hr; y <= hr; y++)
      for (let x = -hr; x <= hr; x++) if (x * x + y * y <= hr * hr) plot(b, hx + x, hy + y, 0);
  }
  // Lit edges face the top-left light.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (get(b, x, y) === 1 && (get(b, x - 1, y) === 0 || get(b, x, y - 1) === 0)) {
        b.data[y * w + x] = 2;
      }
    }
  }
  // A handful of windows still lit: the only bright pixels, and very few.
  const windows = rng.int(3, 7);
  for (let i = 0; i < windows; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, height - 1);
    if (get(b, x, y) === 1) b.data[y * w + x] = 3;
  }
  return b;
}

/** A full-width band of distant rocks, densest along a wavy centerline, with dithered dust. */
function belt(rng: Rng, height: number, levels: number): IndexedBitmap {
  const w = 240;
  const b = createBitmap(w, height);
  const phase = rng.range(0, Math.PI * 2);
  const amp = height * 0.12;
  const half = height * 0.32;
  const centerAt = (x: number): number => height / 2 + Math.sin(x / 38 + phase) * amp;
  const density = (x: number, y: number): number => {
    const t = (y - centerAt(x)) / half;
    return Math.exp(-t * t);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (bayer4(x, y) < density(x, y) * 0.3 && ((x * 7 + y * 13) & 7) < 3) b.data[y * w + x] = 1;
    }
  }
  const rocks = Math.round(w * height * 0.02);
  const lit = Math.min(levels, 4);
  for (let i = 0; i < rocks; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, height - 1);
    if (!rng.chance(density(x, y))) continue;
    const s = rng.chance(0.15) ? 3 : rng.chance(0.45) ? 2 : 1;
    for (let yy = 0; yy < s; yy++) {
      for (let xx = 0; xx < s; xx++) {
        if (s === 3 && (xx + yy === 0 || xx + yy === 4)) continue;
        // Top-left pixel of each rock catches the light.
        plot(b, x + xx, y + yy, xx + yy === 0 || (s === 3 && xx + yy === 1) ? lit : lit - 1);
      }
    }
  }
  return b;
}

/**
 * A slice of a huge banded gas giant: strong, turbulent latitude bands, a storm
 * oval, and a dithered terminator. Meant to be placed mostly off one edge.
 */
function giant(rng: Rng, radius: number, levels: number): IndexedBitmap {
  const d = radius * 2;
  const b = createBitmap(d, d);
  const bands = new PeriodicValueNoise(rng, 4, 8, 96);
  const swirl = new PeriodicValueNoise(rng, 16, 8, 32);
  const tilt = rng.range(-0.12, 0.12);
  const stormLat = rng.range(0.15, 0.45);
  const stormLon = rng.range(-0.5, 0.5);
  const top = levels - 1;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const nx = (x + 0.5 - radius) / radius;
      const ny = (y + 0.5 - radius) / radius;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const lam = nx * LX + ny * LY + nz * LZ;
      // Bands sampled by latitude, wobbled by a second noise so their edges churn.
      const lat = ny + nx * tilt;
      const wob = (swirl.sample(nx * 40 + 64, lat * 60 + 64) - 0.5) * 0.06;
      const band = Math.sin((lat + wob) * 22) * 0.5 + (bands.sample(nx * 2, (lat + 1) * 48) - 0.5);
      let v = lam * 0.85 - 0.1 + band * 0.32;
      // A storm oval: a lighter eye with a darker collar.
      const sx = (nx - stormLon) / 0.16;
      const sy = (ny - stormLat) / 0.07;
      const sd = sx * sx + sy * sy;
      if (sd < 1) v += sd < 0.45 ? 0.25 : -0.2;
      const edge = radius * (1 - Math.sqrt(rr));
      if (edge < 1.2 && lam > 0.1) v = 1;
      if (v < 0) v = 0;
      b.data[y * d + x] = 1 + ditherLevel(v > 1 ? 1 : v, top, x, y);
    }
  }
  return b;
}

/**
 * Distant capital ships at anchor, noses up: dark wedge hulls with 1–2 px
 * superstructure, a lit top-left edge, rust patches, and running lights in two
 * blink groups (indices 4 and 5). The strip is 240 px wide and `height` tall.
 */
function fleet(rng: Rng, height: number): IndexedBitmap {
  const w = 240;
  const b = createBitmap(w, height);
  const ships = rng.int(3, 5);
  const slot = w / ships;
  for (let i = 0; i < ships; i++) {
    const len = rng.int(Math.round(height * 0.45), height - 4);
    const beam = rng.int(5, Math.max(6, Math.round(len * 0.22)));
    const cx = Math.round(slot * (i + 0.5) + rng.range(-slot * 0.25, slot * 0.25));
    const y0 = rng.int(1, height - len - 1);
    ship(rng, b, cx, y0, len, beam);
  }
  // Lit edges face the top-left light; only hull pixels next to space.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (get(b, x, y) === 1 && (get(b, x - 1, y) === 0 || get(b, x, y - 1) === 0)) {
        b.data[y * w + x] = 2;
      }
    }
  }
  // Running lights go last so the edge pass can't overwrite them.
  const lights = rng.int(5, 9);
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < lights; tries++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, height - 1);
    const c = get(b, x, y);
    // Lights sit on a hull edge facing space, so they read as wingtip/mast lights.
    if (c !== 2 && c !== 1) continue;
    if (get(b, x - 1, y) !== 0 && get(b, x + 1, y) !== 0 && get(b, x, y - 1) !== 0) continue;
    b.data[y * w + x] = placed % 2 === 0 ? FLEET_LIGHT_A : FLEET_LIGHT_B;
    placed++;
  }
  return b;
}

function ship(rng: Rng, b: IndexedBitmap, cx: number, y0: number, len: number, beam: number): void {
  const prow = Math.round(len * rng.range(0.3, 0.45));
  for (let y = 0; y < len; y++) {
    // Wedge bow widening to the full beam, then a straight hull with a stepped stern.
    let half = y < prow ? (beam / 2) * (y / prow) : beam / 2;
    if (y > len - 4) half -= 1;
    const hw = Math.max(0, Math.round(half));
    for (let x = -hw; x <= hw; x++) plot(b, cx + x, y0 + y, 1);
  }
  // Superstructure: a bridge tower and a few 1–2 px blocks along the spine.
  const bridge = y0 + Math.round(len * rng.range(0.55, 0.7));
  for (let y = bridge; y < bridge + 3; y++) {
    plot(b, cx - 1, y, 1);
    plot(b, cx + 1, y, 1);
    plot(b, cx - Math.round(beam / 2) - 1, y, 1);
    plot(b, cx + Math.round(beam / 2) + 1, y, 1);
  }
  // Engine block bumps at the stern.
  const stern = y0 + len;
  for (let k = -1; k <= 1; k++) plot(b, cx + k * Math.max(2, Math.round(beam / 3)), stern, 1);
  // Notches cut into the flanks for 1 px detail.
  const notches = rng.int(2, 4);
  for (let i = 0; i < notches; i++) {
    const y = y0 + rng.int(prow, len - 2);
    const side = rng.chance(0.5) ? 1 : -1;
    plot(b, cx + side * Math.round(beam / 2), y, 0);
  }
  // Syndicate rust: a few dithered patches on the hull.
  const patches = rng.int(2, 4);
  for (let i = 0; i < patches; i++) {
    const py = y0 + rng.int(prow >> 1, len - 2);
    const px = cx + rng.int(-Math.round(beam / 3), Math.round(beam / 3));
    for (let y = py; y < py + 3; y++) {
      for (let x = px - 1; x <= px + 1; x++) {
        if (get(b, x, y) === 1 && ((x + y) & 1) === 0) plot(b, x, y, 3);
      }
    }
  }
}

/**
 * A faint, distant accretion disk: a tilted ellipse of dithered gold rings around
 * an occluding dark core, the near side drawn over the core's lower edge. The
 * bitmap is `size` × `size`; the disk is wider than it is tall.
 */
function disk(rng: Rng, size: number, levels: number): IndexedBitmap {
  const b = createBitmap(size, size);
  const c = size / 2;
  const tilt = rng.range(0.24, 0.34);
  const rot = rng.range(-0.35, 0.35);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ripples = new PeriodicValueNoise(rng, 12, 1, 12);
  const core = size * 0.11;
  const inner = size * 0.15;
  const outer = size * 0.48;
  const top = levels - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      // Rotate, then un-squash, to get radius in the disk plane.
      const u = dx * cos + dy * sin;
      const v = (-dx * sin + dy * cos) / tilt;
      const r = Math.sqrt(u * u + v * v);
      const coreR = Math.sqrt(dx * dx + dy * dy);
      const nearSide = v > 0;
      if (coreR < core && !(nearSide && r > inner && r < outer)) {
        b.data[y * size + x] = 1;
        continue;
      }
      if (r < inner || r > outer) continue;
      const t = (r - inner) / (outer - inner);
      // Brightest at the inner edge, fading out; ring structure from ripple noise.
      const ang = Math.atan2(v, u) / (Math.PI * 2) + 0.5;
      const ring = ripples.sample(ang * 144, 0.5) * 0.15 + Math.sin(t * 40) * 0.12;
      let lv = (1 - t) * 0.9 + ring - 0.15;
      // Doppler: the approaching side (left) is brighter.
      lv -= (u / outer) * 0.15;
      if (lv <= 0.05) continue;
      if (lv > 1) lv = 1;
      const level = ditherLevel(lv, top, x, y);
      if (level > 0) b.data[y * size + x] = 1 + level;
    }
  }
  // Photon ring: one bright pixel ring hugging the core.
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = Math.round(c + Math.cos(a) * (core + 0.5));
    const y = Math.round(c + Math.sin(a) * (core + 0.5));
    plot(b, x, y, levels);
  }
  return b;
}
