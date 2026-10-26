// Sector 4 registrations (T29): roster, behaviors and draws, the garden and
// streaker scripts, Magnetar, and the sandbox keys.
import { LEVEL, MAGNETAR, MAGNETAR_PARTS, ROSTER } from '../../../content/levels/pulsarNursery';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { droneBehavior, rayBehavior, streakerBehavior } from './behaviors';
import { drawDrone, drawMagnetar, drawRay, drawStreaker } from './draw';
import { gardenSystem, startGarden, streakerScript } from './garden';
import { Magnetar } from './magnetar';
import { PN_SPRITE_IDS } from './pulsarNursery.sprites';
import { sandboxLayer } from './sandbox';

registerRoster(ROSTER);
registerBehavior('pulsarNursery.drone', droneBehavior);
registerBehavior('pulsarNursery.streaker', streakerBehavior);
registerBehavior('pulsarNursery.ray', rayBehavior);
registerEnemyDraw('pn_drone', drawDrone);
registerEnemyDraw('pn_streaker', drawStreaker);
registerEnemyDraw('pn_ray', drawRay);

registerBoss(MAGNETAR.id, {
  create: () => new Magnetar(),
  draw: drawMagnetar,
  displayName: MAGNETAR.name,
  parts: MAGNETAR_PARTS,
  spriteIds: PN_SPRITE_IDS,
});

registerLevelScript('pulsarNursery.garden', startGarden);
registerLevelScript('pulsarNursery.streakers', (w, args) => {
  streakerScript(w, typeof args.n === 'number' ? args.n : 1);
});
registerLevelSystem(LEVEL.id, gardenSystem);
registerLevelLayer(LEVEL.id, sandboxLayer);

export { Magnetar, MagPhase } from './magnetar';
export { gardenPulsars } from './garden';
