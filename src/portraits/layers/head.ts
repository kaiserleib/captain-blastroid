import { SKIN } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { PortraitTraits } from '../traits';

export function drawNeck(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  const x = g.cx - 3;
  const h = g.bodyTop + 1 - g.neckY;
  p.rect(s.base, x, g.neckY, 6, h);
  p.rect(s.shadow, x + 4, g.neckY, 2, h);
  // The jaw casts a shadow onto the neck.
  p.rect(s.shadow, x, g.fy + g.fh, 6, 2);
  p.rect(s.dark, x + 1, g.fy + g.fh, 4, 1);
  if (t.age === 'old') p.px(s.shadow, x + 2, g.fy + g.fh + 3);
}

/** siege-and-shuffle's `drawRectHead`, re-lit from the top-left. */
function rectHead(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  const { fx, fy, fw, fh, chin } = g;
  const chinStart = fh - chin;
  p.rect(s.base, fx, fy, fw, chinStart);
  for (let r = 0; r < chin; r++)
    p.rect(s.base, fx + r + 1, fy + chinStart + r, fw - (r + 1) * 2, 1);
  p.rect(s.shadow, fx + fw - 2, fy, 2, chinStart);
  for (let r = 0; r < chin; r++) p.rect(s.shadow, fx + fw - r - 3, fy + chinStart + r, 2, 1);
  // Underside of the jaw.
  p.rect(s.shadow, fx + chin + 1, fy + fh - 1, fw - (chin + 1) * 2, 1);
  p.rect(s.light, fx, fy, 2, Math.floor(fh * 0.45));
  p.rect(s.light, fx + 2, fy, fw - 6, 1);
  // Cheekbone shading gives the face some volume.
  p.rect(s.shadow, fx + fw - 4, g.noseY + 1, 2, 2);
  if (t.head === 'square' || t.head === 'heavy') {
    p.rect(s.shadow, fx, fy + chinStart - 2, 1, 2);
    p.rect(s.light, fx + 1, fy + chinStart, 1, 1);
  }
}

function ears(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  const y = g.earY;
  if (t.alien) {
    // Swept fins instead of human ears.
    p.rect(s.base, g.fx - 2, y, 2, 4);
    p.rect(s.base, g.fx - 3, y - 2, 2, 3);
    p.px(s.light, g.fx - 3, y - 3);
    p.rect(s.shadow, g.fx + g.fw, y, 2, 4);
    p.rect(s.shadow, g.fx + g.fw + 1, y - 2, 2, 3);
    p.px(s.base, g.fx + g.fw + 2, y - 3);
    return;
  }
  p.rect(s.base, g.fx - 2, y, 2, 5);
  p.px(s.shadow, g.fx - 1, y + 1);
  p.px(s.shadow, g.fx - 1, y + 2);
  p.px(s.light, g.fx - 2, y);
  p.rect(s.shadow, g.fx + g.fw, y, 2, 5);
  p.px(s.dark, g.fx + g.fw, y + 1);
  p.px(s.dark, g.fx + g.fw, y + 2);
}

export function drawHead(p: Pixels, t: PortraitTraits, g: Geo): void {
  ears(p, t, g);
  rectHead(p, t, g);
  if (t.browRidge) {
    const s = SKIN[t.skin];
    p.rect(s.light, g.fx + 1, g.browY - 1, g.fw - 2, 1);
    p.rect(s.shadow, g.fx + 1, g.browY + 1, g.fw - 2, 1);
    p.rect(s.shadow, g.cx - 1, g.fy + 2, 2, 3);
    p.rect(s.light, g.cx - 1, g.fy + 2, 1, 3);
  }
}
