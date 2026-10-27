export type EntityId = number;

export const Layer = {
  Player: 1,
  PlayerShot: 2,
  Enemy: 4,
  EnemyShot: 8,
  Asteroid: 16,
  Anomaly: 32,
  Pickup: 64,
} as const;

/** Every pooled entity. `active=false` means the slot is free. */
export interface Body {
  active: boolean;
  id: EntityId;
  /** Center, logical playfield px. */
  x: number;
  y: number;
  /** For render interpolation; set at the start of each tick. */
  prevX: number;
  prevY: number;
  /** px / second */
  vx: number;
  vy: number;
  /** Collision radius. */
  r: number;
}

export interface Damageable {
  hp: number;
  maxHp: number;
  flashT: number;
}

export interface Bullet extends Body {
  owner: 'player' | 'enemy';
  damage: number;
  /** Remaining extra hits; 0 = dies on first hit. */
  pierce: number;
  /** Seconds. */
  ttl: number;
  /** Sprite id. */
  sprite: string;
  /** Radians, render only. */
  rot: number;
  /** Which player weapon spawned it. */
  weaponId: string | null;
  /** Turn rate rad/s, 0 = none. */
  homing: number;
  /** -1 = none. */
  targetId: EntityId;
  /** Enemies already hit (pierce); cleared on spawn. */
  hitIds: EntityId[];
}

export interface Enemy extends Body, Damageable {
  /** Key into content/enemies.ts. */
  defId: string;
  /** Seconds alive. */
  t: number;
  /** Behavior state machine slot. */
  state: number;
  /** Behavior-owned scratch (anchor/target). */
  ax: number;
  ay: number;
  /** Seconds until next shot. */
  fireT: number;
  avoidsAsteroids: boolean;
  /** -1 = none. */
  formationId: number;
  isBoss: boolean;
  contactDamage: number;
}

export interface Asteroid extends Body, Damageable {
  size: 'small' | 'medium' | 'large';
  rot: number;
  spin: number;
  /** Sprite variant. */
  variant: number;
}

export interface Anomaly extends Body {
  kind: 'blackhole' | 'pulsar';
  t: number;
  /** Effect field. */
  strength: number;
  radius: number;
}

export const PICKUP_KINDS = [
  'weapon',
  'upgrade',
  'shield',
  'magnet',
  'repulsor',
  'salvage',
  'schematic',
  'escapePod',
] as const;

export type PickupKind = (typeof PICKUP_KINDS)[number];

export interface Pickup extends Body {
  kind: PickupKind;
  /** weaponId / shipId / pilotId / ''; salvage uses `amount`. */
  payload: string;
  amount: number;
  ttl: number;
  magnetized: boolean;
}

export interface WeaponInstance {
  id: string;
  level: number;
  cooldown: number;
  state: number;
}

export interface PlayerState extends Body {
  alive: boolean;
  shield: number;
  maxShield: number;
  invulnT: number;
  /** px/s */
  speed: number;
  weapons: WeaponInstance[];
  maxWeaponSlots: number;
  magnetT: number;
  repulsorT: number;
  pickupRadius: number;
  /** Multipliers from ship + pilot + meta upgrades. */
  stats: PlayerStats;
}

export interface PlayerStats {
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  pickupRadiusMul: number;
  powerupDurationMul: number;
  extraShield: number;
  salvageMul: number;
  /** Damage to asteroids and crumbly/gate tiles (Rook). */
  rockDmgMul: number;
  /** Weight on uncommon/rare drop-table entries: shield, upgrade, magnet, repulsor (Nyx). */
  rareDropMul: number;
  /** Added weapon slots (Wren); the loadout caps the total at MAX_WEAPON_SLOTS. */
  extraSlots: number;
  /** Extra salvage per asteroid the player destroys (Rook). */
  rockSalvage: number;
}

/**
 * Movement request for one tick, written by input. `x,y` is a direction with
 * length <= 1 (keys, stick). When `targetX/Y` are set (mouse-follow), the
 * player steers toward that playfield point instead.
 */
export interface MoveIntent {
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
}
