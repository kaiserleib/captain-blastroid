import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { warm } from '../../src/gfx/spriteCache';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const N = 2000;
const FRAMES = 240;
const W = 240;
const H = 400;
const IDS = ['ebullet_s', 'pbullet_blaster', 'capsule', 'kestrel'];

registerGallerySection(
  'Benchmark',
  (root, g) => {
    const { canvas, ctx } = pixelCanvas(W, H, Math.min(g.zoom, 2), '#000');
    const r = new CanvasRenderer(ctx);
    const out = el('pre', { text: `Draws ${N} cached sprites per frame for ${FRAMES} frames.` });
    const btn = el('button', { text: `Run benchmark (${N} sprites/frame)` });

    // Preallocated so the measured loop itself doesn't allocate.
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    const vs = new Float32Array(N);
    const kinds = new Uint8Array(N);
    let s = 1;
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < N; i++) {
      xs[i] = rand() * W;
      ys[i] = rand() * H;
      vs[i] = 30 + rand() * 120;
      // Mostly bullets, like a real busy frame.
      kinds[i] = i % 50 === 0 ? 3 : i % 10 === 0 ? 2 : i % 2;
    }

    const opts = { frame: 0, rot: 0 };
    let raf = 0;
    btn.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      warm(IDS);
      btn.disabled = true;
      let frame = 0;
      let drawMs = 0;
      let maxDraw = 0;
      let first = 0;
      let last = 0;
      const step = (now: number) => {
        if (frame === 0) first = now;
        last = now;
        const t0 = performance.now();
        r.rect(0, 0, W, H, '#000008');
        for (let i = 0; i < N; i++) {
          let y = (ys[i] as number) + (vs[i] as number) / 60;
          if (y > H + 8) y -= H + 16;
          ys[i] = y;
          const k = kinds[i] as number;
          opts.frame = frame >> 2;
          opts.rot = k === 1 ? i * 0.39 : 0;
          r.sprite(IDS[k] as string, xs[i] as number, y, opts);
        }
        // Read one pixel back so the GPU work is inside the measurement.
        ctx.getImageData(0, 0, 1, 1);
        const d = performance.now() - t0;
        drawMs += d;
        if (d > maxDraw) maxDraw = d;
        frame++;
        if (frame < FRAMES) {
          raf = requestAnimationFrame(step);
          return;
        }
        const fps = ((FRAMES - 1) * 1000) / (last - first);
        out.textContent =
          `${N} sprites × ${FRAMES} frames\n` +
          `draw: avg ${(drawMs / FRAMES).toFixed(2)} ms, max ${maxDraw.toFixed(2)} ms ` +
          `(budget 16.7 ms)\n` +
          `rAF rate during run: ${fps.toFixed(1)} fps`;
        btn.disabled = false;
      };
      raf = requestAnimationFrame(step);
    });

    root.append(el('div', { class: 'row' }, btn), out, canvas);
    return () => cancelAnimationFrame(raf);
  },
  90,
);
