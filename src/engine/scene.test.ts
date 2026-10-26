import { describe, expect, it } from 'vitest';
import type { Renderer } from '../gfx/renderer';
import { SceneManager, type Scene } from './scene';

function scene(name: string, log: string[]): Scene {
  return {
    enter: () => log.push(`${name}:enter`),
    exit: () => log.push(`${name}:exit`),
    update: () => log.push(`${name}:update`),
    render: () => log.push(`${name}:render`),
  };
}

describe('SceneManager', () => {
  it('push overlays, pop returns, replace clears the stack', () => {
    const log: string[] = [];
    const sm = new SceneManager();
    const r = {} as Renderer;
    sm.replace(scene('game', log));
    sm.push(scene('pause', log));
    sm.update(1 / 60);
    sm.render(r, 0);
    expect(log).toEqual([
      'game:enter',
      'pause:enter',
      'pause:update',
      'game:render',
      'pause:render',
    ]);
    log.length = 0;
    sm.pop();
    sm.update(1 / 60);
    expect(log).toEqual(['pause:exit', 'game:update']);
    log.length = 0;
    sm.push(scene('pause', log));
    sm.replace(scene('title', log));
    expect(log).toEqual(['pause:enter', 'pause:exit', 'game:exit', 'title:enter']);
    expect(sm.depth).toBe(1);
  });
});
