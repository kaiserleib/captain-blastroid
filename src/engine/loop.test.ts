import { describe, expect, it } from 'vitest';
import { Loop, MAX_STEPS, STEP, type LoopScheduler } from './loop';

function makeLoop() {
  const updates: number[] = [];
  const alphas: number[] = [];
  let pending: ((t: number) => void) | null = null;
  const scheduler: LoopScheduler = {
    request: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  const loop = new Loop(
    { update: (dt) => updates.push(dt), render: (a) => alphas.push(a) },
    scheduler,
  );
  const fire = (t: number) => pending?.(t);
  return { loop, updates, alphas, fire };
}

describe('Loop', () => {
  it('runs 60 ticks per second on a 60 Hz display', () => {
    const { loop, updates } = makeLoop();
    for (let i = 0; i <= 60; i++) loop.frame((i * 1000) / 60);
    expect(updates).toHaveLength(60);
    expect(updates.every((dt) => dt === STEP)).toBe(true);
  });

  it('runs 60 ticks per second on a 120 Hz display, interpolating between', () => {
    const { loop, updates, alphas } = makeLoop();
    for (let i = 0; i <= 120; i++) loop.frame((i * 1000) / 120);
    expect(updates).toHaveLength(60);
    expect(alphas.some((a) => a > 0.4 && a < 0.6)).toBe(true);
  });

  it('caps catch-up at 5 steps and drops the backlog', () => {
    const { loop, updates, alphas } = makeLoop();
    loop.frame(0);
    loop.frame(2000);
    expect(updates).toHaveLength(MAX_STEPS);
    expect(alphas.at(-1)).toBeLessThan(1);
    loop.frame(2000 + 1000 / 60);
    expect(updates).toHaveLength(MAX_STEPS + 1);
  });

  it('resume does not fast-forward over the paused time', () => {
    const { loop, updates, fire } = makeLoop();
    loop.start();
    fire(0);
    fire(100);
    const before = updates.length;
    loop.pause();
    expect(loop.paused).toBe(true);
    fire(5000); // cancelled: no-op
    loop.resume();
    fire(60_000);
    fire(60_000 + 1000 / 60);
    expect(updates.length - before).toBe(1);
  });

  it('hitstop freezes updates but keeps rendering', () => {
    const { loop, updates, alphas } = makeLoop();
    loop.frame(0);
    loop.hitstop(0.1);
    for (let i = 1; i <= 6; i++) loop.frame((i * 1000) / 60);
    expect(updates).toHaveLength(0);
    expect(alphas).toHaveLength(7);
    for (let i = 7; i <= 12; i++) loop.frame((i * 1000) / 60);
    expect(updates.length).toBeGreaterThanOrEqual(5);
  });
});
