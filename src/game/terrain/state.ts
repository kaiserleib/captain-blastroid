import {
  getChunk,
  TERRAIN,
  TERRAIN_THEMES,
  Tile,
  TILE_CHARS,
  type TerrainTheme,
  type TileCode,
} from '../../content/terrain';
import type { World } from '../../sim/world';

// The terrain ring buffer. Row k (counted from the first row spawned) has its
// bottom edge at y = scroll - k * TILE: rows enter above the screen and slide
// down as `scroll` grows with `world.scrollSpeed`. Everything is preallocated
// when a world first gets terrain; per-tick work allocates nothing.

export const TILE = TERRAIN.tile;
export const COLS = TERRAIN.cols;
export const RING = TERRAIN.ringRows;

/** Called for each `T` tile as its row enters (tile center, above the screen). */
export type TurretSpawner = (w: World, x: number, y: number) => void;

export interface TerrainState {
  /** px scrolled since the terrain started; `prevScroll` is last tick's (render interpolation). */
  scroll: number;
  prevScroll: number;
  /** Next row index to spawn; rows nextK - RING .. nextK - 1 live in the ring. */
  nextK: number;
  /** Tile codes, RING × COLS, slot-major. */
  readonly tiles: Uint8Array;
  readonly hp: Float32Array;
  /** Per slot: theme index, change counter (draw re-bakes on change), and the row index it holds. */
  readonly theme: Uint8Array;
  readonly rev: Uint32Array;
  readonly rowK: Int32Array;
  /** Pending rows, bottom first. */
  queue: string[];
  queueTheme: number[];
  queueHead: number;
  /** What spawns while the queue is empty: the last row, with gates opened and sockets filled. */
  readonly hold: Uint8Array;
  holdTheme: number;
  /** Rows up to this index have had their gates crumbled at the crumble line. */
  crumbleK: number;
  /** World tick of the last crush (bots, hit causes); -1 = never. */
  crushTick: number;
  crushes: number;
  /** Broken-tile dust: x, terrain-space y (y - scroll), age, tile code. */
  readonly debris: Float32Array;
  debrisHead: number;
}

const states = new WeakMap<World, TerrainState>();
const spawners = new Map<string, TurretSpawner>();
const ignored = new Set<string>();

export function getTerrainState(w: World): TerrainState | undefined {
  return states.get(w);
}

export function ensureTerrainState(w: World): TerrainState {
  let st = states.get(w);
  if (st === undefined) {
    st = {
      scroll: 0,
      prevScroll: 0,
      nextK: 0,
      tiles: new Uint8Array(RING * COLS),
      hp: new Float32Array(RING * COLS),
      theme: new Uint8Array(RING),
      rev: new Uint32Array(RING),
      rowK: new Int32Array(RING).fill(-1),
      queue: [],
      queueTheme: [],
      queueHead: 0,
      hold: new Uint8Array(COLS),
      holdTheme: 0,
      crumbleK: -1,
      crushTick: -1,
      crushes: 0,
      debris: new Float32Array(TERRAIN.maxDebris * 4).fill(-1),
      debrisHead: 0,
    };
    // Debris ages start past their life, i.e. inactive.
    for (let i = 0; i < TERRAIN.maxDebris; i++) st.debris[i * 4 + 2] = TERRAIN.debrisLife;
    states.set(w, st);
  }
  return st;
}

/** One spawner per theme; registering again replaces it. */
export function registerTurretSpawner(theme: string, fn: TurretSpawner): () => void {
  spawners.set(theme, fn);
  return () => {
    if (spawners.get(theme) === fn) spawners.delete(theme);
  };
}

/** Enemies of this def pass through terrain (burrowers, things that live in walls). */
export function ignoreTerrain(defId: string): void {
  ignored.add(defId);
}

export function ignoresTerrain(defId: string): boolean {
  return ignored.has(defId);
}

export function themeIndex(theme: string): number {
  const i = TERRAIN_THEMES.indexOf(theme as TerrainTheme);
  if (i < 0) throw new Error(`Unknown terrain theme "${theme}"`);
  return i;
}

// ---------------------------------------------------------------------------
// Addressing.

