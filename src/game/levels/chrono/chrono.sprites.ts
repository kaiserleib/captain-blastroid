// Sector 9 art: the Syndicate's rift-tech roster (gunmetal and rust hulls with
// violet chrome and slow-time blue hourglasses and clock faces) and the Echo,
// a 2× violet/black/white mirror of whatever ship the player flies. Painted
// into index buffers like the Rock Hauler, lit from the top-left, 15-bit
// colors. Painted sizes are 2 px under the cell sizes: the outline adds 1 px
// per side (Stutterer 16×16, Bubble Mine 16×16, Rewinder 24×24, Echo 50×50).
import { SHIPS } from '../../../content/ships';
import { OUTLINE } from '../../../gfx/palette';
import { defineProcSprite, getSpriteEntry, type GridSpriteEntry } from '../../../gfx/sprite';
import {
  AMBERR,
  B,
  c,
  D,
  ECHO_R,
  GLOWR,
  GUN,
  H,
  L,
  Paint,
  proc,
  RUST,
  S,
  SLOWB,
  VIOLET,
  WHITE_I,
  type Mask,
  type Ramp5,
} from './paint';

export const CR_SPRITES = {
  stutterer: 'cr_stutterer',
  rewinder: 'cr_rewinder',
  clock: 'cr_rewind_clock',
  mine: 'cr_bubblemine',
  missile: 'cr_missile',
  drone: 'cr_echo_drone',
  shard: 'cr_echo_shard',
  pod: 'cr_echo_pod',
} as const;

/** Stutterer frames: 0–1 moving, 2–3 frozen, 4–5 frozen with the cross charged. */
export const STUTTER_FRAMES = { move: 0, freeze: 2, charged: 4 } as const;
/** Bubble Mine frames: 0–1 idle blink, 2–3 fuse warning. */
export const MINE_FRAMES = { idle: 0, warn: 2 } as const;
/** Clock frames: the hands step backward one eighth per frame. */
export const CLOCK_FRAMES = 8;
export const SHARD_FRAMES = 4;

/** The Echo of one ship: its hull at 2×, nose down, in the Echo palette. */
export function echoSpriteId(shipId: string): string {
  return `cr_echo_${shipId}`;
}

export const ECHO_SPRITE_IDS: readonly string[] = Object.keys(SHIPS).map(echoSpriteId);
export const CR_SPRITE_IDS: readonly string[] = [...Object.values(CR_SPRITES), ...ECHO_SPRITE_IDS];

function mirror(cx: number, m: (dx: number, y: number) => boolean): Mask {
  return (x, y) => m(Math.abs(x + 0.5 - cx), y);
}

// ---------------------------------------------------------------------------
// Stutterer (14×14): a squat gunmetal hex with rust side fins and a glass
// hourglass in its belly. Frozen, the sand lights up slow-time blue; with the
// cross charged, the four ports glow white.

const ST = 7;
const stBody = mirror(ST, (dx, y) => y >= 1 && y <= 12 && dx <= 5.2 - Math.abs(y - 6.5) * 0.45);
const stFin = mirror(ST, (dx, y) => dx >= 4.6 && dx <= 7 && y >= 4 && y <= 10 - (dx > 6 ? 2 : 0));
const stGlass = mirror(ST, (dx, y) => y >= 3 && y <= 10 && dx <= Math.abs(y - 6.5) * 0.7 + 0.6);

