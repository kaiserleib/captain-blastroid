import type { BossPartSpec } from '../../bosses';
import type { EnemyDef } from '../../enemies';
import type { SimEnemyDef } from '../../../sim/spawn';
import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// Sector 4, per docs/design.md → Level 4 "Pulsar Nursery". Rhythm (pulse rings
// with telegraphed gaps, locked to the 120 BPM `pulsar` song) and speed (the
// scroll surges to 70 and stalls to 18). Beats, scroll in brackets:
//   0–12    [28] a steady pulsar teaches the gaps; supply-run Spread capsule at 6
//   12–45   [28] Pulse Drone pairs on the bar, gnat lines between pulses, a
//                second steady pulsar half a bar out of phase; carrier at 35
//   45–70   [28] turning pulsars, swoopers, one Warden Ray
//   70–105  [28 → 70] the current: small-rock rain, Streakers from below, a quick pulsar
//   105–110 [70 → 18] the surge breaks, shield drop
//   110–145 [18] the garden: three near-stationary pulsars, drones, interceptors; pod at 118
//   145–178 [18 → 36] magnet, then Warden Rays ×2, gunboats, quick pulsars
//   182 warning, 186 Magnetar

/**
 * The `pulsar` song's bar (PULSAR_SONG_PERIOD in audio/songs/pulsar.ts; a
 * test keeps them equal). GameScene starts the song with the level clock, so
 * a kick lands at level time BAR·k.
 */
export const BAR = 3;

/**
 * Pulse periods of the variants this sector places (content/obstacles'
 * PULSAR_VARIANTS; a test keeps them equal; a runtime import would be a cycle).
 */
export const VARIANT_PERIOD = { steady: 3, turning: 3, quick: 2 } as const;
export type NurseryPulsar = keyof typeof VARIANT_PERIOD;

/**
 * Phase that puts a pulsar spawned at level time `t` on the song grid: pulse
 * k fires when its clock reaches k·period, so `t mod period` lands every
 * pulse on a multiple of the period (the bar line for 3 s pulsars). `offset`
 * shifts the pulses later by that many seconds (half a bar = 1.5).
 */
export function lockedPhase(t: number, period: number, offset = 0): number {
  const p = (t - offset) % period;
  return p < 0 ? p + period : p;
}

/**
 * A drifting pulsar on the song grid. `turns` pre-fires that many silent
 * pulses so the gap pattern's rotation is chosen: a rotating pulsar's
 * near-vertical patterns are timed for when it crosses the middle of the
 * screen, where a sideways gap would be out of reach from the bottom.
 */
function pulsarAt(
  t: number,
  x: number,
  variant: NurseryPulsar,
  offset = 0,
  turns = 0,
): TimelineEvent {
  const period = VARIANT_PERIOD[variant];
  return {
    t,
    anomaly: {
      kind: 'pulsar',
      x,
      variant,
      phase: lockedPhase(t, period, offset) + turns * period,
    },
  };
}

// ---------------------------------------------------------------------------
// Roster (ids `pn_`). Authored at sector numbers; enemyHpMul doesn't touch them.

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  pn_drone: {
    id: 'pn_drone',
    name: 'Pulse Drone',
    hp: 4,
    r: 7,
    // Drawn by its registerEnemyDraw (the charge glow follows the beat, not the clock).
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'pulsarNursery.drone',
      // vy: px/s down. reach: nearest pulsar within this range drives the beat.
      // minGap: seconds between rings; no rings below maxY. n/speed: the ring. charge: glow before one.
      p: { vy: 20, reach: 300, minGap: 2.4, maxY: 230, n: 10, speed: 62, charge: 0.6 },
    },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 150,
    salvage: 4,
    dropTable: 'common',
  },
  pn_streaker: {
    id: 'pn_streaker',
    name: 'Streaker',
    hp: 3,
    r: 6,
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'pulsarNursery.streaker',
      // warn: seconds the bottom-edge chevron blinks before it launches (≥ 0.5, fairness).
      // speed/tilt: 150 px/s up, angled up to ±15°. shotY: fires once crossing this y.
      p: { warn: 0.7, speed: 150, tilt: 15, shotY: 200, shotSpeed: 95 },
    },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 120,
    salvage: 3,
    dropTable: 'common',
  },
  pn_ray: {
    id: 'pn_ray',
    name: 'Warden Ray',
    hp: 14,
    r: 11,
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'pulsarNursery.ray',
      p: {
        descend: 55,
        holdY: 58,
        /** px/s it drifts toward the player's x while holding. */
        drift: 14,
        leaveAfter: 15,
        exitVy: -50,
        /** Beam cycle: telegraph, on (bullets every `gap` s), off. */
        firstDelay: 0.9,
        telegraph: 0.7,
        on: 1.8,
        off: 2.2,
        gap: 0.08,
        /** Degrees swept while on; the sweep starts `lead`° behind the player's bearing. */
        sweep: 54,
        lead: 12,
        speed: 105,
      },
    },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 600,
    salvage: 12,
    dropTable: 'common',
  },
};

