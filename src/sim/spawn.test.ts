import { describe, expect, it } from 'vitest';
import {
  FALLBACK_ENEMY_DEF,
  NO_HIT,
  getEnemyDef,
  registerEnemyDefs,
  spawnAnomaly,
  spawnAsteroid,
  spawnEnemy,
  spawnEnemyShot,
  spawnPickup,
  spawnPlayerShot,
  velocityRot,
} from './spawn';
import {
  createAnomaly,
  createAsteroid,
  createBullet,
  createEnemy,
  createPickup,
  createWorld,
} from './world';

/** Sets every field of a pooled object to junk, mimicking a stale slot. */
function dirty(obj: object): void {
  const o = obj as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (k === 'active') continue;
    if (typeof v === 'number') o[k] = 999;
    else if (typeof v === 'boolean') o[k] = !v;
    else if (typeof v === 'string' || v === null) o[k] = 'stale';
    else if (Array.isArray(v)) v.push(424242);
  }
}

describe('spawn helpers reset every field of a recycled slot', () => {
  it('player and enemy shots', () => {
    const w = createWorld('SPAWN', { capacities: { playerShots: 1, enemyShots: 1 } });
    for (const [pool, spawn, owner] of [
      [w.playerShots, spawnPlayerShot, 'player'],
      [w.enemyShots, spawnEnemyShot, 'enemy'],
    ] as const) {
      const first = spawn(w, { x: 1, y: 1, vx: 0, vy: 0 })!;
      dirty(first);
      pool.release(first);
      pool.compact();
      const b = spawn(w, { x: 10, y: 20, vx: 0, vy: 50 })!;
      expect(b).toBe(first);
      expect(b.id).toBeGreaterThan(0);
      expect({ ...b, id: 0, hitIds: [...b.hitIds] }).toEqual({
        ...createBullet(),
        active: true,
        id: 0,
        x: 10,
        y: 20,
        prevX: 10,
        prevY: 20,
        vy: 50,
        r: 2,
        owner,
        damage: 1,
        ttl: 4,
        rot: Math.PI,
        hitIds: [NO_HIT],
      });
    }
  });

  it('enemies read the def, then overrides', () => {
    const w = createWorld('SPAWN', { capacities: { enemies: 1 } });
    const first = spawnEnemy(w, 'dummy', 0, 0)!;
    dirty(first);
    w.enemies.release(first);
    w.enemies.compact();
    const e = spawnEnemy(w, 'dummy', 30, 40)!;
    expect(e).toBe(first);
    expect({ ...e, id: 0 }).toEqual({
      ...createEnemy(),
      active: true,
      id: 0,
      x: 30,
      y: 40,
      prevX: 30,
      prevY: 40,
      r: FALLBACK_ENEMY_DEF.r,
      hp: FALLBACK_ENEMY_DEF.hp,
      maxHp: FALLBACK_ENEMY_DEF.hp,
      defId: 'dummy',
      contactDamage: 1,
    });
    w.enemies.release(e);
    w.enemies.compact();
    const o = spawnEnemy(w, 'dummy', 0, 0, { hp: 9, vx: 3, formationId: 4, isBoss: true })!;
    expect([o.hp, o.maxHp, o.vx, o.formationId, o.isBoss]).toEqual([9, 9, 3, 4, true]);
  });

  it('asteroids, anomalies and pickups', () => {
    const w = createWorld('SPAWN', { capacities: { asteroids: 1, anomalies: 1, pickups: 1 } });
    const a0 = spawnAsteroid(w, { x: 0, y: 0, vx: 0, vy: 0, r: 1, hp: 1 })!;
    const n0 = spawnAnomaly(w, { kind: 'pulsar', x: 0, y: 0, r: 1, radius: 1, strength: 1 })!;
    const p0 = spawnPickup(w, { kind: 'shield', x: 0, y: 0 })!;
    for (const [o, pool] of [
      [a0, w.asteroids],
      [n0, w.anomalies],
      [p0, w.pickups],
    ] as const) {
      dirty(o);
      (pool as { release(x: object): void; compact(): void }).release(o);
      pool.compact();
    }
    const a = spawnAsteroid(w, { x: 5, y: 6, vx: 1, vy: 2, r: 7, hp: 3 })!;
    expect({ ...a, id: 0 }).toEqual({
      ...createAsteroid(),
      active: true,
      id: 0,
      x: 5,
      y: 6,
      prevX: 5,
      prevY: 6,
      vx: 1,
      vy: 2,
      r: 7,
      hp: 3,
      maxHp: 3,
    });
    const n = spawnAnomaly(w, { kind: 'blackhole', x: 5, y: 6, r: 8, radius: 50, strength: 9 })!;
    expect({ ...n, id: 0 }).toEqual({
      ...createAnomaly(),
      active: true,
      id: 0,
      x: 5,
      y: 6,
      prevX: 5,
      prevY: 6,
      r: 8,
      radius: 50,
      strength: 9,
    });
    const p = spawnPickup(w, { kind: 'salvage', x: 5, y: 6, amount: 5 })!;
    expect({ ...p, id: 0 }).toEqual({
      ...createPickup(),
      active: true,
      id: 0,
      x: 5,
      y: 6,
      prevX: 5,
      prevY: 6,
      r: 6,
      amount: 5,
      ttl: 10,
    });
  });

  it('assigns unique ids and returns null (counting drops) when a pool is full', () => {
    const w = createWorld('IDS', { capacities: { enemies: 2 } });
    const a = spawnEnemy(w, 'dummy', 0, 0)!;
    const b = spawnEnemy(w, 'dummy', 0, 0)!;
    expect(a.id).not.toBe(b.id);
    expect(spawnEnemy(w, 'dummy', 0, 0)).toBeNull();
    expect(w.enemies.droppedSpawns).toBe(1);
  });
});

describe('enemy def registry', () => {
  it('resolves registered defs and fails loudly on unknown ids', () => {
    registerEnemyDefs({ testGnat: { hp: 4, r: 5, score: 50, avoidsAsteroids: true } });
    const w = createWorld('DEFS');
    const e = spawnEnemy(w, 'testGnat', 0, 0)!;
    expect([e.hp, e.r, e.avoidsAsteroids]).toEqual([4, 5, true]);
    expect(getEnemyDef('testGnat').score).toBe(50);
    expect(() => spawnEnemy(w, 'nope', 0, 0)).toThrow(/Unknown enemy id "nope"/);
  });
});

describe('velocityRot', () => {
  it('is 0 pointing up, clockwise positive', () => {
    expect(velocityRot(0, -1)).toBeCloseTo(0);
    expect(velocityRot(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(velocityRot(0, 1))).toBeCloseTo(Math.PI);
  });
});
