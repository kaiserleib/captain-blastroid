import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// The Gauntlet: a post-campaign stage (opened by the first Foundry clear) where
// a fully built hangar finally gets to fill all six slots. Seven rounds, each a
// short wave block rich in capsules and cores, then a campaign boss that comes
// back tougher. The timeline freezes while each boss lives and picks up again
// when it falls (`continue`), so rounds chain without a results screen.
// The Wyrm's round flies into a short stretch of the Warrens (mouth, tunnel,
// den): the den brake stops the scroll for the fight, and the next round's
// opening ramps it back up so the den scrolls away behind the terrain fade.

/** One round: the boss, its home sector (music, layers), local roster and the escalation. */
export interface GauntletRound {
  boss: string;
  home: string;
  /** Wave seconds before the boss. */
  waves: number;
  /** Sector enemies mixed into this round's waves (two spawn slots: a and b). */
  a: string;
  b: string;
  /** `enemyHpMul` for reused Level 1 roster enemies. */
  hp: number;
  /** `enemyShotSpeedMul`. */
  shot: number;
  /** Boss parts take 1/`tough` of the player's damage. */
  tough: number;
  salvage: number;
  /** Warrens terrain: queued `terrainAt` s into the round, ending in the den the Wyrm needs. */
  terrainAt?: number;
}

export const GAUNTLET_ROUNDS: readonly GauntletRound[] = [
  {
    boss: 'rock_hauler',
    home: 'kessler',
    waves: 42,
    a: 'swooper',
    b: 'gunboat',
    hp: 1.3,
    shot: 1.05,
    tough: 1.0,
    salvage: 80,
  },
  {
    boss: 'ion_shepherd',
    home: 'ionShoals',
    waves: 36,
    a: 'ion_skiff',
    b: 'gunboat',
    hp: 1.45,
    shot: 1.1,
    tough: 1.3,
    salvage: 120,
  },
  {
    boss: 'pn_magnetar',
    home: 'pulsarNursery',
    waves: 36,
    a: 'pn_drone',
    b: 'pn_ray',
    hp: 1.6,
    shot: 1.15,
    tough: 2.4,
    salvage: 160,
  },
  {
    boss: 'co_heliostat',
    home: 'corona',
    waves: 36,
    a: 'co_lens',
    b: 'interceptor',
    hp: 1.75,
    shot: 1.2,
    tough: 2.6,
    salvage: 200,
  },
  {
    boss: 'wr_wyrm',
    home: 'warrens',
    waves: 40,
    a: 'interceptor',
    b: 'gunboat',
    hp: 1.85,
    shot: 1.25,
    tough: 2.4,
    salvage: 220,
    terrainAt: 14,
  },
  {
    boss: 'wj_janus',
    home: 'junction',
    waves: 36,
    a: 'wj_blinker',
    b: 'gunboat',
    hp: 1.95,
    shot: 1.28,
    tough: 1.3,
    salvage: 240,
  },
  {
    boss: 'cr_echo',
    home: 'chrono',
    waves: 36,
    a: 'cr_rewinder',
    b: 'interceptor',
    hp: 2.05,
    shot: 1.3,
    tough: 1.5,
    salvage: 280,
  },
  {
    boss: 'fd_architect',
    home: 'foundry',
    waves: 36,
    a: 'fd_sentinel',
    b: 'gunboat',
    hp: 2.2,
    shot: 1.35,
    tough: 1.7,
    salvage: 600,
  },
];

/** Seconds of level clock between a boss falling and the next round's first beat. */
export const ROUND_GAP = 4;

/** The Warrens stretch the Wyrm's round flies into, in queue order; the den comes last. */
export const GAUNTLET_TERRAIN = ['wr_mouth', 'wr_tunnel'] as const;
export const GAUNTLET_DEN = 'wr_den';
/** Ends the terrain (game/terrain `CLEAR_CHUNK`). */
const CLEAR_CHUNK = '@clear';

/** Level-clock start of each round (the boss freezes the clock, so this is fight-independent). */
export function roundStarts(rounds: readonly GauntletRound[] = GAUNTLET_ROUNDS): number[] {
  const out: number[] = [];
  let t = 0;
  for (const r of rounds) {
    out.push(t);
    t += r.waves + ROUND_GAP;
  }
  return out;
}

