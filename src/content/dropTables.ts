// Drop tables, per docs/design.md → Pickups. One weighted roll per player kill,
// on top of an enemy def's guaranteed `salvage`. Weights are relative.
import type { PickupKind } from '../sim/types';

export type DropKind = PickupKind | 'none';

export interface DropEntry {
  kind: DropKind;
  weight: number;
  /** Salvage value. */
  amount?: number;
  /** Weapon id for `weapon`; '' or absent picks one (weighted toward owned non-max). */
  payload?: string;
}

export type DropTable = readonly DropEntry[];

/** `enemy def dropTable` → table. Enemies without one use `common`; asteroids use `asteroid_<size>`. */
export const DROP_TABLES: Readonly<Record<string, DropTable>> = {
  common: [
    { kind: 'none', weight: 70 },
    { kind: 'salvage', weight: 15, amount: 1 },
    { kind: 'salvage', weight: 3, amount: 5 },
    { kind: 'shield', weight: 4 },
    { kind: 'upgrade', weight: 3 },
    { kind: 'magnet', weight: 1.5 },
    { kind: 'repulsor', weight: 1.5 },
    { kind: 'weapon', weight: 2 },
  ],
  elite: [
    { kind: 'none', weight: 40 },
    { kind: 'salvage', weight: 20, amount: 5 },
    { kind: 'salvage', weight: 5, amount: 25 },
    { kind: 'shield', weight: 10 },
    { kind: 'upgrade', weight: 10 },
    { kind: 'magnet', weight: 5 },
    { kind: 'repulsor', weight: 5 },
    { kind: 'weapon', weight: 4.5 },
    { kind: 'schematic', weight: 0.5 },
  ],
  // Carriers always drop a weapon capsule (the drop code also enforces this).
  carrier: [{ kind: 'weapon', weight: 1 }],
  asteroid_small: [
    { kind: 'none', weight: 80 },
    { kind: 'salvage', weight: 18, amount: 1 },
    { kind: 'shield', weight: 1 },
    { kind: 'magnet', weight: 0.5 },
    { kind: 'repulsor', weight: 0.5 },
  ],
  asteroid_medium: [
    { kind: 'none', weight: 60 },
    { kind: 'salvage', weight: 30, amount: 1 },
    { kind: 'salvage', weight: 6, amount: 5 },
    { kind: 'shield', weight: 2 },
    { kind: 'upgrade', weight: 1 },
    { kind: 'magnet', weight: 0.5 },
    { kind: 'repulsor', weight: 0.5 },
  ],
  asteroid_large: [
    { kind: 'none', weight: 30 },
    { kind: 'salvage', weight: 40, amount: 5 },
    { kind: 'salvage', weight: 10, amount: 25 },
    { kind: 'shield', weight: 8 },
    { kind: 'upgrade', weight: 6 },
    { kind: 'magnet', weight: 3 },
    { kind: 'repulsor', weight: 3 },
  ],
};

export const DEFAULT_ENEMY_DROP_TABLE = 'common';
export const CARRIER_DROP_TABLE = 'carrier';
