// `?sandbox` keys (T10, T23):
//   B / N         black hole / pulsar at a random spot (default variants)
//   Shift+B / N   the next black-hole / pulsar variant at the cursor
//   X             clears every anomaly
//   A             cycles the asteroid stream: off → stream → storm → off
//   T (hold)      tows the rock nearest the cursor toward it; release flings it at the ship
//   F / Shift+F   solar flare now / shade slab at the cursor (T33)
//   [ / Shift+[   portal pair (A at the cursor, colors cycle) / swap the first two pairs
//   ] / Shift+]   time bubble at the cursor / cycle its kind (slow → fast → flip)
//   X             also clears slabs, portals and bubbles
// Keys only queue requests; the obstacles system applies them inside a tick
// so the sim stays deterministic per tick.
import {
  BLACK_HOLE_VARIANT_IDS,
  PULSAR_VARIANT_IDS,
  TRACTOR,
  type BubbleKind,
} from '../../content/obstacles';
import { flags } from '../../debug/flags';
import type { Renderer } from '../../gfx/renderer';
import type { Asteroid } from '../../sim/types';
import type { World } from '../../sim/world';
import { spawnBlackHole } from './anomalies/blackhole';
import { spawnPulsar } from './anomalies/pulsar';
import { spawnAsteroidStream, type AsteroidStream } from './asteroidSystem';
import { drawTractorBeam, flingRock, isTowed, towRock } from './tractor';
import { clearHazardsII } from './hazards2';
import { spawnBubble } from './hazards2/bubbles';
import { flareState, startFlare } from './hazards2/flare';
import { portalPairs, spawnPortalPair, swapPortals } from './hazards2/portals';
import { spawnShadeSlab } from './hazards2/shade';
import type { PortalPair } from './hazards2/state';

type StreamMode = 'off' | 'stream' | 'storm';

/** Exposed for console pokes in dev: `(await import('/src/game/obstacles/sandbox.ts')).sandbox.world`. */
export const sandbox = {
  world: null as World | null,
  pendingBlackHoles: 0,
  pendingPulsars: 0,
  /** Next variant index to place with Shift+B / Shift+N; -1 = none queued. */
  pendingBhVariant: -1,
  pendingPulsarVariant: -1,
  bhCycle: 0,
  pulsarCycle: 0,
  clearAnomalies: false,
  mode: 'off' as StreamMode,
  modeDirty: false,
  stream: null as AsteroidStream | null,
  towHeld: false,
  towRock: null as Asteroid | null,
  towRockId: -1,
  /** Beam emitter, i.e. the tow target this tick. */
  towX: 0,
  towY: 0,
  hazardQueue: [] as HazardRequest[],
  /** Index into BUBBLE_KINDS for `]`. */
  bubbleKind: 0,
  portalColor: 0,
};

type HazardRequest = 'flare' | 'slab' | 'portal' | 'swap' | 'bubble' | 'bubbleKind';
const BUBBLE_KINDS: readonly BubbleKind[] = ['slow', 'fast', 'flip'];
const PORTAL_COLOR_IDS = ['cyan', 'orange', 'lime'] as const;

function runHazardQueue(w: World): void {
  const q = sandbox.hazardQueue;
  for (let i = 0; i < q.length; i++) {
    const req = q[i] as HazardRequest;
    const cx = cursorX(w);
    const cy = cursorY(w);
    if (req === 'flare') {
      startFlare(w);
      const f = flareState(w);
      w.events.emit('toast', { text: f?.fizzled ? 'FLARE (FIZZLES: NO SHADE)' : 'SOLAR FLARE' });
    } else if (req === 'slab') {
      spawnShadeSlab(w, cx, cy, { vy: 0 });
    } else if (req === 'portal') {
      const color = PORTAL_COLOR_IDS[sandbox.portalColor] as string;
      sandbox.portalColor = (sandbox.portalColor + 1) % PORTAL_COLOR_IDS.length;
      // A at the cursor, B mirrored across the field and 120 px higher.
      const bx = Math.max(24, Math.min(216, 240 - cx));
      const by = Math.max(40, cy - 120);
      if (spawnPortalPair(w, cx, cy, bx, by, { color }) === null)
        w.events.emit('toast', { text: 'PORTALS FULL (X CLEARS)' });
    } else if (req === 'swap') {
      let p: PortalPair | null = null;
      let pq: PortalPair | null = null;
      for (const pair of portalPairs(w)) {
        if (!pair.active) continue;
        if (p === null) p = pair;
        else if (pq === null) pq = pair;
      }
      if (p === null || pq === null || !swapPortals(w, p, pq))
        w.events.emit('toast', { text: 'SWAP NEEDS 2 PAIRS' });
    } else if (req === 'bubble') {
      const kind = BUBBLE_KINDS[sandbox.bubbleKind] as BubbleKind;
      spawnBubble(w, cx, cy, { kind, r: 52, vy: 0 });
    } else {
      const kind = BUBBLE_KINDS[sandbox.bubbleKind] as BubbleKind;
      w.events.emit('toast', { text: `BUBBLE: ${kind.toUpperCase()}` });
    }
  }
  q.length = 0;
}

