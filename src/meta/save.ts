// Save persistence through a StorageAdapter. No DOM: storage and lifecycle are injected.
import type { Lifecycle, StorageAdapter } from '../platform/platform';
import {
  DEFAULT_SETTINGS,
  SaveFormatError,
  createDefaultSave,
  parseSave,
  serializeSave,
  type SaveData,
  type Settings,
} from './schema';

export const SAVE_KEY = 'captain-blastroid.save';
/** Where an unreadable save is copied before defaults replace it. */
export const CORRUPT_BACKUP_KEY = 'captain-blastroid.save.corrupt';
export const SAVE_DEBOUNCE_MS = 500;

export interface SaveStoreOptions {
  key?: string;
  backupKey?: string;
  debounceMs?: number;
}

export class SaveStore {
  private current: SaveData = createDefaultSave();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(save: SaveData) => void>();
  private readonly key: string;
  private readonly backupKey: string;
  private readonly debounceMs: number;
  /** True when the last load found corrupt data (and backed it up). */
  recovered = false;

  constructor(
    private readonly storage: StorageAdapter,
    opts: SaveStoreOptions = {},
  ) {
    this.key = opts.key ?? SAVE_KEY;
    this.backupKey = opts.backupKey ?? CORRUPT_BACKUP_KEY;
    this.debounceMs = opts.debounceMs ?? SAVE_DEBOUNCE_MS;
  }

  get data(): SaveData {
    return this.current;
  }

  get pending(): boolean {
    return this.timer !== null;
  }

  async load(): Promise<SaveData> {
    this.recovered = false;
    let raw: string | null = null;
    try {
      raw = await this.storage.get(this.key);
    } catch (e) {
      console.warn('Save read failed; using defaults', e);
    }
    if (raw === null) {
      this.current = createDefaultSave();
    } else {
      try {
        this.current = parseSave(raw);
      } catch (e) {
        if (!(e instanceof SaveFormatError)) throw e;
        console.warn('Corrupt save backed up and reset', e.message);
        this.recovered = true;
        this.current = createDefaultSave();
        try {
          await this.storage.set(this.backupKey, raw);
        } catch {
          // Losing the backup is better than failing to boot.
        }
        await this.saveNow();
      }
    }
    this.notify();
    return this.current;
  }

  /** Replaces the save and schedules a debounced write. */
  set(next: SaveData): void {
    this.current = next;
    this.notify();
    this.save();
  }

  update(fn: (save: SaveData) => SaveData): SaveData {
    this.set(fn(this.current));
    return this.current;
  }

  /** Schedules a debounced write of the current save. */
  save(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.write();
    }, this.debounceMs);
  }

  /** Writes immediately (pause/pagehide, results screen). Resolves once stored. */
  saveNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.write();
  }

  /** Calls `cb` whenever the save is loaded or replaced. Returns an unsubscribe function. */
  onChange(cb: (save: SaveData) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Flushes pending writes when the app is backgrounded. Returns an unsubscribe function. */
  bindLifecycle(lifecycle: Lifecycle): () => void {
    return lifecycle.onPause(() => {
      void this.saveNow();
    });
  }

  private write(): Promise<void> {
    // Chain writes so a slow adapter can't land an older snapshot after a newer one.
    const json = serializeSave(this.current);
    this.writing = this.writing
      .then(() => this.storage.set(this.key, json))
      .catch((e: unknown) => console.warn('Save write failed', e));
    return this.writing;
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.current);
  }
}

// App-wide store. Boot calls `initSave(platform.storage, platform.lifecycle)` once.

let store: SaveStore | null = null;
const appListeners = new Set<(save: SaveData) => void>();

export async function initSave(
  storage: StorageAdapter,
  lifecycle?: Lifecycle,
  opts?: SaveStoreOptions,
): Promise<SaveStore> {
  store = new SaveStore(storage, opts);
  store.onChange((save) => {
    for (const cb of appListeners) cb(save);
  });
  if (lifecycle) store.bindLifecycle(lifecycle);
  await store.load();
  return store;
}

export function getSaveStore(): SaveStore {
  if (!store) throw new Error('initSave() has not been called');
  return store;
}

/** Current save, or defaults before `initSave` resolves. */
export function getSave(): SaveData {
  return store?.data ?? createDefaultSave();
}

export function setSave(next: SaveData): void {
  getSaveStore().set(next);
}

export function saveNow(): Promise<void> {
  return store ? store.saveNow() : Promise.resolve();
}

/** Synchronous settings read; defaults until the save has loaded. */
export function getSettings(): Readonly<Settings> {
  return store?.data.settings ?? DEFAULT_SETTINGS;
}

/** Merges `patch` into settings and saves immediately (settings UI writes are rare). */
export function updateSettings(patch: Partial<Settings>): Settings {
  const s = getSaveStore();
  s.set({ ...s.data, settings: { ...s.data.settings, ...patch } });
  void s.saveNow();
  return s.data.settings;
}

/** Works before `initSave`; fires on load and on every change. Returns an unsubscribe function. */
export function onSaveChange(cb: (save: SaveData) => void): () => void {
  appListeners.add(cb);
  return () => appListeners.delete(cb);
}

/** Test helper. */
export function resetSaveStore(): void {
  store = null;
  appListeners.clear();
}
