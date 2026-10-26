import { afterEach, describe, expect, it } from 'vitest';
import { LEVEL1, getLevel, levelIdForNumber, levelSummary } from '../../content/levels';
import { createRng } from '../../engine/rng';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { bulletsSystem } from '../../sim/motion';
import type { Pickup } from '../../sim/types';
import { createWorld, type System, type World } from '../../sim/world';
import { enemySystem } from '../enemies';
import { activeAsteroidStreams, obstaclesSystem } from '../obstacles';
import { attachPickups, pickupsSystem } from '../pickups';
import { initPlayer, playerSystem, setGodMode } from '../player';
import { weaponSystem } from '../weapons';
import { DEBUG_LOADOUT, OUTRO, getDirector, startDirector, updateDirector } from './director';
import {
  buildSchedule,
  fieldRate,
  firstFireAt,
  formationHalfWidth,
  pickSchematic,
  resolveX,
  segmentRate,
} from './timeline';

const DT = 1 / 60;

const SYSTEMS: System[] = [
  playerSystem,
  weaponSystem,
  enemySystem,
  bulletsSystem,
  obstaclesSystem,
  pickupsSystem,
  collisionSystem,
  cleanupSystem,
  { name: 'director', update: updateDirector },
];

interface Recorder {
  counts: Record<string, number>;
  bossRequestedAt: number[];
  victory: boolean[];
}

function makeWorld(seed: string, startT = 0): { w: World; rec: Recorder } {
  const w = createWorld(seed);
  initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid'));
  w.scrollSpeed = LEVEL1.scrollSpeed;
  startDirector(w, LEVEL1, { startT, debugLoadout: true });
  const rec: Recorder = { counts: {}, bossRequestedAt: [], victory: [] };
  const count = (k: string) => () => (rec.counts[k] = (rec.counts[k] ?? 0) + 1);
  w.events.on('bossWarning', count('bossWarning'));
  w.events.on('levelComplete', count('levelComplete'));
  w.events.on('bossRequested', () => rec.bossRequestedAt.push(w.time));
  w.events.on('runOver', (p) => rec.victory.push(p.victory));
  return { w, rec };
}

function run(w: World, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    for (const s of SYSTEMS) s.update(w, DT);
  }
}

afterEach(() => setGodMode(false));

describe('timeline helpers', () => {
  it('expands repeats and sorts stably', () => {
    const s = buildSchedule([
      { t: 5, toast: 'b' },
      { t: 1, toast: 'a', repeat: { every: 2, times: 3 } },
      { t: 5, toast: 'c' },
    ]);
    expect(s.map((f) => [f.t, f.index, f.rep])).toEqual([
      [1, 1, 0],
      [3, 1, 1],
      [5, 0, 0],
      [5, 1, 2],
      [5, 2, 0],
    ]);
    expect(firstFireAt(s, 4)).toBe(2);
  });

  it('ramps segment rates and stacks overlapping segments', () => {
    const seg = { from: 10, to: 20, rate: 1, rateTo: 3, sizes: { small: 1 } };
    expect(segmentRate(seg, 9.9)).toBe(0);
    expect(segmentRate(seg, 10)).toBe(1);
    expect(segmentRate(seg, 15)).toBe(2);
    expect(segmentRate(seg, 20)).toBe(0);
    // Level 1's storm is far denser than its opening.
    expect(fieldRate(LEVEL1, 170)).toBeGreaterThan(fieldRate(LEVEL1, 5) * 6);
    expect(fieldRate(LEVEL1, 179)).toBe(0);
  });

  it("resolves 'rand' inside the safe bounds, accounting for formation width", () => {
    const rng = createRng('x');
    const f = { type: 'v' as const, enemy: 'gnat', count: 7, x: 'rand' as const };
    const hw = formationHalfWidth(f);
    expect(hw).toBe(60);
    for (let i = 0; i < 200; i++) {
      const x = resolveX('rand', rng, hw);
      expect(x - hw).toBeGreaterThanOrEqual(16);
      expect(x + hw).toBeLessThanOrEqual(224);
    }
    expect(resolveX(42, rng)).toBe(42);
  });

  it('awards the first schematic not yet found or built', () => {
    const order = ['bulwark', 'dart'];
    expect(pickSchematic(order, { schematics: [], shipsBuilt: [] }, [])).toBe('bulwark');
    expect(pickSchematic(order, { schematics: ['bulwark'], shipsBuilt: [] }, [])).toBe('dart');
    expect(pickSchematic(order, { schematics: [], shipsBuilt: ['bulwark'] }, ['dart'])).toBeNull();
  });

  it('exposes level metadata and ?level=N lookup', () => {
    expect(levelIdForNumber(1)).toBe('kessler');
    expect(levelIdForNumber(9)).toBeNull();
    expect(levelIdForNumber(null)).toBeNull();
    expect(getLevel('nope')).toBe(LEVEL1);
    expect(levelSummary('kessler')).toEqual({
      id: 'kessler',
      name: 'THE KESSLER BELT',
      duration: 210,
    });
  });

  it('level 1 warns 2 s before requesting the boss, which is the last event', () => {
    const tl = LEVEL1.timeline;
    const warn = tl.find((e) => 'bossWarning' in e)!;
    const boss = tl.find((e) => 'boss' in e)!;
    expect(boss.t - warn.t).toBe(2);
    expect('boss' in boss && boss.boss).toBe('rock_hauler');
    expect(
      Math.max(...tl.map((e) => e.t + (e.repeat ? e.repeat.every * (e.repeat.times - 1) : 0))),
    ).toBe(boss.t);
  });
});

