import { beforeEach, describe, expect, it } from 'vitest';
import { ASTEROID_SIZES, BUBBLE, FLARE, PORTAL, SHADE } from '../../content/obstacles';
import {
  clearHooks,
  getTimelineAction,
  isSolidAt,
  raycastSolid,
  timeScaleAt,
} from '../../sim/hooks';
import { bulletsSystem } from '../../sim/motion';
import { spawnEnemy, spawnEnemyShot, spawnPickup, spawnPlayerShot } from '../../sim/spawn';
import type { Bullet } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import {
  bubbleTimeScale,
  flareState,
  flipFlickering,
  flipIsSlow,
  hazardLog,
  inShade,
  isFlareBurning,
  nearestShadeSpot,
  obstaclesSystem,
  partnerOf,
  portalOptIn,
  portalPairs,
  registerAnomalyHooks,
  registerHazardIIHooks,
  registerShadeCaster,
  setPortalEnd,
  sinceShipPorted,
  spawnBubble,
  spawnPortalPair,
  spawnRock,
  spawnShadeSlab,
  startFlare,
  startFlares,
  swapPortals,
} from './index';

const DT = 1 / 60;
const LARGE_R = ASTEROID_SIZES.large.r;

function world(): World {
  const w = createWorld('t33');
  w.scrollSpeed = 0;
  const p = w.player;
  p.alive = true;
  p.shield = p.maxShield = 5;
  p.speed = 120;
  p.r = 3;
  return w;
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    w.player.prevX = w.player.x;
    w.player.prevY = w.player.y;
    bulletsSystem.update(w, DT);
    obstaclesSystem.update(w, DT);
  }
}

function rock(w: World, x: number, y: number, size: 'small' | 'medium' | 'large' = 'large') {
  return spawnRock(w, { size, x, y, vx: 0, vy: 0, hp: 0, spin: 0 })!;
}

beforeEach(() => {
  clearHooks();
  registerAnomalyHooks();
  registerHazardIIHooks();
});

describe('shade geometry', () => {
  it('a large rock shades a strip of its width minus 2, 160 px down from its bottom edge', () => {
    const w = world();
    rock(w, 100, 100);
    const half = LARGE_R - SHADE.stripInset / 2;
    const top = 100 + LARGE_R;
    expect(inShade(w, 100, top + 40, 3)).toBe(true);
    // Edges: the whole hitbox must be inside.
    expect(inShade(w, 100 + half - 3, top + 40, 3)).toBe(true);
    expect(inShade(w, 100 + half - 2.5, top + 40, 3)).toBe(false);
    expect(inShade(w, 100, top + 3, 3)).toBe(true);
    expect(inShade(w, 100, top + 2.5, 3)).toBe(false);
    expect(inShade(w, 100, top + SHADE.stripLength - 3, 3)).toBe(true);
    expect(inShade(w, 100, top + SHADE.stripLength - 2, 3)).toBe(false);
    // Above the rock and off to the side: light.
    expect(inShade(w, 100, 60, 3)).toBe(false);
    expect(inShade(w, 140, top + 40, 3)).toBe(false);
  });

  it('small rocks cast nothing; slabs and registered hulls do', () => {
    const w = world();
    rock(w, 40, 100, 'small');
    expect(inShade(w, 40, 130, 1)).toBe(false);
    spawnShadeSlab(w, 180, 50, { vy: 0 });
    expect(inShade(w, 180, 50 + 5 + 30, 3)).toBe(true);
    expect(inShade(w, 180 + 19 - 2, 90, 3)).toBe(false);
    const hull = spawnEnemy(w, 'dummy', 100, 200, { r: 10, hp: 50, isBoss: true })!;
    registerShadeCaster(w, hull.id, 30);
    expect(inShade(w, 100 + 25, 260, 3)).toBe(true);
    w.enemies.release(hull);
    expect(inShade(w, 100 + 25, 260, 3)).toBe(false);
  });

  it('nearestShadeSpot finds the closest point a hitbox fits', () => {
    const w = world();
    rock(w, 60, 100);
    const out = { x: 0, y: 0, d: 0 };
    expect(nearestShadeSpot(w, 120, 200, 3, out)).toBe(true);
    expect(out.x).toBeCloseTo(60 + LARGE_R - 1 - 3);
    expect(out.y).toBe(200);
    expect(nearestShadeSpot(w, 120, 200, 3, out, 0, 20)).toBe(false);
  });
});

