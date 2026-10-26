import { FACE, HAIR, SKIN } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { EyeStyle, PortraitTraits } from '../traits';

function eye(p: Pixels, t: PortraitTraits, x: number, y: number, style: EyeStyle): void {
  const s = SKIN[t.skin];
  const iris = t.irisColor;
  const { eyeWhite: white, pupil } = FACE;
  switch (style) {
    case 'normal':
      p.rect(s.dark, x, y, 4, 1);
      p.rect(white, x, y + 1, 4, 2);
      p.rect(iris, x + 1, y + 1, 2, 2);
      p.px(pupil, x + 2, y + 1);
      break;
    case 'wide':
      p.rect(s.dark, x, y, 5, 1);
      p.rect(white, x, y + 1, 5, 2);
      p.rect(iris, x + 1, y + 1, 3, 2);
      p.px(pupil, x + 2, y + 1);
      p.px(white, x + 1, y + 1);
      break;
    case 'narrow':
      p.rect(s.dark, x, y + 1, 4, 1);
      p.rect(white, x, y + 2, 4, 1);
      p.rect(iris, x + 1, y + 2, 2, 1);
      p.px(pupil, x + 2, y + 2);
      p.rect(s.shadow, x, y + 3, 4, 1);
      break;
    case 'round':
      p.rect(white, x + 1, y, 2, 4);
      p.rect(white, x, y + 1, 4, 2);
      p.rect(iris, x + 1, y + 1, 2, 2);
      p.px(pupil, x + 2, y + 1);
      break;
    case 'tired':
      p.rect(s.shadow, x, y, 4, 1);
      p.rect(s.dark, x, y + 1, 4, 1);
      p.rect(white, x, y + 2, 4, 1);
      p.rect(iris, x + 1, y + 2, 2, 1);
      p.rect(s.shadow, x, y + 3, 4, 1);
      break;
    case 'large':
      p.rect(iris, x + 1, y, 3, 4);
      p.rect(iris, x, y + 1, 5, 2);
      p.rect(pupil, x + 2, y + 1, 2, 2);
      p.px(FACE.eyeWhite, x + 1, y + 1);
      p.px(s.dark, x, y);
      p.px(s.dark, x + 4, y);
      break;
  }
}

export function drawEyes(p: Pixels, t: PortraitTraits, g: Geo): void {
  const left = !t.accessories.includes('eyepatch');
  const right = !t.accessories.includes('cyberEye');
  if (left) eye(p, t, g.eyeLX, g.eyeY, t.eyes);
  if (right) eye(p, t, g.eyeRX, g.eyeY, t.eyes);

  const s = SKIN[t.skin];
  const hair = HAIR[t.hairColor];
  const brow = t.alien && t.hair === 'bald' ? s.dark : t.age === 'old' ? hair.base : hair.shadow;
  const y = g.browY;
  const w = g.ew;
  if (t.mouth === 'grim') {
    // Furrowed: inner ends dip toward the nose.
    p.rect(brow, g.eyeLX, y, w, 1);
    p.px(brow, g.eyeLX + w - 1, y + 1);
    p.rect(brow, g.eyeRX, y, w, 1);
    p.px(brow, g.eyeRX, y + 1);
  } else if (t.mouth === 'smirk') {
    p.rect(brow, g.eyeLX, y, w, 1);
    p.rect(brow, g.eyeRX, y - 1, w, 1);
    p.px(brow, g.eyeRX + w - 1, y);
  } else {
    p.rect(brow, g.eyeLX, y, w, 1);
    p.rect(brow, g.eyeRX, y, w, 1);
    if (t.mouth === 'grin') {
      p.px(brow, g.eyeLX, y + 1);
      p.px(brow, g.eyeRX + w - 1, y + 1);
    }
  }
}