describe('director (headless Level 1)', () => {
  it('runs 180 s with a god player: every event fires once, the boss is requested once at 180', () => {
    setGodMode(true);
    const { w, rec } = makeWorld('kessler-run');
    run(w, 181);
    const st = getDirector(w)!;
    LEVEL1.timeline.forEach((ev, i) => {
      expect(st.fires[i], `event ${i} @${ev.t}`).toBe(ev.repeat?.times ?? 1);
    });
    expect(rec.counts.bossWarning).toBe(1);
    expect(rec.bossRequestedAt).toHaveLength(1);
    expect(rec.bossRequestedAt[0]!).toBeCloseTo(180, 1);
    expect(st.phase).toBe('boss');
    expect(w.player.alive).toBe(true);
    // The sim really ran: things spawned, died and dropped.
    expect(w.run.kills).toBeGreaterThan(20);
    expect(w.run.asteroidsDestroyed).toBeGreaterThan(20);

    // The timeline waits for the boss, and the field is off.
    run(w, 20);
    expect(rec.bossRequestedAt).toHaveLength(1);
    expect(st.t).toBeCloseTo(180, 1);
    expect(w.asteroids.count).toBe(0);
  });

  it('handles bossDefeated: schematic + salvage, levelComplete, then runOver{victory}', () => {
    setGodMode(true);
    const { w, rec } = makeWorld('outro', 179);
    run(w, 2);
    expect(rec.bossRequestedAt).toHaveLength(1);
    const salvageBefore = w.run.salvage;
    w.events.emit('bossDefeated', { defId: 'rock_hauler', x: 120, y: 70 });
    const items = () => w.pickups.items.slice(0, w.pickups.count).filter((p) => p.active);
    expect(items().some((p: Pickup) => p.kind === 'schematic' && p.payload === 'bulwark')).toBe(
      true,
    );
    expect(w.run.bossDefeated).toBe(true);
    expect(w.enemyShots.items.slice(0, w.enemyShots.count).some((b) => b.active)).toBe(false);

    run(w, OUTRO.levelCompleteAt - 0.1);
    expect(rec.counts.levelComplete).toBeUndefined();
    run(w, 0.2);
    expect(rec.counts.levelComplete).toBe(1);
    expect(rec.victory).toEqual([]);
    run(w, OUTRO.runOverAt - OUTRO.levelCompleteAt);
    expect(rec.victory).toEqual([true]);
    expect(w.run.schematics).toEqual(['bulwark']);
    expect(w.run.salvage - salvageBefore).toBeGreaterThanOrEqual(LEVEL1.bossSalvage);

    // A second defeat event changes nothing.
    w.events.emit('bossDefeated', { defId: 'rock_hauler', x: 120, y: 70 });
    run(w, 8);
    expect(rec.counts.levelComplete).toBe(1);
    expect(rec.victory).toEqual([true]);
  });

  it('gives the same spawn log for the same seed and a different one for another seed', () => {
    const logFor = (seed: string) => {
      setGodMode(true);
      const { w } = makeWorld(seed);
      run(w, 90);
      return getDirector(w)!.log.join('\n');
    };
    const a = logFor('alpha');
    expect(logFor('alpha')).toBe(a);
    expect(logFor('beta')).not.toBe(a);
    // Asteroid jitter differs too.
    const rocks = (seed: string) => {
      const { w } = makeWorld(seed);
      run(w, 10);
      return w.asteroids.items
        .slice(0, w.asteroids.count)
        .map((r) => r.x.toFixed(2))
        .join(',');
    };
    expect(rocks('alpha')).toBe(rocks('alpha'));
    expect(rocks('alpha')).not.toBe(rocks('beta'));
  });

  it('?t=120 skips earlier events and grants the debug loadout', () => {
    const { w } = makeWorld('mid', 120);
    expect(w.time).toBe(120);
    for (const g of DEBUG_LOADOUT) {
      expect(w.player.weapons.find((wi) => wi.id === g.id)?.level).toBe(g.level);
    }
    run(w, 1);
    const st = getDirector(w)!;
    LEVEL1.timeline.forEach((ev, i) => {
      if (ev.t < 120) expect(st.fires[i]).toBe(0);
    });
    expect(st.log.length).toBe(0);
    run(w, 2);
    expect(st.log.some((l) => l.includes('formation'))).toBe(true);
    // Mid-level segments are running.
    expect(activeAsteroidStreams(w).length).toBeGreaterThan(0);
  });

  it('forces the first clear capsule in the opening to Spread', () => {
    const { w } = makeWorld('force');
    attachPickups(w);
    run(w, 16.05);
    const st = getDirector(w)!;
    const [id] = [...st.forced.keys()];
    expect(id).toBeDefined();
    w.events.emit('formationCleared', { formationId: id!, x: 77, y: 150 });
    updateDirector(w, 0);
    const cap = w.pickups.items.find((p) => p.active && p.kind === 'weapon' && p.x === 77);
    expect(cap?.payload).toBe('spread');
    expect(st.forcedGranted.has('spread')).toBe(true);
  });

  it('spawns a salvage cache instead of a pod when the pilot is already rescued', () => {
    const { w } = makeWorld('pod', 99.9);
    w.run.pilotsRescued.push('juno');
    run(w, 0.3);
    const st = getDirector(w)!;
    expect(st.log.some((l) => l.includes('salvageCache'))).toBe(true);
    expect(w.pickups.items.some((p) => p.active && p.kind === 'escapePod')).toBe(false);

    const fresh = makeWorld('pod', 99.9).w;
    run(fresh, 0.3);
    expect(
      fresh.pickups.items.some((p) => p.active && p.kind === 'escapePod' && p.payload === 'juno'),
    ).toBe(true);
  });

  it('announces a salvage cache instead of a pod when no pilot is left to rescue', () => {
    const toasts = (w: World): string[] => {
      const out: string[] = [];
      w.events.on('toast', (p) => out.push(p.text));
      return out;
    };
    const { w } = makeWorld('pod', 98.9);
    w.run.pilotsRescued.push('juno');
    const cacheToasts = toasts(w);
    run(w, 0.3);
    expect(cacheToasts).toEqual(['SALVAGE CACHE AHEAD']);

    const fresh = makeWorld('pod', 98.9).w;
    const podToasts = toasts(fresh);
    run(fresh, 0.3);
    expect(podToasts).toEqual(['ESCAPE POD AHEAD']);
  });
});

describe('debug start past the boss', () => {
  it('still summons the boss right away', () => {
    const { w, rec } = makeWorld('late-start', 185);
    run(w, 0.1);
    expect(rec.bossRequestedAt).toHaveLength(1);
  });
});
