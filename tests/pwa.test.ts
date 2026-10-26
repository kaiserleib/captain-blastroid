import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { kestrelPixels, renderIcon } from '../tools/pwa/icons';
import { encodePng, pngSize } from '../tools/pwa/png';

const alphaAt = (img: { w: number; data: Uint8ClampedArray }, x: number, y: number): number =>
  img.data[(y * img.w + x) * 4 + 3] ?? -1;

describe('PWA icons', () => {
  it('outlines the Kestrel by one pixel per side', () => {
    const k = kestrelPixels();
    expect(k.w).toBe(26);
    expect(alphaAt(k, 0, 0)).toBe(0);
  });

  it('square and maskable icons are fully opaque (iOS shows alpha as black)', () => {
    for (const style of ['square', 'maskable'] as const) {
      const img = renderIcon(64, 64, style);
      for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
    }
  });

  it('round icons are transparent outside the circle; foregrounds keep a clear background', () => {
    const round = renderIcon(96, 96, 'round');
    expect(alphaAt(round, 0, 0)).toBe(0);
    expect(alphaAt(round, 48, 48)).toBe(255);
    const fg = renderIcon(108, 108, 'foreground');
    expect(alphaAt(fg, 2, 2)).toBe(0);
  });

  it('splash screens may be rectangular and keep the ship centered', () => {
    const img = renderIcon(480, 800, 'splash');
    expect(img.w).toBe(480);
    expect(img.h).toBe(800);
    expect(alphaAt(img, 0, 0)).toBe(255);
  });

  it('encodes a valid, deterministic PNG', () => {
    const img = renderIcon(48, 48, 'square');
    const a = encodePng(img);
    expect(a.equals(encodePng(img))).toBe(true);
    expect(pngSize(a)).toEqual({ w: 48, h: 48 });
    // IDAT holds filter byte + RGBA rows.
    const len = a.readUInt32BE(33);
    expect(a.toString('ascii', 37, 41)).toBe('IDAT');
    const raw = inflateSync(a.subarray(41, 41 + len));
    expect(raw.length).toBe((48 * 4 + 1) * 48);
    expect([...raw.subarray(1, 5)]).toEqual([...img.data.subarray(0, 4)]);
  });
});
