import { describe, expect, it, vi } from 'vitest';
import { isNativeRuntime } from '../select';
import {
  NativeHaptics,
  NativeLifecycle,
  NativeOrientation,
  type AppApi,
  type HapticsApi,
} from './services';
import {
  migrateFromLocalStorage,
  MIGRATED_KEY,
  PreferencesStorage,
  type EnumerableBacking,
  type PreferencesApi,
} from './storage';

function fakePrefs(): PreferencesApi & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async ({ key }) => ({ value: map.get(key) ?? null }),
    set: async ({ key, value }) => void map.set(key, value),
    remove: async ({ key }) => void map.delete(key),
  };
}

function fakeLocal(entries: Record<string, string>): EnumerableBacking {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => entries[k] ?? null,
  };
}

describe('PreferencesStorage', () => {
  it('get / set / remove through Preferences', async () => {
    const prefs = fakePrefs();
    const s = new PreferencesStorage(prefs);
    expect(await s.get('a')).toBeNull();
    await s.set('a', '1');
    expect(prefs.map.get('a')).toBe('1');
    expect(await s.get('a')).toBe('1');
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
  });
});

describe('migrateFromLocalStorage', () => {
  it('copies game keys once and ignores other keys', async () => {
    const prefs = fakePrefs();
    const local = fakeLocal({
      'captain-blastroid.save': '{"v":1}',
      'captain-blastroid.save.corrupt': 'x',
      'other-app': 'nope',
    });
    expect(await migrateFromLocalStorage(prefs, local)).toBe(2);
    expect(prefs.map.get('captain-blastroid.save')).toBe('{"v":1}');
    expect(prefs.map.has('other-app')).toBe(false);
    expect(prefs.map.has(MIGRATED_KEY)).toBe(true);

    // A later launch never re-imports, even if localStorage changed.
    prefs.map.delete('captain-blastroid.save');
    expect(await migrateFromLocalStorage(prefs, local)).toBe(0);
    expect(prefs.map.has('captain-blastroid.save')).toBe(false);
  });

  it('never overwrites a value already in Preferences', async () => {
    const prefs = fakePrefs();
    prefs.map.set('captain-blastroid.save', 'native');
    await migrateFromLocalStorage(prefs, fakeLocal({ 'captain-blastroid.save': 'web' }));
    expect(prefs.map.get('captain-blastroid.save')).toBe('native');
  });

  it('marks migration done when localStorage is unavailable', async () => {
    const prefs = fakePrefs();
    expect(await migrateFromLocalStorage(prefs, null)).toBe(0);
    expect(prefs.map.has(MIGRATED_KEY)).toBe(true);
  });
});

describe('native services', () => {
  it('maps haptic kinds to impact styles and swallows rejections', async () => {
    const impact = vi.fn<HapticsApi['impact']>().mockRejectedValue(new Error('no motor'));
    const h = new NativeHaptics({ impact });
    h.impact('light');
    h.impact('heavy');
    expect(impact.mock.calls.map((c) => c[0].style)).toEqual(['LIGHT', 'HEAVY']);
    await Promise.resolve();
  });

  it('subscribes to App pause/resume and unsubscribes', async () => {
    const remove = vi.fn(async () => {});
    const cbs: Record<string, () => void> = {};
    const app: AppApi = {
      addListener: async (event, cb) => {
        cbs[event] = cb;
        return { remove };
      },
    };
    const lc = new NativeLifecycle(app);
    const onPause = vi.fn();
    const off = lc.onPause(onPause);
    lc.onResume(() => {});
    cbs.pause?.();
    expect(onPause).toHaveBeenCalledOnce();
    expect(Object.keys(cbs).sort()).toEqual(['pause', 'resume']);
    off();
    await Promise.resolve();
    await Promise.resolve();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('orientation lock resolves even when refused', async () => {
    const o = new NativeOrientation({ lock: async () => Promise.reject(new Error('no')) });
    await expect(o.lockPortrait()).resolves.toBeUndefined();
  });
});

describe('isNativeRuntime', () => {
  it('reads the injected Capacitor global', () => {
    expect(isNativeRuntime({})).toBe(false);
    expect(isNativeRuntime({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(isNativeRuntime({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
  });
});
