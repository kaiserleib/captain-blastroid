import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, mulberry32, randomSeedString } from './rng';

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    const a = createRng('ABCD2345');
    const b = createRng('ABCD2345');
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('matches the siege-and-shuffle mulberry32 stream', () => {
    const ref = mulberry32(hashSeed('ABCD2345'));
    const rng = createRng('ABCD2345');
    for (let i = 0; i < 100; i++) expect(rng.next()).toBe(ref());
  });

  it('different seeds diverge', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('hashSeed is the Java-style string hash', () => {
    expect(hashSeed('')).toBe(0);
    expect(hashSeed('a')).toBe(97);
    expect(hashSeed('hello')).toBe(99162322);
  });

  it('range, int, chance and pick stay in bounds', () => {
    const rng = createRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.range(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
      const n = rng.int(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      seen.add(n);
      expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
    expect(() => rng.pick([])).toThrow();
  });

  it('fork is deterministic and independent of parent consumption', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    for (let i = 0; i < 50; i++) b.next();
    const fa = a.fork('asteroids');
    const fb = b.fork('asteroids');
    for (let i = 0; i < 100; i++) expect(fa.next()).toBe(fb.next());
    expect(a.fork('enemies').next()).not.toBe(a.fork('asteroids').next());
  });

  it('randomSeedString yields 8 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) expect(randomSeedString()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
