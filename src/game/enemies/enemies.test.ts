import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_FAIRNESS, type SineDiveParams } from '../../content/enemies';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { damageEnemy } from '../../sim/damage';
import { bulletsSystem } from '../../sim/motion';
import { rebuildSpatialHash } from '../../sim/spatialHash';
import { spawnAsteroid, spawnEnemy } from '../../sim/spawn';
import type { Bullet, Enemy } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { computeAvoidance, type Steer } from './avoidance';
import { runBehavior } from './behaviors';
import { HS_LEAVE } from './behaviors/holdAndStrafe';
import { formationOffset, spawnFormation } from './formations';
import { aimed, burst, canFire, fan, ring } from './patterns';
import { enemySystem } from './index';

const DT = 1 / 60;

function world(seed = 'T11'): World {
  const w = createWorld(seed);
  w.player.x = 120;
  w.player.y = 340;
  w.player.shield = 99;
  return w;
}

function step(w: World, ticks: number, onTick?: (w: World) => void): void {
  for (let i = 0; i < ticks; i++) {
    w.tick++;
    w.time += DT;
    enemySystem.update(w, DT);
    bulletsSystem.update(w, DT);
    collisionSystem.update(w, DT);
    cleanupSystem.update(w, DT);
    onTick?.(w);
  }
}

function liveEnemies(w: World): Enemy[] {
  return w.enemies.items.slice(0, w.enemies.count).filter((e) => e.active);
}

function liveShots(w: World): Bullet[] {
  return w.enemyShots.items.slice(0, w.enemyShots.count).filter((b) => b.active);
}

function track(defId: string, x: number, y: number, ticks: number, seed = 'T11') {
  const w = world(seed);
  const e = spawnEnemy(w, defId, x, y) as Enemy;
  const path: number[] = [];
  for (let i = 0; i < ticks && e.active; i++) {
    step(w, 1);
    path.push(e.x, e.y);
  }
  return { w, e, path };
}

describe('behaviors', () => {
  const spawns: Record<string, [number, number]> = {
    gnat: [60, -12],
    swooper: [-10, -10],
    gunboat: [100, -16],
    interceptor: [40, -16],
    carrier: [-18, 70],
  };

  it.each(Object.keys(ENEMIES))('%s path is deterministic for a seed', (id) => {
    const [x, y] = spawns[id] as [number, number];
    const a = track(id, x, y, 400).path;
    const b = track(id, x, y, 400).path;
    expect(a.length).toBeGreaterThan(20);
    expect(b).toEqual(a);
  });

  it('gnat flies straight down at 70 px/s', () => {
    const { e } = track('gnat', 60, -12, 60);
    expect(e.x).toBeCloseTo(60, 6);
    expect(e.y).toBeCloseTo(-12 + 70, 3);
  });

  it('swooper enters from a corner and exits the far side', () => {
    const { path } = track('swooper', -10, -10, 600);
    let maxY = -Infinity;
    for (let i = 1; i < path.length; i += 2) maxY = Math.max(maxY, path[i] as number);
    expect(maxY).toBeGreaterThan(120);
    expect(path[path.length - 2]).toBeGreaterThan(240);
  });

  it('a right-side swooper mirrors the path', () => {
    const l = track('swooper', -10, -10, 90).e;
    const r = track('swooper', 250, -10, 90).e;
    expect(r.x).toBeCloseTo(240 - l.x, 3);
    expect(r.y).toBeCloseTo(l.y, 3);
  });

  it('gunboat descends to y≈80, holds while strafing, then leaves', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 100, -16) as Enemy;
    let minX = Infinity;
    let maxX = -Infinity;
    step(w, 60 * 3);
    for (let i = 0; i < 60 * 2.5; i++) {
      step(w, 1);
      expect(Math.abs(e.y - 80)).toBeLessThan(4);
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
    expect(maxX - minX).toBeGreaterThan(20);
    step(w, 60);
    expect(e.state).toBe(HS_LEAVE);
    expect(e.vy).toBeLessThan(0);
  });

  it('interceptor lags toward the player x', () => {
    const w = world();
    const e = spawnEnemy(w, 'interceptor', 30, -16) as Enemy;
    step(w, 30);
    const early = Math.abs(e.x - 120);
    step(w, 120);
    expect(Math.abs(e.x - 120)).toBeLessThan(early);
    expect(Math.abs(e.x - 120)).toBeLessThan(22); // ±spread offset
  });

  it('carrier crosses at a fixed height', () => {
    const { e } = track('carrier', -18, 70, 300);
    expect(e.y).toBeCloseTo(70, 3);
    expect(e.x).toBeCloseTo(-18 + 28 * 5, 0);
  });

  it('sineDive oscillates around its spawn x', () => {
    const w = world();
    const e = spawnEnemy(w, 'gnat', 120, 0) as Enemy;
    const p: SineDiveParams = { kind: 'sineDive', speed: 50, amplitude: 30, frequency: 0.5 };
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < 240; i++) {
      runBehavior(w, e, p, DT);
      e.x += e.vx * DT;
      e.y += e.vy * DT;
      e.t += DT;
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
    expect(maxX).toBeGreaterThan(145);
    expect(minX).toBeLessThan(95);
    expect(e.y).toBeCloseTo(200, 3);
  });
});

