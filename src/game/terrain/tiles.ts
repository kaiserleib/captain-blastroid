import { TERRAIN, Tile, type TileCode } from '../../content/terrain';
import type { RayHit } from '../../sim/hooks';
import type { World } from '../../sim/world';
import {
  codeAt,
  codeAtPoint,
  COLS,
  getTerrainState,
  rowAtY,
  rowBottom,
  rowLive,
  slotOf,
  TILE,
  touchRow,
  type TerrainState,
} from './state';

// Point, box and ray queries plus tile damage. "Solid" means any tile (sockets
// included: they sit in the wall); shots only stop on rock, crumbly and gates,
// so a turret in its socket can be hit and can fire.

export function solidCode(code: number): boolean {
  return code !== Tile.Empty;
}

/** Shots pass sockets (the turret on it takes the hit). */
export function shotStopper(code: number): boolean {
  return code === Tile.Rock || code === Tile.Crumbly || code === Tile.Gate;
}

export function breakable(code: number): boolean {
  return code === Tile.Crumbly || code === Tile.Gate;
}

/** Tile code at a point (`Tile.Empty` when the world has no terrain). */
export function tileAt(w: World, x: number, y: number): TileCode {
  const st = getTerrainState(w);
  return (st === undefined ? Tile.Empty : codeAtPoint(st, x, y)) as TileCode;
}

export function terrainSolidAt(w: World, x: number, y: number): boolean {
  const st = getTerrainState(w);
  return st !== undefined && solidCode(codeAtPoint(st, x, y));
}

/** True if the box [x ± hw) × [y ± hh) touches no solid tile. */
export function boxFree(st: TerrainState, x: number, y: number, hw: number, hh: number): boolean {
  const c0 = Math.floor((x - hw) / TILE);
  const c1 = Math.floor((x + hw - 1e-6) / TILE);
  const kTop = rowAtY(st, y - hh);
  const kBot = rowAtY(st, y + hh - 1e-6);
  for (let k = kBot; k <= kTop; k++) {
    if (!rowLive(st, k)) continue;
    for (let c = c0; c <= c1; c++) if (solidCode(codeAt(st, k, c))) return false;
  }
  return true;
}

/**
 * The extreme solid-tile edge inside the box, for pushing it out in one
 * direction: dir 0 up (min tile top), 1 down (max tile bottom), 2 left (min
 * tile left), 3 right (max tile right). NaN if the box is free.
 */
export function blockingEdge(
  st: TerrainState,
  x: number,
  y: number,
  hw: number,
  hh: number,
  dir: number,
): number {
  const c0 = Math.floor((x - hw) / TILE);
  const c1 = Math.floor((x + hw - 1e-6) / TILE);
  const kTop = rowAtY(st, y - hh);
  const kBot = rowAtY(st, y + hh - 1e-6);
  let edge = NaN;
  for (let k = kBot; k <= kTop; k++) {
    if (!rowLive(st, k)) continue;
    const bottom = rowBottom(st, k);
    for (let c = c0; c <= c1; c++) {
      if (!solidCode(codeAt(st, k, c))) continue;
      const v =
        dir === 0 ? bottom - TILE : dir === 1 ? bottom : dir === 2 ? c * TILE : (c + 1) * TILE;
      if (edge !== edge) edge = v;
      else if (dir === 0 || dir === 2) edge = v < edge ? v : edge;
      else edge = v > edge ? v : edge;
    }
  }
  return edge;
}

/**
 * Distance to push a box out of the terrain in one direction (see
 * `blockingEdge`), following on through stacked tiles; Infinity past `max`.
 * The pushed center is written to `out`.
 */
export function pushOut(
  st: TerrainState,
  x: number,
  y: number,
  hw: number,
  hh: number,
  dir: number,
  max: number,
  out: { x: number; y: number },
): number {
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    const e = blockingEdge(st, px, py, hw, hh, dir);
    if (e !== e) {
      out.x = px;
      out.y = py;
      return Math.abs(px - x) + Math.abs(py - y);
    }
    if (dir === 0) py = e - hh;
    else if (dir === 1) py = e + hh;
    else if (dir === 2) px = e - hw;
    else px = e + hw;
    if (Math.abs(px - x) + Math.abs(py - y) > max) return Infinity;
  }
  return Infinity;
}

// ---------------------------------------------------------------------------
// Damage.

const sfxP = { id: 'asteroid_break', x: 0 };

function addDebris(st: TerrainState, x: number, y: number, code: number): void {
  const i = st.debrisHead * 4;
  st.debris[i] = x;
  st.debris[i + 1] = y - st.scroll;
  st.debris[i + 2] = 0;
  st.debris[i + 3] = code;
  st.debrisHead = (st.debrisHead + 1) % TERRAIN.maxDebris;
}

/** Clears one tile with dust; player breaks score. */
export function breakTile(w: World, st: TerrainState, k: number, c: number, byPlayer: boolean) {
  const i = slotOf(k) * COLS + c;
  const code = st.tiles[i] as TileCode;
  if (code === Tile.Empty) return;
  st.tiles[i] = Tile.Empty;
  st.hp[i] = 0;
  touchRow(st, k, true);
  const x = c * TILE + TILE / 2;
  const y = rowBottom(st, k) - TILE / 2;
  addDebris(st, x, y, code);
  if (byPlayer) w.run.score += TERRAIN.score[code] ?? 0;
  if (y > -TILE && y < w.height + TILE) {
    sfxP.x = x;
    w.events.emit('sfx', sfxP);
  }
}

