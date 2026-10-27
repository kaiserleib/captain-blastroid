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
  // Act II ships, per docs/design.md → Act II "New ships". Schematics drop from sector 6–10 bosses.
  shrike: {
    id: 'shrike',
    name: 'Shrike',
    shield: 3,
    speed: 140,
    weaponSlots: 4,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'arc', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'shrike', cost: 1400 },
  },
  ferret: {
    id: 'ferret',
    name: 'Ferret',
    shield: 3,
    speed: 125,
    weaponSlots: 4,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'ricochet', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'ferret', cost: 1600 },
  },
  wraith: {
    id: 'wraith',
    name: 'Wraith',
    shield: 2,
    speed: 145,
    weaponSlots: 5,
    startingWeapons: [
      { weaponId: 'blaster', level: 2 },
      { weaponId: 'flak', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'wraith', cost: 1800 },
  },
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    shield: 4,
    speed: 115,
    weaponSlots: 5,
    startingWeapons: [
      { weaponId: 'blaster', level: 1 },
      { weaponId: 'seeker', level: 1 },
      { weaponId: 'orbitDrones', level: 1 },
    ],
    unlock: { kind: 'schematic', schematicId: 'revenant', cost: 2100 },
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    shield: 4,
    speed: 130,
    weaponSlots: 6,
    startingWeapons: [{ weaponId: 'blaster', level: 2 }],
    unlock: { kind: 'schematic', schematicId: 'nova', cost: 3000 },
  },
};

/** Hard cap on weapon slots after pilot bonuses (the HUD strip holds six). */
export const MAX_WEAPON_SLOTS = 6;
/** A pilot's shield penalty never takes a ship below this. */
export const MIN_MAX_SHIELD = 1;

/** Display / hangar order. */
export const SHIP_ORDER: readonly string[] = [
  'kestrel',
  'bulwark',
  'dart',
  'warden',
  'corsair',
  'halcyon',
  'paragon',
  'shrike',
  'ferret',
  'wraith',
  'revenant',
  'nova',
];
