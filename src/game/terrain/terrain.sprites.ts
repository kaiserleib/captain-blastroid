import { TERRAIN_THEMES, type TerrainTheme } from '../../content/terrain';
import { gridRows, defineSprite } from '../../gfx/sprite';
import { snes } from '../../gfx/palette';

// Terrain tile sets (T34): one sprite per tile kind and theme, one frame per
// 4-neighbour mask. The 8×8 textures are authored as grids; edges, outer
// corners and inner corners are stamped onto them per mask (light from the
// top-left: top and left edges catch light, bottom and right fall into shadow).
//
// Frames: rock = mask (0–15), then 16 + diagonal bits for fully enclosed
// tiles with an open diagonal (inner corners); crumbly and gate = crack * 16
// + mask (crack 0–2); socket = mask.
//
// Mask bits: 1 up, 2 right, 4 down, 8 left (set = neighbour is solid).
// Diagonal bits: 1 up-left, 2 up-right, 4 down-right, 8 down-left (set = open).

export const MASK_UP = 1;
export const MASK_RIGHT = 2;
export const MASK_DOWN = 4;
export const MASK_LEFT = 8;

export type TileKind = 'rock' | 'crumbly' | 'gate' | 'socket';
export const TILE_KINDS: readonly TileKind[] = ['rock', 'crumbly', 'gate', 'socket'];

export function tileSpriteId(theme: TerrainTheme, kind: TileKind): string {
  return `tr_${theme}_${kind}`;
}

interface ThemeArt {
  /** o outline, d dark, b base, l light, h highlight; s/S steel light/dark; y/k hazard; m seam glow. */
  palette: Record<string, string>;
  rock: string;
  crumbly: string;
  gate: string;
  socket: string;
}

const ART: Record<TerrainTheme, ThemeArt> = {
  // Ochre and umber strata, gunmetal fittings, hazard-yellow gates.
  warrens: {
    palette: {
      o: '#181008',
      d: '#483018',
      b: '#785028',
      l: '#a87838',
      h: '#d0a858',
      S: '#384048',
      s: '#788090',
      y: '#f8c800',
      k: '#181818',
      m: '#a87838',
    },
    rock: `
      bbdbbbbd
      blbbdbbb
      bbbbbbdb
      dbbdbbbb
      bbbbbblb
      bdbbbbbb
      bbbblbdb
      dbbbbbbb`,
    crumbly: `
      lbbdlbbd
      bbdbbbdb
      dbblbdbb
      bbdbbblb
      lbbbdbbd
      bdblbbdb
      bbbdbbbl
      dbbbldbb`,
    gate: `
      ssssssss
      yykkyykk
      ykkyykky
      kkyykkyy
      kyykkyyk
      yykkyykk
      ykkyykky
      SSSSSSSS`,
    socket: `
      dddddddd
      dSSSSSSd
      dSkkkkSd
      dSksskSd
      dSksskSd
      dSkkkkSd
      dSSSSSSd
      dddddddd`,
  },
  // Black steel plates on rust, molten seams in the weak plating.
  foundry: {
    palette: {
      o: '#100808',
      d: '#302020',
      b: '#503830',
      l: '#805040',
      h: '#b07858',
      S: '#282830',
      s: '#686870',
      y: '#f8a800',
      k: '#100808',
      m: '#f88820',
    },
    rock: `
      bbbbbbbd
      blbbbbbd
      bbbbbbbd
      dddddddd
      bbbdbbbb
      bbbdbblb
      bbbdbbbb
      dddddddd`,
    crumbly: `
      bbdbbmbb
      bmbbdbbd
      dbbmbbbb
      bbbbbdmb
      bdbmbbbb
      mbbbbdbb
      bbdbbbmb
      dbbmbbbd`,
    gate: `
      ssssssss
      kkyykkyy
      kyykkyyk
      yykkyykk
      ykkyykky
      kkyykkyy
      kyykkyyk
      SSSSSSSS`,
    socket: `
      dddddddd
      dSSSSSSd
      dSkkkkSd
      dSkmmkSd
      dSkmmkSd
      dSkkkkSd
      dSSSSSSd
      dddddddd`,
  },
};

