// Sector 8 registrations (T40): the Wormhole Junction roster and behaviors,
// Janus, the level scripts and system, the junction collision pass (Aegis
// shields, aimed exits, the portal wall) and sandbox keys.
import { JANUS, JANUS_PARTS, ROSTER } from '../../../content/levels/junction';
import { registerCollisionPass } from '../../../sim/hooks';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import {
  aegisBehavior,
  blinkerBehavior,
  drawAegis,
  drawBlinker,
  drawShieldSparks,
  pylonBehavior,
} from './behaviors';
import { Janus } from './janus';
import { drawJanus } from './janus.draw';
import { JANUS_SPRITE_IDS } from './janus.sprites';
import { WJ_SPRITE_IDS } from './junction.sprites';
import { junctionPass } from './pass';
import { installJunctionSandbox } from './sandbox';
import {
  aegisScript,
  collapseScript,
  junctionSystem,
  pairScript,
  pylonScript,
  rushEndScript,
  rushScript,
  streamScript,
} from './scripts';

registerRoster(ROSTER);
registerBehavior('junction.blinker', blinkerBehavior);
registerBehavior('junction.pylon', pylonBehavior);
registerBehavior('junction.aegis', aegisBehavior);
registerEnemyDraw('wj_blinker', drawBlinker);
registerEnemyDraw('wj_aegis', drawAegis);

registerBoss(JANUS.id, {
  create: () => new Janus(),
  draw: drawJanus,
  displayName: JANUS.name,
  parts: JANUS_PARTS,
  spriteIds: [...JANUS_SPRITE_IDS, ...WJ_SPRITE_IDS],
  assistAfter: JANUS.assistAfter,
});

registerCollisionPass(junctionPass);

registerLevelScript('junction.pair', pairScript);
registerLevelScript('junction.collapse', collapseScript);
registerLevelScript('junction.aegis', (w, a) => void aegisScript(w, a));
registerLevelScript('junction.pylon', (w, a) => void pylonScript(w, a));
registerLevelScript('junction.rush', rushScript);
registerLevelScript('junction.rushEnd', rushEndScript);
registerLevelScript('junction.stream', streamScript);
registerLevelSystem('junction', junctionSystem);
registerLevelLayer('junction', {
  name: 'junction.sparks',
  z: 41,
  draw: (w, r) => drawShieldSparks(w, r),
});

installJunctionSandbox();

export { Janus, Phase } from './janus';
export { AegisState, BlinkState, PylonState } from './behaviors';
