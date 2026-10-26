import { describe, expect, it } from 'vitest';
import { computeLayout, cssToLogical, MAX_LOGICAL_H, PLAYFIELD_H } from './display';

describe('computeLayout', () => {
  it('desktop landscape: 400 tall, fractional fill of the height, centered', () => {
    const l = computeLayout(1920, 1080, 1);
    expect(l.logicalH).toBe(400);
    expect(l.playfieldOffsetY).toBe(0);
    expect(l.integerScale).toBe(false);
    expect(l.scale).toBeCloseTo(2.7);
    expect([l.destX, l.destY, l.destW, l.destH]).toEqual([636, 0, 648, 1080]);
  });

  it('uses an integer scale when it fills at least 85% of the fractional fit', () => {
    const l = computeLayout(480, 880, 2);
    expect(l.integerScale).toBe(true);
    expect(l.scale).toBe(4);
    expect(l.logicalH).toBe(440);
    expect(l.playfieldOffsetY).toBe(20);
    expect([l.destW, l.destH, l.canvasW, l.canvasH]).toEqual([960, 1760, 960, 1760]);
  });

  it('pins the logical height with forceLogicalH (dev ?h=), clamped', () => {
    const l = computeLayout(1920, 1080, 1, undefined, 520);
    expect(l.logicalH).toBe(520);
    expect(l.playfieldOffsetY).toBe(60);
    expect(l.destH).toBeLessThanOrEqual(1080);
    expect(computeLayout(500, 1000, 1, undefined, 440).logicalH).toBe(440);
    expect(computeLayout(500, 1000, 1, undefined, 900).logicalH).toBe(MAX_LOGICAL_H);
  });

  it('records the safe-area insets it was given', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 0 };
    expect(computeLayout(390, 844, 3, insets).insets).toEqual(insets);
  });

  it('gives the vertical room an integer scale leaves to the HUD bands', () => {
    const l = computeLayout(500, 1000, 1);
    expect(l.scale).toBe(2);
    expect(l.logicalH).toBe(500);
    expect(l.playfieldOffsetY).toBe(50);
    expect(l.destH).toBe(1000);
  });

  it('tall phone with notch insets: HUD bands, fractional scale, inside the safe area', () => {
    const l = computeLayout(390, 844, 3, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(l.logicalH).toBe(470);
    expect(l.playfieldOffsetY).toBe(35);
    expect(l.integerScale).toBe(false);
    expect(l.destY).toBeGreaterThanOrEqual(47 * 3);
    expect(l.destY + l.destH).toBeLessThanOrEqual((844 - 34) * 3);
    expect(l.destW).toBeGreaterThanOrEqual(1168);
  });

  it('clamps very tall screens to 520 and letterboxes vertically', () => {
    const l = computeLayout(300, 900, 1);
    expect(l.logicalH).toBe(MAX_LOGICAL_H);
    expect(l.destW).toBe(300);
    expect(l.destY).toBeGreaterThan(0);
  });

  it('holds its invariants across many viewports', () => {
    for (let w = 200; w <= 2600; w += 37) {
      for (let h = 200; h <= 2000; h += 41) {
        for (const dpr of [1, 1.5, 2, 3]) {
          const l = computeLayout(w, h, dpr);
          expect(l.logicalH).toBeGreaterThanOrEqual(PLAYFIELD_H);
          expect(l.logicalH).toBeLessThanOrEqual(MAX_LOGICAL_H);
          expect(l.playfieldOffsetY).toBeGreaterThanOrEqual(0);
          expect(l.playfieldOffsetY * 2).toBeLessThanOrEqual(l.logicalH - PLAYFIELD_H);
          expect(l.destX).toBeGreaterThanOrEqual(0);
          expect(l.destY).toBeGreaterThanOrEqual(0);
          expect(l.destX + l.destW).toBeLessThanOrEqual(l.canvasW + 1);
          expect(l.destY + l.destH).toBeLessThanOrEqual(l.canvasH + 1);
          if (l.integerScale) expect(Number.isInteger(l.scale)).toBe(true);
        }
      }
    }
  });
});

describe('cssToLogical', () => {
  it('maps the dest rect corners and center onto the logical buffer', () => {
    const l = computeLayout(1920, 1080, 1);
    expect(cssToLogical(l, 636, 0)).toEqual({ x: 0, y: 0 });
    const c = cssToLogical(l, 960, 540);
    expect(c.x).toBeCloseTo(120);
    expect(c.y).toBeCloseTo(200);
  });

  it('accounts for device pixel ratio and writes into out', () => {
    const l = computeLayout(480, 880, 2);
    const out = { x: -1, y: -1 };
    expect(cssToLogical(l, 240, 440, out)).toBe(out);
    expect(out).toEqual({ x: 120, y: 220 });
  });
});
