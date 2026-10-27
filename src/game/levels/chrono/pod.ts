import { ESCAPE_POD_TUNING } from '../../../content/pickups';
import { POD } from '../../../content/levels/chrono';
import { timeScaleAt } from '../../../sim/hooks';
import type { Pickup } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { chronoState, type EchoPodState } from './state';

// Dr. Halász's pod. At 100 s an uncollectable echo pod drifts in and records
// its path tick by tick, moving exactly as a pod would (bubbles included). At
// 106 s the timeline's `escapePod` event spawns the real pod (the director
// picks the pilot, or an armored cache pod once Halász is rescued); this
// module moves it to the echo's start and replays the recording, so it takes
// the route the echo showed even if the bubbles have moved since.

/** Timeline script `chrono.echoPod`: the ghost pod appears at a seeded x and starts recording. */
export function echoPod(w: World): void {
  const p = chronoState(w).pod;
  const x = w.rng.range(POD.margin, w.width - POD.margin);
  const y = -ESCAPE_POD_TUNING.r - 2;
  p.active = true;
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.tick = w.tick;
  p.path[0] = x;
  p.path[1] = y;
  p.len = 1;
  p.realId = -1;
  p.realDone = false;
}

const realRefs = new WeakMap<World, Pickup | null>();

/**
 * The director's `escapePod` event (106 s) spawned the real pod (or its cache
 * pod): move it to where the echo appeared and replay the echo's path from here.
 */
export function claimRealPod(w: World, k: Pickup): void {
  const p = chronoState(w).pod;
  p.realDone = true;
  k.x = k.prevX = p.path[0] as number;
  k.y = k.prevY = p.path[1] as number;
  realRefs.set(w, k);
  p.realId = k.id;
  p.realTick = w.tick;
}

function findNewPod(w: World): Pickup | null {
  const items = w.pickups.items;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = items[i] as Pickup;
    if (k.active && k.kind === 'escapePod') return k;
  }
  return null;
}

/** Level system step: the echo moves and records; the real pod follows the recording. */
export function updatePod(w: World, dt: number): void {
  const p = chronoState(w).pod;
  if (p.active) stepEcho(w, p, dt);
  if (!p.realDone && p.len > 0) {
    // Level systems run after the timeline step, so this is the pod's spawn tick.
    const fresh = findNewPod(w);
    if (fresh !== null) claimRealPod(w, fresh);
  }
  if (p.realId < 0) return;
  const k = realRefs.get(w) ?? null;
  if (k === null || !k.active || k.id !== p.realId || k.magnetized) {
    p.realId = -1;
    return;
  }
  const age = w.tick - p.realTick;
  if (age <= 0) return;
  if (age >= p.len) {
    // Past the recording (the echo left the screen first): it drifts on as a normal pod.
    p.realId = -1;
    return;
  }
  k.x = p.path[age * 2] as number;
  k.y = p.path[age * 2 + 1] as number;
}

function stepEcho(w: World, p: EchoPodState, dt: number): void {
  if (w.tick === p.tick) return;
  p.prevX = p.x;
  p.prevY = p.y;
  p.y += ESCAPE_POD_TUNING.speed * timeScaleAt(w, p.x, p.y) * dt;
  if (p.len < POD.maxTicks) {
    p.path[p.len * 2] = p.x;
    p.path[p.len * 2 + 1] = p.y;
    p.len++;
  }
  if (p.y - ESCAPE_POD_TUNING.r > w.height + 2 || p.len >= POD.maxTicks) p.active = false;
}
