import { Background, getTheme, THEME_IDS, type ThemeId } from '../../src/backgrounds';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { warm } from '../../src/gfx/spriteCache';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

// Every background theme, scrolling at its nominal speed, under a readability
// overlay: an enemy-bullet fan, a large bullet, pickups and the ship. The
// Measure button times each theme's draw so new themes can be held to the
// most expensive Act I theme.
const W = 240;
const H = 400;
const ACT1: readonly ThemeId[] = ['kessler', 'ion', 'horizon', 'pulsar', 'armada', 'title'];
/** Seconds into each level the panel starts at, to frame its set pieces. */
const START: Partial<Record<ThemeId, number>> = { warrens: 14, junction: 12, rift: 8, foundry: 12 };
const OVERLAY = ['kestrel', 'ebullet_s', 'ebullet_l', 'capsule', 'pickup_shield', 'salvage_s'];

function overlay(r: CanvasRenderer, t: number): void {
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.2 + (0.6 * i) / 8);
    const d = 40 + ((t * 50) % 200);
    r.sprite('ebullet_s', 120 + Math.cos(a) * d, 40 + Math.sin(a) * d);
  }
  r.sprite('ebullet_l', 60, 120);
  r.sprite('ebullet_l', 180, 30);
  r.sprite('capsule', 50, 250, { frame: t * 4 });
  r.sprite('pickup_shield', 190, 260, { frame: t * 4 });
  r.sprite('salvage_s', 150, 300, { frame: t * 4 });
  r.sprite('kestrel', 120, 340);
}

registerGallerySection(
  'Backgrounds',
  (root, g) => {
    warm(OVERLAY);
    const grid = el('div', { class: 'row' });
    const panels: {
      bg: Background;
      ctx: CanvasRenderingContext2D;
      r: CanvasRenderer;
      id: ThemeId;
      scroll: number;
    }[] = [];
    for (const id of THEME_IDS) {
      const { canvas, ctx } = pixelCanvas(W, H, 1);
      const bg = new Background(id, 'gallery');
      bg.prebuild();
      const scroll = (START[id] ?? 0) * getTheme(id).scrollSpeed;
      panels.push({ bg, ctx, r: new CanvasRenderer(ctx), id, scroll });
      grid.append(el('figure', {}, canvas, el('figcaption', { text: id })));
    }
    g.animate((dt, t) => {
      for (const p of panels) {
        const speed = getTheme(p.id).scrollSpeed;
        p.scroll += speed * dt;
        p.bg.draw(p.ctx, p.scroll, t, H, speed);
        overlay(p.r, t);
      }
    });

    const out = el('pre', { text: 'Per-theme draw cost: press Measure.' });
    const btn = el('button', { text: 'Measure draw cost (all themes)' });
    btn.addEventListener('click', () => {
      btn.disabled = true;
      // Synchronous and off-screen. Each run sweeps a 220 s level at the theme's
      // nominal speed, so set pieces are on screen as often as in play; "fast"
      // repeats it with speed lines at 90 px/s (the Foundry escape). Best of
      // three runs, to keep GC and timer noise out of the comparison.
      const { ctx } = pixelCanvas(W, H, 1);
      const FRAMES = 1200;
      const rows: [ThemeId, number, number][] = [];
      const measure = (bg: Background, speed: number, lineSpeed: number): number => {
        let best = Infinity;
        for (let run = 0; run < 3; run++) {
          const t0 = performance.now();
          for (let i = 0; i < FRAMES; i++)
            bg.draw(ctx, (i / FRAMES) * 220 * speed, i / 60, H, lineSpeed);
          ctx.getImageData(0, 0, 1, 1);
          best = Math.min(best, (performance.now() - t0) / FRAMES);
        }
        return best;
      };
      for (const id of THEME_IDS) {
        const bg = new Background(id, 'measure');
        bg.prebuild();
        for (let i = 0; i < 30; i++) bg.draw(ctx, i * 60, i / 60, H, 90);
        ctx.getImageData(0, 0, 1, 1);
        const speed = getTheme(id).scrollSpeed;
        rows.push([id, measure(bg, speed, speed), measure(bg, speed, 90)]);
      }
      const act1 = rows.filter(([id]) => ACT1.includes(id));
      const max1 = Math.max(...act1.map(([, c]) => c));
      const max2 = Math.max(...act1.map(([, , f]) => f));
      out.textContent = rows
        .map(([id, c, f]) => {
          const flag = !ACT1.includes(id) && (c > max1 || f > max2) ? '  > Act I max' : '';
          return `${id.padEnd(9)} cruise ${c.toFixed(4)}  fast ${f.toFixed(4)} ms/frame${flag}`;
        })
        .concat(`Act I max  cruise ${max1.toFixed(4)}  fast ${max2.toFixed(4)}`)
        .join('\n');
      btn.disabled = false;
    });
    root.append(el('div', { class: 'row' }, btn), out, grid);
  },
  60,
);
