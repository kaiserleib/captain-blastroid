import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, LEVELS } from './levels';
import { isFreePack, PACKS, packForProduct, packOf } from './packs';
import { PILOTS } from './pilots';
import { SHIPS } from './ships';
import { DEFAULT_UNLOCKED_WEAPONS } from './weapons';

describe('content packs', () => {
  const act2 = PACKS.act2;

  it('the base game is sectors 1-5; Act II holds 6-10 and the Gauntlet', () => {
    expect(LEVEL_ORDER.filter((id) => packOf('levels', id) === null)).toEqual(
      LEVEL_ORDER.slice(0, 5),
    );
    expect(act2.levels).toEqual(LEVEL_ORDER.slice(5));
    expect(act2.levels).toContain('gauntlet');
  });

  it('Act II owns the second wave of ships, pilots and weapons', () => {
    expect(act2.ships).toEqual(['shrike', 'ferret', 'wraith', 'revenant', 'nova']);
    expect(act2.pilots).toEqual(['ines', 'rook', 'nyx', 'halasz', 'wren']);
    expect(act2.weapons).toEqual(['arc', 'ricochet', 'flak']);
  });

  it('nothing in the base game depends on pack content', () => {
    for (const id of LEVEL_ORDER.slice(0, 5)) {
      const level = LEVELS[id];
      expect(level?.fieldTestWeapon).toBeUndefined();
      for (const ship of level?.schematicOnClear ?? []) expect(packOf('ships', ship)).toBeNull();
    }
    for (const ship of Object.values(SHIPS)) {
      if (packOf('ships', ship.id) !== null) continue;
      for (const w of ship.startingWeapons) expect(packOf('weapons', w.weaponId)).toBeNull();
    }
    for (const id of DEFAULT_UNLOCKED_WEAPONS) expect(packOf('weapons', id)).toBeNull();
    expect(packOf('ships', 'kestrel')).toBeNull();
    expect(packOf('pilots', 'blastroid')).toBeNull();
  });

  it('every pack pilot and ship exists', () => {
    for (const id of act2.pilots) expect(PILOTS[id]).toBeDefined();
    for (const id of act2.ships) expect(SHIPS[id]).toBeDefined();
  });

  it('Act II is free: claimed in the app, with no store product', () => {
    expect(act2.productId).toBeNull();
    expect(isFreePack('act2')).toBe(true);
    expect(packForProduct('something_else')).toBeNull();
  });
});
