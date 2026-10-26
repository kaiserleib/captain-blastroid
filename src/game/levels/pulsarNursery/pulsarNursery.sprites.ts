// Sector 4 art: the Syndicate's pulsar-tech roster (gunmetal and rust hulls
// with gold resonators and a blue-white pulsar glow, the green eye kept as the
// faction tell) and the Magnetar forge station. Painted procedurally into an
// index buffer like the Rock Hauler: bevelled shapes, sphere lighting with
// ordered dithering, all lit from the top-left, all 15-bit colors.
import { createRng } from '../../../engine/rng';
import {
  FX,
  GILT,
  GLOW,
  GUNMETAL,
  OLIVE,
  OUTLINE,
  snes,
  SYNDICATE,
  WHITE,
} from '../../../gfx/palette';
import { defineProcSprite } from '../../../gfx/sprite';

export const PN_SPRITES = {
  drone: 'pn_drone',
  streaker: 'pn_streaker',
  warn: 'pn_warn',
  ray: 'pn_ray',
  rayLens: 'pn_ray_lens',
  hull: 'pn_mag_hull',
  core: 'pn_mag_core',
  pylon: 'pn_mag_pylon',
  pylonWreck: 'pn_mag_pylon_wreck',
  spark: 'pn_mag_spark',
} as const;

export const PN_SPRITE_IDS: readonly string[] = Object.values(PN_SPRITES);

/** Drone frames: 0–1 idle shimmer, 2–3 charging (the beat is near). */
export const DRONE_FRAMES = { idle: 0, charge: 2 } as const;
export const RAY_LENS_FRAMES = 4;
export const WARN_FRAMES = 2;
/** Core frames: 0–1 shielded, 2–3 shield cracking, 4–7 exposed pulse, 8–9 meltdown. */
export const CORE_FRAMES = { shield: 0, crack: 2, open: 4, openCount: 4, melt: 8 } as const;
export const SPARK_FRAMES = 3;
/** Hull radius (px) the station art covers; the boss draws telegraph spokes from here out. */
export const HULL_RADIUS = 47;

// ---------------------------------------------------------------------------
// Colors (shadow → dark → base → light → highlight)

type Ramp5 = readonly [number, number, number, number, number];
const c = (hex: string): number => parseInt(hex.slice(1), 16);

const GUN: Ramp5 = [
  c(snes('#100c18')),
  c(GUNMETAL.dark),
  c(GUNMETAL.base),
  c(GUNMETAL.light),
  c(GUNMETAL.highlight),
];
const RUST: Ramp5 = [
  c(SYNDICATE.shadow),
  c(SYNDICATE.dark),
  c(SYNDICATE.base),
  c(SYNDICATE.light),
  c(SYNDICATE.highlight),
];
const OLV: Ramp5 = [
  c(snes('#181808')),
  c(OLIVE.dark),
  c(OLIVE.base),
  c(OLIVE.light),
  c(OLIVE.highlight),
];
const GOLD: Ramp5 = [
  c(snes('#382000')),
  c(GILT.dark),
  c(GILT.base),
  c(GILT.light),
  c(GILT.highlight),
];
/** The pulsar's blue-white (matches the ring ramp in game/obstacles). */
const STAR: Ramp5 = [
  c(snes('#100850')),
  c(snes('#283098')),
  c(snes('#5868e8')),
  c(snes('#a8c0f8')),
  c(WHITE),
];
/** Magnetic violet for field arcs and halos. */
const MAG: Ramp5 = [
  c(snes('#180830')),
  c(snes('#382070')),
  c(snes('#6840b8')),
  c(snes('#a080f0')),
  c(snes('#d8c8f8')),
];
/** Meltdown: the star running hot. */
const HOT: Ramp5 = [c(snes('#481000')), c(FX.red), c(FX.orange), c(FX.yellow), c(WHITE)];
const INK = c(OUTLINE);
const GREEN = c(GLOW.green);
const GREEN_HOT = c(GLOW.greenHot);
const GREEN_DARK = c(GLOW.greenDark);
const AMBER = c(GLOW.amber);
const AMBER_DIM = c(snes('#784000'));
const RED = c(GLOW.red);
const RED_DIM = c(snes('#601010'));
const SOOT = c(snes('#181010'));
const HAZARD_DARK = c(snes('#201810'));
const SPARK_YELLOW = c(FX.yellow);

const S = 0;
const D = 1;
const B = 2;
const L = 3;
const H = 4;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;
}

