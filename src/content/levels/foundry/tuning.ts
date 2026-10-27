// Level 10 tunables (T42): the roster params, the remix beats (conveyors,
// containment, the welding line, the furnace, assembly), the Architect and
// the escape run. game/levels/foundry reads only these tables. Shot speeds
// are before the level's enemyShotSpeedMul (1.35).

import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

/** `foundry`'s tempo (audio/songs/bpm.ts; a test keeps them equal). The song starts with the level clock. */
export const FOUNDRY_BPM = 136;
export const BEAT = 60 / FOUNDRY_BPM;

/** Riveter: conveyor lines crossing at a fixed y. Contact only. */
export const RIVETER_P = {
  speed: 60,
  /** Px the line bobs, and the bob period (rivet-gun rattle). */
  bob: 1.5,
  bobPeriod: 0.6,
} as const;

/** Crane: carries hull scrap in, holds near the top, flings it, then snipes. */
export const CRANE_P = {
  descend: 55,
  holdMin: 46,
  holdMax: 82,
  /** Spring on the hold line, and the slow drift toward the ship's x. */
  drift: 16,
  driftK: 0.35,
  /** The hook carries its rock this far below its center. */
  holdOy: 22,
  /** Tow spring, 1/s². */
  k: 26,
  /** Seconds holding the scrap before the fling, and the hook's glow before it (≥ 0.5). */
  towTime: 3.2,
  telegraph: 0.6,
  flingSpeed: 118,
  /** After a fling: seconds before it looks for field scrap, and its pick-up range. */
  regrab: 3.5,
  range: 96,
  /** One aimed shot every `interval` while it has no rock. */
  firstShot: 1.2,
  interval: 2.4,
  shotSpeed: 76,
  leaveAfter: 17,
  exitVy: -46,
  /** HP of the scrap it brings in (a large basalt rock is 14). */
  rockHp: 10,
} as const;

/** Sentinel: holds, turns toward the ship, a 120° front shield, 3-way fans along its facing. */
export const SENTINEL_P = {
  descend: 60,
  holdMin: 52,
  holdMax: 96,
  /** rad/s. */
  turn: 0.8,
  /** Half the shield arc, degrees (design: a 120° front shield). */
  shieldHalf: 60,
  /** Shield radius beyond the hull radius, px. */
  shieldPad: 4,
  firstDelay: 1.2,
  interval: 1.8,
  n: 3,
  spreadDeg: 26,
  shotSpeed: 72,
  /** Holds fire while its facing is more than this far off the ship's bearing, degrees. */
  maxOffAim: 40,
  leaveAfter: 14,
  exitVy: -42,
  /** Slow sideways sway while holding, px/s and Hz. */
  sway: 10,
  swayHz: 0.18,
} as const;

/** Conveyor lines (`foundry.conveyor`, `foundry.portalLine`). */
export const CONVEYOR = {
  /** Px between riveters in a line. */
  spacing: 17,
  maxLines: 4,
  /** Riveters enter this far outside the side edge. */
  entryX: 10,
} as const;

/** Containment (40–75 s): a captive massive hole inside a ring of shade slabs. */
export const CONTAINMENT = {
  x: 120,
  /** The hole falls with the scroll, then settles below `settleY` at `settleVy` with a slow sway. */
  settleY: 116,
  settleVy: 2,
  sway: 26,
  swayPeriod: 14,
  /** Slab ring: offsets from the hole, px (40×10 slabs; gaps between them let shots through). */
  slabs: [
    [0, -66],
    [-62, -30],
    [62, -30],
    [-62, 34],
    [62, 34],
  ] as readonly (readonly [number, number])[],
  /** Spring the slabs follow their slots with, 1/s. */
  slabK: 6,
  collapse: 1.2,
  /** Slabs drop away at this speed when containment ends. */
  dropVy: 140,
  /** Orbiters spawn this far either side of the hole. */
  orbiterDx: 84,
} as const;

/** The welding line: `turning` pulsars on `foundry`'s beat. */
export const WELDING = {
  variant: 'turning',
  /** Pulse period in beats (7 × 0.441 s ≈ 3.09 s, the `turning` variant's 3 s on the grid). */
  beats: 7,
} as const;

/** The furnace's portal conveyor: two pairs feeding the riveter line down the screen. */
export const FURNACE = {
  /** Row the line enters on, and the pair ends (a on the right, b on the left, one row down). */
  rows: [62, 142, 222] as readonly number[],
  ax: 210,
  bx: 30,
  colors: ['orange', 'cyan'] as const,
  /** The pod rides the line; it's let go once it reaches this x on the last row. */
  podHp: 2,
  podReleaseX: 132,
  /** Pod drift speed once released (it lingers like any pod). */
  podVy: 24,
  /** Slabs the furnace drops for shade. */
  margin: 24,
} as const;

/** Escape run (design: terrain corridors ≥ 7 tiles at 90 px/s, debris rocks, no enemies). */
export const ESCAPE_RUN = {
  /** Keep at least this many rows queued above the screen. */
  queueRows: 24,
  /** The terrain tapers off when this many seconds are left. */
  clearAt: 4.5,
  /** Debris: one rock every `every` s (seconds after the start before the first). */
  debrisFirst: 2.5,
  debrisEvery: 0.7,
  debrisMedium: 0.25,
  /** Own speed on top of the scroll, px/s. */
  debrisSpeed: [10, 40] as const,
} as const;

// ---------------------------------------------------------------------------
// The Architect (three forms on one boss bar).

