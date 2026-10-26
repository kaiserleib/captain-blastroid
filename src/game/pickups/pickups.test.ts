import { describe, expect, it } from 'vitest';
import { DROP_TABLES, type DropTable } from '../../content/dropTables';
import { createRng } from '../../engine/rng';
import { collisionSystem } from '../../sim/collision';
import { damageAsteroid, damageEnemy } from '../../sim/damage';
import { registerEnemyDefs, spawnAsteroid, spawnEnemy, spawnEnemyShot } from '../../sim/spawn';
import type { Pickup, PickupKind } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { PICKUP_TUNING } from '../../content/pickups';
import { getSave, initSave, resetSaveStore, setSave } from '../../meta';
import { MemoryStorage } from '../../platform';
import {
  onEnemyKilled,
  onFormationCleared,
  rollAndSpawn,
  ROLL_NO_SHIELD,
  rollDrop,
  spawnEntry,
} from './drops';
import {
  attachPickups,
  cachePayload,
  collectPickup,
  pickCapsuleWeapon,
  pickupsSystem,
  spawnDrop,
  spawnEscapePod,
} from './index';
import { getPickupState } from './state';

const DT = 1 / 60;

function makeWorld(seed = 'pickups'): World {
  const w = createWorld(seed);
  const p = w.player;
  p.shield = 2;
  p.maxShield = 3;
  p.pickupRadius = 14;
  w.scrollSpeed = 30;
  attachPickups(w);
  return w;
}

function live(w: World): Pickup[] {
  const out: Pickup[] = [];
  w.pickups.each((k) => out.push(k));
  return out;
}

function tick(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    w.time += DT;
    pickupsSystem.update(w, DT);
    w.pickups.compact();
  }
}

function capture<K extends 'toast' | 'pickupCollected' | 'sfx'>(w: World, type: K): string[] {
  const out: string[] = [];
  w.events.on(type, (p) => {
    const anyP = p as { text?: string; id?: string; pickup?: Pickup };
    out.push(anyP.text ?? anyP.id ?? `${anyP.pickup?.kind}:${anyP.pickup?.payload}`);
  });
  return out;
}

describe('rollDrop', () => {
  it('matches table weights over 10k rolls', () => {
    const table = DROP_TABLES.common as DropTable;
    const rng = createRng('dist');
    const counts = new Map<object, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const e = rollDrop(table, rng)!;
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const total = table.reduce((s, e) => s + e.weight, 0);
    for (const e of table) {
      const expected = e.weight / total;
      expect(Math.abs((counts.get(e) ?? 0) / N - expected)).toBeLessThan(0.015);
    }
  });

  it('re-rolls shield cells while at max shield', () => {
    const table = DROP_TABLES.common as DropTable;
    const rng = createRng('shield');
    let none = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const e = rollDrop(table, rng, ROLL_NO_SHIELD)!;
      expect(e.kind).not.toBe('shield');
      if (e.kind === 'none') none++;
    }
    const total = table.reduce((s, e) => s + (e.kind === 'shield' ? 0 : e.weight), 0);
    expect(Math.abs(none / N - 70 / total)).toBeLessThan(0.015);
  });

  it('rollAndSpawn never drops a shield at max shield, but does below it', () => {
    const table: DropTable = [
      { kind: 'shield', weight: 1 },
      { kind: 'magnet', weight: 1 },
    ];
    const w = makeWorld();
    w.player.shield = w.player.maxShield;
    for (let i = 0; i < 200; i++) rollAndSpawn(w, table, 100, 100);
    expect(live(w).every((k) => k.kind === 'magnet')).toBe(true);
    w.pickups.clear();
    w.player.shield = 0;
    for (let i = 0; i < 200; i++) rollAndSpawn(w, table, 100, 100);
    expect(live(w).some((k) => k.kind === 'shield')).toBe(true);
  });
});