const LX = -0.48;
const LY = -0.56;
const LZ = 0.67;

type Mask = (x: number, y: number) => boolean;

function level(lum: number, x: number, y: number): number {
  const t = (lum + 0.15) / 1.1;
  const k = Math.floor(t * 5 + (bayer(x, y) - 0.5) * 0.7);
  return k < 0 ? 0 : k > 4 ? 4 : k;
}

/** An RGB index buffer; -1 is transparent. */
class Paint {
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

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.d[y * this.w + x] as number;
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
        else if (!up || !lf) k = L;
        else if (!dn && !rt) k = S;
        else if (!dn || !rt) k = D;
        this.set(x, y, r[k] as number);
      }
    }
  }

  sphere(cx: number, cy: number, rad: number, r: Ramp5, bias = 0, mask?: Mask): void {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        const nx = (x + 0.5 - cx) / rad;
        const ny = (y + 0.5 - cy) / rad;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1 || (mask && !mask(x, y))) continue;
        const lum = nx * LX + ny * LY + Math.sqrt(1 - d2) * LZ;
        this.set(x, y, r[level(lum + bias, x, y)] as number);
      }
    }
  }

  /** A ring band (r0..r1 around cx, cy) shaded as a raised torus lit from the top-left. */
  torus(cx: number, cy: number, r0: number, r1: number, r: Ramp5, mask?: Mask): void {
    const mid = (r0 + r1) / 2;
    const half = (r1 - r0) / 2;
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) {
      for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
        const ex = x + 0.5 - cx;
        const ey = y + 0.5 - cy;
        const d = Math.hypot(ex, ey);
        if (d < r0 || d >= r1 || (mask && !mask(x, y))) continue;
        // Across the band the surface tilts from inward- to outward-facing.
        const t = (d - mid) / half;
        const nx = (ex / d) * t;
        const ny = (ey / d) * t;
        const nz = Math.sqrt(Math.max(0, 1 - t * t));
        this.set(x, y, r[level(nx * LX + ny * LY + nz * LZ, x, y)] as number);
      }
    }
  }

  rivet(x: number, y: number, r: Ramp5): void {
    this.set(x, y, r[H]);
    this.set(x + 1, y + 1, r[S]);
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

function proc(
  id: string,
  w: number,
  h: number,
  frames: number,
  paint: (p: Paint, f: number) => void,
  outline = true,
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
    { frames, outline: outline ? OUTLINE : false },
  );
}

const polar = (cx: number, cy: number) => (x: number, y: number) => ({
  d: Math.hypot(x + 0.5 - cx, y + 0.5 - cy),
  a: Math.atan2(y + 0.5 - cy, x + 0.5 - cx),
});

// ---------------------------------------------------------------------------
// Pulse Drone, 16×16: a gunmetal orb in a gold resonator crown, green eye.
// Charging frames light the prongs and wake a blue-white glow in the eye.

proc(PN_SPRITES.drone, 16, 16, 4, (p, f) => {
  const charge = f >= DRONE_FRAMES.charge;
  const pol = polar(8, 8);
  // Four diagonal prongs (the crown), drawn under the orb.
  const prong: Mask = (x, y) => {
    const { d, a } = pol(x, y);
    if (d < 4 || d > 7.6) return false;
    const k = (((a / (Math.PI / 2) - 0.5) % 1) + 1) % 1;
    return Math.abs(k - 0.5) > 0.5 - 0.11 * (8.5 - d);
  };
  p.shape(prong, GOLD, charge ? L : B);
  // The ring the prongs hang from.
  p.torus(8, 8, 4.6, 6.4, GOLD, (x, y) => {
    const { a } = pol(x, y);
    return Math.abs(Math.sin(a * 2)) < 0.55;
  });
  p.sphere(8, 8, 4.6, GUN, 0.05);
  // Eye: green while idle, blue-white heart when charging.
  const pulse = f & 1;
  if (charge) {
    p.sphere(8, 8.5, 2.4, STAR, 0.25 + pulse * 0.2);
    p.set(7, 7, c(WHITE));
    for (const [x, y] of [
      [2, 2],
      [13, 2],
      [2, 13],
      [13, 13],
    ] as const) {
      p.set(x, y, GOLD[H]);
    }
  } else {
    p.set(7, 8, GREEN_DARK);
    p.set(8, 8, pulse ? GREEN : GREEN_HOT);
    p.set(7, 9, GREEN_DARK);
    p.set(8, 9, GREEN);
  }
  p.set(6, 5, GUN[H]);
});

