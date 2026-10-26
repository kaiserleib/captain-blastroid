import { afterEach, describe, expect, it } from 'vitest';
import { clearHooks, registerTargetFilter } from './hooks';
import { spawnEnemy } from './spawn';
import { isTargetable } from './targeting';
import type { Enemy } from './types';
import { createWorld } from './world';

afterEach(() => clearHooks());

describe('isTargetable', () => {
  it('always allows roster enemies, never zero-HP boss armor', () => {
    const w = createWorld('tgt');
    const e = spawnEnemy(w, 'dummy', 50, 50) as Enemy;
    const armor = spawnEnemy(w, 'dummy', 60, 50, { isBoss: true, hp: 0 }) as Enemy;
    expect(isTargetable(w, e)).toBe(true);
    expect(isTargetable(w, armor)).toBe(false);
  });

  it('asks registered filters about boss parts only', () => {
    const w = createWorld('tgt2');
    const e = spawnEnemy(w, 'dummy', 50, 50) as Enemy;
    const core = spawnEnemy(w, 'dummy', 60, 50, { isBoss: true, hp: 20 }) as Enemy;
    let open = false;
    registerTargetFilter(() => open);
    expect(isTargetable(w, e)).toBe(true);
    expect(isTargetable(w, core)).toBe(false);
    open = true;
    expect(isTargetable(w, core)).toBe(true);
  });
});
