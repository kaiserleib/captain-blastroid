import { RAMPS } from '../../src/gfx/palette';
import { el, registerGallerySection } from '../galleryRegistry';

registerGallerySection(
  'Palettes',
  (root) => {
    for (const [name, ramp] of Object.entries(RAMPS)) {
      const row = el('div', { class: 'row' });
      for (const [key, color] of Object.entries(ramp)) {
        const chip = el('div');
        chip.style.background = color;
        row.append(el('div', { class: 'swatch', title: color }, chip, `${key}`, el('br'), color));
      }
      root.append(el('h3', { text: name }), row);
    }
  },
  0,
);
