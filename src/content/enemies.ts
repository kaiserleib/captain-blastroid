// Level 1 enemy roster ("Scrap Syndicate"), per docs/design.md → Enemies.
// Angles are degrees in screen space (+y down): 0 = right, 90 = straight down.

export interface StraightParams {
  kind: 'straight';
  /** px/s along the heading. A non-zero spawn velocity overrides heading and speed. */
  speed: number;
  /** Degrees, 90 = down. */
  heading: number;
  /** Fraction of `world.scrollSpeed` added to vy. */
  drift: number;
}

export interface SineDiveParams {
  kind: 'sineDive';
  speed: number;
  amplitude: number;
  /** Hz. */
  frequency: number;
}

/**
 * Cubic Bézier from the spawn point. Control points are offsets from the
 * spawn, authored for a left-side entry; a spawn right of center mirrors x.
 */
export interface SwoopParams {
  kind: 'swoop';
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  endX: number;
  endY: number;
  /** Seconds to traverse the curve; afterwards it keeps the exit tangent. */
  duration: number;
}

export interface HoldAndStrafeParams {
  kind: 'holdAndStrafe';
  descendSpeed: number;
  /** Hold height. A spawn override `ay > 0` replaces it. */
  anchorY: number;
  strafeSpeed: number;
  /** Max |x - spawn x| while strafing; also clamped to the screen margin. */
  strafeRange: number;
  /** Seconds after spawn before it leaves. */
  leaveAfter: number;
  /** vy while leaving; negative exits up. */
  exitVy: number;
}

export interface ShadowPlayerParams {
  kind: 'shadowPlayer';
  descendSpeed: number;
  /** 1/s: vx = (player.x - x) × lag, so higher tracks tighter. */
  lag: number;
  maxVx: number;
  /** px: each instance trails a fixed offset in [-spread, spread] so a group doesn't stack. */
  spread: number;
}

export interface CrossingParams {
  kind: 'crossing';
  /** px/s; direction is toward the far side from the spawn. */
  speed: number;
}

export type BehaviorParams =
  | StraightParams
  | SineDiveParams
  | SwoopParams
  | HoldAndStrafeParams
  | ShadowPlayerParams
  | CrossingParams;

export type BehaviorId = BehaviorParams['kind'];

/** `aimed`: n shots across spreadDeg, centered on the player's current position (no lead). */
export interface AimedPattern {
  kind: 'aimed';
  n: number;
  spreadDeg: number;
  speed: number;
}

/** `fan`: n shots across arcDeg, centered on `centerDeg` (default 90 = down). */
export interface FanPattern {
  kind: 'fan';
  n: number;
  arcDeg: number;
  speed: number;
  centerDeg?: number;
}

/** `ring`: n shots evenly around 360°, the first at rotOffset degrees. */
export interface RingPattern {
  kind: 'ring';
  n: number;
  speed: number;
  rotOffset: number;
}

/** `burst`: fires `inner` `count` times, `interval` s apart, from the shooter's live position. */
export interface BurstPattern {
  kind: 'burst';
  count: number;
  interval: number;
  inner: AimedPattern | FanPattern | RingPattern;
}

export type PatternDef = AimedPattern | FanPattern | RingPattern | BurstPattern;

export type EnemyBulletSize = 's' | 'l';

export interface EnemyFireDef {
  pattern: PatternDef;
  /** Seconds after spawn before the first volley (never under the 0.5 s fairness floor). */
  firstDelay: number;
  /** Seconds between volleys; 0 = fire once. */
  interval: number;
  bullet: EnemyBulletSize;
}

/** Superset of the sim's `SimEnemyDef`; registered with `registerEnemyDefs`. */
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  r: number;
  sprite: string;
  behavior: BehaviorParams;
  fire: EnemyFireDef | null;
  avoidsAsteroids: boolean;
  contactDamage: number;
  score: number;
  salvage: number;
  /** Drop table id rolled by T12 on `enemyKilled`. `carrier` always drops a capsule. */
  dropTable: string;
  isBoss?: boolean;
}

/** Shot hitboxes are smaller than the sprites (design.md: r=2 for the 6 px bullet). */
export const ENEMY_BULLETS: Readonly<Record<EnemyBulletSize, { sprite: string; r: number }>> = {
  s: { sprite: 'ebullet_s', r: 2 },
  l: { sprite: 'ebullet_l', r: 3 },
};

export const ENEMY_FAIRNESS = {
  /** No shots during an enemy's first seconds alive. */
  minAge: 0.5,
  /** Shooter must be at least this far above the player. */
  minAbovePlayer: 24,
  /** Enemy shot lifetime, seconds. */
  shotTtl: 6,
} as const;

export const AVOIDANCE = {
  /** Center probe length along the heading, px. */
  lookAhead: 40,
  whiskerDeg: 25,
  whiskerLen: 30,
  /** Max lateral steer, px/s. */
  maxSteer: 130,
  /** 1/s: how fast velocity converges on desired + steer (and back once clear). */
  blend: 7,
  /** Fraction of desired speed shed at full urgency. */
  brake: 1,
  /** Extra clearance added to the probe radius, px. */
  margin: 4,
} as const;

export const ENEMIES: Readonly<Record<string, EnemyDef>> = {
  gnat: {
    id: 'gnat',
    name: 'Gnat',
    hp: 1,
    r: 6,
    sprite: 'enemy_gnat',
    behavior: { kind: 'straight', speed: 70, heading: 90, drift: 0 },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 50,
    salvage: 1,
    dropTable: 'common',
  },
  swooper: {
    id: 'swooper',
    name: 'Swooper',
    hp: 2,
    r: 6,
    sprite: 'enemy_swooper',
    behavior: {
      kind: 'swoop',
      c1x: 60,
      c1y: 230,
      c2x: 200,
      c2y: 250,
      endX: 290,
      endY: 110,
      duration: 3.4,
    },
    fire: {
      pattern: { kind: 'aimed', n: 2, spreadDeg: 10, speed: 90 },
      firstDelay: 1.2,
      interval: 0,
      bullet: 's',
    },
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 100,
    salvage: 1,
    dropTable: 'common',
  },
  gunboat: {
    id: 'gunboat',
    name: 'Gunboat',
    hp: 6,
    r: 10,
    sprite: 'enemy_gunboat',
    behavior: {
      kind: 'holdAndStrafe',
      descendSpeed: 60,
      anchorY: 80,
      strafeSpeed: 22,
      strafeRange: 50,
      leaveAfter: 6,
      exitVy: -55,
    },
    fire: {
      pattern: { kind: 'fan', n: 5, arcDeg: 56, speed: 75 },
      firstDelay: 1.0,
      interval: 1.5,
      bullet: 'l',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 300,
    salvage: 5,
    dropTable: 'common',
  },
  interceptor: {
    id: 'interceptor',
    name: 'Interceptor',
    hp: 3,
    r: 9,
    sprite: 'enemy_interceptor',
    behavior: { kind: 'shadowPlayer', descendSpeed: 38, lag: 1.1, maxVx: 70, spread: 18 },
    fire: {
      pattern: { kind: 'aimed', n: 2, spreadDeg: 10, speed: 100 },
      firstDelay: 1.0,
      interval: 1.7,
      bullet: 's',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 200,
    salvage: 2,
    dropTable: 'common',
  },
  carrier: {
    id: 'carrier',
    name: 'Carrier',
    hp: 8,
    r: 13,
    sprite: 'enemy_carrier',
    behavior: { kind: 'crossing', speed: 28 },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 500,
    salvage: 5,
    dropTable: 'carrier',
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES);
