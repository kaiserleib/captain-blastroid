import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import type { PlayerState, WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { fireShot, NOSE_Y } from './shots';

/** Straight shots from the nose: single, twin at ±offset, triple adds the center. */
export function fireBlaster(
  w: World,
  p: PlayerState,
  _inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
): void {
  const y = p.y + NOSE_Y;
  const n = lv.count;
  if (n !== 2) fireShot(w, p, def, lv, p.x, y, 0);
  if (n >= 2) {
    fireShot(w, p, def, lv, p.x - lv.offset, y + 2, 0);
    fireShot(w, p, def, lv, p.x + lv.offset, y + 2, 0);
  }
}
