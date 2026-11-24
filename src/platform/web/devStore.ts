import type { PurchaseOutcome, Store, StoreProduct } from '../platform';

/** `?dlc=store` (dev): an in-memory store, to walk the buy and restore flows in a browser. */
export class DevStore implements Store {
  private readonly ids: string[] = [];

  owned(): Promise<string[]> {
    return Promise.resolve([...this.ids]);
  }

  product(id: string): Promise<StoreProduct | null> {
    return Promise.resolve({ id, price: '$0.00 TEST' });
  }

  purchase(id: string): Promise<PurchaseOutcome> {
    // Long enough to see the waiting state.
    return new Promise((resolve) =>
      setTimeout(() => {
        if (!this.ids.includes(id)) this.ids.push(id);
        resolve('purchased');
      }, 800),
    );
  }

  restore(): Promise<string[]> {
    return new Promise((resolve) => setTimeout(() => resolve([...this.ids]), 800));
  }

  onChange(): () => void {
    return () => {};
  }
}
