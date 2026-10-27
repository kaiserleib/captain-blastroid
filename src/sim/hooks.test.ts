import { afterEach, describe, expect, it } from 'vitest';
import {
  clearHooks,
  isSolidAt,
  raycastSolid,
  registerSolidQuery,
  registerTimeScale,
  timeScaleAt,
  type RayHit,
} from './hooks';
import { createWorld } from './world';

afterEach(clearHooks);

describe('Act II hooks', () => {
  it('default to open space and normal time', () => {
    const w = createWorld('hooks');
    const hit: RayHit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };
    expect(isSolidAt(w, 10, 10)).toBe(false);
    expect(raycastSolid(w, 0, 0, 100, 100, hit)).toBe(false);
    expect(timeScaleAt(w, 10, 10)).toBe(1);
    expect(w.enemyBulletTimeScale).toBe(1);
  });

  it('use the registered query and scale until unregistered', () => {
    const w = createWorld('hooks');
    const offSolid = registerSolidQuery({
      isSolidAt: (_w, x) => x < 8,
      raycastSolid: (_w, _x0, _y0, _x1, _y1, out) => {
        out.nx = 1;
        return true;
      },
    });
    const offScale = registerTimeScale(() => 0.35);
    const hit: RayHit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };
    expect(isSolidAt(w, 4, 0)).toBe(true);
    expect(raycastSolid(w, 20, 0, 0, 0, hit)).toBe(true);
    expect(hit.nx).toBe(1);
    expect(timeScaleAt(w, 0, 0)).toBe(0.35);
    offSolid();
    offScale();
    expect(isSolidAt(w, 4, 0)).toBe(false);
    expect(timeScaleAt(w, 0, 0)).toBe(1);
  });
});
