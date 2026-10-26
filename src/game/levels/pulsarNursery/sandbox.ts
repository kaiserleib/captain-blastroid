import { MAGNETAR } from '../../../content/levels/pulsarNursery';
import { flags } from '../../../debug/flags';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { DrawLayer, World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { spawnStreakers } from './behaviors';
import { Magnetar } from './magnetar';

// `?sandbox&level=4`: H a Pulse Drone pair, J two Streakers (any scroll speed),
// L a Warden Ray, Shift+H Magnetar, Shift+J wreck three pylons (phase 2),
// Shift+L the core to 29% (meltdown). Level systems don't tick under
// ?sandbox, so the queue drains from this level layer's draw, between ticks.

const queue: string[] = [];
let installed = false;
const REQ = { defId: MAGNETAR.id };

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyH' || e.code === 'KeyJ' || e.code === 'KeyL')
      queue.push(`${e.shiftKey ? 'S' : ''}${e.code}`);
  });
}

export function runSandbox(w: World, cmd: string): void {
  const rng = w.rng;
  switch (cmd) {
    case 'KeyH': {
      const x = rng.range(40, 120);
      spawnEnemy(w, 'pn_drone', x, -10);
      spawnEnemy(w, 'pn_drone', x + 80, -10);
      return;
    }
    case 'KeyJ':
      spawnStreakers(w, 2);
      return;
    case 'KeyL':
      spawnEnemy(w, 'pn_ray', rng.range(50, 190), -14);
      return;
    case 'SKeyH':
      w.events.emit('bossRequested', REQ);
      return;
  }
  const b = activeBoss(w);
  if (!(b instanceof Magnetar)) return;
  if (cmd === 'SKeyJ') {
    let n = 0;
    for (const s of b.pylons) {
      if (n >= 3) break;
      if (b.rig.alive(s) && s.enemy !== null) {
        damageEnemy(w, s.enemy, s.enemy.hp, 'player');
        n++;
      }
    }
  } else if (cmd === 'SKeyL') {
    const c = b.core.enemy;
    if (c !== null && b.rig.alive(b.core)) c.hp = Math.floor(b.core.spec.hp * 0.29);
  }
}

export const sandboxLayer: DrawLayer = {
  name: 'pulsarNursery.sandbox',
  z: 99,
  draw(w) {
    if (!flags.sandbox) return;
    install();
    while (queue.length > 0) runSandbox(w, queue.shift() as string);
  },
};
