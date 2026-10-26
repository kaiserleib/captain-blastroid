import { describe, expect, it } from 'vitest';
import { parseFlags } from './flags';

describe('parseFlags', () => {
  it('parses every flag in dev', () => {
    const f = parseFlags(
      '?debug&god&sandbox&seed=ABCD2345&level=1&t=120&h=520&save=mid&mute',
      true,
    );
    expect(f).toEqual({
      debug: true,
      god: true,
      sandbox: true,
      seed: 'ABCD2345',
      level: 1,
      t: 120,
      h: 520,
      save: 'mid',
      mute: true,
    });
    expect(Object.isFrozen(f)).toBe(true);
  });

  it('defaults to off and ignores bad numbers', () => {
    expect(parseFlags('?level=abc&t=', true)).toEqual({
      debug: false,
      god: false,
      sandbox: false,
      seed: null,
      level: null,
      t: null,
      h: null,
      save: null,
      mute: false,
    });
  });

  it('only honours the seed in production builds', () => {
    const f = parseFlags('?debug&god&seed=XY&level=2', false);
    expect(f.debug || f.god || f.level !== null).toBe(false);
    expect(f.seed).toBe('XY');
    expect(parseFlags('?save=all&mute', false).save).toBeNull();
  });

  it('rejects unknown crafted saves', () => {
    expect(parseFlags('?save=bogus', true).save).toBeNull();
  });
});
