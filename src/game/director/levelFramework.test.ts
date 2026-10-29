import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTS,
  LEVEL1,
  LEVELS,
  LEVEL_ORDER,
  REGISTERED_ACTION_KINDS,
  actEndedBy,
  actFinishedBy,
  campaignFinale,
  actIndexOf,
  getLevel,
  levelIdForNumber,
  type LevelDef,
  type TimelineEvent,
} from '../../content/levels';
import { rockThemeForLevel } from '../../content/obstacles';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { registerTimelineAction } from '../../sim/hooks';
import { isPinned } from '../../sim/scroll';
import { spawnAsteroid } from '../../sim/spawn';
import type { Anomaly, Pickup } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { activeBoss, bossRegistration, bossSystem } from '../boss';
import { enemyHpMul, shootDir } from '../enemies';
import '../levels';
import { attachPickups } from '../pickups';
import { initPlayer, setGodMode } from '../player';
import {
  NO_SCHEMATIC_SALVAGE_MUL,
  OUTRO,
  SUPPLY_DROP,
  getDirector,
  registerLevelScript,
  registerLevelSystem,
  startDirector,
  updateDirector,
} from './index';
import { pickSchematic } from './timeline';

const DT = 1 / 60;

function level(id: string, timeline: TimelineEvent[], extra: Partial<LevelDef> = {}): LevelDef {
  return {
    ...LEVEL1,
    id,
    asteroidField: [],
    timeline,
    ...extra,
  };
}

function setup(lv: LevelDef, seed = 'T21'): World {
  const w = createWorld(seed, { levelId: lv.id });
  initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', 'blastroid'));
  w.scrollSpeed = lv.scrollSpeed;
  startDirector(w, lv);
  return w;
}

/** Director only (plus anything passed): the timeline clock advances by `seconds`. */
function run(
  w: World,
  seconds: number,
  systems: { update(w: World, dt: number): void }[] = [],
): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    for (const s of systems) s.update(w, DT);
    updateDirector(w, DT);
  }
}

function live<T extends { active: boolean }>(pool: { items: T[]; count: number }): T[] {
  return pool.items.slice(0, pool.count).filter((x) => x.active);
}

afterEach(() => setGodMode(false));

describe('sectors', () => {
  it('lists ten campaign sectors in order, then the Gauntlet, each with its tuning', () => {
    expect(LEVEL_ORDER).toEqual([
      'kessler',
      'ionShoals',
      'eventHorizon',
      'pulsarNursery',
      'armada',
      'corona',
      'warrens',
      'junction',
      'chrono',
      'foundry',
      'gauntlet',
    ]);
    for (let n = 1; n <= 10; n++) {
      const id = levelIdForNumber(n)!;
      expect(id).toBe(LEVEL_ORDER[n - 1]);
      const l = getLevel(id);
      expect(l.number).toBe(n);
      // Each sector ends in one registered boss; a pod may come from a script instead.
      const bosses = l.timeline.filter((e) => 'boss' in e);
      expect(bosses).toHaveLength(1);
      const boss = bosses[0];
      expect(boss !== undefined && 'boss' in boss && bossRegistration(boss.boss)).toBeTruthy();
      expect(l.timeline.filter((e) => 'escapePod' in e).length).toBeLessThanOrEqual(1);
      expect(l.guaranteeWeapon).toBeDefined();
      expect(rockThemeForLevel(id)).toBe(l.rockTheme);
    }
    expect(levelIdForNumber(12)).toBeNull();
    expect(getLevel('nowhere')).toBe(LEVEL1);
    expect(LEVELS.armada!.bossMusic).toBe('armada_boss');
    expect(rockThemeForLevel('nowhere')).toBe('basalt');
    expect(rockThemeForLevel('2')).toBe('ion');
  });
});

describe('anomaly action', () => {
  it('spawns just above the top edge drifting with the scroll; vy: 0 pins it', () => {
    const w = setup(
      level('t21-anom', [
        { t: 0.1, anomaly: { kind: 'blackhole', x: 60 } },
        { t: 0.1, anomaly: { kind: 'pulsar', x: 180, y: 150, vx: 4, vy: 0, phase: 1 } },
      ]),
    );
    run(w, 0.2);
    const [hole, pulsar] = live(w.anomalies) as [Anomaly, Anomaly];
    expect(hole.kind).toBe('blackhole');
    expect(hole.x).toBe(60);
    expect(hole.y).toBe(-hole.r);
    expect(hole.vy).toBe(w.scrollSpeed);
    expect(isPinned(hole)).toBe(false);
    expect(pulsar.kind).toBe('pulsar');
    expect(pulsar.y).toBe(150);
    expect(pulsar.vx).toBe(4);
    expect(pulsar.vy).toBe(0);
    expect(isPinned(pulsar)).toBe(true);
  });
});

