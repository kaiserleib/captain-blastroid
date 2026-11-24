// Content packs: what the base game ships with and what a store purchase adds.
// A pack is defined by its sectors; its ships, pilots and weapons are whatever
// can only be earned there, so new content lands in the right pack by itself.
import { ACTS, LEVELS, LEVEL_ORDER } from './levels';
import { PILOTS, PILOT_ORDER } from './pilots';
import { SHIPS, SHIP_ORDER } from './ships';
import { DEFAULT_UNLOCKED_WEAPONS, WEAPON_ORDER, type WeaponId } from './weapons';

export type PackId = 'act2';

export interface PackDef {
  id: PackId;
  /** Store screen title. */
  name: string;
  /**
   * Non-consumable product id, the same string in App Store Connect and the Play
   * Console (it can't be renamed once the product is live). Null for a free pack:
   * the player claims it in the app and no store is involved.
   */
  productId: string | null;
  /** Store screen lines. */
  blurb: readonly string[];
  levels: readonly string[];
  ships: readonly string[];
  pilots: readonly string[];
  weapons: readonly WeaponId[];
}

const ACT2_LEVELS: readonly string[] = ACTS.slice(1).flatMap((a) => a.levels);

/** Ships whose schematic drops in `levels` and nowhere outside them. */
function shipsOnlyIn(levels: readonly string[]): string[] {
  return SHIP_ORDER.filter((id) => {
    if (SHIPS[id]?.unlock.kind !== 'schematic') return false;
    const homes = LEVEL_ORDER.filter((l) => LEVELS[l]?.schematicOnClear.includes(id));
    return homes.length > 0 && homes.every((l) => levels.includes(l));
  });
}

function pilotsRescuedIn(levels: readonly string[]): string[] {
  return PILOT_ORDER.filter((id) => {
    const u = PILOTS[id]?.unlock;
    return u?.kind === 'rescue' && levels.includes(u.levelId);
  });
}

export const PACKS: Readonly<Record<PackId, PackDef>> = {
  act2: {
    id: 'act2',
    name: 'ACT II: THE FOUNDRY',
    productId: null,
    blurb: ['5 NEW SECTORS', 'THE GAUNTLET', '5 SHIPS  5 PILOTS', '3 WEAPONS'],
    levels: ACT2_LEVELS,
    ships: shipsOnlyIn(ACT2_LEVELS),
    pilots: pilotsRescuedIn(ACT2_LEVELS),
    weapons: WEAPON_ORDER.filter((id) => !DEFAULT_UNLOCKED_WEAPONS.includes(id)),
  },
};

export const PACK_ORDER: readonly PackId[] = ['act2'];

export type PackContent = 'levels' | 'ships' | 'pilots' | 'weapons';

/** The pack that `id` belongs to, or null for base-game (and unknown) content. */
export function packOf(kind: PackContent, id: string): PackId | null {
  for (const p of PACK_ORDER) {
    if ((PACKS[p][kind] as readonly string[]).includes(id)) return p;
  }
  return null;
}

export function packForProduct(productId: string): PackId | null {
  return PACK_ORDER.find((p) => PACKS[p].productId === productId) ?? null;
}

/** A free pack is claimed in the app; a paid one is bought from the store. */
export function isFreePack(id: PackId): boolean {
  return PACKS[id].productId === null;
}
