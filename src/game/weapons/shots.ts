import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import { spawnPlayerShot, type ShotInit } from '../../sim/spawn';
import type { Bullet, PlayerState } from '../../sim/types';
import type { World } from '../../sim/world';

export const DEG = Math.PI / 180;
/** Nose of a 24 px ship, relative to its center. */
export const NOSE_Y = -12;

// One reused init: spawn helpers copy it and never keep it.
const init: Required<ShotInit> = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: 2,
  damage: 1,
  pierce: 0,
  ttl: 4,
  sprite: '',
  weaponId: null,
  homing: 0,
  targetId: -1,
};

/** Spawns one shot of `def` at (x, y) heading `angle` rad clockwise from straight up. */
export function fireShot(
  w: World,
  p: PlayerState,
  def: WeaponDef,
  lv: WeaponLevel,
  x: number,
  y: number,
  angle: number,
): Bullet | null {
  init.x = x;
  init.y = y;
  init.vx = Math.sin(angle) * lv.speed;
  init.vy = -Math.cos(angle) * lv.speed;
  init.r = lv.radius;
  init.damage = lv.damage * p.stats.damageMul;
  init.pierce = lv.pierce;
  init.ttl = lv.ttl;
  init.sprite = lv.sprite;
  init.weaponId = def.id;
  init.homing = lv.homing;
  init.targetId = -1;
  return spawnPlayerShot(w, init);
}

const sfxP: { id: string; x?: number } = { id: '', x: 0 };

export function emitSfx(w: World, id: string, x: number): void {
  if (id === '') return;
  sfxP.id = id;
  sfxP.x = x;
  w.events.emit('sfx', sfxP);
}
