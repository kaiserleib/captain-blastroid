// Sector 2 registrations (T27): the Ion Shoals roster and behaviors, the
// Shepherd, the level scripts and the gauntlet system, and sandbox keys.
import { MINE_P, ROSTER, SHEPHERD, SHEPHERD_PARTS } from '../../../content/levels/ionShoals';
import { registerBoss } from '../../boss';
import { registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { drawMine, drawTug, mineBehavior, skiffBehavior, tugBehavior } from './behaviors';
import { gauntletScript, gauntletSystem, rockScript } from './gauntlet';
import './ionShoals.sprites';
import { installIonSandbox } from './sandbox';
import { Shepherd } from './shepherd';
import { drawShepherd } from './shepherd.draw';
import { SHEP_SPRITE_IDS } from './shepherd.sprites';
import { ION_SPRITE_IDS } from './ionShoals.sprites';

registerRoster(ROSTER);
registerBehavior('ion.tug', tugBehavior);
registerBehavior('ion.skiff', skiffBehavior);
registerBehavior('ion.mine', mineBehavior);
registerEnemyDraw('ion_tug', drawTug);
registerEnemyDraw('ion_mine', (w, r, e, x, y) => drawMine(w, r, e, x, y, MINE_P));

registerBoss(SHEPHERD.id, {
  create: () => new Shepherd(),
  draw: drawShepherd,
  displayName: SHEPHERD.name,
  parts: SHEPHERD_PARTS,
  spriteIds: [...SHEP_SPRITE_IDS, ...ION_SPRITE_IDS],
});

registerLevelScript('ionShoals.gauntlet', gauntletScript);
registerLevelScript('ionShoals.rock', rockScript);
registerLevelSystem('ionShoals', gauntletSystem);

installIonSandbox();

export { Phase, Shepherd, Slot } from './shepherd';
export { MineState, SkiffState, TugState } from './behaviors';
