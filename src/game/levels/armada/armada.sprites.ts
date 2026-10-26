// The Armada (T30): Syndicate fleet sprites, lit from the top-left, nose-down
// unless noted. Small fighters are string grids like the Level 1 roster;
// ships and hull parts are painted procedurally (paint.ts) in the Rock
// Hauler's style. The dreadnought's deck is one 240×780 painting cut into
// six segment sprites, so the hull costs six drawImage calls a frame.
import { createRng } from '../../../engine/rng';
import { EBULLET, GLOW, GUNMETAL, OLIVE, OUTLINE, SYNDICATE } from '../../../gfx/palette';
import { defineSprite, gridRows } from '../../../gfx/sprite';
import { LEVIATHAN, LEVIATHAN_PARTS } from '../../../content/levels/armada';
import {
  AMBER,
  AMBER_DIM,
  B,
  bayer,
  D,
  FLAME,
  FLAME_DARK,
  FLAME_HOT,
  GLOWR,
  GUN,
  H,
  INK,
  ION,
  L,
  level,
  LX,
  LY,
  OLV,
  Paint,
  proc,
  RED,
  RED_DIM,
  RUST,
  S,
  SMOKE,
  SMOKE_DARK,
  SMOKE_LIGHT,
  SOOT,
  SPARK_YELLOW,
  STEEL,
  WHITE_I,
  type Mask,
  type Ramp5,
} from './paint';

export const AR_SPRITES = {
  escort: 'ar_escort',
  minelayer: 'ar_minelayer',
  mine: 'ar_mine',
  missile: 'ar_missile',
  frigate: 'ar_frigate',
  frigateWreck: 'ar_frigate_wreck',
  frigateTurret: 'ar_frigate_turret',
  frigateBarrel: 'ar_frigate_barrel',
  frigateGlow: 'ar_frigate_glow',
  flak: 'ar_lev_flak',
  deck: 'ar_lev_deck',
  barrelSingle: 'ar_lev_barrel_s',
  barrelTwin: 'ar_lev_barrel_t',
  armor: 'ar_lev_armor',
  bay: 'ar_lev_bay',
  gen: 'ar_lev_gen',
  gun: 'ar_lev_gun',
  bridge: 'ar_lev_bridge',
  bridgeWreck: 'ar_lev_bridge_wreck',
  core: 'ar_lev_core',
  wreck: 'ar_lev_wreck',
  plume: 'ar_lev_plume',
  smoke: 'ar_smoke',
  spark: 'ar_spark',
} as const;

/** Deck segments, bow first: segment k covers depths [k·SEG_H, (k+1)·SEG_H). */
export const HULL_SEGMENTS = 6;
export const SEG_H = Math.ceil(LEVIATHAN.length / HULL_SEGMENTS);
export function hullSegmentId(k: number): string {
  return `ar_lev_hull_${k}`;
}

/** Bay frames: 0 shut, 1 cracking, 2 open with warheads, 3 open and empty. */
export const BAY_FRAMES = { shut: 0, cracking: 1, armed: 2, empty: 3 } as const;
/** Mine frames: 0 dim, 1 lit, 2 red warning, 3 white (armed). */
export const MINE_FRAMES = { dim: 0, lit: 1, warn: 2, armed: 3 } as const;
export const GEN_FRAMES = 4;
export const SMOKE_FRAMES = 4;
export const SPARK_FRAMES = 3;
export const GLOW_FRAMES = 3;

export const AR_SPRITE_IDS: readonly string[] = [
  ...Object.values(AR_SPRITES),
  ...Array.from({ length: HULL_SEGMENTS }, (_, k) => hullSegmentId(k)),
];

// ---------------------------------------------------------------------------
// Escort Fighter 16×16: forward-swept gunmetal wings, a rust fuselage, twin
// tail fins and a green canopy. Left half, mirrored.

const GRID_PAL = {
  o: OUTLINE,
  s: SYNDICATE.shadow,
  d: SYNDICATE.dark,
  r: SYNDICATE.base,
  l: SYNDICATE.light,
  h: SYNDICATE.highlight,
  v: OLIVE.dark,
  e: OLIVE.base,
  k: GUNMETAL.dark,
  m: GUNMETAL.base,
  n: GUNMETAL.light,
  w: GUNMETAL.highlight,
  g: GLOW.greenDark,
  G: GLOW.green,
  H: GLOW.greenHot,
  a: GLOW.amber,
  y: EBULLET.core,
};

const ESCORT = `
  ...o...a
  ..owo.od
  ..onkodr
  o.omkodr
  wo.okdrl
  nwookdrl
  mnwkkdrh
  omnmkdrh
  .omnkdrl
  ..oomdrl
  ....oddG
  ....odGH
  ....odgG
  .....odr
  ......od
  .......o
`;

function frames(base: string, swaps: Record<number, string>): string[] {
  const rows = gridRows(base);
  return [rows.join('\n'), rows.map((r, i) => swaps[i] ?? r).join('\n')];
}

defineSprite(AR_SPRITES.escort, {
  palette: GRID_PAL,
  mirrorX: true,
  frames: frames(ESCORT, { 0: '...o...y', 11: '....odHG', 12: '....odGH' }),
});

// ---------------------------------------------------------------------------
// Minelayer 26×22: an olive barge with a mine drum amidships and two
// thruster pods; the drum turns and the drop chute blinks.

