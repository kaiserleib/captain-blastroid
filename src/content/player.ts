// Player flight and damage-feedback tunables (T08). Ship numbers live in ships.ts.

export const PLAYER_TUNING = {
  spawnX: 120,
  spawnY: 340,
  /** Shmup-convention hitbox, far smaller than the 24 px sprite. */
  hitboxR: 4,
  /** px; multiplied by stats.pickupRadiusMul. */
  basePickupRadius: 14,
  /** Playfield clamp margin, px. */
  margin: 8,
  /** Seconds from rest to full speed. */
  accelTime: 0.06,
  /** Seconds from full speed to rest. */
  stopTime: 0.04,
  /**
   * Mouse-follow arrival gain, 1/s: commanded speed is min(speed, d × gain), so
   * the ship eases in over the last ~8–12 px and settles instead of jittering.
   */
  arriveGain: 12,
  /** Below this distance (px) the ship snaps onto a resting cursor. */
  arriveSnap: 0.25,
  /** Vertical offset added to the mouse target, px (kept for touch-relative modes later). */
  mouseOffsetY: 0,
  /** |vx| beyond this fraction of speed shows the bank frames. */
  bankThreshold: 0.4,
  /** vy below −this fraction of speed shows the long engine flame. */
  boostThreshold: 0.3,
  flameFps: 12,
  /** Invulnerability blink rate, Hz. */
  blinkHz: 15,
  /** White flash after a hit, seconds. */
  hitFlash: 0.06,
  /** Seconds from death to `runOver`. */
  deathDelay: 2.0,
  deathHitstop: 0.12,
} as const;
