import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// Level 3, per docs/design.md → Level 3 "Event Horizon". Black holes bend
// every bullet, the player's too. Beats:
//   0–12    a `small` hole down the right third; the supply-run columns fly
//           beside it, so the first shots the player fires visibly curve
//   13–45   a slow `standard` hole on the left; swoopers and gnats past it,
//           the first Orbiters circle it; carrier at 40
//   45–80   two holes (left and right), interceptors between them, first Lancers
//   80–85   breather + shield
//   85–118  Gravity Buoys in lines of three, gunboats firing through their fields;
//           Sable's pod (2 HP) drifts between two small holes at 100
//   119–157 a `massive` hole settles mid-screen and sways; Orbiter rings,
//           Lancer volleys of 3, magnet at 130
//   157–176 "event storm": rock lanes aimed at the massive hole, gnat swarms
//   176     every hole collapses; warning at 178; Perihelion at 182
//
// Holes that must linger for a beat get a slow vy (behind the scroll, like the
// nebula layer); `vy` 0 would pin them, which only the boss arena wants.

export { ROSTER, ORBITER_P, LANCER_P, BUOY_P } from './roster';
export { PERIHELION, PERIHELION_PART_DEFS, type PerihelionDef } from './perihelion';

/** Level-script knobs (game/levels/eventHorizon reads these). */
export const HZ_SCRIPTS = {
  /** Orbiters spawn this far outside their orbit and spiral in. */
  orbiterEntryExtra: 24,
  /** A spawn slot this close to the player moves to the far side of the hole. */
  orbiterSpawnClear: 60,
  /** The massive hole falls at scroll speed, settles to `settleVy` below `settleY`. */
  massive: { variant: 'massive', settleY: 92, settleVy: 1.5, sway: 6, swayPeriod: 16 },
  /** Seconds every non-boss hole takes to collapse before the boss. */
  collapse: 1,
} as const;

const SMALL = { small: 1 } as const;
const SPARSE = { small: 4, medium: 1 } as const;
const STORM = { small: 3, medium: 2 } as const;

const FIELD: readonly AsteroidFieldSegment[] = [
  { from: 0, to: 14, rate: 0.4, rateTo: 0.6, sizes: SMALL, speed: [12, 28] },
  { from: 14, to: 80, rate: 0.35, rateTo: 0.5, sizes: SPARSE },
  { from: 80, to: 86, rate: 0.3, sizes: SMALL },
  { from: 86, to: 118, rate: 0.4, rateTo: 0.5, sizes: SPARSE },
  { from: 118, to: 157, rate: 0.4, rateTo: 0.6, sizes: SPARSE },
  // Event storm: lanes aimed at the massive hole. The center lane falls slowly
  // and mostly gets swallowed; the side lanes swing past it.
  {
    from: 157,
    to: 175,
    rate: 0.5,
    rateTo: 1,
    sizes: STORM,
    xRange: [10, 60],
    angle: [10, 18],
    speed: [24, 40],
  },
  {
    from: 157,
    to: 175,
    rate: 0.5,
    rateTo: 1,
    sizes: STORM,
    xRange: [180, 230],
    angle: [-18, -10],
    speed: [24, 40],
  },
  {
    from: 159,
    to: 175,
    rate: 0.6,
    rateTo: 1.6,
    sizes: { small: 2, medium: 1, large: 0.4 },
    xRange: [100, 140],
    angle: [-4, 4],
    speed: [8, 20],
  },
  { from: 175, to: 177, rate: 0.8, rateTo: 0.2, sizes: SMALL },
];

const LANCER_VOLLEY = (t: number, xs: readonly [number, number, number]): TimelineEvent[] => [
  { t, spawn: { enemy: 'hz_lancer', x: xs[0] } },
  { t: t + 0.4, spawn: { enemy: 'hz_lancer', x: xs[1] } },
  { t: t + 0.8, spawn: { enemy: 'hz_lancer', x: xs[2] } },
];

