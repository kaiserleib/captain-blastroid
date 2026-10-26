import { getTargetFilters } from './hooks';
import type { Body, Enemy } from './types';
import type { World } from './world';

/**
 * Whether auto-aim (seekers, homing retargets) may pick `e`. Roster enemies
 * always can; boss parts can't when they have no HP to lose (armor) or when a
 * registered filter (the boss module) says the part is shielded right now.
 */
export function isTargetable(w: World, e: Enemy): boolean {
  if (!e.active) return false;
  if (!e.isBoss) return true;
  if (e.maxHp <= 0) return false;
  const filters = getTargetFilters();
  for (let i = 0; i < filters.length; i++)
    if (!(filters[i] as (w: World, e: Enemy) => boolean)(w, e)) return false;
  return true;
}

let filterWorld: World | null = null;

/** `SpatialHash.nearest` filter over the enemy layer; call `targetFilterFor(w)` first. */
export function targetableBody(b: Body): boolean {
  return filterWorld !== null && isTargetable(filterWorld, b as Enemy);
}

export function targetFilterFor(w: World): (b: Body) => boolean {
  filterWorld = w;
  return targetableBody;
}
