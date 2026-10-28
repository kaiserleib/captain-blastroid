// Watches one run's world for the run log: hits by phase and cause, the boss's
// arrival and defeat, and what killed the ship.
import type { RunLogEntry, RunOutcome } from '../../meta';
import type { World } from '../../sim/world';
import { hitCause } from './hitCause';

type Phase = 'level' | 'boss' | 'escape';

interface Recorder {
  w: World;
  phase: Phase;
  hits: Record<string, number>;
  bossAt: number | null;
  bossEnd: number | null;
  lastCause: string;
  lastHitTick: number;
  deathCause: string | null;
}

let current: Recorder | null = null;

/** Starts recording `w`; GameScene calls it on enter. The world's `events.clear()` detaches it. */
export function startRunRecord(w: World): void {
  const r: Recorder = {
    w,
    phase: 'level',
    hits: {},
    bossAt: null,
    bossEnd: null,
    lastCause: '?',
    lastHitTick: -1,
    deathCause: null,
  };
  current = r;
  w.events.on('playerHit', () => {
    r.lastCause = hitCause(w);
    r.lastHitTick = w.tick;
    const key = `${r.phase}:${r.lastCause}`;
    r.hits[key] = (r.hits[key] ?? 0) + 1;
  });
  w.events.on('playerDied', () => {
    r.deathCause = r.lastHitTick === w.tick ? r.lastCause : hitCause(w);
  });
  w.events.on('bossSpawned', () => {
    if (r.bossAt !== null) return;
    r.bossAt = w.time;
    r.phase = 'boss';
  });
  w.events.on('bossDefeated', () => {
    r.bossEnd ??= w.time;
  });
  w.events.on('escapeStarted', () => {
    r.phase = 'escape';
  });
}

export interface RunEnd {
  outcome: RunOutcome;
  /** Salvage banked. */
  salvage: number;
  at?: Date;
}

/** The finished run's log entry, or null if no run was recorded. Clears the recorder. */
export function finishRunRecord(end: RunEnd): RunLogEntry | null {
  const r = current;
  current = null;
  if (r === null) return null;
  const { w } = r;
  const run = w.run;
  return {
    at: (end.at ?? new Date()).toISOString(),
    level: run.levelId,
    ship: run.shipId,
    pilot: run.pilotId,
    outcome: end.outcome,
    time: w.time,
    bossAt: r.bossAt,
    bossTime: r.bossAt === null ? null : (r.bossEnd ?? w.time) - r.bossAt,
    score: run.score,
    salvage: end.salvage,
    kills: run.kills,
    pod: run.pickupsCollected.escapePod > 0,
    hits: r.hits,
    deathCause: end.outcome === 'death' ? (r.deathCause ?? r.lastCause) : null,
    weapons: w.player.weapons.map((wp) => `${wp.id}${wp.level}`).join(' '),
  };
}
