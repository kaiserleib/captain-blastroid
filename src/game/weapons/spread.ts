import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import type { PlayerState, WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { DEG, fireShot, NOSE_Y } from './shots';

/** Fan of `count` shots evenly across ±spread degrees. */
export function fireSpread(
  w: World,
  p: PlayerState,
  _inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
): void {
  const n = lv.count;
  const y = p.y + NOSE_Y + 2;
  if (n <= 1) {
    fireShot(w, p, def, lv, p.x, y, 0);
    return;
  }
  const step = (2 * lv.spread * DEG) / (n - 1);
  for (let i = 0; i < n; i++) fireShot(w, p, def, lv, p.x, y, -lv.spread * DEG + step * i);
}
