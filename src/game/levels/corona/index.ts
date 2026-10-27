// Sector 6 registrations (T38): roster, behaviors and draws, the placed-cover
// scripts, the Heliostat, and the sandbox keys.
import { HELIOSTAT, HELIOSTAT_PARTS, LEVEL, ROSTER } from '../../../content/levels/corona';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { setFlareImmune } from '../../obstacles';
import { lensBehavior, shadeBehavior, skimmerBehavior } from './behaviors';
import { CO_SPRITE_IDS } from './corona.sprites';
import { drawHeliostat, drawLens, drawShade, drawSkimmer } from './draw';
import { Heliostat } from './heliostat';
import { sandboxLayer } from './sandbox';
import { spawnBand, spawnNearSlab, spawnPodSlab } from './scripts';

registerRoster(ROSTER);
registerBehavior('corona.skimmer', skimmerBehavior);
registerBehavior('corona.shade', shadeBehavior);
registerBehavior('corona.lens', lensBehavior);
registerEnemyDraw('co_sunskimmer', drawSkimmer);
registerEnemyDraw('co_shade', drawShade);
registerEnemyDraw('co_lens', drawLens);
setFlareImmune('co_sunskimmer');

registerBoss(HELIOSTAT.id, {
  create: () => new Heliostat(),
  draw: drawHeliostat,
  displayName: HELIOSTAT.name,
  parts: HELIOSTAT_PARTS,
  spriteIds: CO_SPRITE_IDS,
});

registerLevelScript('corona.band', (w) => {
  spawnBand(w);
});
registerLevelScript('corona.slab', (w, args) => {
  spawnNearSlab(w, typeof args.away === 'number' ? args.away : 0);
});
registerLevelScript('corona.podSlab', (w, args) => {
  spawnPodSlab(w, typeof args.x === 'number' ? args.x : w.width / 2);
});
registerLevelLayer(LEVEL.id, sandboxLayer);

export { Heliostat, HelioPhase } from './heliostat';
