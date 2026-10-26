// Level definition format, read by the wave director (game/director).

import type { EnemyOverrides } from '../../sim/spawn';
import type { AsteroidSize, RockTheme } from '../obstacles';
import type { PickupKind } from '../../sim/types';

/** A number in px, or `'rand'`: resolved through `world.rng` inside the safe x bounds. */
export type XSpec = number | 'rand';

/**
 * One asteroid emitter active over [from, to). Rate ramps linearly from `rate`
 * to `rateTo`. Overlapping segments stack, so a level can layer lanes.
 */
export interface AsteroidFieldSegment {
  from: number;
  to: number;
  /** Rocks/s at `from`. */
  rate: number;
  /** Rocks/s at `to` (default: `rate`). */
  rateTo?: number;
  sizes: Readonly<Partial<Record<AsteroidSize, number>>>;
  /** Own speed px/s (scroll drift is added). Default: the stream default. */
  speed?: readonly [number, number];
  /** Degrees off straight down, clamped to ±25. */
  angle?: readonly [number, number];
  xRange?: readonly [number, number];
  /** Interval jitter (0..0.95). */
  jitter?: number;
}

export interface FormationEvent {
  type: 'column' | 'v' | 'line' | 'stagger';
  enemy: string;
  count: number;
  x: XSpec;
  /** Default per type (see director). */
  spacing?: number;
  /** Seconds between member spawns. */
  delay?: number;
  overrides?: EnemyOverrides;
}

/** Entry sides. `left`/`right` enter from the side at `y`; corners for swoopers. */
export type SpawnFrom = 'top' | 'left' | 'right' | 'topLeft' | 'topRight';

export interface SpawnEvent {
  enemy: string;
  from?: SpawnFrom;
  /** Used for `top` entries. Default 'rand'. */
  x?: XSpec;
  /** Used for side entries (cruise height). */
  y?: number;
  overrides?: EnemyOverrides;
}

export interface DropEvent {
  kind: PickupKind;
  x: XSpec;
  payload?: string;
  amount?: number;
}

/** Places an anomaly. Variants are ids in content/obstacles (`BLACK_HOLE_VARIANTS`, `PULSAR_VARIANTS`). */
export interface AnomalyEvent {
  kind: 'blackhole' | 'pulsar';
  x: XSpec;
  /** Default: just above the top edge (−radius). */
  y?: number;
  /** Default 0 / `world.scrollSpeed` (drifts with the scroll). */
  vx?: number;
  vy?: number;
  variant?: string;
  /** Pulsars: seconds already elapsed on the pulse clock at spawn (phase-locks rings to the music). */
  phase?: number;
}

/** Ramps `world.scrollSpeed` linearly to `to` over `over` seconds (0 = instant). */
export interface ScrollEvent {
  to: number;
  over: number;
}

interface EventBase {
  /** Level seconds. */
  t: number;
  /** Fires `times` times in total, `every` s apart (the first at `t`). */
  repeat?: { every: number; times: number };
}

/** Exactly one action per event. */
export type TimelineEvent = EventBase &
  (
    | {
        formation: FormationEvent;
        /** If this formation is cleared and the player lacks the weapon, its capsule is this weapon. */
        forceCapsule?: string;
      }
    | { spawn: SpawnEvent }
    | {
        escapePod: {
          x: XSpec;
          /** Enemy shots the pod survives (default 1: the first hit destroys it). */
          hp?: number;
        };
      }
    | { anomaly: AnomalyEvent }
    | { scroll: ScrollEvent }
    /** A named level script (registered by the level's game folder) for bespoke beats. */
    | { script: string; args?: Readonly<Record<string, number | string>> }
    | { drop: DropEvent }
    | {
        toast: string;
        /** Shown instead when the level's next pod would be a salvage cache (all its pilots rescued). */
        ifNoPod?: string;
      }
    | { bossWarning: true }
    | { boss: string }
  );

export interface LevelDef {
  id: string;
  /** 1-based, for `?level=N`. */
  number: number;
  name: string;
  theme: string;
  music: string;
  /** px/s. */
  scrollSpeed: number;
  /** Nominal length in seconds including a typical boss fight (results screen). */
  duration: number;
  asteroidField: readonly AsteroidFieldSegment[];
  timeline: readonly TimelineEvent[];
  /** Ship ids; the first one the save hasn't found or built drops from the boss. */
  schematicOnClear: readonly string[];
  /** Salvage sprayed by the boss on defeat. */
  bossSalvage: number;
  /** Salvage cache sprayed when every pilot of this level is already rescued. */
  podFallbackSalvage: number;
  /** Rock look and toughness. */
  rockTheme: RockTheme;
  /** Song id played on `bossSpawned` (default `boss`). */
  bossMusic?: string;
  /** Multiplier on the HP of *reused* Level 1 roster enemies (rounded, min 1). Default 1. */
  enemyHpMul?: number;
  /** Multiplier on every enemy shot's speed in this level. Default 1. */
  enemyShotSpeedMul?: number;
  /** If the player holds only one weapon at `by` level seconds, drop a `weapon` capsule ahead of them. */
  guaranteeWeapon?: { by: number; weapon: string };
}