describe('scroll action', () => {
  it('ramps scrollSpeed linearly; rocks and unpinned anomalies take the delta', () => {
    const w = setup(
      level('t21-scroll', [
        { t: 0.1, anomaly: { kind: 'blackhole', x: 60 } },
        { t: 0.1, anomaly: { kind: 'blackhole', x: 180, y: 100, vy: 0 } },
        { t: 1, scroll: { to: 70, over: 2 } },
        { t: 5, scroll: { to: 18, over: 0 } },
      ]),
    );
    run(w, 0.5);
    const rock = spawnAsteroid(w, { x: 120, y: 50, vx: 0, vy: 10 + w.scrollSpeed, r: 4, hp: 1 })!;
    const [free, pinned] = live(w.anomalies) as [Anomaly, Anomaly];
    run(w, 1.5); // t = 2: halfway through the ramp
    expect(w.scrollSpeed).toBeCloseTo(50, 0);
    run(w, 1.5); // t = 3.5: ramp done
    expect(w.scrollSpeed).toBe(70);
    expect(rock.vy).toBeCloseTo(80, 6);
    expect(free.vy).toBeCloseTo(70, 6);
    expect(pinned.vy).toBe(0);
    run(w, 1.6); // instant drop at t = 5
    expect(w.scrollSpeed).toBe(18);
    expect(rock.vy).toBeCloseTo(28, 6);
    expect(free.vy).toBeCloseTo(18, 6);
    expect(pinned.vy).toBe(0);
    expect(getDirector(w)!.log.filter((l) => l.includes('scroll'))).toHaveLength(2);
  });
});

describe('script action and level systems', () => {
  it('runs a registered script with its args', () => {
    const seen: unknown[] = [];
    registerLevelScript('t21.beat', (w, args) => seen.push([w.time.toFixed(1), args.n, args.s]));
    const w = setup(level('t21-script', [{ t: 1, script: 't21.beat', args: { n: 3, s: 'x' } }]));
    run(w, 1.2);
    expect(seen).toEqual([['1.0', 3, 'x']]);
  });

  it('an unknown script throws in dev', () => {
    const w = setup(level('t21-noscript', [{ t: 0.1, script: 't21.missing' }]));
    expect(() => run(w, 0.2)).toThrow(/Unknown level script "t21.missing"/);
  });

  it('a second, different script under one name throws', () => {
    const fn = () => {};
    registerLevelScript('t21.dup', fn);
    expect(() => registerLevelScript('t21.dup', fn)).not.toThrow();
    expect(() => registerLevelScript('t21.dup', () => {})).toThrow(/duplicate/);
  });

  it("runs the level's systems every tick through the boss fight and the outro, and only for that level", () => {
    const phases: string[] = [];
    registerLevelSystem('t21-sys', {
      name: 't21.sys',
      update: (w) => {
        const p = getDirector(w)!.phase;
        if (phases[phases.length - 1] !== p) phases.push(p);
      },
    });
    expect(() => registerLevelSystem('t21-sys', { name: 't21.sys', update: () => {} })).toThrow(
      /duplicate/,
    );
    setGodMode(true);
    const w = setup(level('t21-sys', [{ t: 0.5, boss: 'rock_hauler' }]));
    run(w, 2, [bossSystem]);
    expect(activeBoss(w)).not.toBeNull();
    w.events.emit('bossDefeated', { defId: 'rock_hauler', x: 120, y: 70 });
    run(w, OUTRO.runOverAt + 0.2, [bossSystem]);
    expect(phases).toEqual(['level', 'boss', 'outro', 'done']);
    // Another level doesn't run it.
    const before = phases.length;
    const other = setup(level('t21-other', []));
    run(other, 0.5);
    expect(phases.length).toBe(before);
  });
});

