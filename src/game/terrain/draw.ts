import { TERRAIN, TERRAIN_THEMES, Tile } from '../../content/terrain';
import type { Renderer } from '../../gfx/renderer';
import { getCompiled } from '../../gfx/spriteCache';
import type { DrawLayer, World } from '../../sim/world';
import {
  codeAt,
  COLS,
  getTerrainState,
  lowestRow,
  RING,
  rowAtY,
  slotOf,
  TILE,
  type TerrainState,
} from './state';
import {
  MASK_DOWN,
  MASK_LEFT,
  MASK_RIGHT,
  MASK_UP,
  tileSpriteId,
  type TileKind,
} from './terrain.sprites';

// Rows are baked into a ring atlas (one 240×8 strip per ring slot) when they
// enter or change, so a frame is at most two drawImage calls however much
// terrain is on screen. Slot s sits at atlas y = (RING - 1 - s) * TILE, which
// keeps consecutive rows adjacent and in screen order.

const W = COLS * TILE;

interface View {
  readonly atlas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly bakedRev: Uint32Array;
  readonly bakedK: Int32Array;
}

const views = new WeakMap<TerrainState, View>();

function viewFor(st: TerrainState): View | null {
  let v = views.get(st);
  if (v !== undefined) return v;
  if (typeof document === 'undefined') return null;
  const atlas = document.createElement('canvas');
  atlas.width = W;
  atlas.height = RING * TILE;
  const ctx = atlas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  v = { atlas, ctx, bakedRev: new Uint32Array(RING), bakedK: new Int32Array(RING).fill(-1) };
  views.set(st, v);
  return v;
}

/** Unknown rows (not spawned yet, or gone below) count as solid: no edge drawn against them. */
function solidAround(st: TerrainState, k: number, c: number): boolean {
  if (c < 0 || c >= COLS) return true;
  if (k < lowestRow(st) || k >= st.nextK) return true;
  return codeAt(st, k, c) !== Tile.Empty;
}

/** 4-neighbour mask (bits: 1 up, 2 right, 4 down, 8 left). Row k + 1 is above row k. */
export function tileMask(st: TerrainState, k: number, c: number): number {
  return (
    (solidAround(st, k + 1, c) ? MASK_UP : 0) |
    (solidAround(st, k, c + 1) ? MASK_RIGHT : 0) |
    (solidAround(st, k - 1, c) ? MASK_DOWN : 0) |
    (solidAround(st, k, c - 1) ? MASK_LEFT : 0)
  );
}

/** Open diagonals of an enclosed tile (bits: 1 up-left, 2 up-right, 4 down-right, 8 down-left). */
function diagOpen(st: TerrainState, k: number, c: number): number {
  return (
    (solidAround(st, k + 1, c - 1) ? 0 : 1) |
    (solidAround(st, k + 1, c + 1) ? 0 : 2) |
    (solidAround(st, k - 1, c + 1) ? 0 : 4) |
    (solidAround(st, k - 1, c - 1) ? 0 : 8)
  );
}

/** 0 intact, 1 cracked (≤ 2/3 HP), 2 badly cracked (≤ 1/3 HP). */
export function crackStage(hp: number, max: number): number {
  return hp > (max * 2) / 3 ? 0 : hp > max / 3 ? 1 : 2;
}

const KIND_BY_CODE: readonly (TileKind | null)[] = [null, 'rock', 'crumbly', 'gate', 'socket'];
/** Sheets by theme and tile code, resolved on first bake. */
const sheets: (HTMLCanvasElement | null)[][] = TERRAIN_THEMES.map(() => [
  null,
  null,
  null,
  null,
  null,
]);

function sheet(theme: number, code: number): HTMLCanvasElement | null {
  const row = sheets[theme] as (HTMLCanvasElement | null)[];
  let s = row[code] ?? null;
  if (s === null) {
    const kind = KIND_BY_CODE[code];
    const t = TERRAIN_THEMES[theme];
    if (kind == null || t === undefined) return null;
    s = getCompiled(tileSpriteId(t, kind))?.sheet ?? null;
    row[code] = s;
  }
  return s;
}

