import { Background } from '../../src/backgrounds';
import { PULSAR_VARIANT_IDS, ROCK_THEME_IDS, type RockTheme } from '../../src/content/obstacles';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import {
  anomalyLayer,
  asteroidLayer,
  drawTractorBeam,
  flingRock,
  isTowed,
  obstaclesSystem,
  pulsarGapAngles,
  setPulsarPattern,
  spawnAsteroidStream,
  spawnBlackHole,
  spawnPulsar,
  spawnRock,
  towRock,
} from '../../src/game/obstacles';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { spawnPlayerShot } from '../../src/sim/spawn';
import type { Asteroid } from '../../src/sim/types';
import { createWorld, type World } from '../../src/sim/world';
import {
  el,
  pixelCanvas,
  registerGallerySection,
  type GallerySectionRender,
} from '../galleryRegistry';

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

// T23 hazards: black-hole variants over the L2–L4 backgrounds, pulsar variants
// with a marker parked in a telegraphed gap, and a tractor-beam tow/fling loop.
type HazardTheme = 'ion' | 'horizon' | 'pulsar';
type Ctx = Parameters<GallerySectionRender>[1];

function livePanel(
  g: Ctx,
  theme: HazardTheme,
  seed: string,
  setup: (w: World) => void,
  tick: ((w: World) => void) | null,
  overlay: ((w: World, r: CanvasRenderer) => void) | null,
): HTMLCanvasElement {
  const { canvas, ctx } = pixelCanvas(240, 400, Math.min(g.zoom, 2), '#000');
  const r = new CanvasRenderer(ctx);
  const bg = new Background(theme, 'gallery');
  const w = createWorld(seed, { levelId: theme });
  w.player.alive = false;
  setup(w);
  let acc = 0;
  g.animate((dt) => {
    acc += Math.min(dt, 0.1);
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      w.tick++;
      w.time += 1 / 60;
      w.scrollY += w.scrollSpeed / 60;
      tick?.(w);
      bulletsSystem.update(w, 1 / 60);
      obstaclesSystem.update(w, 1 / 60);
      collisionSystem.update(w, 1 / 60);
      cleanupSystem.update(w, 1 / 60);
    }
    bg.draw(ctx, w.scrollY, w.time, 400);
    anomalyLayer.draw(w, r, 1);
    asteroidLayer.draw(w, r, 1);
    for (let i = 0; i < w.playerShots.count; i++) {
      const s = w.playerShots.items[i];
      if (s?.active) r.sprite(s.sprite, s.x, s.y, { rot: s.rot });
    }
    overlay?.(w, r);
  });
  return canvas;
}

function shotFan(w: World, every: number): void {
  if (w.tick % every !== 0) return;
  for (let k = 0; k < 5; k++) {
    spawnPlayerShot(w, { x: 30 + k * 45, y: 400, vx: 0, vy: -200, sprite: 'pbullet_blaster' });
  }
}

function marker(r: CanvasRenderer, x: number, y: number, color: string): void {
  r.rect(x - 3, y - 3, 7, 1, color);
  r.rect(x - 3, y + 3, 7, 1, color);
  r.rect(x - 3, y - 3, 1, 7, color);
  r.rect(x + 3, y - 3, 1, 7, color);
}

registerGallerySection(
  'Hazards',
  (root, g) => {
    const holes = el('div', { class: 'grid' });
    const pulsars = el('div', { class: 'grid' });
    const tows = el('div', { class: 'grid' });
    root.append(
      el('p', {
        class: 'label',
        text: 'Black holes small / standard / massive over the ion, horizon and pulsar backgrounds. Fields are not drawn; the shots bend.',
      }),
      holes,
      el('p', {
        class: 'label',
        text: 'Pulsar variants: gap spokes telegraph the next pulse, rings have the gaps cut out. The box sits in a gap. Magnetar runs a double pattern.',
      }),
      pulsars,
      el('p', {
        class: 'label',
        text: 'Tractor beam: tow into a 46 px orbit slot, fling at the box every 3 s.',
      }),
      tows,
    );

    for (const theme of ['ion', 'horizon', 'pulsar'] as const) {
      const c = livePanel(
        g,
        theme,
        `hz-${theme}`,
        (w) => {
          spawnBlackHole(w, 60, 110, { vy: 0, variant: 'small' });
          spawnBlackHole(w, 180, 170, { vy: 0, variant: 'standard' });
          spawnBlackHole(w, 90, 280, { vy: 0, variant: 'massive' });
        },
        (w) => shotFan(w, 18),
        null,
      );
      holes.append(el('div', { class: 'card' }, el('h3', { text: theme }), c));
    }

    for (const variant of PULSAR_VARIANT_IDS) {
      const gaps = [0, 0, 0, 0, 0, 0, 0, 0];
      const c = livePanel(
        g,
        'pulsar',
        `pn-${variant}`,
        (w) => {
          const a = spawnPulsar(w, 120, 140, { vy: 0, variant });
          if (a && variant === 'magnetar') {
            setPulsarPattern(a, { period: 2.6, gaps: 3, gapDeg: 44, gapSpin: 25, double: true });
          }
        },
        null,
        (w, r) => {
          const a = w.anomalies.items[0];
          if (!a?.active || pulsarGapAngles(a, gaps) < 1) return;
          const ang = gaps[0] as number;
          marker(r, a.x + Math.cos(ang) * 120, a.y + Math.sin(ang) * 120, '#58d0f8');
        },
      );
      pulsars.append(el('div', { class: 'card' }, el('h3', { text: variant }), c));
    }

    let rock: Asteroid | null = null;
    let id = -1;
    let towT = 0;
    const ex = 120;
    const ey = 80;
    const c = livePanel(
      g,
      'ion',
      'hz-tow',
      () => {},
      (w) => {
        if (rock === null || !rock.active || rock.id !== id) {
          rock = spawnRock(w, {
            size: 'large',
            x: w.rng.range(30, 210),
            y: -20,
            vx: 0,
            vy: 20,
            theme: 'ion',
          });
          id = rock?.id ?? -1;
          towT = 0;
          return;
        }
        towT += 1 / 60;
        if (towT < 3) {
          // The Shepherd's orbit: 46 px from the emitter at 1.2 rad/s.
          const ang = w.time * 1.2;
          const sx = ex + Math.cos(ang) * 46;
          const sy = ey + Math.sin(ang) * 46;
          towRock(w, rock, sx, sy, 14, -Math.sin(ang) * 55, Math.cos(ang) * 55);
        } else if (isTowed(rock)) {
          flingRock(w, rock, 95, 120, 340);
        }
      },
      (w, r) => {
        r.circle(ex, ey, 4, '#d0f8f8');
        marker(r, 120, 340, '#58d0f8');
        if (rock?.active && rock.id === id && isTowed(rock)) {
          drawTractorBeam(r, ex, ey, rock.x, rock.y, w.time);
        }
      },
    );
    tows.append(el('div', { class: 'card' }, el('h3', { text: 'tow + fling' }), c));
  },
  121,
);
