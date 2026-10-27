// The Warrens (T39): Syndicate mining hardware in ochre, umber and gunmetal
// with amber work lamps, plus the cave bats. Painted procedurally (paint.ts),
// lit from the top-left. Painted sizes are 2 px under the cell sizes (the
// outline adds 1 px per side): turret 16×16 with a 14×14 rotating barrel,
// borer 16×16, bat 16×12, Wyrm head 32×32 and segments 16×16.
// Orientation: the turret base faces right (left-wall mount, flipped for the
// right wall), the borer drills right, and the Wyrm's parts point up
// (rotation 0), turned by `velocityRot`.
import { B, c, D, H, hash01, L, proc, ramp5, S, type Mask, type Paint } from './paint';

export const WR_SPRITES = {
  turret: 'wr_turret',
  turretGun: 'wr_turret_gun',
  borer: 'wr_borer',
  bat: 'wr_bat',
  head: 'wr_wyrm_head',
  seg: 'wr_wyrm_seg',
} as const;

export const WR_SPRITE_IDS: readonly string[] = Object.values(WR_SPRITES);

/** Wyrm head frames. */
export const HEAD_CLOSED = 0;
export const HEAD_OPEN = 1;

export const OCHRE = ramp5('#281808', '#583810', '#986828', '#c89848', '#f0d080');
export const UMBER = ramp5('#180c08', '#302010', '#584028', '#806040', '#b09068');
export const GUN = ramp5('#100c18', '#202028', '#404858', '#687080', '#a0a8b8');
export const RUST = ramp5('#300808', '#601810', '#a03020', '#d05830', '#f09058');
export const LAMP = ramp5('#401000', '#803000', '#d06000', '#f8a030', '#f8e8a0');
export const FUR = ramp5('#100810', '#281828', '#483848', '#706070', '#a090a0');
export const GLOWG = ramp5('#103008', '#307810', '#90f040', '#e0f8a0', '#f8f8f8');
export const MAW = ramp5('#200000', '#500808', '#a01810', '#f05020', '#f8c060');
export const HAZARD = c('#f8c800');
export const HAZARD_DARK = c('#181010');
export const WHITE = c('#f8f8f8');
export const EYE = c('#f83030');
export const EYE_DIM = c('#801818');

function mirror(cx: number, m: (dx: number, y: number) => boolean): Mask {
  return (x, y) => m(Math.abs(x + 0.5 - cx), y);
}

// ---------------------------------------------------------------------------
// Wall Turret base (14×14): a gunmetal mounting plate bolted to the wall on
// the left, a hazard-striped collar, an ochre dome and an amber status lamp
// that blinks between frames. The barrel is a separate rotating sprite.

/** Dome center in the base sprite's cell, px from its center (the barrel pivots here). */
export const TURRET_PIVOT = { x: 1, y: 0 } as const;

proc(WR_SPRITES.turret, 14, 14, 2, (p, f) => {
  const plate: Mask = (x, y) => x >= 0 && x <= 3 && y >= 0 && y <= 13;
  p.shape(plate, GUN);
  for (const y of [2, 11]) p.rivet(1, y, GUN);
  // Hazard collar: alternating yellow and black diagonal bands.
  for (let y = 2; y <= 11; y++) {
    for (let x = 4; x <= 5; x++) p.set(x, y, (x + y) % 4 < 2 ? HAZARD : HAZARD_DARK);
  }
  p.sphere(8.5, 7, 5, OCHRE, 0.05, (x) => x >= 5);
  // A seam around the dome and the lamp on its upper face.
  for (let y = 3; y <= 11; y++)
    if (p.get(9, y) >= 0 && (y === 3 || y === 11)) p.set(9, y, OCHRE[D]);
  p.set(9, 4, f === 0 ? LAMP[H] : LAMP[D]);
  p.set(10, 4, f === 0 ? LAMP[L] : LAMP[S]);
  p.speckle(OCHRE[B], OCHRE[D], (x, y) => hash01(x, y, 11) < 0.12);
});

// Barrel (12×12, rotating): points up from the pivot, a twin-ring muzzle.
proc(
  WR_SPRITES.turretGun,
  12,
  12,
  1,
  (p) => {
    p.sphere(6, 6.5, 2.6, GUN, 0.1);
    p.cylinder(5, 0, 2, 6, GUN);
    p.set(4, 1, GUN[L]);
    p.set(7, 1, GUN[D]);
    p.set(5, 0, GUN[H]);
    p.set(6, 0, GUN[B]);
    p.set(5, 3, OCHRE[L]);
    p.set(6, 3, OCHRE[D]);
  },
  16,
);

// ---------------------------------------------------------------------------
// Borer (14×14): a stubby rust crawler with treads, drilling right. The
// gunmetal bit's spiral groove advances between frames.

