export interface LimiterOptions {
  /** Concurrent instances allowed per id. */
  perId: number;
  /** Minimum seconds between starts of the same id. */
  minGap: number;
  /** Concurrent voices allowed across all ids. */
  total: number;
}

export const DEFAULT_LIMITS: LimiterOptions = { perId: 3, minGap: 0.03, total: 24 };

interface Slot {
  lastStart: number;
  ends: Float64Array;
}

/**
 * Decides whether a sound may start, from the audio clock alone. It doesn't
 * touch Web Audio, so it's unit-testable. A voice counts as active until the
 * end time it was admitted with.
 */
export class VoiceLimiter {
  private readonly slots = new Map<string, Slot>();
  readonly opts: LimiterOptions;

  constructor(opts: Partial<LimiterOptions> = {}) {
    this.opts = { ...DEFAULT_LIMITS, ...opts };
  }

  /**
   * Returns true and records the voice if it may play `duration` seconds from
   * `now`. `limits` overrides perId/minGap for this id (the first call sizes it).
   */
  tryStart(
    id: string,
    now: number,
    duration: number,
    limits?: { perId: number; minGap: number },
  ): boolean {
    let slot = this.slots.get(id);
    if (!slot) {
      const perId = limits?.perId ?? this.opts.perId;
      slot = { lastStart: -Infinity, ends: new Float64Array(perId).fill(-Infinity) };
      this.slots.set(id, slot);
    }
    if (now - slot.lastStart < (limits?.minGap ?? this.opts.minGap)) return false;
    let free = -1;
    for (let i = 0; i < slot.ends.length; i++) {
      if (slot.ends[i]! <= now) {
        free = i;
        break;
      }
    }
    if (free < 0) return false;
    if (this.activeCount(now) >= this.opts.total) return false;
    slot.lastStart = now;
    slot.ends[free] = now + duration;
    return true;
  }

  activeCount(now: number, id?: string): number {
    let n = 0;
    for (const [key, slot] of this.slots) {
      if (id !== undefined && key !== id) continue;
      for (let i = 0; i < slot.ends.length; i++) if (slot.ends[i]! > now) n++;
    }
    return n;
  }

  reset(): void {
    this.slots.clear();
  }
}

/** Maps a playfield x (0..240) to stereo pan −1..1, clamped. */
export function xToPan(x: number, width = 240): number {
  const p = (x / width) * 2 - 1;
  return p < -1 ? -1 : p > 1 ? 1 : p;
}
