import { describe, expect, it } from 'vitest';
import { applyRadialForce, applyRadialForceTo } from './forces';
import { bulletsSystem, integrate } from './motion';
import { rebuildSpatialHash } from './spatialHash';
import { spawnAsteroid, spawnEnemy, spawnEnemyShot, spawnPlayerShot } from './spawn';
import { createWorld } from './world';

const DT = 1 / 60;

describe('integrate', () => {
  it('stores prev then moves by velocity × dt', () => {
    const w = createWorld('MOVE');
    const a = spawnAsteroid(w, { x: 10, y: 20, vx: 60, vy: -30, r: 4, hp: 1 })!;
    integrate(w.asteroids, 0.5);
    expect([a.prevX, a.prevY, a.x, a.y]).toEqual([10, 20, 40, 5]);
  });

  it('asteroids keep a constant velocity with no forces (300 ticks)', () => {
    const w = createWorld('STRAIGHT');
    const a = spawnAsteroid(w, { x: 0, y: 0, vx: 7, vy: 11, r: 4, hp: 1 })!;
    for (let i = 0; i < 300; i++) integrate(w.asteroids, DT);
    expect([a.vx, a.vy]).toEqual([7, 11]);
    expect(a.x).toBeCloseTo(35);
    expect(a.y).toBeCloseTo(55);
  });
});

describe('bullets system', () => {
  it('counts ttl down and releases expired shots', () => {
    const w = createWorld('TTL');
    const s = spawnPlayerShot(w, { x: 0, y: 0, vx: 0, vy: -100, ttl: 0.1 })!;
    const e = spawnEnemyShot(w, { x: 0, y: 0, vx: 0, vy: 100, ttl: 1 })!;
    for (let i = 0; i < 5; i++) bulletsSystem.update(w, DT);
    expect(s.active).toBe(true);
    expect(s.prevY).toBeCloseTo((-100 * 4) / 60);
    for (let i = 0; i < 2; i++) bulletsSystem.update(w, DT);
    expect(s.active).toBe(false);
    expect(e.active).toBe(true);
  });

  it('turns homing shots toward the target by at most homing × dt and sets rot', () => {
    const w = createWorld('HOME');
    const target = spawnEnemy(w, 'dummy', 100, 0)!;
    const s = spawnPlayerShot(w, {
      x: 0,
      y: 0,
      vx: 0,
      vy: -100,
      homing: Math.PI,
      targetId: target.id,
    })!;
    bulletsSystem.update(w, DT);
    const turned = Math.atan2(s.vx, -s.vy);
    expect(turned).toBeCloseTo(Math.PI / 60, 6);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(100);
    expect(s.rot).toBeCloseTo(turned);
    // Eventually it points straight at the target.
    for (let i = 0; i < 40; i++) bulletsSystem.update(w, DT);
    const toTarget = Math.atan2(target.y - s.y, target.x - s.x);
    expect(Math.atan2(s.vy, s.vx)).toBeCloseTo(toTarget, 3);
  });

  it('retargets to the nearest enemy when its target dies', () => {
    const w = createWorld('RETARGET');
    const doomed = spawnEnemy(w, 'dummy', 0, -100)!;
    const near = spawnEnemy(w, 'dummy', 50, 0)!;
    spawnEnemy(w, 'dummy', -150, 0);
    const s = spawnPlayerShot(w, { x: 0, y: 0, vx: 0, vy: -100, homing: 2, targetId: doomed.id })!;
    rebuildSpatialHash(w);
    bulletsSystem.update(w, DT);
    expect(s.targetId).toBe(doomed.id);
    w.enemies.release(doomed);
    bulletsSystem.update(w, DT);
    expect(s.targetId).toBe(near.id);
    expect(s.vx).toBeGreaterThan(0);
  });

  it('flies straight when no enemy exists; enemy homing shots chase the player', () => {
    const w = createWorld('NOTARGET');
    const s = spawnPlayerShot(w, { x: 0, y: 0, vx: 0, vy: -100, homing: 3 })!;
    const e = spawnEnemyShot(w, { x: 0, y: 0, vx: 0, vy: 100, homing: 3 })!;
    w.player.x = 100;
    w.player.y = 0;
    rebuildSpatialHash(w);
    bulletsSystem.update(w, DT);
    expect([s.vx, s.vy, s.targetId]).toEqual([0, -100, -1]);
    expect(e.vx).toBeGreaterThan(0);
  });
});

describe('forces', () => {
  it('pushes outward with positive strength and pulls with negative', () => {
    const w = createWorld('FORCE');
    const a = spawnAsteroid(w, { x: 10, y: 0, vx: 0, vy: 0, r: 4, hp: 1 })!;
    const b = spawnAsteroid(w, { x: 0, y: -20, vx: 0, vy: 0, r: 4, hp: 1 })!;
    const far = spawnAsteroid(w, { x: 100, y: 0, vx: 5, vy: 0, r: 4, hp: 1 })!;
    const center = spawnAsteroid(w, { x: 0, y: 0, vx: 0, vy: 0, r: 4, hp: 1 })!;
    expect(applyRadialForce(w.asteroids, 0, 0, 40, 100, 'linear')).toBe(2);
    expect(a.vx).toBeCloseTo(100 * (1 - 10 / 40));
    expect(a.vy).toBeCloseTo(0);
    expect(b.vy).toBeCloseTo(-100 * (1 - 20 / 40));
    expect([far.vx, far.vy, center.vx, center.vy]).toEqual([5, 0, 0, 0]);

    applyRadialForce(w.asteroids, 0, 0, 40, -100, 'linear');
    expect(a.vx).toBeCloseTo(0);
  });

  it('inverse falloff is full strength inside 8 px and ~1/d beyond; dt scales it', () => {
    const w = createWorld('INV');
    const near = spawnAsteroid(w, { x: 4, y: 0, vx: 0, vy: 0, r: 4, hp: 1 })!;
    const mid = spawnAsteroid(w, { x: 32, y: 0, vx: 0, vy: 0, r: 4, hp: 1 })!;
    applyRadialForce(w.asteroids, 0, 0, 64, -60, 'inverse', 0.5);
    expect(near.vx).toBeCloseTo(-30);
    expect(mid.vx).toBeCloseTo(-30 * (8 / 32));
  });

  it('applyRadialForceTo works on a single body such as the player', () => {
    const w = createWorld('ONE');
    w.player.x = 0;
    w.player.y = 30;
    expect(applyRadialForceTo(w.player, 0, 0, 60, -20, 'linear')).toBe(true);
    expect(w.player.vy).toBeCloseTo(-10);
    expect(applyRadialForceTo(w.player, 0, 0, 10, -20, 'linear')).toBe(false);
  });

  it('a pushed asteroid keeps its new velocity and flies straight', () => {
    const w = createWorld('KEEP');
    const a = spawnAsteroid(w, { x: 0, y: 10, vx: 0, vy: 30, r: 4, hp: 1 })!;
    applyRadialForce(w.asteroids, 0, 0, 48, 120, 'linear');
    const vx = a.vx;
    const vy = a.vy;
    for (let i = 0; i < 120; i++) integrate(w.asteroids, DT);
    expect([a.vx, a.vy]).toEqual([vx, vy]);
  });
});