describe('smart avoidance', () => {
  const steer: Steer = { x: 0, y: 0 };

  it('deflects away from an asteroid ahead', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 120, 100) as Enemy;
    spawnAsteroid(w, { x: 116, y: 130, vx: 0, vy: 0, r: 10, hp: 0 });
    rebuildSpatialHash(w);
    expect(computeAvoidance(w, e, 0, 60, steer)).toBe(true);
    expect(steer.x).toBeGreaterThan(0); // rock is left of the path → steer right
    expect(steer.y).toBeLessThan(0); // and eases off the throttle
  });

  it('ignores rocks behind or far to the side', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 120, 100) as Enemy;
    spawnAsteroid(w, { x: 120, y: 60, vx: 0, vy: 0, r: 10, hp: 0 });
    spawnAsteroid(w, { x: 200, y: 110, vx: 0, vy: 0, r: 10, hp: 0 });
    rebuildSpatialHash(w);
    expect(computeAvoidance(w, e, 0, 60, steer)).toBe(false);
    expect(steer.x).toBeCloseTo(0, 9);
  });

  it('smart enemies weave around a rock that dumb ones smash into', () => {
    for (const [id, smart] of [
      ['gnat', false],
      ['swooper', false],
      ['gunboat', true],
      ['interceptor', true],
    ] as const) {
      const w = world();
      // Rock straight in the path.
      spawnAsteroid(w, { x: 121, y: 40, vx: 0, vy: 0, r: 10, hp: 0 });
      const e =
        id === 'swooper'
          ? (spawnEnemy(w, id, -10, -10) as Enemy)
          : (spawnEnemy(w, id, 121, -16) as Enemy);
      // The interceptor's shadow target (player x + its fixed offset) sits on the rock.
      w.player.x = 121 - ((e.id % 3) - 1) * 18;
      if (id === 'swooper') {
        // Park the rock on the swooper's curve 1.2 s in.
        const probe = track('swooper', -10, -10, 72).e;
        w.asteroids.items[0]!.x = probe.x;
        w.asteroids.items[0]!.y = probe.y;
      }
      const id0 = e.id;
      step(w, 60 * 4);
      const alive = e.active && e.id === id0;
      expect([id, alive]).toEqual([id, smart]);
    }
  });

  it('blends back toward the desired path once clear', () => {
    const w = world();
    spawnAsteroid(w, { x: 120, y: 30, vx: 0, vy: 0, r: 10, hp: 0 });
    const e = spawnEnemy(w, 'gunboat', 120, -16) as Enemy;
    let maxDx = 0;
    step(w, 60 * 3, () => (maxDx = Math.max(maxDx, Math.abs(e.x - 120))));
    expect(maxDx).toBeGreaterThan(10);
    expect(e.active).toBe(true);
    expect(Math.abs(e.y - 80)).toBeLessThan(4);
  });
});