describe('pity timer', () => {
  it('guarantees a non-salvage drop after 25 s without one', () => {
    const w = makeWorld();
    const st = getPickupState(w);
    for (let i = 0; i < 100; i++) {
      w.pickups.clear();
      st.sinceItem = 25;
      onEnemyKilled(w, 'dummy', 100, 100, false);
      const kinds = live(w).map((k) => k.kind);
      expect(kinds.some((k) => k !== 'salvage')).toBe(true);
      expect(st.sinceItem).toBe(0);
    }
  });

  it('does not apply before 25 s', () => {
    const w = makeWorld();
    const st = getPickupState(w);
    let empty = 0;
    for (let i = 0; i < 200; i++) {
      w.pickups.clear();
      st.sinceItem = 0;
      onEnemyKilled(w, 'dummy', 100, 100, false);
      if (w.pickups.count === 0) empty++;
    }
    expect(empty).toBeGreaterThan(100);
  });

  it('counts up in the system tick', () => {
    const w = makeWorld();
    tick(w, 60);
    expect(getPickupState(w).sinceItem).toBeCloseTo(1, 5);
  });
});

describe('drops from events', () => {
  it('a cleared formation drops a weapon capsule where the last member died', () => {
    const w = makeWorld();
    w.run.formations.set(7, { alive: 3, total: 3, broken: false });
    const xs = [40, 120, 200];
    const gnats = xs.map((x, i) => spawnEnemy(w, 'dummy', x, 50 + i * 10, { formationId: 7 })!);
    for (const g of gnats) damageEnemy(w, g, 99, 'player');
    const caps = live(w).filter((k) => k.kind === 'weapon');
    expect(caps.length).toBeGreaterThanOrEqual(1);
    expect(caps.some((k) => k.x === 200 && k.y === 70)).toBe(true);
  });

  it('carriers always drop a weapon capsule', () => {
    registerEnemyDefs({ carrierT: { hp: 1, r: 8, dropTable: 'carrier', salvage: 5 } as never });
    const w = makeWorld();
    for (let i = 0; i < 20; i++) {
      const e = spawnEnemy(w, 'carrierT', 100, 100)!;
      damageEnemy(w, e, 9, 'player');
    }
    expect(live(w).filter((k) => k.kind === 'weapon').length).toBe(20);
    expect(w.run.salvage).toBe(0);
    const salvage = live(w)
      .filter((k) => k.kind === 'salvage')
      .reduce((s, k) => s + k.amount, 0);
    expect(salvage).toBe(100);
  });

  it('kills by asteroids drop nothing', () => {
    const w = makeWorld();
    for (let i = 0; i < 200; i++) {
      const e = spawnEnemy(w, 'dummy', 100, 100)!;
      damageEnemy(w, e, 9, 'asteroid');
      const a = spawnAsteroid(w, { x: 50, y: 50, vx: 0, vy: 0, r: 6, hp: 1, size: 'large' })!;
      damageAsteroid(w, a, 9, false);
      w.enemies.compact();
      w.asteroids.compact();
    }
    expect(w.pickups.count).toBe(0);
  });

  it('player-destroyed asteroids roll their size table', () => {
    const w = makeWorld();
    for (let i = 0; i < 200; i++) {
      const a = spawnAsteroid(w, { x: 50, y: 50, vx: 0, vy: 0, r: 6, hp: 1, size: 'large' })!;
      damageAsteroid(w, a, 9, true);
      w.asteroids.compact();
    }
    expect(w.pickups.count).toBeGreaterThan(50);
  });

  it('unknown enemy ids fall back to the common table instead of throwing', () => {
    const w = makeWorld();
    expect(() => onEnemyKilled(w, 'nope', 1, 1, false)).not.toThrow();
  });
});

describe('pickCapsuleWeapon', () => {
  it('favors owned non-max weapons half the time', () => {
    const rng = createRng('weap');
    const weapons = [
      { id: 'spread', level: 2, cooldown: 0, state: 0 },
      { id: 'blaster', level: 5, cooldown: 0, state: 0 },
    ];
    const counts: Record<string, number> = {};
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const id = pickCapsuleWeapon(rng, weapons);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(Math.abs((counts.spread ?? 0) / N - 0.6)).toBeLessThan(0.02);
    expect(Math.abs((counts.blaster ?? 0) / N - 0.1)).toBeLessThan(0.015);
    expect(Object.keys(counts).sort()).toEqual(
      ['blaster', 'lance', 'orbitDrones', 'seeker', 'spread'].sort(),
    );
  });
});

