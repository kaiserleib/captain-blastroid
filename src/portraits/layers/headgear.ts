import { GLOW, HELMET, METAL, SKIN, UNIFORM, VISOR, type Ramp } from '../palette';
import type { Geo, Pixels } from '../pixels';
import type { PortraitTraits } from '../traits';

function helmetRamp(t: PortraitTraits): Ramp {
  return t.helmetColor === 'uniform' ? UNIFORM[t.uniform] : HELMET[t.helmetColor];
}

function shell(p: Pixels, t: PortraitTraits, g: Geo): void {
  const h = helmetRamp(t);
  const u = UNIFORM[t.uniform];
  const { fx, fy, fw, cx } = g;
  const left = fx - 3;
  const w = fw + 6;
  const guardH = g.mouthY - fy;
  p.rrect(h.dark, left - 1, fy - 8, w + 2, 11);
  p.rrect(h.base, left, fy - 8, w, 10);
  p.rect(h.light, left + 2, fy - 8, w - 8, 1);
  p.rect(h.light, left + 1, fy - 7, 2, 5);
  p.rect(h.shadow, left + w - 3, fy - 6, 3, 8);
  // Cheek guards over the ears.
  p.rect(h.dark, left - 1, fy + 2, 5, guardH);
  p.rect(h.base, left, fy + 2, 3, guardH - 1);
  p.rect(h.light, left, fy + 2, 1, guardH - 2);
  p.rect(h.dark, left + w - 4, fy + 2, 5, guardH);
  p.rect(h.shadow, left + w - 3, fy + 2, 3, guardH - 1);
  p.px(METAL.light, left + 1, g.earY + 1);
  p.px(METAL.base, left + w - 2, g.earY + 1);
  // Brow trim.
  p.rect(h.shadow, fx, fy + 1, fw, 1);
  if (t.helmetColor !== 'uniform') {
    p.rect(u.base, cx - 1, fy - 8, 2, 9);
    p.px(u.light, cx - 1, fy - 8);
  }
}

function visorUp(p: Pixels, t: PortraitTraits, g: Geo): void {
  const v = VISOR[t.visorTint];
  const { fx, fy, fw } = g;
  p.rect(v.dark, fx - 2, fy - 6, fw + 4, 4);
  p.rect(v.base, fx - 1, fy - 6, fw + 2, 3);
  p.rect(v.light, fx - 1, fy - 6, fw + 2, 1);
  p.rect(v.shadow, fx + fw / 2, fy - 5, fw / 2 + 1, 2);
  p.px(GLOW.white, fx + 1, fy - 5);
  p.px(GLOW.white, fx + 2, fy - 5);
}

function visorDown(p: Pixels, t: PortraitTraits, g: Geo): void {
  const v = VISOR[t.visorTint];
  const { fx, fy, fw } = g;
  const top = fy + 1;
  const bottom = g.noseY + 4;
  const x0 = fx - 1;
  const w = fw + 2;
  p.rect(v.dark, x0 - 1, top, w + 2, bottom - top + 1);
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / (bottom - top);
    p.rect(k < 0.25 ? v.light : k < 0.6 ? v.base : v.shadow, x0, y, w, 1);
  }
  // Horizon reflection plus a diagonal glint, both from the top-left light.
  p.rect(v.light, x0 + 1, top + 5, w - 2, 1);
  p.rect(v.dark, x0 + w - 4, top, 4, bottom - top);
  p.rect(v.shadow, x0 + w - 4, top + 1, 2, bottom - top - 2);
  for (let i = 0; i < 4; i++) p.px(GLOW.white, x0 + 2 + i, top + 4 - i);
  p.px(GLOW.white, x0 + 2, top + 1);
  p.px(v.light, x0 + 7, top + 2);
  p.px(v.light, x0 + 8, top + 1);
}

