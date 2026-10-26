import { describe, expect, it } from 'vitest';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../../content/weapons';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { damageEnemy } from '../../sim/damage';
import { bulletsSystem, updateBullets } from '../../sim/motion';
import { spawnAsteroid, spawnEnemy, spawnEnemyShot, spawnPickup } from '../../sim/spawn';
import { rebuildSpatialHash } from '../../sim/spatialHash';
import type { Bullet, Enemy, WeaponInstance } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import {
  applyUpgradeCore,
  applyWeaponPickup,
  attachWeapons,
  sandboxAction,
  updateWeapons,
  weaponSystem,
} from './index';

const DT = 1 / 60;

function world(slots = 4): World {
  const w = createWorld('T09');
  w.player.maxWeaponSlots = slots;
  return w;
}

function give(w: World, id: WeaponId, level = 1): WeaponInstance {
  const inst = { id, level, cooldown: 0, state: 0 };
  w.player.weapons.push(inst);
  return inst;
}

function count(w: World, event: 'sfx', id: string): { n: number } {
  const c = { n: 0 };
  w.events.on(event, (e) => {
    if (e.id === id) c.n++;
  });
  return c;
}

function shots(w: World): Bullet[] {
  return w.playerShots.items.slice(0, w.playerShots.count).filter((b) => b.active);
}

