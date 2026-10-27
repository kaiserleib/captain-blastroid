import { registerChunks, type ChunkDef } from '../../terrain';

// Foundry terrain (T42): the assembly corridors (150–190 s at 30 px/s) and
// the escape run's corridors (≥ 7 tiles at 90 px/s). Chunks are built from
// wall profiles, bottom row first (the order they enter), then flipped to the
// top-first authoring order. Every chunk joins its neighbours on the same
// corridor: assembly on 8|14|8, escape on 9|12|9.

const COLS = 30;

/** One row: `left` wall tiles, `width` open, the rest wall. */
export function corridorRow(left: number, width: number): string {
  const l = Math.max(0, Math.min(COLS, Math.round(left)));
  const wd = Math.max(0, Math.min(COLS - l, Math.round(width)));
  return '#'.repeat(l) + '.'.repeat(wd) + '#'.repeat(COLS - l - wd);
}

/** Replaces columns [c0, c1) of a row with `ch`. */
function patch(row: string, c0: number, c1: number, ch: string): string {
  return row.slice(0, c0) + ch.repeat(c1 - c0) + row.slice(c1);
}

type Profile = readonly [left: number, width: number];

/** `n` rows easing linearly from profile `a` to `b` (both ends included when n ≥ 2). */
function ramp(a: Profile, b: Profile, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 1 : i / (n - 1);
    out.push(corridorRow(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k));
  }
  return out;
}

function hold(p: Profile, n: number): string[] {
  return ramp(p, p, n);
}

/** Bottom-first rows → a chunk (top-first). */
function chunk(id: string, bottomUp: string[], scroll: number, escape = false): ChunkDef {
  return {
    id,
    scroll,
    tags: escape ? ['escape'] : undefined,
    rows: [...bottomUp].reverse(),
  };
}

// ---------------------------------------------------------------------------
// Assembly (30 px/s). A corridor 14 wide, two S-bends with a time bubble
// parked in each, and two chambers with a gate line and Cranes.

const A: Profile = [8, 14];
export const ASM_SCROLL = 30;

const entry = chunk(
  'fd_asm_entry',
  [...ramp([0, 30], [1, 28], 2), ...ramp([2, 26], A, 8), ...hold(A, 2)],
  ASM_SCROLL,
);

/** S-bend: out to the right, hold, and back. The bubble parks at the outer stretch. */
const bendRight = chunk(
  'fd_asm_bend_r',
  [
    ...hold(A, 2),
    ...ramp(A, [14, 13], 7),
    ...hold([14, 13], 8),
    ...ramp([14, 13], A, 7),
    ...hold(A, 2),
  ],
  ASM_SCROLL,
);

const bendLeft = chunk(
  'fd_asm_bend_l',
  [
    ...hold(A, 2),
    ...ramp(A, [3, 13], 6),
    ...hold([3, 13], 8),
    ...ramp([3, 13], A, 6),
    ...hold(A, 2),
  ],
  ASM_SCROLL,
);

/** A chamber 24 wide: crumbly buttresses, a gate line across the throat, then it narrows back. */
function chamber(id: string, gateRow: number): ChunkDef {
  const C: Profile = [3, 24];
  const rows = [...hold(A, 2), ...ramp(A, C, 5), ...hold(C, 16), ...ramp(C, A, 5), ...hold(A, 4)];
  // Crumbly buttresses on the chamber walls.
  for (const i of [9, 10, 15, 16]) {
    const r = rows[i] as string;
    rows[i] = patch(patch(r, 3, 5, '%'), 25, 27, '%');
  }
  // The gate across the throat (6 HP a tile; it crumbles by itself at y 300).
  rows[gateRow] = patch(rows[gateRow] as string, 8, 22, '=');
  return chunk(id, rows, ASM_SCROLL);
}

const chamber1 = chamber('fd_asm_chamber_a', 29);
const chamber2 = chamber('fd_asm_chamber_b', 29);

/** Assembly in timeline order; `@clear` tapers it off after the last chunk. */
export const ASSEMBLY_SEQUENCE = [
  'fd_asm_entry',
  'fd_asm_bend_r',
  'fd_asm_chamber_a',
  'fd_asm_bend_l',
  'fd_asm_chamber_b',
] as const;

// ---------------------------------------------------------------------------
// Escape (90 px/s): the lateral rule allows 5 px of wall drift a row, so the
// corridor moves at most a tile every two rows.

