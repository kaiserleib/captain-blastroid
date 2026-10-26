import { describe, expect, it } from 'vitest';
import { parseFrames, type PixelBuffer } from './sprite';
import { addOutline, rotateBuffer, rotatedSize, rotationBucket, silhouette } from './spriteCache';

const PAL = { a: '#f80000', b: '#00f800', o: '#100818' };

function grid(buf: PixelBuffer): string[] {
  const rows: string[] = [];
  for (let y = 0; y < buf.h; y++) {
    let r = '';
    for (let x = 0; x < buf.w; x++) {
      const i = (y * buf.w + x) * 4;
      const [R, G, A] = [buf.data[i], buf.data[i + 1], buf.data[i + 3]];
      r +=
        A === 0 ? '.' : R === 0xf8 && G === 0xf8 ? 'W' : R === 0xf8 ? 'a' : G === 0xf8 ? 'b' : 'o';
    }
    rows.push(r);
  }
  return rows;
}

const one = (src: string) => parseFrames('t', [src], PAL)[0]!;

describe('rotateBuffer', () => {
  const arrow = one(`
    .ab.
    aaaa
    .aa.
    .aa.`);

  it('is exact at 0° and 90° steps (clockwise, screen y-down)', () => {
    const s = rotatedSize(4, 4, 2, 2);
    expect(s).toEqual({ w: 6, h: 6 });
    const r0 = rotateBuffer(arrow, 2, 2, 0, s.w, s.h);
    expect(grid(r0)).toEqual(['......', '..ab..', '.aaaa.', '..aa..', '..aa..', '......']);
    const r90 = rotateBuffer(arrow, 2, 2, Math.PI / 2, s.w, s.h);
    expect(grid(r90)).toEqual(['......', '...a..', '.aaaa.', '.aaab.', '...a..', '......']);
  });

  it('four quarter turns round-trip', () => {
    let b = arrow;
    for (let i = 0; i < 4; i++) b = rotateBuffer(b, 2, 2, Math.PI / 2, 4, 4);
    expect(grid(b)).toEqual(grid(arrow));
  });

  it('keeps colors from the palette (nearest neighbor, no blending)', () => {
    const r = rotateBuffer(arrow, 2, 2, 0.4, 6, 6);
    for (let i = 0; i < r.data.length; i += 4) {
      const a = r.data[i + 3];
      expect(a === 0 || a === 255).toBe(true);
    }
  });

  it('sizes odd sprites with an odd canvas so the center pixel stays centered', () => {
    expect(rotatedSize(5, 5, 2.5, 2.5)).toEqual({ w: 9, h: 9 });
    const dot = one('...\n.a.\n...');
    const s = rotatedSize(3, 3, 1.5, 1.5);
    const r = rotateBuffer(dot, 1.5, 1.5, 1.1, s.w, s.h);
    expect(grid(r)[(s.h - 1) / 2]![(s.w - 1) / 2]).toBe('a');
  });
});

describe('rotationBucket', () => {
  it('maps radians to 16 buckets, wrapping both ways', () => {
    const step = (Math.PI * 2) / 16;
    expect(rotationBucket(0)).toBe(0);
    expect(rotationBucket(step)).toBe(1);
    expect(rotationBucket(step * 0.49)).toBe(0);
    expect(rotationBucket(Math.PI)).toBe(8);
    expect(rotationBucket(-step)).toBe(15);
    expect(rotationBucket(Math.PI * 2)).toBe(0);
    expect(rotationBucket(Math.PI * 6 + step * 3)).toBe(3);
  });
});

describe('silhouette and outline', () => {
  it('flash turns every opaque pixel white', () => {
    expect(grid(silhouette(one('ab\n.a')))).toEqual(['WW', '.W']);
  });

  it('outline grows 1 px per side and rings 4-adjacent pixels', () => {
    const out = addOutline(one('a.\n.b'), 0x100818);
    expect(out.w).toBe(4);
    expect(out.h).toBe(4);
    expect(grid(out)).toEqual(['.o..', 'oao.', '.obo', '..o.']);
  });
});
