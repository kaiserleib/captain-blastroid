import type { AimedPattern } from '../../../content/enemies';
import { BAT, BORER, TURRET } from '../../../content/levels/warrens';
import { Tile } from '../../../content/terrain';
import { damageEnemy } from '../../../sim/damage';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { burst, canFire, emitEnemyShotSfx, ring, SHOT_SMALL } from '../../enemies';
import { carveTiles, tileAt } from '../../terrain';
import { warrensState } from './state';

// The Warrens' roster behaviors (T39). Each owns e.vx / e.vy (the enemy
// system integrates them) and keeps its state in e.state / e.ax / e.ay.

const TILE = 8;

function solid(w: World, x: number, y: number): boolean {
  return tileAt(w, x, y) !== Tile.Empty;
}

// ---------------------------------------------------------------------------
// Wall Turret: sits on its socket's wall face and scrolls with the terrain.
// ax = side the corridor is on (+1 right, -1 left), ay = seconds on screen.

export const TURRET_INIT = 0;
export const TURRET_ON = 1;

const TURRET_VOLLEY: AimedPattern = { kind: 'aimed', n: 1, spreadDeg: 0, speed: TURRET.speed };

/** The socket tile's center x for a turret on its face. */
export function turretSocketX(e: Enemy): number {
  return e.x - e.ax * TURRET.faceOffset;
}

export function turret(w: World, e: Enemy, _p: unknown, dt: number): void {
  if (e.state === TURRET_INIT) {
    // Spawned at the socket's center: lean out of the wall toward the open side.
    const openR = !solid(w, e.x + TILE, e.y);
    const openL = !solid(w, e.x - TILE, e.y);
    e.ax = openR && !openL ? 1 : openL && !openR ? -1 : e.x < w.width / 2 ? 1 : -1;
    e.x += e.ax * TURRET.faceOffset;
    e.prevX = e.x;
    e.ay = 0;
    e.fireT = 0;
    e.state = TURRET_ON;
  }
  e.vx = 0;
  e.vy = w.scrollSpeed;
  // A borer or the Wyrm carved the socket out: the turret goes with it.
  if (e.y > -TILE && tileAt(w, turretSocketX(e), e.y) !== Tile.Socket) {
    damageEnemy(w, e, e.hp, 'hazard');
    return;
  }
  if (e.y < 0) return;
  e.ay += dt;
  if (e.fireT > 0) e.fireT -= dt;
  // Design: the first burst no earlier than 0.6 s on screen; canFire adds the
  // 0.5 s minimum age and the 24 px above-the-ship rule for aimed fire.
  if (e.ay < TURRET.firstOnScreen || e.fireT > 0 || e.y > TURRET.maxY || !canFire(w, e)) return;
  e.fireT = TURRET.interval;
  burst(w, e, TURRET.burst, TURRET.burstGap, TURRET_VOLLEY, SHOT_SMALL, true);
}

// ---------------------------------------------------------------------------
// Borer: plume on the near wall for `warn` s, bores out, crosses, rings as it
// hits the far wall, digs in and is gone. ax = heading (±1); ay = the plume's
// x while warning, then the x where it hit the far wall.

export const BORER_INIT = 0;
export const BORER_WARN = 1;
export const BORER_OUT = 2;
export const BORER_CROSS = 3;
export const BORER_DIG = 4;

/** Wall face x on the `dir` side of row y (the first open tile from that edge), or NaN. */
export function wallFace(w: World, y: number, fromLeft: boolean): number {
  for (let i = 0; i < 30; i++) {
    const c = fromLeft ? i : 29 - i;
    if (!solid(w, c * TILE + TILE / 2, y)) {
      if (i === 0) return NaN;
      return fromLeft ? c * TILE : (c + 1) * TILE;
    }
  }
  return NaN;
}

export function borer(w: World, e: Enemy, _p: unknown, dt: number): void {
  if (e.state === BORER_INIT) {
    const fromLeft = e.x < w.width / 2;
    e.ax = fromLeft ? 1 : -1;
    const face = wallFace(w, e.y, fromLeft);
    if (!Number.isNaN(face)) e.x = e.prevX = face - e.ax * BORER.depth;
    // No wall on this row: it comes in from the edge.
    e.ay = Number.isNaN(face) ? (fromLeft ? 0 : w.width) : face;
    e.state = BORER_WARN;
  }
  e.vy = w.scrollSpeed;
  if (e.state === BORER_WARN) {
    e.vx = 0;
    if (e.t + dt >= BORER.warn) e.state = BORER_OUT;
    return;
  }
  e.vx = e.ax * BORER.speed;
  const inRock = solid(w, e.x, e.y);
  if (inRock) carveTiles(w, e.x + e.ax * 3, e.y, BORER.carveR);
  if (e.state === BORER_OUT) {
    if (!inRock && !solid(w, e.x + e.ax * e.r, e.y)) e.state = BORER_CROSS;
    return;
  }
  if (e.state === BORER_CROSS) {
    if (!solid(w, e.x + e.ax * e.r, e.y)) return;
    e.state = BORER_DIG;
    e.ay = e.x;
    if (e.y >= 0 && e.y <= w.height && w.player.alive && e.t >= 0.5) {
      const r = BORER.ring;
      if (ring(w, e.x, e.y, r.n, r.speed, r.rot, SHOT_SMALL) > 0) emitEnemyShotSfx(w, e.x);
    }
    return;
  }
  // Dug in far enough: gone (not a kill).
  if (Math.abs(e.x - e.ay) >= BORER.digIn) w.enemies.release(e);
}

