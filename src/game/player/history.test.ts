import { describe, expect, it } from 'vitest';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { createWorld } from '../../sim/world';
import { createHistory, pushHistory, sampleHistory } from './history';
import { initPlayer, playerPastPos, updatePlayer } from './playerSystem';

const DT = 1 / 60;

describe('position history', () => {
  it('holds 10 s at the fixed step plus the current sample', () => {
    expect(createHistory().xs.length).toBe(601);
  });

  it('is empty until the first push', () => {
    const out = { x: -1, y: -1 };
    expect(sampleHistory(createHistory(), 0, out)).toBe(false);
    expect(out).toEqual({ x: -1, y: -1 });
  });

  it('returns exact samples on tick boundaries and interpolates between them', () => {
    const h = createHistory(1, 0.1);
    for (let i = 0; i <= 5; i++) pushHistory(h, i * 10, 100 - i);
    const out = { x: 0, y: 0 };
    sampleHistory(h, 0, out);
    expect(out).toEqual({ x: 50, y: 95 });
    sampleHistory(h, 0.2, out);
    expect(out.x).toBeCloseTo(30);
    expect(out.y).toBeCloseTo(97);
    sampleHistory(h, 0.25, out);
    expect(out.x).toBeCloseTo(25);
    expect(out.y).toBeCloseTo(97.5);
  });

  it('clamps before the buffer has filled: older asks return the first sample', () => {
    const h = createHistory(1, 0.1);
    pushHistory(h, 7, 8);
    pushHistory(h, 9, 10);
    const out = { x: 0, y: 0 };
    sampleHistory(h, 0.5, out);
    expect(out).toEqual({ x: 7, y: 8 });
    sampleHistory(h, -1, out);
    expect(out).toEqual({ x: 9, y: 10 });
  });

  it('wraps: after overflow the oldest kept sample is exactly `seconds` back', () => {
    const h = createHistory(1, 0.1); // 11 slots
    for (let i = 0; i < 37; i++) pushHistory(h, i, -i);
    const out = { x: 0, y: 0 };
    sampleHistory(h, 0, out);
    expect(out).toEqual({ x: 36, y: -36 });
    sampleHistory(h, 1, out);
    expect(out.x).toBeCloseTo(26);
    sampleHistory(h, 5, out);
    expect(out.x).toBeCloseTo(26);
    sampleHistory(h, 0.35, out);
    expect(out.x).toBeCloseTo(32.5);
    expect(out.y).toBeCloseTo(-32.5);
  });
});

describe('playerPastPos', () => {
  it('replays where the ship flew, ticked by the player system', () => {
    const w = createWorld('HIST', { shipId: 'kestrel', pilotId: 'blastroid' });
    initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid'));
    const out = { x: 0, y: 0 };
    expect(playerPastPos(w, 3, out)).toEqual({ x: w.player.x, y: w.player.y });
    const xs: number[] = [];
    w.input.x = 1;
    for (let i = 0; i < 12 * 60; i++) {
      if (i === 3 * 60) w.input.x = -1;
      if (i === 6 * 60) w.input.x = 0;
      updatePlayer(w, DT);
      xs.push(w.player.x);
    }
    const now = xs.length - 1;
    for (const ago of [0, 1, 2.5, 7, 9.99]) {
      playerPastPos(w, ago, out);
      expect(out.x).toBeCloseTo(xs[now - Math.round(ago * 60)] as number, 3);
    }
    // Past 10 s it holds at the 10 s sample.
    playerPastPos(w, 20, out);
    expect(out.x).toBeCloseTo(xs[now - 600] as number, 6);
  });
});
