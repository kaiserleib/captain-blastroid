import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '../platform/web/storage';
import {
  appendRunLog,
  clearRunLog,
  formatRunLog,
  initRunLog,
  RUN_LOG_KEY,
  RUN_LOG_MAX,
  runLogEntries,
  type RunLogEntry,
} from './runLog';

function entry(p: Partial<RunLogEntry> = {}): RunLogEntry {
  return {
    at: '2026-10-27T14:02:00.000Z',
    level: 'kessler',
    ship: 'kestrel',
    pilot: 'blastroid',
    outcome: 'death',
    time: 93.4,
    bossAt: null,
    bossTime: null,
    score: 12000,
    salvage: 140,
    kills: 88,
    pod: false,
    hits: { 'level:shot': 2, 'level:rock': 1 },
    deathCause: 'rock',
    weapons: 'blaster3 spread1',
    ...p,
  };
}

const HEADER = { build: 'abc123', device: 'test', levelOrder: ['kessler', 'ionShoals'] };

describe('run log storage', () => {
  let s: MemoryStorage;
  beforeEach(async () => {
    s = new MemoryStorage();
    await initRunLog(s);
  });

  it('persists appended runs and reloads them', async () => {
    await appendRunLog(entry());
    await appendRunLog(entry({ outcome: 'clear', deathCause: null }));
    await initRunLog(s);
    expect(runLogEntries().map((e) => e.outcome)).toEqual(['death', 'clear']);
  });

  it(`keeps the newest ${RUN_LOG_MAX}`, async () => {
    for (let i = 0; i < RUN_LOG_MAX + 5; i++) await appendRunLog(entry({ score: i }));
    expect(runLogEntries()).toHaveLength(RUN_LOG_MAX);
    expect(runLogEntries()[0]?.score).toBe(5);
  });

  it('starts empty on a corrupt log and clears on request', async () => {
    await s.set(RUN_LOG_KEY, '{not json');
    await initRunLog(s);
    expect(runLogEntries()).toEqual([]);
    await appendRunLog(entry());
    await clearRunLog();
    await initRunLog(s);
    expect(runLogEntries()).toEqual([]);
  });
});

describe('formatRunLog', () => {
  it('says so when empty', () => {
    expect(formatRunLog([], HEADER)).toContain('No runs yet.');
  });

  it('summarizes sectors in campaign order and lists runs newest first', () => {
    const text = formatRunLog(
      [
        entry(),
        entry({
          level: 'ionShoals',
          outcome: 'clear',
          deathCause: null,
          bossAt: 150,
          bossTime: 61.6,
        }),
        entry({ hits: { 'boss:hull': 1 }, deathCause: 'hull', bossAt: 170, bossTime: 12 }),
      ],
      HEADER,
    );
    expect(text).toContain('build abc123 · 3 runs');
    const lines = text.split('\n');
    const kessler = lines.find((l) => l.startsWith('L1 kessler')) ?? '';
    expect(kessler).toMatch(/L1 kessler\s+2\s+0\s+2\s+0\s+hull 1, rock 1/);
    expect(lines.findIndex((l) => l.startsWith('L1 kessler'))).toBeLessThan(
      lines.findIndex((l) => l.startsWith('L2 ionShoals')),
    );
    const runs = lines.slice(lines.indexOf('RUNS (newest first)') + 1);
    expect(runs[0]).toContain('DEATH 93s');
    expect(runs[0]).toContain('boss 170s fight 12s');
    expect(runs[1]).toBe('  hits boss: hull 1 · died to hull');
    expect(runs[3]).toContain('L2 ionShoals CLEAR');
    expect(runs[4]).toBe('  hits level: shot 2, rock 1');
  });
});
