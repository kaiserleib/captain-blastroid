import type { EnemyDef } from '../../enemies';
import type { AsteroidFieldSegment, EscapeDef, LevelDef, TimelineEvent } from '../types';
import { ASM_SCROLL, ASSEMBLY_SEQUENCE, assemblyOffsets, assemblyRows } from './chunks';
import { CRANE_P, RIVETER_P, SENTINEL_P } from './tuning';

export * from './tuning';
export {
  ASSEMBLY_SEQUENCE,
  CHUNKS,
  ESCAPE_CHUNKS,
  ESCAPE_ENTRY,
  ESCAPE_SCROLL,
  ASM_SCROLL,
  corridorRow,
} from './chunks';

// Level 10, "The Foundry" (T42), per docs/design.md → Level 10. The finale
// remixes every Act II mechanic in Foundry dress. Beats, scroll in brackets:
//   0–40    [30] the yard: Cranes hauling hull scrap, riveter conveyors,
//                Escort Fighters; Lance supply run at 6, carrier at 30
//   40–75   [30] containment: a captive massive hole in a ring of shade slabs,
//                Orbiters, Lancers and Sentinels
//   75–80   breather and a shield
//   80–115  [30 → 60] the welding line: turning pulsars on the beat,
//                Streakers and riveters
//   115–150 [60 → 30] the furnace: flares over shade slabs, the portal
//                conveyor (Wren's pod rides it at 130), Sentinels
//   150–190 [30] assembly: Foundry corridors, slow bubbles in the bends,
//                gates and Cranes in the chambers; magnet at 160
//   194     warning; 200 the Architect; then the 40 s escape

/** Sector enemies (ids `fd_`), registered by game/levels/foundry. Authored at L10 numbers. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  fd_riveter: {
    id: 'fd_riveter',
    name: 'Riveter',
    hp: 2,
    r: 5,
    sprite: 'fd_riveter',
    behavior: { kind: 'custom', behavior: 'foundry.riveter', p: RIVETER_P },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 40,
    salvage: 2,
    dropTable: 'asteroid_small',
  },
  fd_crane: {
    id: 'fd_crane',
    name: 'Crane',
    hp: 12,
    r: 11,
    // Drawn by its registerEnemyDraw: the hook glows before a fling, and the tow beam.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'foundry.crane', p: CRANE_P },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 400,
    salvage: 10,
    dropTable: 'common',
  },
  fd_sentinel: {
    id: 'fd_sentinel',
    name: 'Sentinel',
    hp: 16,
    r: 9,
    // Drawn by its registerEnemyDraw: the hull, the barrel and the shield arc follow its facing.
    sprite: '',
    behavior: { kind: 'custom', behavior: 'foundry.sentinel', p: SENTINEL_P },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 500,
    salvage: 14,
    dropTable: 'common',
  },
};

/**
 * Design → Level 10: 40 s, the scroll 30 → 90 px/s over 6 s, 100 salvage minus 20 a hit.
 * The corridors and debris run from the sector's level system, which starts them on
 * the escape phase (`foundry.escape` is registered too, for when `script` is set here).
 */
export const ESCAPE: EscapeDef = {
  dur: 40,
  scrollTo: 90,
  over: 6,
  bonus: 100,
  bonusPerHit: 20,
};

/** Assembly: the corridors start here; bubbles and Cranes are timed off the chunk rows. */
export const ASSEMBLY_T = 150;

/** Level seconds when assembly row `row` (bottom first) enters at the top edge. */
export function assemblyRowT(row: number): number {
  return ASSEMBLY_T + (row * 8) / ASM_SCROLL;
}

const OFF = assemblyOffsets();
/** Where the slow bubbles park: the outer stretch of each S-bend (row in the chunk, x px). */
const BEND_BUBBLES: readonly (readonly [string, number, number])[] = [
  ['fd_asm_bend_r', 13, 164],
  ['fd_asm_bend_l', 12, 76],
];
/** The chambers' Cranes (row in the chunk, x px). */
const CHAMBER_CRANES: readonly (readonly [string, number, number])[] = [
  ['fd_asm_chamber_a', 8, 70],
  ['fd_asm_chamber_a', 12, 172],
  ['fd_asm_chamber_b', 8, 168],
  ['fd_asm_chamber_b', 12, 72],
];

