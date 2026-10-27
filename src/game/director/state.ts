import type { LevelDef } from '../../content/levels';
import type { System } from '../../sim/world';
import type { AsteroidStream } from '../obstacles';
import type { ScheduledFire } from './timeline';

export type DirectorPhase = 'level' | 'boss' | 'escape' | 'outro' | 'done';

export interface CapsuleFix {
  x: number;
  y: number;
  weaponId: string;
}

export interface DirectorState {
  level: LevelDef;
  /** Level clock; frozen while the boss lives. */
  t: number;
  startT: number;
  phase: DirectorPhase;
  schedule: ScheduledFire[];
  /** Next schedule entry to fire. */
  cursor: number;
  /** One stream slot per field segment (null until it starts / after it ends). */
  streams: (AsteroidStream | null)[];
  segmentDone: boolean[];
  fieldStopped: boolean;
  /** Formation id → weapon its clear capsule should be. */
  forced: Map<number, string>;
  /** Weapons a forced capsule has already been granted for. */
  forcedGranted: Set<string>;
  capsuleFixes: CapsuleFix[];
  /** `LevelDef.escape` after the boss: seconds in, seconds left, hits taken. */
  escape: EscapeState;
  /** Seconds since `bossDefeated` (or since the escape ended). */
  outroT: number;
  outroStep: number;
  bossX: number;
  bossY: number;
  /** Firings per timeline index. */
  fires: number[];
  /** Active `scroll` ramp: from → to over `over` s, `t` s in (inactive once t ≥ over). */
  scroll: { active: boolean; from: number; to: number; over: number; t: number };
  /** `guaranteeWeapon` has been checked (it fires at most once). */
  guaranteeDone: boolean;
  /** `registerLevelSystem` entries for this level (a live list). */
  systems: readonly System[];
  /** Fired schedule entries, for tests and debugging. */
  log: string[];
  offs: (() => void)[];
}

export interface EscapeState {
  /** Started; stays true through the outro, so the last-shield guard holds to the end. */
  active: boolean;
  t: number;
  left: number;
  hits: number;
  magnetized: boolean;
}

export const LOG_LIMIT = 4000;

export function logLine(st: DirectorState, line: string): void {
  if (st.log.length < LOG_LIMIT) st.log.push(line);
}
