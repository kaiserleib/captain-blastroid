import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist';

describe('requestPersistentStorage', () => {
  it('is false without the StorageManager API', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
    expect(await requestPersistentStorage({})).toBe(false);
  });

  it('skips the request when already persistent', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistentStorage({ persisted: async () => true, persist })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports what the browser grants', async () => {
    expect(
      await requestPersistentStorage({ persisted: async () => false, persist: async () => true }),
    ).toBe(true);
    expect(await requestPersistentStorage({ persist: async () => false })).toBe(false);
  });

  it('swallows rejections', async () => {
    const persist = async (): Promise<boolean> => {
      throw new Error('denied');
    };
    expect(await requestPersistentStorage({ persist })).toBe(false);
  });
});
