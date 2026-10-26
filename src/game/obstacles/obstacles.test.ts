import { beforeEach, describe, expect, it } from 'vitest';
import {
  ASTEROID_SIZES,
  BLACK_HOLE,
  PULSAR,
  ROCK_VARIANTS,
  type AsteroidSize,
} from '../../content/obstacles';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { damageAsteroid } from '../../sim/damage';
import { clearHooks } from '../../sim/hooks';
import { bulletsSystem } from '../../sim/motion';
import { spawnEnemy, spawnEnemyShot, spawnPlayerShot } from '../../sim/spawn';
import { createWorld, type World } from '../../sim/world';
import { pulseIndex, pulsarGlow, pulsarRingRadius } from './anomalies/pulsar';
import {
  AsteroidStream,
  activeAsteroidStreams,
  asteroidTheme,
  obstaclesSystem,
  registerAnomalyHooks,
  spawnAsteroidStream,
  spawnBlackHole,
  spawnPulsar,
  spawnRock,
} from './index';
import { ROCK_FRAMES, rockFrame, rockLevels, rockShape } from './obstacles.sprites';

const DT = 1 / 60;

function world(levelId = 'kessler'): World {
  const w = createWorld('t10', { levelId });
  w.player.shield = 3;
  w.player.maxShield = 3;
  w.player.alive = true;
  return w;
}

/** bullets → obstacles → collision → cleanup, the slice of the real order T10 sits in. */
function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    if (w.player.invulnT > 0) w.player.invulnT = Math.max(0, w.player.invulnT - DT);
    bulletsSystem.update(w, DT);
    obstaclesSystem.update(w, DT);
    collisionSystem.update(w, DT);
    cleanupSystem.update(w, DT);
  }
}

function parkPlayer(w: World, x = 230, y = 390): void {
  w.player.x = w.player.prevX = x;
  w.player.y = w.player.prevY = y;
}

beforeEach(() => {
  clearHooks();
  registerAnomalyHooks();
});

describe('asteroid motion', () => {
  it('keeps velocity unchanged over 300 ticks without forces, and spins', () => {
    const w = world();
    parkPlayer(w);
    const a = spawnRock(w, { size: 'medium', x: 30, y: 20, vx: 7.5, vy: 0.5, spin: 1 })!;
    const x0 = a.x;
    const rot0 = a.rot;
    step(w, 300);
    expect(a.active).toBe(true);
    expect(a.vx).toBe(7.5);
    expect(a.vy).toBe(0.5);
    expect(a.x).toBeCloseTo(x0 + 7.5 * 5, 6);
    expect(a.rot).not.toBe(rot0);
    expect(a.rot).toBeGreaterThanOrEqual(0);
    expect(a.rot).toBeLessThan(Math.PI * 2);
  });

  it('uses content radius and theme HP; hp <= 0 is indestructible', () => {
    const w = world('ion');
    const m = spawnRock(w, { size: 'medium', x: 0, y: 0, vx: 0, vy: 0 })!;
    expect(m.r).toBe(ASTEROID_SIZES.medium.r);
    expect(m.hp).toBe(ASTEROID_SIZES.medium.hp.ion);
    expect(asteroidTheme(m)).toBe('ion');
    const rock = spawnRock(w, { size: 'large', x: 0, y: 0, vx: 0, vy: 0, hp: 0, theme: 'basalt' })!;
    expect(asteroidTheme(rock)).toBe('basalt');
    expect(damageAsteroid(w, rock, 99, true)).toBe(false);
  });
});

