import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lifecycle, StorageAdapter } from '../platform/platform';
import { MemoryStorage } from '../platform/web/storage';
import {
  CORRUPT_BACKUP_KEY,
  PRE_IMPORT_BACKUP_KEY,
  SAVE_KEY,
  SaveStore,
  getSettings,
  initSave,
  onSaveChange,
  resetSaveStore,
  updateSettings,
} from './save';
import { DEFAULT_SETTINGS, createDefaultSave } from './schema';

// Drains the write chain's microtasks (setTimeout is faked in these tests).
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('SaveStore', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    resetSaveStore();
  });

  it('loads defaults from empty storage without writing', async () => {
    const mem = new MemoryStorage();
    const store = new SaveStore(mem);
    expect(await store.load()).toEqual(createDefaultSave());
    expect(mem.data.size).toBe(0);
  });

  it('round-trips save → load', async () => {
    const mem = new MemoryStorage();
    const a = new SaveStore(mem);
    await a.load();
    a.set({ ...a.data, salvage: 77, schematics: ['bulwark'] });
    await a.saveNow();

    const b = new SaveStore(mem);
    const loaded = await b.load();
    expect(loaded.salvage).toBe(77);
    expect(loaded.schematics).toEqual(['bulwark']);
  });

  it('debounces writes', async () => {
    const mem = new MemoryStorage();
    const setSpy = vi.spyOn(mem, 'set');
    const store = new SaveStore(mem, { debounceMs: 500 });
    await store.load();
    store.set({ ...store.data, salvage: 1 });
    store.set({ ...store.data, salvage: 2 });
    store.set({ ...store.data, salvage: 3 });
    expect(store.pending).toBe(true);
    vi.advanceTimersByTime(499);
    expect(setSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await flush();
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '').salvage).toBe(3);
  });

  it('saveNow cancels the pending debounce', async () => {
    const mem = new MemoryStorage();
    const setSpy = vi.spyOn(mem, 'set');
    const store = new SaveStore(mem);
    await store.load();
    store.set({ ...store.data, salvage: 9 });
    await store.saveNow();
    vi.advanceTimersByTime(10_000);
    await flush();
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('backs up corrupt data and resets to defaults', async () => {
    const mem = new MemoryStorage();
    await mem.set(SAVE_KEY, '{not json');
    const store = new SaveStore(mem);
    const loaded = await store.load();
    expect(loaded).toEqual(createDefaultSave());
    expect(store.recovered).toBe(true);
    expect(mem.data.get(CORRUPT_BACKUP_KEY)).toBe('{not json');
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '')).toEqual(createDefaultSave());
  });

  it('upgrades a stored v1 save on load and writes v2 on the next save', async () => {
    const mem = new MemoryStorage();
    const v1 = {
      ...createDefaultSave(),
      version: 1,
      salvage: 6,
      stats: { runs: 1, kills: 4, deaths: 0, bossKills: 1 },
    };
    delete (v1 as Partial<typeof v1>).levels;
    await mem.set(SAVE_KEY, JSON.stringify(v1));
    const store = new SaveStore(mem);
    const loaded = await store.load();
    expect(store.recovered).toBe(false);
    expect(loaded.salvage).toBe(6);
    expect(loaded.levels).toEqual({ kessler: { clears: 1, best: 0 } });
    await store.saveNow();
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '').version).toBe(2);
  });

  it('imports a save after backing up the current one', async () => {
    const mem = new MemoryStorage();
    const store = new SaveStore(mem);
    await store.load();
    store.set({ ...store.data, salvage: 11 });
    const seen: number[] = [];
    store.onChange((s) => seen.push(s.salvage));
    await store.replaceWithImport({ ...createDefaultSave(), salvage: 999 });
    expect(seen).toEqual([999]);
    expect(store.pending).toBe(false);
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '').salvage).toBe(999);
    expect(JSON.parse(mem.data.get(PRE_IMPORT_BACKUP_KEY) ?? '').salvage).toBe(11);
  });

  it('survives a storage adapter that throws', async () => {
    const broken: StorageAdapter = {
      get: () => Promise.reject(new Error('nope')),
      set: () => Promise.reject(new Error('nope')),
      remove: () => Promise.reject(new Error('nope')),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new SaveStore(broken);
    expect(await store.load()).toEqual(createDefaultSave());
    await expect(store.saveNow()).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('flushes on lifecycle pause', async () => {
    const mem = new MemoryStorage();
    let pause: () => void = () => {};
    const lifecycle: Lifecycle = {
      onPause: (cb) => {
        pause = cb;
        return () => {};
      },
      onResume: () => () => {},
    };
    const store = await initSave(mem, lifecycle);
    store.set({ ...store.data, salvage: 42 });
    expect(mem.data.has(SAVE_KEY)).toBe(false);
    pause();
    await flush();
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '').salvage).toBe(42);
  });
});

describe('settings accessors', () => {
  afterEach(() => resetSaveStore());

  it('getSettings returns defaults before load, then the loaded values', async () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    const mem = new MemoryStorage();
    const saved = createDefaultSave();
    saved.settings.stickOpacity = 0.8;
    await mem.set(SAVE_KEY, JSON.stringify(saved));
    await initSave(mem);
    expect(getSettings().stickOpacity).toBe(0.8);
  });

  it('updateSettings persists immediately and notifies listeners', async () => {
    const mem = new MemoryStorage();
    const seen: number[] = [];
    onSaveChange((s) => seen.push(s.settings.stickRadiusScale));
    await initSave(mem);
    updateSettings({ stickRadiusScale: 1.5 });
    await flush();
    expect(getSettings().stickRadiusScale).toBe(1.5);
    expect(JSON.parse(mem.data.get(SAVE_KEY) ?? '').settings.stickRadiusScale).toBe(1.5);
    expect(seen).toEqual([1, 1.5]);
  });
});
