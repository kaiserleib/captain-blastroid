// `?sandbox` harness for T13. X = big explosion test, Shift+X = kill burst
// (real spawn + damage calls, so the event reactions fire). More helpers are
// on `window.fxSandbox` for the console.
import type { PickupKind } from '../../sim/types';
import { damageAsteroid, damageEnemy, damagePlayer } from '../../sim/damage';
import { spawnAsteroid, spawnEnemy, spawnPickup } from '../../sim/spawn';
import type { World } from '../../sim/world';
import type { Fx } from './fxSystem';

const STORM_RATE = 30;

export interface FxSandbox {
  big(): void;
  burst(): void;
  hitPlayer(): void;
  killPlayer(): void;
  boss(): void;
  pickup(kind?: PickupKind): void;
  toast(text: string): void;
  /** Toggles an asteroid storm of 30 kills/s. Returns the new state. */
  storm(on?: boolean): boolean;
}

let installed: { fx: Fx; world: () => World | null } | null = null;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function makeApi(): FxSandbox {
  const cur = (): { fx: Fx; w: World } | null => {
    const w = installed?.world();
    return installed && w ? { fx: installed.fx, w } : null;
  };
  let stormOn = false;
  let stormAcc = 0;
  const api: FxSandbox = {
    big() {
      const c = cur();
      if (!c) return;
      const x = rand(60, 180);
      const y = rand(100, 260);
      c.fx.explode(x, y, 48);
      c.fx.explosions.chain(x, y, { radius: 24, count: 6, duration: 0.6 });
      c.fx.shake.add(4, 0.5);
      c.w.events.emit('hitstop', { dur: 0.08 });
      c.w.events.emit('toast', { text: 'BIG BOOM!' });
    },
    burst() {
      const c = cur();
      if (!c) return;
      const w = c.w;
      // Chain kills (×2 and up) show score popups.
      const radii = [5, 6, 10, 12, 16, 20];
      for (let i = 0; i < radii.length; i++) {
        const e = spawnEnemy(w, 'dummy', 30 + i * 36, rand(80, 160), {
          hp: 2,
          r: radii[i],
          vy: 40,
        });
        if (!e) continue;
        damageEnemy(w, e, 1, 'player');
        damageEnemy(w, e, 1, 'player');
      }
      const sizes = ['small', 'medium', 'large'] as const;
      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i] as (typeof sizes)[number];
        const a = spawnAsteroid(w, {
          x: 50 + i * 70,
          y: rand(200, 260),
          vx: rand(-20, 20),
          vy: 30,
          r: [6, 11, 18][i] as number,
          hp: 1,
          size,
        });
        if (a) damageAsteroid(w, a, 1, true);
      }
    },
    hitPlayer() {
      const c = cur();
      if (!c) return;
      const p = c.w.player;
      p.alive = true;
      p.shield = Math.max(p.shield, 2);
      p.invulnT = 0;
      damagePlayer(c.w, 1);
    },
    killPlayer() {
      const c = cur();
      if (!c) return;
      const p = c.w.player;
      p.alive = true;
      p.shield = 0;
      p.invulnT = 0;
      damagePlayer(c.w, 1);
    },
    boss() {
      const c = cur();
      if (!c) return;
      c.w.events.emit('bossDefeated', { defId: 'sandbox', x: 120, y: 120 });
      c.w.events.emit('toast', { text: 'SECTOR CLEAR' });
    },
    pickup(kind = 'weapon') {
      const c = cur();
      if (!c) return;
      const pk = spawnPickup(c.w, { kind, x: c.w.player.x, y: c.w.player.y - 10 });
      if (!pk) return;
      c.w.events.emit('pickupCollected', { pickup: pk });
      c.w.pickups.release(pk);
      if (kind === 'weapon') c.w.events.emit('toast', { text: 'SPREAD CANNON LV3' });
    },
    toast(text) {
      cur()?.w.events.emit('toast', { text });
    },
    storm(on = !stormOn) {
      stormOn = on;
      const c = cur();
      if (c) c.fx.sandboxTick = stormOn ? stormTick : null;
      return stormOn;
    },
  };
  const stormTick = (w: World, dt: number): void => {
    stormAcc += dt * STORM_RATE;
    while (stormAcc >= 1) {
      stormAcc--;
      const size = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large';
      const a = spawnAsteroid(w, {
        x: rand(10, 230),
        y: rand(20, 380),
        vx: rand(-20, 20),
        vy: rand(20, 60),
        r: size === 'small' ? 6 : size === 'medium' ? 11 : 18,
        hp: 1,
        size,
      });
      if (a) damageAsteroid(w, a, 1, true);
    }
  };
  return api;
}

/** Call once per GameScene enter; key handlers are installed on first call only. */
export function installFxSandbox(fx: Fx, world: () => World | null): FxSandbox {
  const first = installed === null;
  installed = { fx, world };
  const api = makeApi();
  (globalThis as { fxSandbox?: FxSandbox }).fxSandbox = api;
  if (first && typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyX' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = (globalThis as { fxSandbox?: FxSandbox }).fxSandbox;
      if (e.shiftKey) a?.burst();
      else a?.big();
    });
  }
  return api;
}
