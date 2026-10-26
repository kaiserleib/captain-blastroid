import { describe, expect, it } from 'vitest';
import { arrowNav, keyAction, KeyState, keyVector } from './keyboard';

describe('keyVector', () => {
  const out = { x: 0, y: 0 };

  it('gives unit cardinal vectors', () => {
    keyVector(false, true, false, false, out);
    expect(out).toEqual({ x: 1, y: 0 });
    keyVector(false, false, true, false, out);
    expect(out).toEqual({ x: 0, y: -1 });
  });

  it('normalizes diagonals', () => {
    keyVector(true, false, false, true, out);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
    expect(out.x).toBeLessThan(0);
    expect(out.y).toBeGreaterThan(0);
  });

  it('cancels opposing keys', () => {
    keyVector(true, true, true, false, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBe(-1);
  });
});

describe('KeyState', () => {
  it('maps arrows and WASD to the same directions', () => {
    const k = new KeyState();
    const out = { x: 0, y: 0 };
    k.set('KeyW', true);
    k.set('ArrowRight', true);
    k.vector(out);
    expect(out.x).toBeCloseTo(Math.SQRT1_2);
    expect(out.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('keeps moving while the other key for a direction is still held', () => {
    const k = new KeyState();
    const out = { x: 0, y: 0 };
    k.set('KeyA', true);
    k.set('ArrowLeft', true);
    k.set('KeyA', false);
    k.vector(out);
    expect(out.x).toBe(-1);
    k.set('ArrowLeft', false);
    expect(k.anyHeld).toBe(false);
  });

  it('clear() drops everything', () => {
    const k = new KeyState();
    k.set('KeyS', true);
    k.clear();
    expect(k.anyHeld).toBe(false);
  });
});

describe('key classification', () => {
  it('classifies actions', () => {
    expect(keyAction('KeyD')).toBe('move');
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('KeyP')).toBe('pause');
    expect(keyAction('Enter')).toBe('confirm');
    expect(keyAction('Space')).toBe('confirm');
    expect(keyAction('KeyQ')).toBeNull();
  });

  it('only arrows navigate menus', () => {
    const out = { x: 0, y: 0 };
    expect(arrowNav('ArrowDown', out)).toBe(true);
    expect(out).toEqual({ x: 0, y: 1 });
    expect(arrowNav('KeyS', out)).toBe(false);
  });
});
