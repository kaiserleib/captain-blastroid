import type { Renderer, SpriteOpts } from '../../gfx/renderer';
import { GUNMETAL, PBULLET } from '../../gfx/palette';
import type { Bullet, WeaponInstance } from '../../sim/types';
import type { DrawLayer } from '../../sim/world';
import { droneAngle } from './drones';
import { levelOf } from './weaponSystem';

const TICK_DT = 1 / 60;
const opts: SpriteOpts = { rot: 0, frame: 0 };
const droneOpts: SpriteOpts = { frame: 0 };

/** Seeker exhaust: a hot pixel, then two fading smoke puffs behind the missile. */
function drawTrail(r: Renderer, b: Bullet, x: number, y: number, tick: number): void {
  const len = Math.hypot(b.vx, b.vy);
  if (len === 0) return;
  const ux = b.vx / len;
  const uy = b.vy / len;
  r.rect(x - ux * 6, y - uy * 6, 1, 1, PBULLET.yellow);
  r.rect(x - ux * 8 - 1, y - uy * 8, 2, 2, GUNMETAL.highlight);
  if ((tick + b.id) & 2) r.rect(x - ux * 11, y - uy * 11, 1, 1, GUNMETAL.light);
}

/** Every player shot, interpolated. z 55. */
export const playerShotsLayer: DrawLayer = {
  name: 'playerShots',
  z: 55,
  draw(w, r, alpha) {
    const items = w.playerShots.items;
    const n = w.playerShots.count;
    const shimmer = w.tick >> 2;
    for (let i = 0; i < n; i++) {
      const b = items[i] as Bullet;
      if (!b.active) continue;
      const x = b.prevX + (b.x - b.prevX) * alpha;
      const y = b.prevY + (b.y - b.prevY) * alpha;
      if (b.sprite === '') {
        r.rect(x - 1, y - 2, 2, 4, PBULLET.cyan);
        continue;
      }
      if (b.homing > 0) drawTrail(r, b, x, y, w.tick);
      opts.rot = b.rot;
      opts.frame = shimmer + b.id;
      r.sprite(b.sprite, x, y, opts);
    }
  },
};

/** Orbit drones around the (interpolated) ship. z 58. */
export const dronesLayer: DrawLayer = {
  name: 'drones',
  z: 58,
  draw(w, r, alpha) {
    const p = w.player;
    if (!p.alive) return;
    const list = p.weapons;
    let inst: WeaponInstance | null = null;
    for (let i = 0; i < list.length; i++) {
      if ((list[i] as WeaponInstance).id === 'orbitDrones') inst = list[i] as WeaponInstance;
    }
    if (inst === null) return;
    const lv = levelOf(inst);
    if (lv === null) return;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    const a = inst.state - lv.orbitSpeed * TICK_DT * (1 - alpha);
    const n = lv.count;
    droneOpts.frame = w.tick >> 3;
    for (let i = 0; i < n; i++) {
      const da = droneAngle(a, i, n);
      r.sprite(
        lv.sprite,
        px + Math.cos(da) * lv.orbitRadius,
        py + Math.sin(da) * lv.orbitRadius,
        droneOpts,
      );
    }
  },
};
