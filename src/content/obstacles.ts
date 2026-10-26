// Asteroid and anomaly tunables (T10). Systems in game/obstacles read these.

import { LEVELS } from './levels';

export type AsteroidSize = 'small' | 'medium' | 'large';
export const ASTEROID_SIZE_IDS: readonly AsteroidSize[] = ['small', 'medium', 'large'];

/** Rock look and toughness set. Levels map onto one with `rockThemeForLevel`. */
export type RockTheme = 'kessler' | 'ion' | 'basalt';
export const ROCK_THEME_IDS: readonly RockTheme[] = ['kessler', 'ion', 'basalt'];

/** Sprite variants per size and theme. */
export const ROCK_VARIANTS = 3;

export interface SplitRule {
  into: AsteroidSize;
  count: number;
  /** Sideways speed (px/s) each child gets, away from the others. */
  kick: number;
  /** Children keep this share of the parent's velocity. */
  inherit: number;
}

export interface AsteroidSizeDef {
  /** Collision radius, a little under the sprite's visual radius. */
  r: number;
  /** Sprite cell size including the 1 px outline (art-direction: 12 / 20 / 32). */
  sprite: number;
  /** Per theme. A value <= 0 makes the rock indestructible. */
  hp: Readonly<Record<RockTheme, number>>;
  split: Readonly<Record<RockTheme, SplitRule | null>>;
  /** Spin speed range, rad/s; the sign is random. */
  spin: readonly [number, number];
  /** Salvage value for T12's drop roll. */
  salvage: number;
  /** Matches T03's flat ASTEROID_SCORE; kept here for balance passes. */
  score: number;
}

const TWO_MEDIUMS: SplitRule = { into: 'medium', count: 2, kick: 34, inherit: 0.8 };
const TWO_SMALLS: SplitRule = { into: 'small', count: 2, kick: 42, inherit: 0.85 };

export const ASTEROID_SIZES: Readonly<Record<AsteroidSize, AsteroidSizeDef>> = {
  small: {
    r: 5,
    sprite: 12,
    hp: { kessler: 1, ion: 1, basalt: 2 },
    split: { kessler: null, ion: null, basalt: null },
    spin: [0.8, 2.6],
    salvage: 1,
    score: 10,
  },
  // L1 mediums are one-shot and don't split (design.md, Obstacles).
  medium: {
    r: 8,
    sprite: 20,
    hp: { kessler: 1, ion: 4, basalt: 6 },
    split: { kessler: null, ion: TWO_SMALLS, basalt: TWO_SMALLS },
    spin: [0.5, 1.6],
    salvage: 2,
    score: 10,
  },
  large: {
    r: 13,
    sprite: 32,
    hp: { kessler: 10, ion: 10, basalt: 14 },
    split: { kessler: TWO_MEDIUMS, ion: TWO_MEDIUMS, basalt: TWO_MEDIUMS },
    spin: [0.25, 0.9],
    salvage: 5,
    score: 10,
  },
};

/**
 * Level id → rock theme: the LevelDef's `rockTheme`, then the old aliases;
 * unknown levels fall back to basalt.
 */
export function rockThemeForLevel(levelId: string): RockTheme {
  // LEVELS is read at call time, so the levels ↔ obstacles import cycle is harmless.
  const def = LEVELS[levelId];
  if (def !== undefined) return def.rockTheme;
  if (levelId === 'kessler' || levelId === 'level1' || levelId === '1') return 'kessler';
  if (levelId === 'ion' || levelId === 'level2' || levelId === '2') return 'ion';
  return 'basalt';
}

/** Director stream defaults; every field can be overridden per stream. */
export const ASTEROID_STREAM_DEFAULTS = {
  /** Rocks per second. */
  rate: 0.6,
  sizeWeights: { small: 6, medium: 3, large: 0 } as Readonly<Record<AsteroidSize, number>>,
  /** Heading off straight down, degrees. Clamped to ±MAX_STREAM_ANGLE. */
  angleRange: [-25, 25] as readonly [number, number],
  /** Own speed in px/s, before the scroll drift is added. */
  speedRange: [18, 46] as readonly [number, number],
  xRange: [8, 232] as readonly [number, number],
  /** Interval jitter: each gap is (1 ± jitter) / rate. */
  jitter: 0.6,
  /** Slots kept free so splits never hit a full pool. */
  poolReserve: 12,
};

export const MAX_STREAM_ANGLE = 25;

export interface BlackHoleDef {
  /** Core radius: absorbs shots and rocks, hurts the player. */
  r: number;
  /** Field radius. */
  radius: number;
  /** Pull on both shot pools, px/s² at INVERSE_FALLOFF_MIN (inverse falloff). */
  strength: number;
  /** Multipliers on `strength` for the other pools. */
  rockMul: number;
  pickupMul: number;
  /** Player drift toward the core, px/s at the center (linear falloff). Gentle by design. */
  playerPull: number;
  contactDamage: number;
}

export interface PulsarDef {
  /** Core radius (absorbs shots, hurts on contact). */
  r: number;
  /** Seconds between pulses. */
  period: number;
  /** Glow before each pulse, seconds. */
  telegraph: number;
  ringSpeed: number;
  ringThickness: number;
  /** The ring fades out at this radius. */
  maxRadius: number;
  damage: number;
  contactDamage: number;
}

export const BLACK_HOLE: Readonly<BlackHoleDef> = {
  r: 8,
  radius: 128,
  strength: 1500,
  rockMul: 0.3,
  pickupMul: 0.4,
  playerPull: 34,
  contactDamage: 1,
};

export const PULSAR: Readonly<PulsarDef> = {
  r: 5,
  period: 3,
  telegraph: 0.6,
  ringSpeed: 120,
  ringThickness: 4,
  maxRadius: 220,
  damage: 1,
  contactDamage: 1,
};
