// Level definition format, read by the wave director (game/director).

import type { EnemyOverrides } from '../../sim/spawn';
import type { AsteroidSize, RockTheme } from '../obstacles';
import type { PickupKind } from '../../sim/types';
import type { WeaponId } from '../weapons';

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

/** Act II hazard placements, run by whichever module registered the kind (`registerTimelineAction`). */
export interface FlareEvent {
  /** Seconds (default from content). */
  warn?: number;
  burn?: number;
  /** Teaching flare: telegraphs and outlines shade, deals no damage. */
  practice?: boolean;
}
export interface FlaresEvent {
  every: number;
  /** Level seconds after which no new flare starts. */
  until: number;
  warn?: number;
  burn?: number;
}
export interface ShadeSlabEvent {
  x: XSpec;
  vx?: number;
}
export interface TerrainEvent {
  /** Chunk id in content. */
  chunk: string;
  /** Tile set, e.g. `warrens`, `foundry`. */
  theme: string;
}
export interface PortalEvent {
  a: readonly [number, number];
  b: readonly [number, number];
  color: string;
  /** Ends drift with the scroll (default true). */
  drift?: boolean;
}
export interface BubbleEvent {
  kind: 'slow' | 'fast' | 'flip';
  x: XSpec;
  /** Default: just above the top edge. */
  y?: number;
  r: number;
  ttl?: number;
  vx?: number;
  vy?: number;
}

/** Event kinds dispatched through `registerTimelineAction` rather than by the director itself. */
export const REGISTERED_ACTION_KINDS = [
  'flare',
  'flares',
  'shadeSlab',
  'terrain',
  'portal',
  'bubble',
] as const;
export type RegisteredActionKind = (typeof REGISTERED_ACTION_KINDS)[number];

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
    | { flare: FlareEvent }
    | { flares: FlaresEvent }
    | { shadeSlab: ShadeSlabEvent }
    | { terrain: TerrainEvent }
    | { portal: PortalEvent }
    | { bubble: BubbleEvent }
    /** A named level script (registered by the level's game folder) for bespoke beats. */
    | { script: string; args?: Readonly<Record<string, number | string>> }
    | { drop: DropEvent }
    | {
        toast: string;
        /** Shown instead when the level's next pod would be a salvage cache (all its pilots rescued). */
        ifNoPod?: string;
      }
    | { bossWarning: true }
    | {
        boss: string;
        /**
         * The stage goes on after this boss (gauntlet rounds): its defeat pays
         * `salvage` (default `bossSalvage`), resumes the timeline and the field,
         * and doesn't count as a clear. The last boss of a level never continues.
         */
        continue?: boolean;
        salvage?: number;
      }
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
  /** Act II: this sector's supply run may drop this weapon while it's locked; the first clear unlocks it. */
  fieldTestWeapon?: WeaponId;
  /** Act II finale: boss defeat starts a timed escape, and the run is won when it ends. */
  escape?: EscapeDef;
  /** Other sectors whose level systems and layers also run here (the gauntlet hosts their bosses). */
  hostLevels?: readonly string[];
}

export interface EscapeDef {
  /** Countdown, seconds. */
  dur: number;
  /** Scroll ramp at the start: px/s and seconds. */
  scrollTo: number;
  over: number;
  /** Level script started with the escape. */
  script?: string;
  /** Salvage paid at the end, minus `bonusPerHit` per hit taken (min 0). */
  bonus: number;
  bonusPerHit: number;
  /** Toast at the start (default `ESCAPE_TOAST` in game/director). */
  toast?: string;
}
