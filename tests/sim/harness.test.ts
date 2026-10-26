import { describe, expect, it } from 'vitest';
import { GAME_SYSTEMS, PRESENTATION_SYSTEMS } from './harness';
import src from '../../src/scenes/GameScene.ts?raw';

describe('harness', () => {
  it("runs GameScene's systems in GameScene's order", () => {
    const m = /readonly systems: System\[\] = \[([\s\S]*?)\];/.exec(src);
    expect(m, 'GameScene.systems array not found').not.toBeNull();
    const entries = m![1]!
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .flatMap((l) => l.split(','))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const sim = entries.filter((e) => !PRESENTATION_SYSTEMS.includes(e));
    expect(sim).toEqual(Object.keys(GAME_SYSTEMS));
  });

  it('imports the sim without a DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });
});
