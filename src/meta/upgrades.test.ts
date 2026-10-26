import { describe, expect, it } from 'vitest';
import { createPlayerStats } from '../sim/world';
import { bankRun, computePlayerStats } from './progression';
import { createDefaultSave, type SaveData } from './schema';
import {
  applyStatMods,
  buyUpgrade,
  canBuyUpgrade,
  missingRequirement,
  startWeaponBonus,
} from './upgrades';

function rich(over: Partial<SaveData> = {}): SaveData {
  return { ...createDefaultSave(), salvage: 5000, ...over };
}

describe('upgrade requirements', () => {
  it('refuses Hull Lattice until Reinforced Plating is maxed', () => {
    const save = rich();
    expect(missingRequirement(save, 'hullLattice')).toBe('plating');
    expect(canBuyUpgrade(save, 'hullLattice')).toBe(false);
    expect(() => buyUpgrade(save, 'hullLattice')).toThrow();

    const plated = buyUpgrade(save, 'plating');
    expect(missingRequirement(plated, 'hullLattice')).toBeNull();
    expect(canBuyUpgrade(plated, 'hullLattice')).toBe(true);
    const latticed = buyUpgrade(plated, 'hullLattice');
    expect(latticed.salvage).toBe(5000 - 200 - 600);
    expect(canBuyUpgrade(latticed, 'hullLattice')).toBe(false);
  });

  it('stacks Hull Lattice on Plating for +2 max shield', () => {
    const save = rich({ upgrades: { plating: 1, hullLattice: 1 } });
    expect(computePlayerStats(save, 'kestrel', 'blastroid').maxShield).toBe(5);
  });

  it('needs no requirement for upgrades without one', () => {
    expect(missingRequirement(rich(), 'munitions')).toBeNull();
    expect(canBuyUpgrade(rich(), 'munitions')).toBe(true);
  });
});

describe('Munitions Cache', () => {
  it('starts the first weapon one level higher and leaves the rest alone', () => {
    const save = rich({ upgrades: { munitions: 1 } });
    expect(startWeaponBonus(save)).toBe(1);
    expect(computePlayerStats(save, 'kestrel', 'blastroid').startingWeapons).toEqual([
      { weaponId: 'blaster', level: 2 },
    ]);
    expect(computePlayerStats(save, 'warden', 'blastroid').startingWeapons).toEqual([
      { weaponId: 'blaster', level: 2 },
      { weaponId: 'seeker', level: 1 },
    ]);
    expect(computePlayerStats(save, 'paragon', 'blastroid').startingWeapons[0]?.level).toBe(3);
  });

  it('does nothing without the upgrade and never touches the ship definition', () => {
    const plain = computePlayerStats(createDefaultSave(), 'corsair', 'blastroid');
    expect(plain.startingWeapons).toEqual([{ weaponId: 'blaster', level: 2 }]);
    computePlayerStats(rich({ upgrades: { munitions: 1 } }), 'corsair', 'blastroid');
    expect(computePlayerStats(createDefaultSave(), 'corsair', 'blastroid').startingWeapons).toEqual(
      [{ weaponId: 'blaster', level: 2 }],
    );
  });

  it('caps at the weapon max level', () => {
    const save = rich({ upgrades: { munitions: 99 } });
    expect(computePlayerStats(save, 'kestrel', 'blastroid').startingWeapons[0]?.level).toBe(2);
  });

  it('adds no stat multipliers', () => {
    const a = computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid').stats;
    const b = computePlayerStats(
      rich({ upgrades: { munitions: 1 } }),
      'kestrel',
      'blastroid',
    ).stats;
    expect(b).toEqual(a);
  });
});

describe('negative stat mods', () => {
  it('shrinks a multiplier below 1', () => {
    const s = createPlayerStats();
    applyStatMods(s, { pickupRadiusMul: 0.85, salvageMul: 0.9 });
    expect(s.pickupRadiusMul).toBeCloseTo(0.85);
    expect(s.salvageMul).toBeCloseTo(0.9);
  });

  it('applies Sable, Pip and Vale passives on top of upgrades', () => {
    const save = rich({ upgrades: { tractor: 1 } });
    const sable = computePlayerStats(save, 'kestrel', 'sable');
    expect(sable.stats.damageMul).toBeCloseTo(1.2);
    expect(sable.stats.pickupRadiusMul).toBeCloseTo(0.85 * 1.15);

    const pip = computePlayerStats(createDefaultSave(), 'corsair', 'pip');
    expect(pip.speed).toBeCloseTo(135 * 1.15);
    expect(pip.stats.pickupRadiusMul).toBeCloseTo(1.2);

    const vale = computePlayerStats(createDefaultSave(), 'paragon', 'vale');
    expect(vale.maxShield).toBe(5);
    expect(vale.stats.fireRateMul).toBeCloseTo(1.1);
    expect(vale.stats.salvageMul).toBeCloseTo(0.9);
  });

  it('banks 10% less salvage with Vale', () => {
    const r = bankRun(createDefaultSave(), {
      shipId: 'kestrel',
      pilotId: 'vale',
      levelId: 'armada',
      score: 0,
      salvage: 100,
      kills: 0,
      schematics: [],
      pilotsRescued: [],
      bossDefeated: false,
      victory: false,
    });
    expect(r.salvageEarned).toBe(90);
  });
});
