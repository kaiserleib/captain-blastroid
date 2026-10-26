import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { damageAsteroid, damageEnemy, damagePlayer } from '../../sim/damage';
import { bulletsSystem } from '../../sim/motion';
import { spawnAsteroid, spawnEnemy, spawnPickup } from '../../sim/spawn';
import { createWorld, type World } from '../../sim/world';
import { isSnesColor } from '../palette';
import { getSpriteEntry } from '../sprite';
import { BOOM_FRAMES, BOOM_SIZES, boomSprite } from './fx.sprites';
import { Fx, boomSizeFor } from './fxSystem';
import { HITSTOP_MAX, HitstopGate } from './hitstop';
import { PARTICLE_CAPACITY, PK, ParticlePool, RAMP, SPARK_SOFT_CAP } from './particles';
import { SHAKE_MAX, Shake, shakeScale } from './shake';
import { TOAST_MAX_VISIBLE, TOAST_TIME, Toasts } from './toasts';

const DT = 1 / 60;

function testFx(log: string[] = []): Fx {
  return new Fx({
    haptic: (k) => log.push(`haptic ${k}`),
    shakeScale: () => 1,
    hitstop: (d) => log.push(`hitstop ${d}`),
  });
}

describe('ParticlePool', () => {
  it('drops spawns past capacity without throwing', () => {
    const p = new ParticlePool();
    for (let i = 0; i < PARTICLE_CAPACITY + 50; i++) p.spawn(PK.debris, 0, 0, 0, 0, 1, RAMP.hot);
    expect(p.count).toBe(PARTICLE_CAPACITY);
    expect(p.dropped).toBe(50);
  });

  it('skips sparks once more than 400 are live, but not other kinds', () => {
    const p = new ParticlePool();
    for (let i = 0; i <= SPARK_SOFT_CAP; i++) p.spawn(PK.debris, 0, 0, 0, 0, 1, RAMP.hot);
    expect(p.spawn(PK.spark, 0, 0, 0, 0, 1, RAMP.hot)).toBe(-1);
    expect(p.spawn(PK.chunk, 0, 0, 0, 0, 1, RAMP.rock)).toBeGreaterThanOrEqual(0);
  });

  it('moves, applies drag, and expires particles', () => {
    const p = new ParticlePool();
    p.spawn(PK.debris, 0, 0, 60, 0, 0.5, RAMP.hot, 1, 1);
    p.spawn(PK.debris, 0, 0, 60, 0, 0.5, RAMP.hot, 1, 0.1);
    p.update(0.25);
    expect(p.x[0]).toBeCloseTo(15);
    expect(p.x[1] as number).toBeLessThan(15);
    p.update(0.3);
    expect(p.count).toBe(0);
  });
});

describe('Shake', () => {
  it('offsets in whole pixels, capped at 4 px, decaying to zero', () => {
    const s = new Shake();
    const rng = createRng('shake');
    s.add(20, 0.5);
    let maxSeen = 0;
    for (let i = 0; i < 20; i++) {
      s.update(DT, rng, 1);
      expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
      maxSeen = Math.max(maxSeen, Math.abs(s.x), Math.abs(s.y));
    }
    expect(maxSeen).toBeLessThanOrEqual(SHAKE_MAX);
    expect(maxSeen).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) s.update(DT, rng, 1);
    expect([s.x, s.y]).toEqual([0, 0]);
  });

  it('respects the setting', () => {
    expect([shakeScale('off'), shakeScale('low'), shakeScale('full')]).toEqual([0, 0.5, 1]);
    const s = new Shake();
    const rng = createRng('off');
    s.add(4, 1);
    for (let i = 0; i < 10; i++) {
      s.update(DT, rng, 0);
      expect([s.x, s.y]).toEqual([0, 0]);
    }
    for (let i = 0; i < 10; i++) {
      s.update(DT, rng, 0.5);
      expect(Math.max(Math.abs(s.x), Math.abs(s.y))).toBeLessThanOrEqual(2);
    }
  });
});