// ---------------------------------------------------------------------------
// Boss: Magnetar (`pn_magnetar`)

export interface MagnetarRingPattern {
  period: number;
  gaps: number;
  gapDeg: number;
  gapSpin: number;
  ringSpeed: number;
  /**
   * Switch to this pattern only on a pulse whose gaps sit this many degrees
   * either side of straight down (see Magnetar `lands`).
   */
  offsetDeg?: number;
}

export interface MagnetarDef {
  id: 'pn_magnetar';
  name: string;
  /** Score for the core kill (× chain). Pylons score through their part def. */
  score: number;
  parts: readonly BossPartSpec[];
  entry: { fromY: number; toY: number; duration: number };
  /** Gentle bob while it holds (px, s); it never strafes. */
  bob: { amp: number; period: number };
  pylons: {
    /** Orbit radius px and angular speed rad/s. */
    radius: number;
    spin: number;
    /** Each pylon fires one aimed shot this often; pylon i starts `stagger·i` later. */
    interval: number;
    firstDelay: number;
    stagger: number;
    shotSpeed: number;
  };
  /** The arena drift: scroll speed eases between min and max over `period` s (cosine). */
  scroll: { min: number; max: number; period: number };
  /** A sparse small-rock trickle the scroll drags (phases 1–2). Seconds between rocks. */
  rocks: { every: number; speed: readonly [number, number] };
  ring: {
    telegraph: number;
    /** px; the ring's reach, so the bottom of the playfield isn't a safe harbor. */
    reach: number;
    p1: MagnetarRingPattern;
    p2: MagnetarRingPattern;
    /**
     * Meltdown: p2's timing and turn with wider gaps, plus an echo ring
     * `echoDelay` s later with its gaps turned half a spacing.
     */
    p3: MagnetarRingPattern;
    echoDelay: number;
  };
  spiral: {
    arms: number;
    interval: number;
    intervalMeltdown: number;
    turnDeg: number;
    speed: number;
    /** Quiet window after each main pulse (s) before the spiral resumes; it stops for the telegraph. */
    after: number;
    afterMeltdown: number;
  };
  /** Seconds the core shield takes to fall once the third pylon is down. */
  shieldDrop: number;
  /** Phase 3 when the core is below this share of its HP. */
  meltdownAt: number;
  deathTime: number;
  shotSalvageMax: number;
  pylonShake: { mag: number; dur: number };
}

const PYLON_R = 9;
const CORE_R = 15;
// Design: 300. The pylons orbit, so phase 1 runs long for anyone who doesn't lead
// their shots; 240 puts the typical fight at ~60–90 s (T29 Notes).
const CORE_HP = 240;

function pylon(i: number): BossPartSpec {
  const a = Math.PI / 4 + (i * Math.PI) / 2;
  return {
    defId: 'pn_mag_pylon',
    role: 'turret',
    ox: Math.round(Math.cos(a) * 34),
    oy: Math.round(Math.sin(a) * 34),
    hp: 50,
    r: PYLON_R,
    targetable: true,
  };
}