function onKey(e: KeyboardEvent): void {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  // T33 keys match on `code`: Shift turns `[` into `{` on most layouts.
  if (e.code === 'KeyF') {
    sandbox.hazardQueue.push(e.shiftKey ? 'slab' : 'flare');
    return;
  }
  if (e.code === 'BracketLeft') {
    sandbox.hazardQueue.push(e.shiftKey ? 'swap' : 'portal');
    return;
  }
  if (e.code === 'BracketRight') {
    if (e.shiftKey) {
      sandbox.bubbleKind = (sandbox.bubbleKind + 1) % BUBBLE_KINDS.length;
      sandbox.hazardQueue.push('bubbleKind');
    } else sandbox.hazardQueue.push('bubble');
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'b') {
    if (e.shiftKey) {
      sandbox.pendingBhVariant = sandbox.bhCycle;
      sandbox.bhCycle = (sandbox.bhCycle + 1) % BLACK_HOLE_VARIANT_IDS.length;
    } else sandbox.pendingBlackHoles++;
  } else if (k === 'n') {
    if (e.shiftKey) {
      sandbox.pendingPulsarVariant = sandbox.pulsarCycle;
      sandbox.pulsarCycle = (sandbox.pulsarCycle + 1) % PULSAR_VARIANT_IDS.length;
    } else sandbox.pendingPulsars++;
  } else if (k === 'x') {
    sandbox.clearAnomalies = true;
  } else if (k === 't') {
    sandbox.towHeld = true;
  } else if (k === 'a') {
    sandbox.mode = sandbox.mode === 'off' ? 'stream' : sandbox.mode === 'stream' ? 'storm' : 'off';
    sandbox.modeDirty = true;
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key.toLowerCase() === 't') sandbox.towHeld = false;
}

let installed = false;

export function installObstacleSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
}

// The mouse-follow target is the cursor; keyboard play has none, so use a
// spot ahead of the ship. Tows aim 40 px above it so the catch doesn't land
// on the ship that's chasing the cursor.
function cursorX(w: World): number {
  return w.input.targetX ?? w.player.x;
}
function cursorY(w: World): number {
  return w.input.targetY ?? w.player.y - 90;
}

function nearestRock(w: World, x: number, y: number): Asteroid | null {
  let best: Asteroid | null = null;
  let bestD = Infinity;
  const items = w.asteroids.items;
  for (let i = 0; i < w.asteroids.count; i++) {
    const a = items[i] as Asteroid;
    if (!a.active) continue;
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function runTow(w: World): void {
  const held = sandbox.towRock;
  const live = held !== null && held.active && held.id === sandbox.towRockId;
  if (sandbox.towHeld) {
    sandbox.towX = cursorX(w);
    sandbox.towY = cursorY(w) - 40;
    let rock = live ? held : null;
    if (rock === null) {
      rock = nearestRock(w, sandbox.towX, sandbox.towY);
      sandbox.towRock = rock;
      sandbox.towRockId = rock?.id ?? -1;
    }
    if (rock !== null) towRock(w, rock, sandbox.towX, sandbox.towY, TRACTOR.k);
  } else if (held !== null) {
    if (live && isTowed(held)) flingRock(w, held, TRACTOR.flingSpeed, w.player.x, w.player.y);
    sandbox.towRock = null;
    sandbox.towRockId = -1;
  }
}

/** Draws the sandbox tow beam (called from the anomaly layer while `?sandbox` is on). */
export function drawObstacleSandbox(w: World, r: Renderer): void {
  const rock = sandbox.towRock;
  if (sandbox.world !== w || rock === null || !rock.active || rock.id !== sandbox.towRockId) return;
  drawTractorBeam(r, sandbox.towX, sandbox.towY, rock.x, rock.y, w.time);
}

/** Called by the obstacles system each tick while `?sandbox` is on. */
export function runObstacleSandbox(w: World): void {
  if (sandbox.world !== w) {
    sandbox.world = w;
    sandbox.stream = null;
    sandbox.towRock = null;
    if (sandbox.mode !== 'off') sandbox.modeDirty = true;
  }
  if (sandbox.clearAnomalies) {
    sandbox.clearAnomalies = false;
    w.anomalies.each((a) => w.anomalies.release(a));
    clearHazardsII(w);
  }
  runHazardQueue(w);
  for (; sandbox.pendingBlackHoles > 0; sandbox.pendingBlackHoles--) {
    spawnBlackHole(w, w.rng.range(70, 170), w.rng.range(120, 200), { vy: 0 });
  }
  for (; sandbox.pendingPulsars > 0; sandbox.pendingPulsars--) {
    spawnPulsar(w, w.rng.range(60, 180), w.rng.range(90, 180), { vy: 0 });
  }
  if (sandbox.pendingBhVariant >= 0) {
    const variant = BLACK_HOLE_VARIANT_IDS[sandbox.pendingBhVariant];
    sandbox.pendingBhVariant = -1;
    spawnBlackHole(w, cursorX(w), cursorY(w), { vy: 0, variant });
    w.events.emit('toast', { text: `BLACK HOLE: ${(variant ?? '').toUpperCase()}` });
  }
  if (sandbox.pendingPulsarVariant >= 0) {
    const variant = PULSAR_VARIANT_IDS[sandbox.pendingPulsarVariant];
    sandbox.pendingPulsarVariant = -1;
    spawnPulsar(w, cursorX(w), cursorY(w), { vy: 0, variant });
    w.events.emit('toast', { text: `PULSAR: ${(variant ?? '').toUpperCase()}` });
  }
  runTow(w);
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
