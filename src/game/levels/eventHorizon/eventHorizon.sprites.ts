// Event Horizon roster: Scrap Syndicate gravity tech. Gunmetal and rust hulls
// as in Level 1, with violet gravitic cores and gold accretion rings that echo
// the sector's black holes. Every ship flies nose-down, lit from the top-left.
import { GLOW, GUNMETAL, OUTLINE, SYNDICATE, snes } from '../../../gfx/palette';
import { defineSprite, gridRows } from '../../../gfx/sprite';
import { B, c, D, H, L, proc, ramp, S, type Paint } from './paint';

export const HZ_VIOLET = {
  shadow: snes('#180828'),
  dark: snes('#382068'),
  base: snes('#6840b0'),
  light: snes('#a070e8'),
  highlight: snes('#d8b8f8'),
} as const;

export const HZ_GOLD = {
  shadow: snes('#382008'),
  dark: snes('#805010'),
  base: snes('#c88818'),
  light: snes('#f8c840'),
  highlight: snes('#f8f0a8'),
} as const;

/** Telegraph lines: warning red into amber into white, never the enemy-bullet magenta. */
export const HZ_WARN = {
  dim: snes('#782010'),
  red: GLOW.red,
  amber: GLOW.amber,
  hot: snes('#f8f0c0'),
} as const;

export const VIOLET5 = ramp(
  HZ_VIOLET.shadow,
  HZ_VIOLET.dark,
  HZ_VIOLET.base,
  HZ_VIOLET.light,
  HZ_VIOLET.highlight,
);
export const GOLD5 = ramp(
  HZ_GOLD.shadow,
  HZ_GOLD.dark,
  HZ_GOLD.base,
  HZ_GOLD.light,
  HZ_GOLD.highlight,
);
export const GUN5 = ramp(
  '#100c18',
  GUNMETAL.dark,
  GUNMETAL.base,
  GUNMETAL.light,
  GUNMETAL.highlight,
);
export const RUST5 = ramp(
  SYNDICATE.shadow,
  SYNDICATE.dark,
  SYNDICATE.base,
  SYNDICATE.light,
  SYNDICATE.highlight,
);
const WHITE = c('#f8f8f8');
const GREEN = c(GLOW.green);
const GREEN_HOT = c(GLOW.greenHot);
const INK = c(OUTLINE);

export const HZ_SPRITES = {
  orbiter: 'hz_orbiter',
  lancer: 'hz_lancer',
  lancerCharge: 'hz_lancer_charge',
  buoy: 'hz_buoy',
} as const;

export const HZ_ENEMY_SPRITE_IDS: readonly string[] = Object.values(HZ_SPRITES);

// ---------------------------------------------------------------------------
// Orbiter 20×20: a ringed gun drone, Saturn-shaped. Its gold ring carries two
// running lights that chase around it; guns sit at the ring's ends, because
// it fires outward from whatever hole it circles.

function paintOrbiter(p: Paint, f: number): void {
  const cx = 9;
  const cy = 9;
  p.torus(cx, cy, 7.6, 2.6, 2.2, GOLD5, -1);
  p.sphere(cx, cy, 5.6, 5.6, GUN5, 0.05);
  // Rust cowl over the top, a violet gravitic eye below the ring line.
  for (let y = 3; y <= 6; y++) {
    for (let x = 4; x <= 13; x++) {
      const nx = (x + 0.5 - cx) / 5.6;
      const ny = (y + 0.5 - cy) / 5.6;
      if (nx * nx + ny * ny > 0.86) continue;
      const k = y === 3 ? H : y === 4 ? L : x < 7 ? B : D;
      p.set(x, y, RUST5[k] as number);
    }
  }
  p.sphere(cx, cy + 2.4, 2.4, 2.1, VIOLET5, 0.3);
  p.set(cx - 1, cy + 1, WHITE);
  p.torus(cx, cy, 7.6, 2.6, 2.2, GOLD5, 1);
  // Gun nubs at the ring tips.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : 16;
    p.set(x0, cy - 1, GUN5[L] as number);
    p.set(x0 + 1, cy - 1, GUN5[B] as number);
    p.set(x0, cy, GUN5[D] as number);
    p.set(x0 + 1, cy, GUN5[S] as number);
    p.set(s < 0 ? x0 : x0 + 1, cy + 1, INK);
  }
  // Two running lights a half-turn apart; 4 frames chase around the ring.
  for (let k = 0; k < 2; k++) {
    const a = ((f + k * 2) / 4) * Math.PI * 2 + 0.4;
    const lx = cx + Math.cos(a) * 7.6;
    const ly = cy + Math.sin(a) * 2.6;
    // Lights behind the hull stay hidden.
    if (Math.sin(a) < 0 && Math.abs(Math.cos(a)) < 0.7) continue;
    p.set(lx, ly, GREEN_HOT);
    p.set(lx + (Math.cos(a) > 0 ? -1 : 1), ly, GREEN);
  }
}

proc(HZ_SPRITES.orbiter, 18, 18, 4, paintOrbiter);

