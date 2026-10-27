import { PICKUP_TUNING } from '../../../content/pickups';
import { BAT, CAGE, DEN, DEN_BRAKE, FORK, ROCKFALL } from '../../../content/levels/warrens';
import { Tile } from '../../../content/terrain';
import { setScrollSpeed } from '../../../sim/scroll';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { Pickup } from '../../../sim/types';
import type { System, World } from '../../../sim/world';
import type { LevelScriptArgs } from '../../director';
import { spawnRock } from '../../obstacles';
import { spawnDrop } from '../../pickups';
import { getTerrainState, rowBottom, terrainQueued, tileAt } from '../../terrain';
import { cageLive, warrensState, type Cage } from './state';

// Level scripts and the level system: chunk marks, bat flocks, the collapse's
// rock falls, the fork's two cages (Rook's pod, the upgrade core) and the
// den's scroll stop.

const TILE = 8;
const COLS = 30;

/** Terrain row index the next queued chunk will start at. */
function nextRow(w: World): number {
  const st = getTerrainState(w);
  return st === undefined ? 0 : st.nextK + terrainQueued(w);
}

/** `warrens.mark { chunk }`: run right before that chunk's `terrain` event. */
export function markChunk(w: World, args: LevelScriptArgs): void {
  warrensState(w).marks.set(String(args.chunk), nextRow(w));
}

/** Screen y of the bottom edge of row `row` (from the bottom) of a marked chunk, or NaN. */
export function markedRowY(w: World, chunk: string, row: number): number {
  const k0 = warrensState(w).marks.get(chunk);
  const st = getTerrainState(w);
  if (k0 === undefined || st === undefined) return NaN;
  return rowBottom(st, k0 + row);
}

/** True once that row exists in the terrain (it spawns two rows above the screen). */
function rowSpawned(w: World, chunk: string, row: number): boolean {
  const k0 = warrensState(w).marks.get(chunk);
  const st = getTerrainState(w);
  return k0 !== undefined && st !== undefined && k0 + row < st.nextK;
}

// ---------------------------------------------------------------------------
// Bats.

const batO: EnemyOverrides = { vx: 0, vy: BAT.speed };

/** `warrens.bats { n, x }`: a flock drops in from the top around x. */
export function spawnBats(w: World, args: LevelScriptArgs): void {
  const n = Math.max(1, Math.floor(Number(args.n ?? 10)));
  const x = Number(args.x ?? w.width / 2);
  const rng = w.rng;
  for (let i = 0; i < n; i++) {
    const bx = Math.max(12, Math.min(w.width - 12, x + rng.range(-BAT.spread, BAT.spread) / 2));
    batO.vx = rng.range(-20, 20);
    spawnEnemy(w, 'wr_bat', bx, -10 - i * 5 - rng.range(0, 6), batO);
  }
}

// ---------------------------------------------------------------------------
// Rock falls: dust trickles from an open column at the top for `warn` s, then a rock drops.

/** `warrens.rockfall`: picks an open column at the top edge and starts its telegraph. */
export function startRockfall(w: World): void {
  const st = warrensState(w);
  const f = st.falls;
  let slot = -1;
  for (let i = 0; i < f.length; i += 3) {
    if ((f[i + 1] as number) < 0) {
      slot = i;
      break;
    }
  }
  if (slot < 0) return;
  // Open columns at the top row, away from the edges' rubble.
  let open = 0;
  for (let c = 1; c < COLS - 1; c++) if (tileAt(w, c * TILE + 4, 4) === Tile.Empty) open++;
  if (open === 0) return;
  let pick = w.rng.int(0, open - 1);
  for (let c = 1; c < COLS - 1; c++) {
    if (tileAt(w, c * TILE + 4, 4) !== Tile.Empty) continue;
    if (pick-- === 0) {
      f[slot] = c * TILE + 4;
      break;
    }
  }
  f[slot + 1] = ROCKFALL.warn;
  f[slot + 2] = w.rng.next() < ROCKFALL.medium ? 1 : 0;
}

const rockInit = { size: 'small' as 'small' | 'medium', x: 0, y: 0, vx: 0, vy: 0 };

function tickRockfalls(w: World, dt: number): void {
  const f = warrensState(w).falls;
  for (let i = 0; i < f.length; i += 3) {
    const left = f[i + 1] as number;
    if (left < 0) continue;
    const next = left - dt;
    if (next > 0) {
      f[i + 1] = next;
      continue;
    }
    f[i + 1] = -1;
    rockInit.size = f[i + 2] === 1 ? 'medium' : 'small';
    rockInit.x = f[i] as number;
    rockInit.y = -10;
    rockInit.vx = w.rng.range(-6, 6);
    rockInit.vy = w.scrollSpeed + ROCKFALL.speed;
    spawnRock(w, rockInit);
  }
}

