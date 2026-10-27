import { POD, REWIND_P } from '../../../content/levels/chrono';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';

// Per-world Chrono Rift state: the Rewinders' history recorders, the pod
// beat's recorded path, and whether the Bubble Mine listener is attached.
// Everything is preallocated on the world's first use.

export const MAX_RECORDERS = 16;
/** Samples a recorder keeps: the 2 s span plus the current one. */
export const REC_SAMPLES = Math.round(REWIND_P.record / REWIND_P.sample) + 1;

/** One Rewinder's last 2 s (x, y, HP), sampled every 0.1 s of its own (bubble-scaled) time. */
export interface Recorder {
  enemy: Enemy | null;
  /** Entity id at claim, to tell a recycled pool slot from our Rewinder. */
  id: number;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly hps: Float32Array;
  head: number;
  count: number;
  /** Seconds since the last sample. */
  acc: number;
  /** Rewind target (fixed when the telegraph starts). */
  tx: number;
  ty: number;
  thp: number;
  /** Seconds of telegraph left (-1 when none is running). */
  warnT: number;
}

export interface EchoPodState {
  /** The ghost pod is on screen and recording. */
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Tick it spawned (it doesn't move on that tick). */
  tick: number;
  /** Recorded path: x, y per tick since spawn. */
  readonly path: Float64Array;
  len: number;
  /** The real pod replaying the path, by entity id (-1 none). */
  realId: number;
  realTick: number;
  /** The real pod beat has run (or was skipped). */
  realDone: boolean;
}

export interface ChronoState {
  recorders: Recorder[];
  pod: EchoPodState;
  mineListener: boolean;
  /** Counters for tests and the sector run: rewinds done, denied, mine pops. */
  rewinds: number;
  denied: number;
  minePops: number;
  stutterRings: number;
}

const states = new WeakMap<World, ChronoState>();

export function chronoState(w: World): ChronoState {
  let s = states.get(w);
  if (s === undefined) {
    const recorders: Recorder[] = [];
    for (let i = 0; i < MAX_RECORDERS; i++) {
      recorders.push({
        enemy: null,
        id: -1,
        xs: new Float32Array(REC_SAMPLES),
        ys: new Float32Array(REC_SAMPLES),
        hps: new Float32Array(REC_SAMPLES),
        head: 0,
        count: 0,
        acc: 0,
        tx: 0,
        ty: 0,
        thp: 0,
        warnT: -1,
      });
    }
    s = {
      recorders,
      pod: {
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        tick: 0,
        path: new Float64Array(POD.maxTicks * 2),
        len: 0,
        realId: -1,
        realTick: 0,
        realDone: false,
      },
      mineListener: false,
      rewinds: 0,
      denied: 0,
      minePops: 0,
      stutterRings: 0,
    };
    states.set(w, s);
  }
  return s;
}

export function peekChrono(w: World): ChronoState | undefined {
  return states.get(w);
}

function live(r: Recorder): boolean {
  const e = r.enemy;
  return e !== null && e.active && e.id === r.id;
}

/** Claims a recorder for `e`; -1 when all are in use. A dead owner's recorder is reused. */
export function claimRecorder(w: World, e: Enemy): number {
  const rs = chronoState(w).recorders;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i] as Recorder;
    if (live(r)) continue;
    if (r.enemy !== null && r.warnT >= 0) chronoState(w).denied++;
    r.enemy = e;
    r.id = e.id;
    r.head = 0;
    r.count = 0;
    r.acc = 0;
    r.warnT = -1;
    return i;
  }
  return -1;
}

/** The recorder index `e` holds, or null if it lost it (pool recycled). */
export function recorderOf(w: World, e: Enemy, index: number): Recorder | null {
  const r = chronoState(w).recorders[index];
  return r !== undefined && r.enemy === e && r.id === e.id ? r : null;
}

export function pushSample(r: Recorder, x: number, y: number, hp: number): void {
  const cap = r.xs.length;
  r.xs[r.head] = x;
  r.ys[r.head] = y;
  r.hps[r.head] = hp;
  r.head = r.head + 1 === cap ? 0 : r.head + 1;
  if (r.count < cap) r.count++;
}

/** The sample `back` samples before the newest (clamped to the oldest). Returns the slot index. */
export function sampleIndex(r: Recorder, back: number): number {
  const cap = r.xs.length;
  const k = Math.max(0, Math.min(back, r.count - 1));
  return (r.head - 1 - k + cap * 2) % cap;
}

/** Releases recorders whose Rewinder died mid-telegraph (counts the denial). */
export function sweepRecorders(w: World): void {
  const s = peekChrono(w);
  if (s === undefined) return;
  for (const r of s.recorders) {
    if (r.enemy === null || live(r)) continue;
    if (r.warnT >= 0) s.denied++;
    r.enemy = null;
    r.id = -1;
    r.warnT = -1;
  }
}
