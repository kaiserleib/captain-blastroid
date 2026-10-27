import {
  getChunk,
  slowestShipSpeed,
  TERRAIN,
  TERRAIN_RULES,
  TILE_CHARS,
  type ChunkDef,
} from '../../content/terrain';

// Chunk fairness checks (design.md, Terrain → Authoring rules). Pure: runs
// in unit tests over every registered chunk, and sector tests can run it on
// their whole chunk sequence with `validateSequence`.

export interface ValidateOptions {
  /** Scroll to check at, px/s (default: the chunk's `scroll`, else 34, or 90 for escape). */
  scroll?: number;
  /** Escape rules: corridors ≥ 7 tiles. */
  escape?: boolean;
}

export interface ChunkProblem {
  /** Row index, top first as authored; -1 for chunk-wide problems. */
  row: number;
  msg: string;
}

const W = TERRAIN.cols * TERRAIN.tile;
const HW = TERRAIN.shipHalfW;

/** Rock and sockets are walls; open tiles and gates (shootable) are passable. Crumbly counts as wall. */
function passable(ch: string): boolean {
  return ch === '.' || ch === '=';
}

/** Ship x positions (px, integer) whose terrain box fits in the row. */
function fits(row: string): Uint8Array {
  const out = new Uint8Array(W + 1);
  for (let x = HW; x <= W - HW; x++) {
    const c0 = Math.floor((x - HW) / TERRAIN.tile);
    const c1 = Math.floor((x + HW - 1e-6) / TERRAIN.tile);
    let ok = 1;
    for (let c = c0; c <= c1 && ok; c++) if (!passable(row[c] as string)) ok = 0;
    out[x] = ok;
  }
  return out;
}

/** Passable runs as [startCol, endColExclusive). */
function runs(row: string): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let c = 0; c <= row.length; c++) {
    const p = c < row.length && passable(row[c] as string);
    if (p && start < 0) start = c;
    else if (!p && start >= 0) {
      out.push([start, c]);
      start = -1;
    }
  }
  return out;
}

/**
 * Checks rows (top first, as authored):
 * - every row is 30 chars of `# % = T .`;
 * - every row has a corridor at least `minCorridor` wide (gates count as open);
 * - walls never force the ship sideways faster than 60% of the slowest ship:
 *   from every fitting spot in every full-width corridor, there's a way up
 *   through all later rows moving at most that fast;
 * - gates show on screen at least `gateLeadS` before the crumble line.
 */
export function validateRows(rows: readonly string[], opts: ValidateOptions = {}): ChunkProblem[] {
  const problems: ChunkProblem[] = [];
  const escape = opts.escape ?? false;
  const scroll =
    opts.scroll ?? (escape ? TERRAIN_RULES.defaultScrollEscape : TERRAIN_RULES.defaultScroll);
  const minW = escape ? TERRAIN_RULES.minCorridorEscape : TERRAIN_RULES.minCorridor;
  const n = rows.length;
  for (let i = 0; i < n; i++) {
    const r = rows[i] as string;
    if (r.length !== TERRAIN.cols) problems.push({ row: i, msg: `length ${r.length}, want 30` });
    for (const ch of r) {
      if (TILE_CHARS[ch] === undefined) problems.push({ row: i, msg: `bad char "${ch}"` });
    }
  }
  if (problems.length > 0) return problems;

  let hasGate = false;
  for (let i = 0; i < n; i++) {
    const r = rows[i] as string;
    if (r.includes('=')) hasGate = true;
    if (!runs(r).some(([a, b]) => b - a >= minW))
      problems.push({ row: i, msg: `no corridor ≥ ${minW} tiles` });
  }

  // Ship-path check, walking the rows bottom (last) to top (first). A row passes
  // in TILE / scroll seconds, so the ship may slide M px per row.
  const M = Math.floor(
    (TERRAIN_RULES.lateralShare * slowestShipSpeed() * TERRAIN.tile) / Math.max(1, scroll),
  );
  const fit = rows.map(fits);
  // safe[i][x]: from x in row i the ship can keep up with every row above.
  const safe: Uint8Array[] = new Array<Uint8Array>(n);
  safe[0] = fit[0] as Uint8Array;
  for (let i = 1; i < n; i++) {
    const here = fit[i] as Uint8Array;
    const next = fit[i - 1] as Uint8Array;
    const nextSafe = safe[i - 1] as Uint8Array;
    const s = new Uint8Array(W + 1);
    for (let x = 0; x <= W; x++) {
      if (!here[x]) continue;
      // Slide within this row (stay fitting) to a spot that fits both rows and is safe above.
      for (let dir = -1; dir <= 1 && !s[x]; dir += 2) {
        for (let d = 0; d <= M; d++) {
          const x2 = x + d * dir;
          if (x2 < 0 || x2 > W || !here[x2]) break;
          if (next[x2] && nextSafe[x2]) {
            s[x] = 1;
            break;
          }
        }
      }
    }
    safe[i] = s;
  }
  for (let i = 1; i < n; i++) {
    const r = rows[i] as string;
    const s = safe[i] as Uint8Array;
    const f = fit[i] as Uint8Array;
    for (const [a, b] of runs(r)) {
      if (b - a < minW) continue;
      let ok = false;
      let any = false;
      for (let x = a * TERRAIN.tile; x <= b * TERRAIN.tile && !ok; x++) {
        if (f[x]) any = true;
        if (s[x]) ok = true;
      }
      if (any && !ok)
        problems.push({
          row: i,
          msg: `corridor at cols ${a}–${b - 1} can't be followed at ${scroll} px/s (max ${M} px per row)`,
        });
    }
  }

  if (hasGate && TERRAIN.gateCrumbleY / scroll < TERRAIN_RULES.gateLeadS) {
    problems.push({
      row: -1,
      msg: `gates get ${(TERRAIN.gateCrumbleY / scroll).toFixed(2)} s on screen at ${scroll} px/s (want ≥ ${TERRAIN_RULES.gateLeadS})`,
    });
  }
  return problems;
}

export function validateChunk(c: ChunkDef, opts: ValidateOptions = {}): ChunkProblem[] {
  const escape = opts.escape ?? c.tags?.includes('escape') ?? false;
  return validateRows(c.rows, { escape, scroll: opts.scroll ?? c.scroll });
}

/** Validates chunks as they will stack (first id enters first), joins included. */
export function validateSequence(ids: readonly string[], opts: ValidateOptions = {}) {
  const rows: string[] = [];
  let escape = opts.escape ?? false;
  let scroll = opts.scroll ?? 0;
  for (const id of ids) {
    const c = getChunk(id);
    rows.unshift(...c.rows);
    if (c.tags?.includes('escape')) escape = opts.escape ?? true;
    if (opts.scroll === undefined && c.scroll !== undefined) scroll = Math.max(scroll, c.scroll);
  }
  return validateRows(rows, { escape, ...(scroll > 0 && { scroll }) });
}
