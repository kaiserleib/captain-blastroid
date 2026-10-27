// Per-world side tables for the Act II hazards (T33). Everything is
// preallocated on first use so the per-tick paths never allocate.
import {
  BUBBLE,
  PORTAL,
  SHADE_SLAB,
  type BubbleKind,
  type PortalColorId,
} from '../../../content/obstacles';
import type { World } from '../../../sim/world';

export interface ShadeSlab {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
}

export interface ShadeCaster {
  /** Entity id; -1 = free slot. */
  id: number;
  halfWidth: number;
  /** Center to bottom edge; < 0 uses the enemy's radius. */
  halfHeight: number;
}

export type FlarePhase = 'idle' | 'warn' | 'burn' | 'cool';

export interface FlareState {
  phase: FlarePhase;
  /** Seconds into the current phase. */
  t: number;
  warn: number;
  burn: number;
  practice: boolean;
  fizzled: boolean;
  /** Flares started this run (intro warns use it). */
  count: number;
  /** Tick the ship took this flare's hit, or -1. */
  hitTick: number;
  /** Entity ids already burned this flare (enemies, pods). */
  burned: Int32Array;
  burnedN: number;
  // `flares` repeat
  repeatEvery: number;
  repeatUntil: number;
  repeatNext: number;
  repeatWarn: number;
  repeatBurn: number;
}

export interface PortalEnd {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Carried by an owner (`setPortalEnd`): it doesn't move by itself. */
  owned: boolean;
  /** Open to the ship this tick (partner on screen and clear of hazards). */
  open: boolean;
  pair: PortalPair;
}

export interface PortalPair {
  active: boolean;
  /** Unique per spawn, so owners can tell a recycled handle. */
  id: number;
  color: PortalColorId;
  a: PortalEnd;
  b: PortalEnd;
  /** Swap telegraph: seconds left (0 = none) and the pair it re-pairs with. */
  swapT: number;
  swapWith: PortalPair | null;
  /** Seconds alive (swirl phase). */
  t: number;
}

export interface Bubble {
  active: boolean;
  kind: BubbleKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  t: number;
}

export const COOLDOWN_SLOTS = 2048;
const COOLDOWN_MASK = COOLDOWN_SLOTS - 1;
export const MAX_CASTERS = 16;
export const MAX_OPT_INS = 16;
export const MAX_FLASHES = 8;
const MAX_BURNED = 256;

export interface HazardState {
  clock: number;
  slabs: ShadeSlab[];
  slabCount: number;
  casters: ShadeCaster[];
  flare: FlareState;
  pairs: PortalPair[];
  pairCount: number;
  nextPairId: number;
  /** Per-body portal cooldown keyed by `id & mask`; the id is stored to reject collisions. */
  cdId: Int32Array;
  cdUntil: Float64Array;
  optIns: Int32Array;
  shipCdUntil: number;
  /** Clock time of the ship's last teleport (bots' hit causes). */
  shipPortedAt: number;
  flashX: Float32Array;
  flashY: Float32Array;
  flashTick: Int32Array;
  flashNext: number;
  bubbles: Bubble[];
  bubbleCount: number;
  log: string[];
}

function makeEnd(): PortalEnd {
  return {
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    owned: false,
    open: false,
    pair: null as unknown as PortalPair,
  };
}

function makePair(): PortalPair {
  const p: PortalPair = {
    active: false,
    id: 0,
    color: 'cyan',
    a: makeEnd(),
    b: makeEnd(),
    swapT: 0,
    swapWith: null,
    t: 0,
  };
  p.a.pair = p;
  p.b.pair = p;
  return p;
}

const states = new WeakMap<World, HazardState>();

export function hz(w: World): HazardState {
  let s = states.get(w);
  if (s !== undefined) return s;
  s = {
    clock: 0,
    slabs: Array.from({ length: SHADE_SLAB.max }, () => ({
      active: false,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
    })),
    slabCount: 0,
    casters: Array.from({ length: MAX_CASTERS }, () => ({ id: -1, halfWidth: 0, halfHeight: -1 })),
    flare: {
      phase: 'idle',
      t: 0,
      warn: 0,
      burn: 0,
      practice: false,
      fizzled: false,
      count: 0,
      hitTick: -1,
      burned: new Int32Array(MAX_BURNED),
      burnedN: 0,
      repeatEvery: 0,
      repeatUntil: -1,
      repeatNext: 0,
      repeatWarn: 0,
      repeatBurn: 0,
    },
    pairs: Array.from({ length: PORTAL.maxPairs }, makePair),
    pairCount: 0,
    nextPairId: 1,
    cdId: new Int32Array(COOLDOWN_SLOTS).fill(-1),
    cdUntil: new Float64Array(COOLDOWN_SLOTS),
    optIns: new Int32Array(MAX_OPT_INS).fill(-1),
    shipCdUntil: 0,
    shipPortedAt: -1e9,
    flashX: new Float32Array(MAX_FLASHES),
    flashY: new Float32Array(MAX_FLASHES),
    flashTick: new Int32Array(MAX_FLASHES).fill(-100),
    flashNext: 0,
    bubbles: Array.from({ length: BUBBLE.max }, () => ({
      active: false,
      kind: 'slow' as BubbleKind,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      r: 0,
      ttl: 0,
      t: 0,
    })),
    bubbleCount: 0,
    log: [],
  };
  states.set(w, s);
  return s;
}

/** The world's hazard state if anything has created it (no allocation on the hot path). */
export function peekHz(w: World): HazardState | undefined {
  return states.get(w);
}

export function onCooldown(s: HazardState, id: number): boolean {
  const k = id & COOLDOWN_MASK;
  return s.cdId[k] === id && s.clock < (s.cdUntil[k] as number);
}

export function setCooldown(s: HazardState, id: number, dur: number): void {
  const k = id & COOLDOWN_MASK;
  s.cdId[k] = id;
  s.cdUntil[k] = s.clock + dur;
}

const LOG_LIMIT = 400;

export function hzLog(s: HazardState, w: World, line: string): void {
  if (s.log.length < LOG_LIMIT) s.log.push(`${w.time.toFixed(2)} ${line}`);
}
