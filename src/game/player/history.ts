// Ship-position history: a fixed ring of the last 10 s of (x, y), one sample per
// tick, so the Echo boss (T41) can replay where the player was.
import { STEP } from '../../engine/loop';

export const HISTORY_SECONDS = 10;

export interface PosHistory {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Seconds between samples. */
  readonly step: number;
  /** Next write slot. */
  head: number;
  /** Samples written, up to the capacity. */
  count: number;
}

/** Room for `seconds` of history plus the current sample. */
export function createHistory(seconds = HISTORY_SECONDS, step = STEP): PosHistory {
  const cap = Math.round(seconds / step) + 1;
  return { xs: new Float64Array(cap), ys: new Float64Array(cap), step, head: 0, count: 0 };
}

export function clearHistory(h: PosHistory): void {
  h.head = 0;
  h.count = 0;
}

export function pushHistory(h: PosHistory, x: number, y: number): void {
  const cap = h.xs.length;
  h.xs[h.head] = x;
  h.ys[h.head] = y;
  h.head = h.head + 1 === cap ? 0 : h.head + 1;
  if (h.count < cap) h.count++;
}

/**
 * Position `secondsAgo` before the newest sample, linearly interpolated between
 * ticks. Clamped to the recorded span, so asking past the oldest sample (early in
 * a run, or beyond 10 s) returns the oldest. False, with `out` untouched, when empty.
 */
export function sampleHistory(
  h: PosHistory,
  secondsAgo: number,
  out: { x: number; y: number },
): boolean {
  if (h.count === 0) return false;
  const cap = h.xs.length;
  const maxBack = h.count - 1;
  let f = secondsAgo > 0 ? secondsAgo / h.step : 0;
  if (f > maxBack) f = maxBack;
  const k = Math.floor(f);
  const t = f - k;
  const i0 = (h.head - 1 - k + cap * 2) % cap;
  const x0 = h.xs[i0] as number;
  const y0 = h.ys[i0] as number;
  if (t === 0 || k >= maxBack) {
    out.x = x0;
    out.y = y0;
    return true;
  }
  const i1 = i0 === 0 ? cap - 1 : i0 - 1;
  out.x = x0 + ((h.xs[i1] as number) - x0) * t;
  out.y = y0 + ((h.ys[i1] as number) - y0) * t;
  return true;
}