// ---------------------------------------------------------------------------
// Streaker, 12×20, nose UP (it rockets in from below): a rust needle with a
// gold spine, swept fins and a long engine flame.

proc(PN_SPRITES.streaker, 12, 20, 2, (p, f) => {
  const hull: Mask = (x, y) => {
    const dx = Math.abs(x + 0.5 - 6);
    if (y < 1 || y > 14) return false;
    return dx <= Math.min(2.6, 0.6 + y * 0.32);
  };
  const fins: Mask = (x, y) => {
    const dx = Math.abs(x + 0.5 - 6);
    return y >= 9 && y <= 15 && dx >= 2 && dx <= 2 + (y - 8) * 0.55 && dx <= 5.6;
  };
  p.shape(fins, GUN);
  p.shape(hull, RUST);
  for (let y = 3; y <= 12; y++) p.set(6, y, GOLD[y < 6 ? H : L]);
  p.set(5, 2, RUST[H]);
  // Canopy slit with the faction green.
  p.set(5, 6, GREEN_DARK);
  p.set(6, 6, GREEN);
  // Nozzle and flame (two lengths).
  p.set(5, 15, GUN[D]);
  p.set(6, 15, GUN[S]);
  const len = f === 0 ? 4 : 3;
  for (let k = 0; k < len; k++) {
    const col = k === 0 ? c(WHITE) : k === 1 ? SPARK_YELLOW : AMBER;
    p.set(5, 16 + k, col);
    if (k < len - 1) p.set(6, 16 + k, k === 0 ? SPARK_YELLOW : AMBER_DIM);
  }
});

// Bottom-edge warning, 9×6: a blinking chevron pointing up where a Streaker will launch.
proc(PN_SPRITES.warn, 9, 6, WARN_FRAMES, (p, f) => {
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 4; i++) {
      const y = 1 + i + k * 2 - 1;
      if (y > 5) continue;
      const col = f === 0 ? (k === 0 ? SPARK_YELLOW : RED) : k === 0 ? AMBER : RED_DIM;
      p.set(4 - i, y, col);
      p.set(4 + i, y, col);
    }
  }
});

// ---------------------------------------------------------------------------
// Warden Ray, 32×24, nose down: olive manta wings with rust leading edges,
// a gunmetal spine and the gold beam emitter under the chin.

const RAY_CX = 16;

proc(PN_SPRITES.ray, 32, 24, 2, (p, f) => {
  const dx = (x: number) => Math.abs(x + 0.5 - RAY_CX);
  // Wings: a broad crescent, deepest at the body, swept back to points.
  const wing: Mask = (x, y) => {
    const d = dx(x);
    if (d > 15.6) return false;
    const top = 4 + d * 0.2 + (d > 11 ? (d - 11) * 0.9 : 0);
    const bot = 17 - d * 0.55;
    return y >= top && y <= bot;
  };
  const body: Mask = (x, y) => {
    const d = dx(x);
    return y >= 1 && y <= 21 && d <= 4.2 - Math.max(0, y - 15) * 0.45;
  };
  p.shape(wing, OLV);
  // Rust leading edge (the wing's lower rim, toward the nose).
  for (let x = 0; x < 32; x++) {
    for (let y = 23; y >= 0; y--) {
      if (!wing(x, y)) continue;
      p.set(x, y, RUST[dx(x) > 8 ? D : B]);
      if (wing(x, y - 1)) p.set(x, y - 1, RUST[L]);
      break;
    }
  }
  // Wing ribs.
  for (const rx of [7, 11]) {
    for (let y = 0; y < 24; y++) {
      for (const s of [-1, 1]) {
        const x = RAY_CX + s * rx - (s < 0 ? 1 : 0);
        if (wing(x, y) && wing(x, y + 2) && wing(x, y - 1)) p.set(x, y, OLV[D]);
      }
    }
  }
  p.shape(body, GUN);
  for (let y = 3; y < 15; y += 4) p.rivet(RAY_CX - 3, y, GUN);
  // Eyes and the tail fin.
  p.set(RAY_CX - 3, 9, GREEN_DARK);
  p.set(RAY_CX - 2, 9, f === 0 ? GREEN_HOT : GREEN);
  p.set(RAY_CX + 1, 9, f === 0 ? GREEN_HOT : GREEN);
  p.set(RAY_CX + 2, 9, GREEN_DARK);
  for (let y = 0; y < 3; y++) p.set(RAY_CX - 1, y, GUN[y === 0 ? H : L]);
  // Emitter socket under the chin (the lens sprite sits in it).
  for (let x = RAY_CX - 2; x < RAY_CX + 2; x++) p.set(x, 21, INK);
  // Wing-tip running lights blink.
  p.set(1, 9, f === 0 ? AMBER : AMBER_DIM);
  p.set(30, 9, f === 0 ? AMBER_DIM : AMBER);
});

