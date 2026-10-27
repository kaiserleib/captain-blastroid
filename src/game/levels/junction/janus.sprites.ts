// Janus (≈128×64 with its generators): a two-faced Syndicate gate station.
// A gunmetal-and-bronze arch hull with two face sockets; Dawn (left) is a gold
// sun mask, Dusk (right) a violet moon mask. Ring generators are lime coil
// drums that sit in front of the wall's ends. Separate part sprites so faces
// and generators flash and break on their own. Painted sizes are 2 px under
// the cells (the outline adds 1 px per side).
import { B, c, D, H, hash01, L, proc, ramp5, S, type Mask, type Paint, type Ramp5 } from './paint';
import { GUN, LIME, ORANGE, VERD, VIO, WHITE } from './junction.sprites';

export const JANUS_SPRITES = {
  hull: 'wj_janus_hull',
  dawn: 'wj_janus_dawn',
  dusk: 'wj_janus_dusk',
  dawnCracked: 'wj_janus_dawn_cracked',
  duskCracked: 'wj_janus_dusk_cracked',
  gen: 'wj_janus_gen',
  genWreck: 'wj_janus_gen_wreck',
} as const;

export const JANUS_SPRITE_IDS: readonly string[] = Object.values(JANUS_SPRITES);

const BRONZE = ramp5('#201008', '#583010', '#906028', '#c89048', '#f0d088');
const GOLD = ramp5('#402000', '#906000', '#e0a818', '#f8d050', '#f8f8b8');
const MOON = ramp5('#101030', '#283070', '#5060b0', '#90a0e0', '#d8e0f8');
const SOOT = c('#181010');
const EMBER = c('#f85818');

function mirror(cx: number, m: (dx: number, y: number) => boolean): Mask {
  return (x, y) => m(Math.abs(x + 0.5 - cx), y);
}

// ---------------------------------------------------------------------------
// Hull (126×54 painted). Face sockets centered at (33, 23) and (93, 23), the
// throat (ring and spiral origin) at (63, 47).

const HW = 126;
const HC = 63;
const hullBody = mirror(HC, (dx, y) => {
  if (y < 4 || y > 52) return false;
  // A shallow arch: full width in the middle rows, tapering at the top and
  // bottom corners, with a notch where the throat hangs.
  const top = y < 14 ? 62 - (14 - y) * 2.2 : 62;
  const bot = y > 40 ? 62 - (y - 40) * 3.2 : 62;
  return dx <= Math.min(top, bot) || (dx <= 9 && y <= 52);
});
const hullSpine = mirror(HC, (dx, y) => dx <= 12 && y >= 0 && y <= 10);
const socket =
  (cx: number): Mask =>
  (x, y) =>
    Math.hypot(x + 0.5 - cx, y + 0.5 - 23) <= 15;
const sockets: Mask = (x, y) => socket(33)(x, y) || socket(93)(x, y);
const throat = mirror(HC, (dx, y) => y >= 40 && y <= 53 && dx <= 7 - (y > 50 ? (y - 50) * 1.5 : 0));

proc(JANUS_SPRITES.hull, HW, 54, 2, (p, f) => {
  p.shape(hullBody, GUN);
  p.shape(hullSpine, BRONZE);
  // Bronze trim along the arch's lower edge, and panel seams.
  for (let x = 0; x < HW; x++) {
    for (let y = 30; y < 54; y++) {
      if (hullBody(x, y) && !hullBody(x, y + 1)) {
        p.set(x, y, BRONZE[L]);
        p.set(x, y - 1, BRONZE[B]);
      }
    }
  }
  for (const x of [16, 50, 76, 110]) {
    for (let y = 8; y < 40; y++) if (hullBody(x, y) && !sockets(x, y)) p.set(x, y, GUN[S]);
  }
  // The sockets: dark recessed rings with bronze lips (the faces sit in them).
  for (let y = 0; y < 54; y++) {
    for (let x = 0; x < HW; x++) {
      if (!sockets(x, y)) continue;
      const d = Math.min(
        Math.hypot(x + 0.5 - 33, y + 0.5 - 23),
        Math.hypot(x + 0.5 - 93, y + 0.5 - 23),
      );
      p.set(x, y, d > 13.5 ? BRONZE[y < 23 ? L : D] : d > 12.5 ? BRONZE[S] : GUN[S]);
    }
  }
  // The throat: a verdigris nozzle with a lime glow inside.
  p.shape(throat, VERD);
  p.rect(HC - 3, 48, 6, 4, LIME[f === 0 ? B : D]);
  p.rect(HC - 1, 49, 2, 2, f === 0 ? LIME[H] : LIME[L]);
  // Running lights along the spine.
  for (let i = 0; i < 5; i++) p.set(HC - 8 + i * 4, 6, (i + f) % 2 === 0 ? LIME[L] : LIME[D]);
  for (const [x, y] of [
    [6, 20],
    [119, 20],
    [24, 42],
    [101, 42],
    [HC - 10, 12],
    [HC + 9, 12],
  ] as const) {
    p.rivet(x, y, GUN);
  }
  p.speckle(GUN[B], GUN[D], (x, y) => hash01(x, y, 31) < 0.06);
  p.speckle(BRONZE[B], BRONZE[D], (x, y) => hash01(x, y, 37) < 0.1);
});

