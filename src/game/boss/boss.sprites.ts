// Rock Hauler: a Scrap Syndicate mining barge, nose-down, lit from the
// top-left. Built from separate part sprites (hull, hopper load, clamp
// turrets and their wrecks, iris core, drills) so each part can flash and be
// destroyed on its own. Everything is painted procedurally into an index
// buffer: shapes get automatic bevels, round things get per-pixel sphere
// lighting with ordered dithering, and the rust is weathered from a seeded rng.
import { createRng, type Rng } from '../../engine/rng';
import {
  FX,
  GLOW,
  GUNMETAL,
  OLIVE,
  OUTLINE,
  ROCK,
  snes,
  SYNDICATE,
  WHITE,
} from '../../gfx/palette';
import { defineProcSprite } from '../../gfx/sprite';

export const BOSS_SPRITES = {
  hull: 'boss_rh_hull',
  hopper: 'boss_rh_hopper',
  turret: 'boss_rh_turret',
  barrel: 'boss_rh_barrel',
  wreck: 'boss_rh_turret_wreck',
  core: 'boss_rh_core',
  drill: 'boss_rh_drill',
  chute: 'boss_rh_chute',
  smoke: 'boss_rh_smoke',
  spark: 'boss_rh_spark',
} as const;

export const BOSS_SPRITE_IDS: readonly string[] = Object.values(BOSS_SPRITES);

/** Core frames: 0–1 shut (glow pulse), 2–4 the iris opening, 5–8 open (pulse). */
export const CORE_FRAMES = { shut: 0, opening: 2, open: 5, openCount: 4 } as const;
export const CHUTE_FRAMES = 3;
export const SMOKE_FRAMES = 4;
export const SPARK_FRAMES = 3;

/** Composite layout, px from the boss center. Matches the hull painting below. */
export const BOSS_LAYOUT = {
  hopper: { x: 0, y: -17 },
  drillL: { x: -15, y: 37 },
  drillR: { x: 15, y: 37 },
  chute: { x: 0, y: 26 },
} as const;

// ---------------------------------------------------------------------------
// Colors. Every ramp runs shadow → dark → base → light → highlight.

type Ramp5 = readonly [number, number, number, number, number];

