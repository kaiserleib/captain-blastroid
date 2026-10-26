import { BUOY_P, type ORBITER_P, type LANCER_P } from '../../../content/levels/eventHorizon';
import { ENEMY_FAIRNESS } from '../../../content/enemies';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { canFire, emitEnemyShotSfx, shootDir } from '../../enemies';
import { collapseAnomaly, isCollapsing, isFieldOnly, spawnFieldOnly } from '../../obstacles';

// Sector 3 behaviors (registered from index.ts). Each owns e.vx/e.vy (the
// enemy system integrates), e.state and the ax/ay scratch, and keeps any
// extra per-entity data in a side table keyed by the pooled Enemy object
// (checked by id, since pool slots recycle).

type P<T> = { readonly [K in keyof T]: number };

const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;
const SFX_P = { id: '', x: 0 as number | undefined };

function sfx(w: World, id: string, x: number): void {
  SFX_P.id = id;
  SFX_P.x = x;
  w.events.emit('sfx', SFX_P);
}

/** The nearest live black hole with a core (not a buoy field, not collapsing), or null. */
export function nearestHole(w: World, x: number, y: number): Anomaly | null {
  let best: Anomaly | null = null;
  let bestD = Infinity;
  const items = w.anomalies.items;
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = items[i] as Anomaly;
    if (!a.active || a.kind !== 'blackhole' || a.r <= 0 || isFieldOnly(a) || isCollapsing(a))
      continue;
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Orbiter: spirals in to `radius` around the nearest hole, circles it at
// `omega` for `orbitTime`, then peels off downward. Its 2-shot fans point
// straight out from the hole, and the hole bends them into arcs.
// e.ax at spawn: orbit direction (< 0 = counter-clockwise on screen).
// States: 0 init, 1 orbiting, 2 leaving.

export const Orbit = { Init: 0, Orbiting: 1, Leaving: 2 } as const;

interface OrbitState {
  id: number;
  hole: Anomaly | null;
  holeId: number;
  /** Orbit center (the hole, or a virtual one that scrolls when there is none). */
  cx: number;
  cy: number;
  angle: number;
  r0: number;
  dir: number;
}

const orbits = new WeakMap<Enemy, OrbitState>();

export function orbitState(e: Enemy): OrbitState {
  let s = orbits.get(e);
  if (s === undefined) {
    s = { id: -1, hole: null, holeId: -1, cx: 0, cy: 0, angle: 0, r0: 0, dir: 1 };
    orbits.set(e, s);
  }
  return s;
}

function holeAlive(s: OrbitState): boolean {
  const h = s.hole;
  return h !== null && h.active && h.id === s.holeId && !isCollapsing(h);
}

export function orbitBehavior(w: World, e: Enemy, p: P<typeof ORBITER_P>, dt: number): void {
  const s = orbitState(e);
  if (e.state === Orbit.Init || s.id !== e.id) {
    s.id = e.id;
    e.state = Orbit.Orbiting;
    s.dir = e.ax < 0 ? -1 : 1;
    const h = nearestHole(w, e.x, e.y);
    s.hole = h;
    s.holeId = h === null ? -1 : h.id;
    s.cx = h === null ? e.x : h.x;
    s.cy = h === null ? e.y + p.radius : h.y;
    const dx = e.x - s.cx;
    const dy = e.y - s.cy;
    s.angle = Math.atan2(dy, dx);
    s.r0 = Math.max(p.radius, Math.hypot(dx, dy));
    e.fireT = p.firstFire;
  }
  if (e.state === Orbit.Leaving) {
    const k = Math.min(1, 2.5 * dt);
    // Peel off outward, away from the hole, so a leaving ring doesn't rain on the player.
    e.vx += ((e.x < s.cx ? -1 : 1) * p.exitSpeed * 0.8 - e.vx) * k;
    e.vy += (p.exitSpeed + w.scrollSpeed * 0.5 - e.vy) * k;
    return;
  }
  if (s.hole !== null) {
    if (!holeAlive(s)) {
      e.state = Orbit.Leaving;
      return;
    }
    // Obstacles move after enemies, so aim at where the hole will be this tick.
    s.cx = s.hole.x + s.hole.vx * dt;
    s.cy = s.hole.y + s.hole.vy * dt;
  } else {
    s.cy += w.scrollSpeed * dt;
  }
  const k = Math.min(1, (e.t + dt) / p.enter);
  const ease = 1 - (1 - k) * (1 - k);
  const rad = s.r0 + (p.radius - s.r0) * ease;
  s.angle = (s.angle + s.dir * p.omega * dt) % TAU;
  const tx = s.cx + Math.cos(s.angle) * rad;
  const ty = s.cy + Math.sin(s.angle) * rad;
  e.vx = (tx - e.x) / dt;
  e.vy = (ty - e.y) / dt;
  if (e.t >= p.enter + p.orbitTime || s.cy > p.leaveBelowY) {
    e.state = Orbit.Leaving;
    return;
  }
  e.fireT -= dt;
  if (e.fireT > 0 || k < 1) return;
  e.fireT = p.fireEvery;
  if (!canFire(w, e)) return;
  const pl = w.player;
  if (Math.hypot(pl.x - e.x, pl.y - e.y) < p.minPlayerDist) return;
  const ox = Math.cos(s.angle);
  const oy = Math.sin(s.angle);
  const deg = s.angle * DEG;
  const mx = e.x + ox * 8;
  const my = e.y + oy * 3;
  const n =
    shootDir(w, mx, my, deg - p.fanDeg / 2, p.shotSpeed) +
    shootDir(w, mx, my, deg + p.fanDeg / 2, p.shotSpeed);
  if (n > 0) emitEnemyShotSfx(w, mx);
}

// ---------------------------------------------------------------------------
// Lancer: descends to holdY (e.ay > 0 at spawn overrides it), settles, locks
// a line on the player and shows it for the whole telegraph, then dashes
// along it until it leaves the screen. e.fireT is the state timer (it has no
// fire def); from Telegraph on, e.ax/e.ay hold the dash direction.

export const Lance = { Init: 0, Descend: 1, Settle: 2, Telegraph: 3, Dash: 4 } as const;

export function lanceBehavior(w: World, e: Enemy, p: P<typeof LANCER_P>, dt: number): void {
  if (e.state === Lance.Init) {
    e.state = Lance.Descend;
    if (e.ay <= 0) e.ay = p.holdY;
  }
  if (e.state === Lance.Descend) {
    const left = e.ay - e.y;
    e.vx = 0;
    e.vy = p.descendSpeed * Math.min(1, Math.max(0.2, left / 28));
    if (left > 1.5) return;
    e.state = Lance.Settle;
    e.fireT = p.settle;
    return;
  }
  if (e.state === Lance.Settle) {
    e.vx = 0;
    e.vy = 0;
    e.fireT -= dt;
    if (e.fireT > 0 || e.t < ENEMY_FAIRNESS.minAge) return;
    lockOn(w, e);
    e.state = Lance.Telegraph;
    e.fireT = p.telegraph;
    return;
  }
  if (e.state === Lance.Telegraph) {
    e.vx = 0;
    e.vy = 0;
    e.fireT -= dt;
    if (e.fireT > 0) return;
    e.state = Lance.Dash;
    // The dash is a straight line: no steering around rocks from here on.
    e.avoidsAsteroids = false;
    sfx(w, 'boss_throw', e.x);
  }
  e.vx = e.ax * p.dashSpeed;
  e.vy = e.ay * p.dashSpeed;
}

function lockOn(w: World, e: Enemy): void {
  const pl = w.player;
  let dx = 0;
  let dy = 1;
  if (pl.alive) {
    dx = pl.x - e.x;
    dy = pl.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = 0;
      dy = 1;
    } else {
      dx /= d;
      dy /= d;
    }
  }
  e.ax = dx;
  e.ay = dy;
}

