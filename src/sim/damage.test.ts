import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from './cleanup';
import {
  CHAIN_MAX,
  CHAIN_WINDOW,
  HIT_FLASH,
  damageAsteroid,
  damageEnemy,
  damagePlayer,
  tickChain,
} from './damage';
import { clearHooks, registerBossDamage } from './hooks';
import { spawnAsteroid, spawnEnemy } from './spawn';
import { createWorld, type World } from './world';

function world(): World {
  const w = createWorld('DMG');
  w.player.shield = 2;
  return w;
}

afterEach(() => clearHooks());

describe('damageEnemy', () => {
  it('flashes, emits enemyHit, and on death emits enemyKilled before releasing', () => {
    const w = world();
    const e = spawnEnemy(w, 'dummy', 50, 50, { hp: 2 })!;
    const seen: string[] = [];
    w.events.on('enemyHit', (p) => seen.push(`hit ${p.damage} ${p.enemy.hp}`));
    w.events.on('enemyKilled', (p) => seen.push(`killed ${p.byPlayer} active=${p.enemy.active}`));
    expect(damageEnemy(w, e, 1, 'player')).toBe(false);
    expect(e.flashT).toBe(HIT_FLASH);
    expect(damageEnemy(w, e, 1, 'player')).toBe(true);
    expect(seen).toEqual(['hit 1 1', 'hit 1 0', 'killed true active=true']);
    expect(e.active).toBe(false);
    // Dead enemies ignore further damage.
    expect(damageEnemy(w, e, 1, 'player')).toBe(false);
    expect(seen.length).toBe(3);
  });

  it('a listener that damages the same enemy again cannot kill it twice', () => {
    const w = world();
    const e = spawnEnemy(w, 'dummy', 50, 50, { hp: 1 })!;
    let kills = 0;
    w.events.on('enemyHit', (p) => damageEnemy(w, p.enemy, 5, 'player'));
    w.events.on('enemyKilled', () => kills++);
    damageEnemy(w, e, 1, 'player');
    expect(kills).toBe(1);
  });

  it('nested kills from listeners get their own payloads', () => {
    const w = world();
    const a = spawnEnemy(w, 'dummy', 0, 0)!;
    const b = spawnEnemy(w, 'dummy', 0, 0)!;
    const order: number[] = [];
    w.events.on('enemyKilled', (p) => {
      if (p.enemy === a) damageEnemy(w, b, 1, 'player');
      order.push(p.enemy.id);
    });
    damageEnemy(w, a, 1, 'player');
    expect(order).toEqual([b.id, a.id]);
  });

  it('only player kills score and count', () => {
    const w = world();
    damageEnemy(w, spawnEnemy(w, 'dummy', 0, 0)!, 1, 'asteroid');
    expect([w.run.score, w.run.kills]).toEqual([0, 0]);
    damageEnemy(w, spawnEnemy(w, 'dummy', 0, 0)!, 1, 'player');
    expect([w.run.score, w.run.kills]).toEqual([10, 1]);
  });

  it('boss parts go through the boss hooks first', () => {
    const w = world();
    const boss = spawnEnemy(w, 'dummy', 0, 0, { hp: 10, isBoss: true })!;
    let handle = true;
    const calls: number[] = [];
    registerBossDamage((_w, part, amount) => {
      calls.push(amount);
      expect(part).toBe(boss);
      return handle;
    });
    damageEnemy(w, boss, 3, 'player');
    expect(boss.hp).toBe(10);
    handle = false;
    damageEnemy(w, boss, 3, 'player');
    expect(boss.hp).toBe(7);
    expect(calls).toEqual([3, 3]);
  });
});

describe('chain multiplier', () => {
  it('rises with kills within the window, caps at 8, and decays after it', () => {
    const w = world();
    for (let i = 0; i < 10; i++) {
      damageEnemy(w, spawnEnemy(w, 'dummy', 0, 0)!, 1, 'player');
      tickChain(w, 0.5);
    }
    expect(w.run.chain).toBe(CHAIN_MAX);
    // 10 × (1+2+...+8+8+8) = 10 × 52
    expect(w.run.score).toBe(520);
    tickChain(w, CHAIN_WINDOW);
    expect(w.run.chain).toBe(1);
  });

  it('resets on playerHit', () => {
    const w = world();
    damageEnemy(w, spawnEnemy(w, 'dummy', 0, 0)!, 1, 'player');
    damageEnemy(w, spawnEnemy(w, 'dummy', 0, 0)!, 1, 'player');
    expect(w.run.chain).toBe(2);
    damagePlayer(w);
    expect(w.run.chain).toBe(1);
    expect(w.run.chainT).toBe(0);
  });
});

