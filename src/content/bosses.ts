// Boss tunables (T16). The boss module in game/boss reads only these tables.

import type { SimEnemyDef } from '../sim/spawn';

/** A part's role decides how the boss treats it; every part is an `isBoss` enemy. */
export type BossPartRole = 'turret' | 'core' | 'hull';

export interface BossPartSpec {
  /** Enemy def id (registered with `registerEnemyDefs`). */
  defId: string;
  role: BossPartRole;
  /** Offset from the boss center, px. */
  ox: number;
  oy: number;
  /** HP 0 = armor: absorbs shots, never takes damage, adds nothing to the boss bar. */
  hp: number;
  r: number;
  /** Untargetable parts swallow shots without taking damage until unlocked. */
  targetable: boolean;
}

export interface RockHaulerDef {
  id: 'rock_hauler';
  name: string;
  /** Score for the core kill (× chain); turrets score through their part def. */
  score: number;
  parts: readonly BossPartSpec[];
  entry: {
    /** Spawn y (above the playfield) and the fighting y. */
    fromY: number;
    toY: number;
    /** Seconds; the boss is invulnerable while it descends. */
    duration: number;
  };
  strafe: {
    minX: number;
    maxX: number;
    /** Seconds for one left→right sweep, per phase. */
    period1: number;
    period2: number;
    /** Gentle vertical bob, px and seconds. */
    bobAmp: number;
    bobPeriod: number;
  };
  turret: {
    /** Each turret fires this often; the two are offset by half an interval. */
    interval: number;
    /** Once its twin is wrecked, the survivor fires this often. */
    intervalAlone: number;
    burstCount: number;
    burstGap: number;
    shotSpeed: number;
    /** Degrees across the aimed volley (0 = a single shot). */
    spreadDeg: number;
    shotsPerVolley: number;
  };
  fling: {
    interval1: number;
    interval2: number;
    /** First fling this long after the fight starts. */
    firstDelay: number;
    speed: number;
    /** Phase 2 throws a pair at ±pairDeg around the aim. */
    pairDeg: number;
    /** Hopper shakes and the chute glows this long before a throw. */
    telegraph: number;
    /** Spawn point, below every part so the rock leaves moving away from the hull. */
    ox: number;
    oy: number;
  };
  ring: {
    interval: number;
    firstDelay: number;
    n: number;
    speed: number;
    /** Each volley turns by this many degrees. */
    rotStep: number;
  };
  /** Seconds the core takes to open once both turrets are wrecked (still armored). */
  coreOpenTime: number;
  /** Seconds from the killing blow to releasing the parts (T13 plays a 2 s chain). */
  deathTime: number;
  /** Enemy shots on screen at defeat turn into salvage bits worth 1 each, up to this many. */
  shotSalvageMax: number;
  turretShake: { mag: number; dur: number };
}

// Hit points (T18): the DPS-only sim in boss.test.ts (a bot that leads every
// shot) kills it in ~40–55 s with Blaster L3 + Spread L3 + Lance/Seeker L2. A
// dodging bot that doesn't lead (tests/sim) takes ~45–90 s, which is where a
// human with a typical loadout should land. Phase 2 strafes slower than T16's
// first pass because an unled shot at a fast-sweeping core mostly misses.
export const ROCK_HAULER: RockHaulerDef = {
  id: 'rock_hauler',
  name: 'ROCK HAULER',
  score: 2000,
  parts: [
    {
      defId: 'rock_hauler_turret',
      role: 'turret',
      ox: -34,
      oy: 10,
      hp: 120,
      r: 10,
      targetable: true,
    },
    {
      defId: 'rock_hauler_turret',
      role: 'turret',
      ox: 34,
      oy: 10,
      hp: 120,
      r: 10,
      targetable: true,
    },
    { defId: 'rock_hauler_core', role: 'core', ox: 0, oy: 6, hp: 210, r: 13, targetable: false },
    { defId: 'rock_hauler_hull', role: 'hull', ox: -21, oy: -8, hp: 0, r: 8, targetable: false },
    { defId: 'rock_hauler_hull', role: 'hull', ox: 21, oy: -8, hp: 0, r: 8, targetable: false },
    { defId: 'rock_hauler_hull', role: 'hull', ox: 0, oy: -19, hp: 0, r: 10, targetable: false },
  ],
  entry: { fromY: -44, toY: 72, duration: 3 },
  strafe: { minX: 62, maxX: 178, period1: 7, period2: 5.6, bobAmp: 3, bobPeriod: 2.6 },
  turret: {
    interval: 1.6,
    intervalAlone: 1.2,
    burstCount: 3,
    burstGap: 0.14,
    shotSpeed: 105,
    spreadDeg: 0,
    shotsPerVolley: 1,
  },
  fling: {
    interval1: 4,
    interval2: 3.6,
    firstDelay: 2,
    speed: 90,
    pairDeg: 15,
    telegraph: 0.6,
    ox: 0,
    oy: 38,
  },
  ring: { interval: 1.5, firstDelay: 0.6, n: 14, speed: 70, rotStep: 11 },
  coreOpenTime: 1.2,
  deathTime: 2,
  shotSalvageMax: 20,
  turretShake: { mag: 3, dur: 0.35 },
};

/**
 * Silent stall breaker: a fight that outlasts `after` seconds (median clears
 * take ~55 s, the slowest ~125 s) ramps player damage on boss parts linearly
 * up to `maxMul` over `ramp` seconds. A weak loadout can then still finish the
 * boss, but only by surviving that long.
 */
export const BOSS_ASSIST = { after: 90, ramp: 60, maxMul: 5 } as const;

export const BOSSES = { rock_hauler: ROCK_HAULER } as const;
export type BossId = keyof typeof BOSSES;

export function isBossId(id: string): id is BossId {
  return Object.prototype.hasOwnProperty.call(BOSSES, id);
}

function partOf(role: BossPartRole): BossPartSpec {
  const p = ROCK_HAULER.parts.find((s) => s.role === role);
  if (p === undefined) throw new Error(`rock_hauler has no ${role} part`);
  return p;
}

/** Part defs for the sim (`registerEnemyDefs`). Spawns pass each spec's own hp and r. */
export const BOSS_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = {
  rock_hauler_turret: { hp: partOf('turret').hp, r: partOf('turret').r, score: 500, isBoss: true },
  rock_hauler_core: { hp: partOf('core').hp, r: partOf('core').r, score: 0, isBoss: true },
  rock_hauler_hull: { hp: 0, r: partOf('hull').r, score: 0, isBoss: true },
};