/** 0..1 through the telegraph (for the draw), or -1 outside it. */
export function lanceTelegraph(e: Enemy, p: P<typeof LANCER_P>): number {
  if (e.state !== Lance.Telegraph) return -1;
  return Math.min(1, Math.max(0, 1 - e.fireT / p.telegraph));
}

// ---------------------------------------------------------------------------
// Gravity Buoy: drifts with the scroll and sways, carrying a coreless field
// (spawnFieldOnly) that it keeps on itself. Its death collapses the field.

export interface BuoyField {
  enemy: Enemy | null;
  enemyId: number;
  field: Anomaly | null;
  fieldId: number;
  /** Seconds since spawn (the field ring's draw phase). */
  t: number;
}

const MAX_BUOYS = 8;
const buoyTables = new WeakMap<World, BuoyField[]>();

export function buoyFields(w: World): BuoyField[] {
  let t = buoyTables.get(w);
  if (t === undefined) {
    t = [];
    for (let i = 0; i < MAX_BUOYS; i++)
      t.push({ enemy: null, enemyId: -1, field: null, fieldId: -1, t: 0 });
    buoyTables.set(w, t);
    // Killed (not culled): the field implodes. A culled buoy's field leaves
    // the screen with it and is culled too.
    w.events.on('enemyKilled', (ev) => {
      const b = buoyOf(t as BuoyField[], ev.enemy);
      if (b === null) return;
      b.enemy = null;
      if (fieldAlive(b)) collapseAnomaly(w, b.field as Anomaly, BUOY_P.collapse);
    });
  }
  return t;
}

function buoyOf(t: readonly BuoyField[], e: Enemy): BuoyField | null {
  for (let i = 0; i < t.length; i++) {
    const b = t[i] as BuoyField;
    if (b.enemy === e && b.enemyId === e.id) return b;
  }
  return null;
}

export function fieldAlive(b: BuoyField): boolean {
  return b.field !== null && b.field.active && b.field.id === b.fieldId;
}

const fieldOpts = { variant: 'small', strengthMul: 0.5, vx: 0, vy: 0 };

export function buoyBehavior(w: World, e: Enemy, p: P<typeof BUOY_P>, dt: number): void {
  const t = buoyFields(w);
  let b = buoyOf(t, e);
  if (e.state === 0 || b === null) {
    e.state = 1;
    e.ax = e.x;
    b = null;
    for (let i = 0; i < t.length; i++) {
      const s = t[i] as BuoyField;
      if ((s.enemy === null || !s.enemy.active || s.enemy.id !== s.enemyId) && !fieldAlive(s)) {
        b = s;
        break;
      }
    }
    if (b !== null) {
      fieldOpts.strengthMul = p.fieldMul;
      fieldOpts.vy = w.scrollSpeed;
      const a = spawnFieldOnly(w, e.x, e.y, fieldOpts);
      b.enemy = e;
      b.enemyId = e.id;
      b.field = a;
      b.fieldId = a === null ? -1 : a.id;
      b.t = 0;
    }
  }
  e.vy = w.scrollSpeed;
  e.vx = Math.sin((e.t + dt) * p.swayHz * TAU) * p.sway;
  if (b === null) return;
  b.t += dt;
  if (!fieldAlive(b)) return;
  // The anomaly system integrates after us, which lands it on the buoy's new spot.
  const a = b.field as Anomaly;
  a.x = e.x;
  a.y = e.y;
  a.vx = e.vx;
  a.vy = e.vy;
}
