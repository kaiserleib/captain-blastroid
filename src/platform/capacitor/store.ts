import type { PurchaseOutcome, Store, StoreProduct } from '../platform';
import type { ListenerHandle } from './services';

// @capgo/native-purchases (StoreKit 2 / Play Billing), typed structurally like the
// other plugin wrappers so tests can pass a fake.

export interface PurchaseRecord {
  productIdentifier: string;
  /** iOS: set once Apple refunds or revokes the purchase. */
  revocationDate?: string;
  /** Android: "1" is paid; "0" is still pending. Absent on iOS. */
  purchaseState?: string;
}

export interface PurchasesApi {
  getPurchases(o: {
    productType: 'inapp';
    onlyCurrentEntitlements: boolean;
  }): Promise<{ purchases: PurchaseRecord[] }>;
  getProducts(o: {
    productIdentifiers: string[];
    productType: 'inapp';
  }): Promise<{ products: { identifier: string; priceString: string }[] }>;
  purchaseProduct(o: {
    productIdentifier: string;
    productType: 'inapp';
    quantity: number;
  }): Promise<PurchaseRecord>;
  restorePurchases(): Promise<void>;
  addListener(event: 'transactionUpdated', cb: () => void): Promise<ListenerHandle>;
}

function isOwned(p: PurchaseRecord): boolean {
  if (p.revocationDate) return false;
  return p.purchaseState === undefined || p.purchaseState === '1';
}

/** Sorts a rejected purchase: the plugin reports cancel and pending as errors too. */
export function purchaseFailure(e: unknown): PurchaseOutcome {
  const err = e as { message?: unknown; code?: unknown } | null;
  const text = `${String(err?.code ?? '')} ${String(err?.message ?? '')}`.toLowerCase();
  // Play says this when a purchase from another device hasn't synced yet: it is paid for.
  if (text.includes('already_owned')) return 'purchased';
  if (text.includes('cancel')) return 'cancelled';
  if (text.includes('pending')) return 'pending';
  return 'failed';
}

export class NativeStore implements Store {
  constructor(private readonly api: PurchasesApi) {}

  async owned(): Promise<string[]> {
    // Current entitlements only, so a previous owner's purchases on a shared device don't count.
    const { purchases } = await this.api.getPurchases({
      productType: 'inapp',
      onlyCurrentEntitlements: true,
    });
    const out: string[] = [];
    for (const p of purchases) {
      if (isOwned(p) && !out.includes(p.productIdentifier)) out.push(p.productIdentifier);
    }
    return out;
  }

  async product(id: string): Promise<StoreProduct | null> {
    try {
      const { products } = await this.api.getProducts({
        productIdentifiers: [id],
        productType: 'inapp',
      });
      const p = products.find((x) => x.identifier === id);
      return p ? { id, price: p.priceString } : null;
    } catch {
      return null;
    }
  }

  async purchase(id: string): Promise<PurchaseOutcome> {
    try {
      const t = await this.api.purchaseProduct({
        productIdentifier: id,
        productType: 'inapp',
        quantity: 1,
      });
      return isOwned(t) ? 'purchased' : 'pending';
    } catch (e) {
      return purchaseFailure(e);
    }
  }

  async restore(): Promise<string[]> {
    await this.api.restorePurchases();
    return this.owned();
  }

  onChange(cb: () => void): () => void {
    const handle = this.api.addListener('transactionUpdated', cb);
    // Without the event, ownership is still re-checked at boot and on resume.
    handle.catch(() => {});
    return () => {
      void handle.then((h) => h.remove()).catch(() => {});
    };
  }
}
