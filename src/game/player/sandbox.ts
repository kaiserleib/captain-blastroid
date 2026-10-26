import { flags } from '../../debug/flags';
import { toggleGodMode } from './playerSystem';

let installed = false;

/** `?sandbox`: `G` toggles god mode. Installed once per page. */
export function installPlayerSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG' && !e.repeat) toggleGodMode();
  });
}
