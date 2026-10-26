import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { spriteIds } from '../../src/gfx/sprite';
import { getCompiled, ROTATION_STEPS } from '../../src/gfx/spriteCache';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const CELL_BG = '#080410';
const STEP = (Math.PI * 2) / ROTATION_STEPS;

function strip(
  id: string,
  count: number,
  cw: number,
  ch: number,
  ox: number,
  oy: number,
  zoom: number,
  draw: (r: CanvasRenderer, i: number, x: number, y: number) => void,
): HTMLCanvasElement {
  const pad = 2;
  const { canvas, ctx } = pixelCanvas(count * (cw + pad) - pad, ch, zoom);
  const r = new CanvasRenderer(ctx);
  for (let i = 0; i < count; i++) {
    const x = i * (cw + pad);
    r.rect(x, 0, cw, ch, CELL_BG);
    draw(r, i, x + ox, oy);
  }
  canvas.title = id;
  return canvas;
}

registerGallerySection(
  'Sprites',
  (root, g) => {
    const grid = el('div', { class: 'grid' });
    root.append(
      el('p', {
        class: 'label',
        text: 'Every registered sprite: frames, animated preview, white hit-flash, and the 16 pre-baked rotations (rotating sprites only).',
      }),
      grid,
    );
    for (const id of spriteIds()) {
      const c = getCompiled(id);
      if (!c) continue;
      const card = el('div', { class: 'card' });
      card.append(
        el('h3', {
          text: `${id}  ${c.w}×${c.h}  ${c.frames}f${c.rotations ? '  rot16' : ''}`,
        }),
      );

      const frames = strip(id, c.frames, c.w, c.h, c.ox, c.oy, g.zoom, (r, i, x, y) =>
        r.sprite(id, x, y, { frame: i }),
      );
      const flash = strip(id, c.frames, c.w, c.h, c.ox, c.oy, g.zoom, (r, i, x, y) =>
        r.sprite(id, x, y, { frame: i, flash: true }),
      );
      const { canvas: anim, ctx } = pixelCanvas(c.w, c.h, g.zoom);
      const ar = new CanvasRenderer(ctx);
      g.animate((_dt, t) => {
        ar.rect(0, 0, c.w, c.h, CELL_BG);
        ar.sprite(id, c.ox, c.oy, { frame: Math.floor(t * 10) });
      });

      card.append(
        el('div', { class: 'row' }, frames, el('span', { class: 'label', text: 'frames' })),
        el('div', { class: 'row' }, anim, el('span', { class: 'label', text: 'anim' })),
        el('div', { class: 'row' }, flash, el('span', { class: 'label', text: 'flash' })),
      );
      if (c.rotations === 16) {
        const rot = strip(id, ROTATION_STEPS, c.rw, c.rh, c.rox, c.roy, g.zoom, (r, i, x, y) =>
          r.sprite(id, x, y, { rot: i * STEP }),
        );
        const rotFlash = strip(id, ROTATION_STEPS, c.rw, c.rh, c.rox, c.roy, g.zoom, (r, i, x, y) =>
          r.sprite(id, x, y, { rot: i * STEP, flash: true }),
        );
        card.append(
          el('div', { class: 'row' }, rot, el('span', { class: 'label', text: 'rotations' })),
          el('div', { class: 'row' }, rotFlash),
        );
      }
      grid.append(card);
    }
  },
  10,
);
