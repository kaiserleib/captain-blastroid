// Tractor beams (T23): any enemy or boss can haul a rock on a critically
// damped spring and fling it. Tow state lives in a per-slot side table so the
// Asteroid contract stays untouched.
import { TRACTOR } from '../../content/obstacles';
import { STEP } from '../../engine/loop';
import { snes } from '../../gfx/palette';
import type { Renderer } from '../../gfx/renderer';
import type { Asteroid } from '../../sim/types';
import type { World } from '../../sim/world';

interface TowState {
  /** Entity id this slot state belongs to; a reused slot starts fresh. */
  id: number;
  towing: boolean;
  /** `world.tick` of the latest towRock call. */
  tick: number;
  world: World | null;
  rock: Asteroid;
}

const tows = new WeakMap<Asteroid, TowState>();
/** Rocks under tow right now, so the per-tick sweep doesn't walk the whole pool. */
const active: TowState[] = [];

function towState(rock: Asteroid): TowState {
  let st = tows.get(rock);
  if (st === undefined) {
    st = { id: -1, towing: false, tick: 0, world: null, rock };
    tows.set(rock, st);
  }
  if (st.id !== rock.id) {
    st.id = rock.id;
    st.towing = false;
  }
  return st;
}

/**
 * Call every tick while towing. Pulls the rock toward (tx, ty) with a spring of
 * `k` (1/s²) and critical damping 2√k, relative to the target's own velocity
 * (tvx, tvy) so a moving anchor (an orbit slot) is tracked without lag. Uses
 * backward Euler at the fixed sim step, so any k is stable.
 */
export function towRock(
  w: World,
  rock: Asteroid,
  tx: number,
  ty: number,
  k: number,
  tvx = 0,
  tvy = 0,
): void {
  if (!rock.active) return;
  const st = towState(rock);
  if (!st.towing) {
    st.towing = true;
    active.push(st);
  }
  st.tick = w.tick;
  st.world = w;
  const dt = STEP;
  const c = 2 * Math.sqrt(k > 0 ? k : 0);
  const den = 1 + c * dt + k * dt * dt;
  rock.vx = tvx + (rock.vx - tvx + k * (tx - rock.x) * dt) / den;
  rock.vy = tvy + (rock.vy - tvy + k * (ty - rock.y) * dt) / den;
}

/** Ends the tow and launches the rock at `speed` px/s toward (targetX, targetY). */
export function flingRock(
  _w: World,
  rock: Asteroid,
  speed: number,
  targetX: number,
  targetY: number,
): void {
  releaseRock(rock);
  const dx = targetX - rock.x;
  const dy = targetY - rock.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) {
    rock.vx = 0;
    rock.vy = speed;
    return;
  }
  rock.vx = (dx / d) * speed;
  rock.vy = (dy / d) * speed;
}

/** Ends the tow and leaves the rock drifting with its current velocity (the tower died). */
export function releaseRock(rock: Asteroid): void {
  const st = tows.get(rock);
  if (st !== undefined && st.id === rock.id) st.towing = false;
}

/** True while some tower is holding this rock (towed this tick or the one before). */
export function isTowed(rock: Asteroid): boolean {
  if (!rock.active) return false;
  const st = tows.get(rock);
  return st !== undefined && st.towing && st.id === rock.id;
}

/** The sim hook (registered by index.ts): held rocks escape culling and pass through enemies. */
export function towedHeldCheck(_w: World, a: Asteroid): boolean {
  return isTowed(a);
}

/**
 * Obstacles system, each tick: a rock nobody towed last tick or this one is
 * dropped with its current velocity (its tower died or gave up). The one-tick
 * grace lets towers run before or after the obstacles slot.
 */
export function sweepTows(w: World): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const st = active[i] as TowState;
    const rock = st.rock;
    const stale = !st.towing || st.id !== rock.id || !rock.active;
    if (!stale && st.world !== w) continue;
    if (stale || st.tick < w.tick - 1) {
      st.towing = false;
      active[i] = active[active.length - 1] as TowState;
      active.pop();
    }
  }
}

/** For tests: forget every tow. */
export function resetTows(): void {
  for (const st of active) st.towing = false;
  active.length = 0;
}

const BEAM = snes(TRACTOR.color);
const BEAM_HI = snes(TRACTOR.highlight);
const DASH = TRACTOR.dashOn + TRACTOR.dashOff;

/**
 * Dashed 2 px beam from the emitter (x0, y0) to the rock (x1, y1). Dashes
 * scroll toward the emitter, each led by a bright pixel. Whole pixels only.
 */
export function drawTractorBeam(
  r: Renderer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
): void {
  const ax = Math.round(x0);
  const ay = Math.round(y0);
  const dx = Math.round(x1) - ax;
  const dy = Math.round(y1) - ay;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  if (n === 0) return;
  // Thicken across the beam: sideways for steep lines, downward for flat ones.
  const steep = Math.abs(dy) >= Math.abs(dx);
  const w = steep ? 2 : 1;
  const h = steep ? 1 : 2;
  let shift = Math.floor(t * TRACTOR.dashSpeed) % DASH;
  if (shift < 0) shift += DASH;
  for (let i = 0; i <= n; i++) {
    // Pattern measured from the rock end and shifted back over time, so dashes
    // travel toward the emitter; the largest phase is a dash's leading pixel.
    let ph = (n - i - shift) % DASH;
    if (ph < 0) ph += DASH;
    if (ph >= TRACTOR.dashOn) continue;
    const x = ax + Math.round((dx * i) / n);
    const y = ay + Math.round((dy * i) / n);
    r.rect(steep ? x - 1 : x, steep ? y : y - 1, w, h, ph === TRACTOR.dashOn - 1 ? BEAM_HI : BEAM);
  }
}