export const MAGNETAR: MagnetarDef = {
  id: 'pn_magnetar',
  name: 'MAGNETAR',
  score: 2500,
  parts: [
    pylon(0),
    pylon(1),
    pylon(2),
    pylon(3),
    { defId: 'pn_mag_core', role: 'core', ox: 0, oy: 0, hp: CORE_HP, r: CORE_R, targetable: false },
  ],
  entry: { fromY: -60, toY: 96, duration: 3.5 },
  bob: { amp: 2, period: 3 },
  // Design: every 2 s at 90. With rings to stand in, four aimed streams were the
  // phase's main killer for the bots; 2.6 s / 80 keeps the pressure readable.
  pylons: { radius: 34, spin: 0.5, interval: 2.6, firstDelay: 1, stagger: 0.65, shotSpeed: 80 },
  scroll: { min: 30, max: 50, period: 12 },
  rocks: { every: 2.2, speed: [8, 22] },
  ring: {
    telegraph: 0.7,
    reach: 320,
    p1: { period: 3, gaps: 4, gapDeg: 45, gapSpin: 30, ringSpeed: 130 },
    // ±30° off straight down, flipping each pulse: the gap the player needs is
    // always one side or the other of the center line, never up the flanks.
    p2: { period: 2, gaps: 3, gapDeg: 50, gapSpin: 60, ringSpeed: 160, offsetDeg: 30 },
    // 56° gaps leave 4° between a ring's gap and its echo's, so the half-second
    // hop between them is ~25 px even at the bottom of the screen (50° gaps
    // made it ~52 px: too tight to make after the first ring has passed).
    p3: { period: 2, gaps: 3, gapDeg: 58, gapSpin: 60, ringSpeed: 160, offsetDeg: 30 },
    echoDelay: 0.5,
  },
  spiral: {
    arms: 4,
    interval: 0.2,
    intervalMeltdown: 0.26,
    turnDeg: 13,
    speed: 56,
    after: 0.45,
    afterMeltdown: 0.8,
  },
  shieldDrop: 1,
  meltdownAt: 0.3,
  deathTime: 2,
  shotSalvageMax: 20,
  pylonShake: { mag: 3, dur: 0.3 },
};

/** Part defs for the boss registry (`isBoss` is forced on). */
export const MAGNETAR_PARTS: Readonly<Record<string, SimEnemyDef>> = {
  pn_mag_pylon: { hp: 50, r: PYLON_R, score: 400 },
  pn_mag_core: { hp: CORE_HP, r: CORE_R, score: 0 },
};

// ---------------------------------------------------------------------------
// Garden (110–145 s): three pulsars glide in and hold in a triangle.

export interface GardenSlot {
  variant: NurseryPulsar;
  x: number;
  /** Where it settles, and how many seconds after the script it starts gliding in. */
  y: number;
  delay: number;
  /** Seconds past the bar its pulses land (0 = on the kick). */
  offset: number;
}

export const GARDEN = {
  /** Glide in from above the top edge over this many seconds (ease-out). */
  glide: 5,
  /** px/s they creep down while holding ("almost stationary"). */
  creep: 1.5,
  /** Level time they burn out (collapse over `fade` s) as the scroll picks up again. */
  releaseAt: 145,
  fade: 1.5,
  slots: [
    // The quick one sits high: its 200 px reach covers the upper field, not the bottom row.
    { variant: 'quick', x: 120, y: 62, delay: 0, offset: 0 },
    { variant: 'steady', x: 52, y: 150, delay: 1.5, offset: 0 },
    { variant: 'steady', x: 188, y: 150, delay: 3, offset: 1.5 },
  ] as readonly GardenSlot[],
} as const;

/** Streakers launch from the bottom edge at least this far from the player's x. */
export const STREAKER_MIN_DX = 50;
/** Streaker scripts are skipped below this scroll speed (design: fast scroll only). */
export const STREAKER_MIN_SCROLL = 50;

// ---------------------------------------------------------------------------
// Level

const SMALL = { small: 1 } as const;
const LIGHT = { small: 5, medium: 1 } as const;

const FIELD: readonly AsteroidFieldSegment[] = [
  { from: 0, to: 12, rate: 0.4, rateTo: 0.7, sizes: SMALL, speed: [12, 28] },
  { from: 12, to: 45, rate: 0.6, rateTo: 0.8, sizes: LIGHT },
  { from: 45, to: 70, rate: 0.7, rateTo: 0.9, sizes: LIGHT },
  // The current: rain at 70 px/s scroll (own speed added on top).
  { from: 72, to: 104, rate: 2.2, rateTo: 3.6, sizes: SMALL, speed: [6, 30], jitter: 0.7 },
  { from: 104, to: 108, rate: 2, rateTo: 0.2, sizes: SMALL },
  // The garden is open space: the pulsars are the obstacle.
  { from: 112, to: 145, rate: 0.35, sizes: SMALL, speed: [6, 16] },
  { from: 148, to: 176, rate: 0.6, rateTo: 1, sizes: LIGHT },
];

const streaker = (t: number, n = 1): TimelineEvent => ({
  t,
  script: 'pulsarNursery.streakers',
  args: { n },
});

