import {
  registerChunks,
  TERRAIN_THEMES,
  TEST_CORRIDOR,
  type TerrainTheme,
} from '../../src/content/terrain';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { getCompiled } from '../../src/gfx/spriteCache';
import { computePlayerStats, createDefaultSave } from '../../src/meta';
import { initPlayer, playerLayer } from '../../src/game/player';
import {
  crushCount,
  nearestOpenX,
  queueChunk,
  terrainLayer,
  tileSpriteId,
} from '../../src/game/terrain';
import { bulletsSystem } from '../../src/sim/motion';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { spawnPlayerShot } from '../../src/sim/spawn';
import { createWorld, type World } from '../../src/sim/world';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const KINDS = [
  ['rock', 'masks 0–15, then inner corners'],
  ['crumbly', 'masks × crack stages 0–2'],
  ['gate', 'masks × crack stages 0–2'],
  ['socket', 'masks'],
] as const;

const BG = '#100c10';
const DT = 1 / 60;

registerChunks([
  { id: 'gallery_open', rows: Array.from({ length: 40 }, () => '..............................') },
  { id: 'gallery_ceiling', rows: ['........######################'] },
]);

function sheetCard(theme: TerrainTheme, zoom: number): HTMLElement {
  const card = el('div', { class: 'card' }, el('h3', { text: theme }));
  for (const [kind, note] of KINDS) {
    const c = getCompiled(tileSpriteId(theme, kind));
    if (!c) continue;
    const per = 16;
    const rows = Math.ceil(c.frames / per);
    const { canvas, ctx } = pixelCanvas(per * 10, rows * 10, zoom * 2, BG);
    for (let f = 0; f < c.frames; f++) {
      ctx.drawImage(
        c.sheet,
        f * 8,
        0,
        8,
        8,
        (f % per) * 10 + 1,
        Math.floor(f / per) * 10 + 1,
        8,
        8,
      );
    }
    card.append(el('p', { class: 'label', text: `${kind}: ${note}` }), canvas);
  }
  return card;
}

function makeWorld(seed: string): World {
  const w = createWorld(seed);
  initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid'));
  w.scrollSpeed = 30;
  return w;
}

/** A live 240×400 panel: `tick` runs before the systems each step. */
function panel(
  zoom: number,
  animate: (fn: (dt: number) => void) => void,
  setup: () => World,
  tick: (w: World) => void,
  caption: (w: World) => string,
): HTMLElement {
  const { canvas, ctx } = pixelCanvas(240, 400, Math.min(zoom, 2), BG);
  const r = new CanvasRenderer(ctx);
  const label = el('p', { class: 'label' });
  let w = setup();
  let acc = 0;
  animate((dt) => {
    acc += Math.min(dt, 0.1);
    while (acc >= DT) {
      acc -= DT;
      w.tick++;
      w.time += DT;
      if (w.player.invulnT > 0) w.player.invulnT = Math.max(0, w.player.invulnT - DT);
      tick(w);
      bulletsSystem.update(w, DT);
      collisionSystem.update(w, DT);
      cleanupSystem.update(w, DT);
      if (w.time > 40) w = setup();
    }
    r.rect(0, 0, 240, 400, BG);
    terrainLayer.draw(w, r, 1);
    const shots = w.playerShots;
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i];
      if (s?.active) r.sprite('pbullet_blaster', s.x, s.y);
    }
    playerLayer.draw(w, r, 1);
    label.textContent = caption(w);
  });
  return el('div', { class: 'card' }, canvas, label);
}

// Flies the test corridor: steers toward the open spot 1.5 s of scroll ahead, firing.
function pilot(w: World): void {
  const p = w.player;
  const aheadY = p.y - w.scrollSpeed * 1.5;
  const near = nearestOpenX(w, p.x, p.y - 12);
  const far = nearestOpenX(w, p.x, aheadY);
  const tx = near !== near ? p.x : far !== far ? near : (near + far) / 2;
  const step = p.speed * DT;
  p.x += Math.max(-step, Math.min(step, tx - p.x));
  if (w.tick % 8 === 0) {
    spawnPlayerShot(w, { x: p.x - 4, y: p.y - 12, vx: 0, vy: -300, damage: 1 });
    spawnPlayerShot(w, { x: p.x + 4, y: p.y - 12, vx: 0, vy: -300, damage: 1 });
  }
}

registerGallerySection(
  'Terrain',
  (root, g) => {
    const sets = el('div', { class: 'grid' });
    for (const t of TERRAIN_THEMES) sets.append(sheetCard(t, g.zoom));
    const live = el('div', { class: 'grid' });
    for (const theme of TERRAIN_THEMES) {
      live.append(
        panel(
          g.zoom,
          g.animate,
          () => {
            const w = makeWorld(`gallery-terrain-${theme}`);
            for (const id of TEST_CORRIDOR) queueChunk(w, id, { theme });
            return w;
          },
          pilot,
          (w) => `${theme}: test corridor, t ${w.time.toFixed(0)} s`,
        ),
      );
    }
    live.append(
      panel(
        g.zoom,
        g.animate,
        () => {
          const w = makeWorld('gallery-crush');
          queueChunk(w, 'gallery_open', { theme: 'warrens' });
          queueChunk(w, 'gallery_ceiling', { theme: 'warrens' });
          w.scrollSpeed = 60;
          w.player.x = 180;
          w.player.y = 360;
          return w;
        },
        () => {},
        (w) =>
          `crush demo: the ceiling drags the parked ship down. Crushes ${crushCount(w)}, shield ${w.player.shield}`,
      ),
    );
    root.append(
      el('p', {
        class: 'label',
        text: 'Tile sets by 4-neighbour mask (bits: 1 up, 2 right, 4 down, 8 left; set = solid neighbour).',
      }),
      sets,
      el('p', {
        class: 'label',
        text: 'Live: the sandbox test corridor in both tile sets (a bot follows the open column 1.5 s ahead and shoots the gates), and a crush.',
      }),
      live,
    );
  },
  125,
);
