import type { LevelDef } from '../types';

export { MINE_P, ROSTER, SKIFF_P, TUG_P } from './roster';
export { SHEPHERD, SHEPHERD_PARTS, type ShepherdDef } from './shepherd';

// Level 2, per docs/design.md → Level 2 "Ion Shoals". Beats:
//   0–12    sparse smalls and a few 4 HP mediums that split
//   8       supply run: a gnat V with a forced Spread capsule
//   14–40   skiff weaves in pairs, the first lone large at 20, a carrier at 32
//   40–70   the first tug pair over a medium-rock band, swoopers from the corners
//   70–75   breather and a shield drop
//   75–110  ion mines sown in lanes, skiffs through them, two tugs flinging larges
//   110–145 escape-pod gauntlet (ionShoals.gauntlet): skiff sweeps from both
//           sides, gunboat pairs at the top edge firing across the pod's path
//   145–175 ion storm: dense rocks (larges weighted), three tugs, gunboats, a magnet
//   176–183 the field clears, warning at 181, the Shepherd at 183

/** Gauntlet length, s; the pod drifts 12 px/s, so it reaches the ship's row about then. */
export const GAUNTLET = {
  /** Seconds the skiff sweeps keep coming. */
  duration: 30,
  /** Seconds between sweeps; sides alternate. */
  every: 4.2,
  /** Skiffs per sweep and the gap between them. */
  count: 3,
  gap: 0.32,
  /** Sweep heading, degrees below horizontal, so each pass dips across the pod's column. */
  dipDeg: 26,
  /** Sweeps enter this far above the pod, clamped to [minY, maxY]. */
  aboveRows: 34,
  minY: 24,
  maxY: 150,
} as const;

const SMALL = { small: 1 } as const;
const SHOALS = { small: 3, medium: 1 } as const;
const BAND = { small: 2, medium: 3, large: 0.25 } as const;
const HAUL = { small: 2, medium: 2, large: 0.7 } as const;