describe('flares', () => {
  it('hits the ship once per flare in the light, never in the shade', () => {
    const w = world();
    rock(w, 120, 200);
    w.player.x = 30;
    w.player.y = 300;
    // A strip is in reach (90 px away, 120 px/s, 2 s warn), so it doesn't fizzle.
    expect(startFlare(w, { warn: 1, burn: 1.2 })).toBe(true);
    expect(flareState(w)?.fizzled).toBe(false);
    for (let i = 0; i < 160; i++) {
      w.player.invulnT = 0; // even with no invulnerability, one hit per flare
      step(w);
    }
    expect(w.player.shield).toBe(5 - FLARE.playerDamage);

    w.player.x = 120;
    w.player.y = 300;
    startFlare(w, { warn: 1, burn: 1.2 });
    for (let i = 0; i < 160; i++) {
      w.player.invulnT = 0;
      step(w);
    }
    expect(w.player.shield).toBe(5 - FLARE.playerDamage);
  });

  it('practice flares never hurt', () => {
    const w = world();
    w.player.x = 30;
    startFlare(w, { warn: 0.2, burn: 1, practice: true });
    step(w, 120);
    expect(w.player.shield).toBe(5);
  });

  it('burns non-boss enemies in the light for 3, once; shade and bosses are spared', () => {
    const w = world();
    rock(w, 120, 100);
    w.player.x = 120;
    w.player.y = 200;
    const lit = spawnEnemy(w, 'dummy', 40, 150, { hp: 10 })!;
    const shaded = spawnEnemy(w, 'dummy', 120, 160, { hp: 10, r: 6 })!;
    const boss = spawnEnemy(w, 'dummy', 200, 150, { hp: 10, isBoss: true })!;
    startFlare(w, { warn: 0.1, burn: 1 });
    step(w, 90);
    expect(lit.hp).toBe(10 - FLARE.enemyDamage);
    expect(shaded.hp).toBe(10);
    expect(boss.hp).toBe(10);
  });

  it('escape pods in the light lose 1 HP', () => {
    const w = world();
    rock(w, 120, 100);
    w.player.x = 120;
    w.player.y = 200;
    const pod = spawnPickup(w, {
      kind: 'escapePod',
      x: 40,
      y: 150,
      vx: 0,
      vy: 0,
      r: 6,
      payload: 'ines',
      amount: 3,
      ttl: 99,
    })!;
    startFlare(w, { warn: 0.1, burn: 1 });
    step(w, 90);
    expect(pod.amount).toBe(2);
  });

  it('fizzles (and logs it) when no strip is within reach', () => {
    const w = world();
    rock(w, 230, 100);
    w.player.x = 20;
    w.player.y = 300;
    startFlare(w, { warn: 1.2 });
    expect(flareState(w)?.fizzled).toBe(true);
    expect(hazardLog(w).at(-1)).toMatch(/fizzle/);
    step(w, 200);
    expect(w.player.shield).toBe(5);

    // Within 100 px horizontally but too slow to get there before the burn.
    w.player.x = 140;
    w.player.speed = 20;
    startFlare(w, { warn: 1.2 });
    expect(flareState(w)?.fizzled).toBe(true);
    w.player.speed = 120;
    step(w, 200);
    startFlare(w, { warn: 1.2 });
    expect(flareState(w)?.fizzled).toBe(false);
  });

  it('the first two flares of a run get the long intro warning', () => {
    const w = world();
    rock(w, 120, 200);
    w.player.x = 120;
    w.player.y = 300;
    const warns: number[] = [];
    for (let i = 0; i < 3; i++) {
      startFlare(w);
      warns.push(flareState(w)!.warn);
      step(w, 300);
    }
    expect(warns).toEqual([FLARE.introWarn, FLARE.introWarn, FLARE.warn]);
  });

  it('`flares` repeats every N s until the cutoff, through the timeline action', () => {
    const w = world();
    rock(w, 120, 200);
    w.player.x = 120;
    w.player.y = 300;
    getTimelineAction('flares')!(w, { every: 4, until: 9, warn: 1, burn: 1 });
    let starts = 0;
    let prev = 'idle';
    for (let i = 0; i < 60 * 20; i++) {
      step(w);
      const ph = flareState(w)!.phase;
      if (ph === 'warn' && prev !== 'warn') starts++;
      prev = ph;
    }
    expect(starts).toBe(3); // t = 0, 4, 8
    startFlares(w, { every: 2, until: -1 });
  });

  it('isFlareBurning only during a real burn', () => {
    const w = world();
    rock(w, 120, 200);
    w.player.x = 120;
    w.player.y = 300;
    startFlare(w, { warn: 0.5, burn: 0.5 });
    step(w, 10);
    expect(isFlareBurning(w)).toBe(false);
    step(w, 30);
    expect(isFlareBurning(w)).toBe(true);
  });
});

