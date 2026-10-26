// The Shepherd: a Scrap Syndicate tug-mothership, nose-down, lit from the
// top-left. Separate part sprites (hull, tractor emitters and their wrecks,
// the shuttered ion core) so each part flashes and breaks on its own, as the
// Rock Hauler does. Gunmetal spine, rust armor, olive outrigger girders that
// end in shepherd's-crook pylons, and cyan ion gear: engines, conduits,
// emitter dishes and the reactor.
import { defineProcSprite } from '../../../gfx/sprite';
import {
  AMBER,
  AMBER_DIM,
  GLOWG,
  GUN,
  ION,
  OLV,
  RED,
  RED_DIM,
  RUST,
  SOOT,
  WHITE,
} from './ionShoals.sprites';
import {
  B,
  bayer,
  c,
  D,
  H,
  hash01,
  L,
  level,
  LX,
  LY,
  Paint,
  proc,
  S,
  type Mask,
  type Ramp5,
} from './paint';

export const SHEP_SPRITES = {
  hull: 'ion_shep_hull',
  emitter: 'ion_shep_emitter',
  wreck: 'ion_shep_emitter_wreck',
  core: 'ion_shep_core',
  smoke: 'ion_shep_smoke',
  spark: 'ion_shep_spark',
} as const;

export const SHEP_SPRITE_IDS: readonly string[] = Object.values(SHEP_SPRITES);

/** Core frames: 0–1 shut (slit pulse), 2–4 the shutters parting, 5–8 open (crackle). */
export const SHEP_CORE_FRAMES = { shut: 0, opening: 2, open: 5, openCount: 4 } as const;
export const SHEP_SMOKE_FRAMES = 4;
export const SHEP_SPARK_FRAMES = 3;

const INK = c('#100818');
const HAZARD_DARK = c('#201810');
const IONR: Ramp5 = [ION[0], ION[1], ION[2], ION[3], ION[4]];
const IONW: Ramp5 = [ION[1], ION[2], ION[3], ION[4], WHITE];
const SMOKE = c('#584048');
const SMOKE_DARK = c('#302030');
const SMOKE_LIGHT = c('#806870');
const SPARK_HOT = c('#a8f8f8');

// ---------------------------------------------------------------------------
// Hull, 110×62 painted (112×64 with the outline). Center (55, 31) is the boss
// origin; part offsets in content/levels/ionShoals/shepherd.ts match it.

const HW = 110;
const HH = 62;
const CX = 55;
const CY = 31;
/** Core socket center (core part at oy 6). */
const SOCK_Y = CY + 6;
/** Emitter mounts (emitter parts at ox ±40, oy 10). */
const EM_DX = 40;
const EM_Y = CY + 10;

function dx(x: number): number {
  return Math.abs(x + 0.5 - CX);
}

function within(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r;
}

const inSpine: Mask = (x, y) => {
  if (y < 6 || y > 59) return false;
  const d = dx(x);
  if (y > 46) return d <= 19 - (y - 46) * 1.15;
  if (y < 10) return d <= 15 + (y - 6);
  return d <= 19;
};
const inEngine =
  (cxo: number): Mask =>
  (x, y) => {
    const d = Math.abs(x + 0.5 - (CX + cxo));
    return y >= 0 && y <= 11 && d <= (y < 2 ? 3 : 4);
  };
const inArm: Mask = (x, y) => {
  const d = dx(x);
  if (d < 17 || d > 50) return false;
  // Swept down toward the emitters, a girder 7 px deep.
  const top = 28 + (d - 17) * 0.24;
  return y >= top && y <= top + 7;
};
const inCrook: Mask = (x, y) => {
  const d = dx(x);
  // The post, outboard of the emitter...
  if (d >= 49.5 && d <= 53.5 && y >= 25 && y <= 50) return true;
  // ...curling over the top and back in: a shepherd's crook.
  const ex = d - 46;
  const ey = y + 0.5 - 24;
  const r = Math.hypot(ex, ey);
  return ey <= 0 && r >= 3.6 && r <= 7.6 && ex > -4;
};
/** Chamfered armor plates on each shoulder, angled outward. */
const inShoulder =
  (sx: number): Mask =>
  (x, y) => {
    const lx = (x + 0.5 - (CX + sx)) * Math.sign(sx);
    const ly = y + 0.5 - (CY - 12);
    if (ly < -7 || ly > 7 || lx < -9 || lx > 10) return false;
    // Clip the outer-top and inner-bottom corners: a swept wedge.
    return lx - ly <= 12 && -lx + ly <= 12 && lx + ly <= 14;
  };