proc(AR_SPRITES.minelayer, 26, 22, 2, (p, f) => {
  const hull: Mask = (x, y) => {
    const ex = (x + 0.5 - 13) / 10.5;
    const ey = (y + 0.5 - 11) / 10;
    return ex * ex + ey * ey <= 1 && y >= 2;
  };
  p.shape(0, 0, 25, 21, hull, OLV);
  // Rust deck bands and a hazard nose.
  for (let y = 4; y < 19; y++) {
    for (let x = 6; x < 20; x++) {
      if (!hull(x, y) || !hull(x - 1, y) || !hull(x + 1, y)) continue;
      if (y === 6 || y === 15) p.set(x, y, RUST[D]);
    }
  }
  p.hazard(10, 18, 15, 19, (x, y) => hull(x, y) && hull(x, y + 1));
  // Thruster pods.
  for (const x0 of [0, 21]) {
    p.cylinder(x0, 5, 5, 11, GUN);
    p.set(x0 + 1, 4, GUN[L]);
    p.set(x0 + 2, 4, GUN[H]);
    p.set(x0 + 3, 4, GUN[B]);
    p.set(x0 + 1, 16, f === 0 ? FLAME : FLAME_HOT);
    p.set(x0 + 2, 16, f === 0 ? FLAME_HOT : FLAME);
    p.set(x0 + 3, 16, FLAME_DARK);
  }
  // The mine drum: a horizontal cylinder with spiked mines showing.
  p.hcylinder(7, 7, 12, 8, GUN);
  for (let i = 0; i < 3; i++) {
    const mx = 9 + i * 4 + (f === 0 ? 0 : 2);
    if (mx > 17) continue;
    p.sphere(mx, 11, 1.8, RUST);
    p.set(mx, 9, GUN[H]);
  }
  for (let x = 7; x < 19; x++) p.set(x, 15, GUN[S]);
  // Cockpit glow, the bow lamp.
  p.set(12, 3, GLOWR[f === 0 ? H : B]);
  p.set(13, 3, GLOWR[f === 0 ? B : H]);
  p.set(12, 20, f === 0 ? RED : RED_DIM);
  p.set(13, 20, f === 0 ? RED_DIM : RED);
});

// ---------------------------------------------------------------------------
// Ion Mine 12×12: a spiked gunmetal ball with a lamp. The behavior picks the
// frame (dim/lit blink, red warning, white when armed).

proc(AR_SPRITES.mine, 12, 12, 4, (p, f) => {
  const spikes: readonly (readonly [number, number])[] = [
    [5, 0],
    [6, 0],
    [0, 5],
    [0, 6],
    [11, 5],
    [11, 6],
    [5, 11],
    [6, 11],
    [1, 1],
    [10, 1],
    [1, 10],
    [10, 10],
  ];
  for (const [x, y] of spikes) p.set(x, y, x + y < 11 ? GUN[L] : GUN[D]);
  for (const [x, y] of [
    [5, 1],
    [6, 1],
    [1, 5],
    [1, 6],
    [10, 5],
    [10, 6],
    [5, 10],
    [6, 10],
  ] as const) {
    p.set(x, y, GUN[B]);
  }
  p.sphere(6, 6, 4.4, GUN);
  const lamp = [GLOWR[D], GLOWR[H], RED, WHITE_I][f] as number;
  const rim = [GLOWR[S], GLOWR[B], RED_DIM, GLOWR[H]][f] as number;
  p.set(5, 5, lamp);
  p.set(6, 5, lamp);
  p.set(5, 6, lamp);
  p.set(6, 6, rim);
  if (f >= 1) p.set(4, 4, f === 2 ? RED : GLOWR[H]);
});

// ---------------------------------------------------------------------------
// Homing missile 6×14, pointing up (baked at 16 angles): a rust warhead,
// gunmetal body, swept fins and a flickering motor.

proc(
  AR_SPRITES.missile,
  6,
  14,
  2,
  (p, f) => {
    p.cylinder(1, 2, 4, 8, GUN);
    p.set(2, 1, RUST[H]);
    p.set(3, 1, RUST[B]);
    p.set(2, 0, RED);
    p.set(3, 0, RED_DIM);
    p.set(1, 2, RUST[L]);
    p.set(2, 2, RUST[H]);
    p.set(3, 2, RUST[B]);
    p.set(4, 2, RUST[D]);
    p.set(1, 3, RUST[B]);
    p.set(4, 3, RUST[S]);
    // Fins.
    p.set(0, 8, GUN[L]);
    p.set(0, 9, GUN[B]);
    p.set(5, 8, GUN[D]);
    p.set(5, 9, GUN[S]);
    // Motor.
    p.set(2, 10, f === 0 ? FLAME_HOT : FLAME);
    p.set(3, 10, FLAME);
    p.set(2, 11, f === 0 ? FLAME : FLAME_DARK);
    p.set(3, 11, f === 0 ? FLAME_DARK : FLAME_HOT);
    if (f === 1) p.set(2, 12, FLAME_DARK);
    if (f === 0) p.set(3, 12, FLAME_DARK);
  },
  16,
);

// ---------------------------------------------------------------------------
// Frigate 84×30, side-on to its course: drawn heading right (bow at right),
// flipped heading left. Gunmetal hull, rust deck, bridge tower forward, the
// reactor hatch amidships where the ring fires from.

export const FRIGATE_W = 84;
export const FRIGATE_H = 30;
const FCX = 42;
const FCY = 15;

function frigateHalf(x: number): number {
  if (x < 3 || x > 83) return -1;
  if (x < 8) return 9 + (x - 3) * 0.5;
  if (x > 64) return 12 - ((x - 64) / 19) ** 1.6 * 11;
  return 12;
}

const inFrigate: Mask = (x, y) => {
  const hw = frigateHalf(x + 0.5);
  return hw > 0 && Math.abs(y + 0.5 - FCY) <= hw;
};

let frigateBase: Paint | null = null;

