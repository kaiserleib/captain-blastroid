import { AVOIDANCE } from '../../content/enemies';
import { isSolidAt } from '../../sim/hooks';
import { getSpatialHash } from '../../sim/spatialHash';
import { Layer, type Asteroid, type Body, type Enemy } from '../../sim/types';
import { WORLD_W, type World } from '../../sim/world';

export interface Steer {
  x: number;
  y: number;
}

const WHISKER = (AVOIDANCE.whiskerDeg * Math.PI) / 180;
const WC = Math.cos(WHISKER);
const WS = Math.sin(WHISKER);
const MAX_SEEN = 16;
/** px: a rock this close to the heading line counts as dead ahead. */
const TIE = 2;

// Query context for the hoisted callback (no per-call closures).
let cx = 0;
let cy = 0;
let hx = 0;
let hy = 0;
/** Which side of the heading the current probe leans: ±1 whiskers, 0 center. */
let probeSide = 0;
let lateral = 0;
let maxUrgency = 0;
let selfR = 0;
/** Current velocity along the perpendicular; breaks dead-center ties without flip-flopping. */
let curLat = 0;
const seen = new Int32Array(MAX_SEEN);
let nSeen = 0;

function onRock(b: Body): void {
  const a = b as Asteroid;
  for (let i = 0; i < nSeen; i++) if (seen[i] === a.id) return;
  if (nSeen < MAX_SEEN) seen[nSeen++] = a.id;
  const rx = a.x - cx;
  const ry = a.y - cy;
  const along = rx * hx + ry * hy;
  if (along < -a.r) return;
  // Perpendicular (-hy, hx): positive = rock sits on that side.
  const side = rx * -hy + ry * hx;
  let away = side > TIE ? -1 : side < -TIE ? 1 : 0;
  if (away === 0) {
    if (curLat > 1 || curLat < -1) away = curLat > 0 ? 1 : -1;
    else if (probeSide !== 0) away = -probeSide;
    else away = -hy * (WORLD_W / 2 - cx) >= 0 ? 1 : -1;
  }
  // Urgency grows as the edge-to-edge gap ahead closes.
  const gap = along - a.r - selfR;
  const urgency = gap <= 0 ? 1 : gap >= AVOIDANCE.lookAhead ? 0 : 1 - gap / AVOIDANCE.lookAhead;
  lateral += away * urgency * AVOIDANCE.maxSteer;
  if (urgency > maxUrgency) maxUrgency = urgency;
}

/** Half a terrain tile: a solid point counts as an obstacle this big. */
const TILE_R = 4;

function probe(w: World, len: number, dx: number, dy: number, r: number, side: number): void {
  const h = getSpatialHash(w);
  probeSide = side;
  h.qx = cx + dx * len;
  h.qy = cy + dy * len;
  h.qr = r;
  h.queryAt(Layer.Asteroid, onRock);
  // Tile-ahead term (T34): a wall at the probe tip steers like a rock there.
  if (isSolidAt(w, h.qx, h.qy)) onTile(h.qx, h.qy);
}

function onTile(x: number, y: number): void {
  const rx = x - cx;
  const ry = y - cy;
  const along = rx * hx + ry * hy;
  const side = rx * -hy + ry * hx;
  let away = side > TIE ? -1 : side < -TIE ? 1 : 0;
  if (away === 0) away = probeSide !== 0 ? -probeSide : curLat >= 0 ? 1 : -1;
  const gap = along - TILE_R - selfR;
  const urgency = gap <= 0 ? 1 : gap >= AVOIDANCE.lookAhead ? 0 : 1 - gap / AVOIDANCE.lookAhead;
  lateral += away * urgency * AVOIDANCE.maxSteer;
  if (urgency > maxUrgency) maxUrgency = urgency;
}

/**
 * Lateral steer away from asteroids ahead of `e` along (dirX, dirY): a
 * center probe at `lookAhead` (sampled at half and full length) plus two
 * ±whiskerDeg whiskers. Reads the spatial hash snapshot. Writes a px/s
 * correction into `out` (lateral capped at maxSteer, plus a brake along the
 * heading) and returns true if anything was in the way.
 * (curVx, curVy) is the enemy's velocity before this tick: a rock dead ahead
 * is passed on the side it is already drifting toward.
 */
export function computeAvoidance(
  w: World,
  e: Enemy,
  dirX: number,
  dirY: number,
  out: Steer,
  curVx = 0,
  curVy = 0,
): boolean {
  let len = Math.hypot(dirX, dirY);
  if (len < 1e-6) {
    dirX = 0;
    dirY = 1;
    len = 1;
  }
  hx = dirX / len;
  hy = dirY / len;
  cx = e.x;
  cy = e.y;
  lateral = 0;
  maxUrgency = 0;
  selfR = e.r;
  curLat = curVx * -hy + curVy * hx;
  nSeen = 0;
  const r = e.r + AVOIDANCE.margin;
  const L = AVOIDANCE.lookAhead;
  probe(w, L * 0.5, hx, hy, r, 0);
  probe(w, L, hx, hy, r, 0);
  // +θ swings the whisker toward the positive (-hy, hx) side.
  probe(w, AVOIDANCE.whiskerLen, hx * WC - hy * WS, hx * WS + hy * WC, r, 1);
  probe(w, AVOIDANCE.whiskerLen, hx * WC + hy * WS, -hx * WS + hy * WC, r, -1);
  const max = AVOIDANCE.maxSteer;
  // Rocks on both sides cancel out; commit to one side instead of stalling in front of the gap.
  if (maxUrgency > 0.5 && lateral < max * 0.25 && lateral > -max * 0.25) {
    const side =
      curLat > 1 || curLat < -1 ? (curLat > 0 ? 1 : -1) : -hy * (WORLD_W / 2 - cx) >= 0 ? 1 : -1;
    lateral = side * max * maxUrgency;
  }
  const s = lateral > max ? max : lateral < -max ? -max : lateral;
  // Easing off the throttle buys time for the lateral steer to clear a rock dead ahead.
  const brake = maxUrgency * maxUrgency * AVOIDANCE.brake * len;
  out.x = -hy * s - hx * brake;
  out.y = hx * s - hy * brake;
  return s !== 0;
}
