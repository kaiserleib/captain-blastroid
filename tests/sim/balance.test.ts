import { describe, expect, it } from 'vitest';
import { playRun, SKILLS, summarize, type RunStats } from './harness';

// `npm run sim` (BALANCE=1) plays many seeded runs per bot skill and prints the
// balance summary used for the T18 balance log. The default test run only
// does a quick god-mode smoke of the full level → boss → clear flow.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const BALANCE = env.BALANCE === '1';
const RUNS = Number(env.RUNS ?? 12);

describe('level 1 headless smoke', () => {
  it('a god-mode bot reaches the boss, kills it and gets runOver{victory}', () => {
    const r = playRun({ seed: 'smoke', skill: SKILLS.expert!, god: true, maxT: 320 });
    expect(r.reachedBoss).toBe(true);
    expect(r.victory).toBe(true);
    expect(r.schematics).toContain('bulwark');
    // Design: about 3 weapons at the boss, not a full rack of max levels.
    expect(r.levelSumAtBoss).toBeGreaterThanOrEqual(5);
    expect(r.levelSumAtBoss).toBeLessThanOrEqual(16);
  }, 60_000);
});

describe.skipIf(!BALANCE)('balance measurement', () => {
  for (const skill of ['novice', 'typical', 'expert']) {
    it(`${skill}`, () => {
      const runs: RunStats[] = [];
      for (let i = 0; i < RUNS; i++) runs.push(playRun({ seed: `bal${i}`, skill: SKILLS[skill]! }));
      console.log(`\n=== ${skill}\n${summarize(runs)}`);
    }, 600_000);
  }
  it('god expert (loadout / boss time without deaths)', () => {
    const runs: RunStats[] = [];
    for (let i = 0; i < RUNS; i++)
      runs.push(playRun({ seed: `god${i}`, skill: SKILLS.typical!, god: true }));
    console.log(`\n=== god typical\n${summarize(runs)}`);
  }, 600_000);
});
