import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';
import type { WeaponId } from '../../weapons';

// Boss tunables for the Echo (design.md → Level 9 boss). The controller in
// game/levels/chrono reads only this table. Shot speeds are before the
// level's enemyShotSpeedMul (1.3), except the Lance bolt, which the design
// gives as an absolute 200 px/s.

/** How the Echo translates one of the player's weapons. `lv` is that weapon's level. */
export interface EchoPatterns {
  blaster: { every: number; speed: number; twinFrom: number; twinGap: number };
  spread: {
    every: number;
    n: number;
    nHigh: number;
    highFrom: number;
    stepDeg: number;
    speed: number;
  };
  lance: { every: number; telegraph: number; speed: number; rounds: number; gap: number };
  seeker: { every: number; n: number; nHigh: number; highFrom: number };
  /** Blockers by the player's drone level (index = level − 1). */
  orbitDrones: { byLevel: readonly number[] };
  arc: { range: number; telegraph: number; cooldown: number };
  ricochet: { every: number; speed: number; bounces: number };
  flak: {
    every: number;
    speed: number;
    fuse: number;
    shards: number;
    shardSpeed: number;
    /** Bursts early once this close to the ship (never point-blank). */
    burstDist: number;
  };
}

export interface EchoDef {
  id: 'cr_echo';
  name: string;
  score: number;
  parts: readonly BossPartSpec[];
  /** Seconds behind the ship (design: 8 s; the ghost 4 s). */
  delay: number;
  ghostDelay: number;
  /** Bubbles bend the lag: it grows inside slow time and shrinks in fast time, within these. */
  delayMin: number;
  delayMax: number;
  ghostDelayMin: number;
  ghostDelayMax: number;
  /** 1/s: how fast a bent lag eases back once the Echo is out of a bubble. */
  delayRelax: number;
  /** y = clamp(base + (pastY − center) × k, min, max). */
  yMap: { base: number; center: number; k: number; min: number; max: number };
  /** No history yet (sandbox): strafe across the top band. */
  strafe: { y: number; minX: number; maxX: number; period: number };
  entry: { fromY: number; duration: number };
  /** Core HP shares where phase 2 (ghost) and phase 3 (PARADOX) begin. */
  ghostAt: number;
  paradoxAt: number;
  /** Mirrored weapons: the highest-level ones, ties to the oldest. */
  maxWeapons: number;
  /** The ghost fires only its first weapon, this much slower. */
  ghostEveryMul: number;
  /** Muzzle below the core center (the nose of the 2× sprite). */
  muzzle: number;
  patterns: EchoPatterns;
  /** Blockers orbit the core; a destroyed one comes back after `respawn` s. */
  drones: { orbitR: number; omega: number; respawn: number };
  paradox: {
    flipR: number;
    slowR: number;
    /** Seconds between slow bubbles, how far back the ship was, and each bubble's life. */
    slowEvery: number;
    slowPast: number;
    slowTtl: number;
    maxSlow: number;
  };
  /** Death: freeze, rewind 1 s along its own path, shatter. */
  death: { freeze: number; rewind: number; shatter: number };
  shotSalvageMax: number;
}

export const ECHO_WEAPONS: readonly WeaponId[] = [
  'blaster',
  'spread',
  'lance',
  'seeker',
  'orbitDrones',
  'arc',
  'ricochet',
  'flak',
];

export const ECHO: EchoDef = {
  id: 'cr_echo',
  name: 'ECHO',
  score: 3000,
  parts: [
    { defId: 'cr_echo_core', role: 'core', ox: 0, oy: 0, hp: 1150, r: 14, targetable: true },
    { defId: 'cr_echo_ghost', role: 'turret', ox: 0, oy: 0, hp: 200, r: 12, targetable: true },
    { defId: 'cr_echo_drone', role: 'turret', ox: 0, oy: 0, hp: 20, r: 5, targetable: true },
    { defId: 'cr_echo_drone', role: 'turret', ox: 0, oy: 0, hp: 20, r: 5, targetable: true },
    { defId: 'cr_echo_drone', role: 'turret', ox: 0, oy: 0, hp: 20, r: 5, targetable: true },
  ],
  delay: 8,
  ghostDelay: 4,
  delayMin: 5,
  delayMax: 9.8,
  ghostDelayMin: 2.5,
  ghostDelayMax: 6,
  delayRelax: 0.25,
  yMap: { base: 60, center: 240, k: 0.5, min: 40, max: 140 },
  strafe: { y: 70, minX: 40, maxX: 200, period: 7 },
  entry: { fromY: -40, duration: 2.5 },
  ghostAt: 0.6,
  paradoxAt: 0.25,
  maxWeapons: 3,
  ghostEveryMul: 2.2,
  muzzle: 16,
  patterns: {
    blaster: { every: 1.3, speed: 80, twinFrom: 4, twinGap: 5 },
    spread: { every: 2.2, n: 3, nHigh: 5, highFrom: 4, stepDeg: 14, speed: 72 },
    lance: { every: 2.8, telegraph: 0.6, speed: 200, rounds: 3, gap: 0.03 },
    seeker: { every: 3.2, n: 1, nHigh: 2, highFrom: 3 },
    orbitDrones: { byLevel: [1, 1, 2, 2, 3] },
    arc: { range: 60, telegraph: 0.5, cooldown: 1.5 },
    ricochet: { every: 2.4, speed: 82, bounces: 2 },
    flak: { every: 2.8, speed: 76, fuse: 0.9, shards: 6, shardSpeed: 40, burstDist: 72 },
  },
  drones: { orbitR: 28, omega: 2.2, respawn: 8 },
  paradox: { flipR: 52, slowR: 36, slowEvery: 2.6, slowPast: 2.5, slowTtl: 6, maxSlow: 3 },
  death: { freeze: 0.4, rewind: 1, shatter: 0.7 },
  shotSalvageMax: 20,
};

function partDef(defId: string, score: number): SimEnemyDef {
  const p = ECHO.parts.find((s) => s.defId === defId);
  if (p === undefined) throw new Error(`cr_echo has no ${defId} part`);
  return { hp: p.hp, r: p.r, score, isBoss: true };
}

/** Part defs for the boss registry. Spawns pass each spec's own hp and r. */
export const ECHO_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = {
  cr_echo_core: partDef('cr_echo_core', 0),
  cr_echo_ghost: partDef('cr_echo_ghost', 800),
  cr_echo_drone: partDef('cr_echo_drone', 60),
};