function c(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

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
const GUN: Ramp5 = [
  c(snes('#100c18')),
  c(GUNMETAL.dark),
  c(GUNMETAL.base),
  c(GUNMETAL.light),
  c(GUNMETAL.highlight),
];
const STONE: Ramp5 = [c(ROCK.shadow), c(ROCK.dark), c(ROCK.base), c(ROCK.light), c(ROCK.highlight)];
const GLOWR: Ramp5 = [
  c(snes('#103008')),
  c(GLOW.greenDark),
  c(GLOW.green),
  c(GLOW.greenHot),
  c(WHITE),
];
const INK = c(OUTLINE);
const AMBER = c(GLOW.amber);
const AMBER_DIM = c(snes('#784000'));
const HAZARD_DARK = c(snes('#201810'));
const RED = c(GLOW.red);
const SOOT = c(snes('#181010'));
const SMOKE = c(FX.smoke);
const SMOKE_DARK = c(FX.smokeDark);
const SMOKE_LIGHT = c(snes('#806870'));
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

// Light from the top-left, slightly toward the viewer.
const LX = -0.48;
const LY = -0.56;
const LZ = 0.67;

type Mask = (x: number, y: number) => boolean;

/** An RGB index buffer with painting helpers. -1 is transparent. */
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

  rect(x: number, y: number, w: number, h: number, col: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }

  /** Fills a mask with a bevel: top/left edges lit, bottom/right edges dark. */
  shape(x0: number, y0: number, x1: number, y1: number, inside: Mask, r: Ramp5, base = B): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
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

  /** Sphere-lit disc (cx, cy in pixel-edge coordinates). `bias` brightens or darkens. */
  sphere(cx: number, cy: number, rad: number, r: Ramp5, bias = 0, mask?: Mask): void {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        const nx = (x + 0.5 - cx) / rad;
        const ny = (y + 0.5 - cy) / rad;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1 || (mask && !mask(x, y))) continue;
        const nz = Math.sqrt(1 - d2);
        const lum = nx * LX + ny * LY + nz * LZ;
        this.set(x, y, r[level(lum + bias, x, y)] as number);
      }
    }
  }

  /** Vertical cylinder shading across [x0, x0 + w). */
  cylinder(x0: number, y0: number, w: number, h: number, r: Ramp5, mask?: Mask): void {
    for (let x = x0; x < x0 + w; x++) {
      const nx = ((x + 0.5 - x0) / w) * 2 - 1;
      const lum = nx * LX * 1.3 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.75;
      for (let y = y0; y < y0 + h; y++) {
        if (mask && !mask(x, y)) continue;
        this.set(x, y, r[level(lum, x, y)] as number);
      }
    }
  }

  /** Diagonal hazard stripes over the pixels a mask selects. */
  hazard(x0: number, y0: number, x1: number, y1: number, inside: Mask): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        const on = ((x + y) >> 1) % 2 === 0;
        const edge = !inside(x, y - 1);
        const bottom = !inside(x, y + 1);
        let col = on ? AMBER : HAZARD_DARK;
        if (on && edge) col = c(snes('#f8d060'));
        if (on && bottom) col = AMBER_DIM;
        this.set(x, y, col);
      }
    }
  }

  /** A rivet: a lit head with a shadow below-right. */
  rivet(x: number, y: number, r: Ramp5): void {
    this.set(x, y, r[H] as number);
    this.set(x + 1, y + 1, r[S] as number);
  }

  /** Swaps `from` for `to` at random with probability `p`. */
  speckle(rng: Rng, from: number, to: number, p: number, x0 = 0, y0 = 0, x1 = 1e9, y1 = 1e9): void {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) {
        if (this.get(x, y) === from && rng.next() < p) this.set(x, y, to);
      }
    }
  }

  copyFrom(o: Paint): void {
    this.d.set(o.d);
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

/** Light value → ramp index, dithered across the band edges. */
function level(lum: number, x: number, y: number): number {
  // lum is roughly -0.2 .. 1.0 over a lit sphere.
  const t = (lum + 0.15) / 1.1;
  const k = Math.floor(t * 5 + (bayer(x, y) - 0.5) * 0.7);
  return k < 0 ? 0 : k > 4 ? 4 : k;
}

function proc(
  id: string,
  w: number,
  h: number,
  frames: number,
  paint: (p: Paint, f: number) => void,
  rotations: 0 | 16 = 0,
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
    { frames, outline: OUTLINE, rotations },
  );
}

// ---------------------------------------------------------------------------
// Hull, 96×60. Center (48, 30) is the boss origin. Mirrored geometry uses
// `dx`, the distance from the center line, but every bevel and highlight is
// lit in absolute screen space so the right half stays shaded correctly.

const HW = 96;
const HH = 60;
const CX = 48;
const CORE_Y = 36;

function dx(x: number): number {
  return Math.abs(x + 0.5 - CX);
}

function inRing(x: number, y: number, cx: number, cy: number, r0: number, r1: number): boolean {
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return d >= r0 && d < r1;
}

const deckLimit = (y: number): number => 33 - Math.max(0, 19 - y) - Math.max(0, y - 43) * 1.5;
const inDeck: Mask = (x, y) => y >= 14 && y <= 48 && dx(x) <= deckLimit(y);
const inHopper: Mask = (x, y) => y >= 1 && y <= 24 && dx(x) <= 22 - Math.max(0, 3 - y);
const inWell: Mask = (x, y) => y >= 4 && y <= 21 && dx(x) <= 19;
const inProw: Mask = (x, y) => y >= 46 && y <= 59 && dx(x) <= 25 - (y - 46) * 0.75;
const inUpperJaw: Mask = (x, y) => {
  const d = dx(x);
  if (y >= 25 && y <= 30 && d >= 27 && d <= 46.5) return true;
  // Claw tip hooking down toward the turret.
  return y > 30 && y <= 34 && d >= 41 + (y - 30) && d <= 47.5;
};
const inLowerJaw: Mask = (x, y) => {
  const d = dx(x);
  if (y >= 50 && y <= 55 && d >= 25 && d <= 46.5) return true;
  return y >= 46 && y < 50 && d >= 41 + (50 - y) && d <= 47.5;
};
const inShoulderPlate: Mask = (x, y) => y >= 20 && y <= 28 && dx(x) >= 20 && dx(x) <= 31;

