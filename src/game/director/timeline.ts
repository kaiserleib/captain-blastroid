// Pure timeline helpers: schedule expansion, field ramps, x resolution, rewards.

import type {
  AsteroidFieldSegment,
  FormationEvent,
  LevelDef,
  TimelineEvent,
  XSpec,
} from '../../content/levels';
import { REGISTERED_ACTION_KINDS } from '../../content/levels';
import { SHIPS } from '../../content/ships';
import type { Rng } from '../../engine/rng';

/** One firing of a timeline event (repeats expand into several). */
export interface ScheduledFire {
  t: number;
  /** Index into `level.timeline`. */
  index: number;
  /** 0 for the first firing. */
  rep: number;
}

/**
 * Flattens the timeline (repeats expanded) and sorts by time. Order among
 * equal times follows the authored order, so the result is stable.
 */
export function buildSchedule(timeline: readonly TimelineEvent[]): ScheduledFire[] {
  const out: ScheduledFire[] = [];
  for (let i = 0; i < timeline.length; i++) {
    const ev = timeline[i] as TimelineEvent;
    const times = Math.max(1, ev.repeat?.times ?? 1);
    const every = ev.repeat?.every ?? 0;
    for (let k = 0; k < times; k++) out.push({ t: ev.t + k * every, index: i, rep: k });
  }
  out.sort((a, b) => a.t - b.t || a.index - b.index || a.rep - b.rep);
  return out;
}

/** First schedule index at or after `startT` (everything before it is skipped). */
export function firstFireAt(schedule: readonly ScheduledFire[], startT: number): number {
  let i = 0;
  while (i < schedule.length && (schedule[i] as ScheduledFire).t < startT) i++;
  return i;
}

/** Rocks/s for a segment at time t, ramping rate → rateTo across [from, to); 0 outside. */
export function segmentRate(seg: AsteroidFieldSegment, t: number): number {
  if (t < seg.from || t >= seg.to) return 0;
  const span = seg.to - seg.from;
  const u = span > 0 ? (t - seg.from) / span : 0;
  const to = seg.rateTo ?? seg.rate;
  return seg.rate + (to - seg.rate) * u;
}

/** Total field density at t across every overlapping segment. */
export function fieldRate(level: LevelDef, t: number): number {
  let r = 0;
  for (const s of level.asteroidField) r += segmentRate(s, t);
  return r;
}

/** Spawns are kept this far inside the screen edges. */
export const SAFE_X_MARGIN = 16;

export const DEFAULT_SPACING: Readonly<Record<FormationEvent['type'], number>> = {
  column: 20,
  v: 20,
  line: 24,
  stagger: 22,
};

/** Half the horizontal extent of a formation, so 'rand' keeps every member on screen. */
export function formationHalfWidth(f: FormationEvent): number {
  const s = f.spacing ?? DEFAULT_SPACING[f.type];
  switch (f.type) {
    case 'column':
      return 0;
    case 'stagger':
      return s / 2;
    case 'line':
      return ((f.count - 1) / 2) * s;
    case 'v':
      return Math.ceil((f.count - 1) / 2) * s;
  }
}

/** A fixed x passes through; 'rand' draws from the rng inside the safe bounds. */
export function resolveX(spec: XSpec, rng: Rng, halfWidth = 0, width = 240): number {
  if (spec !== 'rand') return spec;
  const lo = SAFE_X_MARGIN + halfWidth;
  const hi = width - SAFE_X_MARGIN - halfWidth;
  if (hi <= lo) return width / 2;
  return rng.range(lo, hi);
}

function isShip(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHIPS, id);
}

/**
 * The first ship in `order` that hasn't been found (save or this run) or
 * built. Ids that aren't ships (yet) are skipped, so a level can list ships
 * another ticket adds.
 */
export function pickSchematic(
  order: readonly string[],
  found: { schematics: readonly string[]; shipsBuilt: readonly string[] },
  runSchematics: readonly string[],
  exists: (id: string) => boolean = isShip,
): string | null {
  for (const id of order) {
    if (!exists(id)) continue;
    if (found.schematics.includes(id) || found.shipsBuilt.includes(id)) continue;
    if (runSchematics.includes(id)) continue;
    return id;
  }
  return null;
}

/** Short label of an event's action, for logs and tests. */
export function eventKind(ev: TimelineEvent): string {
  if ('formation' in ev) return 'formation';
  if ('spawn' in ev) return 'spawn';
  if ('escapePod' in ev) return 'escapePod';
  if ('drop' in ev) return 'drop';
  if ('toast' in ev) return 'toast';
  if ('bossWarning' in ev) return 'bossWarning';
  if ('anomaly' in ev) return 'anomaly';
  if ('scroll' in ev) return 'scroll';
  if ('script' in ev) return 'script';
  if ('boss' in ev) return 'boss';
  for (const k of REGISTERED_ACTION_KINDS) if (k in ev) return k;
  return 'boss';
}
