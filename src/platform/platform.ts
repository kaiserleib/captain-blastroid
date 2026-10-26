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

export interface Platform {
  readonly kind: 'web' | 'native';
  readonly storage: StorageAdapter;
  readonly haptics: Haptics;
  readonly lifecycle: Lifecycle;
  readonly orientation: Orientation;
}
