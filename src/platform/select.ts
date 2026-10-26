import { setPlatform } from './index';

interface CapacitorGlobal {
  isNativePlatform?(): boolean;
}

/**
 * `Capacitor.isNativePlatform()` without importing `@capacitor/core`: the native
 * shell injects `window.Capacitor` before any page script runs, so the web build
 * never loads Capacitor code.
 */
export function isNativeRuntime(g: unknown = globalThis): boolean {
  const cap = (g as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
}

/** Swaps in the Capacitor platform when running natively. Call before anything subscribes. */
export async function selectPlatform(): Promise<void> {
  if (!isNativeRuntime()) return;
  try {
    const { createCapacitorPlatform } = await import('./capacitor');
    setPlatform(await createCapacitorPlatform());
  } catch (e) {
    console.error('Capacitor platform failed to load; using web services', e);
  }
}

/** Offline support for the browser build. Skipped in dev (HMR) and inside the native shell. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || isNativeRuntime()) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((e: unknown) => console.warn('Service worker registration failed', e));
  });
}
