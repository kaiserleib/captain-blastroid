// Composes the Play Store feature graphic (1024×500) from the Android screenshots.
// Run after tools/release/screenshots.mjs:  node tools/release/feature-graphic.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Inlined: a page made with setContent may not load file: URLs.
const shot = (name) =>
  `data:image/png;base64,${readFileSync(new URL(`../../store/screenshots/android/${name}.png`, import.meta.url)).toString('base64')}`;
const out = new URL('../../store/screenshots/feature-graphic.png', import.meta.url).pathname;
const html = `<!doctype html><style>
  * { margin: 0; image-rendering: pixelated; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #0a0c1e; position: relative; }
  .bg { position: absolute; inset: 0; background: url(${shot('8-title')}) -300px 0 / 1650px auto; opacity: 0.9; }
  /* The logo block of the title screen, cut out by position. */
  .logo { position: absolute; left: 44px; top: 168px; width: 520px; height: 165px;
          background: url(${shot('8-title')}) -170px -262px / 864px auto; }
  .phone { position: absolute; width: 214px; height: 380px; border: 4px solid #2a3060; border-radius: 14px;
           background-size: cover; box-shadow: 0 10px 0 #05060f; }
  .a { left: 590px; top: 78px; transform: rotate(-5deg); background-image: url(${shot('2-armada')}); }
  .b { left: 782px; top: 46px; transform: rotate(4deg); background-image: url(${shot('3-event-horizon')}); }
</style><div class="bg"></div><div class="logo"></div><div class="phone a"></div><div class="phone b"></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
