// The Foundry: Syndicate shipyard machinery in rust, black steel and molten
// orange. Every sprite is lit from the top-left; glows are the furnace's
// orange and white-hot yellow, so nothing reads like an enemy bullet's
// magenta. The Architect's parts carry a hint of each form's honored boss:
// tow cyan on the scaffold arms, violet on the singularity engine, and the
// portal orange-and-cyan on the paradox core.
import { B, c, D, H, L, proc, ramp, S, type Paint } from './paint';

export const RUST5 = ramp('#300808', '#601810', '#983020', '#c85830', '#f09058');
export const STEEL5 = ramp('#080810', '#202028', '#383848', '#606878', '#a0a8b8');
export const MOLTEN5 = ramp('#581000', '#a83000', '#f07000', '#f8b020', '#f8f0a0');
export const VIOLET5 = ramp('#180828', '#382068', '#6840b0', '#a070e8', '#d8b8f8');
export const TOW5 = ramp('#002830', '#086068', '#10a0a8', '#58e0e0', '#c8f8f8');
const WHITE = c('#f8f8f8');
const INK = c('#100818');

export const FD_SPRITES = {
  riveter: 'fd_riveter',
  crane: 'fd_crane',
  sentinel: 'fd_sentinel',
  archFrame: 'fd_arch_frame',
  archArm: 'fd_arch_arm',
  archCore1: 'fd_arch_core1',
  archPylon: 'fd_arch_pylon',
  archCore2: 'fd_arch_core2',
  archCore3: 'fd_arch_core3',
  wreck: 'fd_arch_wreck',
  gantry: 'fd_gantry',
} as const;

/** Crane frames: 0–1 idle running lights, 2–3 the hook glowing before a fling. */
export const CRANE_FRAMES = { idle: 0, hot: 2 } as const;
/** Arm frames: 0–1 idle, 2–3 the emitter glowing before a throw. */
export const ARM_FRAMES = { idle: 0, hot: 2 } as const;
/** Core 1 frames: 0–1 shuttered (armored), 2–3 open. */
export const CORE1_FRAMES = { shut: 0, open: 2 } as const;
export const CORE3_FRAMES = 4;

export const FD_SPRITE_IDS: readonly string[] = Object.values(FD_SPRITES);

// ---------------------------------------------------------------------------
// Riveter 12×12: a squat rivet-gun drone on a conveyor, its muzzle glowing.

proc(FD_SPRITES.riveter, 12, 12, 2, (p: Paint, f) => {
  p.shape((x, y) => x >= 1 && x <= 10 && y >= 2 && y <= 8 && !(y === 2 && (x < 3 || x > 8)), RUST5);
  // Steel treads underneath.
  p.box(0, 8, 12, 3, STEEL5, D);
  for (let x = 1; x < 12; x += 3) p.set(x + (f & 1), 9, STEEL5[H]);
  // The rivet gun nose and its glowing tip (alternates hot / warm).
  p.box(4, 0, 4, 3, STEEL5);
  p.set(5, 0, f === 0 ? MOLTEN5[H] : MOLTEN5[L]);
  p.set(6, 0, f === 0 ? MOLTEN5[L] : MOLTEN5[B]);
  p.rivet(3, 4, RUST5);
  p.rivet(8, 4, RUST5);
  p.set(5, 5, MOLTEN5[B]);
  p.set(6, 5, MOLTEN5[D]);
});

// ---------------------------------------------------------------------------
// Crane 26×22: a gantry trolley with a two-fingered grab hook below it.

function paintCrane(p: Paint, f: number): void {
  const hot = f >= 2;
  // Trolley body: a wide rust box with steel rails.
  p.box(3, 2, 20, 8, RUST5);
  p.box(0, 4, 26, 3, STEEL5);
  for (let x = 2; x < 26; x += 4) p.rivet(x, 4, STEEL5);
  // Cab window, Syndicate green.
  p.box(9, 3, 8, 3, STEEL5, D);
  p.set(10, 4, c('#90f040'));
  p.set(11, 4, c('#e0f8a0'));
  // Running lights at the rail ends.
  const on = (f & 1) === 0;
  p.set(0, 5, on ? MOLTEN5[H] : MOLTEN5[D]);
  p.set(25, 5, on ? MOLTEN5[D] : MOLTEN5[H]);
  // Cable and hook.
  for (let y = 10; y < 15; y++) p.set(12 + (y & 1), y, STEEL5[L]);
  p.box(9, 14, 8, 3, STEEL5);
  const glow = hot ? MOLTEN5 : TOW5;
  p.set(12, 15, glow[H]);
  p.set(13, 15, glow[L]);
  // Grab fingers.
  for (let i = 0; i < 4; i++) {
    p.set(9 - (i >> 1), 17 + i, STEEL5[i < 2 ? L : B]);
    p.set(16 + (i >> 1), 17 + i, STEEL5[i < 2 ? B : D]);
  }
  if (hot) {
    p.set(12, 18, MOLTEN5[L]);
    p.set(13, 18, MOLTEN5[B]);
  }
}