const SIDES = ['left', 'right'] as const;

/**
 * A round's waves. The same skeleton every round, denser as `n` grows, with the
 * round's own sector roster in the a/b slots. Two carriers and two cores per
 * round (plus a core and a shield after each boss) keep the arsenal filling.
 */
function roundEvents(r: GauntletRound, n: number, T: number, of: number): TimelineEvent[] {
  return r.terrainAt !== undefined
    ? terrainRound(r, n, T, of, r.terrainAt)
    : openRound(r, n, T, of);
}

function roundStart(r: GauntletRound, n: number, T: number, of: number): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    {
      t: T + 0.5,
      script: 'gauntlet.round',
      args: { round: n + 1, of, hp: r.hp, shot: r.shot, tough: r.tough, home: r.home },
    },
  ];
  if (n > 0) {
    // Resupply after the last boss.
    ev.push({ t: T + 1, drop: { kind: 'upgrade', x: 'rand' } });
    ev.push({ t: T + 2, drop: { kind: 'shield', x: 'rand' } });
  }
  return ev;
}

function bossBeat(r: GauntletRound, n: number, T: number, of: number): TimelineEvent[] {
  const last = n === of - 1;
  return [
    { t: T + r.waves - 2, bossWarning: true },
    { t: T + r.waves, boss: r.boss, salvage: r.salvage, ...(!last && { continue: true }) },
  ];
}

/**
 * Open space, then the Warrens: only bats, borers (through the walls) and
 * interceptors once the walls close in, with the cores dropped down the middle.
 */
function terrainRound(
  r: GauntletRound,
  n: number,
  T: number,
  of: number,
  at: number,
): TimelineEvent[] {
  const gnats = 5 + Math.min(4, Math.floor(n / 2));
  const terrain: TimelineEvent[] = GAUNTLET_TERRAIN.map((chunk) => ({
    t: T + at,
    terrain: { chunk, theme: 'warrens' },
  }));
  return [
    ...roundStart(r, n, T, of),
    { t: T + 3, formation: { type: 'v', enemy: 'gnat', count: gnats, x: 'rand' } },
    { t: T + 5, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
    { t: T + 7, spawn: { enemy: r.b, x: 70 } },
    { t: T + 7, spawn: { enemy: r.b, x: 170 } },
    { t: T + 9, formation: { type: 'column', enemy: 'gnat', count: gnats, x: 'rand' } },
    { t: T + 10, spawn: { enemy: 'carrier', from: 'right', y: 110 } },
    { t: T + 12, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    ...terrain,
    { t: T + at, script: 'warrens.mark', args: { chunk: GAUNTLET_DEN } },
    { t: T + at, terrain: { chunk: GAUNTLET_DEN, theme: 'warrens' } },
    { t: T + at + 4, script: 'warrens.bats', args: { n: 10, x: 120 } },
    { t: T + at + 6, drop: { kind: 'upgrade', x: 120 } },
    { t: T + at + 8, spawn: { enemy: r.a, x: 'rand' } },
    { t: T + at + 10, spawn: { enemy: 'wr_borer', from: 'left', y: 120 } },
    { t: T + at + 11.5, spawn: { enemy: 'wr_borer', from: 'right', y: 160 } },
    { t: T + at + 13, script: 'warrens.bats', args: { n: 12, x: 120 } },
    { t: T + at + 15, spawn: { enemy: r.a, x: 'rand' } },
    { t: T + at + 17, drop: { kind: 'upgrade', x: 120 } },
    { t: T + at + 18, spawn: { enemy: 'wr_borer', from: 'right', y: 110 } },
    { t: T + at + 20, script: 'warrens.bats', args: { n: 8, x: 120 } },
    { t: T + r.waves - 6, drop: { kind: 'shield', x: 120 } },
    ...bossBeat(r, n, T, of),
  ];
}

function openRound(r: GauntletRound, n: number, T: number, of: number): TimelineEvent[] {
  const gnats = 5 + Math.min(4, Math.floor(n / 2));
  const side = SIDES[n % 2] as 'left' | 'right';
  const other = SIDES[(n + 1) % 2] as 'left' | 'right';
  const ev: TimelineEvent[] = [
    ...roundStart(r, n, T, of),
    { t: T + 3, formation: { type: 'v', enemy: 'gnat', count: gnats, x: 'rand' } },
    { t: T + 6, spawn: { enemy: 'carrier', from: side, y: 90 } },
    { t: T + 8, spawn: { enemy: r.a, x: 70 } },
    { t: T + 8.5, spawn: { enemy: r.a, x: 170 } },
    { t: T + 11, formation: { type: 'column', enemy: 'gnat', count: gnats, x: 'rand' } },
    { t: T + 11, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: T + 14, spawn: { enemy: r.b, x: 60 } },
    { t: T + 14, spawn: { enemy: r.b, x: 180 } },
    { t: T + 16, drop: { kind: 'upgrade', x: 'rand' } },
    { t: T + 18, formation: { type: 'stagger', enemy: 'gnat', count: gnats + 1, x: 'rand' } },
    { t: T + 19, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: T + 22, spawn: { enemy: 'carrier', from: other, y: 110 } },
    { t: T + 24, spawn: { enemy: r.a, x: 120 } },
    { t: T + 24, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: T + 27, formation: { type: 'line', enemy: 'gnat', count: gnats + 2, x: 120 } },
    { t: T + 28, spawn: { enemy: r.b, x: 'rand' } },
    { t: T + 30, drop: { kind: 'upgrade', x: 'rand' } },
    { t: T + 31, spawn: { enemy: r.a, x: 60 } },
    { t: T + 31, spawn: { enemy: r.a, x: 180 } },
  ];
  if (n >= 3) {
    ev.push({ t: T + 20, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 100 } } });
    ev.push({ t: T + 33, formation: { type: 'v', enemy: 'gnat', count: gnats + 2, x: 'rand' } });
  }
  if (r.waves > 38) {
    ev.push({ t: T + 35, spawn: { enemy: 'carrier', from: side, y: 100 } });
    ev.push({ t: T + 37, formation: { type: 'column', enemy: 'gnat', count: gnats, x: 'rand' } });
  }
  ev.push(...bossBeat(r, n, T, of));
  return ev;
}

