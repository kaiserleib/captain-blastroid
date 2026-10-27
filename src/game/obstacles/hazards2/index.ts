// Act II shared hazards (T33): flares and shade, portals, time bubbles.
import type {
  BubbleEvent,
  FlareEvent,
  FlaresEvent,
  PortalEvent,
  ShadeSlabEvent,
  XSpec,
} from '../../../content/levels';
import { SHADE_SLAB } from '../../../content/obstacles';
import { registerSolidQuery, registerTimelineAction, registerTimeScale } from '../../../sim/hooks';
import { WORLD_W, type World } from '../../../sim/world';
import { bubbleTimeScale, spawnBubble, updateBubbles } from './bubbles';
import { startFlare, startFlares, updateFlare } from './flare';
import { spawnPortalPair, updatePortals } from './portals';
import { slabSolidQuery, spawnShadeSlab, updateSlabs } from './shade';
import { hz, peekHz } from './state';

/** Matches the director's `resolveX` (16 px safe margin), without importing the director. */
const SAFE_X = 16;

function resolveX(w: World, x: XSpec, halfWidth: number): number {
  if (x !== 'rand') return x;
  const lo = SAFE_X + halfWidth;
  const hi = WORLD_W - SAFE_X - halfWidth;
  return hi <= lo ? WORLD_W / 2 : w.rng.range(lo, hi);
}

function flareAction(w: World, ev: unknown): void {
  startFlare(w, (ev ?? {}) as FlareEvent);
}

function flaresAction(w: World, ev: unknown): void {
  startFlares(w, ev as FlaresEvent);
}

function slabAction(w: World, ev: unknown): void {
  const e = ev as ShadeSlabEvent;
  spawnShadeSlab(w, resolveX(w, e.x, SHADE_SLAB.w / 2), -SHADE_SLAB.h / 2 - 1, { vx: e.vx });
}

function portalAction(w: World, ev: unknown): void {
  const e = ev as PortalEvent;
  const v = e.drift === false ? 0 : w.scrollSpeed;
  spawnPortalPair(w, e.a[0], e.a[1], e.b[0], e.b[1], { color: e.color, vyA: v, vyB: v });
}

function bubbleAction(w: World, ev: unknown): void {
  const e = ev as BubbleEvent;
  spawnBubble(w, resolveX(w, e.x, e.r), e.y ?? -e.r, {
    kind: e.kind,
    r: e.r,
    ttl: e.ttl,
    vx: e.vx,
    vy: e.vy,
  });
}

/** Timeline actions, the time-scale hook and the slab solid query. Safe to call again. */
export function registerHazardIIHooks(): void {
  registerTimelineAction('flare', flareAction);
  registerTimelineAction('flares', flaresAction);
  registerTimelineAction('shadeSlab', slabAction);
  registerTimelineAction('portal', portalAction);
  registerTimelineAction('bubble', bubbleAction);
  registerTimeScale(bubbleTimeScale);
  registerSolidQuery(slabSolidQuery);
}

/**
 * Runs after rocks move: slabs (and the shots they eat), bubbles, portals,
 * then the flare. Free when a world has never used any of them.
 */
export function updateHazardsII(w: World, dt: number): void {
  const s = peekHz(w);
  if (s === undefined) return;
  s.clock += dt;
  updateSlabs(w, dt);
  updateBubbles(w, dt);
  updatePortals(w, dt);
  updateFlare(w, dt);
}

/** Clears every Act II hazard (sandbox). */
export function clearHazardsII(w: World): void {
  const s = hz(w);
  for (const sl of s.slabs) sl.active = false;
  s.slabCount = 0;
  for (const b of s.bubbles) b.active = false;
  s.bubbleCount = 0;
  for (const p of s.pairs) {
    p.active = false;
    p.swapT = 0;
    p.swapWith = null;
  }
  s.pairCount = 0;
  s.flare.repeatUntil = -1;
}
