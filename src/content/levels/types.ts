// Level definition format, read by the wave director (game/director).

import type { EnemyOverrides } from '../../sim/spawn';
import type { AsteroidSize } from '../obstacles';
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
    | { escapePod: { x: XSpec } }
    | { drop: DropEvent }
    | { toast: string }
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
}