// ---------------------------------------------------------------------------
// Cave Bat: loose boids (separation, alignment, cohesion) chasing the ship at
// 70 px/s, steering off walls; after `interest` s it gives up and climbs away.
// The flock's neighbor list is one preallocated index array per world.

export const BAT_INIT = 0;
export const BAT_CHASE = 1;
export const BAT_FLEE = 2;

function refreshBats(w: World): void {
  const st = warrensState(w);
  if (st.batTick === w.tick) return;
  st.batTick = w.tick;
  let n = 0;
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count && n < st.bats.length; i++) {
    const o = items[i] as Enemy;
    if (o.active && o.defId === 'wr_bat') st.bats[n++] = i;
  }
  st.batCount = n;
}

function clampLen(x: number, y: number, max: number, out: { x: number; y: number }): void {
  const d = Math.hypot(x, y);
  const k = d > max ? max / d : 1;
  out.x = x * k;
  out.y = y * k;
}

const acc = { x: 0, y: 0 };

export function bat(w: World, e: Enemy, _p: unknown, dt: number): void {
  if (e.state === BAT_INIT) {
    e.state = BAT_CHASE;
    if (e.vx === 0 && e.vy === 0) e.vy = BAT.speed;
  }
  const p = w.player;
  if (e.state === BAT_CHASE && (e.t >= BAT.interest || !p.alive)) e.state = BAT_FLEE;
  let tx: number;
  let ty: number;
  if (e.state === BAT_FLEE) {
    // Lost interest: climb out the way it came, keeping some sideways drift.
    tx = Math.sign(e.vx) * 30 - e.vx;
    ty = -BAT.fleeSpeed - e.vy;
  } else {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = ((dx / d) * BAT.speed - e.vx) * BAT.wSeek;
    ty = ((dy / d) * BAT.speed - e.vy) * BAT.wSeek;
    refreshBats(w);
    const st = warrensState(w);
    const items = w.enemies.items;
    let sx = 0;
    let sy = 0;
    let ax = 0;
    let ay = 0;
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (let j = 0; j < st.batCount; j++) {
      const o = items[st.bats[j] as number] as Enemy;
      if (o === e || !o.active) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const d2 = ox * ox + oy * oy;
      if (d2 > BAT.nbrR * BAT.nbrR) continue;
      if (d2 < BAT.sepR * BAT.sepR) {
        const k = 1 / Math.max(1, d2);
        sx += ox * k * BAT.sepR * BAT.sepR;
        sy += oy * k * BAT.sepR * BAT.sepR;
      }
      ax += o.vx;
      ay += o.vy;
      cx += o.x;
      cy += o.y;
      n++;
    }
    tx += sx * BAT.wSep;
    ty += sy * BAT.wSep;
    if (n > 0) {
      tx += (ax / n - e.vx) * BAT.wAli + (cx / n - e.x) * BAT.wCoh;
      ty += (ay / n - e.vy) * BAT.wAli + (cy / n - e.y) * BAT.wCoh;
    }
  }
  // Walls: probe ahead and to either side, and steer away from rock.
  if (e.y > 0) {
    const v = Math.hypot(e.vx, e.vy) || 1;
    const ux = e.vx / v;
    const uy = e.vy / v;
    const pr = BAT.probe;
    if (solid(w, e.x + ux * pr, e.y + uy * pr)) {
      tx -= ux * BAT.speed * BAT.wWall;
      ty -= uy * BAT.speed * BAT.wWall;
    }
    if (solid(w, e.x - pr, e.y)) tx += BAT.speed * BAT.wWall * 0.5;
    if (solid(w, e.x + pr, e.y)) tx -= BAT.speed * BAT.wWall * 0.5;
  }
  clampLen(tx, ty, BAT.accel, acc);
  const max = e.state === BAT_FLEE ? BAT.fleeSpeed : BAT.speed;
  clampLen(e.vx + acc.x * dt, e.vy + acc.y * dt, max, acc);
  e.vx = acc.x;
  e.vy = acc.y;
}