describe('shade slabs', () => {
  it('drift with the scroll, absorb shots from both sides, and are solid', () => {
    const w = world();
    w.scrollSpeed = 30;
    const slab = spawnShadeSlab(w, 120, 100)!;
    spawnPlayerShot(w, { x: 120, y: 140, vx: 0, vy: -400 });
    spawnEnemyShot(w, { x: 100, y: 60, vx: 0, vy: 300 });
    const ric = spawnPlayerShot(w, { x: 130, y: 140, vx: 0, vy: -400, weaponId: 'ricochet' })!;
    step(w, 20);
    expect(w.playerShots.items.filter((b) => b.active && b !== ric)).toHaveLength(0);
    expect(w.enemyShots.items.filter((b) => b.active)).toHaveLength(0);
    expect(ric.active).toBe(true);
    expect(slab.y).toBeCloseTo(100 + 30 * 20 * DT);
    expect(isSolidAt(w, slab.x + 19, slab.y)).toBe(true);
    expect(isSolidAt(w, slab.x + 21, slab.y)).toBe(false);
    const hit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };
    expect(raycastSolid(w, slab.x, slab.y + 50, slab.x, slab.y - 50, hit)).toBe(true);
    expect(hit.ny).toBe(1);
    expect(hit.y).toBeCloseTo(slab.y + 5);
  });
});

