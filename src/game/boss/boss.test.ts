import { describe, expect, it } from 'vitest';
import { ROCK_HAULER } from '../../content/bosses';
import type { WeaponId } from '../../content/weapons';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { damageEnemy } from '../../sim/damage';
import { bulletsSystem } from '../../sim/motion';
import { spawnEnemy, spawnEnemyShot } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { updateEnemies } from '../enemies';
import { obstaclesSystem } from '../obstacles';
import { weaponSystem } from '../weapons';
import {
  activeBoss,
  attachBoss,
  bossHp,
  bossMaxHp,
  Phase,
  spawnBoss,
  updateBoss,
  type RockHauler,
} from './index';

const DT = 1 / 60;

function world(seed = 'T16'): World {
  const w = createWorld(seed, { levelId: 'kessler' });
  w.scrollSpeed = 30;
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  weaponSystem.update(w, DT);
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  obstaclesSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    each?.();
    step(w);
  }
}

function spawned(w: World): RockHauler {
  const b = spawnBoss(w, 'rock_hauler');
  if (b === null) throw new Error('no boss');
  return b;
}

/** Fast-forwards through the invulnerable descent. */
function fighting(w: World): RockHauler {
  const b = spawned(w);
  w.player.invulnT = 1e9;
  run(w, ROCK_HAULER.entry.duration + 0.05);
  expect(b.phase).toBe(Phase.Fight);
  return b;
}

function counter(w: World): Record<string, number> {
  const c: Record<string, number> = {};
  const bump = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  w.events.on('bossSpawned', () => bump('bossSpawned'));
  w.events.on('bossDefeated', () => bump('bossDefeated'));
  w.events.on('sfx', (p) => bump(`sfx:${p.id}`));
  return c;
}

function killTurrets(w: World, b: RockHauler): void {
  for (const s of b.turrets) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
}

