import { LEVEL1 } from './level1';
import type { LevelDef } from './types';

export * from './types';
export { LEVEL1 } from './level1';

export const LEVELS: Readonly<Record<string, LevelDef>> = { [LEVEL1.id]: LEVEL1 };

/** Play order; `?level=N` picks entry N-1. */
export const LEVEL_ORDER: readonly string[] = [LEVEL1.id];

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
