import { describe, expect, it, vi } from 'vitest';
import { createWebPlatform } from './index';
import { WebHaptics } from './web/haptics';
import { MemoryStorage, WebStorage, type KeyValueBacking } from './web/storage';

function mapBacking(): KeyValueBacking & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('MemoryStorage', () => {
  it('get / set / remove', async () => {
    const m = new MemoryStorage();
    expect(await m.get('a')).toBeNull();
    await m.set('a', '1');
    expect(await m.get('a')).toBe('1');
    await m.remove('a');
    expect(await m.get('a')).toBeNull();
  });
});

describe('WebStorage', () => {
  it('uses the backing store', async () => {
    const b = mapBacking();
    const s = new WebStorage(() => b);
    await s.set('k', 'v');
    expect(b.map.get('k')).toBe('v');
    expect(await s.get('k')).toBe('v');
    await s.remove('k');
    expect(b.map.has('k')).toBe(false);
    expect(s.volatile).toBe(false);
  });

  it('falls back to memory when storage is missing', async () => {
    const s = new WebStorage(() => null);
    await s.set('k', 'v');
    expect(await s.get('k')).toBe('v');
    expect(s.volatile).toBe(true);
  });

  it('falls back to memory when a call throws (quota / private mode)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b = mapBacking();
    b.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const s = new WebStorage(() => b);
    await s.set('k', 'v');
    expect(await s.get('k')).toBe('v');
    expect(s.volatile).toBe(true);
    warn.mockRestore();
  });
});

describe('WebHaptics', () => {
  it('vibrates with a per-kind duration', () => {
    const vibrate = vi.fn(() => true);
    const h = new WebHaptics(vibrate);
    h.impact('light');
    h.impact('heavy');
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, 35);
  });

  it('is a no-op without navigator.vibrate', () => {
    expect(() => new WebHaptics(null).impact('medium')).not.toThrow();
  });
});

describe('createWebPlatform', () => {
  it('constructs in Node without touching the DOM', async () => {
    const p = createWebPlatform();
    expect(p.kind).toBe('web');
    await p.storage.set('x', '1');
    expect(await p.storage.get('x')).toBe('1');
    await expect(p.orientation.lockPortrait()).resolves.toBeUndefined();
  });
});
