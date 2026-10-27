// Pilot roster, per docs/design.md → Pilots.
import type { PlayerStats } from '../sim/types';

/** Passive modifiers: `*Mul` fields multiply the matching PlayerStats field, `extraShield` adds. */
export type StatMods = Partial<PlayerStats>;

export type PilotUnlock =
  | { kind: 'start' }
  /** Rescued from an escape pod on `levelId`. Pods on a level go in PILOT_ORDER. */
  | { kind: 'rescue'; levelId: string };

/** Passives that act during a run rather than as a stat (game/player runs them). */
export type PilotAbility = 'solarCells' | 'bulletTime';

/** Ability tunables, per docs/design.md → Act II "New pilots". */
export const PILOT_ABILITY_TUNING = {
  /** Ines: seconds without a hit before +1 shield. The clock restarts on every hit. */
  solarRegenAfter: 25,
  /** Gold hull flash on regen, seconds. */
  solarFlash: 0.35,
  /** Halász: enemy-bullet rate after a hit, and how long it lasts. */
  bulletTimeScale: 0.5,
  bulletTimeDur: 2,
} as const;

export interface PilotDef {
  id: string;
  name: string;
  passiveText: string;
  passive: StatMods;
  ability?: PilotAbility;
  unlock: PilotUnlock;
  /** One line for the pilot select screen. Portraits are keyed by id in `portraits/named.ts`. */
  bio: string;
}

export const PILOTS: Readonly<Record<string, PilotDef>> = {
  blastroid: {
    id: 'blastroid',
    name: 'Captain Blastroid',
    passiveText: '+10% pickup radius',
    passive: { pickupRadiusMul: 1.1 },
    bio: 'Hero of the Kessler run. Never reads the manual.',
    unlock: { kind: 'start' },
  },
  juno: {
    id: 'juno',
    name: 'Juno Sparks',
    passiveText: '+15% fire rate',
    passive: { fireRateMul: 1.15 },
    bio: 'Hotshot mechanic. Overclocks anything with a trigger.',
    unlock: { kind: 'rescue', levelId: 'kessler' },
  },
  grieg: {
    id: 'grieg',
    name: 'Old Grieg',
    passiveText: '+1 max shield, -10% speed',
    passive: { extraShield: 1, speedMul: 0.9 },
    bio: 'Forty years hauling ore. Trusts armor, not luck.',
    unlock: { kind: 'rescue', levelId: 'kessler' },
  },
  zzkar: {
    id: 'zzkar',
    name: "Zz'kar",
    passiveText: '+50% powerup duration, +25% salvage',
    passive: { powerupDurationMul: 1.5, salvageMul: 1.25 },
    bio: 'Exiled scrap broker. Smells salvage through hull plate.',
    unlock: { kind: 'rescue', levelId: 'ionShoals' },
  },
  sable: {
    id: 'sable',
    name: 'Sable Okoro',
    passiveText: '+20% damage, -15% pickup radius',
    passive: { damageMul: 1.2, pickupRadiusMul: 0.85 },
    bio: 'Syndicate-hunting ace. Shoots first, collects later.',
    unlock: { kind: 'rescue', levelId: 'eventHorizon' },
  },
  pip: {
    id: 'pip',
    name: 'Pip Tanaka',
    passiveText: '+15% speed, +20% pickup radius',
    passive: { speedMul: 1.15, pickupRadiusMul: 1.2 },
    bio: 'Youngest pilot on the station. Flies like the comms are a rhythm game.',
    unlock: { kind: 'rescue', levelId: 'pulsarNursery' },
  },
  vale: {
    id: 'vale',
    name: 'Commodore Vale',
    passiveText: '+1 max shield, +10% fire rate, -10% salvage',
    passive: { extraShield: 1, fireRateMul: 1.1, salvageMul: 0.9 },
    bio: 'Lost a fleet to the Armada. Wants it back, one ship at a time.',
    unlock: { kind: 'rescue', levelId: 'armada' },
  },
  ines: {
    id: 'ines',
    name: 'Ines Solano',
    passiveText: 'Solar cells: +1 shield after 25s unhit',
    passive: {},
    ability: 'solarCells',
    bio: 'Solar-sail courier. Flies the corona run with her visor up.',
    unlock: { kind: 'rescue', levelId: 'corona' },
  },
  rook: {
    id: 'rook',
    name: 'Rook Mbeki',
    passiveText: '+50% damage to rock and gates, +1 salvage per asteroid',
    passive: { rockDmgMul: 1.5, rockSalvage: 1 },
    bio: 'Tunnel miner from the Warrens. Reads stone like a map.',
    unlock: { kind: 'rescue', levelId: 'warrens' },
  },
  nyx: {
    id: 'nyx',
    name: 'Nyx Calder',
    passiveText: '+25% rare drops',
    passive: { rareDropMul: 1.25 },
    bio: 'Junction smuggler. Always knows which crate is worth opening.',
    unlock: { kind: 'rescue', levelId: 'junction' },
  },
  halasz: {
    id: 'halasz',
    name: 'Dr. Imre Halasz',
    passiveText: 'Bullet time: enemy shots slow to half for 2s after a hit',
    passive: {},
    ability: 'bulletTime',
    bio: 'Chronophysicist. Taught the rift to skip a beat, mostly on purpose.',
    unlock: { kind: 'rescue', levelId: 'chrono' },
  },
  wren: {
    id: 'wren',
    name: 'Wren Ashgrove',
    passiveText: '+1 weapon slot, -1 max shield',
    passive: { extraSlots: 1, extraShield: -1 },
    bio: 'Syndicate defector. Tore off the badge, kept the gunnery training.',
    unlock: { kind: 'rescue', levelId: 'foundry' },
  },
};

/** Display order; also the rescue order within a level. */
export const PILOT_ORDER: readonly string[] = [
  'blastroid',
  'juno',
  'grieg',
  'zzkar',
  'sable',
  'pip',
  'vale',
  'ines',
  'rook',
  'nyx',
  'halasz',
  'wren',
];
