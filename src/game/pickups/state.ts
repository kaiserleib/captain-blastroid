import type { PickupInit } from '../../sim/spawn';
import type { Pickup, PickupKind } from '../../sim/types';
import type { World } from '../../sim/world';

/** Per-world pickup bookkeeping (worlds are recreated on every scene enter). */
export interface PickupState {
  /** Seconds since the last non-salvage pickup dropped (pity timer). */
  sinceItem: number;
  /** Live escape pods as of the last pickups tick; lets the shot blocker bail early. */
  pods: number;
}

const states = new WeakMap<World, PickupState>();

export function getPickupState(w: World): PickupState {
  let s = states.get(w);
  if (s === undefined) {
    s = { sinceItem: 0, pods: 0 };
    states.set(w, s);
  }
  return s;
}

export function isItemKind(kind: PickupKind | 'none'): boolean {
  return kind !== 'none' && kind !== 'salvage';
}

// Shared event payloads and spawn scratch. Payloads are reused: listeners copy.
export const pickupP = { pickup: null as unknown as Pickup };
export const sfxP: { id: string; x?: number } = { id: '', x: 0 };
export const toastP = { text: '' };
export const spawnScratch: PickupInit = { kind: 'salvage', x: 0, y: 0 };

export function emitSfx(w: World, id: string, x: number): void {
  sfxP.id = id;
  sfxP.x = x;
  w.events.emit('sfx', sfxP);
}

export function emitToast(w: World, text: string): void {
  toastP.text = text;
  w.events.emit('toast', toastP);
}
