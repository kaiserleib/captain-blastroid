// Which content packs this install owns. Kept out of SaveData on purpose: a save code
// carries progress between devices, and ownership has to come from the store account.
import {
  PACKS,
  PACK_ORDER,
  packForProduct,
  packOf,
  type PackContent,
  type PackId,
} from '../content';
import type { PurchaseOutcome, StorageAdapter, Store } from '../platform/platform';
import { milestone } from './telemetry';

/** Last known store ownership, so an offline launch still opens what was paid for. */
export const OWNED_PACKS_KEY = 'captain-blastroid.packs';
/** Free packs the player has claimed. The store knows nothing about these. */
export const CLAIMED_PACKS_KEY = 'captain-blastroid.packs.claimed';

// Until a store says otherwise (web, tests, sims) every pack is owned.
let owned: readonly PackId[] = PACK_ORDER;
let bought: readonly PackId[] = [];
let claimed: readonly PackId[] = [];
let store: Store | null = null;
let storage: StorageAdapter | null = null;
/** Bumped on every local change, so a store query that started earlier can't undo it. */
let epoch = 0;
const listeners = new Set<() => void>();

export function ownsPack(id: PackId): boolean {
  return owned.includes(id);
}

/** True for base-game content and for content of an owned pack. */
export function owns(kind: PackContent, id: string): boolean {
  const pack = packOf(kind, id);
  return pack === null || owned.includes(pack);
}

/** Whether packs can be bought or claimed here. Never on the web build, which has no store. */
export function canGetPacks(): boolean {
  return store !== null;
}

function setOwned(next: readonly PackId[]): void {
  epoch++;
  const changed = next.length !== owned.length || next.some((id) => !owned.includes(id));
  owned = next;
  if (changed) for (const cb of listeners) cb();
}

function write(key: string, ids: readonly PackId[]): void {
  void storage?.set(key, JSON.stringify(ids)).catch(() => {});
}

/** Owned = bought from the store account + free packs claimed on this install. */
function apply(fromStore: readonly PackId[], persist = true): void {
  bought = PACK_ORDER.filter((id) => fromStore.includes(id));
  if (persist) write(OWNED_PACKS_KEY, bought);
  setOwned(PACK_ORDER.filter((id) => bought.includes(id) || claimed.includes(id)));
}

/** Replaces ownership outright (tests, `?dlc=0`). */
export function setOwnedPacks(ids: readonly PackId[]): void {
  bought = [];
  claimed = [];
  setOwned(PACK_ORDER.filter((id) => ids.includes(id)));
}

function packsFor(productIds: readonly string[]): PackId[] {
  const out: PackId[] = [];
  for (const pid of productIds) {
    const pack = packForProduct(pid);
    if (pack !== null && !out.includes(pack)) out.push(pack);
  }
  return out;
}

async function readList(from: StorageAdapter, key: string): Promise<PackId[]> {
  try {
    const raw = await from.get(key);
    const ids: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(ids) ? PACK_ORDER.filter((id) => ids.includes(id)) : [];
  } catch {
    return [];
  }
}

export interface EntitlementOptions {
  /** No store, and nothing owned: the web build previewing (or shipping) the base game. */
  locked?: boolean;
}

/**
 * With a store: start from the cached answer, then ask the store in the background
 * (boot never waits on the network). Without one: everything is owned unless `locked`.
 */
export async function initEntitlements(
  storageAdapter: StorageAdapter,
  s: Store | null,
  opts: EntitlementOptions = {},
): Promise<void> {
  store = s;
  storage = null;
  bought = [];
  claimed = [];
  if (!s) {
    setOwned(opts.locked ? [] : PACK_ORDER);
    return;
  }
  // A pack that stops being free keeps working for those who claimed it.
  claimed = await readList(storageAdapter, CLAIMED_PACKS_KEY);
  apply(await readList(storageAdapter, OWNED_PACKS_KEY), false);
  storage = storageAdapter;
  try {
    s.onChange(() => void refreshEntitlements());
  } catch (e) {
    console.warn('Store change events unavailable', e);
  }
  void refreshEntitlements();
}

/** Asks the store what is owned. A failed query keeps the current answer; resolves false. */
export async function refreshEntitlements(): Promise<boolean> {
  if (!store) return true;
  const started = epoch;
  try {
    const ids = await store.owned();
    if (epoch === started) apply(packsFor(ids));
    return true;
  } catch (e) {
    console.warn('Store ownership query failed', e);
    return false;
  }
}

/** The store's localized price; null for a free pack or when it can't be fetched. */
export async function packPrice(id: PackId): Promise<string | null> {
  const productId = PACKS[id].productId;
  if (productId === null) return null;
  const p = await store?.product(productId);
  return p?.price ?? null;
}

/** Buys a paid pack from the store, or claims a free one on the spot. */
export async function buyPack(id: PackId): Promise<PurchaseOutcome> {
  if (!store) return 'failed';
  const productId = PACKS[id].productId;
  if (productId === null) {
    if (!claimed.includes(id)) claimed = [...claimed, id];
    write(CLAIMED_PACKS_KEY, claimed);
    apply(bought, false);
    milestone(`pack_get_${id}`);
    return 'purchased';
  }
  const outcome = await store.purchase(productId);
  if (outcome === 'purchased') {
    apply([...bought, id]);
    milestone(`pack_get_${id}`);
  }
  return outcome;
}

export type RestoreOutcome = 'restored' | 'nothing' | 'failed';

export async function restorePacks(): Promise<RestoreOutcome> {
  if (!store) return 'failed';
  try {
    apply(packsFor(await store.restore()));
    return bought.length > 0 ? 'restored' : 'nothing';
  } catch (e) {
    console.warn('Restore failed', e);
    return 'failed';
  }
}

/** Fires when the owned set changes. Returns an unsubscribe function. */
export function onEntitlementsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Test helper: back to "no store, everything owned". */
export function resetEntitlements(): void {
  store = null;
  storage = null;
  owned = PACK_ORDER;
  bought = [];
  claimed = [];
  epoch++;
  listeners.clear();
}
