import type { EnemyDef } from '../../enemies';

// Sector 8 enemies (design.md → Level 8 "Wormhole Junction"). Authored at the
// sector's numbers, so the level's enemyHpMul doesn't apply to them.
// Behaviors live in game/levels/junction and read only these params.

/** Dives into a portal, holds at the partner, flashes, fires; swoops when there are none. */
export const BLINKER_P = {
  /** Entry descent, px/s, and the height it looks for a ring from. */
  enterSpeed: 90,
  enterY: 56,
  /** Seconds it searches for a ring before giving up and swooping. */
  search: 0.9,
  diveSpeed: 120,
  /** A dive that hasn't gone through in this long is abandoned (the ring moved away). */
  diveTimeout: 3,
  /** Seconds held at the exit; the burst fires after `flash`. */
  hold: 1.2,
  flash: 0.5,
  burstCount: 3,
  burstGap: 0.12,
  shotSpeed: 85,
  /** An exit it may use must sit this far above the ship (the burst is aimed). */
  exitAbovePlayer: 90,
  /** Dives before it leaves with a swoop. */
  maxDives: 3,
  /** Swoop: initial speed, turn toward the ship's column, px/s². */
  swoopSpeed: 110,
  swoopPull: 140,
  swoopMaxVx: 90,
  /** A jump of more than this between ticks means it went through a ring. */
  jump: 12,
} as const;

/** Drifts in and carries one end of a portal pair beside it. */
export const PYLON_P = {
  /** Entry speed until `holdY`, px/s. */
  enterSpeed: 40,
  /** Design: a slow drift at 18 px/s. */
  drift: 18,
  /** Side bounds of the drift, px. */
  minX: 26,
  maxX: 214,
  /** Seconds of drift before it leaves off the nearer side. */
  life: 12,
  leaveSpeed: 30,
  /** The carried ring hangs this far beside the pylon (clear of its hitbox). */
  ringDx: 24,
} as const;

/** Holds near the top behind a front shield; a portal exit above it lands shots on its back. */
export const AEGIS_P = {
  enterSpeed: 60,
  holdY: 58,
  /** Sideways sway while holding, px and Hz. */
  sway: 10,
  swayHz: 0.18,
  /** Seconds held before it climbs away. */
  hold: 14,
  leaveSpeed: 45,
  /** Its own pair: the exit sits `exitDy` above it, the entry at (x + lowDx, lowY). */
  exitDy: -30,
  lowY: 240,
} as const;

/** Shots that get past an Aegis shield from below (design: Seekers, Ricochet discs from the side). */
export const AEGIS_BYPASS = {
  weapons: ['seeker'] as readonly string[],
  /** Ricochet discs pass when |vx| ≥ this share of |vy| (they fly ±20° off vertical). */
  ricochetSlope: 0.25,
} as const;

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  wj_blinker: {
    id: 'wj_blinker',
    name: 'Blinker',
    hp: 4,
    r: 6,
    sprite: 'wj_blinker',
    behavior: { kind: 'custom', behavior: 'junction.blinker', p: BLINKER_P },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 150,
    salvage: 3,
    dropTable: 'common',
  },
  wj_pylon: {
    id: 'wj_pylon',
    name: 'Gate Pylon',
    hp: 10,
    r: 8,
    sprite: 'wj_pylon',
    behavior: { kind: 'custom', behavior: 'junction.pylon', p: PYLON_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 200,
    salvage: 5,
    // Gate hardware: it drops like an elite (and it never shoots back).
    dropTable: 'elite',
  },
  wj_aegis: {
    id: 'wj_aegis',
    name: 'Aegis',
    hp: 10,
    r: 9,
    sprite: 'wj_aegis',
    behavior: { kind: 'custom', behavior: 'junction.aegis', p: { ...AEGIS_P, pair: 1, lowDx: 0 } },
    fire: {
      pattern: { kind: 'fan', n: 5, arcDeg: 64, speed: 72 },
      firstDelay: 1.6,
      interval: 2,
      bullet: 's',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 300,
    salvage: 6,
    // The portal teacher pays like an elite: the lesson should feel worth it.
    dropTable: 'elite',
  },
};
