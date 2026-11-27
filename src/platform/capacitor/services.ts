import type { HapticKind, Haptics, Lifecycle, Orientation } from '../platform';

// Thin wrappers over Capacitor plugins. The plugin surfaces are typed structurally
// so tests can pass fakes without loading the Capacitor runtime.

export type ImpactStyleName = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export interface HapticsApi {
  impact(o: { style: ImpactStyleName }): Promise<void>;
}

const STYLE: Record<HapticKind, ImpactStyleName> = {
  light: 'LIGHT',
  medium: 'MEDIUM',
  heavy: 'HEAVY',
};

export class NativeHaptics implements Haptics {
  constructor(private readonly api: HapticsApi) {}

  impact(kind: HapticKind): void {
    this.api.impact({ style: STYLE[kind] }).catch(() => {
      // Devices without a Taptic engine / vibrator reject; haptics are optional.
    });
  }
}

export interface ListenerHandle {
  remove(): Promise<void>;
}

export interface AppApi {
  addListener(event: 'pause' | 'resume' | 'backButton', cb: () => void): Promise<ListenerHandle>;
}

/** App.pause / App.resume: fired by the OS on app switch, lock, and incoming calls. */
export class NativeLifecycle implements Lifecycle {
  constructor(private readonly app: AppApi) {}

  onPause(cb: () => void): () => void {
    return this.listen('pause', cb);
  }

  onResume(cb: () => void): () => void {
    return this.listen('resume', cb);
  }

  private listen(event: 'pause' | 'resume', cb: () => void): () => void {
    const handle = this.app.addListener(event, cb);
    return () => {
      void handle.then((h) => h.remove());
    };
  }
}

export interface ScreenOrientationApi {
  lock(o: { orientation: 'portrait' }): Promise<void>;
}

/** Shorter screen side of 600 CSS px or more: an iPad or Android tablet, not a phone. */
export function isTabletSized(g: unknown = globalThis): boolean {
  const s = (g as { screen?: { width?: number; height?: number } }).screen;
  const w = s?.width ?? 0;
  const h = s?.height ?? 0;
  return Math.min(w, h) >= 600;
}

export class NativeOrientation implements Orientation {
  constructor(private readonly api: ScreenOrientationApi) {}

  async lockPortrait(): Promise<void> {
    // Tablets rotate freely and the game letterboxes itself: a portrait lock inside an
    // iPad window draws the game sideways when the iPad is held in landscape.
    if (isTabletSized()) return;
    try {
      await this.api.lock({ orientation: 'portrait' });
    } catch {
      // The native projects are portrait-only anyway (Info.plist / AndroidManifest).
    }
  }
}