describe('portals', () => {
  it('a body crossing into a ring leaves the partner with the same velocity, r + 2 out', () => {
    const w = world();
    spawnPortalPair(w, 100, 200, 60, 80, { color: 'cyan' });
    const b = spawnPlayerShot(w, { x: 100, y: 230, vx: 0, vy: -300 })!;
    let ported = -1;
    for (let i = 0; i < 20 && ported < 0; i++) {
      step(w);
      if (b.y < 150) ported = i;
    }
    expect(ported).toBeGreaterThanOrEqual(0);
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(-300);
    expect(b.x).toBeCloseTo(60);
    expect(b.y).toBeCloseTo(80 - (PORTAL.r + PORTAL.exitPad));
  });

  it('no ping-pong: a body that comes straight back is held by the cooldown', () => {
    const w = world();
    // Exit B sits right on the shot's path back: without the cooldown it would bounce forever.
    spawnPortalPair(w, 100, 200, 100, 120, {});
    const b = spawnPlayerShot(w, { x: 100, y: 240, vx: 0, vy: -240 })!;
    let ports = 0;
    let lastY = b.y;
    for (let i = 0; i < 40; i++) {
      step(w);
      if (b.y - lastY > 10 || lastY - b.y > 10) ports++;
      lastY = b.y;
    }
    expect(ports).toBe(1);
  });

  it('rocks and pickups teleport; enemies only when opted in', () => {
    const w = world();
    spawnPortalPair(w, 100, 200, 200, 60, {});
    const r = rock(w, 100, 170, 'small');
    r.vy = 120;
    const plain = spawnEnemy(w, 'dummy', 100, 230)!;
    const blinker = spawnEnemy(w, 'dummy', 100, 240)!;
    portalOptIn(w, blinker.id);
    for (let i = 0; i < 30; i++) {
      // No enemy system here: move them by hand, the way it would.
      for (const e of [plain, blinker]) {
        e.prevX = e.x;
        e.prevY = e.y;
        e.y -= 120 * DT;
      }
      step(w);
    }
    expect(r.x).toBeCloseTo(200);
    expect(plain.x).toBe(100);
    expect(blinker.x).toBeCloseTo(200);
  });

  it('the ship goes through an open end, never a closed one, with a 1 s cooldown', () => {
    const w = world();
    const pair = spawnPortalPair(w, 120, 300, 120, 100, {})!;
    const p = w.player;
    p.x = 120;
    p.y = 330;
    p.vy = -120;
    const fly = (n: number) => {
      for (let i = 0; i < n; i++) {
        w.tick++;
        w.time += DT;
        p.prevX = p.x;
        p.prevY = p.y;
        p.y += p.vy * DT;
        obstaclesSystem.update(w, DT);
      }
    };
    fly(20);
    expect(p.y).toBeLessThan(100);
    expect(sinceShipPorted(w)).toBeLessThan(0.5);

    // Partner off screen: closed. The ship passes over the ring.
    setPortalEnd(w, pair, 'b', 120, -60);
    p.y = 330;
    fly(80);
    expect(pair.a.open).toBe(false);
    expect(p.y).toBeLessThan(300);
    expect(p.y).toBeGreaterThan(150);
  });

  it('swapPortals re-pairs after the flicker', () => {
    const w = world();
    const p = spawnPortalPair(w, 40, 100, 40, 300, { color: 'cyan' })!;
    const q = spawnPortalPair(w, 200, 100, 200, 300, { color: 'orange' })!;
    const pb = p.b;
    const qb = q.b;
    expect(swapPortals(w, p, q)).toBe(true);
    step(w, Math.floor(PORTAL.swapTime * 60) - 2);
    expect(partnerOf(p.a)).toBe(pb);
    step(w, 4);
    expect(partnerOf(p.a)).toBe(qb);
    expect(partnerOf(q.a)).toBe(pb);
    expect(portalPairs(w).filter((x) => x.active)).toHaveLength(2);
  });
});