function paintFrigateBase(): Paint {
  const p = new Paint(FRIGATE_W, FRIGATE_H);
  const rng = createRng('ar_frigate#weather');
  p.shape(0, 0, FRIGATE_W - 1, FRIGATE_H - 1, inFrigate, GUN);
  // Side curvature: the top flank lit, the bottom flank in shadow.
  for (let x = 0; x < FRIGATE_W; x++) {
    for (let y = 0; y < FRIGATE_H; y++) {
      if (!inFrigate(x, y) || !inFrigate(x, y - 1) || !inFrigate(x, y + 1)) continue;
      const hw = frigateHalf(x + 0.5);
      const ny = (y + 0.5 - FCY) / hw;
      if (ny < -0.62) p.set(x, y, GUN[L]);
      else if (ny > 0.62) p.set(x, y, GUN[D]);
    }
  }
  // Rust deck strip with panel seams and rivets.
  const deck: Mask = (x, y) =>
    x >= 9 && x <= 70 && Math.abs(y + 0.5 - FCY) <= 6.5 && inFrigate(x, y);
  p.shape(9, 8, 70, 22, deck, RUST);
  for (let x = 14; x < 70; x += 8) {
    for (let y = 9; y < 22; y++) if (deck(x, y) && deck(x, y - 1)) p.set(x, y, RUST[S]);
    p.rivet(x + 2, 10, RUST);
  }
  p.speckle(rng, RUST[B], RUST[D], 0.12);
  p.speckle(rng, GUN[B], GUN[S], 0.05);
  // Turret sockets.
  for (const sx of [25, 57]) {
    for (let y = 4; y < 17; y++) {
      for (let x = sx - 7; x <= sx + 7; x++) {
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - 10);
        if (d >= 5.5 && d < 7) p.set(x, y, (x + y) % 3 === 0 ? AMBER : GUN[S]);
        else if (d < 5.5) p.set(x, y, GUN[S]);
      }
    }
  }
  // Bridge tower near the bow.
  p.box(62, 11, 9, 9, GUN, L);
  p.box(64, 12, 5, 7, RUST);
  for (let y = 13; y < 18; y++) p.set(69, y, GLOWR[B]);
  // Engines at the stern.
  for (const ey of [9, 18]) {
    p.hcylinder(0, ey, 6, 4, GUN);
    p.set(0, ey + 1, SOOT);
    p.set(0, ey + 2, SOOT);
  }
  // Prow hazard chevrons.
  p.hazard(74, 11, 79, 19, (x, y) => inFrigate(x, y) && inFrigate(x + 2, y));
  return p;
}

function paintReactor(p: Paint, open: number): void {
  for (let y = FCY - 5; y <= FCY + 5; y++) {
    for (let x = FCX - 5; x <= FCX + 5; x++) {
      const d = Math.hypot(x + 0.5 - FCX, y + 0.5 - FCY);
      if (d > 5) continue;
      if (d > 4) p.set(x, y, GUN[x + y < FCX + FCY ? L : S]);
      else p.set(x, y, d < open ? GLOWR[d < open - 1.5 ? H : B] : GUN[D]);
    }
  }
}

proc(AR_SPRITES.frigate, FRIGATE_W, FRIGATE_H, 2, (p, f) => {
  frigateBase ??= paintFrigateBase();
  p.copyFrom(frigateBase);
  paintReactor(p, f === 0 ? 1.5 : 2.2);
  // Engine glow and running lights.
  for (const ey of [9, 18]) {
    p.set(0, ey + 1, f === 0 ? FLAME_HOT : FLAME);
    p.set(0, ey + 2, f === 0 ? FLAME : FLAME_HOT);
  }
  p.set(30, 4, f === 0 ? RED : RED_DIM);
  p.set(50, 25, f === 0 ? GLOWR[B] : GLOWR[H]);
  p.set(80, 15, f === 0 ? WHITE_I : AMBER);
});

proc(AR_SPRITES.frigateWreck, FRIGATE_W, FRIGATE_H, 2, (p, f) => {
  frigateBase ??= paintFrigateBase();
  p.copyFrom(frigateBase);
  const rng = createRng('ar_frigate#wreck');
  // Broken back: the keel snaps amidships, plates scorched to soot.
  for (let y = 0; y < FRIGATE_H; y++) {
    for (let x = 0; x < FRIGATE_W; x++) {
      if (p.get(x, y) < 0) continue;
      const crack = Math.abs(x - FCX - Math.sin(y * 0.9) * 2) < 2.5;
      if (crack) {
        p.set(x, y, -1);
        continue;
      }
      const burn = Math.hypot((x - FCX) * 0.6, y - FCY) < 13 + Math.sin(x * 0.7 + y) * 3;
      if (burn) p.set(x, y, rng.next() < 0.5 ? SOOT : GUN[S]);
    }
  }
  // Fires along the break.
  for (let i = 0; i < 9; i++) {
    const x = FCX - 8 + ((i * 7) % 17);
    const y = 6 + ((i * 5) % 18);
    if (p.get(x, y) < 0) continue;
    const hot = (i + f) % 2 === 0;
    p.set(x, y, hot ? FLAME_HOT : FLAME);
    p.set(x, y - 1, hot ? FLAME : FLAME_DARK);
  }
});

// Frigate turret 12×12: a rust dome in a gunmetal collar with a green slit.
proc(AR_SPRITES.frigateTurret, 12, 12, 2, (p, f) => {
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 6);
      if (d < 5.9 && d >= 4.6) p.set(x, y, GUN[x + y < 11 ? L : D]);
    }
  }
  p.sphere(6, 6, 4.4, RUST, 0.05);
  p.set(4, 7, INK);
  p.set(5, 7, GLOWR[f === 0 ? H : B]);
  p.set(6, 7, GLOWR[f === 0 ? B : H]);
  p.set(7, 7, INK);
});

/** A single barrel on a center pivot, pointing down; baked at 16 angles. */
function paintBarrel(p: Paint, cx: number, len: number, twin: boolean): void {
  const xs = twin ? [cx - 2, cx + 1] : [cx - 1];
  for (const bx of xs) {
    for (let y = cx + 1; y < cx + len; y++) {
      p.set(bx, y, GUN[y > cx + len - 4 ? H : L]);
      p.set(bx + 1, y, GUN[y > cx + len - 4 ? B : D]);
    }
    p.set(bx - 1, cx + len - 3, GUN[B]);
    p.set(bx + 2, cx + len - 3, GUN[D]);
    p.set(bx, cx + len - 1, GUN[S]);
    p.set(bx + 1, cx + len - 1, INK);
  }
}

