// Corona Drift art: Syndicate sail-tech that works the star's light. Gunmetal
// and rust hulls as ever, with sun-gold sails and mirror faces (silver-blue
// glass that whitens when it focuses). Every ship flies nose-down, lit from
// the top-left; the Heliostat is a truss of mirror arms around a furnace.
import { FX, GILT, GLOW, GUNMETAL, OUTLINE, SYNDICATE, snes } from '../../../gfx/palette';
import { B, c, D, H, L, proc, ramp, S, type Paint, type Ramp5 } from './paint';

export const CO_SPRITES = {
  skimmer: 'co_sunskimmer',
  shade: 'co_shade',
  lens: 'co_lens',
  hull: 'co_helio_hull',
  core: 'co_helio_core',
  mirror: 'co_helio_mirror',
  mirrorWreck: 'co_helio_mirror_wreck',
  glint: 'co_helio_glint',
  spark: 'co_helio_spark',
} as const;

export const CO_SPRITE_IDS: readonly string[] = Object.values(CO_SPRITES);

/** Skimmer frames: 0–1 sail shimmer, 2–3 sail blazing (a burn). */
export const SKIMMER_FRAMES = { idle: 0, burn: 2 } as const;
/** Lens frames: 0–1 idle, 2 telegraph, 3 beam. */
export const LENS_FRAMES = { idle: 0, charge: 2, beam: 3 } as const;
/** Core frames: 0–1 shuttered, 2–3 exposed, 4–5 Solar Furnace. */
export const CORE_FRAMES = { shut: 0, open: 2, furnace: 4 } as const;
/** Mirror frames: 0–1 idle glint, 2 telegraph, 3 beaming. */
export const MIRROR_FRAMES = { idle: 0, charge: 2, beam: 3 } as const;
export const GLINT_FRAMES = 3;
export const SPARK_FRAMES = 3;

/** Line colors: telegraphs run red → amber → white, never the enemy-bullet magenta. */
export const CO_COLORS = {
  line: snes('#f8a800'),
  lineDim: snes('#a04010'),
  lineHot: snes('#f8f0c0'),
  arm: snes('#585870'),
  armDark: snes('#282838'),
  armLight: snes('#9898b0'),
  joint: snes('#c88818'),
} as const;

// ---------------------------------------------------------------------------
// Ramps

const GUN5 = ramp('#100c18', GUNMETAL.dark, GUNMETAL.base, GUNMETAL.light, GUNMETAL.highlight);
const RUST5 = ramp(
  SYNDICATE.shadow,
  SYNDICATE.dark,
  SYNDICATE.base,
  SYNDICATE.light,
  SYNDICATE.highlight,
);
const GOLD5 = ramp('#382000', GILT.dark, GILT.base, GILT.light, GILT.highlight);
/** Mirror glass: silver-blue, its highlight white. */
const GLASS5 = ramp('#182040', '#385888', '#7898c8', '#b8d0f0', '#f8f8f8');
/** Glass focusing sunlight: amber to white. */
const HOTGLASS5 = ramp('#683010', '#c06010', '#f8a800', '#f8e070', '#f8f8f8');
/** The Shade: soot-violet, a hull painted to vanish in shadow. */
const DUSK5 = ramp('#080610', '#181428', '#302848', '#504870', '#8070a0');
const FURNACE5: Ramp5 = ramp('#481000', FX.red, FX.orange, FX.yellow, '#f8f8f8');
const INK = c(OUTLINE);
const WHITE = c('#f8f8f8');
const GREEN = c(GLOW.green);
const GREEN_HOT = c(GLOW.greenHot);
const AMBER = c(GLOW.amber);
const CYAN = c('#58d8f8');
const CYAN_DIM = c('#186888');
const SOOT = c('#181010');

// ---------------------------------------------------------------------------
// Sunskimmer 16×16: a needle hull under a diamond sun-sail. Painted nose-down
// and pre-baked at 16 rotations: it is drawn turned to its heading.

