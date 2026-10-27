// Per-world side tables for the junction sector. Preallocated on first use so
// the per-tick paths never allocate; worlds that never meet a junction enemy
// or script never get one (`peekJx`), so other sectors pay one WeakMap read.
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { collapsePortalPair, type PortalEnd, type PortalPair } from '../../obstacles';

/** How an aimed exit points the player shots it lets out. */
export const Aim = {
  Off: 0,
  /** Toward (tx, ty): a held exit over its target's back. */
  Point: 1,
  /** Straight down: a free exit wandering over its target. */
  Down: 2,
} as const;
export type AimMode = (typeof Aim)[keyof typeof Aim];

/**
 * A portal exit that turns player shots coming out of it toward a target
 * (the design's "exits aimed at its back"). Portals keep a body's velocity,
 * so without this a straight-up stream would leave an exit above a target
 * still going up.
 */
export interface AimedExit {
  end: PortalEnd | null;
  /** The end is valid while its pair is one of these (Janus swaps its two pairs). */
  pairA: number;
  pairB: number;
  mode: AimMode;
  tx: number;
  ty: number;
}

/** A pair that dies with an enemy (a pylon carrying an end, an Aegis owning both). */
export interface OwnedPair {
  owner: Enemy | null;
  ownerId: number;
  pair: PortalPair | null;
  pairId: number;
  /** The end a pylon carries ('' = the owner places both). */
  end: '' | 'a' | 'b';
  /** Pylon: the ring's offset beside it, px. */
  dx: number;
}

export interface TaggedPair {
  tag: string;
  pair: PortalPair | null;
  pairId: number;
}

export interface AegisEntry {
  enemy: Enemy | null;
  id: number;
  lowDx: number;
  anchorX: number;
  /** Seconds since the shield last absorbed a shot (draw flash). */
  hitAgo: number;
}

export interface BlinkerEntry {
  id: number;
  target: PortalEnd | null;
  /** The end it last came out of (it doesn't dive straight back in). */
  exit: PortalEnd | null;
  targetPairId: number;
  /** Seconds in the current state. */
  t: number;
  dives: number;
  fired: boolean;
  lastX: number;
  lastY: number;
}

/** Janus's portal wall, written by the boss each tick. */
export interface WallState {
  on: boolean;
  /** Flickered off (the silent assist): shots pass, the ship is still held. */
  down: boolean;
  x0: number;
  x1: number;
  y: number;
  shipPad: number;
  /** Shots absorbed (draw shimmer, tests). */
  absorbed: number;
}

export interface Stream {
  active: boolean;
  tag: string;
  kind: 'rock' | 'gnat';
  left: number;
  gap: number;
  t: number;
}

export const MAX_AIMED = 8;
export const MAX_OWNED = 12;
export const MAX_TAGGED = 12;
export const MAX_AEGIS = 8;
export const MAX_BLINKERS = 16;
export const MAX_STREAMS = 4;
export const MAX_SPARKS = 12;

export interface JunctionState {
  aimed: AimedExit[];
  owned: OwnedPair[];
  tagged: TaggedPair[];
  aegis: AegisEntry[];
  blinkers: BlinkerEntry[];
  streams: Stream[];
  wall: WallState;
  rush: { on: boolean; t: number; k: number };
  /** Shield sparks: x, y, age. */
  sparks: Float32Array;
  sparkNext: number;
  /** Shots the Aegis shields absorbed, and shots turned by aimed exits (tests, logs). */
  shieldAbsorbed: number;
  reaimed: number;
  pingT: number;
}

const states = new WeakMap<World, JunctionState>();

export function peekJx(w: World): JunctionState | undefined {
  return states.get(w);
}

export function jx(w: World): JunctionState {
  let s = states.get(w);
  if (s === undefined) {
    s = {
      aimed: Array.from({ length: MAX_AIMED }, () => ({
        end: null,
        pairA: -1,
        pairB: -1,
        mode: Aim.Off,
        tx: 0,
        ty: 0,
      })),
      owned: Array.from({ length: MAX_OWNED }, () => ({
        owner: null,
        ownerId: -1,
        pair: null,
        pairId: -1,
        end: '' as const,
        dx: 0,
      })),
      tagged: Array.from({ length: MAX_TAGGED }, () => ({ tag: '', pair: null, pairId: -1 })),
      aegis: Array.from({ length: MAX_AEGIS }, () => ({
        enemy: null,
        id: -1,
        lowDx: 0,
        anchorX: 0,
        hitAgo: 9,
      })),
      blinkers: Array.from({ length: MAX_BLINKERS }, () => ({
        id: -1,
        target: null,
        exit: null,
        targetPairId: -1,
        t: 0,
        dives: 0,
        fired: false,
        lastX: 0,
        lastY: 0,
      })),
      streams: Array.from({ length: MAX_STREAMS }, () => ({
        active: false,
        tag: '',
        kind: 'rock' as const,
        left: 0,
        gap: 0,
        t: 0,
      })),
      wall: { on: false, down: false, x0: 0, x1: 0, y: 0, shipPad: 0, absorbed: 0 },
      rush: { on: false, t: 0, k: 0 },
      sparks: new Float32Array(MAX_SPARKS * 3).fill(99),
      sparkNext: 0,
      shieldAbsorbed: 0,
      reaimed: 0,
      pingT: 0,
    };
    states.set(w, s);
  }
  return s;
}

/** True while `pair` is still the live pair spawned with `id`. */
export function pairLive(pair: PortalPair | null, id: number): pair is PortalPair {
  return pair !== null && pair.active && pair.id === id;
}

export function enemyLive(e: Enemy | null, id: number): e is Enemy {
  return e !== null && e.active && e.id === id;
}

