import { describe, expect, it } from 'vitest';
import { likelyHasKeyboard, openExternal } from './external';

const media = (coarse: boolean) => ({
  matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' && coarse }),
});

describe('likelyHasKeyboard', () => {
  it('is false in the apps and on touch-first browsers', () => {
    expect(likelyHasKeyboard(true, media(false))).toBe(false);
    expect(likelyHasKeyboard(false, media(true))).toBe(false);
  });

  it('is true on a desktop browser, and where it cannot tell', () => {
    expect(likelyHasKeyboard(false, media(false))).toBe(true);
    expect(likelyHasKeyboard(false, {})).toBe(true);
  });
});

describe('openExternal', () => {
  it('opens a new browsing context and survives a refusal', () => {
    const calls: string[][] = [];
    openExternal('https://example.test/p', {
      open: (u: string, t: string, f: string) => calls.push([u, t, f]),
    });
    expect(calls).toEqual([['https://example.test/p', '_blank', 'noopener']]);
    expect(() =>
      openExternal('https://example.test/p', {
        open: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });
});