proc(FD_SPRITES.crane, 26, 22, 4, paintCrane);

// ---------------------------------------------------------------------------
// Sentinel 20×20: a heavy round gun turret. The shield arc and the barrel are
// drawn live along its facing; the hull is round so any facing reads.

proc(FD_SPRITES.sentinel, 20, 20, 2, (p, f) => {
  p.sphere(10, 10, 9, 9, STEEL5, 0.05);
  // Rust armor collar.
  p.ring(10, 10, 7.5, RUST5[L], Math.PI * 1.05, Math.PI * 1.75);
  p.ring(10, 10, 7.5, RUST5[D], Math.PI * 0.05, Math.PI * 0.95);
  p.ring(10, 10, 6.5, RUST5[B]);
  // Hot core eye (pulses).
  p.sphere(10, 10, 3.2, 3.2, MOLTEN5, f === 0 ? 0.25 : 0);
  p.set(9, 9, WHITE);
  for (const [x, y] of [
    [4, 4],
    [15, 4],
    [4, 15],
    [15, 15],
  ] as const)
    p.rivet(x, y, STEEL5);
});

// ---------------------------------------------------------------------------
// The Architect.

/** Scaffold truss 120×16: the girder the arms hang from (not damageable). */
proc(
  FD_SPRITES.archFrame,
  120,
  16,
  1,
  (p) => {
    p.box(0, 2, 120, 4, STEEL5);
    p.box(0, 10, 120, 4, STEEL5, D);
    // Diagonal lattice between the chords.
    for (let x = 0; x < 120; x += 10) {
      for (let k = 0; k < 4; k++) {
        p.set(x + k + 1, 6 + k, RUST5[k < 2 ? L : B]);
        p.set(x + 9 - k, 6 + k, RUST5[D]);
      }
      p.rivet(x + 1, 3, STEEL5);
    }
    // Hazard stripes at the ends.
    for (let x = 0; x < 8; x++) {
      const col = ((x >> 1) & 1) === 0 ? MOLTEN5[L] : INK;
      p.set(x, 0, col);
      p.set(x, 1, col);
      p.set(119 - x, 0, col);
      p.set(119 - x, 1, col);
    }
  },
  false,
);

/** Arm 22×22: a crane head with a tow emitter (cyan), glowing orange before a throw. */
proc(FD_SPRITES.archArm, 22, 22, 4, (p, f) => {
  const hot = f >= 2;
  p.box(3, 0, 16, 6, STEEL5);
  p.shape(
    (x, y) => y >= 5 && y <= 16 && x >= 4 + ((y - 5) >> 2) && x <= 17 - ((y - 5) >> 2),
    RUST5,
  );
  p.rivet(6, 7, RUST5);
  p.rivet(14, 7, RUST5);
  const g = hot ? MOLTEN5 : TOW5;
  p.sphere(11, 14, 4, 4, g, (f & 1) === 0 ? 0.25 : 0.05);
  p.set(10, 13, WHITE);
  // Claws.
  for (let i = 0; i < 4; i++) {
    p.set(5 - (i >> 1), 17 + i, STEEL5[L]);
    p.set(16 + (i >> 1), 17 + i, STEEL5[B]);
  }
});