describe('asteroid stream', () => {
  it('enters from the top within ±25° and includes the scroll drift', () => {
    const w = world();
    w.scrollSpeed = 30;
    const s = new AsteroidStream({ rate: 20, speedRange: [20, 40], angleRange: [-90, 90] });
    let n = 0;
    for (let i = 0; i < 120; i++) n += s.update(w, DT);
    expect(n).toBeGreaterThan(20);
    expect(w.asteroids.count).toBe(n);
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = w.asteroids.items[i]!;
      expect(a.y).toBeLessThan(0);
      const own = Math.hypot(a.vx, a.vy - 30);
      expect(own).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(own).toBeLessThanOrEqual(40 + 1e-9);
      const deg = (Math.atan2(Math.abs(a.vx), a.vy - 30) * 180) / Math.PI;
      expect(deg).toBeLessThanOrEqual(25 + 1e-6);
    }
  });

  it('respects size weights and the pool reserve, and never drops spawns', () => {
    const w = world();
    const s = new AsteroidStream({ rate: 200, sizeWeights: { large: 1 } });
    for (let i = 0; i < 120; i++) s.update(w, DT);
    expect(w.asteroids.count).toBe(w.asteroids.capacity - 12);
    expect(w.asteroids.droppedSpawns).toBe(0);
    for (let i = 0; i < w.asteroids.count; i++) expect(w.asteroids.items[i]!.size).toBe('large');
  });

  it('is ticked by the obstacles system and stops after its duration', () => {
    const w = world();
    parkPlayer(w);
    const s = spawnAsteroidStream(w, { rate: 5, duration: 1 });
    step(w, 30);
    expect(s.spawned).toBeGreaterThan(0);
    expect(activeAsteroidStreams(w)).toContain(s);
    step(w, 40);
    expect(s.active).toBe(false);
    expect(activeAsteroidStreams(w)).not.toContain(s);
  });

  it('is deterministic per seed', () => {
    const run = () => {
      const w = world();
      parkPlayer(w);
      spawnAsteroidStream(w, { rate: 3, sizeWeights: { small: 1, medium: 1, large: 1 } });
      step(w, 300);
      const out: number[] = [];
      w.asteroids.each((a) => out.push(a.x, a.vy, a.variant));
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('breaking', () => {
  it('emits asteroid_break; L1 mediums do not split', () => {
    const w = world('kessler');
    const ids: string[] = [];
    w.events.on('sfx', (e) => ids.push(e.id));
    parkPlayer(w);
    const m = spawnRock(w, { size: 'medium', x: 100, y: 100, vx: 0, vy: 0 })!;
    step(w);
    damageAsteroid(w, m, 1, true);
    expect(ids).toEqual(['asteroid_break']);
    step(w);
    expect(w.asteroids.count).toBe(0);
  });

  it('splits into diverging children with the theme preserved', () => {
    const w = world('ion');
    parkPlayer(w);
    const big = spawnRock(w, { size: 'large', x: 120, y: 100, vx: 0, vy: 40 })!;
    step(w);
    damageAsteroid(w, big, big.hp, true);
    step(w);
    const kids = w.asteroids.items.slice(0, w.asteroids.count).filter((a) => a.active);
    expect(kids).toHaveLength(2);
    for (const k of kids) {
      expect(k.size).toBe('medium');
      expect(asteroidTheme(k)).toBe('ion');
      expect(k.vy).toBeGreaterThan(0);
    }
    const [a, b] = kids as [(typeof kids)[0], (typeof kids)[0]];
    expect(Math.sign(a.vx)).not.toBe(Math.sign(b.vx));
    // Children of an ion medium split again into smalls.
    damageAsteroid(w, a, a.hp, true);
    step(w);
    const sizes = w.asteroids.items.slice(0, w.asteroids.count).map((r) => r.size);
    expect(sizes.filter((s) => s === 'small')).toHaveLength(2);
  });
});

describe('asteroids with T03 collision rules', () => {
  it('absorb enemy shots as cover', () => {
    const w = world();
    parkPlayer(w, 120, 300);
    spawnRock(w, { size: 'large', x: 120, y: 200, vx: 0, vy: 0, hp: 0 });
    spawnEnemyShot(w, { x: 120, y: 150, vx: 0, vy: 120 });
    step(w, 120);
    expect(w.enemyShots.count).toBe(0);
    expect(w.player.shield).toBe(3);
  });

  it('kill dumb enemies that fly into them', () => {
    const w = world();
    parkPlayer(w);
    const killed: boolean[] = [];
    w.events.on('enemyKilled', (e) => killed.push(e.byPlayer));
    spawnRock(w, { size: 'medium', x: 120, y: 200, vx: 0, vy: 0, hp: 0 });
    spawnEnemy(w, 'dummy', 120, 120, { vx: 0, vy: 70 });
    for (let i = 0; i < 120; i++) {
      // T11 isn't here, so move the enemy by hand (dumb: straight down).
      w.enemies.each((e) => {
        e.prevY = e.y;
        e.y += e.vy * DT;
      });
      step(w);
    }
    expect(killed).toEqual([false]);
    expect(w.run.kills).toBe(0);
  });
});

describe('black hole', () => {
  it('curves passing shots and pulls rocks; velocity changes only from forces', () => {
    const w = world();
    parkPlayer(w);
    spawnBlackHole(w, 120, 200, { vy: 0 });
    const shot = spawnPlayerShot(w, { x: 150, y: 330, vx: 0, vy: -240, ttl: 4 })!;
    const rock = spawnRock(w, { size: 'small', x: 40, y: 200, vx: 0, vy: 0 })!;
    step(w, 30);
    expect(shot.vx).toBeLessThan(-20);
    expect(rock.vx).toBeGreaterThan(0);
    expect(Math.abs(rock.vy)).toBeLessThan(1e-6);
  });

  it('swallows rocks and shots at the core', () => {
    const w = world();
    parkPlayer(w);
    spawnBlackHole(w, 120, 200, { vy: 0 });
    spawnRock(w, { size: 'medium', x: 120, y: 150, vx: 0, vy: 30 });
    spawnPlayerShot(w, { x: 120, y: 260, vx: 0, vy: -200 });
    step(w, 180);
    expect(w.asteroids.count).toBe(0);
    expect(w.playerShots.count).toBe(0);
  });

  it('drifts the player gently and hurts on core contact', () => {
    const w = world();
    parkPlayer(w, 120, 280);
    spawnBlackHole(w, 120, 200, { vy: 0 });
    step(w, 60);
    const moved = 280 - w.player.y;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(BLACK_HOLE.playerPull);
    parkPlayer(w, 120, 203);
    step(w);
    expect(w.player.shield).toBe(3 - BLACK_HOLE.contactDamage);
  });
});

describe('pulsar', () => {
  it('telegraphs, then fires an expanding ring each period', () => {
    const w = world();
    parkPlayer(w);
    const p = spawnPulsar(w, 60, 60, { vy: 0 })!;
    step(w, Math.round((PULSAR.period - PULSAR.telegraph / 2) * 60));
    expect(pulsarGlow(p)).toBeGreaterThan(0);
    expect(pulsarRingRadius(p)).toBe(-1);
    step(w, Math.round((PULSAR.telegraph / 2 + 0.5) * 60));
    expect(pulseIndex(p)).toBe(1);
    expect(pulsarRingRadius(p)).toBeCloseTo(PULSAR.r + 0.5 * PULSAR.ringSpeed, 0);
  });

  it('damages the player once per pulse when the ring passes', () => {
    const w = world();
    parkPlayer(w, 120, 260);
    w.player.shield = 5;
    spawnPulsar(w, 120, 200, { vy: 0 });
    const hits: number[] = [];
    w.events.on('playerHit', () => hits.push(w.tick));
    step(w, Math.round(PULSAR.period * 60) + 60);
    expect(hits).toHaveLength(1);
    // Second pulse hits again once invulnerability has worn off.
    step(w, Math.round(PULSAR.period * 60));
    expect(hits).toHaveLength(2);
  });

  it('does not hurt a player outside the band', () => {
    const w = world();
    parkPlayer(w, 120, 200 + PULSAR.maxRadius + 20);
    spawnPulsar(w, 120, 200, { vy: 0 });
    step(w, Math.round(PULSAR.period * 2 * 60));
    expect(w.player.shield).toBe(3);
  });
});

describe('rock sprites', () => {
  it('rotation frames follow the renderer buckets', () => {
    expect(rockFrame(0)).toBe(0);
    expect(rockFrame(Math.PI)).toBe(8);
    expect(rockFrame(Math.PI * 2 - 0.01)).toBe(0);
    expect(rockFrame(-Math.PI / 8)).toBe(ROCK_FRAMES - 1);
  });

  it.each<AsteroidSize>(['small', 'medium', 'large'])(
    '%s rocks fill most of their cell and are lit from the top-left',
    (size) => {
      for (let v = 0; v < ROCK_VARIANTS; v++) {
        const n = rockShape(size, v).n;
        for (const f of [0, 5, 11]) {
          const lv = rockLevels(size, v, f);
          let filled = 0;
          let tl = 0;
          let tlN = 0;
          let br = 0;
          let brN = 0;
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              const l = lv[y * n + x]!;
              if (l < 0) continue;
              filled++;
              if (x + y < n - 2) {
                tl += l;
                tlN++;
              } else if (x + y > n) {
                br += l;
                brN++;
              }
            }
          }
          expect(filled / (n * n)).toBeGreaterThan(0.5);
          expect(tl / tlN).toBeGreaterThan(br / brN);
        }
      }
    },
  );

  it('is deterministic', () => {
    expect(rockLevels('large', 1, 3)).toEqual(rockLevels('large', 1, 3));
  });
});
