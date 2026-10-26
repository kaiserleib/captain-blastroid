import { describe, expect, it } from 'vitest';
import { Pool } from './pool';

interface Thing {
  active: boolean;
  n: number;
}

const make = (cap: number) => new Pool<Thing>('things', cap, () => ({ active: false, n: 0 }));

function live(pool: Pool<Thing>): number[] {
  const out: number[] = [];
  pool.each((t) => out.push(t.n));
  return out;
}

describe('Pool', () => {
  it('preallocates and spawns active objects', () => {
    const pool = make(4);
    expect(pool.items).toHaveLength(4);
    const a = pool.spawn();
    expect(a?.active).toBe(true);
    expect(pool.count).toBe(1);
  });

  it('defers release until compact, preserving order', () => {
    const pool = make(5);
    for (let i = 0; i < 4; i++) pool.spawn()!.n = i;
    const second = pool.items[1]!;
    pool.release(second);
    pool.release(second); // idempotent
    expect(pool.count).toBe(4);
    expect(live(pool)).toEqual([0, 2, 3]);
    pool.compact();
    expect(pool.count).toBe(3);
    expect(live(pool)).toEqual([0, 2, 3]);
    // The released object is recycled by the next spawn.
    expect(pool.spawn()).toBe(second);
  });

  it('refuses spawns at capacity and counts them', () => {
    const pool = make(2);
    pool.spawn();
    pool.spawn();
    expect(pool.spawn()).toBeNull();
    expect(pool.spawn()).toBeNull();
    expect(pool.droppedSpawns).toBe(2);
    pool.release(pool.items[0]!);
    expect(pool.spawn()).toBeNull(); // still full until compact
    pool.compact();
    expect(pool.spawn()).not.toBeNull();
  });

  it('each skips objects spawned or released during the walk', () => {
    const pool = make(8);
    for (let i = 0; i < 3; i++) pool.spawn()!.n = i;
    const visited: number[] = [];
    pool.each((t) => {
      visited.push(t.n);
      if (t.n === 0) {
        pool.release(pool.items[1]!);
        pool.spawn()!.n = 99;
      }
    });
    expect(visited).toEqual([0, 2]);
    expect(live(pool)).toEqual([0, 2, 99]);
  });

  it('clear frees every slot', () => {
    const pool = make(3);
    pool.spawn();
    pool.spawn();
    pool.clear();
    expect(pool.count).toBe(0);
    expect(pool.items.every((t) => !t.active)).toBe(true);
  });
});
