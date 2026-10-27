import { describe, expect, it } from 'vitest';
import { HELIOSTAT } from '../../../content/levels/corona';
import { cleanupSystem } from '../../../sim/cleanup';
import { collisionSystem } from '../../../sim/collision';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import type { Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { bossHp, bossMaxHp, spawnBoss, updateBoss } from '../../boss';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import { flarePhase, flareState, inShade, obstaclesSystem, shadeSlabs } from '../../obstacles';
import { BeamState, Heliostat, HelioPhase } from './heliostat';
import './index';

const DT = 1 / 60;

function world(seed = 'T38h'): World {
  const w = createWorld(seed, { levelId: 'corona' });
  w.scrollSpeed = 30;
  w.player.x = 120;
  w.player.y = 340;
  // The fizzle check reads the ship's speed (initPlayer isn't run here).
  w.player.speed = 120;
  setEnemyShotSpeedMul(w, 1);
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

function fighting(w: World): Heliostat {
  const b = spawnBoss(w, HELIOSTAT.id);
  if (!(b instanceof Heliostat)) throw new Error('no boss');
  run(w, HELIOSTAT.entry.duration + 0.05);
  return b;
}

function wreck(w: World, b: Heliostat, n: number): void {
  let k = 0;
  for (const s of b.mirrors) {
    if (k >= n) break;
    if (b.rig.alive(s)) {
      damageEnemy(w, s.enemy as Enemy, (s.enemy as Enemy).hp, 'player');
      k++;
    }
  }
  step(w);
}

const shots = (w: World) => {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]!.active) n++;
  return n;
};

/** Keeps the ship alive and out of the way (the tests watch the boss, not the dodge). */
function shield(w: World): void {
  w.player.alive = true;
  w.player.invulnT = 1;
}

