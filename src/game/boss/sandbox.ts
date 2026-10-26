import { flags } from '../../debug/flags';
import { damageEnemy } from '../../sim/damage';
import type { World } from '../../sim/world';
import { activeBoss } from './bossSystem';
import { RockHauler } from './rockHauler';

// `?sandbox`: K requests the Rock Hauler (the same event the director sends);
// Shift+K wrecks both clamp turrets to jump to phase 2.

const queue: string[] = [];

/** Console access in dev: `(await import('/src/game/boss/sandbox.ts')).bossSandbox.world`. */
export const bossSandbox = { world: null as World | null };
let installed = false;
const REQ = { defId: 'rock_hauler' };

export function installBossSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyK' && !e.repeat) queue.push(e.shiftKey ? 'skip' : 'spawn');
  });
}

export function runBossSandbox(w: World): void {
  bossSandbox.world = w;
  while (queue.length > 0) {
    const cmd = queue.shift();
    if (cmd === 'spawn') {
      w.events.emit('bossRequested', REQ);
      continue;
    }
    const b = activeBoss(w);
    if (!(b instanceof RockHauler)) continue;
    for (const s of b.turrets) {
      if (b.rig.alive(s) && s.enemy !== null) damageEnemy(w, s.enemy, s.enemy.hp, 'player');
    }
  }
}
