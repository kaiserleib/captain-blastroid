// T16: bosses on a generic multi-part rig; T21: the boss registry. Level 1's
// Rock Hauler registers here; sector bosses register from game/levels/<id>.
import { BOSS_PART_DEFS, ROCK_HAULER } from '../../content/bosses';
import { flags } from '../../debug/flags';
import { registerBossDamage, registerBossDamageScale, registerTargetFilter } from '../../sim/hooks';
import type { System } from '../../sim/world';
import { BOSS_SPRITE_IDS } from './boss.sprites';
import {
  bossDamageHook,
  bossDamageScale,
  bossTargetFilter,
  registerBoss,
  updateBoss,
} from './bossSystem';
import { drawRockHauler } from './draw';
import { RockHauler } from './rockHauler';
import { installBossSandbox, runBossSandbox } from './sandbox';

registerBossDamage(bossDamageHook);
registerBossDamageScale(bossDamageScale);
registerTargetFilter(bossTargetFilter);
registerBoss(ROCK_HAULER.id, {
  create: () => new RockHauler(),
  draw: drawRockHauler,
  displayName: ROCK_HAULER.name,
  parts: BOSS_PART_DEFS,
  spriteIds: BOSS_SPRITE_IDS,
});

export { BOSS_SPRITE_IDS } from './boss.sprites';
export {
  activeBoss,
  attachBoss,
  bossAssistMul,
  bossDamageHook,
  bossDamageScale,
  bossDisplayName,
  bossHp,
  bossIds,
  bossMaxHp,
  bossRegistration,
  bossTargetFilter,
  drawActiveBoss,
  registerBoss,
  setBossToughness,
  spawnBoss,
  updateBoss,
  type BossController,
  type BossRegistration,
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
