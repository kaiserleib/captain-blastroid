import { describe, expect, it } from 'vitest';
import { cleanup, isOffscreen } from './cleanup';
import { spawnAnomaly, spawnAsteroid, spawnEnemy, spawnEnemyShot, spawnPickup } from './spawn';
import { createWorld } from './world';

describe('cleanup', () => {
  it('culls past the bottom and sides by 16 + r', () => {
    const w = createWorld('CULL');
    const r = 6;
    const keep = [
      spawnAsteroid(w, { x: 120, y: 400 + 16 + r, vx: 0, vy: 0, r, hp: 1 })!,
      spawnAsteroid(w, { x: -16 - r, y: 100, vx: 0, vy: 0, r, hp: 1 })!,
      spawnAsteroid(w, { x: 240 + 16 + r, y: 100, vx: 0, vy: 0, r, hp: 1 })!,
    ];
    const cull = [
      spawnAsteroid(w, { x: 120, y: 400 + 16 + r + 0.1, vx: 0, vy: 0, r, hp: 1 })!,
      spawnAsteroid(w, { x: -16 - r - 0.1, y: 100, vx: 0, vy: 0, r, hp: 1 })!,
      spawnAsteroid(w, { x: 240 + 16 + r + 0.1, y: 100, vx: 0, vy: 0, r, hp: 1 })!,
    ];
    cleanup(w, 1 / 60);
    expect(keep.map((a) => a.active)).toEqual([true, true, true]);
    expect(cull.map((a) => a.active)).toEqual([false, false, false]);
    expect(w.asteroids.count).toBe(3);
  });

  it('culls above y = -64 only when moving up', () => {
    const w = createWorld('TOP');
    const entering = spawnEnemyShot(w, { x: 120, y: -200, vx: 0, vy: 50 })!;
    const parked = spawnEnemyShot(w, { x: 120, y: -200, vx: 0, vy: 0 })!;
    const leaving = spawnEnemyShot(w, { x: 120, y: -65, vx: 0, vy: -50 })!;
    const nearTop = spawnEnemyShot(w, { x: 120, y: -63, vx: 0, vy: -50 })!;
    cleanup(w, 1 / 60);
    expect([entering.active, parked.active, leaving.active, nearTop.active]).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });

  it('covers every pool, spares bosses, compacts, and decays flash', () => {
    const w = createWorld('ALL');
    spawnPickup(w, { kind: 'salvage', x: 120, y: 900 });
    spawnAnomaly(w, { kind: 'pulsar', x: 900, y: 100, r: 8, radius: 40, strength: 1 });
    const boss = spawnEnemy(w, 'dummy', 120, 900, { isBoss: true })!;
    const e = spawnEnemy(w, 'dummy', 120, 900)!;
    const live = spawnEnemy(w, 'dummy', 120, 100)!;
    live.flashT = 0.05;
    cleanup(w, 0.02);
    expect([w.pickups.count, w.anomalies.count, w.enemies.count]).toEqual([0, 0, 2]);
    expect(boss.active).toBe(true);
    expect(e.active).toBe(false);
    expect(live.flashT).toBeCloseTo(0.03);
    cleanup(w, 0.1);
    expect(live.flashT).toBe(0);
  });

  it('isOffscreen matches the rule for a single body', () => {
    const w = createWorld('ONE');
    const a = spawnAsteroid(w, { x: 120, y: 500, vx: 0, vy: 0, r: 4, hp: 1 })!;
    expect(isOffscreen(a)).toBe(true);
    a.y = 200;
    expect(isOffscreen(a)).toBe(false);
  });
});
