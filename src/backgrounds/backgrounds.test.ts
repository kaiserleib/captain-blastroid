import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng';
import { createWorld } from '../sim/world';
import {
  Background,
  layerSeed,
  speedLineAlpha,
  speedLineLength,
  STRIP_H,
  STRIP_W,
  stripOffset,
} from './background';
import { isQuantized, q5, rgbValue } from './color';
import { createBackgroundPair } from './index';
import { EDGE_H, generateNebula, nebulaEdge, nebulaPalette, nebulaPhases } from './nebula';
import { bayer4, ditherLevel, verticalTilingNoise } from './noise';
import {
  generateSetPiece,
  generateSetPieceFrames,
  hasLights,
  LIGHT_PHASES,
  setPiecePalette,
  SHIMMER_PHASES,
  type SetPieceKind,
  type SetPieceSpec,
} from './setpieces';
import { generateStars, generateStreaks, starPalette, TWINKLE_PHASES } from './starfield';
import { MAX_FILL_VALUE, MAX_POINT_VALUE, THEME_IDS, THEMES, themeForLevel } from './themes';

describe('color', () => {
  it('quantizes to multiples of 8 in 0..248', () => {
    expect(q5(255)).toBe(248);
    expect(q5(3)).toBe(0);
    expect(q5(13)).toBe(16);
  });
});

describe('noise', () => {
  it('bayer thresholds are 16 distinct values in (0,1)', () => {
    const s = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s.add(bayer4(x, y));
    expect(s.size).toBe(16);
    for (const v of s) expect(v > 0 && v < 1).toBe(true);
  });

  it('dither hits the extremes and averages to the input', () => {
    expect(ditherLevel(0, 3, 1, 2)).toBe(0);
    expect(ditherLevel(1, 3, 1, 2)).toBe(3);
    let sum = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += ditherLevel(0.5, 3, x, y);
    expect(sum / 16).toBeCloseTo(1.5, 1);
  });

  it('tiles vertically', () => {
    const n = verticalTilingNoise(createRng(1), 32, 240, STRIP_H);
    for (let x = 0; x < 240; x += 7) expect(n.sample(x, STRIP_H)).toBeCloseTo(n.sample(x, 0), 6);
  });
});