// ---------------------------------------------------------------------------
// Aimed exits

/** Registers (or updates) an aimed exit. Returns its slot, or null when the table is full. */
export function aimExit(
  w: World,
  end: PortalEnd,
  pairA: number,
  pairB: number,
  mode: AimMode,
  tx: number,
  ty: number,
): AimedExit | null {
  const s = jx(w);
  let free: AimedExit | null = null;
  for (const a of s.aimed) {
    if (a.end === end) {
      free = a;
      break;
    }
    if (free === null && a.end === null) free = a;
  }
  if (free === null) return null;
  free.end = end;
  free.pairA = pairA;
  free.pairB = pairB;
  free.mode = mode;
  free.tx = tx;
  free.ty = ty;
  return free;
}

export function aimedFor(w: World, end: PortalEnd): AimedExit | null {
  const s = peekJx(w);
  if (s === undefined) return null;
  for (const a of s.aimed) if (a.end === end) return a;
  return null;
}

export function aimedValid(a: AimedExit): boolean {
  const e = a.end;
  if (e === null) return false;
  const p = e.pair;
  return p.active && (p.id === a.pairA || p.id === a.pairB);
}

// ---------------------------------------------------------------------------
// Owned and tagged pairs

export function ownPair(
  w: World,
  owner: Enemy,
  pair: PortalPair,
  end: '' | 'a' | 'b',
  dx: number,
): OwnedPair | null {
  for (const o of jx(w).owned) {
    if (o.owner !== null) continue;
    o.owner = owner;
    o.ownerId = owner.id;
    o.pair = pair;
    o.pairId = pair.id;
    o.end = end;
    o.dx = dx;
    return o;
  }
  return null;
}

/** The first live owned-pair entry of `e`, or null. */
export function ownedBy(w: World, e: Enemy): OwnedPair | null {
  const s = peekJx(w);
  if (s === undefined) return null;
  for (const o of s.owned) if (o.owner === e && o.ownerId === e.id) return o;
  return null;
}

/** Collapses the pairs of owners that died or left; frees their entries. Every tick. */
export function sweepOwned(w: World, s: JunctionState): void {
  for (const o of s.owned) {
    if (o.owner === null) continue;
    if (enemyLive(o.owner, o.ownerId) && pairLive(o.pair, o.pairId)) continue;
    if (pairLive(o.pair, o.pairId)) collapsePortalPair(w, o.pair);
    o.owner = null;
    o.ownerId = -1;
    o.pair = null;
    o.pairId = -1;
  }
  for (const a of s.aimed) {
    if (a.end !== null && !aimedValid(a)) {
      a.end = null;
      a.mode = Aim.Off;
    }
  }
}

export function tagPair(w: World, tag: string, pair: PortalPair): void {
  const s = jx(w);
  let slot: TaggedPair | null = null;
  for (const t of s.tagged) {
    if (!pairLive(t.pair, t.pairId)) {
      slot = t;
      break;
    }
  }
  if (slot === null) return;
  slot.tag = tag;
  slot.pair = pair;
  slot.pairId = pair.id;
}

export function taggedPair(w: World, tag: string): PortalPair | null {
  const s = peekJx(w);
  if (s === undefined) return null;
  for (const t of s.tagged) if (t.tag === tag && pairLive(t.pair, t.pairId)) return t.pair;
  return null;
}

/** Collapses the pairs tagged `tag` (`*`: every tagged pair). */
export function collapseTagged(w: World, tag: string): number {
  const s = peekJx(w);
  if (s === undefined) return 0;
  let n = 0;
  for (const t of s.tagged) {
    if (!pairLive(t.pair, t.pairId) || (tag !== '*' && t.tag !== tag)) continue;
    collapsePortalPair(w, t.pair);
    t.pair = null;
    t.pairId = -1;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Aegis and Blinker tables

export function aegisEntry(w: World, e: Enemy): AegisEntry | null {
  const s = peekJx(w);
  if (s === undefined) return null;
  for (const a of s.aegis) if (a.enemy === e && a.id === e.id) return a;
  return null;
}

export function claimAegis(w: World, e: Enemy, lowDx: number): AegisEntry | null {
  for (const a of jx(w).aegis) {
    if (enemyLive(a.enemy, a.id)) continue;
    a.enemy = e;
    a.id = e.id;
    a.lowDx = lowDx;
    a.anchorX = e.x;
    a.hitAgo = 9;
    return a;
  }
  return null;
}

export function blinkerEntry(w: World, id: number): BlinkerEntry | null {
  const s = peekJx(w);
  if (s === undefined) return null;
  for (const b of s.blinkers) if (b.id === id) return b;
  return null;
}

/** A slot for a new Blinker; slots of Blinkers no longer alive are reused. */
export function claimBlinker(w: World, e: Enemy): BlinkerEntry | null {
  const s = jx(w);
  for (const b of s.blinkers) {
    if (b.id >= 0 && liveEnemyId(w, b.id)) continue;
    b.id = e.id;
    b.target = null;
    b.exit = null;
    b.targetPairId = -1;
    b.t = 0;
    b.dives = 0;
    b.fired = false;
    b.lastX = e.x;
    b.lastY = e.y;
    return b;
  }
  return null;
}

function liveEnemyId(w: World, id: number): boolean {
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i] as Enemy;
    if (e.active && e.id === id) return true;
  }
  return false;
}

export function addSpark(s: JunctionState, x: number, y: number): void {
  const i = s.sparkNext;
  s.sparks[i * 3] = x;
  s.sparks[i * 3 + 1] = y;
  s.sparks[i * 3 + 2] = 0;
  s.sparkNext = (i + 1) % MAX_SPARKS;
}
