import { DRONE_SPARK, DRONE_SPARK_RANGE, WEAPONS, type WeaponLevel } from '../../content/weapons';
import { TAU } from '../../engine/math';
import { damageEnemy } from '../../sim/damage';
import { getSpatialHash } from '../../sim/spatialHash';
import { targetFilterFor } from '../../sim/targeting';
import {
  Layer,
  type Body,
  type Bullet,
  type Enemy,
  type PlayerState,
  type WeaponInstance,
} from '../../sim/types';
import type { World } from '../../sim/world';
import { emitSfx, fireShot } from './shots';
import { MAX_CONTACTS, MAX_DRONES, weaponsState, type WeaponsState } from './state';

/** Orbit angle of drone `i` of `n` when the lead drone is at `a`. */
export function droneAngle(a: number, i: number, n: number): number {
  return a + (i * TAU) / n;
}

export function tickDroneContacts(s: WeaponsState, dt: number): void {
  const ids = s.contactId;
  const t = s.contactT;
  for (let i = 0; i < MAX_CONTACTS; i++) {
    if (ids[i] === -1) continue;
    const left = (t[i] as number) - dt;
    if (left <= 0) ids[i] = -1;
    else t[i] = left;
  }
}

/** True if drones hit `id` within the last tick window; otherwise records the hit. */
function onCooldown(s: WeaponsState, id: number, tick: number): boolean {
  const ids = s.contactId;
  const t = s.contactT;
  let slot = -1;
  for (let i = 0; i < MAX_CONTACTS; i++) {
    const v = ids[i] as number;
    if (v === id) return true;
    if (v === -1 && slot === -1) slot = i;
  }
  if (slot === -1) {
    // Full: evict whichever enemy is closest to being hittable again.
    slot = 0;
    for (let i = 1; i < MAX_CONTACTS; i++) if ((t[i] as number) < (t[slot] as number)) slot = i;
  }
  ids[slot] = id;
  t[slot] = tick;
  return false;
}

let cw: World;
let cs: WeaponsState;
let cDamage = 0;
let cTick = 0;

function onDroneEnemy(b: Body): void {
  const e = b as Enemy;
  if (onCooldown(cs, e.id, cTick)) return;
  damageEnemy(cw, e, cDamage, 'player');
}

/**
 * Advances the orbit (angle in `inst.state`), places the drones and deals
 * contact damage. Shot blocking happens in the collision pass via `droneBlocker`.
 */
export function updateDrones(
  w: World,
  p: PlayerState,
  inst: WeaponInstance,
  lv: WeaponLevel,
  dt: number,
): void {
  const s = weaponsState(w);
  let a = inst.state + lv.orbitSpeed * dt;
  if (a > TAU) a -= TAU;
  inst.state = a;
  const n = lv.count < MAX_DRONES ? lv.count : MAX_DRONES;
  s.droneN = n;
  s.droneR = lv.radius;
  cw = w;
  cs = s;
  cDamage = lv.damage * p.stats.damageMul;
  cTick = lv.contactTick;
  const h = getSpatialHash(w);
  for (let i = 0; i < n; i++) {
    const da = droneAngle(a, i, n);
    const x = p.x + Math.cos(da) * lv.orbitRadius;
    const y = p.y + Math.sin(da) * lv.orbitRadius;
    s.droneX[i] = x;
    s.droneY[i] = y;
    h.qx = x;
    h.qy = y;
    h.qr = lv.radius;
    h.queryAt(Layer.Enemy, onDroneEnemy);
  }
  if (lv.sparkCooldown > 0 && n > 0) tickSparks(w, p, s, lv.sparkCooldown, n, dt);
}

/**
 * One shared timer, one drone per beat: each drone fires every `cooldown` s,
 * but the orbit's sparks are spread evenly instead of leaving in a volley.
 */
function tickSparks(
  w: World,
  p: PlayerState,
  s: WeaponsState,
  cooldown: number,
  n: number,
  dt: number,
): void {
  s.sparkT -= dt * p.stats.fireRateMul;
  if (s.sparkT > 0) return;
  const k = s.sparkNext < n ? s.sparkNext : 0;
  fireSpark(w, p, s.droneX[k] as number, s.droneY[k] as number);
  s.sparkNext = k + 1;
  s.sparkT += cooldown / n;
  // A huge fireRateMul can't bank sparks into a burst.
  if (s.sparkT < 0) s.sparkT = 0;
}

/** Angle (clockwise from straight up) of a spark from (x, y): at the nearest target in range, else 0. */
export function sparkAngle(w: World, x: number, y: number): number {
  const t = getSpatialHash(w).nearest(x, y, Layer.Enemy, DRONE_SPARK_RANGE, targetFilterFor(w));
  if (t === null) return 0;
  return Math.atan2(t.x - x, y - t.y);
}

function fireSpark(w: World, p: PlayerState, x: number, y: number): void {
  fireShot(w, p, WEAPONS.orbitDrones, DRONE_SPARK, x, y, sparkAngle(w, x, y));
}

/** Shot-blocker hook: drones eat enemy shots they touch. */
export function droneBlocker(w: World, shot: Bullet): boolean {
  const s = weaponsState(w);
  const n = s.droneN;
  if (n === 0) return false;
  const rr = s.droneR + shot.r;
  for (let i = 0; i < n; i++) {
    const dx = (s.droneX[i] as number) - shot.x;
    const dy = (s.droneY[i] as number) - shot.y;
    if (dx * dx + dy * dy < rr * rr) {
      emitSfx(w, 'drone_hit', shot.x);
      return true;
    }
  }
  return false;
}