/** The documented order, minus systems that aren't ours. */
function step(w: World): void {
  w.tick++;
  w.time += DT;
  weaponSystem.update(w, DT);
  bulletsSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

describe('weapon system', () => {
  it('fires on cooldown, scaled by fireRateMul', () => {
    for (const [mul, expected] of [
      [1, 15],
      [2, 30],
    ] as const) {
      const w = world();
      give(w, 'blaster');
      w.player.stats.fireRateMul = mul;
      const c = count(w, 'sfx', 'shot_blaster');
      for (let i = 0; i < 360; i++) updateWeapons(w, DT); // 6 s at 0.4 s cooldown
      expect(Math.abs(c.n - expected)).toBeLessThanOrEqual(1);
    }
  });

  it('does not fire while the player is dead', () => {
    const w = world();
    give(w, 'blaster');
    w.player.alive = false;
    for (let i = 0; i < 60; i++) updateWeapons(w, DT);
    expect(w.playerShots.count).toBe(0);
  });

  it('applies damageMul to shots', () => {
    const w = world();
    give(w, 'lance');
    w.player.stats.damageMul = 1.5;
    updateWeapons(w, DT);
    expect(shots(w)[0]?.damage).toBe(4.5);
  });

  it('blaster: single, twin at ±4, triple adds the center', () => {
    const xs = (level: number) => {
      const w = world();
      give(w, 'blaster', level);
      updateWeapons(w, DT);
      return shots(w)
        .map((b) => b.x - w.player.x)
        .sort((a, b) => a - b);
    };
    expect(xs(1)).toEqual([0]);
    expect(xs(3)).toEqual([-4, 4]);
    expect(xs(5)).toEqual([-5, 0, 5]);
  });

  it('spread: 3-way at ±12°, 5-way from L4, short range', () => {
    const angles = (level: number) => {
      const w = world();
      give(w, 'spread', level);
      updateWeapons(w, DT);
      return shots(w).map((b) => Math.round((Math.atan2(b.vx, -b.vy) * 180) / Math.PI));
    };
    expect(angles(1)).toEqual([-12, 0, 12]);
    expect(angles(4)).toHaveLength(5);
    const l1 = WEAPONS.spread.levels[0];
    const range = (l1?.speed ?? 0) * (l1?.ttl ?? 0);
    expect(range).toBeGreaterThan(400 * 0.6);
    expect(range).toBeLessThan(400 * 0.8);
  });

  it('Blaster L1 pops a 1 HP asteroid in one shot', () => {
    const w = world();
    give(w, 'blaster');
    const a = spawnAsteroid(w, { x: w.player.x, y: w.player.y - 80, vx: 0, vy: 0, r: 6, hp: 1 });
    let destroyedBy = 0;
    w.events.on('asteroidDestroyed', () => (destroyedBy = w.tick));
    for (let i = 0; i < 60 && destroyedBy === 0; i++) step(w);
    expect(a?.active).toBe(false);
    // First volley at tick 1; 80 px at 240 px/s is ~20 ticks.
    expect(destroyedBy).toBeLessThan(30);
  });
});

describe('pulse lance pierce', () => {
  it('has pierce 2, 3, 4, 4, 5 by level', () => {
    expect(WEAPONS.lance.levels.map((l) => l.pierce)).toEqual([2, 3, 4, 4, 5]);
  });

  it.each([1, 2, 3, 4, 5])('L%i passes through pierce+1 enemies', (level) => {
    const w = world();
    const inst = give(w, 'lance', level);
    const enemies: Enemy[] = [];
    for (let i = 0; i < 10; i++) {
      const e = spawnEnemy(w, 'dummy', w.player.x, w.player.y - 40 - i * 20, { hp: 100 });
      if (e) enemies.push(e);
    }
    rebuildSpatialHash(w);
    updateWeapons(w, DT);
    inst.cooldown = 99; // one bolt only
    for (let i = 0; i < 90; i++) step(w);
    const hit = enemies.filter((e) => e.hp < 100).length;
    expect(hit).toBe((WEAPONS.lance.levels[level - 1]?.pierce ?? 0) + 1);
  });
});

describe('seeker pods', () => {
  it('targets the closest enemy ahead of the ship over a closer one behind', () => {
    const w = world();
    const p = w.player;
    spawnEnemy(w, 'dummy', p.x + 10, p.y + 15);
    const ahead = spawnEnemy(w, 'dummy', p.x - 30, p.y - 100) as Enemy;
    rebuildSpatialHash(w);
    give(w, 'seeker', 2);
    updateWeapons(w, DT);
    const s = shots(w);
    expect(s).toHaveLength(2);
    for (const b of s) expect(b.targetId).toBe(ahead.id);
    // Launched sideways from opposite wings.
    expect(Math.sign(s[0]?.vx ?? 0)).toBe(-Math.sign(s[1]?.vx ?? 0));
  });

  it('retargets when its target dies', () => {
    const w = world();
    const p = w.player;
    const first = spawnEnemy(w, 'dummy', p.x, p.y - 60, { hp: 50 }) as Enemy;
    const second = spawnEnemy(w, 'dummy', p.x + 60, p.y - 150, { hp: 50 }) as Enemy;
    rebuildSpatialHash(w);
    give(w, 'seeker');
    updateWeapons(w, DT);
    const m = shots(w)[0] as Bullet;
    expect(m.targetId).toBe(first.id);
    damageEnemy(w, first, 999, 'player');
    w.enemies.compact();
    rebuildSpatialHash(w);
    updateBullets(w, w.playerShots, DT);
    expect(m.targetId).toBe(second.id);
  });
});

describe('orbit drones', () => {
  it('deals contact damage once per 0.25 s per enemy', () => {
    const w = world();
    give(w, 'orbitDrones', 3);
    // Big enough to touch every drone all the time.
    const e = spawnEnemy(w, 'dummy', w.player.x, w.player.y, { hp: 100, r: 30 }) as Enemy;
    for (let i = 0; i < 60; i++) {
      rebuildSpatialHash(w);
      updateWeapons(w, DT);
    }
    expect(100 - e.hp).toBe(4);
  });

  it('eats enemy shots it touches', () => {
    const w = world();
    const inst = give(w, 'orbitDrones');
    const c = count(w, 'sfx', 'drone_hit');
    updateWeapons(w, DT);
    // Lead drone sits at angle inst.state, radius 22.
    const r = WEAPONS.orbitDrones.levels[0]?.orbitRadius ?? 0;
    const x = w.player.x + Math.cos(inst.state) * r;
    const y = w.player.y + Math.sin(inst.state) * r;
    const shot = spawnEnemyShot(w, { x, y, vx: 0, vy: 0 }) as Bullet;
    const missed = spawnEnemyShot(w, { x: 10, y: 10, vx: 0, vy: 0 }) as Bullet;
    collisionSystem.update(w, DT);
    expect(shot.active).toBe(false);
    expect(missed.active).toBe(true);
    expect(c.n).toBe(1);
  });

  function sparks(w: World): Bullet[] {
    return shots(w).filter((b) => b.sprite === 'pbullet_spark');
  }

  it('fire no sparks below L3', () => {
    const w = world();
    give(w, 'orbitDrones', 2);
    for (let i = 0; i < 300; i++) updateWeapons(w, DT);
    expect(w.playerShots.count).toBe(0);
  });

  for (const [level, perDrone, n] of [
    [3, 0.9, 3],
    [4, 0.7, 3],
    [5, 0.5, 5],
  ] as const) {
    it(`L${level}: each of ${n} drones sparks every ${perDrone} s, staggered`, () => {
      const w = world();
      give(w, 'orbitDrones', level);
      const fired: number[] = [];
      for (let t = 0; t < 600; t++) {
        const before = w.playerShots.count;
        updateWeapons(w, DT);
        const added = w.playerShots.count - before;
        // Staggered: never more than one spark in a tick.
        expect(added).toBeLessThanOrEqual(1);
        if (added === 1) fired.push(t);
      }
      // 10 s → n sparks per `perDrone` seconds.
      expect(Math.abs(fired.length - (10 * n) / perDrone)).toBeLessThanOrEqual(1);
      const gap = Math.round((perDrone / n) * 60);
      for (let i = 1; i < fired.length; i++)
        expect(Math.abs((fired[i] as number) - (fired[i - 1] as number) - gap)).toBeLessThanOrEqual(
          1,
        );
      const s = sparks(w)[0] as Bullet;
      expect(s.damage).toBe(1);
      expect(s.weaponId).toBe('orbitDrones');
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(220);
    });
  }

  it('aim sparks at the nearest targetable enemy in range, else straight up', () => {
    const w = world();
    const p = w.player;
    give(w, 'orbitDrones', 3);
    // Out of range (> 150 px from every drone): straight up.
    spawnEnemy(w, 'dummy', p.x + 200, p.y - 120, { hp: 50 });
    // Boss armor is never a target.
    const armor = spawnEnemy(w, 'dummy', p.x - 40, p.y - 10, { hp: 50, isBoss: true }) as Enemy;
    armor.maxHp = 0;
    rebuildSpatialHash(w);
    updateWeapons(w, DT);
    const up = sparks(w)[0] as Bullet;
    expect(up.vx).toBeCloseTo(0);
    expect(up.vy).toBeCloseTo(-220);

    const near = spawnEnemy(w, 'dummy', p.x + 60, p.y - 60, { hp: 50 }) as Enemy;
    rebuildSpatialHash(w);
    for (let i = 0; i < 30 && sparks(w).length < 2; i++) updateWeapons(w, DT);
    const aimed = sparks(w)[1] as Bullet;
    const dx = near.x - aimed.x;
    const dy = near.y - aimed.y;
    // Velocity parallel to the line to the target, and toward it.
    expect(Math.abs(aimed.vx * dy - aimed.vy * dx)).toBeLessThan(1e-6 * 220 * Math.hypot(dx, dy));
    expect(aimed.vx * dx + aimed.vy * dy).toBeGreaterThan(0);
  });

  it('sparks go through the normal damage pipeline', () => {
    const w = world();
    const p = w.player;
    give(w, 'orbitDrones', 5);
    const e = spawnEnemy(w, 'dummy', p.x, p.y - 100, { hp: 1000 }) as Enemy;
    for (let i = 0; i < 120; i++) {
      rebuildSpatialHash(w);
      step(w);
    }
    expect(e.hp).toBeLessThan(1000);
  });

  it('vanish while the player is dead', () => {
    const w = world();
    give(w, 'orbitDrones');
    updateWeapons(w, DT);
    w.player.alive = false;
    updateWeapons(w, DT);
    const shot = spawnEnemyShot(w, { x: w.player.x, y: w.player.y, vx: 0, vy: 0, r: 40 }) as Bullet;
    collisionSystem.update(w, DT);
    expect(shot.active).toBe(true);
  });
});

describe('pickup resolution', () => {
  function log(w: World): string[] {
    const out: string[] = [];
    w.events.on('weaponAdded', (e) => out.push(`added ${e.weaponId}`));
    w.events.on('weaponLeveled', (e) => out.push(`leveled ${e.weaponId} ${e.level}`));
    w.events.on('toast', (e) => out.push(`toast ${e.text}`));
    w.events.on('sfx', (e) => out.push(`sfx ${e.id}`));
    return out;
  }

  it('adds an unowned weapon at L1 when a slot is free', () => {
    const w = world(2);
    give(w, 'blaster');
    const out = log(w);
    expect(applyWeaponPickup(w, 'spread')).toBe('added');
    expect(w.player.weapons.map((i) => `${i.id}${i.level}`)).toEqual(['blaster1', 'spread1']);
    expect(out).toEqual(['added spread', 'sfx weapon_up', 'toast SPREAD CANNON LV1']);
  });

  it('levels an owned weapon', () => {
    const w = world(1);
    give(w, 'blaster', 2);
    const out = log(w);
    expect(applyWeaponPickup(w, 'blaster')).toBe('leveled');
    expect(w.player.weapons[0]?.level).toBe(3);
    expect(out).toEqual(['leveled blaster 3', 'sfx weapon_up', 'toast BLASTER LV3']);
  });

  it('converts at max level, with full slots, or for an unknown id', () => {
    for (const [setup, id] of [
      [(w: World) => give(w, 'lance', 5), 'lance'],
      [(w: World) => give(w, 'blaster'), 'seeker'],
      [() => undefined, 'nope'],
    ] as const) {
      const w = world(1);
      setup(w);
      w.player.stats.salvageMul = 1.2;
      const out = log(w);
      expect(applyWeaponPickup(w, id)).toBe('converted');
      expect(w.run.salvage).toBe(30);
      expect(w.run.score).toBe(100);
      expect(out).toEqual(['toast +30 SALVAGE']);
    }
  });

  it('upgrade core levels the lowest non-maxed weapon, ties to the oldest', () => {
    const w = world(4);
    give(w, 'blaster', 5);
    give(w, 'spread', 3);
    give(w, 'lance', 2);
    give(w, 'seeker', 2);
    expect(applyUpgradeCore(w)).toBe('leveled');
    expect(w.player.weapons.map((i) => i.level)).toEqual([5, 3, 3, 2]);
    expect(applyUpgradeCore(w)).toBe('leveled');
    expect(w.player.weapons.map((i) => i.level)).toEqual([5, 3, 3, 3]);
    expect(applyUpgradeCore(w)).toBe('leveled');
    expect(w.player.weapons.map((i) => i.level)).toEqual([5, 4, 3, 3]);
  });

  it('upgrade core converts when nothing can level', () => {
    const empty = world();
    expect(applyUpgradeCore(empty)).toBe('converted');
    const maxed = world();
    give(maxed, 'blaster', 5);
    expect(applyUpgradeCore(maxed)).toBe('converted');
    expect(maxed.run.salvage).toBe(25);
  });

  it('resolves weapon and upgrade pickups from pickupCollected', () => {
    const w = world(3);
    attachWeapons(w);
    attachWeapons(w); // idempotent
    const emit = (kind: 'weapon' | 'upgrade' | 'shield', payload = '') => {
      const p = spawnPickup(w, { kind, x: 0, y: 0, payload });
      if (p) w.events.emit('pickupCollected', { pickup: p });
    };
    emit('weapon', 'seeker');
    emit('upgrade');
    emit('shield');
    expect(w.player.weapons.map((i) => `${i.id}${i.level}`)).toEqual(['seeker2']);
  });
});

describe('sandbox and budget', () => {
  it('F6 maxes all five weapons regardless of slots', () => {
    const w = world(0);
    sandboxAction(w, 5);
    expect(w.player.weapons.map((i) => `${i.id}${i.level}`)).toEqual(
      WEAPON_ORDER.map((id) => `${id}5`),
    );
  });

  it('a maxed loadout stays well inside the 400-shot pool with 40 enemies', () => {
    const w = world();
    sandboxAction(w, 5);
    w.player.stats.fireRateMul = 1.3;
    for (let i = 0; i < 40; i++) {
      spawnEnemy(w, 'dummy', 20 + (i % 10) * 22, 30 + Math.floor(i / 10) * 30, { hp: 1e6 });
    }
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      step(w);
      if (w.playerShots.count > peak) peak = w.playerShots.count;
    }
    expect(w.playerShots.droppedSpawns).toBe(0);
    expect(peak).toBeLessThan(200);
  });
});
