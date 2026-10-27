import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// Level 9, "Chrono Rift" (T41), per docs/design.md → Level 9. Beats:
//   0–10    a slow bubble drifts down the center; rocks crawl through it
//   8       supply run: a forced Spread capsule (twice, so a miss can recover)
//   14–40   Stutterer columns; a fast bubble at 28; carrier at 32
//   40–70   Rewinders ("FINISH THEM FAST") and lines of Bubble Mines
//   70–75   breather and a shield
//   75–110  gunboats behind slow bubbles (their fans pile up and spill out
//           together), interceptors; the echo pod at 100, the real pod on the
//           same path at 106
//   110–145 mixed waves and bubble-mine fields; a magnet at 120
//   145–172 time storm: flip bubbles and Stutterer swarms
//   175     warning; the Echo at 179
//
// Slow bubbles meant to hold still behind gunboats get `vy` 3 (the default is
// the scroll speed) and a ttl, so they never outstay their beat.

export { ROSTER, STUTTER_P, REWIND_P, BUBBLE_MINE_P, MISSILE_P } from './roster';
export { ECHO, ECHO_PART_DEFS, ECHO_WEAPONS, type EchoDef, type EchoPatterns } from './echo';

/** The pod beat: an uncollectable echo pod, then the real one on its recorded path. */
export const POD = {
  /** Enemy shots the real pod survives (design gives none for L9; it shares the screen with fans). */
  hp: 2,
  /** Kept this far inside the side edges. */
  margin: 30,
  /** Level seconds between the echo and the real pod (the timeline's 100 → 106). */
  lead: 6,
  /** Ticks of path the echo can record (40 s at 60 Hz; the pod crosses in about 34 s). */
  maxTicks: 2400,
} as const;

const SMALL = { small: 1 } as const;
const SPARSE = { small: 4, medium: 1 } as const;
const STORM = { small: 3, medium: 2 } as const;

const FIELD: readonly AsteroidFieldSegment[] = [
  // The opening's rocks fall down the middle, through the slow bubble.
  { from: 0, to: 12, rate: 0.5, rateTo: 0.7, sizes: SMALL, speed: [14, 30], xRange: [80, 160] },
  { from: 12, to: 70, rate: 0.3, rateTo: 0.45, sizes: SPARSE },
  { from: 70, to: 76, rate: 0.2, sizes: SMALL },
  { from: 76, to: 145, rate: 0.35, rateTo: 0.5, sizes: SPARSE },
  { from: 145, to: 172, rate: 0.45, rateTo: 0.75, sizes: STORM },
  { from: 172, to: 176, rate: 0.5, rateTo: 0.1, sizes: SMALL },
];

/** A gunboat holding behind a near-still slow bubble: its fans pile up inside and spill out together. */
const DAMMED_GUNBOAT = (t: number, x: number): TimelineEvent[] => [
  { t, bubble: { kind: 'slow', x, y: 150, r: 52, vy: 3, ttl: 10 } },
  { t: t + 0.5, spawn: { enemy: 'gunboat', x, overrides: { ay: 82 } } },
];

