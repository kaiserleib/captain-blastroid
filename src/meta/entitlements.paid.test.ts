import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseOutcome, Store } from '../platform/platform';
import { MemoryStorage } from '../platform';
import {
  OWNED_PACKS_KEY,
  buyPack,
  canGetPacks,
  initEntitlements,
  onEntitlementsChange,
  ownsPack,
  packPrice,
  refreshEntitlements,
  resetEntitlements,
  restorePacks,
} from './entitlements';

// Act II ships free, so the paid path is exercised by pricing it here: this is the
// path the next, paid pack will take.
const PRODUCT = 'act2_expansion';
vi.mock('../content', async (original) => {
  const m = await original<typeof import('../content')>();
  return {
    ...m,
    PACKS: { act2: { ...m.PACKS.act2, productId: 'act2_expansion' } },
    isFreePack: () => false,
    packForProduct: (id: string) => (id === 'act2_expansion' ? 'act2' : null),
  };
});

class FakeStore implements Store {
  ownedIds: string[] = [];
  outcome: PurchaseOutcome = 'purchased';
  offline = false;
  changed: (() => void) | null = null;
  async owned(): Promise<string[]> {
    if (this.offline) throw new Error('offline');
    return [...this.ownedIds];
  }
  async product(id: string): Promise<{ id: string; price: string }> {
    return { id, price: '$2.99' };
  }
  async purchase(id: string): Promise<PurchaseOutcome> {
    if (this.outcome === 'purchased') this.ownedIds.push(id);
    return this.outcome;
  }
  async restore(): Promise<string[]> {
    return this.owned();
  }
  onChange(cb: () => void): () => void {
    this.changed = cb;
    return () => {};
  }
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => resetEntitlements());

describe('a paid pack', () => {
  it('a store install starts locked and opens what the store reports', async () => {
    const store = new FakeStore();
    const storage = new MemoryStorage();
    await initEntitlements(storage, store);
    expect(ownsPack('act2')).toBe(false);
    expect(canGetPacks()).toBe(true);
    expect(await packPrice('act2')).toBe('$2.99');
    store.ownedIds = [PRODUCT];
    await refreshEntitlements();
    expect(ownsPack('act2')).toBe(true);
    expect(await storage.get(OWNED_PACKS_KEY)).toBe('["act2"]');
  });

  it('an offline launch trusts the cache; a refund reported later removes the pack', async () => {
    const store = new FakeStore();
    store.offline = true;
    const storage = new MemoryStorage();
    await storage.set(OWNED_PACKS_KEY, '["act2"]');
    await initEntitlements(storage, store);
    await flush();
    expect(ownsPack('act2')).toBe(true);
    store.offline = false;
    store.changed?.();
    await flush();
    expect(ownsPack('act2')).toBe(false);
  });

  it('buying unlocks at once and notifies; cancel and pending do not', async () => {
    const store = new FakeStore();
    await initEntitlements(new MemoryStorage(), store);
    await flush();
    const cb = vi.fn();
    onEntitlementsChange(cb);
    store.outcome = 'cancelled';
    expect(await buyPack('act2')).toBe('cancelled');
    store.outcome = 'pending';
    expect(await buyPack('act2')).toBe('pending');
    expect(ownsPack('act2')).toBe(false);
    store.outcome = 'purchased';
    expect(await buyPack('act2')).toBe('purchased');
    expect(ownsPack('act2')).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('restore reports what it found', async () => {
    const store = new FakeStore();
    await initEntitlements(new MemoryStorage(), store);
    await flush();
    expect(await restorePacks()).toBe('nothing');
    store.ownedIds = [PRODUCT];
    expect(await restorePacks()).toBe('restored');
    expect(ownsPack('act2')).toBe(true);
    store.offline = true;
    expect(await restorePacks()).toBe('failed');
    expect(ownsPack('act2')).toBe(true);
  });
});
