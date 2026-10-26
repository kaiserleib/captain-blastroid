import { WEAPON_CONVERT, WEAPON_MAX_LEVEL, WEAPONS, isWeaponId } from '../../content/weapons';
import type { Pickup, WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { emitSfx } from './shots';

export type PickupResult = 'added' | 'leveled' | 'converted';

const addedP = { weaponId: '' };
const leveledP = { weaponId: '', level: 0 };
const toastP = { text: '' };

function toast(w: World, text: string): void {
  toastP.text = text;
  w.events.emit('toast', toastP);
}

function weaponName(id: string): string {
  return isWeaponId(id) ? WEAPONS[id].name : id.toUpperCase();
}

export function findWeapon(w: World, id: string): WeaponInstance | null {
  const list = w.player.weapons;
  for (let i = 0; i < list.length; i++)
    if ((list[i] as WeaponInstance).id === id) return list[i] as WeaponInstance;
  return null;
}

/** Adds `id` at `level` without checking slots. Emits `weaponAdded`, `sfx weapon_up` and a toast. */
export function addWeapon(w: World, id: string, level = 1): WeaponInstance {
  const inst: WeaponInstance = { id, level, cooldown: 0, state: 0 };
  w.player.weapons.push(inst);
  addedP.weaponId = id;
  w.events.emit('weaponAdded', addedP);
  emitSfx(w, 'weapon_up', w.player.x);
  toast(w, `${weaponName(id)} LV${level}`);
  return inst;
}

/** One level up (capped). Emits `weaponLeveled`, `sfx weapon_up` and a toast. */
export function levelWeapon(w: World, inst: WeaponInstance): void {
  if (inst.level >= WEAPON_MAX_LEVEL) return;
  inst.level++;
  leveledP.weaponId = inst.id;
  leveledP.level = inst.level;
  w.events.emit('weaponLeveled', leveledP);
  emitSfx(w, 'weapon_up', w.player.x);
  toast(w, `${weaponName(inst.id)} LV${inst.level}`);
}

/** A pickup that can't add or level anything: salvage plus score. */
export function convertToSalvage(w: World): void {
  const salvage = Math.round(WEAPON_CONVERT.salvage * w.player.stats.salvageMul);
  w.run.salvage += salvage;
  w.run.score += WEAPON_CONVERT.score;
  toast(w, `+${salvage} SALVAGE`);
}

/**
 * Weapon capsule (design.md → Weapon pickup resolution): owned and below max
 * → level up; unowned with a free slot → add at L1; otherwise salvage.
 */
export function applyWeaponPickup(w: World, weaponId: string): PickupResult {
  if (!isWeaponId(weaponId)) {
    convertToSalvage(w);
    return 'converted';
  }
  const inst = findWeapon(w, weaponId);
  if (inst !== null) {
    if (inst.level < WEAPON_MAX_LEVEL) {
      levelWeapon(w, inst);
      return 'leveled';
    }
  } else if (w.player.weapons.length < w.player.maxWeaponSlots) {
    addWeapon(w, weaponId);
    return 'added';
  }
  convertToSalvage(w);
  return 'converted';
}

/** Upgrade core: levels the lowest non-maxed owned weapon (ties → oldest), else salvage. */
export function applyUpgradeCore(w: World): PickupResult {
  const list = w.player.weapons;
  let best: WeaponInstance | null = null;
  for (let i = 0; i < list.length; i++) {
    const inst = list[i] as WeaponInstance;
    if (inst.level < WEAPON_MAX_LEVEL && (best === null || inst.level < best.level)) best = inst;
  }
  if (best === null) {
    convertToSalvage(w);
    return 'converted';
  }
  levelWeapon(w, best);
  return 'leveled';
}

/** `pickupCollected` listener: T12 collects, this resolves weapon and upgrade kinds. */
export function onPickupCollected(w: World, pickup: Pickup): void {
  if (pickup.kind === 'weapon') applyWeaponPickup(w, pickup.payload);
  else if (pickup.kind === 'upgrade') applyUpgradeCore(w);
}

const attached = new WeakSet<World>();

/** Subscribes `w` to weapon/upgrade pickups. Idempotent per world. */
export function attachWeapons(w: World): void {
  if (attached.has(w)) return;
  attached.add(w);
  w.events.on('pickupCollected', (e) => onPickupCollected(w, e.pickup));
}
