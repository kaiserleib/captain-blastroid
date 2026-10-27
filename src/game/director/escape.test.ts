import { describe, expect, it } from 'vitest';
import { getLevel, type LevelDef } from '../../content/levels';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { damagePlayer } from '../../sim/damage';
import { createWorld, type World } from '../../sim/world';
import { initPlayer } from '../player';
import {
  ESCAPE_TOAST,
  OUTRO,
  escapeBonus,
  escapeTimeLeft,
  getDirector,
  startDirector,
  updateDirector,
} from './director';
import { registerLevelScript } from './registry';

const DT = 1 / 60;

const ESCAPE_LEVEL: LevelDef = {
  ...getLevel('kessler'),
  id: 'escapeTest',
  asteroidField: [],
  timeline: [],
  schematicOnClear: [],
  bossSalvage: 0,
  escape: { dur: 4, scrollTo: 90, over: 2, bonus: 100, bonusPerHit: 20, script: 'test.escape' },
};

let scriptRuns = 0;
registerLevelScript('test.escape', () => void scriptRuns++);

interface Probe {
  toasts: string[];
  escapeDur: number[];
  hits: number;
  runOver: boolean[];
  levelComplete: number;
}

function setup(level: LevelDef = ESCAPE_LEVEL): { w: World; p: Probe } {
  const w = createWorld('escape');
  initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid'));
  w.scrollSpeed = level.scrollSpeed;
  startDirector(w, level);
  const p: Probe = { toasts: [], escapeDur: [], hits: 0, runOver: [], levelComplete: 0 };
  w.events.on('toast', (e) => void p.toasts.push(e.text));
  w.events.on('escapeStarted', (e) => void p.escapeDur.push(e.dur));
  w.events.on('playerHit', () => void p.hits++);
  w.events.on('runOver', (e) => void p.runOver.push(e.victory));
  w.events.on('levelComplete', () => void p.levelComplete++);
  return { w, p };
}

function step(w: World, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    updateDirector(w, DT);
  }
}

function hit(w: World): boolean {
  w.player.invulnT = 0;
  return damagePlayer(w, 1);
}

function defeatBoss(w: World): void {
  w.events.emit('bossDefeated', { defId: 'rock_hauler', x: 120, y: 80 });
}

describe('escape phase', () => {
  it('starts on boss defeat: event, toast, scroll ramp and script', () => {
    const { w, p } = setup();
    const runs = scriptRuns;
    defeatBoss(w);
    const st = getDirector(w)!;
    expect(st.phase).toBe('escape');
    expect(p.escapeDur).toEqual([4]);
    expect(p.toasts).toContain(ESCAPE_TOAST);
    expect(scriptRuns).toBe(runs + 1);
    expect(w.run.bossDefeated).toBe(true);
    step(w, 1);
    expect(w.scrollSpeed).toBeGreaterThan(ESCAPE_LEVEL.scrollSpeed);
    expect(w.scrollSpeed).toBeLessThan(90);
    step(w, 1.1);
    expect(w.scrollSpeed).toBe(90);
    expect(escapeTimeLeft(w)).toBeCloseTo(4 - 2.1, 1);
  });

  it('keeps the last shield: hits flash and count, but never kill', () => {
    const { w, p } = setup();
    defeatBoss(w);
    w.player.shield = 2;
    expect(hit(w)).toBe(true);
    expect(w.player.shield).toBe(1);
    expect(hit(w)).toBe(true);
    expect(hit(w)).toBe(true);
    expect(w.player.shield).toBe(1);
    expect(w.player.alive).toBe(true);
    expect(w.player.invulnT).toBeGreaterThan(0);
    // Entering the escape with no pips left still can't die.
    w.player.shield = 0;
    expect(hit(w)).toBe(true);
    expect(w.player.alive).toBe(true);
    expect(w.player.shield).toBe(0);
    expect(p.hits).toBe(4);
    expect(getDirector(w)!.escape.hits).toBe(4);
  });

  it('pays bonus − perHit × hits when the countdown ends, then wins', () => {
    const { w, p } = setup();
    defeatBoss(w);
    hit(w);
    hit(w);
    const before = w.run.salvage;
    step(w, 3.9);
    expect(getDirector(w)!.phase).toBe('escape');
    expect(p.runOver).toEqual([]);
    step(w, 0.2);
    expect(getDirector(w)!.phase).toBe('outro');
    expect(escapeTimeLeft(w)).toBe(-1);
    expect(w.run.salvage - before).toBe(60);
    expect(p.toasts).toContain('ESCAPE BONUS +60');
    step(w, OUTRO.runOverAt - OUTRO.magnetAt + 0.1);
    expect(p.levelComplete).toBe(1);
    expect(p.runOver).toEqual([true]);
    expect(getDirector(w)!.phase).toBe('done');
    // The guard holds through the outro.
    w.player.shield = 1;
    hit(w);
    expect(w.player.alive).toBe(true);
  });

  it('never pays below zero', () => {
    const def = ESCAPE_LEVEL.escape!;
    expect(escapeBonus(def, 0)).toBe(100);
    expect(escapeBonus(def, 5)).toBe(0);
    expect(escapeBonus(def, 9)).toBe(0);
  });

  it('leaves levels without an escape alone', () => {
    const { w, p } = setup(getLevel('kessler'));
    w.player.shield = 0;
    expect(hit(w)).toBe(true);
    expect(w.player.alive).toBe(false);
    defeatBoss(w);
    expect(getDirector(w)!.phase).toBe('outro');
    expect(p.escapeDur).toEqual([]);
  });

  it('the Foundry stub carries the design escape', () => {
    expect(getLevel('foundry').escape).toEqual({
      dur: 40,
      scrollTo: 90,
      over: 6,
      bonus: 100,
      bonusPerHit: 20,
    });
  });
});
