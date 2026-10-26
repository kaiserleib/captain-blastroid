// Crafted saves for `?save=fresh|mid|all` (dev only), to see every locked/unlocked state.
import { LEVEL_ORDER, PILOT_ORDER, SHIP_ORDER, UPGRADES, UPGRADE_ORDER } from '../content';
import { createDefaultSave, type HighScore, type LevelRecord, type SaveData } from '../meta';

export type DebugSaveId = 'fresh' | 'mid' | 'all';

const DAY = '2026-10-20T12:00:00.000Z';

/**
 * fresh: a new player. mid: sector 1 cleared (sector 2 unlocked and selected), Juno
 * rescued, Bulwark buildable, Dart schematic found but unaffordable, a few upgrades and
 * scores. all: every sector cleared, everything unlocked and mostly maxed.
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
        { score: 18450, pilot: 'juno', ship: 'kestrel', level: 'kessler', date: DAY },
        { score: 9120, pilot: 'blastroid', ship: 'kestrel', level: 'kessler', date: DAY },
        { score: 2400, pilot: 'blastroid', ship: 'kestrel', level: 'kessler', date: DAY },
      ],
      levels: { kessler: { clears: 1, best: 18450 } },
      selectedLevel: LEVEL_ORDER[1] ?? s.selectedLevel,
      stats: { runs: 5, kills: 612, deaths: 4, bossKills: 1 },
    };
  }
  const upgrades: Record<string, number> = {};
  for (const u of UPGRADE_ORDER) {
    const def = UPGRADES[u];
    if (def) upgrades[u] = Math.max(1, def.maxLevel - 1);
  }
  const levels = allLevels();
  let bossKills = 0;
  for (const rec of Object.values(levels)) bossKills += rec.clears;
  return {
    ...s,
    salvage: 4200,
    totalSalvageEarned: 9800,
    upgrades,
    schematics: SHIP_ORDER.filter((id) => id !== 'kestrel'),
    shipsBuilt: [...SHIP_ORDER],
    pilotsRescued: [...PILOT_ORDER],
    highScores: allScores(),
    levels,
    stats: { runs: 31 + bossKills, kills: 5180, deaths: 24, bossKills },
  };
}

// Later sectors score higher and have been flown fewer times.
const ALL_BEST = 52000;
const ALL_BEST_STEP = 9000;

function allLevels(): Record<string, LevelRecord> {
  const out: Record<string, LevelRecord> = {};
  LEVEL_ORDER.forEach((id, i) => {
    out[id] = { clears: Math.max(1, 7 - 2 * i), best: ALL_BEST + i * ALL_BEST_STEP };
  });
  return out;
}

function allScores(): HighScore[] {
  const out: HighScore[] = [];
  LEVEL_ORDER.forEach((level, li) => {
    const n = Math.max(3, 10 - 2 * li);
    for (let i = 0; i < n; i++) {
      out.push({
        score: ALL_BEST + li * ALL_BEST_STEP - i * 4300,
        pilot: PILOT_ORDER[(i + li) % PILOT_ORDER.length] as string,
        ship: SHIP_ORDER[(i + li) % SHIP_ORDER.length] as string,
        level,
        date: DAY,
      });
    }
  });
  return out.sort((a, b) => b.score - a.score);
}
