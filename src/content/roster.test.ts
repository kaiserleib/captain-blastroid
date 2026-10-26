import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER } from './levels';
import { PILOTS, PILOT_ORDER } from './pilots';
import { SHIPS, SHIP_ORDER } from './ships';
import { UPGRADES, UPGRADE_ORDER } from './upgrades';
import { WEAPONS } from './weapons';

// WAVE5-NOTES' level ids; T21 adds the last four to LEVEL_ORDER.
const CAMPAIGN = ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada'];

describe('roster content', () => {
  it('lists every ship once, and every ship in the order', () => {
    expect(new Set(SHIP_ORDER).size).toBe(SHIP_ORDER.length);
    expect([...SHIP_ORDER].sort()).toEqual(Object.keys(SHIPS).sort());
    expect(SHIP_ORDER.slice(3)).toEqual(['warden', 'corsair', 'halcyon', 'paragon']);
  });

  it('gives every ship valid starting weapons within its slots', () => {
    for (const id of SHIP_ORDER) {
      const ship = SHIPS[id];
      if (!ship) throw new Error(id);
      expect(ship.id).toBe(id);
      expect(ship.startingWeapons.length).toBeGreaterThan(0);
      expect(ship.startingWeapons.length).toBeLessThanOrEqual(ship.weaponSlots);
      for (const sw of ship.startingWeapons) {
        const def = WEAPONS[sw.weaponId as keyof typeof WEAPONS];
        expect(def, `${id}: ${sw.weaponId}`).toBeDefined();
        expect(sw.level).toBeGreaterThanOrEqual(1);
        expect(sw.level).toBeLessThanOrEqual(def.levels.length);
      }
    }
  });

  it('unlocks each campaign ship by its own schematic at a positive cost', () => {
    for (const id of SHIP_ORDER) {
      const u = SHIPS[id]?.unlock;
      if (!u || u.kind === 'start') continue;
      expect(u.schematicId).toBe(id);
      expect(u.cost).toBeGreaterThan(0);
    }
  });

  it('rescues every pilot on a campaign sector', () => {
    expect([...PILOT_ORDER].sort()).toEqual(Object.keys(PILOTS).sort());
    for (const id of PILOT_ORDER) {
      const u = PILOTS[id]?.unlock;
      if (!u || u.kind === 'start') continue;
      expect(CAMPAIGN).toContain(u.levelId);
    }
    expect(PILOTS.sable?.unlock).toEqual({ kind: 'rescue', levelId: 'eventHorizon' });
    expect(PILOTS.pip?.unlock).toEqual({ kind: 'rescue', levelId: 'pulsarNursery' });
    expect(PILOTS.vale?.unlock).toEqual({ kind: 'rescue', levelId: 'armada' });
    expect(PILOTS.zzkar?.unlock).toEqual({ kind: 'rescue', levelId: 'ionShoals' });
  });

  it.runIf(LEVEL_ORDER.length >= CAMPAIGN.length)(
    'rescues every pilot on a level in LEVEL_ORDER',
    () => {
      for (const id of PILOT_ORDER) {
        const u = PILOTS[id]?.unlock;
        if (u?.kind === 'rescue') expect(LEVEL_ORDER).toContain(u.levelId);
      }
    },
  );

  it('prices every upgrade above zero, and requirements point at real upgrades', () => {
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      if (!def) throw new Error(id);
      expect(def.costPerLevel).toBeGreaterThan(0);
      expect(def.stat !== undefined || def.startWeaponLevel !== undefined).toBe(true);
      if (def.requires) expect(UPGRADE_ORDER).toContain(def.requires);
    }
  });
});
