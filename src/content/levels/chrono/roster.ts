import type { EnemyDef } from '../../enemies';

// Sector 9 enemies (design.md → Level 9 "Chrono Rift"). Authored at the
// sector's numbers, so the level's enemyHpMul doesn't apply to them. Shot
// speeds are before the level's enemyShotSpeedMul (1.3). Behaviors live in
// game/levels/chrono and read only these params; every timer runs on the
// bubble-scaled dt the enemy system hands them.

/** Moves in bursts and freezes; a cross ring on every second freeze. */
export const STUTTER_P = {
  /** Seconds moving, then seconds frozen. */
  burst: 0.4,
  freeze: 0.6,
  /** Downward speed during a burst, px/s (≈ 42 px/s on average). */
  speed: 105,
  /** Fires on every `ringEvery`-th freeze (design: every second). */
  ringEvery: 2,
  ringN: 4,
  ringSpeed: 68,
  /** The cross points down/right/up/left. */
  ringRot: 0,
} as const;

/** Interceptor-like; records 2 s and rewinds once, the first time it drops below half HP. */
export const REWIND_P = {
  descend: 30,
  lag: 1.1,
  maxVx: 70,
  spread: 18,
  /** Seconds of history kept (design: 2 s). */
  record: 2,
  /** Seconds between history samples. */
  sample: 0.1,
  /** Telegraph before the rewind: clock hands spin backward (design: 1.0 s). */
  warn: 1,
  /** Rewinds the first time HP drops below this share of max. */
  threshold: 0.5,
} as const;

/** Drifts with the scroll; pops into a slow bubble when killed or when its fuse ends. */
export const BUBBLE_MINE_P = {
  fuse: 6,
  /** The last `warn` s of the fuse blink amber. */
  warn: 1,
  bubbleR: 52,
  bubbleTtl: 6,
} as const;

/** The Echo's Seeker pattern: a slow, shootable homing missile. */
export const MISSILE_P = {
  speed: 62,
  /** rad/s. */
  turn: 1.5,
  ttl: 4.5,
  /** Stops steering inside this distance, so a sidestep beats it. */
  blind: 40,
} as const;

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  cr_stutterer: {
    id: 'cr_stutterer',
    name: 'Stutterer',
    hp: 3,
    r: 7,
    // Drawn by its registerEnemyDraw: the frame follows the burst/freeze state.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'chrono.stutter', p: STUTTER_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 120,
    salvage: 3,
    dropTable: 'common',
  },
  cr_rewinder: {
    id: 'cr_rewinder',
    name: 'Rewinder',
    hp: 8,
    r: 9,
    sprite: 'cr_rewinder',
    behavior: { kind: 'custom', behavior: 'chrono.rewind', p: REWIND_P },
    fire: {
      pattern: { kind: 'aimed', n: 2, spreadDeg: 10, speed: 92 },
      firstDelay: 1.0,
      interval: 1.8,
      bullet: 's',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 300,
    salvage: 7,
    dropTable: 'common',
  },
  cr_bubblemine: {
    id: 'cr_bubblemine',
    name: 'Bubble Mine',
    hp: 5,
    r: 7,
    // Drawn by its registerEnemyDraw: the lamps follow the fuse.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'chrono.bubbleMine', p: BUBBLE_MINE_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 100,
    salvage: 2,
    dropTable: 'common',
  },
  cr_missile: {
    id: 'cr_missile',
    name: 'Echo Missile',
    hp: 1,
    r: 4,
    // Drawn by its registerEnemyDraw, turned to its heading.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'chrono.missile', p: MISSILE_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 20,
    salvage: 0,
    // Mostly nothing, so the Echo's missile stream can't be farmed for shields.
    dropTable: 'asteroid_small',
  },
};
