import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, getLevel } from '../../src/content/levels';
import { dodgerBot, godBot, idleBot } from './bots';
import { runSim, type SimRun } from './harness';

// `npm run test` runs a quick subset; `npm run test:sim` (SIM=1) runs the full set.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const FULL = env.SIM === '1';
const GOD_SEEDS = FULL ? 10 : 3;
/** God seeds per sector in the every-level pass. */
const LEVEL_SEEDS = FULL ? 10 : 1;

/** The debug-boosted loadout the god runs start with, so the boss falls in ~20 s. */
const BOOSTED = [
  { id: 'blaster', level: 5 },
  { id: 'spread', level: 4 },
  { id: 'seeker', level: 4 },
];
const ALL_MAX = ['blaster', 'spread', 'lance', 'seeker', 'orbitDrones'].map((id) => ({
  id,
  level: 5,
}));

function expectNoDroppedSpawns(r: SimRun): void {
  for (const [name, u] of Object.entries(r.stats.pools)) {
    expect(u.dropped, `${r.stats.seed}: pool ${name} dropped spawns (peak ${u.peak})`).toBe(0);
    expect(u.peak, `${r.stats.seed}: pool ${name} hit capacity`).toBeLessThan(u.capacity);
  }
}

function indexOf(r: SimRun, type: string): number {
  return r.events.findIndex((e) => e.type === type);
}

describe('level 1 god playthrough', () => {
  for (let i = 0; i < GOD_SEEDS; i++) {
    it(`seed god${i}: boss spawns, falls, levelComplete then runOver{victory}`, () => {
      const r = runSim(`god${i}`, godBot(), 400, { loadout: BOOSTED });
      expect(r.result.outcome).toBe('victory');
      const spawned = indexOf(r, 'bossSpawned');
      const defeated = indexOf(r, 'bossDefeated');
      const complete = indexOf(r, 'levelComplete');
      const over = indexOf(r, 'runOver');
      expect(indexOf(r, 'bossRequested')).toBeGreaterThanOrEqual(0);
      expect(spawned).toBeGreaterThanOrEqual(0);
      expect(defeated).toBeGreaterThan(spawned);
      expect(complete).toBeGreaterThan(defeated);
      expect(over).toBeGreaterThan(complete);
      expect(r.events[over]!.data).toContain('victory:true');
      expect(r.events.filter((e) => e.type === 'runOver')).toHaveLength(1);
      expect(r.stats.hits).toBe(0);
      expect(r.stats.schematics).toContain('bulwark');
      expectNoDroppedSpawns(r);
    }, 30_000);
  }

  it('without a boosted loadout the god bot still clears (fresh save, Kestrel)', () => {
    const r = runSim('god-plain', godBot(), 400);
    expect(r.result.outcome).toBe('victory');
    expect(r.stats.bossDefeated).toBe(true);
    // Design: about 3 weapons at the boss, not a full rack of max levels.
    expect(r.stats.levelSumAtBoss).toBeGreaterThanOrEqual(5);
    expect(r.stats.levelSumAtBoss).toBeLessThanOrEqual(16);
    expectNoDroppedSpawns(r);
  }, 30_000);
});

describe('every sector: god playthrough', () => {
  for (const levelId of LEVEL_ORDER) {
    for (let i = 0; i < LEVEL_SEEDS; i++) {
      it(`${levelId} seed god${i}: boss spawned → defeated → levelComplete → one runOver{victory}`, () => {
        const r = runSim(`${levelId}-god${i}`, godBot(), 400, { levelId, loadout: BOOSTED });
        expect(r.result.outcome).toBe('victory');
        const spawned = indexOf(r, 'bossSpawned');
        const defeated = indexOf(r, 'bossDefeated');
        const complete = indexOf(r, 'levelComplete');
        expect(spawned).toBeGreaterThanOrEqual(0);
        expect(defeated).toBeGreaterThan(spawned);
        expect(complete).toBeGreaterThan(defeated);
        const overs = r.events.filter((e) => e.type === 'runOver');
        expect(overs).toHaveLength(1);
        expect(overs[0]!.data).toContain('victory:true');
        // The first toast names the sector.
        const toast = r.events.find((e) => e.type === 'toast');
        expect(toast?.data).toContain(getLevel(levelId).name);
        expectNoDroppedSpawns(r);
      }, 30_000);
    }
  }
});