const E: Profile = [9, 12];
export const ESCAPE_SCROLL = 90;

/** n rows drifting `dx` tiles (one tile per two rows at most) at a fixed width. */
function drift(from: Profile, dx: number): string[] {
  const out: string[] = [];
  const steps = Math.abs(dx);
  const s = Math.sign(dx);
  for (let i = 0; i < steps; i++) {
    out.push(corridorRow(from[0] + s * i, from[1]));
    out.push(corridorRow(from[0] + s * (i + 1), from[1]));
  }
  return out;
}

const escEntry = chunk(
  'fd_esc_entry',
  [...hold([0, 30], 4), ...ramp([0, 30], [3, 24], 6), ...ramp([3, 24], E, 12), ...hold(E, 4)],
  ESCAPE_SCROLL,
  true,
);

const escSweep = chunk(
  'fd_esc_sweep',
  [
    ...hold(E, 3),
    ...drift(E, 6),
    ...hold([15, 12], 6),
    ...drift([15, 12], -12),
    ...hold([3, 12], 6),
    ...drift([3, 12], 6),
    ...hold(E, 3),
  ],
  ESCAPE_SCROLL,
  true,
);

/** The corridor opens around a pillar (two 8-wide lanes), then closes again. */
function pillarRows(): string[] {
  const W: Profile = [3, 24];
  const rows = [...hold(E, 3), ...ramp(E, W, 12), ...hold(W, 18), ...ramp(W, E, 12), ...hold(E, 3)];
  // Pillar: grows from a point, holds 8 rows wide lanes either side, shrinks.
  const widths = [2, 4, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 6, 4, 2];
  for (let i = 0; i < widths.length; i++) {
    const k = 16 + i;
    const wd = widths[i] as number;
    const c0 = 15 - wd / 2;
    rows[k] = patch(rows[k] as string, c0, c0 + wd, '#');
  }
  return rows;
}

const escPillar = chunk('fd_esc_pillar', pillarRows(), ESCAPE_SCROLL, true);

const escZig = chunk(
  'fd_esc_zig',
  [
    ...hold(E, 2),
    ...drift(E, -5),
    ...hold([4, 12], 4),
    ...drift([4, 12], 9),
    ...hold([13, 12], 4),
    ...drift([13, 12], -4),
    ...hold(E, 2),
  ],
  ESCAPE_SCROLL,
  true,
);

/** A wide hall with crumbly blocks to weave through or shoot. */
function hallRows(): string[] {
  const H: Profile = [4, 22];
  const rows = [...hold(E, 2), ...ramp(E, H, 10), ...hold(H, 20), ...ramp(H, E, 10), ...hold(E, 2)];
  for (const [k, c0] of [
    [16, 7],
    [17, 7],
    [22, 19],
    [23, 19],
  ] as const) {
    rows[k] = patch(rows[k] as string, c0, c0 + 4, '%');
  }
  return rows;
}

const escHall = chunk('fd_esc_hall', hallRows(), ESCAPE_SCROLL, true);

/** Escape chunks after the entry, in the order the script cycles them (with a seeded shuffle). */
export const ESCAPE_CHUNKS = [
  'fd_esc_sweep',
  'fd_esc_pillar',
  'fd_esc_zig',
  'fd_esc_hall',
] as const;
export const ESCAPE_ENTRY = 'fd_esc_entry';

export const CHUNKS: readonly ChunkDef[] = [
  entry,
  bendRight,
  bendLeft,
  chamber1,
  chamber2,
  escEntry,
  escSweep,
  escPillar,
  escZig,
  escHall,
];

registerChunks(CHUNKS);

/** Rows (bottom first) before the first row of each assembly chunk, by id. */
export function assemblyOffsets(): Record<string, number> {
  const out: Record<string, number> = {};
  let n = 0;
  for (const id of ASSEMBLY_SEQUENCE) {
    out[id] = n;
    n += (CHUNKS.find((c) => c.id === id) as ChunkDef).rows.length;
  }
  return out;
}

/** Total assembly rows. */
export function assemblyRows(): number {
  let n = 0;
  for (const id of ASSEMBLY_SEQUENCE)
    n += (CHUNKS.find((c) => c.id === id) as ChunkDef).rows.length;
  return n;
}