describe('escapePod hp', () => {
  it('passes hp to the pod', () => {
    const w = setup(level('kessler', [{ t: 0.1, escapePod: { x: 100, hp: 3 } }]));
    attachPickups(w);
    run(w, 0.2);
    const pod = live(w.pickups).find((p) => p.kind === 'escapePod') as Pickup;
    expect(pod.payload).toBe('juno');
    expect(pod.amount).toBe(3);
  });
});

describe('guaranteeWeapon', () => {
  const lv = level('t21-supply', [], { guaranteeWeapon: { by: 2, weapon: 'spread' } });

  function capsules(w: World): Pickup[] {
    return live(w.pickups).filter((p) => p.kind === 'weapon');
  }

  it('drops the capsule ahead of a one-weapon ship once, with a toast', () => {
    const w = setup(lv);
    attachPickups(w);
    const toasts: string[] = [];
    w.events.on('toast', (p) => toasts.push(p.text));
    expect(w.player.weapons).toHaveLength(1);
    run(w, 1.9);
    expect(capsules(w)).toHaveLength(0);
    run(w, 0.2);
    const [cap] = capsules(w);
    expect(cap!.payload).toBe('spread');
    expect(cap!.x).toBe(w.player.x);
    expect(cap!.y).toBeCloseTo(w.player.y - SUPPLY_DROP.ahead, 0);
    expect(toasts).toEqual(['SUPPLY DROP']);
    w.pickups.release(cap!);
    run(w, 3);
    expect(capsules(w)).toHaveLength(0);
  });

  it('keeps the capsule on screen near the top edge', () => {
    const w = setup(lv);
    w.player.y = 20;
    w.player.x = 2;
    run(w, 2.1);
    const [cap] = capsules(w);
    expect(cap!.x).toBe(SUPPLY_DROP.margin);
    expect(cap!.y).toBeGreaterThanOrEqual(SUPPLY_DROP.margin - 1);
  });

  it('does nothing when the player already holds two weapons', () => {
    const w = setup(lv);
    w.player.weapons.push({ id: 'lance', level: 1, cooldown: 0, state: 0 });
    run(w, 3);
    expect(capsules(w)).toHaveLength(0);
  });
});

describe('boss rewards', () => {
  it('skips schematic ids that are not ships yet', () => {
    expect(pickSchematic(['no_such_ship', 'dart'], { schematics: [], shipsBuilt: [] }, [])).toBe(
      'dart',
    );
    expect(pickSchematic(['no_such_ship'], { schematics: [], shipsBuilt: [] }, [])).toBeNull();
  });

  it('pays +50% boss salvage when no schematic is left', () => {
    const w = setup(
      level('t21-reward', [{ t: 0.1, boss: 'rock_hauler' }], {
        schematicOnClear: ['no_such_ship'],
      }),
    );
    attachPickups(w);
    run(w, 0.2);
    w.events.emit('bossDefeated', { defId: 'rock_hauler', x: 120, y: 70 });
    const salvage = live(w.pickups)
      .filter((p) => p.kind === 'salvage')
      .reduce((n, p) => n + p.amount, 0);
    expect(live(w.pickups).some((p) => p.kind === 'schematic')).toBe(false);
    expect(salvage).toBe(Math.round(LEVEL1.bossSalvage * NO_SCHEMATIC_SALVAGE_MUL));
  });
});

describe('level tuning', () => {
  it("startDirector applies the level's enemy shot speed and HP multipliers", () => {
    const w = setup(level('t21-fast', [], { enemyShotSpeedMul: 1.2, enemyHpMul: 1.35 }));
    shootDir(w, 120, 100, 90, 100);
    expect(live(w.enemyShots)[0]!.vy).toBeCloseTo(120, 6);
    expect(enemyHpMul(w)).toBe(1.35);
    const plain = setup(level('t21-plain', []));
    expect(enemyHpMul(plain)).toBe(1);
  });
});

