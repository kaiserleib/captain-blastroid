// Meta-progression rules. Pure functions on SaveData: they return new saves and never do I/O.
import {
  LEVEL_ORDER,
  MAX_WEAPON_SLOTS,
  MIN_MAX_SHIELD,
  PILOTS,
  PILOT_ORDER,
  SHIPS,
  SHIP_ORDER,
  getDef,
  WEAPONS,
  type ShipDef,
  type StartingWeapon,
  type WeaponId,
} from '../content';
import { createPlayerStats, type RunState } from '../sim/world';
import type { PlayerStats } from '../sim/types';
import { HIGH_SCORE_LIMIT, type HighScore, type SaveData } from './schema';
import { applyStatMods, applyUpgrades, startWeaponBonus } from './upgrades';

/** What a finished (or abandoned) run hands to the meta layer. */
export interface RunResult {
  shipId: string;
  pilotId: string;
  levelId: string;
  score: number;
  /** Raw salvage collected; bankRun applies salvageMul. */
  salvage: number;
  kills: number;
  schematics: string[];
  pilotsRescued: string[];
  bossDefeated: boolean;
  victory: boolean;
  /** Quit from the pause menu: banks salvage and stats but never a score. */
  abandoned?: boolean;
  /** Set by bankRun when this clear unlocked the level's field-test weapon (T35). */
  unlockedWeapon?: WeaponId;
}

/** Scores below this never enter the high-score tables. */
export const HIGH_SCORE_FLOOR = 1000;

export function runResultFrom(run: RunState, victory: boolean, abandoned = false): RunResult {
  return {
    shipId: run.shipId,
    pilotId: run.pilotId,
    levelId: run.levelId,
    score: run.score,
    salvage: run.salvage,
    kills: run.kills,
    schematics: [...run.schematics],
    pilotsRescued: [...run.pilotsRescued],
    bossDefeated: run.bossDefeated,
    victory,
    abandoned,
  };
}

export type Discovery =
  | { kind: 'schematic'; schematicId: string; shipId: string }
  | { kind: 'pilot'; pilotId: string }
  /** 1-based position in the high-score table. */
  | { kind: 'highScore'; rank: number };

export interface BankResult {
  save: SaveData;
  /** Salvage actually banked, after salvageMul. */
  salvageEarned: number;
  discoveries: Discovery[];
}

/** Ship whose blueprint is `schematicId`, if any. */
export function shipForSchematic(schematicId: string): ShipDef | null {
  for (const id of SHIP_ORDER) {
    const ship = SHIPS[id];
    if (ship && ship.unlock.kind === 'schematic' && ship.unlock.schematicId === schematicId) {
      return ship;
    }
  }
  return null;
}

/** Pilot passive + hangar upgrades. Unknown pilot ids contribute nothing. */
export function computeStatMods(save: SaveData, pilotId: string): PlayerStats {
  const stats = createPlayerStats();
  const pilot = PILOTS[pilotId];
  if (pilot) applyStatMods(stats, pilot.passive);
  applyUpgrades(stats, save);
  return stats;
}

