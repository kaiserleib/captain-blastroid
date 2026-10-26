import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import { getSpatialHash } from '../../sim/spatialHash';
import { Layer, type Body, type PlayerState, type WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { DEG, fireShot } from './shots';

/** Extra launch angle per missile pair, so a volley fans out. */
const PAIR_FAN = 18 * DEG;

let aheadY = 0;
function isAhead(b: Body): boolean {
  return b.y < aheadY;
}

/** Closest enemy above the ship, else the closest anywhere. Null if none. */
export function pickSeekerTarget(w: World, x: number, y: number): Body | null {
  const h = getSpatialHash(w);
  aheadY = y;
  return h.nearest(x, y, Layer.Enemy, Infinity, isAhead) ?? h.nearest(x, y, Layer.Enemy);
}

/**
 * Missiles launch sideways from alternating wing pods, then the bullet
 * system's homing turns them onto the target (and retargets if it dies).
 */
export function fireSeeker(
  w: World,
  p: PlayerState,
  _inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
): void {
  const target = pickSeekerTarget(w, p.x, p.y);
  const tid = target === null ? -1 : target.id;
  for (let i = 0; i < lv.count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const angle = side * (lv.spread * DEG + (i >> 1) * PAIR_FAN);
    const b = fireShot(w, p, def, lv, p.x + side * lv.offset, p.y + 2, angle);
    if (b !== null) b.targetId = tid;
  }
}