const TIMELINE: TimelineEvent[] = [
  { t: 0.5, toast: 'EVENT HORIZON' },
  { t: 1, anomaly: { kind: 'blackhole', x: 186, variant: 'small' } },
  { t: 3.5, toast: 'GRAVITY BENDS EVERY SHOT' },

  // Supply run beside the hole: Seekers home, and homing plus gravity is fun.
  {
    t: 6,
    formation: { type: 'column', enemy: 'gnat', count: 5, x: 112 },
    forceCapsule: 'seeker',
  },
  {
    t: 10,
    formation: { type: 'v', enemy: 'gnat', count: 5, x: 88 },
    forceCapsule: 'seeker',
  },

  // A slow standard hole on the left; swoopers and gnats past it, Orbiters on it.
  { t: 13, anomaly: { kind: 'blackhole', x: 66, variant: 'standard', vy: 11 } },
  { t: 15, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
  { t: 19, script: 'eventHorizon.orbiters', args: { x: 66, n: 2, dir: 1 } },
  { t: 21, formation: { type: 'column', enemy: 'gnat', count: 5, x: 150 } },
  { t: 24, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
  { t: 28, script: 'eventHorizon.orbiters', args: { x: 66, n: 3, dir: -1 } },
  { t: 30, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 34, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
  { t: 37, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 160 } },
  { t: 40, spawn: { enemy: 'carrier', from: 'right', y: 84 } },
  { t: 42, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },

  // Two holes at once; interceptors and the first Lancers between them.
  { t: 45, anomaly: { kind: 'blackhole', x: 50, variant: 'standard', vy: 10 } },
  { t: 45, anomaly: { kind: 'blackhole', x: 190, variant: 'standard', vy: 10 } },
  { t: 47, spawn: { enemy: 'interceptor', x: 120 } },
  { t: 51, spawn: { enemy: 'hz_lancer', x: 96 } },
  { t: 54, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
  { t: 56, spawn: { enemy: 'hz_lancer', x: 150 } },
  { t: 58, script: 'eventHorizon.orbiters', args: { x: 190, n: 2, dir: 1 } },
  { t: 60, spawn: { enemy: 'interceptor', x: 120 } },
  { t: 63, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 120 } },
  { t: 64, script: 'eventHorizon.orbiters', args: { x: 50, n: 2, dir: -1 } },
  { t: 66, spawn: { enemy: 'hz_lancer', x: 80 } },
  { t: 66.6, spawn: { enemy: 'hz_lancer', x: 160 } },
  { t: 69, formation: { type: 'column', enemy: 'gnat', count: 5, x: 120 } },
  { t: 74, spawn: { enemy: 'hz_lancer', x: 120 } },
  { t: 76, formation: { type: 'v', enemy: 'gnat', count: 7, x: 'rand' } },

  // Breather.
  { t: 81, drop: { kind: 'shield', x: 120 } },

  // Gravity Buoys warp the lanes; gunboat fans curve through their fields.
  { t: 85, spawn: { enemy: 'hz_buoy', x: 60 } },
  { t: 85, spawn: { enemy: 'hz_buoy', x: 120 } },
  { t: 85, spawn: { enemy: 'hz_buoy', x: 180 } },
  { t: 87.5, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 76 } } },
  { t: 92, formation: { type: 'column', enemy: 'gnat', count: 4, x: 30 } },
  { t: 92, formation: { type: 'column', enemy: 'gnat', count: 4, x: 210 } },

  // Sable's pod drifts between two small holes, with only rammers around it.
  { t: 96, anomaly: { kind: 'blackhole', x: 42, variant: 'small', vy: 18 } },
  { t: 96, anomaly: { kind: 'blackhole', x: 198, variant: 'small', vy: 18 } },
  { t: 99, toast: "SABLE'S POD AHEAD", ifNoPod: 'SALVAGE CACHE AHEAD' },
  { t: 100, escapePod: { x: 120, hp: 2 } },
  { t: 102, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
  { t: 105, formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' } },
  { t: 108, spawn: { enemy: 'hz_buoy', x: 52 } },
  { t: 108, spawn: { enemy: 'hz_buoy', x: 188 } },
  { t: 111, spawn: { enemy: 'gunboat', x: 120, overrides: { ay: 70 } } },
  { t: 114, spawn: { enemy: 'hz_lancer', x: 60 } },
  { t: 114.5, spawn: { enemy: 'hz_lancer', x: 180 } },
  { t: 116, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },

  // The massive hole: Orbiter rings, Lancer volleys.
  { t: 119, script: 'eventHorizon.massive', args: { x: 120 } },
  { t: 125, script: 'eventHorizon.orbiters', args: { x: 120, n: 4, dir: 1 } },
  ...LANCER_VOLLEY(128, [60, 120, 180]),
  { t: 130, drop: { kind: 'magnet', x: 'rand' } },
  { t: 133, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
  { t: 136, formation: { type: 'column', enemy: 'gnat', count: 5, x: 28 } },
  { t: 136, formation: { type: 'column', enemy: 'gnat', count: 5, x: 212 } },
  { t: 139, script: 'eventHorizon.orbiters', args: { x: 120, n: 4, dir: -1 } },
  { t: 143, spawn: { enemy: 'hz_lancer', x: 200 } },
  { t: 143.5, spawn: { enemy: 'hz_lancer', x: 40 } },
  { t: 146, spawn: { enemy: 'interceptor', x: 70 } },
  { t: 146, spawn: { enemy: 'interceptor', x: 170 } },
  { t: 149, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
  { t: 151, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 153, script: 'eventHorizon.orbiters', args: { x: 120, n: 3, dir: 1 } },
  { t: 155, spawn: { enemy: 'hz_lancer', x: 80 } },
  { t: 155.5, spawn: { enemy: 'hz_lancer', x: 160 } },

  // Event storm.
  { t: 157, toast: 'EVENT STORM' },
  { t: 160, formation: { type: 'v', enemy: 'gnat', count: 7, x: 120 } },
  { t: 163, formation: { type: 'column', enemy: 'gnat', count: 6, x: 36 } },
  { t: 163, formation: { type: 'column', enemy: 'gnat', count: 6, x: 204 } },
  {
    t: 166,
    formation: { type: 'stagger', enemy: 'gnat', count: 8, x: 'rand' },
    repeat: { every: 1.5, times: 2 },
  },
  {
    t: 170,
    formation: { type: 'line', enemy: 'gnat', count: 7, x: 120 },
    repeat: { every: 2, times: 2 },
  },
  { t: 173, formation: { type: 'column', enemy: 'gnat', count: 6, x: 'rand' } },

  { t: 176, script: 'eventHorizon.collapse' },
  { t: 178, bossWarning: true },
  { t: 182, boss: 'hz_perihelion' },
];

export const LEVEL: LevelDef = {
  id: 'eventHorizon',
  number: 3,
  name: 'EVENT HORIZON',
  theme: 'horizon',
  music: 'horizon',
  scrollSpeed: 34,
  duration: 250,
  rockTheme: 'basalt',
  enemyHpMul: 1.15,
  enemyShotSpeedMul: 1.1,
  guaranteeWeapon: { by: 30, weapon: 'seeker' },
  bossSalvage: 120,
  podFallbackSalvage: 50,
  schematicOnClear: ['corsair'],
  asteroidField: FIELD,
  timeline: TIMELINE,
};
