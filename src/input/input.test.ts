import { afterEach, describe, expect, it } from 'vitest';
import type { MoveIntent } from '../sim/types';
import { createWorld } from '../sim/world';
import { InputManager, type UiEvent } from './input';
import { cssLengthToLogical, type PointerMapper } from './pointer';
import { DEFAULT_INPUT_SETTINGS, setInputSettingsProvider } from './settings';

// 2 CSS px per logical px, with a 20 px top HUD band.
const OFFSET = 20;
const mapper: PointerMapper = {
  toLogical: (x, y, out) => {
    out.x = x / 2;
    out.y = y / 2;
    return out;
  },
  playfieldOffsetY: () => OFFSET,
  cssLength: (px) => px / 2,
};

function make(): { im: InputManager; intent: MoveIntent } {
  const im = new InputManager();
  im.setMapper(mapper);
  return { im, intent: { x: 0, y: 0, targetX: null, targetY: null } };
}

afterEach(() => setInputSettingsProvider(() => DEFAULT_INPUT_SETTINGS));

describe('InputManager modes', () => {
  it('keys give a direction with no target', () => {
    const { im, intent } = make();
    im.handleKey('ArrowLeft', true, false);
    im.writeIntent(intent);
    expect(im.mode).toBe('keys');
    expect(intent).toEqual({ x: -1, y: 0, targetX: null, targetY: null });
  });

  it('mouse movement switches to mouse and targets playfield coords', () => {
    const { im, intent } = make();
    im.handleKey('ArrowLeft', true, false);
    im.handlePointer('move', 1, 'mouse', 200, 300);
    im.writeIntent(intent);
    expect(im.mode).toBe('mouse');
    expect(intent).toEqual({ x: 0, y: 0, targetX: 100, targetY: 150 - OFFSET });
  });

  it('clamps the mouse target to the playfield', () => {
    const { im, intent } = make();
    im.handlePointer('move', 1, 'mouse', -50, 5);
    im.writeIntent(intent);
    expect(intent.targetX).toBe(0);
    expect(intent.targetY).toBe(0);
  });

  it('a key press takes over until the mouse moves again', () => {
    const { im, intent } = make();
    im.handlePointer('move', 1, 'mouse', 200, 300);
    im.handleKey('KeyD', true, false);
    // A zero-distance move (layout/scroll) must not switch back.
    im.handlePointer('move', 1, 'mouse', 200, 300);
    im.writeIntent(intent);
    expect(im.mode).toBe('keys');
    expect(intent.x).toBe(1);
    im.handlePointer('move', 1, 'mouse', 202, 300);
    expect(im.mode).toBe('mouse');
  });

  it('mouse leaving the canvas stops the ship', () => {
    const { im, intent } = make();
    im.handlePointer('move', 1, 'mouse', 200, 300);
    im.handleMouseLeave();
    im.writeIntent(intent);
    expect(intent).toEqual({ x: 0, y: 0, targetX: null, targetY: null });
  });

  it('touch spawns the stick in playfield coords and captures the pointer', () => {
    const { im, intent } = make();
    expect(im.handlePointer('down', 7, 'touch', 200, 400)).toBe(true);
    expect(im.mode).toBe('touch');
    expect(im.stick).toMatchObject({ active: true, baseX: 100, baseY: 200 - OFFSET });
    // Radius 40 CSS = 20 logical; move 20 logical right -> full deflection.
    im.handlePointer('move', 7, 'touch', 240, 400);
    im.writeIntent(intent);
    expect(intent.x).toBeCloseTo(1);
    expect(intent.targetX).toBeNull();
    im.handlePointer('up', 7, 'touch', 240, 400);
    im.writeIntent(intent);
    expect(im.stick.active).toBe(false);
    expect(intent.x).toBe(0);
  });

  it('secondary touches do not move the stick but still reach the UI', () => {
    const { im } = make();
    const seen: number[] = [];
    im.onPointer = (e) => seen.push(e.id);
    im.handlePointer('down', 1, 'touch', 100, 100);
    expect(im.handlePointer('down', 2, 'touch', 300, 300)).toBe(false);
    im.handlePointer('move', 2, 'touch', 400, 400);
    im.handlePointer('up', 2, 'touch', 400, 400);
    expect(im.stick).toMatchObject({ active: true, pointerId: 1, x: 0, y: 0 });
    expect(seen).toEqual([1, 2, 2, 2]);
  });

  it('forwards pointers to scenes in logical buffer coords', () => {
    const { im } = make();
    let y = -1;
    im.onPointer = (e) => (y = e.y);
    im.handlePointer('down', 1, 'mouse', 10, 100);
    expect(y).toBe(50);
  });

  it('reads the stick radius scale from settings', () => {
    const { im, intent } = make();
    setInputSettingsProvider(() => ({ stickOpacity: 0.5, stickRadiusScale: 2 }));
    im.handlePointer('down', 1, 'touch', 0, 0);
    im.handlePointer('move', 1, 'touch', 40, 0);
    im.writeIntent(intent);
    // Radius is now 40 logical; 20 logical out is (20-3)/(40-3).
    expect(intent.x).toBeCloseTo(17 / 37);
  });

  it('clear() drops keys, stick and hover', () => {
    const { im, intent } = make();
    im.handleKey('KeyW', true, false);
    im.clear();
    im.writeIntent(intent);
    expect(intent.y).toBe(0);
    im.handlePointer('down', 1, 'touch', 0, 0);
    im.clear();
    expect(im.stick.active).toBe(false);
  });
});

describe('InputManager UI keys', () => {
  it('pause is edge-triggered and emits pauseRequested from the system', () => {
    const { im } = make();
    const w = createWorld('t');
    let pauses = 0;
    w.events.on('pauseRequested', () => pauses++);
    expect(im.handleKey('Escape', true, false)).toBe(true);
    im.handleKey('Escape', true, true);
    im.system.update(w, 1 / 60);
    im.system.update(w, 1 / 60);
    expect(pauses).toBe(1);
  });

  it('drops a pause no game tick consumed', () => {
    const { im } = make();
    im.handleKey('KeyP', true, false);
    im.endTick();
    expect(im.consumePause()).toBe(false);
  });

  it('reports confirm and arrow navigation', () => {
    const { im } = make();
    const seen: string[] = [];
    im.onUi = (e: UiEvent) => seen.push(e.kind === 'nav' ? `nav${e.dx},${e.dy}` : e.kind);
    im.handleKey('Enter', true, false);
    im.handleKey('Space', true, true);
    im.handleKey('ArrowUp', true, false);
    im.handleKey('ArrowUp', true, true);
    im.handleKey('KeyW', true, false);
    im.handleKey('Escape', true, false);
    expect(seen).toEqual(['confirm', 'nav0,-1', 'nav0,-1', 'pause']);
  });

  it('ignores unrelated keys so the page keeps them', () => {
    const { im } = make();
    expect(im.handleKey('KeyQ', true, false)).toBe(false);
  });
});

describe('cssLengthToLogical', () => {
  it('converts via dpr and the buffer scale', () => {
    // 390 CSS px wide phone at dpr 3, buffer drawn 1170 device px wide.
    expect(cssLengthToLogical({ dpr: 3, logicalW: 240, destW: 1170 }, 40)).toBeCloseTo(24.6, 1);
  });
});
