import { describe, expect, it } from 'vitest';
import { isSnesColor, mix, OUTLINE, RAMPS, snes } from './palette';

describe('snes()', () => {
  it('rounds each channel to the nearest multiple of 8', () => {
    expect(snes('#2243a3')).toBe('#2040a0');
    expect(snes('#050b0c')).toBe('#080810');
    expect(snes(34, 67, 163)).toBe('#2040a0');
  });

  it('clamps to the 0..248 range', () => {
    expect(snes('#ffffff')).toBe('#f8f8f8');
    expect(snes(-10, 300, 252)).toBe('#00f8f8');
  });

  it('is idempotent and accepts hex without #', () => {
    expect(snes(snes('#123456'))).toBe(snes('#123456'));
    expect(snes('abcdef')).toBe(snes('#abcdef'));
  });

  it('rejects malformed colors', () => {
    expect(() => snes('#fff')).toThrow(/bad color/);
  });
});

describe('palette', () => {
  it('every exported ramp color is 15-bit quantized', () => {
    let n = 0;
    for (const [name, ramp] of Object.entries(RAMPS)) {
      for (const [key, color] of Object.entries(ramp)) {
        expect(isSnesColor(color), `${name}.${key} = ${color}`).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it('outline is dark but not pure black', () => {
    expect(OUTLINE).not.toBe('#000000');
    expect(isSnesColor(OUTLINE)).toBe(true);
  });

  it('mix() stays quantized', () => {
    for (let t = 0; t <= 1; t += 0.1) expect(isSnesColor(mix('#102030', '#f0e0d0', t))).toBe(true);
  });

  it('isSnesColor rejects off-grid channels', () => {
    expect(isSnesColor('#f8f8f8')).toBe(true);
    expect(isSnesColor('#f8f8f9')).toBe(false);
    expect(isSnesColor('#F8F8F8')).toBe(false);
  });
});
