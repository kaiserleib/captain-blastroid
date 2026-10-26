import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';

interface TestEvents {
  hit: { damage: number };
  done: Record<string, never>;
}

describe('EventBus', () => {
  it('delivers payloads synchronously to listeners of that type', () => {
    const bus = new EventBus<TestEvents>();
    const hit = vi.fn();
    const done = vi.fn();
    bus.on('hit', hit);
    bus.on('done', done);
    bus.emit('hit', { damage: 3 });
    expect(hit).toHaveBeenCalledWith({ damage: 3 });
    expect(done).not.toHaveBeenCalled();
  });

  it('off and the returned unsubscribe remove listeners', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('hit', a);
    const unsubB = bus.on('hit', b);
    bus.off('hit', a);
    unsubB();
    bus.emit('hit', { damage: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('changes made during dispatch apply from the next emit', () => {
    const bus = new EventBus<TestEvents>();
    const late = vi.fn();
    const second = vi.fn();
    bus.on('hit', () => {
      bus.off('hit', second);
      bus.on('hit', late);
    });
    bus.on('hit', second);
    bus.emit('hit', { damage: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
    bus.emit('hit', { damage: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('clear removes one type or everything', () => {
    const bus = new EventBus<TestEvents>();
    const hit = vi.fn();
    const done = vi.fn();
    bus.on('hit', hit);
    bus.on('done', done);
    bus.clear('hit');
    bus.emit('hit', { damage: 1 });
    bus.emit('done', {});
    expect(hit).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
    bus.clear();
    bus.emit('done', {});
    expect(done).toHaveBeenCalledTimes(1);
  });
});
