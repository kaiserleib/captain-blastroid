import { describe, expect, it } from 'vitest';
import { spawnEnemyShot } from '../../sim/spawn';
import type { Bullet } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { podHp, podShotBlocker, spawnEscapePod } from './escapePod';
import { attachPickups } from './index';

function world(): World {
  const w = createWorld('pod-hp');
  attachPickups(w);
  return w;
}

function shotAt(w: World, x: number, y: number): Bullet {
  return spawnEnemyShot(w, { x, y, vx: 0, vy: 0 })!;
}

describe('escape pod hp', () => {
  it('defaults to 1: the first hit destroys it', () => {
    const w = world();
    const toasts: string[] = [];
    w.events.on('toast', (p) => toasts.push(p.text));
    const pod = spawnEscapePod(w, 'juno', 100)!;
    expect(podHp(pod)).toBe(1);
    expect(podShotBlocker(w, shotAt(w, pod.x, pod.y))).toBe(true);
    expect(pod.active).toBe(false);
    expect(toasts).toEqual(['POD LOST']);
  });

  it('survives hp − 1 hits, pinging each time, then is lost', () => {
    const w = world();
    const sfx: string[] = [];
    const toasts: string[] = [];
    w.events.on('sfx', (p) => sfx.push(p.id));
    w.events.on('toast', (p) => toasts.push(p.text));
    const pod = spawnEscapePod(w, 'zzkar', 100, 3)!;
    expect(podHp(pod)).toBe(3);
    expect(podShotBlocker(w, shotAt(w, pod.x, pod.y))).toBe(true);
    expect(podShotBlocker(w, shotAt(w, pod.x, pod.y))).toBe(true);
    expect(pod.active).toBe(true);
    expect(podHp(pod)).toBe(1);
    expect(sfx).toEqual(['armor_ping', 'armor_ping']);
    expect(toasts).toEqual([]);
    podShotBlocker(w, shotAt(w, pod.x, pod.y));
    expect(pod.active).toBe(false);
    expect(toasts).toEqual(['POD LOST']);
  });

  it('a miss does nothing', () => {
    const w = world();
    const pod = spawnEscapePod(w, 'juno', 100, 2)!;
    expect(podShotBlocker(w, shotAt(w, 10, 10))).toBe(false);
    expect(podHp(pod)).toBe(2);
  });
});