// ---------------------------------------------------------------------------
// Cages: a pickup held in the terrain's frame until its gate is shot out (or
// it reaches the release line; the gates there have crumbled anyway).

function holdIn(w: World, k: Pickup, y: number): void {
  k.vx = 0;
  k.vy = w.scrollSpeed;
  k.y = y;
  if (k.kind !== 'escapePod') k.ttl = PICKUP_TUNING.ttl;
}

function gateOpen(w: World, chunk: string, row: number, x: number): boolean {
  const y = markedRowY(w, chunk, row) - TILE / 2;
  return Number.isNaN(y) || tileAt(w, x, y) !== Tile.Gate;
}

/** The pod: take the director's escape pod into the alcove when the pocket's row arrives. */
function tickPod(w: World, c: Cage): void {
  if (c.done && !cageLive(c)) return;
  if (!c.done) {
    if (!warrensState(w).marks.has(FORK.id)) return;
    const items = w.pickups.items;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = items[i] as Pickup;
      if (!k.active || k.kind !== 'escapePod') continue;
      c.pickup = k;
      c.id = k.id;
      c.done = true;
      c.caged = true;
      break;
    }
    if (!c.done) return;
  }
  const k = c.pickup as Pickup;
  if (k.magnetized) return;
  const y = markedRowY(w, FORK.id, FORK.podRow) - TILE / 2;
  if (c.caged) {
    if (!rowSpawned(w, FORK.id, FORK.podRow)) {
      // Waiting above the screen for the pocket to arrive.
      k.x = k.prevX = FORK.podX;
      k.y = k.prevY = -24;
      k.vx = 0;
      k.vy = 0;
      return;
    }
    if (k.x !== FORK.podX && y < 0) k.x = k.prevX = FORK.podX;
    const shot =
      gateOpen(w, FORK.id, FORK.podGateRow, FORK.podGateCols[0] * TILE + 4) ||
      gateOpen(w, FORK.id, FORK.podGateRow, FORK.podGateCols[1] * TILE + 4);
    if (!shot && y < CAGE.releaseY) {
      holdIn(w, k, y);
      return;
    }
    c.caged = false;
    c.freed = true;
  }
  // Out: drop down the branch a little faster than the walls, easing to its middle.
  k.vy = w.scrollSpeed + CAGE.podDrop;
  k.vx = Math.max(-30, Math.min(30, (FORK.podExitX - k.x) * CAGE.podSteer));
}

/** The upgrade core above the right branch's gates. */
function tickCore(w: World, c: Cage): void {
  if (!c.done) {
    if (!rowSpawned(w, FORK.id, FORK.coreRow)) return;
    c.done = true;
    const y = markedRowY(w, FORK.id, FORK.coreRow) - TILE / 2;
    // The row passed long ago (a late `?t=` start): no core.
    if (y > CAGE.releaseY) return;
    const k = spawnDrop(w, 'upgrade', FORK.coreX, y);
    if (k === null) return;
    c.pickup = k;
    c.id = k.id;
    c.caged = true;
  }
  if (!c.caged || !cageLive(c)) return;
  const k = c.pickup as Pickup;
  if (k.magnetized) {
    c.caged = false;
    return;
  }
  const y = markedRowY(w, FORK.id, FORK.coreRow) - TILE / 2;
  const open =
    gateOpen(w, FORK.id, FORK.coreGateRows[0], FORK.coreX) &&
    gateOpen(w, FORK.id, FORK.coreGateRows[1], FORK.coreX);
  if (open || y >= CAGE.releaseY) {
    c.caged = false;
    c.freed = true;
    return;
  }
  k.x = FORK.coreX;
  holdIn(w, k, y);
}

// ---------------------------------------------------------------------------
// The den: brake so its bottom row stops exactly at DEN.stopY, then hold 0.

/** Brakes the scroll onto the den (idempotent per tick). True once it has stopped. */
export function denBrake(w: World): boolean {
  const st = warrensState(w);
  if (st.denStopped) return true;
  const y = markedRowY(w, DEN.id, 0);
  if (Number.isNaN(y)) return false;
  const rem = DEN.stopY - y;
  if (rem <= 0.25) {
    setScrollSpeed(w, 0);
    st.denStopped = true;
    return true;
  }
  const vmax = Math.sqrt(2 * DEN_BRAKE * rem);
  if (w.scrollSpeed > vmax) setScrollSpeed(w, vmax);
  return false;
}

export const warrensSystem: System = {
  name: 'warrens.level',
  update(w, dt) {
    const st = warrensState(w);
    tickRockfalls(w, dt);
    tickPod(w, st.pod);
    tickCore(w, st.core);
    denBrake(w);
  },
};
