import { flags } from '../../../debug/flags';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { spawnRock } from '../../obstacles';
import { Shepherd } from './shepherd';

// `?sandbox` keys (WAVE6-NOTES key map), any sector:
//   Q        a tug, plus a medium pair and a large drifting in for it to haul
//   E        a skiff sweep from alternating sides (Shift+E: a weave pair from the top)
//   Y        a row of three ion mines
//   Shift+Q  the Shepherd
//   Shift+Y  wreck both of the Shepherd's emitters (jump to phase 2)
// The world comes from the director's dev handle; keys act between frames,
// never mid-tick.

let installed = false;
let side = 1;
const SWEEP = { vx: 0, vy: 0 };
const REQ = { defId: 'ion_shepherd' };

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function run(w: World, code: string, shift: boolean): void {
  const rng = w.rng;
  switch (code) {
    case 'KeyQ':
      if (shift) {
        w.events.emit('bossRequested', REQ);
        return;
      }
      spawnEnemy(w, 'ion_tug', rng.range(50, 190), -14);
      spawnRock(w, { size: 'medium', x: rng.range(40, 100), y: -12, vx: 0, vy: 30 });
      spawnRock(w, { size: 'medium', x: rng.range(140, 200), y: -40, vx: 0, vy: 30 });
      spawnRock(w, { size: 'large', x: rng.range(80, 160), y: -60, vx: 0, vy: 26 });
      return;
    case 'KeyE':
      if (shift) {
        spawnEnemy(w, 'ion_skiff', 80, -10);
        spawnEnemy(w, 'ion_skiff', 160, -10);
        return;
      }
      side = -side;
      SWEEP.vx = side * 117;
      SWEEP.vy = 57;
      for (let i = 0; i < 4; i++) {
        spawnEnemy(
          w,
          'ion_skiff',
          side > 0 ? -14 - i * 40 : w.width + 14 + i * 40,
          60 - i * 20,
          SWEEP,
        );
      }
      return;
    case 'KeyY': {
      if (shift) {
        const b = activeBoss(w);
        if (!(b instanceof Shepherd)) return;
        for (const s of b.emitters) {
          if (b.rig.alive(s) && s.enemy !== null) damageEnemy(w, s.enemy, s.enemy.hp, 'player');
        }
        return;
      }
      for (const x of [60, 120, 180]) spawnEnemy(w, 'ion_mine', x, -10);
      return;
    }
  }
}

export function installIonSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || (e.code !== 'KeyQ' && e.code !== 'KeyE' && e.code !== 'KeyY')) return;
    const w = world();
    if (w !== null) run(w, e.code, e.shiftKey);
  });
}