describe('collection', () => {
  function collect(w: World, kind: PickupKind, payload = '', amount = 0): Pickup {
    const k = spawnDrop(w, kind, w.player.x, w.player.y - 5, payload, amount)!;
    tick(w);
    return k;
  }

  it('collects within pickupRadius × pickupRadiusMul only', () => {
    const w = makeWorld();
    w.player.stats.pickupRadiusMul = 2;
    const far = spawnDrop(w, 'salvage', w.player.x + 30, w.player.y, '', 1)!;
    const near = spawnDrop(w, 'salvage', w.player.x + 26, w.player.y, '', 1)!;
    far.vy = near.vy = 0;
    w.scrollSpeed = -10; // cancels the drift
    tick(w);
    expect(near.active).toBe(false);
    expect(far.active).toBe(true);
  });

  it('weapon and upgrade pickups only emit pickupCollected (T09 applies them)', () => {
    const w = makeWorld();
    const got = capture(w, 'pickupCollected');
    const sfx = capture(w, 'sfx');
    collect(w, 'weapon', 'lance');
    collect(w, 'upgrade');
    expect(got).toEqual(['weapon:lance', 'upgrade:']);
    expect(sfx).toEqual(['weapon_up', 'weapon_up']);
    expect(w.player.weapons).toEqual([]);
    expect(w.run.pickupsCollected.weapon).toBe(1);
    expect(w.run.pickupsCollected.upgrade).toBe(1);
  });

  it('shield adds a segment up to max, then scores 100', () => {
    const w = makeWorld();
    collect(w, 'shield');
    expect(w.player.shield).toBe(3);
    const score = w.run.score;
    collect(w, 'shield');
    expect(w.player.shield).toBe(3);
    expect(w.run.score).toBe(score + 100);
  });

  it('salvage scales by salvageMul', () => {
    const w = makeWorld();
    w.player.stats.salvageMul = 1.25;
    collect(w, 'salvage', '', 4);
    expect(w.run.salvage).toBe(5);
  });

  it('magnet and repulsor set timers scaled by powerupDurationMul', () => {
    const w = makeWorld();
    w.player.stats.powerupDurationMul = 1.5;
    collect(w, 'magnet');
    expect(w.player.magnetT).toBeCloseTo(12, 5);
    collect(w, 'repulsor');
    expect(w.player.repulsorT).toBeCloseTo(9, 5);
    tick(w, 60);
    expect(w.player.repulsorT).toBeCloseTo(8, 3);
  });

  it('schematic and escape pod update the run and toast', () => {
    const w = makeWorld();
    const toasts = capture(w, 'toast');
    collect(w, 'schematic', 'bulwark');
    expect(w.run.schematics).toEqual(['bulwark']);
    const pod = spawnEscapePod(w, 'juno', w.player.x)!;
    pod.y = w.player.y;
    tick(w);
    expect(w.run.pilotsRescued).toEqual(['juno']);
    expect(toasts).toEqual(['SCHEMATIC: BULWARK', 'PILOT RESCUED: JUNO SPARKS']);
  });

  it('a cache pod sprays its salvage instead of rescuing anyone', () => {
    const w = makeWorld();
    const toasts = capture(w, 'toast');
    const pod = spawnEscapePod(w, cachePayload(40), w.player.x, 3)!;
    pod.y = w.player.y;
    tick(w);
    expect(w.run.pilotsRescued).toEqual([]);
    expect(toasts).toEqual(['SALVAGE CACHE SECURED']);
    let salvage = 0;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i]!;
      if (k.active && k.kind === 'salvage') salvage += k.amount;
    }
    expect(salvage).toBe(40);
  });

  it('collectPickup is a no-op on a released pickup', () => {
    const w = makeWorld();
    const k = spawnDrop(w, 'shield', 10, 10)!;
    w.pickups.release(k);
    collectPickup(w, k);
    expect(w.player.shield).toBe(2);
  });
});

describe('motion', () => {
  it('drifts at scroll + 10 and expires after 10 s', () => {
    const w = makeWorld();
    w.player.alive = false;
    const k = spawnDrop(w, 'shield', 120, 20)!;
    tick(w, 60);
    expect(k.y - 20).toBeCloseTo(40, 0);
    tick(w, 9 * 60 + 2);
    expect(k.active).toBe(false);
  });

  it('salvage sprays out and then settles into the drift', () => {
    const w = makeWorld();
    w.player.alive = false;
    onEnemyKilled(w, 'dummy', 120, 100, false);
    registerEnemyDefs({ salvT: { hp: 1, r: 6, salvage: 7 } as never });
    onEnemyKilled(w, 'salvT', 120, 100, false);
    const bits = live(w).filter((k) => k.kind === 'salvage');
    expect(bits.length).toBeGreaterThanOrEqual(3);
    expect(new Set(bits.map((k) => Math.round(k.vx))).size).toBeGreaterThan(1);
    tick(w, 120);
    for (const k of bits) expect(k.vy).toBeCloseTo(40, 0);
  });
});