export function bankRun(save: SaveData, result: RunResult, now: Date = new Date()): BankResult {
  const discoveries: Discovery[] = [];
  const mods = computeStatMods(save, result.pilotId);
  const salvageEarned = Math.max(0, Math.round(result.salvage * mods.salvageMul));

  const schematics = [...save.schematics];
  for (const id of result.schematics) {
    const ship = shipForSchematic(id);
    if (!ship || schematics.includes(id) || save.shipsBuilt.includes(ship.id)) continue;
    schematics.push(id);
    discoveries.push({ kind: 'schematic', schematicId: id, shipId: ship.id });
  }

  const pilotsRescued = [...save.pilotsRescued];
  for (const id of result.pilotsRescued) {
    if (!(id in PILOTS) || pilotsRescued.includes(id)) continue;
    pilotsRescued.push(id);
    discoveries.push({ kind: 'pilot', pilotId: id });
  }

  const abandoned = result.abandoned === true;
  let highScores = save.highScores;
  if (!abandoned && result.score >= HIGH_SCORE_FLOOR) {
    const added = insertHighScore(highScores, {
      score: result.score,
      pilot: result.pilotId,
      ship: result.shipId,
      level: result.levelId,
      date: now.toISOString(),
    });
    if (added) {
      highScores = added.highScores;
      discoveries.push({ kind: 'highScore', rank: added.rank });
    }
  }

  const prev = save.levels[result.levelId];
  const prevClears = prev?.clears ?? 0;
  const clears = prevClears + (result.bossDefeated ? 1 : 0);
  const prevBest = prev?.best ?? 0;
  const best = abandoned ? prevBest : Math.max(prevBest, result.score);
  const levels =
    clears > 0 || best > 0 ? { ...save.levels, [result.levelId]: { clears, best } } : save.levels;
  // The first clear points LAUNCH at the next sector, so the campaign carries on.
  const next = prevClears === 0 && clears > 0 ? nextLevelId(result.levelId) : null;
  const selectedLevel = next ?? save.selectedLevel;

  return {
    salvageEarned,
    discoveries,
    save: {
      ...save,
      levels,
      selectedLevel,
      salvage: save.salvage + salvageEarned,
      totalSalvageEarned: save.totalSalvageEarned + salvageEarned,
      schematics,
      pilotsRescued,
      highScores,
      stats: {
        runs: save.stats.runs + 1,
        kills: save.stats.kills + result.kills,
        deaths: save.stats.deaths + (result.victory ? 0 : 1),
        bossKills: save.stats.bossKills + (result.bossDefeated ? 1 : 0),
      },
    },
  };
}

/**
 * Inserts `entry` into a table that keeps up to HIGH_SCORE_LIMIT entries per level in
 * one score-sorted array. Ties keep the older entry ahead. Returns null when the score
 * doesn't make its level's table; `rank` is 1-based within the level.
 */
export function insertHighScore(
  table: readonly HighScore[],
  entry: HighScore,
): { highScores: HighScore[]; rank: number } | null {
  let rank = 0;
  let at = table.length;
  for (let i = 0; i < table.length; i++) {
    const h = table[i] as HighScore;
    if (entry.score > h.score) {
      at = i;
      break;
    }
    if (h.level === entry.level) rank++;
  }
  if (rank >= HIGH_SCORE_LIMIT) return null;
  const out = [...table.slice(0, at), entry, ...table.slice(at)];
  let seen = 0;
  for (let i = 0; i < out.length; i++) {
    if ((out[i] as HighScore).level !== entry.level) continue;
    if (++seen > HIGH_SCORE_LIMIT) {
      out.splice(i, 1);
      break;
    }
  }
  return { highScores: out, rank: rank + 1 };
}

/** One level's entries from the shared table, best first. */
export function levelHighScores(save: SaveData, levelId: string): HighScore[] {
  return save.highScores.filter((h) => h.level === levelId);
}

/** The sector after `id` in the campaign, or null for the last (or an unknown) one. */
export function nextLevelId(id: string, order: readonly string[] = LEVEL_ORDER): string | null {
  const i = order.indexOf(id);
  return i >= 0 ? (order[i + 1] ?? null) : null;
}

/** Sector 1 is always open; every later one needs the sector before it cleared once. */
export function isLevelUnlocked(
  save: SaveData,
  id: string,
  order: readonly string[] = LEVEL_ORDER,
): boolean {
  const i = order.indexOf(id);
  if (i < 0) return false;
  if (i === 0) return true;
  return (save.levels[order[i - 1] as string]?.clears ?? 0) > 0;
}

export function unlockedLevels(save: SaveData, order: readonly string[] = LEVEL_ORDER): string[] {
  return order.filter((id) => isLevelUnlocked(save, id, order));
}

/** Returns a new save launching `id`. Throws if it's locked. */
export function selectLevel(
  save: SaveData,
  id: string,
  order: readonly string[] = LEVEL_ORDER,
): SaveData {
  if (!isLevelUnlocked(save, id, order)) throw new Error(`Level "${id}" is locked`);
  return { ...save, selectedLevel: id };
}

export type ShipStatus = 'built' | 'buildable' | 'schematic' | 'unknown';

