import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, getLevel } from '../../src/content/levels';
import { createDefaultSave, isLevelUnlocked, type SaveData } from '../../src/meta';
import type { Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { bankFinishedRun } from '../../src/ui/results';
import { godBot, type Bot } from './bots';
import { runSim } from './harness';

// T31: the campaign end to end on one save, the way the results screen drives
// it: fresh save → clear sector 1 → NEXT SECTOR → … → sector 5 → CAMPAIGN
// COMPLETE. Banking goes through the same `bankFinishedRun` ResultsScene calls.

/** Boss schematic and pod pilot each sector's first clear should bank (design: Rewards by sector). */
const REWARDS: Readonly<Record<string, { schematic: string; pilot: string }>> = {
  kessler: { schematic: 'bulwark', pilot: 'juno' },
  ionShoals: { schematic: 'warden', pilot: 'zzkar' },
  eventHorizon: { schematic: 'corsair', pilot: 'sable' },
  pulsarNursery: { schematic: 'halcyon', pilot: 'pip' },
  armada: { schematic: 'paragon', pilot: 'vale' },
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

describe('campaign flow', () => {
  it('fresh save → five sector clears via NEXT SECTOR → CAMPAIGN COMPLETE', () => {
    let save: SaveData = createDefaultSave();
    expect(save.selectedLevel).toBe(LEVEL_ORDER[0]);
    const seen: string[] = [];
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
      const banked = bankFinishedRun(save, world!.run, true);
      save = banked.save;
      seen.push(levelId);

      const want = REWARDS[levelId]!;
      expect(banked.firstClear, levelId).toBe(true);
      expect(save.schematics, `${levelId} schematic`).toContain(want.schematic);
      expect(save.pilotsRescued, `${levelId} pod`).toContain(want.pilot);
      expect(save.levels[levelId]?.clears, `${levelId} clears`).toBe(1);
      expect(save.levels[levelId]?.best, `${levelId} best`).toBe(world!.run.score);
      expect(save.highScores.some((h) => h.level === levelId)).toBe(true);

      const last = levelId === LEVEL_ORDER[LEVEL_ORDER.length - 1];
      expect(banked.campaignComplete, `${levelId} campaignComplete`).toBe(last);
      // The first clear points LAUNCH at the next sector; NEXT SECTOR flies it.
      expect(save.selectedLevel).toBe(last ? levelId : banked.nextLevel);
      if (banked.nextLevel !== null) {
        expect(isLevelUnlocked(save, banked.nextLevel)).toBe(true);
        expect(getLevel(banked.nextLevel).number).toBe(getLevel(levelId).number + 1);
      }
      levelId = banked.nextLevel;
    }
    expect(seen).toEqual([...LEVEL_ORDER]);
    expect(save.stats.bossKills).toBe(LEVEL_ORDER.length);
    expect(save.salvage).toBeGreaterThan(0);
  }, 120_000);
});
