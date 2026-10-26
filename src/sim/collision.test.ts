import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from './cleanup';
import { collide } from './collision';
import { RAM_DAMAGE } from './collisionRules';
import {
  clearHooks,
  registerAnomalyContact,
  registerBossDamage,
  registerShotBlocker,
} from './hooks';
import { bulletsSystem } from './motion';
import {
  spawnAnomaly,
  spawnAsteroid,
  spawnEnemy,
  spawnEnemyShot,
  spawnPickup,
  spawnPlayerShot,
} from './spawn';
import { createWorld, type World } from './world';

const DT = 1 / 60;

function makeWorld(): World {
  const w = createWorld('COLLIDE');
  const p = w.player;
  p.shield = 3;
  p.maxShield = 3;
  p.r = 4;
  p.x = 120;
  p.y = 360;
  return w;
}

function tick(w: World): void {
  bulletsSystem.update(w, DT);
  collide(w, DT);
  cleanup(w, DT);
}

/** Copies payload fields: payload objects are reused after dispatch. */
function record(w: World) {
  const log = {
    enemyHit: [] as { id: number; damage: number }[],
    enemyKilled: [] as { id: number; byPlayer: boolean }[],
    asteroidHit: [] as number[],
    asteroidDestroyed: [] as { id: number; byPlayer: boolean }[],
    playerHit: [] as number[],
    playerDied: 0,
    shake: 0,
    haptic: [] as string[],
    formationCleared: [] as { formationId: number; x: number; y: number }[],
  };
  w.events.on('enemyHit', (p) => log.enemyHit.push({ id: p.enemy.id, damage: p.damage }));
  w.events.on('enemyKilled', (p) => log.enemyKilled.push({ id: p.enemy.id, byPlayer: p.byPlayer }));
  w.events.on('asteroidHit', (p) => log.asteroidHit.push(p.asteroid.id));
  w.events.on('asteroidDestroyed', (p) =>
    log.asteroidDestroyed.push({ id: p.asteroid.id, byPlayer: p.byPlayer }),
  );
  w.events.on('playerHit', (p) => log.playerHit.push(p.shieldLeft));
  w.events.on('playerDied', () => log.playerDied++);
  w.events.on('shake', () => log.shake++);
  w.events.on('haptic', (p) => log.haptic.push(p.kind));
  w.events.on('formationCleared', (p) => log.formationCleared.push({ ...p }));
  return log;
}

const rock = (x: number, y: number, hp = 1, r = 6) => ({ x, y, vx: 0, vy: 0, r, hp });
const shot = (x: number, y: number, extra = {}) => ({ x, y, vx: 0, vy: 0, r: 2, ...extra });

afterEach(() => clearHooks());

