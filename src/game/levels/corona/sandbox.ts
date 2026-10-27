import { HELIOSTAT } from '../../../content/levels/corona';
import { flags } from '../../../debug/flags';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { DrawLayer, World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { Heliostat } from './heliostat';

// `?sandbox&level=6`: Alt+Q a Sunskimmer pair, Alt+E a Shade, Alt+Y a Lens
// Drone, Alt+Shift+Q the Heliostat, Alt+Shift+E wreck three mirrors (Solar
// Furnace), Alt+Shift+Y the core to 10%. T33's F starts a flare. Level systems
// don't tick under ?sandbox, so the queue drains from this layer's draw.

const queue: string[] = [];
let installed = false;
const REQ = { defId: HELIOSTAT.id };
const KEYS = new Set(['KeyQ', 'KeyE', 'KeyY']);

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // Capture, and stop it there: ionShoals' sandbox listens for plain Q/E/Y
  // without checking Alt, and would spawn its own enemies (and the Shepherd).
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || !KEYS.has(e.code)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) queue.push(`${e.shiftKey ? 'S' : ''}${e.code}`);
    },
    { capture: true },
  );
}

export function runSandbox(w: World, cmd: string): void {
  const rng = w.rng;
  switch (cmd) {
    case 'KeyQ': {
      const left = rng.next() < 0.5;
      const x = left ? -18 : w.width + 18;
      const y = rng.range(30, 70);
      spawnEnemy(w, 'co_sunskimmer', x, y);
      spawnEnemy(w, 'co_sunskimmer', x + (left ? -36 : 36), y - 18);
      return;
    }
    case 'KeyE':
      spawnEnemy(w, 'co_shade', rng.range(40, 200), -12);
      return;
    case 'KeyY':
      spawnEnemy(w, 'co_lens', rng.range(50, 190), -14);
      return;
    case 'SKeyQ':
      w.events.emit('bossRequested', REQ);
      return;
  }
  const b = activeBoss(w);
  if (!(b instanceof Heliostat)) return;
  if (cmd === 'SKeyE') {
    let n = 0;
    for (const s of b.mirrors) {
      if (n >= HELIOSTAT.furnaceAfter) break;
      if (b.rig.alive(s) && s.enemy !== null) {
        damageEnemy(w, s.enemy, s.enemy.hp, 'player');
        n++;
      }
    }
  } else if (cmd === 'SKeyY') {
    const c = b.core.enemy;
    if (c !== null && b.rig.alive(b.core)) c.hp = Math.max(1, Math.floor(b.core.spec.hp * 0.1));
  }
}

export const sandboxLayer: DrawLayer = {
  name: 'corona.sandbox',
  z: 99,
  draw(w) {
    if (!flags.sandbox) return;
    install();
    while (queue.length > 0) runSandbox(w, queue.shift() as string);
  },
};