proc(CR_SPRITES.stutterer, 14, 14, 6, (p, f) => {
  const frozen = f >= 2;
  const charged = f >= 4;
  p.shape(0, 0, 13, 13, stFin, RUST);
  p.shape(0, 0, 13, 13, stBody, GUN);
  // The hourglass: dark glass, sand settling in the lower bulb.
  const sand = frozen ? SLOWB : VIOLET;
  for (let y = 3; y <= 10; y++) {
    for (let x = 0; x < 14; x++) {
      if (!stGlass(x, y)) continue;
      const lower = y >= 7;
      const k = lower ? (y >= 9 ? L : B) : y === 3 ? D : S;
      p.set(x, y, sand[k] as number);
    }
  }
  p.set(6, 6, sand[frozen ? H : L] as number);
  p.set(7, 7, sand[frozen ? H : B] as number);
  if (frozen) {
    p.set(5, 9, SLOWB[H] as number);
    p.set(8, 10, SLOWB[H] as number);
  }
  // Four ports (the cross ring): nose, tail and both fins.
  const port = charged ? (f === 4 ? WHITE_I : (SLOWB[H] as number)) : (GUN[S] as number);
  p.set(6, 12, port);
  p.set(7, 12, port);
  p.set(6, 1, port);
  p.set(7, 1, port);
  p.set(0, 7, port);
  p.set(13, 7, port);
  // Moving: thruster flicker on the top edge.
  if (!frozen) {
    p.set(4, 0, f === 0 ? (AMBERR[L] as number) : (AMBERR[B] as number));
    p.set(9, 0, f === 0 ? (AMBERR[B] as number) : (AMBERR[L] as number));
  }
});

// ---------------------------------------------------------------------------
// Rewinder (22×22): an interceptor-style delta with swept rust wings and a
// white clock face set into a violet chrome hull. The hands tick between frames.

const RW = 11;
const INKY = c('#201030');
const rwHull = mirror(RW, (dx, y) => y >= 0 && y <= 20 && dx <= 4.5 - Math.max(0, y - 14) * 0.55);
const rwWing = mirror(
  RW,
  (dx, y) => dx >= 3 && dx <= 11 && y >= 3 + dx * 0.55 && y <= 9 + dx * 0.3,
);
const rwFace = (x: number, y: number): boolean => {
  const dx = x + 0.5 - 11;
  const dy = y + 0.5 - 9.5;
  return dx * dx + dy * dy <= 3.6 * 3.6;
};

proc(CR_SPRITES.rewinder, 22, 22, 2, (p, f) => {
  p.shape(0, 0, 21, 21, rwWing, RUST);
  p.shape(0, 0, 21, 21, rwHull, VIOLET);
  // Wing-tip guns and the green faction eye under the nose.
  for (const x of [1, 20]) {
    p.set(x, 10, GUN[L] as number);
    p.set(x, 11, GUN[B] as number);
    p.set(x, 12, GUN[D] as number);
  }
  p.set(10, 17, GLOWR[f === 0 ? L : B] as number);
  p.set(11, 17, GLOWR[f === 0 ? B : L] as number);
  p.set(10, 18, GLOWR[D] as number);
  p.set(11, 18, GLOWR[D] as number);
  // The clock face: a lit dial with a dark rim and two hands from the hub.
  p.sphere(11, 9.5, 4.4, VIOLET, 0.3);
  for (let y = 5; y <= 14; y++)
    for (let x = 6; x <= 16; x++) if (rwFace(x, y)) p.set(x, y, WHITE_I);
  p.set(10, 6, SLOWB[D] as number);
  p.set(14, 9, SLOWB[D] as number);
  p.set(10, 13, SLOWB[D] as number);
  p.set(7, 9, SLOWB[D] as number);
  p.set(10, 9, INKY);
  if (f === 0) {
    p.set(10, 8, INKY);
    p.set(10, 7, INKY);
    p.set(11, 9, INKY);
  } else {
    p.set(9, 8, INKY);
    p.set(11, 10, INKY);
    p.set(12, 10, INKY);
  }
  // Twin engines on the top edge.
  for (const x of [8, 13]) p.set(x, 0, AMBERR[f === 0 ? L : B] as number);
});

// ---------------------------------------------------------------------------
// Rewind telegraph (16×16): a blue clock ring over the Rewinder whose hands
// spin backward, one eighth per frame.

