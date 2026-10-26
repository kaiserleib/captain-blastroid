import { COBALT, CANOPY, FLAME, FX, PICKUP, ROCK, SYNDICATE } from '../palette';
import type { Renderer, SpriteOpts } from '../renderer';

export const PARTICLE_CAPACITY = 600;
/** Above this many live particles, new sparks are skipped so bigger effects still fit. */
export const SPARK_SOFT_CAP = 400;

export const PK = {
  spark: 0,
  smoke: 1,
  chunk: 2,
  debris: 3,
  ring: 4,
  sparkle: 5,
} as const;
export type ParticleKind = (typeof PK)[keyof typeof PK];

/** Color ramps, sampled by life fraction (index 0 at birth). */
export const RAMP = {
  hot: 0,
  spark: 1,
  rock: 2,
  smoke: 3,
  shield: 4,
  gold: 5,
  ember: 6,
} as const;
export type RampId = (typeof RAMP)[keyof typeof RAMP];

const RAMPS: readonly (readonly string[])[] = [
  [FX.white, FX.yellow, FX.yellow, FX.orange, FX.red],
  [FX.white, FX.spark, CANOPY.light, CANOPY.base],
  [ROCK.highlight, ROCK.light, ROCK.base, ROCK.dark, ROCK.shadow],
  [FX.smoke, FX.smoke, FX.smokeDark],
  [FX.white, CANOPY.highlight, COBALT.light, COBALT.base],
  [FX.white, PICKUP.highlight, PICKUP.light, PICKUP.base],
  [FX.yellow, FX.orange, FLAME.dark, SYNDICATE.dark],
];

/** Smoke-kind sprite per ramp; dust from rocks reads brown, everything else gray. */
function smokeSprite(ramp: number): string {
  return ramp === RAMP.rock ? 'fx_dust' : 'fx_smoke';
}

const SMOKE_FRAMES = 4;
// Reused for every sprite draw so drawing doesn't allocate.
const spriteOpts: SpriteOpts = { frame: 0 };

/**
 * Structure-of-arrays particle pool. Dead particles are swap-removed, so live
 * ones are always packed in [0, count). Never allocates after construction.
 */
export class ParticlePool {
  readonly capacity: number;
  count = 0;
  /** Spawns refused because the pool was full or sparks were throttled. */
  dropped = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** Per-second velocity retention factor (1 = no drag). */
  readonly drag: Float32Array;
  readonly life: Float32Array;
  readonly ttl: Float32Array;
  readonly size: Float32Array;
  /** Rings: radius growth in px/s. */
  readonly grow: Float32Array;
  readonly kind: Uint8Array;
  readonly ramp: Uint8Array;

  constructor(capacity = PARTICLE_CAPACITY) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.ttl = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.ramp = new Uint8Array(capacity);
  }

  /** Returns the slot index, or -1 when dropped. Never throws. */
  spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    ttl: number,
    ramp: RampId,
    size = 1,
    drag = 1,
    grow = 0,
  ): number {
    if (
      this.count >= this.capacity ||
      ttl <= 0 ||
      (kind === PK.spark && this.count > SPARK_SOFT_CAP)
    ) {
      this.dropped++;
      return -1;
    }
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.ttl[i] = ttl;
    this.life[i] = 0;
    this.ramp[i] = ramp;
    this.size[i] = size;
    this.drag[i] = drag;
    this.grow[i] = grow;
    this.kind[i] = kind;
    return i;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const life = (this.life[i] as number) + dt;
      if (life >= (this.ttl[i] as number)) {
        this.kill(i);
        continue;
      }
      this.life[i] = life;
      const d = this.drag[i] as number;
      if (d < 1) {
        const k = Math.pow(d, dt);
        this.vx[i] = (this.vx[i] as number) * k;
        this.vy[i] = (this.vy[i] as number) * k;
      }
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  /** Smoke goes under the fireballs, so it's drawn in its own pass. */
  drawSmoke(r: Renderer): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== PK.smoke) continue;
      const f = Math.min(
        SMOKE_FRAMES - 1,
        ((this.life[i] as number) / (this.ttl[i] as number)) * SMOKE_FRAMES,
      );
      spriteOpts.frame = f;
      r.sprite(
        smokeSprite(this.ramp[i] as number),
        this.x[i] as number,
        this.y[i] as number,
        spriteOpts,
      );
    }
  }

  draw(r: Renderer, tick: number): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const kind = this.kind[i] as number;
      if (kind === PK.smoke) continue;
      const t = (this.life[i] as number) / (this.ttl[i] as number);
      const ramp = RAMPS[this.ramp[i] as number] as readonly string[];
      const ci = Math.min(ramp.length - 1, (t * ramp.length) | 0);
      const color = ramp[ci] as string;
      const x = this.x[i] as number;
      const y = this.y[i] as number;
      const s = this.size[i] as number;
      switch (kind) {
        case PK.spark: {
          // Tail one step behind the head, in the next-cooler ramp color.
          const tail = ramp[Math.min(ramp.length - 1, ci + 1)] as string;
          r.rect(x - (this.vx[i] as number) / 60, y - (this.vy[i] as number) / 60, s, s, tail);
          r.rect(x, y, s, s, color);
          break;
        }
        case PK.chunk:
          r.rect(x, y, s, s, color);
          if (s > 1 && ci + 1 < ramp.length) {
            r.rect(x + s - 1, y + s - 1, 1, 1, ramp[ci + 1] as string);
          }
          break;
        case PK.debris:
          // Flicker out over the last third, SNES-style.
          if (t > 0.66 && ((tick + i) & 2) !== 0) break;
          r.rect(x, y, s, s, color);
          break;
        case PK.ring: {
          const rad = s + (this.grow[i] as number) * (this.life[i] as number);
          r.circle(x, y, rad, color, false);
          if (t < 0.5)
            r.circle(x, y, rad - 1, ramp[Math.min(ramp.length - 1, ci + 1)] as string, false);
          break;
        }
        case PK.sparkle: {
          // Four-point star that shrinks as it ages.
          const arm = t < 0.5 ? s : s > 1 ? s - 1 : 0;
          r.rect(x, y, 1, 1, color);
          if (arm > 0) {
            r.rect(x - arm, y, arm, 1, color);
            r.rect(x + 1, y, arm, 1, color);
            r.rect(x, y - arm, 1, arm, color);
            r.rect(x, y + 1, 1, arm, color);
          }
          break;
        }
      }
    }
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last] as number;
    this.y[i] = this.y[last] as number;
    this.vx[i] = this.vx[last] as number;
    this.vy[i] = this.vy[last] as number;
    this.drag[i] = this.drag[last] as number;
    this.life[i] = this.life[last] as number;
    this.ttl[i] = this.ttl[last] as number;
    this.size[i] = this.size[last] as number;
    this.grow[i] = this.grow[last] as number;
    this.kind[i] = this.kind[last] as number;
    this.ramp[i] = this.ramp[last] as number;
  }
}
