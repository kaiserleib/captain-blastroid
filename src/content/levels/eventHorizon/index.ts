import type { EnemyDef } from '../../enemies';
import { STUB_BASE, stubTimeline } from '../stub';
import type { LevelDef } from '../types';

// Sector 3 stub (T21). T28 replaces the field, timeline and roster.

/** Sector enemies (ids prefixed `hz_`), registered by game/levels/eventHorizon. */
export const ROSTER: Readonly<Record<string, EnemyDef>> = {};

export const LEVEL: LevelDef = {
  ...STUB_BASE,
  id: 'eventHorizon',
  number: 3,
  name: 'EVENT HORIZON',
  theme: 'horizon',
  music: 'horizon',
  scrollSpeed: 34,
  rockTheme: 'basalt',
  enemyHpMul: 1.15,
  enemyShotSpeedMul: 1.1,
  guaranteeWeapon: { by: 30, weapon: 'seeker' },
  bossSalvage: 90,
  podFallbackSalvage: 50,
  schematicOnClear: ['corsair'],
  timeline: stubTimeline('EVENT HORIZON', 1, [
    { t: 2, anomaly: { kind: 'blackhole', x: 180, variant: 'small' } },
  ]),
};
