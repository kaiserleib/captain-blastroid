// Crafted saves for `?save=fresh|mid|act1|all` (dev only), to see every locked/unlocked state.
import {
  LEVEL_ORDER,
  PILOT_ORDER,
  SHIP_ORDER,
  UPGRADES,
  UPGRADE_ORDER,
  type WeaponId,
} from '../content';
import { createDefaultSave, type HighScore, type LevelRecord, type SaveData } from '../meta';

export type DebugSaveId = 'fresh' | 'mid' | 'act1' | 'all';

const DAY = '2026-10-20T12:00:00.000Z';

/**
 * fresh: a new player. mid: sector 1 cleared (sector 2 unlocked and selected), Juno
 * rescued, Bulwark buildable, Dart schematic found but unaffordable, a few upgrades and
 * scores. act1: Act I finished the way a player reaching sector 6 would have it (the
 * baseline for Act II balance). all: every sector cleared, everything unlocked and mostly maxed.
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
  if (id === 'act1') return act1Save(s);
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

const ACT1_LEVELS = ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada'];
const ACT1_SHIPS = ['kestrel', 'bulwark', 'dart', 'warden', 'corsair', 'halcyon', 'paragon'];
const ACT1_PILOTS = ['blastroid', 'juno', 'grieg', 'zzkar', 'sable', 'pip', 'vale'];
const ACT1_WEAPONS: WeaponId[] = ['blaster', 'spread', 'lance', 'seeker', 'orbitDrones'];

/** Kestrel + Blastroid still selected so bot numbers compare with Act I's. */
function act1Save(s: SaveData): SaveData {
  const upgrades: Record<string, number> = {};
  for (const u of UPGRADE_ORDER) {
    const def = UPGRADES[u];
    if (def) upgrades[u] = def.maxLevel;
  }
  const levels: Record<string, LevelRecord> = {};
  ACT1_LEVELS.forEach((lid, i) => {
    levels[lid] = { clears: 1, best: ALL_BEST + i * ALL_BEST_STEP };
  });
  return {
    ...s,
    salvage: 600,
    totalSalvageEarned: 6200,
    upgrades,
    schematics: ACT1_SHIPS.filter((id) => id !== 'kestrel'),
    shipsBuilt: [...ACT1_SHIPS],
    pilotsRescued: [...ACT1_PILOTS],
    levels,
    weaponsUnlocked: [...ACT1_WEAPONS],
    selectedShip: 'kestrel',
    selectedPilot: 'blastroid',
    selectedLevel: 'corona',
    stats: { runs: 24, kills: 4100, deaths: 18, bossKills: 5 },
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
