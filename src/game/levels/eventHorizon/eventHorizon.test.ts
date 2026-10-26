import { describe, expect, it } from 'vitest';
import { BUOY_P, LANCER_P, ORBITER_P, PERIHELION } from '../../../content/levels/eventHorizon';
import { cleanupSystem } from '../../../sim/cleanup';
import { collisionSystem } from '../../../sim/collision';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { isPinned } from '../../../sim/scroll';
import { spawnEnemy } from '../../../sim/spawn';
import type { Anomaly, Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, attachBoss, spawnBoss, updateBoss } from '../../boss';
import { runLevelScript } from '../../director';
import { updateEnemies } from '../../enemies';
import { isCollapsing, isFieldOnly, obstaclesSystem, spawnBlackHole } from '../../obstacles';
import { buoyFields, fieldAlive } from './behaviors';
import { Dive, Lance, Orbit, Perihelion, PeriPhase } from './index';
import { massiveSystem } from './scripts';

const DT = 1 / 60;

function world(seed = 'T28'): World {
  const w = createWorld(seed, { levelId: 'eventHorizon' });
  w.scrollSpeed = 34;
  w.player.x = 120;
  w.player.y = 360;
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
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

function shots(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]!.active) n++;
  return n;
}

function holes(w: World): Anomaly[] {
  return w.anomalies.items.slice(0, w.anomalies.count).filter((a) => a.active);
}

describe('Orbiter', () => {
  it('spirals in to its orbit radius around the hole, fires outward fans, then leaves', () => {
    const w = world();
    w.player.invulnT = 1e9;
    const h = spawnBlackHole(w, 120, 120, { vy: 0, variant: 'standard' }) as Anomaly;
    const e = spawnEnemy(w, 'hz_orbiter', 120, 120 - 78) as Enemy;
    step(w);
    expect(e.state).toBe(Orbit.Orbiting);
    run(w, ORBITER_P.enter + 0.2);
    expect(Math.hypot(e.x - h.x, e.y - h.y)).toBeCloseTo(ORBITER_P.radius, 0);
    // It keeps the radius while circling.
    const a0 = Math.atan2(e.y - h.y, e.x - h.x);
    run(w, 1);
    expect(Math.hypot(e.x - h.x, e.y - h.y)).toBeCloseTo(ORBITER_P.radius, 0);
    expect(Math.atan2(e.y - h.y, e.x - h.x)).not.toBeCloseTo(a0, 1);
    expect(shots(w)).toBeGreaterThan(0);
    run(w, ORBITER_P.orbitTime);
    expect(e.state).toBe(Orbit.Leaving);
    expect(e.vy).toBeGreaterThan(0);
  });

  it('peels off once its hole sinks low, and never fires near the player', () => {
    const w = world();
    w.player.invulnT = 1e9;
    const h = spawnBlackHole(w, 120, 150, { vy: 30, variant: 'standard' }) as Anomaly;
    const e = spawnEnemy(w, 'hz_orbiter', 120, 150 - 60) as Enemy;
    w.player.x = 120;
    w.player.y = 230;
    run(w, ORBITER_P.firstFire + 0.4);
    expect(shots(w)).toBe(0);
    run(w, (ORBITER_P.leaveBelowY - h.y) / 30 + 0.2);
    expect(e.state).toBe(Orbit.Leaving);
  });

  it('the orbiters script rings the nearest hole, never on top of the player', () => {
    const w = world();
    spawnBlackHole(w, 120, 150, { vy: 0, variant: 'massive' });
    w.player.x = 120;
    w.player.y = 150 + ORBITER_P.radius + 24;
    runLevelScript(w, 'eventHorizon.orbiters', { x: 120, n: 4, dir: -1 });
    const os = w.enemies.items.filter((e) => e.active && e.defId === 'hz_orbiter');
    expect(os).toHaveLength(4);
    for (const o of os) {
      expect(Math.hypot(o.x - 120, o.y - 150)).toBeCloseTo(ORBITER_P.radius + 24, 0);
      expect(Math.hypot(o.x - w.player.x, o.y - w.player.y)).toBeGreaterThan(40);
      expect(o.ax).toBe(-1);
    }
  });
});

