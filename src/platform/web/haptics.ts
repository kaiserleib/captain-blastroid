import type { HapticKind, Haptics } from '../platform';

const DURATION_MS: Record<HapticKind, number> = { light: 10, medium: 20, heavy: 35 };

type Vibrate = (pattern: number) => boolean;

function defaultVibrate(): Vibrate | null {
  const nav = (globalThis as { navigator?: { vibrate?: Vibrate } }).navigator;
  // iOS Safari has no navigator.vibrate, so haptics are a no-op on iOS web.
  return nav && typeof nav.vibrate === 'function' ? nav.vibrate.bind(nav) : null;
}

export class WebHaptics implements Haptics {
  private readonly vibrate: Vibrate | null;

  constructor(vibrate: Vibrate | null = defaultVibrate()) {
    this.vibrate = vibrate;
  }

  impact(kind: HapticKind): void {
    if (!this.vibrate) return;
    try {
      this.vibrate(DURATION_MS[kind]);
    } catch {
      // Some browsers throw before the first user gesture; haptics are optional.
    }
  }
}
