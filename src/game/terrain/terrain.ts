import { PLAYER_TUNING } from '../../content/player';
import { TERRAIN, Tile } from '../../content/terrain';
import { damageAsteroid, damageEnemy, damagePlayer, isDestructible } from '../../sim/damage';
import { isAsteroidHeld } from '../../sim/hooks';
import type { Asteroid, Bullet, Enemy } from '../../sim/types';
import type { World } from '../../sim/world';
import {
  codeAt,
  codeAtPoint,
  COLS,
  ensureTerrainState,
  getTerrainState,
  ignoresTerrain,
  lowestRow,
  queueChunkRows,
  queuedRows,
  queueRows,
  RING,
  slotOf,
  spawnRows,
  themeIndex,
  TILE,
  type TerrainState,
} from './state';
import { boxFree, breakTile, damageTile, pushOut, shotStopper, solidCode } from './tiles';

// The terrain's tick, run by the collision system before its broad phase
// (every body has moved): scroll and spawn rows, crumble gates at the line,
// then push the ship out, stop shots, break rocks and dumb enemies.

export interface QueueOptions {
  /** Tile set: `warrens` or `foundry`. */
  theme: string;
}

/** Queues a chunk's rows above the screen (they enter as the terrain scrolls). */
export function queueChunk(w: World, chunkId: string, opts: QueueOptions): void {
  queueChunkRows(ensureTerrainState(w), chunkId, themeIndex(opts.theme));
}

export interface ClearOptions {
  /** Rows over which the walls fall back to the edges (default TERRAIN.fadeRows); 0 stops dead. */
  fadeRows?: number;
  /** Also wipe every tile now, on screen included. */
  now?: boolean;
}

/**
 * Ends the terrain: drops the queue and, with `fadeRows`, appends a taper
 * from the last row so the walls recede instead of stopping in a hard line.
 * Rows already spawned scroll away unless `now`.
 */
export function clearTerrain(w: World, opts: ClearOptions = {}): void {
  const st = getTerrainState(w);
  if (st === undefined) return;
  const fade = Math.max(0, Math.floor(opts.fadeRows ?? TERRAIN.fadeRows));
  const last = queuedRows(st) > 0 ? (st.queue[st.queue.length - 1] as string) : null;
  const theme =
    queuedRows(st) > 0 ? (st.queueTheme[st.queueTheme.length - 1] as number) : st.holdTheme;
  st.queue.length = 0;
  st.queueTheme.length = 0;
  st.queueHead = 0;
  if (fade > 0 && !opts.now) queueRows(st, taper(st, last, fade), theme);
  st.hold.fill(Tile.Empty);
  if (opts.now) {
    st.tiles.fill(Tile.Empty);
    st.hp.fill(0);
    for (let s = 0; s < RING; s++) st.rev[s]!++;
  }
}

/** Taper rows, top first: each wall tile survives while it is deeper than the receding front. */
function taper(st: TerrainState, last: string | null, rows: number): string[] {
  const solid: boolean[] = [];
  for (let c = 0; c < COLS; c++) {
    solid.push(last !== null ? last[c] !== '.' && last[c] !== '=' : st.hold[c] !== Tile.Empty);
  }
  // Depth: distance to the nearest open column (walls with no opening count from the edges).
  const depth: number[] = [];
  for (let c = 0; c < COLS; c++) {
    let d = Infinity;
    for (let o = 0; o < COLS; o++) if (!solid[o]) d = Math.min(d, Math.abs(o - c));
    depth.push(solid[c] ? (d === Infinity ? Math.min(c, COLS - 1 - c) + 1 : d) : 0);
  }
  const maxDepth = Math.max(1, ...depth);
  const out: string[] = [];
  for (let i = 1; i <= rows; i++) {
    const front = (maxDepth * i) / rows;
    let s = '';
    for (let c = 0; c < COLS; c++) s += (depth[c] as number) > front ? '#' : '.';
    out.unshift(s);
  }
  return out;
}

