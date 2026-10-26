import type { Rng } from '../../engine/rng';

export type ShakeSetting = 'off' | 'low' | 'full';

/** Hard cap in px, after the setting scale, so shake never hurts readability. */
export const SHAKE_MAX = 4;

export function shakeScale(setting: ShakeSetting): number {
  return setting === 'off' ? 0 : setting === 'low' ? 0.5 : 1;
}

/** Linearly decaying random offset, re-rolled every tick in whole pixels. */
export class Shake {
  x = 0;
  y = 0;
  private mag = 0;
  private dur = 0;
  private t = 0;

  /** The stronger of the current and new shake wins. */
  add(mag: number, dur: number): void {
    if (!(mag > 0 && dur > 0)) return;
    if (mag >= this.current()) {
      this.mag = mag;
      this.dur = dur;
      this.t = 0;
    }
  }

  current(): number {
    return this.t < this.dur ? this.mag * (1 - this.t / this.dur) : 0;
  }

  update(dt: number, rng: Rng, scale: number): void {
    this.t += dt;
    const m = Math.min(SHAKE_MAX, this.current() * scale);
    if (m < 0.5) {
      this.x = 0;
      this.y = 0;
      return;
    }
    this.x = Math.round(rng.range(-m, m)) | 0;
    this.y = Math.round(rng.range(-m, m)) | 0;
  }

  reset(): void {
    this.mag = this.dur = this.t = 0;
    this.x = this.y = 0;
  }
}
