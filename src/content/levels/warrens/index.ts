import type { EnemyDef } from '../../enemies';
import type { LevelDef, TimelineEvent } from '../types';
import { FORK } from './chunks';
import { BAT, BORER, CAGE, TURRET } from './tuning';

export * from './chunks';
export * from './tuning';

// Level 7, "The Warrens" (T39), per docs/design.md → Level 7. The first
// terrain sector: chunk entry times are in chunks.ts. Beats:
//   0–14    open space in front of the asteroid's face, a few rocks
//   6       supply run: a gnat column with a forced Ricochet capsule (field test)
//   15      the cave mouth closes in, "THE WARRENS"; scroll 30 → 26
//   15–40   the wide tunnel with wall turrets; bats at 30; the chamber's carrier at 33
//   40–70   the narrows (scroll 22): gate rows, "SHOOT THE GATES", borers
//   70–75   the breather chamber and a shield
//   75–110  the fork: turrets and Rook's alcove left, gates and an upgrade core right
//   110–145 the crush: S-bends at 26 → 34, bats and borers, a magnet at 120
//   145–172 the collapse (34 → 26): crumbly walls, rock falls, gunboats in chambers
//   176     warning; the den's floor reaches the bottom edge and the scroll stops at ~180

/** Sector enemies, registered by game/levels/warrens. Authored at L7 numbers (no enemyHpMul). */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  wr_turret: {
    id: 'wr_turret',
    name: 'Wall Turret',
    hp: TURRET.hp,
    r: TURRET.r,
    // Base and barrel are drawn by its registerEnemyDraw (the barrel tracks the ship).
    sprite: '',
    behavior: { kind: 'custom', behavior: 'warrens.turret', p: {} },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: TURRET.score,
    salvage: TURRET.salvage,
    dropTable: 'common',
  },
  wr_borer: {
    id: 'wr_borer',
    name: 'Borer',
    hp: BORER.hp,
    r: BORER.r,
    // Drawn by its registerEnemyDraw: hidden in the rock while the plume telegraphs.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'warrens.borer', p: {} },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: BORER.score,
    salvage: BORER.salvage,
    dropTable: 'common',
  },
  wr_bat: {
    id: 'wr_bat',
    name: 'Cave Bat',
    hp: BAT.hp,
    r: BAT.r,
    sprite: 'wr_bat',
    behavior: { kind: 'custom', behavior: 'warrens.bat', p: {} },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: BAT.score,
    salvage: BAT.salvage,
    // Flocks of a dozen 1-HP bats mustn't become a shield farm.
    dropTable: 'asteroid_small',
  },
};

const OPEN = { small: 3, medium: 1 } as const;
const THEME = 'warrens';

/** Queues a chunk; `mark` first records where it starts (the fork's cages, the den's stop). */
function chunk(t: number, id: string, mark = false): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ t, terrain: { chunk: id, theme: THEME } }];
  if (mark) ev.unshift({ t, script: 'warrens.mark', args: { chunk: id } });
  return ev;
}

function bats(t: number, n: number, x: number): TimelineEvent {
  return { t, script: 'warrens.bats', args: { n, x } };
}

function borer(t: number, from: 'left' | 'right', y: number): TimelineEvent {
  return { t, spawn: { enemy: 'wr_borer', from, y } };
}

