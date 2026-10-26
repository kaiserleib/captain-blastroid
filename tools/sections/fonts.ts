import { CanvasRenderer } from '../../src/gfx/canvasRenderer';
import { drawText, FONTS, measure } from '../../src/gfx/font';
import { UI } from '../../src/gfx/palette';
import { el, pixelCanvas, registerGallerySection } from '../galleryRegistry';

const BG = '#000000';
const DEBUG_LINES = ['FPS 60  TPS 60', 'UPD 0.12ms MAX 0.48', 'PS12 ES48 EN6 AS9 AN0 PU3'];

const CHARSETS = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789 .,:;!?-+×/%()\'"<>=#*_$',
  '←↑→↓ ▶ ⬢⬢⬢⬡ ',
];

registerGallerySection(
  'Fonts',
  (root, g) => {
    // The look the UI font is modeled on: T00's placeholder (canvas 8px monospace into the
    // 240-px buffer, 1 px black shadow) next to the bitmap font drawing the same text.
    const cmp = el('div', { class: 'grid' });
    const old = pixelCanvas(150, 30, g.zoom, BG);
    old.ctx.font = '8px monospace';
    old.ctx.textBaseline = 'top';
    DEBUG_LINES.forEach((s, i) => {
      old.ctx.fillStyle = '#000';
      old.ctx.fillText(s, 3, 3 + i * 9);
      old.ctx.fillStyle = UI.textDebug;
      old.ctx.fillText(s, 2, 2 + i * 9);
    });
    const neu = pixelCanvas(150, 30, g.zoom, BG);
    const nr = new CanvasRenderer(neu.ctx);
    DEBUG_LINES.forEach((s, i) => nr.text(s, 2, 2 + i * 9, { color: UI.textDebug }));
    cmp.append(
      el('div', { class: 'card' }, el('h3', { text: 'old: canvas 8px monospace' }), old.canvas),
      el('div', { class: 'card' }, el('h3', { text: "new: bitmap 'ui' font" }), neu.canvas),
    );
    root.append(cmp);

    for (const font of Object.values(FONTS)) {
      const lines = font.id === 'small' ? [CHARSETS[0], CHARSETS[2], CHARSETS[3]] : CHARSETS;
      const text = (lines as string[]).join('\n');
      const w = measure(text, font) + 6;
      const h = lines.length * font.lineHeight + 6;
      const sheet = pixelCanvas(w, h, g.zoom, BG);
      drawText(sheet.ctx, text, 2, 2, { font });

      const colors = [UI.text, UI.textGold, UI.textDebug, UI.barFill, UI.barWarn];
      const sample = font.id === 'small' ? 'SCORE 0012340  ×3  SALVAGE 85' : 'CAPTAIN BLASTROID';
      const sw = measure(sample, font) + 6;
      const tint = pixelCanvas(sw, colors.length * font.lineHeight + 4, g.zoom, '#102060');
      colors.forEach((c, i) =>
        drawText(tint.ctx, sample, 2, 2 + i * font.lineHeight, { font, color: c }),
      );

      const big = pixelCanvas(measure('BLASTROID', font) * 3 + 8, font.cellH * 3 + 6, g.zoom, BG);
      drawText(big.ctx, 'BLASTROID', 2, 2, { font, scale: 3, color: UI.textGold });

      root.append(
        el('h3', {
          text: `'${font.id}' font  cell h ${font.cellH}  line ${font.lineHeight}  (measure "BLASTROID" = ${measure('BLASTROID', font)} px)`,
        }),
        el('div', { class: 'grid' }, sheet.canvas, tint.canvas, big.canvas),
      );
    }
  },
  30,
);
