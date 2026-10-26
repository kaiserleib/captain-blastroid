import type { StorageAdapter } from '../platform';

/** The subset of `@capacitor/preferences` we use; injectable for tests. */
export interface PreferencesApi {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

/**
 * Native key-value storage (UserDefaults / SharedPreferences). iOS may evict
 * WKWebView localStorage under storage pressure; Preferences is never evicted.
 */
export class PreferencesStorage implements StorageAdapter {
  constructor(private readonly prefs: PreferencesApi) {}

  async get(key: string): Promise<string | null> {
    return (await this.prefs.get({ key })).value;
  }

  set(key: string, value: string): Promise<void> {
    return this.prefs.set({ key, value });
  }

  remove(key: string): Promise<void> {
    return this.prefs.remove({ key });
  }
}

/** Enumerable Web Storage subset, so migration can find every game key. */
export interface EnumerableBacking {
  readonly length: number;
  key(i: number): string | null;
  getItem(key: string): string | null;
}

export const KEY_PREFIX = 'captain-blastroid.';
export const MIGRATED_KEY = 'captain-blastroid.migratedFromLocalStorage';

/**
 * One-time copy of the game's localStorage keys into Preferences on the first
 * native launch. Values already in Preferences win, and localStorage is left
 * intact as a fallback copy. Returns the number of keys copied.
 */
export async function migrateFromLocalStorage(
  prefs: PreferencesApi,
  backing: EnumerableBacking | null,
): Promise<number> {
  if ((await prefs.get({ key: MIGRATED_KEY })).value !== null) return 0;
  let copied = 0;
  if (backing) {
    const keys: string[] = [];
    for (let i = 0; i < backing.length; i++) {
      const k = backing.key(i);
      if (k !== null && k.startsWith(KEY_PREFIX) && k !== MIGRATED_KEY) keys.push(k);
    }
    for (const key of keys) {
      const value = backing.getItem(key);
      if (value === null) continue;
      if ((await prefs.get({ key })).value !== null) continue;
      await prefs.set({ key, value });
      copied++;
    }
  }
  await prefs.set({ key: MIGRATED_KEY, value: String(Date.now()) });
  return copied;
}

export function defaultLocalStorage(): EnumerableBacking | null {
  try {
    const ls = (globalThis as { localStorage?: EnumerableBacking }).localStorage;
    return ls && typeof ls.getItem === 'function' ? ls : null;
  } catch {
    return null;
  }
}
