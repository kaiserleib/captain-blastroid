import { createRng } from '../engine/rng';
import { drawAccessories } from './layers/accessories';
import { drawBackground } from './layers/background';
import { drawAge, drawEyes, drawMouth, drawNose } from './layers/face';
import { drawFacialHair, drawHair, drawHairBack, drawHelmetFringe } from './layers/hair';
import { drawHead, drawNeck } from './layers/head';
import { drawAntennae, drawHeadgear } from './layers/headgear';
import { drawUniform } from './layers/uniform';
import { geometry, H, Pixels, W } from './pixels';
import { rollTraits, type PortraitOverrides, type PortraitTraits } from './traits';

export const PORTRAIT_W = W;
export const PORTRAIT_H = H;

/** The minimal canvas surface the generator needs, so tests can record calls. */
export interface PixelSink {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/** Pure pixel output: `W*H` hex colors, row-major. */
export function renderPortrait(
  seed: string | number,
  overrides: PortraitOverrides = {},
): { traits: PortraitTraits; pixels: Pixels } {
  const t = rollTraits(seed, overrides);
  const g = geometry(t);
  const p = new Pixels();

  drawBackground(p, t, createRng(seed).fork('background-art'));
  p.figure = true;
  drawHairBack(p, t, g);
  drawUniform(p, t, g);
  drawNeck(p, t, g);
  drawHead(p, t, g);
  if (!t.visorDown) {
    drawEyes(p, t, g);
    drawNose(p, t, g);
  }
  drawMouth(p, t, g);
  drawAge(p, t, g);
  drawFacialHair(p, t, g);
  drawHair(p, t, g);
  drawHeadgear(p, t, g);
  drawHelmetFringe(p, t, g);
  drawAntennae(p, t, g);
  drawAccessories(p, t, g);
  p.outline();
  return { traits: t, pixels: p };
}

/** Draws a 48×56 portrait at (0,0), one fillRect per horizontal color run. */
export function generatePortrait(
  ctx: PixelSink,
  seed: string | number,
  overrides: PortraitOverrides = {},
): PortraitTraits {
  const { traits, pixels } = renderPortrait(seed, overrides);
  const { w, h, data } = pixels;
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = data[y * w + x] as string;
      let end = x + 1;
      while (end < w && data[y * w + end] === c) end++;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, end - x, 1);
      x = end;
    }
  }
  return traits;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Cached 48×56 canvas for a seed + overrides pair. */
export function portraitCanvas(
  seed: string | number,
  overrides: PortraitOverrides = {},
): HTMLCanvasElement {
  const key = `${seed}|${JSON.stringify(overrides)}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (ctx) generatePortrait(ctx, seed, overrides);
    cache.set(key, c);
  }
  return c;
}
