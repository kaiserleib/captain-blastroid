import { TERRAIN_THEMES, TEST_CORRIDOR, TEST_GATE_CHUNK } from '../../content/terrain';
import { flags } from '../../debug/flags';
import type { World } from '../../sim/world';
import { emitToast } from '../director';
import { queueChunk } from './terrain';

// `?sandbox` keys (WAVE8-NOTES): `\` queues the ~60 s test corridor (the
// tile set alternates warrens / foundry per press), `Shift+\` a gate row.
// Like the sector sandboxes, commands act between ticks on the director's
// dev handle (`__director.world`). Console: `__terrain.queue(id, theme)`.

let press = 0;

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function theme(): string {
  return TERRAIN_THEMES[press % TERRAIN_THEMES.length] as string;
}

let installed = false;

export function installTerrainSandbox(): void {
  if (installed || typeof window === 'undefined' || !import.meta.env.DEV) return;
  installed = true;
  (window as unknown as { __terrain: unknown }).__terrain = {
    queue: (id: string, t = 'warrens') => {
      const w = world();
      if (w !== null) queueChunk(w, id, { theme: t });
    },
  };
  if (!flags.sandbox) return;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.code !== 'Backslash' || e.ctrlKey || e.metaKey || e.altKey) return;
    const w = world();
    if (w === null) return;
    if (e.shiftKey) {
      queueChunk(w, TEST_GATE_CHUNK, { theme: theme() });
      return;
    }
    for (const id of TEST_CORRIDOR) queueChunk(w, id, { theme: theme() });
    emitToast(w, `TEST CORRIDOR (${theme().toUpperCase()})`);
    press++;
  });
}