describe('Rock Hauler lifecycle', () => {
  it('spawns on bossRequested and emits bossSpawned once', () => {
    const w = world();
    const c = counter(w);
    attachBoss(w);
    w.events.emit('bossRequested', { defId: 'rock_hauler' });
    w.events.emit('bossRequested', { defId: 'rock_hauler' });
    step(w);
    expect(activeBoss(w)).not.toBeNull();
    expect(c.bossSpawned).toBe(1);
    const parts = w.enemies.items.filter((e) => e.active && e.isBoss);
    expect(parts.length).toBe(ROCK_HAULER.parts.length);
    expect(bossHp(w)).toBe(bossMaxHp(w));
    expect(bossMaxHp(w)).toBe(ROCK_HAULER.parts.reduce((n, p) => n + p.hp, 0));
  });

  it('ignores unknown boss ids', () => {
    const w = world();
    attachBoss(w);
    w.events.emit('bossRequested', { defId: 'scrap_baron' });
    step(w);
    expect(activeBoss(w)).toBeNull();
  });

  it('descends invulnerable, then holds near the fighting line', () => {
    const w = world();
    const b = spawned(w);
    const turret = b.turrets[0]?.enemy as Enemy;
    expect(b.rig.y).toBeLessThan(0);
    damageEnemy(w, turret, 5, 'player');
    expect(turret.hp).toBe(ROCK_HAULER.parts[0]?.hp);
    run(w, ROCK_HAULER.entry.duration + 0.1);
    expect(b.phase).toBe(Phase.Fight);
    expect(Math.abs(b.rig.y - ROCK_HAULER.entry.toY)).toBeLessThanOrEqual(
      ROCK_HAULER.strafe.bobAmp + 0.01,
    );
    damageEnemy(w, turret, 5, 'player');
    expect(turret.hp).toBe((ROCK_HAULER.parts[0]?.hp ?? 0) - 5);
  });

  it('keeps the core untargetable until both turrets are wrecked', () => {
    const w = world();
    const b = fighting(w);
    const core = b.core.enemy as Enemy;
    const full = core.hp;
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(full);

    damageEnemy(w, b.turrets[0]?.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.turrets[0]?.destroyed).toBe(true);
    expect(b.phase).toBe(Phase.Fight);
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(full);

    damageEnemy(w, b.turrets[1]?.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.phase).toBe(Phase.Opening);
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(full);

    run(w, ROCK_HAULER.coreOpenTime + 0.05);
    expect(b.phase).toBe(Phase.Exposed);
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(full - 10);
  });

  it('phase 2 fires rotating rings and throws rocks in pairs', () => {
    const w = world();
    const b = fighting(w);
    killTurrets(w, b);
    step(w);
    run(w, ROCK_HAULER.coreOpenTime + 0.1);
    expect(b.phase).toBe(Phase.Exposed);
    w.enemyShots.items.forEach((s) => s.active && w.enemyShots.release(s));
    cleanupSystem.update(w, DT);
    run(w, ROCK_HAULER.ring.firstDelay);
    const shots = w.enemyShots.items.filter((s) => s.active).length;
    expect(shots).toBe(ROCK_HAULER.ring.n);
    const rot0 = b.ringRot;
    run(w, ROCK_HAULER.ring.interval);
    expect(b.ringRot).toBe((rot0 + ROCK_HAULER.ring.rotStep) % 360);

    const before = w.asteroids.items.filter((a) => a.active).length;
    b.flingT = DT / 2;
    step(w);
    const rocks = w.asteroids.items.filter((a) => a.active);
    expect(rocks.length).toBe(before + 2);
  });

  it('turret fire is aimed bursts of three, alternating', () => {
    const w = world();
    const b = fighting(w);
    w.player.x = 40;
    const seen = new Set<number>();
    for (let i = 0; i < Math.round(2 / DT); i++) {
      step(w);
      for (const s of w.enemyShots.items) if (s.active) seen.add(s.id);
    }
    const shots = seen.size;
    // Each turret fires a 3-shot burst every 1.6 s, half an interval apart.
    expect(shots).toBeGreaterThanOrEqual(ROCK_HAULER.turret.burstCount * 2);
    expect(b.turretFired[0]).toBeLessThan(1.6);
    expect(b.turretFired[1]).toBeLessThan(1.6);
  });

  it('flung rocks leave the hopper intact, head for the player, and break on the hull when batted back', () => {
    const w = world();
    const b = fighting(w);
    w.player.x = 120;
    w.player.y = 340;
    b.flingT = DT / 2;
    step(w);
    const rock = w.asteroids.items.find((a) => a.active);
    expect(rock).toBeDefined();
    const r = rock as NonNullable<typeof rock>;
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(ROCK_HAULER.fling.speed, 0);
    expect(r.vy).toBeGreaterThan(0);
    run(w, 0.3);
    expect(r.active).toBe(true);
    expect(r.y).toBeGreaterThan(b.rig.y + ROCK_HAULER.fling.oy);
    // Repulsor-style reversal: straight back up into the hull.
    r.x = b.rig.x;
    r.y = b.rig.y + 40;
    r.vx = 0;
    r.vy = -200;
    run(w, 0.4);
    expect(r.active).toBe(false);
    expect(bossHp(w)).toBe(bossMaxHp(w));
  });

  it('flung rocks smash dumb enemies in their path', () => {
    const w = world();
    const b = fighting(w);
    b.flingT = DT / 2;
    step(w);
    const rock = w.asteroids.items.find((a) => a.active) as NonNullable<
      (typeof w.asteroids.items)[number]
    >;
    // A gnat flying up into the rock's path.
    const gnat = spawnEnemy(w, 'gnat', rock.x + rock.vx * 0.35, rock.y + rock.vy * 0.35 + 30, {
      vx: 0,
      vy: -70,
    }) as Enemy;
    run(w, 0.5);
    expect(gnat.active).toBe(false);
  });

  it('defeat emits bossDefeated and boss_die once, clears shots to salvage, then releases parts', () => {
    const w = world();
    const c = counter(w);
    const b = fighting(w);
    killTurrets(w, b);
    step(w);
    run(w, ROCK_HAULER.coreOpenTime + 0.1);
    for (let i = 0; i < 5; i++) spawnEnemyShot(w, { x: 40 + i * 30, y: 200, vx: 0, vy: 50 });
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, 1e6, 'player');
    damageEnemy(w, core, 1e6, 'player');
    expect(b.phase).toBe(Phase.Dying);
    step(w);
    expect(c.bossDefeated).toBe(1);
    expect(c['sfx:boss_die']).toBe(1);
    expect(w.run.bossDefeated).toBe(true);
    expect(w.enemyShots.items.filter((s) => s.active).length).toBe(0);
    expect(
      w.pickups.items.filter((p) => p.active && p.kind === 'salvage').length,
    ).toBeGreaterThanOrEqual(5);
    // Invulnerable while it dies; nothing else fires.
    run(w, ROCK_HAULER.deathTime - 0.1);
    expect(c.bossDefeated).toBe(1);
    expect(w.enemies.items.some((e) => e.active && e.isBoss)).toBe(true);
    run(w, 0.2);
    expect(w.enemies.items.some((e) => e.active && e.isBoss)).toBe(false);
    expect(activeBoss(w)).toBeNull();
    expect(c.bossDefeated).toBe(1);
    expect(c['sfx:boss_die']).toBe(1);
  });
});

/**
 * DPS-only fight: an invulnerable bot sits under the current target part
 * (left turret, right turret, then the core) at real ship speed, firing a
 * typical end-of-level loadout. Rocks and shots still soak up some fire.
 */
function simulateTimeToKill(loadout: [WeaponId, number][], seed = 'ttk'): number {
  const w = world(seed);
  const p = w.player;
  p.y = 320;
  p.speed = 120;
  for (const [id, level] of loadout) p.weapons.push({ id, level, cooldown: 0, state: 0 });
  const b = spawned(w);
  let t = 0;
  while (!b.done && b.phase !== Phase.Dying && t < 300) {
    p.invulnT = 1e9;
    const target = b.turrets.find((s) => b.rig.alive(s))?.enemy ?? b.core.enemy;
    if (target) {
      // Lead the strafe a little, like a player would.
      const dx = target.x + target.vx * ((p.y - target.y) / 240) - p.x;
      const max = p.speed * DT;
      p.prevX = p.x;
      p.x += Math.max(-max, Math.min(max, dx));
    }
    step(w);
    t += DT;
  }
  return t - ROCK_HAULER.entry.duration;
}

describe('Rock Hauler balance', () => {
  it('a typical end-of-level loadout kills it in 45–75 s of DPS-only fighting', () => {
    const loadouts: [WeaponId, number][][] = [
      [
        ['blaster', 3],
        ['spread', 3],
        ['lance', 2],
      ],
      [
        ['blaster', 3],
        ['spread', 3],
        ['seeker', 2],
      ],
    ];
    for (const l of loadouts) {
      const ttk = simulateTimeToKill(l);
      expect(ttk, l.map(([id, lv]) => `${id}${lv}`).join('+')).toBeGreaterThanOrEqual(45);
      expect(ttk).toBeLessThanOrEqual(75);
    }
  });
});
