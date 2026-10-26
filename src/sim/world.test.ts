import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAPACITIES, createWorld } from './world';
import { PICKUP_KINDS } from './types';
import {
  clearHooks,
  getAnomalyContact,
  getBossDamageHooks,
  getShotBlockers,
  registerAnomalyContact,
  registerBossDamage,
  registerShotBlocker,
} from './hooks';

describe('createWorld', () => {
  it('builds a 240x400 world with sized, empty pools', () => {
    const w = createWorld('TESTSEED');
    expect(w.width).toBe(240);
    expect(w.height).toBe(400);
    expect(w.playerShots.capacity).toBe(DEFAULT_CAPACITIES.playerShots);
    expect(w.enemyShots.capacity).toBe(600);
    expect(w.enemies.capacity).toBe(80);
    expect(w.asteroids.capacity).toBe(120);
    expect(w.anomalies.capacity).toBe(8);
    expect(w.pickups.capacity).toBe(120);
    for (const pool of [w.playerShots, w.enemies, w.pickups]) expect(pool.count).toBe(0);
    expect(w.player.alive).toBe(true);
    expect(w.input).toEqual({ x: 0, y: 0, targetX: null, targetY: null });
  });

  it('seeds the rng deterministically and records the run', () => {
    const a = createWorld('SAME', { shipId: 'dart', capacities: { enemies: 4 } });
    const b = createWorld('SAME');
    expect(a.rng.next()).toBe(b.rng.next());
    expect(a.run.seed).toBe('SAME');
    expect(a.run.shipId).toBe('dart');
    expect(a.enemies.capacity).toBe(4);
    expect(a.run.chain).toBe(1);
    for (const k of PICKUP_KINDS) expect(a.run.pickupsCollected[k]).toBe(0);
  });

  it('hands out unique increasing ids', () => {
    const w = createWorld('IDS');
    const a = w.nextId();
    const b = w.nextId();
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a + 1);
  });

  it('pooled entities spawn and carry events', () => {
    const w = createWorld('EV');
    const e = w.enemies.spawn();
    expect(e?.formationId).toBe(-1);
    const fn = vi.fn();
    w.events.on('enemyKilled', fn);
    w.events.emit('enemyKilled', { enemy: e!, byPlayer: true });
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('hooks', () => {
  it('register, look up and unregister', () => {
    clearHooks();
    const blocker = () => true;
    const off = registerShotBlocker(blocker);
    registerBossDamage(() => false);
    const contact = vi.fn();
    registerAnomalyContact('blackhole', contact);
    expect(getShotBlockers()).toEqual([blocker]);
    expect(getBossDamageHooks()).toHaveLength(1);
    expect(getAnomalyContact('blackhole')).toBe(contact);
    expect(getAnomalyContact('pulsar')).toBeUndefined();
    off();
    expect(getShotBlockers()).toHaveLength(0);
    clearHooks();
    expect(getAnomalyContact('blackhole')).toBeUndefined();
    expect(getBossDamageHooks()).toHaveLength(0);
  });
});
