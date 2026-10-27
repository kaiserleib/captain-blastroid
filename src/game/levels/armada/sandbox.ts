import { LEVIATHAN } from '../../../content/levels/armada';
import { flags } from '../../../debug/flags';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { activeBoss, type PartSlot } from '../../boss';
import { spawnFormation } from '../../enemies';
import { Leviathan, LevPhase } from './leviathan';

// `?sandbox` keys (WAVE6-NOTES): Z an escort wing, Shift+Z a frigate,
// C a minelayer, M a mine near the top, Shift+C the Dreadnought Leviathan.
// Commands run between ticks on the director's dev handle (`__director.world`),
// since sector folders have no sandbox slot of their own. Use `?level=5` too,
// so the hull layer is drawn. `__armada` (dev) skips through the boss:
// `__armada.skip('bridge' | 'gens' | 'core')`.

let side = 0;
const o: EnemyOverrides = {};

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function clear(): EnemyOverrides {
  for (const k in o) delete o[k as keyof EnemyOverrides];
  return o;
}

function run(w: World, code: string, shift: boolean): void {
  side ^= 1;
  const rng = w.rng;
  if (code === 'KeyZ' && !shift) {
    spawnFormation(w, {
      type: 'v',
      enemyId: 'ar_escort',
      count: 3,
      x: rng.range(50, 190),
      spacing: 18,
    });
  } else if (code === 'KeyZ') {
    spawnEnemy(w, 'ar_frigate', side ? -18 : w.width + 18, rng.range(70, 110), clear());
  } else if (code === 'KeyC' && !shift) {
    spawnEnemy(w, 'ar_minelayer', side ? -18 : w.width + 18, rng.range(36, 56), clear());
  } else if (code === 'KeyC') {
    w.events.emit('bossRequested', { defId: 'ar_leviathan' });
  } else if (code === 'KeyM') {
    spawnEnemy(w, 'ar_mine', rng.range(30, 210), rng.range(30, 120), clear());
  }
}

/** Fast-forwards the active Leviathan (dev console and browser checks). */
export function skipLeviathan(w: World, to: 'bridge' | 'gens' | 'core'): boolean {
  const b = activeBoss(w);
  if (!(b instanceof Leviathan)) return false;
  if (b.phase === LevPhase.Hull) {
    // Jump the anchor to just short of the lock; parts follow next tick.
    b.anchorY = b.anchorPrevY = LEVIATHAN.lockY - b.bridge.spec.oy - 4;
    b.rig.moveTo(w.width / 2, b.anchorY, 1 / 60);
  }
  if (to === 'bridge') return true;
  for (const i of b.genI) {
    const s = b.rig.slots[i] as PartSlot;
    if (b.rig.alive(s)) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
  }
  if (to === 'gens') return true;
  b.genAlive = false;
  const br = b.bridge.enemy;
  if (br !== null && br.active) damageEnemy(w, br, 1e6, 'player');
  return true;
}

let installed = false;

export function installArmadaSandbox(): void {
  if (installed || typeof window === 'undefined' || !import.meta.env.DEV) return;
  installed = true;
  (window as unknown as { __armada: unknown }).__armada = {
    skip: (to: 'bridge' | 'gens' | 'core') => {
      const w = world();
      return w !== null && skipLeviathan(w, to);
    },
  };
  if (!flags.sandbox) return;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey) return;
    if (e.code !== 'KeyZ' && e.code !== 'KeyC' && e.code !== 'KeyM') return;
    const w = world();
    if (w !== null) run(w, e.code, e.shiftKey);
  });
}