describe('HitstopGate', () => {
  it('clamps to 0.12 s and ignores requests while one is active', () => {
    let now = 0;
    const g = new HitstopGate(() => now);
    expect(g.request(1)).toBe(HITSTOP_MAX);
    now = 50;
    expect(g.request(0.05)).toBe(0);
    now = 121;
    expect(g.request(0.05)).toBe(0.05);
    expect(g.request(0)).toBe(0);
  });
});

describe('Toasts', () => {
  it('shows at most 2 at a time for 1.2 s each, then the queue', () => {
    const t = new Toasts();
    t.push('A');
    t.push('B');
    t.push('C');
    expect(t.visible).toBe(TOAST_MAX_VISIBLE);
    expect(t.queued).toBe(1);
    for (let i = 0; i < Math.ceil(TOAST_TIME / DT) + 1; i++) t.update(DT);
    expect(t.visible).toBe(1);
    expect(t.slots.find((s) => s.active)?.text).toBe('C');
  });
});

describe('explosion sprites', () => {
  it('registers 8-frame bursts at 16/32/48 that only use SNES colors', () => {
    for (const s of BOOM_SIZES) {
      const e = getSpriteEntry(boomSprite(s));
      expect(e?.kind).toBe('proc');
      if (e?.kind !== 'proc') continue;
      expect([e.w, e.h, e.frameCount]).toEqual([s, s, BOOM_FRAMES]);
      const colors = new Set<string>();
      let lit = 0;
      const ctx = {
        fillStyle: '',
        fillRect(x: number, y: number) {
          expect(x >= 0 && y >= 0 && x < s && y < s).toBe(true);
          colors.add(ctx.fillStyle as string);
          lit++;
        },
      } as unknown as CanvasRenderingContext2D;
      for (let f = 0; f < BOOM_FRAMES; f++) e.draw(ctx, f, createRng(f));
      expect(lit).toBeGreaterThan(s * 4);
      for (const c of colors) expect(isSnesColor(c)).toBe(true);
    }
  });
});

describe('Fx event reactions', () => {
  function setup(): { w: World; fx: Fx; log: string[]; sfx: string[] } {
    const w = createWorld('FX');
    const log: string[] = [];
    const sfx: string[] = [];
    const fx = testFx(log);
    fx.attach(w);
    w.events.on('sfx', (p) => sfx.push(p.id));
    return { w, fx, log, sfx };
  }

  it('sizes kill explosions by enemy radius and emits the die sfx', () => {
    expect([boomSizeFor(5), boomSizeFor(10), boomSizeFor(20)]).toEqual([16, 32, 48]);
    const { w, fx, sfx, log } = setup();
    const small = spawnEnemy(w, 'dummy', 50, 50, { r: 5 })!;
    const big = spawnEnemy(w, 'dummy', 150, 50, { r: 20 })!;
    damageEnemy(w, small, 5, 'player');
    damageEnemy(w, big, 5, 'player');
    expect(fx.explosions.count).toBe(2);
    expect(sfx).toEqual(['enemy_die_s', 'enemy_die_m']);
    expect(log).toContain('hitstop 0.05');
    // Second kill is a ×2 chain, so it gets a score popup.
    expect(fx.popups.count).toBe(1);
  });

  it('copies payload fields instead of keeping the pooled entity', () => {
    const { w, fx } = setup();
    const e = spawnEnemy(w, 'dummy', 40, 60, { r: 20 })!;
    damageEnemy(w, e, 5, 'player');
    const before = fx.particles.count;
    // The pool slot gets reused immediately; the chain continues where it died.
    cleanupSystem.update(w, DT);
    spawnEnemy(w, 'dummy', 200, 300);
    expect(e.x).toBe(200);
    fx.update(w, DT);
    expect(fx.particles.count).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
    for (let i = 0; i < fx.particles.count; i++) {
      expect(Math.abs((fx.particles.x[i] as number) - 40)).toBeLessThan(40);
    }
  });

  it('reacts to rocks, player hits, deaths, pickups, bosses and toasts', () => {
    const { w, fx, log } = setup();
    const a = spawnAsteroid(w, { x: 100, y: 100, vx: 0, vy: 30, r: 18, hp: 1, size: 'large' })!;
    damageAsteroid(w, a, 1, true);
    expect(fx.particles.count).toBeGreaterThan(10);

    w.player.shield = 1;
    damagePlayer(w, 1);
    expect(log).toContain('haptic medium');
    w.player.invulnT = 0;
    damagePlayer(w, 5);
    expect(log).toContain('haptic heavy');
    expect(log).toContain('hitstop 0.12');

    const pk = spawnPickup(w, { kind: 'magnet', x: 10, y: 10 })!;
    w.events.emit('pickupCollected', { pickup: pk });
    expect(log).toContain('haptic light');

    w.events.emit('bossDefeated', { defId: 'b', x: 120, y: 100 });
    expect(fx.explosions.activeChains).toBeGreaterThan(0);
    for (let i = 0; i < 150; i++) fx.update(w, DT);
    expect(fx.explosions.activeChains).toBe(0);

    w.events.emit('toast', { text: 'SPREAD CANNON LV3' });
    expect(fx.toasts.visible).toBe(1);
  });

  it('stops listening after detach', () => {
    const { w, fx } = setup();
    fx.detach();
    const e = spawnEnemy(w, 'dummy', 50, 50)!;
    damageEnemy(w, e, 5, 'player');
    expect(fx.explosions.count).toBe(0);
  });
});

