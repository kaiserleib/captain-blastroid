import { LEVEL as ARMADA } from './armada';
import { LEVEL as CHRONO } from './chrono';
import { LEVEL as CORONA } from './corona';
import { LEVEL as EVENT_HORIZON } from './eventHorizon';
import { LEVEL as FOUNDRY } from './foundry';
import { LEVEL as GAUNTLET } from './gauntlet';
import { LEVEL as ION_SHOALS } from './ionShoals';
import { LEVEL as JUNCTION } from './junction';
import { LEVEL1 } from './level1';
import { LEVEL as PULSAR_NURSERY } from './pulsarNursery';
import type { LevelDef } from './types';
import { LEVEL as WARRENS } from './warrens';

export * from './types';
export { LEVEL1 } from './level1';
export {
  GAUNTLET_DEN,
  GAUNTLET_ROUNDS,
  GAUNTLET_TERRAIN,
  ROUND_GAP,
  roundStarts,
  type GauntletRound,
} from './gauntlet';

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
  [GAUNTLET.id]: GAUNTLET,
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
  GAUNTLET.id,
];

export interface ActDef {
  /** `ACT I`, `ACT II`: Sector Select page headers and the results banner. */
  name: string;
  /** Level ids in play order, a contiguous run of `LEVEL_ORDER`. */
  levels: readonly string[];
  /** Past the campaign (the Gauntlet): its clear isn't CAMPAIGN COMPLETE. */
  extra?: boolean;
}

/** Sector Select pages by act; the first clear of an act's last sector shows "<name> COMPLETE". */
export const ACTS: readonly ActDef[] = [
  { name: 'ACT I', levels: LEVEL_ORDER.slice(0, 5) },
  { name: 'ACT II', levels: LEVEL_ORDER.slice(5, 10) },
  { name: 'GAUNTLET', levels: LEVEL_ORDER.slice(10), extra: true },
];

/** The last sector of the last act that isn't `extra`: its first clear is CAMPAIGN COMPLETE. */
export function campaignFinale(acts: readonly ActDef[] = ACTS): string {
  const story = acts.filter((a) => a.extra !== true);
  const last = story[story.length - 1];
  return last?.levels[last.levels.length - 1] ?? '';
}

/** The act whose last sector is `id` (whether or not another act follows), else null. */
export function actFinishedBy(id: string, acts: readonly ActDef[] = ACTS): ActDef | null {
  return acts.find((a) => a.levels[a.levels.length - 1] === id) ?? null;
}

/** The first sector (in play order) whose own timeline summons `bossId`; hosts like the Gauntlet are skipped. */
export function bossHomeLevel(bossId: string): LevelDef | null {
  for (const id of LEVEL_ORDER) {
    const l = LEVELS[id] as LevelDef;
    if (l.hostLevels !== undefined) continue;
    if (l.timeline.some((ev) => 'boss' in ev && ev.boss === bossId)) return l;
  }
  return null;
}

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