let hullBase: Paint | null = null;

function paintHullBase(): Paint {
  const p = new Paint(HW, HH);
  const rng = createRng('boss_rh_hull#weather');
  const all = (m: Mask) => p.shape(0, 0, HW - 1, HH - 1, m, GUN);

  // Clamp jaws sit behind the deck; truss holes lighten the girders.
  all(inUpperJaw);
  all(inLowerJaw);
  for (let x = 0; x < HW; x++) {
    const d = dx(x);
    if (d < 29 || d > 43) continue;
    if (Math.floor(d) % 4 === 0) {
      p.set(x, 27, GUN[S]);
      p.set(x, 28, GUN[D]);
      p.set(x, 52, GUN[S]);
      p.set(x, 53, GUN[D]);
    }
  }

  // Engine pods: cylinders with dark nozzle caps.
  for (const x0 of [CX - 34, CX + 22]) {
    p.cylinder(x0, 4, 12, 17, GUN);
    p.rect(x0 + 1, 2, 10, 2, GUN[S]);
    p.rect(x0 + 2, 1, 8, 1, GUN[D]);
    for (let y = 8; y <= 18; y += 5) {
      for (let i = 0; i < 12; i++) p.set(x0 + i, y, GUN[D]);
      for (let i = 1; i < 11; i++) p.set(x0 + i, y + 1, GUN[L]);
    }
  }

  // Deck: rusted plate with chamfered corners.
  p.shape(0, 0, HW - 1, HH - 1, inDeck, RUST);
  p.shape(0, 0, HW - 1, HH - 1, inShoulderPlate, OLV);
  for (let x = 0; x < HW; x++) {
    if (!inShoulderPlate(x, 23) || !inShoulderPlate(x, 22)) continue;
    p.set(x, 23, OLV[D]);
    p.set(x, 24, OLV[L]);
  }

  // Seams and rivets on the visible deck strip beside the core socket.
  for (const sx of [CX - 21, CX + 20]) {
    for (let y = 29; y <= 45; y++) {
      p.set(sx, y, RUST[D]);
      p.set(sx + 1, y, RUST[L]);
    }
    for (let y = 30; y <= 44; y += 4) p.rivet(sx - 3, y, RUST);
  }
  for (let x = 0; x < HW; x++) {
    const d = dx(x);
    if (d >= 17 && d <= 31 && Math.floor(d) % 3 === 0) p.rivet(x, 16, RUST);
  }

  // Hopper: an olive bin with a dark well and a hazard-striped front lip.
  p.shape(0, 0, HW - 1, HH - 1, inHopper, OLV);
  for (let y = 4; y <= 21; y++) {
    for (let x = 0; x < HW; x++) {
      if (!inWell(x, y)) continue;
      let col = SOOT;
      if (y <= 5 || !inWell(x - 1, y)) col = INK;
      else if (y === 21 || !inWell(x + 1, y)) col = OLV[D];
      p.set(x, y, col);
    }
  }
  p.hazard(0, 22, HW - 1, 24, (x, y) => inHopper(x, y) && y >= 22 && dx(x) <= 20);
  for (const [x, y] of [
    [CX - 21, 2],
    [CX + 20, 2],
    [CX - 21, 20],
    [CX + 20, 20],
  ] as const) {
    p.rivet(x, y, GUN);
  }

  // Core socket: a recessed bowl (lit from inside its far wall) with a raised lip.
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      const ex = x + 0.5 - CX;
      const ey = y + 0.5 - CORE_Y;
      const dist = Math.hypot(ex, ey);
      if (dist >= 16.5 || dist < 11.5) {
        if (dist >= 16.5 && dist < 17.6) {
          const lum = (ex * LX + ey * LY) / dist;
          p.set(x, y, GUN[lum > 0.3 ? H : lum > -0.3 ? L : D] as number);
        }
        continue;
      }
      const lum = -(ex * LX + ey * LY) / dist;
      p.set(x, y, GUN[level(lum * 0.7 + 0.25, x, y)] as number);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    p.rivet(
      Math.round(CX - 0.5 + Math.cos(a) * 14.5),
      Math.round(CORE_Y - 0.5 + Math.sin(a) * 14.5),
      GUN,
    );
  }

  // Prow: heavy gunmetal plating, hazard band, drill hubs and the rock chute.
  p.shape(0, 0, HW - 1, HH - 1, (x, y) => inProw(x, y) && !inRing(x, y, CX, CORE_Y, 0, 17.6), GUN);
  p.hazard(0, 53, HW - 1, 55, (x, y) => inProw(x, y) && y >= 53 && y <= 55 && dx(x) >= 7);
  for (const hx of [CX - 15, CX + 15]) p.sphere(hx, 56, 4.5, GUN, 0.05);
  p.shape(0, 0, HW - 1, HH - 1, (x, y) => y >= 51 && y <= 59 && dx(x) <= 7, GUN, L);
  p.rect(CX - 5, 53, 10, 7, INK);
  for (let x = CX - 5; x < CX + 5; x++) p.set(x, 53, GUN[S]);

  // Weathering: rust speckle, chipped paint, grime streaks, scorch.
  p.speckle(rng, RUST[B], RUST[D], 0.1);
  p.speckle(rng, RUST[B], RUST[L], 0.025);
  p.speckle(rng, OLV[B], RUST[D], 0.06);
  p.speckle(rng, OLV[B], OLV[D], 0.06);
  p.speckle(rng, GUN[B], GUN[D], 0.05);
  for (let i = 0; i < 16; i++) {
    const x = rng.int(CX - 32, CX + 31);
    const y = rng.int(15, 40);
    const len = rng.int(2, 5);
    for (let k = 0; k < len; k++) {
      const cur = p.get(x, y + k);
      if (cur === RUST[B] || cur === RUST[L]) p.set(x, y + k, RUST[D]);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.int(CX - 30, CX + 26);
    const y = rng.int(16, 44);
    for (let k = 0; k < 6; k++) {
      const sx = x + rng.int(0, 3);
      const sy = y + rng.int(0, 2);
      if (inDeck(sx, sy)) p.set(sx, sy, k < 2 ? RUST[S] : SOOT);
    }
  }

  // Asymmetric touches: a Syndicate skull stencil on the right shoulder plate,
  // and a mast with a warning beacon on the left pod.
  const skull = ['.GGG.', 'G.G.G', 'GGGGG', '.G.G.'];
  skull.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === 'G') p.set(CX + 23 + i, 21 + j, c(GLOW.greenDark));
  });
  for (let y = 0; y < 5; y++) p.set(CX - 27, y, GUN[y === 0 ? H : L]);
  return p;
}

