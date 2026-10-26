import type { SpriteOpts } from '../../gfx/renderer';
import { warm } from '../../gfx/spriteCache';
import type { Bullet, Enemy } from '../../sim/types';
import type { DrawLayer } from '../../sim/world';
import { ENEMY_SPRITE_IDS } from './enemies.sprites';
import { enemyDrawFn, rosterDef } from './roster';

const ANIM_FPS = 8;
const BULLET_PULSE_FPS = 10;

const opts: SpriteOpts = { frame: 0, flash: false };
let warmed = false;

function warmOnce(): void {
  if (warmed) return;
  warm(ENEMY_SPRITE_IDS);
  warmed = true;
}

/** Registered roster enemies only (plus their `registerEnemyDraw` extras); boss parts draw themselves. */
export const enemiesLayer: DrawLayer = {
  name: 'enemies',
  z: 40,
  draw(w, r, alpha) {
    warmOnce();
    const items = w.enemies.items;
    const n = w.enemies.count;
    for (let i = 0; i < n; i++) {
      const e = items[i] as Enemy;
      if (!e.active) continue;
      const def = rosterDef(e.defId);
      if (def === undefined) continue;
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      if (def.sprite !== '') {
        // Per-id phase so a formation doesn't flicker in lockstep.
        opts.frame = Math.floor((w.time + e.id * 0.37) * ANIM_FPS);
        opts.flash = e.flashT > 0;
        r.sprite(def.sprite, x, y, opts);
      }
      enemyDrawFn(e.defId)?.(w, r, e, x, y);
    }
  },
};

const shotOpts: SpriteOpts = { frame: 0 };

export const enemyShotsLayer: DrawLayer = {
  name: 'enemyShots',
  z: 50,
  draw(w, r, alpha) {
    warmOnce();
    shotOpts.frame = Math.floor(w.time * BULLET_PULSE_FPS);
    const items = w.enemyShots.items;
    const n = w.enemyShots.count;
    for (let i = 0; i < n; i++) {
      const b = items[i] as Bullet;
      if (!b.active) continue;
      r.sprite(
        b.sprite === '' ? 'ebullet_s' : b.sprite,
        b.prevX + (b.x - b.prevX) * alpha,
        b.prevY + (b.y - b.prevY) * alpha,
        shotOpts,
      );
    }
  },
};
