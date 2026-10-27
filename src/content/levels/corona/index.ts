import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 6 stub (T32): the shared ~45 s stub ending in the Rock Hauler, with the
// design's tuning numbers. T38 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `co_`), registered by game/levels/corona. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'corona',
  number: 6,
  name: 'CORONA DRIFT',
  theme: 'corona',
  music: 'corona',
  bossMusic: 'boss2',
  scrollSpeed: 30,
  rockTheme: 'basalt',
  enemyHpMul: 1.4,
  enemyShotSpeedMul: 1.22,
  guaranteeWeapon: { by: 25, weapon: 'arc' },
  fieldTestWeapon: 'arc',
  bossSalvage: 240,
  podFallbackSalvage: 90,
  schematicOnClear: ['shrike'],
  timeline: stubTimeline('CORONA DRIFT', 1),
};