// Beam lens, 8×8: the emitter glowing up through the telegraph (frame = intensity).
proc(
  PN_SPRITES.rayLens,
  8,
  8,
  RAY_LENS_FRAMES,
  (p, f) => {
    p.sphere(4, 4, 3.2, GOLD, 0.1);
    if (f === 0) return;
    const rad = 0.9 + f * 0.7;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
        if (d > rad) continue;
        p.set(x, y, d < rad - 1.2 ? c(WHITE) : STAR[L]);
      }
    }
  },
  true,
);

// ---------------------------------------------------------------------------
// Magnetar station hull, 96×96, radially symmetric: an outer gunmetal torus,
// four rust buttresses with hazard stripes, the dark pylon track with gold
// rail studs, and a gold-coiled containment collar around the core well.

const HC = 48;
const OUTER0 = 40;
const OUTER1 = 46.5;
const TRACK0 = 29;
const TRACK1 = 39.5;
const COLLAR0 = 16;
const COLLAR1 = 22;

let hullBase: Paint | null = null;

function paintHull(): Paint {
  const p = new Paint(96, 96);
  const rng = createRng('pn_mag_hull#weather');
  const pol = polar(HC, HC);
  const near = (a: number, k: number, w: number): boolean => {
    // Angular distance from the nearest of k evenly spaced spokes (first at 0).
    const s = (Math.PI * 2) / k;
    let r = a % s;
    if (r < 0) r += s;
    return Math.min(r, s - r) < w;
  };

  // Buttress spokes, outer ring to collar (cardinal directions).
  const spoke: Mask = (x, y) => {
    const { d, a } = pol(x, y);
    return d >= COLLAR1 - 1 && d < OUTER1 && near(a, 4, 0.2 + 2.2 / d);
  };
  p.shape(spoke, RUST);
  // Track floor: a dark groove the pylons ride, studded with gold rails.
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const { d, a } = pol(x, y);
      if (d < TRACK0 || d >= TRACK1 || spoke(x, y)) continue;
      const edge = d < TRACK0 + 1 || d >= TRACK1 - 1;
      p.set(x, y, edge ? GUN[S] : SOOT);
      if (Math.abs(d - 34.25) < 0.6 && near(a + 0.1, 24, 0.05)) p.set(x, y, GOLD[L]);
    }
  }
  p.torus(HC, HC, OUTER0, OUTER1, GUN);
  // Hazard stripes where each spoke meets the outer ring.
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const { d, a } = pol(x, y);
      if (d < OUTER0 - 4 || d >= OUTER0 || !spoke(x, y)) continue;
      const on = ((x + y) >> 1) % 2 === 0;
      p.set(x, y, on ? AMBER : HAZARD_DARK);
      void a;
    }
  }
  // Outer ring panel seams and rivets.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    for (let r = OUTER0 + 1; r < OUTER1 - 1; r += 1) {
      p.set(Math.round(HC - 0.5 + Math.cos(a) * r), Math.round(HC - 0.5 + Math.sin(a) * r), GUN[D]);
    }
    const b = a + Math.PI / 16;
    p.rivet(
      Math.round(HC - 0.5 + Math.cos(b) * (OUTER0 + 3)),
      Math.round(HC - 0.5 + Math.sin(b) * (OUTER0 + 3)),
      GUN,
    );
  }
  // Containment collar: gold coils between gunmetal clamps.
  p.torus(HC, HC, COLLAR0, COLLAR1, GOLD, (x, y) => !near(pol(x, y).a + Math.PI / 4, 4, 0.22));
  p.torus(HC, HC, COLLAR0, COLLAR1 + 1, GUN, (x, y) => near(pol(x, y).a + Math.PI / 4, 4, 0.22));
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const { d, a } = pol(x, y);
      if (d < COLLAR0 || d >= COLLAR1 || near(a + Math.PI / 4, 4, 0.22)) continue;
      // Coil windings: a dark line every few degrees.
      if (near(a, 36, 0.035)) p.set(x, y, GOLD[S]);
    }
  }
  // The core well.
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const { d } = pol(x, y);
      if (d >= COLLAR0) continue;
      p.set(x, y, d > COLLAR0 - 1.2 ? INK : SOOT);
    }
  }
  // Weathering on the rust and the ring.
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const v = p.get(x, y);
      if (v === RUST[B] && rng.next() < 0.12) p.set(x, y, RUST[D]);
      else if (v === GUN[B] && rng.next() < 0.05) p.set(x, y, GUN[D]);
    }
  }
  // A skull stencil on the east buttress (the Syndicate tag).
  const skull = ['.GGG.', 'G.G.G', 'GGGGG', '.G.G.'];
  skull.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === 'G') p.set(HC + 27 + i, HC - 2 + j, GREEN_DARK);
  });
  return p;
}

