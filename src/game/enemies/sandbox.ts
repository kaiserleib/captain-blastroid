import { spawnAsteroid, spawnEnemy } from '../../sim/spawn';
import { ROCK } from '../../gfx/palette';
import type { DrawLayer, System, World } from '../../sim/world';
import { spawnFormation } from './formations';

// `?sandbox` keys: 1–5 spawn gnat/swooper/gunboat/interceptor/carrier,
// 6 a gnat V, R a field of static indestructible rocks (stand-in for T10's
// stream, so avoidance can be watched in this worktree).

const queue: string[] = [];
let listening = false;

function onKey(ev: KeyboardEvent): void {
  if (ev.repeat) return;
  if (/^Digit[1-6]$/.test(ev.code) || ev.code === 'KeyR') queue.push(ev.code);
}

let side = 0;

function run(w: World, code: string): void {
  const rng = w.rng;
  side ^= 1;
  switch (code) {
    case 'Digit1':
      spawnEnemy(w, 'gnat', rng.range(24, 216), -12);
      return;
    case 'Digit2':
      spawnEnemy(w, 'swooper', side ? -10 : w.width + 10, -10);
      return;
    case 'Digit3':
      spawnEnemy(w, 'gunboat', rng.range(40, 200), -16);
      return;
    case 'Digit4':
      spawnEnemy(w, 'interceptor', rng.range(30, 210), -16);
      return;
    case 'Digit5':
      spawnEnemy(w, 'carrier', side ? -18 : w.width + 18, rng.range(50, 110));
      return;
    case 'Digit6':
      spawnFormation(w, { type: 'v', enemyId: 'gnat', count: 5, x: 120, spacing: 18 });
      return;
    case 'KeyR':
      for (let i = 0; i < 6; i++) {
        const r = rng.pick([6, 10, 15]);
        spawnAsteroid(w, {
          x: rng.range(20, 220),
          y: rng.range(110, 250),
          vx: 0,
          vy: 0,
          r,
          hp: 0,
          size: r < 8 ? 'small' : r < 12 ? 'medium' : 'large',
        });
      }
      return;
  }
}

export const enemySandboxSystem: System = {
  name: 'enemySandbox',
  update(w) {
    if (!listening && typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      listening = true;
    }
    while (queue.length > 0) run(w, queue.shift() as string);
  },
};

/** Outlines asteroids under z 30, so sandbox rocks are visible before T10 lands. */
export const enemySandboxLayer: DrawLayer = {
  name: 'enemySandboxRocks',
  z: 29,
  draw(w, r, alpha) {
    const items = w.asteroids.items;
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = items[i];
      if (!a?.active) continue;
      const x = a.prevX + (a.x - a.prevX) * alpha;
      const y = a.prevY + (a.y - a.prevY) * alpha;
      r.circle(x, y, a.r, ROCK.dark, true);
      r.circle(x, y, a.r, ROCK.light, false);
    }
  },
};
