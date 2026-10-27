// Level 5 tunables (T30): the frigate mid-boss, minelayer mines and the
// Dreadnought Leviathan. game/levels/armada reads only these tables.
// Shot speeds are before the level's enemyShotSpeedMul (1.2).

import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

/** Frigate (mid-boss): crosses at 25 px/s, two turrets guard an armored hull. */
export const FRIGATE = {
  speed: 25,
  /** Px the hull bobs while it crosses, and the bob period in seconds. */
  bobAmp: 3,
  bobPeriod: 3.4,
  hullHp: 60,
  hullR: 13,
  turretHp: 30,
  turretR: 7,
  /** Turret and armor offsets for a frigate heading right (mirrored heading left). */
  turrets: [
    { ox: -17, oy: -5 },
    { ox: 15, oy: -5 },
  ],
  armor: [
    { ox: -29, oy: 1, r: 8 },
    { ox: 29, oy: 2, r: 8 },
  ],
  turret: { interval: 3.2, firstDelay: 1.2, burstCount: 3, burstGap: 0.14, speed: 80 },
  /** Both turrets wrecked: the hull's reactor fires 8-rings, glowing `telegraph` s first. */
  ring: { n: 8, speed: 70, interval: 2.5, firstDelay: 1.2, rotStep: 22.5, telegraph: 0.6 },
  salvage: 50,
  /** Px past the far edge where a surviving frigate is released (not a kill). */
  exitMargin: 44,
} as const;

/** Commodore Vale's pod (design: no HP given for L5; 2 because it ejects mid-firefight). */
export const POD = {
  hp: 2,
  /** Kept this far inside the side edges. */
  margin: 24,
  /** A salvage cache opens at least this far down (it bursts upward). */
  cacheY: 40,
} as const;

/** Ion Mine (design: L2's numbers), dropped by Minelayers. */
export const MINE = {
  /** Seconds after spawn before it bursts on its own. */
  fuse: 6,
  /** Player within this many px arms it. */
  trigger: 36,
  /** Seconds between arming and the burst (fairness: ≥ 0.5 s telegraph). */
  arm: 0.5,
  /** The last `warn` seconds of the fuse blink fast. */
  warn: 1,
  n: 8,
  speed: 60,
} as const;

export type LeviathanPartKind =
  'flak' | 'deck' | 'armor' | 'bay' | 'gen' | 'gun' | 'bridge' | 'core';

/** A hull part. `oy` is −depth (px from the bow tip toward the stern); `ox` from the center line. */
export interface LeviathanPartSpec extends BossPartSpec {
  kind: LeviathanPartKind;
  /** 0 bow, 1 forward battery, 2 missile bays, 3 shield generators, 4 bridge. */
  section: number;
}

function part(
  kind: LeviathanPartKind,
  section: number,
  x: number,
  depth: number,
  hp: number,
  r: number,
): LeviathanPartSpec {
  return {
    kind,
    section,
    defId: `ar_lev_${kind}`,
    role: kind === 'armor' ? 'hull' : kind === 'bridge' || kind === 'core' ? 'core' : 'turret',
    ox: x - 120,
    oy: -depth,
    hp,
    r,
    targetable: kind !== 'armor' && kind !== 'core',
  };
}

// Hit points (T30 balance): the hull is optional salvage; only the generators
// (or their 25 s overload), the bridge and the escape core stand between the
// player and the clear. Bridge 250 + core 120 (T31; T30 had 220 + 100, the design 280 + 120).
export const LEVIATHAN_PARTS: readonly LeviathanPartSpec[] = [
  part('flak', 0, 84, 78, 25, 8),
  part('flak', 0, 156, 104, 25, 8),
  part('deck', 1, 64, 196, 30, 9),
  part('deck', 1, 176, 196, 30, 9),
  part('armor', 1, 101, 252, 0, 10),
  part('armor', 1, 139, 252, 0, 10),
  part('deck', 1, 96, 282, 30, 9),
  part('deck', 1, 144, 282, 30, 9),
  part('bay', 2, 70, 382, 40, 11),
  part('bay', 2, 170, 382, 40, 11),
  part('gen', 3, 58, 600, 40, 10),
  part('gen', 3, 182, 600, 40, 10),
  part('gun', 4, 78, 652, 40, 8),
  part('gun', 4, 162, 652, 40, 8),
  part('bridge', 4, 120, 690, 250, 19),
  part('core', 4, 120, 694, 120, 2),
];

