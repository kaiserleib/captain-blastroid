// `?sandbox` keys (T10): B black hole, N pulsar (Shift+B / Shift+N clears
// anomalies), A cycles the asteroid stream: off → stream → storm → off.
// Keys only queue requests; the obstacles system applies them inside a tick
// so the sim stays deterministic per tick.
import { flags } from '../../debug/flags';
import type { World } from '../../sim/world';
import { spawnBlackHole } from './anomalies/blackhole';
import { spawnPulsar } from './anomalies/pulsar';
import { spawnAsteroidStream, type AsteroidStream } from './asteroidSystem';

type StreamMode = 'off' | 'stream' | 'storm';

/** Exposed for console pokes in dev: `(await import('/src/game/obstacles/sandbox.ts')).sandbox.world`. */
export const sandbox = {
  world: null as World | null,
  pendingBlackHoles: 0,
  pendingPulsars: 0,
  clearAnomalies: false,
  mode: 'off' as StreamMode,
  modeDirty: false,
  stream: null as AsteroidStream | null,
};

function onKey(e: KeyboardEvent): void {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'b' || k === 'n') {
    if (e.shiftKey) sandbox.clearAnomalies = true;
    else if (k === 'b') sandbox.pendingBlackHoles++;
    else sandbox.pendingPulsars++;
  } else if (k === 'a') {
    sandbox.mode = sandbox.mode === 'off' ? 'stream' : sandbox.mode === 'stream' ? 'storm' : 'off';
    sandbox.modeDirty = true;
  }
}

let installed = false;

export function installObstacleSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKey);
}

/** Called by the obstacles system each tick while `?sandbox` is on. */
export function runObstacleSandbox(w: World): void {
  if (sandbox.world !== w) {
    sandbox.world = w;
    sandbox.stream = null;
    if (sandbox.mode !== 'off') sandbox.modeDirty = true;
  }
  if (sandbox.clearAnomalies) {
    sandbox.clearAnomalies = false;
    w.anomalies.each((a) => w.anomalies.release(a));
  }
  for (; sandbox.pendingBlackHoles > 0; sandbox.pendingBlackHoles--) {
    spawnBlackHole(w, w.rng.range(70, 170), w.rng.range(120, 200), { vy: 0 });
  }
  for (; sandbox.pendingPulsars > 0; sandbox.pendingPulsars--) {
    spawnPulsar(w, w.rng.range(60, 180), w.rng.range(90, 180), { vy: 0 });
  }
  if (sandbox.modeDirty) {
    sandbox.modeDirty = false;
    sandbox.stream?.stop();
    sandbox.stream = null;
    if (sandbox.mode === 'stream') {
      sandbox.stream = spawnAsteroidStream(w, {
        rate: 1.4,
        sizeWeights: { small: 6, medium: 3, large: 1 },
      });
    } else if (sandbox.mode === 'storm') {
      // Fills the whole pool: the 120-rock perf case.
      sandbox.stream = spawnAsteroidStream(w, {
        rate: 40,
        sizeWeights: { small: 6, medium: 3, large: 1 },
        speedRange: [10, 30],
        xRange: [-10, 250],
        poolReserve: 0,
      });
    }
  }
}