// ---------------------------------------------------------------------------
// Lancer 14×24: a needle-hulled rammer with a steel lance for a nose and
// swept rust fins at the stern. Authored as the left half and mirrored.

const PAL = {
  o: OUTLINE,
  s: SYNDICATE.shadow,
  d: SYNDICATE.dark,
  r: SYNDICATE.base,
  l: SYNDICATE.light,
  h: SYNDICATE.highlight,
  k: GUNMETAL.dark,
  m: GUNMETAL.base,
  n: GUNMETAL.light,
  w: GUNMETAL.highlight,
  g: GLOW.greenDark,
  G: GLOW.green,
  H: GLOW.greenHot,
  v: HZ_VIOLET.dark,
  p: HZ_VIOLET.base,
  q: HZ_VIOLET.light,
  Q: HZ_VIOLET.highlight,
};

const LANCER = `
  ....op
  ...oqQ
  ...okn
  o..omw
  ro.okn
  lro.mn
  hlrokw
  ohlrkn
  .ohdmn
  ..odkm
  ...okn
  ...omw
  ...okn
  ...ogH
  ...ogG
  ...okw
  ...omn
  ....ow
  ....on
  ....ow
  ....on
  ....ow
  .....o
`;

function lancerFrames(): string[] {
  const rows = gridRows(LANCER);
  const alt = rows.slice();
  alt[0] = '....oQ';
  alt[1] = '...opq';
  alt[13] = '...oGH';
  alt[14] = '...ogH';
  return [rows.join('\n'), alt.join('\n')];
}

defineSprite(HZ_SPRITES.lancer, { palette: PAL, mirrorX: true, frames: lancerFrames() });

// The nose flare during the telegraph: a 7×7 star that tightens and whitens.
proc(
  HZ_SPRITES.lancerCharge,
  7,
  7,
  3,
  (p, f) => {
    const hot = c(HZ_WARN.hot);
    const amber = c(HZ_WARN.amber);
    const red = c(HZ_WARN.red);
    const arm = 3 - f;
    for (let i = 1; i <= 3; i++) {
      const col = i <= arm - 1 ? amber : red;
      if (i > arm + 1) continue;
      p.set(3 - i, 3, col);
      p.set(3 + i, 3, col);
      p.set(3, 3 - i, col);
      p.set(3, 3 + i, col);
    }
    p.set(3, 3, hot);
    if (f >= 1) {
      p.set(2, 3, hot);
      p.set(4, 3, hot);
      p.set(3, 2, hot);
      p.set(3, 4, hot);
    }
    if (f === 2) {
      p.set(2, 2, amber);
      p.set(4, 2, amber);
      p.set(2, 4, amber);
      p.set(4, 4, amber);
    }
  },
  false,
);

// ---------------------------------------------------------------------------
// Gravity Buoy 20×24: a beacon spindle. A violet singularity seed hangs in a
// gold gimbal between gunmetal end caps; the antenna lamps blink.

function paintBuoy(p: Paint, f: number): void {
  const cx = 9;
  const cy = 11;
  // Back half of the gimbal ring (vertical ellipse) behind the seed.
  p.torus(cx, cy, 7.4, 6.6, 1.8, GOLD5, -1);
  // End caps.
  p.shape((x, y) => y >= 1 && y <= 4 && Math.abs(x + 0.5 - cx) <= 4.2 - (y === 1 ? 1.5 : 0), GUN5);
  p.shape(
    (x, y) => y >= 18 && y <= 21 && Math.abs(x + 0.5 - cx) <= 4.2 - (y === 21 ? 1.5 : 0),
    GUN5,
  );
  // Struts from the caps to the ring.
  for (let y = 4; y <= 6; y++) {
    p.set(cx - 3, y, GUN5[L] as number);
    p.set(cx + 2, y, GUN5[D] as number);
  }
  for (let y = 15; y <= 18; y++) {
    p.set(cx - 3, y, GUN5[B] as number);
    p.set(cx + 2, y, GUN5[S] as number);
  }
  // The seed: a violet sphere that swells a pixel on the pulse frame.
  const rad = f === 1 ? 4.4 : 3.8;
  p.sphere(cx, cy, rad, rad, VIOLET5, f === 1 ? 0.25 : 0.05);
  p.set(cx - 2, cy - 2, WHITE);
  // Front half of the gimbal, over the seed.
  p.torus(cx, cy, 7.4, 6.6, 1.8, GOLD5, 1);
  // Antenna and lamps.
  p.set(cx - 1, 0, GUN5[L] as number);
  p.set(cx, 0, f === 0 ? GREEN_HOT : GREEN);
  p.set(cx - 1, 22, GUN5[D] as number);
  p.set(cx, 22, f === 1 ? GREEN_HOT : GREEN);
  // Rust hazard bands on the caps.
  for (const y of [3, 19]) {
    for (let x = cx - 3; x <= cx + 2; x++) {
      if (((x + y) & 1) === 0) p.set(x, y, RUST5[y === 3 ? L : B] as number);
    }
  }
}

proc(HZ_SPRITES.buoy, 18, 23, 2, paintBuoy);
