import type { StorageAdapter } from '../platform';

/** The subset of the Web Storage API we use. */
export interface KeyValueBacking {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

function defaultBacking(): KeyValueBacking | null {
  // Merely reading `localStorage` throws in some sandboxed / privacy modes.
  try {
    const ls = (globalThis as { localStorage?: KeyValueBacking }).localStorage;
    return ls && typeof ls.getItem === 'function' ? ls : null;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed storage. Any failing call (missing storage, quota,
 * Safari private mode) switches to an in-memory map for the rest of the
 * session, so the game keeps working without persistence.
 */
export class WebStorage implements StorageAdapter {
  private backing: KeyValueBacking | null | undefined;
  private readonly memory = new MemoryStorage();

  constructor(private readonly getBacking: () => KeyValueBacking | null = defaultBacking) {}

  /** True once storage has fallen back to memory. */
  get volatile(): boolean {
    return this.resolve() === null;
  }

  private resolve(): KeyValueBacking | null {
    if (this.backing === undefined) this.backing = this.getBacking();
    return this.backing;
  }

  private fallBack(): void {
    if (this.backing) console.warn('localStorage unavailable; saves will not persist');
    this.backing = null;
  }

  async get(key: string): Promise<string | null> {
    const b = this.resolve();
    if (b) {
      try {
        return b.getItem(key);
      } catch {
        this.fallBack();
      }
    }
    return this.memory.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    const b = this.resolve();
    if (b) {
      try {
        b.setItem(key, value);
        return;
      } catch {
        this.fallBack();
      }
    }
    await this.memory.set(key, value);
  }

  async remove(key: string): Promise<void> {
    const b = this.resolve();
    if (b) {
      try {
        b.removeItem(key);
        return;
      } catch {
        this.fallBack();
      }
    }
    await this.memory.remove(key);
  }
}
