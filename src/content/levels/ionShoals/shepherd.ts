import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

// The Shepherd (docs/design.md → Level 2 boss): an ion tug-mothership that
// keeps two large rocks in orbit as a shield, throws them, and tows fresh
// ones in. Once both tractor emitters are wrecked the core opens: a 5-arm
// ion spiral and skiff waves. Read only by game/levels/ionShoals/shepherd.ts.

export interface ShepherdDef {
  id: 'ion_shepherd';
  name: string;
  /** Score for the core kill (× chain); emitters score through their part def. */
  score: number;
  parts: readonly BossPartSpec[];
  entry: { fromY: number; toY: number; duration: number };
  strafe: {
    minX: number;
    maxX: number;
    /** Seconds for one left→right sweep, per phase. */
    period1: number;
    period2: number;
    bobAmp: number;
    bobPeriod: number;
  };
  orbit: {
    /** Ellipse radii around the boss center, px. Wider than tall so the rocks clear the hull. */
    rx: number;
    ry: number;
    /** Ellipse center below the boss center, px. */
    oy: number;
    /** rad/s. */
    speed: number;
    /** Spring constant while orbiting, 1/s². */
    k: number;
    /** Spring constant while a fresh rock is towed in from the top edge. */
    towInK: number;
    /** Seconds a tow-in takes before the rock counts as orbiting. */
    towIn: number;
    /** Seconds before an emitter fetches a new rock after losing one (shot apart or thrown). */
    refetch: number;
    /** The fresh rock spawns this far above the top edge, px. */
    spawnY: number;
  };
  fling: {
    /** Seconds between throws; the emitters take turns. */
    interval: number;
    firstDelay: number;
    speed: number;
    /** The rock swings down to a release point below its emitter for this long (the tell). */
    windup: number;
    windupK: number;
    /** Release point, px below the boss center. */
    releaseOy: number;
    /** Phase 2: the leftover rocks go as a pair, ±pairDeg around the aim. */
    pairDeg: number;
  };
  /** Aimed bursts from the emitters, which take turns (one burst per interval in all). */
  burst: {
    interval: number;
    count: number;
    gap: number;
    speed: number;
  };
  spiral: {
    arms: number;
    /** Seconds between rings while spinning. */
    interval: number;
    on: number;
    off: number;
    /** Degrees each ring turns. */
    rotStep: number;
    speed: number;
    firstDelay: number;
  };
  skiffWave: {
    interval: number;
    firstDelay: number;
    count: number;
    /** Seconds between skiffs in a wave. */
    gap: number;
  };
  coreOpenTime: number;
  deathTime: number;
  shotSalvageMax: number;
  emitterShake: { mag: number; dur: number };
}

export const SHEPHERD: ShepherdDef = {
  id: 'ion_shepherd',
  name: 'THE SHEPHERD',
  score: 2500,
  parts: [
    { defId: 'ion_shep_emitter', role: 'turret', ox: -40, oy: 10, hp: 90, r: 10, targetable: true },
    { defId: 'ion_shep_emitter', role: 'turret', ox: 40, oy: 10, hp: 90, r: 10, targetable: true },
    { defId: 'ion_shep_core', role: 'core', ox: 0, oy: 6, hp: 240, r: 13, targetable: false },
    { defId: 'ion_shep_hull', role: 'hull', ox: -19, oy: -12, hp: 0, r: 10, targetable: false },
    { defId: 'ion_shep_hull', role: 'hull', ox: 19, oy: -12, hp: 0, r: 10, targetable: false },
    { defId: 'ion_shep_hull', role: 'hull', ox: 0, oy: -22, hp: 0, r: 10, targetable: false },
  ],
  entry: { fromY: -44, toY: 70, duration: 3 },
  strafe: { minX: 78, maxX: 162, period1: 8, period2: 7, bobAmp: 3, bobPeriod: 3.1 },
  orbit: {
    rx: 60,
    ry: 46,
    oy: 4,
    speed: 1.2,
    k: 40,
    towInK: 5,
    towIn: 2,
    refetch: 2.2,
    spawnY: -24,
  },
  fling: {
    interval: 5,
    firstDelay: 3,
    speed: 95,
    windup: 0.7,
    windupK: 36,
    releaseOy: 56,
    pairDeg: 14,
  },
  burst: { interval: 2.2, count: 3, gap: 0.14, speed: 100 },
  spiral: {
    arms: 5,
    interval: 0.2,
    on: 1.4,
    off: 2,
    rotStep: 9,
    speed: 75,
    firstDelay: 0.8,
  },
  skiffWave: { interval: 9, firstDelay: 3.5, count: 4, gap: 0.3 },
  coreOpenTime: 1.2,
  deathTime: 2,
  shotSalvageMax: 20,
  emitterShake: { mag: 3, dur: 0.35 },
};

function partOf(role: BossPartSpec['role']): BossPartSpec {
  const p = SHEPHERD.parts.find((s) => s.role === role);
  if (p === undefined) throw new Error(`ion_shepherd has no ${role} part`);
  return p;
}

/** Part defs for `registerBoss` (spawns pass each spec's own hp and r). */
export const SHEPHERD_PARTS: Readonly<Record<string, SimEnemyDef>> = {
  ion_shep_emitter: { hp: partOf('turret').hp, r: partOf('turret').r, score: 600 },
  ion_shep_core: { hp: partOf('core').hp, r: partOf('core').r, score: 0 },
  ion_shep_hull: { hp: 0, r: partOf('hull').r, score: 0 },
};