describe('fire patterns', () => {
  it('aimed shots head at the player’s current position', () => {
    const w = world();
    w.player.x = 200;
    w.player.y = 300;
    expect(aimed(w, 100, 100, 1, 0, 90)).toBe(1);
    const b = liveShots(w)[0] as Bullet;
    const len = Math.hypot(b.vx, b.vy);
    expect(len).toBeCloseTo(90, 6);
    expect(b.vx / len).toBeCloseTo(100 / Math.hypot(100, 200), 6);
    expect(b.vy / len).toBeCloseTo(200 / Math.hypot(100, 200), 6);
    expect(b.sprite).toBe('ebullet_s');
  });

  it('fan is symmetric about straight down; ring is evenly spaced', () => {
    const w = world();
    expect(fan(w, 120, 50, 3, 40, 80)).toBe(3);
    const [a, b, c] = liveShots(w) as [Bullet, Bullet, Bullet];
    expect(b.vx).toBeCloseTo(0, 6);
    expect(a.vx).toBeCloseTo(-c.vx, 6);
    expect(a.vy).toBeCloseTo(c.vy, 6);

    const w2 = world();
    expect(ring(w2, 120, 120, 8, 60, 0)).toBe(8);
    let sx = 0;
    let sy = 0;
    for (const s of liveShots(w2)) {
      sx += s.vx;
      sy += s.vy;
    }
    expect(sx).toBeCloseTo(0, 6);
    expect(sy).toBeCloseTo(0, 6);
  });

  it('burst repeats from the live shooter and stops when it dies', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 120, 80, { fireT: 999 }) as Enemy;
    e.t = 10;
    burst(w, e, 3, 0.2, { kind: 'fan', n: 2, arcDeg: 20, speed: 70 });
    expect(liveShots(w).length).toBe(2);
    step(w, 13);
    expect(liveShots(w).length).toBe(4);
    damageEnemy(w, e, 99, 'player');
    step(w, 30);
    expect(liveShots(w).length).toBe(4);
  });
});

describe('fairness', () => {
  it('no shots in the first 0.5 s, even when due', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 120, 60, { fireT: 0.01 }) as Enemy;
    expect(canFire(w, e)).toBe(false);
    step(w, Math.floor(ENEMY_FAIRNESS.minAge * 60) - 1);
    expect(liveShots(w).length).toBe(0);
    step(w, 3);
    const fire = ENEMIES.gunboat?.fire?.pattern;
    expect(liveShots(w).length).toBe(fire?.kind === 'fan' ? fire.n : -1);
  });

  it('no shots from below (or within 24 px above) the player', () => {
    const w = world();
    w.player.y = 100;
    spawnEnemy(w, 'interceptor', 120, 90);
    step(w, 60 * 4);
    expect(liveShots(w).length).toBe(0);
  });

  it('no shots while off screen', () => {
    const w = world();
    const e = spawnEnemy(w, 'gunboat', 120, -16) as Enemy;
    e.t = 5;
    expect(canFire(w, e)).toBe(false);
  });
});

describe('formations', () => {
  it('registers in run.formations and tags every member', () => {
    const w = world();
    const id = spawnFormation(w, { type: 'v', enemyId: 'gnat', count: 5, x: 120, spacing: 18 });
    expect(w.run.formations.get(id)).toEqual({ alive: 5, total: 5, broken: false });
    const members = liveEnemies(w);
    expect(members.length).toBe(5);
    expect(members.every((e) => e.formationId === id)).toBe(true);
    expect(members[0]?.x).toBe(120);
  });

  it('delayed members spawn over time and still count', () => {
    const w = world();
    const id = spawnFormation(w, {
      type: 'column',
      enemyId: 'gnat',
      count: 4,
      x: 60,
      spacing: 0,
      delay: 0.5,
    });
    expect(liveEnemies(w).length).toBe(1);
    expect(w.run.formations.get(id)?.total).toBe(4);
    step(w, 31);
    expect(liveEnemies(w).length).toBe(2);
    step(w, 60);
    expect(liveEnemies(w).length).toBe(4);
  });

  it('clearing every member by player kills emits formationCleared', () => {
    const w = world();
    const cleared: number[] = [];
    w.events.on('formationCleared', (p) => cleared.push(p.formationId));
    const id = spawnFormation(w, { type: 'line', enemyId: 'gnat', count: 3, x: 120, spacing: 20 });
    for (const e of liveEnemies(w)) damageEnemy(w, e, 5, 'player');
    expect(cleared).toEqual([id]);
  });

  it('offsets: column stacks up, line centers, v trails both wings', () => {
    const o = { x: 0, y: 0 };
    formationOffset('column', 2, 3, 10, o);
    expect(o).toEqual({ x: 0, y: -20 });
    formationOffset('line', 0, 3, 10, o);
    expect(o).toEqual({ x: -10, y: 0 });
    formationOffset('v', 1, 5, 10, o);
    expect(o.x).toBe(-10);
    formationOffset('v', 2, 5, 10, o);
    expect(o.x).toBe(10);
    expect(o.y).toBeLessThan(0);
  });
});