/** Bottom edge of row k, px. */
export function rowBottom(st: TerrainState, k: number): number {
  return st.scroll - k * TILE;
}

/** The row covering y (rows own their top edge). May be outside the live range. */
export function rowAtY(st: TerrainState, y: number): number {
  return -Math.floor((y - st.scroll) / TILE) - 1;
}

export function lowestRow(st: TerrainState): number {
  return st.nextK > RING ? st.nextK - RING : 0;
}

export function rowLive(st: TerrainState, k: number): boolean {
  return k >= lowestRow(st) && k < st.nextK;
}

export function slotOf(k: number): number {
  return k % RING;
}

/** Tile code at row k, column c; empty outside the playfield or the live rows. */
export function codeAt(st: TerrainState, k: number, c: number): number {
  if (c < 0 || c >= COLS || !rowLive(st, k)) return Tile.Empty;
  return st.tiles[slotOf(k) * COLS + c] as number;
}

export function codeAtPoint(st: TerrainState, x: number, y: number): number {
  return codeAt(st, rowAtY(st, y), Math.floor(x / TILE));
}

/** Bumps a row's change counter (and its neighbours', whose edge masks depend on it). */
export function touchRow(st: TerrainState, k: number, neighbours: boolean): void {
  for (let j = neighbours ? k - 1 : k; j <= (neighbours ? k + 1 : k); j++) {
    if (rowLive(st, j)) st.rev[slotOf(j)]!++;
  }
}

// ---------------------------------------------------------------------------
// Queue and spawning.

/** Appends a chunk's rows above whatever is queued. */
export function queueRows(st: TerrainState, rows: readonly string[], theme: number): void {
  if (st.queueHead > 0 && st.queueHead >= st.queue.length) {
    st.queue.length = 0;
    st.queueTheme.length = 0;
    st.queueHead = 0;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    st.queue.push(rows[i] as string);
    st.queueTheme.push(theme);
  }
}

export function queuedRows(st: TerrainState): number {
  return st.queue.length - st.queueHead;
}

export function queueChunkRows(st: TerrainState, chunkId: string, theme: number): void {
  queueRows(st, getChunk(chunkId).rows, theme);
}

function parseInto(row: string, out: Uint8Array, base: number): void {
  for (let c = 0; c < COLS; c++) {
    const code = TILE_CHARS[row[c] ?? '.'];
    if (code === undefined) throw new Error(`terrain: bad tile char "${row[c]}" in "${row}"`);
    out[base + c] = code;
  }
}

function spawnRow(w: World, st: TerrainState): void {
  const k = st.nextK++;
  const slot = slotOf(k);
  const base = slot * COLS;
  const tiles = st.tiles;
  if (st.queueHead < st.queue.length) {
    const theme = st.queueTheme[st.queueHead] as number;
    parseInto(st.queue[st.queueHead++] as string, tiles, base);
    st.theme[slot] = theme;
    st.holdTheme = theme;
    for (let c = 0; c < COLS; c++) {
      const code = tiles[base + c] as number;
      st.hold[c] = code === Tile.Gate ? Tile.Empty : code === Tile.Socket ? Tile.Rock : code;
    }
  } else {
    tiles.set(st.hold, base);
    st.theme[slot] = st.holdTheme;
  }
  for (let c = 0; c < COLS; c++) {
    st.hp[base + c] = TERRAIN.hp[tiles[base + c] as TileCode] ?? 0;
  }
  st.rowK[slot] = k;
  st.rev[slot]!++;
  if (k > 0 && rowLive(st, k - 1)) st.rev[slotOf(k - 1)]!++;
  const fn = spawners.get(TERRAIN_THEMES[st.theme[slot] as number] as string);
  if (fn === undefined) return;
  for (let c = 0; c < COLS; c++) {
    if (tiles[base + c] === Tile.Socket) fn(w, c * TILE + TILE / 2, rowBottom(st, k) - TILE / 2);
  }
}

/** Spawns rows until the spawn band above the screen is full. */
export function spawnRows(w: World, st: TerrainState): void {
  const band = -TERRAIN.spawnAhead * TILE;
  while (rowBottom(st, st.nextK) > band) spawnRow(w, st);
}
