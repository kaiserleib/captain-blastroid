import { describe, expect, it } from 'vitest';
import { createWorld } from '../../sim/world';
import { finishRunRecord, startRunRecord } from './recorder';

describe('run recorder', () => {
  it('splits hits by phase and times the boss fight', () => {
    const w = createWorld('rl', { levelId: 'kessler' });
    startRunRecord(w);
    w.events.emit('playerHit', { shieldLeft: 2 });
    w.time = 150;
    w.events.emit('bossSpawned', { defId: 'rockHauler' });
    w.events.emit('playerHit', { shieldLeft: 1 });
    w.time = 210;
    w.events.emit('bossDefeated', { defId: 'rockHauler', x: 0, y: 0 });
    w.events.emit('escapeStarted', { dur: 40 });
    w.events.emit('playerHit', { shieldLeft: 0 });
    w.time = 250;
    const e = finishRunRecord({ outcome: 'clear', salvage: 300 });
    expect(e).toMatchObject({
      level: 'kessler',
      outcome: 'clear',
      time: 250,
      bossAt: 150,
      bossTime: 60,
      salvage: 300,
      deathCause: null,
      hits: { 'level:?': 1, 'boss:?': 1, 'escape:?': 1 },
    });
    expect(finishRunRecord({ outcome: 'clear', salvage: 0 })).toBeNull();
  });

  it('names the killing hit and counts a fight still going at the end', () => {
    const w = createWorld('rl2', { levelId: 'kessler' });
    startRunRecord(w);
    w.time = 100;
    w.events.emit('bossSpawned', { defId: 'rockHauler' });
    w.time = 130;
    w.events.emit('playerHit', { shieldLeft: 0 });
    w.events.emit('playerDied', {});
    const e = finishRunRecord({ outcome: 'death', salvage: 50 });
    expect(e?.deathCause).toBe('?');
    expect(e?.bossTime).toBe(30);
  });
});
