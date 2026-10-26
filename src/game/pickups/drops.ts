import {
  CARRIER_DROP_TABLE,
  DEFAULT_ENEMY_DROP_TABLE,
  DROP_TABLES,
  type DropEntry,
  type DropTable,
} from '../../content/dropTables';
import {
  CAPSULE_WEAPON_IDS,
  PICKUP_TUNING,
  SALVAGE_SIZES,
  SCHEMATIC_SHIPS,
} from '../../content/pickups';
import { WEAPON_MAX_LEVEL } from '../../content/weapons';
import type { Rng } from '../../engine/rng';
import { getSave } from '../../meta';
import { getEnemyDef, spawnPickup } from '../../sim/spawn';
import type { Asteroid, Pickup, PickupKind, WeaponInstance } from '../../sim/types';
import type { World } from '../../sim/world';
import { getPickupState, isItemKind, spawnScratch } from './state';

/** Roll filters, combinable. */
export const ROLL_ANY = 0;
/** Player is at max shield: shield cells are re-rolled. */
export const ROLL_NO_SHIELD = 1;
/** Pity: only non-salvage items. */
export const ROLL_ITEMS_ONLY = 2;

function allowed(e: DropEntry, filter: number): boolean {
  if (e.weight <= 0) return false;
  if (filter & ROLL_NO_SHIELD && e.kind === 'shield') return false;
  if (filter & ROLL_ITEMS_ONLY && !isItemKind(e.kind)) return false;
  return true;
}

/**
 * Weighted pick among the entries the filter allows. Excluding an entry is the
 * same distribution as re-rolling until something else comes up. Null if the
 * filter leaves nothing.
 */
export function rollDrop(table: DropTable, rng: Rng, filter = ROLL_ANY): DropEntry | null {
  let total = 0;
  for (let i = 0; i < table.length; i++) {
    const e = table[i] as DropEntry;
    if (allowed(e, filter)) total += e.weight;
  }
  if (total <= 0) return null;
  let x = rng.next() * total;
  let last: DropEntry | null = null;
  for (let i = 0; i < table.length; i++) {
    const e = table[i] as DropEntry;
    if (!allowed(e, filter)) continue;
    x -= e.weight;
    last = e;
    if (x < 0) return e;
  }
  return last;
}

function ownedNonMax(weapons: readonly WeaponInstance[], skip: number): string | null {
  let k = 0;
  for (let i = 0; i < weapons.length; i++) {
    const wi = weapons[i] as WeaponInstance;
    if (wi.level >= WEAPON_MAX_LEVEL || !CAPSULE_WEAPON_IDS.includes(wi.id)) continue;
    if (k++ === skip) return wi.id;
  }
  return null;
}

/** Weapon for a capsule: `ownedWeaponBias` of the time an owned, non-max weapon (if any), else uniform. */
export function pickCapsuleWeapon(rng: Rng, weapons: readonly WeaponInstance[]): string {
  if (rng.next() < PICKUP_TUNING.ownedWeaponBias) {
    let n = 0;
    while (ownedNonMax(weapons, n) !== null) n++;
    if (n > 0) return ownedNonMax(weapons, rng.int(0, n - 1)) as string;
  }
  return CAPSULE_WEAPON_IDS[rng.int(0, CAPSULE_WEAPON_IDS.length - 1)] as string;
}

/** Spawns one pickup, resetting the pity timer for anything but salvage. */
export function spawnDrop(
  w: World,
  kind: PickupKind,
  x: number,
  y: number,
  payload = '',
  amount = 0,
): Pickup | null {
  const o = spawnScratch;
  o.kind = kind;
  o.x = x;
  o.y = y;
  o.vx = 0;
  o.vy = w.scrollSpeed + PICKUP_TUNING.driftExtra;
  o.r = PICKUP_TUNING.r;
  o.payload = payload;
  o.amount = amount;
  o.ttl = PICKUP_TUNING.ttl;
  const p = spawnPickup(w, o);
  if (p !== null && isItemKind(kind)) getPickupState(w).sinceItem = 0;
  return p;
}

export function spawnWeaponCapsule(w: World, x: number, y: number): Pickup | null {
  return spawnDrop(w, 'weapon', x, y, pickCapsuleWeapon(w.rng, w.player.weapons));
}

const MAX_SALVAGE_BITS = 8;

/** Sprays `total` salvage as bits (largest denominations first), each with a small burst. */
export function spraySalvage(w: World, x: number, y: number, total: number): void {
  let left = Math.floor(total);
  let bits = 0;
  for (let s = SALVAGE_SIZES.length - 1; s >= 0 && left > 0; s--) {
    const size = SALVAGE_SIZES[s] as number;
    while (left >= size && bits < MAX_SALVAGE_BITS) {
      // The last allowed bit carries whatever is left so no salvage is lost.
      const amount = bits === MAX_SALVAGE_BITS - 1 ? left : size;
      const p = spawnDrop(w, 'salvage', x, y, '', amount);
      if (p === null) return;
      const a = w.rng.range(0, Math.PI * 2);
      const v = w.rng.range(PICKUP_TUNING.salvageBurstMin, PICKUP_TUNING.salvageBurstMax);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - PICKUP_TUNING.salvageBurstUp;
      left -= amount;
      bits++;
    }
  }
}

