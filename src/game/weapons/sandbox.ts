import { WEAPON_MAX_LEVEL, WEAPON_ORDER } from '../../content/weapons';
import type { World } from '../../sim/world';
import { addWeapon, findWeapon, levelWeapon } from './resolvePickup';
import { setWeaponsPreTick } from './weaponSystem';

// `?sandbox`: F1–F5 grant or level one Act I weapon, F6 maxes everything,
// F7–F9 grant or level Arc Coil, Ricochet and Flak. Slot limits are ignored
// so the full loadout can be tested on any ship.

const KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'];
const MAX_ALL = 5;
const queue: number[] = [];

/** Applies one sandbox action (a KEYS index): grant/level that key's weapon, 5 = max all. */
export function sandboxAction(w: World, action: number): void {
  const ids =
    action === MAX_ALL ? WEAPON_ORDER : [WEAPON_ORDER[action < MAX_ALL ? action : action - 1]];
  for (const id of ids) {
    if (id === undefined) continue;
    let inst = findWeapon(w, id);
    if (inst === null) inst = addWeapon(w, id);
    else if (action !== MAX_ALL) levelWeapon(w, inst);
    if (action === MAX_ALL) while (inst.level < WEAPON_MAX_LEVEL) levelWeapon(w, inst);
  }
  const p = w.player;
  if (p.maxWeaponSlots < p.weapons.length) p.maxWeaponSlots = p.weapons.length;
}

function preTick(w: World): void {
  // Until T08's initPlayer hands out the ship's starting weapons.
  if (w.player.weapons.length === 0) addWeapon(w, 'blaster');
  for (let i = 0; i < queue.length; i++) sandboxAction(w, queue[i] as number);
  queue.length = 0;
}

export function installWeaponSandbox(): void {
  setWeaponsPreTick(preTick);
  window.addEventListener('keydown', (e) => {
    const i = KEYS.indexOf(e.key);
    if (i < 0) return;
    // F1 opens help, F5 reloads and F7 toggles caret browsing otherwise.
    e.preventDefault();
    if (!e.repeat) queue.push(i);
  });
}
