/** Longest sim freeze any single request may cause. */
export const HITSTOP_MAX = 0.12;

/**
 * Real-time gate: while a hitstop is running, new requests are ignored so
 * back-to-back big kills don't stack into a stall.
 */
export class HitstopGate {
  private untilMs = -Infinity;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Returns the granted duration in seconds, or 0 if ignored. */
  request(dur: number): number {
    if (!(dur > 0)) return 0;
    const t = this.now();
    if (t < this.untilMs) return 0;
    const d = Math.min(HITSTOP_MAX, dur);
    this.untilMs = t + d * 1000;
    return d;
  }

  reset(): void {
    this.untilMs = -Infinity;
  }
}

const gate = new HitstopGate();
let sink: ((seconds: number) => void) | null = null;

/** main.ts points this at `loop.hitstop`; until then hitstops are no-ops. */
export function setHitstopSink(fn: ((seconds: number) => void) | null): void {
  sink = fn;
}

export function requestHitstop(dur: number): boolean {
  const d = gate.request(dur);
  if (d > 0 && sink) sink(d);
  return d > 0;
}