/** The first schematic ship not found this run and not already in the save (found or built). */
function nextSchematic(w: World): string | null {
  const save = getSave();
  for (let i = 0; i < SCHEMATIC_SHIPS.length; i++) {
    const id = SCHEMATIC_SHIPS[i] as string;
    if (w.run.schematics.includes(id)) continue;
    if (save.schematics.includes(id) || save.shipsBuilt.includes(id)) continue;
    return id;
  }
  return null;
}

/** Spawns what a rolled entry describes. */
export function spawnEntry(w: World, e: DropEntry, x: number, y: number): void {
  switch (e.kind) {
    case 'none':
      return;
    case 'salvage':
      spraySalvage(w, x, y, e.amount ?? 1);
      return;
    case 'weapon':
      if (e.payload) spawnDrop(w, 'weapon', x, y, e.payload);
      else spawnWeaponCapsule(w, x, y);
      return;
    case 'schematic': {
      const id = e.payload || nextSchematic(w);
      if (id) spawnDrop(w, 'schematic', x, y, id);
      else spraySalvage(w, x, y, SALVAGE_SIZES[SALVAGE_SIZES.length - 1] as number);
      return;
    }
    default:
      spawnDrop(w, e.kind, x, y, e.payload ?? '', e.amount ?? 0);
  }
}

/** Rolls `table` with the global modifiers (pity timer, shield re-roll at max). */
export function rollAndSpawn(w: World, table: DropTable, x: number, y: number): void {
  const p = w.player;
  const st = getPickupState(w);
  let filter = p.shield >= p.maxShield ? ROLL_NO_SHIELD : ROLL_ANY;
  if (st.sinceItem >= PICKUP_TUNING.pityTime) filter |= ROLL_ITEMS_ONLY;
  let e = rollDrop(table, w.rng, filter);
  // A table with no eligible items under pity falls back to the common table.
  if (e === null && filter & ROLL_ITEMS_ONLY) {
    e = rollDrop(DROP_TABLES[DEFAULT_ENEMY_DROP_TABLE] as DropTable, w.rng, filter);
  }
  if (e !== null) spawnEntry(w, e, x, y);
}

/** The optional fields T11's enemy defs add on top of SimEnemyDef. */
interface DropDefFields {
  dropTable?: string;
  salvage?: number;
}

/** Undefined for unknown ids, so a missing def never breaks a kill. */
function dropFields(defId: string): DropDefFields | undefined {
  try {
    return getEnemyDef(defId) as DropDefFields;
  } catch {
    return undefined;
  }
}

export function onEnemyKilled(
  w: World,
  defId: string,
  x: number,
  y: number,
  isBoss: boolean,
): void {
  // Boss rewards are scripted by T15/T16.
  if (isBoss) return;
  const def = dropFields(defId);
  const tableId = def?.dropTable ?? DEFAULT_ENEMY_DROP_TABLE;
  const salvage = def?.salvage ?? 0;
  if (salvage > 0) spraySalvage(w, x, y, salvage);
  if (tableId === CARRIER_DROP_TABLE) {
    spawnWeaponCapsule(w, x, y);
    return;
  }
  const table = DROP_TABLES[tableId] ?? (DROP_TABLES[DEFAULT_ENEMY_DROP_TABLE] as DropTable);
  rollAndSpawn(w, table, x, y);
}

const ASTEROID_TABLE: Readonly<Record<Asteroid['size'], string>> = {
  small: 'asteroid_small',
  medium: 'asteroid_medium',
  large: 'asteroid_large',
};

export function onAsteroidDestroyed(w: World, size: Asteroid['size'], x: number, y: number): void {
  const table = DROP_TABLES[ASTEROID_TABLE[size]];
  if (table !== undefined) rollAndSpawn(w, table, x, y);
}

/**
 * 1942 rule: a wiped-out formation drops a weapon capsule, at most one per
 * `formationCapsuleGap` seconds so a level of ~30 formations doesn't max the
 * rack by midway. Inside the gap the clear sprays a little salvage instead.
 */
export function onFormationCleared(w: World, x: number, y: number): void {
  const st = getPickupState(w);
  if (st.sinceFormationCapsule >= PICKUP_TUNING.formationCapsuleGap) {
    if (spawnWeaponCapsule(w, x, y) !== null) st.sinceFormationCapsule = 0;
  } else if (PICKUP_TUNING.formationBonusSalvage > 0) {
    spraySalvage(w, x, y, PICKUP_TUNING.formationBonusSalvage);
  }
}

/** Subscribes the drop rules to a world's events. */
export function attachDrops(w: World): void {
  w.events.on('enemyKilled', (p) => {
    if (!p.byPlayer) return;
    const e = p.enemy;
    onEnemyKilled(w, e.defId, e.x, e.y, e.isBoss);
  });
  w.events.on('asteroidDestroyed', (p) => {
    if (!p.byPlayer) return;
    const a = p.asteroid;
    onAsteroidDestroyed(w, a.size, a.x, a.y);
  });
  w.events.on('formationCleared', (p) => {
    onFormationCleared(w, p.x, p.y);
  });
}