describe('Heliostat', () => {
  it('enters invulnerable, then fights with the hull registered as a shade caster', () => {
    const w = world();
    const b = spawnBoss(w, HELIOSTAT.id) as Heliostat;
    expect(b.phaseName()).toBe('entry');
    const m = b.mirrors[0]!.enemy as Enemy;
    expect(b.targetable(m, b.mirrors[0]!)).toBe(false);
    run(w, HELIOSTAT.entry.duration + 0.05, () => shield(w));
    expect(b.phase).toBe(HelioPhase.P1);
    expect(b.targetable(m, b.mirrors[0]!)).toBe(true);
    // The core is armored until the furnace.
    const core = b.core.enemy as Enemy;
    expect(b.targetable(core, b.core)).toBe(false);
    const hp = core.hp;
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(hp);
    // Right under the hull is shade.
    expect(inShade(w, b.rig.x, b.rig.y + 60, 3)).toBe(true);
    expect(inShade(w, b.rig.x + 80, b.rig.y + 60, 3)).toBe(false);
    expect(bossMaxHp(w)).toBe(4 * 45 + 200);
    expect(bossHp(w)).toBe(bossMaxHp(w));
  });

  it('phase 1: a pair telegraphs ≥ 0.5 s, sweeps a beam, and the pairs alternate', () => {
    const w = world();
    const b = fighting(w);
    const pairOn = () =>
      b.beam.map((s, i) => (s !== BeamState.Off ? b.pairOf(i) : -1)).filter((p) => p >= 0);
    step(w);
    expect(b.beam.filter((s) => s === BeamState.Telegraph)).toHaveLength(2);
    const first = pairOn()[0];
    const before = shots(w);
    run(w, HELIOSTAT.beam.telegraph - 0.1, () => shield(w));
    expect(shots(w)).toBe(before);
    expect(HELIOSTAT.beam.telegraph).toBeGreaterThanOrEqual(0.5);
    run(w, 1, () => shield(w));
    expect(shots(w)).toBeGreaterThan(before);
    expect(b.beam.filter((s) => s === BeamState.On)).toHaveLength(2);
    // The sweep covers ±arc around the slant.
    for (let i = 0; i < b.mirrors.length; i++) {
      if (b.beam[i] === BeamState.Off) continue;
      expect(Math.abs((b.to[i] as number) - (b.from[i] as number))).toBeCloseTo(
        HELIOSTAT.beam.arc * 2,
        5,
      );
    }
    run(w, HELIOSTAT.beam.cycle - 1.4, () => shield(w));
    expect(pairOn()).toHaveLength(2);
    expect(pairOn()[0]).not.toBe(first);
  });

  it('drops a slab into the lower half before each flare, beside the ship', () => {
    const w = world();
    const b = fighting(w);
    const fd = HELIOSTAT.flare;
    run(w, fd.first - fd.slabLead + 0.05, () => shield(w));
    const live = () => shadeSlabs(w).filter((s) => s.active);
    expect(live()).toHaveLength(1);
    expect(flarePhase(w)).toBe('idle');
    run(w, fd.slabLead, () => shield(w));
    expect(flarePhase(w)).toBe('warn');
    expect(flareState(w)!.warn).toBe(fd.warn);
    const s = live()[0]!;
    expect(s.y).toBeGreaterThanOrEqual(fd.landY[0]);
    expect(s.vy).toBe(fd.drift);
    expect(Math.abs(s.x - w.player.x)).toBeGreaterThanOrEqual(fd.minDx - 0.5);
    expect(b.flaresStarted).toBe(1);
    // It holds still while the light is up, so its own shadow does too.
    const x0 = b.rig.x;
    run(w, 1, () => shield(w));
    expect(b.rig.x).toBe(x0);
    run(w, fd.every, () => shield(w));
    expect(b.flaresStarted).toBe(2);
  });

  it('three mirrors down: SOLAR FURNACE opens the core, the spiral, two slabs, 7 s flares', () => {
    const w = world();
    const toasts: string[] = [];
    w.events.on('toast', (p) => void toasts.push(p.text));
    const b = fighting(w);
    wreck(w, b, 2);
    expect(b.phase).toBe(HelioPhase.P1);
    wreck(w, b, 1);
    expect(b.phase).toBe(HelioPhase.Furnace);
    expect(b.phaseName()).toBe('furnace');
    expect(toasts).toContain('SOLAR FURNACE');
    const core = b.core.enemy as Enemy;
    expect(b.targetable(core, b.core)).toBe(true);
    // Spiral: 6-way rings, 0.2 s apart, 8 of them, then a pause.
    const ring = HELIOSTAT.spiral;
    let n0 = shots(w);
    // (the first ring comes 1 s in)
    run(w, 2.1, () => shield(w));
    const burst = shots(w) - n0;
    expect(burst % ring.arms).toBe(0);
    expect(burst).toBeGreaterThanOrEqual(ring.arms * 5);
    // Flares now every 7 s, each after two slabs.
    const started = b.flaresStarted;
    let slabs = 0;
    run(w, HELIOSTAT.flare.everyFurnace * 2 + 0.2, () => {
      shield(w);
      slabs = Math.max(slabs, shadeSlabs(w).filter((s) => s.active).length);
    });
    expect(b.flaresStarted - started).toBeGreaterThanOrEqual(2);
    expect(slabs).toBeGreaterThanOrEqual(2);
    n0 = shots(w);
    expect(n0).toBeGreaterThan(0);
  });

  it('furnace: the last mirror bends one beam through each burn', () => {
    const w = world();
    const b = fighting(w);
    wreck(w, b, 3);
    const last = b.mirrors.findIndex((s) => b.rig.alive(s));
    expect(last).toBeGreaterThanOrEqual(0);
    let telegraphAt = -1;
    let burnAt = -1;
    let onInBurn = false;
    run(w, HELIOSTAT.flare.everyFurnace + 1, () => {
      shield(w);
      if (telegraphAt < 0 && b.beam[last] === BeamState.Telegraph) telegraphAt = w.time;
      if (burnAt < 0 && flarePhase(w) === 'burn') burnAt = w.time;
      if (flarePhase(w) === 'burn' && b.beam[last] === BeamState.On) onInBurn = true;
    });
    expect(telegraphAt).toBeGreaterThan(0);
    expect(burnAt - telegraphAt).toBeGreaterThanOrEqual(0.5);
    expect(onInBurn).toBe(true);
  });

  it('the core kill: dying, mirrors shatter, the flare fades, bossDefeated once, then done', () => {
    const w = world();
    let defeated = 0;
    w.events.on('bossDefeated', () => void defeated++);
    const b = fighting(w);
    wreck(w, b, 3);
    run(w, HELIOSTAT.flare.everyFurnace - 0.5, () => shield(w));
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, core.hp, 'player');
    step(w);
    expect(b.phase).toBe(HelioPhase.Dying);
    expect(defeated).toBe(1);
    expect(b.glintN).toBeGreaterThan(0);
    expect(['idle', 'cool']).toContain(flarePhase(w));
    run(w, HELIOSTAT.deathTime + 0.1);
    expect(b.done).toBe(true);
    expect(defeated).toBe(1);
  });
});