export function drawNose(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  const x = g.cx;
  const y = g.noseY;
  switch (t.nose) {
    case 'straight':
      p.rect(s.shadow, x, y, 1, 3);
      p.rect(s.light, x - 1, y, 1, 2);
      p.rect(s.shadow, x - 2, y + 3, 4, 1);
      p.px(s.dark, x, y + 3);
      break;
    case 'button':
      p.px(s.light, x - 1, y + 1);
      p.rect(s.shadow, x - 1, y + 2, 3, 1);
      p.px(s.dark, x + 1, y + 2);
      break;
    case 'long':
      p.rect(s.shadow, x, y - 1, 1, 5);
      p.rect(s.light, x - 1, y - 1, 1, 4);
      p.rect(s.shadow, x - 2, y + 4, 5, 1);
      break;
    case 'broad':
      p.rect(s.shadow, x, y, 1, 3);
      p.rect(s.light, x - 1, y, 1, 3);
      p.rect(s.shadow, x - 3, y + 3, 6, 1);
      p.px(s.dark, x - 2, y + 3);
      p.px(s.dark, x + 1, y + 3);
      break;
    case 'hooked':
      p.rect(s.shadow, x, y - 1, 1, 4);
      p.px(s.shadow, x + 1, y);
      p.px(s.light, x - 1, y);
      p.rect(s.shadow, x - 1, y + 3, 3, 1);
      p.px(s.dark, x + 1, y + 3);
      break;
    case 'none':
      p.px(s.dark, x - 2, y + 2);
      p.px(s.dark, x + 1, y + 2);
      break;
  }
}

export function drawMouth(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  const x = g.mouthX;
  const y = g.mouthY;
  const dark = FACE.mouth;
  switch (t.mouth) {
    case 'neutral':
      p.rect(dark, x, y, 6, 1);
      p.rect(s.lip, x + 1, y + 1, 4, 1);
      p.px(s.shadow, x, y + 1);
      break;
    case 'grin':
      p.rect(dark, x, y, 6, 1);
      p.rect(FACE.teeth, x + 1, y, 4, 1);
      p.rect(dark, x + 1, y + 1, 4, 1);
      p.rect(s.lip, x + 2, y + 2, 2, 1);
      p.px(dark, x - 1, y - 1);
      p.px(dark, x + 6, y - 1);
      p.px(s.shadow, x - 1, y + 1);
      p.px(s.shadow, x + 6, y + 1);
      break;
    case 'grim':
      p.rect(dark, x, y, 6, 1);
      p.px(dark, x - 1, y + 1);
      p.px(dark, x + 6, y + 1);
      p.rect(s.shadow, x + 1, y + 1, 4, 1);
      p.rect(s.shadow, x + 2, y + 3, 2, 1);
      break;
    case 'smirk':
      p.rect(dark, x + 1, y, 5, 1);
      p.px(dark, x + 6, y - 1);
      p.rect(s.lip, x + 1, y + 1, 4, 1);
      p.px(s.shadow, x + 7, y);
      break;
    case 'open':
      p.rect(dark, x + 1, y, 4, 2);
      p.rect(FACE.teeth, x + 1, y, 4, 1);
      p.rect(s.lip, x + 1, y + 2, 4, 1);
      break;
  }
}

export function drawAge(p: Pixels, t: PortraitTraits, g: Geo): void {
  const s = SKIN[t.skin];
  if (t.age === 'young') return;
  // Nasolabial folds.
  p.rect(s.shadow, g.mouthX - 1, g.noseY + 3, 1, t.age === 'old' ? 3 : 2);
  p.rect(s.shadow, g.mouthX + 6, g.noseY + 3, 1, t.age === 'old' ? 3 : 2);
  if (t.age !== 'old') return;
  p.rect(s.shadow, g.fx + 4, g.fy + 3, g.fw - 8, 1);
  p.rect(s.shadow, g.fx + 3, g.fy + 5, g.fw - 6, 1);
  if (!t.visorDown) {
    p.px(s.shadow, g.eyeLX - 1, g.eyeY + 2);
    p.px(s.shadow, g.eyeRX + g.ew, g.eyeY + 2);
    p.rect(s.shadow, g.eyeLX, g.eyeY + 4, 3, 1);
    p.rect(s.shadow, g.eyeRX + g.ew - 3, g.eyeY + 4, 3, 1);
  }
}
