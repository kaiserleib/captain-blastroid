// Tile terrain (T34): tile codes, tunables, the chunk format and the shared
// test chunks. Sector content registers its own chunks with `registerChunks`.
import { SHIPS } from './ships';

/** Tile codes as stored in the terrain ring buffer. */
export const Tile = {
  Empty: 0,
  /** `#` indestructible rock. */
  Rock: 1,
  /** `%` crumbly rock. */
  Crumbly: 2,
  /** `=` gate, hazard-striped. */
  Gate: 3,
  /** `T` turret socket: the sector's wall turret spawns here when the row enters. */
  Socket: 4,
} as const;
export type TileCode = (typeof Tile)[keyof typeof Tile];

/** Authoring chars → tile codes. */
export const TILE_CHARS: Readonly<Record<string, TileCode>> = {
  '.': Tile.Empty,
  '#': Tile.Rock,
  '%': Tile.Crumbly,
  '=': Tile.Gate,
  T: Tile.Socket,
};

/** Tile sets, in the order the ring buffer stores their index. */
export const TERRAIN_THEMES = ['warrens', 'foundry'] as const;
export type TerrainTheme = (typeof TERRAIN_THEMES)[number];

export const TERRAIN = {
  /** px per tile. */
  tile: 8,
  /** Tiles across the 240 px playfield. */
  cols: 30,
  /** Ring buffer rows: the 50 visible rows, the spawn band above and slack below. */
  ringRows: 64,
  /** Rows kept spawned above the top edge, so masks and turrets are settled before they show. */
  spawnAhead: 2,
  /** Tile HP by code (0 = indestructible or empty). */
  hp: { [Tile.Crumbly]: 3, [Tile.Gate]: 6 } as Readonly<Partial<Record<TileCode, number>>>,
  /** A gate whose bottom edge reaches this y crumbles by itself (design.md, Terrain → Fairness). */
  gateCrumbleY: 300,
  /**
   * The ship's terrain box half-size, px. Wider than the 4 px damage hitbox so the
   * 24 px sprite can't visibly sink into rock, narrower than the wings so
   * corridors don't feel tight.
   */
  shipHalfW: 6,
  shipHalfH: 6,
  /** Push-outs longer than this per tick don't count as a way out (that's a crush). */
  maxPush: 8,
  /** Pilot passives on breakable tiles (Rook: +50% to rock and gates). */
  tileDamageMul: { rook: 1.5 } as Readonly<Record<string, number>>,
  /** Score for breaking a tile (player shots only). */
  score: { [Tile.Crumbly]: 10, [Tile.Gate]: 25 } as Readonly<Partial<Record<TileCode, number>>>,
  /** Broken-tile dust puffs kept for drawing. */
  maxDebris: 48,
  debrisLife: 0.45,
  /** `clearTerrain` default taper length, rows. */
  fadeRows: 6,
} as const;

/** Authoring rules checked by `validateChunk` (design.md, Terrain → Authoring rules). */
export const TERRAIN_RULES = {
  /** Narrowest corridor, tiles. */
  minCorridor: 6,
  /** Escape corridors (chunks tagged `escape`). */
  minCorridorEscape: 7,
  /** Share of the slowest ship's speed a wall may force sideways. */
  lateralShare: 0.6,
  /** Gates show on screen at least this long before they reach the crumble line. */
  gateLeadS: 3,
  /** Scroll a chunk is checked at unless it says otherwise, px/s. */
  defaultScroll: 34,
  defaultScrollEscape: 90,
} as const;

/** Slowest ship in the roster, px/s (the lateral rule's reference). */
export function slowestShipSpeed(): number {
  let s = Infinity;
  for (const id in SHIPS) s = Math.min(s, SHIPS[id]!.speed);
  return s;
}

export type ChunkTag = 'escape' | 'test';

/**
 * A terrain chunk. `rows` read top to bottom as they look on screen, so the
 * last row enters first. Each row is 30 chars of `# % = T .`.
 */
export interface ChunkDef {
  id: string;
  rows: readonly string[];
  tags?: readonly ChunkTag[];
  /** Fastest scroll this chunk is meant for, px/s (the validator checks it there). */
  scroll?: number;
}

const chunks = new Map<string, ChunkDef>();

/** Sector content registers its chunks at module load. Ids are global: prefix them (`wr_fork`). */
export function registerChunks(defs: readonly ChunkDef[]): void {
  for (const d of defs) {
    const had = chunks.get(d.id);
    if (had !== undefined && had !== d) throw new Error(`registerChunks: duplicate "${d.id}"`);
    chunks.set(d.id, d);
  }
}

