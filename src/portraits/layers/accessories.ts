import { FACE, GLOW, METAL, SKIN } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { Accessory, PortraitTraits } from '../traits';

function draw(p: Pixels, t: PortraitTraits, g: Geo, a: Accessory): void {
  const s = SKIN[t.skin];
  const { fx, fy, fw, eyeLX, eyeRX, eyeY, ew, noseY } = g;
  switch (a) {
    case 'scar':
      for (let i = 0; i < 7; i++) p.px(FACE.scar, eyeRX + ew - i, g.browY - 2 + i);
      p.px(s.shadow, eyeRX + ew - 1, g.browY);
      p.px(s.shadow, eyeRX + ew - 4, g.browY + 1);
      p.px(s.shadow, eyeRX + ew - 3, g.browY + 4);
      break;
    case 'eyepatch':
      p.line(FACE.patch, eyeLX + ew, eyeY - 1, fx + fw, fy + 2);
      p.line(FACE.patch, eyeLX - 1, eyeY + 1, fx - 1, eyeY + 1);
      p.rrect(FACE.patch, eyeLX - 1, eyeY - 1, ew + 2, 5);
      p.px(METAL.shadow, eyeLX, eyeY);
      break;
    case 'cyberEye':
      p.rect(METAL.dark, eyeRX - 1, eyeY - 1, ew + 2, 5);
      p.rect(METAL.base, eyeRX, eyeY - 1, ew + 1, 4);
      p.rect(METAL.light, eyeRX, eyeY - 1, ew, 1);
      p.rect(FACE.pupil, eyeRX + 1, eyeY, 2, 2);
      p.px(GLOW.red, eyeRX + 1, eyeY);
      p.px(METAL.dark, eyeRX + ew, eyeY + 2);
      p.rect(METAL.dark, eyeRX + ew + 1, eyeY + 1, fx + fw - eyeRX - ew - 1, 1);
      break;
    case 'tattoo':
      p.rect(FACE.tattoo, eyeLX, eyeY + 4, 1, 3);
      p.rect(FACE.tattoo, eyeLX + 2, eyeY + 4, 1, 4);
      p.px(FACE.tattoo, eyeLX - 1, eyeY + 3);
      break;
    case 'plaster':
      p.rect(FACE.plasterShade, eyeRX, noseY + 1, 5, 3);
      p.rect(FACE.plaster, eyeRX, noseY + 1, 4, 2);
      p.px(FACE.plasterShade, eyeRX + 1, noseY + 1);
      p.px(FACE.plasterShade, eyeRX + 2, noseY + 2);
      break;
    case 'freckles':
      // A sparse band across the cheek tops and nose bridge.
      for (const [dx, dy] of [
        [1, 0],
        [3, 1],
        [2, 2],
      ] as const) {
        p.px(s.shadow, eyeLX + dx, eyeY + 4 + dy);
        p.px(s.shadow, eyeRX + ew - 1 - dx, eyeY + 4 + dy);
      }
      p.px(s.shadow, g.cx - 2, eyeY + 4);
      p.px(s.shadow, g.cx + 1, eyeY + 4);
      break;
  }
}

export function drawAccessories(p: Pixels, t: PortraitTraits, g: Geo): void {
  if (t.visorDown) return;
  for (const a of t.accessories) draw(p, t, g, a);
}