/** The bridge tower: a chamfered block with its windows near the top. */
const inBridge: Mask = (x, y) => {
  const lx = Math.abs(x + 0.5 - CX);
  const ly = y + 0.5 - (CY - 22);
  if (ly < -10 || ly > 8 || lx > 9) return false;
  return lx - ly <= 14 && lx + ly <= 15;
};

let hullBase: Paint | null = null;

function paintHullBase(): Paint {
  const p = new Paint(HW, HH);

  // Outrigger girders with truss holes, then the crook pylons.
  p.shape(inArm, OLV);
  for (let x = 0; x < HW; x++) {
    const d = dx(x);
    if (d < 20 || d > 47) continue;
    const top = Math.round(28 + (d - 17) * 0.24);
    if (Math.floor(d) % 5 === 0) {
      p.set(x, top + 3, OLV[S]);
      p.set(x, top + 4, OLV[D]);
    }
    // A cyan conduit glowing along the girder's underside.
    if (Math.floor(d) % 2 === 0) p.set(x, top + 6, ION[D]);
  }
  p.shape(inCrook, RUST);
  for (const side of [-1, 1]) {
    const px = CX + side * 51.5 - (side > 0 ? 1 : 0);
    for (let y = 30; y <= 48; y += 6) p.rivet(Math.round(px - 1), y, RUST);
    // Warning lamp at the crook's tip.
    p.set(Math.round(CX + side * 42.5 - 0.5), 24, AMBER_DIM);
  }

  // Engines across the top: three ion bells.
  for (const o of [-11, 0, 11]) {
    p.shape(inEngine(o), GUN);
    for (let x = 0; x < HW; x++) {
      if (!inEngine(o)(x, 5)) continue;
      p.set(x, 5, GUN[S]);
      p.set(x, 6, GUN[L]);
    }
  }

  // The spine: gunmetal with plate seams, a core socket and a prow.
  p.shape(inSpine, GUN);
  for (let y = 12; y <= 46; y += 8) {
    for (let x = 0; x < HW; x++) {
      if (!inSpine(x, y) || !inSpine(x, y + 1) || dx(x) > 17) continue;
      p.set(x, y, GUN[D]);
    }
  }
  for (const sx of [-15, 15]) for (let y = 14; y <= 50; y += 6) p.rivet(CX + sx - 1, y, GUN);

  // Core socket: a recessed bowl lit from inside its far wall, with a raised lip.
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      const ex = x + 0.5 - CX;
      const ey = y + 0.5 - SOCK_Y;
      const dist = Math.hypot(ex, ey);
      if (dist >= 15.5 || dist < 11.5) {
        if (dist >= 15.5 && dist < 16.6) {
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
      Math.round(CX - 0.5 + Math.cos(a) * 13.5),
      Math.round(SOCK_Y - 0.5 + Math.sin(a) * 13.5),
      GUN,
    );
  }

  // Prow: hazard band and a tow hook under the nose.
  for (let y = 52; y <= 54; y++) {
    for (let x = 0; x < HW; x++) {
      if (!inSpine(x, y) || dx(x) < 4) continue;
      const on = ((x + y) >> 1) % 2 === 0;
      p.set(x, y, on ? (y === 52 ? c('#f8d060') : y === 54 ? AMBER_DIM : AMBER) : HAZARD_DARK);
    }
  }
  p.rect(CX - 2, 55, 4, 5, GUN[B]);
  p.set(CX - 2, 55, GUN[H]);
  p.set(CX + 1, 59, GUN[S]);
  p.rect(CX - 1, 58, 2, 2, INK);

  // Emitter mounts: collars on the girders that the dishes sit in.
  for (const side of [-1, 1]) {
    const mx = CX + side * EM_DX;
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        const ex = x + 0.5 - mx;
        const ey = y + 0.5 - EM_Y;
        const d = Math.hypot(ex, ey);
        if (d < 9 || d >= 12) continue;
        const lum = (ex * LX + ey * LY) / d;
        p.set(x, y, GUN[d >= 11 ? (lum > 0.25 ? L : lum > -0.35 ? B : S) : D] as number);
      }
    }
  }

  // Rust armor: two shoulder plates and the bridge dome (the hull parts).
  for (const sx of [-19, 19]) {
    const m = inShoulder(sx);
    p.shape(m, RUST);
    // An inset panel line and a dark seam across each plate, plus rivets.
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        if (!m(x, y)) continue;
        const inner = m(x - 2, y) && m(x + 2, y) && m(x, y - 2) && m(x, y + 2);
        const rim = inner && !(m(x - 3, y) && m(x + 3, y) && m(x, y - 3) && m(x, y + 3));
        if (rim) p.set(x, y, (x + y) % 2 === 0 ? RUST[D] : RUST[B]);
      }
    }
    for (let x = 0; x < HW; x++) {
      if (!m(x, CY - 9) || !m(x, CY - 8)) continue;
      p.set(x, CY - 9, RUST[S]);
      p.set(x, CY - 8, RUST[L]);
    }
    p.rivet(CX + sx - 6, CY - 16, RUST);
    p.rivet(CX + sx + 5, CY - 16, RUST);
    p.rivet(CX + sx - 6, CY - 6, RUST);
    p.rivet(CX + sx + 5, CY - 6, RUST);
  }
  p.shape(inBridge, RUST);
  for (let y = CY - 30; y <= CY - 14; y++) {
    if (inBridge(CX - 7, y) && inBridge(CX - 7, y + 1)) p.set(CX - 7, y, RUST[L]);
    if (inBridge(CX + 6, y) && inBridge(CX + 6, y + 1)) p.set(CX + 6, y, RUST[D]);
  }
  // Bridge windows: a green Syndicate visor band.
  for (let x = CX - 6; x < CX + 6; x++) {
    p.set(x, CY - 24, INK);
    p.set(x, CY - 23, GLOWG[x < CX - 2 ? B : D]);
  }
  p.set(CX - 5, CY - 23, GLOWG[L]);
  p.rivet(CX - 4, CY - 18, RUST);
  p.rivet(CX + 3, CY - 18, RUST);

  // Cyan conduits from the engines down the spine edges.
  for (let y = 12; y <= 22; y++) {
    p.set(CX - 9, y, ION[y % 3 === 0 ? L : D]);
    p.set(CX + 8, y, ION[y % 3 === 0 ? B : D]);
  }

  // Weathering.
  p.speckle(RUST[B], RUST[D], (x, y) => hash01(x, y, 11) < 0.1);
  p.speckle(RUST[B], RUST[L], (x, y) => hash01(x, y, 12) < 0.025);
  p.speckle(OLV[B], OLV[D], (x, y) => hash01(x, y, 13) < 0.07);
  p.speckle(GUN[B], GUN[D], (x, y) => hash01(x, y, 14) < 0.05);
  for (let i = 0; i < 4; i++) {
    const x = CX - 16 + Math.floor(hash01(i, 1, 15) * 32);
    const y = 24 + Math.floor(hash01(i, 2, 15) * 22);
    for (let k = 0; k < 5; k++) {
      const sx = x + Math.floor(hash01(i, k, 16) * 3);
      const sy = y + Math.floor(hash01(k, i, 17) * 2);
      if (inSpine(sx, sy) && !within(sx, sy, CX, SOCK_Y, 16.6))
        p.set(sx, sy, k < 2 ? GUN[S] : SOOT);
    }
  }
  // A Syndicate skull stencil on the right shoulder.
  const skull = ['.GGG.', 'G.G.G', 'GGGGG', '.G.G.'];
  skull.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === 'G') p.set(CX + 17 + i, CY - 6 + j, GLOWG[D]);
  });
  return p;
}

