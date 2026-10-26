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

export function canBuyUpgrade(save: SaveData, id: string): boolean {
  if (!(id in UPGRADES)) return false;
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

/** Applies stat modifiers in place: `extraShield` adds, every `*Mul` multiplies. */
export function applyStatMods(stats: PlayerStats, mods: StatMods): void {
  for (const key of Object.keys(mods) as (keyof PlayerStats)[]) {
    const v = mods[key];
    if (v === undefined) continue;
    if (key === 'extraShield') stats.extraShield += v;
    else stats[key] *= v;
  }
}

/** Applies every owned hangar upgrade in place. */
export function applyUpgrades(stats: PlayerStats, save: SaveData): void {
  for (const [id, lvl] of Object.entries(save.upgrades)) {
    const def = UPGRADES[id];
    if (!def || lvl <= 0) continue;
    const level = Math.min(lvl, def.maxLevel);
    if (def.stat === 'extraShield') stats.extraShield += def.perLevel * level;
    else stats[def.stat] *= 1 + def.perLevel * level;
  }
}