describe('registered timeline actions (Act II hazards)', () => {
  it('routes a hazard event to its registered handler with the payload', () => {
    const seen: unknown[] = [];
    const off = registerTimelineAction('flare', (_w, ev) => seen.push(ev));
    const w = setup(level('t32-flare', [{ t: 0.5, flare: { warn: 1.2, practice: true } }]));
    run(w, 0.6);
    off();
    expect(seen).toEqual([{ warn: 1.2, practice: true }]);
    expect(getDirector(w)!.log.some((l) => l.endsWith('flare'))).toBe(true);
  });

  it('skips and logs an unregistered kind instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // T33 registers `bubble` at load; replacing it and removing the stand-in leaves it unregistered.
    registerTimelineAction('bubble', () => {})();
    const w = setup(level('t32-none', [{ t: 0.1, bubble: { kind: 'slow', x: 120, r: 52 } }]));
    expect(() => run(w, 0.2)).not.toThrow();
    expect(getDirector(w)!.log.some((l) => l.includes('bubble (unregistered)'))).toBe(true);
    warn.mockRestore();
  });

  it('routes every Act II kind, and warns once per unknown kind', () => {
    const events: TimelineEvent[] = [
      { t: 0.1, flare: { burn: 1 } },
      { t: 0.1, flares: { every: 8, until: 60 } },
      { t: 0.1, shadeSlab: { x: 60 } },
      { t: 0.1, terrain: { chunk: 'c1', theme: 'warrens' } },
      { t: 0.1, portal: { a: [40, 80], b: [200, 80], color: 'cyan' } },
      { t: 0.1, bubble: { kind: 'fast', x: 120, r: 40 } },
    ];
    const seen: string[] = [];
    const offs = REGISTERED_ACTION_KINDS.map((k) => registerTimelineAction(k, () => seen.push(k)));
    run(setup(level('t32-all', events)), 0.2);
    offs.forEach((off) => off());
    expect(seen).toEqual([...REGISTERED_ACTION_KINDS]);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const twice: TimelineEvent[] = [
      { t: 0.1, portal: { a: [40, 80], b: [200, 80], color: 'cyan' } },
      { t: 0.2, portal: { a: [40, 80], b: [200, 80], color: 'lime' } },
    ];
    run(setup(level('t32-twice', twice)), 0.3);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("'portal'"))).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('Act II sector stubs (T32)', () => {
  const ACT2: Record<string, [music: string, boss: string, schematic: string, field?: string]> = {
    corona: ['corona', 'boss2', 'shrike', 'arc'],
    warrens: ['warrens', 'boss2', 'ferret', 'ricochet'],
    junction: ['junction', 'boss2', 'wraith', 'flak'],
    chrono: ['rift', 'boss2', 'revenant'],
    foundry: ['foundry', 'foundry_boss', 'nova'],
  };

  it('carry the design tuning, one pod and a guaranteed field-test weapon', () => {
    for (const [id, [music, boss, schematic, field]] of Object.entries(ACT2)) {
      const l = getLevel(id);
      expect(l.id, id).toBe(id);
      expect(l.music).toBe(music);
      expect(l.bossMusic).toBe(boss);
      expect(l.schematicOnClear).toEqual([schematic]);
      expect(l.fieldTestWeapon).toBe(field);
      if (field !== undefined) expect(l.guaranteeWeapon).toEqual({ by: 25, weapon: field });
      // At most one: a sector may spawn its pod from a level script instead.
      expect(l.timeline.filter((e) => 'escapePod' in e).length).toBeLessThanOrEqual(1);
      expect(l.enemyHpMul).toBeGreaterThanOrEqual(1.4);
      expect(l.escape !== undefined).toBe(id === 'foundry');
    }
    expect(LEVEL_ORDER.slice(5, 10).map((id) => getLevel(id).bossSalvage)).toEqual([
      240, 260, 280, 300, 400,
    ]);
    expect(LEVEL_ORDER.slice(5, 10).map((id) => getLevel(id).podFallbackSalvage)).toEqual([
      90, 100, 110, 120, 150,
    ]);
  });

  it('pages into two acts of five, then the Gauntlet', () => {
    expect(ACTS.map((a) => a.name)).toEqual(['ACT I', 'ACT II', 'GAUNTLET']);
    expect(ACTS.map((a) => a.extra === true)).toEqual([false, false, true]);
    expect(campaignFinale()).toBe('foundry');
    expect(actFinishedBy('gauntlet')?.name).toBe('GAUNTLET');
    expect(ACTS.flatMap((a) => a.levels)).toEqual([...LEVEL_ORDER]);
    expect(actIndexOf('armada')).toBe(0);
    expect(actIndexOf('corona')).toBe(1);
    expect(actIndexOf('nowhere')).toBe(0);
    expect(actEndedBy('armada')?.name).toBe('ACT I');
    expect(actEndedBy('foundry')?.name).toBe('ACT II');
    expect(actEndedBy('gauntlet')).toBeNull();
    expect(actEndedBy('corona')).toBeNull();
  });
});
