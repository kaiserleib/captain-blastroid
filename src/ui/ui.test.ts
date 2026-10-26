import { describe, expect, it, vi } from 'vitest';
import type { ScenePointer } from '../engine/scene';
import { normalize } from '../meta';
import { createRunState } from '../sim/world';
import { debugSave } from './debugSaves';
import { formatTime, wrapText } from './draw';
import { wasdNav } from './keys';
import { buildLogoLine, embolden, LOGO_GOLD, scaleMask, textMask } from './logo';
import { hitTest, Menu, navTarget, type MenuItem } from './menu';
import { bankFinishedRun, discoveryLines } from './results';
import { cycleShake, SLIDERS, snapSetting } from './settings';

const item = (id: string, x: number, y: number, w = 100, h = 20): MenuItem => ({ id, x, y, w, h });
const list = [item('a', 20, 10), item('b', 20, 40), item('c', 20, 70)];
const grid = [
  item('tl', 0, 0, 50, 50),
  item('tr', 60, 0, 50, 50),
  item('bl', 0, 60, 50, 50),
  item('br', 60, 60, 50, 50),
];

function ptr(
  type: ScenePointer['type'],
  x: number,
  y: number,
  id = 1,
  pointerType = 'touch',
): ScenePointer {
  return { type, x, y, id, pointerType };
}

describe('hitTest', () => {
  it('finds the item under the point', () => {
    expect(hitTest(list, 50, 45, 1)).toBe(1);
    expect(hitTest(list, 50, 35, 1)).toBe(-1);
  });

  it('grows small items to the minimum tap size, nearest centre winning', () => {
    const small = [item('x', 0, 0, 10, 10), item('y', 0, 30, 10, 10)];
    expect(hitTest(small, 5, 13, 22)).toBe(0);
    expect(hitTest(small, 5, 27, 22)).toBe(1);
    expect(hitTest(small, 5, 13, 1)).toBe(-1);
  });
});

describe('navTarget', () => {
  it('moves through a list and wraps vertically', () => {
    expect(navTarget(list, 0, 0, 1)).toBe(1);
    expect(navTarget(list, 2, 0, 1)).toBe(0);
    expect(navTarget(list, 0, 0, -1)).toBe(2);
  });

  it('moves spatially in a grid without wrapping sideways', () => {
    expect(navTarget(grid, 0, 1, 0)).toBe(1);
    expect(navTarget(grid, 0, 0, 1)).toBe(2);
    expect(navTarget(grid, 3, -1, 0)).toBe(2);
    expect(navTarget(grid, 1, 1, 0)).toBe(-1);
  });
});

describe('Menu', () => {
  it('activates on release over the pressed item only', () => {
    const activate = vi.fn();
    const m = new Menu({ activate });
    m.setItems(list.map((i) => ({ ...i })));
    m.pointer(ptr('down', 50, 45));
    expect(m.focus).toBe(1);
    m.pointer(ptr('up', 50, 75));
    expect(activate).not.toHaveBeenCalled();
    m.pointer(ptr('down', 50, 45));
    m.pointer(ptr('up', 50, 46));
    expect(activate).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('hover focuses with a mouse but not with touch', () => {
    const moved = vi.fn();
    const m = new Menu({ activate: () => {}, moved });
    m.setItems(list.map((i) => ({ ...i })));
    m.pointer(ptr('move', 50, 75, 1, 'touch'));
    expect(m.focus).toBe(0);
    m.pointer(ptr('move', 50, 75, 1, 'mouse'));
    expect(m.focus).toBe(2);
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('routes left/right on sliders to adjust and drags to drag', () => {
    const adjust = vi.fn();
    const drag = vi.fn();
    const m = new Menu({ activate: () => {}, adjust, drag });
    m.setItems([{ ...item('vol', 0, 0), slider: true }, item('done', 0, 30)]);
    m.nav(1, 0);
    expect(adjust).toHaveBeenCalledWith(expect.objectContaining({ id: 'vol' }), 1);
    m.pointer(ptr('down', 30, 10));
    m.pointer(ptr('move', 60, 12));
    expect(drag.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [30, true],
      [60, false],
    ]);
  });

  it('keeps focus on the same id across setItems', () => {
    const m = new Menu({ activate: () => {} });
    m.setItems(list.map((i) => ({ ...i })));
    m.focusId('c');
    m.setItems([item('c', 0, 0), item('a', 0, 30)]);
    expect(m.focused?.id).toBe('c');
  });
});

describe('logo', () => {
  it('builds a mask from the ui font and scales it', () => {
    const m = textMask('I');
    expect(m.bits.some((b) => b === 1)).toBe(true);
    const b = embolden(m, false);
    expect(b.w).toBe(m.w + 1);
    const s = scaleMask(b, 3, 5);
    expect([s.w, s.h]).toEqual([b.w * 3, b.h * 5]);
  });

  it('outlines and extrudes the lettering', () => {
    const p = buildLogoLine('AB', 2, 3, LOGO_GOLD);
    expect(p.px.length).toBe(p.w * p.h);
    expect(p.px).toContain(LOGO_GOLD.outline);
    expect(p.px).toContain(LOGO_GOLD.extrude[0]);
    expect(p.px).toContain(LOGO_GOLD.face[0]);
    // Corners stay transparent.
    expect(p.px[0]).toBeNull();
  });
});

describe('debug saves', () => {
  it.each(['fresh', 'mid', 'all'] as const)('%s survives normalization unchanged', (id) => {
    const s = debugSave(id);
    expect(normalize(JSON.parse(JSON.stringify(s)) as Record<string, unknown>)).toEqual(s);
  });
});

describe('results', () => {
  it('floors fractional run salvage before banking', () => {
    const save = debugSave('fresh');
    const run = createRunState('SEED', 'kestrel', 'blastroid', 'kessler');
    run.salvage = 10.9;
    run.score = 500;
    run.pilotsRescued.push('juno');
    run.schematics.push('bulwark');
    const b = bankFinishedRun(save, run, false);
    // Blastroid has no salvage bonus.
    expect(b.salvageEarned).toBe(10);
    expect(b.save.salvage).toBe(10);
    const lines = discoveryLines(b.discoveries);
    expect(lines.map((l) => l.label)).toEqual([
      'SCHEMATIC FOUND',
      'PILOT RESCUED',
      'NEW HIGH SCORE!',
    ]);
    expect(lines[1]?.value).toBe('Juno Sparks');
  });

  it('formats time as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(209.7)).toBe('3:29');
  });
});

describe('settings', () => {
  const music = SLIDERS[0] as (typeof SLIDERS)[number];

  it('snaps and clamps slider values', () => {
    expect(snapSetting(music, 0.35 - 0.05)).toBe(0.3);
    expect(snapSetting(music, 1.2)).toBe(1);
    expect(snapSetting(music, -1)).toBe(0);
    const size = SLIDERS.find((s) => s.key === 'stickRadiusScale');
    if (size) expect(snapSetting(size, 1.04)).toBe(1);
  });

  it('cycles screen shake both ways', () => {
    expect(cycleShake('full', 1)).toBe('off');
    expect(cycleShake('off', -1)).toBe('full');
  });
});

describe('misc', () => {
  it('maps WASD to nav directions', () => {
    expect(wasdNav('KeyW')).toEqual([0, -1]);
    expect(wasdNav('KeyD')).toEqual([1, 0]);
    expect(wasdNav('KeyQ')).toBeNull();
  });

  it('wraps text to a pixel width', () => {
    const lines = wrapText('Hotshot mechanic. Overclocks anything with a trigger.', 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('Hotshot mechanic. Overclocks anything with a trigger.');
  });
});
