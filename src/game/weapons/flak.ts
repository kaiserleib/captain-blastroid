import { FLAK_FRAGMENT, WEAPONS, type WeaponDef, type WeaponLevel } from '../../content/weapons';
import { damageAsteroid, damageEnemy } from '../../sim/damage';
import { isSolidAt } from '../../sim/hooks';
import { NO_HIT, spawnPlayerShot, type ShotInit } from '../../sim/spawn';
import { getSpatialHash } from '../../sim/spatialHash';
import {
  Layer,
  type Asteroid,
  type Body,
  type Bullet,
  type Enemy,
  type PlayerState,
  type WeaponInstance,
} from '../../sim/types';
import type { World } from '../../sim/world';
import { DEG, NOSE_Y } from './shots';
import { MAX_BURSTS, MAX_SHELLS, weaponsState, type WeaponsState } from './state';

const TAU = Math.PI * 2;
const CONTACT_MASK = Layer.Enemy | Layer.Asteroid | Layer.Anomaly;
const LEVELS = WEAPONS.flak.levels;

/** Fires `count` shells, fanned ±spread and spaced ±offset when there are two. */
export function fireFlak(
  w: World,
  p: PlayerState,
  inst: WeaponInstance,
  lv: WeaponLevel,
  _def: WeaponDef,
): void {
  const li = inst.level - 1;
  const y = p.y + NOSE_Y;
  if (lv.count === 1) {
    launchShell(w, p.x, y, 0, lv, li);
    return;
  }
  for (let i = 0; i < lv.count; i++) {
    const side = (i / (lv.count - 1)) * 2 - 1;
    launchShell(w, p.x + side * lv.offset, y, side * lv.spread * DEG, lv, li);
  }
}

function launchShell(
  w: World,
  x: number,
  y: number,
  angle: number,
  lv: WeaponLevel,
  levelIndex: number,
): void {
  const s = weaponsState(w);
  for (let i = 0; i < MAX_SHELLS; i++) {
    if (s.shellOn[i] !== 0) continue;
    s.shellOn[i] = 1;
    s.shellX[i] = s.shellPX[i] = x;
    s.shellY[i] = s.shellPY[i] = y;
    s.shellVX[i] = Math.sin(angle) * lv.speed;
    s.shellVY[i] = -Math.cos(angle) * lv.speed;
    s.shellT[i] = lv.ttl;
    s.shellLv[i] =
      levelIndex < 0 ? 0 : levelIndex >= LEVELS.length ? LEVELS.length - 1 : levelIndex;
    return;
  }
}

let contact: Body | null = null;
let contactLayer = 0;

function onContact(b: Body, layer: number): boolean {
  contact = b;
  contactLayer = layer;
  return true;
}

/**
 * Moves the shells and bursts each one whose fuse ran out or that touched an
 * enemy, a rock, an anomaly or solid geometry. Runs in the weapon system,
 * against last tick's spatial hash like the other auto-aim weapons.
 */
export function updateShells(w: World, dt: number): void {
  const s = weaponsState(w);
  let h = null;
  for (let i = 0; i < MAX_SHELLS; i++) {
    if (s.shellOn[i] === 0) continue;
    s.shellPX[i] = s.shellX[i] as number;
    s.shellPY[i] = s.shellY[i] as number;
    const x = (s.shellX[i] as number) + (s.shellVX[i] as number) * dt;
    const y = (s.shellY[i] as number) + (s.shellVY[i] as number) * dt;
    s.shellX[i] = x;
    s.shellY[i] = y;
    s.shellT[i] = (s.shellT[i] as number) - dt;
    h ??= getSpatialHash(w);
    const lv = LEVELS[s.shellLv[i] as number] as WeaponLevel;
    contact = null;
    h.qx = x;
    h.qy = y;
    h.qr = lv.radius;
    h.queryAt(CONTACT_MASK, onContact);
    if (contact === null && (s.shellT[i] as number) > 0 && !isSolidAt(w, x, y)) continue;
    s.shellOn[i] = 0;
    burst(w, s, x, y, lv, contact, contactLayer);
  }
}

const frag: Required<ShotInit> = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: FLAK_FRAGMENT.radius,
  damage: 1,
  pierce: 0,
  ttl: FLAK_FRAGMENT.ttl,
  sprite: FLAK_FRAGMENT.sprite,
  weaponId: 'flak',
  homing: 0,
  targetId: -1,
};

/**
 * The shell's impact hit (if it touched something), `fragments` evenly spaced
 * fragments from a random start angle, the bullet erase and a burst ring.
 * Fragments skip the body the shell hit, so contact isn't a 6× point-blank hit.
 */
export function burst(
  w: World,
  s: WeaponsState,
  x: number,
  y: number,
  lv: WeaponLevel,
  hitBody: Body | null,
  hitLayer: number,
): void {
  const mul = w.player.stats.damageMul;
  let skip = -1;
  if (hitBody !== null) {
    skip = hitBody.id;
    if (hitLayer === Layer.Enemy) damageEnemy(w, hitBody as Enemy, lv.damage * mul, 'player');
    else if (hitLayer === Layer.Asteroid)
      damageAsteroid(w, hitBody as Asteroid, lv.damage * mul, true);
  }
  const n = lv.fragments;
  const a0 = w.rng.next() * TAU;
  frag.x = x;
  frag.y = y;
  frag.damage = lv.fragDamage * mul;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * TAU) / n;
    frag.vx = Math.cos(a) * FLAK_FRAGMENT.speed;
    frag.vy = Math.sin(a) * FLAK_FRAGMENT.speed;
    const b = spawnPlayerShot(w, frag);
    if (b !== null && skip >= 0) markHit(b, skip);
  }
  eraseEnemyShots(w, x, y, lv.eraseR);
  const j = s.burstNext;
  s.burstX[j] = x;
  s.burstY[j] = y;
  s.burstR[j] = lv.eraseR;
  s.burstTick[j] = w.tick;
  s.burstNext = (j + 1) % MAX_BURSTS;
}

function markHit(b: Bullet, id: number): void {
  const ids = b.hitIds;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === NO_HIT) {
      ids[i] = id;
      return;
    }
  }
  ids.push(id);
}

/** Releases every enemy shot whose circle reaches within `r` of (x, y). Returns the count. */
export function eraseEnemyShots(w: World, x: number, y: number, r: number): number {
  const pool = w.enemyShots;
  const items = pool.items;
  const n = pool.count;
  let erased = 0;
  for (let i = 0; i < n; i++) {
    const b = items[i] as Bullet;
    if (!b.active) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    const rr = r + b.r;
    if (dx * dx + dy * dy < rr * rr) {
      pool.release(b);
      erased++;
    }
  }
  return erased;
}
