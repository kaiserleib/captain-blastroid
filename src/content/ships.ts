// Ship roster, per docs/design.md → Ships.

export interface StartingWeapon {
  weaponId: string;
  level: number;
}

export type ShipUnlock =
  | { kind: 'start' }
  /** Needs the schematic `schematicId` (found in a run), then `cost` salvage to build. */
  | { kind: 'schematic'; schematicId: string; cost: number };

export interface ShipDef {
  id: string;
  name: string;
  shield: number;
  /** px/s */
  speed: number;
  weaponSlots: number;
  startingWeapons: readonly StartingWeapon[];
  unlock: ShipUnlock;
}

export const SHIPS: Readonly<Record<string, ShipDef>> = {
  kestrel: {
    id: 'kestrel',
    name: 'Kestrel',
    shield: 3,
    speed: 120,
    weaponSlots: 4,
    startingWeapons: [{ weaponId: 'blaster', level: 1 }],
    unlock: { kind: 'start' },
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    shield: 5,
    speed: 95,
    weaponSlots: 3,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'orbitDrones', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'bulwark', cost: 150 },
  },
  dart: {
    id: 'dart',
    name: 'Dart',
    shield: 2,
    speed: 150,
    weaponSlots: 5,
    startingWeapons: [{ weaponId: 'blaster', level: 1 }],
    unlock: { kind: 'schematic', schematicId: 'dart', cost: 300 },
  },
};

/** Display / hangar order. */
export const SHIP_ORDER: readonly string[] = ['kestrel', 'bulwark', 'dart'];
