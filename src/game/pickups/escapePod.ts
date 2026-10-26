import { ESCAPE_POD_TUNING } from '../../content/pickups';
import type { Renderer, SpriteOpts } from '../../gfx/renderer';
import { spawnPickup } from '../../sim/spawn';
import type { Bullet, Pickup } from '../../sim/types';
import type { DrawLayer, World } from '../../sim/world';
import { emitSfx, emitToast, getPickupState, spawnScratch } from './state';

// A pod's remaining HP lives in `amount` (pods carry no salvage), so it costs
// no new field: the first hit at amount 1 destroys it.

const POD_FLASH_T = 0.1;
const PIP_COLOR = '#58f8a0';
const PIP_DARK = '#104828';

/**
 * Spawns a pod carrying `pilotId` just above the playfield at `x`. It
 * survives `hp − 1` enemy shots. The director schedules these.
 */
export function spawnEscapePod(w: World, pilotId: string, x: number, hp = 1): Pickup | null {
  const o = spawnScratch;
  o.kind = 'escapePod';
  o.x = x;
  o.y = -ESCAPE_POD_TUNING.r - 2;
  o.vx = 0;
  o.vy = ESCAPE_POD_TUNING.speed;
  o.r = ESCAPE_POD_TUNING.r;
  o.payload = pilotId;
  o.amount = Math.max(1, Math.round(hp));
  o.ttl = ESCAPE_POD_TUNING.ttl;
  const p = spawnPickup(w, o);
  if (p !== null) getPickupState(w).pods++;
  return p;
}

/** Remaining hits a pod can take (1 = the next one destroys it). */
export function podHp(pod: Pickup): number {
  return Math.max(1, pod.amount);
}

const CACHE_PREFIX = 'cache:';

/** A pod with no pilot aboard: an escort-able salvage cache worth `salvage` when collected. */
export function cachePayload(salvage: number): string {
  return `${CACHE_PREFIX}${Math.max(0, Math.round(salvage))}`;
}

export function isCachePod(pod: Pickup): boolean {
  return pod.payload.startsWith(CACHE_PREFIX);
}

export function cacheSalvage(pod: Pickup): number {
  return isCachePod(pod) ? Number(pod.payload.slice(CACHE_PREFIX.length)) || 0 : 0;
}

export function losePod(w: World, pod: Pickup): void {
  if (!pod.active) return;
  w.pickups.release(pod);
  const st = getPickupState(w);
  if (st.pods > 0) st.pods--;
  emitSfx(w, 'enemy_die_s', pod.x);
  emitToast(w, isCachePod(pod) ? 'CACHE LOST' : 'POD LOST');
}

/** World time of each pod's last survived hit, checked by id since pool slots recycle. */
const lastHit = new WeakMap<Pickup, { id: number; t: number }>();

function onPodHit(w: World, pod: Pickup): void {
  if (pod.amount <= 1) {
    losePod(w, pod);
    return;
  }
  pod.amount--;
  const h = lastHit.get(pod);
  if (h === undefined) lastHit.set(pod, { id: pod.id, t: w.time });
  else {
    h.id = pod.id;
    h.t = w.time;
  }
  emitSfx(w, 'armor_ping', pod.x);
}

/** Shot blocker (registered by index.ts): an enemy shot touching a pod costs it one HP. */
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
      onPodHit(w, p);
      return true;
    }
  }
  return false;
}

const flashOpts: SpriteOpts = { frame: 0, flash: true };

function drawPodOverlay(w: World, r: Renderer, alpha: number): void {
  if (getPickupState(w).pods === 0) return;
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (!k.active || k.kind !== 'escapePod') continue;
    const x = Math.round(k.prevX + (k.x - k.prevX) * alpha);
    const y = Math.round(k.prevY + (k.y - k.prevY) * alpha);
    const h = lastHit.get(k);
    if (h !== undefined && h.id === k.id && w.time - h.t < POD_FLASH_T) {
      flashOpts.frame = Math.floor(w.time * 2) & 1;
      r.sprite('escape_pod', x, y, flashOpts);
    }
    const hp = k.amount;
    if (hp <= 1) continue;
    // 1 px pips, 2 px apart, centered over the pod on a dark backing.
    const x0 = x - (hp - 1);
    const py = y - k.r - 4;
    r.rect(x0 - 1, py - 1, hp * 2 + 1, 3, PIP_DARK);
    for (let j = 0; j < hp; j++) r.rect(x0 + j * 2, py, 1, 1, PIP_COLOR);
  }
}

/** Pod hit flash and HP pips, just above the pickups layer (20). */
export const podOverlayLayer: DrawLayer = { name: 'podOverlay', z: 21, draw: drawPodOverlay };
