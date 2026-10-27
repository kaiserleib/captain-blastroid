import { flags } from '../../../debug/flags';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { spawnFormation } from '../../enemies';
import { Echo } from './echo';

// `?sandbox` keys (WAVE9-NOTES, matched on KeyboardEvent.code): Alt+Z a
// Stutterer column, Alt+C a Rewinder, Alt+M a Bubble Mine near the top,
// Alt+Shift+Z the Echo. Sector folders have no sandbox slot, so commands act
// between ticks on the director's dev handle (`__director.world`). Dev console:
// `__chrono.skip('ghost' | 'paradox' | 'kill')` fast-forwards the Echo.

const o: EnemyOverrides = {};
const REQ = { defId: 'cr_echo' };

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function clear(): EnemyOverrides {
  for (const k in o) delete o[k as keyof EnemyOverrides];
  return o;
}

export function runChronoSandbox(w: World, code: string, shift: boolean): void {
  const rng = w.rng;
  if (code === 'KeyZ' && shift) {
    w.events.emit('bossRequested', REQ);
  } else if (code === 'KeyZ') {
    spawnFormation(w, {
      type: 'column',
      enemyId: 'cr_stutterer',
      count: 4,
      x: rng.range(40, 200),
      spacing: 22,
    });
  } else if (code === 'KeyC') {
    spawnEnemy(w, 'cr_rewinder', rng.range(50, 190), -12, clear());
  } else if (code === 'KeyM') {
    spawnEnemy(w, 'cr_bubblemine', rng.range(30, 210), rng.range(30, 110), clear());
  }
}

/** Fast-forwards the active Echo (dev console and browser checks). */
export function skipEcho(w: World, to: 'ghost' | 'paradox' | 'kill'): boolean {
  const b = activeBoss(w);
  if (!(b instanceof Echo)) return false;
  b.skipTo(w, to);
  return true;
}

let installed = false;

export function installChronoSandbox(): void {
  if (installed || typeof window === 'undefined' || !import.meta.env.DEV) return;
  installed = true;
  (window as unknown as { __chrono: unknown }).__chrono = {
    skip: (to: 'ghost' | 'paradox' | 'kill') => {
      const w = world();
      return w !== null && skipEcho(w, to);
    },
  };
  if (!flags.sandbox) return;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !e.altKey) return;
    if (e.code !== 'KeyZ' && e.code !== 'KeyC' && e.code !== 'KeyM') return;
    e.preventDefault();
    const w = world();
    if (w !== null) runChronoSandbox(w, e.code, e.shiftKey);
  });
}
