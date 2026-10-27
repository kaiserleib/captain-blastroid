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

/** The `standard` black hole plus the multipliers every variant shares. */
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
  ringThickness: number;
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

/** Shared by every pulsar variant; timing and gaps come from PULSAR_VARIANTS. */
export const PULSAR: Readonly<PulsarDef> = {
  r: 5,
  ringThickness: 4,
  damage: 1,
  contactDamage: 1,
};

// ---------------------------------------------------------------------------
// Hazard variants (T23, design.md "Shared mechanics")

export type BlackHoleVariantId = 'small' | 'standard' | 'massive';

export interface BlackHoleVariant {
  r: number;
  radius: number;
  strength: number;
  playerPull: number;
}

export const BLACK_HOLE_VARIANTS: Readonly<Record<BlackHoleVariantId, Readonly<BlackHoleVariant>>> =
  {
    small: { r: 6, radius: 96, strength: 1100, playerPull: 24 },
    standard: { r: 8, radius: 128, strength: 1500, playerPull: 34 },
    massive: { r: 12, radius: 170, strength: 2100, playerPull: 44 },
  };

export const BLACK_HOLE_VARIANT_IDS: readonly BlackHoleVariantId[] = [
  'small',
  'standard',
  'massive',
];
export const DEFAULT_BLACK_HOLE_VARIANT: BlackHoleVariantId = 'standard';

/** Gravity buoys: a coreless field at this share of the variant's pull, unless told otherwise. */
export const FIELD_ONLY_STRENGTH_MUL = 0.5;

export type PulsarVariantId = 'steady' | 'turning' | 'quick' | 'magnetar';

export interface PulsarVariant {
  /** Seconds between pulses. */
  period: number;
  /** Glow (and gap spokes) before each pulse, seconds. */
  telegraph: number;
  /** Safe gaps in the ring, evenly spaced. 0 = a solid ring. */
  gaps: number;
  /** Width of each gap, degrees. */
  gapDeg: number;
  /** Degrees the gap pattern turns each pulse. */
  gapSpin: number;
  /** px/s. */
  ringSpeed: number;
  /** The ring is gone past this radius. */
  maxRadius: number;
}

export const PULSAR_VARIANTS: Readonly<Record<PulsarVariantId, Readonly<PulsarVariant>>> = {
  steady: {
    period: 3,
    telegraph: 1,
    gaps: 3,
    gapDeg: 64,
    gapSpin: 0,
    ringSpeed: 110,
    maxRadius: 220,
  },
  turning: {
    period: 3,
    telegraph: 1,
    gaps: 3,
    gapDeg: 52,
    gapSpin: 40,
    ringSpeed: 120,
    maxRadius: 220,
  },
  quick: {
    period: 2,
    telegraph: 0.8,
    gaps: 2,
    gapDeg: 58,
    gapSpin: 90,
    ringSpeed: 140,
    maxRadius: 200,
  },
  // The Magnetar boss drives this one with setPulsarPattern; these are only its starting values.
  magnetar: {
    period: 3,
    telegraph: 0.7,
    gaps: 2,
    gapDeg: 50,
    gapSpin: 30,
    ringSpeed: 130,
    maxRadius: 260,
  },
};

export const PULSAR_VARIANT_IDS: readonly PulsarVariantId[] = [
  'steady',
  'turning',
  'quick',
  'magnetar',
];
export const DEFAULT_PULSAR_VARIANT: PulsarVariantId = 'steady';

/** Direction of the first pulse's first gap (canvas y is down): straight toward the player's side. */
export const PULSAR_FIRST_GAP_DEG = 90;
/** `double` patterns: the second ring trails the first by this many seconds. */
export const PULSAR_DOUBLE_DELAY = 0.5;
/** Telegraph spokes reach this far from the core at full glow. */
export const PULSAR_SPOKE_LEN = 40;

/** Tractor beams (L2 tugs, the Shepherd). */
export const TRACTOR = {
  /** Suggested spring constant, 1/s². Damping is always critical (2√k). */
  k: 12,
  /** Suggested fling speed toward the player, px/s (design: tugs fling at 95). */
  flingSpeed: 95,
  color: '#58d0f8',
  highlight: '#d0f8f8',
  /** Dash pattern along the beam, px; the dashes scroll toward the emitter. */
  dashOn: 5,
  dashOff: 3,
  /** px/s. */
  dashSpeed: 36,
} as const;

// ---------------------------------------------------------------------------
// Act II shared hazards (T33): solar flares and shade, portals, time bubbles.

export const FLARE = {
  /** Seconds of warning by default, and for the first `introCount` flares of a run. */
  warn: 1.2,
  introWarn: 2.0,
  introCount: 2,
  burn: 1.2,
  /** Fade after the burn. */
  cool: 0.4,
  /** Damage to each non-boss enemy in the light, once per flare. */
  enemyDamage: 3,
  /** HP an escape pod in the light loses, once per flare. */
  podDamage: 1,
  /** Shield segments the ship loses, once per flare. */
  playerDamage: 1,
  /** Fairness: a strip must be this close horizontally (and reachable before the burn). */
  fizzleReach: 100,
} as const;

export const SHADE = {
  /** A strip runs this far below its caster's bottom edge. */
  stripLength: 160,
  /** A strip is the caster's width minus this. */
  stripInset: 2,
} as const;

/** Indestructible drifting cover (L6, L10). */
export const SHADE_SLAB = { w: 40, h: 10, max: 12 } as const;

export type PortalColorId = 'cyan' | 'orange' | 'lime';

export const PORTAL = {
  r: 14,
  /** Exits are placed this far outside the partner ring. */
  exitPad: 2,
  /** Per-body re-entry cooldown, s (shots, rocks, pickups, opted-in enemies). */
  bodyCooldown: 0.35,
  shipCooldown: 1.0,
  swapTime: 0.8,
  maxPairs: 4,
  /** A partner this close to a pulsar's live ring (px) is closed to the ship. */
  pulsarPad: 10,
  /** A partner within a black-hole core plus this is closed to the ship. */
  holePad: 6,
} as const;

/** Dark, base, light per pair color (15-bit). */
export const PORTAL_COLORS: Readonly<Record<PortalColorId, readonly [string, string, string]>> = {
  cyan: ['#086878', '#30c8e0', '#b8f8f8'],
  orange: ['#803808', '#f88820', '#f8d8a0'],
  lime: ['#306808', '#90e028', '#e0f8a8'],
};

export type BubbleKind = 'slow' | 'fast' | 'flip';

export const BUBBLE = {
  slow: 0.35,
  fast: 1.8,
  /** Flip bubbles switch every `flipEvery` s, flickering for `flipFlicker` s before each switch. */
  flipEvery: 3,
  flipFlicker: 0.6,
  /** Design radii: small, medium, large. */
  radii: [36, 52, 70] as readonly number[],
  max: 8,
} as const;
