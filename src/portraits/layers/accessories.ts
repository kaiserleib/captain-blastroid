import { FACE, GLOW, HAIR, METAL, SKIN } from '../palette';
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
    case 'glasses':
      // Round wire rims with a lens glint, bridged over the nose.
      for (const ex of [eyeLX, eyeRX]) {
        p.rect(METAL.dark, ex, eyeY - 2, ew, 1);
        p.rect(METAL.dark, ex, eyeY + 3, ew, 1);
        p.rect(METAL.dark, ex - 1, eyeY - 1, 1, 4);
        p.rect(METAL.dark, ex + ew, eyeY - 1, 1, 4);
        p.px(FACE.lens, ex, eyeY - 1);
      }
      p.rect(METAL.dark, eyeLX + ew + 1, eyeY - 1, eyeRX - eyeLX - ew - 2, 1);
      p.rect(METAL.dark, fx - 1, eyeY - 1, eyeLX - fx, 1);
      p.rect(METAL.dark, eyeRX + ew + 1, eyeY - 1, fx + fw - eyeRX - ew, 1);
      break;
    case 'hairStreak': {
      // One dyed lock through the fringe and down the near side.
      const c = HAIR.cyan;
      p.rect(c.base, fx + 2, fy - 3, 2, 5);
      p.px(c.light, fx + 2, fy - 3);
      p.rect(c.shadow, fx - 2, fy, 2, 8);
      p.px(c.light, fx - 2, fy);
      break;
    }
    case 'dust':
      // Smudges on the brow and cheek, as if wiped with a glove.
      for (const [dx, dy] of [
        [2, -3],
        [3, -3],
        [5, -4],
        [fw - 6, -3],
        [fw - 5, -2],
      ] as const)
        p.px(s.dark, fx + dx, eyeY + dy);
      p.rect(s.shadow, eyeRX, noseY + 2, 4, 1);
      p.rect(s.dark, eyeRX + 1, noseY + 3, 2, 1);
      p.px(s.shadow, eyeLX, noseY + 3);
      p.px(s.dark, eyeLX + 1, noseY + 3);
      break;
    case 'burnScar': {
      // Mottled patch along the jaw on the shadow side.
      const y0 = g.mouthY + 1;
      const x0 = fx + fw - 6;
      p.rect(FACE.burn, x0, y0, 4, 3);
      p.rect(FACE.burn, x0 + 1, y0 + 3, 3, 1);
      p.px(s.shadow, x0 + 1, y0 + 1);
      p.px(FACE.scar, x0 + 2, y0);
      p.px(FACE.scar, x0, y0 + 2);
      p.px(s.dark, x0 + 3, y0 + 2);
      break;
    }
    case 'earpiece':
      // A single bud on the near ear with a status light and a coiled lead.
      p.rrect(METAL.dark, fx - 3, g.earY, 3, 5);
      p.px(METAL.light, fx - 3, g.earY + 1);
      p.px(GLOW.cyan, fx - 2, g.earY + 2);
      for (let y = g.earY + 5; y < g.bodyTop; y++) p.px(y % 2 ? METAL.dark : METAL.base, fx - 2, y);
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
