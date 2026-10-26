// T12: pickups, drop tables, magnet/repulsor, escape pods.
import { registerShotBlocker } from '../../sim/hooks';
import { podShotBlocker } from './escapePod';
import './pickups.sprites';

registerShotBlocker(podShotBlocker);

export {
  attachPickups,
  collectPickup,
  collectRadius,
  pickupsLayer,
  pickupsSystem,
  powerupFxLayer,
  PICKUP_SPRITE_IDS,
} from './pickupSystem';
export { podHp, podOverlayLayer, spawnEscapePod } from './escapePod';
export { pickCapsuleWeapon, rollDrop, spawnDrop, spawnWeaponCapsule, spraySalvage } from './drops';
