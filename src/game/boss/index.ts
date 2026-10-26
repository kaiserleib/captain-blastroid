// T16: bosses. Level 1's Rock Hauler, on a generic multi-part rig.
import { BOSS_PART_DEFS } from '../../content/bosses';
import { flags } from '../../debug/flags';
import { registerBossDamage } from '../../sim/hooks';
import { registerEnemyDefs } from '../../sim/spawn';
import type { System } from '../../sim/world';
import './boss.sprites';
import { bossDamageHook, updateBoss } from './bossSystem';
import { installBossSandbox, runBossSandbox } from './sandbox';

registerEnemyDefs(BOSS_PART_DEFS);
registerBossDamage(bossDamageHook);

export { BOSS_SPRITE_IDS } from './boss.sprites';
export {
  activeBoss,
  attachBoss,
  bossDamageHook,
  bossHp,
  bossMaxHp,
  spawnBoss,
  updateBoss,
} from './bossSystem';
export { bossLayer } from './draw';
export { BossRig, type PartSlot } from './parts';
export { clearShotsToSalvage, Phase, RockHauler, type PhaseId } from './rockHauler';

/** Slot: after enemies, before bullets. Under `?sandbox`, K summons the boss. */
export const bossSystem: System = {
  name: 'boss',
  update(w, dt) {
    if (flags.sandbox) {
      installBossSandbox();
      runBossSandbox(w);
    }
    updateBoss(w, dt);
  },
};
