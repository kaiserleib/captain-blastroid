// Pilot roster, per docs/design.md → Pilots.
import type { PlayerStats } from '../sim/types';

/** Passive modifiers: `*Mul` fields multiply the matching PlayerStats field, `extraShield` adds. */
export type StatMods = Partial<PlayerStats>;

export type PilotUnlock =
  | { kind: 'start' }
  /** Rescued from an escape pod on `levelId`. Pods on a level go in PILOT_ORDER. */
  | { kind: 'rescue'; levelId: string };

export interface PilotDef {
  id: string;
  name: string;
  passiveText: string;
  passive: StatMods;
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
];
