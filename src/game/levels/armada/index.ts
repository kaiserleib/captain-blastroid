// Sector 5, The Armada (T30): roster behaviors, the frigate mid-boss, the
// Dreadnought Leviathan, the pod scripts, and the hull and wreck layers.
import {
  FRIGATE_PART_DEFS,
  LEVEL,
  LEVIATHAN,
  LEVIATHAN_PART_DEFS,
  ROSTER,
} from '../../../content/levels/armada';
import { registerBossDamage, registerTargetFilter } from '../../../sim/hooks';
import { registerEnemyDefs } from '../../../sim/spawn';
import type { System } from '../../../sim/world';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { AR_SPRITE_IDS } from './armada.sprites';
import { escort, homing, mine, minelayer } from './behaviors';
import {
  drawLeviathan,
  drawMine,
  drawMissile,
  hullLayer,
  sunkLayer,
  WRECK_LIFE,
  wreckLayer,
} from './draw';
import { drawFrigate, frigateBehavior, frigateDamage, frigateTargetFilter } from './frigate';
import { Leviathan } from './leviathan';
import { podArm, podFallback } from './pod';
import { installArmadaSandbox } from './sandbox';
import { armadaState } from './state';

registerRoster(ROSTER);
registerEnemyDefs(FRIGATE_PART_DEFS);

registerBehavior('armada.escort', escort);
registerBehavior('armada.minelayer', minelayer);
registerBehavior('armada.mine', mine);
registerBehavior('armada.homing', homing);
registerBehavior('armada.frigate', frigateBehavior);
registerEnemyDraw('ar_frigate', drawFrigate);
registerEnemyDraw('ar_missile', drawMissile);
registerEnemyDraw('ar_mine', drawMine);
registerBossDamage(frigateDamage);
registerTargetFilter(frigateTargetFilter);

registerBoss(LEVIATHAN.id, {
  create: () => new Leviathan(),
  draw: drawLeviathan,
  displayName: LEVIATHAN.name,
  parts: LEVIATHAN_PART_DEFS,
  spriteIds: AR_SPRITE_IDS,
});

registerLevelScript('armada.podArm', podArm);
registerLevelScript('armada.podFallback', podFallback);

/** Frigate wrecks sink and fade; the dreadnought's wreck drifts off after the kill. */
const armadaSystem: System = {
  name: 'armada.wrecks',
  update(w, dt) {
    const st = armadaState(w);
    for (const k of st.wrecks) {
      if (!k.active) continue;
      k.t += dt;
      k.prevX = k.x;
      k.prevY = k.y;
      k.x += k.vx * dt;
      k.y += (w.scrollSpeed + 10) * dt;
      if (k.t >= WRECK_LIFE) k.active = false;
    }
    st.hull?.outro(w, dt);
  },
};

registerLevelSystem(LEVEL.id, armadaSystem);
registerLevelLayer(LEVEL.id, hullLayer);
registerLevelLayer(LEVEL.id, wreckLayer);
registerLevelLayer(LEVEL.id, sunkLayer);

installArmadaSandbox();

export { Leviathan, LevPhase } from './leviathan';
