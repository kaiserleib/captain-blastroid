// Title logo: the ui font's glyph bits, emboldened, scaled up, banded with a metallic
// gradient, extruded downward and outlined. Pure pixel math until `logoCanvas` paints it.
import { FONT_UI, glyphFor } from '../gfx/font';

export interface Mask {
  w: number;
  h: number;
  /** 1 = lit, row-major. */
  bits: Uint8Array;
}

export interface LogoPixels {
  w: number;
  h: number;
  /** CSS color per pixel, or null for transparent. */
  px: (string | null)[];
  /** Bounding box of the lettering face (for the sheen). */
  faceTop: number;
  faceH: number;
}

/** Lit pixels of `str` in the ui font, one glyph cell tall. */
export function textMask(str: string, gap = FONT_UI.spacing): Mask {
  const f = FONT_UI;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const g = glyphFor(f, str.charCodeAt(i));
    w += (g ? g.w : f.spaceW) + gap;
  }
  w = Math.max(1, w - gap);
  const h = f.cellH;
  const bits = new Uint8Array(w * h);
  let x = 0;
  for (let i = 0; i < str.length; i++) {
    const g = glyphFor(f, str.charCodeAt(i));
    if (g) {
      for (let j = 0; j < g.bits.length; j += 2) {
        const bx = x + (g.bits[j] as number);
        const by = g.bits[j + 1] as number;
        if (bx < w && by < h) bits[by * w + bx] = 1;
      }
    }
    x += (g ? g.w : f.spaceW) + gap;
  }
  return { w, h, bits };
}

/** Thickens strokes by OR-ing a copy shifted right (and down when `down`). */
export function embolden(m: Mask, down = true): Mask {
  const w = m.w + 1;
  const h = m.h + (down ? 1 : 0);
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.bits[y * m.w + x]) continue;
      bits[y * w + x] = 1;
      bits[y * w + x + 1] = 1;
      if (down) {
        bits[(y + 1) * w + x] = 1;
        bits[(y + 1) * w + x + 1] = 1;
      }
    }
  }
  return { w, h, bits };
}

export function scaleMask(m: Mask, sx: number, sy = sx): Mask {
  const w = m.w * sx;
  const h = m.h * sy;
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++)
      bits[y * w + x] = m.bits[Math.floor(y / sy) * m.w + Math.floor(x / sx)] as number;
  }
  return { w, h, bits };
}

/** Trims empty rows (the font cell has descender space). */
function rowSpan(m: Mask): [number, number] {
  let top = m.h;
  let bottom = -1;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (m.bits[y * m.w + x]) {
        if (y < top) top = y;
        bottom = y;
        break;
      }
    }
  }
  return bottom < 0 ? [0, 0] : [top, bottom - top + 1];
}

export interface LogoStyle {
  /** Face colors top → bottom, applied in equal horizontal bands. */
  face: readonly string[];
  /** Extrusion colors, nearest the face first; one px each, straight down. */
  extrude: readonly string[];
  outline: string;
}

export function stylize(m: Mask, style: LogoStyle): LogoPixels {
  const [top, faceH] = rowSpan(m);
  const ex = style.extrude.length;
  // 1 px outline all round, plus room for the extrusion below.
  const w = m.w + 2;
  const h = faceH + ex + 2;
  const px: (string | null)[] = new Array(w * h).fill(null);
  const solid = new Uint8Array(w * h);
  const lit = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < m.w && y < faceH && m.bits[(y + top) * m.w + x] === 1;

  for (let y = 0; y < faceH; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!lit(x, y)) continue;
      for (let k = ex; k >= 1; k--) {
        const i = (y + 1 + k) * w + x + 1;
        if (!lit(x, y + k)) px[i] = style.extrude[k - 1] as string;
        solid[i] = 1;
      }
    }
  }
  const bands = style.face.length;
  for (let y = 0; y < faceH; y++) {
    const c = style.face[Math.min(bands - 1, Math.floor((y * bands) / faceH))] as string;
    for (let x = 0; x < m.w; x++) {
      if (!lit(x, y)) continue;
      const i = (y + 1) * w + x + 1;
      px[i] = c;
      solid[i] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      let near = false;
      for (let oy = -1; oy <= 1 && !near; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[ny * w + nx]) {
            near = true;
            break;
          }
        }
      }
      if (near) px[i] = style.outline;
    }
  }
  return { w, h, px, faceTop: 1, faceH };
}

/**
 * Glyphs get a 2 px gap so emboldening (horizontal only, keeping counters open)
 * can't fuse neighbours; `sy > sx` stretches the letters into logo proportions.
 */
export function buildLogoLine(str: string, sx: number, sy: number, style: LogoStyle): LogoPixels {
  return stylize(scaleMask(embolden(textMask(str, 2), false), sx, sy), style);
}

export const LOGO_GOLD: LogoStyle = {
  face: ['#f8f8d8', '#f8e878', '#f8d040', '#f8b030', '#f09020', '#e07018', '#c05010', '#983808'],
  extrude: ['#682008', '#501808', '#381008'],
  outline: '#100818',
};

export const LOGO_STEEL: LogoStyle = {
  face: ['#f8f8f8', '#d0e8f8', '#a8d0f0', '#78a8e0', '#5880c8', '#4060b0'],
  extrude: ['#283880', '#182058'],
  outline: '#100818',
};

function paint(p: LogoPixels): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  for (let y = 0; y < p.h; y++) {
    let x = 0;
    while (x < p.w) {
      const col = p.px[y * p.w + x];
      let end = x + 1;
      while (end < p.w && p.px[y * p.w + end] === col) end++;
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, end - x, 1);
      }
      x = end;
    }
  }
  return c;
}

export interface Logo {
  captain: HTMLCanvasElement;
  blastroid: HTMLCanvasElement;
  /** Same shape in white, for the sheen pass. */
  blastroidMask: HTMLCanvasElement;
}

let cached: Logo | null = null;

export function logoCanvases(): Logo {
  if (cached) return cached;
  const big = buildLogoLine('BLASTROID', 3, 5, LOGO_GOLD);
  const face = new Set(LOGO_GOLD.face);
  const white: LogoPixels = {
    ...big,
    px: big.px.map((c) => (c && face.has(c) ? '#f8f8f8' : null)),
  };
  cached = {
    captain: paint(buildLogoLine('CAPTAIN', 2, 2, LOGO_STEEL)),
    blastroid: paint(big),
    blastroidMask: paint(white),
  };
  return cached;
}