/** Tile damage multiplier for the current pilot (Rook's passive). */
export function tileDamageMul(w: World): number {
  return TERRAIN.tileDamageMul[w.run.pilotId] ?? 1;
}

/**
 * Damages the breakable tile under (x, y). Returns true if it broke. Rock and
 * sockets ignore damage. `byPlayer` scores and applies the pilot multiplier.
 */
export function damageTile(w: World, x: number, y: number, amount: number, byPlayer = true) {
  const st = getTerrainState(w);
  if (st === undefined || amount <= 0) return false;
  const k = rowAtY(st, y);
  const c = Math.floor(x / TILE);
  const code = codeAt(st, k, c);
  if (!breakable(code)) return false;
  const i = slotOf(k) * COLS + c;
  const hp = (st.hp[i] as number) - (byPlayer ? amount * tileDamageMul(w) : amount);
  if (hp <= 0) {
    breakTile(w, st, k, c, byPlayer);
    return true;
  }
  st.hp[i] = hp;
  touchRow(st, k, false);
  return false;
}

/** Removes every tile (rock included) whose center is within r of (x, y). Returns the count. */
export function carveTiles(w: World, x: number, y: number, r: number): number {
  const st = getTerrainState(w);
  if (st === undefined) return 0;
  const c0 = Math.max(0, Math.floor((x - r) / TILE));
  const c1 = Math.min(COLS - 1, Math.floor((x + r) / TILE));
  const kTop = rowAtY(st, y - r);
  const kBot = rowAtY(st, y + r);
  const rr = r * r;
  let n = 0;
  for (let k = kBot; k <= kTop; k++) {
    if (!rowLive(st, k)) continue;
    const cy = rowBottom(st, k) - TILE / 2;
    for (let c = c0; c <= c1; c++) {
      if (codeAt(st, k, c) === Tile.Empty) continue;
      const dx = c * TILE + TILE / 2 - x;
      const dy = cy - y;
      if (dx * dx + dy * dy > rr) continue;
      breakTile(w, st, k, c, false);
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Rays.

/**
 * Grid walk from (x0, y0) to (x1, y1) against solid tiles. On a hit, `out`
 * gets the entry point, the face normal and t (0..1 along the ray). A start
 * inside a tile hits at t = 0, normal against the ray's main axis.
 */
export function terrainRaycast(
  w: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  out: RayHit,
): boolean {
  const st = getTerrainState(w);
  if (st === undefined) return false;
  const dx = x1 - x0;
  const dy = y1 - y0;
  // Grid space: column = x / TILE, gy = (y - scroll) / TILE, row k = -floor(gy) - 1.
  let c = Math.floor(x0 / TILE);
  let j = Math.floor((y0 - st.scroll) / TILE);
  if (solidCode(codeAt(st, -j - 1, c))) {
    out.x = x0;
    out.y = y0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      out.nx = dx > 0 ? -1 : 1;
      out.ny = 0;
    } else {
      out.nx = 0;
      out.ny = dy > 0 ? -1 : 1;
    }
    out.t = 0;
    return true;
  }
  const stepC = dx > 0 ? 1 : -1;
  const stepJ = dy > 0 ? 1 : -1;
  const gx = x0 / TILE;
  const gy = (y0 - st.scroll) / TILE;
  const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tmx = dx > 0 ? (c + 1 - gx) * tdx : dx < 0 ? (gx - c) * tdx : Infinity;
  let tmy = dy > 0 ? (j + 1 - gy) * tdy : dy < 0 ? (gy - j) * tdy : Infinity;
  for (let guard = 0; guard < 128; guard++) {
    let t: number;
    let nx = 0;
    let ny = 0;
    if (tmx < tmy) {
      t = tmx;
      c += stepC;
      tmx += tdx;
      nx = -stepC;
    } else {
      t = tmy;
      j += stepJ;
      tmy += tdy;
      ny = -stepJ;
    }
    if (t > 1) return false;
    if (solidCode(codeAt(st, -j - 1, c))) {
      out.x = x0 + dx * t;
      out.y = y0 + dy * t;
      out.nx = nx;
      out.ny = ny;
      out.t = t;
      return true;
    }
  }
  return false;
}

/**
 * The x of the open spot nearest to x in the row at y where a box of half
 * width hw fits (column-aligned search), or NaN if the row is closed.
 */
export function nearestOpenX(w: World, x: number, y: number, hw: number = TERRAIN.shipHalfW) {
  const st = getTerrainState(w);
  if (st === undefined) return x;
  const k = rowAtY(st, y);
  if (!rowLive(st, k)) return x;
  let best = NaN;
  let bestD = Infinity;
  let run = 0;
  for (let c = 0; c <= COLS; c++) {
    const open = c < COLS && !solidCode(codeAt(st, k, c));
    if (open) {
      run++;
      continue;
    }
    if (run * TILE >= hw * 2) {
      const lo = (c - run) * TILE + hw;
      const hi = c * TILE - hw;
      const px = x < lo ? lo : x > hi ? hi : x;
      const d = Math.abs(px - x);
      if (d < bestD) {
        bestD = d;
        best = px;
      }
    }
    run = 0;
  }
  return best;
}