function roundField(r: GauntletRound, n: number, T: number): AsteroidFieldSegment[] {
  const k = 1 + n * 0.12;
  return [
    {
      from: T,
      // Tunnel walls would only break the rocks.
      to: T + (r.terrainAt ?? r.waves - 4),
      rate: 0.7 * k,
      rateTo: 1.3 * k,
      sizes: { small: 3, medium: 2, large: n >= 2 ? 0.4 : 0 },
    },
  ];
}

function build(rounds: readonly GauntletRound[]): {
  timeline: TimelineEvent[];
  field: AsteroidFieldSegment[];
} {
  const starts = roundStarts(rounds);
  const timeline: TimelineEvent[] = [{ t: 0.2, toast: 'THE GAUNTLET' }];
  const field: AsteroidFieldSegment[] = [];
  rounds.forEach((r, n) => {
    const T = starts[n] as number;
    // The den brake left the scroll at 0; the den scrolls away into the wall fade.
    // (Queuing the fade earlier would drop the den's unspawned rows.)
    if (rounds[n - 1]?.terrainAt !== undefined) {
      timeline.push({ t: T + 0.5, scroll: { to: GAUNTLET_SCROLL, over: 3 } });
      timeline.push({ t: T + 0.5, terrain: { chunk: CLEAR_CHUNK, theme: 'warrens' } });
    }
    timeline.push(...roundEvents(r, n, T, rounds.length));
    field.push(...roundField(r, n, T));
  });
  return { timeline, field };
}

const GAUNTLET_SCROLL = 32;
const BUILT = build(GAUNTLET_ROUNDS);

export const LEVEL: LevelDef = {
  id: 'gauntlet',
  number: 11,
  name: 'THE GAUNTLET',
  theme: 'junction',
  music: 'level1',
  scrollSpeed: GAUNTLET_SCROLL,
  // About 37 s of waves and ~45 s of boss per round.
  duration: 600,
  asteroidField: BUILT.field,
  timeline: BUILT.timeline,
  schematicOnClear: [],
  bossSalvage: 100,
  podFallbackSalvage: 0,
  rockTheme: 'kessler',
  hostLevels: [...new Set(GAUNTLET_ROUNDS.map((r) => r.home))],
};
