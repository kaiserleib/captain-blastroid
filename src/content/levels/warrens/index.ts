import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 7 stub (T32): the shared ~45 s stub ending in the Rock Hauler, with the
// design's tuning numbers. T39 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `wr_`), registered by game/levels/warrens. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'warrens',
  number: 7,
  name: 'THE WARRENS',
  theme: 'warrens',
  music: 'warrens',
  bossMusic: 'boss2',
  scrollSpeed: 26,
  rockTheme: 'basalt',
  enemyHpMul: 1.45,
  enemyShotSpeedMul: 1.25,
  guaranteeWeapon: { by: 25, weapon: 'ricochet' },
  fieldTestWeapon: 'ricochet',
  bossSalvage: 260,
  podFallbackSalvage: 100,
  schematicOnClear: ['ferret'],
  timeline: stubTimeline('THE WARRENS', 1),
};
