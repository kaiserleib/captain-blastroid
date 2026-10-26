import { LEVEL as ARMADA } from './armada';
import { LEVEL as EVENT_HORIZON } from './eventHorizon';
import { LEVEL as ION_SHOALS } from './ionShoals';
import { LEVEL1 } from './level1';
import { LEVEL as PULSAR_NURSERY } from './pulsarNursery';
import type { LevelDef } from './types';

export * from './types';
export { LEVEL1 } from './level1';

/** Every sector by id. Sector folders (`./<id>/index.ts`) export `LEVEL` and `ROSTER`. */
export const LEVELS: Readonly<Record<string, LevelDef>> = {
  [LEVEL1.id]: LEVEL1,
  [ION_SHOALS.id]: ION_SHOALS,
  [EVENT_HORIZON.id]: EVENT_HORIZON,
  [PULSAR_NURSERY.id]: PULSAR_NURSERY,
  [ARMADA.id]: ARMADA,
};

/** Play order; `?level=N` picks entry N-1. */
export const LEVEL_ORDER: readonly string[] = [
  LEVEL1.id,
  ION_SHOALS.id,
  EVENT_HORIZON.id,
  PULSAR_NURSERY.id,
  ARMADA.id,
];

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
