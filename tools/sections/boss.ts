import { Background } from '../../src/backgrounds';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { bossLayer, Phase, spawnBoss, updateBoss, type RockHauler } from '../../src/game/boss';
import { enemyLayers, updateEnemies } from '../../src/game/enemies';
import { asteroidLayer, obstaclesSystem } from '../../src/game/obstacles';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { damageEnemy } from '../../src/sim/damage';
import { bulletsSystem } from '../../src/sim/motion';
import type { Enemy } from '../../src/sim/types';
import { createWorld, type World } from '../../src/sim/world';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const DT = 1 / 60;

function step(w: World): void {
  w.tick++;
  w.time += DT;
  w.scrollY += w.scrollSpeed * DT;
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  obstaclesSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

function boss(seed: string): { w: World; b: RockHauler } {
  const w = createWorld(seed, { levelId: 'kessler' });
  w.scrollSpeed = 30;
  w.player.invulnT = 1e9;
  w.player.y = 300;
  const b = spawnBoss(w, 'rock_hauler') as RockHauler;
  for (let i = 0; i < 200; i++) step(w);
  return { w, b };
}

function wreck(w: World, b: RockHauler, n: number): void {
  for (let i = 0; i < n; i++) {
    const e = b.turrets[i]?.enemy;
    if (e) damageEnemy(w, e as Enemy, 1e6, 'player');
  }
  step(w);
}

const STATES: [string, (w: World, b: RockHauler) => void][] = [
  ['Phase 1', () => {}],
  ['One turret wrecked', (w, b) => wreck(w, b, 1)],
  [
    'Core opening',
    (w, b) => {
      wreck(w, b, 2);
      for (let i = 0; i < 40; i++) step(w);
    },
  ],
  [
    'Phase 2 (core exposed)',
    (w, b) => {
      wreck(w, b, 2);
      for (let i = 0; i < 100; i++) step(w);
    },
  ],
];

// The composite boss in each state, over the level 1 background, animated.
registerGallerySection(
  'Boss: Rock Hauler',
  (root, g) => {
    const row = el('div', { class: 'grid' });
    root.append(
      el('p', {
        class: 'label',
        text: 'Composite at fight position; parts animate live (sim paused except the death panel).',
      }),
      row,
    );
    const zoom = Math.max(2, g.zoom);
    for (const [label, setup] of STATES) {
      const { canvas, ctx } = pixelCanvas(150, 130, zoom, '#000');
      const r = new CanvasRenderer(ctx);
      const bg = new Background('kessler', 'boss-gallery');
      const { w, b } = boss(`gallery-${label}`);
      setup(w, b);
      const ox = 75 - b.rig.x;
      const oy = 55 - b.rig.y;
      g.animate((dt) => {
        w.time += dt;
        // Clear stray shots/rocks so the panel shows only the boss.
        for (const s of w.enemyShots.items) if (s.active) w.enemyShots.release(s);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 150, 130);
        bg.draw(ctx, w.time * 30, w.time, 130);
        r.shakeX = ox;
        r.shakeY = oy;
        bossLayer.draw(w, r, 1);
        r.shakeX = r.shakeY = 0;
      });
      row.append(el('div', { class: 'card' }, el('h3', { text: label }), canvas));
    }
    // Live fight loop: the boss fights a stationary invulnerable target, dies, and respawns.
    const { canvas, ctx } = pixelCanvas(240, 400, Math.min(g.zoom, 2), '#000');
    const r = new CanvasRenderer(ctx);
    const bg = new Background('kessler', 'boss-live');
    let { w, b } = boss('gallery-live');
    let acc = 0;
    g.animate((dt) => {
      acc += Math.min(dt, 0.1);
      while (acc >= DT) {
        acc -= DT;
        w.player.x = 120 + Math.sin(w.time * 0.7) * 60;
        step(w);
        if (b.phase === Phase.Fight && w.time > 8) wreck(w, b, 2);
        if (b.phase === Phase.Exposed && b.phaseT > 6 && b.core.enemy)
          damageEnemy(w, b.core.enemy, 1e6, 'player');
        if (b.done) ({ w, b } = boss(`gallery-live-${w.tick}`));
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 240, 400);
      bg.draw(ctx, w.scrollY, w.time, 400);
      asteroidLayer.draw(w, r, 1);
      bossLayer.draw(w, r, 1);
      for (const l of enemyLayers) l.draw(w, r, 1);
      r.rect(w.player.x - 3, w.player.y - 4, 6, 8, '#4088f8');
    });
    row.append(el('div', { class: 'card' }, el('h3', { text: 'Live loop' }), canvas));
  },
  110,
);
