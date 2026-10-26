// Sector 3 registrations (T28): roster and behaviors, Perihelion, level
// scripts, the massive-hole system and the buoy-field and sandbox layers.
import {
  BUOY_P,
  LANCER_P,
  ORBITER_P,
  PERIHELION,
  PERIHELION_PART_DEFS,
  ROSTER,
} from '../../../content/levels/eventHorizon';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { buoyBehavior, lanceBehavior, orbitBehavior } from './behaviors';
import { buoyFieldLayer, drawLancer } from './draw';
import { Perihelion } from './perihelion';
import { drawPerihelion } from './perihelion.draw';
import { PERI_SPRITE_IDS } from './perihelion.sprites';
import { sandboxLayer } from './sandbox';
import { collapseHoles, massiveSystem, spawnMassive, spawnOrbiters } from './scripts';
import './eventHorizon.sprites';

const LEVEL_ID = 'eventHorizon';

registerRoster(ROSTER);
// Typed params come from the defs; the registry hands them over as plain records.
registerBehavior('eventHorizon.orbit', (w, e, _p, dt) => orbitBehavior(w, e, ORBITER_P, dt));
registerBehavior('eventHorizon.lance', (w, e, _p, dt) => lanceBehavior(w, e, LANCER_P, dt));
registerBehavior('eventHorizon.buoy', (w, e, _p, dt) => buoyBehavior(w, e, BUOY_P, dt));
registerEnemyDraw('hz_lancer', drawLancer);

registerBoss(PERIHELION.id, {
  create: () => new Perihelion(),
  draw: drawPerihelion,
  displayName: PERIHELION.name,
  parts: PERIHELION_PART_DEFS,
  spriteIds: PERI_SPRITE_IDS,
});

registerLevelScript('eventHorizon.orbiters', (w, args) => void spawnOrbiters(w, args));
registerLevelScript('eventHorizon.massive', spawnMassive);
registerLevelScript('eventHorizon.collapse', collapseHoles);
registerLevelSystem(LEVEL_ID, massiveSystem);
registerLevelLayer(LEVEL_ID, buoyFieldLayer);
registerLevelLayer(LEVEL_ID, sandboxLayer);

export { Perihelion, PeriPhase, Dive } from './perihelion';
export { Lance, Orbit } from './behaviors';