function assemblyEvents(): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const id of ASSEMBLY_SEQUENCE)
    out.push({ t: ASSEMBLY_T, terrain: { chunk: id, theme: 'foundry' } });
  out.push({
    t: assemblyRowT(assemblyRows()) - 0.5,
    terrain: { chunk: '@clear', theme: 'foundry' },
  });
  for (const [id, row, x] of BEND_BUBBLES) {
    out.push({
      t: round1(assemblyRowT((OFF[id] as number) + row) - 0.6),
      bubble: { kind: 'slow', x, r: 30, ttl: 24 },
    });
  }
  for (const [id, row, x] of CHAMBER_CRANES) {
    out.push({
      t: round1(assemblyRowT((OFF[id] as number) + row)),
      // ax: a shorter hold, so it leaves before the chamber has scrolled past.
      spawn: { enemy: 'fd_crane', x, overrides: { ax: 8 } },
    });
  }
  return out;
}

function round1(t: number): number {
  return Math.round(t * 10) / 10;
}

const SMALL = { small: 1 } as const;
const SCRAP = { small: 4, medium: 1 } as const;
const FURNACE_SCRAP = { small: 2, medium: 2, large: 1 } as const;

const FIELD: readonly AsteroidFieldSegment[] = [
  // The yard: light hull scrap (the Cranes haul the big pieces).
  { from: 0, to: 10, rate: 0.3, rateTo: 0.4, sizes: SMALL, speed: [12, 26] },
  { from: 10, to: 40, rate: 0.35, rateTo: 0.45, sizes: SCRAP },
  { from: 40, to: 74, rate: 0.3, rateTo: 0.4, sizes: SMALL },
  { from: 75, to: 80, rate: 0.2, sizes: SMALL },
  // The welding line: sparks of small scrap in the surge.
  { from: 82, to: 114, rate: 0.5, rateTo: 0.8, sizes: SMALL, speed: [8, 20] },
  // The furnace: large scrap throws shade too.
  { from: 116, to: 148, rate: 0.3, rateTo: 0.4, sizes: FURNACE_SCRAP, speed: [8, 20] },
];

