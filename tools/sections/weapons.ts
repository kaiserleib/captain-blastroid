import { WEAPONS, type WeaponId } from '../../src/content/weapons';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { dronesLayer, playerShotsLayer, weaponSystem } from '../../src/game/weapons';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { spawnEnemy, spawnEnemyShot, spawnAsteroid } from '../../src/sim/spawn';
import { rebuildSpatialHash } from '../../src/sim/spatialHash';
import type { Enemy } from '../../src/sim/types';
import { createWorld } from '../../src/sim/world';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const DT = 1 / 60;
const H = 240;
const ACT2: readonly WeaponId[] = ['arc', 'ricochet', 'flak'];

// T35: Arc Coil, Ricochet and Flak at L1–L5, live, against drifting dummies.
// Ricochet panels add an indestructible rock to bank off; Flak panels rain
// enemy bullets so the erase shows.
registerGallerySection(
  'Weapons: Act II',
  (root, g) => {
    root.append(
      el('p', {
        class: 'label',
        text: 'Arc Coil, Ricochet and Flak, L1–L5 left to right (live sim, full 240 px width so discs bounce off the real edges).',
      }),
    );
    for (const id of ACT2) {
      const row = el('div', { class: 'grid' });
      root.append(el('h3', { text: WEAPONS[id].name }), row);
      for (let level = 1; level <= 5; level++) {
        const { canvas, ctx } = pixelCanvas(240, H, 1, '#081028');
        const r = new CanvasRenderer(ctx);
        const w = createWorld(`gallery-${id}-${level}`);
        const p = w.player;
        p.x = 120;
        p.y = H - 24;
        p.maxWeaponSlots = 6;
        p.weapons.push({ id, level, cooldown: 0, state: 0 });
        const dummies: Enemy[] = [];
        for (let i = 0; i < 7; i++) {
          const e = spawnEnemy(w, 'dummy', 30 + i * 30, 70 + (i % 3) * 30, {
            hp: 1e9,
            vx: 0,
            vy: 0,
          });
          if (e) dummies.push(e);
        }
        if (id === 'ricochet') {
          spawnAsteroid(w, { x: 60, y: 40, vx: 0, vy: 0, r: 10, hp: 0, size: 'large' });
        }
        rebuildSpatialHash(w);
        let acc = 0;
        g.animate((dt) => {
          acc += Math.min(dt, 0.1);
          while (acc >= DT) {
            acc -= DT;
            w.tick++;
            w.time += DT;
            for (let i = 0; i < dummies.length; i++) {
              const e = dummies[i]!;
              e.prevX = e.x;
              e.x = 30 + i * 30 + Math.sin(w.time * 0.7 + i) * 14;
            }
            p.prevX = p.x;
            p.x = 120 + Math.sin(w.time * 0.5) * 50;
            if (id === 'flak' && w.tick % 8 === 0) {
              const x = 40 + ((w.tick * 37) % 160);
              spawnEnemyShot(w, { x, y: 0, vx: 0, vy: 80, r: 3, sprite: 'ebullet_s' });
            }
            p.invulnT = 1;
            weaponSystem.update(w, DT);
            bulletsSystem.update(w, DT);
            collisionSystem.update(w, DT);
            cleanupSystem.update(w, DT);
          }
          ctx.fillStyle = '#081028';
          ctx.fillRect(0, 0, 240, H);
          for (let i = 0; i < w.asteroids.count; i++) {
            const a = w.asteroids.items[i];
            if (a?.active) r.circle(a.x, a.y, a.r, '#58586c');
          }
          for (const e of dummies) {
            r.rect(e.x - 5, e.y - 5, 10, 10, e.flashT > 0 ? '#f8f8f8' : '#a83850');
          }
          for (let i = 0; i < w.enemyShots.count; i++) {
            const s = w.enemyShots.items[i];
            if (s?.active) r.sprite(s.sprite, s.x, s.y);
          }
          playerShotsLayer.draw(w, r, 1);
          dronesLayer.draw(w, r, 1);
          r.sprite('kestrel', p.x, p.y);
        });
        row.append(el('div', { class: 'card' }, el('h3', { text: `L${level}` }), canvas));
      }
    }
  },
  115,
);
