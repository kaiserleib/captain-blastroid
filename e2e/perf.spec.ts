import { test, type Page } from '@playwright/test';

// T43 device-class perf check (T19/T31 method, scripted): each Act II sector's
// heaviest beat and the Foundry escape, under `?debug&god&mute&save=act1`, with
// Chromium's CPU throttle standing in for a mid-range phone (DevTools' "mid-tier
// mobile" preset is 4×). Reads the debug overlay's one-second windows through
// the dev-only `window.__perf` and prints one row per beat.
// Opt-in: PERF=1 [PERF_CPU=4] E2E_PORT=… npx playwright test -c e2e/playwright.config.ts perf --project=pixel

const RUN = process.env.PERF === '1';
const CPU = Number(process.env.PERF_CPU ?? 4);

interface Beat {
  name: string;
  level: number;
  t: number;
  /** Seconds of wall time to sample. */
  secs: number;
  /** Console calls at given seconds into the sample (boss skips). */
  calls?: [number, string][];
}

const BEATS: Beat[] = [
  { name: 'L6 CME storm (flares, gnat swarms)', level: 6, t: 146, secs: 24 },
  { name: 'L6 Heliostat (beams → furnace spiral)', level: 6, t: 177, secs: 50 },
  { name: 'L7 fork (turrets, bats, gates)', level: 7, t: 74, secs: 20 },
  {
    name: 'L7 Wyrm frenzy (carving)',
    level: 7,
    t: 164,
    secs: 40,
    calls: [[22, "__warrens.skip('frenzy')"]],
  },
  { name: 'L8 junction rush + feedback loop', level: 8, t: 128, secs: 40 },
  { name: 'L8 Janus phase 1 → 2', level: 8, t: 178, secs: 40 },
  { name: 'L9 dammed gunboat + time storm', level: 9, t: 129, secs: 35 },
  {
    name: 'L9 Echo → PARADOX',
    level: 9,
    t: 178,
    secs: 40,
    calls: [[20, "__chrono.skip('paradox')"]],
  },
  { name: 'L10 furnace (flares, portals, line)', level: 10, t: 114, secs: 30 },
  {
    name: 'L10 Architect forms → escape',
    level: 10,
    t: 199,
    secs: 75,
    calls: [
      [14, '__foundry.skip()'],
      [28, '__foundry.skip()'],
      [40, '__foundry.skip()'],
    ],
  },
];

interface Window1 {
  fps: number;
  tps: number;
  upd: number;
  updMax: number;
  rnd: number;
  rndMax: number;
  shots: number;
}

async function sample(page: Page): Promise<Window1 | null> {
  return page.evaluate(() => {
    const g = window as unknown as {
      __perf?: () => Omit<Window1, 'shots'>;
      __director?: { world?: { enemyShots: { items: { active: boolean }[]; count: number } } };
    };
    if (!g.__perf) return null;
    const s = g.__perf();
    const es = g.__director?.world?.enemyShots;
    let shots = 0;
    if (es) for (let i = 0; i < es.count; i++) if (es.items[i]!.active) shots++;
    return { ...s, shots };
  });
}

test.describe('perf', () => {
  test.skip(!RUN, 'PERF=1 to run');
  test.setTimeout(0);

  test(`Act II beats at ${CPU}× CPU`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const rows: string[] = [
      `| Beat | FPS min | TPS | UPD avg / max ms | RND avg / max ms | frame avg ms | peak shots |`,
      '|---|---|---|---|---|---|---|',
    ];
    for (const b of BEATS) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await page.goto(`/?level=${b.level}&t=${b.t}&save=act1&god&debug&mute&seed=perf`);
      await page.waitForFunction(
        () => {
          const g = window as unknown as { __director?: unknown; __perf?: unknown };
          return g.__director !== undefined && g.__perf !== undefined;
        },
        null,
        { timeout: 30_000 },
      );
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.waitForTimeout(1500);
      const ws: Window1[] = [];
      const calls = [...(b.calls ?? [])];
      for (let s = 0; s < b.secs; s++) {
        while (calls.length > 0 && calls[0]![0] <= s) {
          const [, js] = calls.shift()!;
          await page.evaluate(js).catch(() => undefined);
        }
        await page.waitForTimeout(1000);
        const w = await sample(page);
        if (w && w.fps > 0) ws.push(w);
      }
      const avg = (f: (w: Window1) => number) =>
        ws.reduce((a, w) => a + f(w), 0) / Math.max(1, ws.length);
      const max = (f: (w: Window1) => number) => Math.max(0, ...ws.map(f));
      const min = (f: (w: Window1) => number) => Math.min(...ws.map(f));
      const fmt = (v: number) => v.toFixed(2);
      rows.push(
        `| ${b.name} | ${min((w) => w.fps).toFixed(0)} | ${avg((w) => w.tps).toFixed(0)} | ${fmt(avg((w) => w.upd))} / ${fmt(max((w) => w.updMax))} | ${fmt(avg((w) => w.rnd))} / ${fmt(max((w) => w.rndMax))} | ${fmt(avg((w) => w.upd * (w.tps / Math.max(1, w.fps)) + w.rnd))} | ${max((w) => w.shots)} |`,
      );
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(
      `\nAct II perf, ${CPU}× CPU throttle (Chromium, ${test.info().project.name})\n${rows.join('\n')}\n`,
    );
  });
});