describe('Lancer', () => {
  it('descends, settles, telegraphs a locked line ≥ 0.5 s, then dashes along it', () => {
    const w = world();
    w.player.invulnT = 1e9;
    w.player.x = 60;
    const e = spawnEnemy(w, 'hz_lancer', 140, -12) as Enemy;
    const seen: number[] = [];
    let teleStart = -1;
    let teleEnd = -1;
    run(w, 4, () => {
      if (seen[seen.length - 1] !== e.state) seen.push(e.state);
      if (e.state === Lance.Telegraph && teleStart < 0) teleStart = w.time;
      if (e.state === Lance.Dash && teleEnd < 0) teleEnd = w.time;
      if (e.state === Lance.Telegraph) w.player.x = 200; // moving doesn't drag the line
    });
    expect(seen.slice(0, 5)).toEqual([
      Lance.Init,
      Lance.Descend,
      Lance.Settle,
      Lance.Telegraph,
      Lance.Dash,
    ]);
    expect(teleEnd - teleStart).toBeGreaterThanOrEqual(0.5);
    expect(teleEnd - teleStart).toBeCloseTo(LANCER_P.telegraph, 1);
    // Locked toward where the player was (left and down), at dash speed.
    expect(e.ax).toBeLessThan(0);
    expect(e.ay).toBeGreaterThan(0);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(LANCER_P.dashSpeed, 0);
  });
});

describe('Gravity Buoy', () => {
  it('carries a field-only anomaly that collapses when it is killed', () => {
    const w = world();
    const e = spawnEnemy(w, 'hz_buoy', 100, 40) as Enemy;
    run(w, 1);
    const f = holes(w);
    expect(f).toHaveLength(1);
    const a = f[0]!;
    expect(isFieldOnly(a)).toBe(true);
    expect(Math.hypot(a.x - e.x, a.y - e.y)).toBeLessThan(0.5);
    expect(e.vy).toBeCloseTo(w.scrollSpeed, 5);
    damageEnemy(w, e, e.hp, 'player');
    step(w);
    expect(isCollapsing(a)).toBe(true);
    run(w, BUOY_P.collapse + 0.1);
    expect(holes(w)).toHaveLength(0);
    expect(buoyFields(w).some(fieldAlive)).toBe(false);
  });
});

describe('level scripts', () => {
  it('collapse takes every unpinned hole and leaves pinned ones; massive settles', () => {
    const w = world();
    runLevelScript(w, 'eventHorizon.massive', { x: 120 });
    const pinned = spawnBlackHole(w, 60, 100, { vy: 0 }) as Anomaly;
    // isPinned needs pinAnomaly; the boss does it. Here the hole just has vy 0.
    expect(isPinned(pinned)).toBe(false);
    const m = holes(w).find((a) => a !== pinned) as Anomaly;
    for (let i = 0; i < 60 * 8; i++) {
      massiveSystem.update(w, DT);
      step(w);
    }
    expect(m.y).toBeGreaterThan(60);
    expect(Math.abs(m.vy)).toBeLessThan(5);
    runLevelScript(w, 'eventHorizon.collapse', {});
    expect(isCollapsing(m)).toBe(true);
  });
});

