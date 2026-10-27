import type { WeaponDef, WeaponLevel } from '../../content/weapons';
import { isDestructible } from '../../sim/damage';
import { raycastSolid, type RayHit } from '../../sim/hooks';
import { getSpatialHash } from '../../sim/spatialHash';
import {
  Layer,
  type Asteroid,
  type Body,
  type Bullet,
  type PlayerState,
  type WeaponInstance,
} from '../../sim/types';
import { WORLD_W, type World } from '../../sim/world';
import { DEG, fireShot, NOSE_Y } from './shots';

// A disc's remaining bounces live in `Bullet.targetId`: discs never home, and
// only homing reads that field.

/**
 * L1–L2 alternate ±spread each volley (`inst.state` flips), twin discs fire
 * both, three add one straight up.
 */
export function fireRicochet(
  w: World,
  p: PlayerState,
  inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
): void {
  const y = p.y + NOSE_Y;
  const a = lv.spread * DEG;
  if (lv.count === 1) {
    inst.state = inst.state === 0 ? 1 : 0;
    disc(w, p, lv, def, p.x, y, inst.state === 1 ? -a : a);
    return;
  }
  disc(w, p, lv, def, p.x - 2, y, -a);
  disc(w, p, lv, def, p.x + 2, y, a);
  if (lv.count >= 3) disc(w, p, lv, def, p.x, y - 2, 0);
}

function disc(
  w: World,
  p: PlayerState,
  lv: WeaponLevel,
  def: WeaponDef,
  x: number,
  y: number,
  angle: number,
): void {
  const b = fireShot(w, p, def, lv, x, y, angle);
  if (b !== null) b.targetId = lv.bounces;
}

const hit: RayHit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };
let rock: Body | null = null;

function onRock(b: Body): boolean {
  if (!isDestructible(b as Asteroid)) {
    rock = b;
    return true;
  }
  return false;
}

/** Reflects the disc's velocity off a surface with unit normal (nx, ny), if it's heading in. */
function reflect(b: Bullet, nx: number, ny: number): boolean {
  const dot = b.vx * nx + b.vy * ny;
  if (dot >= 0) return false;
  b.vx -= 2 * dot * nx;
  b.vy -= 2 * dot * ny;
  b.targetId--;
  return true;
}

/**
 * Runs before the bullets system moves the discs: a disc whose next step
 * would cross a side edge, solid geometry (the `raycastSolid` hook) or an
 * indestructible rock reflects instead, while it has bounces left. Spent discs
 * fly on and leave the screen (or are absorbed as usual).
 */
export function updateRicochets(w: World, dt: number): void {
  const items = w.playerShots.items;
  const n = w.playerShots.count;
  let h = null;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Bullet;
    if (!b.active || b.weaponId !== 'ricochet' || b.targetId <= 0) continue;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (nx < b.r) {
      reflect(b, 1, 0);
      continue;
    }
    if (nx > WORLD_W - b.r) {
      reflect(b, -1, 0);
      continue;
    }
    if (raycastSolid(w, b.x, b.y, nx, ny, hit)) {
      if (reflect(b, hit.nx, hit.ny)) {
        b.x = hit.x + hit.nx * 0.5;
        b.y = hit.y + hit.ny * 0.5;
      }
      continue;
    }
    h ??= getSpatialHash(w);
    rock = null;
    h.qx = nx;
    h.qy = ny;
    h.qr = b.r;
    if (h.queryAt(Layer.Asteroid, onRock) && rock !== null) {
      const r = rock as Body;
      const dx = b.x - r.x;
      const dy = b.y - r.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) reflect(b, dx / d, dy / d);
    }
  }
}