function paintSkimmer(p: Paint, f: number): void {
  const burn = f >= 2;
  const sail = burn ? HOTGLASS5 : GOLD5;
  const cx = 7.5;
  // The sail: a diamond, lit along its top-left edges, with spars.
  p.shape(
    (x, y) => {
      const dx = Math.abs(x + 0.5 - cx);
      const dy = Math.abs(y + 0.5 - 6.5);
      return dx / 7.6 + dy / 5.6 <= 1;
    },
    sail,
    burn ? L : B,
  );
  const shimmer = (f & 1) === 0 ? 0 : 1;
  for (let x = 2; x <= 13; x++) if ((x + shimmer) % 3 === 0) p.set(x, 6, sail[H] as number);
  for (let y = 2; y <= 11; y++) p.set(7, y, sail[D] as number);
  p.set(8, 6, sail[D] as number);
  // Hull spine running through the sail to a nose at the bottom.
  for (let y = 3; y <= 14; y++) {
    p.set(7, y, GUN5[y < 8 ? L : B] as number);
    p.set(8, y, GUN5[y < 8 ? B : D] as number);
  }
  p.set(7, 15, GUN5[H] as number);
  p.set(8, 15, GUN5[D] as number);
  // Rust gondola and a green cockpit eye.
  p.set(6, 10, RUST5[L] as number);
  p.set(9, 10, RUST5[D] as number);
  p.set(6, 11, RUST5[B] as number);
  p.set(9, 11, RUST5[S] as number);
  p.set(7, 12, burn ? GREEN_HOT : GREEN);
  p.set(8, 12, GREEN);
  // Sail tips catch the light.
  p.set(0, 6, sail[H] as number);
  p.set(15, 6, sail[L] as number);
}

proc(CO_SPRITES.skimmer, 16, 16, 4, paintSkimmer, OUTLINE, 16);

// ---------------------------------------------------------------------------
// Shade 20×18: a soot-violet hunter with folded vanes, built to sit in the
// dark. A cold cyan eye; vanes edged with dull rust.

function paintShade(p: Paint, f: number): void {
  const cx = 9.5;
  // Body: a blunt teardrop, nose down.
  p.shape((x, y) => {
    const nx = (x + 0.5 - cx) / 5.2;
    const ny = (y + 0.5 - 8) / 8.2;
    return nx * nx + ny * ny <= 1 && y >= 1;
  }, DUSK5);
  // Folded vanes either side, angled back.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = Math.round(cx + s * (5 + i * 0.7)) - (s < 0 ? 1 : 0);
      const y0 = 3 + i;
      for (let y = y0; y <= y0 + 4 - Math.floor(i / 2); y++) {
        const k = y === y0 ? (s < 0 ? H : L) : y === y0 + 1 ? B : D;
        p.set(x, y, DUSK5[k] as number);
      }
      p.set(x, y0 + 5 - Math.floor(i / 2), RUST5[i & 1 ? D : B] as number);
    }
  }
  // Heat-sink ribs along the back.
  for (let y = 3; y <= 9; y += 2) {
    p.set(8, y, DUSK5[L] as number);
    p.set(11, y, DUSK5[D] as number);
  }
  // The eye: a cyan slit that brightens on the second frame.
  const hot = (f & 1) === 1;
  p.set(9, 12, hot ? WHITE : CYAN);
  p.set(10, 12, CYAN);
  p.set(8, 12, CYAN_DIM);
  p.set(11, 12, CYAN_DIM);
  p.set(9, 13, CYAN_DIM);
  p.set(10, 13, hot ? CYAN : CYAN_DIM);
  // Gun snouts.
  p.set(7, 15, GUN5[L] as number);
  p.set(12, 15, GUN5[D] as number);
  p.set(7, 16, GUN5[B] as number);
  p.set(12, 16, GUN5[S] as number);
}

proc(CO_SPRITES.shade, 20, 18, 2, paintShade);

// ---------------------------------------------------------------------------
// Lens Drone 22×22: a big glass lens held in four gold petals on a gunmetal
// ring. It whitens as it focuses the burn into a beam.

function paintLens(p: Paint, f: number): void {
  const cx = 11;
  const cy = 11;
  // Four petal-mirrors at the diagonals.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const px = cx + Math.cos(a) * 7.6;
    const py = cy + Math.sin(a) * 7.6;
    p.sphere(px, py, 3.2, 3.2, f >= 2 ? HOTGLASS5 : GOLD5, 0.1);
  }
  p.torus(cx, cy, 7, 7, 2.2, GUN5);
  // Cardinal struts.
  for (const [x, y] of [
    [cx - 1, 1],
    [cx - 1, 19],
    [1, cy - 1],
    [19, cy - 1],
  ] as const) {
    p.set(x, y, GUN5[L] as number);
    p.set(x + 1, y, GUN5[B] as number);
    p.set(x, y + 1, GUN5[D] as number);
    p.set(x + 1, y + 1, GUN5[S] as number);
  }
  const glass = f >= 2 ? HOTGLASS5 : GLASS5;
  p.sphere(cx, cy, 5, 5, glass, f === 3 ? 0.5 : f === 2 ? 0.25 : 0);
  // A glint that wanders between the idle frames.
  if (f < 2) {
    p.set(cx - 3 + f, cy - 3, WHITE);
    p.set(cx - 2 + f, cy - 2, glass[H] as number);
  } else {
    p.set(cx - 1, cy - 1, WHITE);
    p.set(cx, cy - 1, WHITE);
    p.set(cx - 1, cy, WHITE);
    if (f === 3) p.set(cx, cy, WHITE);
  }
  // Green status lamp on the lower strut.
  p.set(cx, 20, f >= 2 ? AMBER : GREEN);
}

