import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from './types';

// Placeholder sector (T21): ~45 s of rocks, three gnat formations, a pod at
// 20 s and the Rock Hauler at 40 s, carrying the sector's real tuning numbers.
// Each wave-6 sector ticket replaces its stub's field and timeline wholesale.

export const STUB_FIELD: readonly AsteroidFieldSegment[] = [
  { from: 0, to: 12, rate: 0.6, rateTo: 1, sizes: { small: 1 }, speed: [14, 32] },
  { from: 12, to: 36, rate: 1, rateTo: 1.4, sizes: { small: 3, medium: 1 } },
  { from: 36, to: 38, rate: 1, rateTo: 0.2, sizes: { small: 1 } },
];

/** The shared stub beats; `extra` adds a sector's own (an anomaly, a scroll change). */
export function stubTimeline(
  name: string,
  podHp: number,
  extra: readonly TimelineEvent[] = [],
): TimelineEvent[] {
  return [
    { t: 0.5, toast: name },
    { t: 6, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 12, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
    { t: 19, toast: 'ESCAPE POD AHEAD', ifNoPod: 'SALVAGE CACHE AHEAD' },
    { t: 20, escapePod: { x: 'rand', hp: podHp } },
    { t: 26, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    ...extra,
    { t: 38, bossWarning: true },
    { t: 40, boss: 'rock_hauler' },
  ];
}

/** The fields every stub shares; a sector spreads this and sets its own numbers. */
export const STUB_BASE: Pick<LevelDef, 'duration' | 'asteroidField'> = {
  duration: 105,
  asteroidField: STUB_FIELD,
};
