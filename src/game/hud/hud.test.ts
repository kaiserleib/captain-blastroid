import { describe, expect, it } from 'vitest';
import { computeLayout, PLAYFIELD_H } from '../../engine/display';
import { createWorld } from '../../sim/world';
import { weaponLetter } from './icons';
import {
  BAND_MIN,
  computeHudLayout,
  defaultViewport,
  inRect,
  OVERLAY_BOTTOM_H,
  OVERLAY_TOP_H,
  safeInsetsLogical,
  viewportFromLayout,
} from './layout';
import { bossDisplayName, HudState, PIP_GAIN_T, PIP_LOST_T, WARNING_T, WHITE_OUT } from './state';
import { formatEscape, formatScore, MAX_SLOTS } from './widgets';

describe('computeHudLayout', () => {
  it('overlays the playfield edges at 240×400', () => {
    const l = computeHudLayout(defaultViewport(240, 400, 0));
    expect(l.topBand).toBe(false);
    expect(l.bottomBand).toBe(false);
    expect(l.topRowY).toBeGreaterThanOrEqual(0);
    expect(l.topRowY + 9).toBeLessThanOrEqual(OVERLAY_TOP_H);
    expect(l.bottomRowY).toBeGreaterThanOrEqual(400 - OVERLAY_BOTTOM_H);
    expect(l.bottomRowY + 12).toBeLessThanOrEqual(400);
    expect(l.bossY).toBeGreaterThanOrEqual(OVERLAY_TOP_H);
  });

  it('uses 20 px bands at 240×440', () => {
    const l = computeHudLayout(defaultViewport(240, 440, 20));
    expect(l.topBand && l.bottomBand).toBe(true);
    expect(l.topRowY).toBeGreaterThanOrEqual(0);
    // Score + chain (two 9 px rows) fit above the playfield.
    expect(l.topRowY + 18).toBeLessThanOrEqual(l.pfTop);
    expect(l.bottomRowY).toBeGreaterThanOrEqual(l.pfBottom);
    expect(l.bottomRowY + 12).toBeLessThanOrEqual(440);
    expect(l.bossY).toBeGreaterThanOrEqual(l.pfTop);
    expect(l.topBandRect).toEqual({ x: 0, y: 0, w: 240, h: 20 });
    expect(l.bottomBandRect).toEqual({ x: 0, y: 420, w: 240, h: 20 });
  });

  it('hugs the playfield in tall bands', () => {
    const l = computeHudLayout(defaultViewport(240, 520, 60));
    expect(l.pfBottom).toBe(60 + PLAYFIELD_H);
    expect(l.topRowY).toBe(60 - BAND_MIN + 2);
    expect(l.bottomRowY).toBe(463);
  });

  it('falls back to overlay when the safe area eats the band', () => {
    const v = defaultViewport(240, 440, 20);
    v.safe.top = 6;
    const l = computeHudLayout(v);
    expect(l.topBand).toBe(false);
    expect(l.bottomBand).toBe(true);
    expect(l.topRowY).toBe(22);
  });

  it('keeps rows inside left/right safe insets', () => {
    const v = defaultViewport(240, 400, 0);
    v.safe.left = 10;
    v.safe.right = 12;
    const l = computeHudLayout(v);
    expect(l.left).toBeGreaterThanOrEqual(10);
    expect(l.pauseIcon.x + l.pauseIcon.w).toBeLessThanOrEqual(240 - 12);
  });

  it('gives the pause button a ≥44 CSS px hit area inside the buffer', () => {
    const v = defaultViewport(240, 400, 0);
    v.logicalPerCss = 240 / 390;
    const l = computeHudLayout(v);
    expect(l.pauseHit.w / v.logicalPerCss).toBeGreaterThanOrEqual(44);
    expect(l.pauseHit.x + l.pauseHit.w).toBeLessThanOrEqual(240);
    expect(l.pauseHit.y).toBeGreaterThanOrEqual(0);
    const cx = l.pauseIcon.x + 4;
    const cy = l.pauseIcon.y + 4;
    expect(inRect(l.pauseHit, cx, cy)).toBe(true);
    expect(inRect(l.pauseHit, 120, 200)).toBe(false);
  });
});

