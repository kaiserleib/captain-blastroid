import { expect, test, type Page } from '@playwright/test';
import { computeLayout, type Layout } from '../src/engine/display';
import { LEVEL_ORDER } from '../src/content/levels';

// Title → Hangar → Launch by taps, then real touch-drag on the floating stick.
// `?mute` keeps the run silent, `?save=` keeps it off the real save, `?debug` turns
// on the FPS overlay. Dev-only hooks: `window.__scene` lists the top menu's items
// (so taps go by item id, not hard-coded coordinates) and `window.__director` gives
// the world to read ticks, the ship position and the level from.
const URL = '/?debug&mute&save=fresh';
const DRAG_MS = 10_000;

interface SceneItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DirectorProbe {
  tick: number;
  t: number;
  x: number;
  y: number;
  alive: boolean;
  levelId: string;
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
    const w = d.world as {
      tick: number;
      player: { x: number; y: number; alive: boolean };
      run: { levelId: string };
    };
    return {
      tick: w.tick,
      t: d.state.t,
      x: w.player.x,
      y: w.player.y,
      alive: w.player.alive,
      levelId: w.run.levelId,
    };
  });
}

async function sceneState(page: Page): Promise<{ name: string; items: SceneItem[] } | null> {
  return page.evaluate(() => {
    const s = (window as unknown as { __scene?: { name(): string; items(): SceneItem[] } }).__scene;
    return s ? { name: s.name(), items: s.items() } : null;
  });
}

/** Waits for `scene` to be on top with item `id` laid out, then taps the item's centre. */
async function tapItem(page: Page, l: Layout, scene: string, id: string): Promise<void> {
  let item: SceneItem | undefined;
  await expect
    .poll(
      async () => {
        const s = await sceneState(page);
        item = s?.name === scene ? s.items.find((it) => it.id === id) : undefined;
        return item ? 'ready' : `${s?.name ?? 'no __scene'}: ${s?.items.map((i) => i.id)}`;
      },
      { timeout: 10_000, message: `${scene} item "${id}"` },
    )
    .toBe('ready');
  // Let the screen settle a frame (scene transitions run from update()).
  await page.waitForTimeout(150);
  const it = item as SceneItem;
  const c = toCss(l, it.x + it.w / 2, it.y + it.h / 2);
  await page.touchscreen.tap(c.x, c.y);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Title: the logo drops in over 0.5 s; then the whole screen is the start button. */
async function passTitle(page: Page, l: Layout): Promise<void> {
  await expect
    .poll(async () => (await canvasInk(page)).colors, { timeout: 10_000 })
    .toBeGreaterThan(8);
  await expect.poll(async () => (await sceneState(page))?.name).toBe('TitleScene');
  await page.waitForTimeout(600);
  const centre = toCss(l, 120, l.logicalH / 2);
  await page.touchscreen.tap(centre.x, centre.y);
}

/** Holds a finger mid-playfield and circles it for `ms`; returns the ship's x range. */
async function dragStick(page: Page, l: Layout, ms: number): Promise<number> {
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
  for (let i = 0; Date.now() - t0 < ms; i++) {
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
  return maxX - minX;
}

test('title → hangar → launch, 10 s of touch-drag', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto(URL);
  const l = await layoutOf(page);

  await passTitle(page, l);
  await tapItem(page, l, 'HangarScene', 'launch');
  await expect.poll(() => probe(page), { timeout: 10_000 }).not.toBeNull();
  const start = (await probe(page))!;
  expect(start.levelId).toBe(LEVEL_ORDER[0]);

  // Floating stick: finger down mid-playfield, then circle around it so the ship
  // sweeps in every direction.
  const sweep = await dragStick(page, l, DRAG_MS);

  const end = (await probe(page))!;
  // 10 s at 60 TPS is ~600 ticks; allow for a slow CI box.
  expect(end.tick - start.tick).toBeGreaterThan(300);
  expect(end.t).toBeGreaterThan(start.t + 5);
  // The drag steered the ship.
  expect(sweep).toBeGreaterThan(20);

  await testInfo.attach('after-drag', { body: await page.screenshot(), contentType: 'image/png' });
  const ink = await canvasInk(page);
  expect(ink.lit).toBeGreaterThan(0.02);
  expect(ink.colors).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('sector select → launch sector 2, 5 s of touch-drag', async ({ page }, testInfo) => {
  const second = LEVEL_ORDER[1];
  test.skip(!second, 'needs a second sector in LEVEL_ORDER (T21)');
  const errors = collectErrors(page);
  await page.goto('/?mute&save=all');
  const l = await layoutOf(page);

  await passTitle(page, l);
  await tapItem(page, l, 'HangarScene', 'sector');
  await tapItem(page, l, 'SectorSelectScene', `sector:${second}`);
  await tapItem(page, l, 'HangarScene', 'launch');
  await expect.poll(() => probe(page), { timeout: 10_000 }).not.toBeNull();
  const start = (await probe(page))!;

  const sweep = await dragStick(page, l, 5_000);
  const end = (await probe(page))!;
  expect(end.levelId).toBe(second);
  expect(start.levelId).toBe(second);
  expect(end.tick - start.tick).toBeGreaterThan(150);
  expect(sweep).toBeGreaterThan(10);

  await testInfo.attach('sector-2', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

async function itemIds(page: Page): Promise<string[]> {
  return (await sceneState(page))?.items.map((i) => i.id) ?? [];
}

test('act1 save: sector select pages ACT II ↔ ACT I, launches sector 6', async ({
  page,
}, testInfo) => {
  const sixth = LEVEL_ORDER[5];
  test.skip(!sixth, 'needs Act II in LEVEL_ORDER (T32)');
  const errors = collectErrors(page);
  await page.goto('/?mute&save=act1');
  const l = await layoutOf(page);

  await passTitle(page, l);
  await tapItem(page, l, 'HangarScene', 'sector');
  // Opens on the page holding selectedLevel (corona, ACT II); only that act's cards are laid out.
  await tapItem(page, l, 'SectorSelectScene', `sector:${sixth}`);
  await tapItem(page, l, 'HangarScene', 'sector');
  await tapItem(page, l, 'SectorSelectScene', 'prev');
  await expect.poll(() => itemIds(page)).toContain(`sector:${LEVEL_ORDER[0]}`);
  expect(await itemIds(page)).not.toContain(`sector:${sixth}`);
  await tapItem(page, l, 'SectorSelectScene', 'next');
  await expect.poll(() => itemIds(page)).toContain(`sector:${sixth}`);
  await testInfo.attach('act-2-page', { body: await page.screenshot(), contentType: 'image/png' });
  await tapItem(page, l, 'SectorSelectScene', `sector:${sixth}`);
  await tapItem(page, l, 'HangarScene', 'launch');
  await expect.poll(() => probe(page), { timeout: 10_000 }).not.toBeNull();
  const start = (await probe(page))!;
  expect(start.levelId).toBe(sixth);

  const sweep = await dragStick(page, l, 4_000);
  const end = (await probe(page))!;
  expect(end.levelId).toBe(sixth);
  expect(end.tick - start.tick).toBeGreaterThan(120);
  expect(sweep).toBeGreaterThan(10);

  await testInfo.attach('sector-6', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});