/** Scripted run that exercises every FX listener. Returns a full sim snapshot. */
function scriptedRun(withFx: boolean): string {
  const w = createWorld('DETERMINISM');
  w.player.shield = 1000;
  w.scrollSpeed = 30;
  const fx = withFx ? testFx() : null;
  fx?.attach(w);
  const systems = [bulletsSystem, collisionSystem, cleanupSystem, ...(fx ? [fx.system] : [])];
  for (let tick = 0; tick < 900; tick++) {
    w.tick++;
    w.time += DT;
    const rng = w.rng;
    if (rng.chance(0.3)) {
      spawnEnemy(w, 'dummy', rng.range(10, 230), rng.range(10, 300), {
        hp: rng.int(1, 3),
        r: rng.pick([5, 10, 16]),
        vy: rng.range(10, 60),
      });
    }
    if (rng.chance(0.2)) {
      const size = rng.pick(['small', 'medium', 'large'] as const);
      spawnAsteroid(w, {
        x: rng.range(10, 230),
        y: rng.range(10, 300),
        vx: rng.range(-20, 20),
        vy: rng.range(10, 50),
        r: size === 'small' ? 6 : size === 'medium' ? 11 : 18,
        hp: rng.int(1, 2),
        size,
      });
    }
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.active && rng.chance(0.1))
        damageEnemy(w, e, 1, rng.chance(0.8) ? 'player' : 'asteroid');
    }
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = w.asteroids.items[i]!;
      if (a.active && rng.chance(0.1)) damageAsteroid(w, a, 1, true);
    }
    if (tick % 97 === 0) {
      w.player.invulnT = 0;
      damagePlayer(w, 1);
    }
    if (tick % 131 === 0) {
      const pk = spawnPickup(w, { kind: rng.pick(['salvage', 'magnet'] as const), x: 120, y: 300 });
      if (pk) {
        w.events.emit('pickupCollected', { pickup: pk });
        w.pickups.release(pk);
      }
    }
    if (tick === 300) w.events.emit('bossDefeated', { defId: 'b', x: 120, y: 100 });
    if (tick % 200 === 0) w.events.emit('toast', { text: 'HI' });
    for (const s of systems) s.update(w, DT);
  }
  // Listeners live on the bus, so it's left out; everything else must match.
  const state: Record<string, unknown> = { ...w };
  delete state.events;
  delete state.rng;
  delete state.nextId;
  return JSON.stringify({ state, rng: w.rng.next(), nextId: w.nextId() });
}

describe('determinism', () => {
  it('same seed and inputs give identical world state with FX on or off', () => {
    const off = scriptedRun(false);
    const on = scriptedRun(true);
    expect(on.length).toBeGreaterThan(1000);
    expect(on).toBe(off);
  });
});
