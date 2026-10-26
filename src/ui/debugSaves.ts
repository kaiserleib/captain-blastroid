// Crafted saves for `?save=fresh|mid|all` (dev only), to see every locked/unlocked state.
import { PILOT_ORDER, SHIP_ORDER, UPGRADES, UPGRADE_ORDER } from '../content';
import { createDefaultSave, type SaveData } from '../meta';

export type DebugSaveId = 'fresh' | 'mid' | 'all';

const DAY = '2026-10-20T12:00:00.000Z';

/**
 * fresh: a new player. mid: Juno rescued, Bulwark buildable, Dart schematic found but
 * unaffordable, a few upgrades and scores. all: everything unlocked and mostly maxed.
 */
export function debugSave(id: DebugSaveId): SaveData {
  const s = createDefaultSave();
  if (id === 'fresh') return s;
  if (id === 'mid') {
    return {
      ...s,
      salvage: 180,
      totalSalvageEarned: 420,
      upgrades: { capacitors: 2, tractor: 1 },
      schematics: ['bulwark', 'dart'],
      pilotsRescued: ['blastroid', 'juno'],
      highScores: [
        { score: 18450, pilot: 'juno', ship: 'kestrel', date: DAY },
        { score: 9120, pilot: 'blastroid', ship: 'kestrel', date: DAY },
        { score: 2400, pilot: 'blastroid', ship: 'kestrel', date: DAY },
      ],
      stats: { runs: 5, kills: 612, deaths: 4, bossKills: 1 },
    };
  }
  const upgrades: Record<string, number> = {};
  for (const u of UPGRADE_ORDER) {
    const def = UPGRADES[u];
    if (def) upgrades[u] = Math.max(1, def.maxLevel - 1);
  }
  return {
    ...s,
    salvage: 4200,
    totalSalvageEarned: 9800,
    upgrades,
    schematics: SHIP_ORDER.filter((id) => id !== 'kestrel'),
    shipsBuilt: [...SHIP_ORDER],
    pilotsRescued: [...PILOT_ORDER],
    highScores: Array.from({ length: 10 }, (_, i) => ({
      score: 52000 - i * 4300,
      pilot: PILOT_ORDER[i % PILOT_ORDER.length] as string,
      ship: SHIP_ORDER[i % SHIP_ORDER.length] as string,
      date: DAY,
    })),
    stats: { runs: 31, kills: 5180, deaths: 24, bossKills: 7 },
  };
}