proc(CO_SPRITES.lens, 22, 22, 4, paintLens);

// ---------------------------------------------------------------------------
// Heliostat hull 64×40: a gunmetal truss frame around the furnace housing,
// solar collector panels on the shoulders, rust plating along the keel and
// the four arm sockets. The core and mirrors are separate parts.

const HULL_W = 64;
const HULL_H = 40;
/** Hull center in the sprite (the rig's x, y). */
export const HULL_CX = 32;
export const HULL_CY = 20;
/** Arm sockets on the hull, offset from the rig center (mirror order). */
export const ARM_SOCKETS: readonly (readonly [number, number])[] = [
  [-24, -8],
  [-15, 12],
  [15, 12],
  [24, -8],
];

function paintHull(p: Paint, f: number): void {
  // Main body: an octagon with chamfered corners.
  p.shape((x, y) => {
    const dx = Math.abs(x + 0.5 - HULL_CX);
    const dy = Math.abs(y + 0.5 - HULL_CY);
    return dx <= 26 && dy <= 15 && dx + dy <= 36;
  }, GUN5);
  // Solar panels on the shoulders: dark blue cells in a gold frame.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 2 : 46;
    for (let y = 2; y <= 9; y++) {
      for (let x = x0; x < x0 + 16; x++) {
        const edge = y === 2 || y === 9 || x === x0 || x === x0 + 15;
        const cell = ((x - x0) % 4 === 0 || (y - 2) % 3 === 0) && !edge;
        const col = edge
          ? (GOLD5[y === 2 || x === x0 ? L : D] as number)
          : cell
            ? (GLASS5[S] as number)
            : (GLASS5[(x + y) % 5 === 0 ? B : D] as number);
        p.set(x, y, col);
      }
    }
  }
  // Rust keel plating with rivets.
  p.shape((x, y) => {
    const dx = Math.abs(x + 0.5 - HULL_CX);
    return y >= 26 && y <= 34 && dx <= 20 - (y - 26);
  }, RUST5);
  for (let x = 16; x <= 48; x += 6) p.rivet(x, 28, RUST5);
  // The furnace housing ring the core sits in.
  p.torus(HULL_CX, HULL_CY + 2, 12, 11, 2.4, GOLD5);
  p.sphere(HULL_CX, HULL_CY + 2, 10, 9.5, GUN5, -0.35);
  // Arm sockets: gold hubs.
  for (const [ox, oy] of ARM_SOCKETS) p.sphere(HULL_CX + ox, HULL_CY + oy, 2.6, 2.6, GOLD5, 0.1);
  // Running lights along the top edge, chasing.
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 5;
    p.set(x, 5, (i + f) % 2 === 0 ? GREEN_HOT : c(GLOW.greenDark));
  }
  // Collector vanes under the keel.
  for (let x = 22; x <= 42; x += 4) {
    p.set(x, 35, GUN5[L] as number);
    p.set(x, 36, GUN5[B] as number);
    p.set(x, 37, GUN5[D] as number);
  }
}

proc(CO_SPRITES.hull, HULL_W, HULL_H, 2, paintHull);

// ---------------------------------------------------------------------------
// Core 24×24: the furnace eye. Shuttered by four gunmetal leaves until the
// mirrors fall, then a white-gold sun; in the Solar Furnace it runs red-hot.