export const LEVEL: LevelDef = {
  id: 'warrens',
  number: 7,
  name: 'THE WARRENS',
  theme: 'warrens',
  music: 'warrens',
  bossMusic: 'boss2',
  scrollSpeed: 30,
  duration: 250,
  rockTheme: 'basalt',
  enemyHpMul: 1.45,
  enemyShotSpeedMul: 1.35,
  guaranteeWeapon: { by: 25, weapon: 'ricochet' },
  fieldTestWeapon: 'ricochet',
  bossSalvage: 260,
  podFallbackSalvage: 100,
  schematicOnClear: ['ferret'],

  // Rocks only out in the open: tunnels break them on their walls.
  asteroidField: [
    { from: 0, to: 12, rate: 0.5, rateTo: 0.8, sizes: OPEN, speed: [12, 30] },
    { from: 12, to: 15, rate: 0.6, rateTo: 0.1, sizes: { small: 1 } },
  ],

  timeline: [
    // Open space in front of the asteroid's face.
    { t: 0.5, toast: 'THE WARRENS AHEAD' },
    { t: 1.5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 3.5, formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' } },
    // Supply run: Ricochet's field test (discs bounce off the walls ahead).
    {
      t: 6,
      formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' },
      forceCapsule: 'ricochet',
    },
    { t: 8.5, spawn: { enemy: 'interceptor', x: 'rand' } },
    { t: 9, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
    { t: 11, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
    { t: 13, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },

    // The cave mouth.
    ...chunk(15, 'wr_mouth'),
    ...chunk(15, 'wr_tunnel'),
    { t: 15, toast: 'THE WARRENS' },
    { t: 15, scroll: { to: 26, over: 2 } },

    // The wide tunnel: wall turrets, then the first bats.
    { t: 19, formation: { type: 'column', enemy: 'gnat', count: 4, x: 120 } },
    { t: 21, spawn: { enemy: 'gunboat', x: 120 } },
    { t: 23, spawn: { enemy: 'interceptor', x: 120 } },
    ...chunk(25, 'wr_chamber', true),
    { t: 26, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
    { t: 28, formation: { type: 'line', enemy: 'gnat', count: 4, x: 120 } },
    bats(30, 10, 120),
    { t: 32, formation: { type: 'column', enemy: 'gnat', count: 4, x: 150 } },
    // The chamber opens to the left edge; the carrier crosses it.
    { t: 33.5, spawn: { enemy: 'carrier', from: 'left', y: 100 } },
    { t: 35, formation: { type: 'column', enemy: 'gnat', count: 5, x: 90 } },
    { t: 37.5, spawn: { enemy: 'interceptor', x: 80 } },

    // The narrows: gates and borers.
    ...chunk(39, 'wr_narrows'),
    { t: 40, scroll: { to: 22, over: 3 } },
    bats(40.5, 8, 116),
    { t: 42, formation: { type: 'column', enemy: 'gnat', count: 4, x: 116 } },
    { t: 47, spawn: { enemy: 'interceptor', x: 116 } },
    { t: 49, toast: 'SHOOT THE GATES' },
    borer(50, 'left', 120),
    { t: 51.5, formation: { type: 'column', enemy: 'gnat', count: 4, x: 116 } },
    borer(53, 'right', 90),
    { t: 55, formation: { type: 'column', enemy: 'gnat', count: 4, x: 116 } },
    { t: 57.5, spawn: { enemy: 'interceptor', x: 116 } },
    borer(60, 'left', 150),
    borer(61.5, 'right', 110),
    { t: 62.5, formation: { type: 'column', enemy: 'gnat', count: 4, x: 116 } },
    bats(64, 8, 116),
    { t: 66, formation: { type: 'column', enemy: 'gnat', count: 4, x: 116 } },
    borer(67, 'left', 100),
    borer(68.5, 'right', 140),

    // Breather.
    ...chunk(69, 'wr_rest'),
    { t: 70, scroll: { to: 26, over: 2 } },
    { t: 72, drop: { kind: 'shield', x: 120 } },
    { t: 73, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 } },
    { t: 74.5, spawn: { enemy: 'gunboat', x: 120 } },

    // The fork. Left: turrets and Rook's alcove. Right: gates and an upgrade core.
    ...chunk(74, 'wr_fork', true),
    { t: 78, formation: { type: 'column', enemy: 'gnat', count: 4, x: 176 } },
    { t: 80, formation: { type: 'column', enemy: 'gnat', count: 4, x: 52 } },
    { t: 82, spawn: { enemy: 'interceptor', x: 176 } },
    { t: 84, formation: { type: 'column', enemy: 'gnat', count: 4, x: 52 } },
    bats(86, 8, 120),
    { t: 88, formation: { type: 'column', enemy: 'gnat', count: 4, x: 176 } },
    { t: 90, formation: { type: 'column', enemy: 'gnat', count: 4, x: 52 } },
    { t: 91, spawn: { enemy: 'gunboat', x: 176 } },
    { t: 93, spawn: { enemy: 'interceptor', x: 176 } },
    // Rook's pod: the cage script takes it into the alcove as the pocket's row arrives.
    { t: 96, escapePod: { x: FORK.podX, hp: CAGE.podHp } },
    { t: 97, toast: 'POD BEHIND THE GATE', ifNoPod: 'CACHE BEHIND THE GATE' },
    { t: 99, formation: { type: 'v', enemy: 'gnat', count: 3, x: 176 } },
    { t: 96, spawn: { enemy: 'interceptor', x: 52 } },
    { t: 102, spawn: { enemy: 'interceptor', x: 52 } },
    { t: 103.5, formation: { type: 'column', enemy: 'gnat', count: 4, x: 176 } },
    { t: 106, formation: { type: 'column', enemy: 'gnat', count: 4, x: 120 } },

    // The crush: S-bends, faster scroll, bats and borers.
    ...chunk(110, 'wr_sbends'),
    { t: 110, scroll: { to: 34, over: 6 } },
    bats(112, 10, 120),
    borer(116, 'left', 120),
    borer(119, 'right', 160),
    { t: 120, drop: { kind: 'magnet', x: 120 } },
    { t: 122, spawn: { enemy: 'interceptor', x: 'rand' } },
    bats(125, 12, 120),
    { t: 127, spawn: { enemy: 'interceptor', x: 'rand' } },
    borer(128, 'left', 100),
    borer(129.5, 'right', 150),
    { t: 131, spawn: { enemy: 'gunboat', x: 120 } },
    { t: 132, spawn: { enemy: 'interceptor', x: 'rand' } },
    bats(135, 10, 120),
    { t: 137, spawn: { enemy: 'interceptor', x: 'rand' } },
    borer(138, 'right', 120),
    borer(139.5, 'left', 170),
    bats(141, 10, 120),
    { t: 142, spawn: { enemy: 'interceptor', x: 'rand' } },

    // The collapse: crumbly walls, rock falls, gunboats holding in the chambers.
    ...chunk(138, 'wr_collapse'),
    { t: 145, scroll: { to: 26, over: 6 } },
    { t: 145.5, spawn: { enemy: 'gunboat', x: 120 } },
    { t: 146, script: 'warrens.rockfall', repeat: { every: 1.5, times: 17 } },
    bats(150, 8, 120),
    { t: 151, spawn: { enemy: 'interceptor', x: 120 } },
    borer(153, 'left', 110),
    { t: 156.5, spawn: { enemy: 'gunboat', x: 90 } },
    { t: 157, spawn: { enemy: 'gunboat', x: 150, overrides: { ay: 96 } } },
    { t: 160, spawn: { enemy: 'interceptor', x: 120 } },
    bats(163, 8, 120),
    borer(166, 'right', 130),

    // The den. Its floor reaches the bottom edge and the scroll brakes to 0 (~180 s).
    ...chunk(162, 'wr_den', true),
    { t: 172, drop: { kind: 'shield', x: 120 } },
    { t: 176, bossWarning: true },
    { t: 180, boss: 'wr_wyrm' },
  ],
};
