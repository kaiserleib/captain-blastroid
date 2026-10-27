import { ACCENT, HAIR, HELMET, METAL, UNIFORM, type Ramp } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { Insignia, PortraitTraits } from '../traits';

/** Half-width of the torso per row below `bodyTop`: sloped shoulders. */
const HALF = [10, 14, 16, 17, 18, 19];

const GLYPHS: Record<Insignia, readonly string[]> = {
  chevron: ['x...x', '.x.x.', '..x..', '.....'],
  star: ['..x..', 'xxxxx', '.xxx.', '.x.x.'],
  bolt: ['..xxx', '.xx..', '..xx.', 'xxx..'],
  ring: ['.xxx.', 'x...x', 'x...x', '.xxx.'],
  torn: [],
};

function torso(p: Pixels, u: Ramp, top: number): void {
  for (let y = top; y < p.h; y++) {
    const i = y - top;
    const hw = HALF[Math.min(i, HALF.length - 1)] ?? 19;
    const x0 = 24 - hw;
    p.rect(u.base, x0, y, hw * 2, 1);
    p.rect(u.light, x0, y, i < 3 ? hw : 2, 1);
    p.rect(u.shadow, 24 + hw - 4, y, 3, 1);
    p.rect(u.dark, 24 + hw - 1, y, 1, 1);
  }
  // Shoulder tops catch the light; armpit seams separate the arms.
  p.rect(u.light, 24 - 14, top + 1, 8, 1);
  p.rect(u.shadow, 24 - 13, top + 6, 1, p.h);
  p.rect(u.dark, 24 + 12, top + 6, 1, p.h);
}

function patch(p: Pixels, t: PortraitTraits, u: Ramp, x: number, y: number): void {
  if (t.insignia === 'torn') {
    // Ripped off: an unfaded square of cloth and loose stitching.
    p.rect(u.base, x + 1, y + 1, 5, 4);
    p.rect(u.light, x + 1, y + 1, 5, 1);
    for (let i = 0; i < 7; i += 2) {
      p.px(u.dark, x + i, y);
      p.px(u.dark, x + 6 - i, y + 5);
    }
    p.px(u.dark, x, y + 2);
    p.px(u.dark, x + 6, y + 3);
    return;
  }
  p.rect(u.dark, x, y, 7, 6);
  p.rect(ACCENT[t.patchColor], x + 1, y + 1, 5, 4);
  const g = GLYPHS[t.insignia];
  for (let row = 0; row < g.length; row++) {
    const line = g[row] ?? '';
    for (let col = 0; col < line.length; col++) {
      if (line[col] === 'x') p.px(u.dark, x + 1 + col, y + 1 + row);
    }
  }
}

function shoulderPads(p: Pixels, top: number): void {
  const m = METAL;
  // Left pad faces the light.
  p.rect(m.dark, 5, top + 2, 10, 6);
  p.rect(m.base, 6, top + 2, 8, 4);
  p.rect(m.light, 7, top + 2, 6, 1);
  p.rect(m.light, 6, top + 3, 1, 2);
  p.rect(m.shadow, 6, top + 5, 8, 1);
  p.px(m.light, 12, top + 4);
  p.rect(m.dark, 33, top + 2, 10, 6);
  p.rect(m.shadow, 34, top + 2, 8, 4);
  p.rect(m.base, 35, top + 2, 6, 1);
  p.rect(m.dark, 34, top + 5, 8, 1);
  p.px(m.base, 35, top + 4);
}

function tubes(p: Pixels, top: number): void {
  const m = METAL;
  p.rect(m.dark, 13, top + 8, 6, 4);
  p.rect(m.base, 14, top + 8, 4, 3);
  p.px(m.light, 14, top + 8);
  p.px(ACCENT.red, 16, top + 9);
  for (let y = top + 12; y < p.h; y++) {
    p.rect(y % 2 === 0 ? m.base : m.shadow, 14, y, 3, 1);
    p.px(y % 2 === 0 ? m.light : m.base, 14, y);
  }
  for (let y = top + 1; y < top + 8; y++) {
    p.rect(y % 2 === 0 ? m.base : m.shadow, 17, y, 2, 1);
  }
}

