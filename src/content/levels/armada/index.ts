import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 5 stub (T21). T30 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `ar_`), registered by game/levels/armada. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'armada',
  number: 5,
  name: 'THE ARMADA',
  theme: 'armada',
  music: 'armada',
  bossMusic: 'armada_boss',
  scrollSpeed: 24,
  rockTheme: 'basalt',
  enemyHpMul: 1.35,
  enemyShotSpeedMul: 1.2,
  guaranteeWeapon: { by: 25, weapon: 'lance' },
  bossSalvage: 150,
  podFallbackSalvage: 80,
  schematicOnClear: ['paragon'],
  timeline: stubTimeline('THE ARMADA', 1),
};