proc(AR_SPRITES.frigateBarrel, 22, 22, 1, (p) => paintBarrel(p, 11, 9, false), 16);
proc(AR_SPRITES.barrelSingle, 28, 28, 1, (p) => paintBarrel(p, 14, 12, false), 16);
proc(AR_SPRITES.barrelTwin, 38, 38, 1, (p) => paintBarrel(p, 19, 17, true), 16);

// Reactor flare 14×14: the frigate's ring telegraph, brightening over 3 frames.
proc(
  AR_SPRITES.frigateGlow,
  14,
  14,
  GLOW_FRAMES,
  (p, f) => {
    const rad = 3.5 + f * 1.6;
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x + 0.5 - 7, y + 0.5 - 7);
        if (d > rad) continue;
        const k = Math.floor((1 - d / rad) * (2 + f) + bayer(x, y) * 0.9);
        if (k <= 0) continue;
        p.set(x, y, GLOWR[Math.min(H, k + 1)] as number);
      }
    }
  },
  0,
  false,
);

// ---------------------------------------------------------------------------
// Dreadnought hull: a 240×780 deck painting. Depth d runs from the bow tip
// (d 0, the bottom) to the stern (d 780, the top); row Y = 780 − d.

const LEN = LEVIATHAN.length;
const HCX = 120;

function depthOf(kind: string): number {
  const s = LEVIATHAN_PARTS.find((p) => p.kind === kind);
  return s === undefined ? -999 : -s.oy;
}
const BAY_D = depthOf('bay');
const GEN_D = depthOf('gen');

function bump(d: number, c: number, half: number, amt: number): number {
  const k = (half - Math.abs(d - c)) / 7;
  return k <= 0 ? 0 : amt * Math.min(1, k);
}

/** Hull half-width at depth d (an ogive bow, sponsons, a tapered stern), or -1 outside. */
export function hullHalfWidth(d: number): number {
  if (d < 0 || d > LEN) return -1;
  let hw: number;
  if (d < 170) {
    const k = d / 170;
    hw = 6 + 98 * (1 - (1 - k) * (1 - k));
  } else if (d > 735) hw = 104 - (d - 735) * 0.55;
  else hw = 104;
  return hw + bump(d, BAY_D, 30, 10) + bump(d, GEN_D, 34, 13) + bump(d, 239, 52, 4);
}

function inHull(x: number, Y: number): boolean {
  const hw = hullHalfWidth(LEN - Y - 0.5);
  return hw > 0 && Math.abs(x + 0.5 - HCX) <= hw;
}

/** Cheap seeded value noise in [0, 1). */
function makeNoise(seed: string, cell: number): (x: number, y: number) => number {
  const rng = createRng(seed);
  const N = 64;
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const at = (i: number, j: number) => g[(((j % N) + N) % N) * N + (((i % N) + N) % N)] as number;
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * su;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * su;
    return a + (b - a) * sv;
  };
}

interface Socket {
  x: number;
  Y: number;
  r: number;
}

/** Ion conduit path from a generator to the bridge (deck grooves; the live glow is drawn on top). */
export function conduitPath(genX: number): { x0: number; d0: number; d1: number; x1: number } {
  return { x0: genX, d0: GEN_D, d1: GEN_D + 40, x1: genX < HCX ? HCX - 14 : HCX + 14 };
}

let hullPaint: Paint | null = null;

