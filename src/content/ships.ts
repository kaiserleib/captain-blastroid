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
  // Campaign ships, per docs/design.md → New ships. Schematics drop from sector 2–5 bosses.
  warden: {
    id: 'warden',
    name: 'Warden',
    shield: 4,
    speed: 110,
    weaponSlots: 4,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'seeker', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'warden', cost: 400 },
  },
  corsair: {
    id: 'corsair',
    name: 'Corsair',
    shield: 3,
    speed: 135,
    weaponSlots: 4,
    startingWeapons: [{ weaponId: 'blaster', level: 2 }],
    unlock: { kind: 'schematic', schematicId: 'corsair', cost: 600 },
  },
  halcyon: {
    id: 'halcyon',
    name: 'Halcyon',
    shield: 3,
    speed: 120,
    weaponSlots: 4,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'lance', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'halcyon', cost: 800 },
  },
  paragon: {
    id: 'paragon',
    name: 'Paragon',
    shield: 4,
    speed: 130,
    weaponSlots: 5,
    startingWeapons: [
      { weaponId: 'blaster', level: 2 },
      { weaponId: 'orbitDrones', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'paragon', cost: 1200 },
  },
};

/** Display / hangar order. */
export const SHIP_ORDER: readonly string[] = [
  'kestrel',
  'bulwark',
  'dart',
  'warden',
  'corsair',
  'halcyon',
  'paragon',
];
