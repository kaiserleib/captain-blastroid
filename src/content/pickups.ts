// Pickup tunables, per docs/design.md → Pickups.
import { WEAPON_ORDER } from './weapons';

/** Weapon ids a capsule can carry, in letter order B/S/L/M/D. */
export const CAPSULE_WEAPON_IDS: readonly string[] = WEAPON_ORDER;

/** Salvage bit denominations, smallest first. */
export const SALVAGE_SIZES: readonly number[] = [1, 5, 25];

export const PICKUP_TUNING = {
  /** Seconds before an uncollected pickup expires. */
  ttl: 10,
  /** Blink during the last seconds of ttl. */
  blinkT: 2,
  /** Drift speed on top of the scroll speed, px/s. */
  driftExtra: 10,
  /** Sideways bob, px/s amplitude and rad/s. */
  bobSpeed: 8,
  bobFreq: 2.2,
  /** How fast a pickup's velocity settles onto its drift (1/s). Salvage bursts decay with this. */
  settleRate: 4,
  /** Salvage spray: burst speed range (px/s) and upward bias. */
  salvageBurstMin: 25,
  salvageBurstMax: 60,
  salvageBurstUp: 30,
  /** Collision radius used for collection and pod hits. */
  r: 6,
  /** Fallback until T08 sets player.pickupRadius. */
  defaultPickupRadius: 14,
  shieldFullScore: 100,
  /** If no non-salvage pickup has dropped for this long, the next kill guarantees one. */
  pityTime: 25,
  /** Formation / carrier capsules favor owned non-max weapons this often. */
  ownedWeaponBias: 0.5,
  /**
   * Seconds after a formation-clear capsule before another clear drops one
   * (T18: dropping one per clear maxed four weapons by mid-level).
   */
  formationCapsuleGap: 25,
  /** What a clear inside that gap sprays instead. */
  formationBonusSalvage: 1,
} as const;

export const POWERUP_TUNING = {
  magnetDuration: 8,
  /** Homing acceleration px/s² and top speed px/s. */
  magnetAccel: 600,
  magnetMaxSpeed: 300,
  repulsorDuration: 6,
  repulsorRadius: 48,
  /** Linear-falloff acceleration (px/s²) at the ship. Bullets get batted, rocks get shoved. */
  repulsorShotForce: 2400,
  repulsorAsteroidForce: 900,
} as const;

export const ESCAPE_POD_TUNING = {
  /** Absolute drift speed, px/s (slower than the scroll, so it lingers). */
  speed: 12,
  r: 6,
  /** Pods never expire; they are lost only off-screen or to enemy fire. */
  ttl: Infinity,
} as const;

/** Ships whose schematic can drop, in unlock order. */
export const SCHEMATIC_SHIPS: readonly string[] = ['bulwark', 'dart'];