proc(
  CR_SPRITES.clock,
  16,
  16,
  CLOCK_FRAMES,
  (p, f) => {
    const cx = 8;
    const cy = 8;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= 6.2 && d <= 7.6) p.set(x, y, (y < 7 ? SLOWB[H] : SLOWB[L]) as number);
      }
    }
    // Twelve ticks: the four quarters brighter.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * 5.2;
      const y = cy + Math.sin(a) * 5.2;
      p.set(x, y, (k % 3 === 0 ? WHITE_I : SLOWB[B]) as number);
    }
    // Counterclockwise: the minute hand steps back 45° per frame, the hour hand 15°.
    const am = -Math.PI / 2 - (f / CLOCK_FRAMES) * Math.PI * 2;
    const ah = -Math.PI / 2 - ((f / CLOCK_FRAMES) * (Math.PI * 2)) / 3 + 1.2;
    for (let i = 0; i <= 5; i++) p.set(cx + Math.cos(am) * i, cy + Math.sin(am) * i, WHITE_I);
    for (let i = 0; i <= 3; i++)
      p.set(cx + Math.cos(ah) * i, cy + Math.sin(ah) * i, SLOWB[H] as number);
    p.set(cx, cy, WHITE_I);
    // A backward arrowhead on the rim.
    const ax = cx + Math.cos(am + 0.5) * 7;
    const ay = cy + Math.sin(am + 0.5) * 7;
    p.set(ax, ay, WHITE_I);
  },
  0,
  true,
);

// ---------------------------------------------------------------------------
// Bubble Mine (14×14): a glass sphere of slow time in a gunmetal cage band.
// The core blinks; in the last second of its fuse the band lamps go amber.

proc(CR_SPRITES.mine, 14, 14, 4, (p, f) => {
  p.sphere(7, 7, 6.6, SLOWB, -0.05);
  // Cage: an equator band and two pole caps.
  for (let x = 1; x <= 12; x++) {
    p.set(x, 6, GUN[x < 5 ? L : B] as number);
    p.set(x, 7, GUN[x < 5 ? B : D] as number);
  }
  p.box(5, 0, 4, 2, GUN);
  p.box(5, 12, 4, 2, GUN);
  // Specular glint, and the slow-time core.
  p.set(4, 3, WHITE_I);
  p.set(5, 3, SLOWB[H] as number);
  p.set(4, 4, SLOWB[H] as number);
  const warn = f >= 2;
  const on = f % 2 === 0;
  const lamp = warn ? AMBERR : SLOWB;
  for (const x of [2, 11]) p.set(x, 6, lamp[on ? H : D] as number);
  p.set(7, 9, (on ? WHITE_I : SLOWB[L]) as number);
  p.set(6, 9, SLOWB[L] as number);
  p.set(7, 10, SLOWB[B] as number);
});

// ---------------------------------------------------------------------------
// Echo missile (6×10, 16 rotations): a violet dart, nose down, white tip.

proc(
  CR_SPRITES.missile,
  6,
  10,
  2,
  (p, f) => {
    const body = mirror(3, (dx, y) => y >= 2 && y <= 9 && dx <= (y >= 8 ? 2.6 - (y - 7) : 1.6));
    const fin = mirror(3, (dx, y) => y >= 2 && y <= 4 && dx <= 3);
    p.shape(0, 0, 5, 9, fin, ECHO_R);
    p.shape(0, 0, 5, 9, body, ECHO_R);
    p.set(2, 9, WHITE_I);
    p.set(3, 9, WHITE_I);
    p.set(2, 1, (f === 0 ? ECHO_R[H] : ECHO_R[L]) as number);
    p.set(3, 1, (f === 0 ? ECHO_R[L] : ECHO_R[H]) as number);
    if (f === 0) p.set(2, 0, ECHO_R[L] as number);
    else p.set(3, 0, ECHO_R[L] as number);
  },
  16,
);

// ---------------------------------------------------------------------------
// Echo blocker drone (10×10): a black glass orb with a white eye.

proc(CR_SPRITES.drone, 10, 10, 2, (p, f) => {
  p.sphere(5, 5, 4.8, ECHO_R, -0.1);
  p.set(4, 5, WHITE_I);
  p.set(5, 5, WHITE_I);
  p.set(4, 6, (f === 0 ? ECHO_R[L] : WHITE_I) as number);
  p.set(5, 6, ECHO_R[L] as number);
  p.set(2, 2, ECHO_R[H] as number);
});

// ---------------------------------------------------------------------------
// Shatter shard (6×6): a spinning glass triangle, four frames.