/** Core 1 30×30: the scaffold hub. Shuttered (armored) or open with the escape core's eye. */
proc(FD_SPRITES.archCore1, 30, 30, 4, (p, f) => {
  const open = f >= 2;
  p.sphere(15, 15, 14, 14, STEEL5, 0);
  p.ring(15, 15, 11, RUST5[B]);
  p.ring(15, 15, 12, RUST5[D]);
  if (open) {
    p.sphere(15, 15, 7, 7, MOLTEN5, (f & 1) === 0 ? 0.3 : 0.1);
    p.set(13, 12, WHITE);
    p.set(14, 12, WHITE);
  } else {
    // Iris shutters: four bevelled leaves.
    p.shape((x, y) => Math.hypot(x + 0.5 - 15, y + 0.5 - 15) < 8 && Math.abs(x - y) > 0, RUST5);
    p.set(15, 15, (f & 1) === 0 ? MOLTEN5[L] : MOLTEN5[B]);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    p.rivet(15 + Math.cos(a) * 13 - 0.5, 15 + Math.sin(a) * 13 - 0.5, STEEL5);
  }
});

/** Pylon 12×18: a field capacitor on a stalk, violet charge. */
proc(FD_SPRITES.archPylon, 12, 18, 2, (p, f) => {
  p.box(4, 0, 4, 18, STEEL5, D);
  p.box(1, 3, 10, 9, RUST5);
  p.sphere(6, 7.5, 3.4, 3.4, VIOLET5, f === 0 ? 0.3 : 0.05);
  p.set(5, 6, WHITE);
  p.box(2, 14, 8, 3, STEEL5);
});

/** Core 2 28×28: the singularity engine, a violet heart in black steel. */
proc(FD_SPRITES.archCore2, 28, 28, 2, (p, f) => {
  p.sphere(14, 14, 13, 13, STEEL5, -0.05);
  p.ring(14, 14, 10, VIOLET5[D]);
  p.ring(14, 14, 11, RUST5[B]);
  p.sphere(14, 14, 6.5, 6.5, VIOLET5, f === 0 ? 0.3 : 0.1);
  p.sphere(14, 14, 2.5, 2.5, ramp('#000000', '#080010', '#180828', '#382068', '#6840b0'), 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.rivet(14 + Math.cos(a) * 12 - 0.5, 14 + Math.sin(a) * 12 - 0.5, STEEL5);
  }
});

/** Core 3 22×22: the bare paradox core, white-hot with portal orange and cyan rings that turn. */
proc(FD_SPRITES.archCore3, 22, 22, CORE3_FRAMES, (p, f) => {
  p.sphere(11, 11, 10, 10, MOLTEN5, 0.15);
  const a0 = (f / CORE3_FRAMES) * Math.PI;
  p.ring(11, 11, 8, c('#f88020'), a0, a0 + Math.PI);
  p.ring(11, 11, 8, c('#40e0f8'), a0 + Math.PI, a0 + Math.PI * 2);
  p.sphere(11, 11, 4, 4, ramp('#f8b020', '#f8d860', '#f8f0a0', '#f8f8e0', '#f8f8f8'), 0.2);
  p.set(9, 9, WHITE);
});

/** Falling scaffold wreckage 14×10 (2 frames). */
proc(FD_SPRITES.wreck, 14, 10, 2, (p, f) => {
  p.shape((x, y) => y >= 2 && y <= 7 && x >= 1 + (y & 1) && x <= 12 - ((y + f) & 1), STEEL5, D);
  p.set(4 + f * 3, 4, MOLTEN5[L]);
  p.set(5 + f * 3, 4, MOLTEN5[B]);
  p.rivet(9, 3, RUST5);
});

/** Yard gantry 40×120 silhouette (no outline; drawn dark behind the action). */
proc(
  FD_SPRITES.gantry,
  40,
  120,
  2,
  (p, f) => {
    const dark = ramp('#080810', '#100c18', '#181820', '#202028', '#302828');
    p.box(2, 0, 6, 120, dark, D);
    p.box(32, 0, 6, 120, dark, D);
    for (let y = 4; y < 120; y += 16) {
      for (let k = 0; k < 24; k++) {
        p.set(8 + k, y + (k >> 1), dark[S]);
        p.set(31 - k, y + (k >> 1), dark[S]);
      }
      p.box(2, y, 36, 2, dark, B);
    }
    // A warning lamp blinking on the left leg.
    p.set(4, 2, f === 0 ? MOLTEN5[L] : MOLTEN5[S]);
    p.set(5, 2, f === 0 ? MOLTEN5[B] : MOLTEN5[S]);
  },
  false,
);
