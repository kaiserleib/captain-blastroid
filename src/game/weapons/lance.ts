import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import type { PlayerState, WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { fireShot, NOSE_Y } from './shots';

/** One long piercing bolt; pierce comes from the level table. */
export function fireLance(
  w: World,
  p: PlayerState,
  _inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
): void {
  fireShot(w, p, def, lv, p.x, p.y + NOSE_Y - 4, 0);
}
