import type { BossPartSpec } from '../../content/bosses';
import { spawnEnemy, type EnemyOverrides } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';

// Generic multi-part rig: a controller position plus N `isBoss` enemies held
// at rigid offsets. The enemy system skips non-roster defs, so the rig
// integrates its parts itself. Reusable by any future boss.

export interface PartSlot {
  readonly spec: BossPartSpec;
  /** The live entity, or null once it is gone. */
  enemy: Enemy | null;
  /** Entity id at spawn, to tell a recycled pool slot from our part. */
  id: number;
  /** Destroyed by damage (not merely released at the end). */
  destroyed: boolean;
  /** Seconds since destroyed (wreck smoke, sparks). */
  deadT: number;
  targetable: boolean;
}

const overrides: EnemyOverrides = { isBoss: true, hp: 1, r: 1, vx: 0, vy: 0 };

export class BossRig {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  readonly slots: PartSlot[];

  constructor(specs: readonly BossPartSpec[]) {
    this.slots = specs.map((spec) => ({
      spec,
      enemy: null,
      id: -1,
      destroyed: false,
      deadT: 0,
      targetable: spec.targetable,
    }));
  }

  /** Spawns every part at the controller. Returns false if the enemy pool was too full. */
  spawn(w: World, x: number, y: number): boolean {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = this.vy = 0;
    let ok = true;
    for (const s of this.slots) {
      overrides.hp = s.spec.hp;
      overrides.r = s.spec.r;
      const e = spawnEnemy(w, s.spec.defId, x + s.spec.ox, y + s.spec.oy, overrides);
      s.enemy = e;
      s.id = e === null ? -1 : e.id;
      s.destroyed = false;
      s.deadT = 0;
      s.targetable = s.spec.targetable;
      if (e === null) ok = false;
    }
    return ok;
  }

  /** True while the slot's entity is still ours and in play. */
  alive(s: PartSlot): boolean {
    const e = s.enemy;
    return e !== null && e.active && e.id === s.id;
  }

  /** Index of the slot holding `e`, or -1. */
  slotOf(e: Enemy): number {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i] as PartSlot;
      if (s.enemy === e && s.id === e.id) return i;
    }
    return -1;
  }

  /**
   * Moves the controller to (x, y) over dt and carries every part along
   * (prev for interpolation, velocity for the sim's closing-speed checks).
   * Parts the sim released since last tick are marked destroyed; returns how
   * many, so the boss can react.
   */
  moveTo(x: number, y: number, dt: number): number {
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = dt > 0 ? (x - this.x) / dt : 0;
    this.vy = dt > 0 ? (y - this.y) / dt : 0;
    this.x = x;
    this.y = y;
    let lost = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i] as PartSlot;
      if (s.destroyed) {
        s.deadT += dt;
        continue;
      }
      if (s.enemy === null) continue;
      if (!this.alive(s)) {
        s.enemy = null;
        s.destroyed = true;
        s.deadT = 0;
        lost++;
        continue;
      }
      const e = s.enemy;
      e.prevX = e.x;
      e.prevY = e.y;
      e.x = x + s.spec.ox;
      e.y = y + s.spec.oy;
      e.vx = this.vx;
      e.vy = this.vy;
      e.t += dt;
    }
    return lost;
  }

  /** Sum of live part HP (destroyed parts count 0). */
  hp(): number {
    let n = 0;
    for (const s of this.slots) if (this.alive(s)) n += Math.max(0, (s.enemy as Enemy).hp);
    return n;
  }

  maxHp(): number {
    let n = 0;
    for (const s of this.slots) n += s.spec.hp;
    return n;
  }

  /** Releases every remaining part (end of the death sequence). */
  release(w: World): void {
    for (const s of this.slots) {
      if (this.alive(s)) w.enemies.release(s.enemy as Enemy);
      s.enemy = null;
    }
  }
}
