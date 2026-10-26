import type { EnemyDef } from '../../enemies';

// Sector 3 enemies (design.md → Level 3 "Event Horizon"). Authored at the
// sector's numbers, so the level's enemyHpMul doesn't apply to them.
// Behaviors live in game/levels/eventHorizon and read only these params.

/** Circles the nearest black hole, firing outward fans the hole then bends. */
export const ORBITER_P = {
  /** Orbit radius around the hole's center, px. */
  radius: 54,
  /** rad/s. */
  omega: 1.4,
  /** Seconds on the orbit before it peels off downward. */
  orbitTime: 10,
  /** Seconds to spiral in from wherever it spawned to the orbit radius. */
  enter: 1.2,
  exitSpeed: 70,
  /** Seconds between outward fans, and before the first one. */
  fireEvery: 1.3,
  firstFire: 1.6,
  shotSpeed: 72,
  /** Degrees between the fan's 2 shots. */
  fanDeg: 18,
  /** Won't fire with the player closer than this (shots curve; keep them visible). */
  minPlayerDist: 70,
  /** Peels off early once its hole sinks below this y, so it never sweeps the player's row. */
  leaveBelowY: 190,
} as const;

/** Descends, locks a telegraphed line on the player, then dashes along it. */
export const LANCER_P = {
  holdY: 70,
  descendSpeed: 90,
  /** Pause at the hold height before the telegraph starts. */
  settle: 0.35,
  /** The line is locked for the whole telegraph (design: 0.7 s). */
  telegraph: 0.7,
  dashSpeed: 260,
} as const;

/** Drifts with the scroll and projects a coreless gravity field. */
export const BUOY_P = {
  /** Sideways sway amplitude, px/s, and its frequency, Hz. */
  sway: 8,
  swayHz: 0.35,
  /** Field strength as a share of the `small` hole's (design: 0.5×). */
  fieldMul: 0.5,
  /** Seconds for the field to collapse when the buoy dies. */
  collapse: 0.45,
} as const;

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  hz_orbiter: {
    id: 'hz_orbiter',
    name: 'Orbiter',
    hp: 6,
    r: 8,
    sprite: 'hz_orbiter',
    behavior: { kind: 'custom', behavior: 'eventHorizon.orbit', p: ORBITER_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 250,
    salvage: 5,
    dropTable: 'common',
  },
  hz_lancer: {
    id: 'hz_lancer',
    name: 'Lancer',
    hp: 5,
    r: 7,
    sprite: 'hz_lancer',
    behavior: { kind: 'custom', behavior: 'eventHorizon.lance', p: LANCER_P },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 250,
    salvage: 4,
    dropTable: 'common',
  },
  hz_buoy: {
    id: 'hz_buoy',
    name: 'Gravity Buoy',
    hp: 12,
    r: 9,
    sprite: 'hz_buoy',
    behavior: { kind: 'custom', behavior: 'eventHorizon.buoy', p: BUOY_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 400,
    salvage: 10,
    dropTable: 'common',
  },
};
