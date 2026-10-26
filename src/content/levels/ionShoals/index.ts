import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 2 stub (T21). T27 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `ion_`), registered by game/levels/ionShoals. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'ionShoals',
  number: 2,
  name: 'ION SHOALS',
  theme: 'ion',
  music: 'ion',
  scrollSpeed: 32,
  rockTheme: 'ion',
  enemyHpMul: 1,
  enemyShotSpeedMul: 1.05,
  guaranteeWeapon: { by: 35, weapon: 'spread' },
  bossSalvage: 70,
  podFallbackSalvage: 40,
  schematicOnClear: ['warden', 'dart', 'bulwark'],
  timeline: stubTimeline('ION SHOALS', 3),
};