export type ArchitectPartKind = 'arm' | 'core1' | 'pylon' | 'core2' | 'core3';

export interface ArchitectPartSpec extends BossPartSpec {
  kind: ArchitectPartKind;
  /** 1 Scaffold, 2 Singularity Engine, 3 Paradox Core. */
  form: 1 | 2 | 3;
}

function part(
  kind: ArchitectPartKind,
  form: 1 | 2 | 3,
  ox: number,
  oy: number,
  hp: number,
  r: number,
): ArchitectPartSpec {
  return {
    kind,
    form,
    defId: `fd_arch_${kind}`,
    role: kind.startsWith('core') ? 'core' : 'turret',
    ox,
    oy,
    hp,
    r,
    targetable: kind === 'arm',
  };
}

/** Every part spawns with the fight (later forms parked off screen), so the bar spans all three. */
export const ARCHITECT_PARTS: readonly ArchitectPartSpec[] = [
  part('arm', 1, -46, 6, 75, 10),
  part('arm', 1, 46, 6, 75, 10),
  part('core1', 1, 0, 0, 180, 14),
  part('pylon', 2, -46, -4, 50, 8),
  part('pylon', 2, 46, -4, 50, 8),
  part('pylon', 2, -24, 24, 50, 8),
  part('pylon', 2, 24, 24, 50, 8),
  part('core2', 2, 0, 0, 250, 13),
  part('core3', 3, 0, 0, 220, 11),
];

export const ARCHITECT = {
  id: 'fd_architect',
  name: 'THE ARCHITECT',
  score: 8000,
  /** Where unused parts wait (off screen, untargetable). */
  parkY: -400,
  entry: { fromY: -70, toY: 74, time: 3 },
  /** Seconds between forms (invulnerable): the scaffold falls, the hole collapses. */
  transition: 2.2,
  /** No shots in a form's first `wake` seconds (fairness). */
  wake: 0.8,
  scaffold: {
    y: 74,
    strafe: 22,
    period: 12,
    bob: 3,
    bobPeriod: 2.6,
    /** Each arm's rock orbits at this radius and period. */
    orbitR: 26,
    orbitPeriod: 2.4,
    towK: 30,
    /** Throws every `throwEvery` s per arm (the second arm half a cycle later); the hook glows first. */
    throwEvery: 5,
    telegraph: 0.7,
    throwSpeed: 130,
    /** A fresh rock is hauled in from above this long after a throw. */
    regrab: 2.6,
    rockHp: 6,
    fan: { first: 1.6, interval: 2.1, n: 5, spreadDeg: 52, speed: 74 },
  },
  engine: {
    y: 66,
    strafe: 30,
    period: 10,
    /** The captive hole, below the core; it sways against the core so the line is never shut for long. */
    hole: { variant: 'massive', y: 176, sway: 56, collapse: 1 },
    /**
     * The pylons feed the singularity: its pull is `minPull` of the massive
     * hole's with every pylon down, rising evenly to `maxPull` with all four
     * up. At full massive pull a Blaster shot bends ~60 px on its way up, so
     * nothing below the core can hit it (T42 balance).
     */
    minPull: 0.2,
    maxPull: 0.6,
    /** Magnetar rings from the core. */
    ring: {
      period: 2.5,
      gaps: 3,
      gapDeg: 58,
      gapSpin: 30,
      telegraph: 0.7,
      speed: 112,
      reach: 250,
    },
    /** Each pylon's aimed shot (the hole bends it). */
    pylonShot: { first: 1.4, interval: 2.6, speed: 72 },
    /** The core's shield drops once this many pylons are left. */
    shieldUntil: 1,
  },
  paradox: {
    /** Lissajous drift around (x, y). */
    x: 120,
    y: 84,
    ax: 40,
    ay: 16,
    px: 14,
    py: 5.5,
    /** Flares every `flareEvery` s; the boss drops two slabs `slabLead` s before each. */
    flareEvery: 8,
    firstFlare: 3,
    slabLead: 1.2,
    slabDx: 74,
    slabVy: 30,
    flare: { warn: 1.3, burn: 1.1 },
    /** Two pairs, re-paired every `swapEvery` s. Ends: [ax, ay, bx, by]. */
    portals: [
      [36, 300, 204, 150],
      [204, 300, 36, 150],
    ] as readonly (readonly [number, number, number, number])[],
    swapEvery: 6,
    bubbleR: 28,
    /** 6-arm spiral: a volley every `gap` s for `on` s, then `off` s quiet. */
    spiral: { arms: 6, gap: 0.26, on: 2.2, off: 1.2, rotStep: 11, speed: 66 },
  },
  /** Salvage a shot-down arm or pylon sprays (like the Leviathan's hull parts). */
  partSalvage: { arm: 40, pylon: 30 },
  /** Salvage each broken core sprays as its form falls away. */
  formSalvage: 45,
  deathTime: 2.4,
  deathPopGap: 0.12,
  shotSalvageMax: 30,
} as const;

const PART_SCORE: Readonly<Record<ArchitectPartKind, number>> = {
  arm: 900,
  core1: 0,
  pylon: 600,
  core2: 0,
  core3: 0,
};

/** Sim defs for the Architect's parts (`registerBoss` forces isBoss). Only the cores ram. */
export const ARCHITECT_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = Object.fromEntries(
  ARCHITECT_PARTS.map((s) => [
    s.defId,
    {
      hp: s.hp,
      r: s.r,
      score: PART_SCORE[s.kind],
      contactDamage: s.role === 'core' ? 1 : 0,
    },
  ]),
);
