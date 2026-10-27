import { LEVEL as ARMADA } from './armada';
import { LEVEL as CHRONO } from './chrono';
import { LEVEL as CORONA } from './corona';
import { LEVEL as EVENT_HORIZON } from './eventHorizon';
import { LEVEL as FOUNDRY } from './foundry';
import { LEVEL as ION_SHOALS } from './ionShoals';
import { LEVEL as JUNCTION } from './junction';
import { LEVEL1 } from './level1';
import { LEVEL as PULSAR_NURSERY } from './pulsarNursery';
import type { LevelDef } from './types';
import { LEVEL as WARRENS } from './warrens';

export * from './types';
export { LEVEL1 } from './level1';

/** Every sector by id. Sector folders (`./<id>/index.ts`) export `LEVEL` and `ROSTER`. */
export const LEVELS: Readonly<Record<string, LevelDef>> = {
  [LEVEL1.id]: LEVEL1,
  [ION_SHOALS.id]: ION_SHOALS,
  [EVENT_HORIZON.id]: EVENT_HORIZON,
  [PULSAR_NURSERY.id]: PULSAR_NURSERY,
  [ARMADA.id]: ARMADA,
  [CORONA.id]: CORONA,
  [WARRENS.id]: WARRENS,
  [JUNCTION.id]: JUNCTION,
  [CHRONO.id]: CHRONO,
  [FOUNDRY.id]: FOUNDRY,
};

/** Play order; `?level=N` picks entry N-1. */
export const LEVEL_ORDER: readonly string[] = [
  LEVEL1.id,
  ION_SHOALS.id,
  EVENT_HORIZON.id,
  PULSAR_NURSERY.id,
  ARMADA.id,
  CORONA.id,
  WARRENS.id,
  JUNCTION.id,
  CHRONO.id,
  FOUNDRY.id,
];

export interface ActDef {
  /** `ACT I`, `ACT II`: Sector Select page headers and the results banner. */
  name: string;
  /** Level ids in play order, a contiguous run of `LEVEL_ORDER`. */
  levels: readonly string[];
}

/** Sector Select pages by act; the first clear of an act's last sector shows "<name> COMPLETE". */
export const ACTS: readonly ActDef[] = [
  { name: 'ACT I', levels: LEVEL_ORDER.slice(0, 5) },
  { name: 'ACT II', levels: LEVEL_ORDER.slice(5) },
];

/** Index into `ACTS` of the act holding `id` (0 for unknown ids). */
export function actIndexOf(id: string, acts: readonly ActDef[] = ACTS): number {
  const i = acts.findIndex((a) => a.levels.includes(id));
  return i < 0 ? 0 : i;
}

/** The act `id` ends, if it is an act's last sector and another act follows; else null. */
export function actEndedBy(id: string, acts: readonly ActDef[] = ACTS): ActDef | null {
  const i = acts.findIndex((a) => a.levels[a.levels.length - 1] === id);
  return i >= 0 && i < acts.length - 1 ? (acts[i] as ActDef) : null;
}

/** Unknown ids fall back to Level 1 so a bad `levelId` still plays. */
export function getLevel(id: string): LevelDef {
  return LEVELS[id] ?? LEVEL1;
}

/** `?level=N` → level id, or null if N is missing or out of range. */
export function levelIdForNumber(n: number | null): string | null {
  if (n === null) return null;
  return LEVEL_ORDER[Math.floor(n) - 1] ?? null;
}

/** What the results screen shows. */
export function levelSummary(id: string): { id: string; name: string; duration: number } {
  const l = getLevel(id);
  return { id: l.id, name: l.name, duration: l.duration };
}
