// Shade: casters (medium/large rocks, shade slabs, registered hulls) each
// throw a vertical strip straight down, the sun being overhead. Slabs are
// indestructible cover that drifts with the scroll and eats shots.
import { SHADE, SHADE_SLAB } from '../../../content/obstacles';
import type { RayHit, SolidQuery } from '../../../sim/hooks';
import type { Asteroid, Bullet, Enemy } from '../../../sim/types';
import { WORLD_H, WORLD_W, type World } from '../../../sim/world';
import type { Pool } from '../../../engine/pool';
import { hz, peekHz, type HazardState, type ShadeSlab } from './state';

const SLAB_HW = SHADE_SLAB.w / 2;
const SLAB_HH = SHADE_SLAB.h / 2;

export interface SlabOptions {
  vx?: number;
  /** Default: the scroll speed (drifts with the scroll). */
  vy?: number;
}

/** Spawns an indestructible 40×10 shade slab centered at (x, y). Null when all slots are used. */
export function spawnShadeSlab(
  w: World,
  x: number,
  y: number,
  o: SlabOptions = {},
): ShadeSlab | null {
  const s = hz(w);
  for (let i = 0; i < s.slabs.length; i++) {
    const sl = s.slabs[i] as ShadeSlab;
    if (sl.active) continue;
    sl.active = true;
    sl.x = sl.prevX = x;
    sl.y = sl.prevY = y;
    sl.vx = o.vx ?? 0;
    sl.vy = o.vy ?? w.scrollSpeed;
    if (i >= s.slabCount) s.slabCount = i + 1;
    return sl;
  }
  return null;
}

export function removeShadeSlab(w: World, slab: ShadeSlab): void {
  slab.active = false;
  trimSlabs(hz(w));
}

function trimSlabs(s: HazardState): void {
  while (s.slabCount > 0 && !(s.slabs[s.slabCount - 1] as ShadeSlab).active) s.slabCount--;
}

/** Live slabs (check `active`); the array is reused. */
export function shadeSlabs(w: World): readonly ShadeSlab[] {
  return peekHz(w)?.slabs ?? NO_SLABS;
}
const NO_SLABS: readonly ShadeSlab[] = [];

/**
 * Marks an enemy (a boss hull) as a shade caster. Its strip is `halfWidth`
 * either side of its x (minus the inset) and starts `halfHeight` below its
 * center (default: its radius). Dropped automatically when the enemy dies.
 */
export function registerShadeCaster(
  w: World,
  entityId: number,
  halfWidth: number,
  halfHeight = -1,
): boolean {
  const cs = hz(w).casters;
  let free = -1;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    if (c.id === entityId) free = i;
    else if (free < 0 && c.id < 0) free = i;
  }
  if (free < 0) return false;
  const c = cs[free]!;
  c.id = entityId;
  c.halfWidth = halfWidth;
  c.halfHeight = halfHeight;
  return true;
}

export function unregisterShadeCaster(w: World, entityId: number): void {
  const s = peekHz(w);
  if (s === undefined) return;
  for (const c of s.casters) if (c.id === entityId) c.id = -1;
}

function findEnemy(w: World, id: number): Enemy | null {
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i] as Enemy;
    if (e.id === id) return e.active ? e : null;
  }
  return null;
}

