import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER } from './levels';
import { PILOTS, PILOT_ORDER } from './pilots';
import { MAX_WEAPON_SLOTS, SHIPS, SHIP_ORDER } from './ships';
import { UPGRADES, UPGRADE_ORDER } from './upgrades';
import { WEAPONS } from './weapons';

// WAVE5/WAVE8-NOTES' level ids; T32 adds the Act II five to LEVEL_ORDER.
const ACT1 = ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada'];
const ACT2 = ['corona', 'warrens', 'junction', 'chrono', 'foundry'];
const CAMPAIGN = [...ACT1, ...ACT2];

describe('roster content', () => {
  it('lists every ship once, and every ship in the order', () => {
    expect(new Set(SHIP_ORDER).size).toBe(SHIP_ORDER.length);
    expect([...SHIP_ORDER].sort()).toEqual(Object.keys(SHIPS).sort());
    expect(SHIP_ORDER.slice(3, 7)).toEqual(['warden', 'corsair', 'halcyon', 'paragon']);
    expect(SHIP_ORDER.slice(7)).toEqual(['shrike', 'ferret', 'wraith', 'revenant', 'nova']);
  });

  it('matches the Act II ship table', () => {
    const row = (id: string) => {
      const s = SHIPS[id];
      if (!s || s.unlock.kind !== 'schematic') throw new Error(id);
      return [s.shield, s.speed, s.weaponSlots, s.unlock.cost];
    };
    expect(row('shrike')).toEqual([3, 140, 4, 1400]);
    expect(row('ferret')).toEqual([3, 125, 4, 1600]);
    expect(row('wraith')).toEqual([2, 145, 5, 1800]);
    expect(row('revenant')).toEqual([4, 115, 5, 2100]);
    expect(row('nova')).toEqual([4, 130, 6, 3000]);
    expect(SHIPS.shrike?.startingWeapons.map((w) => w.weaponId)).toEqual(['blaster', 'arc']);
    expect(SHIPS.ferret?.startingWeapons.map((w) => w.weaponId)).toEqual(['blaster', 'ricochet']);
    expect(SHIPS.wraith?.startingWeapons).toEqual([
      { weaponId: 'blaster', level: 2 },
      { weaponId: 'flak', level: 1 },
    ]);
    for (const id of SHIP_ORDER)
      expect(SHIPS[id]?.weaponSlots ?? 0).toBeLessThanOrEqual(MAX_WEAPON_SLOTS);
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
    const act2 = ['ines', 'rook', 'nyx', 'halasz', 'wren'].map((id) => PILOTS[id]?.unlock);
    expect(act2).toEqual(ACT2.map((levelId) => ({ kind: 'rescue', levelId })));
  });

  it('rescues one pilot per Act II sector, so each pod has someone to carry', () => {
    for (const lid of ACT2) {
      const n = PILOT_ORDER.filter((id) => {
        const u = PILOTS[id]?.unlock;
        return u?.kind === 'rescue' && u.levelId === lid;
      }).length;
      expect(n, lid).toBe(1);
    }
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
