import { ARC_CHAIN_RANGE, type WeaponDef, type WeaponLevel } from '../../content/weapons';
import { damageEnemy } from '../../sim/damage';
import { getSpatialHash } from '../../sim/spatialHash';
import { isTargetable } from '../../sim/targeting';
import {
  Layer,
  type Body,
  type Enemy,
  type PlayerState,
  type WeaponInstance,
} from '../../sim/types';
import type { World } from '../../sim/world';
import { NOSE_Y } from './shots';
import { MAX_ARC_TARGETS, weaponsState, type WeaponsState } from './state';

// Filter context for SpatialHash.nearest (hoisted, so a fire allocates nothing).
let fw: World;
let fs: WeaponsState;

/** Targetable and not already in this arc. */
function unhit(b: Body): boolean {
  if (!isTargetable(fw, b as Enemy)) return false;
  const ids = fs.arcIds;
  for (let i = 0; i < fs.arcN - 1; i++) if (ids[i] === b.id) return false;
  return true;
}

/**
 * Writes the arc into the weapon state: the emitter, the nearest targetable
 * enemy within `range` of the ship, then each next-nearest enemy within
 * ARC_CHAIN_RANGE of the previous link that the arc hasn't hit. Returns the
 * number of targets (0 = nothing in range). No damage is dealt.
 */
export function traceArc(w: World, x: number, y: number, range: number, links: number): number {
  const s = weaponsState(w);
  const h = getSpatialHash(w);
  fw = w;
  fs = s;
  s.arcN = 1;
  s.arcX[0] = x;
  s.arcY[0] = y;
  const max = links < MAX_ARC_TARGETS ? links : MAX_ARC_TARGETS;
  let cx = x;
  let cy = y;
  let reach = range;
  for (let k = 0; k < max; k++) {
    const e = h.nearest(cx, cy, Layer.Enemy, reach, unhit);
    if (e === null) break;
    s.arcIds[k] = e.id;
    s.arcX[s.arcN] = e.x;
    s.arcY[s.arcN] = e.y;
    s.arcN++;
    cx = e.x;
    cy = e.y;
    reach = ARC_CHAIN_RANGE;
  }
  return s.arcN - 1;
}

function enemyAt(w: World, id: number): Enemy | null {
  const items = w.enemies.items;
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (e.id === id) return e.active ? e : null;
  }
  return null;
}

/**
 * Instant chain hit; ignores geometry. Holds its charge (returns false) while
 * nothing is in range, so the coil fires the moment an enemy comes close.
 */
export function fireArc(
  w: World,
  p: PlayerState,
  _inst: WeaponInstance,
  lv: WeaponLevel,
  _def: WeaponDef,
): boolean {
  const n = traceArc(w, p.x, p.y + NOSE_Y, lv.range, 1 + lv.chain);
  if (n === 0) return false;
  const s = weaponsState(w);
  s.arcTick = w.tick;
  const dmg = lv.damage * p.stats.damageMul;
  // Trace first, then damage: a kill mid-chain can't reshape the arc.
  for (let k = 0; k < n; k++) {
    const e = enemyAt(w, s.arcIds[k] as number);
    if (e !== null) damageEnemy(w, e, dmg, 'player');
  }
  return true;
}