export const LEVEL: LevelDef = {
  id: 'ionShoals',
  number: 2,
  name: 'ION SHOALS',
  theme: 'ion',
  music: 'ion',
  scrollSpeed: 32,
  duration: 245,
  rockTheme: 'ion',
  enemyHpMul: 1,
  enemyShotSpeedMul: 1.05,
  guaranteeWeapon: { by: 35, weapon: 'spread' },
  bossSalvage: 70,
  podFallbackSalvage: 40,
  schematicOnClear: ['warden', 'dart', 'bulwark'],

  asteroidField: [
    { from: 0, to: 12, rate: 0.6, rateTo: 0.9, sizes: { small: 4, medium: 1 }, speed: [14, 30] },
    // Light while the supply formations pass, so rocks don't break them up.
    { from: 12, to: 40, rate: 0.7, rateTo: 1.0, sizes: SHOALS },
    // The medium band the first tugs haul from.
    { from: 40, to: 70, rate: 1.0, rateTo: 1.3, sizes: BAND, speed: [14, 34] },
    { from: 70, to: 76, rate: 0.5, sizes: SMALL },
    { from: 76, to: 110, rate: 0.9, rateTo: 1.2, sizes: HAUL, speed: [14, 34] },
    // The gauntlet keeps the field thin: the pod and its escort are the story.
    { from: 110, to: 145, rate: 0.5, sizes: SHOALS },
    { from: 145, to: 152, rate: 0.8, rateTo: 1.8, sizes: { small: 2, medium: 2, large: 1 } },
    {
      from: 152,
      to: 174,
      rate: 1.8,
      rateTo: 3.0,
      sizes: { small: 3, medium: 3, large: 1.4 },
      speed: [20, 46],
      jitter: 0.7,
    },
    // A diagonal lane of smalls across the storm's peak.
    {
      from: 160,
      to: 174,
      rate: 0.8,
      rateTo: 1.8,
      sizes: { small: 3, medium: 1 },
      angle: [12, 24],
      xRange: [0, 90],
      speed: [36, 60],
    },
    { from: 174, to: 177, rate: 1.5, rateTo: 0.2, sizes: SMALL },
  ],

  timeline: [
    { t: 0.5, toast: 'ION SHOALS' },
    // Two mediums to learn on: four hits each, and they split.
    { t: 3, script: 'ionShoals.rock', args: { size: 'medium', x: 84, vy: 12 } },
    { t: 5.5, script: 'ionShoals.rock', args: { size: 'medium', x: 160, vy: 12 } },

    // Supply run.
    { t: 8, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 }, forceCapsule: 'spread' },
    {
      t: 12,
      formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
      forceCapsule: 'spread',
    },

    // Skiffs, two at a time.
    { t: 15, spawn: { enemy: 'ion_skiff', x: 70 } },
    { t: 16.5, spawn: { enemy: 'ion_skiff', x: 170 } },
    { t: 20, spawn: { enemy: 'ion_skiff', x: 200 } },
    { t: 21.5, spawn: { enemy: 'ion_skiff', x: 100 } },
    { t: 23, script: 'ionShoals.rock', args: { size: 'large', x: 120, vy: 10 } },
    { t: 27, formation: { type: 'column', enemy: 'ion_skiff', count: 4, x: 'rand', delay: 0.3 } },
    { t: 32, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
    { t: 34, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 38, spawn: { enemy: 'ion_skiff', x: 60 } },
    { t: 38, spawn: { enemy: 'ion_skiff', x: 180 } },

    // The first tug pair over the medium band; swoopers from the corners.
    { t: 40, toast: 'TUGS: THEY THROW ROCKS' },
    { t: 41, spawn: { enemy: 'ion_tug', x: 70 } },
    { t: 41, spawn: { enemy: 'ion_tug', x: 170 } },
    { t: 44, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 46, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 50, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 52, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: 56, spawn: { enemy: 'ion_tug', x: 120 } },
    { t: 57, formation: { type: 'column', enemy: 'ion_skiff', count: 4, x: 'rand', delay: 0.3 } },
    { t: 61, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
    { t: 61.3, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.6, times: 2 } },
    { t: 64, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 66, spawn: { enemy: 'ion_skiff', x: 80 } },
    { t: 66, spawn: { enemy: 'ion_skiff', x: 160 } },

    // Breather.
    { t: 71, drop: { kind: 'shield', x: 'rand' } },
    { t: 72.5, drop: { kind: 'upgrade', x: 'rand' } },
    { t: 73, toast: 'ION MINES - SHOOT THEM' },

    // Mines in lanes, skiffs through them, two tugs hauling larges.
    { t: 76, spawn: { enemy: 'ion_mine', x: 50 } },
    { t: 76, spawn: { enemy: 'ion_mine', x: 120 } },
    { t: 76, spawn: { enemy: 'ion_mine', x: 190 } },
    { t: 79, formation: { type: 'column', enemy: 'ion_skiff', count: 4, x: 85, delay: 0.3 } },
    { t: 80, spawn: { enemy: 'ion_mine', x: 85 } },
    { t: 80, spawn: { enemy: 'ion_mine', x: 155 } },
    { t: 83, spawn: { enemy: 'ion_tug', x: 60 } },
    { t: 83.5, spawn: { enemy: 'ion_tug', x: 180 } },
    { t: 86, spawn: { enemy: 'ion_mine', x: 40 } },
    { t: 86, spawn: { enemy: 'ion_mine', x: 120 } },
    { t: 86, spawn: { enemy: 'ion_mine', x: 200 } },
    { t: 89, formation: { type: 'column', enemy: 'ion_skiff', count: 4, x: 155, delay: 0.3 } },
    { t: 92, spawn: { enemy: 'ion_mine', x: 75 } },
    { t: 92, spawn: { enemy: 'ion_mine', x: 165 } },
    { t: 94, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    // A second carrier (not in the design table): the loadout economy needs it, see T27 Notes.
    { t: 95, spawn: { enemy: 'carrier', from: 'right', y: 104 } },
    { t: 97, spawn: { enemy: 'ion_skiff', x: 60 } },
    { t: 97, spawn: { enemy: 'ion_skiff', x: 180 } },
    { t: 99, spawn: { enemy: 'ion_mine', x: 50 } },
    { t: 99, spawn: { enemy: 'ion_mine', x: 120 } },
    { t: 99, spawn: { enemy: 'ion_mine', x: 190 } },
    { t: 101, spawn: { enemy: 'ion_tug', x: 120 } },
    { t: 103, formation: { type: 'stagger', enemy: 'ion_skiff', count: 5, x: 'rand' } },
    { t: 105, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 107, spawn: { enemy: 'interceptor', x: 70 } },
    { t: 107.4, spawn: { enemy: 'interceptor', x: 170 } },

    // Escape-pod gauntlet.
    { t: 110, toast: "ZZ'KAR'S POD - ESCORT IT!", ifNoPod: 'SALVAGE CACHE AHEAD' },
    { t: 111, escapePod: { x: 120, hp: 3 } },
    { t: 112, script: 'ionShoals.gauntlet' },
    { t: 115, spawn: { enemy: 'gunboat', x: 56, overrides: { ay: 36 } } },
    { t: 115, spawn: { enemy: 'gunboat', x: 184, overrides: { ay: 36 } } },
    { t: 125, spawn: { enemy: 'gunboat', x: 64, overrides: { ay: 40 } } },
    { t: 125, spawn: { enemy: 'gunboat', x: 176, overrides: { ay: 40 } } },
    { t: 142, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },

    // Breather and a shield before the storm.
    { t: 144, drop: { kind: 'shield', x: 'rand' } },

    // Ion storm.
    { t: 145, toast: 'ION STORM' },
    { t: 146, spawn: { enemy: 'ion_tug', x: 50 } },
    { t: 147, spawn: { enemy: 'ion_tug', x: 120 } },
    { t: 148, spawn: { enemy: 'ion_tug', x: 190 } },
    { t: 150, drop: { kind: 'magnet', x: 'rand' } },
    { t: 150, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 152, formation: { type: 'column', enemy: 'ion_skiff', count: 5, x: 'rand', delay: 0.3 } },
    { t: 155, spawn: { enemy: 'gunboat', x: 70 } },
    { t: 155, spawn: { enemy: 'gunboat', x: 170, overrides: { ay: 100 } } },
    { t: 159, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },
    { t: 162, spawn: { enemy: 'ion_tug', x: 80 } },
    { t: 162.5, spawn: { enemy: 'ion_tug', x: 160 } },
    { t: 164, formation: { type: 'column', enemy: 'ion_skiff', count: 5, x: 'rand', delay: 0.3 } },
    {
      t: 169,
      formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' },
      repeat: { every: 2, times: 2 },
    },
    { t: 171, formation: { type: 'column', enemy: 'ion_skiff', count: 4, x: 'rand', delay: 0.3 } },

    { t: 181, bossWarning: true },
    { t: 183, boss: 'ion_shepherd' },
  ],
};