proc(SHEP_SPRITES.hull, HW, HH, 2, (p, f) => {
  hullBase ??= paintHullBase();
  p.copyFrom(hullBase);
  // Ion exhaust in the engine bells, flickering between frames.
  for (const o of [-11, 0, 11]) {
    for (let x = CX + o - 2; x <= CX + o + 1; x++) {
      p.set(x, 0, IONW[f === 0 ? L : B] as number);
      p.set(x, 1, IONW[f === 0 ? B : D] as number);
    }
    p.set(CX + o - 1, 0, f === 0 ? WHITE : ION[4]);
  }
  // Crook lamps alternate; the conduits pulse.
  p.set(CX - 43, 24, f === 0 ? AMBER : AMBER_DIM);
  p.set(CX + 42, 24, f === 0 ? AMBER_DIM : AMBER);
  p.set(CX - 1, CY - 31, f === 0 ? RED : RED_DIM);
  for (let y = 12; y <= 22; y += 3) {
    p.set(CX - 9, y + f, ION[H]);
    p.set(CX + 8, y + 1 - f, ION[L]);
  }
});

// ---------------------------------------------------------------------------
// Tractor emitter, 22×22 painted: a dish facing down out of its collar, a
// prong at the focus and a glowing tip where the beam leaves.

const EC = 11;

