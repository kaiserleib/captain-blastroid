// Ion Shoals roster: Scrap Syndicate rust, olive and gunmetal (the L1 faction
// look) with cyan ion gear, since the tugs herd rocks with tractor beams.
// Nose-down, lit from the top-left, painted procedurally like the Rock
// Hauler. Painted sizes are 2 px under the cell sizes: the outline adds 1 px
// per side (Skiff 16×16, Ion Mine 16×16, Tug 32×24).
import { B, c, D, H, hash01, L, proc, ramp5, S, type Mask, type Paint } from './paint';

export const ION_SPRITES = {
  skiff: 'ion_skiff',
  tug: 'ion_tug',
  mine: 'ion_mine',
  mineHot: 'ion_mine_hot',
} as const;

export const ION_SPRITE_IDS: readonly string[] = Object.values(ION_SPRITES);

export const RUST = ramp5('#300808', '#601810', '#a03020', '#d05830', '#f09058');
export const GUN = ramp5('#100c18', '#202028', '#404858', '#687080', '#a0a8b8');
export const OLV = ramp5('#181808', '#283010', '#506028', '#809040', '#b0c068');
export const ION = ramp5('#082838', '#105878', '#2898c8', '#58d0f8', '#d0f8f8');
export const GLOWG = ramp5('#103008', '#307810', '#90f040', '#e0f8a0', '#f8f8f8');
export const WHITE = c('#f8f8f8');
export const AMBER = c('#f8a800');
export const AMBER_DIM = c('#784000');
export const RED = c('#f83030');
export const RED_DIM = c('#601010');
export const SOOT = c('#181010');

function mirror(cx: number, m: (dx: number, y: number) => boolean): Mask {
  return (x, y) => m(Math.abs(x + 0.5 - cx), y);
}

// ---------------------------------------------------------------------------
// Skiff (14×14 painted): a catamaran raider. Two rust pontoons, a swept
// gunmetal crossbar, a slim pod with a green cockpit and a cyan ion sail on
// top. The H silhouette reads apart from the gnat and swooper at a glance.

const SK = 7;
const skPontoon = mirror(SK, (dx, y) => {
  if (y < 1 || y > 12) return false;
  if (y === 12) return dx >= 4.5 && dx <= 5.5;
  if (y === 1) return dx >= 4 && dx <= 6;
  return dx >= 3.5 && dx <= 6.5;
});
const skBar = mirror(SK, (dx, y) => dx <= 4 && y >= 4 + dx * 0.4 && y <= 6.6 + dx * 0.4);
const skPod = mirror(SK, (dx, y) => {
  if (y < 2 || y > 12) return false;
  if (y >= 11) return dx <= 12.6 - y;
  return dx <= 2;
});
const skSail = mirror(SK, (dx, y) => y >= 0 && y <= 4 && dx <= 1 + (y >= 3 ? 0.6 : 0));

proc(ION_SPRITES.skiff, 14, 14, 2, (p, f) => {
  p.shape(skPontoon, RUST);
  p.shape(skBar, GUN);
  p.shape(skPod, GUN);
  p.shape(skSail, ION);
  // Pontoon seams and the dark crossbar shadow line.
  for (const x of [2, 11]) {
    p.set(x, 8, RUST[D]);
    p.set(x, 9, RUST[L]);
  }
  for (let x = 4; x <= 9; x++) if (skBar(x, 7) && !skBar(x, 8)) p.set(x, 7, GUN[S]);
  // Cockpit glow, the sail's hot core, and the pontoon engines at the top.
  p.set(6, 8, GLOWG[f === 0 ? H : L]);
  p.set(7, 8, GLOWG[f === 0 ? L : B]);
  p.set(6, 9, GLOWG[B]);
  p.set(7, 9, GLOWG[D]);
  p.set(6, 1, ION[f === 0 ? H : L]);
  p.set(7, 2, ION[f === 0 ? L : H]);
  for (const x of [1, 12]) p.set(x, 1, GLOWG[f === 0 ? L : B]);
  for (const x of [2, 11]) p.set(x, 0, GLOWG[f === 0 ? B : D]);
});

// ---------------------------------------------------------------------------
// Tug (30×22 painted): a squat hauler. Twin rust engine nacelles at the top,
// a gunmetal cab with an olive deck, olive clamp arms, and a cyan tractor
// dish slung under the nose that the beam leaves from.

const TW = 30;
const TCX = 15;
/** Beam origin, px from the sprite center (the dish focus). */
export const TUG_EMITTER = { x: 0, y: 8 } as const;

const tgNacelle = mirror(
  TCX,
  (dx, y) => dx >= 8.5 && dx <= 14 && y >= 1 && y <= 13 - (dx > 12 ? 2 : 0),
);
const tgCab = mirror(TCX, (dx, y) => {
  if (y < 2 || y > 17) return false;
  const w = y < 4 ? 6 : y > 14 ? 9 - (y - 14) * 1.6 : 9;
  return dx <= w;
});
const tgDeck = mirror(TCX, (dx, y) => y >= 5 && y <= 11 && dx <= 6.5 - (y === 5 ? 1 : 0));
const tgClamp = mirror(TCX, (dx, y) => {
  if (y >= 12 && y <= 15 && dx >= 8 && dx <= 12.5) return true;
  // The claw tip hooks in toward the dish.
  return y >= 16 && y <= 19 && dx >= 7.5 + (y - 16) * 0.2 && dx <= 10 - (y - 16) * 0.3;
});
const tgDishRim = mirror(TCX, (dx, y) => {
  const ey = (y + 0.5 - 18) / 3.6;
  const ex = dx / 6.2;
  return ex * ex + ey * ey <= 1;
});