describe('collision matrix: playerShot', () => {
  it('× enemy: damages, emits enemyHit and consumes the shot', () => {
    const w = makeWorld();
    const log = record(w);
    const e = spawnEnemy(w, 'dummy', 100, 100, { hp: 3 })!;
    const s = spawnPlayerShot(w, shot(100, 104, { damage: 1 }))!;
    collide(w, DT);
    expect(e.hp).toBe(2);
    expect(e.flashT).toBeGreaterThan(0);
    expect(log.enemyHit).toEqual([{ id: e.id, damage: 1 }]);
    expect(log.enemyKilled).toEqual([]);
    expect(s.active).toBe(false);
  });

  it('× enemy: lethal hit emits enemyKilled{byPlayer:true}, scores and releases', () => {
    const w = makeWorld();
    const log = record(w);
    const e = spawnEnemy(w, 'dummy', 100, 100)!;
    spawnPlayerShot(w, shot(100, 100));
    collide(w, DT);
    expect(log.enemyKilled).toEqual([{ id: e.id, byPlayer: true }]);
    expect(e.active).toBe(false);
    expect(w.run.score).toBe(10);
    expect(w.run.kills).toBe(1);
  });

  it('× enemy: misses when circles only touch', () => {
    const w = makeWorld();
    const e = spawnEnemy(w, 'dummy', 100, 100, { r: 6 })!;
    spawnPlayerShot(w, shot(108, 100, { r: 2 }));
    collide(w, DT);
    expect(e.hp).toBe(1);
  });

  it('pierce: hits 3 lined-up enemies exactly once each', () => {
    const w = makeWorld();
    const log = record(w);
    const es = [80, 60, 40].map((y) => spawnEnemy(w, 'dummy', 100, y, { hp: 10, r: 6 })!);
    // Slow enough to overlap each enemy for several ticks.
    const s = spawnPlayerShot(w, { x: 100, y: 100, vx: 0, vy: -120, r: 2, pierce: 2 })!;
    for (let i = 0; i < 60 && s.active; i++) tick(w);
    expect(es.map((e) => e.hp)).toEqual([9, 9, 9]);
    expect(log.enemyHit.map((h) => h.id)).toEqual(es.map((e) => e.id));
    expect(s.active).toBe(false);
  });

  it('pierce: kills 3 lined-up 1 HP enemies and dies after the third', () => {
    const w = makeWorld();
    const log = record(w);
    const es = [80, 60, 40, 20].map((y) => spawnEnemy(w, 'dummy', 100, y)!);
    const s = spawnPlayerShot(w, { x: 100, y: 100, vx: 0, vy: -240, r: 2, pierce: 2 })!;
    for (let i = 0; i < 60 && s.active; i++) tick(w);
    expect(log.enemyKilled.map((k) => k.id)).toEqual(es.slice(0, 3).map((e) => e.id));
    expect(es[3]!.active).toBe(true);
  });

  it('× destructible asteroid: damages, consumes, byPlayer:true and scores', () => {
    const w = makeWorld();
    const log = record(w);
    const a = spawnAsteroid(w, rock(100, 100, 2))!;
    const s = spawnPlayerShot(w, shot(100, 100))!;
    collide(w, DT);
    expect(a.hp).toBe(1);
    expect(s.active).toBe(false);
    expect(log.asteroidHit).toEqual([a.id]);
    spawnPlayerShot(w, shot(100, 100));
    collide(w, DT);
    expect(log.asteroidDestroyed).toEqual([{ id: a.id, byPlayer: true }]);
    expect(a.active).toBe(false);
    expect(w.run.asteroidsDestroyed).toBe(1);
    expect(w.run.score).toBe(10);
  });

  it('× destructible asteroid: pierce applies (shot survives one rock)', () => {
    const w = makeWorld();
    const a = spawnAsteroid(w, rock(100, 100, 5))!;
    const s = spawnPlayerShot(w, shot(100, 100, { pierce: 1 }))!;
    collide(w, DT);
    collide(w, DT);
    expect(a.hp).toBe(4);
    expect(s.active).toBe(true);
    expect(s.pierce).toBe(0);
  });

  it('× indestructible asteroid: absorbed, rock untouched', () => {
    const w = makeWorld();
    const log = record(w);
    const a = spawnAsteroid(w, rock(100, 100, 0))!;
    const s = spawnPlayerShot(w, shot(100, 100, { pierce: 3 }))!;
    collide(w, DT);
    expect(s.active).toBe(false);
    expect(a.active).toBe(true);
    expect(log.asteroidHit).toEqual([]);
  });

  it('× anomaly: absorbed, even when piercing', () => {
    const w = makeWorld();
    const an = spawnAnomaly(w, {
      kind: 'blackhole',
      x: 100,
      y: 100,
      r: 8,
      radius: 60,
      strength: 50,
    })!;
    const s = spawnPlayerShot(w, shot(104, 100, { pierce: 5 }))!;
    collide(w, DT);
    expect(s.active).toBe(false);
    expect(an.active).toBe(true);
  });
});

