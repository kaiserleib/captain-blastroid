// Sector 10, The Foundry (T42): the Riveter, Crane and Sentinel, the remix
// beats' scripts and system, the Architect, the escape run, and the yard,
// containment and sandbox layers.
import {
  ARCHITECT,
  ARCHITECT_PART_DEFS,
  CRANE_P,
  LEVEL,
  RIVETER_P,
  ROSTER,
  SENTINEL_P,
} from '../../../content/levels/foundry';
import { registerCollisionPass } from '../../../sim/hooks';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { Architect } from './architect';
import { drawArchitect } from './architect.draw';
import {
  craneBehavior,
  drawCrane,
  drawSentinel,
  riveterBehavior,
  sentinelBehavior,
  sentinelShieldPass,
} from './behaviors';
import { FD_SPRITE_IDS } from './foundry.sprites';
import { installFoundryDev, sandboxLayer } from './sandbox';
import {
  containmentEndScript,
  containmentLayer,
  containmentScript,
  conveyorScript,
  escapeScript,
  foundrySystem,
  furnaceEndScript,
  gantryLayer,
  orbitersScript,
  portalLineScript,
  portalsScript,
  pulsarScript,
} from './scripts';

registerRoster(ROSTER);
// Typed params come from the content tables; the registry hands them over as plain records.
registerBehavior('foundry.riveter', (w, e, _p, dt) => riveterBehavior(w, e, RIVETER_P, dt));
registerBehavior('foundry.crane', (w, e, _p, dt) => craneBehavior(w, e, CRANE_P, dt));
registerBehavior('foundry.sentinel', (w, e, _p, dt) => sentinelBehavior(w, e, SENTINEL_P, dt));
registerEnemyDraw('fd_crane', drawCrane);
registerEnemyDraw('fd_sentinel', drawSentinel);
registerCollisionPass(sentinelShieldPass);

registerBoss(ARCHITECT.id, {
  create: () => new Architect(),
  draw: drawArchitect,
  displayName: ARCHITECT.name,
  parts: ARCHITECT_PART_DEFS,
  spriteIds: FD_SPRITE_IDS,
  // Three forms: the stall breaker waits 150 s instead of 90 (design.md, Act II difficulty curve).
  assistAfter: 150,
});

registerLevelScript('foundry.conveyor', conveyorScript);
registerLevelScript('foundry.portalLine', portalLineScript);
registerLevelScript('foundry.containment', containmentScript);
registerLevelScript('foundry.containmentEnd', containmentEndScript);
registerLevelScript('foundry.orbiters', orbitersScript);
registerLevelScript('foundry.pulsar', pulsarScript);
registerLevelScript('foundry.portals', portalsScript);
registerLevelScript('foundry.furnaceEnd', furnaceEndScript);
registerLevelScript('foundry.escape', escapeScript);
registerLevelSystem(LEVEL.id, foundrySystem);
registerLevelLayer(LEVEL.id, gantryLayer);
registerLevelLayer(LEVEL.id, containmentLayer);
registerLevelLayer(LEVEL.id, sandboxLayer);

installFoundryDev();

export { Architect, ArchPhase } from './architect';
export { CraneState, SentinelState } from './behaviors';
