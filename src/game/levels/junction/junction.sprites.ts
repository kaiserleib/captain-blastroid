// Wormhole Junction roster: Syndicate gate-tech in gunmetal and verdigris,
// with the portal colors (portal orange, lime, cyan) as glows, on the
// sector's green-black void. Nose-down, lit from the top-left. Painted sizes
// are 2 px under the cell sizes (the outline adds 1 px per side): Blinker
// 16×16, Gate Pylon 16×24, Aegis 24×24.
import { B, c, D, H, hash01, L, proc, ramp5, S, type Mask } from './paint';

export const WJ_SPRITES = {
  blinker: 'wj_blinker',
  pylon: 'wj_pylon',
  aegis: 'wj_aegis',
} as const;

export const WJ_SPRITE_IDS: readonly string[] = Object.values(WJ_SPRITES);

export const GUN = ramp5('#100c18', '#202830', '#404c58', '#687888', '#a8b8c8');
export const VERD = ramp5('#081810', '#104030', '#287058', '#50a080', '#98d8b8');
export const VIO = ramp5('#100818', '#281838', '#483060', '#705090', '#a888c8');
export const ORANGE = ramp5('#401000', '#803808', '#f88820', '#f8b858', '#f8e0b0');
export const LIME = ramp5('#183008', '#306808', '#90e028', '#c0f068', '#e8f8c0');
export const CYANR = ramp5('#082838', '#086878', '#30c8e0', '#78e0f0', '#d0f8f8');
export const WHITE = c('#f8f8f8');

function mirror(cx: number, m: (dx: number, y: number) => boolean): Mask {
  return (x, y) => m(Math.abs(x + 0.5 - cx), y);
}

// ---------------------------------------------------------------------------
// Blinker (14×14 painted): a violet dart folded around a portal-orange eye,
// with two swept fins. The eye pulses between frames (it blinks).

const BK = 7;
const bkBody = mirror(BK, (dx, y) => {
  if (y < 1 || y > 13) return false;
  // A teardrop: wide at the back (top), pointed nose (bottom).
  const half = y <= 6 ? 2.5 + y * 0.35 : 4.6 - (y - 6) * 0.6;
  return dx <= half;
});
const bkFin = mirror(BK, (dx, y) => dx >= 3.5 && dx <= 6.5 && y >= 1 + (dx - 3.5) && y <= 6);

proc(WJ_SPRITES.blinker, 14, 14, 2, (p, f) => {
  p.shape(bkFin, GUN);
  p.shape(bkBody, VIO);
  // The eye: an orange ring with a white-hot core.
  p.sphere(BK, 7, 2.6, ORANGE, f === 0 ? 0.25 : -0.15);
  p.set(BK - 1, 6, f === 0 ? WHITE : ORANGE[H]);
  p.set(BK, 7, ORANGE[f === 0 ? H : L]);
  // Fin tips glint, and the engine slits at the back.
  for (const x of [1, 12]) p.set(x, 2, ORANGE[f === 0 ? L : B]);
  p.set(BK - 1, 1, ORANGE[f === 0 ? B : D]);
  p.set(BK, 1, ORANGE[D]);
  p.speckle(VIO[B], VIO[D], (x, y) => hash01(x, y, 11) < 0.08);
});

// ---------------------------------------------------------------------------
// Gate Pylon (14×22 painted): a tall gunmetal mast with verdigris collars and
// a lime emitter at each end (the ring it carries hangs beside it).

const PY = 7;
const pyMast = mirror(PY, (dx, y) => y >= 2 && y <= 19 && dx <= 2.2);
const pyCollar = mirror(PY, (dx, y) => {
  if (y >= 5 && y <= 7) return dx <= 5.5 - (y === 5 ? 1 : 0);
  if (y >= 14 && y <= 16) return dx <= 5.5 - (y === 16 ? 1 : 0);
  return false;
});
const pyCap = mirror(
  PY,
  (dx, y) => (y <= 2 || y >= 19) && dx <= 3.5 - (y === 0 || y === 21 ? 1 : 0),
);

proc(WJ_SPRITES.pylon, 14, 22, 2, (p, f) => {
  p.cylinder(PY - 2, 2, 5, 18, GUN, pyMast);
  p.shape(pyCollar, VERD);
  p.shape(pyCap, GUN);
  // Collar rivets and seams.
  for (const y of [6, 15]) {
    p.rivet(3, y, VERD);
    p.rivet(10, y, VERD);
  }
  // The emitters: lime lenses at the caps, alternating glow between frames.
  for (const [y, on] of [
    [1, f === 0],
    [20, f === 1],
  ] as const) {
    p.rect(PY - 2, y, 4, 1, LIME[on ? L : D]);
    p.set(PY - 1, y, on ? WHITE : LIME[B]);
  }
  // A light strip down the mast, the "carrier" core.
  for (let y = 8; y <= 13; y++) p.set(PY - 1, y, LIME[(y + f) % 2 === 0 ? B : D]);
  p.speckle(GUN[B], GUN[D], (x, y) => hash01(x, y, 17) < 0.07);
});

// ---------------------------------------------------------------------------
// Aegis (22×22 painted): a broad verdigris turret saucer with gunmetal gun
// cheeks and a lime front shield plate wrapped round its lower (front) half.
// The plate is what the shots from below hit; its back (top) is bare.

const AG = 11;
const agHull = mirror(AG, (dx, y) => {
  const ey = (y + 0.5 - 9) / 8.5;
  const ex = dx / 9.5;
  return ex * ex + ey * ey <= 1 && y >= 1;
});
const agCheek = mirror(AG, (dx, y) => dx >= 7 && dx <= 10.5 && y >= 6 && y <= 12);
const agShield = mirror(AG, (dx, y) => {
  const ey = (y + 0.5 - 10) / 11;
  const ex = dx / 11;
  const outer = ex * ex + ey * ey <= 1;
  const iy = (y + 0.5 - 9) / 8.6;
  const ix = dx / 9.6;
  return outer && ix * ix + iy * iy > 1 && y >= 12;
});

proc(WJ_SPRITES.aegis, 22, 22, 2, (p, f) => {
  p.shape(agCheek, GUN);
  p.shape(agHull, VERD);
  // The dome: a sphere-lit bubble on the back with a dark slit window.
  p.sphere(AG, 7, 4.2, GUN, 0.1);
  p.rect(AG - 3, 7, 6, 1, VERD[S]);
  p.set(AG - 2, 7, LIME[f === 0 ? L : B]);
  p.set(AG + 1, 7, LIME[f === 0 ? B : L]);
  // The fan muzzles under the hull.
  for (const x of [AG - 5, AG - 3, AG - 1, AG + 1, AG + 3]) p.set(x, 15, GUN[S]);
  // The front shield: a lime band, bright rim on the outside, shimmer stripes.
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      if (!agShield(x, y)) continue;
      const rim = !agShield(x, y + 1);
      const stripe = (x + y + f) % 3 === 0;
      p.set(x, y, rim ? LIME[L] : stripe ? LIME[H] : LIME[B]);
    }
  }
  for (const [x, y] of [
    [5, 4],
    [16, 4],
  ] as const) {
    p.rivet(x, y, VERD);
  }
  p.speckle(VERD[B], VERD[D], (x, y) => hash01(x, y, 23) < 0.08);
});
