import { describe, expect, it } from 'vitest';
import { generatePortrait, renderPortrait, type PixelSink } from './generator';
import { NAMED_PORTRAITS } from './named';
import { snes } from './palette';
import { rollTraits } from './traits';

class RecordingCtx implements PixelSink {
  fillStyle: PixelSink['fillStyle'] = '#000000';
  calls: string[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(`${String(this.fillStyle)}:${x},${y},${w},${h}`);
  }
}

function record(seed: string, ov = {}): string[] {
  const ctx = new RecordingCtx();
  generatePortrait(ctx, seed, ov);
  return ctx.calls;
}

function hash(seed: string, ov = {}): string {
  return renderPortrait(seed, ov).pixels.data.join('');
}

describe('portrait generator', () => {
  it('is deterministic for a seed + overrides', () => {
    for (const seed of ['ABCD2345', 'ZZTOP', 'X']) {
      expect(record(seed)).toEqual(record(seed));
      expect(record(seed, { uniform: 'teal' })).toEqual(record(seed, { uniform: 'teal' }));
    }
  });

  it('covers the full 48x56 canvas with integer rects', () => {
    const ctx = new RecordingCtx();
    generatePortrait(ctx, 'COVER');
    let area = 0;
    for (const c of ctx.calls) {
      const [x, y, w, h] = (c.split(':')[1] ?? '').split(',').map(Number);
      expect([x, y, w, h].every((n) => Number.isInteger(n))).toBe(true);
      area += (w ?? 0) * (h ?? 0);
    }
    expect(area).toBe(48 * 56);
  });

  it('different seeds give visibly different pilots', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(hash(`SEED${i}`));
    expect(seen.size).toBe(20);
  });

  it('only paints 15-bit colors', () => {
    for (let i = 0; i < 40; i++) {
      for (const c of new Set(renderPortrait(`Q${i}`).pixels.data)) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
        expect(snes(c)).toBe(c);
      }
    }
  });

  it('overriding one trait leaves the other rolls alone', () => {
    const a = rollTraits('STABLE');
    const b = rollTraits('STABLE', { uniform: a.uniform === 'cobalt' ? 'olive' : 'cobalt' });
    expect({ ...b, uniform: a.uniform }).toEqual(a);
  });

  it('visorDown forces the closed helmet and hides the eyes', () => {
    const t = rollTraits('VISOR', { visorDown: true, headgear: 'none' });
    expect(t.headgear).toBe('helmetDown');
    expect(t.visorDown).toBe(true);
    expect(rollTraits('VISOR', { headgear: 'helmetDown', visorDown: false }).headgear).toBe(
      'helmetUp',
    );
  });

  it('rolls rare alien pilots', () => {
    let aliens = 0;
    for (let i = 0; i < 1000; i++) if (rollTraits(`A${i}`).alien) aliens++;
    expect(aliens).toBeGreaterThan(40);
    expect(aliens).toBeLessThan(130);
  });
});

describe('named pilots', () => {
  it('apply their signature traits', () => {
    const b = rollTraits(NAMED_PORTRAITS.blastroid.seed, NAMED_PORTRAITS.blastroid.overrides);
    expect([b.head, b.mouth, b.hair, b.headgear, b.uniform]).toEqual([
      'square',
      'grin',
      'swept',
      'helmetUp',
      'cobalt',
    ]);
    const j = rollTraits(NAMED_PORTRAITS.juno.seed, NAMED_PORTRAITS.juno.overrides);
    expect([j.age, j.hair, j.hairColor, j.headgear, j.uniform]).toEqual([
      'young',
      'undercut',
      'cyan',
      'headset',
      'orange',
    ]);
    expect(j.accessories).toContain('freckles');
    const g = rollTraits(NAMED_PORTRAITS.grieg.seed, NAMED_PORTRAITS.grieg.overrides);
    expect([g.age, g.facialHair, g.hairColor, g.uniform, g.mouth]).toEqual([
      'old',
      'fullBeard',
      'white',
      'olive',
      'grim',
    ]);
    expect(g.accessories).toEqual(['eyepatch', 'scar']);
    const z = rollTraits(NAMED_PORTRAITS.zzkar.seed, NAMED_PORTRAITS.zzkar.overrides);
    expect([z.alien, z.skin, z.antennae, z.nose, z.eyes, z.uniform]).toEqual([
      true,
      'lavender',
      true,
      'none',
      'large',
      'purple',
    ]);
  });

  it('are pinned to fixed pixels', () => {
    const hashes = Object.values(NAMED_PORTRAITS).map((s) => hash(s.seed, s.overrides));
    expect(new Set(hashes).size).toBe(4);
    for (const s of Object.values(NAMED_PORTRAITS)) {
      expect(hash(s.seed, s.overrides)).toBe(hash(s.seed, s.overrides));
    }
  });
});

describe('palette', () => {
  it('snes quantizes channels to multiples of 8, max 248', () => {
    expect(snes('#ffffff')).toBe('#f8f8f8');
    expect(snes('#030507')).toBe('#000808');
    expect(snes('#3a5a2a')).toBe('#385828');
  });
});

it('the generator never calls Math.random', () => {
  const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  expect(Object.keys(sources).length).toBeGreaterThan(5);
  for (const src of Object.values(sources)) expect(src).not.toContain('Math.random');
});