function paintHull(): Paint {
  const p = new Paint(240, LEN);
  const rng = createRng('ar_lev_hull#weather');
  const rustN = makeNoise('ar_lev_hull#rust', 14);
  const grimeN = makeNoise('ar_lev_hull#grime', 6);

  const sockets: Socket[] = [];
  for (const s of LEVIATHAN_PARTS) {
    if (s.kind === 'armor' || s.kind === 'core' || s.kind === 'bridge') continue;
    sockets.push({ x: HCX + s.ox, Y: LEN + s.oy, r: s.r + 3 });
  }

  for (let Y = 0; Y < LEN; Y++) {
    const d = LEN - Y - 0.5;
    const hw = hullHalfWidth(d);
    for (let x = 0; x < 240; x++) {
      const dx = x + 0.5 - HCX;
      const ax = Math.abs(dx);
      if (hw <= 0 || ax > hw) continue;
      const edge = hw - ax;
      // Rim armor: lit on the left flank, shadowed on the right.
      if (edge < 1) {
        p.set(x, Y, INK);
        continue;
      }
      if (edge < 5) {
        const lit = dx < 0;
        p.set(x, Y, STEEL[edge < 2.5 ? (lit ? H : S) : lit ? L : D] as number);
        continue;
      }
      // Panel grid: seams every 22 rows, columns staggered by row.
      const row = Math.floor(Y / 22);
      const colW = 26;
      const cx = x + (row % 2) * 13;
      const sy = Y % 22;
      const sx = cx % colW;
      let k = B;
      if (sy === 0 || sx === 0) k = S;
      else if (sy === 1 || sx === 1) k = L;
      else if (sy === 21 || sx === colW - 1) k = D;
      // Curvature: flanks a step darker on the right, lighter on the left.
      if (edge < 16 && k === B) k = dx < 0 ? L : D;
      let col = STEEL[k] as number;
      // Grime and Syndicate rust.
      // Rust stays dark (shadow/dark steps) so the pink enemy bullets keep their contrast.
      const rn = rustN(x, Y) + (edge < 20 ? 0.12 : 0) - 0.1;
      if (rn > 0.66 && k !== S) {
        const t = (rn - 0.66) * 6 + (bayer(x, Y) - 0.5) * 0.8;
        col = (t > 0.5 ? RUST[S] : k === L ? RUST[D] : STEEL[D]) as number;
        if (t > 0.5 && k === L) col = RUST[D];
      } else if (grimeN(x, Y) > 0.78 && k === B) col = STEEL[D];
      p.set(x, Y, col);
    }
  }

  // Rivets along the seams.
  for (let Y = 0; Y < LEN; Y += 22) {
    for (let x = 4; x < 236; x += 6)
      if (inHull(x, Y + 2) && inHull(x + 2, Y + 2)) p.rivet(x, Y + 2, STEEL);
  }

  // Rust streaks running toward the bow from the rivet lines.
  for (let i = 0; i < 130; i++) {
    const x = rng.int(6, 233);
    const Y = rng.int(0, LEN - 12);
    const len = rng.int(3, 11);
    for (let j = 0; j < len; j++) {
      if (!inHull(x, Y + j) || p.get(x, Y + j) === INK) break;
      p.set(x, Y + j, j === 0 ? RUST[D] : j < len / 2 ? RUST[S] : STEEL[S]);
    }
  }

  // Side trenches with pipe runs.
  for (let Y = 60; Y < LEN - 40; Y++) {
    const d = LEN - Y;
    if (d < 150) continue;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = HCX + side * 62 + i * side;
        if (!inHull(x, Y)) continue;
        // Recessed gutter with a pipe lit from the left.
        const px = side < 0 ? 8 - i : i;
        if (px < 2 || px > 6 || Y % 30 === 0) p.set(x, Y, STEEL[S]);
        else p.set(x, Y, GUN[[H, L, B, D, S][px - 2] as number] as number);
      }
    }
  }

  // Raised spine walkway from the bow deck to the bridge.
  for (let Y = LEN - 640; Y < LEN - 130; Y++) {
    for (let x = HCX - 13; x < HCX + 13; x++) {
      const i = x - (HCX - 13);
      let k = B;
      if (i === 0) k = H;
      else if (i === 1) k = L;
      else if (i === 25) k = S;
      else if (i === 24) k = D;
      else if (Y % 10 === 0) k = D;
      else if (Y % 10 === 1) k = L;
      p.set(x, Y, (i >= 9 && i <= 16 && k === B ? GUN[B] : STEEL[k]) as number);
    }
  }

  // Hazard bands across the deck: behind the bow and ahead of the bridge.
  for (const d0 of [134, 612]) {
    const hw = hullHalfWidth(d0);
    p.hazard(Math.ceil(HCX - hw + 6), LEN - d0 - 6, Math.floor(HCX + hw - 7), LEN - d0, (x, Y) => {
      const e = hullHalfWidth(LEN - Y - 0.5) - Math.abs(x + 0.5 - HCX);
      return e > 6 && Math.abs(x + 0.5 - HCX) > 14;
    });
  }

  // The Syndicate mark on the bow: a rust ring with a slash through it.
  const ex = HCX;
  const eY = LEN - 44;
  for (let Y = eY - 16; Y <= eY + 16; Y++) {
    for (let x = ex - 16; x <= ex + 16; x++) {
      const r = Math.hypot(x + 0.5 - ex, Y + 0.5 - eY);
      const slash = Math.abs(x + 0.5 - ex - (Y + 0.5 - eY)) < 2.6 && r < 12;
      if ((r >= 9.5 && r < 13) || slash) {
        const lit = x + Y < ex + eY;
        p.set(x, Y, (r >= 12 ? RUST[S] : lit ? RUST[L] : RUST[B]) as number);
      }
    }
  }

  // Turret sockets: a recessed ring with amber ticks.
  for (const s of sockets) {
    for (let Y = Math.floor(s.Y - s.r - 2); Y <= s.Y + s.r + 2; Y++) {
      for (let x = Math.floor(s.x - s.r - 2); x <= s.x + s.r + 2; x++) {
        const dd = Math.hypot(x + 0.5 - s.x, Y + 0.5 - s.Y);
        if (dd > s.r + 1.5) continue;
        if (dd > s.r) {
          const a = Math.atan2(Y + 0.5 - s.Y, x + 0.5 - s.x);
          const tick = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 3 === 0;
          p.set(x, Y, tick ? AMBER : STEEL[S]);
        } else {
          // A pit: the lower-right rim catches the light (inverse bevel).
          const lit = x + 0.5 - s.x + (Y + 0.5 - s.Y) > s.r * 0.9;
          p.set(x, Y, lit ? STEEL[B] : dd > s.r - 2 ? STEEL[S] : GUN[S]);
        }
      }
    }
  }

  // Missile bay pits.
  for (const s of LEVIATHAN_PARTS) {
    if (s.kind !== 'bay') continue;
    const x0 = HCX + s.ox - 15;
    const Y0 = LEN + s.oy - 15;
    p.shape(x0, Y0, x0 + 29, Y0 + 29, () => true, STEEL, D);
    p.hazard(x0 + 2, Y0 + 2, x0 + 27, Y0 + 3, () => true);
    p.hazard(x0 + 2, Y0 + 26, x0 + 27, Y0 + 27, () => true);
  }

  // Conduit grooves from each generator to the bridge.
  for (const s of LEVIATHAN_PARTS) {
    if (s.kind !== 'gen') continue;
    const c = conduitPath(HCX + s.ox);
    for (let d = c.d0 + 12; d <= c.d1; d++) {
      const Y = LEN - d;
      p.set(c.x0 - 1, Y, STEEL[S]);
      p.set(c.x0, Y, ION[S]);
      p.set(c.x0 + 1, Y, STEEL[L]);
    }
    const lo = Math.min(c.x0, c.x1);
    const hi = Math.max(c.x0, c.x1);
    for (let x = lo; x <= hi; x++) {
      p.set(x, LEN - c.d1 - 1, STEEL[S]);
      p.set(x, LEN - c.d1, ION[S]);
      p.set(x, LEN - c.d1 + 1, STEEL[L]);
    }
    // Generator pad.
    const gy = LEN + s.oy;
    const gx = HCX + s.ox;
    for (let Y = gy - 15; Y <= gy + 15; Y++) {
      for (let x = gx - 15; x <= gx + 15; x++) {
        const dd = Math.hypot(x + 0.5 - gx, Y + 0.5 - gy);
        if (dd < 15 && dd >= 13) p.set(x, Y, (x + Y) % 4 < 2 ? ION[D] : STEEL[S]);
      }
    }
  }

  // Bridge landing pad: a dark apron with a light ring.
  {
    const by = LEN - 690;
    for (let Y = by - 34; Y <= by + 34; Y++) {
      for (let x = HCX - 44; x <= HCX + 44; x++) {
        const dd = Math.hypot((x + 0.5 - HCX) * 0.85, Y + 0.5 - by);
        if (dd > 36) continue;
        if (dd > 34) p.set(x, Y, STEEL[S]);
        else if (dd > 33) p.set(x, Y, STEEL[L]);
        else p.set(x, Y, (Math.floor(dd) % 6 === 0 ? STEEL[S] : GUN[D]) as number);
      }
    }
  }

  // Stern engine bank: four nozzles opening upward.
  for (const ox of [-72, -30, 30, 72]) {
    const nx = HCX + ox;
    for (let Y = 0; Y < 24; Y++) {
      for (let x = nx - 13; x <= nx + 13; x++) {
        if (!inHull(x, Y)) continue;
        const ux = (x + 0.5 - nx) / 12;
        if (Math.abs(ux) > 1) continue;
        if (Y < 3) p.set(x, Y, INK);
        else if (Y < 18) {
          const lum = ux * LX * 1.4 + Math.sqrt(Math.max(0, 1 - ux * ux)) * 0.7;
          p.set(x, Y, GUN[level(lum, x, Y)] as number);
        } else p.set(x, Y, Y === 18 ? GUN[S] : STEEL[D]);
      }
      if (Y >= 3 && Y < 8) for (let x = nx - 8; x <= nx + 8; x++) p.set(x, Y, SOOT);
    }
  }
  return p;
}

