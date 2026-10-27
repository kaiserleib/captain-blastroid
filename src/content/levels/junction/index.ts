import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// Level 8, per docs/design.md → Level 8 "Wormhole Junction". Portal pairs carry
// shots, rocks, pods and the ship; the sector teaches shooting through them.
//   0–13    one fixed pair (low-left ↔ high-right); a rock lane feeds the high end
//   8, 11   supply run: forced Flak capsules (field test)
//   14–40   swoopers and gnats; the first Aegis at 25 with its ring under it
//           ("SHOOT THROUGH THE RING"); carrier at 32
//   40–70   two crossed pairs; Blinkers dive through them; two Aegis with offset rings
//   70–75   breather and a shield
//   75–110  Gate Pylons carrying moving ends (rocks fed through the rings), interceptors;
//           Nyx Calder's pod falls into a ring at 100 and is carried down a ring chain
//   110–145 junction rush: three pairs swapping every 10 s, mixed waves, magnet at 120
//   145–172 feedback loop: vertically stacked pairs; rock streams and gnat swarms
//           pour out of the top ring and fall back into the bottom one
//   175     warning; Janus at 179
//
// Pairs are spawned by `junction.pair` (tagged, so `junction.collapse` can close
// them) rather than the generic `portal` action, which can't be closed early.

export { ROSTER, BLINKER_P, PYLON_P, AEGIS_P, AEGIS_BYPASS } from './roster';
export { JANUS, JANUS_PARTS, type JanusDef } from './janus';

/** Level-script knobs (game/levels/junction reads these). */
export const JX_SCRIPTS = {
  /** Junction rush: seconds between swaps (the pairs cycle 0↔1, 1↔2, 2↔0). */
  rushSwapEvery: 10,
  /** Feedback loop: things poured from a top ring leave it at this speed, px/s. */
  stream: { rockSpeed: 44, rockSize: 'medium' as const },
  /** Gnats this close to a loop's column are opted into the portals, px. */
  loopOptInDx: 20,
  /** A player shot this close to (ring r + exit pad) of an aimed exit was just put there, px. */
  aimSlack: 1.5,
} as const;

const LIGHT = { small: 4, medium: 2, large: 0.5 } as const;
/** Rocks fed through the pylon rings: big ones, worth shooting on the way out. */
const FEED = { small: 2, medium: 2, large: 1 } as const;
const SMALL = { small: 1 } as const;

const FIELD: readonly AsteroidFieldSegment[] = [
  // The opening lane falls into the high-right ring and comes out low-left.
  { from: 0, to: 13, rate: 0.5, rateTo: 0.7, sizes: SMALL, xRange: [176, 198], speed: [10, 22] },
  { from: 2, to: 14, rate: 0.25, sizes: SMALL },
  { from: 14, to: 70, rate: 0.3, rateTo: 0.45, sizes: LIGHT },
  { from: 70, to: 76, rate: 0.2, sizes: SMALL },
  { from: 76, to: 110, rate: 0.35, sizes: LIGHT },
  // Rocks fed through the pylon rings: lanes onto their fixed ends.
  { from: 77, to: 92, rate: 0.5, sizes: FEED, xRange: [54, 66], speed: [16, 26] },
  { from: 105, to: 109, rate: 0.5, sizes: FEED, xRange: [176, 186], speed: [16, 26] },
  { from: 110, to: 145, rate: 0.35, rateTo: 0.5, sizes: LIGHT },
  { from: 145, to: 172, rate: 0.3, sizes: SMALL },
  { from: 172, to: 176, rate: 0.3, rateTo: 0.1, sizes: SMALL },
];