proc(
  CR_SPRITES.shard,
  6,
  6,
  SHARD_FRAMES,
  (p, f) => {
    const a = (f / SHARD_FRAMES) * Math.PI * 2;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        // A triangle whose apex turns with the frame.
        const dx = x + 0.5 - 3;
        const dy = y + 0.5 - 3;
        const u = dx * Math.cos(a) + dy * Math.sin(a);
        const v = -dx * Math.sin(a) + dy * Math.cos(a);
        if (u > -1.6 && Math.abs(v) < (2.2 - u) * 0.6) {
          p.set(x, y, (u < 0 ? ECHO_R[H] : v < 0 ? ECHO_R[L] : ECHO_R[B]) as number);
        }
      }
    }
  },
  0,
  false,
);

// ---------------------------------------------------------------------------
// Derived sprites: the Echo and the echo pod are recolored from the player's
// ship and the escape pod at bake time, so they always match their originals.

/** Luminance (0..1) → an Echo palette step: violet, black and white. */
export function echoStep(r: number, g: number, b: number): number {
  const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
  return lum < 0.16 ? S : lum < 0.36 ? D : lum < 0.58 ? B : lum < 0.8 ? L : H;
}

/** Rows a ship sprite spends on its flame strip (ships.sprites.ts and the Kestrel: 6). */
const FLAME_ROWS = 6;
export const ECHO_SIZE = 48;

function paintRecolored(
  p: Paint,
  src: GridSpriteEntry,
  frame: number,
  rows: number,
  scale: number,
  flipY: boolean,
  ox: number,
  oy: number,
  ramp: Ramp5,
): void {
  const px = src.pixels[frame] ?? src.pixels[0];
  if (px === undefined) return;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < px.w; x++) {
      const i = (y * px.w + x) * 4;
      if ((px.data[i + 3] as number) === 0) continue;
      const k = echoStep(px.data[i] as number, px.data[i + 1] as number, px.data[i + 2] as number);
      const ty = flipY ? rows - 1 - y : y;
      p.rect(ox + x * scale, oy + ty * scale, scale, scale, ramp[k] as number);
    }
  }
}

function defineEcho(shipId: string): void {
  defineProcSprite(
    echoSpriteId(shipId),
    ECHO_SIZE,
    ECHO_SIZE,
    (ctx, f) => {
      const p = new Paint(ECHO_SIZE, ECHO_SIZE);
      const src = getSpriteEntry(shipId);
      if (src !== undefined && src.kind === 'grid') {
        const rows = Math.max(1, src.h - FLAME_ROWS);
        const top = ECHO_SIZE - rows * 2;
        paintRecolored(p, src, 0, rows, 2, true, (ECHO_SIZE - src.w * 2) >> 1, top, ECHO_R);
        // Engines now point up: violet flames from each nozzle of the source's flame strip.
        const px = src.pixels[0];
        if (px !== undefined) {
          for (let x = 0; x < px.w; x++) {
            if ((px.data[(rows * px.w + x) * 4 + 3] as number) === 0) continue;
            const fx = ((ECHO_SIZE - src.w * 2) >> 1) + x * 2;
            const len = f === 0 ? 4 : 3;
            for (let k = 1; k <= len; k++) {
              const col = k === 1 ? WHITE_I : k <= 2 ? ECHO_R[H] : ECHO_R[L];
              p.rect(fx, top - k, 2, 1, col as number);
            }
          }
        }
        // Lit from the top-left: a white rim on the nose edge reads as the mirror's glint.
        for (let y = top; y < ECHO_SIZE; y++) {
          for (let x = 0; x < ECHO_SIZE; x++) {
            if (p.get(x, y) >= 0 && p.get(x - 1, y) < 0 && p.get(x, y - 1) < 0 && (x + y) % 3 === 0)
              p.set(x, y, WHITE_I);
          }
        }
      }
      p.flush(ctx);
    },
    { frames: 2, outline: OUTLINE },
  );
}

for (const id of Object.keys(SHIPS)) defineEcho(id);

defineProcSprite(
  CR_SPRITES.pod,
  12,
  15,
  (ctx, f) => {
    const p = new Paint(12, 15);
    const src = getSpriteEntry('escape_pod');
    if (src !== undefined && src.kind === 'grid')
      paintRecolored(p, src, f, src.h, 1, false, 0, 0, SLOWB);
    p.flush(ctx);
  },
  { frames: 2 },
);
