import { flags } from '../../debug/flags';
import { registerShotBlocker } from '../../sim/hooks';
import { droneBlocker } from './drones';
import { installWeaponSandbox } from './sandbox';
import './weapons.sprites';

export { weaponSystem, updateWeapons, levelOf } from './weaponSystem';
export { playerShotsLayer, dronesLayer } from './draw';
export {
  applyWeaponPickup,
  applyUpgradeCore,
  attachWeapons,
  addWeapon,
  levelWeapon,
  findWeapon,
  type PickupResult,
} from './resolvePickup';
export { droneBlocker } from './drones';
export { pickSeekerTarget } from './seeker';
export { sandboxAction } from './sandbox';

/** Sprite ids to `warm()` at scene load. */
export const WEAPON_SPRITE_IDS: readonly string[] = [
  'pbullet_blaster',
  'pbullet_blaster5',
  'pbullet_spread',
  'pbullet_spread5',
  'pbullet_lance',
  'pbullet_lance_w',
  'pbullet_lance5',
  'pbullet_seeker',
  'pbullet_seeker5',
  'drone',
  'drone5',
  'icon_blaster',
  'icon_spread',
  'icon_lance',
  'icon_seeker',
  'icon_orbitDrones',
];

registerShotBlocker(droneBlocker);
if (flags.sandbox && typeof window !== 'undefined') installWeaponSandbox();
