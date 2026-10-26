import { createRng } from '../../src/engine/rng';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { hasSprite } from '../../src/gfx/sprite';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const W = 240;
const H = 220;
const STAR_COLORS = ['#303048', '#585878', '#a0a0c0', '#f8f8f8'];

registerGallerySection(
  'Flight test',
  (root, g) => {
    const { canvas, ctx } = pixelCanvas(W, H, g.zoom);
    const r = new CanvasRenderer(ctx);
    const rng = createRng('gallery-stars');
    const stars = Array.from({ length: 90 }, () => ({
      x: rng.int(0, W - 1),
      y: rng.range(0, H),
      layer: rng.int(0, 3),
    }));
    const shots: { x: number; y: number }[] = [];
    const ebs: { x: number; y: number; vx: number; vy: number }[] = [];
    let fireT = 0;
    let ebT = 0;
    let prevX = W / 2;

    g.animate((dt, t) => {
      r.rect(0, 0, W, H, '#000008');
      for (const s of stars) {
        s.y += dt * (6 + s.layer * 14);
        if (s.y >= H) s.y -= H;
        r.rect(s.x, s.y, 1, s.layer === 3 ? 2 : 1, STAR_COLORS[s.layer] as string);
      }

      const x = W / 2 + Math.sin(t * 0.9) * 70;
      const y = H - 40 + Math.sin(t * 1.7) * 8;
      const vx = (x - prevX) / Math.max(dt, 1e-3);
      prevX = x;

      fireT -= dt;
      if (fireT <= 0) {
        fireT = 0.09;
        shots.push({ x: x - 4, y: y - 12 }, { x: x + 4, y: y - 12 });
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]!;
        s.y -= dt * 300;
        if (s.y < -8) shots.splice(i, 1);
        else r.sprite('pbullet_blaster', s.x, s.y);
      }

      ebT -= dt;
      if (ebT <= 0) {
        ebT = 0.6;
        const ox = 40 + ((t * 53) % 160);
        for (let k = -2; k <= 2; k++) {
          const a = Math.PI / 2 + k * 0.25;
          ebs.push({ x: ox, y: -4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 });
        }
      }
      for (let i = ebs.length - 1; i >= 0; i--) {
        const b = ebs[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > H + 8) ebs.splice(i, 1);
        else r.sprite('ebullet_s', b.x, b.y, { frame: Math.floor(t * 8) });
      }

      r.sprite('capsule', 40 + Math.sin(t) * 6, 60 + ((t * 20) % 140), {
        frame: Math.floor(t * 4),
      });

      let ship = 'kestrel';
      if (vx < -40 && hasSprite('kestrel_bank_l')) ship = 'kestrel_bank_l';
      else if (vx > 40 && hasSprite('kestrel_bank_r')) ship = 'kestrel_bank_r';
      r.sprite(ship, x, y, { frame: Math.floor(t * 15), flash: t % 3 < 0.07 });
    });

    root.append(
      el('p', {
        class: 'label',
        text: 'Kestrel over a dark starfield with blaster shots, an enemy spread and a capsule. Flashes white every 3 s. Check it at 1×.',
      }),
      canvas,
    );
  },
  20,
);
