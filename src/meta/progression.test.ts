import { describe, expect, it } from 'vitest';
import { createRunState } from '../sim/world';
import {
  bankRun,
  buildShip,
  canBuildShip,
  computePlayerStats,
  nextRescuablePilot,
  runResultFrom,
  shipStatus,
  type RunResult,
} from './progression';
import { createDefaultSave, type SaveData } from './schema';
import { buyUpgrade, canBuyUpgrade, nextUpgradeCost } from './upgrades';

function result(over: Partial<RunResult> = {}): RunResult {
  return {
    shipId: 'kestrel',
    pilotId: 'blastroid',
    levelId: 'kessler',
    score: 0,
    salvage: 0,
    kills: 0,
    schematics: [],
    pilotsRescued: [],
    bossDefeated: false,
    victory: false,
    ...over,
  };
}

function withSalvage(n: number, base: SaveData = createDefaultSave()): SaveData {
  return { ...base, salvage: n };
}

describe('runResultFrom', () => {
  it('copies the RunState fields', () => {
    const run = createRunState('s', 'bulwark', 'juno', 'kessler');
    run.score = 900;
    run.salvage = 40;
    run.kills = 12;
    run.schematics.push('bulwark');
    run.pilotsRescued.push('juno');
    run.bossDefeated = true;
    const r = runResultFrom(run, true);
    expect(r).toEqual({
      shipId: 'bulwark',
      pilotId: 'juno',
      levelId: 'kessler',
      score: 900,
      salvage: 40,
      kills: 12,
      schematics: ['bulwark'],
      pilotsRescued: ['juno'],
      bossDefeated: true,
      victory: true,
    });
    run.schematics.push('dart');
    expect(r.schematics).toEqual(['bulwark']);
  });
});

describe('bankRun', () => {
  const now = new Date('2026-01-02T03:04:05Z');

  it('banks salvage, stats and discoveries without mutating the input', () => {
    const save = createDefaultSave();
    const {
      save: next,
      salvageEarned,
      discoveries,
    } = bankRun(
      save,
      result({
        score: 1000,
        salvage: 50,
        kills: 30,
        schematics: ['bulwark'],
        pilotsRescued: ['juno'],
        bossDefeated: true,
        victory: true,
      }),
      now,
    );
    expect(salvageEarned).toBe(50);
    expect(next.salvage).toBe(50);
    expect(next.totalSalvageEarned).toBe(50);
    expect(next.schematics).toEqual(['bulwark']);
    expect(next.pilotsRescued).toEqual(['blastroid', 'juno']);
    expect(next.stats).toEqual({ runs: 1, kills: 30, deaths: 0, bossKills: 1 });
    expect(next.highScores).toEqual([
      { score: 1000, pilot: 'blastroid', ship: 'kestrel', date: now.toISOString() },
    ]);
    expect(discoveries).toEqual([
      { kind: 'schematic', schematicId: 'bulwark', shipId: 'bulwark' },
      { kind: 'pilot', pilotId: 'juno' },
      { kind: 'highScore', rank: 1 },
    ]);
    expect(save).toEqual(createDefaultSave());
  });

  it('counts a death and banks salvage on defeat', () => {
    const { save } = bankRun(createDefaultSave(), result({ salvage: 7, victory: false }), now);
    expect(save.salvage).toBe(7);
    expect(save.stats.deaths).toBe(1);
  });

  it('ignores duplicate and unknown schematics / pilots', () => {
    let save = bankRun(
      createDefaultSave(),
      result({ schematics: ['bulwark'], pilotsRescued: ['juno'] }),
      now,
    ).save;
    const second = bankRun(
      save,
      result({
        schematics: ['bulwark', 'bulwark', 'nonsense'],
        pilotsRescued: ['juno', 'blastroid', 'ghost'],
      }),
      now,
    );
    save = second.save;
    expect(save.schematics).toEqual(['bulwark']);
    expect(save.pilotsRescued).toEqual(['blastroid', 'juno']);
    expect(second.discoveries).toEqual([]);
  });

  it('ignores a schematic for a ship that is already built', () => {
    const save = { ...createDefaultSave(), shipsBuilt: ['kestrel', 'dart'] };
    const r = bankRun(save, result({ schematics: ['dart'] }), now);
    expect(r.save.schematics).toEqual([]);
    expect(r.discoveries).toEqual([]);
  });

  it("applies salvageMul (Zz'kar +25%)", () => {
    const save = { ...createDefaultSave(), pilotsRescued: ['blastroid', 'zzkar'] };
    const r = bankRun(save, result({ pilotId: 'zzkar', salvage: 100 }), now);
    expect(r.salvageEarned).toBe(125);
  });

  it('keeps the high-score table at 10, sorted, ties keep the older entry first', () => {
    let save = createDefaultSave();
    for (let i = 1; i <= 10; i++) save = bankRun(save, result({ score: i * 100 }), now).save;
    expect(save.highScores.map((h) => h.score)).toEqual([
      1000, 900, 800, 700, 600, 500, 400, 300, 200, 100,
    ]);
    const tooLow = bankRun(save, result({ score: 50 }), now);
    expect(tooLow.save.highScores).toHaveLength(10);
    expect(tooLow.discoveries).toEqual([]);

    const tie = bankRun(save, result({ score: 500, pilotId: 'juno' }), now);
    expect(tie.discoveries).toEqual([{ kind: 'highScore', rank: 7 }]);
    expect(tie.save.highScores[6]?.pilot).toBe('juno');
    expect(tie.save.highScores[5]?.pilot).toBe('blastroid');
    expect(tie.save.highScores.at(-1)?.score).toBe(200);
  });

  it('does not record zero scores', () => {
    const r = bankRun(createDefaultSave(), result({ score: 0 }), now);
    expect(r.save.highScores).toEqual([]);
  });
});

