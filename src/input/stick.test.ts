import { describe, expect, it } from 'vitest';
import { createStick, stickDown, stickMove, stickRelease } from './stick';

const R = 40;
const DZ = 6;

describe('stick', () => {
  it('spawns the base under the finger with zero deflection', () => {
    const s = createStick();
    stickDown(s, 3, 100, 200);
    expect(s).toMatchObject({ active: true, pointerId: 3, baseX: 100, baseY: 200, x: 0, y: 0 });
  });

  it('ignores movement inside the deadzone', () => {
    const s = createStick();
    stickDown(s, 1, 100, 100);
    stickMove(s, 104, 103, R, DZ);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
    expect(s.knobX).toBe(104);
  });

  it('scales deflection with offset, rescaled past the deadzone', () => {
    const s = createStick();
    stickDown(s, 1, 100, 100);
    stickMove(s, 100 + DZ + (R - DZ) / 2, 100, R, DZ);
    expect(s.x).toBeCloseTo(0.5);
    expect(s.y).toBe(0);
    stickMove(s, 100, 100 - R, R, DZ);
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(-1);
  });

  it('keeps direction for diagonal offsets', () => {
    const s = createStick();
    stickDown(s, 1, 0, 0);
    stickMove(s, 20, 20, R, DZ);
    expect(s.x).toBeCloseTo(s.y);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo((Math.hypot(20, 20) - DZ) / (R - DZ));
  });

  it('tows the base past the rim and clamps deflection to 1', () => {
    const s = createStick();
    stickDown(s, 1, 100, 100);
    stickMove(s, 200, 100, R, DZ);
    expect(s.baseX).toBeCloseTo(160);
    expect(s.baseY).toBeCloseTo(100);
    expect(s.knobX).toBe(200);
    expect(s.x).toBeCloseTo(1);
    // Reversing now responds from the towed base, not the original touch point.
    stickMove(s, 160 - 20, 100, R, DZ);
    expect(s.baseX).toBeCloseTo(160);
    expect(s.x).toBeLessThan(0);
  });

  it('release zeroes and hides', () => {
    const s = createStick();
    stickDown(s, 1, 0, 0);
    stickMove(s, 30, 0, R, DZ);
    stickRelease(s);
    expect(s).toMatchObject({ active: false, pointerId: -1, x: 0, y: 0 });
  });
});