export const LEVEL: LevelDef = {
  id: 'pulsarNursery',
  number: 4,
  name: 'PULSAR NURSERY',
  theme: 'pulsar',
  music: 'pulsar',
  scrollSpeed: 28,
  duration: 260,
  rockTheme: 'ion',
  enemyHpMul: 1.25,
  enemyShotSpeedMul: 1.15,
  guaranteeWeapon: { by: 30, weapon: 'spread' },
  bossSalvage: 110,
  podFallbackSalvage: 60,
  schematicOnClear: ['halcyon'],
  asteroidField: FIELD,

  timeline: [
    { t: 0.5, toast: 'PULSAR NURSERY' },
    // First pulse on the kick at 3 s, telegraphed from 2.2 s while it is just inside the top.
    pulsarAt(0.5, 120, 'steady'),
    { t: 2.5, toast: 'STAND IN THE GAPS' },

    // Supply run.
    { t: 6, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 }, forceCapsule: 'spread' },
    {
      t: 10,
      formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
      forceCapsule: 'spread',
    },

    // Drones on the bar; gnat lines between pulses; a second steady pulsar off the beat.
    pulsarAt(11, 182, 'steady', 1.5),
    { t: 12, spawn: { enemy: 'pn_drone', x: 70 } },
    { t: 12, spawn: { enemy: 'pn_drone', x: 170 } },
    { t: 17, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 31, formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' } },
    pulsarAt(22, 64, 'steady'),
    { t: 24, spawn: { enemy: 'pn_drone', x: 110 } },
    { t: 24, spawn: { enemy: 'pn_drone', x: 200 } },
    { t: 28.5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 35, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
    { t: 36, spawn: { enemy: 'pn_drone', x: 50 } },
    { t: 36, spawn: { enemy: 'pn_drone', x: 140 } },
    { t: 40.5, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

    // Turning pulsars, swoopers, the first Warden Ray.
    pulsarAt(45, 96, 'turning', 0, 7),
    { t: 47, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 50, spawn: { enemy: 'pn_ray', x: 150 } },
    { t: 53, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    pulsarAt(56, 168, 'turning', 0, 2),
    { t: 57, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 61, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
    { t: 64.5, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

    // The current.
    { t: 69, toast: 'CURRENT SURGE' },
    { t: 70, scroll: { to: 70, over: 3 } },
    streaker(75),
    streaker(78.5, 2),
    streaker(82),
    // Hugging the left edge: closing at scroll + ring speed (210 px/s), it
    // threatens the near side hard and the far side barely.
    pulsarAt(84, 24, 'quick'),
    streaker(87.5, 2),
    streaker(91),
    { t: 93, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    streaker(95.5, 2),
    streaker(99),
    streaker(101.5, 2),

    // The surge breaks.
    { t: 105, scroll: { to: 18, over: 4 } },
    { t: 106, drop: { kind: 'shield', x: 'rand' } },

    // The garden.
    { t: 108, toast: 'THE GARDEN' },
    { t: 108, script: 'pulsarNursery.garden' },
    // Drones flank the pod's lane (x 120) rather than sit on it.
    { t: 114, spawn: { enemy: 'pn_drone', x: 40 } },
    { t: 114, spawn: { enemy: 'pn_drone', x: 200 } },
    { t: 117, toast: 'ESCAPE POD AHEAD', ifNoPod: 'SALVAGE CACHE AHEAD' },
    { t: 118, escapePod: { x: 120, hp: 2 } },
    { t: 121, spawn: { enemy: 'interceptor', x: 70 } },
    { t: 121.4, spawn: { enemy: 'interceptor', x: 170 } },
    { t: 126, spawn: { enemy: 'pn_drone', x: 40 } },
    { t: 126, spawn: { enemy: 'pn_drone', x: 200 } },
    { t: 130, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 133, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 138, spawn: { enemy: 'pn_drone', x: 80 } },
    { t: 138, spawn: { enemy: 'pn_drone', x: 160 } },
    { t: 141, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },

    // Out of the garden.
    { t: 145, scroll: { to: 36, over: 3 } },
    { t: 146, drop: { kind: 'magnet', x: 'rand' } },

    // Finale.
    { t: 150, spawn: { enemy: 'pn_ray', x: 60 } },
    { t: 150, spawn: { enemy: 'pn_ray', x: 180 } },
    pulsarAt(152, 44, 'quick'),
    { t: 155, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 158, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 159, spawn: { enemy: 'pn_drone', x: 120 } },
    { t: 163, spawn: { enemy: 'gunboat', x: 70 } },
    { t: 163, spawn: { enemy: 'gunboat', x: 170, overrides: { ay: 100 } } },
    pulsarAt(165, 196, 'quick'),
    { t: 167, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },
    { t: 170, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: 172, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 174, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

    { t: 179, drop: { kind: 'shield', x: 120 } },
    { t: 182, bossWarning: true },
    { t: 186, boss: 'pn_magnetar' },
  ],
};