describe('collision matrix: enemyShot', () => {
  it('× player: removes a segment, grants invuln, emits playerHit + shake + haptic, releases', () => {
    const w = makeWorld();
    const log = record(w);
    const s = spawnEnemyShot(w, shot(w.player.x + 3, w.player.y))!;
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(w.player.invulnT).toBe(1);
    expect(log.playerHit).toEqual([2]);
    expect(log.shake).toBe(1);
    expect(log.haptic).toEqual(['medium']);
    expect(s.active).toBe(false);
  });

  it('× player: respects invulnerability but still spends the shot', () => {
    const w = makeWorld();
    const log = record(w);
    w.player.invulnT = 0.5;
    const s = spawnEnemyShot(w, shot(w.player.x, w.player.y))!;
    collide(w, DT);
    expect(w.player.shield).toBe(3);
    expect(log.playerHit).toEqual([]);
    expect(s.active).toBe(false);
  });

  it('× player at 0 segments: kills the player and emits playerDied once', () => {
    const w = makeWorld();
    const log = record(w);
    w.player.shield = 0;
    spawnEnemyShot(w, shot(w.player.x, w.player.y));
    spawnEnemyShot(w, shot(w.player.x, w.player.y));
    collide(w, DT);
    expect(w.player.alive).toBe(false);
    expect(log.playerDied).toBe(1);
    expect(log.playerHit).toEqual([0]);
    expect(log.haptic).toEqual(['heavy']);
  });

  it('× player: ignored while the player is dead', () => {
    const w = makeWorld();
    w.player.alive = false;
    const s = spawnEnemyShot(w, shot(w.player.x, w.player.y))!;
    collide(w, DT);
    expect(s.active).toBe(true);
  });

  it('× asteroid: absorbed, asteroid undamaged (cover)', () => {
    const w = makeWorld();
    const log = record(w);
    const a = spawnAsteroid(w, rock(100, 100, 1))!;
    const s = spawnEnemyShot(w, shot(100, 100))!;
    collide(w, DT);
    expect(s.active).toBe(false);
    expect(a.hp).toBe(1);
    expect(log.asteroidHit).toEqual([]);
  });

  it('× asteroid shields the player when both overlap', () => {
    const w = makeWorld();
    const p = w.player;
    spawnAsteroid(w, rock(p.x, p.y - 6, 0, 6));
    spawnEnemyShot(w, shot(p.x, p.y - 3));
    collide(w, DT);
    // The rock still rams the player; only the bullet is blocked.
    expect(p.shield).toBe(2);
    expect(w.enemyShots.items[0]!.active).toBe(false);
  });

  it('× anomaly: absorbed', () => {
    const w = makeWorld();
    spawnAnomaly(w, { kind: 'pulsar', x: 100, y: 100, r: 8, radius: 60, strength: 1 });
    const s = spawnEnemyShot(w, shot(100, 105))!;
    collide(w, DT);
    expect(s.active).toBe(false);
  });

  it('runs every shot blocker hook for every enemy shot; true consumes the shot', () => {
    const w = makeWorld();
    const seen: number[] = [];
    registerShotBlocker((_w, s) => {
      seen.push(s.id);
      return false;
    });
    registerShotBlocker((_w, s) => s.x < 50);
    const blocked = spawnEnemyShot(w, shot(w.player.x, w.player.y))!;
    blocked.x = 40;
    const free = spawnEnemyShot(w, shot(200, 50))!;
    const onPlayer = spawnEnemyShot(w, shot(w.player.x, w.player.y))!;
    registerShotBlocker((_w, s) => s === onPlayer);
    collide(w, DT);
    expect(seen).toEqual([blocked.id, free.id, onPlayer.id]);
    expect(blocked.active).toBe(false);
    expect(free.active).toBe(true);
    expect(onPlayer.active).toBe(false);
    expect(w.player.shield).toBe(3);
  });
});