describe('layers', () => {
  const t = THEMES.kessler;

  it('same seed gives the same pixels; a different seed differs', () => {
    const a = generateNebula(5, STRIP_W, STRIP_H, t.nebula).data;
    const b = generateNebula(5, STRIP_W, STRIP_H, t.nebula).data;
    const c = generateNebula(6, STRIP_W, STRIP_H, t.nebula).data;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(generateStars(9, 240, 640, t.stars).data).toEqual(
      generateStars(9, 240, 640, t.stars).data,
    );
    expect(generateStreaks(9, 240, 640, t.streaks).data).toEqual(
      generateStreaks(9, 240, 640, t.streaks).data,
    );
    for (const sp of t.setPieces) {
      expect(generateSetPiece(3, sp).data).toEqual(generateSetPiece(3, sp).data);
    }
  });

  it('nebula has clouds and clear sky, and its strip wraps without a seam', () => {
    const neb = generateNebula(layerSeed('ABC', 'kessler', 'nebula'), STRIP_W, STRIP_H, t.nebula);
    let filled = 0;
    for (const v of neb.data) if (v) filled++;
    const share = filled / neb.data.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.8);
    // Top and bottom rows should be about as similar as any two adjacent rows.
    const rowDiff = (y0: number, y1: number): number => {
      let d = 0;
      for (let x = 0; x < STRIP_W; x++) {
        const a = neb.data[y0 * STRIP_W + x] as number;
        const b = neb.data[y1 * STRIP_W + x] as number;
        d += Math.abs(a - b);
      }
      return d;
    };
    let typical = 0;
    for (let y = 0; y < STRIP_H - 1; y++) typical += rowDiff(y, y + 1);
    typical /= STRIP_H - 1;
    expect(rowDiff(STRIP_H - 1, 0)).toBeLessThan(typical * 3 + 10);
  });

  it('palette cycle produces distinct twinkle phases', () => {
    const seen = new Set<string>();
    for (let p = 0; p < TWINKLE_PHASES; p++) seen.add(JSON.stringify(starPalette(t.stars, p)));
    expect(seen.size).toBe(TWINKLE_PHASES);
  });

  it('layer seeds depend on seed, theme and layer', () => {
    expect(layerSeed('A', 'ion', 'stars')).toBe(layerSeed('A', 'ion', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('B', 'ion', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('A', 'pulsar', 'stars'));
    expect(layerSeed('A', 'ion', 'stars')).not.toBe(layerSeed('A', 'ion', 'nebula'));
  });
});

describe('themes', () => {
  it.each(THEME_IDS)('%s is 15-bit and dark enough', (id) => {
    const th = THEMES[id];
    const fills = [th.base, ...th.nebula.colors, ...th.setPieces.flatMap((s) => s.colors)];
    for (const c of fills) {
      expect(isQuantized(c)).toBe(true);
      expect(rgbValue(c)).toBeLessThanOrEqual(MAX_FILL_VALUE);
    }
    const lights = th.setPieces.flatMap((s) => (s.light ? [s.light] : []));
    for (const c of [...th.stars.colors, th.streaks.head, th.streaks.tail, ...lights]) {
      expect(isQuantized(c)).toBe(true);
      expect(rgbValue(c)).toBeLessThanOrEqual(MAX_POINT_VALUE);
    }
    expect(th.id).toBe(id);
    expect(STRIP_H % th.nebula.patch).toBe(0);
  });

  it('maps level ids to themes', () => {
    expect(themeForLevel('kessler')).toBe('kessler');
    expect(themeForLevel('pulsar')).toBe('pulsar');
    expect(themeForLevel('unknown-level')).toBe('kessler');
    expect(themeForLevel('ionShoals')).toBe('ion');
    expect(themeForLevel('eventHorizon')).toBe('horizon');
    expect(themeForLevel('pulsarNursery')).toBe('pulsar');
    expect(themeForLevel('armada')).toBe('armada');
    expect(themeForLevel('corona')).toBe('corona');
    expect(themeForLevel('warrens')).toBe('warrens');
    expect(themeForLevel('junction')).toBe('junction');
    expect(themeForLevel('chrono')).toBe('rift');
    expect(themeForLevel('foundry')).toBe('foundry');
  });

  it('armada has a gas giant at 0.1× and fleet silhouettes at 0.2×', () => {
    const pieces = THEMES.armada.setPieces;
    const giant = pieces.find((p) => p.kind === 'giant');
    expect(giant?.parallax ?? 0.1).toBe(0.1);
    const fleets = pieces.filter((p) => p.kind === 'fleet');
    expect(fleets.length).toBeGreaterThan(0);
    for (const f of fleets) expect(f.parallax).toBe(0.2);
    expect(THEMES.horizon.setPieces.some((p) => p.kind === 'disk')).toBe(true);
  });
});

describe('new set pieces', () => {
  const fleet = THEMES.armada.setPieces.find((p) => p.kind === 'fleet') as SetPieceSpec;

  it.each(['giant', 'fleet', 'disk'] as const)('%s is seeded and draws something', (kind) => {
    const spec =
      THEMES.armada.setPieces.find((p) => p.kind === kind) ??
      (THEMES.horizon.setPieces.find((p) => p.kind === kind) as SetPieceSpec);
    const a = generateSetPiece(11, spec);
    expect(a.data).toEqual(generateSetPiece(11, spec).data);
    expect(a.data).not.toEqual(generateSetPiece(12, spec).data);
    let filled = 0;
    for (const v of a.data) if (v) filled++;
    expect(filled).toBeGreaterThan(50);
  });

  it('fleet silhouettes are mostly dark hull with a few lights', () => {
    const b = generateSetPiece(7, fleet);
    const counts = new Array<number>(8).fill(0);
    for (const v of b.data) counts[v]!++;
    const hull = counts[1]! + counts[2]! + counts[3]!;
    const lights = counts[4]! + counts[5]!;
    expect(hull).toBeGreaterThan(200);
    expect(lights).toBeGreaterThanOrEqual(3);
    expect(lights).toBeLessThanOrEqual(10);
    expect(counts[1]!).toBeGreaterThan(counts[2]! + counts[3]!);
  });

  it('running lights blink: phases differ, and an unlit light shows hull', () => {
    const seen = new Set<string>();
    for (let p = 0; p < LIGHT_PHASES; p++) seen.add(JSON.stringify(setPiecePalette(fleet, p)));
    expect(seen.size).toBeGreaterThan(1);
    const off = setPiecePalette(fleet, 1);
    expect(off[4]).toEqual(fleet.colors[0]);
    expect(setPiecePalette(fleet, 0)[4]).toEqual(fleet.light);
  });
});

describe('speed lines', () => {
  it('appear only above 50 px/s and are full strength by 60', () => {
    expect(speedLineAlpha(18)).toBe(0);
    expect(speedLineAlpha(30)).toBe(0);
    expect(speedLineAlpha(50)).toBe(0);
    expect(speedLineAlpha(55)).toBeCloseTo(0.5);
    expect(speedLineAlpha(60)).toBe(1);
    expect(speedLineAlpha(70)).toBe(1);
  });

  it('grow with speed within 6..14 px', () => {
    expect(speedLineLength(50)).toBe(6);
    expect(speedLineLength(70)).toBeGreaterThan(speedLineLength(55));
    expect(speedLineLength(500)).toBe(14);
  });
});

describe('scroll', () => {
  it('strip offsets are whole pixels in [0, STRIP_H)', () => {
    expect(stripOffset(0)).toBe(0);
    expect(stripOffset(12.9)).toBe(12);
    expect(stripOffset(STRIP_H + 3.5)).toBe(3);
    expect(stripOffset(-1.5)).toBe(STRIP_H - 2);
  });

  it('the background system advances world.scrollY once per tick', () => {
    const w = createWorld('S');
    w.scrollSpeed = 30;
    const { system } = createBackgroundPair(new Background('kessler', 'S'));
    system.update(w, 0.5);
    system.update(w, 0.5);
    expect(w.scrollY).toBeCloseTo(30);
  });

  it('follows world.scrollSpeed changes every tick, not the theme speed', () => {
    const w = createWorld('S');
    const { system } = createBackgroundPair(new Background('pulsar', 'S'));
    w.scrollSpeed = 70;
    system.update(w, 1);
    w.scrollSpeed = 18;
    system.update(w, 1);
    expect(w.scrollY).toBeCloseTo(88);
  });
});

// Relative luminance (WCAG), for the readability check.
function lum(c: readonly number[]): number {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
}

describe('Act II themes', () => {
  const ACT2 = ['corona', 'warrens', 'junction', 'rift', 'foundry'] as const;
  const piece = (kind: SetPieceKind): SetPieceSpec => {
    for (const id of THEME_IDS) {
      const p = THEMES[id].setPieces.find((sp) => sp.kind === kind);
      if (p) return p;
    }
    throw new Error(kind);
  };

  it.each(ACT2)('%s fills keep the enemy-bullet ring (#f858b8) at ≥ 2:1 contrast', (id) => {
    const th = THEMES[id];
    const ring = lum([248, 88, 184]);
    const fills = [th.base, ...th.nebula.colors, ...th.setPieces.flatMap((sp) => sp.colors)];
    for (const c of fills) expect((ring + 0.05) / (lum(c) + 0.05)).toBeGreaterThanOrEqual(2);
    for (const c of [th.nebula.lights?.color, th.speedLines?.color]) {
      if (c) expect(rgbValue(c)).toBeLessThanOrEqual(MAX_POINT_VALUE);
    }
  });

  it.each(['limb', 'ring', 'flare', 'clock', 'sun', 'girder'] as const)(
    '%s is seeded and draws something',
    (kind) => {
      const spec = piece(kind);
      const a = generateSetPiece(11, spec);
      expect(a.data).toEqual(generateSetPiece(11, spec).data);
      expect(a.data).not.toEqual(generateSetPiece(12, spec).data);
      let filled = 0;
      let maxIdx = 0;
      for (const v of a.data) {
        if (v) filled++;
        if (v > maxIdx) maxIdx = v;
      }
      expect(filled).toBeGreaterThan(50);
      // Every index used has a palette entry.
      expect(maxIdx).toBeLessThan(setPiecePalette(spec).length);
    },
  );

  it('the corona limb is pinned to the top and shimmers', () => {
    const limb = piece('limb');
    expect(limb.anchor).toBe('top');
    expect(limb.colors).toHaveLength(5);
    const frames = generateSetPieceFrames(3, limb);
    expect(frames).toHaveLength(SHIMMER_PHASES);
    expect(frames[1]!.data).not.toEqual(frames[0]!.data);
    // The star body (inside the disc) doesn't move between frames; only the glow does.
    const w = frames[0]!.w;
    expect(frames[1]!.data.subarray(0, 40 * w)).toEqual(frames[0]!.data.subarray(0, 40 * w));
  });

  it('ring gates and girders have blinking lights', () => {
    for (const kind of ['ring', 'girder'] as const) {
      const spec = piece(kind);
      expect(hasLights(spec)).toBe(true);
      const b = generateSetPiece(5, spec);
      expect(b.data.some((v) => v === 4 || v === 5)).toBe(true);
      expect(setPiecePalette(spec, 0)).not.toEqual(setPiecePalette(spec, 1));
    }
    // A cooled seam still glows faintly instead of showing as steel.
    const g = piece('girder');
    expect(setPiecePalette(g, 1)[4]).toEqual(g.colors[2]);
  });

  it('warrens strata tile, carry lamps, and start as a gated wall', () => {
    const neb = THEMES.warrens.nebula;
    expect(neb.style).toBe('strata');
    expect(neb.start).toBeGreaterThan(0);
    expect(nebulaPhases(neb)).toBe(LIGHT_PHASES);
    const b = generateNebula(4, STRIP_W, STRIP_H, neb);
    const levels = neb.colors.length;
    let lamps = 0;
    let filled = 0;
    for (const v of b.data) {
      if (v > levels) lamps++;
      if (v) filled++;
    }
    expect(lamps).toBe(neb.lights!.count);
    expect(filled / b.data.length).toBeGreaterThan(0.4);
    expect(filled / b.data.length).toBeLessThan(0.98);
    expect(nebulaPalette(neb, 0)).toHaveLength(levels + 3);
    // The lip continues the strip from the row under the leading edge, minus lamps.
    const lip = nebulaEdge(9, b, 100, levels);
    expect(lip.h).toBe(EDGE_H);
    for (let x = 0; x < STRIP_W; x++) {
      const top = lip.data[x]!;
      const src = b.data[100 * STRIP_W + x]!;
      if (top && top !== 1) expect(top).toBe(src);
      expect(top).toBeLessThanOrEqual(levels);
    }
  });

  it('rift stars leave afterimages above bright stars', () => {
    const spec = THEMES.rift.stars;
    const plain = generateStars(9, 240, 640, { ...spec, ghosts: 0 });
    const ghosted = generateStars(9, 240, 640, spec);
    let extra = 0;
    for (let i = 0; i < plain.data.length; i++) {
      if (!plain.data[i] && ghosted.data[i]) {
        extra++;
        expect(ghosted.data[i]).toBe(1);
      }
    }
    expect(extra).toBeGreaterThan(20);
  });

  it('foundry speed lines are denser and longer for the escape', () => {
    const sl = THEMES.foundry.speedLines!;
    expect(sl.count).toBeGreaterThan(18);
    expect(speedLineLength(90, sl)).toBeGreaterThan(speedLineLength(90));
    expect(speedLineLength(50, sl)).toBe(6);
  });
});