proc(BOSS_SPRITES.hull, HW, HH, 2, (p, f) => {
  hullBase ??= paintHullBase();
  p.copyFrom(hullBase);
  // Nozzle glow and running lights alternate between frames.
  for (const x0 of [CX - 34, CX + 22]) {
    for (let i = 3; i < 9; i++) p.set(x0 + i, 2, GLOWR[f === 0 ? L : B] as number);
    p.set(x0 + 5, 2, GLOWR[f === 0 ? H : L] as number);
    p.set(x0 + 6, 2, GLOWR[f === 0 ? H : L] as number);
  }
  p.set(CX - 27, 0, f === 0 ? RED : c(snes('#601010')));
  p.set(CX - 32, 20, f === 0 ? AMBER : AMBER_DIM);
  p.set(CX + 31, 20, f === 0 ? AMBER_DIM : AMBER);
  // The chute mouth breathes faint green.
  for (let x = CX - 4; x < CX + 4; x++) p.set(x, 59, GLOWR[f === 0 ? D : S] as number);
});

// ---------------------------------------------------------------------------
// Hopper load, 38×18: a heap of lit rocks with glowing Syndicate ore.

const HOPPER_ROCKS: readonly (readonly [number, number, number])[] = [
  [6, 4, 4.5],
  [15, 3, 4],
  [24, 4, 5],
  [33, 4, 4],
  [10, 9, 5],
  [20, 10, 5.5],
  [30, 10, 5],
  [4, 13, 4],
  [14, 14, 4.5],
  [25, 15, 4],
  [34, 14, 3.5],
];

