import { describe, expect, it } from 'vitest';
import { BAND, LEVEL, NEAR_SLAB, ROSTER } from '../../../content/levels/corona';
import { ENEMY_FAIRNESS } from '../../../content/enemies';
import { FLARE } from '../../../content/obstacles';
import { spawnEnemy } from '../../../sim/spawn';
import type { Asteroid, Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import {
  flarePhase,
  inShade,
  obstaclesSystem,
  shadeSlabs,
  spawnShadeSlab,
  startFlare,
} from '../../obstacles';
import { LensPhase, mem, ShadeState } from './behaviors';
import { spawnBand, spawnNearSlab, spawnPodSlab } from './scripts';
import './index';

const DT = 1 / 60;

function world(seed = 'T38'): World {
  const w = createWorld(seed, { levelId: 'corona' });
  w.scrollSpeed = 30;
  w.player.alive = true;
  w.player.x = 120;
  w.player.y = 340;
  setEnemyShotSpeedMul(w, 1);
  return w;
}

function step(w: World, n = 1, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    each?.();
    w.tick++;
    w.time += DT;
    updateEnemies(w, DT);
    obstaclesSystem.update(w, DT);
  }
}

const shots = (w: World) => {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]!.active) n++;
  return n;
};

const P = (id: string) => {
  const b = ROSTER[id]!.behavior;
  if (b.kind !== 'custom') throw new Error('not custom');
  return b.p!;
};

/** Steps until the flare reaches `phase` (or fails after `max` s). */
function until(w: World, phase: string, max = 6): void {
  for (let i = 0; i < max / DT && flarePhase(w) !== phase; i++) step(w);
  expect(flarePhase(w)).toBe(phase);
}

