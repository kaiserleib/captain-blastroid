import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER, WEAPONS, type WeaponId } from '../../src/content';
import { LEVEL_ORDER, getLevel } from '../../src/content/levels';
import { capsulePool } from '../../src/game/pickups';
import { isLevelUnlocked, type SaveData } from '../../src/meta';
import type { Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { debugSave } from '../../src/ui/debugSaves';
import { bankFinishedRun, type FinishedRun } from '../../src/ui/results';
import { godBot, type Bot } from './bots';
import { runSim } from './harness';

// T31/T43: the campaign end to end, the way the results screen drives it.
// Act I from `?save=mid` (sector 1 cleared): sector 2 → NEXT SECTOR → … →
// sector 5 → ACT I COMPLETE. Act II from `?save=act1`: sector 6 → … → sector 10 (through the
// Foundry's escape) → CAMPAIGN COMPLETE, with the three weapon unlocks feeding
// later sectors' capsule pools. Banking goes through the same
// `bankFinishedRun` ResultsScene calls.

/** Boss schematic and pod pilot each sector's first clear should bank (design: Rewards by sector). */
const REWARDS: Readonly<Record<string, { schematic: string; pilot: string }>> = {
  kessler: { schematic: 'bulwark', pilot: 'juno' },
  ionShoals: { schematic: 'warden', pilot: 'zzkar' },
  eventHorizon: { schematic: 'corsair', pilot: 'sable' },
  pulsarNursery: { schematic: 'halcyon', pilot: 'pip' },
  armada: { schematic: 'paragon', pilot: 'vale' },
  corona: { schematic: 'shrike', pilot: 'ines' },
  warrens: { schematic: 'ferret', pilot: 'rook' },
  junction: { schematic: 'wraith', pilot: 'nyx' },
  chrono: { schematic: 'revenant', pilot: 'halasz' },
  foundry: { schematic: 'nova', pilot: 'wren' },
};

/** Act II field-test weapons, unlocked by their home sector's first clear (design: Act II rewards). */
const UNLOCKS: Readonly<Record<string, WeaponId | null>> = {
  corona: 'arc',
  warrens: 'ricochet',
  junction: 'flak',
  chrono: null,
  foundry: null,
};

const BOOSTED = [
  { id: 'blaster', level: 5 },
  { id: 'spread', level: 4 },
  { id: 'seeker', level: 4 },
];

/** The god bot, but it flies to an escape pod as soon as one is on screen (a player chasing the rescue). */
function podChaser(): Bot {
  const inner = godBot();
  return {
    name: 'god-podchaser',
    god: true,
    start: (w) => inner.start(w),
    decide(w: World) {
      inner.decide(w);
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i] as Pickup;
        if (!k.active || k.kind !== 'escapePod' || k.y < 30) continue;
        w.input.targetX = k.x;
        w.input.targetY = Math.max(k.y, 120);
        return;
      }
    },
  };
}

interface Step {
  levelId: string;
  banked: FinishedRun;
  /** The run's capsule pool (from the save the sector launched with). */
  pool: readonly string[];
}

/**
 * Flies `save.selectedLevel`, banks it as ResultsScene does, then NEXT SECTOR
 * (`banked.nextLevel`) until `until` is cleared. Checks what every first
 * clear must bank.
 */
function fly(start: SaveData, until: string): { save: SaveData; steps: Step[] } {
  let save = start;
  const steps: Step[] = [];
  let levelId: string | null = save.selectedLevel;
  while (levelId !== null) {
    expect(isLevelUnlocked(save, levelId), `${levelId} unlocked`).toBe(true);
    let world: World | null = null;
    const r = runSim(`campaign-${levelId}`, podChaser(), 420, {
      levelId,
      save,
      loadout: BOOSTED,
      onTick: (w) => void (world ??= w),
    });
    expect(r.result.outcome, levelId).toBe('victory');
    // Only the Foundry ends in an escape, and the god bot rides it out to the win.
    const escaped = r.events.some((e) => e.type === 'escapeStarted');
    expect(escaped, `${levelId} escape`).toBe(getLevel(levelId).escape !== undefined);
    const pool = capsulePool(world!);
    const banked = bankFinishedRun(save, world!.run, true);
    save = banked.save;
    steps.push({ levelId, banked, pool });

    const want = REWARDS[levelId]!;
    expect(banked.firstClear, levelId).toBe(true);
    expect(save.schematics, `${levelId} schematic`).toContain(want.schematic);
    expect(save.pilotsRescued, `${levelId} pod`).toContain(want.pilot);
    expect(save.levels[levelId]?.clears, `${levelId} clears`).toBe(1);
    expect(save.levels[levelId]?.best, `${levelId} best`).toBe(world!.run.score);
    expect(save.highScores.some((h) => h.level === levelId)).toBe(true);

    const last = levelId === LEVEL_ORDER[LEVEL_ORDER.length - 1];
    expect(banked.campaignComplete, `${levelId} campaignComplete`).toBe(last);
    expect(banked.actComplete, levelId).toBe(levelId === 'armada' ? 'ACT I COMPLETE' : null);
    // The first clear points LAUNCH at the next sector; NEXT SECTOR flies it.
    expect(save.selectedLevel).toBe(last ? levelId : banked.nextLevel);
    if (banked.nextLevel !== null) {
      expect(isLevelUnlocked(save, banked.nextLevel)).toBe(true);
      expect(getLevel(banked.nextLevel).number).toBe(getLevel(levelId).number + 1);
    }
    if (levelId === until) break;
    levelId = banked.nextLevel;
  }
  return { save, steps };
}

describe('campaign flow', () => {
  it('?save=mid (sector 1 cleared) → NEXT SECTOR → … → sector 5: ACT I COMPLETE', () => {
    const start = debugSave('mid');
    expect(start.selectedLevel).toBe(LEVEL_ORDER[1]);
    const { save, steps } = fly(start, 'armada');
    expect(steps.map((s) => s.levelId)).toEqual(LEVEL_ORDER.slice(1, 5));
    expect(steps.at(-1)!.banked.actComplete).toBe('ACT I COMPLETE');
    expect(save.selectedLevel).toBe('corona');
    expect(save.stats.bossKills).toBe(5);
    for (const s of steps) expect(s.banked.unlockedWeapon, s.levelId).toBeNull();
  }, 300_000);

  it('?save=act1 → sectors 6 → 10 via NEXT SECTOR: unlocks, pods, schematics, CAMPAIGN COMPLETE', () => {
    const start = debugSave('act1');
    expect(start.selectedLevel).toBe('corona');
    const { save, steps } = fly(start, 'foundry');
    expect(steps.map((s) => s.levelId)).toEqual(LEVEL_ORDER.slice(5));
    const unlocked: string[] = [];
    for (const s of steps) {
      const want = UNLOCKS[s.levelId]!;
      expect(s.banked.unlockedWeapon, `${s.levelId} unlock`).toBe(want);
      if (want !== null) expect(s.banked.unlockedWeaponName).toBe(WEAPONS[want]!.name);
      // A weapon unlocked earlier in the act drops in every later sector.
      for (const id of unlocked) expect(s.pool, `${s.levelId} pool`).toContain(id);
      if (want !== null) unlocked.push(want);
    }
    expect(save.weaponsUnlocked).toEqual(expect.arrayContaining([...WEAPON_ORDER]));
    expect(steps.at(-1)!.banked.campaignComplete).toBe(true);
    expect(save.stats.bossKills).toBe(start.stats.bossKills + 5);
    expect(save.salvage).toBeGreaterThan(start.salvage);
  }, 300_000);
});