proc(BOSS_SPRITES.hopper, 38, 18, 1, (p) => {
  for (const [x, y, r] of HOPPER_ROCKS) {
    p.sphere(x + 0.5, y + 0.5, r + 0.6, [INK, INK, INK, INK, INK]);
    p.sphere(x, y, r, STONE);
  }
  // Ore veins glinting through the heap.
  for (const [x, y] of [
    [18, 7],
    [29, 13],
    [8, 12],
    [26, 2],
  ] as const) {
    p.set(x, y, GLOWR[B]);
    p.set(x + 1, y, GLOWR[H]);
    p.set(x, y + 1, GLOWR[D]);
  }
});

// ---------------------------------------------------------------------------
// Clamp turret, 22×22: a rust dome in a bolted collar, with a visor slit.

const TC = 11;

function paintCollar(p: Paint, broken: boolean, rng?: Rng): void {
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      const ex = x + 0.5 - TC;
      const ey = y + 0.5 - TC;
      const d = Math.hypot(ex, ey);
      if (d < 8 || d >= 10.8) continue;
      if (broken && rng && rng.next() < 0.18) continue;
      const lum = (ex * LX + ey * LY) / d;
      const k = d >= 10 ? (lum > 0.25 ? L : lum > -0.35 ? B : S) : lum > 0.25 ? B : D;
      p.set(x, y, GUN[k] as number);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.rivet(Math.round(TC - 0.5 + Math.cos(a) * 9), Math.round(TC - 0.5 + Math.sin(a) * 9), GUN);
  }
}

proc(BOSS_SPRITES.turret, 22, 22, 2, (p, f) => {
  paintCollar(p, false);
  p.sphere(TC, TC, 7.6, RUST, 0.04);
  // Armor band and visor with the sickly green eye.
  for (let x = 5; x < 17; x++) {
    if (p.get(x, 13) < 0) continue;
    p.set(x, 13, INK);
    p.set(x, 14, x < 9 ? RUST[D] : RUST[S]);
  }
  p.set(9, 13, GLOWR[f === 0 ? B : L]);
  p.set(10, 13, GLOWR[f === 0 ? H : B]);
  p.set(11, 13, GLOWR[f === 0 ? H : B]);
  p.set(12, 13, GLOWR[f === 0 ? B : L]);
  p.set(8, 7, RUST[H]);
});

// Twin cannon, 40×40, points straight down from the center; baked at 16 angles.
proc(
  BOSS_SPRITES.barrel,
  40,
  40,
  1,
  (p) => {
    for (const bx of [17, 21]) {
      for (let y = 20; y < 38; y++) {
        p.set(bx, y, GUN[y > 31 ? H : L]);
        p.set(bx + 1, y, GUN[y > 31 ? B : D]);
      }
      // Cooling rings, then a flared muzzle with a dark bore.
      for (const ry of [33, 30]) {
        p.set(bx - 1, ry, GUN[B]);
        p.set(bx, ry, GUN[H]);
        p.set(bx + 1, ry, GUN[L]);
        p.set(bx + 2, ry, GUN[D]);
      }
      p.set(bx - 1, 36, GUN[L]);
      p.set(bx, 36, c(WHITE));
      p.set(bx + 1, 36, GUN[H]);
      p.set(bx + 2, 36, GUN[B]);
      p.set(bx, 37, GUN[S]);
      p.set(bx + 1, 37, INK);
    }
    p.rect(19, 22, 2, 10, GUN[S]);
  },
  16,
);