proc(SHEP_SPRITES.emitter, 22, 22, 2, (p, f) => {
  // Dish: gunmetal back, lit rim.
  p.sphere(EC, EC - 1, 9.5, GUN, 0.02);
  // Inner bowl, opening toward the bottom: cyan, darker toward the far wall.
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      const ex = x + 0.5 - EC;
      const ey = y + 0.5 - (EC + 1.5);
      const d = Math.hypot(ex / 7.2, ey / 6);
      if (d > 1 || y < EC - 3) continue;
      const lum = 0.55 - ey * 0.08 - ex * 0.05;
      p.set(x, y, IONR[level(lum, x, y)] as number);
    }
  }
  // Rim ring.
  for (let x = 4; x < 18; x++) {
    p.set(x, EC - 4, x < EC ? GUN[H] : GUN[L]);
  }
  // Focus prong and its hot tip.
  for (let y = EC - 3; y <= EC + 5; y++) {
    p.set(EC - 1, y, GUN[L]);
    p.set(EC, y, GUN[S]);
  }
  p.set(EC - 1, EC + 6, f === 0 ? WHITE : ION[4]);
  p.set(EC, EC + 6, ION[f === 0 ? 4 : 3]);
  p.set(EC - 1, EC + 7, ION[3]);
  p.set(EC, EC + 7, ION[2]);
  // Coil glints on the bowl.
  p.set(EC - 5, EC + 2, ION[f === 0 ? 4 : 3]);
  p.set(EC + 4, EC + 3, ION[f === 0 ? 3 : 4]);
  // Bolts on the back plate.
  for (const [x, y] of [
    [6, 4],
    [15, 4],
  ] as const) {
    p.rivet(x, y, GUN);
  }
});

// Wreck, 22×22: the dish torn open, a bent prong, arcing coils.
proc(SHEP_SPRITES.wreck, 22, 22, 2, (p, f) => {
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      const ex = x + 0.5 - EC;
      const ey = y + 0.5 - EC;
      const d = Math.hypot(ex, ey) + Math.sin(Math.atan2(ey, ex) * 5) * 1.4;
      if (d > 9.2) continue;
      if (hash01(x, y, 21) < 0.12 && d > 6) continue;
      p.set(x, y, d > 7.6 ? GUN[D] : d > 5.5 ? GUN[S] : SOOT);
    }
  }
  for (const [x, y] of [
    [4, 6],
    [5, 5],
    [16, 5],
    [17, 7],
    [3, 13],
    [15, 17],
  ] as const) {
    p.set(x, y, GUN[L]);
    p.set(x + 1, y + 1, GUN[B]);
  }
  for (let k = 0; k < 5; k++) {
    p.set(12 + (k >> 1), 12 + k, GUN[L]);
    p.set(13 + (k >> 1), 12 + k, GUN[D]);
  }
  p.set(10, 10, f === 0 ? ION[3] : ION[1]);
  p.set(9, 11, ION[1]);
  if (f === 0) {
    p.set(8, 8, WHITE);
    p.set(7, 7, ION[4]);
  } else {
    p.set(13, 9, WHITE);
    p.set(14, 8, ION[4]);
    p.set(12, 9, ION[3]);
  }
});