const bodyB: Mask = (x, y) =>
  x >= 1 && x <= 8 && y >= 3 && y <= 10 && !(x === 1 && (y === 3 || y === 10));
const treadB: Mask = (x, y) =>
  x >= 0 &&
  x <= 8 &&
  (y === 2 || y === 11 || y === 1 || y === 12) &&
  !(x === 0 && (y === 1 || y === 12));
const bitB: Mask = (x, y) => {
  if (x < 9 || x > 13) return false;
  const half = 4.5 - (x - 9) * 0.95;
  return Math.abs(y + 0.5 - 7) <= half;
};

proc(WR_SPRITES.borer, 14, 14, 2, (p, f) => {
  p.shape(treadB, UMBER);
  for (let x = f; x <= 8; x += 2) {
    if (treadB(x, 1)) p.set(x, 1, UMBER[S]);
    if (treadB(x, 12)) p.set(x, 12, UMBER[S]);
  }
  p.shape(bodyB, RUST);
  p.shape(bitB, GUN);
  // Spiral grooves: diagonal dark lines that march with the frame.
  for (let x = 9; x <= 13; x++) {
    for (let y = 2; y <= 12; y++) {
      if (!bitB(x, y)) continue;
      if ((x + y + f * 2) % 4 === 0) p.set(x, y, GUN[S]);
      else if ((x + y + f * 2) % 4 === 1) p.set(x, y, GUN[L]);
    }
  }
  p.set(13, 7, WHITE);
  // Exhaust stack and a green cab slit.
  p.rect(2, 5, 2, 4, RUST[D]);
  p.set(2, 5, RUST[S]);
  p.set(6, 5, GLOWG[f === 0 ? L : B]);
  p.set(7, 5, GLOWG[B]);
  p.set(6, 6, GLOWG[D]);
  p.speckle(RUST[B], RUST[D], (x, y) => hash01(x, y, 7) < 0.12);
});

// ---------------------------------------------------------------------------
// Cave Bat (14×10): a furry violet-grey body, red eyes, leathery umber wings
// up (frame 0) or down (frame 1) with lit finger bones.

const BC = 7;
const batBody = mirror(
  BC,
  (dx, y) => (y >= 3 && y <= 7 && dx <= 1.8) || (y === 2 && dx >= 0.8 && dx <= 1.6),
);

function wingMask(up: boolean): Mask {
  return mirror(BC, (dx, y) => {
    if (dx < 1.5 || dx > 7) return false;
    const t = (dx - 1.5) / 5.5;
    // The leading edge rises (frame 0) or droops (frame 1) toward the tip.
    const top = up ? 4 - t * 4 : 3 + t * 3;
    const bot = up ? 6 - t * 1.5 + (dx > 5.5 ? 1 : 0) : 6 + t * 3;
    return y >= top && y <= bot;
  });
}

proc(WR_SPRITES.bat, 14, 10, 2, (p, f) => {
  const wing = wingMask(f === 0);
  p.shape(wing, UMBER, D);
  // Finger bones from the shoulder to the wing's outer edge.
  for (let dx = 2; dx <= 6; dx++) {
    for (const s of [-1, 1]) {
      const x = BC + (s < 0 ? -dx - 1 : dx);
      for (let y = 0; y < 10; y++) {
        if (!wing(x, y) || wing(x, y - 1)) continue;
        p.set(x, y, UMBER[L]);
        break;
      }
    }
  }
  p.shape(batBody, FUR);
  p.set(BC - 1, 4, EYE);
  p.set(BC, 4, f === 0 ? EYE : EYE_DIM);
  p.set(BC - 1, 6, FUR[S]);
});

// ---------------------------------------------------------------------------
// Wyrm head (30×30, pointing up): a gunmetal skull of overlapping plates on a
// ribbed collar, green sensor eyes on the cheeks, and an ochre drill-beak.
// Frame 0: the beak is closed (armored). Frame 1: the beak splits into two
// flared jaws around a glowing maw ringed with teeth (vulnerable).

const HC = 15;
const collar = mirror(
  HC,
  (dx, y) => y >= 21 && y <= 29 && dx <= 9 - (y >= 27 ? (y - 26) * 0.8 : 0),
);
const skull: Mask = (x, y) => {
  const nx = (x + 0.5 - HC) / 12.5;
  const ny = (y + 0.5 - 16) / 10.5;
  return nx * nx + ny * ny <= 1;
};
const beak = mirror(HC, (dx, y) => y >= 0 && y <= 13 && dx <= 1 + y * 0.62);
const jaw = mirror(HC, (dx, y) => {
  if (y < 1 || y > 14) return false;
  const inner = 5.5 - y * 0.15;
  const outer = 9.5 - Math.abs(y - 6) * 0.35;
  return dx >= inner && dx <= outer;
});
const mawM: Mask = (x, y) => {
  const nx = (x + 0.5 - HC) / 5.2;
  const ny = (y + 0.5 - 9) / 6.2;
  return nx * nx + ny * ny <= 1;
};

