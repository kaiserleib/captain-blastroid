import { ARCHITECT } from '../../../content/levels/foundry';
import { flags } from '../../../debug/flags';
import { spawnEnemy } from '../../../sim/spawn';
import type { DrawLayer, World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { Architect } from './architect';
import { conveyorScript, foundrySystem } from './scripts';

// `?sandbox&level=10` (WAVE9-NOTES keys, matched on KeyboardEvent.code):
// Alt+R a riveter line, Alt+G a Crane with its scrap, Alt+K a Sentinel,
// Alt+Shift+R the Architect (pressed again while it fights: skip to the next
// form). The listener runs in the capture phase and stops Alt combos there,
// so the shared sandboxes' plain R and K (enemy reset, Rock Hauler) don't
// fire too. Level systems don't run under ?sandbox, so the queue drains from
// a level draw layer, which also ticks the conveyor lines once per sim tick.
// `__foundry.skip()` (dev) ends the Architect's current form in any mode.

const queue: string[] = [];
let listening = false;
let lastTick = -1;
let side = 0;

function onKey(ev: KeyboardEvent): void {
  if (!ev.altKey || ev.repeat) return;
  let cmd = '';
  if (ev.code === 'KeyR') cmd = ev.shiftKey ? 'boss' : 'line';
  else if (ev.code === 'KeyG' && !ev.shiftKey) cmd = 'crane';
  else if (ev.code === 'KeyK' && !ev.shiftKey) cmd = 'sentinel';
  if (cmd === '') return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  ev.stopPropagation();
  queue.push(cmd);
}

const REQ = { defId: ARCHITECT.id };
const LINE = { y: 120, dir: 1, n: 10 };

function run(w: World, cmd: string): void {
  const rng = w.rng;
  side ^= 1;
  switch (cmd) {
    case 'line':
      LINE.y = rng.range(70, 200);
      LINE.dir = side ? 1 : -1;
      conveyorScript(w, LINE);
      return;
    case 'crane':
      spawnEnemy(w, 'fd_crane', rng.range(40, 200), -14);
      return;
    case 'sentinel':
      spawnEnemy(w, 'fd_sentinel', rng.range(40, 200), -12);
      return;
    case 'boss': {
      const b = activeBoss(w);
      if (b instanceof Architect) b.skipForm(w);
      else if (b === null) w.events.emit('bossRequested', REQ);
      return;
    }
  }
}

export const sandboxLayer: DrawLayer = {
  name: 'foundry.sandbox',
  z: 99,
  draw(w) {
    if (!flags.sandbox) return;
    if (!listening && typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey, { capture: true });
      listening = true;
    }
    while (queue.length > 0) run(w, queue.shift() as string);
    // The conveyor lines live in the level system; step them per sim tick here.
    if (lastTick < 0 || w.tick < lastTick) lastTick = w.tick;
    let n = Math.min(10, w.tick - lastTick);
    lastTick = w.tick;
    while (n-- > 0) foundrySystem.update(w, 1 / 60);
  },
};

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

let installed = false;

/** Dev console: `__foundry.skip()` ends the Architect's current form. */
export function installFoundryDev(): void {
  if (installed || typeof window === 'undefined' || !import.meta.env.DEV) return;
  installed = true;
  (window as unknown as { __foundry: unknown }).__foundry = {
    skip: () => {
      const w = world();
      const b = w === null ? null : activeBoss(w);
      if (w === null || !(b instanceof Architect)) return false;
      b.skipForm(w);
      return b.phaseName();
    },
  };
}
