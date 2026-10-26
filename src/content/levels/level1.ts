import type { LevelDef } from './types';

// Level 1, per docs/design.md → Level 1 timeline. Beats:
//   0–16   rocks only (learn to move, one shot pops a rock)
//   16–44  gnat columns/Vs; the first cleared one drops a forced Spread capsule
//   44–74  swoopers from the corners through a dense band (dumb enemies die on rocks); carrier ~60
//   74–78  breather
//   78–109 gunboat pairs; escape pod at 100 with only rammers around it
//   109–114 breather
//   114–145 mixed waves with interceptors, a magnet drop, second carrier at 135
//   145–150 breather + shield gift, storm warning
//   150–176 asteroid storm with gnat swarms; side lanes join at 156/160
//   176–180 the field clears, warning siren at 178, boss at 180

const SMALL = { small: 1 } as const;
const MIXED = { small: 3, medium: 2 } as const;

export const LEVEL1: LevelDef = {
  id: 'kessler',
  number: 1,
  name: 'THE KESSLER BELT',
  theme: 'kessler',
  music: 'level1',
  scrollSpeed: 30,
  duration: 210,
  bossSalvage: 50,
  podFallbackSalvage: 30,
  schematicOnClear: ['bulwark', 'dart'],

  asteroidField: [
    { from: 0, to: 16, rate: 0.6, rateTo: 1.1, sizes: SMALL, speed: [14, 32] },
    // Light while the forced-capsule formations come through, so rocks don't break them.
    { from: 16, to: 44, rate: 0.7, rateTo: 0.9, sizes: { small: 3, medium: 1 } },
    { from: 44, to: 58, rate: 2.0, rateTo: 3.2, sizes: { small: 2, medium: 2 }, speed: [20, 44] },
    { from: 58, to: 74, rate: 1.6, rateTo: 1.0, sizes: MIXED },
    { from: 74, to: 110, rate: 1.0, rateTo: 1.3, sizes: MIXED },
    { from: 110, to: 118, rate: 0.5, sizes: SMALL },
    { from: 118, to: 146, rate: 1.3, rateTo: 1.8, sizes: MIXED },
    { from: 146, to: 152, rate: 1.4, rateTo: 4, sizes: MIXED, speed: [22, 50] },
    {
      from: 152,
      to: 174,
      rate: 4,
      rateTo: 10,
      sizes: { small: 5, medium: 4, large: 0.5 },
      speed: [24, 62],
      jitter: 0.8,
    },
    // Diagonal side lanes cross the main fall for the storm's peak.
    {
      from: 156,
      to: 174,
      rate: 1,
      rateTo: 3,
      sizes: { small: 3, medium: 1 },
      angle: [14, 25],
      xRange: [0, 80],
      speed: [40, 70],
    },
    {
      from: 160,
      to: 174,
      rate: 1,
      rateTo: 3,
      sizes: { small: 3, medium: 1 },
      angle: [-25, -14],
      xRange: [160, 240],
      speed: [40, 70],
    },
    { from: 174, to: 177, rate: 4, rateTo: 0.3, sizes: SMALL },
  ],

  timeline: [
    { t: 0.5, toast: 'THE KESSLER BELT' },

    // Teach: gnats ram, shoot them all for a capsule.
    {
      t: 16,
      formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
      forceCapsule: 'spread',
    },
    {
      t: 22,
      formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
      forceCapsule: 'spread',
    },
    { t: 29, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 }, forceCapsule: 'spread' },
    { t: 35, formation: { type: 'column', enemy: 'gnat', count: 4, x: 60 } },
    { t: 35, formation: { type: 'column', enemy: 'gnat', count: 4, x: 180 } },
    { t: 40, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },

    // Swoopers through the dense band.
    { t: 47, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 51, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 53, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: 56, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 60, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
    { t: 64, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
    { t: 64.3, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.6, times: 2 } },
    { t: 68, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },
    { t: 71, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },

    // Gunboats: smart, weave around rocks.
    { t: 78, spawn: { enemy: 'gunboat', x: 70 } },
    { t: 78, spawn: { enemy: 'gunboat', x: 170 } },
    { t: 84, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 88, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 90, spawn: { enemy: 'gunboat', x: 60, overrides: { ay: 70 } } },
    { t: 90, spawn: { enemy: 'gunboat', x: 180, overrides: { ay: 100 } } },
    { t: 96, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },

    // Escape pod with only rammers around it, so nothing shoots it down (the 90 s
    // gunboats leave at ~96 and their shots clear before the pod arrives).
    { t: 99, toast: 'ESCAPE POD AHEAD', ifNoPod: 'SALVAGE CACHE AHEAD' },
    { t: 100, escapePod: { x: 'rand' } },
    { t: 103, formation: { type: 'column', enemy: 'gnat', count: 4, x: 30 } },
    { t: 103, formation: { type: 'column', enemy: 'gnat', count: 4, x: 210 } },
    { t: 107, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },

    // Mixed waves.
    { t: 114, spawn: { enemy: 'interceptor', x: 80 } },
    { t: 114.4, spawn: { enemy: 'interceptor', x: 160 } },
    { t: 118, spawn: { enemy: 'gunboat', x: 120 } },
    { t: 119, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
    { t: 122, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },
    { t: 124, drop: { kind: 'magnet', x: 'rand' } },
    { t: 126, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 3 } },
    { t: 130, spawn: { enemy: 'gunboat', x: 60 } },
    { t: 130, spawn: { enemy: 'gunboat', x: 180, overrides: { ay: 100 } } },
    { t: 131, formation: { type: 'column', enemy: 'gnat', count: 5, x: 120 } },
    { t: 135, spawn: { enemy: 'carrier', from: 'right', y: 110 } },
    { t: 138, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
    { t: 138.3, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.6, times: 2 } },
    { t: 141, spawn: { enemy: 'interceptor', x: 70 } },
    { t: 141, spawn: { enemy: 'interceptor', x: 170 } },
    { t: 142, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

    // Breather, then the storm.
    { t: 146, drop: { kind: 'shield', x: 'rand' } },
    { t: 147, toast: 'ASTEROID STORM INBOUND' },
    { t: 152, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },
    { t: 155, formation: { type: 'column', enemy: 'gnat', count: 5, x: 40 } },
    { t: 155, formation: { type: 'column', enemy: 'gnat', count: 5, x: 120 } },
    { t: 155, formation: { type: 'column', enemy: 'gnat', count: 5, x: 200 } },
    {
      t: 159,
      formation: { type: 'stagger', enemy: 'gnat', count: 8, x: 'rand' },
      repeat: { every: 1.5, times: 2 },
    },
    { t: 163, formation: { type: 'v', enemy: 'gnat', count: 9, x: 120 } },
    {
      t: 166,
      formation: { type: 'line', enemy: 'gnat', count: 7, x: 120 },
      repeat: { every: 2, times: 3 },
    },
    { t: 171, formation: { type: 'column', enemy: 'gnat', count: 6, x: 'rand' } },
    { t: 171.5, formation: { type: 'column', enemy: 'gnat', count: 6, x: 'rand' } },

    { t: 178, bossWarning: true },
    { t: 180, boss: 'rock_hauler' },
  ],
};
