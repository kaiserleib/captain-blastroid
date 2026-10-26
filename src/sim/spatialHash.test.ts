import { describe, expect, it } from 'vitest';
import { getSpatialHash, rebuildSpatialHash } from './spatialHash';
import { spawnAnomaly, spawnAsteroid, spawnEnemy, spawnPickup } from './spawn';
import { Layer, type Body } from './types';
import { createWorld, type World } from './world';

function populate(seed: string): World {
  const w = createWorld(seed);
  const rng = w.rng;
  for (let i = 0; i < 60; i++) {
    // Includes off-grid positions to exercise edge-cell clamping.
    spawnEnemy(w, 'dummy', rng.range(-200, 440), rng.range(-300, 700), { r: rng.range(2, 40) });
  }
  for (let i = 0; i < 80; i++) {
    spawnAsteroid(w, {
      x: rng.range(0, 240),
      y: rng.range(-60, 400),
      vx: 0,
      vy: 0,
      r: rng.range(3, 16),
      hp: 1,
    });
  }
  for (let i = 0; i < 4; i++) {
    spawnAnomaly(w, {
      kind: 'blackhole',
      x: rng.range(0, 240),
      y: rng.range(0, 400),
      r: 8,
      radius: 50,
      strength: 1,
    });
  }
  for (let i = 0; i < 30; i++) {
    spawnPickup(w, { kind: 'salvage', x: rng.range(0, 240), y: rng.range(0, 400) });
  }
  return w;
}

function all(w: World): { b: Body; layer: number }[] {
  const out: { b: Body; layer: number }[] = [];
  w.enemies.each((b) => out.push({ b, layer: Layer.Enemy }));
  w.asteroids.each((b) => out.push({ b, layer: Layer.Asteroid }));
  w.anomalies.each((b) => out.push({ b, layer: Layer.Anomaly }));
  w.pickups.each((b) => out.push({ b, layer: Layer.Pickup }));
  return out;
}

describe('spatialHash', () => {
  it('query matches brute force for random circles and masks', () => {
    const w = populate('HASH');
    const h = rebuildSpatialHash(w);
    const bodies = all(w);
    const rng = w.rng;
    const masks = [Layer.Enemy, Layer.Asteroid | Layer.Anomaly, Layer.Pickup, 0xff];
    for (let q = 0; q < 300; q++) {
      const x = rng.range(-150, 400);
      const y = rng.range(-250, 650);
      const r = rng.range(0, 30);
      const mask = masks[q % masks.length]!;
      const got = new Set<Body>();
      h.query(x, y, r, mask, (b, layer) => {
        expect(layer & mask).toBeTruthy();
        expect(got.has(b)).toBe(false);
        got.add(b);
      });
      const want = bodies.filter(
        ({ b, layer }) => layer & mask && Math.hypot(b.x - x, b.y - y) < r + b.r,
      );
      expect(got.size).toBe(want.length);
      for (const { b } of want) expect(got.has(b)).toBe(true);
    }
  });

  it('queryInto fills a scratch array; returning true stops a query', () => {
    const w = populate('INTO');
    const h = rebuildSpatialHash(w);
    const out: Body[] = [];
    const n = h.queryInto(120, 200, 400, 0xff, out);
    expect(n).toBe(all(w).filter(({ b }) => Math.hypot(b.x - 120, b.y - 200) < 400 + b.r).length);
    let visits = 0;
    const stopped = h.query(120, 200, 400, 0xff, () => {
      visits++;
      return true;
    });
    expect(stopped).toBe(true);
    expect(visits).toBe(1);
  });

  it('skips released bodies without a rebuild', () => {
    const w = createWorld('REL');
    const e = spawnEnemy(w, 'dummy', 50, 50)!;
    const h = rebuildSpatialHash(w);
    w.enemies.release(e);
    expect(h.queryInto(50, 50, 5, Layer.Enemy, [])).toBe(0);
    expect(h.nearest(50, 50, Layer.Enemy)).toBeNull();
  });

  it('nearest matches brute force, honoring mask, maxDist and filter', () => {
    const w = populate('NEAR');
    const h = rebuildSpatialHash(w);
    const bodies = all(w);
    const rng = w.rng;
    const evenId = (b: Body) => b.id % 2 === 0;
    for (let q = 0; q < 300; q++) {
      const x = rng.range(-150, 400);
      const y = rng.range(-250, 650);
      const mask = q % 2 ? Layer.Enemy : Layer.Asteroid | Layer.Pickup;
      const maxDist = q % 3 === 0 ? 60 : Infinity;
      const filter = q % 5 === 0 ? evenId : null;
      let best: Body | null = null;
      let bd = maxDist;
      for (const { b, layer } of bodies) {
        if (!(layer & mask) || (filter && !filter(b))) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      expect(h.nearest(x, y, mask, maxDist, filter)).toBe(best);
    }
  });

  it('is one instance per world, rebuilt in place', () => {
    const w = createWorld('ONE');
    expect(getSpatialHash(w)).toBe(rebuildSpatialHash(w));
    expect(getSpatialHash(createWorld('TWO'))).not.toBe(getSpatialHash(w));
    spawnEnemy(w, 'dummy', 1, 1);
    expect(rebuildSpatialHash(w).size).toBe(1);
  });
});
