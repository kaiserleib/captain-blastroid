// `?sandbox` keys (T25): V cycles the background theme, Shift+V steps
// `world.scrollSpeed` through 30 → 70 → 18 px/s (speed lines show above 50).
// Keys only queue requests; the background system applies them inside a tick.
import { flags } from '../debug/flags';
import type { World } from '../sim/world';
import type { Background } from './background';
import { THEME_IDS } from './themes';

export const SANDBOX_SPEEDS = [30, 70, 18] as const;

const pending = { themes: 0, speeds: 0 };
let speedIdx = -1;

function onKey(e: KeyboardEvent): void {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.toLowerCase() !== 'v') return;
  if (e.shiftKey) pending.speeds++;
  else pending.themes++;
}

let installed = false;

export function installBackgroundSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKey);
}

/** Called by the background system each tick while `?sandbox` is on. */
export function runBackgroundSandbox(w: World, bg: Background): void {
  for (; pending.themes > 0; pending.themes--) {
    const next = THEME_IDS[(THEME_IDS.indexOf(bg.themeId) + 1) % THEME_IDS.length]!;
    bg.setTheme(next);
    console.info(`sandbox: background ${next}`);
  }
  for (; pending.speeds > 0; pending.speeds--) {
    speedIdx = (speedIdx + 1) % SANDBOX_SPEEDS.length;
    w.scrollSpeed = SANDBOX_SPEEDS[speedIdx]!;
    console.info(`sandbox: scrollSpeed ${w.scrollSpeed}`);
  }
}
