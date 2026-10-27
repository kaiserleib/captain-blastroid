import { BAT, ROCKFALL } from '../../../content/levels/warrens';
import type { Pickup } from '../../../sim/types';
import type { World } from '../../../sim/world';

// Per-world Warrens state: where the marked chunks start in the terrain's row
// count, the caged pod and core, pending rock falls, and the bats' shared
// neighbor list. Everything is allocated once per world.

/** A pickup held in the terrain's frame until its gate is shot out. */
export interface Cage {
  pickup: Pickup | null;
  /** Pickup id when taken (pool slots recycle). */
  id: number;
  caged: boolean;
  /** Let go (gate broken, or it reached the release line). */
  freed: boolean;
  /** Spawned or taken this run (each cage fills once). */
  done: boolean;
}

export interface WarrensState {
  /** Chunk id → the terrain row index of its bottom row (`warrens.mark`). */
  readonly marks: Map<string, number>;
  readonly pod: Cage;
  readonly core: Cage;
  /** Pending rock falls: x, seconds left, size (0 small, 1 medium). */
  readonly falls: Float32Array;
  /** The den's scroll stop has landed (scroll 0, arena fixed). */
  denStopped: boolean;
  /** Pool indices of live bats, rebuilt once per tick (`batTick`). */
  readonly bats: Int32Array;
  batCount: number;
  batTick: number;
}

const states = new WeakMap<World, WarrensState>();

function cage(): Cage {
  return { pickup: null, id: -1, caged: false, freed: false, done: false };
}

export function warrensState(w: World): WarrensState {
  let st = states.get(w);
  if (st === undefined) {
    st = {
      marks: new Map(),
      pod: cage(),
      core: cage(),
      falls: new Float32Array(ROCKFALL.maxPending * 3).fill(-1),
      denStopped: false,
      bats: new Int32Array(BAT.maxBats),
      batCount: 0,
      batTick: -1,
    };
    states.set(w, st);
  }
  return st;
}

/** True while the caged pickup is still the one we took. */
export function cageLive(c: Cage): boolean {
  const k = c.pickup;
  return k !== null && k.active && k.id === c.id;
}