describe('collision matrix: enemy × asteroid', () => {
  it('a dumb enemy flying into an asteroid kills both, byPlayer:false, no formation bonus', () => {
    const w = makeWorld();
    const log = record(w);
    w.run.formations.set(7, { alive: 1, total: 1, broken: false });
    const e = spawnEnemy(w, 'dummy', 100, 40, { vy: 70, formationId: 7 })!;
    const a = spawnAsteroid(w, rock(100, 100, 1))!;
    for (let i = 0; i < 120 && e.active; i++) {
      e.prevY = e.y;
      e.y += e.vy * DT;
      tick(w);
    }
    expect(log.enemyKilled).toEqual([{ id: e.id, byPlayer: false }]);
    expect(log.asteroidDestroyed).toEqual([{ id: a.id, byPlayer: false }]);
    expect(log.formationCleared).toEqual([]);
    expect(w.run.formations.get(7)!.broken).toBe(true);
    expect(w.run.score).toBe(0);
    expect(w.run.kills).toBe(0);
    expect(w.run.asteroidsDestroyed).toBe(0);
  });

  it("both take the other's current HP", () => {
    const w = makeWorld();
    const e = spawnEnemy(w, 'dummy', 100, 100, { hp: 6 })!;
    const a = spawnAsteroid(w, rock(100, 104, 2))!;
    collide(w, DT);
    expect(e.hp).toBe(4);
    expect(a.active).toBe(false);

    const big = spawnAsteroid(w, rock(150, 100, 10))!;
    const gnat = spawnEnemy(w, 'dummy', 150, 100, { hp: 1 })!;
    collide(w, DT);
    expect(gnat.active).toBe(false);
    expect(big.hp).toBe(9);
  });

  it('an indestructible asteroid destroys the enemy and survives', () => {
    const w = makeWorld();
    const e = spawnEnemy(w, 'dummy', 100, 100, { hp: 20 })!;
    const a = spawnAsteroid(w, rock(100, 100, 0))!;
    collide(w, DT);
    expect(e.active).toBe(false);
    expect(a.active).toBe(true);
  });

  it('bosses are immune: a rock moving into a boss breaks, one moving away passes', () => {
    const w = makeWorld();
    const log = record(w);
    const boss = spawnEnemy(w, 'dummy', 100, 60, { hp: 100, r: 20, isBoss: true })!;
    const incoming = spawnAsteroid(w, { ...rock(100, 80, 4), vy: -60 })!;
    const outgoing = spawnAsteroid(w, { ...rock(110, 75, 4), vx: 30, vy: 90 })!;
    collide(w, DT);
    expect(boss.hp).toBe(100);
    expect(log.enemyHit).toEqual([]);
    expect(incoming.active).toBe(false);
    expect(log.asteroidDestroyed).toEqual([{ id: incoming.id, byPlayer: false }]);
    expect(outgoing.active).toBe(true);
    expect(outgoing.hp).toBe(4);
  });
});

describe('collision matrix: player', () => {
  it(`× enemy: player loses a segment, enemy takes ${RAM_DAMAGE}`, () => {
    const w = makeWorld();
    const log = record(w);
    const e = spawnEnemy(w, 'dummy', w.player.x, w.player.y - 5, { hp: 8 })!;
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(e.hp).toBe(8 - RAM_DAMAGE);
    expect(log.enemyHit).toEqual([{ id: e.id, damage: RAM_DAMAGE }]);
    // Invulnerable now: further contact does nothing to either.
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(e.hp).toBe(8 - RAM_DAMAGE);
  });

  it('× enemy: a ram kill counts as a player kill', () => {
    const w = makeWorld();
    const log = record(w);
    const e = spawnEnemy(w, 'dummy', w.player.x, w.player.y, { hp: 5 })!;
    collide(w, DT);
    expect(log.enemyKilled).toEqual([{ id: e.id, byPlayer: true }]);
  });

  it('× boss: only the player is damaged', () => {
    const w = makeWorld();
    const boss = spawnEnemy(w, 'dummy', w.player.x, w.player.y - 10, {
      hp: 50,
      r: 16,
      isBoss: true,
    })!;
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(boss.hp).toBe(50);
  });

  it('× destructible asteroid: player loses a segment, asteroid destroyed', () => {
    const w = makeWorld();
    const log = record(w);
    const a = spawnAsteroid(w, rock(w.player.x + 6, w.player.y, 3))!;
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(a.active).toBe(false);
    expect(log.asteroidDestroyed).toEqual([{ id: a.id, byPlayer: true }]);
  });

  it('× indestructible asteroid: player loses a segment, rock stays', () => {
    const w = makeWorld();
    const a = spawnAsteroid(w, rock(w.player.x, w.player.y, 0))!;
    collide(w, DT);
    expect(w.player.shield).toBe(2);
    expect(a.active).toBe(true);
  });

  it('× asteroid while invulnerable: nothing happens', () => {
    const w = makeWorld();
    w.player.invulnT = 1;
    const a = spawnAsteroid(w, rock(w.player.x, w.player.y, 1))!;
    collide(w, DT);
    expect(w.player.shield).toBe(3);
    expect(a.active).toBe(true);
  });

  it('× anomaly: delegates to the per-kind contact hook every overlapping tick', () => {
    const w = makeWorld();
    const bh = vi.fn();
    const pulsar = vi.fn();
    registerAnomalyContact('blackhole', bh);
    registerAnomalyContact('pulsar', pulsar);
    const a = spawnAnomaly(w, {
      kind: 'blackhole',
      x: w.player.x,
      y: w.player.y - 8,
      r: 8,
      radius: 80,
      strength: 40,
    })!;
    collide(w, DT);
    collide(w, DT);
    expect(bh).toHaveBeenCalledTimes(2);
    expect(bh).toHaveBeenCalledWith(w, a, w.player);
    expect(pulsar).not.toHaveBeenCalled();
    expect(w.player.shield).toBe(3);
  });

  it('× anomaly with no hook registered: no effect', () => {
    const w = makeWorld();
    spawnAnomaly(w, {
      kind: 'pulsar',
      x: w.player.x,
      y: w.player.y,
      r: 8,
      radius: 80,
      strength: 1,
    });
    expect(() => collide(w, DT)).not.toThrow();
    expect(w.player.shield).toBe(3);
  });

  it('× pickup: not handled here', () => {
    const w = makeWorld();
    const pk = spawnPickup(w, { kind: 'salvage', x: w.player.x, y: w.player.y, amount: 5 })!;
    collide(w, DT);
    expect(pk.active).toBe(true);
    expect(w.player.shield).toBe(3);
  });
});

