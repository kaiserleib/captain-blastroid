import { afterAll, describe, expect, it } from 'vitest';
import { LEVEL_ORDER, getLevel } from '../../src/content/levels';
import { debugSave, type DebugSaveId } from '../../src/ui/debugSaves';
import { dodgerBot, godBot, SKILLS, type SkillId } from './bots';
import {
  formatBalanceReport,
  formatSummaryTable,
  playBalance,
  type SummaryRow,
} from './balance.report';

// `npm run balance` (BALANCE=1) prints the report for RUNS (default 50) seeds of
// the typical dodger. SKILLS=novice,typical,expert,god runs T18's per-skill pass
// instead ("god" is the typical dodger that can't die: loadouts and boss time).
// LEVEL=<id> picks the sector (default kessler); LEVEL=all prints one block per
// sector, then a one-line-per-sector summary table for each pass. SAVE=act1 (or
// fresh|mid|all) flies with that `?save=` preset: Act II is balanced on act1.
// Skipped in the default test run.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const BALANCE = env.BALANCE === '1';
const RUNS = Number(env.RUNS ?? 50);
const PASSES = (env.SKILLS ?? 'typical').split(',').map((s) => s.trim());
const LEVEL = env.LEVEL ?? 'kessler';
const LEVELS = LEVEL === 'all' ? LEVEL_ORDER : [LEVEL];
const SAVE = (env.SAVE ?? 'fresh') as DebugSaveId;
const SAVE_DATA = SAVE === 'fresh' ? undefined : debugSave(SAVE);

describe.skipIf(!BALANCE)('balance report', () => {
  const summary = new Map<string, SummaryRow[]>();

  for (const levelId of LEVELS) {
    for (const pass of PASSES) {
      it(`${levelId} ${pass}`, () => {
        expect(LEVEL_ORDER, `unknown level "${levelId}"`).toContain(levelId);
        const isGod = pass === 'god';
        const skill = SKILLS[(isGod ? 'typical' : pass) as SkillId];
        expect(skill, `unknown skill "${pass}"`).toBeDefined();
        const make = () => (isGod ? godBot(skill) : dodgerBot(skill));
        expect(['fresh', 'mid', 'act1', 'all'], `unknown save "${SAVE}"`).toContain(SAVE);
        const runs = playBalance(make, RUNS, isGod ? 'god' : 'bal', levelId, SAVE_DATA);
        const l = getLevel(levelId);
        const label = `Level ${l.number} ${l.name}`;
        console.log(`\n${formatBalanceReport(make().name, runs, label, SAVE)}\n`);
        const name = make().name;
        if (!summary.has(name)) summary.set(name, []);
        summary.get(name)!.push({ label: `${l.number} ${l.name}`, runs });
      }, 900_000);
    }
  }

  afterAll(() => {
    if (LEVELS.length < 2) return;
    for (const [name, rows] of summary) console.log(`\n${formatSummaryTable(name, rows)}\n`);
  });
});
