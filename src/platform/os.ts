interface CapacitorGlobal {
  getPlatform?(): string;
}

/** Which store's app this is, read from the global the native shell injects; `web` in a browser. */
export function runtimeOs(g: unknown = globalThis): 'ios' | 'android' | 'web' {
  const cap = (g as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    const p = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : 'web';
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
}
