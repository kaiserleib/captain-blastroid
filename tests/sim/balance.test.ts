import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, getLevel } from '../../src/content/levels';
import { dodgerBot, godBot, SKILLS, type SkillId } from './bots';
import { formatBalanceReport, playBalance } from './balance.report';

// `npm run balance` (BALANCE=1) prints the report for RUNS (default 50) seeds of
// the typical dodger. SKILLS=novice,typical,expert,god runs T18's per-skill pass
// instead ("god" is the typical dodger that can't die: loadouts and boss time).
// LEVEL=<id> picks the sector (default kessler); LEVEL=all prints one block per sector.
// Skipped in the default test run.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const BALANCE = env.BALANCE === '1';
const RUNS = Number(env.RUNS ?? 50);
const PASSES = (env.SKILLS ?? 'typical').split(',').map((s) => s.trim());
const LEVEL = env.LEVEL ?? 'kessler';
const LEVELS = LEVEL === 'all' ? LEVEL_ORDER : [LEVEL];

describe.skipIf(!BALANCE)('balance report', () => {
  for (const levelId of LEVELS) {
    for (const pass of PASSES) {
      it(`${levelId} ${pass}`, () => {
        expect(LEVEL_ORDER, `unknown level "${levelId}"`).toContain(levelId);
        const isGod = pass === 'god';
        const skill = SKILLS[(isGod ? 'typical' : pass) as SkillId];
        expect(skill, `unknown skill "${pass}"`).toBeDefined();
        const make = () => (isGod ? godBot(skill) : dodgerBot(skill));
        const runs = playBalance(make, RUNS, isGod ? 'god' : 'bal', levelId);
        const l = getLevel(levelId);
        const label = `Level ${l.number} ${l.name}`;
        console.log(`\n${formatBalanceReport(make().name, runs, label)}\n`);
      }, 900_000);
    }
  }
});
