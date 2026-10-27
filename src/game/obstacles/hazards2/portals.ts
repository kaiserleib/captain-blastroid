// Portal pairs: a body whose center crosses into one ring leaves the partner
// with the same velocity, r + 2 px out along its heading.
import { PORTAL, PORTAL_COLORS, type PortalColorId } from '../../../content/obstacles';
import type { Pool } from '../../../engine/pool';
import { isSolidAt } from '../../../sim/hooks';
import type { Anomaly, Body, Enemy } from '../../../sim/types';
import { WORLD_H, WORLD_W, type World } from '../../../sim/world';
import { pulsarRingRadius, pulsarEchoRadius } from '../anomalies/pulsar';
import { isFieldOnly } from '../anomalies/state';
import {
  hz,
  MAX_FLASHES,
  onCooldown,
  peekHz,
  setCooldown,
  type HazardState,
  type PortalEnd,
  type PortalPair,
} from './state';

export interface PortalPairOptions {
  /** `cyan`, `orange` or `lime`; anything else is cyan. */
  color?: string;
  vxA?: number;
  vyA?: number;
  vxB?: number;
  vyB?: number;
}

function colorId(c: string | undefined): PortalColorId {
  return c === 'orange' || c === 'lime' ? c : 'cyan';
}

function placeEnd(e: PortalEnd, x: number, y: number, vx: number, vy: number): void {
  e.x = e.prevX = x;
  e.y = e.prevY = y;
  e.vx = vx;
  e.vy = vy;
  e.owned = false;
  e.open = true;
}

/** Spawns a pair. Velocities default to 0 (fixed); pass the scroll speed to drift. Null when full. */
export function spawnPortalPair(
  w: World,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  o: PortalPairOptions = {},
): PortalPair | null {
  const s = hz(w);
  for (let i = 0; i < s.pairs.length; i++) {
    const p = s.pairs[i] as PortalPair;
    if (p.active) continue;
    p.active = true;
    p.id = s.nextPairId++;
    p.color = colorId(o.color);
    p.swapT = 0;
    p.swapWith = null;
    p.t = 0;
    // Ends may have been swapped into another pair earlier: re-home them.
    p.a.pair = p;
    p.b.pair = p;
    placeEnd(p.a, ax, ay, o.vxA ?? 0, o.vyA ?? 0);
    placeEnd(p.b, bx, by, o.vxB ?? 0, o.vyB ?? 0);
    if (i >= s.pairCount) s.pairCount = i + 1;
    return p;
  }
  return null;
}

/** Owners (Gate Pylons, bosses) carry an end: call every tick with its position. */
export function setPortalEnd(
  w: World,
  pair: PortalPair,
  end: 'a' | 'b',
  x: number,
  y: number,
): void {
  if (!pair.active) return;
  const e = end === 'a' ? pair.a : pair.b;
  e.owned = true;
  e.vx = 0;
  e.vy = 0;
  e.x = x;
  e.y = y;
}

export function collapsePortalPair(w: World, pair: PortalPair): void {
  if (!pair.active) return;
  pair.active = false;
  const q = pair.swapWith;
  if (q !== null && q.swapWith === pair) {
    q.swapWith = null;
    q.swapT = 0;
  }
  pair.swapWith = null;
  pair.swapT = 0;
  const s = hz(w);
  while (s.pairCount > 0 && !(s.pairs[s.pairCount - 1] as PortalPair).active) s.pairCount--;
}

/**
 * Re-pairs two pairs after a `PORTAL.swapTime` color-flicker telegraph:
 * p = (p.a, q.b) and q = (q.a, p.b). Returns false if either is busy or dead.
 */
export function swapPortals(w: World, p: PortalPair, q: PortalPair): boolean {
  if (p === q || !p.active || !q.active || p.swapT > 0 || q.swapT > 0) return false;
  p.swapT = q.swapT = PORTAL.swapTime;
  p.swapWith = q;
  q.swapWith = p;
  return true;
}

function finishSwap(p: PortalPair, q: PortalPair): void {
  const pb = p.b;
  p.b = q.b;
  q.b = pb;
  p.b.pair = p;
  q.b.pair = q;
  p.swapT = q.swapT = 0;
  p.swapWith = q.swapWith = null;
}

/** Live pairs (check `active`); the array is reused. */
export function portalPairs(w: World): readonly PortalPair[] {
  return peekHz(w)?.pairs ?? NO_PAIRS;
}
const NO_PAIRS: readonly PortalPair[] = [];

export function partnerOf(e: PortalEnd): PortalEnd {
  return e.pair.a === e ? e.pair.b : e.pair.a;
}

/** Lets an enemy (the Blinker) use portals, with the body cooldown. */
export function portalOptIn(w: World, enemyId: number): boolean {
  const ids = hz(w).optIns;
  for (let i = 0; i < ids.length; i++) if (ids[i] === enemyId) return true;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i]! < 0) {
      ids[i] = enemyId;
      return true;
    }
  }
  return false;
}

/** Clock seconds since the ship last went through a portal. */
export function sinceShipPorted(w: World): number {
  const s = peekHz(w);
  return s === undefined ? Infinity : s.clock - s.shipPortedAt;
}

export function portalColors(p: PortalPair): readonly [string, string, string] {
  return PORTAL_COLORS[p.color];
}

// ---------------------------------------------------------------------------
// Update

function hazardAt(w: World, x: number, y: number): boolean {
  const items = w.anomalies.items;
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = items[i] as Anomaly;
    if (!a.active) continue;
    const d = Math.hypot(x - a.x, y - a.y);
    if (a.kind === 'blackhole') {
      if (!isFieldOnly(a) && d < a.r + PORTAL.holePad) return true;
    } else {
      if (d < a.r + PORTAL.holePad) return true;
      const R = pulsarRingRadius(a);
      if (R >= 0 && Math.abs(d - R) < PORTAL.pulsarPad) return true;
      const R2 = pulsarEchoRadius(a);
      if (R2 >= 0 && Math.abs(d - R2) < PORTAL.pulsarPad) return true;
    }
  }
  return isSolidAt(w, x, y);
}

