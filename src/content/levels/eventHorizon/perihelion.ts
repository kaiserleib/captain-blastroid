import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

// Boss tunables for Perihelion (design.md → Level 3 boss). The controller in
// game/levels/eventHorizon reads only this table.

export interface PerihelionDef {
  id: 'hz_perihelion';
  name: string;
  /** Score for the core kill (× chain); pods score through their part def. */
  score: number;
  parts: readonly BossPartSpec[];
  /** The arena hole: spawned with the boss, pinned, collapsed on defeat. */
  hole: { x: number; y: number; variant: string; growTime: number; collapseTime: number };
  entry: { fromY: number; duration: number };
  /** Ellipse around the hole; the boss starts at its top. */
  orbit: { rx: number; ry: number; period: number };
  pods: {
    /** Each pod fires this often; the two are offset by half an interval. */
    interval: number;
    intervalAlone: number;
    n: number;
    spreadDeg: number;
    speed: number;
    /** No volley with the player closer than this to the pod. */
    minPlayerDist: number;
  };
  coreOpenTime: number;
  dive: {
    /** Seconds between dive starts (the orbit sets the exact beat: one per lap). */
    every: number;
    telegraph: number;
    /** Mean speed along the path, px/s; the swing is fastest at the bottom. */
    speed: number;
    /** The bottom of the swing tracks the player's row and x, clamped to these. */
    rowMin: number;
    rowMax: number;
    xMin: number;
    xMax: number;
    ringN: number;
    ringSpeed: number;
    /** Path fraction after which the ring may drop (on the climb, away from the player). */
    ringAfter: number;
    /** The ring waits until the player is at least this far away. */
    ringMinDist: number;
  };
  ring: {
    interval: number;
    firstDelay: number;
    n: number;
    speed: number;
    rotStep: number;
    /** Skipped with the player closer than this to the core. */
    minPlayerDist: number;
  };
  deathTime: number;
  shotSalvageMax: number;
  podShake: { mag: number; dur: number };
}

// HP: design 80 / 80 / 260 (T28 balance pass, see the ticket's Notes).
export const PERIHELION: PerihelionDef = {
  id: 'hz_perihelion',
  name: 'PERIHELION',
  score: 2500,
  parts: [
    { defId: 'hz_peri_pod', role: 'turret', ox: -30, oy: 2, hp: 70, r: 9, targetable: true },
    { defId: 'hz_peri_pod', role: 'turret', ox: 30, oy: 2, hp: 70, r: 9, targetable: true },
    { defId: 'hz_peri_core', role: 'core', ox: 0, oy: -2, hp: 120, r: 10, targetable: false },
    { defId: 'hz_peri_hull', role: 'hull', ox: 0, oy: 15, hp: 0, r: 7, targetable: false },
    { defId: 'hz_peri_hull', role: 'hull', ox: 0, oy: -17, hp: 0, r: 7, targetable: false },
  ],
  hole: { x: 120, y: 150, variant: 'massive', growTime: 1.4, collapseTime: 0.5 },
  entry: { fromY: -40, duration: 3 },
  orbit: { rx: 80, ry: 50, period: 9 },
  pods: { interval: 1.6, intervalAlone: 1.2, n: 3, spreadDeg: 20, speed: 82, minPlayerDist: 60 },
  coreOpenTime: 1.2,
  dive: {
    every: 6,
    telegraph: 0.8,
    speed: 280,
    rowMin: 280,
    rowMax: 350,
    xMin: 72,
    xMax: 168,
    ringN: 12,
    ringSpeed: 62,
    ringAfter: 0.68,
    ringMinDist: 96,
  },
  ring: { interval: 1.2, firstDelay: 0.8, n: 6, speed: 68, rotStep: 17, minPlayerDist: 80 },
  deathTime: 2,
  shotSalvageMax: 20,
  podShake: { mag: 3, dur: 0.35 },
};

function partOf(role: BossPartSpec['role']): BossPartSpec {
  const p = PERIHELION.parts.find((s) => s.role === role);
  if (p === undefined) throw new Error(`hz_perihelion has no ${role} part`);
  return p;
}

/** Part defs for the boss registry. Spawns pass each spec's own hp and r. */
export const PERIHELION_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = {
  hz_peri_pod: { hp: partOf('turret').hp, r: partOf('turret').r, score: 600, isBoss: true },
  hz_peri_core: { hp: partOf('core').hp, r: partOf('core').r, score: 0, isBoss: true },
  hz_peri_hull: { hp: 0, r: partOf('hull').r, score: 0, isBoss: true },
};