proc(ION_SPRITES.tug, TW, 22, 2, (p, f) => {
  p.shape(tgNacelle, RUST);
  // Nacelle bands and exhaust caps.
  for (const x0 of [1, 21]) {
    for (let i = 0; i < 8; i++) {
      if (!tgNacelle(x0 + i, 6)) continue;
      p.set(x0 + i, 6, RUST[S]);
      p.set(x0 + i, 7, RUST[L]);
    }
    for (let i = 1; i < 7; i++) if (tgNacelle(x0 + i, 1)) p.set(x0 + i, 1, GUN[S]);
  }
  p.shape(tgClamp, OLV);
  p.shape(tgCab, GUN);
  p.shape(tgDeck, OLV);
  // Deck hatch and rivets.
  p.rect(13, 7, 4, 3, OLV[D]);
  p.set(13, 7, OLV[S]);
  p.set(16, 9, OLV[L]);
  for (const [x, y] of [
    [9, 3],
    [19, 3],
    [8, 13],
    [20, 13],
  ] as const) {
    p.rivet(x, y, GUN);
  }
  // Bridge slit with the Syndicate green glow.
  for (let x = 11; x <= 18; x++) p.set(x, 3, x === 11 ? GUN[S] : GLOWG[x < 14 ? B : D]);
  p.set(12, 3, GLOWG[f === 0 ? H : L]);
  // The dish: a dark bowl with a lit rim and a cyan focus.
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < TW; x++) {
      if (!tgDishRim(x, y)) continue;
      const edge = !tgDishRim(x, y + 1) || !tgDishRim(x - 1, y) || !tgDishRim(x + 1, y);
      const top = !tgDishRim(x, y - 1);
      let col = ION[S];
      if (top) col = GUN[L];
      else if (edge) col = x < TCX ? ION[L] : ION[D];
      else if (y >= 19) col = ION[D];
      p.set(x, y, col);
    }
  }
  p.set(TCX - 1, 19, ION[f === 0 ? H : L]);
  p.set(TCX, 19, f === 0 ? WHITE : ION[H]);
  p.set(TCX - 1, 20, ION[B]);
  p.set(TCX, 20, ION[f === 0 ? L : B]);
  // Nacelle exhaust glow flickers between frames.
  for (const x0 of [1, 21]) {
    for (let i = 2; i < 6; i++) p.set(x0 + i, 0, GLOWG[f === 0 ? L : B]);
    p.set(x0 + 3, 0, GLOWG[f === 0 ? H : L]);
  }
  // Grime on the rust.
  p.speckle(RUST[B], RUST[D], (x, y) => hash01(x, y, 3) < 0.1);
  p.speckle(OLV[B], OLV[D], (x, y) => hash01(x, y, 5) < 0.08);
});

// ---------------------------------------------------------------------------
// Ion Mine (14×14 painted): a gunmetal sphere on four stubby prongs, a cyan
// coil band, and a warning lamp that blinks once per half-second cycle.
// `ion_mine_hot` is the armed look the mine's draw overlays while it counts
// down: lamp red-hot and the coil white.

const MC = 7;

function paintMine(p: Paint, lamp: number, lampCore: number, coil: number, coilHot: number): void {
  // Prongs (N/E/S/W) and their caps.
  for (let k = 0; k < 3; k++) {
    p.set(MC - 1, k, GUN[k === 0 ? L : B]);
    p.set(MC, k, GUN[k === 0 ? B : D]);
    p.set(MC - 1, 13 - k, GUN[B]);
    p.set(MC, 13 - k, GUN[S]);
    p.set(k, MC - 1, GUN[k === 0 ? L : B]);
    p.set(k, MC, GUN[D]);
    p.set(13 - k, MC - 1, GUN[B]);
    p.set(13 - k, MC, GUN[S]);
  }
  p.sphere(MC, MC, 5.2, GUN, 0.05);
  // A two-row coil band around the equator, brighter on the lit side.
  for (let x = 1; x <= 12; x++) {
    for (const y of [MC, MC + 1]) {
      if (p.get(x, y) < 0) continue;
      p.set(x, y, y === MC ? (x < MC ? coilHot : coil) : x < MC - 2 ? coil : ION[D]);
    }
  }
  // Prong tips glint cyan.
  p.set(MC - 1, 0, coil);
  p.set(0, MC - 1, coil);
  p.set(13, MC - 1, coil);
  p.set(MC - 1, 13, coil);
  // The lamp on top.
  p.rect(MC - 1, 3, 2, 2, lamp);
  p.set(MC - 1, 3, lampCore);
}

proc(ION_SPRITES.mine, 14, 14, 4, (p, f) => {
  const on = f === 0;
  paintMine(p, on ? AMBER : AMBER_DIM, on ? WHITE : AMBER_DIM, ION[B], ION[L]);
});

proc(ION_SPRITES.mineHot, 14, 14, 2, (p, f) => {
  paintMine(p, f === 0 ? RED : WHITE, WHITE, ION[f === 0 ? H : L], WHITE);
});
