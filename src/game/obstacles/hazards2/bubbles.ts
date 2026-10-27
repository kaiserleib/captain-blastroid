// Time bubbles: inside one, bodies move and tick at its rate. The rate is read
// through `timeScaleAt` (sim/hooks), which this module registers.
import { BUBBLE, type BubbleKind } from '../../../content/obstacles';
import type { World } from '../../../sim/world';
import { WORLD_H, WORLD_W } from '../../../sim/world';
import { hz, peekHz, type Bubble } from './state';

export interface BubbleOptions {
  kind: BubbleKind;
  r: number;
  /** Seconds; default forever (until it drifts off). */
  ttl?: number;
  vx?: number;
  /** Default: the scroll speed. */
  vy?: number;
}

/** Spawns a bubble centered at (x, y). Null when all slots are used. */
export function spawnBubble(w: World, x: number, y: number, o: BubbleOptions): Bubble | null {
  const s = hz(w);
  for (let i = 0; i < s.bubbles.length; i++) {
    const b = s.bubbles[i] as Bubble;
    if (b.active) continue;
    b.active = true;
    b.kind = o.kind === 'fast' || o.kind === 'flip' ? o.kind : 'slow';
    b.x = b.prevX = x;
    b.y = b.prevY = y;
    b.vx = o.vx ?? 0;
    b.vy = o.vy ?? w.scrollSpeed;
    b.r = Math.max(4, o.r);
    b.ttl = o.ttl ?? Infinity;
    b.t = 0;
    if (i >= s.bubbleCount) s.bubbleCount = i + 1;
    return b;
  }
  return null;
}

export function removeBubble(w: World, b: Bubble): void {
  b.active = false;
  trim(w);
}

function trim(w: World): void {
  const s = hz(w);
  while (s.bubbleCount > 0 && !(s.bubbles[s.bubbleCount - 1] as Bubble).active) s.bubbleCount--;
}

/** Live bubbles (check `active`); the array is reused. */
export function bubbles(w: World): readonly Bubble[] {
  return peekHz(w)?.bubbles ?? NO_BUBBLES;
}
const NO_BUBBLES: readonly Bubble[] = [];

/** Pure: whether a flip bubble aged `t` is in its slow half. Flips start slow. */
export function flipIsSlow(t: number): boolean {
  return Math.floor(t / BUBBLE.flipEvery) % 2 === 0;
}

/** Pure: whether a flip bubble aged `t` is flickering ahead of a switch. */
export function flipFlickering(t: number): boolean {
  return t % BUBBLE.flipEvery >= BUBBLE.flipEvery - BUBBLE.flipFlicker;
}

/** The bubble's current rate. */
export function bubbleScale(b: Bubble): number {
  if (b.kind === 'slow') return BUBBLE.slow;
  if (b.kind === 'fast') return BUBBLE.fast;
  return flipIsSlow(b.t) ? BUBBLE.slow : BUBBLE.fast;
}

/**
 * The `registerTimeScale` hook: the product of every bubble containing (x, y),
 * 1 outside. Enemy bullets multiply `world.enemyBulletTimeScale` on top.
 */
export function bubbleTimeScale(w: World, x: number, y: number): number {
  const s = peekHz(w);
  if (s === undefined || s.bubbleCount === 0) return 1;
  let k = 1;
  for (let i = 0; i < s.bubbleCount; i++) {
    const b = s.bubbles[i] as Bubble;
    if (!b.active) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy < b.r * b.r) k *= bubbleScale(b);
  }
  return k;
}

export function updateBubbles(w: World, dt: number): void {
  const s = peekHz(w);
  if (s === undefined || s.bubbleCount === 0) return;
  for (let i = 0; i < s.bubbleCount; i++) {
    const b = s.bubbles[i] as Bubble;
    if (!b.active) continue;
    b.t += dt;
    b.ttl -= dt;
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (
      b.ttl <= 0 ||
      b.y - b.r > WORLD_H + 4 ||
      (b.vy < 0 && b.y + b.r < -4) ||
      b.x + b.r < -4 ||
      b.x - b.r > WORLD_W + 4
    )
      b.active = false;
  }
  trim(w);
}