describe('idle bot', () => {
  const seeds = FULL ? 10 : 3;
  for (let i = 0; i < seeds; i++) {
    it(`seed idle${i}: no input, no crash, survives the opening`, () => {
      const r = runSim(`idle${i}`, idleBot(), 300);
      // Idle deaths measured at 38–192 s across 10 seeds; 20 s is the floor we promise.
      expect(r.result.endT).toBeGreaterThan(20);
      expect(r.result.outcome).not.toBe('victory');
      expectNoDroppedSpawns(r);
    }, 30_000);
  }
});

describe('determinism per sector', () => {
  // A short slice of each in the default suite; full length under SIM=1.
  const secs = FULL ? 420 : 25;
  for (const levelId of LEVEL_ORDER) {
    it(`${levelId}: same seed + bot gives the same hash (dodger, ${secs} s)`, () => {
      const a = runSim(`det-${levelId}`, dodgerBot(), secs, { levelId });
      const b = runSim(`det-${levelId}`, dodgerBot(), secs, { levelId });
      expect(a.eventCount).toBeGreaterThan(20);
      expect(b.hash).toBe(a.hash);
      expect(b.events).toEqual(a.events);
    }, 30_000);
  }
});

describe('determinism', () => {
  const secs = FULL ? 300 : 90;
  it(`same seed + bot gives the same event-log hash (dodger, ${secs} s)`, () => {
    const a = runSim('det', dodgerBot(), secs);
    const b = runSim('det', dodgerBot(), secs);
    expect(a.eventCount).toBeGreaterThan(100);
    expect(b.hash).toBe(a.hash);
    expect(b.eventCount).toBe(a.eventCount);
    expect(b.result).toEqual(a.result);
    expect(b.events).toEqual(a.events);
  }, 30_000);

  it('the hash depends on the seed', () => {
    const a = runSim('det-a', dodgerBot(), 30);
    const b = runSim('det-b', dodgerBot(), 30);
    expect(a.hash).not.toBe(b.hash);
  });

  it.runIf(FULL)(
    'god runs with a boosted loadout are deterministic too',
    () => {
      const a = runSim('det-god', godBot(), 400, { loadout: BOOSTED });
      const b = runSim('det-god', godBot(), 400, { loadout: BOOSTED });
      expect(b.hash).toBe(a.hash);
      expect(a.result.outcome).toBe('victory');
    },
    30_000,
  );
});

describe('pool safety', () => {
  it('a run with every weapon at L5 never fills a pool', () => {
    const r = runSim(FULL ? 'pool-max' : 'pool-max-short', godBot(), FULL ? 400 : 200, {
      loadout: ALL_MAX,
    });
    expectNoDroppedSpawns(r);
  }, 30_000);

  for (const levelId of LEVEL_ORDER) {
    it(`${levelId}: every weapon at L5 through the whole sector never fills a pool`, () => {
      const r = runSim(`pool-max-${levelId}`, godBot(), 420, { levelId, loadout: ALL_MAX });
      expect(r.result.outcome).toBe('victory');
      expectNoDroppedSpawns(r);
    }, 30_000);
  }

  it('the harness sees overflow when a pool is undersized (the check is not vacuous)', () => {
    const r = runSim('pool-tiny', godBot(), 20, {
      loadout: ALL_MAX,
      capacities: { playerShots: 8 },
    });
    expect(r.stats.pools.playerShots!.dropped).toBeGreaterThan(0);
    expect(r.stats.pools.playerShots!.peak).toBe(8);
  });
});