/** Every timeline beat; the assembly events are generated from the chunk rows. */
const TIMELINE: TimelineEvent[] = [
  { t: 0.5, toast: 'THE FOUNDRY' },

  // The yard.
  { t: 3, script: 'foundry.conveyor', args: { y: 112, dir: 1, n: 8 } },
  { t: 6, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' }, forceCapsule: 'lance' },
  {
    t: 10,
    formation: { type: 'column', enemy: 'gnat', count: 4, x: 'rand' },
    forceCapsule: 'lance',
  },
  { t: 12, toast: 'CRANES THROW SCRAP' },
  { t: 12, spawn: { enemy: 'fd_crane', x: 70 } },
  { t: 15, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 176, spacing: 18 } },
  { t: 18, script: 'foundry.conveyor', args: { y: 146, dir: -1, n: 10 } },
  { t: 19.5, spawn: { enemy: 'gunboat', x: 60 } },
  { t: 21, spawn: { enemy: 'fd_crane', x: 172 } },
  { t: 23, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },
  { t: 26, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
  { t: 28, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 2 } },
  { t: 30, spawn: { enemy: 'carrier', from: 'left', y: 100 } },
  { t: 32, script: 'foundry.conveyor', args: { y: 88, dir: 1, n: 12 } },
  { t: 34, spawn: { enemy: 'fd_crane', x: 120 } },
  { t: 36, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 60, spacing: 18 } },
  { t: 38, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 39, spawn: { enemy: 'interceptor', x: 'rand' } },

  // Containment.
  { t: 40, toast: 'CONTAINMENT' },
  { t: 40, script: 'foundry.containment' },
  { t: 43, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 45, script: 'foundry.orbiters', args: { n: 2, dir: 1 } },
  { t: 47, toast: 'SENTINELS: FLANK THE SHIELD' },
  { t: 47, spawn: { enemy: 'fd_sentinel', x: 64 } },
  { t: 50, spawn: { enemy: 'hz_lancer', x: 'rand' } },
  { t: 51, spawn: { enemy: 'hz_lancer', x: 'rand' } },
  { t: 54, script: 'foundry.orbiters', args: { n: 3, dir: -1 } },
  { t: 57, spawn: { enemy: 'fd_sentinel', x: 178 } },
  { t: 59, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
  { t: 62, spawn: { enemy: 'hz_lancer', x: 'rand' } },
  { t: 63, spawn: { enemy: 'hz_lancer', x: 'rand' } },
  { t: 65, script: 'foundry.orbiters', args: { n: 2, dir: 1 } },
  { t: 67, spawn: { enemy: 'fd_sentinel', x: 120 } },
  { t: 69, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 71, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 'rand', spacing: 18 } },
  { t: 74, script: 'foundry.containmentEnd' },

  // Breather.
  { t: 75, drop: { kind: 'shield', x: 'rand' } },
  { t: 76.5, drop: { kind: 'upgrade', x: 'rand' } },

  // The welding line: the surge, pulsars locked to the beat.
  { t: 79, toast: 'WELDING LINE' },
  { t: 80, scroll: { to: 60, over: 4 } },
  { t: 80, script: 'foundry.pulsar', args: { x: 64 } },
  { t: 83, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 83.6, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 85, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 120, spacing: 18 } },
  { t: 86, script: 'foundry.conveyor', args: { y: 70, dir: 1, n: 10 } },
  { t: 88, script: 'foundry.pulsar', args: { x: 176 } },
  { t: 91, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 91.6, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 94, script: 'foundry.conveyor', args: { y: 124, dir: -1, n: 10 } },
  { t: 96, script: 'foundry.pulsar', args: { x: 120 } },
  { t: 97, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 2 } },
  { t: 99, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 101, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 101.6, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 104, script: 'foundry.pulsar', args: { x: 70 } },
  { t: 105, script: 'foundry.conveyor', args: { y: 96, dir: 1, n: 12 } },
  { t: 108, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 108.6, spawn: { enemy: 'pn_streaker', x: 'rand' } },
  { t: 110, script: 'foundry.pulsar', args: { x: 170 } },
  { t: 112, formation: { type: 'line', enemy: 'gnat', count: 5, x: 120 } },

  // The furnace: flares over the slabs first; then the portal conveyor carries
  // Wren's pod down the screen in a flare-free stretch (a flare would burn it),
  // and the Sentinels and escorts come once the pod is off the line.
  { t: 115, scroll: { to: 30, over: 5 } },
  { t: 115, toast: 'THE FURNACE' },
  { t: 115, shadeSlab: { x: 70 } },
  { t: 116, shadeSlab: { x: 170 } },
  { t: 117, script: 'foundry.portals' },
  { t: 118, flares: { every: 8, until: 127 } },
  { t: 120, script: 'foundry.portalLine', args: { n: 8 } },
  { t: 120, shadeSlab: { x: 'rand' }, repeat: { every: 4, times: 3 } },
  { t: 124, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
  { t: 127, script: 'foundry.portalLine', args: { n: 6 } },
  { t: 129.5, toast: 'ESCAPE POD ON THE LINE', ifNoPod: 'SALVAGE CACHE ON THE LINE' },
  // The director spawns the pod (or its cache); the furnace system lifts it onto the line.
  { t: 131, escapePod: { x: 30, hp: 2 } },
  { t: 134, script: 'foundry.portalLine', args: { n: 8 } },
  { t: 139, spawn: { enemy: 'fd_sentinel', x: 64 } },
  { t: 140, shadeSlab: { x: 'rand' }, repeat: { every: 3, times: 2 } },
  { t: 141, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 176, spacing: 18 } },
  { t: 142, flares: { every: 6, until: 147 } },
  { t: 144, spawn: { enemy: 'fd_sentinel', x: 176 } },
  { t: 148, script: 'foundry.furnaceEnd' },

  // Assembly.
  { t: 150, toast: 'ASSEMBLY' },
  ...assemblyEvents(),
  { t: 154, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 120, spacing: 16 } },
  { t: 160, drop: { kind: 'magnet', x: 120 } },
  { t: 168, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 120, spacing: 16 } },
  { t: 175, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 120, spacing: 16 } },
  { t: 182, formation: { type: 'v', enemy: 'ar_escort', count: 3, x: 120, spacing: 16 } },
  { t: 190, drop: { kind: 'upgrade', x: 120 } },

  { t: 194, bossWarning: true },
  { t: 200, boss: 'fd_architect' },
];

TIMELINE.sort((a, b) => a.t - b.t);

export const LEVEL: LevelDef = {
  id: 'foundry',
  number: 10,
  name: 'THE FOUNDRY',
  theme: 'foundry',
  music: 'foundry',
  bossMusic: 'foundry_boss',
  scrollSpeed: 30,
  // 200 s to the boss, a typical fight and the escape.
  duration: 345,
  rockTheme: 'basalt',
  enemyHpMul: 1.6,
  enemyShotSpeedMul: 1.35,
  guaranteeWeapon: { by: 25, weapon: 'lance' },
  bossSalvage: 400,
  podFallbackSalvage: 150,
  schematicOnClear: ['nova'],
  escape: ESCAPE,
  asteroidField: FIELD,
  timeline: TIMELINE,
};