const TIMELINE: TimelineEvent[] = [
  { t: 0.5, toast: 'CHRONO RIFT' },
  { t: 1, bubble: { kind: 'slow', x: 120, r: 52, vy: 14 } },
  { t: 3, toast: 'SLOW FIELD: SHOTS CRAWL' },
  { t: 5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },

  // Supply run: Spread fans fill a bubble with crawling shots.
  {
    t: 8,
    formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
    forceCapsule: 'spread',
  },
  {
    t: 11,
    formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' },
    forceCapsule: 'spread',
  },

  // Stutterer columns; a fast bubble; the carrier.
  { t: 14, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 60 } },
  { t: 17, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 180 } },
  { t: 20, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
  { t: 22, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 120 } },
  { t: 25, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
  { t: 28, bubble: { kind: 'fast', x: 'rand', r: 52 } },
  { t: 28, toast: 'FAST FIELD' },
  { t: 29, formation: { type: 'column', enemy: 'cr_stutterer', count: 5, x: 90 } },
  { t: 32, spawn: { enemy: 'carrier', from: 'right', y: 84 } },
  { t: 34, formation: { type: 'column', enemy: 'cr_stutterer', count: 3, x: 40 } },
  { t: 34, formation: { type: 'column', enemy: 'cr_stutterer', count: 3, x: 200 } },
  { t: 37, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

  // Rewinders and lines of bubble mines.
  { t: 40, toast: 'FINISH THEM FAST' },
  { t: 40.5, spawn: { enemy: 'cr_rewinder', x: 80 } },
  { t: 43, formation: { type: 'line', enemy: 'cr_bubblemine', count: 3, x: 120 } },
  { t: 45, spawn: { enemy: 'cr_rewinder', x: 170 } },
  { t: 48, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 50, spawn: { enemy: 'cr_rewinder', x: 60 } },
  { t: 50.6, spawn: { enemy: 'cr_rewinder', x: 180 } },
  { t: 53, formation: { type: 'line', enemy: 'cr_bubblemine', count: 4, x: 120 } },
  { t: 56, spawn: { enemy: 'interceptor', x: 120 } },
  { t: 58, spawn: { enemy: 'cr_rewinder', x: 120 } },
  { t: 61, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 'rand' } },
  { t: 63, formation: { type: 'line', enemy: 'cr_bubblemine', count: 3, x: 'rand' } },
  { t: 65, spawn: { enemy: 'cr_rewinder', x: 70 } },
  { t: 65.5, spawn: { enemy: 'cr_rewinder', x: 170 } },
  { t: 68, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },

  // Breather.
  { t: 71, drop: { kind: 'shield', x: 120 } },

  // Gunboats behind slow bubbles; interceptors.
  ...DAMMED_GUNBOAT(75, 80),
  { t: 79, spawn: { enemy: 'interceptor', x: 180 } },
  ...DAMMED_GUNBOAT(82, 170),
  { t: 85, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 60 } },
  { t: 88, spawn: { enemy: 'interceptor', x: 120 } },
  ...DAMMED_GUNBOAT(90, 120),
  { t: 93, spawn: { enemy: 'interceptor', x: 60 } },
  { t: 93.5, spawn: { enemy: 'interceptor', x: 180 } },
  { t: 96, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },

  // Dr. Halász: an echo pod first, then the real one on its exact path.
  { t: 99, toast: 'POD ECHO AHEAD', ifNoPod: 'CACHE ECHO AHEAD' },
  { t: 100, script: 'chrono.echoPod' },
  { t: 101, formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' } },
  { t: 105, toast: "HALASZ'S POD FOLLOWS", ifNoPod: 'THE CACHE FOLLOWS' },
  { t: 106, escapePod: { x: 'rand', hp: POD.hp } },
  { t: 108, spawn: { enemy: 'interceptor', x: 120 } },

  // Mixed waves and bubble-mine fields.
  { t: 110, formation: { type: 'line', enemy: 'cr_bubblemine', count: 4, x: 120 } },
  { t: 112, spawn: { enemy: 'cr_rewinder', x: 80 } },
  { t: 114, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 180 } },
  { t: 116, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 80 } } },
  { t: 118, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },
  { t: 120, drop: { kind: 'magnet', x: 'rand' } },
  { t: 121, formation: { type: 'line', enemy: 'cr_bubblemine', count: 3, x: 'rand' } },
  { t: 123, spawn: { enemy: 'cr_rewinder', x: 160 } },
  { t: 123.6, spawn: { enemy: 'cr_rewinder', x: 80 } },
  { t: 126, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 60 } },
  { t: 126, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 180 } },
  { t: 128, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  ...DAMMED_GUNBOAT(131, 120),
  { t: 134, formation: { type: 'line', enemy: 'cr_bubblemine', count: 4, x: 120 } },
  { t: 136, spawn: { enemy: 'interceptor', x: 70 } },
  { t: 136, spawn: { enemy: 'interceptor', x: 170 } },
  { t: 139, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },
  { t: 141, spawn: { enemy: 'cr_rewinder', x: 120 } },

  // Time storm.
  { t: 145, toast: 'TIME STORM' },
  { t: 145.5, bubble: { kind: 'flip', x: 70, r: 52 } },
  { t: 146, formation: { type: 'stagger', enemy: 'cr_stutterer', count: 5, x: 'rand' } },
  { t: 149, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 180 } },
  { t: 151, bubble: { kind: 'flip', x: 170, r: 52 } },
  { t: 152, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 60 } },
  { t: 155, formation: { type: 'stagger', enemy: 'cr_stutterer', count: 5, x: 120 } },
  { t: 157, bubble: { kind: 'flip', x: 120, r: 70 } },
  { t: 158, spawn: { enemy: 'cr_rewinder', x: 60 } },
  { t: 160, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 40 } },
  { t: 160, formation: { type: 'column', enemy: 'cr_stutterer', count: 4, x: 200 } },
  { t: 163, bubble: { kind: 'flip', x: 'rand', r: 52 } },
  { t: 164, formation: { type: 'stagger', enemy: 'cr_stutterer', count: 6, x: 'rand' } },
  { t: 167, formation: { type: 'v', enemy: 'gnat', count: 7, x: 120 } },
  { t: 169, formation: { type: 'column', enemy: 'cr_stutterer', count: 5, x: 'rand' } },

  { t: 175, bossWarning: true },
  { t: 179, boss: 'cr_echo' },
];

export const LEVEL: LevelDef = {
  id: 'chrono',
  number: 9,
  name: 'CHRONO RIFT',
  theme: 'rift',
  // The chrono sector's song is `rift` (WAVE8-NOTES).
  music: 'rift',
  bossMusic: 'boss2',
  scrollSpeed: 30,
  duration: 250,
  rockTheme: 'kessler',
  enemyHpMul: 1.55,
  enemyShotSpeedMul: 1.3,
  guaranteeWeapon: { by: 25, weapon: 'spread' },
  bossSalvage: 300,
  podFallbackSalvage: 120,
  schematicOnClear: ['revenant'],
  asteroidField: FIELD,
  timeline: TIMELINE,
};
