import { getLevel, LEVEL_ORDER, SHIPS } from '../content';
import { isLevelUnlocked, nextRescuablePilot, type SaveData } from '../meta';

/** What a sector card shows. */
export interface SectorInfo {
  id: string;
  /** 1-based campaign position. */
  number: number;
  name: string;
  unlocked: boolean;
  clears: number;
  best: number;
  /** An unrescued pilot still rides this sector's escape pod. */
  pod: boolean;
  /** This sector's boss still carries a ship schematic the save hasn't found or built. */
  schematic: boolean;
}

/**
 * Mirrors the director's pickSchematic (without this run's finds): the first listed
 * ship that exists and is neither found nor built.
 */
export function hasSchematicLeft(save: SaveData, levelId: string): boolean {
  for (const shipId of getLevel(levelId).schematicOnClear) {
    const ship = SHIPS[shipId];
    if (!ship || save.shipsBuilt.includes(shipId)) continue;
    const sid = ship.unlock.kind === 'schematic' ? ship.unlock.schematicId : shipId;
    if (save.schematics.includes(sid) || save.schematics.includes(shipId)) continue;
    return true;
  }
  return false;
}

export function sectorInfo(
  save: SaveData,
  id: string,
  order: readonly string[] = LEVEL_ORDER,
): SectorInfo {
  const rec = save.levels[id];
  return {
    id,
    number: order.indexOf(id) + 1,
    name: getLevel(id).name,
    unlocked: isLevelUnlocked(save, id, order),
    clears: rec?.clears ?? 0,
    best: rec?.best ?? 0,
    pod: nextRescuablePilot(save, id) !== null,
    schematic: hasSchematicLeft(save, id),
  };
}

/** "1 THE KESSLER BELT": the hangar row, records and results titles. */
export function sectorLabel(id: string, order: readonly string[] = LEVEL_ORDER): string {
  return `${order.indexOf(id) + 1} ${getLevel(id).name}`;
}
