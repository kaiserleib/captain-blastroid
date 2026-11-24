import { flags } from '../debug/flags';
import type { Scene } from '../engine/scene';
import {
  enforceOwnership,
  flushTelemetry,
  getSave,
  httpSender,
  initEntitlements,
  initRunLog,
  initSave,
  initTelemetry,
  onEntitlementsChange,
  refreshEntitlements,
  setOwnedPacks,
  setSave,
} from '../meta';
import { DevStore, MemoryStorage, platform, runtimeOs } from '../platform';
import { debugSave, GAME_VERSION } from '../ui';
import { flow } from './flow';

function syncOwnership(): void {
  const save = getSave();
  const next = enforceOwnership(save);
  if (next !== save) setSave(next);
}

/** Milestone counts go out from real installs only: never from dev, debug or automated runs. */
function telemetrySender(): ReturnType<typeof httpSender> | null {
  const url = import.meta.env.VITE_TELEMETRY_URL as string | undefined;
  if (!url || import.meta.env.DEV || flags.save || flags.fakeStore) return null;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return null;
  const key = (import.meta.env.VITE_TELEMETRY_KEY as string | undefined) ?? null;
  return httpSender(url, key, { platform: runtimeOs(), version: GAME_VERSION });
}

/**
 * Loads the save, then hands over to the title screen (or straight into a run with
 * `?sandbox`, which the gameplay tickets' test keys rely on).
 */
export class BootScene implements Scene {
  private ready = false;

  enter(): void {
    void this.boot().finally(() => {
      this.ready = true;
    });
  }

  private async boot(): Promise<void> {
    void platform.orientation.lockPortrait();
    try {
      if (flags.save) {
        // Crafted saves live in memory so they never overwrite the real one.
        const mem = new MemoryStorage();
        await initSave(mem, platform.lifecycle);
        await initRunLog(mem);
        setSave(debugSave(flags.save));
      } else {
        await initSave(platform.storage, platform.lifecycle);
        await initRunLog(platform.storage);
      }
    } catch (e) {
      console.error('Save failed to load; continuing with defaults', e);
    }
    try {
      // Before the store, so a pack got this session is counted.
      await initTelemetry(platform.storage, telemetrySender());
      platform.lifecycle.onResume(() => void flushTelemetry());
    } catch (e) {
      console.warn('Telemetry unavailable', e);
    }
    try {
      // After the save: losing a pack moves the launch selections off its content.
      onEntitlementsChange(syncOwnership);
      const store = flags.fakeStore ? new DevStore() : platform.store;
      // The fake store's answers must not land in the real ownership cache.
      const cache = flags.fakeStore ? new MemoryStorage() : platform.storage;
      await initEntitlements(cache, store, { locked: flags.lockPacks });
      syncOwnership();
      // A purchase approved, refunded or made on another device while the app was away.
      platform.lifecycle.onResume(() => void refreshEntitlements());
    } catch (e) {
      console.error('Store failed to load', e);
      // A store build never falls back to "everything owned".
      if (platform.store) setOwnedPacks([]);
    }
  }

  exit(): void {}

  // Switch on an update rather than inside the promise, so replace() isn't re-entered.
  update(): void {
    if (!this.ready) return;
    if (flags.sandbox) flow.launch({});
    else flow.title();
  }

  render(): void {}
}