function headset(p: Pixels, _t: PortraitTraits, g: Geo): void {
  const m = METAL;
  const { fx, fy, fw, earY, mouthX, mouthY } = g;
  p.rect(m.dark, fx - 1, fy - 6, fw + 2, 2);
  p.rect(m.base, fx + 1, fy - 6, fw - 2, 1);
  p.rect(m.dark, fx - 2, fy - 5, 1, earY - fy + 4);
  p.rect(m.dark, fx + fw + 1, fy - 5, 1, earY - fy + 4);
  p.rrect(m.dark, fx - 4, earY - 1, 4, 7);
  p.rect(m.base, fx - 4, earY, 3, 5);
  p.px(m.light, fx - 4, earY);
  p.rrect(m.dark, fx + fw, earY - 1, 4, 7);
  p.rect(m.shadow, fx + fw + 1, earY, 3, 5);
  p.px(GLOW.green, fx - 3, earY + 4);
  // Boom mic swings in to the mouth corner.
  p.line(m.dark, fx - 2, earY + 5, mouthX - 2, mouthY + 1);
  p.rect(m.dark, mouthX - 3, mouthY, 2, 2);
  p.px(m.base, mouthX - 3, mouthY);
}

function bandana(p: Pixels, t: PortraitTraits, g: Geo): void {
  const c = UNIFORM[t.uniform === 'crimson' ? 'orange' : 'crimson'];
  const { fx, fy, fw } = g;
  p.rect(c.base, fx - 1, fy, fw + 2, 3);
  p.rect(c.light, fx - 1, fy, fw / 2, 1);
  p.rect(c.shadow, fx - 1, fy + 2, fw + 2, 1);
  p.rect(c.shadow, fx + fw - 2, fy, 3, 3);
  // Knot and tails.
  p.rect(c.base, fx + fw + 1, fy, 2, 2);
  p.rect(c.shadow, fx + fw + 2, fy + 2, 2, 3);
  p.rect(c.dark, fx + fw + 3, fy + 5, 1, 2);
  for (let x = fx + 1; x < fx + fw - 2; x += 4) p.px(c.light, x, fy + 1);
}

function cyberCrest(p: Pixels, t: PortraitTraits, g: Geo): void {
  const m = METAL;
  const { fx, fy, cx } = g;
  const glow = t.alien ? GLOW.green : GLOW.cyan;
  p.rect(m.dark, cx - 2, fy - 8, 4, 10);
  p.rect(m.base, cx - 1, fy - 9, 2, 10);
  p.rect(m.light, cx - 1, fy - 9, 1, 9);
  p.px(glow, cx, fy - 7);
  p.px(glow, cx, fy - 4);
  p.px(glow, cx, fy - 1);
  // Temple jack.
  p.rect(m.dark, fx - 1, g.browY - 1, 3, 3);
  p.px(m.light, fx - 1, g.browY - 1);
  p.px(glow, fx, g.browY);
}

export function drawHeadgear(p: Pixels, t: PortraitTraits, g: Geo): void {
  switch (t.headgear) {
    case 'none':
      break;
    case 'headset':
      headset(p, t, g);
      break;
    case 'helmetUp':
      shell(p, t, g);
      visorUp(p, t, g);
      break;
    case 'helmetDown':
      shell(p, t, g);
      visorDown(p, t, g);
      break;
    case 'bandana':
      bandana(p, t, g);
      break;
    case 'cyberCrest':
      cyberCrest(p, t, g);
      break;
  }
}

export function drawAntennae(p: Pixels, t: PortraitTraits, g: Geo): void {
  if (!t.antennae) return;
  const s = SKIN[t.skin];
  const { fx, fy, fw } = g;
  const top = t.headgear === 'helmetUp' || t.headgear === 'helmetDown' ? fy - 15 : fy - 12;
  p.line(s.base, fx + 4, fy - 2, fx + 1, top + 2);
  p.line(s.shadow, fx + fw - 5, fy - 2, fx + fw - 2, top + 2);
  p.rect(s.light, fx, top, 2, 2);
  p.px(GLOW.white, fx, top);
  p.rect(s.base, fx + fw - 2, top, 2, 2);
  p.px(s.light, fx + fw - 2, top);
}
