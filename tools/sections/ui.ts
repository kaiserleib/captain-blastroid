import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { UI } from '../../src/gfx/palette';
import { drawBar, drawCursor, drawWindow } from '../../src/gfx/ui';
import { pixelCanvas, registerGallerySection } from '../galleryRegistry';

registerGallerySection(
  'UI',
  (root, g) => {
    const { canvas, ctx } = pixelCanvas(240, 150, g.zoom, '#000000');
    const r = new CanvasRenderer(ctx);
    const items = ['START', 'HANGAR', 'PILOTS', 'SETTINGS'];
    g.animate((_dt, t) => {
      r.rect(0, 0, 240, 150, '#000000');
      drawWindow(r, 8, 8, 96, 54);
      items.forEach((s, i) => r.text(s, 26, 14 + i * 11));
      drawCursor(r, 24, 17 + (Math.floor(t / 1.5) % items.length) * 11, t);

      drawWindow(r, 112, 8, 120, 54);
      r.text('KESTREL', 118, 14, { color: UI.textGold });
      r.text('SHIELD', 118, 26, { font: 'small' });
      drawBar(r, 150, 26, 76, 6, 3 + 2 * Math.sin(t), 5);
      r.text('HEAT', 118, 36, { font: 'small' });
      drawBar(r, 150, 36, 76, 6, 4.2, 5, { fill: UI.barWarn, highlight: '#f8a898' });
      r.text('⬢⬢⬢⬡⬡', 118, 46, { color: UI.barFill });

      drawWindow(r, 8, 70, 224, 36);
      r.text('Tap anywhere to launch!', 120, 76, { align: 'center' });
      r.text('MISSION 1  KESSLER BELT', 120, 88, { align: 'center', color: UI.textDim });

      drawWindow(r, 8, 114, 30, 28);
      drawWindow(r, 44, 114, 12, 12);
      drawWindow(r, 62, 114, 6, 6);
      drawBar(r, 80, 118, 60, 4, 1, 3);
      drawBar(r, 80, 126, 60, 8, 2.5, 3);
      r.text('→ ← ↑ ↓', 150, 118);
    });
    root.append(canvas);
  },
  40,
);
