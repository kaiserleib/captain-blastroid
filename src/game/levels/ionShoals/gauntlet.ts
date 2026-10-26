import { GAUNTLET } from '../../../content/levels/ionShoals';
import type { AsteroidSize } from '../../../content/obstacles';
import { spawnEnemy } from '../../../sim/spawn';
import type { Pickup } from '../../../sim/types';
import type { System, World } from '../../../sim/world';
import type { LevelScriptArgs } from '../../director';
import { spawnRock } from '../../obstacles';

// Level scripts. `ionShoals.gauntlet` arms the escape-pod gauntlet: for
// GAUNTLET.duration seconds, skiff sweeps come in from alternating sides,
// dipping across the pod's column a little above it (so their aimed shots
// cross its path). The gunboats, the pod and the toasts are plain timeline
// events; pickups announces "POD LOST" itself.

interface GauntletState {
  active: boolean;
  t: number;
  /** Seconds until the next sweep. */
  next: number;
  /** Skiffs left in the current sweep, and the gap timer. */
  left: number;
  gapT: number;
  side: number;
  entryY: number;
}

const states = new WeakMap<World, GauntletState>();

export function gauntletState(w: World): GauntletState {
  let s = states.get(w);
  if (s === undefined) {
    s = { active: false, t: 0, next: 0, left: 0, gapT: 0, side: 1, entryY: 0 };
    states.set(w, s);
  }
  return s;
}

/** The live pod's y, or where it would be by now if it is gone (a cache or lost). */
function podY(w: World, s: GauntletState): number {
  const items = w.pickups.items;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = items[i] as Pickup;
    if (k.active && k.kind === 'escapePod') return k.y;
  }
  return 10 + s.t * 12;
}

export function startGauntlet(w: World): void {
  const s = gauntletState(w);
  s.active = true;
  s.t = 0;
  s.next = 0.5;
  s.left = 0;
  s.gapT = 0;
  s.side = w.rng.chance(0.5) ? 1 : -1;
}

const SWEEP = { vx: 0, vy: 0 };
const SIDE_X = 14;

export function updateGauntlet(w: World, dt: number): void {
  const s = states.get(w);
  if (s === undefined || !s.active) return;
  s.t += dt;
  if (s.t >= GAUNTLET.duration && s.left <= 0) {
    s.active = false;
    return;
  }
  if (s.left <= 0) {
    s.next -= dt;
    if (s.next > 0 || s.t >= GAUNTLET.duration) return;
    s.next += GAUNTLET.every;
    s.left = GAUNTLET.count;
    s.gapT = 0;
    s.side = -s.side;
    const y = podY(w, s) - GAUNTLET.aboveRows;
    s.entryY = Math.min(GAUNTLET.maxY, Math.max(GAUNTLET.minY, y));
  }
  s.gapT -= dt;
  if (s.gapT > 0) return;
  s.gapT += GAUNTLET.gap;
  s.left--;
  // side +1 enters from the left heading right.
  const a = (GAUNTLET.dipDeg * Math.PI) / 180;
  SWEEP.vx = s.side * Math.cos(a) * 130;
  SWEEP.vy = Math.sin(a) * 130;
  const x = s.side > 0 ? -SIDE_X : w.width + SIDE_X;
  spawnEnemy(w, 'ion_skiff', x, s.entryY, SWEEP);
}

export const gauntletSystem: System = { name: 'ionShoals.gauntlet', update: updateGauntlet };

export function gauntletScript(w: World, _args: LevelScriptArgs): void {
  startGauntlet(w);
}

const SIZES: readonly AsteroidSize[] = ['small', 'medium', 'large'];

/** `ionShoals.rock`: one rock at `x` (px) of `size`, drifting down at scroll + `vy`. */
export function rockScript(w: World, args: LevelScriptArgs): void {
  const size = SIZES.includes(args.size as AsteroidSize) ? (args.size as AsteroidSize) : 'medium';
  const x = typeof args.x === 'number' ? args.x : w.rng.range(40, 200);
  const vy = typeof args.vy === 'number' ? args.vy : 12;
  spawnRock(w, { size, x, y: -20, vx: 0, vy: w.scrollSpeed + vy });
}
