/** A keyboard is plausible: a browser on a device whose main pointer isn't a finger. */
export function likelyHasKeyboard(native: boolean, g: unknown = globalThis): boolean {
  if (native) return false;
  const mm = (g as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return typeof mm !== 'function' || !mm.call(g, '(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

/** Opens `url` outside the game: a new tab on the web, the system browser from the apps. */
export function openExternal(url: string, g: unknown = globalThis): void {
  const open = (g as { open?: (u: string, target: string, features: string) => unknown }).open;
  try {
    if (typeof open === 'function') open.call(g, url, '_blank', 'noopener');
  } catch (e) {
    console.warn('Could not open', url, e);
  }
}
