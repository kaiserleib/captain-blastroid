import { EventBus, type GameEvents } from '../engine/events';
import { Pool } from '../engine/pool';
import { createRng, type Rng } from '../engine/rng';
import type { Renderer } from '../gfx/renderer';
import {
  PICKUP_KINDS,
  type Anomaly,
  type Asteroid,
  type Bullet,
  type EntityId,
  type Enemy,
  type MoveIntent,
  type Pickup,
  type PickupKind,
  type PlayerState,
  type PlayerStats,
} from './types';

export const WORLD_W = 240;
export const WORLD_H = 400;

export interface World {
  readonly width: 240;
  readonly height: 400;
  tick: number;
  /** Seconds since level start. */
  time: number;
  /** The ONLY randomness source in the sim. */
  rng: Rng;
  /** px/s, visual scroll + downward drift reference. */
  scrollSpeed: number;
  scrollY: number;
  player: PlayerState;
  /** Written by input each tick before systems run. */
  input: MoveIntent;
  /** Global rate on enemy bullets (pilot bullet time, T36). Integrators multiply it in (T33). */
  enemyBulletTimeScale: number;
  playerShots: Pool<Bullet>;
  enemyShots: Pool<Bullet>;
  enemies: Pool<Enemy>;
  asteroids: Pool<Asteroid>;
  anomalies: Pool<Anomaly>;
  pickups: Pool<Pickup>;
  events: EventBus<GameEvents>;
  /** Score, salvage, kills, pickups found, unlock candidates. */
  run: RunState;
  nextId(): EntityId;
}

export interface FormationState {
  alive: number;
  total: number;
  broken: boolean;
}

export interface RunState {
  shipId: string;
  pilotId: string;
  levelId: string;
  seed: string;
  score: number;
  /** Chain multiplier 1..8, decays after 1.5 s without a kill. */
  chain: number;
  chainT: number;
  salvage: number;
  kills: number;
  asteroidsDestroyed: number;
  formations: Map<number, FormationState>;
  schematics: string[];
  pilotsRescued: string[];
  pickupsCollected: Record<PickupKind, number>;
  bossDefeated: boolean;
}

export interface System {
  name: string;
  update(w: World, dt: number): void;
}

export interface DrawLayer {
  name: string;
  z: number;
  draw(w: World, r: Renderer, alpha: number): void;
}

export interface PoolCapacities {
  playerShots: number;
  enemyShots: number;
  enemies: number;
  asteroids: number;
  anomalies: number;
  pickups: number;
}

export const DEFAULT_CAPACITIES: Readonly<PoolCapacities> = {
  playerShots: 400,
  enemyShots: 600,
  enemies: 80,
  asteroids: 120,
  anomalies: 8,
  pickups: 120,
};

export interface WorldOptions {
  shipId?: string;
  pilotId?: string;
  levelId?: string;
  capacities?: Partial<PoolCapacities>;
}

// Entity factories produce blank pool slots; spawn helpers (T03) reset every field on reuse.

export function createBullet(): Bullet {
  return {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    r: 0,
    owner: 'player',
    damage: 0,
    pierce: 0,
    ttl: 0,
    sprite: '',
    rot: 0,
    weaponId: null,
    homing: 0,
    targetId: -1,
    hitIds: [],
  };
}

export function createEnemy(): Enemy {
  return {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    r: 0,
    hp: 0,
    maxHp: 0,
    flashT: 0,
    defId: '',
    t: 0,
    state: 0,
    ax: 0,
    ay: 0,
    fireT: 0,
    avoidsAsteroids: false,
    formationId: -1,
    isBoss: false,
    contactDamage: 0,
  };
}

export function createAsteroid(): Asteroid {
  return {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    r: 0,
    hp: 0,
    maxHp: 0,
    flashT: 0,
    size: 'small',
    rot: 0,
    spin: 0,
    variant: 0,
  };
}

export function createAnomaly(): Anomaly {
  return {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    r: 0,
    kind: 'blackhole',
    t: 0,
    strength: 0,
    radius: 0,
  };
}

export function createPickup(): Pickup {
  return {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    r: 0,
    kind: 'salvage',
    payload: '',
    amount: 0,
    ttl: 0,
    magnetized: false,
  };
}

export function createPlayerStats(): PlayerStats {
  return {
    damageMul: 1,
    fireRateMul: 1,
    speedMul: 1,
    pickupRadiusMul: 1,
    powerupDurationMul: 1,
    extraShield: 0,
    salvageMul: 1,
  };
}

/** Neutral placeholder; T08 initializes the real values from ship/pilot content. */
export function createPlayerState(): PlayerState {
  const x = WORLD_W / 2;
  const y = WORLD_H - 60;
  return {
    active: true,
    id: 0,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    r: 3,
    alive: true,
    shield: 0,
    maxShield: 0,
    invulnT: 0,
    speed: 0,
    weapons: [],
    maxWeaponSlots: 0,
    magnetT: 0,
    repulsorT: 0,
    pickupRadius: 0,
    stats: createPlayerStats(),
  };
}

export function createRunState(
  seed: string,
  shipId: string,
  pilotId: string,
  levelId: string,
): RunState {
  const pickupsCollected = {} as Record<PickupKind, number>;
  for (const k of PICKUP_KINDS) pickupsCollected[k] = 0;
  return {
    shipId,
    pilotId,
    levelId,
    seed,
    score: 0,
    chain: 1,
    chainT: 0,
    salvage: 0,
    kills: 0,
    asteroidsDestroyed: 0,
    formations: new Map(),
    schematics: [],
    pilotsRescued: [],
    pickupsCollected,
    bossDefeated: false,
  };
}

export function createWorld(seed: string, opts: WorldOptions = {}): World {
  const cap = { ...DEFAULT_CAPACITIES, ...opts.capacities };
  // Player is id 0; pooled entities start at 1.
  let lastId = 0;
  return {
    width: WORLD_W,
    height: WORLD_H,
    tick: 0,
    time: 0,
    rng: createRng(seed),
    scrollSpeed: 0,
    scrollY: 0,
    player: createPlayerState(),
    input: { x: 0, y: 0, targetX: null, targetY: null },
    enemyBulletTimeScale: 1,
    playerShots: new Pool('playerShots', cap.playerShots, createBullet),
    enemyShots: new Pool('enemyShots', cap.enemyShots, createBullet),
    enemies: new Pool('enemies', cap.enemies, createEnemy),
    asteroids: new Pool('asteroids', cap.asteroids, createAsteroid),
    anomalies: new Pool('anomalies', cap.anomalies, createAnomaly),
    pickups: new Pool('pickups', cap.pickups, createPickup),
    events: new EventBus<GameEvents>(),
    run: createRunState(
      seed,
      opts.shipId ?? 'kestrel',
      opts.pilotId ?? 'blastroid',
      opts.levelId ?? 'kessler',
    ),
    nextId: () => ++lastId,
  };
}