// Wreck, 22×22: the dome blown open, torn plates, a live wire spitting sparks.
proc(BOSS_SPRITES.wreck, 22, 22, 2, (p, f) => {
  const rng = createRng('boss_rh_wreck');
  paintCollar(p, true, rng);
  for (let y = 3; y < 19; y++) {
    for (let x = 3; x < 19; x++) {
      const ex = x + 0.5 - TC;
      const ey = y + 0.5 - TC;
      const d = Math.hypot(ex, ey) + Math.sin(Math.atan2(ey, ex) * 5) * 1.2;
      if (d > 7.5) continue;
      p.set(x, y, d > 6.2 ? RUST[D] : d > 4.5 ? RUST[S] : SOOT);
    }
  }
  // Jagged shards curling outward.
  for (const [x, y] of [
    [5, 6],
    [6, 5],
    [15, 5],
    [16, 7],
    [4, 13],
    [14, 16],
  ] as const) {
    p.set(x, y, RUST[L]);
    p.set(x + 1, y + 1, RUST[B]);
  }
  // A bent barrel stub.
  for (let k = 0; k < 5; k++) {
    p.set(12 + (k >> 1), 13 + k, GUN[L]);
    p.set(13 + (k >> 1), 13 + k, GUN[D]);
  }
  // Glowing slag and the sparking wire.
  p.set(10, 10, f === 0 ? AMBER : AMBER_DIM);
  p.set(9, 11, AMBER_DIM);
  if (f === 0) {
    p.set(8, 8, c(WHITE));
    p.set(7, 7, SPARK_YELLOW);
  } else {
    p.set(12, 9, c(WHITE));
    p.set(13, 8, SPARK_YELLOW);
    p.set(11, 9, AMBER);
  }
});

// ---------------------------------------------------------------------------
// Core, 28×28: a green reactor orb behind a four-petal iris.

const KC = 14;
const CORE_OUTER = 12.5;

function coreGeometry(f: number): { gap: number; hole: number; pulse: number } {
  if (f < CORE_FRAMES.opening) return { gap: 1.2, hole: 0, pulse: f };
  if (f < CORE_FRAMES.open) {
    const k = f - CORE_FRAMES.opening + 1;
    return { gap: 1.2 + k * 2.4, hole: k * 3.2, pulse: 1 };
  }
  const k = f - CORE_FRAMES.open;
  return { gap: 9, hole: 10.2, pulse: [0, 1, 2, 1][k] as number };
}

proc(BOSS_SPRITES.core, 28, 28, CORE_FRAMES.open + CORE_FRAMES.openCount, (p, f) => {
  const g = coreGeometry(f);
  const open = f >= CORE_FRAMES.open;
  // Reactor orb: hot center that swells with the pulse.
  p.sphere(KC, KC, 10.6, GLOWR, 0.15 + g.pulse * 0.08);
  const hot = 2 + g.pulse + (open ? 1 : 0);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const d = Math.hypot(x + 0.5 - KC + 1.5, y + 0.5 - KC + 1.5);
      if (d < hot) p.set(x, y, d < hot - 1.2 ? c(WHITE) : GLOWR[H]);
    }
  }
  if (open) {
    // Energy crawling around the orb rim.
    const k = f - CORE_FRAMES.open;
    for (let i = 0; i < 3; i++) {
      const a = (k / 4) * Math.PI * 2 + (i * Math.PI * 2) / 3;
      p.set(
        Math.round(KC - 0.5 + Math.cos(a) * 8),
        Math.round(KC - 0.5 + Math.sin(a) * 8),
        GLOWR[H],
      );
    }
  }
  // Iris petals: olive armor on an X of seams, opening radially.
  const petal: Mask = (x, y) => {
    const ex = x + 0.5 - KC;
    const ey = y + 0.5 - KC;
    const d = Math.hypot(ex, ey);
    if (d > CORE_OUTER || d < g.hole) return false;
    const u = Math.abs(ex + ey) * Math.SQRT1_2;
    const v = Math.abs(ex - ey) * Math.SQRT1_2;
    return u >= g.gap / 2 && v >= g.gap / 2;
  };
  p.sphere(KC, KC, CORE_OUTER, OLV, -0.02, petal);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      if (!petal(x, y)) continue;
      // Dark lip where a petal meets its seam (depth), lit lip on the far side.
      if (!petal(x + 1, y + 1)) p.set(x, y, OLV[S]);
      else if (!petal(x - 1, y - 1) && Math.hypot(x + 0.5 - KC, y + 0.5 - KC) < CORE_OUTER - 1)
        p.set(x, y, OLV[L]);
    }
  }
  // Hazard ticks and a rivet on each petal.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rr = open ? 11.4 : 8.5;
    const x = Math.round(KC - 0.5 + Math.cos(a) * rr);
    const y = Math.round(KC - 0.5 + Math.sin(a) * rr);
    if (petal(x, y)) p.rivet(x, y, OLV);
    const hx = Math.round(KC - 0.5 + Math.cos(a) * 11.6);
    const hy = Math.round(KC - 0.5 + Math.sin(a) * 11.6);
    if (petal(hx, hy)) p.set(hx, hy, AMBER);
  }
});

