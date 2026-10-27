import { FACE, HAIR, SKIN } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { PortraitTraits } from '../traits';

function helmeted(t: PortraitTraits): boolean {
  return t.headgear === 'helmetUp' || t.headgear === 'helmetDown';
}

/** Hair that hangs behind the head and shoulders; drawn before the neck. */
export function drawHairBack(p: Pixels, t: PortraitTraits, g: Geo): void {
  const h = HAIR[t.hairColor];
  const { fx, fy, fw, fh } = g;
  if (t.hair === 'long') {
    p.rrect(h.shadow, fx - 4, fy - 2, fw + 8, fh + 12);
    p.rect(h.base, fx - 3, fy, 2, fh + 8);
    p.rect(h.dark, fx + fw + 2, fy, 2, fh + 9);
  } else if (t.hair === 'longTied') {
    p.rrect(h.shadow, fx + fw - 1, fy + 3, 5, fh + 2);
    p.rect(h.base, fx + fw, fy + 4, 2, fh);
    p.rect(h.dark, fx + fw + 3, fy + 5, 1, fh - 2);
  } else if (t.hair === 'bob') {
    p.rrect(h.shadow, fx - 3, fy - 2, fw + 6, Math.floor(fh * 0.75));
  }
}

function shaved(p: Pixels, t: PortraitTraits, x: number, y: number, w: number, h: number): void {
  const s = SKIN[t.skin];
  const hr = HAIR[t.hairColor];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if ((xx + yy * 2) % 3 === 0) p.px(hr.shadow, xx, yy);
      else p.px(s.shadow, xx, yy);
    }
  }
}

