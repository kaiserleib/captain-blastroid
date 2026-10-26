import type { EnemyDef } from '../../enemies';
import type { LevelDef } from '../types';
import { FRIGATE, MINE } from './tuning';

export * from './tuning';

// Level 5, "The Armada" (T30), per docs/design.md → Level 5. Beats:
//   0–8     the fleet on the horizon, sparse hull debris
//   5       supply run: a forced Lance capsule (Lance pierces fighter lines)
//   10–40   escort fighter wings and gnat screens; the first frigate at 30
//   40–70   minelayers sowing lanes, interceptors; a carrier at 55
//   70–75   breather and a shield
//   75–110  a frigate pair crossing opposite ways, with wings; the pod ejects
//           from the first wreck of the pair, or drifts in at 105
//   110–145 everything at once; a magnet at 120
//   142–145 warning, "DREADNOUGHT BELOW", the hull begins (armada_boss)

/** Sector enemies, registered by game/levels/armada. Authored at L5 numbers (no enemyHpMul). */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  ar_escort: {
    id: 'ar_escort',
    name: 'Escort Fighter',
    hp: 3,
    r: 7,
    sprite: 'ar_escort',
    // Dives in on an outward arc to `holdY`, then strafes off the far side,
    // holding fire after `cease` s (two volleys a pass).
    behavior: {
      kind: 'custom',
      behavior: 'armada.escort',
      p: { dive: 125, holdY: 80, arc: 46, strafe: 105, sink: 14, stagger: 0.4, cease: 2.2 },
    },
    fire: {
      // The aimed pair: two rounds down the same line, 0.14 s apart.
      pattern: {
        kind: 'burst',
        count: 2,
        interval: 0.14,
        inner: { kind: 'aimed', n: 1, spreadDeg: 0, speed: 80 },
      },
      firstDelay: 1.3,
      interval: 1.6,
      bullet: 's',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 150,
    salvage: 5,
    dropTable: 'common',
  },
  ar_minelayer: {
    id: 'ar_minelayer',
    name: 'Minelayer',
    hp: 8,
    r: 11,
    sprite: 'ar_minelayer',
    behavior: {
      kind: 'custom',
      behavior: 'armada.minelayer',
      p: { speed: 36, every: 1.5, first: 0.9, edge: 14 },
    },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 250,
    salvage: 8,
    dropTable: 'common',
  },
  ar_mine: {
    id: 'ar_mine',
    name: 'Ion Mine',
    hp: 3,
    r: 5,
    // Drawn by its registerEnemyDraw: the lamp frame follows the fuse.
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'armada.mine',
      p: {
        fuse: MINE.fuse,
        trigger: MINE.trigger,
        arm: MINE.arm,
        warn: MINE.warn,
        n: MINE.n,
        speed: MINE.speed,
      },
    },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 60,
    salvage: 3,
    dropTable: 'common',
  },
  ar_missile: {
    id: 'ar_missile',
    name: 'Homing Missile',
    hp: 1,
    r: 3,
    // Drawn rotated by its registerEnemyDraw.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'armada.homing', p: { turn: 1.6, speed: 70, ttl: 4 } },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 20,
    salvage: 0,
    // Mostly nothing: a stream of missiles mustn't become a shield farm.
    dropTable: 'asteroid_small',
  },
  // The frigate's hull is the roster entry; its behavior carries the turret rig.
  // isBoss routes hits through the damage hook (armor until both turrets fall)
  // and keeps cleanup from culling it at the side entry. The HUD bar counts
  // isBoss parts only during a bossSpawned fight, and no frigate outlives 145 s.
  ar_frigate: {
    id: 'ar_frigate',
    name: 'Frigate',
    hp: FRIGATE.hullHp,
    r: FRIGATE.hullR,
    sprite: '',
    behavior: { kind: 'custom', behavior: 'armada.frigate', p: { speed: FRIGATE.speed } },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 1500,
    salvage: FRIGATE.salvage,
    dropTable: 'carrier',
    isBoss: true,
  },
};

const SMALL = { small: 1 } as const;
const DEBRIS = { small: 6, medium: 1 } as const;