// ---------------------------------------------------------------------------
// Drill, 12×24: a collar and a fluted cone; the flutes shift a step per frame.

proc(BOSS_SPRITES.drill, 12, 24, 2, (p, f) => {
  p.cylinder(0, 0, 12, 4, GUN);
  for (let x = 0; x < 12; x++) p.set(x, 3, GUN[S]);
  p.hazard(0, 1, 11, 2, () => true);
  for (let y = 4; y < 24; y++) {
    const hw = 5.6 - (y - 4) * (4.9 / 19);
    for (let x = 0; x < 12; x++) {
      const nx = (x + 0.5 - 6) / hw;
      if (Math.abs(nx) > 1) continue;
      const lum = nx * LX * 1.3 + Math.sqrt(1 - nx * nx) * 0.75;
      let k = level(lum, x, y);
      if ((((y + Math.round(nx * 3) + f * 2) % 4) + 4) % 4 === 0) k = Math.max(0, k - 2);
      p.set(x, y, GUN[k] as number);
    }
  }
  p.set(5, 23, GUN[H]);
  p.set(6, 23, GUN[L]);
});

// Chute glow, 12×8: the mouth lighting up before a throw.
proc(BOSS_SPRITES.chute, 12, 8, CHUTE_FRAMES, (p, f) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      const ex = (x + 0.5 - 6) / 6;
      const ey = (y + 0.5 - 8) / 7;
      const d = Math.hypot(ex, ey);
      if (d > 1) continue;
      const k = Math.floor((1 - d) * (2 + f) + bayer(x, y) * 0.8);
      if (k <= 0) continue;
      p.set(x, y, GLOWR[Math.min(H, k)] as number);
    }
  }
});

// Smoke puff, 8×8: grows and thins out over its four frames.
defineProcSprite(
  BOSS_SPRITES.smoke,
  8,
  8,
  (ctx, f) => {
    const p = new Paint(8, 8);
    const rad = 1.6 + f * 0.75;
    const keep = 1 - f * 0.22;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ex = x + 0.5 - 4;
        const ey = y + 0.5 - 4;
        const d = Math.hypot(ex, ey);
        if (d > rad || bayer(x, y) > keep) continue;
        const lit = ex + ey < -1;
        p.set(x, y, lit ? SMOKE_LIGHT : d > rad - 1 ? SMOKE_DARK : SMOKE);
      }
    }
    p.flush(ctx);
  },
  { frames: SMOKE_FRAMES },
);

// Deflect spark, 5×5: shots pinging off armor.
defineProcSprite(
  BOSS_SPRITES.spark,
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
        p.set(x, y, SPARK_YELLOW);
      }
    } else if (f === 1) {
      p.set(2, 2, SPARK_YELLOW);
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
