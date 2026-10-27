// Hangar upgrade purchase rules and their stat effects. Pure; no I/O.
import { UPGRADES, getDef, upgradeCost, type StatMods } from '../content';
import type { PlayerStats } from '../sim/types';
import type { SaveData } from './schema';

export function upgradeLevel(save: SaveData, id: string): number {
  return save.upgrades[id] ?? 0;
}

/** Cost of the next level, or null when maxed. */
export function nextUpgradeCost(save: SaveData, id: string): number | null {
  const def = getDef(UPGRADES, id, 'upgrade');
  const lvl = upgradeLevel(save, id);
  return lvl >= def.maxLevel ? null : upgradeCost(def, lvl + 1);
}

/** The upgrade that must be maxed first, while it isn't; null once `id` is unblocked. */
export function missingRequirement(save: SaveData, id: string): string | null {
  const req = UPGRADES[id]?.requires;
  if (!req) return null;
  const def = UPGRADES[req];
  if (!def) return null;
  return upgradeLevel(save, req) >= def.maxLevel ? null : req;
}

export function canBuyUpgrade(save: SaveData, id: string): boolean {
  if (!(id in UPGRADES)) return false;
  if (missingRequirement(save, id) !== null) return false;
  const cost = nextUpgradeCost(save, id);
  return cost !== null && save.salvage >= cost;
}

/** Returns a new save with the next level bought. Throws if `canBuyUpgrade` is false. */
export function buyUpgrade(save: SaveData, id: string): SaveData {
  if (!canBuyUpgrade(save, id)) throw new Error(`Cannot buy upgrade "${id}"`);
  const cost = nextUpgradeCost(save, id) as number;
  return {
    ...save,
    salvage: save.salvage - cost,
    upgrades: { ...save.upgrades, [id]: upgradeLevel(save, id) + 1 },
  };
}

/** Applies stat modifiers in place: every `*Mul` multiplies, the rest (`extraShield`, …) add. */
export function applyStatMods(stats: PlayerStats, mods: StatMods): void {
  for (const key of Object.keys(mods) as (keyof PlayerStats)[]) {
    const v = mods[key];
    if (v === undefined) continue;
    if (key.endsWith('Mul')) stats[key] *= v;
    else stats[key] += v;
  }
}

/** Applies every owned hangar upgrade in place. */
export function applyUpgrades(stats: PlayerStats, save: SaveData): void {
  for (const [id, lvl] of Object.entries(save.upgrades)) {
    const def = UPGRADES[id];
    if (!def || lvl <= 0) continue;
    if (!def.stat) continue;
    const level = Math.min(lvl, def.maxLevel);
    if (def.stat === 'extraShield') stats.extraShield += def.perLevel * level;
    else stats[def.stat] *= 1 + def.perLevel * level;
  }
}

/** Levels the owned upgrades add to the ship's first starting weapon. */
export function startWeaponBonus(save: SaveData): number {
  let bonus = 0;
  for (const [id, lvl] of Object.entries(save.upgrades)) {
    const def = UPGRADES[id];
    if (!def?.startWeaponLevel || lvl <= 0) continue;
    bonus += def.startWeaponLevel * Math.min(lvl, def.maxLevel);
  }
  return bonus;
}
