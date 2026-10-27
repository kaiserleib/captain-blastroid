import { DEN, WYRM } from '../../../content/levels/warrens';
import { flags } from '../../../debug/flags';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { queueChunk } from '../../terrain';
import { markChunk, spawnBats } from './scripts';
import { Wyrm } from './wyrm';

// `?sandbox` keys (WAVE9-NOTES), matched on KeyboardEvent.code with Alt held:
//   Alt+U       the wide tunnel chunk (its four `T` sockets spawn wall turrets)
//   Alt+I       a borer from alternating walls
//   Alt+O       a cave-bat flock
//   Alt+Shift+U the Wyrm's den, then the Wyrm (it waits for the den's scroll stop)
// Commands run between ticks on the director's dev handle (`__director.world`).
// Console (dev): `__warrens.skip('frenzy' | 'kill')` pushes the active Wyrm along.

let side = 0;
const o: EnemyOverrides = {};

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function run(w: World, code: string, shift: boolean): void {
  side ^= 1;
  if (code === 'KeyU' && !shift) {
    queueChunk(w, 'wr_tunnel', { theme: 'warrens' });
  } else if (code === 'KeyU') {
    markChunk(w, { chunk: DEN.id });
    queueChunk(w, DEN.id, { theme: 'warrens' });
    w.events.emit('bossRequested', { defId: WYRM.id });
  } else if (code === 'KeyI') {
    spawnEnemy(w, 'wr_borer', side ? -18 : w.width + 18, w.rng.range(80, 220), o);
  } else if (code === 'KeyO') {
    spawnBats(w, { n: 10, x: w.rng.range(60, 180) });
  }
}

/** Fast-forwards the active Wyrm (dev console and browser checks). */
export function skipWyrm(w: World, to: 'frenzy' | 'kill'): boolean {
  const b = activeBoss(w);
  if (!(b instanceof Wyrm)) return false;
  const head = b.head.enemy;
  if (to === 'kill') {
    if (head === null) return false;
    head.hp = 1;
    return true;
  }
  // Segments to 1 HP, then the head down to just under the FRENZY line.
  for (const s of b.rig.slots) if (s !== b.head && s.enemy !== null) s.enemy.hp = 1;
  const over = b.rig.hp() - (b.rig.maxHp() * WYRM.frenzyAt - 1);
  if (over > 0 && head !== null) head.hp -= over;
  return true;
}

let installed = false;

export function installWarrensSandbox(): void {
  if (installed || typeof window === 'undefined' || !import.meta.env.DEV) return;
  installed = true;
  (window as unknown as { __warrens: unknown }).__warrens = {
    skip: (to: 'frenzy' | 'kill') => {
      const w = world();
      return w !== null && skipWyrm(w, to);
    },
  };
  if (!flags.sandbox) return;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !e.altKey) return;
    if (e.code !== 'KeyU' && e.code !== 'KeyI' && e.code !== 'KeyO') return;
    e.preventDefault();
    const w = world();
    if (w !== null) run(w, e.code, e.shiftKey);
  });
}