/** Running lights along the rim every 48 px; they alternate per frame. */
function paintLights(p: Paint, k: number, f: number): void {
  for (let d = 24; d < LEN; d += 48) {
    const hw = hullHalfWidth(d);
    const ly = (k + 1) * SEG_H - d;
    if (hw < 20 || ly < 0 || ly >= SEG_H) continue;
    const on = (Math.floor(d / 48) + f) % 2 === 0;
    p.set(Math.round(HCX - hw + 3), ly, on ? RED : RED_DIM);
    p.set(Math.round(HCX + hw - 4), ly, on ? GLOWR[H] : GLOWR[D]);
  }
}

for (let k = 0; k < HULL_SEGMENTS; k++) {
  proc(
    hullSegmentId(k),
    240,
    SEG_H,
    2,
    (p, f) => {
      hullPaint ??= paintHull();
      // Segment k holds rows [LEN − (k+1)·SEG_H, LEN − k·SEG_H) of the painting.
      const top = LEN - (k + 1) * SEG_H;
      for (let y = 0; y < SEG_H; y++) {
        const Y = top + y;
        if (Y < 0 || Y >= LEN) continue;
        for (let x = 0; x < 240; x++) {
          const col = hullPaint.get(x, Y);
          if (col >= 0) p.set(x, y, col);
        }
      }
      paintLights(p, k, f);
    },
    0,
    false,
  );
}

// ---------------------------------------------------------------------------
// Hull parts.

function collar(p: Paint, cx: number, cy: number, r0: number, r1: number, ramp: Ramp5): void {
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
    for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
      const ex = x + 0.5 - cx;
      const ey = y + 0.5 - cy;
      const dd = Math.hypot(ex, ey);
      if (dd < r0 || dd >= r1) continue;
      const lum = (ex * LX + ey * LY) / dd;
      p.set(x, y, ramp[lum > 0.3 ? L : lum > -0.3 ? B : D] as number);
    }
  }
}

// Flak turret 16×16: a rust dome on a steel collar, green visor slit.
proc(AR_SPRITES.flak, 16, 16, 2, (p, f) => {
  collar(p, 8, 8, 5.4, 7.6, STEEL);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.rivet(Math.round(7.5 + Math.cos(a) * 6.5), Math.round(7.5 + Math.sin(a) * 6.5), STEEL);
  }
  p.sphere(8, 8, 5.2, RUST, 0.05);
  for (let x = 5; x < 11; x++) p.set(x, 9, INK);
  p.set(7, 9, GLOWR[f === 0 ? H : B]);
  p.set(8, 9, GLOWR[f === 0 ? B : H]);
});

// Deck turret 20×20: a heavy square mount, olive armor dome, hazard corners.
proc(AR_SPRITES.deck, 20, 20, 2, (p, f) => {
  const mount: Mask = (x, y) => {
    const ex = Math.abs(x + 0.5 - 10);
    const ey = Math.abs(y + 0.5 - 10);
    return ex <= 9.5 && ey <= 9.5 && ex + ey <= 15.5;
  };
  p.shape(0, 0, 19, 19, mount, STEEL);
  p.hazard(0, 0, 19, 19, (x, y) => {
    const ex = Math.abs(x + 0.5 - 10);
    const ey = Math.abs(y + 0.5 - 10);
    return mount(x, y) && ex + ey > 12.5 && ex + ey <= 14.5;
  });
  p.sphere(10, 10, 6.8, OLV, 0.02);
  for (let x = 5; x < 15; x++) {
    if (p.get(x, 12) < 0) continue;
    p.set(x, 12, INK);
    p.set(x, 13, OLV[S]);
  }
  p.set(8, 12, GLOWR[f === 0 ? B : H]);
  p.set(9, 12, GLOWR[f === 0 ? H : B]);
  p.set(10, 12, GLOWR[f === 0 ? H : B]);
  p.set(11, 12, GLOWR[f === 0 ? B : H]);
  p.rivet(6, 6, OLV);
  p.rivet(13, 6, OLV);
});