/** One strip, in playfield px. */
export interface Strip {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const strip: Strip = { left: 0, right: 0, top: 0, bottom: 0 };

function setStrip(cx: number, halfWidth: number, bottomEdge: number): Strip {
  const hw = halfWidth - SHADE.stripInset / 2;
  strip.left = cx - hw;
  strip.right = cx + hw;
  strip.top = bottomEdge;
  strip.bottom = bottomEdge + SHADE.stripLength;
  return strip;
}

/** Calls `fn` with every strip (a reused object); stops early when `fn` returns true. */
export function forEachStrip(w: World, fn: (s: Strip) => boolean): boolean {
  const rocks = w.asteroids.items;
  for (let i = 0; i < w.asteroids.count; i++) {
    const a = rocks[i] as Asteroid;
    if (!a.active || a.size === 'small') continue;
    if (fn(setStrip(a.x, a.r, a.y + a.r))) return true;
  }
  const s = peekHz(w);
  if (s === undefined) return false;
  for (let i = 0; i < s.slabCount; i++) {
    const sl = s.slabs[i] as ShadeSlab;
    if (sl.active && fn(setStrip(sl.x, SLAB_HW, sl.y + SLAB_HH))) return true;
  }
  for (let i = 0; i < s.casters.length; i++) {
    const c = s.casters[i]!;
    if (c.id < 0) continue;
    const e = findEnemy(w, c.id);
    if (e === null) {
      c.id = -1;
      continue;
    }
    if (fn(setStrip(e.x, c.halfWidth, e.y + (c.halfHeight >= 0 ? c.halfHeight : e.r)))) return true;
  }
  return false;
}

let qx = 0;
let qy = 0;
let qr = 0;
const insideFn = (st: Strip): boolean =>
  qx - qr >= st.left && qx + qr <= st.right && qy - qr >= st.top && qy + qr <= st.bottom;

/** True when the whole circle (x, y, r) sits inside one shadow strip. */
export function inShade(w: World, x: number, y: number, r: number): boolean {
  qx = x;
  qy = y;
  qr = r;
  return forEachStrip(w, insideFn);
}

export interface ShadeSpot {
  x: number;
  y: number;
  /** Distance from the query point. */
  d: number;
}

let spotBest = Infinity;
let spotPad = 0;
let spotMaxDx = Infinity;
let spotOut: ShadeSpot = { x: 0, y: 0, d: 0 };
const spotFn = (st: Strip): boolean => {
  const lo = st.left + qr;
  const hi = st.right - qr;
  if (hi < lo) return false;
  const top = Math.max(st.top, 0) + qr + spotPad;
  const bot = Math.min(st.bottom, WORLD_H) - qr;
  if (bot < top) return false;
  const x = qx < lo ? lo : qx > hi ? hi : qx;
  if (Math.abs(x - qx) > spotMaxDx) return false;
  const y = qy < top ? top : qy > bot ? bot : qy;
  const d = Math.hypot(x - qx, y - qy);
  if (d < spotBest) {
    spotBest = d;
    spotOut.x = x;
    spotOut.y = y;
    spotOut.d = d;
  }
  return false;
};

/**
 * The nearest point where a circle of radius `r` fits wholly inside a strip
 * (clamped to the playfield), at least `topPad` below the strip's top edge,
 * and at most `maxDx` px away horizontally. Writes `out`; false when none.
 */
export function nearestShadeSpot(
  w: World,
  x: number,
  y: number,
  r: number,
  out: ShadeSpot,
  topPad = 0,
  maxDx = Infinity,
): boolean {
  qx = x;
  qy = y;
  qr = r;
  spotBest = Infinity;
  spotPad = topPad;
  spotMaxDx = maxDx;
  spotOut = out;
  forEachStrip(w, spotFn);
  return spotBest < Infinity;
}

// ---------------------------------------------------------------------------
// Slab motion, shot absorption, solid query

export function updateSlabs(w: World, dt: number): void {
  const s = peekHz(w);
  if (s === undefined || s.slabCount === 0) return;
  for (let i = 0; i < s.slabCount; i++) {
    const sl = s.slabs[i] as ShadeSlab;
    if (!sl.active) continue;
    sl.prevX = sl.x;
    sl.prevY = sl.y;
    sl.x += sl.vx * dt;
    sl.y += sl.vy * dt;
    // The strip trails 160 px below, but the slab itself is the cover worth keeping.
    if (sl.y - SLAB_HH > WORLD_H + 4 || sl.x < -SLAB_HW - 20 || sl.x > WORLD_W + SLAB_HW + 20)
      sl.active = false;
  }
  trimSlabs(s);
  absorbShots(w, s, w.playerShots);
  absorbShots(w, s, w.enemyShots);
}

/** Slab hit by the segment (x0,y0)→(x1,y1) grown by `r`; Liang–Barsky entry t, or -1. */
function slabEntry(
  sl: ShadeSlab,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): number {
  const l = sl.x - SLAB_HW - r;
  const rt = sl.x + SLAB_HW + r;
  const t = sl.y - SLAB_HH - r;
  const b = sl.y + SLAB_HH + r;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  if (dx === 0) {
    if (x0 < l || x0 > rt) return -1;
  } else {
    let a = (l - x0) / dx;
    let c = (rt - x0) / dx;
    if (a > c) {
      const tmp = a;
      a = c;
      c = tmp;
    }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
  }
  if (dy === 0) {
    if (y0 < t || y0 > b) return -1;
  } else {
    let a = (t - y0) / dy;
    let c = (b - y0) / dy;
    if (a > c) {
      const tmp = a;
      a = c;
      c = tmp;
    }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
  }
  return t0 <= t1 ? t0 : -1;
}

function absorbShots(w: World, s: HazardState, pool: Pool<Bullet>): void {
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const b = items[i] as Bullet;
    // Ricochet discs bounce off solids instead (T35 reads raycastSolid).
    if (!b.active || b.weaponId === 'ricochet') continue;
    for (let j = 0; j < s.slabCount; j++) {
      const sl = s.slabs[j] as ShadeSlab;
      if (sl.active && slabEntry(sl, b.prevX, b.prevY, b.x, b.y, b.r) >= 0) {
        pool.release(b);
        break;
      }
    }
  }
}

function slabSolidAt(w: World, x: number, y: number): boolean {
  const s = peekHz(w);
  if (s === undefined) return false;
  for (let i = 0; i < s.slabCount; i++) {
    const sl = s.slabs[i] as ShadeSlab;
    if (sl.active && Math.abs(x - sl.x) <= SLAB_HW && Math.abs(y - sl.y) <= SLAB_HH) return true;
  }
  return false;
}

function slabRaycast(
  w: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  out: RayHit,
): boolean {
  const s = peekHz(w);
  if (s === undefined) return false;
  let best = 2;
  let hit: ShadeSlab | null = null;
  for (let i = 0; i < s.slabCount; i++) {
    const sl = s.slabs[i] as ShadeSlab;
    if (!sl.active) continue;
    const t = slabEntry(sl, x0, y0, x1, y1, 0);
    if (t >= 0 && t < best) {
      best = t;
      hit = sl;
    }
  }
  if (hit === null) return false;
  const x = x0 + (x1 - x0) * best;
  const y = y0 + (y1 - y0) * best;
  out.x = x;
  out.y = y;
  out.t = best;
  // Normal of the face entered: whichever edge the hit point sits on.
  const fx = (x - hit.x) / SLAB_HW;
  const fy = (y - hit.y) / SLAB_HH;
  if (Math.abs(fx) >= Math.abs(fy)) {
    out.nx = fx < 0 ? -1 : 1;
    out.ny = 0;
  } else {
    out.nx = 0;
    out.ny = fy < 0 ? -1 : 1;
  }
  return true;
}

/**
 * Slabs as solid geometry. Registered by the obstacles module; T34's composed
 * terrain query should OR this in (it replaces the single registration).
 */
export const slabSolidQuery: SolidQuery = { isSolidAt: slabSolidAt, raycastSolid: slabRaycast };