export const LEVIATHAN = {
  id: 'ar_leviathan',
  name: 'LEVIATHAN',
  /** Score for the escape core kill (× chain); parts score through their defs. */
  score: 6000,
  /** Hull length, px from the bow tip to the stern. */
  length: 780,
  /** Bow tip y at spawn (the bow enters from the top). */
  startY: -12,
  /** Anchor speed and the matching world scroll while the hull passes. */
  hullSpeed: 20,
  /** The anchor stops when the bridge reaches this y; scroll goes to 0. */
  lockY: 110,
  /**
   * Seconds of hull pass before the bridge locks in ((lockY + bridge oy 690 − startY) / hullSpeed);
   * BOSS_ASSIST waits this much longer than for other bosses.
   */
  approachT: 41,
  /** Parts below this y are released (scrolled past; not a kill). */
  passY: 400,
  /** Seconds a part must be on screen before it may fire (fairness). */
  wakeT: 0.5,
  /** Deck guns can't depress further: they hold fire within this many px above the player. */
  minAbove: 100,
  /** Salvage per destroyed hull part (turrets, bays, generators, guns). */
  partSalvage: 25,
  flak: { interval: 2.2, burstCount: 3, burstGap: 0.12, speed: 92 },
  deck: {
    interval: 2.8,
    /** Even: the fan's center lane is open. */
    n: 4,
    arcDeg: 48,
    speed: 76,
    /** Fans point down, leaning at most this far toward the player. */
    leanDeg: 25,
  },
  bay: {
    interval: 4,
    firstDelay: 1,
    /** Doors open this long before a launch. */
    telegraph: 0.6,
    perLaunch: 2,
    /** Degrees either side of straight up the missiles leave at. */
    splayDeg: 38,
  },
  missile: { turn: 1.6, speed: 70, ttl: 4 },
  gen: {
    /** Seconds on screen before an unshot generator overloads by itself. */
    overloadAfter: 25,
    /** Sputtering telegraph before the overload. */
    warn: 2,
  },
  gun: { interval: 2, n: 5, spreadDeg: 44, speed: 76 },
  ring: { interval: 2, firstDelay: 1, n: 20, speed: 70, rotStep: 7 },
  /** Bridge wrecked → the escape core rises out of it, invulnerable, over `launchTime`. */
  launchTime: 1.6,
  /** The broken bridge coughs up a shield cell for the last stretch. */
  launchDrop: 'shield',
  core: {
    /** Strafing line and limits. */
    y: 66,
    minX: 56,
    maxX: 184,
    period: 7.5,
    bobAmp: 4,
    bobPeriod: 2.2,
    r: 11,
    /** 3-arm spiral: a volley every `gap` s for `on` s, then `off` s quiet. */
    arms: 4,
    gap: 0.16,
    on: 3,
    off: 0.9,
    rotStep: 13,
    speed: 78,
  },
  /** Burning wreck: a debris rock flies off every `every` s. */
  debris: { every: 1.7, speed: [38, 64] as const, spreadDeg: 32 },
  /** The death chain across the hull (T13 plays bossDefeated's own chain at the core). */
  deathTime: 3,
  deathPopGap: 0.11,
  shotSalvageMax: 24,
  partShake: { mag: 2.5, dur: 0.3 },
  /** After the kill the wreck drifts off as the scroll resumes. */
  outroScroll: 24,
} as const;

const PART_SCORE: Readonly<Record<LeviathanPartKind, number>> = {
  flak: 400,
  deck: 400,
  armor: 0,
  bay: 600,
  gen: 800,
  gun: 600,
  bridge: 0,
  core: 0,
};

/**
 * Sim defs for every hull part kind (`registerBoss` forces isBoss); spawns
 * pass each spec's own hp and r. The deck isn't solid: only the flying
 * escape core does contact damage.
 */
export const LEVIATHAN_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = Object.fromEntries(
  LEVIATHAN_PARTS.map((s) => [
    s.defId,
    { hp: s.hp, r: s.r, score: PART_SCORE[s.kind], contactDamage: s.kind === 'core' ? 1 : 0 },
  ]),
);

/** Frigate turret and armor sim defs (the hull is a roster enemy). */
export const FRIGATE_PART_DEFS = {
  ar_frigate_turret: { hp: FRIGATE.turretHp, r: FRIGATE.turretR, score: 300, isBoss: true },
  ar_frigate_armor: { hp: 0, r: 8, score: 0, isBoss: true },
} as const;
