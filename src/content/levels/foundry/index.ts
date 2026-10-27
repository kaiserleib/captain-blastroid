import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { EscapeDef, LevelDef } from '../types';

// Sector 10 stub (T32): the shared ~45 s stub ending in the Rock Hauler, with the
// design's tuning numbers and the real escape. T42 replaces the field, timeline,
// roster and boss, and adds the escape's terrain script.

/** Sector enemies (ids prefixed `fd_`), registered by game/levels/foundry. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

/** Design → Level 10: 40 s, the scroll 30 → 90 px/s over 6 s, 100 salvage minus 20 a hit. */
export const ESCAPE: EscapeDef = {
  dur: 40,
  scrollTo: 90,
  over: 6,
  bonus: 100,
  bonusPerHit: 20,
};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  duration: 150,
  id: 'foundry',
  number: 10,
  name: 'THE FOUNDRY',
  theme: 'foundry',
  music: 'foundry',
  bossMusic: 'foundry_boss',
  scrollSpeed: 30,
  rockTheme: 'basalt',
  enemyHpMul: 1.6,
  enemyShotSpeedMul: 1.35,
  guaranteeWeapon: { by: 25, weapon: 'lance' },
  bossSalvage: 400,
  podFallbackSalvage: 150,
  schematicOnClear: ['nova'],
  escape: ESCAPE,
  timeline: stubTimeline('THE FOUNDRY', 1),
};