/** Sprite frame for a tile (see terrain.sprites.ts for the layout). */
export function tileFrame(st: TerrainState, k: number, c: number): number {
  const code = codeAt(st, k, c);
  const mask = tileMask(st, k, c);
  if (code === Tile.Rock) {
    if (mask !== 15) return mask;
    const d = diagOpen(st, k, c);
    return d === 0 ? 15 : 16 + d;
  }
  if (code === Tile.Crumbly || code === Tile.Gate) {
    const max = TERRAIN.hp[code] ?? 1;
    return crackStage(st.hp[slotOf(k) * COLS + c] as number, max) * 16 + mask;
  }
  return mask;
}

function bake(st: TerrainState, v: View, k: number): void {
  const slot = slotOf(k);
  const ay = (RING - 1 - slot) * TILE;
  const ctx = v.ctx;
  ctx.clearRect(0, ay, W, TILE);
  const theme = st.theme[slot] as number;
  for (let c = 0; c < COLS; c++) {
    const code = codeAt(st, k, c);
    if (code === Tile.Empty) continue;
    const img = sheet(theme, code);
    if (img === null) continue;
    ctx.drawImage(img, tileFrame(st, k, c) * TILE, 0, TILE, TILE, c * TILE, ay, TILE, TILE);
  }
  v.bakedK[slot] = k;
  v.bakedRev[slot] = st.rev[slot] as number;
}

/** Blits rows k0..k1 (same ring pass, no wrap) with row k1's top at screen y. */
function blit(r: Renderer, v: View, k0: number, k1: number, top: number): void {
  const ay = (RING - 1 - slotOf(k1)) * TILE;
  const h = (k1 - k0 + 1) * TILE;
  r.ctx.drawImage(v.atlas, 0, ay, W, h, Math.round(r.shakeX), top, W, h);
}

const DUST: Record<number, string> = {
  [Tile.Rock]: '#786048',
  [Tile.Crumbly]: '#a87838',
  [Tile.Gate]: '#f8c800',
  [Tile.Socket]: '#788090',
};

function drawDebris(st: TerrainState, r: Renderer, s: number): void {
  const d = st.debris;
  const life = TERRAIN.debrisLife;
  for (let i = 0; i < TERRAIN.maxDebris; i++) {
    const age = d[i * 4 + 2] as number;
    if (age >= life) continue;
    const x = d[i * 4] as number;
    const y = (d[i * 4 + 1] as number) + s;
    const spread = 4 + age * 30;
    const color = DUST[d[i * 4 + 3] as number] ?? '#786048';
    const sz = age < life * 0.5 ? 2 : 1;
    r.rect(x - spread, y - spread * 0.5 + age * 20, sz, sz, color);
    r.rect(x + spread - 1, y - spread * 0.4 + age * 24, sz, sz, color);
    r.rect(x - spread * 0.4, y + spread * 0.3 + age * 30, sz, sz, color);
    r.rect(x + spread * 0.5, y + spread * 0.2 + age * 28, sz, sz, color);
  }
}

/** Draws the terrain for one world at render interpolation `alpha`. */
export function drawTerrain(w: World, r: Renderer, alpha: number): void {
  const st = getTerrainState(w);
  if (st === undefined) return;
  const v = viewFor(st);
  if (v === null) return;
  const s = st.prevScroll + (st.scroll - st.prevScroll) * alpha;
  // Rows overlapping 0..height at the interpolated scroll (rowAtY reads st.scroll).
  const shift = s - st.scroll;
  let kHi = rowAtY(st, -shift);
  let kLo = rowAtY(st, w.height - 1e-6 - shift);
  kHi = Math.min(kHi, st.nextK - 1);
  kLo = Math.max(kLo, lowestRow(st));
  if (kLo > kHi) {
    drawDebris(st, r, s);
    return;
  }
  for (let k = kLo; k <= kHi; k++) {
    const slot = slotOf(k);
    if (v.bakedK[slot] !== k || v.bakedRev[slot] !== st.rev[slot]) bake(st, v, k);
  }
  const base = Math.round(s) + r.offsetY + Math.round(r.shakeY);
  // Split where the slots wrap from RING - 1 back to 0.
  const wrapK = kLo + (RING - 1 - slotOf(kLo));
  if (wrapK >= kHi) blit(r, v, kLo, kHi, base - (kHi + 1) * TILE);
  else {
    blit(r, v, kLo, wrapK, base - (wrapK + 1) * TILE);
    blit(r, v, wrapK + 1, kHi, base - (kHi + 1) * TILE);
  }
  drawDebris(st, r, s);
}

/** Above the background (0), below anomalies (10) and everything else. */
export const terrainLayer: DrawLayer = { name: 'terrain', z: 5, draw: drawTerrain };