describe('content', () => {
  it('timeline: Arc field test, practice flare, carrier, shields, magnet, a 2 HP pod, boss at 178', () => {
    const tl = LEVEL.timeline;
    const has = (pred: (e: (typeof tl)[number]) => boolean) => tl.some(pred);
    expect(has((e) => 'formation' in e && e.forceCapsule === 'arc' && e.t <= 10)).toBe(true);
    expect(LEVEL.guaranteeWeapon?.weapon).toBe('arc');
    expect(LEVEL.fieldTestWeapon).toBe('arc');
    expect(has((e) => 'flare' in e && e.flare.practice === true && e.t === 12)).toBe(true);
    expect(has((e) => 'spawn' in e && e.spawn.enemy === 'carrier' && e.t < 40)).toBe(true);
    expect(tl.filter((e) => 'drop' in e && e.drop.kind === 'shield').length).toBeGreaterThan(1);
    expect(has((e) => 'drop' in e && e.drop.kind === 'magnet' && e.t >= 115 && e.t <= 125)).toBe(
      true,
    );
    const pods = tl.filter((e) => 'escapePod' in e);
    expect(pods).toHaveLength(1);
    expect('escapePod' in pods[0]! && pods[0].escapePod.hp).toBe(2);
    expect(tl.find((e) => 'boss' in e)?.t).toBe(178);
    expect(has((e) => 'boss' in e && e.boss === 'co_heliostat')).toBe(true);
    for (const id of ['co_sunskimmer', 'co_shade', 'co_lens'])
      expect(has((e) => 'spawn' in e && e.spawn.enemy === id)).toBe(true);
  });

  it('every damaging flare has cover placed ahead of it (a slab or rock band)', () => {
    const tl = LEVEL.timeline;
    const flares = tl.filter((e) => 'flare' in e && e.flare.practice !== true).map((e) => e.t);
    expect(flares.length).toBeGreaterThanOrEqual(10);
    for (const t of flares) {
      const cover = tl.some(
        (e) =>
          e.t < t &&
          e.t > t - 10 &&
          ('shadeSlab' in e ||
            ('script' in e && (e.script === 'corona.slab' || e.script === 'corona.band'))),
      );
      expect(cover, `flare at ${t}`).toBe(true);
    }
    // The storm's repeating flares ride a lane of slabs.
    const storm = tl.find((e) => 'flares' in e);
    expect(storm).toBeDefined();
    const lane = tl.filter((e) => 'shadeSlab' in e && e.t >= 70 && e.t <= 105);
    expect(lane.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Sunskimmer', () => {
  it('crosses diagonally from its side, fires once at mid-screen, and is flare-immune', () => {
    const w = world();
    const e = spawnEnemy(w, 'co_sunskimmer', -10, 40)!;
    step(w, 2);
    expect(e.vx).toBeGreaterThan(0);
    expect(e.vy).toBeGreaterThan(0);
    const speed = Math.hypot(e.vx, e.vy);
    expect(speed).toBeCloseTo(P('co_sunskimmer').speed!, 0);
    let fired = 0;
    let at = 0;
    step(w, 150, () => {
      const before = shots(w);
      if (before > fired) {
        fired = before;
        at = e.x;
      }
    });
    expect(fired).toBe(1);
    expect(at).toBeGreaterThan(w.width / 2 - 6);
    expect(at).toBeLessThan(w.width / 2 + 6);

    // A burn: ×1.5 speed and no damage (a gnat beside it burns). The ship sits
    // in a slab's strip so the flare doesn't fizzle.
    const w3 = world('T38-burn');
    const s3 = spawnEnemy(w3, 'co_sunskimmer', 250, 160)!;
    const g = spawnEnemy(w3, 'gnat', 60, 160)!;
    spawnShadeSlab(w3, 120, 60, { vy: 0 });
    w3.player.x = 120;
    w3.player.y = 120;
    startFlare(w3, { warn: 0.5, burn: 1 });
    step(w3, 2);
    const calm = Math.hypot(s3.vx, s3.vy);
    until(w3, 'burn');
    step(w3, 2);
    expect(Math.hypot(s3.vx, s3.vy)).toBeCloseTo(calm * P('co_sunskimmer').burnMul!, 0);
    expect(s3.hp).toBe(ROSTER.co_sunskimmer!.hp);
    expect(g.active).toBe(false);
  });
});

describe('Shade', () => {
  it('descends, tucks into a strip high up, holds it, and leaves after 12 s', () => {
    const w = world();
    w.player.x = 200;
    spawnShadeSlab(w, 90, 40, { vy: 0 });
    const e = spawnEnemy(w, 'co_shade', 60, -10)!;
    step(w, 30);
    expect(e.vy).toBeGreaterThan(0);
    step(w, 4 / DT);
    expect(e.state).toBe(ShadeState.Hunt);
    expect(inShade(w, e.x, e.y, e.r)).toBe(true);
    expect(mem(e).tucked).toBe(true);
    // Strips below its ceiling aren't worth taking.
    const p = P('co_shade');
    expect(e.y).toBeLessThanOrEqual(p.maxY!);
    step(w, (p.leaveAfter! - e.t + 0.1) / DT);
    expect(e.state).toBe(ShadeState.Leave);
    expect(e.vy).toBeLessThan(0);
  });

  it('fires its aimed pair only from 24 px above the ship, never in its first 0.5 s', () => {
    const w = world();
    const e = spawnEnemy(w, 'co_shade', 120, 60)!;
    let first = -1;
    step(w, 4 / DT, () => {
      if (first < 0 && shots(w) > 0) first = e.t;
    });
    expect(first).toBeGreaterThanOrEqual(ENEMY_FAIRNESS.minAge);
    expect(shots(w) % 2).toBe(0);
  });
});

describe('Lens Drone', () => {
  function lensWorld(): { w: World; e: Enemy } {
    const w = world();
    // The ship in a strip, so the flare burns rather than fizzles.
    spawnShadeSlab(w, 120, 180, { vy: 0 });
    const e = spawnEnemy(w, 'co_lens', 60, -10)!;
    step(w, 3 / DT);
    expect(e.state).toBe(2);
    return { w, e };
  }

  it('holds near the top and stays quiet with no flare', () => {
    const { w, e } = lensWorld();
    expect(e.y).toBeCloseTo(P('co_lens').holdY!, 0);
    step(w, 3 / DT);
    expect(shots(w)).toBe(0);
    expect(mem(e).phase).toBe(LensPhase.Idle);
  });

  it('on a burn: a ≥ 0.5 s telegraph with the aim locked, then one beam of shots', () => {
    const { w, e } = lensWorld();
    const p = P('co_lens');
    expect(p.telegraph).toBeGreaterThanOrEqual(0.5);
    startFlare(w, { warn: 0.6, burn: 1.2 });
    until(w, 'burn');
    step(w, 1);
    const m = mem(e);
    expect(m.phase).toBe(LensPhase.Telegraph);
    const heading = m.heading;
    step(w, (p.telegraph! - 0.05) / DT);
    expect(shots(w)).toBe(0);
    expect(m.heading).toBe(heading);
    step(w, (p.beam! + 0.1) / DT);
    const n = shots(w);
    expect(n).toBeGreaterThanOrEqual(Math.floor(p.beam! / p.gap!) - 1);
    // Every beam shot leaves along the locked line.
    for (let i = 0; i < w.enemyShots.count; i++) {
      const b = w.enemyShots.items[i]!;
      if (!b.active) continue;
      const deg = (Math.atan2(b.vy, b.vx) * 180) / Math.PI;
      expect(deg).toBeCloseTo(heading, 3);
    }
    expect(m.phase).toBe(LensPhase.Idle);
    // One beam per burn.
    step(w, 0.4 / DT);
    expect(shots(w)).toBe(n);
  });

  it('ignores practice flares', () => {
    const { w, e } = lensWorld();
    startFlare(w, { warn: 0.6, burn: 1.2, practice: true });
    step(w, 2.5 / DT);
    expect(shots(w)).toBe(0);
    expect(mem(e).phase).toBe(LensPhase.Idle);
  });
});

describe('placed cover', () => {
  it('a band is three heavy large rocks spread across the playfield', () => {
    const w = world();
    expect(spawnBand(w)).toBe(BAND.n);
    const rocks: Asteroid[] = [];
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = w.asteroids.items[i]!;
      if (a.active) rocks.push(a);
    }
    expect(rocks).toHaveLength(BAND.n);
    rocks.sort((a, b) => a.x - b.x);
    for (const a of rocks) {
      expect(a.size).toBe('large');
      expect(a.hp).toBe(BAND.hp);
      expect(a.vy).toBe(w.scrollSpeed + BAND.speed);
    }
    expect(rocks[rocks.length - 1]!.x - rocks[0]!.x).toBeGreaterThan(140);
  });

  it('a flare slab enters near the player; the pod slab sits beside the pod', () => {
    const w = world();
    w.player.x = 200;
    for (let i = 0; i < 6; i++) spawnNearSlab(w);
    for (const s of shadeSlabs(w)) {
      if (!s.active) continue;
      expect(Math.abs(s.x - 200)).toBeLessThanOrEqual(NEAR_SLAB.spread);
      expect(s.x).toBeLessThanOrEqual(w.width - NEAR_SLAB.margin);
      expect(s.vy).toBe(w.scrollSpeed);
    }
    const w2 = world();
    expect(spawnPodSlab(w2, 150)).toBe(true);
    const s = shadeSlabs(w2).find((x) => x.active)!;
    // Toward the middle, not over the pod (so the pod is in the light).
    expect(s.x).toBeLessThan(150);
    expect(Math.abs(s.x - 150)).toBeGreaterThan(20 + 6);
  });

  it('a flare burns gnats in the light, not ones in a slab shadow', () => {
    const w = world();
    spawnShadeSlab(w, 120, 100, { vy: 0 });
    w.player.y = 200;
    const lit = spawnEnemy(w, 'gnat', 40, 150)!;
    const shaded = spawnEnemy(w, 'gnat', 120, 150, { vy: 0 })!;
    startFlare(w, { warn: 0.5, burn: 0.5 });
    // Pin them so they stay put through the flare.
    step(w, 1.2 / DT, () => {
      lit.y = 150;
      shaded.y = 150;
      lit.vy = shaded.vy = 0;
    });
    expect(FLARE.enemyDamage).toBeGreaterThan(1);
    expect(lit.active).toBe(false);
    expect(shaded.active).toBe(true);
  });
});