function exitOpenForShip(w: World, partner: PortalEnd): boolean {
  if (partner.x < 0 || partner.x > WORLD_W || partner.y < 0 || partner.y > WORLD_H) return false;
  return !hazardAt(w, partner.x, partner.y);
}

const R = PORTAL.r;
const R2 = R * R;

/** Crossed into `e` this tick: previous position outside the ring (where it was), current inside. */
function crossed(e: PortalEnd, b: Body): boolean {
  const dx = b.x - e.x;
  const dy = b.y - e.y;
  if (dx * dx + dy * dy >= R2) return false;
  const px = b.prevX - e.prevX;
  const py = b.prevY - e.prevY;
  return px * px + py * py >= R2;
}

function flash(w: World, s: HazardState, x: number, y: number): void {
  const i = s.flashNext;
  s.flashX[i] = x;
  s.flashY[i] = y;
  s.flashTick[i] = w.tick;
  s.flashNext = (i + 1) % MAX_FLASHES;
}

/** Moves `b` out of `to` along its heading (relative to the entrance), velocity unchanged. */
function teleport(w: World, s: HazardState, from: PortalEnd, to: PortalEnd, b: Body): void {
  let hx = b.vx;
  let hy = b.vy;
  let len = Math.hypot(hx, hy);
  if (len < 1e-3) {
    // Still body caught by a moving ring: carry on the way the ring swept over it.
    hx = b.x - b.prevX - (from.x - from.prevX);
    hy = b.y - b.prevY - (from.y - from.prevY);
    len = Math.hypot(hx, hy);
    if (len < 1e-6) {
      hx = 0;
      hy = 1;
      len = 1;
    }
  }
  const k = (R + PORTAL.exitPad) / len;
  b.x = b.prevX = to.x + hx * k;
  b.y = b.prevY = to.y + hy * k;
  flash(w, s, b.x, b.y);
}

function portBody(w: World, s: HazardState, b: Body): boolean {
  if (onCooldown(s, b.id)) return false;
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    if (crossed(p.a, b)) {
      teleport(w, s, p.a, p.b, b);
    } else if (crossed(p.b, b)) {
      teleport(w, s, p.b, p.a, b);
    } else continue;
    setCooldown(s, b.id, PORTAL.bodyCooldown);
    return true;
  }
  return false;
}

function portPool<T extends Body>(w: World, s: HazardState, pool: Pool<T>): void {
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const b = items[i] as T;
    if (b.active) portBody(w, s, b);
  }
}

// Free ends move before the crossing tests, like the bodies did this tick.
// Owned ends were already moved by their owner (enemies run first), so their
// prev is captured after the tests instead, ready for the next tick.
function moveFreeEnd(e: PortalEnd, dt: number): void {
  if (e.owned) return;
  e.prevX = e.x;
  e.prevY = e.y;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function settleOwnedEnd(e: PortalEnd): void {
  if (!e.owned) return;
  e.prevX = e.x;
  e.prevY = e.y;
}

function endGone(e: PortalEnd): boolean {
  return e.y - R > WORLD_H + 40 || e.y + R < -400 || e.x < -80 || e.x > WORLD_W + 80;
}

export function updatePortals(w: World, dt: number): void {
  const s = peekHz(w);
  if (s === undefined || s.pairCount === 0) return;
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    p.t += dt;
    moveFreeEnd(p.a, dt);
    moveFreeEnd(p.b, dt);
  }
  // Separate pass: a finished swap moves ends between pairs.
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    if (p.swapT > 0) {
      p.swapT -= dt;
      const q = p.swapWith;
      if (p.swapT <= 0 && q !== null) finishSwap(p, q);
    }
  }
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    // Both ends long gone (drifted off the bottom): free the slot.
    if (!p.a.owned && !p.b.owned && endGone(p.a) && endGone(p.b)) {
      collapsePortalPair(w, p);
      continue;
    }
    p.a.open = exitOpenForShip(w, p.b);
    p.b.open = exitOpenForShip(w, p.a);
  }
  portPool(w, s, w.playerShots);
  portPool(w, s, w.enemyShots);
  portPool(w, s, w.asteroids);
  portPool(w, s, w.pickups);
  portOptIns(w, s);
  portShip(w, s);
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    settleOwnedEnd(p.a);
    settleOwnedEnd(p.b);
  }
}

function portOptIns(w: World, s: HazardState): void {
  const ids = s.optIns;
  for (let j = 0; j < ids.length; j++) {
    const id = ids[j] as number;
    if (id < 0) continue;
    let found: Enemy | null = null;
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i] as Enemy;
      if (e.id === id && e.active) {
        found = e;
        break;
      }
    }
    if (found === null) ids[j] = -1;
    else portBody(w, s, found);
  }
}

function portShip(w: World, s: HazardState): void {
  const p = w.player;
  if (!p.alive || s.clock < s.shipCdUntil) return;
  for (let i = 0; i < s.pairCount; i++) {
    const pr = s.pairs[i] as PortalPair;
    if (!pr.active) continue;
    let from: PortalEnd;
    if (pr.a.open && crossed(pr.a, p)) from = pr.a;
    else if (pr.b.open && crossed(pr.b, p)) from = pr.b;
    else continue;
    teleport(w, s, from, partnerOf(from), p);
    s.shipCdUntil = s.clock + PORTAL.shipCooldown;
    s.shipPortedAt = s.clock;
    return;
  }
}