proc(PN_SPRITES.hull, 96, 96, 2, (p, f) => {
  hullBase ??= paintHull();
  p.d.set(hullBase.d);
  // Running lights on the outer ring, alternating between frames.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const on = (i + f) % 2 === 0;
    const x = Math.round(HC - 0.5 + Math.cos(a) * (OUTER1 - 1.5));
    const y = Math.round(HC - 0.5 + Math.sin(a) * (OUTER1 - 1.5));
    p.set(x, y, on ? (i % 4 === 0 ? RED : AMBER) : i % 4 === 0 ? RED_DIM : AMBER_DIM);
  }
});

// ---------------------------------------------------------------------------
// Core, 32×32: the captive magnetar, a blue-white star with violet field
// arcs, inside a gold hex-lattice shield that cracks and falls.

const KC = 16;

function star(p: Paint, f: number, hot: boolean): void {
  const pulse = [0, 1, 2, 1][f % 4] as number;
  const ramp = hot ? HOT : STAR;
  // Violet halo, dithered out to the shield radius.
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - KC, y + 0.5 - KC);
      if (d > 13 || d < 8) continue;
      const k = (13 - d) / 5;
      if (bayer(x, y) < k * 0.6) p.set(x, y, MAG[k > 0.6 ? D : S]);
    }
  }
  p.sphere(KC, KC, 8.6 + pulse * 0.3, ramp, 0.02 + pulse * 0.06);
  const hotR = 2.2 + pulse * 0.7;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - KC + 1.5, y + 0.5 - KC + 1.5);
      if (d < hotR) p.set(x, y, d < hotR - 1 ? c(WHITE) : ramp[H]);
    }
  }
  // Polar field arcs: two loops above and below, crawling with the pulse.
  for (const sy of [-1, 1]) {
    for (let t = 0; t <= 16; t++) {
      const u = (t / 16) * Math.PI;
      const ax = KC + Math.cos(u) * (5 + pulse * 0.5);
      const ay = KC + sy * (8.5 + Math.sin(u) * (4.5 + pulse * 0.6));
      const lit = (t + f * 3) % 6 < 2;
      p.set(ax, ay, lit ? MAG[H] : MAG[L]);
    }
  }
}

function lattice(p: Paint, f: number, broken: number): void {
  const rng = createRng(`pn_mag_core#lattice${f}`);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const ex = x + 0.5 - KC;
      const ey = y + 0.5 - KC;
      const d = Math.hypot(ex, ey);
      if (d > 14.6) continue;
      // Hex lattice lines: three families of parallel lines 60° apart.
      const u = ex * 0.5 + ey * 0.866;
      const v = ex * 0.5 - ey * 0.866;
      const m = (q: number) => Math.abs(((q % 5) + 5) % 5) < 0.9;
      const line = m(ex + 0.3) || m(u + 0.3) || m(v + 0.3);
      const rim = d > 13.4;
      if (!line && !rim) continue;
      if (broken > 0 && rng.next() < broken) continue;
      // Lit from the top-left like everything else.
      const lum = -(ex * LX + ey * LY) / Math.max(1, d);
      const k = rim ? (lum < -0.2 ? H : lum < 0.3 ? L : B) : f % 2 === 0 ? L : B;
      p.set(x, y, GOLD[k] as number);
    }
  }
}

proc(PN_SPRITES.core, 32, 32, 10, (p, f) => {
  if (f < CORE_FRAMES.crack) {
    star(p, f, false);
    lattice(p, f, 0);
  } else if (f < CORE_FRAMES.open) {
    star(p, 2, false);
    lattice(p, f, f === CORE_FRAMES.crack ? 0.35 : 0.7);
  } else if (f < CORE_FRAMES.melt) {
    star(p, f - CORE_FRAMES.open, false);
  } else {
    star(p, (f - CORE_FRAMES.melt) * 2, true);
  }
});

