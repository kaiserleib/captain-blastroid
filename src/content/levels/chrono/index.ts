import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 9 stub (T32): the shared ~45 s stub ending in the Rock Hauler, with the
// design's tuning numbers. T41 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `cr_`), registered by game/levels/chrono. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'chrono',
  number: 9,
  name: 'CHRONO RIFT',
  theme: 'rift',
  // The chrono sector's song is `rift` (WAVE8-NOTES).
  music: 'rift',
  bossMusic: 'boss2',
  scrollSpeed: 30,
  rockTheme: 'kessler',
  enemyHpMul: 1.55,
  enemyShotSpeedMul: 1.3,
  guaranteeWeapon: { by: 25, weapon: 'spread' },
  bossSalvage: 300,
  podFallbackSalvage: 120,
  schematicOnClear: ['revenant'],
  timeline: stubTimeline('CHRONO RIFT', 1),
};