describe('magnet', () => {
  it('sweeps every pickup on screen into the ship', () => {
    const w = makeWorld();
    const rng = createRng('m');
    for (let i = 0; i < 30; i++)
      spawnDrop(w, 'salvage', rng.range(5, 235), rng.range(5, 300), '', 1);
    w.player.magnetT = 8;
    tick(w, 3 * 60);
    expect(w.pickups.count).toBe(0);
    expect(w.run.salvage).toBe(30);
  });
});

describe('repulsor', () => {
  it('bats away enemy shots headed at the ship', () => {
    const w = makeWorld();
    const p = w.player;
    p.repulsorT = 6;
    const s = spawnEnemyShot(w, { x: p.x, y: p.y - 60, vx: 0, vy: 90 })!;
    let hit = false;
    w.events.on('playerHit', () => (hit = true));
    for (let i = 0; i < 120; i++) {
      pickupsSystem.update(w, DT);
      s.x += s.vx * DT;
      s.y += s.vy * DT;
      collisionSystem.update(w, DT);
    }
    expect(hit).toBe(false);
    expect(s.vy).toBeLessThan(0);
  });

  it('shoves asteroids outward', () => {
    const w = makeWorld();
    const p = w.player;
    p.repulsorT = 6;
    const a = spawnAsteroid(w, { x: p.x + 20, y: p.y, vx: 0, vy: 0, r: 5, hp: 1 })!;
    pickupsSystem.update(w, DT);
    expect(a.vx).toBeGreaterThan(0);
  });
});

describe('escape pod', () => {
  it('drifts at 12 px/s and never expires', () => {
    const w = makeWorld();
    w.player.alive = false;
    const pod = spawnEscapePod(w, 'grieg', 60)!;
    const y0 = pod.y;
    tick(w, 60 * 12);
    expect(pod.active).toBe(true);
    expect(pod.y - y0).toBeCloseTo(144, 0);
  });

  it('is destroyed by an enemy shot, consuming the shot', () => {
    const w = makeWorld();
    const toasts = capture(w, 'toast');
    const pod = spawnEscapePod(w, 'juno', 60)!;
    pod.y = 100;
    tick(w);
    const s = spawnEnemyShot(w, { x: 60, y: pod.y, vx: 0, vy: 50 })!;
    collisionSystem.update(w, DT);
    expect(pod.active).toBe(false);
    expect(s.active).toBe(false);
    expect(toasts).toEqual(['POD LOST']);
    expect(getPickupState(w).pods).toBe(0);
  });

  it('is lost when it leaves the screen', () => {
    const w = makeWorld();
    w.player.alive = false;
    const toasts = capture(w, 'toast');
    const pod = spawnEscapePod(w, 'juno', 60)!;
    pod.y = 410;
    tick(w, 120);
    expect(pod.active).toBe(false);
    expect(toasts).toEqual(['POD LOST']);
  });
});

describe('T18 drop pacing', () => {
  it('drops at most one formation capsule per formationCapsuleGap seconds', () => {
    const w = makeWorld('gap');
    const capsules = () => live(w).filter((k) => k.kind === 'weapon').length;
    onFormationCleared(w, 100, 100);
    expect(capsules()).toBe(1);
    onFormationCleared(w, 120, 100);
    expect(capsules()).toBe(1);
    expect(live(w).some((k) => k.kind === 'salvage')).toBe(PICKUP_TUNING.formationBonusSalvage > 0);
    getPickupState(w).sinceFormationCapsule = PICKUP_TUNING.formationCapsuleGap;
    onFormationCleared(w, 140, 100);
    expect(capsules()).toBe(2);
  });

  it('the elite schematic skips ships the save already has', async () => {
    await initSave(new MemoryStorage());
    const w = makeWorld('schem');
    setSave({ ...getSave(), schematics: ['bulwark'] });
    try {
      spawnEntry(w, { kind: 'schematic', weight: 1 }, 50, 50);
      expect(live(w).find((k) => k.kind === 'schematic')?.payload).toBe('dart');
    } finally {
      resetSaveStore();
    }
  });
});