export function getChunk(id: string): ChunkDef {
  const c = chunks.get(id);
  if (c === undefined) throw new Error(`Unknown terrain chunk "${id}"`);
  return c;
}

export function hasChunk(id: string): boolean {
  return chunks.has(id);
}

export function chunkIds(): string[] {
  return [...chunks.keys()];
}

// Shared test chunks: the sandbox corridor, the gallery and the unit tests.
// They join on a 14-wide corridor (walls 8 tiles each side).
export const TEST_CHUNKS: readonly ChunkDef[] = [
  {
    id: 'test_entry',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '#######................#######',
      '######..................######',
      '#####....................#####',
      '####......................####',
      '###........................###',
      '##..........................##',
      '#............................#',
      '..............................',
      '..............................',
    ],
  },
  {
    id: 'test_sbend',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '#######..............#########',
      '######..............##########',
      '#####..............###########',
      '####..............############',
      '###..............#############',
      '###..............#############',
      '###..............#############',
      '###..............#############',
      '####..............############',
      '#####..............###########',
      '######..............##########',
      '#######..............#########',
      '########..............########',
      '#########..............#######',
      '##########..............######',
      '###########..............#####',
      '############..............####',
      '#############..............###',
      '#############..............###',
      '#############..............###',
      '#############..............###',
      '############..............####',
      '###########..............#####',
      '##########..............######',
      '#########..............#######',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_narrow',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '#########............#########',
      '##########..........##########',
      '###########........###########',
      '############......############',
      '############......############',
      '############......############',
      '############......############',
      '############......############',
      '############......############',
      '############......############',
      '###########........###########',
      '##########..........##########',
      '#########............#########',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_fork',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '#######................#######',
      '######..................######',
      '#####....................#####',
      '####......................####',
      '###........................###',
      '###...........##...........###',
      '###..........####..........###',
      '###.........######.........###',
      '###.........######.........###',
      '###T........######.........###',
      '###.........######.........###',
      '###.........######.........###',
      '###.........#%%%%#.........###',
      '###.........######.........###',
      '###.........######........T###',
      '###.........######.........###',
      '###.........######.........###',
      '###.........######.........###',
      '###..........####..........###',
      '###...........##...........###',
      '###........................###',
      '####......................####',
      '#####....................#####',
      '######..................######',
      '#######................#######',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_turrets',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '########..............T#######',
      '########..............########',
      '########..............########',
      '########..............########',
      '#######T..............########',
      '########..............########',
      '########..............########',
      '########..............########',
      '########..............T#######',
      '########..............########',
      '########..............########',
      '########..............########',
      '#######T..............########',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_crumble',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '######%%..............%%######',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_gate',
    tags: ['test'],
    rows: [
      '########..............########',
      '########..............########',
      '########..............########',
      '########..............########',
      '########..............########',
      '########..............########',
      '########==============########',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_exit',
    tags: ['test'],
    rows: [
      '..............................',
      '..............................',
      '#............................#',
      '##..........................##',
      '###........................###',
      '####......................####',
      '#####....................#####',
      '######..................######',
      '#######................#######',
      '########..............########',
      '########..............########',
    ],
  },
  {
    id: 'test_escape',
    tags: ['test', 'escape'],
    rows: [
      '###########........###########',
      '###########........###########',
      '############........##########',
      '############........##########',
      '#############........#########',
      '#############........#########',
      '##############........########',
      '##############........########',
      '###############........#######',
      '###############........#######',
      '###############........#######',
      '###############........#######',
      '##############........########',
      '##############........########',
      '#############........#########',
      '#############........#########',
      '############........##########',
      '############........##########',
      '###########........###########',
      '###########........###########',
      '##########........############',
      '##########........############',
      '#########........#############',
      '#########........#############',
      '########........##############',
      '########........##############',
      '#######........###############',
      '#######........###############',
      '#######........###############',
      '#######........###############',
      '########........##############',
      '########........##############',
      '#########........#############',
      '#########........#############',
      '##########........############',
      '##########........############',
      '###########........###########',
      '###########........###########',
    ],
  },
];

registerChunks(TEST_CHUNKS);

/** The sandbox `\` corridor: about 60 s at 30 px/s, entry to exit. */
export const TEST_CORRIDOR: readonly string[] = [
  'test_entry',
  'test_sbend',
  'test_turrets',
  'test_narrow',
  'test_fork',
  'test_crumble',
  'test_gate',
  'test_sbend',
  'test_narrow',
  'test_fork',
  'test_exit',
];

/** The sandbox `Shift+\` gate row. */
export const TEST_GATE_CHUNK = 'test_gate';
