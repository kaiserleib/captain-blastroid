import { describe, expect, it } from 'vitest';
import {
  bossHomeLevel,
  GAUNTLET_DEN,
  GAUNTLET_ROUNDS,
  GAUNTLET_TERRAIN,
  getLevel,
  roundStarts,
  ROUND_GAP,
} from '../../../content/levels';
import { createWorld } from '../../../sim/world';
import { SONG_IDS } from '../../../audio/songs';
import {
  activeBoss,
  attachBoss,
  bossDamageScale,
  bossRegistration,
  spawnBoss,
  setBossToughness,
  updateBoss,
} from '../../boss';
import { stageLayers, stageSystems } from '../../director';
import { enemyHpMul, enemyShotSpeedMul } from '../../enemies';
import { validateSequence } from '../../terrain';
import '../index';
import { roundScript } from './index';

const LEVEL = getLevel('gauntlet');

describe('gauntlet content', () => {
  it('summons every round boss in order; only the last one ends the run', () => {
    const bosses = LEVEL.timeline.filter((e) => 'boss' in e);
    expect(bosses.map((e) => 'boss' in e && e.boss)).toEqual(GAUNTLET_ROUNDS.map((r) => r.boss));
    bosses.forEach((e, i) => {
      const last = i === bosses.length - 1;
      expect('boss' in e && e.continue === true, `round ${i + 1}`).toBe(!last);
      expect('boss' in e && e.salvage).toBe(GAUNTLET_ROUNDS[i]!.salvage);
    });
    for (const r of GAUNTLET_ROUNDS) {
      expect(bossRegistration(r.boss), r.boss).toBeDefined();
      expect(bossHomeLevel(r.boss)?.id, r.boss).toBe(r.home);
      expect(SONG_IDS).toContain(getLevel(r.home).music);
      expect(LEVEL.hostLevels).toContain(r.home);
    }
  });

  it('times each round from the frozen clock: waves, then the boss, then a gap', () => {
    const starts = roundStarts();
    GAUNTLET_ROUNDS.forEach((r, i) => {
      const boss = LEVEL.timeline.find((e) => 'boss' in e && e.boss === r.boss)!;
      expect(boss.t).toBeCloseTo(starts[i]! + r.waves);
      if (i > 0)
        expect(starts[i]).toBeCloseTo(starts[i - 1]! + GAUNTLET_ROUNDS[i - 1]!.waves + ROUND_GAP);
      // Nothing of a round fires after its boss.
      const next = starts[i + 1] ?? Infinity;
      const late = LEVEL.timeline.filter((e) => e.t > boss.t && e.t < next);
      expect(late, `round ${i + 1}`).toEqual([]);
    });
  });

  it("runs the Warrens stretch into the den only in the Wyrm's round, then restarts the scroll", () => {
    expect(validateSequence([...GAUNTLET_TERRAIN, GAUNTLET_DEN])).toEqual([]);
    const i = GAUNTLET_ROUNDS.findIndex((r) => r.terrainAt !== undefined);
    expect(GAUNTLET_ROUNDS[i]!.boss).toBe('wr_wyrm');
    expect(GAUNTLET_ROUNDS.filter((r) => r.terrainAt !== undefined)).toHaveLength(1);
    const chunks = LEVEL.timeline
      .filter((e) => 'terrain' in e)
      .map((e) => 'terrain' in e && e.terrain.chunk);
    expect(chunks).toEqual([...GAUNTLET_TERRAIN, GAUNTLET_DEN, '@clear']);
    const mark = LEVEL.timeline.find((e) => 'script' in e && e.script === 'warrens.mark');
    expect(mark && 'script' in mark && mark.args).toEqual({ chunk: GAUNTLET_DEN });
    const nextStart = roundStarts()[i + 1]!;
    const resume = LEVEL.timeline.find((e) => 'scroll' in e && e.t >= nextStart);
    expect(resume && 'scroll' in resume && resume.scroll.to).toBe(LEVEL.scrollSpeed);
    // No rocks in the tunnels.
    const wyrmT = roundStarts()[i]! + GAUNTLET_ROUNDS[i]!.terrainAt!;
    for (const seg of LEVEL.asteroidField) expect(seg.from >= wyrmT || seg.to <= wyrmT).toBe(true);
  });

  it("hosts its bosses' sector systems and layers", () => {
    const sys = stageSystems(LEVEL);
    const layers = stageLayers(LEVEL);
    for (const id of LEVEL.hostLevels ?? []) {
      for (const s of stageSystems({ id })) expect(sys).toContain(s);
      for (const l of stageLayers({ id })) expect(layers).toContain(l);
    }
    expect(stageSystems({ id: 'warrens' })).not.toBe(sys);
  });
});

describe('gauntlet.round', () => {
  it('sets the round escalation and asks for the home music', () => {
    const w = createWorld('G', { levelId: 'gauntlet' });
    const songs: string[] = [];
    const toasts: string[] = [];
    w.events.on('songRequested', (e) => songs.push(e.id));
    w.events.on('toast', (e) => toasts.push(e.text));
    roundScript(w, { round: 3, of: 8, hp: 1.6, shot: 1.15, tough: 2, home: 'pulsarNursery' });
    expect(enemyHpMul(w)).toBe(1.6);
    expect(enemyShotSpeedMul(w)).toBe(1.15);
    expect(songs).toEqual(['pulsar']);
    expect(toasts).toEqual(['ROUND 3 OF 8']);
    roundScript(w, { round: 8, of: 8, home: 'foundry' });
    expect(toasts.at(-1)).toBe('FINAL ROUND');
  });
});

describe('boss toughness and queued requests', () => {
  it('divides player damage on boss parts by the toughness', () => {
    const w = createWorld('G', { levelId: 'gauntlet' });
    const boss = spawnBoss(w, 'rock_hauler')!;
    const part = boss.rig.slots[0]!.enemy!;
    expect(bossDamageScale(w, part)).toBe(1);
    setBossToughness(w, 2);
    expect(bossDamageScale(w, part)).toBe(0.5);
  });

  it('holds a request until the last boss is gone', () => {
    const w = createWorld('G', { levelId: 'gauntlet' });
    attachBoss(w);
    const first = spawnBoss(w, 'rock_hauler')!;
    w.events.emit('bossRequested', { defId: 'ion_shepherd' });
    updateBoss(w, 1 / 60);
    expect(activeBoss(w)).toBe(first);
    // Its death throes end.
    Object.defineProperty(first, 'done', { get: () => true });
    updateBoss(w, 1 / 60);
    updateBoss(w, 1 / 60);
    expect(activeBoss(w)?.defId).toBe('ion_shepherd');
  });
});
