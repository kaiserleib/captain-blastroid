import { describe, expect, it } from 'vitest';
import type { World } from '../../src/sim/world';
import { dodgerBot } from './bots';
import { runSim, type SimRun } from './harness';

// T31: the shared dodger reads the campaign's hazards. Each check plays the
// same seeds with the hazard-blind T18 dodger (`hazards: false`) and the
// aware one (typical skill), and compares the hits the harness blames on
// that hazard. Shields refill every tick, so hits still land and count but
// both bots fly the same stretch of the sector.

const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = env.SIM === '1' ? 6 : 3;

const refill = (w: World) => void (w.player.shield = w.player.maxShield);

function causes(runs: readonly SimRun[], ...keys: string[]): number {
  let n = 0;
  for (const r of runs)
    for (const [k, v] of Object.entries(r.stats.hitCauses))
      if (keys.some((x) => k.endsWith(x))) n += v;
  return n;
}

const played = new Map<string, { blind: SimRun[]; aware: SimRun[] }>();

function play(levelId: string, seconds: number): { blind: SimRun[]; aware: SimRun[] } {
  const key = `${levelId}@${seconds}`;
  let p = played.get(key);
  if (p !== undefined) return p;
  p = { blind: [], aware: [] };
  for (let i = 0; i < SEEDS; i++) {
    const seed = `bots-${levelId}${i}`;
    const opts = { levelId, onTick: refill };
    p.blind.push(runSim(seed, dodgerBot(undefined, { hazards: false }), seconds, opts));
    p.aware.push(runSim(seed, dodgerBot(), seconds, opts));
  }
  played.set(key, p);
  return p;
}

describe('hazard-aware dodger', () => {
  it('pulsar rings: under half the blind dodger’s ring hits', () => {
    const { blind, aware } = play('pulsarNursery', 75);
    expect(causes(blind, ':ring')).toBeGreaterThan(3 * SEEDS);
    expect(causes(aware, ':ring')).toBeLessThan(causes(blind, ':ring') / 2);
  }, 60_000);

  it('black holes, curved rocks and Lancer lines: under half the blind dodger’s hits', () => {
    const { blind, aware } = play('eventHorizon', 280);
    const keys = ['level:hole', 'level:rock', 'level:ram-hz_lancer'];
    expect(causes(blind, ...keys)).toBeGreaterThan(2 * SEEDS);
    expect(causes(aware, ...keys)).toBeLessThan(causes(blind, ...keys) / 2);
  }, 60_000);

  it('Perihelion: the dive telegraph is read, so dives rarely connect', () => {
    const { blind, aware } = play('eventHorizon', 280);
    for (const r of aware) expect(r.stats.reachedBoss).toBe(true);
    expect(causes(blind, 'boss:hull')).toBeGreaterThan(SEEDS);
    expect(causes(aware, 'boss:hull')).toBeLessThan(causes(blind, 'boss:hull') / 3);
  }, 60_000);

  it('levels without the new hazards play exactly as the T18 dodger (Level 1 numbers hold)', () => {
    for (let i = 0; i < 2; i++) {
      const a = runSim(`bots-l1-${i}`, dodgerBot(), 120);
      const b = runSim(`bots-l1-${i}`, dodgerBot(undefined, { hazards: false }), 120);
      expect(a.hash).toBe(b.hash);
    }
  }, 60_000);
});
