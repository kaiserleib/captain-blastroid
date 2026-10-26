import type { EnemyDef } from '../../enemies';

// Sector 2 enemies (docs/design.md → Level 2 "Ion Shoals"). Authored at this
// sector's numbers, so the level's enemyHpMul doesn't apply. Each one moves
// and fires from a custom behavior in game/levels/ionShoals; `p` holds its
// tunables (numbers only, so the def stays plain data).

/** Tug: holds near the top, tows the nearest medium/large rock and flings it. */
export const TUG_P = {
  /** px/s while descending to the hold line. */
  descend: 55,
  /** Hold line, picked per tug in [holdMin, holdMax] (a spawn `ay` override wins). */
  holdMin: 60,
  holdMax: 90,
  /** Max px/s of the slow drift toward the player's x. */
  drift: 14,
  /** 1/s: drift = (player.x - x) × driftK, capped at `drift`. */
  driftK: 0.35,
  /** Seconds alive before it climbs away. */
  leaveAfter: 14,
  exitVy: -45,
  /** Seconds between tow attempts, and before the first one. */
  interval: 4.5,
  firstDelay: 0.4,
  /** A medium or large rock within this many px (center to center) can be towed. */
  range: 130,
  /** The rock is held this far below the tug. */
  holdOy: 30,
  /** Seconds of towing before the fling (the tell). */
  towTime: 1.6,
  flingSpeed: 95,
  /** Spring constant, 1/s² (critically damped). */
  k: 12,
  /** The fallback aimed shot when no rock is in range. */
  shotSpeed: 95,
} as const;

/** Skiff: a fast sine weave along its heading, one aimed shot. */
export const SKIFF_P = {
  speed: 130,
  amp: 32,
  hz: 0.75,
  /** Seconds alive when it fires its one shot. */
  shootAt: 1.4,
  shotSpeed: 85,
  /** Seconds alive when a diving skiff peels off toward its nearer side edge. */
  peelAt: 1.9,
  /** rad/s it turns while peeling, up to `peelMax` off straight down. */
  peelTurn: 1.4,
  peelMax: 1.05,
} as const;

/** Ion Mine: drifts with the scroll, bursts on proximity or after its fuse. */
export const MINE_P = {
  /** Player within this many px (center to center) arms it. */
  trigger: 36,
  /** Seconds alive when it arms by itself. */
  fuse: 5.4,
  /** Seconds between arming and the burst (the tell, ≥ 0.5 s). */
  arm: 0.6,
  ringN: 8,
  ringSpeed: 60,
  /** Own px/s on top of the scroll drift. */
  vy: 4,
} as const;

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  ion_tug: {
    id: 'ion_tug',
    name: 'Tug',
    hp: 10,
    r: 11,
    sprite: 'ion_tug',
    behavior: { kind: 'custom', behavior: 'ion.tug', p: TUG_P },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 400,
    salvage: 6,
    dropTable: 'common',
  },
  ion_skiff: {
    id: 'ion_skiff',
    name: 'Skiff',
    hp: 2,
    r: 6,
    sprite: 'ion_skiff',
    behavior: { kind: 'custom', behavior: 'ion.skiff', p: SKIFF_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 100,
    salvage: 1,
    dropTable: 'common',
  },
  ion_mine: {
    id: 'ion_mine',
    name: 'Ion Mine',
    hp: 3,
    r: 6,
    sprite: 'ion_mine',
    behavior: { kind: 'custom', behavior: 'ion.mine', p: MINE_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 80,
    salvage: 2,
    dropTable: 'common',
  },
};
