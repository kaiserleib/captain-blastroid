// Sector 9, Chrono Rift (T41): roster behaviors, the Echo, the pod beat and
// the echo-pod layer.
import { ECHO, ECHO_PART_DEFS, LEVEL, ROSTER } from '../../../content/levels/chrono';
import type { System } from '../../../sim/world';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { bubbleMine, missile, rewind, stutter } from './behaviors';
import { CR_SPRITE_IDS } from './chrono.sprites';
import { drawEcho, drawMine, drawMissile, drawRewinder, drawStutterer, echoPodLayer } from './draw';
import { Echo } from './echo';
import { echoPod, updatePod } from './pod';
import { installChronoSandbox } from './sandbox';
import { sweepRecorders } from './state';

registerRoster(ROSTER);

registerBehavior('chrono.stutter', stutter);
registerBehavior('chrono.rewind', rewind);
registerBehavior('chrono.bubbleMine', bubbleMine);
registerBehavior('chrono.missile', missile);
registerEnemyDraw('cr_stutterer', drawStutterer);
registerEnemyDraw('cr_rewinder', drawRewinder);
registerEnemyDraw('cr_bubblemine', drawMine);
registerEnemyDraw('cr_missile', drawMissile);

registerBoss(ECHO.id, {
  create: () => new Echo(),
  draw: drawEcho,
  displayName: ECHO.name,
  parts: ECHO_PART_DEFS,
  spriteIds: CR_SPRITE_IDS,
});

registerLevelScript('chrono.echoPod', echoPod);

const chronoSystem: System = {
  name: 'chrono.pod',
  update(w, dt) {
    sweepRecorders(w);
    updatePod(w, dt);
  },
};

registerLevelSystem(LEVEL.id, chronoSystem);
registerLevelLayer(LEVEL.id, echoPodLayer);

installChronoSandbox();

export { droneCount, Echo, EchoPhase, echoY, selectMirror } from './echo';
export { chronoState } from './state';
