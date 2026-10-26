import type { World } from '../../sim/world';

/** Upper bound on drones in orbit (content may not exceed it). */
export const MAX_DRONES = 8;
/** Enemies tracked for the per-enemy drone contact tick. */
export const MAX_CONTACTS = 32;

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
