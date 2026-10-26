import { PLAYFIELD_H } from '../../src/engine/display';
import { createHudDemoSystem, Hud } from '../../src/game/hud';
import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { createWorld } from '../../src/sim/world';
import { pixelCanvas, registerGallerySection } from '../galleryRegistry';

// The in-game HUD at the three reference heights, driven by the `?sandbox&hud` demo script.
registerGallerySection('HUD', (root, g) => {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start';
  for (const h of [400, 440, 520]) {
    const { canvas, ctx } = pixelCanvas(240, h, g.zoom, '#000000');
    const r = new CanvasRenderer(ctx);
    r.offsetY = Math.floor((h - PLAYFIELD_H) / 2);
    const w = createWorld(`HUD${h}`);
    const hud = new Hud();
    hud.attach(w);
    const demo = createHudDemoSystem();
    g.animate((dt) => {
      w.time += dt;
      demo.update(w, dt);
      w.enemies.compact();
      ctx.fillStyle = '#100818';
      ctx.fillRect(0, 0, 240, h);
      r.rect(0, 0, 240, PLAYFIELD_H, '#182030');
      hud.layer.draw(w, r, 1);
    });
    const fig = document.createElement('figure');
    fig.style.margin = '0';
    const cap = document.createElement('figcaption');
    cap.textContent = `240×${h}`;
    fig.append(canvas, cap);
    row.append(fig);
  }
  root.append(row);
});