export function drawHair(p: Pixels, t: PortraitTraits, g: Geo): void {
  const h = HAIR[t.hairColor];
  const s = SKIN[t.skin];
  const { fx, fy, fw, fh, cx } = g;
  const sideH = Math.floor(fh * 0.35);

  if (helmeted(t)) {
    // Only the strands that escape the helmet.
    if (t.hair === 'long' || t.hair === 'bob') {
      p.rect(h.base, fx - 3, fy + 2, 3, Math.floor(fh * (t.hair === 'long' ? 0.9 : 0.55)));
      p.rect(h.shadow, fx + fw, fy + 2, 3, Math.floor(fh * (t.hair === 'long' ? 0.9 : 0.55)));
    }
    return;
  }

  switch (t.hair) {
    case 'bald':
      if (!t.alien && t.age !== 'young') {
        p.rect(h.base, fx - 1, fy + 3, 2, 4);
        p.rect(h.shadow, fx + fw - 1, fy + 3, 2, 4);
      }
      p.rect(s.light, fx + 3, fy + 1, 3, 1);
      p.px(s.light, fx + 2, fy + 2);
      break;
    case 'buzz':
      p.rrect(h.shadow, fx - 1, fy - 2, fw + 2, 5);
      for (let y = fy - 2; y < fy + 2; y++) {
        for (let x = fx; x < fx + fw; x++) if ((x + y) % 2 === 0) p.px(h.base, x, y);
      }
      p.rect(h.light, fx + 2, fy - 2, 4, 1);
      p.rect(h.shadow, fx - 1, fy + 2, 2, sideH);
      p.rect(h.dark, fx + fw - 1, fy + 2, 2, sideH);
      break;
    case 'crop':
      p.rrect(h.shadow, fx - 1, fy - 3, fw + 2, 6);
      p.rect(h.base, fx, fy - 4, fw, 5);
      p.rect(h.light, fx + 1, fy - 3, 5, 1);
      p.rect(h.light, fx + 1, fy - 2, 2, 1);
      p.rect(h.base, fx - 2, fy - 1, 3, sideH);
      p.rect(h.shadow, fx + fw - 1, fy - 1, 3, sideH);
      p.px(h.base, fx + 3, fy + 1);
      p.px(h.base, fx + 6, fy + 1);
      p.px(h.shadow, fx + fw - 4, fy + 1);
      break;
    case 'mohawk':
      shaved(p, t, fx, fy - 1, fw, 3);
      p.rect(h.shadow, cx - 2, fy - 8, 4, 10);
      p.rect(h.base, cx - 2, fy - 9, 3, 10);
      p.rect(h.light, cx - 2, fy - 9, 1, 8);
      p.px(h.light, cx - 1, fy - 10);
      p.rect(h.dark, cx + 1, fy - 7, 1, 8);
      break;
    case 'longTied':
      // Slicked back with comb lines, tail hangs behind (see drawHairBack).
      p.rrect(h.base, fx - 1, fy - 4, fw + 2, 6);
      p.rect(h.shadow, fx + fw - 3, fy - 3, 3, 5);
      p.rect(h.light, fx + 1, fy - 3, 6, 1);
      p.rect(h.light, fx + 2, fy - 1, 4, 1);
      p.rect(h.shadow, fx + 1, fy - 2, fw - 4, 1);
      p.rect(h.base, fx - 2, fy, 2, sideH);
      p.rect(h.shadow, fx + fw, fy, 2, sideH);
      break;
    case 'undercut':
      shaved(p, t, fx - 1, fy - 1, 4, sideH + 1);
      p.rrect(h.base, fx + 1, fy - 5, fw + 1, 6);
      p.rect(h.light, fx + 2, fy - 4, 7, 1);
      p.rect(h.light, fx + 3, fy - 3, 3, 1);
      // Fringe sweeps down over the right side of the brow.
      p.rect(h.base, cx - 1, fy, fw / 2 + 2, 2);
      p.rect(h.shadow, cx + 2, fy + 2, fw / 2 - 1, 2);
      p.rect(h.shadow, fx + fw - 1, fy - 2, 3, sideH + 2);
      p.px(h.light, cx, fy);
      break;
    case 'swept':
      // Big swept-back quiff: the hero hair.
      p.rrect(h.shadow, fx - 2, fy - 7, fw + 4, 9);
      p.rrect(h.base, fx - 1, fy - 8, fw, 9);
      p.rect(h.light, fx + 1, fy - 7, fw - 6, 1);
      p.rect(h.light, fx, fy - 5, 4, 1);
      p.rect(h.light, fx + 5, fy - 4, 5, 1);
      p.rect(h.shadow, fx + 3, fy - 2, fw - 4, 1);
      p.rect(h.dark, fx + fw - 2, fy - 5, 2, 6);
      p.rect(h.base, fx - 2, fy, 2, sideH);
      p.rect(h.shadow, fx + fw, fy, 2, sideH);
      p.rect(h.base, fx + 1, fy + 1, 3, 1);
      break;
    case 'bob':
      p.rrect(h.base, fx - 2, fy - 4, fw + 4, 7);
      p.rect(h.light, fx, fy - 3, 6, 1);
      p.rect(h.base, fx, fy + 1, fw, 2);
      p.rect(h.shadow, fx, fy + 3, fw, 1);
      p.rect(s.base, cx - 2, fy + 2, 1, 2);
      p.rect(h.base, fx - 3, fy - 1, 3, Math.floor(fh * 0.55));
      p.rect(h.shadow, fx + fw, fy - 1, 3, Math.floor(fh * 0.55));
      p.rect(h.light, fx - 3, fy, 1, 4);
      break;
    case 'wild':
      // Receding crown, big uncombed tufts flaring out over the ears.
      p.rect(h.shadow, fx + 2, fy - 2, fw - 4, 2);
      p.rect(h.base, fx + 3, fy - 3, 4, 1);
      p.rect(h.base, fx + fw - 6, fy - 3, 3, 1);
      p.rrect(h.base, fx - 5, fy - 4, 7, sideH + 6);
      p.rrect(h.shadow, fx + fw - 2, fy - 4, 7, sideH + 6);
      p.rect(h.light, fx - 4, fy - 3, 3, 2);
      p.rect(h.light, fx - 5, fy, 2, 3);
      p.px(h.base, fx - 6, fy - 2);
      p.px(h.base, fx - 7, fy + 2);
      p.px(h.base, fx - 2, fy - 5);
      p.px(h.shadow, fx + fw + 1, fy - 5);
      p.px(h.shadow, fx + fw + 5, fy - 2);
      p.px(h.dark, fx + fw + 6, fy + 2);
      p.rect(h.dark, fx + fw + 3, fy + sideH, 2, 2);
      break;
    case 'long':
      p.rrect(h.base, fx - 1, fy - 5, fw + 2, 7);
      p.rect(h.light, fx + 1, fy - 4, 5, 1);
      p.rect(h.shadow, cx - 1, fy - 4, 1, 3);
      p.rect(h.base, fx - 3, fy - 2, 3, fh + 6);
      p.rect(h.light, fx - 3, fy, 1, 6);
      p.rect(h.shadow, fx + fw, fy - 2, 3, fh + 6);
      p.rect(h.base, fx, fy + 1, 3, 2);
      p.rect(h.shadow, fx + fw - 3, fy + 1, 3, 2);
      break;
  }
}

