import {
  WEAPON_MAX_LEVEL,
  WEAPONS,
  type WeaponDef,
  type WeaponId,
  type WeaponLevel,
} from '../../content/weapons';
import type { PlayerState, WeaponInstance } from '../../sim/types';
import type { System, World } from '../../sim/world';
import { fireBlaster } from './blaster';
import { tickDroneContacts, updateDrones } from './drones';
import { fireLance } from './lance';
import { attachWeapons } from './resolvePickup';
import { fireSeeker } from './seeker';
import { emitSfx } from './shots';
import { fireSpread } from './spread';
import { weaponsState } from './state';

export type FireFn = (
  w: World,
  p: PlayerState,
  inst: WeaponInstance,
  lv: WeaponLevel,
  def: WeaponDef,
) => void;

const FIRE: Readonly<Record<Exclude<WeaponId, 'orbitDrones'>, FireFn>> = {
  blaster: fireBlaster,
  spread: fireSpread,
  lance: fireLance,
  seeker: fireSeeker,
};

const DEFS = WEAPONS as Readonly<Record<string, WeaponDef | undefined>>;

/** The level row for an instance, clamping out-of-range levels. Null for unknown ids. */
export function levelOf(inst: WeaponInstance): WeaponLevel | null {
  const def = DEFS[inst.id];
  if (def === undefined) return null;
  const i =
    inst.level < 1 ? 0 : inst.level > WEAPON_MAX_LEVEL ? WEAPON_MAX_LEVEL - 1 : inst.level - 1;
  return def.levels[i] as WeaponLevel;
}

/** Hook for the sandbox (runs first each tick, inside the sim). */
let preTick: ((w: World) => void) | null = null;
export function setWeaponsPreTick(fn: ((w: World) => void) | null): void {
  preTick = fn;
}

export function updateWeapons(w: World, dt: number): void {
  attachWeapons(w);
  if (preTick !== null) preTick(w);
  const s = weaponsState(w);
  s.droneN = 0;
  tickDroneContacts(s, dt);
  const p = w.player;
  if (!p.alive) return;
  const list = p.weapons;
  for (let i = 0; i < list.length; i++) {
    const inst = list[i] as WeaponInstance;
    const def = DEFS[inst.id];
    if (def === undefined) continue;
    const lv = levelOf(inst) as WeaponLevel;
    if (def.id === 'orbitDrones') {
      updateDrones(w, p, inst, lv, dt);
      continue;
    }
    inst.cooldown -= dt * p.stats.fireRateMul;
    if (inst.cooldown > 0) continue;
    FIRE[def.id](w, p, inst, lv, def);
    emitSfx(w, def.sfx, p.x);
    inst.cooldown += lv.cooldown;
    // A huge fireRateMul can't bank shots into a burst.
    if (inst.cooldown < 0) inst.cooldown = 0;
  }
}

/** System slot: after player, before enemies. */
export const weaponSystem: System = { name: 'weapons', update: updateWeapons };
