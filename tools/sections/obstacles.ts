import { Background } from '../../src/backgrounds';
import { ROCK_THEME_IDS, type RockTheme } from '../../src/content/obstacles';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import {
  anomalyLayer,
  asteroidLayer,
  obstaclesSystem,
  spawnAsteroidStream,
  spawnBlackHole,
  spawnPulsar,
  spawnRock,
} from '../../src/game/obstacles';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { spawnPlayerShot } from '../../src/sim/spawn';
import { createWorld } from '../../src/sim/world';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const BG_FOR: Record<RockTheme, 'kessler' | 'ion' | 'horizon'> = {
  kessler: 'kessler',
  ion: 'ion',
  basalt: 'horizon',
};
const LEVEL_FOR: Record<RockTheme, string> = { kessler: 'kessler', ion: 'ion', basalt: 'horizon' };

// Live T10 sim over each theme's background: a rock stream, plus a black hole
// bending a fan of player shots and a pulsar on the kessler panel.
registerGallerySection(
  'Obstacles',
  (root, g) => {
    const row = el('div', { class: 'grid' });
    root.append(
      el('p', {
        class: 'label',
        text: 'Rock streams over each theme background (live sim). Kessler panel: black hole bending shots, pulsar ring.',
      }),
      row,
    );
    for (const theme of ROCK_THEME_IDS) {
      const { canvas, ctx } = pixelCanvas(240, 400, Math.min(g.zoom, 2), '#000');
      const r = new CanvasRenderer(ctx);
      const bg = new Background(BG_FOR[theme], 'gallery');
      const w = createWorld(`gallery-${theme}`, { levelId: LEVEL_FOR[theme] });
      w.scrollSpeed = 30;
      // No ship in the gallery.
      w.player.alive = false;
      spawnAsteroidStream(w, { rate: 1.6, sizeWeights: { small: 5, medium: 3, large: 2 } });
      for (let i = 0; i < 10; i++) {
        spawnRock(w, {
          size: i % 3 === 0 ? 'large' : i % 2 ? 'medium' : 'small',
          x: 20 + w.rng.range(0, 200),
          y: w.rng.range(20, 380),
          vx: w.rng.range(-10, 10),
          vy: 40,
        });
      }
      const demo = theme === 'kessler';
      if (demo) {
        spawnBlackHole(w, 120, 150, { vy: 0 });
        spawnPulsar(w, 60, 300, { vy: 0 });
      }
      let acc = 0;
      let shotT = 0;
      g.animate((dt) => {
        acc += Math.min(dt, 0.1);
        while (acc >= 1 / 60) {
          acc -= 1 / 60;
          w.tick++;
          w.time += 1 / 60;
          w.scrollY += w.scrollSpeed / 60;
          if (demo && (shotT -= 1 / 60) <= 0) {
            shotT = 0.25;
            for (let k = 0; k < 5; k++) {
              spawnPlayerShot(w, {
                x: 40 + k * 40,
                y: 400,
                vx: 0,
                vy: -200,
                sprite: 'pbullet_blaster',
              });
            }
          }
          bulletsSystem.update(w, 1 / 60);
          obstaclesSystem.update(w, 1 / 60);
          collisionSystem.update(w, 1 / 60);
          cleanupSystem.update(w, 1 / 60);
        }
        bg.draw(ctx, w.scrollY, w.time, 400);
        anomalyLayer.draw(w, r, 1);
        asteroidLayer.draw(w, r, 1);
        const shots = w.playerShots;
        for (let i = 0; i < shots.count; i++) {
          const s = shots.items[i];
          if (s?.active) r.sprite(s.sprite, s.x, s.y, { rot: s.rot });
        }
      });
      row.append(el('div', { class: 'card' }, el('h3', { text: theme }), canvas));
    }
  },
  120,
);