/** Rows waiting above the screen. */
export function terrainQueued(w: World): number {
  const st = getTerrainState(w);
  return st === undefined ? 0 : queuedRows(st);
}

/** True while any tile is live in the ring (on screen or about to enter). */
export function terrainActive(w: World): boolean {
  const st = getTerrainState(w);
  if (st === undefined) return false;
  if (queuedRows(st) > 0) return true;
  for (let i = 0; i < COLS; i++) if (st.hold[i] !== Tile.Empty) return true;
  for (let k = lowestRow(st); k < st.nextK; k++) {
    const base = slotOf(k) * COLS;
    for (let c = 0; c < COLS; c++) if (st.tiles[base + c] !== Tile.Empty) return true;
  }
  return false;
}

/** World tick of the latest crush, -1 if none (hit-cause attribution). */
export function lastCrushTick(w: World): number {
  return getTerrainState(w)?.crushTick ?? -1;
}

export function crushCount(w: World): number {
  return getTerrainState(w)?.crushes ?? 0;
}

// ---------------------------------------------------------------------------
// Tick.

const HW = TERRAIN.shipHalfW;
const HH = TERRAIN.shipHalfH;
const MIN_X = PLAYER_TUNING.margin;
const MAX_X = 240 - PLAYER_TUNING.margin;
const MIN_Y = PLAYER_TUNING.margin;
const MAX_Y = 400 - PLAYER_TUNING.margin;
/** Push directions in tie-break order: sideways first, so the ship slides along walls. */
const DIRS = [2, 3, 1, 0] as const;
const pt = { x: 0, y: 0 };

function crumbleGates(w: World, st: TerrainState): void {
  const kc = Math.floor((st.scroll - TERRAIN.gateCrumbleY) / TILE);
  for (let k = Math.max(st.crumbleK + 1, lowestRow(st)); k <= kc && k < st.nextK; k++) {
    for (let c = 0; c < COLS; c++)
      if (codeAt(st, k, c) === Tile.Gate) breakTile(w, st, k, c, false);
  }
  if (kc > st.crumbleK) st.crumbleK = kc;
}

function tickDebris(st: TerrainState, dt: number): void {
  const d = st.debris;
  for (let i = 2; i < d.length; i += 4) if ((d[i] as number) < TERRAIN.debrisLife) d[i]! += dt;
}

/** Where a crushed ship goes: the nearest open column at its row, else a little higher. */
function relocate(st: TerrainState, x: number, y: number): boolean {
  for (let dy = 0; dy <= 64; dy += TILE) {
    const py = Math.max(MIN_Y, y - dy);
    for (let off = 0; off <= 240; off += TILE / 2) {
      for (let s = -1; s <= 1; s += 2) {
        const px = x + off * s;
        if (px < MIN_X || px > MAX_X) continue;
        // Headroom: don't drop the ship right under the wall that crushed it.
        if (boxFree(st, px, py, HW, HH) && boxFree(st, px, py - TILE * 2, HW, HH)) {
          pt.x = px;
          pt.y = py;
          return true;
        }
        if (off === 0) break;
      }
    }
  }
  return false;
}

function pushPlayer(w: World, st: TerrainState): void {
  const p = w.player;
  if (!p.alive || boxFree(st, p.x, p.y, HW, HH)) return;
  let best = Infinity;
  let bx = p.x;
  let by = p.y;
  let bdir = -1;
  for (let i = 0; i < DIRS.length; i++) {
    const dir = DIRS[i] as number;
    const d = pushOut(st, p.x, p.y, HW, HH, dir, TERRAIN.maxPush, pt);
    if (d >= best) continue;
    if (pt.x < MIN_X || pt.x > MAX_X || pt.y < MIN_Y || pt.y > MAX_Y) continue;
    best = d;
    bx = pt.x;
    by = pt.y;
    bdir = dir;
  }
  if (bdir >= 0) {
    p.x = bx;
    p.y = by;
    if ((bdir === 2 && p.vx > 0) || (bdir === 3 && p.vx < 0)) p.vx = 0;
    if ((bdir === 0 && p.vy > 0) || (bdir === 1 && p.vy < 0)) p.vy = 0;
    return;
  }
  // Crush: no way out short of the bottom edge.
  st.crushTick = w.tick;
  st.crushes++;
  damagePlayer(w, 1);
  if (relocate(st, p.x, p.y)) {
    p.x = pt.x;
    p.y = pt.y;
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx = 0;
    p.vy = 0;
  }
}

