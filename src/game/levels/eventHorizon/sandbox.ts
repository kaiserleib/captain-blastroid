import { flags } from '../../../debug/flags';
import { spawnEnemy } from '../../../sim/spawn';
import type { DrawLayer, World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { spawnBlackHole } from '../../obstacles';
import { nearestHole } from './behaviors';
import { Perihelion } from './perihelion';
import { spawnOrbiters } from './scripts';

// `?sandbox&level=3`: U a ring of 3 Orbiters (and a slow standard hole if
// none is up), I a Lancer, O a Gravity Buoy, Shift+U Perihelion (pressed
// again while it fights: wreck both pods, jumping to phase 2).
// Level systems don't run under ?sandbox, so the queue drains from a level
// draw layer, which GameScene adds whenever this sector plays.

const queue: string[] = [];
let listening = false;

function onKey(ev: KeyboardEvent): void {
  if (ev.repeat) return;
  if (ev.code === 'KeyU') queue.push(ev.shiftKey ? 'boss' : 'orbiters');
  else if (ev.code === 'KeyI' && !ev.shiftKey) queue.push('lancer');
  else if (ev.code === 'KeyO' && !ev.shiftKey) queue.push('buoy');
}

const REQ = { defId: 'hz_perihelion' };
const HOLE = { vx: 0, vy: 6, variant: 'standard' };
const ORBIT_ARGS = { x: 120, n: 3, dir: 1 };

function run(w: World, cmd: string): void {
  const rng = w.rng;
  switch (cmd) {
    case 'orbiters': {
      ORBIT_ARGS.x = rng.range(70, 170);
      if (nearestHole(w, ORBIT_ARGS.x, 60) === null) spawnBlackHole(w, ORBIT_ARGS.x, 90, HOLE);
      ORBIT_ARGS.dir = rng.chance(0.5) ? 1 : -1;
      spawnOrbiters(w, ORBIT_ARGS);
      return;
    }
    case 'lancer':
      spawnEnemy(w, 'hz_lancer', rng.range(30, 210), -12);
      return;
    case 'buoy':
      spawnEnemy(w, 'hz_buoy', rng.range(40, 200), -14);
      return;
    case 'boss': {
      const b = activeBoss(w);
      if (b instanceof Perihelion) b.wreckPods(w);
      else if (b === null) w.events.emit('bossRequested', REQ);
      return;
    }
  }
}

export const sandboxLayer: DrawLayer = {
  name: 'eventHorizon.sandbox',
  z: 99,
  draw(w) {
    if (!flags.sandbox) return;
    if (!listening && typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      listening = true;
    }
    while (queue.length > 0) run(w, queue.shift() as string);
  },
};
