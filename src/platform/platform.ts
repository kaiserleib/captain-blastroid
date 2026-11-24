// Platform-service interfaces. Web implementations live in ./web; Capacitor ones arrive in T19.

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export type HapticKind = 'light' | 'medium' | 'heavy';

export interface Haptics {
  /** Fire-and-forget; a no-op where unsupported. Callers check `settings.haptics`. */
  impact(kind: HapticKind): void;
}

export interface Lifecycle {
  /** Returns an unsubscribe function. */
  onPause(cb: () => void): () => void;
  onResume(cb: () => void): () => void;
}

export interface Orientation {
  /** Best effort; resolves even when the lock is refused. */
  lockPortrait(): Promise<void>;
}

export interface StoreProduct {
  id: string;
  /** Localized by the store, e.g. `$2.99`. */
  price: string;
}

/** `pending`: the store took the request but hasn't charged yet (Ask to Buy, slow payment). */
export type PurchaseOutcome = 'purchased' | 'cancelled' | 'pending' | 'failed';

/** In-app purchases of non-consumable products. */
export interface Store {
  /** Product ids this store account owns right now. Rejects when the store can't say. */
  owned(): Promise<string[]>;
  /** Null when the store doesn't know the product (not set up yet, or offline). */
  product(id: string): Promise<StoreProduct | null>;
  purchase(id: string): Promise<PurchaseOutcome>;
  /** Re-syncs with the store account (may ask the player to sign in), then resolves like `owned`. */
  restore(): Promise<string[]>;
  /** Fires when ownership may have changed outside `purchase` (a pending purchase approved, a refund). */
  onChange(cb: () => void): () => void;
}

export interface Platform {
  readonly kind: 'web' | 'native';
  readonly storage: StorageAdapter;
  readonly haptics: Haptics;
  readonly lifecycle: Lifecycle;
  readonly orientation: Orientation;
  /** Null where nothing is sold (the web build): every content pack is simply there. */
  readonly store: Store | null;
}
