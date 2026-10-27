// T33 "Hazards II": the three Act II shared hazards, live, each over the
// background of the sector that leans on it (corona, junction, rift).
import { Background, isThemeId, type ThemeId } from '../../src/backgrounds';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import {
  anomalyLayer,
  asteroidLayer,
  obstaclesSystem,
  portalPairs,
  spawnBubble,
  spawnPortalPair,
  spawnRock,
  spawnShadeSlab,
  startFlares,
  swapPortals,
} from '../../src/game/obstacles';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { spawnEnemyShot, spawnPlayerShot } from '../../src/sim/spawn';
import { createWorld, type World } from '../../src/sim/world';
import { el, pixelCanvas, registerGallerySection, type GalleryContext } from '../galleryRegistry';

const DT = 1 / 60;

interface Demo {
  title: string;
  theme: string;
  setup(w: World): void;
  tick(w: World): void;
}

function bgTheme(id: string): ThemeId {
  return isThemeId(id) ? id : 'kessler';
}

function drawShots(w: World, r: CanvasRenderer): void {
  for (const pool of [w.playerShots, w.enemyShots]) {
    for (let i = 0; i < pool.count; i++) {
      const s = pool.items[i];
      if (s?.active) r.sprite(s.sprite, s.x, s.y, { rot: s.rot });
    }
  }
}

function panel(root: HTMLElement, g: GalleryContext, d: Demo): void {
  const { canvas, ctx } = pixelCanvas(240, 400, Math.min(g.zoom, 2), '#000');
  const r = new CanvasRenderer(ctx);
  const bg = new Background(bgTheme(d.theme), 'gallery');
  const w = createWorld(`gallery-${d.theme}`, { levelId: d.theme });
  w.scrollSpeed = 24;
  w.player.alive = false;
  d.setup(w);
  let acc = 0;
  g.animate((dt) => {
    acc += Math.min(dt, 0.1);
    while (acc >= DT) {
      acc -= DT;
      w.tick++;
      w.time += DT;
      w.scrollY += w.scrollSpeed * DT;
      d.tick(w);
      bulletsSystem.update(w, DT);
      obstaclesSystem.update(w, DT);
      collisionSystem.update(w, DT);
      cleanupSystem.update(w, DT);
    }
    bg.draw(ctx, w.scrollY, w.time, 400);
    anomalyLayer.draw(w, r, 1);
    asteroidLayer.draw(w, r, 1);
    drawShots(w, r);
  });
  root.append(el('div', { class: 'card' }, el('h3', { text: d.title }), canvas));
}

let rockT = 0;
let shotT = 0;
let swapT = 0;

const DEMOS: Demo[] = [
  {
    title: 'corona: flares + shade (slabs, large rocks)',
    theme: 'corona',
    setup(w) {
      rockT = 0;
      startFlares(w, { every: 4.5, until: 1e9, warn: 1.2, burn: 1.2 });
      spawnShadeSlab(w, 70, 60, { vy: 12 });
      spawnShadeSlab(w, 180, 150, { vy: 12 });
    },
    tick(w) {
      if ((rockT -= DT) <= 0) {
        rockT = 1.6;
        const x = w.rng.range(20, 220);
        if (w.rng.next() < 0.3) spawnShadeSlab(w, x, -6);
        else spawnRock(w, { size: 'large', x, y: -16, vx: 0, vy: w.scrollSpeed, hp: 0 });
      }
    },
  },
  {
    title: 'junction: portals (shots, swap every 4 s, closed end dim)',
    theme: 'junction',
    setup(w) {
      shotT = 0;
      swapT = 4;
      spawnPortalPair(w, 60, 260, 180, 90, { color: 'cyan' });
      spawnPortalPair(w, 180, 260, 60, 120, { color: 'orange' });
      // Partner off screen: drawn dim, closed to the ship.
      spawnPortalPair(w, 120, 180, 120, -40, { color: 'lime' });
    },
    tick(w) {
      if ((shotT -= DT) <= 0) {
        shotT = 0.2;
        for (const x of [60, 120, 180])
          spawnPlayerShot(w, { x, y: 400, vx: 0, vy: -160, sprite: 'pbullet_blaster' });
      }
      if ((swapT -= DT) <= 0) {
        swapT = 4;
        const ps = portalPairs(w).filter((p) => p.active && p.color !== 'lime');
        if (ps.length >= 2) swapPortals(w, ps[0]!, ps[1]!);
      }
    },
  },
  {
    title: 'rift: time bubbles (slow, fast, flip) with ghosting',
    theme: 'rift',
    setup(w) {
      shotT = 0;
      spawnBubble(w, 70, 140, { kind: 'slow', r: 52, vy: 0 });
      spawnBubble(w, 180, 230, { kind: 'fast', r: 36, vy: 0 });
      spawnBubble(w, 90, 310, { kind: 'flip', r: 52, vy: 0 });
    },
    tick(w) {
      if ((shotT -= DT) <= 0) {
        shotT = 0.12;
        const x = w.rng.range(10, 230);
        spawnEnemyShot(w, {
          x,
          y: -4,
          vx: w.rng.range(-15, 15),
          vy: 90,
          r: 3,
          sprite: 'ebullet_s',
        });
      }
    },
  },
];

registerGallerySection(
  'Hazards II',
  (root, g) => {
    const row = el('div', { class: 'grid' });
    root.append(
      el('p', {
        class: 'label',
        text: 'T33 Act II hazards, live: solar flares and shade, portal pairs, time bubbles.',
      }),
      row,
    );
    for (const d of DEMOS) panel(row, g, d);
  },
  125,
);
