import { expect, test, type Page } from '@playwright/test';
import { computeLayout } from '../src/engine/display';

// T43 device-class perf check (T19/T31 method, scripted): each Act II sector's
// heaviest beat and the Foundry escape, under `?debug&god&mute&save=act1`, with
// Chromium's CPU throttle standing in for a mid-range phone (DevTools' "mid-tier
// mobile" preset is 4×). Reads the debug overlay's one-second windows through
// the dev-only `window.__perf` and prints one row per beat.
// Opt-in: PERF=1 [PERF_CPU=4] E2E_PORT=… npx playwright test -c e2e/playwright.config.ts perf --project=pixel

const RUN = process.env.PERF === '1';

interface SceneItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Title tap, then Hangar LAUNCH (`?level=` picks the sector), as the smoke spec does. */
async function launch(page: Page): Promise<void> {
  const v = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }));
  const l = computeLayout(v.w, v.h, v.dpr);
  const css = (lx: number, ly: number) => ({
    x: (l.destX + (lx * l.destW) / l.logicalW) / l.dpr,
    y: (l.destY + (ly * l.destH) / l.logicalH) / l.dpr,
  });
  const scene = () =>
    page.evaluate(() => {
      const s = (window as unknown as { __scene?: { name(): string; items(): SceneItem[] } })
        .__scene;
      return s ? { name: s.name(), items: s.items() } : null;
    });
  await expect.poll(async () => (await scene())?.name, { timeout: 15_000 }).toBe('TitleScene');
  await page.waitForTimeout(700);
  const mid = css(120, l.logicalH / 2);
  await page.touchscreen.tap(mid.x, mid.y);
  let item: SceneItem | undefined;
  await expect
    .poll(
      async () => {
        const s = await scene();
        item = s?.name === 'HangarScene' ? s.items.find((i) => i.id === 'launch') : undefined;
        return item !== undefined;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.waitForTimeout(150);
  const it = item as SceneItem;
  const c = css(it.x + it.w / 2, it.y + it.h / 2);
  await page.touchscreen.tap(c.x, c.y);
}
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
    // The den's chunks are queued at ~160 s: a later `?t=` skips the den and the boss.
    t: 160,
    secs: 45,
    calls: [[30, "__warrens.skip('frenzy')"]],
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const cdp = await page.context().newCDPSession(page);
    const rows: string[] = [
      `| Beat | FPS min | TPS | UPD avg / max ms | RND avg / max ms | frame avg ms | peak shots |`,
      '|---|---|---|---|---|---|---|',
    ];
    const only = process.env.PERF_ONLY;
    for (const b of BEATS) {
      if (only !== undefined && !b.name.includes(only)) continue;
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await page.goto(`/?level=${b.level}&t=${b.t}&save=act1&god&debug&mute&seed=perf`);
      await launch(page);
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
        if (w && process.env.PERF_LOG === '1')
          console.log(`${b.name} +${s}s upd ${w.updMax.toFixed(1)} rnd ${w.rndMax.toFixed(1)}`);
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
    expect(errors).toEqual([]);
    console.log(
      `\nAct II perf, ${CPU}× CPU throttle (Chromium, ${test.info().project.name})\n${rows.join('\n')}\n`,
    );
  });
});
