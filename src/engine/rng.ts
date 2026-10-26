// Ported from ../siege-and-shuffle so seeds behave identically across both projects.

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Only for picking a fresh run seed outside the sim. */
export function randomSeedString(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_CHARS[(Math.random() * SEED_CHARS.length) | 0];
  return s;
}

export interface Rng {
  readonly seed: number;
  /** [0, 1) */
  next(): number;
  /** [a, b) */
  range(a: number, b: number): number;
  /** Integer in [a, b], inclusive. */
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  /**
   * Independent stream derived from this rng's seed and `label` only, so it is
   * unaffected by how much the parent has been consumed.
   */
  fork(label: string): Rng;
}

class Mulberry32 implements Rng {
  private s: number;

  constructor(readonly seed: number) {
    this.s = seed | 0;
  }

  next(): number {
    // Inlined mulberry32 so the hot path doesn't go through a closure.
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return a + Math.floor((b - a + 1) * this.next());
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('rng.pick: empty array');
    return arr[Math.floor(arr.length * this.next())] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  fork(label: string): Rng {
    return new Mulberry32(hashSeed(label) ^ Math.imul(this.seed, 0x9e3779b1));
  }
}

export function createRng(seed: number | string): Rng {
  return new Mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
}