// Armor plate 26×16: a raised slab with chamfered ends and hazard edging.
proc(AR_SPRITES.armor, 26, 16, 1, (p) => {
  const slab: Mask = (x, y) => {
    const ex = Math.abs(x + 0.5 - 13);
    return ex <= 12.5 && y >= 1 && y <= 14 && ex + Math.abs(y + 0.5 - 8) * 0.6 <= 15;
  };
  p.shape(0, 0, 25, 15, slab, GUN, B);
  for (let x = 3; x < 23; x++) {
    if (!slab(x, 4)) continue;
    p.set(x, 4, GUN[S]);
    p.set(x, 5, GUN[L]);
  }
  p.hazard(2, 11, 23, 12, (x, y) => slab(x, y) && slab(x, y + 2));
  for (const x of [4, 12, 20]) p.rivet(x, 7, GUN);
});

// Missile bay 26×26: two hazard-striped doors that slide apart; warheads inside.
proc(AR_SPRITES.bay, 26, 26, 4, (p, f) => {
  p.box(0, 0, 26, 26, STEEL, D);
  for (let y = 3; y < 23; y++) for (let x = 3; x < 23; x++) p.set(x, y, SOOT);
  if (f === BAY_FRAMES.armed) {
    for (const mx of [9, 16]) {
      p.cylinder(mx - 2, 7, 4, 13, GUN);
      p.set(mx - 1, 6, RED);
      p.set(mx, 6, RED_DIM);
      p.set(mx - 1, 7, RUST[H]);
      p.set(mx, 7, RUST[B]);
    }
  }
  const gap = [0, 2, 9, 9][f] as number;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 3 : 13 + Math.ceil(gap / 2);
    const x1 = side < 0 ? 12 - Math.floor(gap / 2) : 22;
    if (x1 < x0) continue;
    p.shape(x0, 3, x1, 22, (x, y) => x >= x0 && x <= x1 && y >= 3 && y <= 22, GUN);
    p.hazard(x0, 18, x1, 20, (x) => x >= x0 + 1 && x <= x1 - 1);
  }
  // Launch lamps: amber while cracking, red when armed.
  const lamp = f === BAY_FRAMES.cracking ? AMBER : f === BAY_FRAMES.armed ? RED : RED_DIM;
  p.set(1, 1, lamp);
  p.set(24, 1, lamp);
  p.set(1, 24, lamp);
  p.set(24, 24, lamp);
});

// Shield generator 22×22: a pylon cradling an ion orb; the orb pulses.
proc(AR_SPRITES.gen, 22, 22, GEN_FRAMES, (p, f) => {
  collar(p, 11, 11, 7.5, 10.6, STEEL);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.round(10.5 + Math.cos(a) * 8.6);
    const y = Math.round(10.5 + Math.sin(a) * 8.6);
    p.box(x - 1, y - 1, 3, 3, RUST);
  }
  const pulse = [0, 1, 2, 1][f] as number;
  p.sphere(11, 11, 6.4, ION, 0.05 + pulse * 0.08);
  const hot = 1.6 + pulse * 0.7;
  for (let y = 4; y < 18; y++) {
    for (let x = 4; x < 18; x++) {
      const dd = Math.hypot(x + 0.5 - 9.8, y + 0.5 - 9.8);
      if (dd < hot) p.set(x, y, dd < hot - 1 ? WHITE_I : ION[H]);
    }
  }
  // Arcs crawling around the orb.
  for (let i = 0; i < 2; i++) {
    const a = (f / GEN_FRAMES) * Math.PI * 2 + i * Math.PI;
    p.set(Math.round(10.5 + Math.cos(a) * 7.4), Math.round(10.5 + Math.sin(a) * 7.4), ION[H]);
  }
});

// Bridge gun 14×14: a compact rust turret.
proc(AR_SPRITES.gun, 14, 14, 2, (p, f) => {
  collar(p, 7, 7, 4.6, 6.8, GUN);
  p.sphere(7, 7, 4.6, RUST, 0.06);
  p.set(5, 8, INK);
  p.set(6, 8, GLOWR[f === 0 ? H : B]);
  p.set(7, 8, GLOWR[f === 0 ? B : H]);
  p.set(8, 8, INK);
});

// Bridge 64×56: the command tower, stepped gunmetal decks with rust trim, a
// green window band, antenna mast and a radar dish that turns between frames.

const BW = 64;
const BHT = 56;

function paintBridge(p: Paint, f: number): void {
  const tier = (hw: number, y0: number, y1: number, ramp: Ramp5) => {
    const m: Mask = (x, y) =>
      y >= y0 && y <= y1 && Math.abs(x + 0.5 - 32) <= hw - Math.max(0, y0 + 2 - y);
    p.shape(0, 0, BW - 1, BHT - 1, m, ramp);
  };
  tier(31, 14, 52, STEEL);
  tier(24, 8, 46, GUN);
  tier(17, 4, 38, RUST);
  tier(10, 1, 26, GUN);
  // Window bands.
  for (const [y, hw] of [
    [30, 22],
    [20, 15],
  ] as const) {
    for (let x = 32 - hw + 2; x < 32 + hw - 2; x++) {
      const on = (x + f * 3) % 7 !== 0;
      p.set(x, y, on ? GLOWR[x < 32 ? H : B] : GLOWR[D]);
      p.set(x, y + 1, INK);
    }
  }
  // Rust trim and rivets on the lower deck.
  for (let x = 4; x < 60; x++) if (p.get(x, 48) >= 0) p.set(x, 48, RUST[D]);
  for (let x = 6; x < 58; x += 6) p.rivet(x, 44, STEEL);
  // Mast and radar dish.
  for (let y = 0; y < 14; y++) p.set(32, y, GUN[y < 3 ? H : L]);
  p.set(32, 0, f === 0 ? RED : RED_DIM);
  const dishX = f === 0 ? 22 : 40;
  p.sphere(dishX, 9, 3.6, STEEL, 0.1);
  p.set(dishX, 9, INK);
  // Exhaust stacks either side.
  for (const sx of [10, 52]) {
    p.cylinder(sx - 3, 18, 6, 10, GUN);
    p.rect(sx - 1, 18, 2, 2, SOOT);
  }
}

