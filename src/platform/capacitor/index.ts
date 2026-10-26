import { App } from '@capacitor/app';
import { SystemBars } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import type { Platform } from '../platform';
import { NativeHaptics, NativeLifecycle, NativeOrientation, type HapticsApi } from './services';
import { defaultLocalStorage, migrateFromLocalStorage, PreferencesStorage } from './storage';

/**
 * Builds the native platform. Loaded with a dynamic import only when running inside
 * the Capacitor shell, so none of this ships in the web entry chunk.
 */
export async function createCapacitorPlatform(): Promise<Platform> {
  try {
    await migrateFromLocalStorage(Preferences, defaultLocalStorage());
  } catch (e) {
    console.warn('localStorage → Preferences migration failed', e);
  }
  // capacitor.config.ts hides the bars at launch; this keeps them hidden after a resume.
  const hideBars = (): void => void SystemBars.hide().catch(() => {});
  hideBars();
  void App.addListener('resume', hideBars);
  // Android back: act like Esc (pause in a run, back in menus) instead of closing the app.
  void App.addListener('backButton', () => {
    for (const type of ['keydown', 'keyup'] as const) {
      window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape', key: 'Escape' }));
    }
  });

  return {
    kind: 'native',
    storage: new PreferencesStorage(Preferences),
    haptics: new NativeHaptics(Haptics as unknown as HapticsApi),
    lifecycle: new NativeLifecycle(App),
    orientation: new NativeOrientation(ScreenOrientation),
  };
}
