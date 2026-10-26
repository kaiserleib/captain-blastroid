import type { Anomaly, Asteroid } from './types';
import type { World } from './world';

// Scroll-speed changes (T21). Rocks and anomalies sit in the scrolling world:
// their vy already includes the scroll speed they spawned under, so a change
// of scroll adds the same delta to each of them and the field moves as one
// piece. Pickups re-read `scrollSpeed` every tick and enemies fly under their
// own power, so neither is touched.

/** Pinned anomalies (boss arenas) keep their vy. Keyed by object, checked by id: pool slots recycle. */
const pinned = new WeakMap<Anomaly, number>();

/** Excludes an anomaly from scroll changes until it is released. */
export function pinAnomaly(a: Anomaly): void {
  pinned.set(a, a.id);
}

export function isPinned(a: Anomaly): boolean {
  return a.active && pinned.get(a) === a.id;
}

/** Sets `w.scrollSpeed` and shifts every active rock and unpinned anomaly by the delta. */
export function setScrollSpeed(w: World, v: number): void {
  const d = v - w.scrollSpeed;
  w.scrollSpeed = v;
  if (d === 0) return;
  const rocks = w.asteroids.items;
  for (let i = 0; i < w.asteroids.count; i++) {
    const r = rocks[i] as Asteroid;
    if (r.active) r.vy += d;
  }
  const an = w.anomalies.items;
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = an[i] as Anomaly;
    if (a.active && pinned.get(a) !== a.id) a.vy += d;
  }
}
