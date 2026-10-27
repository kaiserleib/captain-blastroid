import { BAND, NEAR_SLAB, POD_SLAB } from '../../../content/levels/corona';
import { ESCAPE_POD_TUNING } from '../../../content/pickups';
import type { World } from '../../../sim/world';
import { spawnRock, spawnShadeSlab } from '../../obstacles';

// Level scripts: placed cover ahead of flares, and the pod's slab.

const ROCK = { size: 'large' as const, x: 0, y: 0, vx: 0, vy: 0, hp: BAND.hp };
const SLAB = { vx: 0, vy: 0 };
/** Large rocks start just above the top edge (r 13). */
const ROCK_Y = -16;

/** A band of heavy large rocks across the playfield. Returns how many spawned. */
export function spawnBand(w: World): number {
  const rng = w.rng;
  const n = BAND.n;
  const span = w.width - BAND.margin * 2;
  let made = 0;
  for (let i = 0; i < n; i++) {
    ROCK.x = BAND.margin + (span * i) / (n - 1) + rng.range(-BAND.jitter, BAND.jitter);
    ROCK.y = ROCK_Y - rng.range(0, 6);
    ROCK.vy = w.scrollSpeed + BAND.speed;
    if (spawnRock(w, ROCK) !== null) made++;
  }
  return made;
}

const NEAR = { vx: 0 };
/** Slabs enter just above the top edge (h 10), as the timeline's do. */
const SLAB_Y = -6;

/**
 * A flare's slab, entering near the player's x so the cover is in reach when
 * the light comes. `away` > 0 places it that far off toward the middle
 * instead (a second slab for the long CME burns).
 */
export function spawnNearSlab(w: World, away = 0): boolean {
  const lo = NEAR_SLAB.margin;
  const hi = w.width - NEAR_SLAB.margin;
  const px = w.player.x;
  const toward = px < w.width / 2 ? 1 : -1;
  const x =
    px + toward * away + w.rng.range(-NEAR_SLAB.spread, NEAR_SLAB.spread) * (away > 0 ? 0.3 : 1);
  return spawnShadeSlab(w, x < lo ? lo : x > hi ? hi : x, SLAB_Y, NEAR) !== null;
}

/** The pod's slab: beside the pod (toward the middle), drifting at the pod's speed. */
export function spawnPodSlab(w: World, podX: number): boolean {
  const dx = podX < w.width / 2 ? POD_SLAB.dx : -POD_SLAB.dx;
  SLAB.vy = ESCAPE_POD_TUNING.speed;
  const y = -ESCAPE_POD_TUNING.r - 2 + POD_SLAB.dy;
  return spawnShadeSlab(w, podX + dx, y, SLAB) !== null;
}
