import { describe, expect, it } from 'vitest';
import { PULSAR_SONG_PERIOD } from '../../../audio/songs/pulsar';
import {
  BAR,
  GARDEN,
  LEVEL,
  lockedPhase,
  ROSTER,
  STREAKER_MIN_DX,
  VARIANT_PERIOD,
} from '../../../content/levels/pulsarNursery';
import { PULSAR_VARIANTS } from '../../../content/obstacles';
import { spawnEnemy } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import { obstaclesSystem, pulseIndex, spawnPulsar } from '../../obstacles';
import { mem, RayPhase, rayHeading, spawnStreakers, streakerLurkY, streakerX } from './behaviors';
import { gardenPulsars, gardenSystem, gardenY, startGarden } from './garden';
import './index';

const DT = 1 / 60;

function world(seed = 'T29b'): World {
  const w = createWorld(seed, { levelId: 'pulsarNursery' });
  w.scrollSpeed = 28;
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

describe('content', () => {
  it('locks to the pulsar song: BAR and the variant periods match their sources', () => {
    expect(BAR).toBe(PULSAR_SONG_PERIOD);
    for (const v of Object.keys(VARIANT_PERIOD) as (keyof typeof VARIANT_PERIOD)[])
      expect(VARIANT_PERIOD[v]).toBe(PULSAR_VARIANTS[v].period);
  });

  it('lockedPhase puts every pulse on the grid (plus the offset)', () => {
    for (const t of [0.5, 11, 22.3, 45, 84]) {
      for (const [period, off] of [
        [3, 0],
        [3, 1.5],
        [2, 0],
      ] as const) {
        const first = t + (period - lockedPhase(t, period, off));
        const k = (first - off) / period;
        expect(k).toBeCloseTo(Math.round(k), 9);
      }
    }
  });

  it('timeline: supply run, carrier, shield drops, magnet, pod, warning then the boss', () => {
    const tl = LEVEL.timeline;
    const has = (pred: (e: (typeof tl)[number]) => boolean) => tl.some(pred);
    expect(has((e) => 'formation' in e && e.forceCapsule === 'spread' && e.t <= 12)).toBe(true);
    expect(has((e) => 'spawn' in e && e.spawn.enemy === 'carrier' && e.t < 60)).toBe(true);
    expect(tl.filter((e) => 'drop' in e && e.drop.kind === 'shield').length).toBeGreaterThan(0);
    expect(has((e) => 'drop' in e && e.drop.kind === 'magnet')).toBe(true);
    expect(tl.filter((e) => 'escapePod' in e)).toHaveLength(1);
    const warn = tl.find((e) => 'bossWarning' in e)!;
    const boss = tl.find((e) => 'boss' in e)!;
    expect('boss' in boss && boss.boss).toBe('pn_magnetar');
    expect(boss.t - warn.t).toBeGreaterThanOrEqual(3);
    const scroll = tl.filter((e) => 'scroll' in e).map((e) => ('scroll' in e ? e.scroll.to : 0));
    expect(scroll).toEqual([70, 18, 36]);
    for (const id of Object.keys(ROSTER)) expect(id.startsWith('pn_')).toBe(true);
  });
});

describe('Pulse Drone', () => {
  it('rings on each pulse of the nearest pulsar, never in its first 0.5 s, silent low down', () => {
    const w = world();
    const a = spawnPulsar(w, 120, 60, { vy: 0, variant: 'steady' })!;
    const e = spawnEnemy(w, 'pn_drone', 60, 40)!;
    let k = pulseIndex(a);
    const pulses: number[] = [];
    const rings: number[] = [];
    let last = shots(w);
    step(w, 60 * 7, () => {
      if (pulseIndex(a) !== k) {
        k = pulseIndex(a);
        pulses.push(w.time);
      }
      const n = shots(w);
      if (n >= last + 10) rings.push(w.time);
      last = n;
    });
    expect(pulses.length).toBe(2);
    expect(rings.length).toBe(2);
    for (let i = 0; i < 2; i++) expect(rings[i]! - pulses[i]!).toBeLessThan(0.05);
    expect(e.vy).toBe(ROSTER.pn_drone!.behavior.kind === 'custom' ? 20 : 0);
    // Below maxY it stops ringing.
    e.y = 300;
    const before = shots(w);
    step(w, 60 * 4);
    expect(shots(w)).toBeLessThanOrEqual(before);
  });

  it("with no pulsar near, it rings on the song's bar and glows before it", () => {
    const w = world();
    const e = spawnEnemy(w, 'pn_drone', 120, 40)!;
    let charged = false;
    let ringAt = -1;
    let last = 0;
    step(w, 60 * 3.3, () => {
      if (mem(e).charge > 0) charged = true;
      const n = shots(w);
      if (n >= last + 10 && ringAt < 0) ringAt = w.time;
      last = n;
    });
    expect(charged).toBe(true);
    expect(ringAt).toBeCloseTo(BAR, 1);
  });
});

describe('Streaker', () => {
  it('launches at least 50 px from the player, from under the bottom edge after a warning', () => {
    const w = world();
    for (const px of [10, 60, 120, 200, 230]) {
      w.player.x = px;
      for (let i = 0; i < 20; i++)
        expect(Math.abs(streakerX(w) - px)).toBeGreaterThanOrEqual(STREAKER_MIN_DX);
    }
    w.player.x = 120;
    expect(spawnStreakers(w, 1)).toBe(1);
    const e = w.enemies.items.find((x) => x.active && x.defId === 'pn_streaker') as Enemy;
    step(w, 1);
    expect(e.state).toBe(1);
    expect(e.y).toBe(streakerLurkY(e.r));
    step(w, 30);
    expect(e.state).toBe(1);
    expect(e.vy).toBe(0);
    step(w, 20);
    expect(e.state).toBeGreaterThanOrEqual(2);
    expect(e.vy).toBeLessThan(-140);
  });

  it('fires one aimed shot crossing y=200, only if the player is below it', () => {
    const w = world();
    w.player.y = 380;
    spawnStreakers(w, 1);
    const e = w.enemies.items.find((x) => x.active && x.defId === 'pn_streaker') as Enemy;
    step(w, 60 * 3);
    expect(e.state).toBe(3);
    expect(shots(w)).toBe(1);
  });
});

describe('Warden Ray', () => {
  it('descends, holds, telegraphs a fan beside the player, then sweeps it far → near', () => {
    const w = world();
    const e = spawnEnemy(w, 'pn_ray', 120, -14)!;
    const m = mem(e);
    step(w, 60 * 2);
    expect(e.state).toBe(2);
    expect(e.y).toBeGreaterThan(50);
    while (m.a !== RayPhase.Telegraph && w.time < 10) step(w);
    const tele = w.time;
    const aim = (Math.atan2(w.player.y - e.y, w.player.x - e.x) * 180) / Math.PI;
    // The near edge stops `lead`° short of the player's bearing; the far edge is beyond.
    expect(Math.abs(m.near - aim)).toBeGreaterThanOrEqual(11);
    expect(Math.sign(m.far - aim)).toBe(Math.sign(m.near - aim));
    while (m.a !== RayPhase.On) step(w);
    expect(w.time - tele).toBeGreaterThanOrEqual(0.5);
    expect(rayHeading(m, 0, 1.8)).toBe(m.far);
    expect(rayHeading(m, 1.8, 1.8)).toBe(m.near);
    const before = shots(w);
    step(w, 60 * 1.8 + 2);
    expect(shots(w) - before).toBeGreaterThan(15);
    expect(m.a).toBe(RayPhase.Off);
  });

  it('leaves after its hold time', () => {
    const w = world();
    const e = spawnEnemy(w, 'pn_ray', 120, -14)!;
    step(w, 60 * 17);
    expect(e.state === 3 || !e.active).toBe(true);
  });
});

describe('garden', () => {
  it('spawns its pulsars pinned on the song grid and drives their glide', () => {
    const w = world();
    // Without a director the level clock reads 0: only the delay-0 slot spawns.
    startGarden(w);
    gardenSystem.update(w, DT);
    const a = gardenPulsars(w)[0]!;
    expect(a).not.toBeNull();
    expect(a.x).toBe(GARDEN.slots[0]!.x);
    expect(gardenY(150, 0)).toBeLessThan(0);
    expect(gardenY(150, GARDEN.glide)).toBeCloseTo(150, 5);
    expect(gardenY(150, GARDEN.glide + 10)).toBeCloseTo(150 + GARDEN.creep * 10, 5);
  });

  it('gardenPulsars is empty before the script', () => {
    const w = world();
    expect(gardenPulsars(w).every((a) => a === null)).toBe(true);
  });
});