// ---------------------------------------------------------------------------
// Pylon, 18×18: a hex-plated emitter tower topped with a gold focusing crystal.

const PC = 9;

function hexMask(cx: number, cy: number, r: number): Mask {
  return (x, y) => {
    const ex = Math.abs(x + 0.5 - cx);
    const ey = Math.abs(y + 0.5 - cy);
    return ey <= r * 0.87 && ex * 0.87 + ey * 0.5 <= r * 0.87;
  };
}

proc(PN_SPRITES.pylon, 18, 18, 2, (p, f) => {
  p.shape(hexMask(PC, PC, 8.2), GUN);
  p.shape(hexMask(PC, PC, 5.6), RUST);
  for (const [x, y] of [
    [PC - 6, PC],
    [PC + 5, PC],
    [PC - 3, PC - 6],
    [PC + 2, PC + 5],
  ] as const) {
    p.rivet(x, y, GUN);
  }
  // Crystal: a small gold diamond with a blue-white glint.
  const crystal: Mask = (x, y) => Math.abs(x + 0.5 - PC) + Math.abs(y + 0.5 - PC) <= 3.6;
  p.shape(crystal, GOLD, L);
  p.set(PC - 1, PC - 1, f === 0 ? c(WHITE) : STAR[L]);
  p.set(PC, PC, f === 0 ? STAR[L] : GOLD[H]);
  p.set(PC + 3, PC - 4, f === 0 ? GREEN : GREEN_DARK);
});

proc(PN_SPRITES.pylonWreck, 18, 18, 2, (p, f) => {
  const rng = createRng('pn_mag_pylon_wreck');
  const hex = hexMask(PC, PC, 8.2);
  p.shape((x, y) => hex(x, y) && rng.next() > 0.16, GUN, D);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x + 0.5 - PC, y + 0.5 - PC) + Math.sin(Math.atan2(y - PC, x - PC) * 5);
      if (d < 5.5) p.set(x, y, d < 3.5 ? SOOT : RUST[S]);
    }
  }
  for (const [x, y] of [
    [5, 4],
    [12, 5],
    [4, 12],
  ] as const) {
    p.set(x, y, RUST[L]);
    p.set(x + 1, y + 1, RUST[D]);
  }
  p.set(PC, PC, f === 0 ? AMBER : AMBER_DIM);
  p.set(PC - 1, PC + 1, AMBER_DIM);
  if (f === 0) {
    p.set(PC - 2, PC - 2, c(WHITE));
    p.set(PC - 3, PC - 3, SPARK_YELLOW);
  } else {
    p.set(PC + 2, PC - 1, MAG[H]);
    p.set(PC + 3, PC - 2, MAG[L]);
  }
});

// Deflect spark, 5×5: shots pinging off the shield and the hull.
defineProcSprite(
  PN_SPRITES.spark,
  5,
  5,
  (ctx, f) => {
    const p = new Paint(5, 5);
    if (f === 0) {
      p.set(2, 2, c(WHITE));
      for (const [x, y] of [
        [2, 0],
        [2, 1],
        [2, 3],
        [2, 4],
        [0, 2],
        [1, 2],
        [3, 2],
        [4, 2],
      ] as const) {
        p.set(x, y, GOLD[H]);
      }
    } else if (f === 1) {
      p.set(2, 2, GOLD[H]);
      for (const [x, y] of [
        [0, 0],
        [4, 0],
        [0, 4],
        [4, 4],
      ] as const) {
        p.set(x, y, c(WHITE));
      }
    } else {
      p.set(2, 2, AMBER);
    }
    p.flush(ctx);
  },
  { frames: SPARK_FRAMES },
);

/** Colors the boss draw uses for spokes and field lines (15-bit). */
export const PN_COLORS = {
  spoke: snes('#f8f8f8'),
  spokeDim: snes('#a8c0f8'),
  spokeEdge: snes('#5868e8'),
  echoSpoke: snes('#d8c8f8'),
  field: snes('#a080f0'),
  fieldHot: snes('#d8c8f8'),
  fieldDim: snes('#6840b8'),
  rayLine: snes('#f0c030'),
  rayLineDim: snes('#b88010'),
} as const;
