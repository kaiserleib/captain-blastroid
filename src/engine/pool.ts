import { flags } from '../debug/flags';

/**
 * Fixed-capacity object pool. Objects are created once up front and recycled.
 * Live objects occupy `items[0..count)`; released ones stay there with
 * `active=false` until `compact()` (run by the cleanup system), so releasing
 * during iteration or event dispatch is always safe.
 */
export class Pool<T extends { active: boolean }> {
  readonly items: T[];
  count = 0;
  /** Spawns refused because the pool was full. Should stay 0; T20 asserts it. */
  droppedSpawns = 0;
  private dirty = false;

  constructor(
    readonly name: string,
    readonly capacity: number,
    create: () => T,
  ) {
    this.items = new Array<T>(capacity);
    for (let i = 0; i < capacity; i++) {
      const obj = create();
      obj.active = false;
      this.items[i] = obj;
    }
  }

  /** Returns a recycled object with stale fields; the caller must reset all of them. */
  spawn(): T | null {
    if (this.count >= this.capacity) {
      if (this.droppedSpawns++ === 0 && flags.debug) {
        console.warn(`Pool "${this.name}" full (${this.capacity}); dropping spawns`);
      }
      return null;
    }
    const obj = this.items[this.count++] as T;
    obj.active = true;
    return obj;
  }

  /** Deferred: the slot is reclaimed by the next `compact()`. */
  release(obj: T): void {
    if (!obj.active) return;
    obj.active = false;
    this.dirty = true;
  }

  /** Moves live objects to the front, preserving their order. */
  compact(): void {
    if (!this.dirty) return;
    const items = this.items;
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const obj = items[i] as T;
      if (!obj.active) continue;
      if (i !== w) {
        items[i] = items[w] as T;
        items[w] = obj;
      }
      w++;
    }
    this.count = w;
    this.dirty = false;
  }

  /**
   * Visits live objects. Objects spawned during the walk are not visited until
   * the next call. Pass a hoisted function, not a fresh closure, in hot paths.
   */
  each(fn: (obj: T) => void): void {
    const items = this.items;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const obj = items[i] as T;
      if (obj.active) fn(obj);
    }
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) (this.items[i] as T).active = false;
    this.count = 0;
    this.dirty = false;
  }
}
