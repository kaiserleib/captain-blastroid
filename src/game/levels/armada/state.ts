import type { World } from '../../../sim/world';

// Per-world Armada state: the pod beat, frigate wrecks (drawn after the hull
// enemy is gone) and the dreadnought (its hull keeps drawing after the fight).

export const MAX_WRECKS = 4;

export interface FrigateWreck {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  flip: boolean;
  t: number;
}

/** The parts of the Leviathan the hull layer and level system need (avoids an import cycle). */
export interface HullView {
  readonly anchorY: number;
  readonly anchorPrevY: number;
  /** True once the fight is over and the wreck drifts off. */
  readonly sunk: boolean;
  /** Seconds since the wreck began drifting (0 while fighting). */
  readonly sunkT: number;
  outro(w: World, dt: number): void;
}

export interface ArmadaState {
  /** The pod ejects from the next frigate wreck. */
  podArmed: boolean;
  /** The pod (or its salvage cache) has appeared. */
  podDone: boolean;
  wrecks: FrigateWreck[];
  hull: HullView | null;
}

const states = new WeakMap<World, ArmadaState>();

export function armadaState(w: World): ArmadaState {
  let s = states.get(w);
  if (s === undefined) {
    const wrecks: FrigateWreck[] = [];
    for (let i = 0; i < MAX_WRECKS; i++) {
      wrecks.push({ active: false, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, flip: false, t: 0 });
    }
    s = { podArmed: false, podDone: false, wrecks, hull: null };
    states.set(w, s);
  }
  return s;
}

/** Records a frigate wreck for the wreck layer (oldest slot reused). */
export function addWreck(w: World, x: number, y: number, vx: number, flip: boolean): void {
  const ws = armadaState(w).wrecks;
  let slot = ws[0] as FrigateWreck;
  for (const k of ws) {
    if (!k.active) {
      slot = k;
      break;
    }
    if (k.t > slot.t) slot = k;
  }
  slot.active = true;
  slot.x = slot.prevX = x;
  slot.y = slot.prevY = y;
  slot.vx = vx;
  slot.flip = flip;
  slot.t = 0;
}