function paintCore(p: Paint, f: number): void {
  const cx = 12;
  const cy = 12;
  const kind = f >> 1;
  const pulse = f & 1;
  if (kind === 0) {
    p.sphere(cx, cy, 9, 9, GUN5, 0.05);
    // Shutter seams in an X, and a thin glow leaking through.
    for (let i = -7; i <= 7; i++) {
      if (Math.abs(i) < 2) continue;
      p.set(cx + i, cy + i, INK);
      p.set(cx + i, cy - i - 1, INK);
    }
    p.set(cx, cy, pulse ? AMBER : c(FX.orange));
    p.set(cx - 1, cy - 1, c(FX.orange));
    return;
  }
  p.torus(cx, cy, 9.5, 9.5, 2, GUN5);
  const r = kind === 2 ? FURNACE5 : HOTGLASS5;
  p.sphere(cx, cy, 7.6 + pulse * 0.6, 7.6 + pulse * 0.6, r, kind === 2 ? 0.25 : 0.15);
  p.set(cx - 2, cy - 3, WHITE);
  p.set(cx - 3, cy - 2, WHITE);
  // Leaves folded back to the rim.
  for (const [x, y] of [
    [cx - 9, cy - 1],
    [cx + 8, cy - 1],
    [cx - 1, cy - 9],
    [cx - 1, cy + 8],
  ] as const) {
    p.set(x, y, GUN5[L] as number);
    p.set(x + 1, y + 1, GUN5[S] as number);
  }
}

proc(CO_SPRITES.core, 24, 24, 6, paintCore);

// ---------------------------------------------------------------------------
// Mirror 18×18: a hexagonal glass facet in a gold frame. Charging, it warms
// to amber; beaming, it is white at the center.

function paintMirror(p: Paint, f: number): void {
  const cx = 9;
  const cy = 9;
  const hex = (x: number, y: number, r: number) => {
    const dx = Math.abs(x + 0.5 - cx);
    const dy = Math.abs(y + 0.5 - cy);
    return dx <= r && dy <= r * 0.87 && dx * 0.5 + dy * 0.87 <= r * 0.87;
  };
  p.shape((x, y) => hex(x, y, 8.5), GOLD5);
  const glass = f >= 2 ? HOTGLASS5 : GLASS5;
  p.shape((x, y) => hex(x, y, 6.2), glass, f === 3 ? L : B);
  // Diagonal sheen bands; they slide between the idle frames.
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      if (!hex(x, y, 5.6)) continue;
      const d = x + y - (f & 1) * 2;
      if (d === 12 || d === 13) p.set(x, y, glass[H] as number);
      else if (d === 16) p.set(x, y, glass[L] as number);
    }
  }
  if (f === 3) {
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) p.set(x, y, WHITE);
  }
}

proc(CO_SPRITES.mirror, 18, 18, 4, paintMirror);

// The bent, empty frame left on the arm.
proc(CO_SPRITES.mirrorWreck, 16, 16, 2, (p, f) => {
  const cx = 8;
  const cy = 8;
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    // A gap where the frame snapped; it sags on frame 1.
    if (t > 4.2 && t < 5.2) continue;
    const sag = f === 1 && t > 0.4 && t < 1.8 ? 1 : 0;
    const x = cx + Math.cos(t) * 6.5;
    const y = cy + Math.sin(t) * 5.6 + sag;
    p.set(x, y, GOLD5[Math.sin(t) < 0 ? L : D] as number);
  }
  // Glass shards still in the frame.
  p.set(5, 6, GLASS5[L] as number);
  p.set(6, 7, GLASS5[B] as number);
  p.set(10, 10, GLASS5[D] as number);
  p.set(9, 5, SOOT);
  p.set(7, 10, SOOT);
});

// Shatter glints: a four-point twinkle that shrinks.
proc(
  CO_SPRITES.glint,
  5,
  5,
  GLINT_FRAMES,
  (p, f) => {
    const arm = 2 - f;
    p.set(2, 2, WHITE);
    for (let i = 1; i <= arm; i++) {
      const col = i === 1 ? (GLASS5[H] as number) : (GLASS5[L] as number);
      p.set(2 - i, 2, col);
      p.set(2 + i, 2, col);
      p.set(2, 2 - i, col);
      p.set(2, 2 + i, col);
    }
  },
  false,
);

// Armor sparks when shots hit the shuttered core.
proc(
  CO_SPRITES.spark,
  5,
  5,
  SPARK_FRAMES,
  (p, f) => {
    const yel = c(FX.yellow);
    const wh = WHITE;
    if (f === 0) {
      p.set(2, 2, wh);
      p.set(1, 2, yel);
      p.set(3, 2, yel);
      p.set(2, 1, yel);
    } else if (f === 1) {
      p.set(0, 1, yel);
      p.set(4, 1, yel);
      p.set(2, 0, wh);
      p.set(1, 3, yel);
      p.set(3, 3, yel);
    } else {
      p.set(0, 0, c(FX.orange));
      p.set(4, 0, c(FX.orange));
      p.set(2, 4, c(FX.orange));
    }
  },
  false,
);