const pair = (
  t: number,
  tag: string,
  a: readonly [number, number],
  b: readonly [number, number],
  color: string,
): TimelineEvent => ({
  t,
  script: 'junction.pair',
  args: { tag, ax: a[0], ay: a[1], bx: b[0], by: b[1], color },
});
const collapse = (t: number, tag: string): TimelineEvent => ({
  t,
  script: 'junction.collapse',
  args: { tag },
});
const aegis = (t: number, x: number, lowDx: number): TimelineEvent => ({
  t,
  script: 'junction.aegis',
  args: { x, lowDx },
});
const blinker = (t: number, x: number): TimelineEvent => ({
  t,
  spawn: { enemy: 'wj_blinker', x },
});
const pylon = (
  t: number,
  tag: string,
  end: 'a' | 'b',
  x: number,
  holdY: number,
  dir: number,
): TimelineEvent => ({ t, script: 'junction.pylon', args: { tag, end, x, holdY, dir } });
const stream = (t: number, tag: string, kind: 'rock' | 'gnat', n: number, gap: number) => ({
  t,
  script: 'junction.stream',
  args: { tag, kind, n, gap },
});

const TIMELINE: TimelineEvent[] = [
  { t: 0.5, toast: 'WORMHOLE JUNCTION' },
  pair(1, 'open', [48, 300], [186, 96], 'cyan'),
  { t: 3, toast: 'PORTALS: WHAT GOES IN COMES OUT' },

  // Supply run beside the pair: Flak bursts erase what comes through the rings.
  {
    t: 8,
    formation: { type: 'column', enemy: 'gnat', count: 5, x: 72 },
    forceCapsule: 'flak',
  },
  {
    t: 11,
    formation: { type: 'v', enemy: 'gnat', count: 5, x: 164 },
    forceCapsule: 'flak',
  },
  collapse(13.5, 'open'),

  // Swoopers and gnats; the portal teacher at 25.
  { t: 15, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
  { t: 18, formation: { type: 'column', enemy: 'gnat', count: 5, x: 170 } },
  { t: 21, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
  aegis(25, 120, 0),
  { t: 26, toast: 'SHOOT THROUGH THE RING' },
  { t: 28, formation: { type: 'v', enemy: 'gnat', count: 5, x: 60 } },
  { t: 30, spawn: { enemy: 'gunboat', x: 60, overrides: { ay: 70 } } },
  { t: 32, spawn: { enemy: 'carrier', from: 'right', y: 96 } },
  { t: 35, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
  { t: 37, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 180 } },
  { t: 39, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },

  // Two crossed pairs; Blinkers dive through them, and two Aegis with offset rings.
  pair(40, 'q0', [52, 76], [188, 150], 'cyan'),
  pair(40, 'q1', [188, 66], [52, 160], 'orange'),
  blinker(42, 90),
  blinker(42.4, 150),
  { t: 45, formation: { type: 'column', enemy: 'gnat', count: 5, x: 120 } },
  aegis(52, 84, 58),
  blinker(51, 120),
  { t: 53, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  blinker(56, 70),
  blinker(56.4, 170),
  aegis(59, 168, -66),
  { t: 61, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
  { t: 63, spawn: { enemy: 'interceptor', x: 60 } },
  blinker(64, 110),
  { t: 66, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },
  blinker(67, 160),
  blinker(68.5, 80),
  collapse(70, 'q0'),
  collapse(70, 'q1'),

  // Breather.
  { t: 71, drop: { kind: 'shield', x: 120 } },

  // Gate Pylons: moving ends. The first pair's fixed end catches a rock lane.
  pair(76, 'p1', [60, 30], [150, -20], 'lime'),
  pylon(76, 'p1', 'b', 150, 150, -1),
  { t: 79, spawn: { enemy: 'interceptor', x: 120 } },
  pair(80, 'px', [30, -20], [210, -20], 'cyan'),
  pylon(80, 'px', 'a', 30, 128, 1),
  pylon(80, 'px', 'b', 210, 186, -1),
  { t: 82, formation: { type: 'column', enemy: 'gnat', count: 5, x: 40 } },
  { t: 83, spawn: { enemy: 'gunboat', x: 196, overrides: { ay: 70 } } },
  { t: 85, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  pair(87, 'p2', [50, -20], [190, -20], 'orange'),
  pylon(87, 'p2', 'a', 50, 112, 1),
  pylon(87, 'p2', 'b', 190, 168, -1),
  { t: 90, spawn: { enemy: 'interceptor', x: 80 } },
  blinker(91, 140),
  { t: 93, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 94, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
  { t: 96, spawn: { enemy: 'interceptor', x: 160 } },
  blinker(97, 60),

  // Nyx Calder's pod falls into a ring at the top and rides a chain of rings down.
  { t: 99, toast: "NYX CALDER'S POD AHEAD", ifNoPod: 'SALVAGE CACHE AHEAD' },
  // The pod's ring chain needs two of the four pair slots.
  collapse(99.2, 'p1'),
  collapse(99.2, 'px'),
  pair(99.5, 'podA', [120, 14], [64, 140], 'cyan'),
  pair(99.5, 'podB', [64, 236], [178, 100], 'lime'),
  { t: 100, escapePod: { x: 120, hp: 2 } },
  { t: 102, formation: { type: 'column', enemy: 'gnat', count: 4, x: 200 } },
  pair(104, 'p3', [181, 30], [100, -20], 'orange'),
  pylon(104, 'p3', 'b', 100, 96, 1),
  { t: 106, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
  collapse(109.5, '*'),

  // Junction rush: three pairs, swapping every 10 s.
  pair(110, 'r0', [48, 84], [192, 230], 'cyan'),
  pair(110, 'r1', [192, 84], [48, 230], 'orange'),
  pair(110, 'r2', [72, 158], [168, 158], 'lime'),
  { t: 110, script: 'junction.rush' },
  { t: 110.5, toast: 'JUNCTION RUSH' },
  blinker(112, 100),
  blinker(112.4, 140),
  { t: 115, formation: { type: 'column', enemy: 'gnat', count: 5, x: 120 } },
  { t: 117, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 66 } } },
  { t: 120, drop: { kind: 'magnet', x: 'rand' } },
  { t: 121, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  blinker(124, 60),
  blinker(124.4, 180),
  { t: 127, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },
  { t: 129, spawn: { enemy: 'interceptor', x: 120 } },
  aegis(131, 120, -60),
  { t: 134, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
  blinker(137, 120),
  { t: 139, formation: { type: 'v', enemy: 'gnat', count: 7, x: 120 } },
  blinker(142, 80),
  blinker(142.4, 160),
  { t: 144.5, script: 'junction.rushEnd' },
  collapse(145, '*'),

  // Feedback loop: what falls into the bottom ring pours out of the top one.
  pair(145.5, 'loop0', [80, -6], [80, 286], 'cyan'),
  { t: 146, toast: 'FEEDBACK LOOP' },
  stream(147, 'loop0', 'rock', 5, 0.9),
  stream(151, 'loop0', 'gnat', 5, 0.35),
  pair(150, 'p5', [30, -20], [210, -20], 'lime'),
  pylon(150, 'p5', 'a', 30, 120, 1),
  pylon(150, 'p5', 'b', 210, 170, -1),
  { t: 153, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  pair(155.5, 'loop1', [164, -6], [164, 286], 'orange'),
  stream(156, 'loop1', 'gnat', 5, 0.35),
  stream(158, 'loop0', 'rock', 4, 1),
  { t: 160, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
  { t: 161, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 64 } } },
  stream(162, 'loop1', 'rock', 5, 0.9),
  stream(164, 'loop0', 'gnat', 6, 0.35),
  { t: 166, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
  { t: 168, spawn: { enemy: 'interceptor', x: 120 } },
  stream(167, 'loop1', 'gnat', 6, 0.35),
  { t: 169, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 120 } },
  collapse(172, '*'),

  { t: 175, bossWarning: true },
  { t: 179, boss: 'wj_janus' },
];

export const LEVEL: LevelDef = {
  id: 'junction',
  number: 8,
  name: 'WORMHOLE JUNCTION',
  theme: 'junction',
  music: 'junction',
  bossMusic: 'boss2',
  scrollSpeed: 32,
  duration: 250,
  rockTheme: 'ion',
  enemyHpMul: 1.5,
  enemyShotSpeedMul: 1.28,
  guaranteeWeapon: { by: 25, weapon: 'flak' },
  fieldTestWeapon: 'flak',
  bossSalvage: 280,
  podFallbackSalvage: 110,
  schematicOnClear: ['wraith'],
  asteroidField: FIELD,
  timeline: TIMELINE,
};
