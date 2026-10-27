import { flags } from '../../../debug/flags';
import { damageEnemy } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { World } from '../../../sim/world';
import { activeBoss } from '../../boss';
import { portalPairs, spawnPortalPair } from '../../obstacles';
import { touchJunction } from './behaviors';
import { Janus } from './janus';
import { aegisScript, pylonScript } from './scripts';
import { tagPair } from './state';

// `?sandbox` keys (WAVE9-NOTES key map), any sector. Alt is held for all:
//   Alt+H        a Blinker pair (and a crossed portal pair for them if none is up)
//   Alt+J        a Gate Pylon carrying one end of a fresh pair (the other end fixed high)
//   Alt+L        an Aegis with its ring offset to the side (alternating), Alt+Shift+L: under it
//   Alt+Shift+H  Janus; Alt+Shift+J wrecks one face (jump to phase 2)
// Keys match on KeyboardEvent.code and act between frames, never mid-tick.

let installed = false;
let side = 1;
let pylonN = 0;
const REQ = { defId: 'wj_janus' };
const ARGS: Record<string, number | string> = {};

function world(): World | null {
  const d = (window as unknown as { __director?: { world?: World } }).__director;
  return d?.world ?? null;
}

function hasPair(w: World): boolean {
  for (const p of portalPairs(w)) if (p.active) return true;
  return false;
}

function run(w: World, code: string, shift: boolean): void {
  touchJunction(w);
  switch (code) {
    case 'KeyH':
      if (shift) {
        w.events.emit('bossRequested', REQ);
        return;
      }
      if (!hasPair(w)) {
        spawnPortalPair(w, 52, 80, 188, 170, { color: 'cyan' });
        spawnPortalPair(w, 188, 70, 52, 180, { color: 'orange' });
      }
      spawnEnemy(w, 'wj_blinker', 90, -10);
      spawnEnemy(w, 'wj_blinker', 150, -10);
      return;
    case 'KeyJ': {
      if (shift) {
        const b = activeBoss(w);
        if (!(b instanceof Janus)) return;
        const f = b.faces[0];
        if (!b.rig.alive(f) || f.enemy === null) return;
        // Only shots reach a face with the wall up: drop it for the hit.
        b.wallDown = true;
        damageEnemy(w, f.enemy, f.enemy.hp, 'player');
        b.wallDown = false;
        return;
      }
      const tag = `sb${pylonN++ % 4}`;
      const x = w.rng.range(60, 180);
      const p = spawnPortalPair(w, 240 - x, 40, x, -20, { color: 'lime' });
      if (p === null) return;
      tagPair(w, tag, p);
      ARGS.tag = tag;
      ARGS.end = 'b';
      ARGS.x = x;
      ARGS.holdY = 140;
      ARGS.dir = x < 120 ? 1 : -1;
      pylonScript(w, ARGS);
      return;
    }
    case 'KeyL':
      side = -side;
      ARGS.x = 120 - side * 40;
      ARGS.lowDx = shift ? 0 : side * 60;
      aegisScript(w, ARGS);
      return;
  }
}

export function installJunctionSandbox(): void {
  if (installed || !flags.sandbox || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !e.altKey) return;
    if (e.code !== 'KeyH' && e.code !== 'KeyJ' && e.code !== 'KeyL') return;
    const w = world();
    if (w === null) return;
    e.preventDefault();
    run(w, e.code, e.shiftKey);
  });
}
