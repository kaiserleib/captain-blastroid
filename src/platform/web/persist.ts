interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

/**
 * Asks the browser not to evict our storage under pressure. Chrome grants it silently to
 * engaged or installed sites, Firefox may prompt, Safari mostly ignores it. Never throws.
 * Resolves true when storage is (now) persistent.
 */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = (
    globalThis as { navigator?: { storage?: StorageManagerLike } }
  ).navigator?.storage,
): Promise<boolean> {
  try {
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
