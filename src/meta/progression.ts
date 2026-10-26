// Meta-progression rules. Pure functions on SaveData: they return new saves and never do I/O.
import {
  PILOTS,
  PILOT_ORDER,
  SHIPS,
  SHIP_ORDER,
  getDef,
  WEAPONS,
  type ShipDef,
  type StartingWeapon,
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
}

export function runResultFrom(run: RunState, victory: boolean): RunResult {
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

  let highScores = save.highScores;
  if (result.score > 0) {
    // Ties keep the older entry ahead.
    let rank = highScores.findIndex((h) => result.score > h.score);
    if (rank < 0) rank = highScores.length;
    if (rank < HIGH_SCORE_LIMIT) {
      const entry: HighScore = {
        score: result.score,
        pilot: result.pilotId,
        ship: result.shipId,
        level: result.levelId,
        date: now.toISOString(),
      };
      highScores = [...highScores.slice(0, rank), entry, ...highScores.slice(rank)].slice(
        0,
        HIGH_SCORE_LIMIT,
      );
      discoveries.push({ kind: 'highScore', rank: rank + 1 });
    }
  }

  const prev = save.levels[result.levelId];
  const clears = (prev?.clears ?? 0) + (result.bossDefeated ? 1 : 0);
  const best = Math.max(prev?.best ?? 0, result.score);
  const levels =
    clears > 0 || best > 0 ? { ...save.levels, [result.levelId]: { clears, best } } : save.levels;

  return {
    salvageEarned,
    discoveries,
    save: {
      ...save,
      levels,
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
  weaponSlots: number;
  startingWeapons: readonly StartingWeapon[];
  /** baseShield + stats.extraShield */
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
    weaponSlots: ship.weaponSlots,
    startingWeapons: boostFirstWeapon(ship.startingWeapons, startWeaponBonus(save)),
    maxShield: ship.shield + stats.extraShield,
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