describe('Perihelion', () => {
  function fighting(w: World): Perihelion {
    attachBoss(w);
    const b = spawnBoss(w, PERIHELION.id);
    if (!(b instanceof Perihelion)) throw new Error('no boss');
    w.player.invulnT = 1e9;
    run(w, PERIHELION.entry.duration + 0.05);
    return b;
  }

  it('brings a pinned massive hole at (120, 150) that grows during the entry', () => {
    const w = world();
    attachBoss(w);
    const b = spawnBoss(w, PERIHELION.id) as Perihelion;
    const h = b.liveHole() as Anomaly;
    expect(h).not.toBeNull();
    expect(isPinned(h)).toBe(true);
    expect(h.x).toBe(120);
    expect(h.y).toBe(150);
    const r0 = h.radius;
    run(w, PERIHELION.hole.growTime + 0.1);
    expect(h.radius).toBeGreaterThan(r0 * 5);
    expect(h.y).toBe(150);
  });

  it('orbits the hole on the design ellipse; pods wrecked → opening → slingshot', () => {
    const w = world();
    const b = fighting(w);
    expect(b.phase).toBe(PeriPhase.Orbit);
    const o = PERIHELION.orbit;
    let maxDev = 0;
    run(w, 4, () => {
      const nx = (b.rig.x - b.hx) / o.rx;
      const ny = (b.rig.y - b.hy) / o.ry;
      maxDev = Math.max(maxDev, Math.abs(Math.hypot(nx, ny) - 1));
    });
    expect(maxDev).toBeLessThan(0.02);
    expect(shots(w)).toBeGreaterThan(0);
    b.wreckPods(w);
    step(w);
    expect(b.phase).toBe(PeriPhase.Opening);
    expect(b.core.targetable).toBe(false);
    run(w, PERIHELION.coreOpenTime + 0.05);
    expect(b.phase).toBe(PeriPhase.Slingshot);
    expect(b.core.targetable).toBe(true);
  });

  it('telegraphs each dive ≥ 0.5 s, then swings through the player row and back to the orbit', () => {
    const w = world();
    const b = fighting(w);
    b.wreckPods(w);
    w.player.x = 110;
    w.player.y = 320;
    let teleStart = -1;
    let diveStart = -1;
    let diveEnd = -1;
    let lowest = 0;
    run(w, 14, () => {
      if (b.dive === Dive.Telegraph && teleStart < 0) teleStart = w.time;
      if (b.dive === Dive.Diving && diveStart < 0) diveStart = w.time;
      if (diveStart > 0 && diveEnd < 0) {
        lowest = Math.max(lowest, b.rig.y);
        if (b.dive === Dive.None) diveEnd = w.time;
      }
    });
    expect(teleStart).toBeGreaterThan(0);
    expect(diveStart - teleStart).toBeGreaterThanOrEqual(0.5);
    expect(diveEnd).toBeGreaterThan(diveStart);
    expect(lowest).toBeGreaterThan(300);
    // Back on the ellipse after the swing.
    const o = PERIHELION.orbit;
    expect(Math.hypot((b.rig.x - b.hx) / o.rx, (b.rig.y - b.hy) / o.ry)).toBeCloseTo(1, 1);
  });

  it('core kill: bossDefeated once, the hole collapses, then the parts and hole are gone', () => {
    const w = world();
    let defeated = 0;
    w.events.on('bossDefeated', () => defeated++);
    const b = fighting(w);
    b.wreckPods(w);
    run(w, PERIHELION.coreOpenTime + 0.1);
    damageEnemy(w, b.core.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.phase).toBe(PeriPhase.Dying);
    expect(defeated).toBe(1);
    const h = b.liveHole() as Anomaly;
    expect(isCollapsing(h)).toBe(true);
    run(w, PERIHELION.deathTime + 0.1);
    expect(b.done).toBe(true);
    expect(activeBoss(w)).toBeNull();
    expect(holes(w)).toHaveLength(0);
    expect(w.enemies.items.some((e) => e.active && e.isBoss)).toBe(false);
    expect(defeated).toBe(1);
  });

  it('armor: the shut core and the entry swallow damage', () => {
    const w = world();
    attachBoss(w);
    const b = spawnBoss(w, PERIHELION.id) as Perihelion;
    const pod = b.pods[0]!.enemy as Enemy;
    damageEnemy(w, pod, 5, 'player');
    expect(pod.hp).toBe(PERIHELION.parts[0]!.hp);
    run(w, PERIHELION.entry.duration + 0.05);
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, 5, 'player');
    expect(core.hp).toBe(PERIHELION.parts[2]!.hp);
    damageEnemy(w, pod, 5, 'player');
    expect(pod.hp).toBe(PERIHELION.parts[0]!.hp - 5);
  });
});
