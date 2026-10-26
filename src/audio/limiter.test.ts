import { describe, expect, it } from 'vitest';
import { VoiceLimiter, xToPan } from './limiter';

describe('VoiceLimiter', () => {
  it('rate-limits one id to one start per 30 ms', () => {
    const l = new VoiceLimiter();
    expect(l.tryStart('a', 0, 0.01)).toBe(true);
    expect(l.tryStart('a', 0.02, 0.01)).toBe(false);
    expect(l.tryStart('a', 0.03, 0.01)).toBe(true);
  });

  it('caps concurrent instances per id at 3', () => {
    const l = new VoiceLimiter();
    expect(l.tryStart('boom', 0, 1)).toBe(true);
    expect(l.tryStart('boom', 0.1, 1)).toBe(true);
    expect(l.tryStart('boom', 0.2, 1)).toBe(true);
    expect(l.tryStart('boom', 0.3, 1)).toBe(false);
    expect(l.activeCount(0.3, 'boom')).toBe(3);
    // The first voice ends at 1.0, freeing its slot.
    expect(l.tryStart('boom', 1.0, 1)).toBe(true);
  });

  it('limits ids independently', () => {
    const l = new VoiceLimiter();
    expect(l.tryStart('a', 0, 1)).toBe(true);
    expect(l.tryStart('b', 0, 1)).toBe(true);
    expect(l.activeCount(0.5)).toBe(2);
  });

  it('enforces a global voice cap', () => {
    const l = new VoiceLimiter({ total: 2 });
    expect(l.tryStart('a', 0, 1)).toBe(true);
    expect(l.tryStart('b', 0, 1)).toBe(true);
    expect(l.tryStart('c', 0, 1)).toBe(false);
  });

  it('never builds up voices under sustained rapid fire', () => {
    const l = new VoiceLimiter();
    let started = 0;
    let peak = 0;
    // 30 s of an event every 60 Hz tick for each of four weapons.
    for (let tick = 0; tick < 30 * 60; tick++) {
      const now = tick / 60;
      for (const id of ['s1', 's2', 's3', 's4']) if (l.tryStart(id, now, 0.1)) started++;
      peak = Math.max(peak, l.activeCount(now));
    }
    expect(peak).toBeLessThanOrEqual(12);
    // Each id starts at most every 30 ms → under 34/s.
    expect(started).toBeLessThanOrEqual(4 * 30 * 34);
    expect(l.activeCount(100)).toBe(0);
  });
});

describe('xToPan', () => {
  it('maps the 240 px playfield to −1..1 and clamps', () => {
    expect(xToPan(0)).toBe(-1);
    expect(xToPan(120)).toBe(0);
    expect(xToPan(240)).toBe(1);
    expect(xToPan(-50)).toBe(-1);
    expect(xToPan(400)).toBe(1);
  });
});