/** Hangar state of a ship: built, schematic owned (affordable or not), or not yet found. */
export function shipStatus(save: SaveData, shipId: string): ShipStatus {
  const ship = getDef(SHIPS, shipId, 'ship');
  if (save.shipsBuilt.includes(shipId) || ship.unlock.kind === 'start') return 'built';
  if (!save.schematics.includes(ship.unlock.schematicId)) return 'unknown';
  return save.salvage >= ship.unlock.cost ? 'buildable' : 'schematic';
}

export function canBuildShip(save: SaveData, shipId: string): boolean {
  return shipId in SHIPS && shipStatus(save, shipId) === 'buildable';
}

/** Returns a new save with the ship built. Throws if `canBuildShip` is false. */
export function buildShip(save: SaveData, shipId: string): SaveData {
  const ship = SHIPS[shipId];
  if (!ship || ship.unlock.kind !== 'schematic' || !canBuildShip(save, shipId)) {
    throw new Error(`Cannot build ship "${shipId}"`);
  }
  return {
    ...save,
    salvage: save.salvage - ship.unlock.cost,
    shipsBuilt: [...save.shipsBuilt, shipId],
  };
}

export function selectShip(save: SaveData, shipId: string): SaveData {
  if (!save.shipsBuilt.includes(shipId)) throw new Error(`Ship "${shipId}" not built`);
  return { ...save, selectedShip: shipId };
}

export function selectPilot(save: SaveData, pilotId: string): SaveData {
  if (!save.pilotsRescued.includes(pilotId)) throw new Error(`Pilot "${pilotId}" not rescued`);
  return { ...save, selectedPilot: pilotId };
}

/** Everything T08 needs to initialize the player for a run. */
export interface PlayerLoadout {
  shipId: string;
  pilotId: string;
  /** Base ship numbers (design.md table). */
  baseShield: number;
  baseSpeed: number;
  /** Ship slots + stats.extraSlots, capped at MAX_WEAPON_SLOTS. */
  weaponSlots: number;
  startingWeapons: readonly StartingWeapon[];
  /** baseShield + stats.extraShield, never below MIN_MAX_SHIELD. */
  maxShield: number;
  /** baseSpeed × stats.speedMul, px/s */
  speed: number;
  /** Combined ship + pilot passive + hangar upgrade multipliers. */
  stats: PlayerStats;
}

export function computePlayerStats(save: SaveData, shipId: string, pilotId: string): PlayerLoadout {
  const ship = getDef(SHIPS, shipId, 'ship');
  getDef(PILOTS, pilotId, 'pilot');
  const stats = computeStatMods(save, pilotId);
  return {
    shipId,
    pilotId,
    baseShield: ship.shield,
    baseSpeed: ship.speed,
    weaponSlots: Math.min(MAX_WEAPON_SLOTS, ship.weaponSlots + stats.extraSlots),
    startingWeapons: boostFirstWeapon(ship.startingWeapons, startWeaponBonus(save)),
    maxShield: Math.max(MIN_MAX_SHIELD, ship.shield + stats.extraShield),
    speed: ship.speed * stats.speedMul,
    stats,
  };
}

/** Munitions Cache: the first starting weapon gains `bonus` levels, capped at its max. */
function boostFirstWeapon(
  weapons: readonly StartingWeapon[],
  bonus: number,
): readonly StartingWeapon[] {
  const first = weapons[0];
  if (!first || bonus <= 0) return weapons;
  const def = WEAPONS[first.weaponId as keyof typeof WEAPONS];
  const max = def ? def.levels.length : first.level;
  const level = Math.max(first.level, Math.min(max, first.level + bonus));
  return [{ ...first, level }, ...weapons.slice(1)];
}

/** The pilot an escape pod on `levelId` carries, or null when that level's pilots are all rescued. */
export function nextRescuablePilot(save: SaveData, levelId: string): string | null {
  for (const id of PILOT_ORDER) {
    const p = PILOTS[id];
    if (!p || p.unlock.kind !== 'rescue' || p.unlock.levelId !== levelId) continue;
    if (!save.pilotsRescued.includes(id)) return id;
  }
  return null;
}
