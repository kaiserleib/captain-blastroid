import type { LevelDef } from '../../content/levels';
import type { AsteroidStream } from '../obstacles';
import type { ScheduledFire } from './timeline';

export type DirectorPhase = 'level' | 'boss' | 'outro' | 'done';

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
  /** Seconds since `bossDefeated`. */
  outroT: number;
  outroStep: number;
  bossX: number;
  bossY: number;
  /** Firings per timeline index. */
  fires: number[];
  /** Fired schedule entries, for tests and debugging. */
  log: string[];
  offs: (() => void)[];
}

export const LOG_LIMIT = 4000;

export function logLine(st: DirectorState, line: string): void {
  if (st.log.length < LOG_LIMIT) st.log.push(line);
}