export const LEVEL: LevelDef = {
  id: 'armada',
  number: 5,
  name: 'THE ARMADA',
  theme: 'armada',
  music: 'armada',
  bossMusic: 'armada_boss',
  scrollSpeed: 24,
  duration: 235,
  rockTheme: 'basalt',
  enemyHpMul: 1.35,
  enemyShotSpeedMul: 1.2,
  guaranteeWeapon: { by: 25, weapon: 'lance' },
  bossSalvage: 220,
  podFallbackSalvage: 80,
  schematicOnClear: ['paragon'],

  // Basalt hull debris, light: the fleet is the hazard here, not the rocks.
  asteroidField: [
    { from: 0, to: 10, rate: 0.3, rateTo: 0.45, sizes: SMALL, speed: [12, 28] },
    { from: 10, to: 40, rate: 0.4, rateTo: 0.5, sizes: SMALL },
    { from: 40, to: 70, rate: 0.45, rateTo: 0.6, sizes: DEBRIS },
    { from: 70, to: 76, rate: 0.3, sizes: SMALL },
    { from: 76, to: 110, rate: 0.45, rateTo: 0.55, sizes: SMALL },
    { from: 110, to: 140, rate: 0.5, rateTo: 0.7, sizes: DEBRIS },
    { from: 140, to: 143, rate: 0.5, rateTo: 0.1, sizes: SMALL },
  ],

  timeline: [
    { t: 0.5, toast: 'THE ARMADA' },

    // Supply run: Lance pierces the fighter lines to come.
    { t: 5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' }, forceCapsule: 'lance' },
    {
      t: 11,
      formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' },
      forceCapsule: 'lance',
    },

    // Escort wings and gnat screens.
    { t: 15, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 64, spacing: 18 } },
    { t: 19, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 22, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 176, spacing: 18 } },
    { t: 26, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },

    // The first frigate.
    { t: 30, toast: 'FRIGATE' },
    { t: 30, spawn: { enemy: 'ar_frigate', from: 'left', y: 68 } },
    { t: 33, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 36, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
    { t: 38.5, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },

    // Minelayers sow lanes; interceptors hunt through them.
    { t: 41, spawn: { enemy: 'ar_minelayer', from: 'right', y: 40 } },
    { t: 44, spawn: { enemy: 'interceptor', x: 70 } },
    { t: 44.4, spawn: { enemy: 'interceptor', x: 170 } },
    { t: 47, spawn: { enemy: 'ar_minelayer', from: 'left', y: 54 } },
    { t: 50, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
    { t: 53, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 55, spawn: { enemy: 'carrier', from: 'left', y: 100 } },
    { t: 58, spawn: { enemy: 'ar_minelayer', from: 'right', y: 38 } },
    { t: 59, spawn: { enemy: 'interceptor', x: 'rand' } },
    { t: 62, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 60, spacing: 18 } },
    { t: 63, formation: { type: 'v', enemy: 'gnat', count: 5, x: 180 } },
    // T31: one interceptor here, not a pair (novice deaths clustered at 45–75 s).
    { t: 66, spawn: { enemy: 'interceptor', x: 120 } },
    { t: 67, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },

    // Breather.
    { t: 71, drop: { kind: 'shield', x: 'rand' } },

    // The frigate pair; Commodore Vale's pod ejects from the first wreck.
    { t: 74, toast: 'FRIGATES INBOUND' },
    { t: 75, script: 'armada.podArm' },
    { t: 76, spawn: { enemy: 'ar_frigate', from: 'left', y: 74 } },
    { t: 76, spawn: { enemy: 'ar_frigate', from: 'right', y: 116 } },
    { t: 80, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
    { t: 84, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 86, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 90, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 176, spacing: 18 } },
    { t: 94, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
    { t: 94.3, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
    { t: 99, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
    { t: 100, spawn: { enemy: 'carrier', from: 'right', y: 96 } },
    { t: 104, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 105, script: 'armada.podFallback' },
    { t: 108, drop: { kind: 'shield', x: 'rand' } },

    // Everything at once.
    { t: 110, spawn: { enemy: 'ar_minelayer', from: 'left', y: 40 } },
    { t: 111, spawn: { enemy: 'gunboat', x: 70 } },
    { t: 113, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 176, spacing: 18 } },
    { t: 116, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 118, spawn: { enemy: 'gunboat', x: 170, overrides: { ay: 96 } } },
    { t: 118.5, spawn: { enemy: 'interceptor', x: 'rand' } },
    { t: 120, drop: { kind: 'magnet', x: 'rand' } },
    { t: 122, spawn: { enemy: 'ar_minelayer', from: 'right', y: 48 } },
    { t: 123, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
    { t: 126, spawn: { enemy: 'gunboat', x: 60 } },
    { t: 126, spawn: { enemy: 'gunboat', x: 180, overrides: { ay: 100 } } },
    { t: 129, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.6, times: 2 } },
    { t: 132, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 60, spacing: 18 } },
    { t: 132.5, formation: { type: 'column', enemy: 'gnat', count: 5, x: 180 } },
    { t: 135, spawn: { enemy: 'ar_minelayer', from: 'left', y: 44 } },
    { t: 136, spawn: { enemy: 'interceptor', x: 80 } },
    { t: 136, spawn: { enemy: 'interceptor', x: 160 } },
    { t: 138, formation: { type: 'stagger', enemy: 'gnat', count: 6, x: 'rand' } },

    // The field clears, a shield for the hull, the warning, then the dreadnought.
    { t: 140, drop: { kind: 'shield', x: 'rand' } },
    { t: 141, drop: { kind: 'upgrade', x: 'rand' } },
    { t: 142, bossWarning: true },
    { t: 145, toast: 'DREADNOUGHT BELOW' },
    { t: 145, boss: 'ar_leviathan' },
  ],
};
