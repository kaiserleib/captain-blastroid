import type { World } from '../../sim/world';

/** Upper bound on drones in orbit (content may not exceed it). */
export const MAX_DRONES = 8;
/** Enemies tracked for the per-enemy drone contact tick. */
export const MAX_CONTACTS = 32;

/** Arc polyline points: the emitter plus up to this many targets. */
export const MAX_ARC_TARGETS = 8;
/** Flak shells in flight (L5 fires 2 per 1.1 s, each lives 0.6 s). */
export const MAX_SHELLS = 8;
/** Burst rings remembered for drawing. */
export const MAX_BURSTS = 8;

/** Per-world weapon state that doesn't belong on the World contract. */
export interface WeaponsState {
  /** Drones placed this tick; 0 while the player is dead or has none. */
  droneN: number;
  droneR: number;
  droneX: Float64Array;
  droneY: Float64Array;
  /** Enemy id per contact slot, -1 = free. */
  contactId: Int32Array;
  /** Seconds until that enemy can be hit by a drone again. */
  contactT: Float64Array;
  /** Seconds until the next drone spark. */
  sparkT: number;
  /** Which drone fires the next spark (round robin, so they're staggered). */
  sparkNext: number;

  /** Last arc: points (emitter first), enemy ids hit, and the tick it fired (-1 = none). */
  arcN: number;
  arcX: Float64Array;
  arcY: Float64Array;
  arcIds: Int32Array;
  arcTick: number;

  /** Flak shells, slot-indexed; `shellOn` 0 = free. */
  shellOn: Uint8Array;
  shellX: Float64Array;
  shellY: Float64Array;
  shellPX: Float64Array;
  shellPY: Float64Array;
  shellVX: Float64Array;
  shellVY: Float64Array;
  /** Seconds to the timed burst. */
  shellT: Float64Array;
  /** Level row index (0-based) the shell was fired at. */
  shellLv: Uint8Array;

  /** Burst rings, a ring buffer: center, erase radius, tick. */
  burstX: Float64Array;
  burstY: Float64Array;
  burstR: Float64Array;
  burstTick: Float64Array;
  burstNext: number;
}

const states = new WeakMap<World, WeaponsState>();
let lastWorld: World | null = null;
let lastState: WeaponsState | null = null;

function create(): WeaponsState {
  return {
    droneN: 0,
    droneR: 0,
    droneX: new Float64Array(MAX_DRONES),
    droneY: new Float64Array(MAX_DRONES),
    contactId: new Int32Array(MAX_CONTACTS).fill(-1),
    contactT: new Float64Array(MAX_CONTACTS),
    sparkT: 0,
    sparkNext: 0,
    arcN: 0,
    arcX: new Float64Array(MAX_ARC_TARGETS + 1),
    arcY: new Float64Array(MAX_ARC_TARGETS + 1),
    arcIds: new Int32Array(MAX_ARC_TARGETS),
    arcTick: -1,
    shellOn: new Uint8Array(MAX_SHELLS),
    shellX: new Float64Array(MAX_SHELLS),
    shellY: new Float64Array(MAX_SHELLS),
    shellPX: new Float64Array(MAX_SHELLS),
    shellPY: new Float64Array(MAX_SHELLS),
    shellVX: new Float64Array(MAX_SHELLS),
    shellVY: new Float64Array(MAX_SHELLS),
    shellT: new Float64Array(MAX_SHELLS),
    shellLv: new Uint8Array(MAX_SHELLS),
    burstX: new Float64Array(MAX_BURSTS),
    burstY: new Float64Array(MAX_BURSTS),
    burstR: new Float64Array(MAX_BURSTS),
    burstTick: new Float64Array(MAX_BURSTS).fill(-Infinity),
    burstNext: 0,
  };
}

export function weaponsState(w: World): WeaponsState {
  // The shot blocker asks once per enemy shot; skip the WeakMap on repeats.
  if (w === lastWorld) return lastState as WeaponsState;
  let s = states.get(w);
  if (s === undefined) {
    s = create();
    states.set(w, s);
  }
  lastWorld = w;
  lastState = s;
  return s;
}
