import { LEVEL, POD } from '../../../content/levels/armada';
import { getSave, nextRescuablePilot } from '../../../meta';
import type { World } from '../../../sim/world';
import { emitToast } from '../../director';
import { spawnEscapePod, spraySalvage } from '../../pickups';
import { armadaState } from './state';

// Commodore Vale's pod: ejected from the first wreck of the frigate pair, or
// drifting in from the top at 105 s if both frigates get away.

/** This sector's pilot still to rescue in this run, or null (the pod becomes a salvage cache). */
export function podPilot(w: World): string | null {
  const pilot = nextRescuablePilot(getSave(), LEVEL.id);
  return pilot !== null && w.run.pilotsRescued.includes(pilot) ? null : pilot;
}

/** Ejects the pod at (x, y), or sprays the salvage cache there. Once per run. */
export function ejectPod(w: World, x: number, y: number): void {
  const st = armadaState(w);
  if (st.podDone) return;
  st.podDone = true;
  const pilot = podPilot(w);
  const px = Math.max(POD.margin, Math.min(w.width - POD.margin, x));
  if (pilot === null) {
    spraySalvage(w, px, Math.max(POD.cacheY, y), LEVEL.podFallbackSalvage);
    emitToast(w, 'SALVAGE CACHE');
    return;
  }
  const pod = spawnEscapePod(w, pilot, px, POD.hp);
  if (pod !== null && y > pod.y) {
    pod.y = pod.prevY = y;
  }
  emitToast(w, y > 0 ? 'POD EJECTED!' : 'ESCAPE POD AHEAD');
}

/** Timeline script `armada.podArm`: the next frigate wreck ejects the pod. */
export function podArm(w: World): void {
  armadaState(w).podArmed = true;
}

/** Timeline script `armada.podFallback`: nobody wrecked a frigate of the pair in time. */
export function podFallback(w: World): void {
  const st = armadaState(w);
  if (st.podDone) return;
  ejectPod(w, w.rng.range(POD.margin + 20, w.width - POD.margin - 20), -1);
}

/** A frigate went down at (x, y). */
export function onFrigateWrecked(w: World, x: number, y: number): void {
  const st = armadaState(w);
  if (st.podArmed && !st.podDone) ejectPod(w, x, y);
}