describe('hangar upgrades', () => {
  it('costs scale with level', () => {
    const save = createDefaultSave();
    expect(nextUpgradeCost(save, 'capacitors')).toBe(50);
    expect(nextUpgradeCost({ ...save, upgrades: { capacitors: 3 } }, 'capacitors')).toBe(200);
    expect(nextUpgradeCost(save, 'plating')).toBe(200);
  });

  it('buys a level and deducts salvage', () => {
    const save = buyUpgrade(withSalvage(130), 'tractor');
    expect(save.upgrades.tractor).toBe(1);
    expect(save.salvage).toBe(90);
    const again = buyUpgrade(save, 'tractor');
    expect(again.upgrades.tractor).toBe(2);
    expect(again.salvage).toBe(10);
  });

  it('requires exact salvage or more', () => {
    expect(canBuyUpgrade(withSalvage(49), 'capacitors')).toBe(false);
    expect(canBuyUpgrade(withSalvage(50), 'capacitors')).toBe(true);
    expect(() => buyUpgrade(withSalvage(49), 'capacitors')).toThrow();
  });

  it('stops at max level', () => {
    const save = { ...withSalvage(10_000), upgrades: { plating: 1 } };
    expect(nextUpgradeCost(save, 'plating')).toBeNull();
    expect(canBuyUpgrade(save, 'plating')).toBe(false);
    expect(() => buyUpgrade(save, 'plating')).toThrow();
  });

  it('rejects unknown upgrades', () => {
    expect(canBuyUpgrade(withSalvage(10_000), 'warpDrive')).toBe(false);
  });
});

describe('ship building', () => {
  it('needs the schematic and enough salvage', () => {
    expect(shipStatus(withSalvage(1000), 'bulwark')).toBe('unknown');
    expect(canBuildShip(withSalvage(1000), 'bulwark')).toBe(false);

    const found = { ...withSalvage(149), schematics: ['bulwark'] };
    expect(shipStatus(found, 'bulwark')).toBe('schematic');
    expect(canBuildShip(found, 'bulwark')).toBe(false);
    expect(() => buildShip(found, 'bulwark')).toThrow();

    const rich = { ...found, salvage: 150 };
    expect(canBuildShip(rich, 'bulwark')).toBe(true);
    const built = buildShip(rich, 'bulwark');
    expect(built.salvage).toBe(0);
    expect(built.shipsBuilt).toEqual(['kestrel', 'bulwark']);
    expect(shipStatus(built, 'bulwark')).toBe('built');
    expect(canBuildShip({ ...built, salvage: 999 }, 'bulwark')).toBe(false);
  });

  it('Kestrel is built from the start; unknown ships are not buildable', () => {
    expect(shipStatus(createDefaultSave(), 'kestrel')).toBe('built');
    expect(canBuildShip(withSalvage(10_000), 'kestrel')).toBe(false);
    expect(canBuildShip(withSalvage(10_000), 'nope')).toBe(false);
  });
});

describe('computePlayerStats', () => {
  it('Kestrel + Captain Blastroid, no upgrades', () => {
    const p = computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid');
    expect(p.maxShield).toBe(3);
    expect(p.speed).toBe(120);
    expect(p.weaponSlots).toBe(4);
    expect(p.startingWeapons).toEqual([{ weaponId: 'blaster', level: 1 }]);
    expect(p.stats.pickupRadiusMul).toBeCloseTo(1.1);
    expect(p.stats.damageMul).toBe(1);
  });

  it('Old Grieg in Bulwark with Plating = 7 shields', () => {
    const save = { ...createDefaultSave(), upgrades: { plating: 1 } };
    const p = computePlayerStats(save, 'bulwark', 'grieg');
    expect(p.baseShield).toBe(5);
    expect(p.maxShield).toBe(7);
    expect(p.speed).toBeCloseTo(95 * 0.9);
    expect(p.startingWeapons.map((w) => w.weaponId)).toEqual(['blaster', 'orbitDrones']);
  });

  it('stacks pilot passive and upgrades multiplicatively', () => {
    const save = { ...createDefaultSave(), upgrades: { capacitors: 5, tractor: 3, fieldGen: 2 } };
    const p = computePlayerStats(save, 'dart', 'blastroid');
    expect(p.stats.damageMul).toBeCloseTo(1.25);
    expect(p.stats.pickupRadiusMul).toBeCloseTo(1.1 * 1.45);
    expect(p.stats.powerupDurationMul).toBeCloseTo(1.2);
    expect(computePlayerStats(save, 'dart', 'juno').stats.fireRateMul).toBeCloseTo(1.15);
  });

  it('throws on unknown ids', () => {
    expect(() => computePlayerStats(createDefaultSave(), 'nope', 'blastroid')).toThrow();
    expect(() => computePlayerStats(createDefaultSave(), 'kestrel', 'nope')).toThrow();
  });
});

describe('nextRescuablePilot', () => {
  it('returns Level 1 pilots in order, then null', () => {
    let save = createDefaultSave();
    expect(nextRescuablePilot(save, 'kessler')).toBe('juno');
    save = { ...save, pilotsRescued: [...save.pilotsRescued, 'juno'] };
    expect(nextRescuablePilot(save, 'kessler')).toBe('grieg');
    save = { ...save, pilotsRescued: [...save.pilotsRescued, 'grieg'] };
    expect(nextRescuablePilot(save, 'kessler')).toBeNull();
  });

  it("Zz'kar is only rescuable on the post-MVP level", () => {
    expect(nextRescuablePilot(createDefaultSave(), 'ionShoals')).toBe('zzkar');
    expect(nextRescuablePilot(createDefaultSave(), 'unknown')).toBeNull();
  });
});
