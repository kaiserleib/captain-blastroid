export const STEP = 1 / 60;
export const MAX_STEPS = 5;
// rAF timestamps jitter around 1/60 s; without slack a 60 Hz display alternates 0 and 2 ticks.
const STEP_SLACK = 1e-4;

export interface LoopCallbacks {
  update(dt: number): void;
  render(alpha: number): void;
}

export interface LoopScheduler {
  request(cb: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

const rafScheduler: LoopScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h),
};

/** Fixed 60 Hz simulation decoupled from display refresh, rendered with interpolation alpha. */
export class Loop {
  /** Sim ticks run since start. */
  ticks = 0;
  private acc = 0;
  private lastMs: number | null = null;
  private hitstopT = 0;
  private handle: number | null = null;
  private running = false;

  constructor(
    private readonly cb: LoopCallbacks,
    private readonly scheduler: LoopScheduler = rafScheduler,
  ) {}

  get paused(): boolean {
    return !this.running;
  }

  start(): void {
    this.resume();
  }

  pause(): void {
    this.running = false;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  /** Never simulates the time spent paused. */
  resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastMs = null;
    this.acc = 0;
    this.handle = this.scheduler.request(this.onFrame);
  }

  /** Freezes sim updates for `seconds` of real time; rendering continues. */
  hitstop(seconds: number): void {
    this.hitstopT = Math.max(this.hitstopT, seconds);
  }

  private readonly onFrame = (nowMs: number): void => {
    if (!this.running) return;
    this.frame(nowMs);
    this.handle = this.scheduler.request(this.onFrame);
  };

  /** One display frame. Public so tests can drive the loop without rAF. */
  frame(nowMs: number): void {
    let elapsed = this.lastMs === null ? 0 : (nowMs - this.lastMs) / 1000;
    this.lastMs = nowMs;
    if (elapsed < 0) elapsed = 0;

    if (this.hitstopT > 0) {
      const frozen = Math.min(this.hitstopT, elapsed);
      this.hitstopT -= frozen;
      elapsed -= frozen;
    }

    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= STEP - STEP_SLACK && steps < MAX_STEPS) {
      this.cb.update(STEP);
      this.acc -= STEP;
      this.ticks++;
      steps++;
    }
    // Drop any backlog beyond the cap instead of spiralling.
    if (this.acc >= STEP) this.acc %= STEP;
    if (this.acc < 0) this.acc = 0;

    this.cb.render(this.acc / STEP);
  }
}