describe('damageAsteroid', () => {
  it('emits asteroidHit, then asteroidDestroyed with the credit, and scores player kills', () => {
    const w = world();
    const a = spawnAsteroid(w, { x: 0, y: 0, vx: 0, vy: 0, r: 5, hp: 2 })!;
    const seen: string[] = [];
    w.events.on('asteroidHit', () => seen.push('hit'));
    w.events.on('asteroidDestroyed', (p) => seen.push(`destroyed ${p.byPlayer}`));
    expect(damageAsteroid(w, a, 1, true)).toBe(false);
    expect(damageAsteroid(w, a, 1, true)).toBe(true);
    expect(seen).toEqual(['hit', 'hit', 'destroyed true']);
    expect([w.run.score, w.run.asteroidsDestroyed, a.active]).toEqual([10, 1, false]);
    const b = spawnAsteroid(w, { x: 0, y: 0, vx: 0, vy: 0, r: 5, hp: 1 })!;
    damageAsteroid(w, b, 1, false);
    expect([w.run.score, w.run.asteroidsDestroyed]).toEqual([10, 1]);
  });

  it('indestructible rocks (maxHp 0) ignore damage', () => {
    const w = world();
    const a = spawnAsteroid(w, { x: 0, y: 0, vx: 0, vy: 0, r: 5, hp: 0 })!;
    expect(damageAsteroid(w, a, 50, true)).toBe(false);
    expect(a.active).toBe(true);
  });
});

describe('damagePlayer', () => {
  it('removes segments, grants 1 s invuln, and kills below 0 segments', () => {
    const w = world();
    const seen: string[] = [];
    w.events.on('playerHit', (p) => seen.push(`hit ${p.shieldLeft}`));
    w.events.on('playerDied', () => seen.push('died'));
    w.events.on('shake', (p) => seen.push(`shake ${p.mag}`));
    w.events.on('haptic', (p) => seen.push(`haptic ${p.kind}`));
    expect(damagePlayer(w)).toBe(true);
    expect(w.player.invulnT).toBe(1);
    expect(damagePlayer(w)).toBe(false);
    w.player.invulnT = 0;
    damagePlayer(w);
    w.player.invulnT = 0;
    damagePlayer(w);
    expect(w.player.alive).toBe(false);
    w.player.invulnT = 0;
    expect(damagePlayer(w)).toBe(false);
    expect(seen).toEqual([
      'hit 1',
      'shake 3',
      'haptic medium',
      'hit 0',
      'shake 3',
      'haptic medium',
      'hit 0',
      'shake 6',
      'haptic heavy',
      'died',
    ]);
  });
});

describe('formations', () => {
  function formation(w: World, n: number) {
    w.run.formations.set(3, { alive: n, total: n, broken: false });
    return Array.from({ length: n }, (_, i) =>
      spawnEnemy(w, 'dummy', 20 + i * 20, 50, { formationId: 3 })!,
    );
  }

  it('clearing every member by the player emits formationCleared at the last position', () => {
    const w = world();
    const cleared: { formationId: number; x: number; y: number }[] = [];
    w.events.on('formationCleared', (p) => cleared.push({ ...p }));
    const es = formation(w, 3);
    damageEnemy(w, es[0]!, 1, 'player');
    damageEnemy(w, es[2]!, 1, 'player');
    expect(cleared).toEqual([]);
    damageEnemy(w, es[1]!, 1, 'player');
    expect(cleared).toEqual([{ formationId: 3, x: 40, y: 50 }]);
    expect(w.run.formations.get(3)).toEqual({ alive: 0, total: 3, broken: false });
  });

  it('a member leaving the screen breaks the formation', () => {
    const w = world();
    let cleared = 0;
    w.events.on('formationCleared', () => cleared++);
    const es = formation(w, 2);
    es[0]!.y = 500;
    cleanup(w, 1 / 60);
    expect(es[0]!.active).toBe(false);
    expect(w.run.formations.get(3)!.broken).toBe(true);
    damageEnemy(w, es[1]!, 1, 'player');
    expect(cleared).toBe(0);
  });

  it('a member killed by an asteroid breaks the formation', () => {
    const w = world();
    let cleared = 0;
    w.events.on('formationCleared', () => cleared++);
    const es = formation(w, 2);
    damageEnemy(w, es[0]!, 1, 'asteroid');
    damageEnemy(w, es[1]!, 1, 'player');
    expect(cleared).toBe(0);
    expect(w.run.formations.get(3)).toEqual({ alive: 0, total: 2, broken: true });
  });
});
