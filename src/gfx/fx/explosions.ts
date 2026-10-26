import type { Rng } from '../../engine/rng';
import type { Renderer, SpriteOpts } from '../renderer';
import { BOOM_FRAMES, boomSprite, type BoomSize } from './fx.sprites';
import { PK, RAMP, type ParticlePool } from './particles';

const BOOM_CAPACITY = 64;
const CHAIN_CAPACITY = 6;
/** Seconds per frame; bigger booms burn a little longer. */
const FRAME_DUR: Record<BoomSize, number> = { 16: 0.04, 32: 0.05, 48: 0.06 };
/** Fraction of the dying entity's velocity the fireball keeps. */
const INHERIT = 0.3;

interface Recipe {
  sparks: number;
  sparkSpeed: number;
  smoke: number;
  embers: number;
  ring: boolean;
}

const RECIPES: Record<BoomSize, Recipe> = {
  16: { sparks: 6, sparkSpeed: 90, smoke: 2, embers: 0, ring: false },
  32: { sparks: 12, sparkSpeed: 130, smoke: 4, embers: 6, ring: true },
  48: { sparks: 18, sparkSpeed: 170, smoke: 7, embers: 12, ring: true },
};

const SIZES: readonly BoomSize[] = [16, 32, 48];
const SPRITES = SIZES.map(boomSprite);
const spriteOpts: SpriteOpts = { frame: 0 };

export interface ChainOpts {
  radius: number;
  count: number;
  duration: number;
  /** Called after the last pop, e.g. for a finale boom and screen flash. */
  onDone?: (x: number, y: number) => void;
}

/** Sprite-frame fireballs plus their particle bursts, and timed chains of them. */
export class Explosions {
  count = 0;
  private readonly bx = new Float32Array(BOOM_CAPACITY);
  private readonly by = new Float32Array(BOOM_CAPACITY);
  private readonly bvx = new Float32Array(BOOM_CAPACITY);
  private readonly bvy = new Float32Array(BOOM_CAPACITY);
  private readonly bt = new Float32Array(BOOM_CAPACITY);
  private readonly bsize = new Uint8Array(BOOM_CAPACITY);

  private readonly chains = Array.from({ length: CHAIN_CAPACITY }, () => ({
    active: false,
    x: 0,
    y: 0,
    radius: 0,
    left: 0,
    interval: 0,
    timer: 0,
    onDone: undefined as ChainOpts['onDone'],
  }));

  constructor(
    private readonly particles: ParticlePool,
    private readonly rng: () => Rng,
  ) {}

  get activeChains(): number {
    let n = 0;
    for (const c of this.chains) if (c.active) n++;
    return n;
  }

  explode(x: number, y: number, size: BoomSize, vx = 0, vy = 0): void {
    const si = SIZES.indexOf(size);
    if (this.count < BOOM_CAPACITY && si >= 0) {
      const i = this.count++;
      this.bx[i] = x;
      this.by[i] = y;
      this.bvx[i] = vx * INHERIT;
      this.bvy[i] = vy * INHERIT;
      this.bt[i] = 0;
      this.bsize[i] = si;
    }
    this.burst(x, y, size, vx * INHERIT, vy * INHERIT);
  }

  /** Staggered pops scattered around (x, y); the last one is always the biggest. */
  chain(x: number, y: number, o: ChainOpts): void {
    const c = this.chains.find((k) => !k.active);
    if (!c || o.count <= 0) return;
    c.active = true;
    c.x = x;
    c.y = y;
    c.radius = o.radius;
    c.left = o.count;
    c.interval = o.duration / o.count;
    c.timer = 0;
    c.onDone = o.onDone;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const size = SIZES[this.bsize[i] as number] as BoomSize;
      const t = (this.bt[i] as number) + dt;
      if (t >= FRAME_DUR[size] * BOOM_FRAMES) {
        this.remove(i);
        continue;
      }
      this.bt[i] = t;
      this.bx[i] = (this.bx[i] as number) + (this.bvx[i] as number) * dt;
      this.by[i] = (this.by[i] as number) + (this.bvy[i] as number) * dt;
      i++;
    }

    const rng = this.rng();
    for (const c of this.chains) {
      if (!c.active) continue;
      c.timer -= dt;
      while (c.active && c.timer <= 0) {
        c.timer += c.interval;
        c.left--;
        if (c.left <= 0) {
          c.active = false;
          this.explode(c.x, c.y, 48);
          c.onDone?.(c.x, c.y);
          break;
        }
        const a = rng.range(0, Math.PI * 2);
        const d = c.radius * Math.sqrt(rng.next());
        this.explode(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rng.chance(0.35) ? 16 : 32);
      }
    }
  }

  /** `back`: seconds to extrapolate backwards from the last tick (render interpolation). */
  draw(r: Renderer, back = 0): void {
    for (let i = 0; i < this.count; i++) {
      const size = SIZES[this.bsize[i] as number] as BoomSize;
      spriteOpts.frame = (this.bt[i] as number) / FRAME_DUR[size];
      r.sprite(
        SPRITES[this.bsize[i] as number] as string,
        (this.bx[i] as number) - (this.bvx[i] as number) * back,
        (this.by[i] as number) - (this.bvy[i] as number) * back,
        spriteOpts,
      );
    }
  }

  clear(): void {
    this.count = 0;
    for (const c of this.chains) c.active = false;
  }

  private burst(x: number, y: number, size: BoomSize, vx: number, vy: number): void {
    const rec = RECIPES[size];
    const rng = this.rng();
    const p = this.particles;
    const rad = size * 0.3;
    for (let i = 0; i < rec.smoke; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, rad);
      const s = rng.range(8, 22);
      p.spawn(
        PK.smoke,
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        vx + Math.cos(a) * s,
        vy + Math.sin(a) * s - 6,
        rng.range(0.45, 0.8) + size * 0.008,
        RAMP.smoke,
        1,
        0.2,
      );
    }
    for (let i = 0; i < rec.sparks; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rec.sparkSpeed * rng.range(0.5, 1.1);
      p.spawn(
        PK.spark,
        x,
        y,
        vx + Math.cos(a) * s,
        vy + Math.sin(a) * s,
        rng.range(0.15, 0.32),
        RAMP.hot,
        1,
        0.03,
      );
    }
    for (let i = 0; i < rec.embers; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(30, 80);
      p.spawn(
        PK.debris,
        x,
        y,
        vx + Math.cos(a) * s,
        vy + Math.sin(a) * s,
        rng.range(0.4, 0.8),
        RAMP.ember,
        rng.chance(0.3) ? 2 : 1,
        0.15,
      );
    }
    if (rec.ring) p.spawn(PK.ring, x, y, vx, vy, 0.22, RAMP.hot, size * 0.25, 1, size * 1.6);
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.bx[i] = this.bx[last] as number;
    this.by[i] = this.by[last] as number;
    this.bvx[i] = this.bvx[last] as number;
    this.bvy[i] = this.bvy[last] as number;
    this.bt[i] = this.bt[last] as number;
    this.bsize[i] = this.bsize[last] as number;
  }
}
