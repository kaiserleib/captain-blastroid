import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 4 stub (T21). T29 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `pn_`), registered by game/levels/pulsarNursery. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'pulsarNursery',
  number: 4,
  name: 'PULSAR NURSERY',
  theme: 'pulsar',
  music: 'pulsar',
  scrollSpeed: 28,
  rockTheme: 'ion',
  enemyHpMul: 1.25,
  enemyShotSpeedMul: 1.15,
  guaranteeWeapon: { by: 30, weapon: 'spread' },
  bossSalvage: 110,
  podFallbackSalvage: 60,
  schematicOnClear: ['halcyon'],
  timeline: stubTimeline('PULSAR NURSERY', 1, [
    { t: 2, anomaly: { kind: 'pulsar', x: 120, variant: 'steady' } },
    { t: 22, toast: 'CURRENT SURGE' },
    { t: 22, scroll: { to: 70, over: 3 } },
    { t: 30, scroll: { to: 28, over: 3 } },
  ]),
};
