import { ESCAPE_POD_TUNING } from '../../content/pickups';
import { spawnPickup } from '../../sim/spawn';
import type { Bullet, Pickup } from '../../sim/types';
import type { World } from '../../sim/world';
import { emitSfx, emitToast, getPickupState, spawnScratch } from './state';

/** Spawns a pod carrying `pilotId` just above the playfield at `x`. T15 schedules these. */
export function spawnEscapePod(w: World, pilotId: string, x: number): Pickup | null {
  const o = spawnScratch;
  o.kind = 'escapePod';
  o.x = x;
  o.y = -ESCAPE_POD_TUNING.r - 2;
  o.vx = 0;
  o.vy = ESCAPE_POD_TUNING.speed;
  o.r = ESCAPE_POD_TUNING.r;
  o.payload = pilotId;
  o.amount = 0;
  o.ttl = ESCAPE_POD_TUNING.ttl;
  const p = spawnPickup(w, o);
  if (p !== null) getPickupState(w).pods++;
  return p;
}

export function losePod(w: World, pod: Pickup): void {
  if (!pod.active) return;
  w.pickups.release(pod);
  const st = getPickupState(w);
  if (st.pods > 0) st.pods--;
  emitSfx(w, 'enemy_die_s', pod.x);
  emitToast(w, 'POD LOST');
}

/** Shot blocker (registered by index.ts): an enemy shot touching a pod destroys it. */
export function podShotBlocker(w: World, shot: Bullet): boolean {
  if (getPickupState(w).pods === 0) return false;
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const p = items[i] as Pickup;
    if (!p.active || p.kind !== 'escapePod') continue;
    const dx = p.x - shot.x;
    const dy = p.y - shot.y;
    const rr = p.r + shot.r;
    if (dx * dx + dy * dy < rr * rr) {
      losePod(w, p);
      return true;
    }
  }
  return false;
}
