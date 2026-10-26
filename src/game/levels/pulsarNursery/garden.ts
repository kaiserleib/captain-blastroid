import {
  GARDEN,
  lockedPhase,
  STREAKER_MIN_SCROLL,
  VARIANT_PERIOD,
} from '../../../content/levels/pulsarNursery';
import { pinAnomaly } from '../../../sim/scroll';
import type { Anomaly } from '../../../sim/types';
import type { System, World } from '../../../sim/world';
import { directorTime } from '../../director';
import { collapseAnomaly, spawnPulsar } from '../../obstacles';
import { spawnStreakers } from './behaviors';

// The garden (110–145 s): three pulsars glide in from the top and settle in a
// triangle, creeping down slowly, until GARDEN.releaseAt burns them out. They
// are pinned so the scroll changes don't move them; this system writes their
// vy every tick instead.

interface GardenState {
  armed: boolean;
  t0: number;
  released: boolean;
  slots: (Anomaly | null)[];
  ids: number[];
}

const states = new WeakMap<World, GardenState>();
const PLACE = { vx: 0, vy: 0, variant: '', phase: 0 };
const ENTRY_Y = -8;

function stateOf(w: World): GardenState {
  let s = states.get(w);
  if (s === undefined) {
    s = {
      armed: false,
      t0: 0,
      released: false,
      slots: GARDEN.slots.map(() => null),
      ids: GARDEN.slots.map(() => -1),
    };
    states.set(w, s);
  }
  return s;
}

/** Level script `pulsarNursery.garden`. */
export function startGarden(w: World): void {
  const s = stateOf(w);
  s.armed = true;
  s.released = false;
  s.t0 = directorTime(w);
  for (let i = 0; i < s.slots.length; i++) {
    s.slots[i] = null;
    s.ids[i] = -1;
  }
}

/** The garden's live pulsars (tests and the sandbox). */
export function gardenPulsars(w: World): readonly (Anomaly | null)[] {
  return stateOf(w).slots;
}

/** Ease-out glide to `y`, then a slow creep. */
export function gardenY(y: number, since: number): number {
  if (since <= 0) return ENTRY_Y;
  const k = Math.min(1, since / GARDEN.glide);
  const e = 1 - (1 - k) * (1 - k);
  return ENTRY_Y + (y - ENTRY_Y) * e + GARDEN.creep * Math.max(0, since - GARDEN.glide);
}

function updateGarden(w: World, dt: number): void {
  const s = states.get(w);
  if (s === undefined || !s.armed) return;
  const now = directorTime(w);
  const since = now - s.t0;
  const release = now >= GARDEN.releaseAt;
  for (let i = 0; i < GARDEN.slots.length; i++) {
    const slot = GARDEN.slots[i];
    if (slot === undefined) continue;
    let a = s.slots[i] ?? null;
    if (a !== null && (!a.active || a.id !== s.ids[i])) {
      s.slots[i] = a = null;
      s.ids[i] = -2;
    }
    if (s.ids[i] === -1 && since >= slot.delay && !release) {
      PLACE.variant = slot.variant;
      PLACE.vy = 0;
      PLACE.phase = lockedPhase(now, VARIANT_PERIOD[slot.variant], slot.offset);
      a = spawnPulsar(w, slot.x, ENTRY_Y, PLACE);
      s.ids[i] = a === null ? -2 : a.id;
      s.slots[i] = a;
      if (a !== null) pinAnomaly(a);
    }
    if (a === null) continue;
    if (release) {
      // They burn out rather than drift down through the player while still pulsing.
      if (!s.released) collapseAnomaly(w, a, GARDEN.fade);
      continue;
    }
    const next = gardenY(slot.y, since - slot.delay + dt);
    a.vy = (next - a.y) / dt;
  }
  if (release) s.released = true;
}

export const gardenSystem: System = { name: 'pulsarNursery.garden', update: updateGarden };

/** Level script `pulsarNursery.streakers` (args.n): fast scroll only. */
export function streakerScript(w: World, n: number): void {
  if (w.scrollSpeed < STREAKER_MIN_SCROLL) return;
  spawnStreakers(w, n);
}
