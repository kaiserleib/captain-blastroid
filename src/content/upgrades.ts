// Hangar upgrades, per docs/design.md → Meta progression.
import type { PlayerStats } from '../sim/types';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  /** Buying level n costs `costPerLevel * n`. */
  costPerLevel: number;
  stat: keyof PlayerStats;
  /** Per level: added to `extraShield`, or applied to a `*Mul` as `× (1 + perLevel * level)`. */
  perLevel: number;
}

export const UPGRADES: Readonly<Record<string, UpgradeDef>> = {
  plating: {
    id: 'plating',
    name: 'Reinforced Plating',
    description: '+1 max shield',
    maxLevel: 1,
    costPerLevel: 200,
    stat: 'extraShield',
    perLevel: 1,
  },
  capacitors: {
    id: 'capacitors',
    name: 'Overcharged Capacitors',
    description: '+5% damage per level',
    maxLevel: 5,
    costPerLevel: 50,
    stat: 'damageMul',
    perLevel: 0.05,
  },
  tractor: {
    id: 'tractor',
    name: 'Tractor Coils',
    description: '+15% pickup radius per level',
    maxLevel: 3,
    costPerLevel: 40,
    stat: 'pickupRadiusMul',
    perLevel: 0.15,
  },
  fieldGen: {
    id: 'fieldGen',
    name: 'Field Generators',
    description: '+10% powerup duration per level',
    maxLevel: 3,
    costPerLevel: 60,
    stat: 'powerupDurationMul',
    perLevel: 0.1,
  },
};

export const UPGRADE_ORDER: readonly string[] = ['plating', 'capacitors', 'tractor', 'fieldGen'];

/** Salvage cost of buying `level` (1-based). */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return def.costPerLevel * level;
}