proc(AR_SPRITES.bridge, BW, BHT, 2, (p, f) => paintBridge(p, f));

proc(AR_SPRITES.bridgeWreck, BW, BHT, 2, (p, f) => {
  paintBridge(p, 1);
  const rng = createRng('ar_lev_bridge#wreck');
  // The core bay torn open, the upper tiers scorched and holed.
  for (let y = 0; y < BHT; y++) {
    for (let x = 0; x < BW; x++) {
      if (p.get(x, y) < 0) continue;
      const dd = Math.hypot(x + 0.5 - 32, (y + 0.5 - 26) * 1.2);
      if (dd < 9 + Math.sin(x * 1.3) * 1.5) p.set(x, y, dd < 6 ? INK : SOOT);
      else if (dd < 20 && rng.next() < 0.45) p.set(x, y, rng.next() < 0.5 ? SOOT : RUST[S]);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = 18 + ((i * 11) % 28);
    const y = 12 + ((i * 7) % 30);
    if (p.get(x, y) < 0) continue;
    const hot = (i + f) % 2 === 0;
    p.set(x, y, hot ? FLAME_HOT : FLAME);
    p.set(x, y - 1, hot ? FLAME : FLAME_DARK);
    if (hot) p.set(x + 1, y - 1, FLAME_DARK);
  }
});

// Escape core 26×30: a rust command pod with a green reactor eye and four
// thrusters at the stern (top) that flare between frames.
proc(AR_SPRITES.core, 26, 30, 2, (p, f) => {
  const pod: Mask = (x, y) => {
    const ex = (x + 0.5 - 13) / 10.5;
    const ey = (y + 0.5 - 16) / 12.5;
    return ex * ex + ey * ey <= 1;
  };
  p.sphere(13, 16, 12, RUST, 0, pod);
  for (let y = 4; y < 29; y++) {
    for (let x = 2; x < 24; x++) {
      if (!pod(x, y)) continue;
      if (y === 10 || y === 22) p.set(x, y, RUST[S]);
    }
  }
  p.sphere(13, 17, 5.2, GLOWR, 0.12 + f * 0.08);
  collar(p, 13, 17, 5.2, 6.6, GUN);
  p.set(11, 15, WHITE_I);
  for (const tx of [5, 10, 16, 21]) {
    p.cylinder(tx - 2, 1, 4, 5, GUN);
    p.set(tx - 1, 0, f === 0 ? FLAME_HOT : FLAME);
    p.set(tx, 0, f === 0 ? FLAME : FLAME_HOT);
  }
  p.rivet(8, 25, RUST);
  p.rivet(17, 25, RUST);
});

// Wreck 22×22: a blown socket, torn plates and slag, a wire spitting sparks.
proc(AR_SPRITES.wreck, 22, 22, 2, (p, f) => {
  const rng = createRng('ar_lev_wreck');
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      const ex = x + 0.5 - 11;
      const ey = y + 0.5 - 11;
      const dd = Math.hypot(ex, ey) + Math.sin(Math.atan2(ey, ex) * 5) * 1.3;
      if (dd > 9.5) continue;
      if (dd > 7.5) {
        if (rng.next() < 0.25) continue;
        p.set(x, y, ex + ey < 0 ? RUST[L] : RUST[D]);
      } else p.set(x, y, dd > 5.5 ? RUST[S] : dd > 3 ? SOOT : INK);
    }
  }
  p.set(10, 10, f === 0 ? AMBER : AMBER_DIM);
  p.set(11, 11, AMBER_DIM);
  p.set(f === 0 ? 8 : 13, f === 0 ? 8 : 9, WHITE_I);
  p.set(f === 0 ? 7 : 14, f === 0 ? 7 : 8, SPARK_YELLOW);
});

// Engine plume 20×18: a stern exhaust flame (drawn above the hull, pointing up).
proc(
  AR_SPRITES.plume,
  20,
  18,
  2,
  (p, f) => {
    for (let y = 0; y < 18; y++) {
      const hw = (y / 17) * 8 + (f === 0 ? 0.5 : 0) - (y < 3 ? 0 : 0);
      for (let x = 0; x < 20; x++) {
        const ex = Math.abs(x + 0.5 - 10);
        if (ex > hw) continue;
        const t = 1 - ex / Math.max(1, hw);
        const k = (y / 17) * 1.4 + t * 1.2 + (bayer(x, y + f) - 0.5) * 0.5;
        if (k < 0.45) continue;
        p.set(x, y, k > 1.9 ? FLAME_HOT : k > 1.3 ? FLAME : FLAME_DARK);
      }
    }
  },
  0,
  false,
);

// Smoke puff 8×8: grows and thins over four frames.
proc(
  AR_SPRITES.smoke,
  8,
  8,
  SMOKE_FRAMES,
  (p, f) => {
    const rad = 1.6 + f * 0.75;
    const keep = 1 - f * 0.22;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ex = x + 0.5 - 4;
        const ey = y + 0.5 - 4;
        const dd = Math.hypot(ex, ey);
        if (dd > rad || bayer(x, y) > keep) continue;
        p.set(x, y, ex + ey < -1 ? SMOKE_LIGHT : dd > rad - 1 ? SMOKE_DARK : SMOKE);
      }
    }
  },
  0,
  false,
);

// Deflect spark 5×5: shots pinging off armor.
proc(
  AR_SPRITES.spark,
  5,
  5,
  SPARK_FRAMES,
  (p, f) => {
    if (f === 0) {
      p.set(2, 2, WHITE_I);
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
        p.set(x, y, WHITE_I);
      }
    } else p.set(2, 2, AMBER);
  },
  0,
  false,
);
