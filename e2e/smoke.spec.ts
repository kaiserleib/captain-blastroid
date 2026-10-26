import { expect, test, type Page } from '@playwright/test';
import { computeLayout, type Layout } from '../src/engine/display';

// Title → Hangar → Launch by taps, then 10 s of real touch-drag on the floating
// stick. `?mute` keeps the run silent, `?save=fresh` keeps it off the real save,
// `?debug` turns on the FPS overlay; the dev-only `window.__director` gives us the
// world to read ticks and the ship position from.
const URL = '/?debug&mute&save=fresh';
const DRAG_MS = 10_000;

interface DirectorProbe {
  tick: number;
  t: number;
  x: number;
  y: number;
  alive: boolean;
}

async function layoutOf(page: Page): Promise<Layout> {
  const v = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }));
  return computeLayout(v.w, v.h, v.dpr);
}

/** Logical buffer px → CSS px (the canvas fills the viewport). */
function toCss(l: Layout, lx: number, ly: number): { x: number; y: number } {
  return {
    x: (l.destX + (lx * l.destW) / l.logicalW) / l.dpr,
    y: (l.destY + (ly * l.destH) / l.logicalH) / l.dpr,
  };
}

/** Share of sampled display pixels that aren't letterbox black, and how many distinct colors. */
async function canvasInk(page: Page): Promise<{ lit: number; colors: number }> {
  return page.evaluate(() => {
    const c = document.getElementById('game') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return { lit: 0, colors: 0 };
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set<number>();
    let lit = 0;
    let n = 0;
    const step = 4 * 7;
    for (let i = 0; i < d.length; i += step) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      n++;
      if (r + g + b > 24) lit++;
      colors.add((r << 16) | (g << 8) | b);
    }
    return { lit: lit / Math.max(1, n), colors: colors.size };
  });
}

async function probe(page: Page): Promise<DirectorProbe | null> {
  return page.evaluate(() => {
    const d = (window as unknown as { __director?: { world: unknown; state: { t: number } } })
      .__director;
    if (!d) return null;
    const w = d.world as { tick: number; player: { x: number; y: number; alive: boolean } };
    return { tick: w.tick, t: d.state.t, x: w.player.x, y: w.player.y, alive: w.player.alive };
  });
}

test('title → hangar → launch, 10 s of touch-drag', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(URL);
  const l = await layoutOf(page);

  // Title: the logo drops in over 0.5 s; then the whole screen is the start button.
  await expect
    .poll(async () => (await canvasInk(page)).colors, { timeout: 10_000 })
    .toBeGreaterThan(8);
  await page.waitForTimeout(600);
  const centre = toCss(l, 120, l.logicalH / 2);
  await page.touchscreen.tap(centre.x, centre.y);

  // Hangar: LAUNCH is the 30 px button under the loadout card (HangarScene.layout).
  await page.waitForTimeout(800);
  const top = Math.max(4, Math.floor((l.logicalH - 284) / 2));
  const launch = toCss(l, 120, top + 24 + 84 + 15);
  await page.touchscreen.tap(launch.x, launch.y);
  await expect.poll(() => probe(page), { timeout: 10_000 }).not.toBeNull();
  const start = (await probe(page))!;

  // Floating stick: finger down mid-playfield, then circle around it so the ship
  // sweeps in every direction.
  const cdp = await page.context().newCDPSession(page);
  const base = toCss(l, 120, l.playfieldOffsetY + 260);
  const touch = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touch(base.x, base.y),
  });
  let minX = Infinity;
  let maxX = -Infinity;
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < DRAG_MS; i++) {
    const a = (Date.now() - t0) / 700;
    const r = 30;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touch(base.x + Math.cos(a) * r, base.y + Math.sin(a) * r * 0.6),
    });
    await page.waitForTimeout(32);
    if (i % 10 === 0) {
      const p = await probe(page);
      if (p) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
      }
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const end = (await probe(page))!;
  // 10 s at 60 TPS is ~600 ticks; allow for a slow CI box.
  expect(end.tick - start.tick).toBeGreaterThan(300);
  expect(end.t).toBeGreaterThan(start.t + 5);
  // The drag steered the ship.
  expect(maxX - minX).toBeGreaterThan(20);

  await testInfo.attach('after-drag', { body: await page.screenshot(), contentType: 'image/png' });
  const ink = await canvasInk(page);
  expect(ink.lit).toBeGreaterThan(0.02);
  expect(ink.colors).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});