export function drawFacialHair(p: Pixels, t: PortraitTraits, g: Geo): void {
  const h = HAIR[t.hairColor];
  const s = SKIN[t.skin];
  const { fx, fy, fw, fh, cx, mouthX, mouthY } = g;
  const chin = fy + fh;
  const mustache = (): void => {
    p.rect(h.base, cx - 4, mouthY - 2, 8, 2);
    p.rect(h.light, cx - 4, mouthY - 2, 3, 1);
    p.px(h.shadow, cx - 5, mouthY - 1);
    p.px(h.shadow, cx - 5, mouthY);
    p.px(h.dark, cx + 4, mouthY - 1);
    p.px(h.dark, cx + 4, mouthY);
  };
  switch (t.facialHair) {
    case 'none':
      break;
    case 'stubble':
      for (let y = mouthY - 2; y < chin; y++) {
        for (let x = fx + 1; x < fx + fw - 1; x++) {
          if ((x + y) % 2 !== 0) continue;
          if (y >= mouthY - 1 && y <= mouthY + 2 && x >= mouthX - 1 && x <= mouthX + 6) continue;
          const c = p.get(x, y);
          if (c === s.base || c === s.light || c === s.shadow) p.px(s.dark, x, y);
        }
      }
      break;
    case 'mustache':
      mustache();
      break;
    case 'goatee':
      p.rect(h.base, cx - 3, mouthY - 1, 6, 1);
      p.rect(h.base, cx - 2, mouthY + 2, 4, chin - mouthY - 1);
      p.rect(h.shadow, cx, mouthY + 2, 2, chin - mouthY - 1);
      p.rect(h.shadow, cx - 1, chin, 2, 2);
      break;
    case 'beard':
      mustache();
      p.rect(h.base, fx + 2, mouthY + 2, fw - 4, chin - mouthY - 1);
      p.rect(h.base, fx, g.earY + 5, 2, chin - g.earY - 6);
      p.rect(h.shadow, fx + fw - 2, g.earY + 5, 2, chin - g.earY - 6);
      p.rect(h.shadow, fx + fw / 2, mouthY + 2, fw / 2 - 2, chin - mouthY - 1);
      p.rect(h.shadow, fx + 3, chin, fw - 6, 1);
      p.rect(h.light, fx + 3, mouthY + 2, 3, 1);
      break;
    case 'fullBeard': {
      const top = mouthY - 3;
      const bottom = chin + 4;
      for (let y = top; y < bottom; y++) {
        const inset = Math.max(0, y - chin + 1) * 2;
        p.rect(h.base, fx - 1 + inset, y, fw + 2 - inset * 2, 1);
        p.rect(h.shadow, cx + 1, y, Math.max(0, fw / 2 + 1 - inset), 1);
      }
      p.rect(h.base, fx - 1, g.earY + 3, 3, top - g.earY - 3);
      p.rect(h.shadow, fx + fw - 2, g.earY + 3, 3, top - g.earY - 3);
      p.rect(h.light, fx, top + 1, 3, 3);
      p.rect(h.dark, cx - 1, bottom - 2, 4, 1);
      // Keep the mouth readable inside the beard.
      mustache();
      const m = mouthX;
      if (t.mouth === 'grin' || t.mouth === 'open') {
        p.rect(s.dark, m, mouthY, 6, 1);
        p.rect(t.mouth === 'grin' ? FACE.teeth : s.dark, m + 1, mouthY, 4, 1);
      } else {
        p.rect(s.dark, m + 1, mouthY + 1, 4, 1);
      }
      break;
    }
  }
}

/** A forelock escaping from under an open helmet, drawn after the headgear. */
export function drawHelmetFringe(p: Pixels, t: PortraitTraits, g: Geo): void {
  if (t.headgear !== 'helmetUp') return;
  const h = HAIR[t.hairColor];
  const { fx, fy } = g;
  if (t.hair === 'swept') {
    p.rect(h.base, fx, fy + 2, 6, 1);
    p.rect(h.base, fx + 1, fy + 3, 3, 1);
    p.rect(h.light, fx + 1, fy + 2, 2, 1);
    p.px(h.shadow, fx + 3, fy + 3);
    p.px(h.shadow, fx + 5, fy + 2);
  } else if (t.hair === 'undercut' || t.hair === 'crop' || t.hair === 'bob') {
    p.rect(h.base, fx + 1, fy + 2, 4, 1);
    p.px(h.shadow, fx + 3, fy + 2);
  }
}