describe('safe-area conversion', () => {
  it('is zero when the buffer is letterboxed inside the safe area', () => {
    const layout = computeLayout(390, 844, 3, { top: 47, right: 0, bottom: 34, left: 0 });
    const s = safeInsetsLogical(layout);
    expect(s).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('converts insets that overlap the buffer to logical px', () => {
    const layout = computeLayout(390, 844, 3);
    // Pretend a notch of 47 CSS px overlaps a buffer that fills the screen.
    layout.insets = { top: 47, right: 0, bottom: 34, left: 0 };
    const s = safeInsetsLogical(layout);
    const perCss = (layout.dpr * layout.logicalH) / layout.destH;
    expect(s.top).toBeCloseTo(
      Math.max(0, 47 * 3 - layout.destY) * (layout.logicalH / layout.destH),
    );
    expect(s.top).toBeGreaterThan(0);
    expect(s.top).toBeLessThanOrEqual(47 * perCss + 1e-9);
    expect(s.bottom).toBeGreaterThan(0);
    const v = viewportFromLayout(layout);
    expect(v.safe.top).toBe(Math.ceil(s.top));
    expect(v.logicalPerCss).toBeCloseTo((3 * 240) / layout.destW);
  });
});

describe('HudState', () => {
  it('blinks a lost pip and glints a gained one, but not on the first frame', () => {
    const st = new HudState();
    st.updateShield(3, 5, 0);
    expect(Array.from(st.pipGainT.slice(0, 5))).toEqual([0, 0, 0, 0, 0]);
    st.updateShield(2, 5, 0.016);
    expect(st.pipLostT[2]).toBeCloseTo(PIP_LOST_T);
    st.updateShield(4, 5, 0.016);
    expect(st.pipLostT[2]).toBe(0);
    expect(st.pipGainT[2]).toBeCloseTo(PIP_GAIN_T);
    expect(st.pipGainT[3]).toBeCloseTo(PIP_GAIN_T);
    st.updateShield(4, 5, 1);
    expect(st.pipGainT[3]).toBe(0);
  });

  it('sums isBoss part HP after bossSpawned and hides when none remain', () => {
    const w = createWorld('HUDTEST');
    const st = new HudState();
    const parts = [100, 50].map((hp) => {
      const e = w.enemies.spawn();
      if (!e) throw new Error('pool');
      e.isBoss = true;
      e.hp = e.maxHp = hp;
      return e;
    });
    const grunt = w.enemies.spawn();
    if (grunt) {
      grunt.isBoss = false;
      grunt.hp = grunt.maxHp = 999;
    }
    st.update(w);
    expect(st.bossActive).toBe(false);
    st.onBossSpawned('boss_scrapBaron');
    expect(st.bossName).toBe('SCRAP BARON');
    w.time = 0.1;
    st.update(w);
    expect([st.bossHp, st.bossMaxHp]).toEqual([150, 150]);
    expect(st.bossFlashT).toBe(0);

    (parts[1] as (typeof parts)[number]).hp = 20;
    w.time = 0.2;
    st.update(w);
    expect(st.bossHp).toBe(120);
    expect(st.bossFlashT).toBeGreaterThan(0);

    // A destroyed part leaves the pool; the bar keeps its full length.
    w.enemies.release(parts[1] as (typeof parts)[number]);
    w.time = 0.3;
    st.update(w);
    expect([st.bossHp, st.bossMaxHp]).toEqual([100, 150]);

    w.enemies.release(parts[0] as (typeof parts)[number]);
    w.time = 0.4;
    st.update(w);
    expect(st.bossActive).toBe(false);
  });

  it('waits briefly for boss parts that spawn after the event', () => {
    const w = createWorld('HUDTEST');
    const st = new HudState();
    st.onBossSpawned('x');
    st.update(w);
    w.time = 0.5;
    st.update(w);
    expect(st.bossActive).toBe(true);
    for (let i = 0; i < 20; i++) {
      w.time += 0.1;
      st.update(w);
    }
    expect(st.bossActive).toBe(false);
  });

  it('runs the warning for 2 s and tracks timer peaks', () => {
    const w = createWorld('HUDTEST');
    const st = new HudState();
    st.update(w);
    st.onBossWarning();
    expect(st.warningT).toBe(WARNING_T);
    w.player.magnetT = 8;
    for (let i = 0; i < 25; i++) {
      w.time += 0.1;
      st.update(w);
      w.player.magnetT -= 0.1;
    }
    expect(st.warningT).toBe(0);
    expect(st.magnetMax).toBe(8);
  });
});

describe('escape countdown', () => {
  it('counts down from escapeStarted, whites out at 0, then clears', () => {
    const w = createWorld('HUDTEST');
    const st = new HudState();
    w.time = 10;
    st.update(w);
    expect(st.escapeEnd).toBe(-1);
    st.onEscapeStarted(w.time, 40);
    w.time = 25;
    st.update(w);
    expect(st.escapeLeft).toBeCloseTo(25);
    expect(st.whiteOut).toBe(0);
    w.time = 50 + WHITE_OUT.in / 2;
    st.update(w);
    expect(st.escapeLeft).toBe(0);
    expect(st.whiteOut).toBeCloseTo(0.5);
    w.time = 50 + WHITE_OUT.in + WHITE_OUT.hold / 2;
    st.update(w);
    expect(st.whiteOut).toBe(1);
    w.time = 50 + WHITE_OUT.in + WHITE_OUT.hold + WHITE_OUT.out + 0.1;
    st.update(w);
    expect(st.whiteOut).toBe(0);
    expect(st.escapeEnd).toBe(-1);
  });

  it('formats whole seconds rounded up', () => {
    expect(formatEscape(40)).toBe('ESCAPE 0:40');
    expect(formatEscape(9.2)).toBe('ESCAPE 0:10');
    expect(formatEscape(0)).toBe('ESCAPE 0:00');
    expect(formatEscape(75)).toBe('ESCAPE 1:15');
  });

  it('fits six weapon slots left of the timers at 240 px', () => {
    expect(MAX_SLOTS).toBe(6);
    const l = computeHudLayout(defaultViewport(240, 400, 0));
    // 18 px per slot (12 px icon + level column); two timers take 24 px on the right.
    expect(l.left + MAX_SLOTS * 18).toBeLessThan(l.right - 24 - 8);
  });
});

describe('formatting', () => {
  it('pads the score and maps weapon letters', () => {
    expect(formatScore(1234)).toBe('0001234');
    expect(
      ['blaster', 'spread', 'lance', 'seeker', 'orbitDrones', 'zap'].map(weaponLetter),
    ).toEqual(['B', 'S', 'L', 'M', 'D', 'Z']);
    expect(bossDisplayName('scrap_baron')).toBe('SCRAP BARON');
  });
});
