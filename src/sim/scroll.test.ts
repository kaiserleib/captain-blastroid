import { describe, expect, it } from 'vitest';
import { isPinned, pinAnomaly, setScrollSpeed } from './scroll';
import { spawnAnomaly, spawnAsteroid } from './spawn';
import { createWorld } from './world';

const anomaly = {
  kind: 'blackhole' as const,
  x: 0,
  y: 0,
  r: 8,
  radius: 100,
  strength: 1,
  vx: 0,
  vy: 30,
};

describe('setScrollSpeed', () => {
  it('shifts rocks and unpinned anomalies by the delta, skips pinned ones', () => {
    const w = createWorld('scroll');
    w.scrollSpeed = 30;
    const rock = spawnAsteroid(w, { x: 10, y: 10, vx: 3, vy: 45, r: 4, hp: 1 })!;
    const free = spawnAnomaly(w, anomaly)!;
    const held = spawnAnomaly(w, { ...anomaly, vy: 0 })!;
    pinAnomaly(held);
    setScrollSpeed(w, 70);
    expect(w.scrollSpeed).toBe(70);
    expect(rock.vy).toBe(85);
    expect(rock.vx).toBe(3);
    expect(free.vy).toBe(70);
    expect(held.vy).toBe(0);
    setScrollSpeed(w, 18);
    expect(rock.vy).toBe(33);
    expect(free.vy).toBe(18);
  });

  it('a recycled pool slot is not pinned any more', () => {
    const w = createWorld('pin');
    const a = spawnAnomaly(w, anomaly)!;
    pinAnomaly(a);
    expect(isPinned(a)).toBe(true);
    w.anomalies.release(a);
    expect(isPinned(a)).toBe(false);
    w.anomalies.compact();
    // Same object, new entity.
    const b = spawnAnomaly(w, anomaly)!;
    expect(b).toBe(a);
    expect(isPinned(b)).toBe(false);
  });
});
