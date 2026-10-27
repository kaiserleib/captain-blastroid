import { afterEach, describe, expect, it } from 'vitest';
import { ARC_CHAIN_RANGE, WEAPONS, type WeaponId } from '../../content/weapons';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { registerSolidQuery, type RayHit } from '../../sim/hooks';
import { bulletsSystem } from '../../sim/motion';
import { spawnAsteroid, spawnEnemy, spawnEnemyShot } from '../../sim/spawn';
import { rebuildSpatialHash } from '../../sim/spatialHash';
import type { Bullet, Enemy, WeaponInstance } from '../../sim/types';
import { createWorld, WORLD_W, type World } from '../../sim/world';
import { traceArc } from './arc';
import { eraseEnemyShots } from './flak';
import { sandboxAction, weaponSystem } from './index';
import { weaponsState } from './state';

const DT = 1 / 60;

function world(): World {
  const w = createWorld('T35');
  w.player.maxWeaponSlots = 6;
  return w;
}

function give(w: World, id: WeaponId, level = 1): WeaponInstance {
  const inst = { id, level, cooldown: 0, state: 0 };
  w.player.weapons.push(inst);
  return inst;
}

function step(w: World): void {
  // Auto-aim reads last tick's hash; the first tick has none yet.
  if (w.tick === 0) rebuildSpatialHash(w);
  w.tick++;
  w.time += DT;
  weaponSystem.update(w, DT);
  bulletsSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

function shots(w: World, weaponId: string): Bullet[] {
  return w.playerShots.items
    .slice(0, w.playerShots.count)
    .filter((b) => b.active && b.weaponId === weaponId);
}

function dummy(w: World, x: number, y: number, hp = 100): Enemy {
  return spawnEnemy(w, 'dummy', x, y, { hp, vx: 0, vy: 0 }) as Enemy;
}

describe('Arc Coil', () => {
  it('chains to the nearest unhit enemy within 50 px of the last link', () => {
    const w = world();
    const p = w.player;
    const a = dummy(w, p.x, p.y - 60);
    const b = dummy(w, p.x + 30, p.y - 60); // 30 px from a
    const c = dummy(w, p.x + 30, p.y - 60 - (ARC_CHAIN_RANGE - 5)); // 45 from b
    dummy(w, p.x + 30 + ARC_CHAIN_RANGE + 40, p.y - 60); // out of every hop
    rebuildSpatialHash(w);
    const n = traceArc(w, p.x, p.y, 90, 4);
    const s = weaponsState(w);
    expect(n).toBe(3);
    expect(Array.from(s.arcIds.slice(0, n))).toEqual([a.id, b.id, c.id]);
  });

  it('never hits the same enemy twice in one arc, even when it is the only one near', () => {
    const w = world();
    const p = w.player;
    const a = dummy(w, p.x, p.y - 40);
    const b = dummy(w, p.x + 20, p.y - 40);
    give(w, 'arc', 4); // 1 + 3 links
    step(w);
    expect(a.hp).toBe(100 - 2);
    expect(b.hp).toBe(100 - 2);
  });

  it('respects range and holds its charge when nothing is in reach', () => {
    const w = world();
    const p = w.player;
    const inst = give(w, 'arc', 1);
    const far = dummy(w, p.x, p.y - 12 - 95); // L1 range 90 from the nose
    for (let i = 0; i < 30; i++) step(w);
    expect(far.hp).toBe(100);
    expect(inst.cooldown).toBe(0);
    far.y = p.y - 80;
    step(w); // the hash catches up
    step(w);
    expect(far.hp).toBe(98);
    expect(inst.cooldown).toBeGreaterThan(1);
  });

  it('L5 deals 3 and chains through a crowd', () => {
    const w = world();
    const p = w.player;
    const row: Enemy[] = [];
    for (let i = 0; i < 6; i++) row.push(dummy(w, p.x + i * 20, p.y - 50));
    give(w, 'arc', 5);
    step(w);
    expect(row.filter((e) => e.hp === 97)).toHaveLength(4);
  });
});

describe('Ricochet', () => {
  let undo: (() => void) | null = null;
  afterEach(() => {
    undo?.();
    undo = null;
  });

  it('alternates ±20° at L1 and fires twin/triple discs later', () => {
    const w = world();
    const inst = give(w, 'ricochet', 1);
    step(w);
    const first = shots(w, 'ricochet');
    expect(first).toHaveLength(1);
    const lv = WEAPONS.ricochet.levels[0]!;
    inst.cooldown = 0;
    step(w);
    const both = shots(w, 'ricochet');
    expect(Math.sign(both[0]!.vx)).toBe(-Math.sign(both[1]!.vx));
    expect(Math.abs(Math.atan2(both[0]!.vx, -both[0]!.vy))).toBeCloseTo(
      (lv.spread * Math.PI) / 180,
    );
    const w5 = world();
    give(w5, 'ricochet', 5);
    step(w5);
    expect(shots(w5, 'ricochet')).toHaveLength(3);
  });

  it('reflects off the side edges, counting bounces, then flies off', () => {
    const w = world();
    give(w, 'ricochet', 1); // 2 bounces
    w.player.x = WORLD_W - 20;
    step(w);
    const d = shots(w, 'ricochet')[0]!;
    w.player.weapons.length = 0;
    // Aim it flat so it ping-pongs between the walls.
    d.vx = 200;
    d.vy = -1;
    d.ttl = 100;
    let flips = 0;
    let last = Math.sign(d.vx);
    for (let i = 0; i < 400 && d.active; i++) {
      step(w);
      if (Math.sign(d.vx) !== last) {
        flips++;
        last = Math.sign(d.vx);
      }
    }
    expect(flips).toBe(2);
    expect(d.targetId).toBe(0);
    expect(d.active).toBe(false); // left the side after the last bounce
  });

  it('bounces off solid geometry through the raycastSolid hook', () => {
    const w = world();
    // A ceiling at y = 100.
    undo = registerSolidQuery({
      isSolidAt: (_w, _x, y) => y < 100,
      raycastSolid(_w, x0, y0, x1, y1, out: RayHit) {
        if (y1 >= 100 || y0 < 100) return false;
        const t = (y0 - 100) / (y0 - y1);
        out.x = x0 + (x1 - x0) * t;
        out.y = 100;
        out.nx = 0;
        out.ny = 1;
        out.t = t;
        return true;
      },
    });
    give(w, 'ricochet', 1);
    w.player.y = 160;
    step(w);
    const d = shots(w, 'ricochet')[0]!;
    w.player.weapons.length = 0;
    let minY = Infinity;
    for (let i = 0; i < 60; i++) {
      step(w);
      minY = Math.min(minY, d.y);
    }
    expect(minY).toBeGreaterThanOrEqual(99);
    expect(d.vy).toBeGreaterThan(0);
    expect(d.targetId).toBe(1);
  });

  it('bounces off indestructible rocks and still pierces 1 enemy', () => {
    const w = world();
    const rock = spawnAsteroid(w, {
      size: 'large',
      x: w.player.x,
      y: 200,
      vx: 0,
      vy: 0,
      r: 12,
      hp: 0,
    })!;
    give(w, 'ricochet', 1);
    w.player.y = 300;
    step(w);
    const d = shots(w, 'ricochet')[0]!;
    w.player.weapons.length = 0;
    d.vx = 0;
    d.vy = -200;
    const e = dummy(w, d.x, 260);
    for (let i = 0; i < 40; i++) step(w);
    expect(rock.active).toBe(true);
    expect(d.active).toBe(true);
    expect(d.vy).toBeGreaterThan(0);
    expect(d.targetId).toBe(1);
    expect(e.hp).toBe(98); // pierced it on the way up, never re-hit on the way down
    expect(d.pierce).toBe(0);
  });
});

describe('Flak', () => {
  it('bursts at 0.6 s into evenly spaced fragments', () => {
    const w = world();
    give(w, 'flak', 1);
    w.player.y = 380;
    step(w);
    const s = weaponsState(w);
    expect(s.shellOn[0]).toBe(1);
    let ticks = 1;
    while (s.shellOn[0] === 1 && ticks < 100) {
      step(w);
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(35);
    expect(ticks).toBeLessThanOrEqual(37);
    const frags = shots(w, 'flak');
    expect(frags).toHaveLength(6);
    const angles = frags.map((f) => Math.atan2(f.vy, f.vx)).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]! - angles[i - 1]!).toBeCloseTo(Math.PI / 3, 5);
    }
  });

  it('bursts early on contact; the hit body takes the impact, not every fragment', () => {
    const w = world();
    const p = w.player;
    const e = dummy(w, p.x, p.y - 40);
    const bystander = dummy(w, p.x + 20, p.y - 40);
    give(w, 'flak', 1);
    for (let i = 0; i < 30; i++) step(w);
    expect(e.hp).toBe(100 - WEAPONS.flak.levels[0]!.damage);
    expect(bystander.hp).toBeLessThan(100);
  });

  it('erases enemy bullets inside the erase radius only', () => {
    const w = world();
    const near = spawnEnemyShot(w, { x: 100, y: 100, vx: 0, vy: 0, r: 2 })!;
    const edge = spawnEnemyShot(w, { x: 100 + 13, y: 100, vx: 0, vy: 0, r: 2 })!;
    const far = spawnEnemyShot(w, { x: 100 + 20, y: 100, vx: 0, vy: 0, r: 2 })!;
    expect(eraseEnemyShots(w, 100, 100, 12)).toBe(2);
    expect(near.active).toBe(false);
    expect(edge.active).toBe(false);
    expect(far.active).toBe(true);
  });

  it('L5 fires two shells with an 18 px erase', () => {
    const w = world();
    give(w, 'flak', 5);
    step(w);
    const s = weaponsState(w);
    expect(s.shellOn[0]! + s.shellOn[1]!).toBe(2);
    expect(WEAPONS.flak.levels[4]!.eraseR).toBe(18);
  });
});

describe('six slots and the sandbox', () => {
  it('every weapon fires with six equipped', () => {
    const w = world();
    const p = w.player;
    const ids = ['blaster', 'spread', 'lance', 'arc', 'ricochet', 'flak'] as const;
    const list = ids.map((id) => give(w, id));
    dummy(w, p.x, p.y - 50);
    step(w);
    for (const inst of list) expect(inst.cooldown, inst.id).toBeGreaterThan(0);
  });

  it('F7–F9 grant and level the Act II weapons', () => {
    const w = world();
    sandboxAction(w, 6);
    sandboxAction(w, 7);
    sandboxAction(w, 8);
    sandboxAction(w, 8);
    expect(w.player.weapons.map((i) => `${i.id}${i.level}`)).toEqual([
      'arc1',
      'ricochet1',
      'flak2',
    ]);
  });
});