// ---------------------------------------------------------------------------
// Faces (24×24 painted): a sphere-lit mask with brow, eyes and mouth slits.
// Frame 1 lights the eyes. The cracked look is the mask split and smoking.

const FC = 12;

function paintFace(p: Paint, r: Ramp5, eye: Ramp5, f: number, sun: boolean): void {
  p.sphere(FC, FC, 11.2, r, 0.05);
  if (sun) {
    // Sun rays: notches round the rim.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      p.set(FC + Math.cos(a) * 10.6 - 0.5, FC + Math.sin(a) * 10.6 - 0.5, r[H]);
    }
  } else {
    // A crescent shadow across the moon's right side.
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        if (p.get(x, y) < 0) continue;
        if (Math.hypot(x + 0.5 - (FC + 5), y + 0.5 - (FC - 2)) <= 9)
          p.set(x, y, r[(x + y) % 2 ? S : D]);
      }
    }
  }
  // Brow ridge, eyes, mouth.
  for (let x = 5; x <= 18; x++) p.set(x, 8, r[S]);
  for (const ex of [7, 15]) {
    p.rect(ex, 10, 3, 2, eye[f === 0 ? D : L]);
    p.set(ex + 1, 10, f === 0 ? eye[B] : WHITE);
  }
  for (let x = 9; x <= 14; x++) p.set(x, 17, r[S]);
  p.set(8, 16, r[S]);
  p.set(15, 16, r[S]);
}

proc(JANUS_SPRITES.dawn, 24, 24, 2, (p, f) => paintFace(p, GOLD, ORANGE, f, true));
proc(JANUS_SPRITES.dusk, 24, 24, 2, (p, f) => paintFace(p, MOON, VIO, f, false));

function crack(p: Paint, f: number): void {
  // A jagged split down the middle, embers in it, soot around.
  let x = FC;
  for (let y = 2; y < 22; y++) {
    x += ((y * 7) % 5) - 2 > 0 ? 1 : -1;
    if (x < FC - 3) x = FC - 2;
    if (x > FC + 3) x = FC + 2;
    if (p.get(x, y) < 0) continue;
    p.set(x, y, SOOT);
    p.set(x + 1, y, (y + f) % 3 === 0 ? EMBER : SOOT);
  }
  p.speckle(p.get(6, 14), SOOT, (xx, yy) => hash01(xx, yy, 41 + f) < 0.25);
}

proc(JANUS_SPRITES.dawnCracked, 24, 24, 2, (p, f) => {
  paintFace(p, GOLD, ORANGE, 0, true);
  crack(p, f);
});
proc(JANUS_SPRITES.duskCracked, 24, 24, 2, (p, f) => {
  paintFace(p, MOON, VIO, 0, false);
  crack(p, f);
});

// ---------------------------------------------------------------------------
// Ring generator (16×16 painted): a lime coil drum in a gunmetal cradle,
// coils pulsing. The wreck is the cradle with a burnt, open drum.

const GC = 8;
const genCradle = mirror(
  GC,
  (dx, y) =>
    (y >= 11 && y <= 15 && dx <= 7.5 - (y === 15 ? 1 : 0)) || (dx >= 5.5 && dx <= 7.5 && y >= 3),
);

proc(JANUS_SPRITES.gen, 16, 16, 2, (p, f) => {
  p.shape(genCradle, GUN);
  p.cylinder(GC - 5, 2, 10, 10, VERD);
  for (let y = 3; y <= 10; y += 2) {
    for (let x = GC - 4; x <= GC + 3; x++) p.set(x, y, LIME[(y + f) % 4 === 1 ? L : B]);
  }
  p.rect(GC - 1, 5, 2, 3, f === 0 ? WHITE : LIME[H]);
  p.rivet(2, 13, GUN);
  p.rivet(13, 13, GUN);
});

proc(JANUS_SPRITES.genWreck, 16, 16, 2, (p, f) => {
  p.shape(genCradle, GUN);
  for (let y = 4; y <= 11; y++) {
    for (let x = GC - 4; x <= GC + 3; x++) {
      if (hash01(x, y, 53) < 0.35) continue;
      p.set(x, y, hash01(x, y, 59 + f) < 0.2 ? EMBER : SOOT);
    }
  }
  p.speckle(GUN[B], SOOT, (x, y) => hash01(x, y, 61) < 0.2);
});