describe('time bubbles', () => {
  it('scale bodies inside; bubble × bullet time compose for enemy shots', () => {
    const w = world();
    spawnBubble(w, 120, 200, { kind: 'slow', r: 52, vy: 0 });
    expect(timeScaleAt(w, 120, 200)).toBeCloseTo(BUBBLE.slow);
    expect(timeScaleAt(w, 120, 300)).toBe(1);
    w.enemyBulletTimeScale = 0.5;
    const es = spawnEnemyShot(w, { x: 120, y: 200, vx: 0, vy: 120 })!;
    const ps = spawnPlayerShot(w, { x: 110, y: 200, vx: 0, vy: -120 })!;
    const out = spawnEnemyShot(w, { x: 20, y: 380, vx: 0, vy: -120 })!;
    step(w);
    expect(es.y - 200).toBeCloseTo(120 * DT * BUBBLE.slow * 0.5);
    expect(200 - ps.y).toBeCloseTo(120 * DT * BUBBLE.slow);
    expect(380 - out.y).toBeCloseTo(120 * DT * 0.5);
    // Overlapping bubbles multiply.
    spawnBubble(w, 140, 200, { kind: 'fast', r: 40, vy: 0 });
    expect(bubbleTimeScale(w, 130, 200)).toBeCloseTo(BUBBLE.slow * BUBBLE.fast);
  });

  it('rocks age and move at the bubble rate', () => {
    const w = world();
    spawnBubble(w, 120, 200, { kind: 'fast', r: 52, vy: 0 });
    const r = rock(w, 120, 200, 'small');
    r.vx = 60;
    step(w);
    expect(r.x - 120).toBeCloseTo(60 * DT * BUBBLE.fast);
  });

  it('flip bubbles alternate every 3 s with a 0.6 s flicker before each switch', () => {
    expect(flipIsSlow(0)).toBe(true);
    expect(flipIsSlow(2.99)).toBe(true);
    expect(flipIsSlow(3.01)).toBe(false);
    expect(flipIsSlow(6.01)).toBe(true);
    expect(flipFlickering(2.3)).toBe(false);
    expect(flipFlickering(2.45)).toBe(true);
    expect(flipFlickering(3.1)).toBe(false);
    const w = world();
    spawnBubble(w, 120, 200, { kind: 'flip', r: 52, vy: 0 });
    step(w, 60);
    expect(timeScaleAt(w, 120, 200)).toBeCloseTo(BUBBLE.slow);
    step(w, 150);
    expect(timeScaleAt(w, 120, 200)).toBeCloseTo(BUBBLE.fast);
  });

  it('expire after their ttl and when they drift off', () => {
    const w = world();
    const b = spawnBubble(w, 120, 200, { kind: 'slow', r: 36, ttl: 0.5, vy: 0 })!;
    step(w, 40);
    expect(b.active).toBe(false);
    expect(timeScaleAt(w, 120, 200)).toBe(1);
  });
});

describe('timeline actions', () => {
  it('registers every T33 kind', () => {
    for (const k of ['flare', 'flares', 'shadeSlab', 'portal', 'bubble'])
      expect(getTimelineAction(k)).toBeTypeOf('function');
  });

  it('portal and bubble events drift with the scroll by default', () => {
    const w = world();
    w.scrollSpeed = 40;
    getTimelineAction('portal')!(w, { a: [60, -20], b: [180, -60], color: 'lime' });
    getTimelineAction('bubble')!(w, { kind: 'slow', x: 'rand', r: 36 });
    getTimelineAction('shadeSlab')!(w, { x: 80 });
    const pair = portalPairs(w).find((p) => p.active)!;
    expect(pair.color).toBe('lime');
    expect(pair.a.vy).toBe(40);
    step(w, 60);
    expect(pair.a.y).toBeCloseTo(20, 0);
  });
});

/** Shots out of the pool, for the zero-allocation check below. */
function liveShots(w: World): Bullet[] {
  return w.playerShots.items.filter((b) => b.active);
}

describe('allocation', () => {
  it('ticking every hazard allocates no new objects per tick (heap stays flat)', () => {
    const w = world();
    rock(w, 120, 100);
    spawnShadeSlab(w, 60, 80, { vy: 0 });
    spawnPortalPair(w, 60, 250, 180, 150, {});
    spawnBubble(w, 120, 200, { kind: 'flip', r: 52, vy: 0 });
    startFlares(w, { every: 2, until: 999, warn: 0.5, burn: 0.5 });
    for (let i = 0; i < 40; i++)
      spawnPlayerShot(w, { x: 20 + i * 5, y: 390, vx: 0, vy: -200, ttl: 99 });
    step(w, 60);
    expect(liveShots(w).length).toBeGreaterThan(0);
    const g = globalThis as { gc?: () => void };
    if (g.gc === undefined) return; // run with --expose-gc for the heap check
    g.gc();
    const before = process.memoryUsage().heapUsed;
    step(w, 600);
    g.gc();
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(256 * 1024);
  });
});
