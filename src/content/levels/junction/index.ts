import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 8 stub (T32): the shared ~45 s stub ending in the Rock Hauler, with the
// design's tuning numbers. T40 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `wj_`), registered by game/levels/junction. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'junction',
  number: 8,
  name: 'WORMHOLE JUNCTION',
  theme: 'junction',
  music: 'junction',
  bossMusic: 'boss2',
  scrollSpeed: 32,
  rockTheme: 'ion',
  enemyHpMul: 1.5,
  enemyShotSpeedMul: 1.28,
  guaranteeWeapon: { by: 25, weapon: 'flak' },
  fieldTestWeapon: 'flak',
  bossSalvage: 280,
  podFallbackSalvage: 110,
  schematicOnClear: ['wraith'],
  timeline: stubTimeline('WORMHOLE JUNCTION', 1),
};
