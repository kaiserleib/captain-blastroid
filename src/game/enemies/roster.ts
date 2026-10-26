import type { EnemyDef } from '../../content/enemies';
import type { Renderer } from '../../gfx/renderer';
import { registerEnemyDefs } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';

// Roster registry (T21). Every enemy the enemy system moves, fires and draws
// is registered here: Level 1's table from this module's index, each sector's
// `ROSTER` from its game/levels folder. Lookups are plain property reads, as
// the static `ENEMIES` table used to be.

const roster: Record<string, EnemyDef> = Object.create(null) as Record<string, EnemyDef>;
const hpScaled: Record<string, boolean> = Object.create(null) as Record<string, boolean>;

export interface RosterOptions {
  /**
   * The level's `enemyHpMul` applies to these enemies (Level 1's roster, which
   * later sectors reuse). New sector enemies are authored at their numbers
   * and leave this off.
   */
  hpScaled?: boolean;
}

/**
 * Registers enemy defs for the sim (`spawnEnemy`, kill scoring) and for the
 * enemy system (behavior, fire, sprite draw). Keys are the enemy ids. Call
 * once at module load. Re-registering the same def object is a no-op;
 * registering an id again with a different def throws, which catches id
 * collisions between sector folders (prefix your ids: `ion_`, `hz_`, ...).
 */
export function registerRoster(
  table: Readonly<Record<string, EnemyDef>>,
  opts: RosterOptions = {},
): void {
  for (const id in table) {
    const def = table[id] as EnemyDef;
    const had = roster[id];
    if (had !== undefined && had !== def)
      throw new Error(`registerRoster: duplicate enemy id "${id}"`);
  }
  for (const id in table) {
    roster[id] = table[id] as EnemyDef;
    hpScaled[id] = opts.hpScaled === true;
  }
  registerEnemyDefs(table);
}

/** The registered roster def for an id, or undefined (boss parts, `dummy`). */
export function rosterDef(id: string): EnemyDef | undefined {
  return roster[id];
}

/** Every registered roster id (tests, gallery, sandbox). */
export function rosterIds(): string[] {
  return Object.keys(roster);
}

const hpMuls = new WeakMap<World, number>();

/** The level's `enemyHpMul` (the director sets it from the LevelDef). */
export function setEnemyHpMul(w: World, mul: number): void {
  hpMuls.set(w, mul);
}

export function enemyHpMul(w: World): number {
  return hpMuls.get(w) ?? 1;
}

/** `max(1, round(hp × mul))`: a 1 HP gnat stays 1 HP. */
export function scaleHp(hp: number, mul: number): number {
  return Math.max(1, Math.round(hp * mul));
}

/** Pool slots are reused, so "already scaled" is remembered per entity id. */
const scaledId = new WeakMap<Enemy, number>();

/** Applied on an enemy's first tick (the enemy system's spawn hook); idempotent. */
export function applyHpMul(w: World, e: Enemy): void {
  if (hpScaled[e.defId] !== true) return;
  const mul = enemyHpMul(w);
  if (mul === 1 || e.maxHp <= 0 || scaledId.get(e) === e.id) return;
  scaledId.set(e, e.id);
  e.hp = scaleHp(e.hp, mul);
  e.maxHp = scaleHp(e.maxHp, mul);
}

/**
 * Extra drawing for one enemy, after its sprite (beams, telegraph lines,
 * shields). A def with `sprite: ''` skips the sprite, so this can draw the
 * whole enemy. `x`, `y` are the interpolated center.
 */
export type EnemyDrawFn = (w: World, r: Renderer, e: Enemy, x: number, y: number) => void;

const draws: Record<string, EnemyDrawFn> = Object.create(null) as Record<string, EnemyDrawFn>;

/** Registers an enemy's extra draw (z 40, the enemies layer). Throws on a second, different fn. */
export function registerEnemyDraw(defId: string, fn: EnemyDrawFn): void {
  const had = draws[defId];
  if (had !== undefined && had !== fn) throw new Error(`registerEnemyDraw: duplicate "${defId}"`);
  draws[defId] = fn;
}

export function enemyDrawFn(defId: string): EnemyDrawFn | undefined {
  return draws[defId];
}
