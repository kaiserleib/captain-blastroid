import type { Rng } from '../../engine/rng';
import { BG, GLOW, METAL } from '../palette';
import type { Pixels } from '../pixels';
import type { PortraitTraits } from '../traits';

const LIGHTS = [GLOW.red, GLOW.green, GLOW.amber, GLOW.cyan];

function lightPanel(p: Pixels, rng: Rng, x: number, y: number, n: number): void {
  const m = BG[rngTint(rng)];
  p.rect(m.dark, x - 1, y - 1, n * 2 + 1, 3);
  for (let i = 0; i < n; i++) {
    // Unlit bulbs stay dim so only a couple of pixels "blink".
    p.px(rng.chance(0.55) ? rng.pick(LIGHTS) : m.light, x + i * 2, y);
  }
}

function rngTint(rng: Rng): 'steel' | 'moss' | 'rust' {
  return rng.pick(['steel', 'steel', 'moss'] as const);
}

function bulkhead(p: Pixels, t: PortraitTraits, rng: Rng): void {
  const m = BG[t.bgTint];
  p.rect(m.shadow, 0, 0, p.w, p.h);
  // Panels: lit top-left edge, dark bottom-right seam.
  const cols = [0, 13, 35];
  const widths = [13, 22, 13];
  for (let i = 0; i < cols.length; i++) {
    const x = cols[i] ?? 0;
    const w = widths[i] ?? 0;
    p.rect(m.base, x + 1, 1, w - 2, 30);
    p.rect(m.light, x + 1, 1, w - 2, 1);
    p.rect(m.light, x + 1, 1, 1, 30);
    p.rect(m.dark, x, 31, w, 1);
    p.rect(m.dark, x + w - 1, 0, 1, 32);
    p.px(METAL.shadow, x + 2, 3);
    p.px(METAL.shadow, x + w - 3, 3);
  }
  // Pipe run.
  p.rect(m.dark, 0, 33, p.w, 5);
  p.rect(m.base, 0, 34, p.w, 3);
  p.rect(m.light, 0, 34, p.w, 1);
  for (let x = 4; x < p.w; x += 9) p.rect(m.dark, x, 33, 2, 5);
  p.rect(m.base, 0, 38, p.w, p.h - 38);
  lightPanel(p, rng, 3, 8, 3);
  lightPanel(p, rng, 39, 12, 3);
  lightPanel(p, rng, 3, 24, 2);
}

function porthole(p: Pixels, t: PortraitTraits, rng: Rng): void {
  const m = BG[t.bgTint];
  p.rect(m.shadow, 0, 0, p.w, p.h);
  const cx = 24;
  const cy = 22;
  const r = 20;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const d2 = dx * dx + dy * dy;
      if (d2 <= (r - 3) * (r - 3)) p.px(BG.space, x, y);
      else if (d2 <= r * r) {
        // Rim lit from the top-left.
        const lit = dx + dy < -6 ? m.light : dx + dy > 6 ? m.dark : m.base;
        p.px(d2 <= (r - 2) * (r - 2) ? m.dark : lit, x, y);
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    p.px(
      METAL.shadow,
      Math.round(cx + Math.cos(a) * (r - 1) - 0.5),
      Math.round(cy + Math.sin(a) * (r - 1) - 0.5),
    );
  }
  const inside = (x: number, y: number): boolean => {
    const dx = x - cx + 0.5;
    const dy = y - cy + 0.5;
    return dx * dx + dy * dy < (r - 4) * (r - 4);
  };
  // Distant planet limb in the lower corner of the window.
  const planet = rng.pick([BG.moss, BG.rust, BG.steel]);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const dx = x - 44;
      const dy = y - 46;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22 * 22 && inside(x, y)) {
        const edge = d2 > 20 * 20;
        p.px(
          edge ? planet.light : (x + y) % 2 === 0 && d2 > 18 * 18 ? planet.base : planet.shadow,
          x,
          y,
        );
      }
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = rng.int(4, 44);
    const y = rng.int(2, 40);
    if (!inside(x, y) || p.get(x, y) !== BG.space) continue;
    p.px(rng.chance(0.25) ? GLOW.white : rng.chance(0.5) ? m.light : METAL.shadow, x, y);
  }
  // Wall below the window.
  p.rect(m.base, 0, 44, p.w, p.h - 44);
  p.rect(m.light, 0, 44, p.w, 1);
  lightPanel(p, rng, 3, 47, 2);
}

function hangar(p: Pixels, t: PortraitTraits, rng: Rng): void {
  const m = BG[t.bgTint];
  p.rect(m.base, 0, 0, p.w, p.h);
  // Ceiling lamps.
  p.rect(m.dark, 0, 0, p.w, 4);
  for (let x = 4; x < p.w; x += 14) {
    p.rect(m.light, x, 3, 6, 1);
    p.rect(m.shadow, x + 1, 4, 4, 1);
  }
  // Wall ribs.
  for (let x = 0; x < p.w; x += 12) {
    p.rect(m.shadow, x, 4, 3, 22);
    p.rect(m.light, x, 4, 1, 22);
  }
  // Diagonal hazard band.
  const top = rng.int(24, 28);
  p.rect(BG.hazardDark, 0, top, p.w, 7);
  for (let y = top + 1; y < top + 6; y++) {
    for (let x = 0; x < p.w; x++) {
      if ((((x + y) >> 2) & 1) === 0) p.px(BG.hazard, x, y);
    }
  }
  p.rect(m.dark, 0, top + 7, p.w, p.h - top - 7);
  p.rect(m.shadow, 0, top + 8, p.w, 1);
  lightPanel(p, rng, 40, 10, 2);
}

export function drawBackground(p: Pixels, t: PortraitTraits, rng: Rng): void {
  if (t.background === 'porthole') porthole(p, t, rng);
  else if (t.background === 'hangar') hangar(p, t, rng);
  else bulkhead(p, t, rng);
}
