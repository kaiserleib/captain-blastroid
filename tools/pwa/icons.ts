// App icons and splash screens rendered from the Kestrel sprite, so the PWA and the
// native shells carry no hand-made image files. Pure: returns RGBA buffers.
import { snes } from '../../src/gfx/palette';
import '../../src/gfx/reference.sprites';
import { getSpriteEntry, parseHex, type PixelBuffer } from '../../src/gfx/sprite';

export type IconStyle =
  /** Full-bleed square on the space backdrop (PWA "any", apple-touch-icon, legacy launcher). */
  | 'square'
  /** Same art inside the 80% maskable safe zone. */
  | 'maskable'
  /** Circle-masked launcher icon (Android `ic_launcher_round`). */
  | 'round'
  /** Ship only on transparency, inside the adaptive-icon safe zone (Android foreground). */
  | 'foreground'
  /** Black screen with a small centered ship. */
  | 'splash';

export const ICON_BG = snes('#081830');
const BG_BANDS = [snes('#081020'), snes('#081830'), snes('#102040'), snes('#182850')];
const STAR = snes('#a8c8f8');
const STAR_DIM = snes('#506890');
const OUTLINE = '#100818';

/** Share of the icon edge the ship's longer side may span. */
const FILL: Record<IconStyle, number> = {
  square: 0.7,
  maskable: 0.52,
  round: 0.6,
  foreground: 0.45,
  splash: 0.12,
};

function rgb(hex: string): [number, number, number] {
  const c = parseHex('icon', hex);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** The Kestrel's first frame with the same 1 px outline the renderer bakes. */
export function kestrelPixels(): PixelBuffer {
  const e = getSpriteEntry('kestrel');
  if (!e || e.kind !== 'grid') throw new Error('kestrel sprite missing');
  const src = e.pixels[0] as PixelBuffer;
  const w = src.w + 2;
  const h = src.h + 2;
  const data = new Uint8ClampedArray(w * h * 4);
  const [or, og, ob] = rgb(OUTLINE);
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < src.w && y < src.h && (src.data[(y * src.w + x) * 4 + 3] ?? 0) > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (opaque(x - 1, y - 1)) {
        const j = ((y - 1) * src.w + (x - 1)) * 4;
        data[i] = src.data[j] ?? 0;
        data[i + 1] = src.data[j + 1] ?? 0;
        data[i + 2] = src.data[j + 2] ?? 0;
        data[i + 3] = 255;
      } else if (
        opaque(x - 2, y - 1) ||
        opaque(x, y - 1) ||
        opaque(x - 1, y - 2) ||
        opaque(x - 1, y)
      ) {
        data[i] = or;
        data[i + 1] = og;
        data[i + 2] = ob;
        data[i + 3] = 255;
      }
    }
  }
  return { w, h, data };
}

/** Deterministic star field in "art pixel" space (hash, no RNG state). */
function starAt(gx: number, gy: number): string | null {
  let n = (gx * 374761393 + gy * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  const v = (n >>> 0) % 1000;
  if (v < 6) return STAR;
  if (v < 22) return STAR_DIM;
  return null;
}

/**
 * Renders a `w`×`h` RGBA icon (square except splash screens). Everything is drawn on a coarse "art pixel"
 * grid and upscaled nearest-neighbor, so the icon reads as pixel art at any size.
 */
export function renderIcon(w: number, h: number, style: IconStyle): PixelBuffer {
  const size = Math.min(w, h);
  const ship = kestrelPixels();
  const scale = Math.max(1, Math.floor((size * FILL[style]) / Math.max(ship.w, ship.h)));
  const shipW = ship.w * scale;
  const shipH = ship.h * scale;
  const ox = Math.floor((w - shipW) / 2);
  const oy = Math.floor((h - shipH) / 2);
  const data = new Uint8ClampedArray(w * h * 4);
  const bands = BG_BANDS.map(rgb);
  const black = rgb('#000000');
  const r2 = (size / 2) * (size / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (style === 'round') {
        const dx = x + 0.5 - w / 2;
        const dy = y + 0.5 - h / 2;
        if (dx * dx + dy * dy > r2) continue;
      }
      // Background.
      if (style === 'splash') {
        data.set(black, i);
        data[i + 3] = 255;
      } else if (style !== 'foreground') {
        const gx = Math.floor((x - ox) / scale);
        const gy = Math.floor((y - oy) / scale);
        const band = Math.min(bands.length - 1, Math.floor((y / h) * bands.length));
        const star = starAt(gx + 1000, gy + 1000);
        data.set(star ? rgb(star) : (bands[band] as [number, number, number]), i);
        data[i + 3] = 255;
      }
      // Ship.
      const sx = x - ox;
      const sy = y - oy;
      if (sx < 0 || sy < 0 || sx >= shipW || sy >= shipH) continue;
      const j = (Math.floor(sy / scale) * ship.w + Math.floor(sx / scale)) * 4;
      if ((ship.data[j + 3] ?? 0) === 0) continue;
      data[i] = ship.data[j] ?? 0;
      data[i + 1] = ship.data[j + 1] ?? 0;
      data[i + 2] = ship.data[j + 2] ?? 0;
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}