export function drawUniform(p: Pixels, t: PortraitTraits, g: Geo): void {
  const u = UNIFORM[t.uniform];
  const top = g.bodyTop;
  torso(p, u, top);

  if (t.suit === 'jacket') {
    // Bomber jacket: shearling collar and an open front over a dark undershirt.
    const fur = HAIR.platinum;
    p.rect(u.dark, 21, top, 6, p.h - top);
    p.rect(u.shadow, 22, top, 4, p.h - top);
    for (let y = top - 1; y < top + 4; y++) {
      for (let x = 13; x < 35; x++) {
        if (x >= 21 && x <= 26 && y > top - 1) continue;
        p.px((x + y) % 3 === 0 ? fur.shadow : x < 24 ? fur.light : fur.base, x, y);
      }
    }
    p.rect(fur.shadow, 13, top + 4, 8, 1);
    p.rect(fur.dark, 27, top + 4, 8, 1);
    for (let y = top + 4; y < p.h; y += 3) p.px(METAL.light, 20, y);
  } else if (t.suit === 'armored') {
    p.rect(u.dark, 17, top + 3, 14, p.h - top - 3);
    p.rect(METAL.base, 18, top + 3, 12, 6);
    p.rect(METAL.light, 18, top + 3, 12, 1);
    p.rect(METAL.light, 18, top + 3, 1, 6);
    p.rect(METAL.shadow, 18, top + 9, 12, 1);
    p.rect(METAL.shadow, 18, top + 10, 12, 3);
    p.rect(METAL.base, 18, top + 10, 5, 1);
    p.px(ACCENT[t.patchColor], 23, top + 6);
    p.px(ACCENT[t.patchColor], 24, top + 6);
    p.rect(u.dark, 19, top - 1, 10, 3);
  } else if (t.suit === 'labCoat') {
    // A white coat over the flight suit: the suit shows in a V down the front.
    const c = HELMET.white;
    torso(p, c, top);
    for (let y = top; y < p.h; y++) {
      const hw = Math.min(6, 2 + ((y - top) >> 1));
      p.rect(u.base, 24 - hw, y, hw * 2, 1);
      p.rect(u.shadow, 24, y, hw, 1);
      p.px(c.shadow, 24 - hw - 1, y);
      p.px(c.dark, 24 + hw, y);
    }
    p.rect(u.dark, 24, top + 2, 1, p.h - top - 2);
    // Turned-up coat collar.
    p.rect(c.base, 15, top - 2, 6, 3);
    p.rect(c.light, 15, top - 2, 4, 1);
    p.rect(c.shadow, 27, top - 2, 6, 3);
  } else {
    // Flight suit: standing collar flaps and a center zip.
    p.rect(u.dark, 24, top + 2, 1, p.h - top - 2);
    p.px(METAL.light, 24, top + 4);
    p.rect(u.dark, 16, top - 1, 6, 3);
    p.rect(u.light, 17, top - 1, 4, 2);
    p.rect(u.dark, 26, top - 1, 6, 3);
    p.rect(u.shadow, 27, top - 1, 4, 2);
  }

  // Name tape on the right breast (viewer's left).
  if (t.suit === 'labCoat') {
    // Pocket and pen on the coat instead of a tape.
    p.rect(HELMET.white.shadow, 11, top + 7, 7, 1);
    p.rect(METAL.dark, 13, top + 5, 1, 3);
    p.px(ACCENT.red, 13, top + 5);
    patch(p, t, u, 30, top + 6);
  } else if (t.suit !== 'armored') {
    p.rect(u.dark, 12, top + 6, 8, 3);
    p.rect(u.light, 13, top + 6, 6, 2);
    p.px(u.shadow, 14, top + 6);
    p.px(u.shadow, 16, top + 6);
    p.px(u.shadow, 17, top + 6);
    patch(p, t, u, 28, top + 5);
  } else {
    patch(p, t, u, 31, top + 9);
  }
  if (t.shoulderPads) shoulderPads(p, top);
  if (t.tubes) tubes(p, top);
}