function playerShots(w: World, st: TerrainState): void {
  const pool = w.playerShots;
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const s = items[i] as Bullet;
    if (!s.active) continue;
    const code = codeAtPoint(st, s.x, s.y);
    if (!shotStopper(code)) continue;
    if (code !== Tile.Rock) damageTile(w, s.x, s.y, s.damage, true);
    pool.release(s);
  }
}

function enemyShots(w: World, st: TerrainState): void {
  const pool = w.enemyShots;
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const s = items[i] as Bullet;
    if (s.active && shotStopper(codeAtPoint(st, s.x, s.y))) pool.release(s);
  }
}

function hitsWall(st: TerrainState, x: number, y: number, r: number): boolean {
  if (solidCode(codeAtPoint(st, x, y))) return true;
  const o = r * 0.6;
  return (
    solidCode(codeAtPoint(st, x - o, y)) ||
    solidCode(codeAtPoint(st, x + o, y)) ||
    solidCode(codeAtPoint(st, x, y - o)) ||
    solidCode(codeAtPoint(st, x, y + o))
  );
}

function rocks(w: World, st: TerrainState): void {
  const pool = w.asteroids;
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const a = items[i] as Asteroid;
    if (!a.active || a.y < 0 || !hitsWall(st, a.x, a.y, a.r) || isAsteroidHeld(w, a)) continue;
    if (isDestructible(a)) damageAsteroid(w, a, a.hp, false);
    else pool.release(a);
  }
}

/** Dumb enemies explode on walls; smart ones are pushed clear (their avoidance steers them off). */
function enemies(w: World, st: TerrainState): void {
  const pool = w.enemies;
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const e = items[i] as Enemy;
    if (!e.active || e.isBoss || e.y < 0 || ignoresTerrain(e.defId)) continue;
    const code = codeAtPoint(st, e.x, e.y);
    // A turret sitting in its socket is home.
    if (code === Tile.Socket) continue;
    if (!e.avoidsAsteroids) {
      let hit = solidCode(code);
      if (!hit) {
        const v = Math.hypot(e.vx, e.vy);
        if (v > 1) {
          const k = (e.r * 0.5) / v;
          const ahead = codeAtPoint(st, e.x + e.vx * k, e.y + e.vy * k);
          hit = solidCode(ahead) && ahead !== Tile.Socket;
        }
      }
      if (hit) damageEnemy(w, e, e.hp, 'asteroid');
      continue;
    }
    const h = Math.min(e.r, HW);
    if (boxFree(st, e.x, e.y, h, h)) continue;
    let best = Infinity;
    let bx = e.x;
    let by = e.y;
    for (let d = 0; d < 4; d++) {
      const dist = pushOut(st, e.x, e.y, h, h, d, TILE * 2, pt);
      if (dist < best) {
        best = dist;
        bx = pt.x;
        by = pt.y;
      }
    }
    e.x = bx;
    e.y = by;
  }
}

/** The collision-slot pass (registered with `registerCollisionPass`). */
export function terrainPass(w: World, dt: number): void {
  const st = getTerrainState(w);
  if (st === undefined) return;
  st.prevScroll = st.scroll;
  st.scroll += w.scrollSpeed * dt;
  spawnRows(w, st);
  crumbleGates(w, st);
  tickDebris(st, dt);
  pushPlayer(w, st);
  playerShots(w, st);
  enemyShots(w, st);
  rocks(w, st);
  enemies(w, st);
}
