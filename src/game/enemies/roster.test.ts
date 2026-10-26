import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyDef } from '../../content/enemies';
import { spawnEnemy } from '../../sim/spawn';
import type { Bullet, Enemy } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import {
  aimed,
  enemyDef,
  fireAt,
  registerBehavior,
  registerRoster,
  rosterDef,
  scaleHp,
  setEnemyHpMul,
  setEnemyShotSpeedMul,
  shootDir,
  updateEnemies,
} from './index';

const DT = 1 / 60;

function world(seed = 'T21'): World {
  const w = createWorld(seed);
  w.player.x = 120;
  w.player.y = 340;
  return w;
}

function shots(w: World): Bullet[] {
  return w.enemyShots.items.slice(0, w.enemyShots.count).filter((b) => b.active);
}

function def(id: string, behavior: EnemyDef['behavior'], extra: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id,
    name: id,
    hp: 3,
    r: 5,
    sprite: 'gnat',
    behavior,
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 10,
    salvage: 1,
    dropTable: 'none',
    ...extra,
  };
}

describe('roster registry', () => {
  it("Level 1's roster is registered and drives the enemy system", () => {
    expect(rosterDef('gnat')).toBe(ENEMIES.gnat);
    const w = world();
    const e = spawnEnemy(w, 'gnat', 60, -10) as Enemy;
    expect(enemyDef(e)).toBe(ENEMIES.gnat);
    updateEnemies(w, DT);
    expect(e.y).toBeGreaterThan(-10);
  });

  it('re-registering the same def is a no-op; a different def under the same id throws', () => {
    expect(() => registerRoster({ gnat: ENEMIES.gnat as EnemyDef })).not.toThrow();
    const clash = def('gnat', { kind: 'crossing', speed: 10 });
    expect(() => registerRoster({ gnat: clash })).toThrow(/duplicate enemy id "gnat"/);
    expect(rosterDef('gnat')).toBe(ENEMIES.gnat);
  });

  it('a registered sector enemy spawns, moves through its custom behavior and fires', () => {
    let calls = 0;
    registerBehavior('t21.drift', (w, e, p, dt) => {
      calls++;
      if (e.state === 0) {
        e.state = 1;
        e.ax = e.x;
      }
      e.vx = p.vx ?? 0;
      e.vy = p.vy ?? 0;
      if (e.t < 1 && e.t + dt >= 1) aimed(w, e.x, e.y, 3, 20, 80);
    });
    registerRoster({
      t21_drifter: def('t21_drifter', {
        kind: 'custom',
        behavior: 't21.drift',
        p: { vx: 30, vy: 12 },
      }),
    });
    const w = world();
    const e = spawnEnemy(w, 't21_drifter', 100, 50) as Enemy;
    expect(e.hp).toBe(3);
    for (let i = 0; i < 70; i++) updateEnemies(w, DT);
    expect(calls).toBe(70);
    expect(e.x).toBeCloseTo(100 + 30 * 70 * DT, 3);
    expect(e.y).toBeCloseTo(50 + 12 * 70 * DT, 3);
    expect(e.ax).toBe(100);
    expect(shots(w)).toHaveLength(3);
  });

  it('a second, different behavior under one name throws', () => {
    const fn = () => {};
    registerBehavior('t21.same', fn);
    expect(() => registerBehavior('t21.same', fn)).not.toThrow();
    expect(() => registerBehavior('t21.same', () => {})).toThrow(/duplicate "t21.same"/);
  });

  it('an unknown custom behavior throws at spawn in dev', () => {
    registerRoster({ t21_lost: def('t21_lost', { kind: 'custom', behavior: 'nope.missing' }) });
    const w = world();
    spawnEnemy(w, 't21_lost', 100, 50);
    expect(() => updateEnemies(w, DT)).toThrow(/Unknown enemy behavior "nope.missing"/);
  });
});

describe('enemyHpMul', () => {
  it('rounds and never drops below 1', () => {
    expect(scaleHp(1, 1.35)).toBe(1);
    expect(scaleHp(2, 1.25)).toBe(3); // 2.5 rounds up
    expect(scaleHp(3, 1.15)).toBe(3);
    expect(scaleHp(10, 1.35)).toBe(14);
    expect(scaleHp(4, 0.1)).toBe(1);
  });

  it('applies once, at spawn, to the Level 1 roster only', () => {
    registerRoster({ t21_native: def('t21_native', { kind: 'crossing', speed: 10 }, { hp: 10 }) });
    const w = world();
    setEnemyHpMul(w, 1.35);
    const gunboat = spawnEnemy(w, 'gunboat', 60, 30) as Enemy;
    const native = spawnEnemy(w, 't21_native', 160, 30) as Enemy;
    const base = gunboat.hp;
    for (let i = 0; i < 10; i++) updateEnemies(w, DT);
    expect(gunboat.hp).toBe(scaleHp(base, 1.35));
    expect(gunboat.maxHp).toBe(gunboat.hp);
    expect(native.hp).toBe(10);
    // A fresh world defaults to 1.
    const w2 = world();
    const g2 = spawnEnemy(w2, 'gunboat', 60, 30) as Enemy;
    updateEnemies(w2, DT);
    expect(g2.hp).toBe(base);
  });
});

describe('enemy shot speed multiplier', () => {
  it('scales every pattern shot, per world', () => {
    const w = world('mul');
    setEnemyShotSpeedMul(w, 1.2);
    shootDir(w, 120, 100, 90, 100);
    const [b] = shots(w);
    expect(b!.vy).toBeCloseTo(120, 6);
    expect(b!.vx).toBeCloseTo(0, 6);
    const other = world('plain');
    shootDir(other, 120, 100, 90, 100);
    expect(shots(other)[0]!.vy).toBeCloseTo(100, 6);
    // Switching back to the first world still reads its own value.
    shootDir(w, 120, 100, 0, 50);
    expect(shots(w)[1]!.vx).toBeCloseTo(60, 6);
  });

  it('fireAt aims a pattern at an arbitrary point', () => {
    const w = world('at');
    const e = spawnEnemy(w, 'gunboat', 100, 100) as Enemy;
    const n = fireAt(w, e, { kind: 'aimed', n: 1, spreadDeg: 0, speed: 50 }, 200, e.y + e.r * 0.5);
    expect(n).toBe(1);
    const [b] = shots(w);
    expect(b!.vx).toBeCloseTo(50, 6);
    expect(b!.vy).toBeCloseTo(0, 6);
  });
});
