// Store screenshots from the dev server: `npx vite --port 5133` then
// `node tools/release/screenshots.mjs [outDir]`. Dev flags (?level, ?t, ?god, ?save)
// only exist in dev builds, which is why this doesn't run against `dist/`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import process from 'node:process';

const BASE = process.env.SHOT_URL ?? 'http://localhost:5133';
const OUT = process.argv[2] ?? 'store/screenshots';

// App Store 6.9" (1290x2796) and Play phone (1080x1920; Play rejects anything taller than 2:1).
const SIZES = {
  ios: { width: 430, height: 932 },
  android: { width: 360, height: 640 },
};

// Title, then the hangar's LAUNCH. (`?sandbox` would skip the menus, but it has no enemy waves.)
const LAUNCH = ['Enter', 'Enter'];

/** [name, query, keys after the title appears, seconds to let the scene run] */
const SHOTS = [
  ['1-kessler', 'level=1&t=95&god&save=act1', LAUNCH, 10],
  ['2-armada', 'level=5&t=150&god&save=act1', LAUNCH, 8],
  ['3-event-horizon', 'level=3&t=120&god&save=act1', LAUNCH, 10],
  ['4-pulsar', 'level=4&t=60&god&save=act1', LAUNCH, 10],
  ['5-hangar', 'save=act1', ['Enter'], 1],
  [
    '6-ships',
    'save=act1',
    ['Enter', 'ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowRight'],
    1,
  ],
  ['7-sectors', 'save=act1&dlc=0', ['Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'], 1],
  ['8-title', 'save=fresh', [], 2],
];

const browser = await chromium.launch();
for (const [platform, viewport] of Object.entries(SIZES)) {
  mkdirSync(`${OUT}/${platform}`, { recursive: true });
  for (const [name, query, keys, wait] of SHOTS) {
    const ctx = await browser.newContext({
      viewport,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?mute&${query}`);
    await page.waitForTimeout(1500);
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(350);
    }
    if (query.includes('level=')) {
      // Weave left and right so the shot catches the ship firing mid-field.
      for (let i = 0; i < wait; i++) {
        const k = i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(k);
        await page.waitForTimeout(i === 0 ? 300 : 600);
        await page.keyboard.up(k);
        await page.waitForTimeout(400);
      }
    } else {
      await page.waitForTimeout(wait * 1000);
    }
    await page.screenshot({ path: `${OUT}/${platform}/${name}.png` });
    console.log(platform, name);
    await ctx.close();
  }
}
await browser.close();