/** Per-kind edge colors: [highlight, light, dark, outline]. */
const EDGES: Record<TileKind, [string, string, string, string]> = {
  rock: ['h', 'l', 'd', 'o'],
  crumbly: ['h', 'l', 'd', 'o'],
  gate: ['s', 's', 'S', 'k'],
  socket: ['h', 'l', 'd', 'o'],
};

/** Crack pixels, [x, y], added at each stage. */
const CRACKS: readonly (readonly [number, number])[][] = [
  [],
  [
    [2, 1],
    [3, 2],
    [3, 3],
    [4, 4],
    [5, 4],
    [6, 5],
  ],
  [
    [1, 5],
    [2, 5],
    [2, 6],
    [4, 5],
    [4, 6],
    [5, 2],
    [6, 1],
    [1, 2],
  ],
];

function toGrid(src: string): string[][] {
  return gridRows(src).map((r) => r.split(''));
}

function stamp(g: string[][], mask: number, diag: number, kind: TileKind): void {
  const [hi, li, dk, ol] = EDGES[kind];
  const up = (mask & MASK_UP) === 0;
  const right = (mask & MASK_RIGHT) === 0;
  const down = (mask & MASK_DOWN) === 0;
  const left = (mask & MASK_LEFT) === 0;
  const set = (x: number, y: number, ch: string) => void ((g[y] as string[])[x] = ch);
  for (let i = 0; i < 8; i++) {
    if (down) {
      set(i, 6, dk);
      set(i, 7, ol);
    }
    if (right) {
      set(6, i, dk);
      set(7, i, ol);
    }
  }
  if (left) for (let y = 0; y < 8; y++) set(0, y, li);
  if (up) for (let x = 0; x < 8; x++) set(x, 0, hi);
  if (up && left) set(0, 0, '.');
  if (up && right) set(7, 0, '.');
  if (down && left) set(0, 7, '.');
  if (down && right) set(7, 7, '.');
  if (up && left && !down) set(1, 1, li);
  if (mask === 15) {
    if (diag & 1) set(0, 0, hi);
    if (diag & 2) set(7, 0, dk);
    if (diag & 4) set(7, 7, ol);
    if (diag & 8) set(0, 7, dk);
  }
}

function frame(src: string, kind: TileKind, mask: number, diag: number, crack: number): string {
  const g = toGrid(src);
  for (let s = 1; s <= crack; s++) for (const [x, y] of CRACKS[s]!) (g[y] as string[])[x] = 'o';
  stamp(g, mask, diag, kind);
  return g.map((r) => r.join('')).join('\n');
}

function quantized(p: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in p) out[k] = snes(p[k] as string);
  return out;
}

for (const theme of TERRAIN_THEMES) {
  const art = ART[theme];
  const palette = quantized(art.palette);
  const rock: string[] = [];
  for (let m = 0; m < 16; m++) rock.push(frame(art.rock, 'rock', m, 0, 0));
  for (let d = 0; d < 16; d++) rock.push(frame(art.rock, 'rock', 15, d, 0));
  defineSprite(tileSpriteId(theme, 'rock'), { palette, frames: rock, anchor: { x: 0, y: 0 } });
  for (const kind of ['crumbly', 'gate'] as const) {
    const frames: string[] = [];
    for (let c = 0; c < 3; c++)
      for (let m = 0; m < 16; m++) frames.push(frame(art[kind], kind, m, 0, c));
    defineSprite(tileSpriteId(theme, kind), { palette, frames, anchor: { x: 0, y: 0 } });
  }
  const socket: string[] = [];
  for (let m = 0; m < 16; m++) socket.push(frame(art.socket, 'socket', m, 0, 0));
  defineSprite(tileSpriteId(theme, 'socket'), { palette, frames: socket, anchor: { x: 0, y: 0 } });
}

export const TERRAIN_SPRITE_IDS: readonly string[] = TERRAIN_THEMES.flatMap((t) =>
  TILE_KINDS.map((k) => tileSpriteId(t, k)),
);