// ---------------------------------------------------------------------------
// Core, 26×26: a crackling ion orb behind two armored shutters that part
// vertically (the Rock Hauler's core is an iris; this one slides).

const KC = 13;
const CORE_R = 11.5;

function shutterGap(f: number): number {
  if (f < SHEP_CORE_FRAMES.opening) return 1;
  if (f < SHEP_CORE_FRAMES.open) return 1 + (f - SHEP_CORE_FRAMES.opening + 1) * 2.6;
  return 9.5;
}

proc(SHEP_SPRITES.core, 26, 26, SHEP_CORE_FRAMES.open + SHEP_CORE_FRAMES.openCount, (p, f) => {
  const open = f >= SHEP_CORE_FRAMES.open;
  const pulse = open ? ([0, 1, 2, 1][f - SHEP_CORE_FRAMES.open] as number) : f & 1;
  p.sphere(KC, KC, 9.8, IONW, 0.1 + pulse * 0.08);
  const hot = 2 + pulse + (open ? 1 : 0);
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 26; x++) {
      const d = Math.hypot(x + 0.5 - KC + 1.5, y + 0.5 - KC + 1.5);
      if (d < hot) p.set(x, y, d < hot - 1.2 ? WHITE : ION[4]);
    }
  }
  if (open) {
    // Arcs crawling over the orb.
    const k = f - SHEP_CORE_FRAMES.open;
    for (let i = 0; i < 3; i++) {
      const a = (k / 4) * Math.PI * 2 + (i * Math.PI * 2) / 3;
      for (let s = 0; s < 3; s++) {
        const rr = 6 + s;
        p.set(
          Math.round(KC - 0.5 + Math.cos(a + s * 0.25) * rr),
          Math.round(KC - 0.5 + Math.sin(a + s * 0.25) * rr),
          s === 0 ? WHITE : ION[4],
        );
      }
    }
  }
  // Shutters: an upper and a lower armored leaf, each a lit half-disc slice.
  const gap = shutterGap(f);
  const leaf: Mask = (x, y) => {
    const ex = x + 0.5 - KC;
    const ey = y + 0.5 - KC;
    if (Math.hypot(ex, ey) > CORE_R) return false;
    return Math.abs(ey) >= gap / 2;
  };
  p.sphere(KC, KC, CORE_R, RUST, -0.02, leaf);
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 26; x++) {
      if (!leaf(x, y)) continue;
      const ey = y + 0.5 - KC;
      // Hazard stripes along each leaf's leading edge.
      const edge = (ey < 0 && !leaf(x, y + 1)) || (ey > 0 && !leaf(x, y - 1));
      const lip = (ey < 0 && !leaf(x, y + 2)) || (ey > 0 && !leaf(x, y - 2));
      if (edge) p.set(x, y, ((x >> 1) & 1) === 0 ? AMBER : HAZARD_DARK);
      else if (lip) p.set(x, y, ey < 0 ? RUST[S] : RUST[L]);
    }
  }
  // Rivets on the leaves while they're still mostly shut.
  if (gap < 8) {
    p.rivet(KC - 6, KC - 7, RUST);
    p.rivet(KC + 4, KC - 7, RUST);
    p.rivet(KC - 6, KC + 6, RUST);
    p.rivet(KC + 4, KC + 6, RUST);
  }
});

// Smoke puff, 8×8: grows and thins out over its four frames.
defineProcSprite(
  SHEP_SPRITES.smoke,
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
  { frames: SHEP_SMOKE_FRAMES },
);

// Deflect spark, 5×5: shots pinging off armor, in ion cyan.
defineProcSprite(
  SHEP_SPRITES.spark,
  5,
  5,
  (ctx, f) => {
    const p = new Paint(5, 5);
    if (f === 0) {
      p.set(2, 2, WHITE);
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
        p.set(x, y, SPARK_HOT);
      }
    } else if (f === 1) {
      p.set(2, 2, SPARK_HOT);
      for (const [x, y] of [
        [0, 0],
        [4, 0],
        [0, 4],
        [4, 4],
      ] as const) {
        p.set(x, y, WHITE);
      }
    } else {
      p.set(2, 2, ION[3]);
    }
    p.flush(ctx);
  },
  { frames: SHEP_SPARK_FRAMES },
);