describe('collision matrix: no-ops', () => {
  it('enemy × enemy and asteroid × asteroid do nothing', () => {
    const w = makeWorld();
    const log = record(w);
    const e1 = spawnEnemy(w, 'dummy', 100, 100, { hp: 2 })!;
    const e2 = spawnEnemy(w, 'dummy', 102, 100, { hp: 2 })!;
    const a1 = spawnAsteroid(w, rock(200, 100, 1))!;
    const a2 = spawnAsteroid(w, rock(203, 100, 1))!;
    collide(w, DT);
    expect([e1.hp, e2.hp, a1.hp, a2.hp]).toEqual([2, 2, 1, 1]);
    expect(log.enemyHit.length + log.asteroidHit.length).toBe(0);
  });

  it('player shots ignore the player and pickups; enemy shots ignore enemies and pickups', () => {
    const w = makeWorld();
    const p = w.player;
    const ps = spawnPlayerShot(w, shot(p.x, p.y))!;
    const e = spawnEnemy(w, 'dummy', 50, 50)!;
    const es = spawnEnemyShot(w, shot(50, 50))!;
    spawnPickup(w, { kind: 'shield', x: 150, y: 150 });
    const ps2 = spawnPlayerShot(w, shot(150, 150))!;
    const es2 = spawnEnemyShot(w, shot(150, 150))!;
    collide(w, DT);
    expect([ps.active, es.active, ps2.active, es2.active, e.active]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(p.shield).toBe(3);
  });
});

describe('boss damage hooks', () => {
  it('a handling hook takes over the hit; the shot is still consumed', () => {
    const w = makeWorld();
    const hook = vi.fn(() => true);
    registerBossDamage(hook);
    const log = record(w);
    const boss = spawnEnemy(w, 'dummy', 100, 60, { hp: 10, r: 16, isBoss: true })!;
    const s = spawnPlayerShot(w, shot(100, 60, { damage: 3 }))!;
    collide(w, DT);
    expect(hook).toHaveBeenCalledWith(w, boss, 3);
    expect(boss.hp).toBe(10);
    expect(log.enemyHit).toEqual([]);
    expect(s.active).toBe(false);
  });
});

describe('collision performance', () => {
  function crowd(seed: string): World {
    const w = createWorld(seed);
    const rng = w.rng;
    const p = w.player;
    p.shield = 1e9;
    p.r = 4;
    for (let i = 0; i < 80; i++) {
      spawnEnemy(w, 'dummy', rng.range(0, 240), rng.range(0, 400), { hp: 3, r: rng.range(5, 12) });
    }
    for (let i = 0; i < 120; i++) {
      const size = rng.int(0, 2);
      spawnAsteroid(w, rock(rng.range(0, 240), rng.range(-40, 400), 1 + size * 2, 5 + size * 5));
    }
    for (let i = 0; i < 600; i++) {
      spawnEnemyShot(w, shot(rng.range(0, 240), rng.range(0, 400)));
    }
    for (let i = 0; i < 400; i++) {
      spawnPlayerShot(w, shot(rng.range(0, 240), rng.range(0, 400), { pierce: rng.int(0, 2) }));
    }
    return w;
  }

  it('one tick with 600 enemy shots, 400 player shots, 80 enemies, 120 asteroids takes < 2 ms', () => {
    // Warm up the JIT.
    for (let i = 0; i < 30; i++) collide(crowd(`warm${i}`), DT);
    const times: number[] = [];
    for (let i = 0; i < 60; i++) {
      const w = crowd(`bench${i}`);
      expect(w.enemyShots.count + w.playerShots.count + w.enemies.count).toBe(1080);
      expect(w.asteroids.count).toBe(120);
      const t0 = performance.now();
      collide(w, DT);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[times.length >> 1]!;
    const p95 = times[Math.floor(times.length * 0.95)]!;
    console.log(`collision tick: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms`);
    expect(median).toBeLessThan(2);
  });

  it('the steady-state core loop allocates (almost) nothing in src/sim over 1000 ticks', async () => {
    const w = crowd('alloc');
    let kills = 0;
    w.events.on('enemyKilled', () => kills++);
    w.events.on('playerHit', () => {
      w.player.invulnT = 0;
    });
    registerShotBlocker((_w, s) => s.x < 2);
    // Pre-rolled positions keep test-side number boxing out of the picture.
    const rnd = new Float64Array(4096);
    for (let i = 0; i < rnd.length; i++) rnd[i] = w.rng.next();
    let ri = 0;
    const roll = (scale: number) => rnd[ri++ & 4095]! * scale;
    const shotInit = { x: 0.5, y: 0.5, vx: 0, vy: -200, r: 2, pierce: 1 };
    const eshotInit = { x: 0.5, y: 0.5, vx: 0, vy: 90, r: 2 };
    const rockInit = rock(0.5, 0.5, 1, 6);
    const enemyO = { vy: 70, hp: 2 };
    const step = () => {
      bulletsSystem.update(w, DT);
      collide(w, DT);
      cleanup(w, DT);
      while (w.playerShots.count < 400) {
        shotInit.x = roll(240);
        shotInit.y = roll(400);
        spawnPlayerShot(w, shotInit);
      }
      while (w.enemyShots.count < 600) {
        eshotInit.x = roll(240);
        eshotInit.y = roll(400);
        spawnEnemyShot(w, eshotInit);
      }
      while (w.enemies.count < 80) spawnEnemy(w, 'dummy', roll(240), roll(400), enemyO);
      while (w.asteroids.count < 120) {
        rockInit.x = roll(240);
        rockInit.y = roll(400);
        spawnAsteroid(w, rockInit);
      }
    };
    for (let i = 0; i < 300; i++) step();

    // Sampling heap profiler, counting garbage too, attributed to the
    // allocating (possibly inlined-into) function's file.
    // No @types/node in this project, so the module is typed by hand.
    interface InspectorSession {
      connect(): void;
      disconnect(): void;
      post(method: string, params: object, cb: (err: Error | null, res: unknown) => void): void;
    }
    const inspectorId = 'node:inspector';
    const { Session } = (await import(/* @vite-ignore */ inspectorId)) as {
      Session: new () => InspectorSession;
    };
    const s = new Session();
    s.connect();
    const post = <R>(method: string, params: object = {}) =>
      new Promise<R>((res, rej) => s.post(method, params, (e, r) => (e ? rej(e) : res(r as R))));
    await post('HeapProfiler.enable');
    await post('HeapProfiler.startSampling', {
      samplingInterval: 128,
      includeObjectsCollectedByMinorGC: true,
      includeObjectsCollectedByMajorGC: true,
    });
    const kills0 = kills;
    for (let i = 0; i < 1000; i++) step();
    interface Node {
      callFrame: { url: string };
      selfSize: number;
      children: Node[];
    }
    const { profile } = await post<{ profile: { head: Node } }>('HeapProfiler.stopSampling');
    s.disconnect();
    let simBytes = 0;
    const walk = (n: Node) => {
      const url = n.callFrame.url;
      if (url.includes('/src/sim/') && !url.includes('.test.')) simBytes += n.selfSize;
      n.children.forEach(walk);
    };
    walk(profile.head);
    const perTick = simBytes / 1000;
    console.log(
      `src/sim allocations: ${perTick.toFixed(0)} B/tick over 1000 ticks, ${kills - kills0} kills`,
    );
    expect(kills - kills0).toBeGreaterThan(1000);
    // Any per-entity allocation would be >= 16 B × 1,000+ bodies per tick;
    // what remains is a few stray heap numbers on kill paths.
    expect(perTick).toBeLessThan(256);
  });
});
