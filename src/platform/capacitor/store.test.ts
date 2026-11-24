import { describe, expect, it, vi } from 'vitest';
import { NativeStore, purchaseFailure, type PurchaseRecord, type PurchasesApi } from './store';

function fakeApi(over: Partial<PurchasesApi> = {}): PurchasesApi {
  return {
    getPurchases: async () => ({ purchases: [] }),
    getProducts: async () => ({ products: [] }),
    purchaseProduct: async (o) => ({ productIdentifier: o.productIdentifier }),
    restorePurchases: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    ...over,
  };
}

describe('NativeStore', () => {
  it('owned() skips refunded and pending purchases, and asks for current entitlements', async () => {
    const purchases: PurchaseRecord[] = [
      { productIdentifier: 'a' },
      { productIdentifier: 'a' },
      { productIdentifier: 'b', revocationDate: '2026-11-01T00:00:00Z' },
      { productIdentifier: 'c', purchaseState: '0' },
      { productIdentifier: 'd', purchaseState: '1' },
    ];
    const getPurchases = vi.fn(async () => ({ purchases }));
    const store = new NativeStore(fakeApi({ getPurchases }));
    expect(await store.owned()).toEqual(['a', 'd']);
    expect(getPurchases).toHaveBeenCalledWith({
      productType: 'inapp',
      onlyCurrentEntitlements: true,
    });
  });

  it('product() returns the localized price, or null when unknown or offline', async () => {
    const ok = new NativeStore(
      fakeApi({
        getProducts: async () => ({ products: [{ identifier: 'a', priceString: '2,99 €' }] }),
      }),
    );
    expect(await ok.product('a')).toEqual({ id: 'a', price: '2,99 €' });
    expect(await ok.product('b')).toBeNull();
    const down = new NativeStore(fakeApi({ getProducts: () => Promise.reject(new Error('x')) }));
    expect(await down.product('a')).toBeNull();
  });

  it('purchase() maps the plugin results', async () => {
    expect(await new NativeStore(fakeApi()).purchase('a')).toBe('purchased');
    const pending = fakeApi({
      purchaseProduct: async () => ({ productIdentifier: 'a', purchaseState: '0' }),
    });
    expect(await new NativeStore(pending).purchase('a')).toBe('pending');
    const cancel = fakeApi({ purchaseProduct: () => Promise.reject(new Error('User cancelled')) });
    expect(await new NativeStore(cancel).purchase('a')).toBe('cancelled');
  });

  it('sorts rejected purchases', () => {
    expect(purchaseFailure(new Error('Transaction pending'))).toBe('pending');
    expect(purchaseFailure({ message: 'Purchase is not purchased', code: 'USER_CANCELED' })).toBe(
      'cancelled',
    );
    expect(
      purchaseFailure({ message: 'Purchase is not purchased', code: 'ITEM_ALREADY_OWNED' }),
    ).toBe('purchased');
    expect(purchaseFailure({ message: 'boom', code: 'NETWORK_ERROR' })).toBe('failed');
    expect(purchaseFailure(null)).toBe('failed');
  });

  it('restore() re-syncs, then reports ownership', async () => {
    const restorePurchases = vi.fn(async () => {});
    const store = new NativeStore(
      fakeApi({
        restorePurchases,
        getPurchases: async () => ({ purchases: [{ productIdentifier: 'a' }] }),
      }),
    );
    expect(await store.restore()).toEqual(['a']);
    expect(restorePurchases).toHaveBeenCalledOnce();
  });
});
