import type { Lifecycle, Orientation } from '../platform';

/** Pause on visibilitychange→hidden and pagehide; resume on visible and pageshow. */
export class WebLifecycle implements Lifecycle {
  onPause(cb: () => void): () => void {
    const onVis = (): void => {
      if (document.visibilityState === 'hidden') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', cb);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', cb);
    };
  }

  onResume(cb: () => void): () => void {
    const onVis = (): void => {
      if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', cb);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', cb);
    };
  }
}

interface LockableOrientation {
  lock?(o: string): Promise<void>;
}

export class WebOrientation implements Orientation {
  async lockPortrait(): Promise<void> {
    // Only works in fullscreen / installed PWAs on most browsers; rejection is expected elsewhere.
    try {
      const o = (globalThis as { screen?: { orientation?: LockableOrientation } }).screen
        ?.orientation;
      await o?.lock?.('portrait');
    } catch {
      // ignore
    }
  }
}
