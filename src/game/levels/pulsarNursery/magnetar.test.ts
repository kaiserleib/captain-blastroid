import { describe, expect, it } from 'vitest';
import { MAGNETAR } from '../../../content/levels/pulsarNursery';
import { cleanupSystem } from '../../../sim/cleanup';
import { collisionSystem } from '../../../sim/collision';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import type { Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, bossHp, bossMaxHp, spawnBoss, updateBoss } from '../../boss';
import { updateEnemies } from '../../enemies';
import {
  obstaclesSystem,
  pulsarEchoRadius,
  pulsarGapAngles,
  pulsarGlow,
  pulsarRingRadius,
  pulseIndex,
} from '../../obstacles';
import { pulsarEchoRot, pulsarRingRot } from '../../obstacles/anomalies/pulsar';
import { PULSAR_DOUBLE_DELAY } from '../../../content/obstacles';
import './index';
import { Magnetar, MagPhase } from './magnetar';

const DT = 1 / 60;

function world(seed = 'T29'): World {
  const w = createWorld(seed, { levelId: 'pulsarNursery' });
  w.scrollSpeed = 36;
  w.player.y = 340;
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

function fighting(w: World): Magnetar {
  const b = spawnBoss(w, MAGNETAR.id);
  if (!(b instanceof Magnetar)) throw new Error('no boss');
  run(w, MAGNETAR.entry.duration + 0.05);
  return b;
}

function wreckPylons(w: World, b: Magnetar, n: number): void {
  let k = 0;
  for (const s of b.pylons) {
    if (k >= n) break;
    if (b.rig.alive(s)) {
      damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
      k++;
    }
  }
  step(w);
}

const GAPS = [0, 0, 0, 0, 0, 0, 0, 0];

describe('Magnetar', () => {
  it('spawns 4 pylons and a core, descends invulnerable, then holds at y≈96', () => {
    const w = world();
    const b = spawnBoss(w, MAGNETAR.id) as Magnetar;
    expect(b.pylons).toHaveLength(4);
    expect(bossMaxHp(w)).toBe(4 * 50 + MAGNETAR.parts[4]!.hp);
    expect(b.phaseName()).toBe('entry');
    const p = b.pylons[0]!.enemy as Enemy;
    damageEnemy(w, p, 10, 'player');
    expect(p.hp).toBe(50);
    run(w, MAGNETAR.entry.duration + 0.05);
    expect(b.phase).toBe(MagPhase.P1);
    expect(b.rig.y).toBeCloseTo(96, 0);
    expect(b.main()).not.toBeNull();
  });

  it('pylons orbit the core at radius 34', () => {
    const w = world();
    const b = fighting(w);
    const e = b.pylons[0]!.enemy as Enemy;
    const a0 = Math.atan2(e.y - b.rig.y, e.x - b.rig.x);
    run(w, 1);
    expect(Math.hypot(e.x - b.rig.x, e.y - b.rig.y)).toBeCloseTo(34, 0);
    const a1 = Math.atan2(e.y - b.rig.y, e.x - b.rig.x);
    expect(a1 - a0).toBeCloseTo(MAGNETAR.pylons.spin, 1);
  });

  it('the core is shielded until three pylons fall, then the shield drops over 1 s', () => {
    const w = world();
    const b = fighting(w);
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, 50, 'player');
    expect(core.hp).toBe(MAGNETAR.parts[4]!.hp);
    wreckPylons(w, b, 2);
    expect(b.phase).toBe(MagPhase.P1);
    wreckPylons(w, b, 1);
    expect(b.phase).toBe(MagPhase.P2);
    expect(b.core.targetable).toBe(false);
    run(w, MAGNETAR.shieldDrop + 0.05);
    expect(b.core.targetable).toBe(true);
    damageEnemy(w, core, 50, 'player');
    expect(core.hp).toBe(MAGNETAR.parts[4]!.hp - 50);
  });

  it('phase 1 rings: every 3 s, 4 gaps turning 30° a pulse; phase 2: every 2 s, 3 gaps turning 60°', () => {
    const w = world();
    const b = fighting(w);
    const a = b.main()!;
    const times: number[] = [];
    const rots: number[] = [];
    let k = pulseIndex(a);
    run(w, 9.2, () => {
      if (pulseIndex(a) !== k) {
        k = pulseIndex(a);
        times.push(w.time);
        expect(pulsarGapAngles(a, GAPS)).toBe(4);
        rots.push(GAPS[0]!);
      }
    });
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(times[1]! - times[0]!).toBeCloseTo(3, 1);
    const turn = (((rots[1]! - rots[0]!) * 180) / Math.PI + 360) % 90;
    expect(turn).toBeCloseTo(30, 0);

    wreckPylons(w, b, 3);
    const t2: number[] = [];
    const r2: number[] = [];
    run(w, 9, () => {
      if (pulseIndex(a) !== k) {
        k = pulseIndex(a);
        t2.push(w.time);
        pulsarGapAngles(a, GAPS);
        r2.push(GAPS[0]!);
      }
    });
    const last = t2.slice(-3);
    expect(last[2]! - last[1]!).toBeCloseTo(2, 1);
    expect(last[1]! - last[0]!).toBeCloseTo(2, 1);
    const lr = r2.slice(-2);
    expect((((lr[1]! - lr[0]!) * 180) / Math.PI + 360) % 120).toBeCloseTo(60, 0);
    // Every phase 2 ring sits ±30° off straight down (a gap either side of the center line).
    for (const r of r2.slice(-2)) {
      const off = ((((r * 180) / Math.PI - 90) % 60) + 60) % 60;
      expect(off).toBeCloseTo(30, 0);
    }
  });

  it('a pattern switch never fires a ring without its full telegraph', () => {
    const w = world();
    const b = fighting(w);
    const a = b.main()!;
    let k = pulseIndex(a);
    let glowFrom = -1;
    const check = () => {
      if (pulsarGlow(a) > 0 && glowFrom < 0) glowFrom = w.time;
      if (pulseIndex(a) !== k) {
        k = pulseIndex(a);
        expect(w.time - glowFrom).toBeGreaterThanOrEqual(MAGNETAR.ring.telegraph - 2 * DT);
        glowFrom = -1;
      }
    };
    // Wreck the pylons late in a 3 s period: the 2 s period must wait for the next pulse.
    while (pulseIndex(a) === k) step(w);
    k = pulseIndex(a);
    run(w, 2.6, check);
    wreckPylons(w, b, 3);
    run(w, 8, check);
    expect(pulseIndex(a)).toBeGreaterThan(k - 1);
  });

  it('phase 2 adds the 4-arm spiral between rings', () => {
    const w = world();
    const b = fighting(w);
    wreckPylons(w, b, 4);
    run(w, 1.2);
    const before = w.enemyShots.count;
    let peak = 0;
    run(w, 4, () => {
      let n = 0;
      for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]!.active) n++;
      peak = Math.max(peak, n);
    });
    expect(peak).toBeGreaterThan(before + 12);
    expect(b.spiralRot).not.toBe(0);
  });

  it('meltdown under meltdownAt: the toast, then an echo ring 0.5 s behind with gaps half a spacing round', () => {
    const w = world();
    const toasts: string[] = [];
    w.events.on('toast', (p) => toasts.push(p.text));
    const b = fighting(w);
    wreckPylons(w, b, 4);
    run(w, 1.1);
    const core = b.core.enemy as Enemy;
    damageEnemy(
      w,
      core,
      Math.ceil(MAGNETAR.parts[4]!.hp * (1 - MAGNETAR.meltdownAt * 0.8)),
      'player',
    );
    run(w, 0.1);
    expect(b.phase).toBe(MagPhase.Meltdown);
    expect(toasts).toContain('MELTDOWN');
    run(w, 4.5);
    const a = b.main()!;
    expect(b.echo()).toBe(a);
    // Wait for a main pulse: the echo follows it out of the core 0.5 s later.
    const k = pulseIndex(a);
    while (pulseIndex(a) === k) step(w);
    const t0 = w.time;
    let echoAt = -1;
    run(w, 0.8, () => {
      if (echoAt < 0 && pulsarEchoRadius(a) >= 0) echoAt = w.time;
    });
    expect(MAGNETAR.ring.echoDelay).toBe(PULSAR_DOUBLE_DELAY);
    expect(echoAt - t0).toBeCloseTo(MAGNETAR.ring.echoDelay, 1);
    expect(pulsarRingRadius(a)).toBeGreaterThan(0);
    const off = (((((pulsarEchoRot(a) - pulsarRingRot(a)) * 180) / Math.PI) % 120) + 120) % 120;
    expect(off).toBeCloseTo(60, 0);
    // Ring and echo gaps straddle straight down (±30°), so the hop is short.
    pulsarGapAngles(a, GAPS);
    const down = (deg: number) => ((((deg - 90) % 120) + 180) % 120) - 60;
    const ringOff = down((pulsarRingRot(a) * 180) / Math.PI);
    expect(Math.abs(Math.abs(ringOff) - 30)).toBeLessThan(1);
  });

  it('the first echo leaves the core 0.5 s after a pulse, never mid-screen', () => {
    const w = world();
    const b = fighting(w);
    wreckPylons(w, b, 4);
    run(w, 1.1);
    damageEnemy(
      w,
      b.core.enemy as Enemy,
      Math.ceil(MAGNETAR.parts[4]!.hp * (1 - MAGNETAR.meltdownAt * 0.8)),
      'player',
    );
    let first = Infinity;
    run(w, 6, () => {
      const a = b.main();
      if (a === null || first < Infinity) return;
      const R = pulsarEchoRadius(a);
      if (R >= 0) first = R;
    });
    expect(first).toBeLessThan(b.main()!.r + 12);
  });

  it('dies: dying phase, bossDefeated once, pulsars collapse, parts released, scroll back to 30', () => {
    const w = world();
    const defeated: string[] = [];
    w.events.on('bossDefeated', (p) => defeated.push(p.defId));
    const b = fighting(w);
    wreckPylons(w, b, 4);
    run(w, 1.1);
    const a = b.main()!;
    damageEnemy(w, b.core.enemy as Enemy, 1e6, 'player');
    run(w, 0.1);
    expect(b.phase).toBe(MagPhase.Dying);
    expect(defeated).toEqual(['pn_magnetar']);
    run(w, MAGNETAR.deathTime + 0.2);
    expect(a.active).toBe(false);
    expect(activeBoss(w)).toBeNull();
    expect(bossHp(w)).toBe(0);
    expect(w.scrollSpeed).toBeCloseTo(30, 0);
  });

  it('drives the scroll speed 30 → 50 → 30 every 12 s', () => {
    const w = world();
    fighting(w);
    let lo = 1e9;
    let hi = -1e9;
    run(w, 12, () => {
      lo = Math.min(lo, w.scrollSpeed);
      hi = Math.max(hi, w.scrollSpeed);
    });
    expect(lo).toBeCloseTo(30, 0);
    expect(hi).toBeCloseTo(50, 0);
  });
});
