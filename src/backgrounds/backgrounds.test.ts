import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng';
import { createWorld } from '../sim/world';
import { Background, layerSeed, STRIP_H, STRIP_W, stripOffset } from './background';
import { isQuantized, q5, rgbValue } from './color';
import { createBackgroundPair } from './index';
import { generateNebula } from './nebula';
import { bayer4, ditherLevel, verticalTilingNoise } from './noise';
import { generateSetPiece } from './setpieces';
import { generateStars, generateStreaks, starPalette, TWINKLE_PHASES } from './starfield';
import { MAX_FILL_VALUE, MAX_POINT_VALUE, THEME_IDS, THEMES, themeForLevel } from './themes';

describe('color', () => {
  it('quantizes to multiples of 8 in 0..248', () => {
    expect(q5(255)).toBe(248);
    expect(q5(3)).toBe(0);
    expect(q5(13)).toBe(16);
  });
});

describe('noise', () => {
  it('bayer thresholds are 16 distinct values in (0,1)', () => {
    const s = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s.add(bayer4(x, y));
    expect(s.size).toBe(16);
    for (const v of s) expect(v > 0 && v < 1).toBe(true);
  });

  it('dither hits the extremes and averages to the input', () => {
    expect(ditherLevel(0, 3, 1, 2)).toBe(0);
    expect(ditherLevel(1, 3, 1, 2)).toBe(3);
    let sum = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += ditherLevel(0.5, 3, x, y);
    expect(sum / 16).toBeCloseTo(1.5, 1);
  });

  it('tiles vertically', () => {
    const n = verticalTilingNoise(createRng(1), 32, 240, STRIP_H);
    for (let x = 0; x < 240; x += 7) expect(n.sample(x, STRIP_H)).toBeCloseTo(n.sample(x, 0), 6);
  });
});

describe('layers', () => {
  const t = THEMES.kessler;

  it('same seed gives the same pixels; a different seed differs', () => {
    const a = generateNebula(5, STRIP_W, STRIP_H, t.nebula).data;
    const b = generateNebula(5, STRIP_W, STRIP_H, t.nebula).data;
    const c = generateNebula(6, STRIP_W, STRIP_H, t.nebula).data;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(generateStars(9, 240, 640, t.stars).data).toEqual(
      generateStars(9, 240, 640, t.stars).data,
    );
    expect(generateStreaks(9, 240, 640, t.streaks).data).toEqual(
      generateStreaks(9, 240, 640, t.streaks).data,
    );
    for (const sp of t.setPieces) {
      expect(generateSetPiece(3, sp).data).toEqual(generateSetPiece(3, sp).data);
    }
  });

  it('nebula has clouds and clear sky, and its strip wraps without a seam', () => {
    const neb = generateNebula(layerSeed('ABC', 'kessler', 'nebula'), STRIP_W, STRIP_H, t.nebula);
    let filled = 0;
    for (const v of neb.data) if (v) filled++;
    const share = filled / neb.data.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.8);
    // Top and bottom rows should be about as similar as any two adjacent rows.
    const rowDiff = (y0: number, y1: number): number => {
      let d = 0;
      for (let x = 0; x < STRIP_W; x++) {
        const a = neb.data[y0 * STRIP_W + x] as number;
        const b = neb.data[y1 * STRIP_W + x] as number;
        d += Math.abs(a - b);
      }
      return d;
    };
    let typical = 0;
    for (let y = 0; y < STRIP_H - 1; y++) typical += rowDiff(y, y + 1);
    typical /= STRIP_H - 1;
    expect(rowDiff(STRIP_H - 1, 0)).toBeLessThan(typical * 3 + 10);
  });

  it('palette cycle produces distinct twinkle phases', () => {
    const seen = new Set<string>();
    for (let p = 0; p < TWINKLE_PHASES; p++) seen.add(JSON.stringify(starPalette(t.stars, p)));
    expect(seen.size).toBe(TWINKLE_PHASES);
  });

  it('layer seeds depend on seed, theme and layer', () => {
    expect(layerSeed('A', 'ion', 'stars')).toBe(layerSeed('A', 'ion', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('B', 'ion', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('A', 'pulsar', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('A', 'ion', 'nebula'));
  });
});

describe('themes', () => {
  it.each(THEME_IDS)('%s is 15-bit and dark enough', (id) => {
    const th = THEMES[id];
    const fills = [th.base, ...th.nebula.colors, ...th.setPieces.flatMap((s) => s.colors)];
    for (const c of fills) {
      expect(isQuantized(c)).toBe(true);
      expect(rgbValue(c)).toBeLessThanOrEqual(MAX_FILL_VALUE);
    }
    for (const c of [...th.stars.colors, th.streaks.head, th.streaks.tail]) {
      expect(isQuantized(c)).toBe(true);
      expect(rgbValue(c)).toBeLessThanOrEqual(MAX_POINT_VALUE);
    }
    expect(th.id).toBe(id);
    expect(STRIP_H % th.nebula.patch).toBe(0);
  });

  it('maps level ids to themes', () => {
    expect(themeForLevel('kessler')).toBe('kessler');
    expect(themeForLevel('pulsar')).toBe('pulsar');
    expect(themeForLevel('unknown-level')).toBe('kessler');
  });
});

describe('scroll', () => {
  it('strip offsets are whole pixels in [0, STRIP_H)', () => {
    expect(stripOffset(0)).toBe(0);
    expect(stripOffset(12.9)).toBe(12);
    expect(stripOffset(STRIP_H + 3.5)).toBe(3);
    expect(stripOffset(-1.5)).toBe(STRIP_H - 2);
  });

  it('the background system advances world.scrollY once per tick', () => {
    const w = createWorld('S');
    w.scrollSpeed = 30;
    const { system } = createBackgroundPair(new Background('kessler', 'S'));
    system.update(w, 0.5);
    system.update(w, 0.5);
    expect(w.scrollY).toBeCloseTo(30);
  });
});