function paintHead(p: Paint, open: boolean): void {
  p.cylinder(6, 21, 19, 9, GUN, collar);
  for (let y = 22; y <= 28; y += 2) {
    for (let x = 0; x < 30; x++) if (collar(x, y) && p.get(x, y) >= 0) p.set(x, y, GUN[S]);
  }
  p.sphere(HC, 16, 12.5, GUN, 0.02, skull);
  // Plate seams: two arcs across the skull.
  for (let x = 4; x <= 26; x++) {
    const y1 = Math.round(19 + Math.abs(x + 0.5 - HC) * 0.18);
    if (skull(x, y1)) p.set(x, y1, GUN[S]);
    const y2 = Math.round(13 + Math.abs(x + 0.5 - HC) * 0.3);
    if (skull(x, y2) && Math.abs(x + 0.5 - HC) > 6) p.set(x, y2, GUN[D]);
  }
  for (const [x, y] of [
    [8, 21],
    [21, 21],
    [6, 16],
    [23, 16],
  ] as const) {
    p.rivet(x, y, GUN);
  }
  // Sensor eyes on the cheeks.
  for (const x of [5, 24]) {
    p.set(x, 18, GLOWG[open ? H : L]);
    p.set(x + (x < HC ? 1 : -1), 18, GLOWG[B]);
    p.set(x, 19, GLOWG[D]);
  }
  if (!open) {
    p.shape(beak, OCHRE);
    // Spiral flutes down the beak.
    for (let y = 1; y <= 13; y++) {
      for (let x = 0; x < 30; x++) {
        if (!beak(x, y)) continue;
        const k = (x - y * 0.5 + 40) % 3;
        if (k < 0.6) p.set(x, y, OCHRE[D]);
      }
    }
    p.set(HC - 1, 0, OCHRE[H]);
    p.set(HC, 0, WHITE);
    return;
  }
  // Open: a red-hot maw with a ring of teeth, jaws flared to either side.
  p.sphere(HC, 9, 6, MAW, -0.25, mawM);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      if (!mawM(x, y)) continue;
      const rim = !mawM(x, y - 1) || !mawM(x, y + 1) || !mawM(x - 1, y) || !mawM(x + 1, y);
      if (rim) p.set(x, y, (x + y) % 2 === 0 ? WHITE : OCHRE[H]);
    }
  }
  p.set(HC - 1, 9, MAW[H]);
  p.set(HC, 9, WHITE);
  p.set(HC, 10, MAW[H]);
  p.shape(jaw, OCHRE);
  for (const x of [HC - 9, HC + 8]) p.set(x, 2, WHITE);
}

proc(WR_SPRITES.head, 30, 30, 2, (p, f) => paintHead(p, f === HEAD_OPEN), 16);

// ---------------------------------------------------------------------------
// Wyrm segment (14×14, pointing up): an ochre armor ring around a gunmetal
// core band, short side fins, and an amber vent that pulses between frames.

const SC = 7;
const fins = mirror(SC, (dx, y) => dx >= 5.5 && dx <= 7 && y >= 5 && y <= 8 - (dx > 6.5 ? 1 : 0));
const shell: Mask = (x, y) => {
  const nx = (x + 0.5 - SC) / 5.6;
  const ny = (y + 0.5 - 7) / 6.2;
  return nx * nx + ny * ny <= 1;
};

proc(
  WR_SPRITES.seg,
  14,
  14,
  2,
  (p, f) => {
    p.shape(fins, GUN);
    p.sphere(SC, 7, 6.2, OCHRE, 0, shell);
    // The core band across the body, and its vent.
    for (let x = 1; x <= 12; x++) {
      for (const y of [6, 7]) {
        if (!shell(x, y)) continue;
        p.set(x, y, y === 6 ? (x < SC ? GUN[L] : GUN[B]) : GUN[D]);
      }
    }
    p.set(SC - 1, 6, f === 0 ? LAMP[H] : LAMP[B]);
    p.set(SC, 6, f === 0 ? LAMP[L] : LAMP[D]);
    // Plate seams fore and aft.
    for (let x = 3; x <= 10; x++) {
      if (shell(x, 3)) p.set(x, 3, OCHRE[D]);
      if (shell(x, 10)) p.set(x, 10, OCHRE[S]);
    }
    p.speckle(OCHRE[B], OCHRE[D], (x, y) => hash01(x, y, 23) < 0.1);
  },
  16,
);
